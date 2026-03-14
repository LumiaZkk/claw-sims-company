import type { AgentControlSnapshot, GatewayModelChoice, GatewaySessionRow } from "./index";
import { gateway } from "./index";
import { waitForGatewayChatRunTerminal } from "./chat-run";

type SessionModelPlanEntry = {
  actorId: string;
  model: string;
  sessionKey: string;
};

type SessionLike = Pick<GatewaySessionRow, "actorId" | "key">;
type ControlLike = Pick<AgentControlSnapshot, "defaultModel" | "modelOverride">;
type CompanyLike = {
  employees?: Array<{
    agentId?: string | null;
  } | null> | null;
} | null | undefined;

function normalizeNonEmptyString(value: string | null | undefined): string | null {
  if (typeof value !== "string") {
    return null;
  }
  const normalized = value.trim();
  return normalized.length > 0 ? normalized : null;
}

function resolveEffectiveModel(snapshot: ControlLike | null | undefined): string | null {
  return normalizeNonEmptyString(snapshot?.modelOverride) ?? normalizeNonEmptyString(snapshot?.defaultModel);
}

function resolveGatewaySessionModelRef(
  session: Pick<GatewaySessionRow, "model" | "modelProvider"> | null | undefined,
) {
  const model = normalizeNonEmptyString(session?.model);
  const provider = normalizeNonEmptyString(session?.modelProvider);
  if (model && model.includes("/")) {
    return model;
  }
  if (provider && model) {
    return `${provider}/${model}`;
  }
  return model;
}

export function isCodexModelRef(modelRef: string | null | undefined): boolean {
  const normalized = normalizeNonEmptyString(modelRef);
  return normalized ? normalized.startsWith("openai-codex/") : false;
}

export function buildCodexSessionReapplyPlan(input: {
  sessions: SessionLike[];
  controlSnapshots: Record<string, ControlLike | null | undefined>;
}): SessionModelPlanEntry[] {
  const plannedSessionKeys = new Set<string>();
  const plan: SessionModelPlanEntry[] = [];

  for (const session of input.sessions) {
    const sessionKey = normalizeNonEmptyString(session.key);
    const actorId = normalizeNonEmptyString(session.actorId);
    if (!sessionKey || !actorId || plannedSessionKeys.has(sessionKey)) {
      continue;
    }

    const effectiveModel = resolveEffectiveModel(input.controlSnapshots[actorId]);
    if (!effectiveModel || !isCodexModelRef(effectiveModel)) {
      continue;
    }

    plannedSessionKeys.add(sessionKey);
    plan.push({
      actorId,
      model: effectiveModel,
      sessionKey,
    });
  }

  return plan;
}

export function countCodexSessionReapplySuccesses(input: {
  plan: SessionModelPlanEntry[];
  sessions: Array<Pick<GatewaySessionRow, "key" | "model" | "modelProvider">>;
}): number {
  const bySessionKey = new Map(
    input.sessions.map((session) => [session.key, resolveGatewaySessionModelRef(session)] as const),
  );
  return input.plan.reduce((count, entry) => (
    bySessionKey.get(entry.sessionKey) === entry.model ? count + 1 : count
  ), 0);
}

export function collectCodexAuthTargetAgentIds(company: CompanyLike): string[] {
  return [
    ...new Set(
      (company?.employees ?? [])
        .map((employee) => normalizeNonEmptyString(employee?.agentId))
        .filter((agentId): agentId is string => Boolean(agentId)),
    ),
  ];
}

export async function syncCodexModelsToAllowlist(models: GatewayModelChoice[]) {
  const codexModels = models.filter((model) => model.provider === "openai-codex");
  if (codexModels.length === 0) {
    return false;
  }

  const snapshot = await gateway.getConfigSnapshot();
  const hash = snapshot.hash;
  if (!hash) {
    return false;
  }

  const currentModels =
    (snapshot.config as { agents?: { defaults?: { models?: Record<string, unknown> } } })?.agents?.defaults
      ?.models ?? {};
  const nextModels = { ...currentModels };
  let changed = false;

  for (const model of codexModels) {
    const ref = `${model.provider}/${model.id}`;
    if (!(ref in nextModels)) {
      nextModels[ref] = {};
      changed = true;
    }
  }

  if (!changed) {
    return false;
  }

  await gateway.patchConfig(
    {
      agents: {
        defaults: {
          models: nextModels,
        },
      },
    },
    hash,
  );

  return true;
}

export async function reapplyCodexModelsToActiveSessions(): Promise<{
  failed: number;
  matched: number;
  reapplied: number;
}> {
  const sessionsResult = await gateway.listSessions({
    includeGlobal: true,
    includeUnknown: true,
    limit: 1000,
  });
  const sessions = sessionsResult.sessions ?? [];
  const actorIds = [
    ...new Set(
      sessions
        .map((session) => normalizeNonEmptyString(session.actorId))
        .filter((actorId): actorId is string => Boolean(actorId)),
    ),
  ];
  if (actorIds.length === 0) {
    return { failed: 0, matched: 0, reapplied: 0 };
  }

  const controlEntries = await Promise.all(
    actorIds.map(async (actorId) => [actorId, await gateway.getAgentControlSnapshot(actorId)] as const),
  );
  const controlSnapshots = Object.fromEntries(controlEntries);
  const plan = buildCodexSessionReapplyPlan({ sessions, controlSnapshots });
  if (plan.length === 0) {
    return { failed: 0, matched: 0, reapplied: 0 };
  }

  const settled = await Promise.allSettled(
    plan.map(async (entry) => {
      const ack = await gateway.sendChatMessage(entry.sessionKey, `/model ${entry.model}`);
      await waitForGatewayChatRunTerminal({
        providerSessionKey: entry.sessionKey,
        runId: ack?.runId ?? null,
      });
    }),
  );

  const fulfilledEntries: SessionModelPlanEntry[] = [];
  let commandFailed = 0;
  settled.forEach((result, index) => {
    if (result.status === "fulfilled") {
      if (plan[index]) {
        fulfilledEntries.push(plan[index]);
      }
      return;
    }
    commandFailed += 1;
    console.warn("Failed to reapply Codex model to active session", {
      actorId: plan[index]?.actorId,
      error: result.reason,
      sessionKey: plan[index]?.sessionKey,
    });
  });

  let reapplied = fulfilledEntries.length;
  let failed = commandFailed;
  if (fulfilledEntries.length > 0) {
    try {
      const verification = await gateway.listSessions({
        includeGlobal: true,
        includeUnknown: true,
        limit: 1000,
      });
      reapplied = countCodexSessionReapplySuccesses({
        plan: fulfilledEntries,
        sessions: verification.sessions ?? [],
      });
      failed = commandFailed + (fulfilledEntries.length - reapplied);
    } catch (error) {
      console.warn("Skipped Codex session reapply verification because listing sessions failed", {
        error,
      });
    }
  }

  return {
    failed,
    matched: plan.length,
    reapplied,
  };
}

export function formatCodexRuntimeSyncDescription(result: {
  failed: number;
  matched: number;
  reapplied: number;
}): string {
  if (result.matched === 0) {
    return "当前没有检测到需要热切换的 Codex 活动会话。";
  }
  if (result.failed === 0) {
    return `已完成 ${result.reapplied} 个活动会话的 Codex 模型重绑。`;
  }
  return `已重绑 ${result.reapplied}/${result.matched} 个活动会话，另有 ${result.failed} 个会话重绑失败。`;
}

const LAST_CODEX_ACCOUNT_ID_STORAGE_KEY = "cyber-company.codex.last-account-id";

function getCodexAuthStorage(): Storage | null {
  try {
    return typeof globalThis !== "undefined" && "localStorage" in globalThis ? globalThis.localStorage : null;
  } catch {
    return null;
  }
}

function shortenCodexAccountId(accountId: string): string {
  if (accountId.length <= 16) {
    return accountId;
  }
  return `${accountId.slice(0, 8)}...${accountId.slice(-4)}`;
}

export function formatCodexAccountChangeDescription(accountId: string | null | undefined): string {
  const normalizedAccountId = normalizeNonEmptyString(accountId);
  if (!normalizedAccountId) {
    return "";
  }

  const storage = getCodexAuthStorage();
  const previousAccountId = normalizeNonEmptyString(storage?.getItem(LAST_CODEX_ACCOUNT_ID_STORAGE_KEY) ?? null);

  try {
    storage?.setItem(LAST_CODEX_ACCOUNT_ID_STORAGE_KEY, normalizedAccountId);
  } catch {
    // Best-effort only. Missing storage should not block auth completion.
  }

  const shortAccountId = shortenCodexAccountId(normalizedAccountId);
  if (!previousAccountId) {
    return `当前 OpenAI account 为 ${shortAccountId}。`;
  }
  if (previousAccountId === normalizedAccountId) {
    return `OpenAI account 未切换，仍为 ${shortAccountId}。`;
  }
  return `OpenAI account 已切换为 ${shortAccountId}（之前为 ${shortenCodexAccountId(previousAccountId)}）。`;
}

export function formatCodexAuthCompletionDescription(input: {
  accountId?: string | null;
  codexCount: number;
  profileId?: string | null;
  reapplyResult: {
    failed: number;
    matched: number;
    reapplied: number;
  };
}): string {
  const profileLabel = normalizeNonEmptyString(input.profileId) ?? "openai-codex";
  const parts = [
    `已导入 ${profileLabel}，当前发现 ${input.codexCount} 个 Codex 模型。`,
  ];
  const accountDescription = formatCodexAccountChangeDescription(input.accountId);
  if (accountDescription) {
    parts.push(accountDescription);
  }
  parts.push(formatCodexRuntimeSyncDescription(input.reapplyResult));
  return parts.join("");
}
