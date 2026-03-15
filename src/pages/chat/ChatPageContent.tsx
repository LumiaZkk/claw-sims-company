import {
  useCallback,
  useEffect,
  useRef,
  useState,
} from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { useCompanyShellCommands } from "../../application/company/shell";
import { type RequirementSessionSnapshot } from "../../domain/mission/requirement-snapshot";
import { ChatPageBody } from "./components/ChatPageBody";
import { useChatCompanySnapshots } from "./hooks/useChatCompanySnapshots";
import { useChatDisplayState } from "./hooks/useChatDisplayState";
import { useChatSessionHistory } from "./hooks/useChatSessionHistory";
import { useChatPanelState } from "./hooks/useChatPanelState";
import { useChatSignalState } from "./hooks/useChatSignalState";
import { useChatSessionContext } from "./hooks/useChatSessionContext";
import { useChatWorkspaceViewModel } from "./hooks/useChatWorkspaceViewModel";
import { useChatConversationSurface } from "./hooks/useChatConversationSurface";
import { useChatDragAndDrop } from "./hooks/useChatDragAndDrop";
import { useChatPageMissionState } from "./hooks/useChatPageMissionState";
import { useChatPagePresentationState } from "./hooks/useChatPagePresentationState";
import { useChatUploads } from "./hooks/useChatUploads";
import {
  gateway,
  type ChatMessage,
} from "../../application/gateway";
import { useGatewayStore } from "../../application/gateway";
import { usePageVisibility } from "../../lib/use-page-visibility";
import { useChatRouteCompanyState } from "./hooks/useChatRouteCompanyState";
import {
  clearLiveChatSession,
  type LiveChatSessionState,
  upsertLiveChatSession,
} from "../../application/chat/live-session-cache";

export function ChatPageScreen() {
  const navigate = useNavigate();
  const location = useLocation();
  const {
    config,
    activeCompany,
    authorityBackedState,
    activeRoomRecords,
    activeMissionRecords,
    activeConversationStates,
    activeWorkItems,
    activeRequirementAggregates,
    activeRequirementEvidence,
    activeDecisionTickets,
    primaryRequirementId,
    activeRoundRecords,
    activeArtifacts,
    activeDispatches,
    activeRoomBindings,
    activeAgentRuntime,
    updateCompany,
    upsertTask,
    upsertHandoff,
    upsertRequest,
    upsertRoomRecord,
    upsertRoundRecord,
    deleteRoundRecord,
    appendRoomMessages,
    ensureRequirementRoomForAggregate,
    upsertRoomConversationBindings,
    upsertMissionRecord,
    setConversationCurrentWorkKey,
    setConversationDraftRequirement,
    clearConversationState,
    upsertWorkItemRecord,
    resolveDecisionTicket,
    upsertDispatchRecord,
    replaceDispatchRecords,
  } = useChatWorkspaceViewModel();
  const { switchCompany } = useCompanyShellCommands();
  const providerId = useGatewayStore((state) => state.providerId);
  const connected = useGatewayStore((state) => state.connected);
  const providerCapabilities = useGatewayStore((state) => state.capabilities);
  const providerManifest = useGatewayStore((state) => state.manifest);
  const isPageVisible = usePageVisibility();

  const [sessionMessages, setMessages] = useState<ChatMessage[]>([]);
  const [sessionKey, setSessionKey] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  const [runningFocusActionId, setRunningFocusActionId] = useState<string | null>(null);
  const [recoveringCommunication, setRecoveringCommunication] = useState(false);
  const [sessionSyncStale, setSessionSyncStale] = useState(false);
  const [sessionSyncError, setSessionSyncError] = useState<string | null>(null);
  const streamTextRef = useRef<string | null>(null);
  const activeRunIdRef = useRef<string | null>(null);
  const pendingGenerationStartedAtRef = useRef<number | null>(null);
  const [activeRunId, setActiveRunId] = useState<string | null>(null);
  const companySessionSnapshotsRef = useRef<RequirementSessionSnapshot[]>([]);
  const scrollContainerRef = useRef<HTMLElement | null>(null);
  const shouldAutoScrollRef = useRef(true);
  const forceScrollOnNextUpdateRef = useRef(false);
  const programmaticScrollRef = useRef(false);
  const userScrollLockRef = useRef(false);
  const lastScrollTopRef = useRef(0);
  const lastEnsuredRequirementRoomRef = useRef<string | null>(null);
  const lockedScrollTopRef = useRef<number | null>(null);
  const lastSyncedRoomSignatureRef = useRef<string | null>(null);
  const lastTrackedDraftKeyRef = useRef<string | null>(null);
  const lastTrackedAutoPromotionRef = useRef<string | null>(null);
  const lastTrackedStaleRef = useRef<string | null>(null);
  const [composerPrefill, setComposerPrefill] = useState<{ id: string | number; text: string } | null>(null);
  const [decisionSubmittingOptionId, setDecisionSubmittingOptionId] = useState<string | null>(null);
  const [thinkingLevel, setThinkingLevel] = useState("adaptive");

  const [attachments, setAttachments] = useState<{ mimeType: string; dataUrl: string }[]>([]);
  const [currentTime, setCurrentTime] = useState(() => Date.now());
  const fileInputRef = useRef<HTMLInputElement>(null);

  const endRef = useRef<HTMLDivElement>(null);
  const autoScrollFrameRef = useRef<number | null>(null);

  const updateStreamText = useCallback((value: string | null) => {
    streamTextRef.current = value;
  }, []);

  const {
    agentId,
    archiveId,
    groupMembers,
    groupTitle,
    groupTopic,
    groupTopicKey,
    groupWorkItemId,
    historyAgentId,
    isArchiveView,
    isGroup,
    productRoomId,
    routeComposerPrefill,
    routeCompanyConflictMessage,
    routeRoomId,
    routeWorkItemId,
    companyRouteReady,
    activeRequirementRoom,
    activeConversationState,
    effectiveGroupSessionKey,
    messages,
    targetAgentId,
    conversationStateKey: groupConversationStateKey,
  } = useChatRouteCompanyState({
    authorityBackedState,
    config,
    activeCompanyId: activeCompany?.id ?? null,
    activeRoomRecords,
    activeConversationStates,
    activeRoomBindings,
    sessionMessages,
    switchCompany,
    navigate,
    location,
  });

  const restoreGeneratingState = useCallback(
    (liveSession: Pick<LiveChatSessionState, "runId" | "streamText" | "isGenerating" | "startedAt"> | null) => {
      activeRunIdRef.current = liveSession?.runId ?? null;
      setActiveRunId(liveSession?.runId ?? null);
      pendingGenerationStartedAtRef.current = liveSession?.startedAt ?? null;
      updateStreamText(liveSession?.streamText ?? null);
      setIsGenerating(Boolean(liveSession?.isGenerating));
    },
    [updateStreamText],
  );

  const clearGeneratingState = useCallback(
    (options?: { preserveRuntime?: boolean }) => {
      activeRunIdRef.current = null;
      setActiveRunId(null);
      pendingGenerationStartedAtRef.current = null;
      updateStreamText(null);
      setIsGenerating(false);
      if (!options?.preserveRuntime) {
        clearLiveChatSession(activeCompany?.id, sessionKey);
      }
    },
    [activeCompany?.id, sessionKey, updateStreamText],
  );

  const beginGeneratingState = useCallback(
    (
      startedAt: number,
      options?: { runId?: string | null; streamText?: string | null; persist?: boolean },
    ) => {
      const nextRunId = options && "runId" in options ? options.runId ?? null : activeRunIdRef.current;
      const nextStreamText =
        options && "streamText" in options ? options.streamText ?? null : streamTextRef.current;
      activeRunIdRef.current = nextRunId;
      setActiveRunId(nextRunId);
      pendingGenerationStartedAtRef.current = startedAt;
      updateStreamText(nextStreamText ?? null);
      setIsGenerating(true);
      if (options?.persist === false) {
        return;
      }
      upsertLiveChatSession(activeCompany?.id, sessionKey, {
        sessionKey: sessionKey ?? "",
        agentId: targetAgentId,
        runId: nextRunId,
        streamText: nextStreamText ?? null,
        isGenerating: true,
        startedAt,
        updatedAt: Date.now(),
      });
    },
    [activeCompany?.id, sessionKey, targetAgentId, updateStreamText],
  );
  const conversationStateKey = isGroup
    ? groupConversationStateKey
    : sessionKey ?? historyAgentId ?? targetAgentId ?? null;

  const {
    companySessionSnapshots,
    companySyncError,
    companySyncStale,
    setCompanySessionSnapshots,
    setHasBootstrappedCompanySync,
    setCompanySyncStale,
  } = useChatCompanySnapshots(activeCompany?.id ?? null);
  const {
    displayWindowSize,
    roomBroadcastMode,
    expandDisplayWindow,
    setRoomBroadcastMode,
  } = useChatDisplayState({
    agentId,
    archiveId,
    historyAgentId,
    productRoomId: routeRoomId ?? routeWorkItemId ?? null,
    sessionKey,
  });
  const {
    isHistoryMenuOpen,
    isSummaryOpen,
    isTechnicalSummaryOpen,
    summaryPanelView,
    setIsHistoryMenuOpen,
    setIsSummaryOpen,
    setIsTechnicalSummaryOpen,
    setSummaryPanelView,
    openSummaryPanel,
  } = useChatPanelState(sessionKey);
  const {
    recentAgentSessions,
    recentArchivedRounds,
    archiveHistoryNotice,
    historyLoading,
    incrementHistoryRefreshNonce,
    setRecentAgentSessions,
    setRecentArchivedRounds,
  } = useChatSessionHistory({
    connected,
    historyAgentId,
    isGroup,
    isHistoryMenuOpen,
    isArchiveView,
    sessionKey,
    supportsSessionHistory: providerCapabilities.sessionHistory,
    supportsSessionArchives: providerCapabilities.sessionArchives,
  });
  const {
    localProgressEvents,
    actionWatches,
    setLocalProgressEvents,
    setActionWatches,
    appendLocalProgressEvent,
  } = useChatSignalState(sessionKey);

  const {
    uploadingFile,
    processTextFileUpload,
    processImageFile,
    handleFileSelect,
  } = useChatUploads({
    isGroup,
    groupMembers,
    agentId,
    setComposerPrefill,
    setAttachments,
  });
  const { isDragging, handleDragOver, handleDragLeave, handleDrop } = useChatDragAndDrop({
    processTextFileUpload,
    processImageFile,
  });

  const isNearBottom = useCallback((element: HTMLElement | null): boolean => {
    if (!element) {
      return true;
    }
    const distanceToBottom = element.scrollHeight - element.scrollTop - element.clientHeight;
    return distanceToBottom <= 120;
  }, []);

  const markScrollIntent = useCallback((mode: "preserve" | "follow" = "preserve") => {
    if (mode === "follow") {
      userScrollLockRef.current = false;
      shouldAutoScrollRef.current = true;
      forceScrollOnNextUpdateRef.current = true;
      lockedScrollTopRef.current = null;
      return;
    }

    shouldAutoScrollRef.current = isNearBottom(scrollContainerRef.current);
    forceScrollOnNextUpdateRef.current = false;
  }, [isNearBottom]);

  const setProgrammaticScrollLock = useCallback((locked: boolean) => {
    programmaticScrollRef.current = locked;
    if (locked) {
      requestAnimationFrame(() => {
        programmaticScrollRef.current = false;
      });
    }
  }, []);

  const syncAutoScrollPosition = useCallback(() => {
    if (userScrollLockRef.current && scrollContainerRef.current) {
      const lockedTop = lockedScrollTopRef.current;
      if (typeof lockedTop === "number" && Math.abs(scrollContainerRef.current.scrollTop - lockedTop) > 2) {
        setProgrammaticScrollLock(true);
        scrollContainerRef.current.scrollTop = lockedTop;
      }
      return;
    }

    if (forceScrollOnNextUpdateRef.current || (shouldAutoScrollRef.current && !userScrollLockRef.current)) {
      setProgrammaticScrollLock(true);
      if (autoScrollFrameRef.current !== null) {
        window.cancelAnimationFrame(autoScrollFrameRef.current);
      }
      autoScrollFrameRef.current = window.requestAnimationFrame(() => {
        autoScrollFrameRef.current = null;
        endRef.current?.scrollIntoView({ behavior: "auto" });
      });
      forceScrollOnNextUpdateRef.current = false;
      shouldAutoScrollRef.current = true;
    }
  }, [setProgrammaticScrollLock]);

  useEffect(() => {
    companySessionSnapshotsRef.current = companySessionSnapshots;
  }, [companySessionSnapshots]);

  useEffect(() => {
    const timer = window.setInterval(() => {
      setCurrentTime(Date.now());
    }, 60_000);
    return () => window.clearInterval(timer);
  }, []);
  useEffect(() => {
    if (!connected || !sessionKey || isArchiveView || isGroup) {
      return;
    }

    let cancelled = false;
    void gateway
      .getChatHistory(sessionKey, 1)
      .then((history) => {
        if (cancelled) {
          return;
        }
        const nextLevel =
          typeof history.thinkingLevel === "string" && history.thinkingLevel.trim().length > 0
            ? history.thinkingLevel.trim()
            : "adaptive";
        setThinkingLevel(nextLevel);
      })
      .catch(() => {});

    return () => {
      cancelled = true;
    };
  }, [connected, isArchiveView, isGroup, sessionKey]);
  const supportsSessionHistory = providerCapabilities.sessionHistory;
  const supportsSessionArchiveRestore = providerCapabilities.sessionArchiveRestore;
  useEffect(() => {
    lastSyncedRoomSignatureRef.current = null;
  }, [activeCompany?.id, sessionKey, archiveId]);
  const lastRouteConflictRef = useRef<string | null>(null);
  useEffect(() => {
    if (!routeCompanyConflictMessage || lastRouteConflictRef.current === routeCompanyConflictMessage) {
      return;
    }
    lastRouteConflictRef.current = routeCompanyConflictMessage;
    toast.error("聊天路由冲突", routeCompanyConflictMessage);
  }, [routeCompanyConflictMessage]);
  const {
    activeArchivedRound,
    ceoSurface,
    handoffPreview,
    historyRoundItems,
    historySessionPresentations,
    isCeoSession,
    isFreshConversation,
    isRequirementBootstrapPending,
    latestMessageTimestamp,
    localSlaFallbackAlerts,
    nextOpenTaskStepAgentId,
    nextOpenTaskStepLabel,
    orgAdvisor,
    previewTimestamp,
    productArchivedRounds,
    relatedSlaAlerts,
    requestHealth,
    requestPreview,
    requirementRoomMentionCandidates,
    requirementRoomSessionKeys,
    requirementRoomSessions,
    requirementRoomSnapshotAgentIds,
    requirementRoomSnapshots,
    requirementRoomTargetAgentIds,
    sessionExecution,
    structuredTaskPreview,
    summaryAlertCount,
    takeoverPack,
    targetEmployee: emp,
  } = useChatSessionContext({
    activeCompany,
    activeConversationState,
    activeAgentRuntime,
    activeRequirementRoom,
    activeRoomBindings,
    activeRoomRecords,
    activeRoundRecords,
    archiveHistoryNotice,
    archiveId,
    companySessionSnapshots,
    connected,
    currentTime,
    effectiveGroupSessionKey,
    groupMembers,
    groupTitle,
    groupWorkItemId,
    historyAgentId,
    isArchiveView,
    isGenerating,
    isGroup,
    loading,
    messages,
    recentAgentSessions,
    recentArchivedRounds,
    routeRoomId,
    sessionKey,
    targetAgentId,
  });
  const {
    currentConversationRequirementHint,
    preferredConversationTopicKey,
    requirementOverview,
    requirementProgressGroups,
    latestDirectTurnSummary,
    ceoReplyExplicitlyRequestsNewTask,
    preferredConversationWorkKey,
    previewConversationWorkItem,
    shouldPreferPreviewConversationWorkItem,
    persistedWorkItem,
    linkedRequirementRoom,
    effectiveRequirementRoom,
    roomBoundWorkItem,
    stableDisplayWorkItem,
    effectiveRequirementRoomSnapshots,
    hasStableConversationWorkItem,
    shouldUsePersistedWorkItemPrimaryView,
    stableDisplayPrimaryView,
    taskPlanOverview,
    requirementTeam,
  } = useChatConversationSurface({
    activeCompany,
    activeConversationState,
    activeRequirementRoom,
    activeRoomRecords,
    activeWorkItems,
    activeRequirementAggregates,
    primaryRequirementId,
    companySessionSnapshots,
    requirementRoomSnapshots,
    requirementRoomSnapshotAgentIds,
    requestPreview,
    handoffPreview,
    structuredTaskPreview,
    messages,
    currentTime,
    historyAgentId,
    sessionKey,
    productRoomId,
    groupTopicKey,
    groupWorkItemId,
    isGroup,
    isCeoSession,
    isFreshConversation,
    isRequirementBootstrapPending,
    isSummaryOpen,
    summaryPanelView,
  });
  const missionState = useChatPageMissionState({
    actionWatches,
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
    effectiveRequirementRoom,
    effectiveRequirementRoomSnapshots,
    emp,
    ensureRequirementRoomForAggregate,
    groupTitle,
    groupTopic,
    groupTopicKey,
    groupWorkItemId,
    handoffPreview,
    hasStableConversationWorkItem,
    historyAgentId,
    isArchiveView,
    isCeoSession,
    isFreshConversation,
    isGroup,
    isRequirementBootstrapPending,
    isSummaryOpen,
    lastSyncedRoomSignatureRef,
    latestMessageTimestamp,
    linkedRequirementRoom,
    localProgressEvents,
    localSlaFallbackAlerts,
    messages,
    navigate,
    nextOpenTaskStepAgentId,
    nextOpenTaskStepLabel,
    openSummaryPanel,
    persistedWorkItem,
    preferredConversationTopicKey,
    preferredConversationWorkKey,
    previewConversationWorkItem,
    previewTimestamp,
    primaryRequirementId,
    productRoomId,
    publishDispatchTargetAgentId: null,
    publishDispatchTargetLabel: null,
    relatedSlaAlerts,
    replaceDispatchRecords,
    requestPreview,
    requirementOverview,
    requirementProgressGroups,
    requirementRoomSessions,
    requirementRoomTargetAgentIds,
    requirementTeam,
    roomBoundWorkItem,
    routeCompanyConflictMessage,
    sessionExecution,
    sessionKey,
    sessionProgressEvents: undefined,
    sessionSyncError,
    sessionSyncStale,
    setCompanySessionSnapshots,
    setConversationCurrentWorkKey,
    setConversationDraftRequirement,
    shouldPreferPreviewConversationWorkItem,
    shouldUsePersistedWorkItemPrimaryView,
    stableDisplayPrimaryView,
    stableDisplayWorkItem,
    structuredTaskPreview,
    summaryAlertCount,
    summaryPanelView,
    takeoverPack,
    targetAgentId,
    taskPlanOverview,
    updateCompany,
    upsertMissionRecord,
    upsertRoomRecord,
    upsertWorkItemRecord,
  });

  const presentationState = useChatPagePresentationState({
    actionWatches,
    activeRunIdRef,
    activeArchivedRound,
    activeCompany,
    activeDispatches,
    activeRequirementEvidence,
    activeRoomBindings,
    activeRoomRecords,
    agentId,
    appendLocalProgressEvent,
    appendRoomMessages,
    archiveHistoryNotice,
    archiveId,
    attachments,
    authorityBackedState,
    autoScrollFrameRef,
    beginGeneratingState,
    clearConversationState,
    clearGeneratingState,
    companyRouteReady,
    companySessionSnapshots,
    companySessionSnapshotsRef,
    companySyncError,
    companySyncStale,
    connected,
    conversationStateKey,
    currentTime,
    deleteRoundRecord,
    displayWindowSize,
    effectiveGroupSessionKey,
    effectiveRequirementRoom,
    effectiveRequirementRoomSnapshots,
    emp,
    ensureRequirementRoomForAggregate,
    forceScrollOnNextUpdateRef,
    groupTitle,
    groupTopic,
    groupTopicKey,
    groupWorkItemId,
    handoffPreview,
    historyAgentId,
    historyRoundItems,
    incrementHistoryRefreshNonce,
    isArchiveView,
    isCeoSession,
    isGenerating,
    isGroup,
    isPageVisible,
    isSummaryOpen,
    lastEnsuredRequirementRoomRef,
    lastScrollTopRef,
    lastSyncedRoomSignatureRef,
    lastTrackedAutoPromotionRef,
    lastTrackedDraftKeyRef,
    lastTrackedStaleRef,
    latestMessageTimestamp,
    location,
    lockedScrollTopRef,
    markScrollIntent,
    messages,
    missionState,
    navigate,
    pendingGenerationStartedAtRef,
    persistedWorkItem,
    previewTimestamp,
    productArchivedRounds,
    productRoomId,
    programmaticScrollRef,
    providerId,
    providerManifest,
    recentAgentSessions,
    recoverableCommunication: recoveringCommunication,
    requestPreview,
    requirementOverview,
    requirementRoomSessionKeys,
    requirementRoomSessions,
    requirementRoomTargetAgentIds,
    requirementTeam,
    resolveDecisionTicket,
    restoreGeneratingState,
    roomBoundWorkItem,
    roomBroadcastMode,
    routeCompanyConflictMessage,
    runningFocusActionId,
    sending,
    sessionExecution,
    sessionKey,
    sessionSyncError,
    sessionSyncStale,
    setActionWatches,
    setActiveRunId,
    setAttachments,
    setCompanySyncStale,
    setDecisionSubmittingOptionId,
    setHasBootstrappedCompanySync,
    setIsGenerating,
    setIsSummaryOpen,
    setIsTechnicalSummaryOpen,
    setLoading,
    setLocalProgressEvents,
    setMessages,
    setRecentAgentSessions,
    setRecentArchivedRounds,
    setRecoveringCommunication,
    setRoomBroadcastMode,
    setRunningFocusActionId,
    setSending,
    setSessionKey,
    setSessionSyncError,
    setSessionSyncStale,
    shouldAutoScrollRef,
    streamTextRef,
    structuredTaskPreview,
    supportsSessionArchiveRestore,
    syncAutoScrollPosition,
    takeOverPack: takeoverPack,
    takeoverPack,
    targetAgentId,
    thinkingLevel,
    upsertDispatchRecord,
    upsertHandoff,
    upsertRequest,
    upsertRoomConversationBindings,
    upsertRoomRecord,
    upsertRoundRecord,
    upsertTask,
    updateCompany,
    updateStreamText,
    userScrollLockRef,
  });

  const base = {
    activeArchivedRound,
    activeArtifacts,
    activeCompany,
    activeDispatches,
    activeRoomRecords,
    agentId,
    appendLocalProgressEvent,
    archiveId,
    attachments,
    authorityBackedState,
    composerPrefill,
    connected,
    conversationStateKey,
    currentConversationRequirementHint,
    decisionSubmittingOptionId,
    effectiveRequirementRoom,
    emp,
    endRef,
    expandDisplayWindow,
    fileInputRef,
    forceScrollOnNextUpdateRef,
    groupTopic,
    groupWorkItemId,
    handleDragLeave,
    handleDragOver,
    handleDrop,
    handleFileSelect,
    handoffPreview,
    historyLoading,
    historyRoundItems,
    historySessionPresentations,
    isArchiveView,
    isCeoSession,
    isDragging,
    isFreshConversation,
    isGenerating,
    isGroup,
    isHistoryMenuOpen,
    isNearBottom,
    isRequirementBootstrapPending,
    isSummaryOpen,
    isTechnicalSummaryOpen,
    latestDirectTurnSummary,
    loading,
    localSlaFallbackAlerts,
    navigate,
    openSummaryPanel,
    orgAdvisor,
    processImageFile,
    programmaticScrollRef,
    providerManifest,
    recentAgentSessions,
    recoveringCommunication,
    relatedSlaAlerts,
    requestHealth,
    requestPreview,
    requirementOverview,
    requirementRoomMentionCandidates,
    requirementRoomSessions,
    requirementTeam,
    roomBroadcastMode,
    routeCompanyConflictMessage,
    routeComposerPrefill,
    runningFocusActionId,
    scrollContainerRef,
    sending,
    sessionExecution,
    sessionKey,
    setAttachments,
    setIsHistoryMenuOpen,
    setIsSummaryOpen,
    setIsTechnicalSummaryOpen,
    setRoomBroadcastMode,
    setSummaryPanelView,
    setThinkingLevel,
    shouldAutoScrollRef,
    structuredTaskPreview,
    summaryAlertCount,
    summaryPanelView,
    supportsSessionArchiveRestore,
    supportsSessionHistory,
    syncAutoScrollPosition,
    takeoverPack,
    targetAgentId,
    thinkingLevel,
    uploadingFile,
    upsertDispatchRecord,
    upsertWorkItemRecord,
    userScrollLockRef,
    lastScrollTopRef,
    lockedScrollTopRef,
  };

  return <ChatPageBody base={base} missionState={missionState} presentationState={presentationState} />;
}
