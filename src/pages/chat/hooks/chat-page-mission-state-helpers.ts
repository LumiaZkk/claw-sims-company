import { buildRequirementCollaborationSurface } from "../../../application/mission/requirement-collaboration-surface";
import { selectPrimaryRequirementProjection } from "../../../application/mission/requirement-aggregate";
import { buildPrimaryRequirementSurface } from "../../../application/mission/primary-requirement-surface";
import {
  deriveRecentMissionConversationTitle,
  findLatestStructuredMissionNote,
  findMeaningfulMainlineHeadline,
  findMeaningfulMainlineSummary,
  isLowSignalProgressSummary,
} from "../chat-page-helpers";
import type { ChatPageMissionStateInput } from "../chat-page-types";
import type { EmployeeRef } from "../../../domain/org/types";
import { buildRequirementRoomHrefFromRecord } from "../../../application/delegation/room-routing";

type RequirementStateInput = Pick<
  ChatPageMissionStateInput,
  | "activeCompany"
  | "activeConversationStates"
  | "activeDecisionTickets"
  | "activeRequirementAggregates"
  | "activeRequirementEvidence"
  | "activeRoomRecords"
  | "activeWorkItems"
  | "companySessionSnapshots"
  | "currentTime"
  | "groupTitle"
  | "groupTopic"
  | "isArchiveView"
  | "isCeoSession"
  | "isGroup"
  | "messages"
  | "persistedWorkItem"
  | "preferredConversationTopicKey"
  | "primaryRequirementId"
  | "requirementOverview"
  | "stableDisplayWorkItem"
>;

type PrimaryRequirementSurface = ReturnType<typeof buildPrimaryRequirementSurface>;
type RequirementCollaborationSurface = ReturnType<typeof buildRequirementCollaborationSurface>;

export function deriveChatPageRequirementState(input: RequirementStateInput) {
  const {
    activeCompany,
    activeConversationStates,
    activeDecisionTickets,
    activeRequirementAggregates,
    activeRequirementEvidence,
    activeRoomRecords,
    activeWorkItems,
    companySessionSnapshots,
    currentTime,
    groupTitle,
    groupTopic,
    isArchiveView,
    isCeoSession,
    isGroup,
    messages,
    persistedWorkItem,
    preferredConversationTopicKey,
    primaryRequirementId,
    requirementOverview,
    stableDisplayWorkItem,
  } = input;

  const primaryRequirementProjection = selectPrimaryRequirementProjection({
    company: activeCompany,
    activeRequirementAggregates,
    primaryRequirementId,
    activeWorkItems,
    activeRoomRecords,
  });

  const primaryRequirementSurface = activeCompany
    ? buildPrimaryRequirementSurface({
        company: activeCompany,
        activeConversationStates,
        activeWorkItems,
        activeRequirementAggregates,
        activeRequirementEvidence,
        activeDecisionTickets,
        primaryRequirementId,
        activeRoomRecords,
        companySessions: [],
        companySessionSnapshots,
        currentTime,
        ceoAgentId:
          activeCompany.employees.find((employee: EmployeeRef) => employee.metaRole === "ceo")?.agentId ?? null,
      })
    : null;

  const settledRequirementAggregate = primaryRequirementProjection.aggregate;
  const requirementCollaborationSurface = isGroup
    ? buildRequirementCollaborationSurface({
        company: activeCompany,
        surface: primaryRequirementSurface,
        roomMessages: messages,
      })
    : null;
  const latestStructuredMissionNote = findLatestStructuredMissionNote(messages);
  const recentConversationMainlineTitle = deriveRecentMissionConversationTitle(messages);
  const showSettledRequirementCard =
    !isArchiveView &&
    !isGroup &&
    isCeoSession &&
    Boolean(settledRequirementAggregate);

  const latestStructuredMainlineSummary = findMeaningfulMainlineSummary([
    latestStructuredMissionNote?.summary,
  ]);
  const persistedMainlineSummary = findMeaningfulMainlineSummary([
    requirementOverview?.summary,
    settledRequirementAggregate?.summary,
    stableDisplayWorkItem?.goal,
    primaryRequirementSurface?.workItem?.goal,
    primaryRequirementSurface?.aggregate?.summary,
  ]);

  const groupMainlineSummary = (() => {
    if (!isGroup) {
      return null;
    }
    if (latestStructuredMainlineSummary) {
      return latestStructuredMainlineSummary;
    }
    if (persistedMainlineSummary) {
      return persistedMainlineSummary;
    }
    const collaborationGoalSummary = requirementCollaborationSurface?.goalSummary?.trim() ?? "";
    const headline = primaryRequirementSurface?.title?.trim() ?? groupTitle?.trim() ?? "";
    if (
      collaborationGoalSummary &&
      collaborationGoalSummary !== headline &&
      !isLowSignalProgressSummary(collaborationGoalSummary)
    ) {
      return collaborationGoalSummary;
    }
    return null;
  })();

  const groupMainlineHeadline = findMeaningfulMainlineHeadline({
    topicKey:
      primaryRequirementSurface?.workItem?.topicKey ??
      primaryRequirementSurface?.aggregate?.topicKey ??
      requirementOverview?.topicKey ??
      groupTopic,
    headlineCandidates: [
      recentConversationMainlineTitle,
      primaryRequirementSurface?.title,
      stableDisplayWorkItem?.title,
      stableDisplayWorkItem?.headline,
      persistedWorkItem?.title,
      persistedWorkItem?.headline,
      requirementOverview?.title,
      groupTitle,
    ],
    summaryCandidates: [
      groupMainlineSummary,
      requirementCollaborationSurface?.goalSummary,
      requirementOverview?.summary,
      stableDisplayWorkItem?.goal,
      stableDisplayWorkItem?.summary,
      primaryRequirementSurface?.summary,
      settledRequirementAggregate?.summary,
      latestStructuredMissionNote?.summary,
      latestStructuredMissionNote?.rawText,
    ],
  });

  const singleChatMainlineTopicKey =
    preferredConversationTopicKey ??
    primaryRequirementSurface?.workItem?.topicKey ??
    primaryRequirementSurface?.aggregate?.topicKey ??
    requirementOverview?.topicKey ??
    groupTopic ??
    null;

  const singleChatMainlineTitle = !isGroup
    ? findMeaningfulMainlineHeadline({
        topicKey: singleChatMainlineTopicKey,
        headlineCandidates: [
          recentConversationMainlineTitle,
          stableDisplayWorkItem?.title,
          stableDisplayWorkItem?.headline,
          persistedWorkItem?.title,
          persistedWorkItem?.headline,
          requirementOverview?.title,
          primaryRequirementSurface?.title,
        ],
        summaryCandidates: [
          latestStructuredMissionNote?.summary,
          stableDisplayWorkItem?.displaySummary,
          stableDisplayWorkItem?.goal,
          stableDisplayWorkItem?.summary,
          requirementOverview?.summary,
          settledRequirementAggregate?.summary,
          primaryRequirementSurface?.summary,
        ],
      })
    : null;

  const settledRequirementSummary =
    (isGroup ? groupMainlineSummary : null) ??
    latestStructuredMainlineSummary ??
    stableDisplayWorkItem?.displaySummary ??
    stableDisplayWorkItem?.summary ??
    requirementOverview?.summary ??
    settledRequirementAggregate?.summary ??
    "CEO 已经把这件事收敛成一条可推进的主线。";

  const settledRequirementNextAction =
    (isGroup ? latestStructuredMissionNote?.nextAction : null) ??
    stableDisplayWorkItem?.displayNextAction ??
    stableDisplayWorkItem?.nextAction ??
    settledRequirementAggregate?.nextAction ??
    "进入需求中心继续推进。";

  return {
    groupMainlineHeadline,
    groupMainlineSummary,
    latestStructuredMissionNote,
    primaryRequirementProjection,
    primaryRequirementSurface,
    recentConversationMainlineTitle,
    requirementCollaborationSurface,
    settledRequirementAggregate,
    settledRequirementNextAction,
    settledRequirementSummary,
    showSettledRequirementCard,
    singleChatMainlineTitle,
  };
}

type DisplayStateInput = {
  authorityBackedState: boolean;
  displayNextBatonAgentId: string | null;
  displayNextBatonLabel: string | null;
  effectiveActionHint: string | null;
  effectiveHeadline: string | null;
  effectiveOwnerLabel: string | null;
  effectiveStatusLabel: string | null;
  effectiveStepLabel: string | null;
  effectiveSummary: string | null;
  effectiveTone: string | null;
  groupMainlineHeadline: string | null;
  groupMainlineSummary: string | null;
  groupTitle: string | null;
  hasStableDisplayWorkItem: boolean;
  isArchiveView: boolean;
  isCeoSession: boolean;
  isGroup: boolean;
  isRequirementBootstrapPending: boolean;
  primaryOpenAction: { href?: string | null; label: string } | null;
  primaryRequirementSurface: PrimaryRequirementSurface;
  recentStructuredMissionNextAction: string | null;
  requirementCollaborationSurface: RequirementCollaborationSurface;
  resolvedRequirementRoom: ChatPageMissionStateInput["linkedRequirementRoom"] | null;
  settledRequirementNextAction: string;
  settledRequirementSummary: string;
  showSettledRequirementCard: boolean;
  teamGroupRoute: string | null;
};

export function deriveChatPageDisplayState(input: DisplayStateInput) {
  const {
    authorityBackedState,
    displayNextBatonAgentId,
    displayNextBatonLabel,
    effectiveActionHint,
    effectiveHeadline,
    effectiveOwnerLabel,
    effectiveStatusLabel,
    effectiveStepLabel,
    effectiveSummary,
    effectiveTone,
    groupMainlineHeadline,
    groupMainlineSummary,
    groupTitle,
    hasStableDisplayWorkItem,
    isArchiveView,
    isCeoSession,
    isGroup,
    isRequirementBootstrapPending,
    primaryOpenAction,
    primaryRequirementSurface,
    recentStructuredMissionNextAction,
    requirementCollaborationSurface,
    resolvedRequirementRoom,
    settledRequirementNextAction,
    settledRequirementSummary,
    showSettledRequirementCard,
    teamGroupRoute,
  } = input;

  const openRequirementDecisionTicket =
    !isArchiveView && (isGroup || isCeoSession)
      ? primaryRequirementSurface?.openDecisionTicket ?? null
      : null;

  const isStructuredRequirementDecisionPending = Boolean(
    openRequirementDecisionTicket?.requiresHuman,
  );
  const isLegacyRequirementDecisionPending = Boolean(
    !openRequirementDecisionTicket &&
      primaryRequirementSurface?.stageGateStatus === "waiting_confirmation",
  );

  const resolvedAuthorityOwnerLabel =
    primaryRequirementSurface?.ownerLabel ?? effectiveOwnerLabel;
  const resolvedAuthorityStepLabel =
    primaryRequirementSurface?.currentStep ?? effectiveStepLabel;
  const resolvedAuthoritySummary =
    primaryRequirementSurface?.summary ?? effectiveSummary;
  const resolvedAuthorityNextBatonLabel =
    primaryRequirementSurface?.nextBatonLabel ?? displayNextBatonLabel;
  const resolvedAuthorityNextBatonAgentId =
    primaryRequirementSurface?.nextBatonActorId ?? displayNextBatonAgentId;
  const isCurrentRoomPrimaryAction = Boolean(
    isGroup &&
      resolvedRequirementRoom &&
      primaryOpenAction?.href &&
      primaryOpenAction.href === buildRequirementRoomHrefFromRecord(resolvedRequirementRoom),
  );
  const isRequirementRoomPrimaryAction = Boolean(
    primaryOpenAction &&
      (/需求房间/.test(primaryOpenAction.label) || /需求团队/.test(primaryOpenAction.label)),
  );

  const displayRequirementHeadline =
    (isGroup ? groupMainlineHeadline : null) ??
    primaryRequirementSurface?.title ??
    (isGroup ? groupTitle : null) ??
    effectiveHeadline;

  const isManualConfirmationPending =
    isStructuredRequirementDecisionPending || isLegacyRequirementDecisionPending;
  const chatSurfaceHeadline = displayRequirementHeadline;
  const chatSurfaceStatusLabel = isStructuredRequirementDecisionPending
    ? "待你确认"
    : isLegacyRequirementDecisionPending
      ? "待确认"
      : effectiveStatusLabel;
  const chatSurfaceOwnerLabel = resolvedAuthorityOwnerLabel;
  const chatSurfaceStepLabel = isStructuredRequirementDecisionPending
    ? openRequirementDecisionTicket?.decisionType === "requirement_change"
      ? "需求变更待确认"
      : "待你确认下一步"
    : isLegacyRequirementDecisionPending
      ? "等待 CEO 补发结构化选项"
      : resolvedAuthorityStepLabel;
  const chatSurfaceStage = isStructuredRequirementDecisionPending
    ? "待你确认"
    : isLegacyRequirementDecisionPending
      ? "待确认"
      : resolvedAuthorityStepLabel;
  const chatSurfaceSummary = isStructuredRequirementDecisionPending
    ? openRequirementDecisionTicket?.summary ?? resolvedAuthoritySummary ?? settledRequirementSummary
    : isLegacyRequirementDecisionPending
      ? resolvedAuthoritySummary ?? "当前主线停在待确认状态，但这轮还没有可操作的结构化决策选项。"
      : resolvedAuthoritySummary;
  const chatSurfaceNextBatonLabel = isManualConfirmationPending ? "你" : resolvedAuthorityNextBatonLabel;
  const chatSurfaceNextBatonAgentId = isManualConfirmationPending ? null : resolvedAuthorityNextBatonAgentId;
  const chatSurfaceActionHint = isStructuredRequirementDecisionPending
    ? "请直接在对应 CEO 回复下方完成结构化决策。状态会以票据形式持久化，不再依赖聊天文本猜测。"
    : isLegacyRequirementDecisionPending
      ? "当前还没有可点选的决策票。只有 CEO 补发结构化决策后，消息下方才会出现选项按钮。"
      : effectiveActionHint;
  const chatSurfaceTone = isStructuredRequirementDecisionPending
    ? "amber"
    : isLegacyRequirementDecisionPending
      ? "slate"
      : effectiveTone;
  const chatSurfacePrimaryOpenAction =
    isStructuredRequirementDecisionPending ||
    isCurrentRoomPrimaryAction ||
    (isGroup && isRequirementRoomPrimaryAction)
      ? null
      : primaryOpenAction;
  const chatSurfaceSettledRequirementNextAction = isStructuredRequirementDecisionPending
    ? "请先完成当前待决策事项。"
    : isLegacyRequirementDecisionPending
      ? "请让 CEO 补发结构化决策选项后再继续。"
      : settledRequirementNextAction;
  const displayGroupNextAction = isGroup
    ? findMeaningfulMainlineSummary([
        recentStructuredMissionNextAction,
        chatSurfaceSettledRequirementNextAction,
      ])
    : chatSurfaceSettledRequirementNextAction;
  const showGroupCollaborationMode = isGroup && Boolean(requirementCollaborationSurface);
  const displayGroupTitle = isGroup
    ? primaryRequirementSurface?.title ?? groupTitle
    : groupTitle;
  const displayGroupSummaryItems = !isArchiveView
    ? (
        isGroup && showGroupCollaborationMode
          ? [
              requirementCollaborationSurface?.headerSummary.currentBlocker
                ? {
                    label: "当前阻塞",
                    value: requirementCollaborationSurface.headerSummary.currentBlocker,
                  }
                : {
                    label: "当前阶段",
                    value:
                      requirementCollaborationSurface?.headerSummary.phaseLabel ??
                      chatSurfaceStepLabel ??
                      "待确认下一步",
                  },
              requirementCollaborationSurface?.isSingleOwnerClosure &&
              requirementCollaborationSurface.closureOwnerLabel
                ? {
                    label: "当前收口人",
                    value: requirementCollaborationSurface.closureOwnerLabel,
                  }
                : requirementCollaborationSurface?.headerSummary.activeParticipantsLabel
                  ? {
                      label: "协作成员",
                      value: requirementCollaborationSurface.headerSummary.activeParticipantsLabel,
                    }
                  : null,
            ]
          : chatSurfaceStepLabel
            ? [{ label: "当前步骤", value: chatSurfaceStepLabel }]
            : []
      ).filter((value): value is { label: string; value: string } => Boolean(value))
    : [];

  const headerContextTagLabel = !isArchiveView
    ? isGroup
      ? null
      : isRequirementBootstrapPending
        ? "恢复中"
        : hasStableDisplayWorkItem
          ? "当前主线"
          : "本轮规划/任务"
    : null;
  const displayGroupSubtitle = isGroup
    ? [
        requirementCollaborationSurface?.phaseLabel
          ? `阶段：${requirementCollaborationSurface.phaseLabel}`
          : chatSurfaceStepLabel
            ? `阶段：${chatSurfaceStepLabel}`
            : null,
        requirementCollaborationSurface?.currentBlocker
          ? `当前卡点：${requirementCollaborationSurface.currentBlocker}`
          : null,
        requirementCollaborationSurface?.latestConclusionSummary ??
          primaryRequirementSurface?.latestReportSummary ??
          primaryRequirementSurface?.summary ??
          null,
      ]
        .filter((value): value is string => Boolean(value))
        .join(" · ") || "多人协作需求房"
    : null;
  const showIntegratedGroupHeader = !isArchiveView;
  const promotionActionLabel =
    !authorityBackedState &&
    !showSettledRequirementCard
      ? "确认并转为需求"
      : null;

  return {
    chatSurfaceActionHint,
    chatSurfaceHeadline,
    chatSurfaceNextBatonAgentId,
    chatSurfaceNextBatonLabel,
    chatSurfaceOwnerLabel,
    chatSurfacePrimaryOpenAction,
    chatSurfaceSettledRequirementNextAction,
    chatSurfaceStage,
    chatSurfaceStatusLabel,
    chatSurfaceStepLabel,
    chatSurfaceSummary,
    chatSurfaceTone,
    displayGroupNextAction,
    displayGroupSubtitle,
    displayGroupSummaryItems,
    displayGroupTitle,
    displayRequirementHeadline,
    headerContextTagLabel,
    isManualConfirmationPending,
    openRequirementDecisionTicket,
    promotionActionLabel,
    showGroupCollaborationMode,
    showIntegratedGroupHeader,
  };
}
