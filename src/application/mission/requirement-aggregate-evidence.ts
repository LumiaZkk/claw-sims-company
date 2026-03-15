import type {
  Company,
  ConversationStateRecord,
  RequirementAggregateRecord,
  RequirementEvidenceEvent,
  RequirementLifecycleState,
  WorkItemRecord,
} from "../../domain";
import type { RequirementRoomRecord } from "../../domain/delegation/types";
import {
  findMatchingRoom,
  findMatchingRoomForAggregate,
  materializeAggregateRecord,
  normalizeRequirementTopicKey,
  pickPrimaryAggregateId,
  readString,
  readStringArray,
  resolveEmployee,
  sanitizeRequirementAggregateRecords,
  sortIds,
  uniqueIds,
} from "./requirement-aggregate-core";
import { diffRequirementAggregateMaterialFields } from "./requirement-aggregate-diff";

export function resolveRequirementAggregateIdForEvidence(input: {
  activeRequirementAggregates: RequirementAggregateRecord[];
  activeRoomRecords: RequirementRoomRecord[];
  primaryRequirementId: string | null;
  event: RequirementEvidenceEvent;
}): string | null {
  const explicitAggregateId = readString(input.event.aggregateId);
  if (
    explicitAggregateId &&
    input.activeRequirementAggregates.some((aggregate) => aggregate.id === explicitAggregateId)
  ) {
    return explicitAggregateId;
  }

  const workItemId = readString(input.event.payload.workItemId);
  if (workItemId) {
    const matched =
      input.activeRequirementAggregates.find((aggregate) => aggregate.workItemId === workItemId) ??
      input.activeRequirementAggregates.find((aggregate) => aggregate.id === workItemId) ??
      null;
    if (matched) {
      return matched.id;
    }
  }

  const roomId = readString(input.event.payload.roomId);
  if (roomId) {
    const matched =
      input.activeRequirementAggregates.find((aggregate) => aggregate.roomId === roomId) ??
      null;
    if (matched) {
      return matched.id;
    }
  }

  const topicKey = normalizeRequirementTopicKey(readString(input.event.payload.topicKey));
  if (topicKey) {
    const matched =
      input.activeRequirementAggregates.find((aggregate) => aggregate.topicKey === topicKey) ??
      null;
    if (matched) {
      return matched.id;
    }
  }

  const sessionKey = readString(input.event.sessionKey);
  if (sessionKey) {
    const matchedByConversation =
      input.activeRequirementAggregates.find((aggregate) => aggregate.sourceConversationId === sessionKey) ??
      input.activeRequirementAggregates.find((aggregate) =>
        input.activeRoomRecords.some(
          (room) => room.id === aggregate.roomId && room.sessionKey === sessionKey,
        ),
      ) ??
      null;
    if (matchedByConversation) {
      return matchedByConversation.id;
    }
  }

  const actorId = readString(input.event.actorId);
  if (actorId && input.primaryRequirementId) {
    const primary =
      input.activeRequirementAggregates.find((aggregate) => aggregate.id === input.primaryRequirementId) ??
      null;
    if (
      primary &&
      (primary.ownerActorId === actorId || primary.memberIds.includes(actorId))
    ) {
      return primary.id;
    }
  }

  return null;
}

export function applyRequirementEvidenceToAggregates(input: {
  company: Company;
  activeConversationStates: ConversationStateRecord[];
  activeRequirementAggregates: RequirementAggregateRecord[];
  activeRoomRecords: RequirementRoomRecord[];
  activeWorkItems: WorkItemRecord[];
  primaryRequirementId: string | null;
  event: RequirementEvidenceEvent;
}): {
  activeRequirementAggregates: RequirementAggregateRecord[];
  primaryRequirementId: string | null;
  applied: boolean;
  aggregateId: string | null;
} {
  let targetAggregateId = resolveRequirementAggregateIdForEvidence({
    activeRequirementAggregates: input.activeRequirementAggregates,
    activeRoomRecords: input.activeRoomRecords,
    primaryRequirementId: input.primaryRequirementId,
    event: input.event,
  });
  let baseAggregates = input.activeRequirementAggregates;
  let nextPrimaryRequirementId = input.primaryRequirementId;
  if (!targetAggregateId) {
    const workItemId = readString(input.event.payload.workItemId);
    const topicKey = readString(input.event.payload.topicKey);
    const sessionKey = readString(input.event.sessionKey);
    const workItem =
      (workItemId
        ? input.activeWorkItems.find((item) => item.id === workItemId || item.workKey === workItemId) ?? null
        : null) ??
      (topicKey
        ? input.activeWorkItems.find((item) => item.topicKey === topicKey && item.status !== "archived") ?? null
        : null);
    const existing =
      (sessionKey
        ? input.activeRequirementAggregates.find((aggregate) => aggregate.sourceConversationId === sessionKey) ?? null
        : null) ??
      null;
    const room =
      (workItem ? findMatchingRoom(workItem, input.activeRoomRecords) : null) ??
      (existing ? findMatchingRoomForAggregate(existing, input.activeRoomRecords) : null) ??
      (topicKey
        ? input.activeRoomRecords.find((record) => record.topicKey === topicKey) ?? null
        : null);
    const draftConversationState =
      (sessionKey
        ? input.activeConversationStates.find((state) => state.conversationId === sessionKey) ?? null
        : null) ??
      (workItem
        ? input.activeConversationStates.find(
            (state) =>
              state.currentWorkItemId === workItem.id ||
              state.currentWorkKey === workItem.workKey,
          ) ?? null
        : null) ??
      (topicKey
        ? input.activeConversationStates.find((state) => state.draftRequirement?.topicKey === topicKey) ?? null
        : null);
    const bootstrapId =
      readString(input.event.aggregateId) ??
      readString(workItem?.id) ??
      readString(draftConversationState?.currentWorkItemId) ??
      readString(draftConversationState?.currentWorkKey) ??
      (topicKey ? `topic:${topicKey}` : null) ??
      sessionKey;
    const bootstrapAggregate = materializeAggregateRecord({
      companyId: input.company.id,
      existing,
      workItem,
      room,
      evidence: [input.event],
      draftRequirement: draftConversationState?.draftRequirement ?? null,
      draftConversationId: draftConversationState?.conversationId ?? sessionKey,
      fallbackId: bootstrapId,
    });
    if (!bootstrapAggregate) {
      return {
        activeRequirementAggregates: input.activeRequirementAggregates,
        primaryRequirementId: input.primaryRequirementId,
        applied: false,
        aggregateId: null,
      };
    }
    baseAggregates = [...input.activeRequirementAggregates, bootstrapAggregate];
    nextPrimaryRequirementId = pickPrimaryAggregateId({
      aggregates: baseAggregates,
      currentPrimaryRequirementId: input.primaryRequirementId,
      conversationStates: input.activeConversationStates,
    });
    targetAggregateId = bootstrapAggregate.id;
  }

  const nextAggregates = baseAggregates.map((aggregate) => {
    if (aggregate.id !== targetAggregateId) {
      return aggregate;
    }
    const nextOwnerActorId =
      readString(input.event.payload.ownerActorId) ??
      readString(input.event.actorId) ??
      aggregate.ownerActorId;
    const nextOwnerLabel =
      nextOwnerActorId
        ? resolveEmployee(input.company, nextOwnerActorId)?.nickname ?? aggregate.ownerLabel
        : aggregate.ownerLabel;
    const nextStatus = readString(input.event.payload.status);
    const lifecycleStatus: RequirementLifecycleState | null =
      nextStatus === "draft" ||
      nextStatus === "active" ||
      nextStatus === "waiting_peer" ||
      nextStatus === "waiting_owner" ||
      nextStatus === "waiting_review" ||
      nextStatus === "blocked" ||
      nextStatus === "completed" ||
      nextStatus === "archived"
        ? nextStatus
        : null;
    const nextLastEvidenceAt = Math.max(aggregate.lastEvidenceAt ?? 0, input.event.timestamp) || null;
    const nextRecordBase: RequirementAggregateRecord = {
      ...aggregate,
      ownerActorId: nextOwnerActorId,
      ownerLabel: nextOwnerLabel,
      roomId: readString(input.event.payload.roomId) ?? aggregate.roomId,
      topicKey: readString(input.event.payload.topicKey) ?? aggregate.topicKey,
      stage:
        readString(input.event.payload.stage) ??
        readString(input.event.payload.stageLabel) ??
        aggregate.stage,
      summary:
        readString(input.event.payload.summary) ??
        readString(input.event.payload.messageText) ??
        aggregate.summary,
      nextAction: readString(input.event.payload.nextAction) ?? aggregate.nextAction,
      memberIds: sortIds(
        uniqueIds([
          ...aggregate.memberIds,
          nextOwnerActorId,
          ...readStringArray(input.event.payload.memberIds),
        ]),
      ),
      sourceConversationId: readString(input.event.sessionKey) ?? aggregate.sourceConversationId,
      status: lifecycleStatus ?? aggregate.status,
    };
    const changedFields = diffRequirementAggregateMaterialFields(aggregate, nextRecordBase);
    if (changedFields.length === 0 && nextLastEvidenceAt === (aggregate.lastEvidenceAt ?? null)) {
      return aggregate;
    }
    return {
      ...nextRecordBase,
      updatedAt:
        changedFields.length > 0
          ? Math.max(aggregate.updatedAt, input.event.timestamp)
          : aggregate.updatedAt,
      lastEvidenceAt: nextLastEvidenceAt,
      revision: changedFields.length > 0 ? aggregate.revision + 1 : aggregate.revision,
    };
  });

  return {
    activeRequirementAggregates: sanitizeRequirementAggregateRecords(
      nextAggregates,
      nextPrimaryRequirementId,
    ),
    primaryRequirementId: nextPrimaryRequirementId,
    applied: true,
    aggregateId: targetAggregateId,
  };
}
