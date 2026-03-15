import { normalizeProviderSessionStatus } from "../../../../../src/application/agent-runtime";
import type { Company } from "../../../../../src/domain/org/types";
import type {
  AuthorityEvent,
  AuthorityExecutorConfig,
  AuthorityExecutorConfigPatch,
} from "../../../../../src/infrastructure/authority/contract";
import {
  EXECUTOR_PROVIDER_ID,
  isAgentNotFoundError,
  sessionStatusCapabilityState,
  setSyncAuthorityAgentFileMirror,
  type StoredExecutorConfig,
  updateSessionStatusCapability,
} from "../../persistence/authority-persistence-shared";
import type { AuthorityRepository } from "../../persistence/authority-repository";
import { buildAuthorityExecutorSnapshot } from "../executor-status";
import { runAuthorityExecutorConfigPatch } from "../executor-config-command";
import { createAuthorityGatewayProxy } from "../gateway-proxy";
import {
  refreshGatewayAuthRuntimeSnapshot,
  waitForGatewayReconnect,
} from "../gateway-runtime-refresh";
import { createManagedFileMirrorQueue } from "../managed-file-mirror";
import { createOpenClawExecutorBridge } from "../openclaw-bridge";
import {
  resolveLocalOpenClawGatewayToken,
  syncLocalCodexAuthToAgents,
} from "../openclaw-local-auth";
import { createAuthorityManagedExecutor } from "./authority-managed-executor";
import { registerAuthorityNativeEventStream } from "./authority-native-event-stream";

type AuthorityNativeIntegrationDependencies = {
  repository: AuthorityRepository;
  broadcast: (event: AuthorityEvent) => void;
};

export function createAuthorityNativeIntegration(
  deps: AuthorityNativeIntegrationDependencies,
) {
  const { repository, broadcast } = deps;
  const executorBridge = createOpenClawExecutorBridge(repository.loadExecutorConfig(), {
    resolveFallbackToken: () => resolveLocalOpenClawGatewayToken(),
  });
  const managedFileMirrorQueue = createManagedFileMirrorQueue((file) =>
    executorBridge.request("agents.files.set", file),
  );

  function getExecutorSnapshot() {
    const current = repository.loadExecutorConfig();
    const snapshot = buildAuthorityExecutorSnapshot({
      storedConfig: current,
      bridgeSnapshot: executorBridge.snapshot(),
      executorStatus: executorBridge.status(),
      sessionStatusCapabilityState,
      resolveLocalToken: resolveLocalOpenClawGatewayToken,
    });
    repository.saveExecutorConfig(snapshot.nextStoredConfig as StoredExecutorConfig);
    return {
      executor: snapshot.executor,
      executorConfig: snapshot.executorConfig,
      executorCapabilities: snapshot.executorCapabilities,
    };
  }

  function buildHealthSnapshot() {
    return repository.getHealth(getExecutorSnapshot());
  }

  function buildBootstrapSnapshot() {
    return repository.getBootstrap(getExecutorSnapshot());
  }

  function broadcastExecutorStatus() {
    const snapshot = getExecutorSnapshot();
    broadcast({
      type: "executor.status",
      timestamp: Date.now(),
      payload: {
        executor: snapshot.executor,
        executorConfig: snapshot.executorConfig,
      },
    });
  }

  function broadcastBootstrapUpdated(companyId?: string) {
    broadcast({ type: "bootstrap.updated", companyId, timestamp: Date.now() });
  }

  function broadcastCompanyUpdated(companyId: string) {
    broadcast({ type: "company.updated", companyId, timestamp: Date.now() });
  }

  const managedExecutor = createAuthorityManagedExecutor({
    repository,
    executorBridge,
    syncManagedFile: (file) => managedFileMirrorQueue.sync(file),
    onCompaniesChanged: (changedCompanyIds) => {
      if (changedCompanyIds.length === 0) {
        return;
      }
      broadcastBootstrapUpdated();
      changedCompanyIds.forEach((companyId) => {
        broadcastCompanyUpdated(companyId);
      });
    },
  });

  setSyncAuthorityAgentFileMirror((file) => {
    void managedExecutor.syncAgentFileToExecutor(file).catch((error) => {
      if (isAgentNotFoundError(error)) {
        void managedExecutor.queueManagedExecutorSync(`agent-file-miss:${file.agentId}`);
        return;
      }
      console.warn(`Failed to mirror ${file.name} to executor for ${file.agentId}`, error);
    });
  });

  const proxyGatewayRequest = createAuthorityGatewayProxy({
    requestExecutor: (method, params) => executorBridge.request(method, params ?? {}),
    repository,
    providerId: EXECUTOR_PROVIDER_ID,
    getSessionStatusCapabilityState: () => sessionStatusCapabilityState,
    updateSessionStatusCapability,
    normalizeProviderSessionStatus,
  });

  registerAuthorityNativeEventStream({
    repository,
    executorBridge,
    broadcast,
    queueManagedExecutorSync: managedExecutor.queueManagedExecutorSync,
    broadcastExecutorStatus,
    broadcastCompanyUpdated,
  });

  async function syncCompanyCodexAuth(companyId: string, source: "cli" | "gateway" = "cli") {
    const company = findStoredCompanyOrThrow(repository, companyId);
    const agentIds = company.employees
      .map((employee) => employee.agentId?.trim())
      .filter((agentId): agentId is string => Boolean(agentId));
    const result = syncLocalCodexAuthToAgents(agentIds, { preferredSource: source });
    if (!result.changed) {
      return result;
    }
    const gatewayRefresh = await refreshGatewayAuthRuntimeSnapshot(
      proxyGatewayRequest,
      `刷新 Codex 授权后重载 OpenClaw auth/runtime snapshot（company=${companyId} source=${source}）`,
    );
    const gatewayReconnect = await waitForGatewayReconnect(() => executorBridge.reconnect());
    return {
      ...result,
      gatewayRefresh: {
        ...gatewayRefresh,
        ...gatewayReconnect,
      },
    };
  }

  function patchExecutorConfig(body: AuthorityExecutorConfigPatch): Promise<AuthorityExecutorConfig> {
    return runAuthorityExecutorConfigPatch({
      body,
      deps: {
        loadExecutorConfig: () => repository.loadExecutorConfig(),
        saveExecutorConfig: (config) => repository.saveExecutorConfig(config),
        patchExecutorBridgeConfig: (config) => executorBridge.patchConfig(config),
        broadcastExecutorStatus,
        queueManagedExecutorSync: managedExecutor.queueManagedExecutorSync,
        getExecutorSnapshotConfig: () => getExecutorSnapshot().executorConfig,
      },
    });
  }

  return {
    executorProviderId: EXECUTOR_PROVIDER_ID,
    buildHealthSnapshot,
    buildBootstrapSnapshot,
    getExecutorSnapshot,
    getExecutorConfig: () => getExecutorSnapshot().executorConfig,
    getExecutorState: () => executorBridge.status().state,
    patchExecutorConfig,
    proxyGatewayRequest,
    syncCompanyCodexAuth,
    syncAgentFileToExecutor: managedExecutor.syncAgentFileToExecutor,
    deleteManagedAgentFromExecutor: managedExecutor.deleteManagedAgentFromExecutor,
    runManagedExecutorMutation: managedExecutor.runManagedExecutorMutation,
    listExecutorAgentIds: managedExecutor.listExecutorAgentIds,
    listManagedProvisioningAgentIds: managedExecutor.listManagedProvisioningAgentIds,
    updateCompanyExecutorProvisioning: managedExecutor.updateCompanyExecutorProvisioning,
    resolveProvisioningFailureState: managedExecutor.resolveProvisioningFailureState,
    ensureManagedCompanyExecutorProvisioned: managedExecutor.ensureManagedCompanyExecutorProvisioned,
    ensureManagedCompanyExecutorProvisionedBestEffort:
      managedExecutor.ensureManagedCompanyExecutorProvisionedBestEffort,
    queueManagedExecutorSync: managedExecutor.queueManagedExecutorSync,
    connectExecutor: () => executorBridge.reconnect(),
    requestSessionStatus: (sessionKey: string) => executorBridge.request("session_status", { sessionKey }),
    getSessionStatusCapabilityState: () => sessionStatusCapabilityState,
    updateSessionStatusCapability,
    normalizeProviderSessionStatus,
    applyRuntimeSessionStatus: (companyId: string, status: ReturnType<typeof normalizeProviderSessionStatus>) =>
      repository.applyRuntimeSessionStatus(companyId, status),
    broadcastBootstrapUpdated,
    broadcastCompanyUpdated,
  };
}

function findStoredCompanyOrThrow(repository: AuthorityRepository, companyId: string): Company {
  const config = repository.loadConfig();
  const company = config?.companies.find((candidate) => candidate.id === companyId) ?? null;
  if (!company) {
    throw new Error(`Company not found: ${companyId}`);
  }
  return company;
}
