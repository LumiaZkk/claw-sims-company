import { useCallback, useEffect, useMemo } from "react";
import { backfillRequirementRoomRecord } from "../../../application/mission/requirement-room-backfill";
import { buildRequirementDecisionResolutionMessage } from "../../../application/mission/requirement-decision-ticket";
import { buildRequirementRoomRecordSignature } from "../../../application/delegation/room-routing";
import {
  buildTakeoverCaseSummary,
  buildTakeoverCases,
  type TakeoverCase,
} from "../../../application/delegation/takeover-case";
import { useTakeoverCaseWorkflow } from "../../../application/delegation/use-takeover-case-workflow";
import { appendCompanyScopeToChatRoute } from "../../../lib/chat-routes";
import { trackChatRequirementMetric } from "../../../application/telemetry/chat-requirement-metrics";
import { toast } from "../../../system/toast-store";
import { useChatCoordinationActions } from "./useChatCoordinationActions";
import { useChatFocusAction } from "./useChatFocusAction";
import { useChatPreviewPersistence } from "./useChatPreviewPersistence";
import { useChatPageSurface } from "./useChatPageSurface";
import { useChatRuntimeEffects } from "./useChatRuntimeEffects";
import { useChatSessionReset } from "./useChatSessionReset";
import { useChatHistoryActions } from "./useChatHistoryActions";
import { useChatSend } from "./useChatSend";
import type { ChatMessage } from "../../../application/gateway";
import type { RequirementSessionSnapshot } from "../../../domain/mission/requirement-snapshot";
import type { TakeoverCaseRecord } from "../../../domain/delegation/types";
import {
  EMPTY_EMPLOYEES,
  buildSingleChatMissionHeadline,
  extractMissionBlocker,
  findLatestDisplayMissionNote,
  findMeaningfulMainlineSummary,
} from "../chat-page-helpers";
import type { ChatPagePresentationStateInput } from "../chat-page-types";

export function useChatPagePresentationState(input: ChatPagePresentationStateInput) {
  const { missionState } = input;
  const {
    activeConversationMission,
    buildTeamAdjustmentAction,
    chatSurfaceActionHint,
    chatSurfaceHeadline,
    chatSurfaceNextBatonAgentId,
    chatSurfaceNextBatonLabel,
    chatSurfaceOwnerLabel,
    chatSurfaceSettledRequirementNextAction,
    chatSurfaceStage,
    chatSurfaceStatusLabel,
    chatSurfaceStepLabel,
    chatSurfaceSummary,
    conversationDraftRequirement,
    conversationMissionRecord,
    currentConversationTopicKey,
    currentConversationWorkItemId,
    detailActions,
    displayGroupNextAction,
    displayGroupSummaryItems,
    displayMessages,
    displayNextBatonAgentId,
    displayRequirementLifecycleSections,
    displayRequirementProgressGroups,
    effectiveActionHint,
    effectiveHeadline,
    effectiveOwnerAgentId,
    effectiveOwnerLabel,
    hasContextSummary,
    hasTechnicalSummary,
    handlePromoteRequirementDraft,
    latestProgressEvent,
    latestStructuredMissionNote,
    missionIsCompleted,
    openRequirementDecisionTicket,
    openRequirementRoom,
    primaryRequirementSurface,
    recentConversationMainlineTitle,
    recentProgressEvents,
    requirementCollaborationSurface,
    resolvedRequirementRoom,
    shouldPersistConversationTruth,
    shouldShowDraftCard,
    showRequirementTeamEntryResolved,
    showSettledRequirementCard,
    singleChatMainlineTitle,
    summaryRecoveryAction,
    syncCompanyCommunication,
  } = missionState;

  const takeoverSessionKey =
    input.conversationStateKey ?? input.targetAgentId ?? input.historyAgentId ?? input.sessionKey ?? null;

  const directChatTakeoverCase = useMemo<TakeoverCase | null>(() => {
    if (!input.activeCompany) {
      return null;
    }
    const matchedRecord =
      (input.activeCompany.takeoverCases ?? []).find((record: TakeoverCaseRecord) => {
        if (record.status === "archived") {
          return false;
        }
        if (takeoverSessionKey && record.sourceSessionKey === takeoverSessionKey) {
          return true;
        }
        if (input.targetAgentId && record.ownerAgentId === input.targetAgentId) {
          return true;
        }
        return Boolean(input.targetAgentId && record.route.includes(`/chat/${input.targetAgentId}`));
      }) ?? null;
    if (!matchedRecord) {
      return null;
    }
    return {
      id: matchedRecord.id,
      title: matchedRecord.title,
      ownerAgentId: matchedRecord.ownerAgentId ?? null,
      ownerLabel: matchedRecord.ownerLabel ?? input.emp?.nickname ?? "当前负责人",
      assigneeAgentId: matchedRecord.assigneeAgentId ?? null,
      assigneeLabel: matchedRecord.assigneeLabel ?? null,
      sourceSessionKey: matchedRecord.sourceSessionKey,
      sourceWorkItemId: matchedRecord.sourceWorkItemId ?? null,
      sourceTopicKey: matchedRecord.sourceTopicKey ?? null,
      sourceDispatchId: matchedRecord.sourceDispatchId ?? null,
      sourceRoomId: matchedRecord.sourceRoomId ?? null,
      failureSummary: matchedRecord.failureSummary,
      recommendedNextAction: matchedRecord.recommendedNextAction,
      route: matchedRecord.route,
      detectedAt: matchedRecord.detectedAt,
      updatedAt: matchedRecord.updatedAt,
      status: matchedRecord.status,
      auditTrail: [...(matchedRecord.auditTrail ?? [])],
    };
  }, [input.activeCompany, input.emp?.nickname, input.targetAgentId, takeoverSessionKey]);

  const takeoverCaseSummary = useMemo(() => {
    if (!input.activeCompany || !takeoverSessionKey) {
      return buildTakeoverCaseSummary(directChatTakeoverCase ? [directChatTakeoverCase] : []);
    }
    const sessionDisplayName =
      input.emp?.nickname ??
      input.groupTitle ??
      input.groupTopic ??
      input.requirementOverview?.currentOwnerLabel ??
      input.targetAgentId ??
      input.sessionKey;
    const cases = buildTakeoverCases({
      company: input.activeCompany,
      sessions: [
        {
          key: takeoverSessionKey,
          agentId: input.targetAgentId,
          updatedAt: input.latestMessageTimestamp ?? input.previewTimestamp ?? input.currentTime,
          displayName: sessionDisplayName,
        },
      ],
      sessionExecutions: new Map([[takeoverSessionKey, input.sessionExecution]]),
      takeoverPacks: input.takeoverPack ? new Map([[takeoverSessionKey, input.takeoverPack]]) : undefined,
      activeRoomRecords: input.activeRoomRecords,
      activeDispatches: input.activeDispatches,
      sessionKeys: new Set([takeoverSessionKey]),
    });
    return buildTakeoverCaseSummary(
      cases.length > 0 ? cases : directChatTakeoverCase ? [directChatTakeoverCase] : [],
    );
  }, [
    directChatTakeoverCase,
    input.activeCompany,
    input.activeDispatches,
    input.activeRoomRecords,
    input.currentTime,
    input.emp?.nickname,
    input.groupTitle,
    input.groupTopic,
    input.latestMessageTimestamp,
    input.previewTimestamp,
    input.requirementOverview?.currentOwnerLabel,
    input.sessionExecution,
    input.sessionKey,
    input.takeoverPack,
    input.targetAgentId,
    takeoverSessionKey,
  ]);

  const { busyCaseId: busyTakeoverCaseId, runTakeoverAction, runTakeoverRedispatch } =
    useTakeoverCaseWorkflow({
      activeCompany: input.activeCompany,
      updateCompany: input.updateCompany,
      providerManifest: input.providerManifest,
      upsertDispatchRecord: input.upsertDispatchRecord,
      surface: "chat",
    });

  const { handleCopyTakeoverPack, handleRecoverCommunication } = useChatCoordinationActions({
    takeoverPack: input.takeoverPack ? { operatorNote: input.takeoverPack.operatorNote } : null,
    activeCompanyId: input.activeCompany?.id ?? null,
    syncCompanyCommunication,
    appendLocalProgressEvent: input.appendLocalProgressEvent,
    setIsSummaryOpen: input.setIsSummaryOpen,
    setRecoveringCommunication: input.setRecoveringCommunication,
  });

  const handleFocusAction = useChatFocusAction({
    activeCompany: input.activeCompany,
    providerManifest: input.providerManifest,
    sessionKey: input.sessionKey,
    targetAgentId: input.targetAgentId,
    currentConversationWorkItemId,
    currentConversationTopicKey,
    focusSummaryOwnerLabel: missionState.focusSummary.ownerLabel,
    isGroup: input.isGroup,
    routeCompanyConflictMessage: input.routeCompanyConflictMessage,
    appendLocalProgressEvent: input.appendLocalProgressEvent,
    upsertDispatchRecord: input.upsertDispatchRecord,
    setActionWatches: input.setActionWatches,
    setRunningFocusActionId: input.setRunningFocusActionId,
    setIsSummaryOpen: input.setIsSummaryOpen,
    handleCopyTakeoverPack,
    handleRecoverCommunication,
    navigateToHref: (href) => input.navigate(appendCompanyScopeToChatRoute(href, input.activeCompany?.id)),
  });

  const isSyncStale = input.companySyncStale || input.sessionSyncStale;
  const syncStaleDetail = input.sessionSyncError ?? input.companySyncError ?? null;

  useEffect(() => {
    if (!conversationDraftRequirement || !shouldShowDraftCard) {
      return;
    }
    const draftKey = `${input.conversationStateKey ?? "none"}:${conversationDraftRequirement.updatedAt}:${conversationDraftRequirement.state}`;
    if (input.lastTrackedDraftKeyRef.current === draftKey) {
      return;
    }
    input.lastTrackedDraftKeyRef.current = draftKey;
    trackChatRequirementMetric({
      companyId: input.activeCompany?.id ?? null,
      conversationId: input.conversationStateKey,
      requirementId: input.persistedWorkItem?.id ?? conversationMissionRecord?.id ?? null,
      name: "draft_requirement_shown",
      metadata: { state: conversationDraftRequirement.state },
    });
  }, [
    conversationDraftRequirement,
    conversationMissionRecord?.id,
    input.activeCompany?.id,
    input.conversationStateKey,
    input.lastTrackedDraftKeyRef,
    input.persistedWorkItem?.id,
    shouldShowDraftCard,
  ]);

  useEffect(() => {
    if (!conversationDraftRequirement) {
      return;
    }
    if (
      !["promoted_auto", "active_requirement"].includes(conversationDraftRequirement.state) ||
      conversationDraftRequirement.promotionReason === "manual_confirmation"
    ) {
      return;
    }
    const promotionKey = `${input.conversationStateKey ?? "none"}:${conversationDraftRequirement.updatedAt}:${conversationDraftRequirement.promotionReason ?? "auto"}`;
    if (input.lastTrackedAutoPromotionRef.current === promotionKey) {
      return;
    }
    input.lastTrackedAutoPromotionRef.current = promotionKey;
    trackChatRequirementMetric({
      companyId: input.activeCompany?.id ?? null,
      conversationId: input.conversationStateKey,
      requirementId: input.persistedWorkItem?.id ?? conversationMissionRecord?.id ?? null,
      name: "draft_requirement_promoted_auto",
      metadata: { reason: conversationDraftRequirement.promotionReason ?? "auto" },
    });
  }, [
    conversationDraftRequirement,
    conversationMissionRecord?.id,
    input.activeCompany?.id,
    input.conversationStateKey,
    input.lastTrackedAutoPromotionRef,
    input.persistedWorkItem?.id,
  ]);

  useEffect(() => {
    if (!isSyncStale) {
      input.lastTrackedStaleRef.current = null;
      return;
    }
    const staleKey = `${input.conversationStateKey ?? "none"}:${syncStaleDetail ?? "stale"}`;
    if (input.lastTrackedStaleRef.current === staleKey) {
      return;
    }
    input.lastTrackedStaleRef.current = staleKey;
    trackChatRequirementMetric({
      companyId: input.activeCompany?.id ?? null,
      conversationId: input.conversationStateKey,
      requirementId: input.persistedWorkItem?.id ?? conversationMissionRecord?.id ?? null,
      name: "sync_stale_warning_shown",
      metadata: { detail: syncStaleDetail ?? "stale" },
    });
  }, [
    conversationMissionRecord?.id,
    input.activeCompany?.id,
    input.conversationStateKey,
    input.lastTrackedStaleRef,
    input.persistedWorkItem?.id,
    isSyncStale,
    syncStaleDetail,
  ]);

  useEffect(() => {
    input.setSessionSyncStale(false);
    input.setSessionSyncError(null);
  }, [input.activeCompany?.id, input.sessionKey, input.setSessionSyncError, input.setSessionSyncStale]);

  useEffect(() => {
    if (
      !input.authorityBackedState ||
      !input.activeCompany ||
      !primaryRequirementSurface?.aggregateId ||
      primaryRequirementSurface.roomStatus === "ready"
    ) {
      return;
    }
    const ensureKey = `${input.activeCompany.id}:${primaryRequirementSurface.aggregateId}`;
    if (input.lastEnsuredRequirementRoomRef.current === ensureKey) {
      return;
    }
    input.lastEnsuredRequirementRoomRef.current = ensureKey;
    input.ensureRequirementRoomForAggregate(primaryRequirementSurface.aggregateId);
  }, [
    input.activeCompany,
    input.authorityBackedState,
    input.ensureRequirementRoomForAggregate,
    input.lastEnsuredRequirementRoomRef,
    primaryRequirementSurface?.aggregateId,
    primaryRequirementSurface?.roomStatus,
  ]);

  useEffect(() => {
    if (!input.activeCompany || !primaryRequirementSurface?.aggregate || !resolvedRequirementRoom) {
      return;
    }
    const backfilledRoom = backfillRequirementRoomRecord({
      company: input.activeCompany,
      aggregate: primaryRequirementSurface.aggregate,
      workItem: primaryRequirementSurface.workItem,
      room: resolvedRequirementRoom,
      dispatches: input.activeDispatches,
      requests: input.activeCompany.requests ?? [],
      evidence: input.activeRequirementEvidence,
      snapshots: input.companySessionSnapshots.filter((snapshot: RequirementSessionSnapshot) =>
        primaryRequirementSurface.roomMemberIds.includes(snapshot.agentId),
      ),
    });
    const existingSignature = buildRequirementRoomRecordSignature(resolvedRequirementRoom);
    const nextSignature = buildRequirementRoomRecordSignature(backfilledRoom);
    if (
      nextSignature === existingSignature ||
      nextSignature === input.lastSyncedRoomSignatureRef.current
    ) {
      return;
    }
    input.lastSyncedRoomSignatureRef.current = nextSignature;
    input.upsertRoomRecord(backfilledRoom);
  }, [
    input.activeCompany,
    input.activeDispatches,
    input.activeRequirementEvidence,
    input.companySessionSnapshots,
    input.lastSyncedRoomSignatureRef,
    input.upsertRoomRecord,
    primaryRequirementSurface,
    resolvedRequirementRoom,
  ]);

  useChatPreviewPersistence({
    activeCompanyId: input.activeCompany?.id ?? null,
    sessionKey: input.sessionKey,
    isArchiveView: input.isArchiveView,
    handoffPreview: input.handoffPreview,
    requestPreview: input.requestPreview,
    upsertHandoff: input.upsertHandoff,
    upsertRequest: input.upsertRequest,
  });

  const {
    canShowSessionHistory,
    archiveSectionNotice,
    shouldRunCompanySync,
    companySyncIntervalMs,
    displayItems,
    hiddenDisplayItemCount,
    visibleDisplayItems,
    progressGroupSummary,
    latestProgressDisplay,
    actionWatchCards,
    teamMemberCards,
    emptyStateText,
  } = useChatPageSurface({
    authorityBackedState: input.authorityBackedState,
    isGroup: input.isGroup,
    sessionKey: input.sessionKey,
    recentAgentSessionsLength: input.recentAgentSessions.length,
    historyRoundItemsLength: input.historyRoundItems.length,
    archiveHistoryNotice: input.archiveHistoryNotice,
    hasActiveCompany: Boolean(input.activeCompany),
    connected: input.connected,
    isPageVisible: input.isPageVisible,
    isArchiveView: input.isArchiveView,
    isSummaryOpen: input.isSummaryOpen,
    actionWatches: input.actionWatches,
    isCeoSession: input.isCeoSession,
    effectiveRequirementRoom: input.effectiveRequirementRoom,
    roomBoundWorkItem: input.roomBoundWorkItem,
    persistedWorkItem: input.persistedWorkItem,
    messages: displayMessages,
    displayWindowSize: input.displayWindowSize,
    displayRequirementProgressGroups,
    latestProgressEvent,
    runningFocusActionId: input.runningFocusActionId,
    requirementTeam: input.requirementTeam,
    buildTeamAdjustmentAction,
  });

  const latestDisplayMissionNote = useMemo(
    () => findLatestDisplayMissionNote(displayItems),
    [displayItems],
  );
  const latestDisplayMissionBlocker = useMemo(
    () => extractMissionBlocker(latestDisplayMissionNote?.rawText),
    [latestDisplayMissionNote],
  );
  const headerSettledRequirementSummary = findMeaningfulMainlineSummary([
    latestDisplayMissionNote?.summary,
    input.isGroup ? latestStructuredMissionNote?.summary : null,
    missionState.settledRequirementSummary,
    chatSurfaceSummary,
  ]) ?? missionState.settledRequirementSummary;
  const headerDisplayGroupNextAction = findMeaningfulMainlineSummary([
    latestDisplayMissionNote?.nextAction,
    input.isGroup ? latestStructuredMissionNote?.nextAction : null,
    displayGroupNextAction,
    chatSurfaceSettledRequirementNextAction,
  ]) ?? displayGroupNextAction;
  const headerMissionHeadline = input.isGroup
    ? recentConversationMainlineTitle ?? chatSurfaceHeadline
    : buildSingleChatMissionHeadline({
        taskTitle: singleChatMainlineTitle,
        blocker: latestDisplayMissionBlocker,
        step: chatSurfaceStepLabel,
        actorLabel: input.emp?.nickname ?? null,
        fallbackHeadline: chatSurfaceHeadline,
      });
  const headerGroupSummaryItems = input.isGroup
    ? latestDisplayMissionBlocker
      ? [
          { label: "当前阻塞", value: latestDisplayMissionBlocker },
          ...displayGroupSummaryItems.filter(
            (item: { label: string; value: string }) =>
              item.label !== "当前阻塞" && item.label !== "当前阶段",
          ),
        ]
      : displayGroupSummaryItems
    : [
        latestDisplayMissionBlocker
          ? { label: "当前阻塞", value: latestDisplayMissionBlocker }
          : null,
        !latestDisplayMissionBlocker && chatSurfaceStepLabel
          ? { label: "当前步骤", value: chatSurfaceStepLabel }
          : null,
      ].filter((value): value is { label: string; value: string } => Boolean(value));
  const companyEmployees = input.activeCompany?.employees ?? EMPTY_EMPLOYEES;

  const chatSessionRuntime = useMemo(
    () => ({
      activeCompany: input.activeCompany,
      agentId: input.agentId,
      archiveId: input.archiveId,
      activeArchivedRound: input.activeArchivedRound,
      authorityBackedState: input.authorityBackedState,
      companyRouteReady: input.companyRouteReady,
      connected: input.connected,
      routeCompanyConflictMessage: input.routeCompanyConflictMessage,
      groupTopicKey: input.groupTopicKey,
      groupTitle: input.groupTitle,
      historyAgentId: input.historyAgentId,
      isArchiveView: input.isArchiveView,
      isGroup: input.isGroup,
      providerId: input.providerId,
      persistedWorkItemStartedAt: input.persistedWorkItem?.startedAt,
      targetAgentId: input.targetAgentId,
      effectiveOwnerAgentId,
      effectiveGroupSessionKey: input.effectiveGroupSessionKey,
      effectiveRequirementRoom: input.effectiveRequirementRoom,
      effectiveRequirementRoomSnapshots: input.effectiveRequirementRoomSnapshots,
      requirementRoomSessions: input.requirementRoomSessions,
      requirementRoomSessionKeys: input.requirementRoomSessionKeys,
      requirementRoomTargetAgentIds: input.requirementRoomTargetAgentIds,
      groupWorkItemId: input.groupWorkItemId,
      sessionKey: input.sessionKey,
      productRoomId: input.productRoomId,
      activeRoomBindings: input.activeRoomBindings,
      activeDispatches: input.activeDispatches,
      currentConversationWorkItemId,
      currentConversationTopicKey,
      lastSyncedRoomSignatureRef: input.lastSyncedRoomSignatureRef,
      streamTextRef: input.streamTextRef,
      activeRunIdRef: input.activeRunIdRef,
      pendingGenerationStartedAtRef: input.pendingGenerationStartedAtRef,
      setActiveRunId: input.setActiveRunId,
      setLoading: input.setLoading,
      setSessionSyncStale: input.setSessionSyncStale,
      setSessionKey: input.setSessionKey,
      setMessages: input.setMessages,
      setIsGenerating: input.setIsGenerating,
      updateStreamText: input.updateStreamText,
      restoreGeneratingState: input.restoreGeneratingState,
      clearGeneratingState: input.clearGeneratingState,
      upsertRoomRecord: input.upsertRoomRecord,
      upsertRoomConversationBindings: input.upsertRoomConversationBindings,
      appendRoomMessages: input.appendRoomMessages,
      upsertDispatchRecord: input.upsertDispatchRecord,
      upsertTask: input.upsertTask,
    }),
    [
      currentConversationTopicKey,
      currentConversationWorkItemId,
      effectiveOwnerAgentId,
      input.activeArchivedRound,
      input.activeCompany,
      input.activeDispatches,
      input.activeRoomBindings,
      input.agentId,
      input.appendRoomMessages,
      input.archiveId,
      input.authorityBackedState,
      input.clearGeneratingState,
      input.companyRouteReady,
      input.connected,
      input.effectiveGroupSessionKey,
      input.effectiveRequirementRoom,
      input.effectiveRequirementRoomSnapshots,
      input.groupTitle,
      input.groupTopicKey,
      input.groupWorkItemId,
      input.historyAgentId,
      input.isArchiveView,
      input.isGroup,
      input.productRoomId,
      input.providerId,
      input.persistedWorkItem?.startedAt,
      input.requirementRoomSessionKeys,
      input.requirementRoomSessions,
      input.requirementRoomTargetAgentIds,
      input.restoreGeneratingState,
      input.routeCompanyConflictMessage,
      input.sessionKey,
      input.setActiveRunId,
      input.setSessionSyncStale,
      input.targetAgentId,
      input.updateStreamText,
      input.upsertDispatchRecord,
      input.upsertRoomConversationBindings,
      input.upsertRoomRecord,
      input.upsertTask,
    ],
  );

  useEffect(() => {
    if (!input.isGenerating) {
      return;
    }
    const pendingSince = input.pendingGenerationStartedAtRef.current;
    if (!pendingSince) {
      return;
    }
    const hasCompletedReply = input.messages.some((message: ChatMessage) => {
      const timestamp = typeof message.timestamp === "number" ? message.timestamp : 0;
      return timestamp >= pendingSince && (message.role === "assistant" || message.role === "system");
    });
    if (!hasCompletedReply) {
      return;
    }
    const timer = window.setTimeout(() => {
      input.clearGeneratingState();
    }, 0);
    return () => {
      window.clearTimeout(timer);
    };
  }, [input.clearGeneratingState, input.isGenerating, input.messages, input.pendingGenerationStartedAtRef]);

  useChatRuntimeEffects({
    agentId: input.agentId,
    shouldRunCompanySync,
    companySyncIntervalMs,
    companySessionSnapshotsRef: input.companySessionSnapshotsRef,
    setHasBootstrappedCompanySync: input.setHasBootstrappedCompanySync,
    setCompanySyncStale: input.setCompanySyncStale,
    connected: input.connected,
    isPageVisible: input.isPageVisible,
    actionWatches: input.actionWatches,
    appendLocalProgressEvent: input.appendLocalProgressEvent,
    setActionWatches: input.setActionWatches,
    syncCompanyCommunication,
    shouldAutoScrollRef: input.shouldAutoScrollRef,
    forceScrollOnNextUpdateRef: input.forceScrollOnNextUpdateRef,
    programmaticScrollRef: input.programmaticScrollRef,
    userScrollLockRef: input.userScrollLockRef,
    lastScrollTopRef: input.lastScrollTopRef,
    lockedScrollTopRef: input.lockedScrollTopRef,
    chatSessionRuntime,
  });

  useEffect(() => {
    input.syncAutoScrollPosition();
  }, [input.messages, input.syncAutoScrollPosition]);

  useEffect(() => {
    return () => {
      if (input.autoScrollFrameRef.current !== null) {
        window.cancelAnimationFrame(input.autoScrollFrameRef.current);
      }
    };
  }, [input.autoScrollFrameRef]);

  const {
    handleClearSession,
    navigateToCurrentConversation,
    navigateToArchivedRound,
    resetConversationView,
  } = useChatSessionReset({
    sessionKey: input.sessionKey,
    messages: input.messages,
    activeCompany: input.activeCompany,
    isArchiveView: input.isArchiveView,
    currentConversationWorkItemId,
    isGroup: input.isGroup,
    effectiveRequirementRoom: input.effectiveRequirementRoom,
    groupWorkItemId: input.groupWorkItemId,
    activeConversationMission,
    persistedWorkItem: input.persistedWorkItem,
    historyAgentId: input.historyAgentId,
    currentActorAgentId: input.emp?.agentId ?? input.targetAgentId,
    currentActorLabel: input.emp?.nickname ?? "当前负责人",
    providerId: input.providerId,
    conversationStateKey: input.conversationStateKey,
    clearConversationState: input.clearConversationState,
    upsertRoundRecord: input.upsertRoundRecord,
    setMessages: input.setMessages,
    setLoading: input.setLoading,
    setLocalProgressEvents: input.setLocalProgressEvents,
    setActionWatches: input.setActionWatches,
    setIsSummaryOpen: input.setIsSummaryOpen,
    setIsTechnicalSummaryOpen: input.setIsTechnicalSummaryOpen,
    beginGeneratingState: input.beginGeneratingState,
    clearGeneratingState: input.clearGeneratingState,
    incrementHistoryRefreshNonce: input.incrementHistoryRefreshNonce,
    navigate: input.navigate,
    pathname: input.location.pathname,
    search: input.location.search,
  });

  const {
    deletingHistorySessionKey,
    deletingArchiveId,
    restoringArchiveId,
    handleDeleteRecentSession,
    handleDeleteArchivedRound,
    handleRestoreArchivedRound,
  } = useChatHistoryActions({
    sessionKey: input.sessionKey,
    archiveId: input.archiveId,
    historyAgentId: input.historyAgentId,
    conversationStateKey: input.conversationStateKey,
    currentActorLabel: input.emp?.nickname ?? "当前负责人",
    supportsSessionArchiveRestore: input.supportsSessionArchiveRestore,
    productArchivedRounds: input.productArchivedRounds,
    setRecentAgentSessions: input.setRecentAgentSessions,
    setRecentArchivedRounds: input.setRecentArchivedRounds,
    deleteRoundRecord: input.deleteRoundRecord,
    setConversationCurrentWorkKey: input.setConversationCurrentWorkKey,
    incrementHistoryRefreshNonce: input.incrementHistoryRefreshNonce,
    navigateToCurrentConversation,
    resetConversationView,
  });

  const handleSend = useChatSend({
    activeCompany: input.activeCompany,
    providerManifest: input.providerManifest,
    providerId: input.providerId,
    sessionKey: input.sessionKey,
    isArchiveView: input.isArchiveView,
    isGroup: input.isGroup,
    sending: input.sending,
    routeCompanyConflictMessage: input.routeCompanyConflictMessage,
    attachments: input.attachments,
    thinkingLevel: input.isGroup ? undefined : input.thinkingLevel,
    roomBroadcastMode: input.roomBroadcastMode,
    targetAgentId: input.targetAgentId,
    displayNextBatonAgentId,
    requirementRoomTargetAgentIds: input.requirementRoomTargetAgentIds,
    requirementTeamOwnerAgentId: input.requirementTeam?.ownerAgentId,
    effectiveRequirementRoom: input.effectiveRequirementRoom,
    currentConversationWorkItemId,
    currentConversationTopicKey,
    productRoomId: input.productRoomId,
    groupTitle: input.groupTitle,
    handleClearSession,
    markScrollIntent: input.markScrollIntent,
    beginGeneratingState: input.beginGeneratingState,
    clearGeneratingState: input.clearGeneratingState,
    setAttachments: input.setAttachments,
    setSending: input.setSending,
    setRoomBroadcastMode: input.setRoomBroadcastMode,
    setMessages: input.setMessages,
    upsertRoomConversationBindings: input.upsertRoomConversationBindings,
    upsertDispatchRecord: input.upsertDispatchRecord,
    appendRoomMessages: input.appendRoomMessages,
  });

  const handleResolveRequirementDecision = useCallback(
    async (optionId: string) => {
      if (!openRequirementDecisionTicket) {
        return;
      }
      const option =
        openRequirementDecisionTicket.options.find((candidate: { id: string }) => candidate.id === optionId) ?? null;
      if (!option) {
        return;
      }
      const timestamp = Date.now();
      input.setDecisionSubmittingOptionId(optionId);
      input.resolveDecisionTicket({
        ticketId: openRequirementDecisionTicket.id,
        optionId: option.id,
        resolution: option.summary ?? option.label,
        timestamp,
      });
      const resolutionMessage = buildRequirementDecisionResolutionMessage({
        ticket: openRequirementDecisionTicket,
        optionId: option.id,
      });
      if (resolutionMessage) {
        const sent = await handleSend(resolutionMessage);
        if (!sent) {
          toast.warning("已记录你的决策", "状态已更新，但通知 CEO/需求房失败了。你可以稍后重试发送。");
        }
      }
      input.setDecisionSubmittingOptionId(null);
    },
    [handleSend, input, openRequirementDecisionTicket],
  );

  const handleOpenRequirementTeam = useCallback(() => {
    trackChatRequirementMetric({
      companyId: input.activeCompany?.id ?? null,
      conversationId: input.conversationStateKey,
      requirementId: input.persistedWorkItem?.id ?? conversationMissionRecord?.id ?? null,
      name: "requirement_room_opened_from_ceo_chat",
    });
    openRequirementRoom();
  }, [
    conversationMissionRecord?.id,
    input.activeCompany?.id,
    input.conversationStateKey,
    input.persistedWorkItem?.id,
    openRequirementRoom,
  ]);

  return {
    actionWatchCards,
    archiveSectionNotice,
    canShowSessionHistory,
    chatSurfaceActionHint,
    chatSurfaceNextBatonAgentId,
    chatSurfaceNextBatonLabel,
    chatSurfaceOwnerLabel,
    chatSurfaceStage,
    chatSurfaceStatusLabel,
    chatSurfaceSummary,
    companyEmployees,
    deletingArchiveId,
    deletingHistorySessionKey,
    detailActions,
    directChatTakeoverCase,
    displayItems,
    emptyStateText,
    handleClearSession,
    handleCopyTakeoverPack,
    handleDeleteArchivedRound,
    handleDeleteRecentSession,
    handleFocusAction,
    handleOpenRequirementTeam,
    handleRecoverCommunication,
    handleResolveRequirementDecision,
    handleRestoreArchivedRound,
    handleSend,
    headerDisplayGroupNextAction,
    headerGroupSummaryItems,
    headerMissionHeadline,
    headerSettledRequirementSummary,
    hiddenDisplayItemCount,
    isSyncStale,
    latestProgressDisplay,
    navigateToArchivedRound,
    navigateToCurrentConversation,
    progressGroupSummary,
    recentProgressEvents,
    restoringArchiveId,
    runTakeoverAction,
    runTakeoverRedispatch,
    syncStaleDetail,
    takeoverCaseSummary,
    teamMemberCards,
    busyTakeoverCaseId,
    collaborationLifecycle: missionState.collaborationLifecycle,
    visibleDisplayItems,
  };
}
