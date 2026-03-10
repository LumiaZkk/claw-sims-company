import type { ChatMessage } from "../gateway";
import { summarizeProgressText } from "../governance/chat-progress";
import { formatAgentLabel } from "../governance/focus-summary";
import {
  convertRequirementRoomRecordToChatMessages,
  isVisibleRequirementRoomMessage,
} from "./room-routing";
import { buildCompanyChatRoute } from "../../lib/chat-routes";
import type { RequirementRoomRecord } from "../../domain/delegation/types";
import type { WorkItemRecord } from "../../domain/mission/types";
import type { Company } from "../../domain/org/types";

export type ChatSurfaceActionButton = {
  id: string;
  label: string;
  description: string;
  kind: "message" | "navigate" | "recover" | "copy";
  tone: "primary" | "secondary" | "ghost";
  targetAgentId?: string;
  followupTargetAgentId?: string;
  followupTargetLabel?: string;
  preferResolvedSession?: boolean;
  href?: string;
  message?: string;
};

export type RequirementRoomSummaryView = {
  headline: string;
  statusLabel: string;
  tone: "slate" | "amber";
  ownerAgentId: string | null;
  ownerLabel: string;
  stage: string;
  summary: string;
  actionHint: string;
  topSummaryItems: Array<{ id: string; label: string; value: string }>;
  primaryAction: ChatSurfaceActionButton | null;
  openAction: ChatSurfaceActionButton | null;
};

type BuildRequirementRoomSummaryInput = {
  activeCompany: Company | null;
  effectiveRequirementRoom: RequirementRoomRecord | null;
  roomBoundWorkItem: WorkItemRecord | null;
  persistedWorkItem: WorkItemRecord | null;
  groupTitle: string;
  messages: ChatMessage[];
  requirementRoomTargetAgentIds: string[];
  requirementRoomSessionCount: number;
  targetAgentId: string | null;
};

function truncateText(text: string, maxLength: number): string {
  const compact = text.replace(/\s+/g, " ").trim();
  if (compact.length <= maxLength) {
    return compact;
  }
  return `${compact.slice(0, maxLength - 1).trimEnd()}…`;
}

export function buildRequirementRoomSummary(
  input: BuildRequirementRoomSummaryInput,
): RequirementRoomSummaryView | null {
  const {
    activeCompany,
    effectiveRequirementRoom,
    roomBoundWorkItem,
    persistedWorkItem,
    groupTitle,
    messages,
    requirementRoomTargetAgentIds,
    requirementRoomSessionCount,
    targetAgentId,
  } = input;

  if (!effectiveRequirementRoom) {
    return null;
  }

  const persistedVisibleTranscript =
    effectiveRequirementRoom.transcript.filter((message) =>
      isVisibleRequirementRoomMessage(message),
    ) ?? [];
  const hasPersistedRoomHistory = persistedVisibleTranscript.length > 0;
  const latestPersistedVisibleMessage =
    persistedVisibleTranscript[persistedVisibleTranscript.length - 1] ?? null;
  const convertedRoomMessages = convertRequirementRoomRecordToChatMessages(effectiveRequirementRoom);
  const roomMessages = convertedRoomMessages.length > 0 ? convertedRoomMessages : messages;
  const visibleRoomMessages = roomMessages.filter(
    (message) => message.role === "user" || message.role === "assistant",
  );
  const latestDispatch =
    [...visibleRoomMessages].reverse().find(
      (message) =>
        message.role === "user" &&
        Array.isArray(message.roomAudienceAgentIds) &&
        message.roomAudienceAgentIds.length > 0,
    ) ?? null;
  const latestDispatchAt = typeof latestDispatch?.timestamp === "number" ? latestDispatch.timestamp : 0;
  const dispatchTargets =
    latestDispatch && Array.isArray(latestDispatch.roomAudienceAgentIds)
      ? latestDispatch.roomAudienceAgentIds
      : requirementRoomTargetAgentIds;
  const dispatchTargetLabels = dispatchTargets
    .map(
      (agentId) =>
        activeCompany?.employees.find((employee) => employee.agentId === agentId)?.nickname ?? agentId,
    )
    .filter(Boolean);
  const repliesAfterDispatch = visibleRoomMessages.filter((message) => {
    if (message.role !== "assistant") {
      return false;
    }
    const timestamp = typeof message.timestamp === "number" ? message.timestamp : 0;
    return latestDispatchAt > 0 ? timestamp >= latestDispatchAt : true;
  });
  const respondedAgentIds = [
    ...new Set(
      repliesAfterDispatch
        .map((message) =>
          typeof message.roomAgentId === "string" && message.roomAgentId.length > 0
            ? message.roomAgentId
            : null,
        )
        .filter((agentId): agentId is string => Boolean(agentId)),
    ),
  ];
  const pendingAgentIds = dispatchTargets.filter((agentId) => !respondedAgentIds.includes(agentId));
  const pendingLabels = pendingAgentIds
    .map(
      (agentId) =>
        activeCompany?.employees.find((employee) => employee.agentId === agentId)?.nickname ?? agentId,
    )
    .filter(Boolean);
  const latestReply = repliesAfterDispatch[repliesAfterDispatch.length - 1] ?? null;
  const latestReplyText =
    latestReply && typeof latestReply.text === "string" ? latestReply.text : null;
  const latestReplySummary = latestReplyText ? summarizeProgressText(latestReplyText) : null;
  const latestReplyAgentId =
    latestReply && typeof latestReply.roomAgentId === "string" ? latestReply.roomAgentId : null;
  const latestReplyLabel =
    latestReplyAgentId && activeCompany
      ? formatAgentLabel(activeCompany, latestReplyAgentId)
      : "团队成员";
  const respondedLabels = respondedAgentIds
    .map(
      (agentId) =>
        activeCompany?.employees.find((employee) => employee.agentId === agentId)?.nickname ?? agentId,
    )
    .filter(Boolean);
  const roomOwnerAgentId =
    effectiveRequirementRoom.ownerActorId ??
    effectiveRequirementRoom.ownerAgentId ??
    activeCompany?.employees.find((employee) => employee.metaRole === "ceo")?.agentId ??
    targetAgentId ??
    null;
  const roomOwnerLabel =
    roomOwnerAgentId && activeCompany ? formatAgentLabel(activeCompany, roomOwnerAgentId) : "负责人";
  const roomOwnerOpenAction =
    roomOwnerAgentId
      ? {
          id: `open-room-owner:${roomOwnerAgentId}`,
          label: `打开 ${roomOwnerLabel} 会话`,
          description: `直接进入 ${roomOwnerLabel} 的 1v1 会话继续收口当前团队结果。`,
          kind: "navigate" as const,
          tone: "secondary" as const,
          targetAgentId: roomOwnerAgentId,
          href: buildCompanyChatRoute(roomOwnerAgentId, activeCompany?.id),
        }
      : null;

  if (!latestDispatch) {
    const restoredSummary =
      latestPersistedVisibleMessage && typeof latestPersistedVisibleMessage.text === "string"
        ? summarizeProgressText(latestPersistedVisibleMessage.text)?.summary ??
          truncateText(latestPersistedVisibleMessage.text, 160)
        : null;
    const effectiveRoomWorkItem = roomBoundWorkItem ?? persistedWorkItem;
    const stableRoomStage =
      effectiveRoomWorkItem?.displayStage ||
      effectiveRoomWorkItem?.stageLabel ||
      effectiveRequirementRoom.progress ||
      "需求团队房间";
    const stableRoomSummary =
      restoredSummary ||
      effectiveRoomWorkItem?.displaySummary ||
      effectiveRoomWorkItem?.summary ||
      "这间需求团队房间已经绑定到当前主线任务，可以继续在这里 @成员推进，或让负责人先收口当前结论。";
    const stableRoomActionHint =
      effectiveRoomWorkItem?.displayNextAction ||
      "这不是新房间。你可以继续在这里 @成员推进，或先让负责人根据当前进度继续收口。";
    if (hasPersistedRoomHistory) {
      return {
        headline:
          effectiveRequirementRoom.headline ??
          effectiveRoomWorkItem?.title ??
          `需求团队: ${groupTitle}`,
        statusLabel: effectiveRequirementRoom.lastConclusionAt ? "已恢复历史" : "已恢复房间历史",
        tone: effectiveRequirementRoom.lastConclusionAt ? "amber" : "slate",
        ownerAgentId: roomOwnerAgentId,
        ownerLabel: roomOwnerLabel,
        stage: stableRoomStage,
        summary: stableRoomSummary,
        actionHint: stableRoomActionHint,
        topSummaryItems: [
          { id: "history", label: "已恢复", value: `${persistedVisibleTranscript.length} 条消息` },
          { id: "owner", label: "负责人", value: roomOwnerLabel },
        ],
        primaryAction: null,
        openAction: roomOwnerOpenAction,
      };
    }
    if (effectiveRoomWorkItem) {
      return {
        headline: effectiveRoomWorkItem.title,
        statusLabel: effectiveRequirementRoom.lastConclusionAt ? "进行中" : "主线已绑定",
        tone: effectiveRequirementRoom.lastConclusionAt ? "amber" : "slate",
        ownerAgentId: roomOwnerAgentId,
        ownerLabel: roomOwnerLabel,
        stage: stableRoomStage,
        summary: stableRoomSummary,
        actionHint: stableRoomActionHint,
        topSummaryItems: [
          { id: "owner", label: "负责人", value: roomOwnerLabel },
          { id: "progress", label: "当前进度", value: stableRoomStage },
        ],
        primaryAction: null,
        openAction: roomOwnerOpenAction,
      };
    }
    return {
      headline: (persistedWorkItem ?? roomBoundWorkItem)?.title || "需求团队房间",
      statusLabel: "主线已绑定",
      tone: "slate",
      ownerAgentId: roomOwnerAgentId,
      ownerLabel: roomOwnerLabel,
      stage: stableRoomStage,
      summary:
        (persistedWorkItem ?? roomBoundWorkItem)?.displaySummary ||
        (persistedWorkItem ?? roomBoundWorkItem)?.summary ||
        "这间需求团队房间已经绑定到当前主线任务，继续在这里 @成员推进即可。",
      actionHint:
        (persistedWorkItem ?? roomBoundWorkItem)?.displayNextAction ||
        "这不是新房间。继续 @成员推进，或让负责人先收口当前结论。",
      topSummaryItems: [
        { id: "members", label: "房间成员", value: `${requirementRoomSessionCount} 人` },
        { id: "owner", label: "负责人", value: roomOwnerLabel },
      ],
      primaryAction: null,
      openAction: roomOwnerOpenAction,
    };
  }

  if (pendingLabels.length > 0) {
    const primaryPendingAgentId = pendingAgentIds[0] ?? null;
    return {
      headline: `等待 ${pendingLabels.join("、")} 回复`,
      statusLabel: "等待回执",
      tone: "amber",
      ownerAgentId: primaryPendingAgentId,
      ownerLabel: pendingLabels[0] ?? "待回复成员",
      stage: "房间派发已发出",
      summary: `最近一条房间指令已经发给 ${dispatchTargetLabels.join("、")}，当前还在等待 ${pendingLabels.join("、")} 回应。`,
      actionHint: "现在先等房间成员回执；如果长时间没回，再继续 @ 对应成员催办。",
      topSummaryItems: [
        { id: "dispatch", label: "最近派发", value: dispatchTargetLabels.join("、") },
        { id: "waiting", label: "当前等待", value: pendingLabels.join("、") },
      ],
      openAction:
        primaryPendingAgentId && primaryPendingAgentId !== targetAgentId
          ? {
              id: `open-room-pending:${primaryPendingAgentId}`,
              label: `打开 ${(activeCompany && formatAgentLabel(activeCompany, primaryPendingAgentId)) || pendingLabels[0]} 会话`,
              description: "直接进入当前等待成员的 1v1 会话确认有没有卡住。",
              kind: "navigate",
              tone: "secondary",
              targetAgentId: primaryPendingAgentId,
              href: buildCompanyChatRoute(primaryPendingAgentId, activeCompany?.id),
            }
          : null,
      primaryAction: null,
    };
  }

  const closureSummary =
    latestReplySummary?.summary ??
    (latestReplyText ? truncateText(latestReplyText, 160) : "团队成员已经给出新的结论反馈。");
  const closurePrimaryAction =
    roomOwnerAgentId
      ? {
          id: `sync-room-owner:${roomOwnerAgentId}:${latestDispatchAt}`,
          label: `同步给 ${roomOwnerLabel}`,
          description: `把本轮团队回执直接同步给 ${roomOwnerLabel}，由负责人判断下一棒。`,
          kind: "message" as const,
          tone: "primary" as const,
          targetAgentId: roomOwnerAgentId,
          preferResolvedSession: true,
          message: `需求团队房间《${groupTitle}》本轮已经收到回执。最近派发：${dispatchTargetLabels.join("、")}。已回复：${respondedLabels.join("、")}。最新反馈来自 ${latestReplyLabel}：${closureSummary}。请你现在先不要直接跳到执行下一阶段，而是先给我阶段反馈和下一阶段计划，并严格按这个格式回复：\n【本阶段结论】已完成 / 未完成\n【阶段总结】一句话总结本阶段结果、当前判断和你建议的方向\n【风险与问题】列出我还需要关注的风险，没有就写“无”\n【下一阶段计划】\n1. 下一阶段目标\n2. 负责人和关键步骤\n3. 你预计下一次回传给我的结果\n【等待你确认】是`,
        }
      : null;

  return {
    headline: `团队已回复，等待 ${roomOwnerLabel} 收口`,
    statusLabel: "待负责人收口",
    tone: "amber",
    ownerAgentId: roomOwnerAgentId,
    ownerLabel: roomOwnerLabel,
    stage: "团队回执已到齐",
    summary: `${respondedLabels.join("、")} 已经给出反馈。${closureSummary}`,
    actionHint: `现在不要继续盯成员状态，先让 ${roomOwnerLabel} 汇总判断并推进下一棒。`,
    topSummaryItems: [
      { id: "dispatch", label: "最近派发", value: dispatchTargetLabels.join("、") },
      { id: "replied", label: "已回复", value: respondedLabels.join("、") },
      { id: "owner", label: "待收口", value: roomOwnerLabel },
    ],
    primaryAction: closurePrimaryAction,
    openAction: roomOwnerOpenAction,
  };
}
