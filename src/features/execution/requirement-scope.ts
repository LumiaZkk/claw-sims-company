import type {
  Company,
  HandoffRecord,
  RequestRecord,
  TrackedTask,
  WorkItemRecord,
} from "../company/types";
import type { RequirementExecutionOverview } from "./requirement-overview";
import type { SlaAlert } from "../sla/escalation-rules";
import { getActiveHandoffs, inferHandoffTopicKey } from "../handoffs/active-handoffs";
import { getActiveRequests } from "../requests/request-health";
import { requestTopicMatchesText } from "../requests/topic";

export type RequirementScope = {
  topicKey: string;
  title: string;
  tasks: TrackedTask[];
  requests: RequestRecord[];
  handoffs: HandoffRecord[];
  participantAgentIds: string[];
};

function matchesTopic(topicKey: string, values: Array<string | null | undefined>): boolean {
  const corpus = values
    .filter((value): value is string => typeof value === "string" && value.trim().length > 0)
    .join("\n");
  if (!corpus) {
    return false;
  }
  return requestTopicMatchesText(topicKey, corpus);
}

function matchesTaskTopic(task: TrackedTask, topicKey: string): boolean {
  return matchesTopic(topicKey, [
    task.title,
    task.summary,
    task.blockedReason,
    ...task.steps.map((step) => step.text),
  ]);
}

function matchesRequestTopic(request: RequestRecord, topicKey: string): boolean {
  if (request.topicKey === topicKey) {
    return true;
  }
  return matchesTopic(topicKey, [request.title, request.summary, request.responseSummary]);
}

function matchesHandoffTopic(handoff: HandoffRecord, topicKey: string): boolean {
  if (inferHandoffTopicKey(handoff) === topicKey) {
    return true;
  }
  return matchesTopic(topicKey, [
    handoff.title,
    handoff.summary,
    ...(handoff.checklist ?? []),
    ...(handoff.missingItems ?? []),
    ...(handoff.artifactPaths ?? []),
  ]);
}

function matchesWorkItemContext(
  workItem: WorkItemRecord | null | undefined,
  values: Array<string | null | undefined>,
): boolean {
  if (!workItem) {
    return false;
  }
  const corpus = values
    .filter((value): value is string => typeof value === "string" && value.trim().length > 0)
    .join("\n");
  if (!corpus) {
    return false;
  }
  const needles = [
    workItem.title,
    workItem.goal,
    workItem.summary,
    workItem.nextAction,
    ...workItem.steps.map((step) => `${step.title}\n${step.detail ?? ""}`),
  ]
    .filter((value): value is string => typeof value === "string" && value.trim().length > 0)
    .map((value) => value.trim().toLowerCase())
    .filter((value) => value.length >= 4);
  const haystack = corpus.toLowerCase();
  return needles.some((needle) => haystack.includes(needle) || needle.includes(haystack));
}

export function buildRequirementScope(
  company: Company,
  overview: RequirementExecutionOverview | null,
  workItem?: WorkItemRecord | null,
): RequirementScope | null {
  const topicKey = workItem?.topicKey ?? overview?.topicKey;
  if (!topicKey) {
    return null;
  }

  const startedAt = workItem?.startedAt ?? overview?.startedAt ?? 0;
  const workItemParticipantIds = [
    workItem?.ownerActorId,
    workItem?.batonActorId,
    ...(workItem?.steps ?? []).flatMap((step) => step.assigneeActorId),
  ].filter((agentId, index, array): agentId is string => {
    return typeof agentId === "string" && array.indexOf(agentId) === index;
  });
  const participantFilter =
    workItemParticipantIds.length > 0 ? new Set(workItemParticipantIds) : null;
  const tasks = (company.tasks ?? []).filter(
    (task) =>
      task.updatedAt >= startedAt &&
      (matchesTaskTopic(task, topicKey) ||
        matchesWorkItemContext(workItem, [
          task.title,
          task.summary,
          task.blockedReason,
          ...task.steps.map((step) => step.text),
        ])) &&
      (!participantFilter ||
        participantFilter.has(task.agentId) ||
        (task.assigneeAgentIds ?? []).some((agentId) => participantFilter.has(agentId)) ||
        ((!task.agentId || (task.assigneeAgentIds ?? []).length === 0) &&
          (task.ownerAgentId ? participantFilter.has(task.ownerAgentId) : false))),
  );
  const requests = getActiveRequests(company.requests ?? []).filter((request) =>
    request.updatedAt >= startedAt &&
    (matchesRequestTopic(request, topicKey) ||
      matchesWorkItemContext(workItem, [request.title, request.summary, request.responseSummary])) &&
    (!participantFilter ||
      request.toAgentIds.some((agentId) => participantFilter.has(agentId)) ||
      (request.toAgentIds.length === 0 &&
        (request.fromAgentId ? participantFilter.has(request.fromAgentId) : false))),
  );
  const handoffs = getActiveHandoffs(company.handoffs ?? []).filter((handoff) =>
    handoff.updatedAt >= startedAt &&
    (matchesHandoffTopic(handoff, topicKey) ||
      matchesWorkItemContext(workItem, [
        handoff.title,
        handoff.summary,
        ...(handoff.checklist ?? []),
        ...(handoff.missingItems ?? []),
        ...(handoff.artifactPaths ?? []),
      ])) &&
    (!participantFilter ||
      handoff.toAgentIds.some((agentId) => participantFilter.has(agentId)) ||
      (handoff.toAgentIds.length === 0 &&
        (handoff.fromAgentId ? participantFilter.has(handoff.fromAgentId) : false))),
  );

  const participantAgentIds = [
    ...(overview?.participants ?? []).map((participant) => participant.agentId),
    ...workItemParticipantIds,
    ...tasks.flatMap((task) => [
      task.agentId,
      task.ownerAgentId,
      ...(task.assigneeAgentIds ?? []),
    ]),
    ...requests.flatMap((request) => [request.fromAgentId, ...request.toAgentIds]),
    ...handoffs.flatMap((handoff) => [handoff.fromAgentId, ...handoff.toAgentIds]),
  ].filter((agentId, index, array): agentId is string => {
    return typeof agentId === "string" && array.indexOf(agentId) === index;
  });

  return {
    topicKey,
    title: workItem?.title ?? overview?.title ?? "当前需求",
    tasks,
    requests,
    handoffs,
    participantAgentIds,
  };
}

export function filterRequirementSlaAlerts(
  alerts: SlaAlert[],
  scope: RequirementScope | null,
): SlaAlert[] {
  if (!scope) {
    return alerts;
  }

  const taskIds = new Set(scope.tasks.map((task) => task.id));
  const handoffIds = new Set(scope.handoffs.map((handoff) => handoff.id));
  const sessionKeys = new Set([
    ...scope.tasks.map((task) => task.sessionKey),
    ...scope.handoffs.map((handoff) => handoff.sessionKey),
    ...scope.requests.map((request) => request.sessionKey),
  ]);
  const ownerAgentIds = new Set(scope.participantAgentIds);

  return alerts.filter((alert) => {
    if (alert.taskId && taskIds.has(alert.taskId)) {
      return true;
    }
    if (alert.handoffId && handoffIds.has(alert.handoffId)) {
      return true;
    }
    if (alert.sessionKey && sessionKeys.has(alert.sessionKey)) {
      return true;
    }
    if (alert.ownerAgentId && ownerAgentIds.has(alert.ownerAgentId)) {
      return true;
    }
    return false;
  });
}
