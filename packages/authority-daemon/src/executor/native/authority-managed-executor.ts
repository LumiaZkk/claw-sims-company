import type { Company, CyberCompanyConfig } from "../../../../../src/domain/org/types";
import type { AuthorityCompanyRuntimeSnapshot } from "../../../../../src/infrastructure/authority/contract";
import {
  isAgentAlreadyExistsError,
  isAgentNotFoundError,
  isLegacyAgentsDeletePurgeStateError,
  isPresent,
  normalizeCompany,
  readString,
  stringifyError,
} from "../../persistence/authority-persistence-shared";
import type { AuthorityRepository } from "../../persistence/authority-repository";
import {
  buildManagedExecutorProjectionFiles,
  buildManagedExecutorProjectionFilesForCompany,
  listDesiredManagedExecutorAgents,
  planManagedExecutorReconcile,
  resolveManagedExecutorProvisioningState,
} from "../../company/company-executor-sync";
import { syncManagedExecutorWorkspacePlugin } from "../../company/company-workspace-plugin-sync";
import { waitForExecutorAgentsAbsent } from "../../company/company-delete";
import { createOpenClawExecutorBridge } from "../openclaw-bridge";

type ExecutorAgentsListResult = {
  agents?: Array<{ id?: string }>;
};

const EXECUTOR_AGENT_VISIBILITY_TIMEOUT_MS = 15_000;
const EXECUTOR_AGENT_VISIBILITY_POLL_MS = 200;
const EXECUTOR_AGENT_CREATE_ATTEMPTS = 2;

export function createAuthorityManagedExecutor(input: {
  repository: AuthorityRepository;
  executorBridge: ReturnType<typeof createOpenClawExecutorBridge>;
  syncManagedFile: (input: { agentId: string; name: string; content: string }) => Promise<unknown>;
  onCompaniesChanged?: (companyIds: string[]) => void;
}) {
  const { repository, executorBridge, syncManagedFile, onCompaniesChanged } = input;

  let managedExecutorMutationTail: Promise<void> = Promise.resolve();
  let managedExecutorSyncPromise: Promise<void> | null = null;
  let managedExecutorSyncQueued = false;

  async function syncAgentFileToExecutor(input: { agentId: string; name: string; content: string }) {
    return syncManagedFile(input);
  }

  async function deleteManagedAgentFromExecutor(agentId: string) {
    try {
      await executorBridge.request("agents.delete", {
        agentId,
        deleteFiles: true,
        purgeState: true,
      });
    } catch (error) {
      if (isLegacyAgentsDeletePurgeStateError(error)) {
        await executorBridge.request("agents.delete", {
          agentId,
          deleteFiles: true,
        });
        return;
      }
      throw error;
    }

    const remainingAgentIds = await waitForExecutorAgentsAbsent({
      agentIds: [agentId],
      listExecutorAgentIds,
      timeoutMs: EXECUTOR_AGENT_VISIBILITY_TIMEOUT_MS,
      pollMs: EXECUTOR_AGENT_VISIBILITY_POLL_MS,
    });
    if (remainingAgentIds.size > 0) {
      throw new Error(`OpenClaw agent ${agentId} 在删除后仍可见。`);
    }
  }

  function runManagedExecutorMutation<T>(task: () => Promise<T>) {
    const previous = managedExecutorMutationTail.catch(() => {});
    let releaseCurrent!: () => void;
    managedExecutorMutationTail = new Promise<void>((resolve) => {
      releaseCurrent = resolve;
    });
    return previous.then(task).finally(() => {
      releaseCurrent();
    });
  }

  async function listExecutorAgentIds() {
    const listed = await executorBridge.request<ExecutorAgentsListResult>("agents.list", {});
    return new Set((listed.agents ?? []).map((agent) => readString(agent.id)).filter(isPresent));
  }

  function delay(ms: number) {
    return new Promise((resolve) => {
      setTimeout(resolve, ms);
    });
  }

  async function waitForExecutorAgentsVisible(agentIds: string[]) {
    if (agentIds.length === 0) {
      return new Set<string>();
    }

    const remaining = new Set(agentIds);
    const deadline = Date.now() + EXECUTOR_AGENT_VISIBILITY_TIMEOUT_MS;

    while (remaining.size > 0 && Date.now() < deadline) {
      try {
        const existingAgentIds = await listExecutorAgentIds();
        for (const agentId of remaining) {
          if (existingAgentIds.has(agentId)) {
            remaining.delete(agentId);
          }
        }
        if (remaining.size === 0) {
          return existingAgentIds;
        }
      } catch {
        // Keep polling until timeout so transient list failures do not abort reconcile.
      }

      await delay(EXECUTOR_AGENT_VISIBILITY_POLL_MS);
    }

    try {
      return await listExecutorAgentIds();
    } catch {
      return new Set<string>();
    }
  }

  function buildStandaloneCompanyConfig(company: Company): CyberCompanyConfig {
    return {
      version: 1,
      companies: [company],
      activeCompanyId: company.id,
      preferences: { theme: "classic", locale: "zh-CN" },
    };
  }

  function listManagedProvisioningAgentIds(company: Company) {
    return listDesiredManagedExecutorAgents(buildStandaloneCompanyConfig(company)).map(
      (target) => target.agentId,
    );
  }

  function updateCompanyExecutorProvisioning(input: {
    companyId: string;
    state: "ready" | "degraded" | "blocked";
    pendingAgentIds?: string[];
    lastError?: string | null;
    activeCompanyId?: string | null;
    updatedAt?: number;
  }) {
    const currentConfig = repository.loadConfig();
    if (!currentConfig) {
      return null;
    }
    let nextCompany: Company | null = null;
    const nextConfig: CyberCompanyConfig = {
      ...currentConfig,
      activeCompanyId: input.activeCompanyId ?? currentConfig.activeCompanyId,
      companies: currentConfig.companies.map((company) => {
        if (company.id !== input.companyId) {
          return company;
        }
        nextCompany = normalizeCompany({
          ...company,
          system: {
            ...(company.system ?? {}),
            executorProvisioning: {
              state: input.state,
              pendingAgentIds:
                input.pendingAgentIds && input.pendingAgentIds.length > 0 ? input.pendingAgentIds : [],
              lastError: input.lastError ?? null,
              updatedAt: input.updatedAt ?? Date.now(),
            },
          },
        });
        return nextCompany;
      }),
    };
    if (!nextCompany) {
      return null;
    }
    repository.saveConfig(nextConfig);
    return nextCompany;
  }

  function resolveProvisioningFailureState() {
    return executorBridge.status().state === "ready" ? "degraded" : "blocked";
  }

  function groupManagedFilesByAgent(files: Array<{ agentId: string; name: string; content: string }>) {
    const grouped = new Map<string, Array<{ agentId: string; name: string; content: string }>>();
    for (const file of files) {
      const current = grouped.get(file.agentId);
      if (current) {
        current.push(file);
        continue;
      }
      grouped.set(file.agentId, [file]);
    }
    return grouped;
  }

  function dedupeFilesByKey(files: Array<{ agentId: string; name: string; content: string }>) {
    const deduped = new Map<string, { agentId: string; name: string; content: string }>();
    for (const file of files) {
      deduped.set(`${file.agentId}:${file.name}`, file);
    }
    return [...deduped.values()];
  }

  async function ensureExecutorAgentVisible(
    target: { agentId: string; workspace: string },
    reason: string,
  ) {
    for (let attempt = 1; attempt <= EXECUTOR_AGENT_CREATE_ATTEMPTS; attempt += 1) {
      try {
        const existingAgentIds = await listExecutorAgentIds();
        if (existingAgentIds.has(target.agentId)) {
          return;
        }
      } catch {
        // Fall through and retry create below.
      }

      try {
        await executorBridge.request("agents.create", {
          name: target.agentId,
          workspace: target.workspace,
        });
      } catch (error) {
        if (!isAgentAlreadyExistsError(error)) {
          throw error;
        }
      }

      const visibleAgentIds = await waitForExecutorAgentsVisible([target.agentId]);
      if (visibleAgentIds.has(target.agentId)) {
        return;
      }
    }

    throw new Error(`OpenClaw agent ${target.agentId} 在创建后仍不可见（${reason}）。`);
  }

  async function syncManagedFilesForAgent(
    agentId: string,
    files: Array<{ agentId: string; name: string; content: string }>,
    reason: string,
  ) {
    for (const file of files) {
      try {
        await syncAgentFileToExecutor(file);
      } catch (error) {
        throw new Error(`无法同步 ${file.name} 到 ${agentId}（${reason}）：${stringifyError(error)}`);
      }
    }
  }

  async function syncManagedWorkspacePluginForTarget(
    target: { agentId: string; workspace: string },
    reason: string,
  ) {
    try {
      await syncManagedExecutorWorkspacePlugin(target);
    } catch (error) {
      throw new Error(
        `无法安装 sims-company 插件到 ${target.agentId}（${reason}）：${stringifyError(error)}`,
      );
    }
  }

  async function ensureManagedCompanyExecutorProvisioned(
    company: Company,
    runtime: AuthorityCompanyRuntimeSnapshot,
    reason: string,
  ) {
    if (executorBridge.status().state !== "ready") {
      throw new Error("Authority 尚未连接到 OpenClaw，无法确认 agent 已创建。");
    }

    const targets = listDesiredManagedExecutorAgents(buildStandaloneCompanyConfig(company));
    const filesByAgent = groupManagedFilesByAgent(
      buildManagedExecutorProjectionFilesForCompany(company, {
        activeWorkItems: runtime.activeWorkItems,
        activeSupportRequests: runtime.activeSupportRequests,
        activeEscalations: runtime.activeEscalations,
        activeDecisionTickets: runtime.activeDecisionTickets,
      }),
    );

    for (const target of targets) {
      await ensureExecutorAgentVisible(target, reason);
      await syncManagedWorkspacePluginForTarget(target, reason);
      await syncManagedFilesForAgent(target.agentId, filesByAgent.get(target.agentId) ?? [], reason);
    }
  }

  async function ensureManagedCompanyExecutorProvisionedBestEffort(
    company: Company,
    runtime: AuthorityCompanyRuntimeSnapshot,
    reason: string,
  ) {
    if (executorBridge.status().state !== "ready") {
      throw new Error("Authority 尚未连接到 OpenClaw，无法确认 agent 已创建。");
    }

    const targets = listDesiredManagedExecutorAgents(buildStandaloneCompanyConfig(company));
    const filesByAgent = groupManagedFilesByAgent(
      buildManagedExecutorProjectionFilesForCompany(company, {
        activeWorkItems: runtime.activeWorkItems,
        activeSupportRequests: runtime.activeSupportRequests,
        activeEscalations: runtime.activeEscalations,
        activeDecisionTickets: runtime.activeDecisionTickets,
      }),
    );

    let visibleAgentIds = new Set<string>();
    try {
      visibleAgentIds = await listExecutorAgentIds();
    } catch {
      visibleAgentIds = new Set<string>();
    }

    for (const target of targets) {
      if (visibleAgentIds.has(target.agentId)) {
        continue;
      }
      try {
        await executorBridge.request("agents.create", {
          name: target.agentId,
          workspace: target.workspace,
        });
      } catch (error) {
        if (!isAgentAlreadyExistsError(error)) {
          throw error;
        }
      }
    }

    try {
      visibleAgentIds = await listExecutorAgentIds();
    } catch {
      visibleAgentIds = new Set<string>();
    }

    const missingTargets = targets.filter((target) => !visibleAgentIds.has(target.agentId));
    if (missingTargets.length > 0) {
      throw new Error(`OpenClaw agent ${missingTargets[0]!.agentId} 在创建后暂未可见（${reason}）。`);
    }

    for (const target of targets) {
      await syncManagedWorkspacePluginForTarget(target, reason);
      await syncManagedFilesForAgent(target.agentId, filesByAgent.get(target.agentId) ?? [], reason);
    }
  }

  async function reconcileManagedExecutorState(reason: string) {
    if (executorBridge.status().state !== "ready") {
      return [];
    }

    let existingAgentIds = new Set<string>();
    try {
      existingAgentIds = await listExecutorAgentIds();
    } catch (error) {
      console.warn(`Failed to list OpenClaw agents during Authority reconcile (${reason}).`, error);
    }

    const currentConfig = repository.loadConfig();
    if (!currentConfig) {
      return [];
    }
    const reconcilePlan = planManagedExecutorReconcile({
      trackedAgents: repository.listManagedExecutorAgents(),
      desiredTargets: listDesiredManagedExecutorAgents(currentConfig),
      existingAgentIds,
    });

    for (const agentId of reconcilePlan.deleteAgentIds) {
      try {
        await deleteManagedAgentFromExecutor(agentId);
        repository.clearManagedExecutorAgent(agentId);
        existingAgentIds.delete(agentId);
      } catch (error) {
        if (isAgentNotFoundError(error)) {
          repository.clearManagedExecutorAgent(agentId);
          existingAgentIds.delete(agentId);
          continue;
        }
        console.warn(`Failed to delete managed OpenClaw agent ${agentId} (${reason}).`, error);
      }
    }

    const createdAgentIds: string[] = [];
    for (const target of reconcilePlan.createTargets) {
      try {
        await executorBridge.request("agents.create", {
          name: target.agentId,
          workspace: target.workspace,
        });
        createdAgentIds.push(target.agentId);
      } catch (error) {
        if (isAgentAlreadyExistsError(error)) {
          existingAgentIds.add(target.agentId);
          continue;
        }
        console.warn(`Failed to create managed OpenClaw agent ${target.agentId} (${reason}).`, error);
      }
    }

    if (createdAgentIds.length > 0) {
      existingAgentIds = await waitForExecutorAgentsVisible(createdAgentIds);
      const stillMissing = createdAgentIds.filter((agentId) => !existingAgentIds.has(agentId));
      if (stillMissing.length > 0) {
        console.warn(
          `Managed OpenClaw agent(s) not yet visible after create (${reason}): ${stillMissing.join(", ")}`,
        );
      }
    }

    const runtimeByCompanyId = new Map(
      currentConfig.companies.map((company) => [company.id, repository.loadRuntime(company.id)] as const),
    );
    const managedFiles = buildManagedExecutorProjectionFiles(currentConfig, runtimeByCompanyId).filter((file) =>
      existingAgentIds.has(file.agentId),
    );
    const pluginTargets = new Map(
      listDesiredManagedExecutorAgents(currentConfig)
        .filter((target) => existingAgentIds.has(target.agentId))
        .map((target) => [target.agentId, target] as const),
    );
    const pluginSyncFailedAgentIds = new Set<string>();
    for (const target of pluginTargets.values()) {
      try {
        await syncManagedWorkspacePluginForTarget(target, reason);
      } catch (error) {
        pluginSyncFailedAgentIds.add(target.agentId);
        console.warn(
          `Failed to install managed workspace plugin for ${target.agentId} (${reason}).`,
          error,
        );
      }
    }
    const projectionKeys = new Set(managedFiles.map((file) => `${file.agentId}:${file.name}`));
    const storedAgentFiles = [...existingAgentIds].flatMap((agentId) =>
      repository.listAgentFiles(agentId).files.map((file) => ({
        agentId,
        name: file.name,
        content: file.content ?? "",
      })),
    );
    const filesToSync = dedupeFilesByKey([
      ...managedFiles,
      ...storedAgentFiles.filter((file) => projectionKeys.has(`${file.agentId}:${file.name}`)),
    ]);
    const fileResults = await Promise.allSettled(filesToSync.map((file) => syncAgentFileToExecutor(file)));
    const failures = fileResults.filter((result) => result.status === "rejected");
    const fileSyncFailedAgentIds = new Set<string>(pluginSyncFailedAgentIds);
    fileResults.forEach((result, index) => {
      if (result.status === "rejected") {
        const agentId = filesToSync[index]?.agentId;
        if (agentId) {
          fileSyncFailedAgentIds.add(agentId);
        }
      }
    });
    if (failures.length > 0) {
      console.warn(`Failed to mirror ${failures.length} managed company file(s) to OpenClaw executor (${reason}).`);
    }

    const changedCompanyIds: string[] = [];
    for (const company of currentConfig.companies) {
      const nextProvisioning = resolveManagedExecutorProvisioningState({
        company,
        visibleAgentIds: existingAgentIds,
        bridgeState: executorBridge.status().state,
        fileSyncFailedAgentIds,
      });
      const previousProvisioning = company.system?.executorProvisioning;
      const pendingChanged =
        (previousProvisioning?.pendingAgentIds ?? []).join("\n")
        !== (nextProvisioning.pendingAgentIds ?? []).join("\n");
      if (
        previousProvisioning?.state !== nextProvisioning.state
        || (previousProvisioning?.lastError ?? null) !== nextProvisioning.lastError
        || pendingChanged
      ) {
        updateCompanyExecutorProvisioning({
          companyId: company.id,
          state: nextProvisioning.state,
          pendingAgentIds: nextProvisioning.pendingAgentIds,
          lastError: nextProvisioning.lastError,
          updatedAt: nextProvisioning.updatedAt,
        });
        changedCompanyIds.push(company.id);
      }
    }

    return changedCompanyIds;
  }

  function queueManagedExecutorSync(reason: string) {
    if (managedExecutorSyncPromise) {
      managedExecutorSyncQueued = true;
      return managedExecutorSyncPromise;
    }

    managedExecutorSyncPromise = runManagedExecutorMutation(async () => {
      return await reconcileManagedExecutorState(reason);
    })
      .then((changedCompanyIds) => {
        if (!changedCompanyIds?.length) {
          return;
        }
        onCompaniesChanged?.(changedCompanyIds);
      })
      .catch((error) => {
        console.warn(`Managed OpenClaw reconcile failed (${reason}).`, error);
      })
      .finally(() => {
        managedExecutorSyncPromise = null;
        if (managedExecutorSyncQueued) {
          managedExecutorSyncQueued = false;
          void queueManagedExecutorSync("queued");
        }
      });
    return managedExecutorSyncPromise;
  }

  return {
    syncAgentFileToExecutor,
    deleteManagedAgentFromExecutor,
    runManagedExecutorMutation,
    listExecutorAgentIds,
    listManagedProvisioningAgentIds,
    updateCompanyExecutorProvisioning,
    resolveProvisioningFailureState,
    ensureManagedCompanyExecutorProvisioned,
    ensureManagedCompanyExecutorProvisionedBestEffort,
    queueManagedExecutorSync,
  };
}
