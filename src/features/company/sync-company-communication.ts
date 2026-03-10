import { buildHandoffRecords } from "../handoffs/handoff-object";
import { buildRequestRecords } from "../requests/request-object";
import { reconcileCompanyCommunication } from "../requests/reconcile";
import {
  buildDerivedKnowledgeItems,
  mergeCompanyKnowledgeItems,
} from "../knowledge/shared-knowledge";
import {
  createRequirementMessageSnapshots,
  REQUIREMENT_SNAPSHOT_MESSAGE_LIMIT,
  type RequirementArtifactCheck,
  type RequirementSessionSnapshot,
} from "../execution/requirement-overview";
import type {
  ArtifactRecord,
  Company,
  DispatchRecord,
  HandoffRecord,
} from "./types";
import {
  mergeDispatchRecords,
  projectCompanyCommunicationFromEvents,
  uniqueHandoffList,
} from "./events";
import type { ChatMessage } from "../backend";
import { resolveSessionActorId, resolveSessionUpdatedAt } from "../../lib/sessions";
import { gateway } from "../backend";

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
    };
  });

  return {
    handoffs: uniqueHandoffList(normalizedHandoffs),
    normalizedHandoffIds,
  };
}

async function listAllCompanyEvents(companyId: string) {
  const events: Awaited<ReturnType<typeof gateway.listCompanyEvents>>["events"] = [];
  let cursor: string | null | undefined;
  let pageCount = 0;
  do {
    const page = await gateway.listCompanyEvents({
      companyId,
      cursor: cursor ?? undefined,
      limit: 500,
    });
    events.push(...page.events);
    cursor = page.nextCursor;
    pageCount += 1;
  } while (cursor && pageCount < 10);
  return events;
}

export async function syncCompanyCommunicationState(input: {
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

  const companyEvents = await listAllCompanyEvents(input.company.id);
  const projected = projectCompanyCommunicationFromEvents({
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

      const artifactChecks: RequirementArtifactCheck[] = extractArtifactPathsFromMessages(normalizedMessages)
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
