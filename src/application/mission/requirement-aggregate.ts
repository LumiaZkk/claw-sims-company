import { pickCurrentParticipant, type ParticipantProgressTone } from "../../domain/mission/participant-progress";
import type { RequirementExecutionOverview, RequirementParticipantProgress } from "./requirement-overview";
import type { RequirementRoomRecord } from "../../domain/delegation/types";
import type {
  Company,
  RequirementAcceptanceStatus,
  ConversationStateRecord,
  RequirementAggregateRecord,
  RequirementEvidenceEvent,
  RequirementLifecycleState,
  WorkItemRecord,
} from "../../domain";
import { isArtifactRequirementTopic, isStrategicRequirementTopic } from "./requirement-kind";
import { isCanonicalProductWorkItemRecord } from "./work-item-signal";

function readString(value: unknown): string | null {
  return typeof value === "string" && value.trim().length > 0 ? value.trim() : null;
}

function readStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) {
    return [];
  }
  return [...new Set(value.map((entry) => readString(entry)).filter((entry): entry is string => Boolean(entry)))];
}

function uniqueIds(values: Array<string | null | undefined>): string[] {
  return [...new Set(values.map((value) => readString(value)).filter((value): value is string => Boolean(value)))];
}

function sortIds(values: string[]) {
  return [...values].sort((left, right) => left.localeCompare(right));
}

function inferRequirementKind(topicKey: string | null | undefined): RequirementAggregateRecord["kind"] {
  return isStrategicRequirementTopic(topicKey) ? "strategic" : "execution";
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

function mapLifecycleToParticipantStatus(
  status: RequirementLifecycleState,
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

function resolveEmployee(company: Company, actorId: string | null | undefined) {
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
}): string | null {
  if (readString(input.existingId)) {
    return readString(input.existingId);
  }
  if (readString(input.workItem?.id)) {
    return readString(input.workItem?.id);
  }
  if (readString(input.room?.workItemId)) {
    return readString(input.room?.workItemId);
  }
  const topicKey = readString(input.topicKey) ?? readString(input.room?.topicKey);
  if (topicKey) {
    return `topic:${topicKey}`;
  }
  return readString(input.room?.id);
}

function findMatchingRoom(
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

function findMatchingWorkItem(
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

function findMatchingRoomForAggregate(
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
  const latest = evidence
    .filter((event) => event.aggregateId === aggregateId)
    .reduce((max, event) => Math.max(max, event.timestamp), 0);
  return latest > 0 ? latest : null;
}

function buildAggregateMemberIds(
  existing: RequirementAggregateRecord | null,
  workItem: WorkItemRecord | null,
  room: RequirementRoomRecord | null,
): string[] {
  return sortIds(
    uniqueIds([
      ...(existing?.memberIds ?? []),
      ...(room?.memberIds ?? []),
      ...(room?.memberActorIds ?? []),
      workItem?.ownerActorId,
      workItem?.batonActorId,
      ...((workItem?.steps ?? []).map((step) => step.assigneeActorId ?? null)),
    ]),
  );
}

function materializeAggregateRecord(input: {
  companyId: string;
  existing: RequirementAggregateRecord | null;
  workItem: WorkItemRecord | null;
  room: RequirementRoomRecord | null;
  evidence: RequirementEvidenceEvent[];
}): RequirementAggregateRecord | null {
  const id = buildAggregateId({
    existingId: input.existing?.id,
    workItem: input.workItem,
    room: input.room,
    topicKey: input.workItem?.topicKey ?? input.existing?.topicKey ?? null,
  });
  if (!id) {
    return null;
  }

  const topicKey =
    readString(input.workItem?.topicKey) ??
    readString(input.room?.topicKey) ??
    readString(input.existing?.topicKey) ??
    null;
  if (topicKey && isArtifactRequirementTopic(topicKey)) {
    return null;
  }

  const latestEvidenceAt = findLatestEvidenceTimestamp(id, input.evidence);
  const nextLifecycleStatus =
    (input.workItem
      ? mapWorkItemStatusToRequirementLifecycleState(input.workItem.status)
      : mapRoomStatusToRequirementLifecycleState(input.room)) ??
    input.existing?.status ??
    "active";
  const acceptanceStatus = deriveRequirementAcceptanceStatus({
    existing: input.existing,
    nextLifecycleStatus,
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
    workItemId: readString(input.workItem?.id) ?? readString(input.room?.workItemId) ?? readString(input.existing?.workItemId) ?? null,
    roomId: readString(input.room?.id) ?? readString(input.workItem?.roomId) ?? readString(input.existing?.roomId) ?? null,
    ownerActorId:
      readString(input.workItem?.ownerActorId) ??
      readString(input.room?.ownerActorId) ??
      readString(input.room?.ownerAgentId) ??
      readString(input.existing?.ownerActorId) ??
      null,
    ownerLabel:
      readString(input.workItem?.ownerLabel) ??
      readString(input.room?.title) ??
      readString(input.existing?.ownerLabel) ??
      "当前负责人",
    stage:
      readString(input.workItem?.displayStage) ??
      readString(input.workItem?.stageLabel) ??
      readString(input.room?.progress) ??
      readString(input.existing?.stage) ??
      "进行中",
    summary:
      readString(input.workItem?.displaySummary) ??
      readString(input.workItem?.summary) ??
      readString(input.room?.headline) ??
      readString(input.existing?.summary) ??
      "当前主线正在推进。",
    nextAction:
      readString(input.workItem?.displayNextAction) ??
      readString(input.workItem?.nextAction) ??
      readString(input.room?.progress) ??
      readString(input.existing?.nextAction) ??
      "继续推进当前主线。",
    memberIds: buildAggregateMemberIds(input.existing, input.workItem, input.room),
    sourceConversationId:
      readString(input.workItem?.sourceConversationId) ??
      readString(input.workItem?.sourceSessionKey) ??
      readString(input.workItem?.sessionKey) ??
      readString(input.room?.sessionKey) ??
      readString(input.existing?.sourceConversationId) ??
      null,
    startedAt:
      input.workItem?.startedAt ??
      input.room?.createdAt ??
      input.existing?.startedAt ??
      Date.now(),
    updatedAt: Math.max(
      input.workItem?.updatedAt ?? 0,
      input.room?.updatedAt ?? 0,
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
  const materialChanged =
    !existing ||
    existing.topicKey !== nextRecordBase.topicKey ||
    existing.kind !== nextRecordBase.kind ||
    existing.workItemId !== nextRecordBase.workItemId ||
    existing.roomId !== nextRecordBase.roomId ||
    existing.ownerActorId !== nextRecordBase.ownerActorId ||
    existing.ownerLabel !== nextRecordBase.ownerLabel ||
    existing.stage !== nextRecordBase.stage ||
    existing.summary !== nextRecordBase.summary ||
    existing.nextAction !== nextRecordBase.nextAction ||
    existing.sourceConversationId !== nextRecordBase.sourceConversationId ||
    existing.status !== nextRecordBase.status ||
    existing.acceptanceStatus !== nextRecordBase.acceptanceStatus ||
    (existing.acceptanceNote ?? null) !== (nextRecordBase.acceptanceNote ?? null) ||
    existing.startedAt !== nextRecordBase.startedAt ||
    existing.memberIds.join("|") !== nextRecordBase.memberIds.join("|");

  return {
    ...nextRecordBase,
    primary: existing?.primary ?? false,
    revision: existing ? (materialChanged ? existing.revision + 1 : existing.revision) : 1,
  };
}

function pickPrimaryAggregateId(input: {
  aggregates: RequirementAggregateRecord[];
  currentPrimaryRequirementId: string | null;
  conversationStates: ConversationStateRecord[];
}): string | null {
  const activeAggregates = input.aggregates.filter((aggregate) => aggregate.status !== "archived");
  const byId = new Map(activeAggregates.map((aggregate) => [aggregate.id, aggregate] as const));
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
      return null;
    })
    .find((aggregate): aggregate is RequirementAggregateRecord => Boolean(aggregate));
  if (conversationAnchored) {
    return conversationAnchored.id;
  }

  const lockedPrimary = input.currentPrimaryRequirementId
    ? byId.get(input.currentPrimaryRequirementId) ?? null
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
  const byId = new Map<string, RequirementAggregateRecord>();
  records.forEach((record) => {
    const previous = byId.get(record.id);
    if (!previous || record.updatedAt >= previous.updatedAt) {
      byId.set(record.id, record);
    }
  });

  return [...byId.values()]
    .map((record) => ({
      ...record,
      primary: primaryRequirementId ? record.id === primaryRequirementId : false,
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
  input.existingAggregates.forEach((aggregate) => {
    candidateIds.add(aggregate.id);
  });

  const nextAggregates: RequirementAggregateRecord[] = [];
  candidateIds.forEach((candidateId) => {
    const existing =
      input.existingAggregates.find((aggregate) => aggregate.id === candidateId) ??
      input.existingAggregates.find((aggregate) => aggregate.workItemId === candidateId) ??
      null;
    const workItem =
      candidateWorkItems.find((item) => item.id === candidateId) ??
      candidateWorkItems.find((item) => item.workKey === candidateId) ??
      (existing ? findMatchingWorkItem(existing, candidateWorkItems) : null) ??
      null;
    const room =
      findMatchingRoom(workItem, input.activeRoomRecords) ??
      (existing ? findMatchingRoomForAggregate(existing, input.activeRoomRecords) : null) ??
      null;
    const record = materializeAggregateRecord({
      companyId: input.companyId,
      existing,
      workItem,
      room,
      evidence: input.activeRequirementEvidence,
    });
    if (record) {
      nextAggregates.push(record);
    }
  });

  const resolvedPrimaryRequirementId = pickPrimaryAggregateId({
    aggregates: nextAggregates,
    currentPrimaryRequirementId: input.primaryRequirementId,
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
  if (
    input.rawOverview &&
    (!input.aggregate.topicKey || input.rawOverview.topicKey === input.aggregate.topicKey)
  ) {
    return input.rawOverview;
  }
  const participants = buildFallbackParticipants({
    company: input.company,
    aggregate: input.aggregate,
    workItem: input.workItem,
    room: input.room,
  });
  const currentParticipant = pickCurrentParticipant(participants);
  return {
    topicKey: input.aggregate.topicKey ?? input.workItem?.topicKey ?? `aggregate:${input.aggregate.id}`,
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

  const topicKey = readString(input.event.payload.topicKey);
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
  activeRequirementAggregates: RequirementAggregateRecord[];
  activeRoomRecords: RequirementRoomRecord[];
  primaryRequirementId: string | null;
  event: RequirementEvidenceEvent;
}): {
  activeRequirementAggregates: RequirementAggregateRecord[];
  applied: boolean;
  aggregateId: string | null;
} {
  const targetAggregateId = resolveRequirementAggregateIdForEvidence({
    activeRequirementAggregates: input.activeRequirementAggregates,
    activeRoomRecords: input.activeRoomRecords,
    primaryRequirementId: input.primaryRequirementId,
    event: input.event,
  });
  if (!targetAggregateId) {
    return {
      activeRequirementAggregates: input.activeRequirementAggregates,
      applied: false,
      aggregateId: null,
    };
  }

  const nextAggregates = input.activeRequirementAggregates.map((aggregate) => {
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
    const nextRecord: RequirementAggregateRecord = {
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
      updatedAt: Math.max(aggregate.updatedAt, input.event.timestamp),
      lastEvidenceAt: Math.max(aggregate.lastEvidenceAt ?? 0, input.event.timestamp),
      status: lifecycleStatus ?? aggregate.status,
      revision: aggregate.revision + 1,
    };
    return nextRecord;
  });

  return {
    activeRequirementAggregates: sanitizeRequirementAggregateRecords(
      nextAggregates,
      input.primaryRequirementId,
    ),
    applied: true,
    aggregateId: targetAggregateId,
  };
}
