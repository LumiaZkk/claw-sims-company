import { buildRequirementRoomRoute } from "../delegation/room-routing";
import { buildCurrentRequirementState } from "./current-requirement-state";
import { buildRoomRecordIdFromWorkItem } from "./work-item";
import {
  isParticipantCompletedStatus,
  isStrategicRequirementTopic,
} from "./requirement-kind";
import { buildExecutionFocusSummary } from "../governance/focus-summary";
import type {
  RequirementExecutionOverview,
  RequirementParticipantProgress,
} from "./requirement-overview";
import type { RequirementSessionSnapshot } from "../../domain/mission/requirement-snapshot";
import type { RequirementScope } from "./requirement-scope";
import type { Company } from "../../domain/org/types";
import type { ConversationStateRecord, TrackedTask, WorkItemRecord } from "../../domain/mission/types";
import type { RequirementRoomRecord } from "../../domain/delegation/types";
import type { TaskExecutionState, TaskStep } from "../../domain/mission/types";
import type { GatewaySessionRow } from "../gateway";

export { getTaskLane, getTaskSortWeight, type TaskLane } from "../../domain/mission/task-lane";
export {
  summarizeTaskSteps,
  type TaskStepSummary,
} from "../../domain/mission/task-step-summary";

function truncateRoomPreview(text: string, maxLength = 88): string {
  const compact = text.replace(/\s+/g, " ").trim();
  if (compact.length <= maxLength) {
    return compact;
  }
  return `${compact.slice(0, maxLength - 1).trimEnd()}…`;
}

export function describeRequirementRoomPreview(
  room: {
    transcript: Array<{ role: "user" | "assistant"; text?: string; senderLabel?: string; audienceAgentIds?: string[] }>;
    progress?: string;
    lastConclusionAt?: number | null;
  },
  workItem?: WorkItemRecord | null,
) {
  const latest = [...room.transcript]
    .reverse()
    .find((message) => typeof message.text === "string" && message.text.trim().length > 0);
  if (!latest?.text) {
    if (room.lastConclusionAt) {
      return workItem?.displaySummary || workItem?.summary || "这间房间已有历史回传，继续在这里推进即可。";
    }
    if (room.progress && room.progress !== "0 条可见消息") {
      return workItem?.displayNextAction || workItem?.displaySummary || room.progress;
    }
    if (workItem) {
      return (
        workItem.displaySummary ||
        workItem.displayNextAction ||
        workItem.summary ||
        "这间房间已经绑定到当前主线任务，可以继续在这里推进。"
      );
    }
    return "房间已建立，等待第一条团队指令。";
  }
  if (latest.role === "assistant") {
    const actor = latest.senderLabel?.trim() || "团队成员";
    return `${actor}：${truncateRoomPreview(latest.text)}`;
  }
  const audienceCount = latest.audienceAgentIds?.length ?? 0;
  const targetLabel = audienceCount > 0 ? `${audienceCount} 位成员` : "团队成员";
  return `最近派发给 ${targetLabel}：${truncateRoomPreview(latest.text)}`;
}

function mapParticipantStatusToStepStatus(statusLabel: string): TaskStep["status"] {
  if (["已确认", "已冻结待命", "已回复", "已交接"].includes(statusLabel)) {
    return "done";
  }
  if (
    [
      "已开工",
      "已开工未交付",
      "已阻塞",
      "交接阻塞",
      "待回复",
      "未回复",
      "已接单",
      "已接单未推进",
      "已交付待下游",
      "部分完成",
      "待接手",
      "已就绪待稿",
    ].includes(statusLabel)
  ) {
    return "wip";
  }
  return "pending";
}

function mapRequirementState(participant: RequirementParticipantProgress | null): TaskExecutionState {
  if (!participant) {
    return "unknown";
  }
  if (participant.isBlocking) {
    return "blocked_timeout";
  }
  if (["待回复", "未回复"].includes(participant.statusLabel)) {
    return "waiting_peer";
  }
  if (["已交付待下游", "待接手", "已就绪待稿"].includes(participant.statusLabel)) {
    return "waiting_peer";
  }
  if (["已确认", "已冻结待命", "已回复", "已交接"].includes(participant.statusLabel)) {
    return "completed";
  }
  if (["已开工", "已开工未交付", "已接单", "已接单未推进", "部分完成"].includes(participant.statusLabel)) {
    return "running";
  }
  return "idle";
}

export function buildRequirementSyntheticTask(input: {
  requirementOverview: RequirementExecutionOverview;
  currentOwnerSessionKey?: string;
  titleOverride?: string | null;
  now: number;
}): TrackedTask {
  const { requirementOverview, currentOwnerSessionKey, now, titleOverride } = input;
  const currentParticipant =
    requirementOverview.participants.find((participant) => participant.isCurrent) ?? null;
  const isStrategic = isStrategicRequirementTopic(requirementOverview.topicKey);
  const allParticipantsCompleted =
    requirementOverview.participants.length > 0 &&
    requirementOverview.participants.every((participant) =>
      isParticipantCompletedStatus(participant.statusLabel),
    );

  return {
    id: `requirement:${requirementOverview.topicKey}`,
    title: titleOverride?.trim() || requirementOverview.title,
    sessionKey: currentOwnerSessionKey ?? `requirement:${requirementOverview.topicKey}`,
    agentId:
      requirementOverview.currentOwnerAgentId ??
      requirementOverview.participants[0]?.agentId ??
      "unknown",
    ownerAgentId: requirementOverview.currentOwnerAgentId ?? undefined,
    assigneeAgentIds: requirementOverview.participants.map((participant) => participant.agentId),
    steps: requirementOverview.participants.map((participant) => ({
      text: `${participant.nickname} · ${participant.stage}`,
      status: mapParticipantStatusToStepStatus(participant.statusLabel),
      assignee: `@${participant.nickname}`,
    })),
    state: isStrategic
      ? allParticipantsCompleted
        ? "completed"
        : "running"
      : mapRequirementState(currentParticipant),
    summary: requirementOverview.summary,
    blockedReason:
      !isStrategic && currentParticipant?.isBlocking ? currentParticipant.detail : undefined,
    createdAt: requirementOverview.participants[0]?.updatedAt ?? now,
    updatedAt:
      requirementOverview.participants.reduce(
        (latest, participant) => Math.max(latest, participant.updatedAt),
        0,
      ) || now,
  };
}

export function buildStrategicBoardFocusSummary(
  requirementOverview: RequirementExecutionOverview,
): ReturnType<typeof buildExecutionFocusSummary> {
  return {
    headline: requirementOverview.headline,
    ownerLabel: requirementOverview.currentOwnerLabel || "当前负责人",
    ownerRole: "战略主线",
    currentWork: `${requirementOverview.currentOwnerLabel || "当前负责人"} 正在处理：${requirementOverview.currentStage}`,
    blockReason: undefined,
    nextStep: requirementOverview.nextAction,
    detailHint: requirementOverview.summary,
  };
}

export function buildStrategicWorkItemFocusSummary(
  workItem: WorkItemRecord,
): ReturnType<typeof buildExecutionFocusSummary> {
  return {
    headline: `${workItem.ownerLabel || "当前负责人"} 正在推进战略主线`,
    ownerLabel: workItem.ownerLabel || "当前负责人",
    ownerRole: "战略主线",
    currentWork: `${workItem.ownerLabel || "当前负责人"} 正在处理：${workItem.stageLabel}`,
    blockReason: workItem.status === "blocked" ? workItem.nextAction : undefined,
    nextStep: workItem.nextAction,
    detailHint: workItem.summary,
  };
}

function mapWorkStepStatusToTaskStepStatus(status: WorkItemRecord["steps"][number]["status"]): TaskStep["status"] {
  if (status === "done" || status === "skipped") {
    return "done";
  }
  if (status === "active") {
    return "wip";
  }
  return "pending";
}

function mapWorkItemStatusToExecutionState(status: WorkItemRecord["status"]): TaskExecutionState {
  if (status === "completed" || status === "archived") {
    return "completed";
  }
  if (status === "blocked") {
    return "blocked_timeout";
  }
  if (status === "waiting_owner") {
    return "running";
  }
  if (status === "waiting_review") {
    return "waiting_input";
  }
  return "running";
}

export function buildWorkItemSyntheticTask(input: { workItem: WorkItemRecord }): TrackedTask {
  const { workItem } = input;
  const assigneeAgentIds = [
    ...new Set(
      [
        workItem.ownerActorId,
        workItem.batonActorId,
        ...workItem.steps.map((step) => step.assigneeActorId),
      ].filter(Boolean),
    ),
  ] as string[];

  return {
    id: `workitem:${workItem.id}`,
    title: workItem.title,
    sessionKey: workItem.sessionKey ?? workItem.roomId ?? `workitem:${workItem.id}`,
    agentId: workItem.ownerActorId ?? workItem.batonActorId ?? "unknown",
    ownerAgentId: workItem.ownerActorId ?? undefined,
    assigneeAgentIds,
    steps: workItem.steps.map((step) => ({
      text: step.title,
      status: mapWorkStepStatusToTaskStepStatus(step.status),
      assignee: step.assigneeLabel ? `@${step.assigneeLabel}` : undefined,
    })),
    state: mapWorkItemStatusToExecutionState(workItem.status),
    summary: workItem.summary,
    blockedReason: workItem.status === "blocked" ? workItem.nextAction : undefined,
    createdAt: workItem.startedAt,
    updatedAt: workItem.updatedAt,
  };
}

type BuildBoardRequirementSurfaceInput = {
  company: Company;
  activeConversationStates: ConversationStateRecord[];
  activeWorkItems: WorkItemRecord[];
  companySessions: Array<GatewaySessionRow & { agentId: string }>;
  companySessionSnapshots: RequirementSessionSnapshot[];
  activeRoomRecords: RequirementRoomRecord[];
  currentTime: number;
  ceoAgentId: string | null;
};

export type BoardRequirementSurface = {
  currentRequirementSessionKey: string | null;
  activeWorkItem: WorkItemRecord | null;
  currentWorkItem: WorkItemRecord | null;
  requirementOverview: RequirementExecutionOverview | null;
  requirementScope: RequirementScope | null;
  primaryRequirementTopicKey: string | null;
  strategicRequirementOverview: RequirementExecutionOverview | null;
  isStrategicRequirement: boolean;
  latestRequirementRoom: RequirementRoomRecord | null;
  requirementDisplayTitle: string;
  requirementDisplayCurrentStep: string;
  requirementDisplaySummary: string;
  requirementDisplayOwner: string;
  requirementDisplayStage: string;
  requirementDisplayNext: string;
  requirementSyntheticTask: TrackedTask | null;
  currentRequirementTopicKey: string | null;
  currentRequirementWorkItemId: string | null;
  currentRequirementRoomTitle: string;
  requirementRoomRecords: RequirementRoomRecord[];
  requirementRoomMemberIds: string[];
  requirementRoomRoute: ReturnType<typeof buildRequirementRoomRoute> | null;
};

export function buildBoardRequirementSurface(
  input: BuildBoardRequirementSurfaceInput,
): BoardRequirementSurface {
  const ceo = input.company.employees.find((employee) => employee.metaRole === "ceo") ?? null;
  const requirementState = buildCurrentRequirementState({
    company: input.company,
    activeConversationStates: input.activeConversationStates,
    activeWorkItems: input.activeWorkItems,
    companySessions: input.companySessions,
    companySessionSnapshots: input.companySessionSnapshots,
    currentTime: input.currentTime,
    ceoAgentId: input.ceoAgentId ?? ceo?.agentId ?? null,
  });
  const {
    currentRequirementSessionKey,
    currentWorkItem,
    requirementOverview,
    primaryRequirementTopicKey,
    strategicRequirementOverview,
  } = requirementState;

  const isStrategicRequirement = Boolean(
    primaryRequirementTopicKey && isStrategicRequirementTopic(primaryRequirementTopicKey),
  );
  const latestRequirementRoom =
    currentWorkItem
      ? [...input.activeRoomRecords]
          .filter(
            (room) =>
              room.workItemId === currentWorkItem.id &&
              (Boolean(room.topicKey) || room.title.trim().length > 0),
          )
          .sort((left, right) => right.updatedAt - left.updatedAt)[0] ?? null
      : null;
  const requirementDisplayTitle =
    currentWorkItem
      ? currentWorkItem.title || currentWorkItem.headline || "当前需求"
      : "当前需求";
  const requirementDisplayCurrentStep =
    currentWorkItem
      ? currentWorkItem.displayStage || currentWorkItem.stageLabel || "待确认"
      : "待确认";
  const requirementDisplaySummary =
    currentWorkItem
      ? currentWorkItem.displaySummary || currentWorkItem.summary || "待确认"
      : "待确认";
  const requirementDisplayOwner =
    currentWorkItem
      ? currentWorkItem.displayOwnerLabel || currentWorkItem.ownerLabel || "待确认"
      : "待确认";
  const requirementDisplayStage =
    currentWorkItem
      ? currentWorkItem.displayStage || currentWorkItem.stageLabel || "待确认"
      : "待确认";
  const requirementDisplayNext =
    currentWorkItem
      ? currentWorkItem.displayNextAction || currentWorkItem.nextAction || "待确认"
      : "待确认";
  const requirementSyntheticTask =
    currentWorkItem
      ? buildWorkItemSyntheticTask({ workItem: currentWorkItem })
      : (strategicRequirementOverview ?? requirementOverview)
        ? buildRequirementSyntheticTask({
            requirementOverview: strategicRequirementOverview ?? requirementOverview!,
            currentOwnerSessionKey: currentRequirementSessionKey ?? undefined,
            titleOverride: requirementDisplayTitle,
            now: input.currentTime,
          })
        : null;
  const currentRequirementTopicKey =
    strategicRequirementOverview?.topicKey ??
    currentWorkItem?.topicKey ??
    requirementOverview?.topicKey ??
    null;
  const currentRequirementWorkItemId = currentWorkItem?.id ?? null;
  const currentRequirementRoomTitle =
    strategicRequirementOverview?.title ??
    currentWorkItem?.title ??
    requirementOverview?.title ??
    requirementDisplayTitle;
  const dedupeRooms = (rooms: RequirementRoomRecord[]) =>
    [...new Map(rooms.map((room) => [room.id, room] as const)).values()].sort(
      (left, right) => right.updatedAt - left.updatedAt,
    );

  const currentRoomId =
    currentWorkItem?.roomId ??
    (currentRequirementWorkItemId ? buildRoomRecordIdFromWorkItem(currentRequirementWorkItemId) : null);
  let requirementRoomRecords: RequirementRoomRecord[] = [];
  if (currentRoomId) {
    const exactRoom = input.activeRoomRecords.find((room) => room.id === currentRoomId) ?? null;
    if (exactRoom) {
      requirementRoomRecords = [exactRoom];
    }
  }
  if (requirementRoomRecords.length === 0 && currentRequirementWorkItemId) {
    const exactMatches = dedupeRooms(
      input.activeRoomRecords.filter((room) => room.workItemId === currentRequirementWorkItemId),
    );
    if (exactMatches.length > 0) {
      requirementRoomRecords = exactMatches.slice(0, 1);
    }
  }
  if (requirementRoomRecords.length === 0 && currentWorkItem?.workKey) {
    const exactWorkKeyMatches = dedupeRooms(
      input.activeRoomRecords.filter((room) => room.workItemId === currentWorkItem.workKey),
    );
    if (exactWorkKeyMatches.length > 0) {
      requirementRoomRecords = exactWorkKeyMatches.slice(0, 1);
    }
  }
  if (
    requirementRoomRecords.length === 0 &&
    !currentWorkItem &&
    (currentRequirementTopicKey || currentRequirementRoomTitle)
  ) {
    if (currentRequirementTopicKey) {
      const normalizedTopicKey = currentRequirementTopicKey.trim().toLowerCase();
      const exactMatches = dedupeRooms(
        input.activeRoomRecords.filter(
          (room) => room.topicKey?.trim().toLowerCase() === normalizedTopicKey,
        ),
      );
      if (exactMatches.length > 0) {
        requirementRoomRecords = exactMatches.slice(0, 1);
      }
    }
    if (requirementRoomRecords.length === 0) {
      const normalizedTitle = currentRequirementRoomTitle.trim().toLowerCase();
      requirementRoomRecords = dedupeRooms(
        input.activeRoomRecords.filter((room) => room.title.trim().toLowerCase() === normalizedTitle),
      ).slice(0, 1);
    }
  }

  const requirementRoomMemberIds = (() => {
    const overview = strategicRequirementOverview ?? requirementOverview;
    if (overview) {
      return [...new Set(overview.participants.map((participant) => participant.agentId).filter(Boolean))];
    }
    if (currentWorkItem) {
      return [
        ...new Set(
          [
            currentWorkItem.ownerActorId,
            currentWorkItem.batonActorId,
            ...currentWorkItem.steps.map((step) => step.assigneeActorId),
          ].filter(Boolean),
        ),
      ] as string[];
    }
    if (latestRequirementRoom) {
      return [...new Set(latestRequirementRoom.memberIds.filter(Boolean))];
    }
    return [];
  })();
  const requirementRoomRoute =
    (!currentRequirementTopicKey && !currentRequirementRoomTitle) || requirementRoomMemberIds.length < 2
      ? null
      : buildRequirementRoomRoute({
          company: input.company,
          memberIds: requirementRoomMemberIds,
          topic: currentRequirementRoomTitle,
          topicKey: currentRequirementTopicKey,
          workItemId: currentRequirementWorkItemId,
          preferredInitiatorAgentId:
            ceo?.agentId ??
            requirementOverview?.currentOwnerAgentId ??
            currentWorkItem?.ownerActorId ??
            null,
          existingRooms: input.activeRoomRecords,
        });

  return {
    ...requirementState,
    isStrategicRequirement,
    latestRequirementRoom,
    requirementDisplayTitle,
    requirementDisplayCurrentStep,
    requirementDisplaySummary,
    requirementDisplayOwner,
    requirementDisplayStage,
    requirementDisplayNext,
    requirementSyntheticTask,
    currentRequirementTopicKey,
    currentRequirementWorkItemId,
    currentRequirementRoomTitle,
    requirementRoomRecords,
    requirementRoomMemberIds,
    requirementRoomRoute,
  };
}
