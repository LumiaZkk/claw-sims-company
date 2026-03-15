import { useCallback, useMemo } from "react";
import { resolveRequirementRoomEntryTarget } from "../../../application/delegation/requirement-room-entry";
import { buildRequirementRoomHrefFromRecord } from "../../../application/delegation/room-routing";
import { doesConversationWorkItemMatch } from "../../../application/mission/chat-work-item-state";
import { useChatClosedLoop } from "../hooks/useChatClosedLoop";
import { useChatGovernanceState } from "../hooks/useChatGovernanceState";
import { useChatCollaborationSurface } from "../hooks/useChatCollaborationSurface";
import { useChatMissionSurface } from "../hooks/useChatMissionSurface";
import { useChatWorkbench } from "../hooks/useChatWorkbench";
import { useChatActionSurface } from "../hooks/useChatActionSurface";
import { useChatConversationTruth } from "../hooks/useChatConversationTruth";
import { trackChatRequirementMetric } from "../../../application/telemetry/chat-requirement-metrics";
import { toast } from "../../../system/toast-store";
import { buildRequirementPromotionSystemMessages } from "../view-models/promotion-system-events";
import type { ChatPageMissionStateInput } from "../chat-page-types";
import type { WorkItemRecord } from "../../../domain/mission/types";
import {
  deriveChatPageDisplayState,
  deriveChatPageRequirementState,
} from "./chat-page-mission-state-helpers";

export function useChatPageMissionState(input: ChatPageMissionStateInput) {
  const {
    activeArtifacts,
    activeCompany,
    activeConversationState,
    activeConversationStates,
    activeDecisionTickets,
    activeDispatches,
    activeMissionRecords,
    activeRequirementAggregates,
    activeRequirementEvidence,
    activeRoomRecords,
    activeWorkItems,
    appendLocalProgressEvent,
    authorityBackedState,
    ceoReplyExplicitlyRequestsNewTask,
    ceoSurface,
    companySessionSnapshots,
    companySessionSnapshotsRef,
    conversationStateKey,
    currentTime,
    effectiveRequirementRoomSnapshots,
    emp,
    ensureRequirementRoomForAggregate,
    groupTitle,
    groupTopic,
    groupTopicKey,
    groupWorkItemId,
    handoffPreview,
    historyAgentId,
    isArchiveView,
    isCeoSession,
    isFreshConversation,
    isGroup,
    isRequirementBootstrapPending,
    isSummaryOpen,
    lastSyncedRoomSignatureRef,
    latestMessageTimestamp,
    localProgressEvents,
    localSlaFallbackAlerts,
    messages,
    navigate,
    nextOpenTaskStepAgentId,
    nextOpenTaskStepLabel,
    openSummaryPanel,
    preferredConversationTopicKey,
    preferredConversationWorkKey,
    previewConversationWorkItem,
    previewTimestamp,
    primaryRequirementId,
    productRoomId,
    publishDispatchTargetAgentId,
    publishDispatchTargetLabel,
    relatedSlaAlerts,
    replaceDispatchRecords,
    requestPreview,
    routeCompanyConflictMessage,
    sessionExecution,
    sessionKey,
    sessionProgressEvents,
    setConversationDraftRequirement,
    setCompanySessionSnapshots,
    shouldPreferPreviewConversationWorkItem,
    summaryAlertCount,
    summaryPanelView,
    structuredTaskPreview,
    takeoverPack,
    targetAgentId,
    taskPlanOverview,
    updateCompany,
    upsertMissionRecord,
    upsertRoomRecord,
    upsertWorkItemRecord,
  } = input;

  const {
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
  } = useMemo(
    () =>
      deriveChatPageRequirementState({
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
        persistedWorkItem: input.persistedWorkItem,
        preferredConversationTopicKey,
        primaryRequirementId,
        requirementOverview: input.requirementOverview,
        stableDisplayWorkItem: input.stableDisplayWorkItem,
      }),
    [
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
      input.persistedWorkItem,
      preferredConversationTopicKey,
      input.requirementOverview,
      input.stableDisplayWorkItem,
      isArchiveView,
      isCeoSession,
      isGroup,
      messages,
      primaryRequirementId,
    ],
  );

  const doesWorkItemMatchCurrentConversation = useCallback(
    (item: WorkItemRecord | null | undefined) =>
      doesConversationWorkItemMatch({
        item,
        preferredConversationTopicKey,
        preferredConversationWorkKey,
      }),
    [preferredConversationTopicKey, preferredConversationWorkKey],
  );

  const {
    focusSummary,
    isChapterExecutionRequirement,
    requirementTechParticipant,
    shouldAdvanceToNextPhase,
    shouldDirectToTechDispatch,
    shouldDispatchPublish,
    publishDispatchTargetAgentId: resolvedPublishDispatchTargetAgentId,
    publishDispatchTargetLabel: resolvedPublishDispatchTargetLabel,
    hasTechnicalSummary,
    hasContextSummary,
    sessionProgressEvents: resolvedSessionProgressEvents,
  } = useChatGovernanceState({
    activeCompany,
    targetAgentId,
    targetRoleLabel: isGroup ? "多人协作会话" : emp?.role ?? "会话",
    isGroup,
    isCeoSession,
    isFreshConversation,
    sessionKey,
    summaryAlertCount,
    sessionExecution,
    structuredTaskPreview: structuredTaskPreview ?? null,
    requestPreview,
    handoffPreview,
    takeoverPack,
    ceoSurface: ceoSurface ?? null,
    alerts: [...relatedSlaAlerts, ...localSlaFallbackAlerts],
    requirementOverview: input.requirementOverview,
    taskPlanOverview,
    messages,
  });

  const syncCompanyCommunication = useChatClosedLoop({
    activeCompany,
    activeArtifacts,
    activeDispatches,
    previousSnapshotsRef: companySessionSnapshotsRef,
    setCompanySessionSnapshots,
    replaceDispatchRecords,
    updateCompany,
  });

  const {
    recentProgressEvents,
    latestProgressEvent,
    latestBlockingProgressEvent,
    currentTimelineItem,
    focusActions,
    collaborationLifecycle,
    summaryRecoveryAction,
  } = useChatCollaborationSurface({
    activeCompany,
    structuredTaskPreview,
    localProgressEvents,
    sessionProgressEvents: sessionProgressEvents ?? resolvedSessionProgressEvents,
    requestPreview,
    handoffPreview,
    previewTimestamp,
    takeoverPack,
    nextOpenTaskStepLabel,
    nextOpenTaskStepAgentId,
    targetAgentId,
    focusSummary,
    sessionKey,
    structuredTaskOwnerAgentId: structuredTaskPreview?.ownerAgentId ?? null,
    summaryAlertCount,
  });

  const {
    workbenchTone,
    workbenchOwnerAgentId,
    workbenchOwnerLabel,
    workbenchStage,
    workbenchStatusLabel,
    workbenchHeadline,
    workbenchSummary,
    workbenchActionHint,
    workbenchOpenAction,
  } = useChatWorkbench({
    activeCompany,
    latestBlockingProgressEvent,
    currentTimelineItem,
    focusSummary,
    latestProgressEvent,
    sessionExecutionActionable: sessionExecution.actionable,
    focusActions,
    targetAgentId,
  });

  const {
    strategicDirectParticipantView,
    persistedConversationMission,
    requirementRoomSummary,
    missionSurface,
  } = useChatMissionSurface({
    activeCompany,
    activeMissionRecords,
    sessionKey,
    productRoomId,
    groupTopicKey,
    effectiveRequirementRoom: input.effectiveRequirementRoom,
    roomBoundWorkItem: input.roomBoundWorkItem,
    persistedWorkItem: input.persistedWorkItem,
    groupTitle,
    messages,
    requirementRoomTargetAgentIds: input.requirementRoomTargetAgentIds,
    requirementRoomSessionCount: input.requirementRoomSessions.length,
    targetAgentId,
    isGroup,
    isFreshConversation,
    isRequirementBootstrapPending,
    isCeoSession,
    isChapterExecutionRequirement,
    ceoLabel: emp?.nickname ?? "CEO",
    stableDisplayWorkItem: input.stableDisplayWorkItem,
    stableDisplayPrimaryView: input.stableDisplayPrimaryView,
    requirementOverview: input.requirementOverview,
    requirementProgressGroups: input.requirementProgressGroups,
    taskPlanOverview,
    shouldAdvanceToNextPhase,
    shouldDispatchPublish,
    shouldDirectToTechDispatch,
    publishDispatchTargetAgentId: resolvedPublishDispatchTargetAgentId ?? publishDispatchTargetAgentId,
    publishDispatchTargetLabel: resolvedPublishDispatchTargetLabel ?? publishDispatchTargetLabel,
    requirementTeam: input.requirementTeam,
    workbenchHeadline,
    workbenchOwnerAgentId,
    workbenchOwnerLabel,
    workbenchStage,
    workbenchSummary,
    workbenchActionHint,
    workbenchStatusLabel,
    workbenchTone,
    hasStableConversationWorkItem: input.hasStableConversationWorkItem,
    shouldUsePersistedWorkItemPrimaryView: input.shouldUsePersistedWorkItemPrimaryView,
    structuredTaskTitle: structuredTaskPreview?.title ?? null,
  });

  const {
    shouldUseTaskPlanPrimaryView,
    effectiveOwnerAgentId,
    effectiveOwnerLabel,
    effectiveStepLabel,
    effectiveStage,
    effectiveStatusLabel,
    effectiveSummary,
    effectiveActionHint,
    effectiveHeadline,
    effectiveTone,
    displayPlanCurrentStep,
    canonicalNextBatonAgentId,
    canonicalNextBatonLabel,
    displayNextBatonLabel,
    displayNextBatonAgentId,
    missionIsCompleted,
    conversationMission,
    shouldPreferPersistedConversationMission,
    activeConversationMission,
  } = missionSurface;

  const {
    conversationMissionRecord,
    shouldPersistConversationTruth,
    conversationDraftRequirement,
  } = useChatConversationTruth({
    isGroup,
    isCeoSession,
    sessionKey,
    isArchiveView,
    isFreshConversation,
    isRequirementBootstrapPending,
    latestMessageTimestamp,
    effectiveRequirementRoom: input.effectiveRequirementRoom,
    requirementOverview: input.requirementOverview,
    persistedWorkItem: input.persistedWorkItem,
    persistedConversationMission,
    conversationMission,
    hasStableConversationWorkItem: input.hasStableConversationWorkItem,
    shouldPreferPersistedConversationMission,
    groupTopicKey,
    productRoomId,
    effectiveOwnerAgentId,
    displayNextBatonAgentId,
    missionIsCompleted,
    activeCompany,
    authorityBackedState,
    activeRoomRecords,
    activeConversationState,
    requirementTeam: input.requirementTeam
      ? {
          title: input.requirementTeam.title,
          topicKey: input.requirementTeam.topicKey,
          memberIds: input.requirementTeam.memberIds,
          ownerAgentId: input.requirementTeam.ownerAgentId,
        }
      : null,
    groupWorkItemId,
    targetAgentId,
    effectiveRequirementRoomSnapshots,
    upsertMissionRecord,
    upsertWorkItemRecord,
    upsertRoomRecord,
    setConversationCurrentWorkKey: input.setConversationCurrentWorkKey,
    setConversationDraftRequirement,
    conversationStateKey,
    messages,
    structuredTaskPreview,
    previewConversationWorkItem,
    shouldPreferPreviewConversationWorkItem,
    ceoReplyExplicitlyRequestsNewTask,
    doesWorkItemMatchCurrentConversation,
    lastSyncedRoomSignatureRef,
  });

  const {
    detailActions,
    displayRequirementLifecycleSections,
    displayRequirementProgressGroups,
    headerStatusBadgeClass,
    primaryOpenAction,
    teamGroupRoute,
    currentConversationWorkItemId,
    currentConversationTopicKey,
    buildTeamAdjustmentAction,
  } = useChatActionSurface({
    activeCompany,
    activeRoomRecords,
    linkedRequirementRoom: input.linkedRequirementRoom,
    stableDisplayWorkItem: input.stableDisplayWorkItem,
    stableDisplayPrimaryView: input.stableDisplayPrimaryView,
    strategicDirectParticipantView,
    requirementOverview: input.requirementOverview,
    requirementProgressGroups: input.requirementProgressGroups,
    requirementRoomSummary,
    requirementTeam: input.requirementTeam,
    persistedWorkItem: input.persistedWorkItem,
    conversationMissionRecord,
    groupWorkItemId,
    groupTopicKey,
    targetAgentId,
    sessionKey,
    isGroup,
    isCeoSession,
    isFreshConversation,
    isRequirementBootstrapPending,
    isSummaryOpen,
    summaryPanelView,
    currentTime,
    actionWatches: input.actionWatches,
    workbenchOpenAction,
    focusActions,
    summaryRecoveryAction,
    taskPlanOverview,
    displayPlanCurrentStep,
    canonicalNextBatonAgentId,
    canonicalNextBatonLabel,
    displayNextBatonLabel,
    displayNextBatonAgentId,
    missionIsCompleted,
    shouldUseTaskPlanPrimaryView,
    effectiveOwnerAgentId,
    effectiveOwnerLabel,
    effectiveStage,
    effectiveStatusLabel,
    effectiveSummary,
    effectiveActionHint,
    effectiveHeadline,
    effectiveTone,
    shouldAdvanceToNextPhase,
    shouldDispatchPublish,
    shouldDirectToTechDispatch,
    publishDispatchTargetAgentId: resolvedPublishDispatchTargetAgentId ?? publishDispatchTargetAgentId,
    publishDispatchTargetLabel: resolvedPublishDispatchTargetLabel ?? publishDispatchTargetLabel,
    requirementTechParticipant,
    focusSummaryOwnerRole: focusSummary.ownerRole,
  });

  const resolvedRequirementRoom = input.linkedRequirementRoom ?? primaryRequirementSurface?.room ?? null;
  const showRequirementTeamEntryResolved = Boolean(
    !isArchiveView && !isGroup && primaryRequirementSurface?.aggregateId,
  );

  const openRequirementRoom = useCallback(() => {
    const target = resolveRequirementRoomEntryTarget({
      room: resolvedRequirementRoom,
      aggregateId: activeCompany ? primaryRequirementSurface?.aggregateId ?? null : null,
      route: teamGroupRoute,
    });
    if (target.kind === "ensure") {
      const ensuredRoom = ensureRequirementRoomForAggregate(target.aggregateId);
      if (ensuredRoom) {
        navigate(buildRequirementRoomHrefFromRecord(ensuredRoom));
        return;
      }
    }
    if (target.kind === "room" || target.kind === "route") {
      navigate(target.href);
      return;
    }
    openSummaryPanel("team");
  }, [
    activeCompany,
    ensureRequirementRoomForAggregate,
    navigate,
    openSummaryPanel,
    primaryRequirementSurface?.aggregateId,
    resolvedRequirementRoom,
    teamGroupRoute,
  ]);

  const shouldShowDraftCard = Boolean(
    !isArchiveView &&
      !authorityBackedState &&
      !isGroup &&
      isCeoSession &&
      conversationDraftRequirement &&
      !showSettledRequirementCard &&
      ["draft_ready", "awaiting_promotion_choice", "promoted_manual", "promoted_auto"].includes(
        conversationDraftRequirement.state,
      ),
  );

  const {
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
    showGroupCollaborationMode,
    showIntegratedGroupHeader,
  } = useMemo(
    () =>
      deriveChatPageDisplayState({
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
        hasStableDisplayWorkItem: Boolean(input.stableDisplayWorkItem),
        isArchiveView,
        isCeoSession,
        isGroup,
        isRequirementBootstrapPending,
        primaryOpenAction,
        primaryRequirementSurface,
        recentStructuredMissionNextAction: latestStructuredMissionNote?.nextAction ?? null,
        requirementCollaborationSurface,
        resolvedRequirementRoom,
        settledRequirementNextAction,
        settledRequirementSummary,
        showSettledRequirementCard,
        teamGroupRoute,
      }),
    [
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
      isArchiveView,
      isCeoSession,
      isGroup,
      isRequirementBootstrapPending,
      latestStructuredMissionNote?.nextAction,
      primaryOpenAction,
      primaryRequirementSurface,
      requirementCollaborationSurface,
      resolvedRequirementRoom,
      settledRequirementNextAction,
      settledRequirementSummary,
      showSettledRequirementCard,
      teamGroupRoute,
    ],
  );
  const promotionActionLabel =
    !authorityBackedState &&
    conversationDraftRequirement &&
    ["draft_ready", "awaiting_promotion_choice"].includes(conversationDraftRequirement.state)
      ? "确认并转为需求"
      : null;

  const handlePromoteRequirementDraft = useCallback(() => {
    if (!conversationStateKey || !conversationDraftRequirement) {
      return;
    }
    setConversationDraftRequirement(conversationStateKey, {
      ...conversationDraftRequirement,
      state: "promoted_manual",
      promotionReason: "manual_confirmation",
      promotable: true,
      updatedAt: Date.now(),
    });
    trackChatRequirementMetric({
      companyId: activeCompany?.id ?? null,
      conversationId: conversationStateKey,
      requirementId: input.persistedWorkItem?.id ?? conversationMissionRecord?.id ?? null,
      name: "draft_requirement_promoted_manual",
    });
    toast.success("已转为需求", "后续会自动绑定需求房和工作看板。");
  }, [
    activeCompany?.id,
    conversationDraftRequirement,
    conversationMissionRecord?.id,
    conversationStateKey,
    input.persistedWorkItem?.id,
    setConversationDraftRequirement,
  ]);

  const handleContinueDraftChat = useCallback(() => {
    if (!conversationStateKey || !conversationDraftRequirement) {
      return;
    }
    setConversationDraftRequirement(conversationStateKey, {
      ...conversationDraftRequirement,
      state:
        conversationDraftRequirement.state === "draft_ready"
          ? "awaiting_promotion_choice"
          : conversationDraftRequirement.state,
      updatedAt: Date.now(),
    });
    trackChatRequirementMetric({
      companyId: activeCompany?.id ?? null,
      conversationId: conversationStateKey,
      requirementId: input.persistedWorkItem?.id ?? conversationMissionRecord?.id ?? null,
      name: "draft_requirement_continue_chat",
    });
  }, [
    activeCompany?.id,
    conversationDraftRequirement,
    conversationMissionRecord?.id,
    conversationStateKey,
    input.persistedWorkItem?.id,
    setConversationDraftRequirement,
  ]);

  const displayMessages = useMemo(
    () =>
      [
        ...messages,
        ...buildRequirementPromotionSystemMessages({
          draftRequirement: conversationDraftRequirement,
        }),
      ].sort((left, right) => {
        const leftTimestamp = typeof left.timestamp === "number" ? left.timestamp : 0;
        const rightTimestamp = typeof right.timestamp === "number" ? right.timestamp : 0;
        if (leftTimestamp !== rightTimestamp) {
          return leftTimestamp - rightTimestamp;
        }
        if (left.role === right.role) {
          return 0;
        }
        return left.role === "system" ? 1 : -1;
      }),
    [conversationDraftRequirement, messages],
  );

  return {
    activeConversationMission,
    buildTeamAdjustmentAction,
    canonicalNextBatonAgentId,
    canonicalNextBatonLabel,
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
    collaborationLifecycle,
    conversationDraftRequirement,
    conversationMission,
    conversationMissionRecord,
    currentConversationTopicKey,
    currentConversationWorkItemId,
    detailActions,
    displayGroupNextAction,
    displayGroupSubtitle,
    displayGroupSummaryItems,
    displayGroupTitle,
    displayMessages,
    displayNextBatonAgentId,
    displayNextBatonLabel,
    displayPlanCurrentStep,
    displayRequirementLifecycleSections,
    displayRequirementProgressGroups,
    displayRequirementHeadline,
    effectiveActionHint,
    effectiveHeadline,
    effectiveOwnerAgentId,
    effectiveOwnerLabel,
    effectiveStage,
    effectiveStatusLabel,
    effectiveStepLabel,
    effectiveSummary,
    effectiveTone,
    focusActions,
    focusSummary,
    handleContinueDraftChat,
    handlePromoteRequirementDraft,
    hasContextSummary,
    hasTechnicalSummary,
    headerContextTagLabel,
    headerStatusBadgeClass,
    isManualConfirmationPending,
    latestProgressEvent,
    latestStructuredMissionNote,
    missionIsCompleted,
    missionSurface,
    openRequirementDecisionTicket,
    openRequirementRoom,
    persistedConversationMission,
    primaryOpenAction,
    primaryRequirementProjection,
    primaryRequirementSurface,
    promotionActionLabel,
    recentConversationMainlineTitle,
    recentProgressEvents,
    requirementCollaborationSurface,
    requirementRoomSummary,
    requirementTechParticipant,
    resolvedRequirementRoom,
    settledRequirementAggregate,
    settledRequirementNextAction,
    settledRequirementSummary,
    shouldAdvanceToNextPhase,
    shouldDirectToTechDispatch,
    shouldDispatchPublish,
    shouldPersistConversationTruth,
    shouldShowDraftCard,
    shouldUseTaskPlanPrimaryView,
    showGroupCollaborationMode,
    showIntegratedGroupHeader,
    showRequirementTeamEntryResolved,
    showSettledRequirementCard,
    singleChatMainlineTitle,
    strategicDirectParticipantView,
    summaryRecoveryAction,
    syncCompanyCommunication,
    teamGroupRoute,
    workbenchOpenAction,
  };
}
