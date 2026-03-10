import {
  createDelegationEvent,
  mergeDispatchRecords,
  projectDelegationFromEvents,
  uniqueHandoffList,
} from "../../domain/delegation/events";
import {
  buildDerivedKnowledgeItems,
  mergeCompanyKnowledgeItems,
} from "../artifact/shared-knowledge";
import type { ArtifactRecord } from "../../domain/artifact/types";
import type { DispatchRecord, HandoffRecord } from "../../domain/delegation/types";
import type { Company } from "../../domain/org/types";
import { appendDelegationEvent, listAllDelegationEvents } from "../../infrastructure/delegation/company-event-log";
import { gateway, type ChatMessage } from "../gateway";
import { buildHandoffRecords } from "./handoff-object";
import {
  createRequirementMessageSnapshots,
  REQUIREMENT_SNAPSHOT_MESSAGE_LIMIT,
  type RequirementArtifactCheck,
  type RequirementSessionSnapshot,
} from "../../domain/mission/requirement-snapshot";
import { buildRequestRecords } from "./request-object";
import { reconcileCompanyCommunication } from "./reconcile";
import { resolveSessionActorId, resolveSessionUpdatedAt } from "../../lib/sessions";
import { stripTruthInternalMonologue } from "../mission/message-truth";

type DispatchEventPayload = {
  title: string;
  message: string;
  summary?: string;
  sourceStepId?: string;
  handoff?: boolean;
  error?: string;
};

function buildDispatchPayload(input: DispatchEventPayload): Record<string, unknown> {
  return Object.fromEntries(
    Object.entries({
      title: input.title,
      message: input.message,
      summary: input.summary,
      sourceStepId: input.sourceStepId,
      handoff: input.handoff,
      error: input.error,
    }).filter(([, value]) => value !== undefined),
  );
}

function normalizeMessage(raw: ChatMessage): ChatMessage {
  return {
    ...raw,
    timestamp: typeof raw.timestamp === "number" ? raw.timestamp : Date.now(),
  };
}

function extractText(message: ChatMessage): string {
  if (typeof message.text === "string" && message.text.trim()) {
    return message.text.trim();
  }
  if (typeof message.content === "string" && message.content.trim()) {
    return message.content.trim();
  }
  if (!Array.isArray(message.content)) {
    return "";
  }
  return message.content
    .map((block) => {
      if (typeof block === "string") {
        return block;
      }
      if (block && typeof block === "object") {
        const record = block as Record<string, unknown>;
        if (record.type === "text" && typeof record.text === "string") {
          return record.text;
        }
      }
      return "";
    })
    .join("\n")
    .trim();
}

function extractArtifactPathsFromMessages(messages: ChatMessage[]): string[] {
  const pathPattern =
    /(?:\/(?:Users|tmp|var|home)\/[^\s`"'|]+|(?:\.{1,2}\/)[^\s`"'|]+|\/[^\s`"'|]+?\.(?:md|txt|json|csv|png|jpg|jpeg|pdf))/g;
  return [...new Set(messages.flatMap((message) => extractText(message).match(pathPattern) ?? []))];
}

function findArtifactMirrorRecord(absolutePath: string, activeArtifacts: ArtifactRecord[]) {
  return (
    activeArtifacts.find((artifact) => artifact.sourcePath === absolutePath) ??
    activeArtifacts.find((artifact) => artifact.sourceUrl === absolutePath) ??
    null
  );
}

function mergeSessionSnapshots(params: {
  previous: RequirementSessionSnapshot[];
  discovered: RequirementSessionSnapshot[];
  activeSessionKeys: Set<string>;
}) {
  const merged = new Map(
    params.previous.map((snapshot) => [snapshot.sessionKey, snapshot] as const),
  );
  params.discovered.forEach((snapshot) => {
    const current = merged.get(snapshot.sessionKey);
    if (!current || snapshot.updatedAt >= current.updatedAt) {
      merged.set(snapshot.sessionKey, snapshot);
    }
  });
  return [...merged.values()]
    .filter((snapshot) => params.activeSessionKeys.has(snapshot.sessionKey))
    .sort((left, right) => right.updatedAt - left.updatedAt)
    .slice(0, 12);
}

function matchesFallbackReferenceHandoff(params: {
  historyHandoff: HandoffRecord;
  referenceHandoff: HandoffRecord;
  currentAgentId?: string | null;
}) {
  const { historyHandoff, referenceHandoff, currentAgentId } = params;
  if (referenceHandoff.id === historyHandoff.id) {
    return false;
  }
  if (referenceHandoff.sessionKey !== historyHandoff.sessionKey) {
    return false;
  }
  if (currentAgentId && !referenceHandoff.toAgentIds.includes(currentAgentId)) {
    return false;
  }
  if (
    referenceHandoff.fromAgentId &&
    historyHandoff.toAgentIds.length > 0 &&
    !historyHandoff.toAgentIds.includes(referenceHandoff.fromAgentId)
  ) {
    return false;
  }
  return referenceHandoff.createdAt <= historyHandoff.updatedAt;
}

function normalizeFallbackHandoffs(params: {
  handoffs: HandoffRecord[];
  projectedHandoffs: HandoffRecord[];
  existingHandoffs: HandoffRecord[];
  currentAgentId?: string | null;
}) {
  const referenceHandoffs = uniqueHandoffList([
    ...params.projectedHandoffs,
    ...params.existingHandoffs.filter((handoff) => handoff.id.startsWith("handoff:dispatch:")),
  ]);
  const normalizedHandoffIds = new Set<string>();
  const normalizedHandoffs = params.handoffs.map((handoff) => {
    const candidate = referenceHandoffs
      .filter((reference) =>
        matchesFallbackReferenceHandoff({
          historyHandoff: handoff,
          referenceHandoff: reference,
          currentAgentId: params.currentAgentId,
        }),
      )
      .sort((left, right) => right.createdAt - left.createdAt)[0];
    if (!candidate) {
      return handoff;
    }
    normalizedHandoffIds.add(candidate.id);
    return {
      ...handoff,
      id: candidate.id,
      taskId: candidate.taskId ?? handoff.taskId,
      title: candidate.title,
      summary: candidate.summary,
      sourceMessageTs: candidate.sourceMessageTs ?? handoff.sourceMessageTs,
      createdAt: candidate.createdAt,
      updatedAt: Math.max(handoff.updatedAt, candidate.updatedAt),
    } satisfies HandoffRecord;
  });

  return {
    handoffs: uniqueHandoffList(normalizedHandoffs),
    normalizedHandoffIds,
  };
}

export async function recordDelegationEvent(
  input: Parameters<typeof createDelegationEvent>[0],
) {
  return appendDelegationEvent(createDelegationEvent(input));
}

export async function recordDispatchSent(input: {
  companyId: string;
  dispatchId: string;
  workItemId: string;
  topicKey?: string | null;
  roomId?: string | null;
  fromActorId: string;
  targetActorId: string;
  sessionKey?: string;
  providerRunId?: string;
  createdAt?: number;
  title: string;
  message: string;
  summary?: string;
  sourceStepId?: string;
  handoff?: boolean;
}) {
  return recordDelegationEvent({
    companyId: input.companyId,
    kind: "dispatch_sent",
    dispatchId: input.dispatchId,
    workItemId: input.workItemId,
    topicKey: input.topicKey ?? undefined,
    roomId: input.roomId ?? undefined,
    fromActorId: input.fromActorId,
    targetActorId: input.targetActorId,
    sessionKey: input.sessionKey,
    providerRunId: input.providerRunId,
    createdAt: input.createdAt,
    payload: buildDispatchPayload({
      title: input.title,
      message: input.message,
      summary: input.summary,
      sourceStepId: input.sourceStepId,
      handoff: input.handoff,
    }),
  });
}

export async function recordDispatchBlocked(input: {
  companyId: string;
  dispatchId: string;
  workItemId: string;
  topicKey?: string | null;
  roomId?: string | null;
  fromActorId: string;
  targetActorId: string;
  createdAt?: number;
  title: string;
  message: string;
  sourceStepId?: string;
  error?: string;
}) {
  return recordDelegationEvent({
    companyId: input.companyId,
    kind: "dispatch_blocked",
    dispatchId: input.dispatchId,
    workItemId: input.workItemId,
    topicKey: input.topicKey ?? undefined,
    roomId: input.roomId ?? undefined,
    fromActorId: input.fromActorId,
    targetActorId: input.targetActorId,
    createdAt: input.createdAt,
    payload: buildDispatchPayload({
      title: input.title,
      message: input.message,
      sourceStepId: input.sourceStepId,
      error: input.error,
    }),
  });
}

export async function syncDelegationClosedLoopState(input: {
  company: Company;
  previousSnapshots: RequirementSessionSnapshot[];
  activeArtifacts: ArtifactRecord[];
  activeDispatches: DispatchRecord[];
  force?: boolean;
}) {
  const sessionResult = await gateway.listSessions();
  const companyAgentIds = new Set(input.company.employees.map((employee) => employee.agentId));
  const companySessions = sessionResult.sessions
    .filter((session) => {
      const sessionAgentId = resolveSessionActorId(session);
      return sessionAgentId ? companyAgentIds.has(sessionAgentId) : false;
    })
    .sort((left, right) => resolveSessionUpdatedAt(right) - resolveSessionUpdatedAt(left));
  const activeSessionKeys = new Set(companySessions.map((session) => session.key));
  const snapshotBySessionKey = new Map(
    input.previousSnapshots.map((snapshot) => [snapshot.sessionKey, snapshot] as const),
  );

  const companyEvents = await listAllDelegationEvents(input.company.id);
  const projected = projectDelegationFromEvents({
    company: input.company,
    events: companyEvents,
    existingDispatches: input.activeDispatches,
  });

  const sessionsToCheck = companySessions
    .filter((session) => !projected.responseCoveredSessionKeys.has(session.key))
    .filter((session) => {
      if (input.force) {
        return true;
      }
      const knownSnapshot = snapshotBySessionKey.get(session.key);
      return !knownSnapshot || resolveSessionUpdatedAt(session) > knownSnapshot.updatedAt;
    })
    .slice(0, input.force ? 12 : 8);

  const discovered = await Promise.all(
    sessionsToCheck.map(async (session) => {
      const history = await gateway.getChatHistory(session.key, 20);
      const sessionAgentId = resolveSessionActorId(session);
      const normalizedMessages = (history.messages ?? []).map(normalizeMessage);
      const snapshotMessages = createRequirementMessageSnapshots(normalizedMessages, {
        limit: REQUIREMENT_SNAPSHOT_MESSAGE_LIMIT,
        normalizeText: stripTruthInternalMonologue,
      });
      const relatedTask = (input.company.tasks ?? []).find((task) => task.sessionKey === session.key);
      const discoveredHandoffs = buildHandoffRecords({
        sessionKey: session.key,
        messages: normalizedMessages,
        company: input.company,
        currentAgentId: sessionAgentId,
        relatedTask,
      }).map((handoff) => ({ ...handoff, syncSource: "history" as const }));
      const normalizedFallback = normalizeFallbackHandoffs({
        handoffs: discoveredHandoffs,
        projectedHandoffs: projected.handoffs,
        existingHandoffs: input.company.handoffs ?? [],
        currentAgentId: sessionAgentId,
      });
      const discoveredRequests = buildRequestRecords({
        sessionKey: session.key,
        messages: normalizedMessages,
        handoffs: normalizedFallback.handoffs,
        relatedTask,
      }).map((request) => ({
        ...request,
        syncSource: normalizedFallback.normalizedHandoffIds.has(request.handoffId ?? "")
          ? ("normalized" as const)
          : ("history" as const),
      }));

      const artifactChecks: RequirementArtifactCheck[] = extractArtifactPathsFromMessages(
        normalizedMessages,
      )
        .slice(-2)
        .flatMap((absolutePath) => {
          const mirroredArtifact = findArtifactMirrorRecord(absolutePath, input.activeArtifacts);
          return mirroredArtifact
            ? [
                {
                  path: absolutePath,
                  exists: mirroredArtifact.status !== "archived",
                },
              ]
            : [];
        });

      return {
        agentId: sessionAgentId,
        sessionKey: session.key,
        historyMessages: normalizedMessages,
        handoffs: normalizedFallback.handoffs,
        requests: discoveredRequests,
        snapshot:
          sessionAgentId && companyAgentIds.has(sessionAgentId)
            ? ({
                agentId: sessionAgentId,
                sessionKey: session.key,
                updatedAt:
                  normalizedMessages.reduce((latest, message) => {
                    const timestamp = typeof message.timestamp === "number" ? message.timestamp : 0;
                    return Math.max(latest, timestamp);
                  }, session.updatedAt ?? 0) || Date.now(),
                messages: snapshotMessages,
                artifactChecks,
              } satisfies RequirementSessionSnapshot)
            : null,
      };
    }),
  );

  const projectedRequestIds = new Set(projected.requests.map((request) => request.id));
  const historyRequests = discovered
    .flatMap((item) => item.requests)
    .filter((request) => !projectedRequestIds.has(request.id));
  const projectedHandoffIds = new Set(projected.handoffs.map((handoff) => handoff.id));
  const historyHandoffs = discovered
    .flatMap((item) => item.handoffs)
    .filter((handoff) => !projectedHandoffIds.has(handoff.id));
  const mergedHandoffs = uniqueHandoffList([
    ...(input.company.handoffs ?? []).filter((handoff) => handoff.syncSource !== "event"),
    ...projected.handoffs,
    ...historyHandoffs,
  ]);
  const { companyPatch, summary } = reconcileCompanyCommunication(
    {
      ...input.company,
      handoffs: mergedHandoffs,
    },
    [...projected.requests, ...historyRequests],
    Date.now(),
  );
  const nextCompany = {
    ...input.company,
    ...companyPatch,
    handoffs: companyPatch.handoffs ?? mergedHandoffs,
  } satisfies Company;
  const derivedKnowledgeItems = buildDerivedKnowledgeItems({
    company: nextCompany,
    artifacts: input.activeArtifacts,
    requests: companyPatch.requests ?? nextCompany.requests ?? [],
    histories: discovered.map((item) => ({
      agentId: item.agentId,
      sessionKey: item.sessionKey,
      messages: item.historyMessages,
    })),
  });
  const knowledgeItems = mergeCompanyKnowledgeItems(
    input.company.knowledgeItems ?? [],
    derivedKnowledgeItems,
  );

  return {
    summary,
    companyPatch: {
      ...companyPatch,
      handoffs: companyPatch.handoffs ?? mergedHandoffs,
      knowledgeItems,
    } satisfies Partial<Company>,
    dispatches: mergeDispatchRecords(input.activeDispatches, projected.dispatches),
    sessionSnapshots: mergeSessionSnapshots({
      previous: input.previousSnapshots,
      discovered: discovered.flatMap((item) => (item.snapshot ? [item.snapshot] : [])),
      activeSessionKeys,
    }),
    companyEvents,
  };
}

export const syncCompanyCommunicationState = syncDelegationClosedLoopState;
