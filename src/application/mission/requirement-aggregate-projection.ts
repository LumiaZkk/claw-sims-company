import { pickCurrentParticipant, type ParticipantProgressTone } from "../../domain/mission/participant-progress";
import type { Company, RequirementAggregateRecord, WorkItemRecord } from "../../domain";
import type { RequirementRoomRecord } from "../../domain/delegation/types";
import type { RequirementExecutionOverview, RequirementParticipantProgress } from "./requirement-overview";
import {
  findMatchingRoomForAggregate,
  findMatchingWorkItem,
  readString,
  resolveEmployee,
  selectPrimaryRequirementAggregate,
  uniqueIds,
} from "./requirement-aggregate-core";
import { normalizeProductWorkItemIdentity } from "./work-item";

function mapLifecycleToParticipantStatus(
  status: RequirementAggregateRecord["status"],
): {
  statusLabel: string;
  tone: ParticipantProgressTone;
  isBlocking: boolean;
} {
  if (status === "blocked") {
    return { statusLabel: "已阻塞", tone: "rose", isBlocking: true };
  }
  if (status === "waiting_peer") {
    return { statusLabel: "待回复", tone: "amber", isBlocking: false };
  }
  if (status === "waiting_owner") {
    return { statusLabel: "待接手", tone: "violet", isBlocking: false };
  }
  if (status === "waiting_review") {
    return { statusLabel: "已确认", tone: "emerald", isBlocking: false };
  }
  if (status === "completed" || status === "archived") {
    return { statusLabel: "已回复", tone: "emerald", isBlocking: false };
  }
  if (status === "draft") {
    return { statusLabel: "待排期", tone: "slate", isBlocking: false };
  }
  return { statusLabel: "已开工", tone: "blue", isBlocking: false };
}

function mapWorkStepToParticipantStatus(
  status: WorkItemRecord["steps"][number]["status"],
): {
  statusLabel: string;
  tone: ParticipantProgressTone;
  isBlocking: boolean;
} {
  if (status === "blocked") {
    return { statusLabel: "已阻塞", tone: "rose", isBlocking: true };
  }
  if (status === "active") {
    return { statusLabel: "已开工", tone: "blue", isBlocking: false };
  }
  if (status === "done" || status === "skipped") {
    return { statusLabel: "已回复", tone: "emerald", isBlocking: false };
  }
  return { statusLabel: "待回复", tone: "amber", isBlocking: false };
}

function buildParticipantFromAggregate(input: {
  company: Company;
  actorId: string;
  stage: string;
  statusLabel: string;
  tone: ParticipantProgressTone;
  detail: string;
  updatedAt: number;
  isBlocking: boolean;
  isCurrent: boolean;
}): RequirementParticipantProgress {
  const employee = resolveEmployee(input.company, input.actorId);
  return {
    agentId: input.actorId,
    nickname: employee?.nickname ?? input.actorId,
    role: employee?.role ?? "团队成员",
    stage: input.stage,
    statusLabel: input.statusLabel,
    detail: input.detail,
    updatedAt: input.updatedAt,
    tone: input.tone,
    isBlocking: input.isBlocking,
    isCurrent: input.isCurrent,
  };
}

function buildFallbackParticipants(input: {
  company: Company;
  aggregate: RequirementAggregateRecord;
  workItem: WorkItemRecord | null;
  room: RequirementRoomRecord | null;
}): RequirementParticipantProgress[] {
  const participants: RequirementParticipantProgress[] = [];
  const stepParticipants = (input.workItem?.steps ?? [])
    .map((step) => {
      const actorId = readString(step.assigneeActorId);
      if (!actorId) {
        return null;
      }
      const status = mapWorkStepToParticipantStatus(step.status);
      return buildParticipantFromAggregate({
        company: input.company,
        actorId,
        stage: step.title,
        statusLabel: status.statusLabel,
        tone: status.tone,
        detail: readString(step.detail) ?? readString(step.completionCriteria) ?? input.aggregate.summary,
        updatedAt: step.updatedAt,
        isBlocking: status.isBlocking,
        isCurrent: actorId === input.aggregate.ownerActorId,
      });
    })
    .filter((participant): participant is RequirementParticipantProgress => Boolean(participant));
  participants.push(...stepParticipants);

  const ownerActorId = readString(input.aggregate.ownerActorId);
  if (
    ownerActorId &&
    !participants.some((participant) => participant.agentId === ownerActorId)
  ) {
    const status = mapLifecycleToParticipantStatus(input.aggregate.status);
    participants.push(
      buildParticipantFromAggregate({
        company: input.company,
        actorId: ownerActorId,
        stage: input.aggregate.stage,
        statusLabel: status.statusLabel,
        tone: status.tone,
        detail: input.aggregate.summary,
        updatedAt: input.aggregate.updatedAt,
        isBlocking: status.isBlocking,
        isCurrent: true,
      }),
    );
  }

  uniqueIds([...(input.room?.memberIds ?? []), ...(input.aggregate.memberIds ?? [])]).forEach((actorId) => {
    if (participants.some((participant) => participant.agentId === actorId)) {
      return;
    }
    const status = actorId === ownerActorId
      ? mapLifecycleToParticipantStatus(input.aggregate.status)
      : { statusLabel: "待回复", tone: "amber" as const, isBlocking: false };
    participants.push(
      buildParticipantFromAggregate({
        company: input.company,
        actorId,
        stage: actorId === ownerActorId ? input.aggregate.stage : "待命",
        statusLabel: status.statusLabel,
        tone: status.tone,
        detail: input.aggregate.summary,
        updatedAt: input.aggregate.updatedAt,
        isBlocking: status.isBlocking,
        isCurrent: actorId === ownerActorId,
      }),
    );
  });

  if (participants.length === 0) {
    return [];
  }

  const current = pickCurrentParticipant(participants);
  return participants
    .map((participant) => ({
      ...participant,
      isCurrent: current ? participant.agentId === current.agentId : participant.isCurrent,
    }))
    .sort((left, right) => right.updatedAt - left.updatedAt);
}

export function buildAggregateBackedRequirementOverview(input: {
  company: Company;
  aggregate: RequirementAggregateRecord | null;
  workItem: WorkItemRecord | null;
  room: RequirementRoomRecord | null;
  rawOverview?: RequirementExecutionOverview | null;
}): RequirementExecutionOverview | null {
  if (!input.aggregate) {
    return input.rawOverview ?? null;
  }
  const overviewIdentity = normalizeProductWorkItemIdentity({
    workItemId: input.workItem?.id ?? input.aggregate.workItemId ?? input.aggregate.id,
    topicKey: input.aggregate.topicKey ?? input.workItem?.topicKey ?? null,
    title: readString(input.workItem?.title) ?? input.aggregate.summary ?? null,
  });
  const canonicalTopicKey =
    overviewIdentity.topicKey ??
    readString(input.aggregate.topicKey) ??
    readString(input.workItem?.topicKey) ??
    null;
  if (
    input.rawOverview &&
    (!canonicalTopicKey || input.rawOverview.topicKey === canonicalTopicKey)
  ) {
    return canonicalTopicKey && input.rawOverview.topicKey !== canonicalTopicKey
      ? { ...input.rawOverview, topicKey: canonicalTopicKey }
      : input.rawOverview;
  }
  const participants = buildFallbackParticipants({
    company: input.company,
    aggregate: input.aggregate,
    workItem: input.workItem,
    room: input.room,
  });
  const currentParticipant = pickCurrentParticipant(participants);
  return {
    topicKey:
      canonicalTopicKey ??
      input.aggregate.id,
    title: readString(input.workItem?.title) ?? input.aggregate.summary ?? "当前主线",
    startedAt: input.aggregate.startedAt,
    headline: readString(input.workItem?.headline) ?? input.aggregate.summary,
    summary: input.aggregate.summary,
    currentOwnerAgentId: input.aggregate.ownerActorId,
    currentOwnerLabel:
      readString(input.workItem?.ownerLabel) ?? input.aggregate.ownerLabel ?? currentParticipant?.nickname ?? "当前负责人",
    currentStage:
      readString(input.workItem?.displayStage) ?? input.aggregate.stage ?? currentParticipant?.stage ?? "进行中",
    nextAction: input.aggregate.nextAction,
    participants,
  };
}

export function selectPrimaryRequirementProjection(input: {
  company: Company | null;
  activeRequirementAggregates: RequirementAggregateRecord[];
  primaryRequirementId: string | null;
  activeWorkItems: WorkItemRecord[];
  activeRoomRecords: RequirementRoomRecord[];
}): {
  aggregate: RequirementAggregateRecord | null;
  workItem: WorkItemRecord | null;
  room: RequirementRoomRecord | null;
} {
  const aggregate = selectPrimaryRequirementAggregate({
    activeRequirementAggregates: input.activeRequirementAggregates,
    primaryRequirementId: input.primaryRequirementId,
  });
  if (!aggregate) {
    return { aggregate: null, workItem: null, room: null };
  }
  return {
    aggregate,
    workItem: findMatchingWorkItem(aggregate, input.activeWorkItems),
    room: findMatchingRoomForAggregate(aggregate, input.activeRoomRecords),
  };
}
