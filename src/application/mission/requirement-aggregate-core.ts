import type { RequirementRoomRecord } from "../../domain/delegation/types";
import type {
  Company,
  ConversationStateRecord,
  DraftRequirementRecord,
  RequirementAcceptanceStatus,
  RequirementAggregateRecord,
  RequirementEvidenceEvent,
  RequirementLifecycleState,
  WorkItemRecord,
} from "../../domain";
import { isVisibleRequirementRoomMessage } from "../delegation/room-routing";
import { isArtifactRequirementTopic, isStrategicRequirementTopic } from "./requirement-kind";
import {
  resolveRequirementLifecyclePhase,
  resolveRequirementStageGateStatus,
} from "./requirement-lifecycle";
import { diffRequirementAggregateMaterialFields } from "./requirement-aggregate-diff";
import { isCanonicalProductWorkItemRecord } from "./work-item-signal";
import {
  buildRoomRecordIdFromWorkItem,
  normalizeProductWorkItemIdentity,
  normalizeStrategicWorkItemId,
} from "./work-item";

export function readString(value: unknown): string | null {
  return typeof value === "string" && value.trim().length > 0 ? value.trim() : null;
}

export function readStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) {
    return [];
  }
  return [...new Set(value.map((entry) => readString(entry)).filter((entry): entry is string => Boolean(entry)))];
}

export function uniqueIds(values: Array<string | null | undefined>): string[] {
  return [...new Set(values.map((value) => readString(value)).filter((value): value is string => Boolean(value)))];
}

function hasStableDraftRequirement(
  draftRequirement: ConversationStateRecord["draftRequirement"] | null | undefined,
): draftRequirement is DraftRequirementRecord {
  return Boolean(
    draftRequirement &&
      readString(draftRequirement.summary) &&
      readString(draftRequirement.nextAction),
  );
}

export function sortIds(values: string[]) {
  return [...values].sort((left, right) => left.localeCompare(right));
}

function inferRequirementKind(topicKey: string | null | undefined): RequirementAggregateRecord["kind"] {
  return isStrategicRequirementTopic(topicKey) ? "strategic" : "execution";
}

export function normalizeRequirementTopicKey(
  topicKey: string | null | undefined,
  workItemId?: string | null,
  title?: string | null,
): string | null {
  return normalizeProductWorkItemIdentity({
    workItemId,
    topicKey,
    title,
  }).topicKey;
}

function normalizeRequirementAggregateRecord(
  record: RequirementAggregateRecord,
): RequirementAggregateRecord {
  const normalizedId = normalizeStrategicWorkItemId(record.id) ?? record.id;
  const normalizedIdentity = normalizeProductWorkItemIdentity({
    workItemId: record.workItemId ?? (normalizedId.startsWith("topic:") ? normalizedId : null),
    topicKey: record.topicKey,
    title: record.summary,
  });
  const normalizedWorkItemId =
    normalizedIdentity.workItemId ??
    normalizeStrategicWorkItemId(record.workItemId) ??
    (normalizedId.startsWith("topic:") ? normalizedId : null);
  const normalizedTopicKey =
    normalizedIdentity.topicKey ??
    normalizeRequirementTopicKey(
      normalizedId.startsWith("topic:") ? normalizedId.slice("topic:".length) : null,
      normalizedWorkItemId,
      record.summary,
    ) ??
    null;

  return {
    ...record,
    id: normalizedId,
    topicKey: normalizedTopicKey,
    workItemId: normalizedWorkItemId,
    roomId:
      normalizedWorkItemId
        ? buildRoomRecordIdFromWorkItem(normalizedWorkItemId)
        : readString(record.roomId),
    ownerActorId: readString(record.ownerActorId),
    sourceConversationId: readString(record.sourceConversationId),
  };
}

function deriveRequirementAcceptanceStatus(input: {
  existing: RequirementAggregateRecord | null;
  nextLifecycleStatus: RequirementLifecycleState;
}): RequirementAcceptanceStatus {
  const existingAcceptanceStatus = input.existing?.acceptanceStatus ?? "not_requested";
  if (existingAcceptanceStatus === "rejected") {
    return "rejected";
  }
  if (existingAcceptanceStatus === "accepted") {
    return input.nextLifecycleStatus === "completed" || input.nextLifecycleStatus === "archived"
      ? "accepted"
      : "not_requested";
  }
  if (
    input.nextLifecycleStatus === "completed" ||
    input.nextLifecycleStatus === "waiting_review" ||
    existingAcceptanceStatus === "pending"
  ) {
    return input.nextLifecycleStatus === "draft" ||
      input.nextLifecycleStatus === "active" ||
      input.nextLifecycleStatus === "waiting_peer" ||
      input.nextLifecycleStatus === "waiting_owner" ||
      input.nextLifecycleStatus === "blocked"
      ? "not_requested"
      : "pending";
  }
  return "not_requested";
}

export function mapWorkItemStatusToRequirementLifecycleState(
  status: WorkItemRecord["status"],
): RequirementLifecycleState {
  if (status === "draft") {
    return "draft";
  }
  if (status === "waiting_owner") {
    return "waiting_owner";
  }
  if (status === "waiting_review") {
    return "waiting_review";
  }
  if (status === "blocked") {
    return "blocked";
  }
  if (status === "completed") {
    return "completed";
  }
  if (status === "archived") {
    return "archived";
  }
  return "active";
}

function mapRoomStatusToRequirementLifecycleState(
  room: RequirementRoomRecord | null,
): RequirementLifecycleState | null {
  if (!room) {
    return null;
  }
  if (room.status === "archived") {
    return "archived";
  }
  return "active";
}

export function resolveEmployee(company: Company, actorId: string | null | undefined) {
  if (!actorId) {
    return null;
  }
  return company.employees.find((employee) => employee.agentId === actorId) ?? null;
}

function buildAggregateId(input: {
  existingId?: string | null;
  workItem?: WorkItemRecord | null;
  room?: RequirementRoomRecord | null;
  topicKey?: string | null;
  fallbackId?: string | null;
}): string | null {
  const workItemId = normalizeStrategicWorkItemId(input.workItem?.id) ?? readString(input.workItem?.id);
  if (workItemId) {
    return workItemId;
  }
  const roomWorkItemId =
    normalizeStrategicWorkItemId(input.room?.workItemId) ?? readString(input.room?.workItemId);
  if (roomWorkItemId) {
    return roomWorkItemId;
  }
  const topicKey =
    normalizeRequirementTopicKey(
      readString(input.topicKey) ?? readString(input.room?.topicKey),
      workItemId ?? roomWorkItemId,
    ) ??
    null;
  if (topicKey) {
    return `topic:${topicKey}`;
  }
  const existingId = normalizeStrategicWorkItemId(input.existingId) ?? readString(input.existingId);
  if (existingId) {
    return existingId;
  }
  const fallbackId = normalizeStrategicWorkItemId(input.fallbackId) ?? readString(input.fallbackId);
  if (fallbackId) {
    return fallbackId;
  }
  return readString(input.room?.id);
}

export function findMatchingRoom(
  workItem: WorkItemRecord | null,
  rooms: RequirementRoomRecord[],
): RequirementRoomRecord | null {
  if (!workItem) {
    return null;
  }
  return (
    rooms.find(
      (room) =>
        room.id === workItem.roomId ||
        room.workItemId === workItem.id ||
        (workItem.topicKey && room.topicKey === workItem.topicKey),
    ) ?? null
  );
}

export function findMatchingWorkItem(
  aggregate: RequirementAggregateRecord,
  workItems: WorkItemRecord[],
): WorkItemRecord | null {
  return (
    workItems.find((item) => item.id === aggregate.workItemId) ??
    workItems.find((item) => item.workKey === aggregate.workItemId) ??
    workItems.find((item) => item.id === aggregate.id) ??
    (aggregate.topicKey
      ? workItems.find((item) => item.topicKey === aggregate.topicKey && item.status !== "archived")
      : null) ??
    null
  );
}

export function findMatchingRoomForAggregate(
  aggregate: RequirementAggregateRecord,
  rooms: RequirementRoomRecord[],
): RequirementRoomRecord | null {
  return (
    rooms.find((room) => room.id === aggregate.roomId) ??
    rooms.find((room) => room.workItemId === aggregate.workItemId) ??
    (aggregate.topicKey ? rooms.find((room) => room.topicKey === aggregate.topicKey) : null) ??
    null
  );
}

function findLatestEvidenceTimestamp(
  aggregateId: string,
  evidence: RequirementEvidenceEvent[],
): number | null {
  const normalizedAggregateId = normalizeStrategicWorkItemId(aggregateId) ?? aggregateId;
  const latest = evidence
    .filter((event) => (normalizeStrategicWorkItemId(event.aggregateId) ?? event.aggregateId) === normalizedAggregateId)
    .reduce((max, event) => Math.max(max, event.timestamp), 0);
  return latest > 0 ? latest : null;
}

function readSourceConversationActorId(sessionKey: string | null | undefined): string | null {
  const normalized = readString(sessionKey);
  if (!normalized || !normalized.startsWith("agent:")) {
    return null;
  }
  const parts = normalized.split(":");
  const actorId = parts[1]?.trim();
  return actorId && actorId.length > 0 ? actorId : null;
}

function roomHasVisibleTranscript(room: RequirementRoomRecord | null | undefined): boolean {
  return Boolean(room?.transcript?.some((message) => isVisibleRequirementRoomMessage(message)));
}

function isRoomShellDerivedAggregate(
  aggregate: RequirementAggregateRecord | null,
  room: RequirementRoomRecord | null,
): boolean {
  if (!aggregate || !room || roomHasVisibleTranscript(room)) {
    return false;
  }
  const roomHeadline = readString(room.headline) ?? readString(room.title);
  const roomProgress = readString(room.progress);
  return Boolean(
    roomHeadline &&
      roomProgress &&
      aggregate.summary === roomHeadline &&
      aggregate.stage === roomProgress &&
      aggregate.nextAction === roomProgress,
  );
}

function resolveAggregateOwnerActorId(input: {
  workItem: WorkItemRecord | null;
  room: RequirementRoomRecord | null;
  draftRequirement?: ConversationStateRecord["draftRequirement"] | null;
  existing: RequirementAggregateRecord | null;
}): string | null {
  const existingLooksShellDerived = isRoomShellDerivedAggregate(input.existing, input.room);
  const sourceConversationActorId =
    readSourceConversationActorId(input.draftRequirement ? null : input.existing?.sourceConversationId) ??
    readSourceConversationActorId(input.room?.sessionKey) ??
    readSourceConversationActorId(input.workItem?.sourceConversationId) ??
    readSourceConversationActorId(input.workItem?.sessionKey) ??
    null;
  const trustedRoomOwnerActorId = roomHasVisibleTranscript(input.room)
    ? readString(input.room?.ownerActorId) ?? readString(input.room?.ownerAgentId)
    : null;
  return (
    readString(input.workItem?.ownerActorId) ??
    readString(input.draftRequirement?.ownerActorId) ??
    (existingLooksShellDerived ? null : readString(input.existing?.ownerActorId)) ??
    sourceConversationActorId ??
    trustedRoomOwnerActorId ??
    null
  );
}

function resolveAggregateOwnerLabel(input: {
  workItem: WorkItemRecord | null;
  room: RequirementRoomRecord | null;
  draftRequirement?: ConversationStateRecord["draftRequirement"] | null;
  existing: RequirementAggregateRecord | null;
}): string {
  const existingLooksShellDerived = isRoomShellDerivedAggregate(input.existing, input.room);
  const trustedRoomTitle = roomHasVisibleTranscript(input.room) ? readString(input.room?.title) : null;
  return (
    readString(input.workItem?.ownerLabel) ??
    readString(input.draftRequirement?.ownerLabel) ??
    (existingLooksShellDerived ? null : readString(input.existing?.ownerLabel)) ??
    trustedRoomTitle ??
    "当前负责人"
  );
}

function buildAggregateIdFromConversationState(
  state: ConversationStateRecord,
): string | null {
  const currentWorkItemId =
    normalizeStrategicWorkItemId(state.currentWorkItemId) ?? readString(state.currentWorkItemId);
  if (currentWorkItemId) {
    return currentWorkItemId;
  }
  const currentWorkKey =
    normalizeStrategicWorkItemId(state.currentWorkKey) ?? readString(state.currentWorkKey);
  if (currentWorkKey) {
    return currentWorkKey;
  }
  const draftTopicKey = normalizeRequirementTopicKey(readString(state.draftRequirement?.topicKey));
  if (draftTopicKey) {
    return `topic:${draftTopicKey}`;
  }
  return readString(state.conversationId);
}

function findMatchingConversationState(
  aggregate: RequirementAggregateRecord | null,
  conversationStates: ConversationStateRecord[],
  workItem: WorkItemRecord | null,
): ConversationStateRecord | null {
  return (
    conversationStates.find((state) => state.currentWorkItemId === workItem?.id) ??
    conversationStates.find((state) => state.currentWorkKey === workItem?.workKey) ??
    conversationStates.find((state) => state.conversationId === aggregate?.sourceConversationId) ??
    (aggregate?.topicKey
      ? conversationStates.find((state) => state.draftRequirement?.topicKey === aggregate.topicKey)
      : null) ??
    conversationStates.find((state) => {
      const draft = state.draftRequirement;
      return (
        hasStableDraftRequirement(draft) &&
        (draft.ownerActorId === aggregate?.ownerActorId ||
          draft.summary === aggregate?.summary)
      );
    }) ??
    null
  );
}

function resolveDraftRequirementStatus(input: {
  existing: RequirementAggregateRecord | null;
  draftRequirement: ConversationStateRecord["draftRequirement"] | null | undefined;
}): RequirementLifecycleState {
  if (input.existing?.status) {
    return input.existing.status;
  }
  if (input.draftRequirement?.stageGateStatus === "waiting_confirmation") {
    return "waiting_owner";
  }
  return "active";
}

function buildAggregateMemberIds(
  existing: RequirementAggregateRecord | null,
  workItem: WorkItemRecord | null,
  room: RequirementRoomRecord | null,
  draftRequirement?: ConversationStateRecord["draftRequirement"] | null,
): string[] {
  return sortIds(
    uniqueIds([
      ...(existing?.memberIds ?? []),
      ...(room?.memberIds ?? []),
      ...(room?.memberActorIds ?? []),
      workItem?.ownerActorId,
      workItem?.batonActorId,
      draftRequirement?.ownerActorId,
      ...((workItem?.steps ?? []).map((step) => step.assigneeActorId ?? null)),
    ]),
  );
}

export function materializeAggregateRecord(input: {
  companyId: string;
  existing: RequirementAggregateRecord | null;
  workItem: WorkItemRecord | null;
  room: RequirementRoomRecord | null;
  evidence: RequirementEvidenceEvent[];
  draftRequirement?: ConversationStateRecord["draftRequirement"] | null;
  draftConversationId?: string | null;
  fallbackId?: string | null;
}): RequirementAggregateRecord | null {
  const id = buildAggregateId({
    existingId: input.existing?.id,
    workItem: input.workItem,
    room: input.room,
    topicKey: input.workItem?.topicKey ?? input.existing?.topicKey ?? null,
    fallbackId: input.fallbackId ?? null,
  });
  if (!id) {
    return null;
  }

  const topicKey =
    readString(input.workItem?.topicKey) ??
    readString(input.room?.topicKey) ??
    readString(input.draftRequirement?.topicKey) ??
    readString(input.existing?.topicKey) ??
    null;
  if (topicKey && isArtifactRequirementTopic(topicKey)) {
    return null;
  }

  const latestEvidenceAt = findLatestEvidenceTimestamp(id, input.evidence);
  const trustedRoomPresentation = roomHasVisibleTranscript(input.room);
  const existingLooksShellDerived = isRoomShellDerivedAggregate(input.existing, input.room);
  const nextLifecycleStatus =
    (input.workItem
      ? mapWorkItemStatusToRequirementLifecycleState(input.workItem.status)
      : mapRoomStatusToRequirementLifecycleState(input.room)) ??
    (hasStableDraftRequirement(input.draftRequirement)
      ? resolveDraftRequirementStatus({
          existing: input.existing,
          draftRequirement: input.draftRequirement,
        })
      : null) ??
    input.existing?.status ??
    "active";
  const acceptanceStatus = deriveRequirementAcceptanceStatus({
    existing: input.existing,
    nextLifecycleStatus,
  });
  const stageGateStatus = resolveRequirementStageGateStatus({
    explicitStageGateStatus:
      input.workItem?.stageGateStatus ??
      input.existing?.stageGateStatus ??
      input.draftRequirement?.stageGateStatus ??
      "none",
    completed: nextLifecycleStatus === "completed" || nextLifecycleStatus === "archived",
  });
  const lifecyclePhase = resolveRequirementLifecyclePhase({
    explicitLifecyclePhase:
      input.workItem?.lifecyclePhase ?? input.existing?.lifecyclePhase ?? null,
    stageGateStatus,
    promotionState: input.draftRequirement?.state,
    workItemStatus: input.workItem?.status ?? null,
    completed: nextLifecycleStatus === "completed" || nextLifecycleStatus === "archived",
    hasExecutionSignal:
      Boolean(input.room?.lastConclusionAt) ||
      Boolean(input.workItem?.dispatchIds.length) ||
      Boolean(input.workItem?.steps.some((step) => step.status === "active" || step.status === "done")),
  });
  const nextRecordBase: Omit<RequirementAggregateRecord, "revision" | "primary"> = {
    id,
    companyId: input.companyId,
    topicKey,
    kind:
      input.workItem?.kind === "artifact"
        ? inferRequirementKind(topicKey)
        : input.workItem?.kind === "strategic" || input.workItem?.kind === "execution"
          ? input.workItem.kind
          : inferRequirementKind(topicKey),
    workItemId:
      readString(input.workItem?.id) ??
      readString(input.room?.workItemId) ??
      readString(input.existing?.workItemId) ??
      null,
    roomId:
      readString(input.room?.id) ??
      readString(input.workItem?.roomId) ??
      readString(input.existing?.roomId) ??
      null,
    ownerActorId: resolveAggregateOwnerActorId({
      workItem: input.workItem,
      room: input.room,
      draftRequirement: input.draftRequirement,
      existing: input.existing,
    }),
    ownerLabel: resolveAggregateOwnerLabel({
      workItem: input.workItem,
      room: input.room,
      draftRequirement: input.draftRequirement,
      existing: input.existing,
    }),
    lifecyclePhase,
    stageGateStatus,
    stage:
      readString(input.workItem?.displayStage) ??
      readString(input.workItem?.stageLabel) ??
      readString(input.draftRequirement?.stage) ??
      (existingLooksShellDerived ? null : readString(input.existing?.stage)) ??
      (trustedRoomPresentation ? readString(input.room?.progress) : null) ??
      (stageGateStatus === "waiting_confirmation" ? "待确认" : "进行中"),
    summary:
      readString(input.workItem?.displaySummary) ??
      readString(input.workItem?.summary) ??
      readString(input.draftRequirement?.summary) ??
      (existingLooksShellDerived ? null : readString(input.existing?.summary)) ??
      (trustedRoomPresentation ? readString(input.room?.headline) : null) ??
      "当前主线正在推进。",
    nextAction:
      readString(input.workItem?.displayNextAction) ??
      readString(input.workItem?.nextAction) ??
      readString(input.draftRequirement?.nextAction) ??
      (existingLooksShellDerived ? null : readString(input.existing?.nextAction)) ??
      (trustedRoomPresentation ? readString(input.room?.progress) : null) ??
      "继续推进当前主线。",
    memberIds: buildAggregateMemberIds(
      input.existing,
      input.workItem,
      input.room,
      input.draftRequirement,
    ),
    sourceConversationId:
      readString(input.workItem?.sourceConversationId) ??
      readString(input.workItem?.sourceSessionKey) ??
      readString(input.workItem?.sessionKey) ??
      readString(input.room?.sessionKey) ??
      readString(input.draftConversationId) ??
      readString(input.existing?.sourceConversationId) ??
      null,
    startedAt:
      input.workItem?.startedAt ??
      input.room?.createdAt ??
      input.draftRequirement?.updatedAt ??
      input.existing?.startedAt ??
      Date.now(),
    updatedAt: Math.max(
      input.workItem?.updatedAt ?? 0,
      input.room?.updatedAt ?? 0,
      input.draftRequirement?.updatedAt ?? 0,
      input.existing?.updatedAt ?? 0,
      latestEvidenceAt ?? 0,
      Date.now(),
    ),
    lastEvidenceAt:
      Math.max(
        input.existing?.lastEvidenceAt ?? 0,
        latestEvidenceAt ?? 0,
        input.room?.lastSourceSyncAt ?? 0,
        input.room?.lastConclusionAt ?? 0,
      ) || null,
    status: nextLifecycleStatus,
    acceptanceStatus,
    acceptanceNote:
      acceptanceStatus === input.existing?.acceptanceStatus
        ? input.existing?.acceptanceNote ?? null
        : null,
  };

  const existing = input.existing;
  if (!existing) {
    return {
      ...nextRecordBase,
      primary: false,
      revision: 1,
    };
  }
  const changedFields = diffRequirementAggregateMaterialFields(existing, {
    ...existing,
    ...nextRecordBase,
    primary: existing.primary,
    revision: existing.revision,
  });
  const materialChanged = changedFields.length > 0;

  return {
    ...nextRecordBase,
    primary: existing.primary,
    updatedAt: materialChanged ? nextRecordBase.updatedAt : existing.updatedAt,
    revision: materialChanged ? existing.revision + 1 : existing.revision,
  };
}

export function pickPrimaryAggregateId(input: {
  aggregates: RequirementAggregateRecord[];
  currentPrimaryRequirementId: string | null;
  conversationStates: ConversationStateRecord[];
}): string | null {
  const activeAggregates = input.aggregates.filter((aggregate) => aggregate.status !== "archived");
  const byId = new Map(activeAggregates.map((aggregate) => [aggregate.id, aggregate] as const));
  const normalizedCurrentPrimaryRequirementId =
    normalizeStrategicWorkItemId(input.currentPrimaryRequirementId) ??
    input.currentPrimaryRequirementId;
  const conversationAnchored = [...input.conversationStates]
    .sort((left, right) => right.updatedAt - left.updatedAt)
    .map((state) => {
      if (state.currentWorkItemId) {
        return (
          activeAggregates.find((aggregate) => aggregate.workItemId === state.currentWorkItemId) ??
          activeAggregates.find((aggregate) => aggregate.id === state.currentWorkItemId) ??
          null
        );
      }
      if (state.currentWorkKey) {
        return (
          activeAggregates.find((aggregate) => aggregate.workItemId === state.currentWorkKey) ??
          activeAggregates.find((aggregate) => aggregate.id === state.currentWorkKey) ??
          activeAggregates.find(
            (aggregate) => aggregate.topicKey && `topic:${aggregate.topicKey}` === state.currentWorkKey,
          ) ??
          null
        );
      }
      if (state.draftRequirement?.topicKey) {
        return (
          activeAggregates.find((aggregate) => aggregate.topicKey === state.draftRequirement?.topicKey) ??
          activeAggregates.find((aggregate) => aggregate.id === state.conversationId) ??
          null
        );
      }
      if (state.draftRequirement) {
        return activeAggregates.find((aggregate) => aggregate.id === state.conversationId) ?? null;
      }
      return null;
    })
    .find((aggregate): aggregate is RequirementAggregateRecord => Boolean(aggregate));
  if (conversationAnchored) {
    return conversationAnchored.id;
  }

  const lockedPrimary = normalizedCurrentPrimaryRequirementId
    ? byId.get(normalizedCurrentPrimaryRequirementId) ?? null
    : null;
  if (lockedPrimary) {
    return lockedPrimary.id;
  }

  const existingPrimary =
    activeAggregates.find((aggregate) => aggregate.primary) ??
    null;
  if (existingPrimary) {
    return existingPrimary.id;
  }

  const strategicOpen =
    [...activeAggregates]
      .filter(
        (aggregate) =>
          aggregate.kind === "strategic" &&
          aggregate.status !== "completed" &&
          aggregate.status !== "archived",
      )
      .sort((left, right) => right.updatedAt - left.updatedAt)[0] ?? null;
  if (strategicOpen) {
    return strategicOpen.id;
  }

  const latestOpen =
    [...activeAggregates]
      .filter((aggregate) => aggregate.status !== "completed" && aggregate.status !== "archived")
      .sort((left, right) => right.updatedAt - left.updatedAt)[0] ?? null;
  if (latestOpen) {
    return latestOpen.id;
  }

  return activeAggregates.sort((left, right) => right.updatedAt - left.updatedAt)[0]?.id ?? null;
}

export function sanitizeRequirementAggregateRecords(
  records: RequirementAggregateRecord[],
  primaryRequirementId: string | null,
): RequirementAggregateRecord[] {
  const normalizedPrimaryRequirementId =
    normalizeStrategicWorkItemId(primaryRequirementId) ?? primaryRequirementId;
  const byId = new Map<string, RequirementAggregateRecord>();
  records.forEach((record) => {
    const normalizedRecord = normalizeRequirementAggregateRecord(record);
    const previous = byId.get(normalizedRecord.id);
    if (!previous || normalizedRecord.updatedAt >= previous.updatedAt) {
      byId.set(normalizedRecord.id, normalizedRecord);
    }
  });

  return [...byId.values()]
    .map((record) => ({
      ...record,
      primary: normalizedPrimaryRequirementId ? record.id === normalizedPrimaryRequirementId : false,
      memberIds: sortIds(uniqueIds(record.memberIds)),
      acceptanceStatus: record.acceptanceStatus ?? "not_requested",
      acceptanceNote:
        typeof record.acceptanceNote === "string" && record.acceptanceNote.trim().length > 0
          ? record.acceptanceNote.trim()
          : null,
    }))
    .sort((left, right) => {
      const primaryDelta = Number(right.primary) - Number(left.primary);
      if (primaryDelta !== 0) {
        return primaryDelta;
      }
      return right.updatedAt - left.updatedAt;
    });
}

export function reconcileRequirementAggregateState(input: {
  companyId: string;
  existingAggregates: RequirementAggregateRecord[];
  primaryRequirementId: string | null;
  activeConversationStates: ConversationStateRecord[];
  activeWorkItems: WorkItemRecord[];
  activeRoomRecords: RequirementRoomRecord[];
  activeRequirementEvidence: RequirementEvidenceEvent[];
}): {
  activeRequirementAggregates: RequirementAggregateRecord[];
  primaryRequirementId: string | null;
} {
  const normalizedExistingAggregates = sanitizeRequirementAggregateRecords(
    input.existingAggregates,
    input.primaryRequirementId,
  );
  const normalizedPrimaryRequirementId =
    normalizeStrategicWorkItemId(input.primaryRequirementId) ?? input.primaryRequirementId;
  const candidateWorkItems = input.activeWorkItems.filter(
    (item) =>
      isCanonicalProductWorkItemRecord(item) &&
      item.kind !== "artifact" &&
      !isArtifactRequirementTopic(item.topicKey),
  );
  const candidateIds = new Set<string>(candidateWorkItems.map((item) => item.id));
  input.activeRoomRecords.forEach((room) => {
    const roomWorkItemId = readString(room.workItemId);
    if (roomWorkItemId) {
      candidateIds.add(roomWorkItemId);
      return;
    }
    const topicKey = readString(room.topicKey);
    if (topicKey && !isArtifactRequirementTopic(topicKey)) {
      candidateIds.add(`topic:${topicKey}`);
    }
  });
  input.activeConversationStates.forEach((state) => {
    if (!hasStableDraftRequirement(state.draftRequirement)) {
      return;
    }
    const candidateId = buildAggregateIdFromConversationState(state);
    if (candidateId) {
      candidateIds.add(candidateId);
    }
  });
  normalizedExistingAggregates.forEach((aggregate) => {
    candidateIds.add(aggregate.id);
  });

  const nextAggregates: RequirementAggregateRecord[] = [];
  candidateIds.forEach((candidateId) => {
    const existing =
      normalizedExistingAggregates.find((aggregate) => aggregate.id === candidateId) ??
      normalizedExistingAggregates.find((aggregate) => aggregate.workItemId === candidateId) ??
      normalizedExistingAggregates.find((aggregate) => aggregate.sourceConversationId === candidateId) ??
      null;
    const workItem =
      candidateWorkItems.find((item) => item.id === candidateId) ??
      candidateWorkItems.find((item) => item.workKey === candidateId) ??
      candidateWorkItems.find((item) => item.sourceConversationId === candidateId) ??
      (existing ? findMatchingWorkItem(existing, candidateWorkItems) : null) ??
      null;
    const room =
      findMatchingRoom(workItem, input.activeRoomRecords) ??
      (existing ? findMatchingRoomForAggregate(existing, input.activeRoomRecords) : null) ??
      null;
    const draftConversationState =
      input.activeConversationStates.find(
        (state) => buildAggregateIdFromConversationState(state) === candidateId,
      ) ??
      findMatchingConversationState(existing, input.activeConversationStates, workItem) ??
      null;
    const record = materializeAggregateRecord({
      companyId: input.companyId,
      existing,
      workItem,
      room,
      evidence: input.activeRequirementEvidence,
      draftRequirement: draftConversationState?.draftRequirement ?? null,
      draftConversationId: draftConversationState?.conversationId ?? null,
      fallbackId: candidateId,
    });
    if (record) {
      nextAggregates.push(record);
    }
  });

  const resolvedPrimaryRequirementId = pickPrimaryAggregateId({
    aggregates: nextAggregates,
    currentPrimaryRequirementId: normalizedPrimaryRequirementId,
    conversationStates: input.activeConversationStates,
  });

  return {
    activeRequirementAggregates: sanitizeRequirementAggregateRecords(
      nextAggregates,
      resolvedPrimaryRequirementId,
    ),
    primaryRequirementId: resolvedPrimaryRequirementId,
  };
}

export function selectPrimaryRequirementAggregate(input: {
  activeRequirementAggregates: RequirementAggregateRecord[];
  primaryRequirementId: string | null;
}): RequirementAggregateRecord | null {
  return (
    input.activeRequirementAggregates.find((aggregate) => aggregate.id === input.primaryRequirementId) ??
    input.activeRequirementAggregates.find((aggregate) => aggregate.primary) ??
    null
  );
}
