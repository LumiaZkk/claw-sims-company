import type {
  ProviderProcessRecord,
  ProviderRuntimeEvent,
  ProviderSessionStatus,
  GatewaySessionRow,
} from "../../infrastructure/gateway/runtime/types";
import type { DispatchRecord } from "../../domain/delegation/types";
import { resolveSessionActorId, resolveSessionUpdatedAt } from "../../lib/sessions";
import type {
  AgentRunRecord,
  AgentRunState,
  AgentRuntimeAvailability,
  AgentRuntimeEvidence,
  AgentRuntimeRecord,
  AgentSessionRecord,
  AgentSessionState,
  RuntimeProjectionInput,
} from "./agent-runtime-types";
import {
  buildExecutionContextFromDispatch,
  buildTerminalRunSummary,
  dedupeStreamKinds,
  isSameExecutionContext,
  normalizeNonEmptyString,
  normalizeProviderProcessState,
  normalizeProviderRunState,
  normalizeProviderSessionState,
  normalizeStreamKind,
  normalizeTimestamp,
  pickLatestRecoveredExecutionContext,
  resolveProviderSessionStateCandidate,
  summarizeRecoveredExecutionContext,
} from "./agent-runtime-utils";

export function reconcileAgentSessionExecutionContext(input: {
  sessions: AgentSessionRecord[];
  dispatches: DispatchRecord[];
}): AgentSessionRecord[] {
  const latestContextBySessionKey = new Map<string, NonNullable<AgentSessionRecord["executionContext"]>>();
  const observedDispatchSessionKeys = new Set<string>();

  [...input.dispatches]
    .sort((left, right) => right.updatedAt - left.updatedAt)
    .forEach((dispatch) => {
      const checkout = buildExecutionContextFromDispatch(dispatch);
      const checkoutSessionKey = dispatch.checkoutSessionKey ?? checkout?.sessionKey ?? null;
      if (checkoutSessionKey) {
        observedDispatchSessionKeys.add(checkoutSessionKey);
      }
      if (!checkout || latestContextBySessionKey.has(checkout.sessionKey)) {
        return;
      }
      latestContextBySessionKey.set(checkout.sessionKey, checkout);
    });

  return [...input.sessions]
    .map((session) => {
      const preservedContext = observedDispatchSessionKeys.has(session.sessionKey)
        ? null
        : session.executionContext ?? null;
      const nextContext = latestContextBySessionKey.get(session.sessionKey) ?? preservedContext;
      if (isSameExecutionContext(session.executionContext ?? null, nextContext)) {
        return session;
      }
      return {
        ...session,
        executionContext: nextContext,
      } satisfies AgentSessionRecord;
    })
    .sort((left, right) => (right.lastSeenAt ?? 0) - (left.lastSeenAt ?? 0));
}

export function isAgentRunTerminalState(state: AgentRunState): boolean {
  return state === "completed" || state === "aborted" || state === "error";
}

export function isAgentRunActive(state: AgentRunState): boolean {
  return !isAgentRunTerminalState(state);
}

export function mapAgentRuntimeAvailabilityToLegacyStatus(
  availability: AgentRuntimeAvailability,
): "running" | "idle" | "stopped" {
  if (availability === "busy") {
    return "running";
  }
  if (availability === "idle" || availability === "degraded" || availability === "no_signal") {
    return "idle";
  }
  return "stopped";
}

function deriveSessionStateFromStatus(status: ProviderSessionStatus): AgentSessionState {
  if (status.state === "running" || status.state === "streaming") {
    return status.state;
  }
  if (status.state === "error") {
    return "error";
  }
  if (status.state === "offline") {
    return "offline";
  }
  if (status.state === "idle") {
    return "idle";
  }
  return "unknown";
}

export function normalizeProviderSessionStatus(
  providerId: string,
  sessionKey: string,
  raw: unknown,
): ProviderSessionStatus {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) {
    return {
      providerId,
      sessionKey,
      agentId: resolveSessionActorId(sessionKey),
      state: "unknown",
      raw,
    };
  }

  const record = raw as Record<string, unknown>;
  const state = resolveProviderSessionStateCandidate(record.state, record.status);

  const normalizedState =
    state !== "unknown"
      ? state
      : record.streaming === true
        ? "streaming"
        : record.running === true || record.busy === true
          ? "running"
          : record.offline === true
            ? "offline"
            : record.error
              ? "error"
              : "unknown";

  return {
    providerId,
    sessionKey,
    agentId:
      normalizeNonEmptyString(record.actorId)
      ?? normalizeNonEmptyString(record.agentId)
      ?? resolveSessionActorId(sessionKey),
    state: normalizedState,
    updatedAt:
      normalizeTimestamp(record.updatedAt)
      ?? normalizeTimestamp(record.lastSeenAt)
      ?? normalizeTimestamp(record.timestamp),
    lastMessageAt:
      normalizeTimestamp(record.lastMessageAt)
      ?? normalizeTimestamp(record.last_message_at),
    runId:
      normalizeNonEmptyString(record.runId)
      ?? normalizeNonEmptyString(record.activeRunId),
    errorMessage:
      normalizeNonEmptyString(record.errorMessage)
      ?? normalizeNonEmptyString(record.error),
    raw,
  };
}

export function normalizeProviderRuntimeEvent(
  providerId: string,
  raw: unknown,
): ProviderRuntimeEvent | null {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) {
    return null;
  }

  const record = raw as Record<string, unknown>;
  const data =
    record.data && typeof record.data === "object" && !Array.isArray(record.data)
      ? (record.data as Record<string, unknown>)
      : null;
  const nested =
    record.payload && typeof record.payload === "object" && !Array.isArray(record.payload)
      ? (record.payload as Record<string, unknown>)
      : null;

  const streamKind =
    normalizeStreamKind(record.stream)
    ?? normalizeStreamKind(data?.stream)
    ?? normalizeStreamKind(data?.type)
    ?? normalizeStreamKind(record.type);
  if (!streamKind) {
    return null;
  }

  const runState =
    normalizeProviderRunState(record.state)
    ?? normalizeProviderRunState(data?.state)
    ?? normalizeProviderRunState(nested?.state)
    ?? (streamKind === "assistant" ? "streaming" : null);
  const runId =
    normalizeNonEmptyString(record.runId)
    ?? normalizeNonEmptyString(data?.runId)
    ?? normalizeNonEmptyString(nested?.runId);
  const sessionKey =
    normalizeNonEmptyString(record.sessionKey)
    ?? normalizeNonEmptyString(data?.sessionKey)
    ?? normalizeNonEmptyString(nested?.sessionKey);
  const agentId =
    normalizeNonEmptyString(record.actorId)
    ?? normalizeNonEmptyString(record.agentId)
    ?? normalizeNonEmptyString(data?.actorId)
    ?? normalizeNonEmptyString(data?.agentId)
    ?? normalizeNonEmptyString(nested?.actorId)
    ?? normalizeNonEmptyString(nested?.agentId)
    ?? (sessionKey ? resolveSessionActorId(sessionKey) : null);
  const timestamp =
    normalizeTimestamp(record.timestamp)
    ?? normalizeTimestamp(data?.timestamp)
    ?? normalizeTimestamp(nested?.timestamp)
    ?? Date.now();

  return {
    providerId,
    agentId,
    sessionKey,
    runId,
    streamKind,
    runState,
    timestamp,
    errorMessage:
      normalizeNonEmptyString(record.errorMessage)
      ?? normalizeNonEmptyString(data?.errorMessage)
      ?? normalizeNonEmptyString(nested?.errorMessage)
      ?? normalizeNonEmptyString(record.error)
      ?? normalizeNonEmptyString(data?.error)
      ?? normalizeNonEmptyString(nested?.error),
    toolName:
      normalizeNonEmptyString(record.toolName)
      ?? normalizeNonEmptyString(data?.toolName)
      ?? normalizeNonEmptyString(data?.name),
    raw,
  };
}

function normalizeProcessCommand(record: Record<string, unknown>): string | null {
  const direct =
    normalizeNonEmptyString(record.command)
    ?? normalizeNonEmptyString(record.cmd)
    ?? normalizeNonEmptyString(record.executable)
    ?? normalizeNonEmptyString(record.program);
  if (direct) {
    return direct;
  }
  const argv = Array.isArray(record.argv) ? record.argv : Array.isArray(record.args) ? record.args : null;
  if (!argv) {
    return null;
  }
  const parts = argv
    .map((item) => (typeof item === "string" ? item.trim() : ""))
    .filter((item) => item.length > 0);
  return parts.length > 0 ? parts.join(" ") : null;
}

export function normalizeProviderProcessRecord(
  providerId: string,
  raw: unknown,
  fallbackSessionKey?: string | null,
): ProviderProcessRecord | null {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) {
    return null;
  }

  const record = raw as Record<string, unknown>;
  const data =
    record.data && typeof record.data === "object" && !Array.isArray(record.data)
      ? (record.data as Record<string, unknown>)
      : null;
  const nested =
    record.process && typeof record.process === "object" && !Array.isArray(record.process)
      ? (record.process as Record<string, unknown>)
      : null;
  const source = nested ?? data ?? record;
  const sessionKey =
    normalizeNonEmptyString(record.sessionKey)
    ?? normalizeNonEmptyString(source.sessionKey)
    ?? normalizeNonEmptyString(source.sessionId)
    ?? fallbackSessionKey
    ?? null;
  const processId =
    normalizeNonEmptyString(record.processId)
    ?? normalizeNonEmptyString(record.id)
    ?? normalizeNonEmptyString(source.processId)
    ?? normalizeNonEmptyString(source.id)
    ?? normalizeNonEmptyString(source.pid)
    ?? (sessionKey ? `${sessionKey}:${normalizeTimestamp(source.startedAt) ?? normalizeTimestamp(source.updatedAt) ?? Date.now()}` : null);
  if (!processId) {
    return null;
  }

  const command = normalizeProcessCommand(source);
  const title =
    normalizeNonEmptyString(record.title)
    ?? normalizeNonEmptyString(source.title)
    ?? normalizeNonEmptyString(source.label)
    ?? normalizeNonEmptyString(source.name)
    ?? command
    ?? processId;
  const recordState = normalizeProviderProcessState(record.state);
  const recordStatus = normalizeProviderProcessState(record.status);
  const sourceStateCandidate = normalizeProviderProcessState(source.state);
  const sourceStatusCandidate = normalizeProviderProcessState(source.status);
  const sourceState =
    recordState !== "unknown"
      ? recordState
      : recordStatus !== "unknown"
        ? recordStatus
        : sourceStateCandidate !== "unknown"
          ? sourceStateCandidate
          : sourceStatusCandidate;
  const exitCode =
    typeof source.exitCode === "number" && Number.isFinite(source.exitCode)
      ? source.exitCode
      : typeof record.exitCode === "number" && Number.isFinite(record.exitCode)
        ? record.exitCode
        : null;
  const state =
    sourceState !== "unknown"
      ? sourceState
      : source.running === true
        ? "running"
        : source.pending === true || source.queued === true
          ? "queued"
          : exitCode != null
            ? exitCode === 0
              ? "completed"
              : "error"
            : "unknown";

  return {
    providerId,
    processId,
    sessionKey,
    agentId:
      normalizeNonEmptyString(record.actorId)
      ?? normalizeNonEmptyString(record.agentId)
      ?? normalizeNonEmptyString(source.actorId)
      ?? normalizeNonEmptyString(source.agentId)
      ?? (sessionKey ? resolveSessionActorId(sessionKey) : null),
    state,
    title,
    command,
    summary:
      normalizeNonEmptyString(record.summary)
      ?? normalizeNonEmptyString(source.summary)
      ?? normalizeNonEmptyString(source.description)
      ?? command,
    startedAt:
      normalizeTimestamp(record.startedAt)
      ?? normalizeTimestamp(source.startedAt)
      ?? normalizeTimestamp(source.createdAt),
    updatedAt:
      normalizeTimestamp(record.updatedAt)
      ?? normalizeTimestamp(source.updatedAt)
      ?? normalizeTimestamp(source.timestamp),
    endedAt:
      normalizeTimestamp(record.endedAt)
      ?? normalizeTimestamp(source.endedAt)
      ?? normalizeTimestamp(source.finishedAt)
      ?? normalizeTimestamp(source.completedAt),
    exitCode,
    raw,
  };
}

export function normalizeProviderProcessList(
  providerId: string,
  raw: unknown,
  fallbackSessionKey?: string | null,
): ProviderProcessRecord[] {
  if (Array.isArray(raw)) {
    return raw
      .map((item) => normalizeProviderProcessRecord(providerId, item, fallbackSessionKey))
      .filter((item): item is ProviderProcessRecord => Boolean(item));
  }

  if (!raw || typeof raw !== "object") {
    return [];
  }

  const record = raw as Record<string, unknown>;
  const collection =
    Array.isArray(record.processes)
      ? record.processes
      : Array.isArray(record.items)
        ? record.items
        : Array.isArray(record.results)
          ? record.results
          : record.process
            ? [record.process]
            : [];

  return collection
    .map((item) => normalizeProviderProcessRecord(providerId, item, fallbackSessionKey))
    .filter((item): item is ProviderProcessRecord => Boolean(item));
}

export function buildAgentSessionRecordsFromSessions(input: {
  existing?: AgentSessionRecord[];
  providerId: string;
  sessions: GatewaySessionRow[];
  now?: number;
}): AgentSessionRecord[] {
  const now = input.now ?? Date.now();
  const bySessionKey = new Map((input.existing ?? []).map((session) => [session.sessionKey, session] as const));

  for (const session of input.sessions) {
    const previous = bySessionKey.get(session.key);
    const updatedAt = resolveSessionUpdatedAt(session) || now;
    const shouldClearStaleFailure =
      !session.abortedLastRun
      && (
        previous?.abortedLastRun
        || previous?.lastTerminalRunState === "error"
        || previous?.lastTerminalRunState === "aborted"
      );
    const next: AgentSessionRecord = {
      sessionKey: session.key,
      agentId: resolveSessionActorId(session),
      providerId: input.providerId,
      sessionState:
        shouldClearStaleFailure
          ? "idle"
          : (previous?.sessionState ?? (session.abortedLastRun ? "error" : "idle")),
      lastSeenAt: Math.max(previous?.lastSeenAt ?? 0, updatedAt) || null,
      lastStatusSyncAt: previous?.lastStatusSyncAt ?? null,
      lastMessageAt: Math.max(previous?.lastMessageAt ?? 0, updatedAt) || null,
      abortedLastRun: shouldClearStaleFailure ? false : Boolean(session.abortedLastRun ?? previous?.abortedLastRun),
      lastError:
        shouldClearStaleFailure
          ? null
          : (previous?.lastError ?? (session.abortedLastRun ? "Gateway 标记最近一次执行为 aborted。" : null)),
      lastTerminalRunState:
        shouldClearStaleFailure
          ? null
          : (previous?.lastTerminalRunState ?? (session.abortedLastRun ? "aborted" : null)),
      lastTerminalSummary:
        shouldClearStaleFailure
          ? null
          : (previous?.lastTerminalSummary ?? (session.abortedLastRun ? "Gateway 标记最近一次执行为 aborted。" : null)),
      executionContext: previous?.executionContext ?? null,
      source: previous?.source ?? "sessions_list",
    };
    bySessionKey.set(session.key, next);
  }

  return [...bySessionKey.values()].sort(
    (left, right) => (right.lastSeenAt ?? 0) - (left.lastSeenAt ?? 0),
  );
}

export function applyProviderSessionStatusToAgentSessions(input: {
  sessions: AgentSessionRecord[];
  status: ProviderSessionStatus;
  now?: number;
}): AgentSessionRecord[] {
  return applyProviderSessionStatusToAgentRuntime({
    sessions: input.sessions,
    runs: [],
    status: input.status,
    now: input.now,
  }).sessions;
}

export function applyProviderSessionStatusToAgentRuntime(input: {
  sessions: AgentSessionRecord[];
  runs: AgentRunRecord[];
  status: ProviderSessionStatus;
  now?: number;
}): {
  sessions: AgentSessionRecord[];
  runs: AgentRunRecord[];
} {
  const now = input.now ?? Date.now();
  const bySessionKey = new Map(input.sessions.map((session) => [session.sessionKey, session] as const));
  const runMap = new Map(input.runs.map((run) => [run.runId, run] as const));
  const previous = bySessionKey.get(input.status.sessionKey);
  const shouldClearStaleFailure =
    (input.status.state === "idle" || input.status.state === "offline")
    && !input.status.errorMessage
    && !input.status.runId
    && (
      previous?.abortedLastRun
      || previous?.lastTerminalRunState === "error"
      || previous?.lastTerminalRunState === "aborted"
    );
  const terminalState =
    shouldClearStaleFailure
      ? null
      : input.status.state === "error"
      ? ("error" as const)
      : input.status.state === "idle" || input.status.state === "offline"
        ? previous?.abortedLastRun
          ? ("aborted" as const)
          : previous?.lastTerminalRunState ?? null
        : null;
  const terminalSummary =
    shouldClearStaleFailure
      ? null
      : terminalState
      ? buildTerminalRunSummary(terminalState, input.status.sessionKey, input.status.errorMessage)
      : previous?.lastTerminalSummary ?? null;
  bySessionKey.set(input.status.sessionKey, {
    sessionKey: input.status.sessionKey,
    agentId: input.status.agentId ?? previous?.agentId ?? resolveSessionActorId(input.status.sessionKey),
    providerId: input.status.providerId,
    sessionState: deriveSessionStateFromStatus(input.status),
    lastSeenAt:
      Math.max(previous?.lastSeenAt ?? 0, input.status.updatedAt ?? now) || null,
    lastStatusSyncAt: now,
    lastMessageAt:
      Math.max(
        previous?.lastMessageAt ?? 0,
        input.status.lastMessageAt ?? input.status.updatedAt ?? 0,
      ) || null,
    abortedLastRun:
      shouldClearStaleFailure
        ? false
        : terminalState === "aborted" || input.status.state === "error"
        ? true
        : input.status.state === "idle" || input.status.state === "running" || input.status.state === "streaming"
          ? false
          : previous?.abortedLastRun ?? false,
    lastError:
      shouldClearStaleFailure
        ? null
        : (input.status.errorMessage
          ?? (input.status.state === "idle" || input.status.state === "running" || input.status.state === "streaming"
            ? null
            : previous?.lastError ?? null)),
    lastTerminalRunState: terminalState,
    lastTerminalSummary: terminalSummary,
    executionContext: previous?.executionContext ?? null,
    source: "session_status",
  });

  if (input.status.runId && (input.status.state === "running" || input.status.state === "streaming")) {
    const previousRun = runMap.get(input.status.runId);
    runMap.set(input.status.runId, {
      runId: input.status.runId,
      agentId:
        input.status.agentId
        ?? previousRun?.agentId
        ?? previous?.agentId
        ?? resolveSessionActorId(input.status.sessionKey),
      sessionKey: input.status.sessionKey,
      providerId: input.status.providerId,
      state: input.status.state === "streaming" ? "streaming" : "running",
      startedAt: previousRun?.startedAt ?? input.status.updatedAt ?? now,
      lastEventAt: input.status.updatedAt ?? now,
      endedAt: null,
      streamKindsSeen: dedupeStreamKinds([...(previousRun?.streamKindsSeen ?? []), "lifecycle"]),
      toolNamesSeen: previousRun?.toolNamesSeen ?? [],
      error: previousRun?.error ?? null,
    });
  }

  if (input.status.state !== "running" && input.status.state !== "streaming") {
    for (const [runId, run] of runMap.entries()) {
      if (run.sessionKey === input.status.sessionKey) {
        runMap.delete(runId);
      }
    }
  }

  return {
    sessions: [...bySessionKey.values()].sort(
      (left, right) => (right.lastSeenAt ?? 0) - (left.lastSeenAt ?? 0),
    ),
    runs: [...runMap.values()].sort((left, right) => right.lastEventAt - left.lastEventAt),
  };
}

export function applyProviderRuntimeEvent(input: {
  sessions: AgentSessionRecord[];
  runs: AgentRunRecord[];
  event: ProviderRuntimeEvent;
}): {
  sessions: AgentSessionRecord[];
  runs: AgentRunRecord[];
} {
  const sessionMap = new Map(input.sessions.map((session) => [session.sessionKey, session] as const));
  const runMap = new Map(input.runs.map((run) => [run.runId, run] as const));
  const event = input.event;
  const sessionKey = event.sessionKey;
  const runId = event.runId;
  const timestamp = event.timestamp;

  if (sessionKey) {
    const previousSession = sessionMap.get(sessionKey);
    const derivedSessionState: AgentSessionState =
      event.runState === "error" || event.runState === "aborted"
        ? "error"
        : event.runState === "completed"
          ? "idle"
          : event.runState === "streaming" || event.streamKind === "assistant"
            ? "streaming"
            : event.runState === "accepted" || event.runState === "running" || event.streamKind === "tool"
              ? "running"
              : previousSession?.sessionState ?? "unknown";
    sessionMap.set(sessionKey, {
      sessionKey,
      agentId: event.agentId ?? previousSession?.agentId ?? resolveSessionActorId(sessionKey),
      providerId: event.providerId,
      sessionState: derivedSessionState,
      lastSeenAt: Math.max(previousSession?.lastSeenAt ?? 0, timestamp) || null,
      lastStatusSyncAt: previousSession?.lastStatusSyncAt ?? null,
      lastMessageAt:
        event.streamKind === "assistant"
          ? Math.max(previousSession?.lastMessageAt ?? 0, timestamp) || null
          : previousSession?.lastMessageAt ?? null,
      abortedLastRun:
        event.runState === "aborted"
          ? true
          : event.runState === "accepted" ||
              event.runState === "running" ||
              event.runState === "streaming" ||
              event.runState === "completed"
            ? false
            : previousSession?.abortedLastRun ?? false,
      lastError:
        event.runState === "error" || event.runState === "aborted"
          ? event.errorMessage ?? previousSession?.lastError ?? null
          : event.runState === "accepted" ||
              event.runState === "running" ||
              event.runState === "streaming" ||
              event.runState === "completed"
            ? null
            : previousSession?.lastError ?? null,
      lastTerminalRunState:
        event.runState === "completed" || event.runState === "aborted" || event.runState === "error"
          ? event.runState
          : previousSession?.lastTerminalRunState ?? null,
      lastTerminalSummary:
        event.runState === "completed" || event.runState === "aborted" || event.runState === "error"
          ? buildTerminalRunSummary(event.runState, sessionKey, event.errorMessage)
          : previousSession?.lastTerminalSummary ?? null,
      executionContext: previousSession?.executionContext ?? null,
      source: "lifecycle",
    });
  }

  if (!runId || !sessionKey) {
    return {
      sessions: [...sessionMap.values()],
      runs: [...runMap.values()],
    };
  }

  const previousRun = runMap.get(runId);
  const nextState =
    event.runState
    ?? previousRun?.state
    ?? (event.streamKind === "assistant" ? "streaming" : "running");
  const nextRun: AgentRunRecord = {
    runId,
    agentId: event.agentId ?? previousRun?.agentId ?? resolveSessionActorId(sessionKey),
    sessionKey,
    providerId: event.providerId,
    state: nextState,
    startedAt: previousRun?.startedAt ?? timestamp,
    lastEventAt: timestamp,
    endedAt: isAgentRunTerminalState(nextState) ? timestamp : null,
    streamKindsSeen: dedupeStreamKinds([
      ...(previousRun?.streamKindsSeen ?? []),
      event.streamKind,
    ]),
    toolNamesSeen:
      event.streamKind === "tool" && event.toolName
        ? [...new Set([...(previousRun?.toolNamesSeen ?? []), event.toolName])]
        : previousRun?.toolNamesSeen ?? [],
    error:
      nextState === "error" || nextState === "aborted"
        ? event.errorMessage ?? previousRun?.error ?? null
        : previousRun?.error ?? null,
  };

  if (isAgentRunTerminalState(nextRun.state)) {
    runMap.delete(runId);
  } else {
    runMap.set(runId, nextRun);
  }

  return {
    sessions: [...sessionMap.values()].sort(
      (left, right) => (right.lastSeenAt ?? 0) - (left.lastSeenAt ?? 0),
    ),
    runs: [...runMap.values()].sort((left, right) => right.lastEventAt - left.lastEventAt),
  };
}

export function buildAgentRuntimeProjection(input: RuntimeProjectionInput): AgentRuntimeRecord[] {
  const agentIds = new Set([
    ...(input.agentIds ?? []),
    ...input.sessions.map((session) => session.agentId).filter(Boolean) as string[],
    ...input.runs.map((run) => run.agentId).filter(Boolean) as string[],
  ]);

  return [...agentIds].map((agentId) => {
    const agentSessions = input.sessions.filter((session) => session.agentId === agentId);
    const latestRecoveredExecutionContext = pickLatestRecoveredExecutionContext(agentSessions);
    const activeRuns = input.runs.filter(
      (run) => run.agentId === agentId && isAgentRunActive(run.state),
    );
    const busySession = agentSessions.find(
      (session) => session.sessionState === "running" || session.sessionState === "streaming",
    );
    const degradedSession = agentSessions.find(
      (session) => session.sessionState === "error" || session.abortedLastRun,
    );
    const explicitOfflineSessions = agentSessions.filter((session) => session.sessionState === "offline");
    const latestTerminalSession =
      [...agentSessions]
        .filter((session) => Boolean(session.lastTerminalSummary))
        .sort(
          (left, right) =>
            (right.lastSeenAt ?? 0) - (left.lastSeenAt ?? 0),
        )[0] ?? null;

    let availability: AgentRuntimeAvailability = "no_signal";
    if (activeRuns.length > 0 || busySession) {
      availability = "busy";
    } else if (degradedSession) {
      availability = "degraded";
    } else if (agentSessions.length > 0 && explicitOfflineSessions.length === agentSessions.length) {
      availability = "offline";
    } else if (agentSessions.length > 0) {
      availability = agentSessions.every(
        (session) => session.sessionState === "unknown" || session.sessionState === "offline",
      )
        ? "no_signal"
        : "idle";
    }

    const evidence: AgentRuntimeEvidence[] = [];
    activeRuns.forEach((run) => {
      evidence.push({
        kind: "run",
        summary:
          run.toolNamesSeen.length > 0
            ? `${run.sessionKey} 正在执行 ${run.toolNamesSeen.join(" / ")}`
            : `${run.sessionKey} 正在执行 (${run.state})`,
        timestamp: run.lastEventAt,
      });
    });
    if (degradedSession?.lastError) {
      evidence.push({
        kind: "error",
        summary: degradedSession.lastError,
        timestamp: degradedSession.lastSeenAt ?? Date.now(),
      });
    } else if (latestRecoveredExecutionContext) {
      evidence.push({
        kind: "session",
        summary: summarizeRecoveredExecutionContext(latestRecoveredExecutionContext),
        timestamp: latestRecoveredExecutionContext.updatedAt,
      });
    } else if (latestTerminalSession?.lastTerminalSummary) {
      evidence.push({
        kind: "status",
        summary: latestTerminalSession.lastTerminalSummary,
        timestamp: latestTerminalSession.lastSeenAt ?? Date.now(),
      });
    } else if (busySession) {
      evidence.push({
        kind: "session",
        summary: `${busySession.sessionKey} 当前为 ${busySession.sessionState}`,
        timestamp: busySession.lastSeenAt ?? Date.now(),
      });
    } else if (agentSessions[0]) {
      evidence.push({
        kind: "status",
        summary: `${agentSessions[0].sessionKey} 当前为 ${agentSessions[0].sessionState}`,
        timestamp: agentSessions[0].lastSeenAt ?? Date.now(),
      });
    }

    const activeSessionKeys = [
      ...new Set([
        ...activeRuns.map((run) => run.sessionKey),
        ...agentSessions
          .filter((session) => session.sessionState === "running" || session.sessionState === "streaming")
          .map((session) => session.sessionKey),
      ]),
    ];

    return {
      agentId,
      providerId: input.providerId,
      availability,
      activeSessionKeys,
      activeRunIds: activeRuns.map((run) => run.runId),
      lastSeenAt: Math.max(...agentSessions.map((session) => session.lastSeenAt ?? 0), 0) || null,
      lastBusyAt: Math.max(
        ...activeRuns.map((run) => run.lastEventAt),
        ...agentSessions
          .filter((session) => session.sessionState === "running" || session.sessionState === "streaming")
          .map((session) => session.lastSeenAt ?? 0),
        0,
      ) || null,
      lastIdleAt: Math.max(
        ...agentSessions
          .filter((session) => session.sessionState === "idle")
          .map((session) => session.lastSeenAt ?? 0),
        0,
      ) || null,
      latestTerminalAt: latestTerminalSession?.lastSeenAt ?? null,
      latestTerminalSummary: latestTerminalSession?.lastTerminalSummary ?? null,
      currentWorkload:
        activeSessionKeys.length <= 0
          ? "free"
          : activeSessionKeys.length === 1
            ? "busy"
            : "saturated",
      runtimeEvidence: evidence.sort((left, right) => right.timestamp - left.timestamp),
    };
  });
}
