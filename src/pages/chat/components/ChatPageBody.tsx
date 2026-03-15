import * as Dialog from "@radix-ui/react-dialog";
import { UploadCloud } from "lucide-react";
import { AgentOps } from "../../../application/org/employee-ops";
import { appendOperatorActionAuditEvent } from "../../../application/governance/operator-action-audit";
import { buildRequirementRoomHrefFromRecord } from "../../../application/delegation/room-routing";
import { buildCompanyChatRoute } from "../../../lib/chat-routes";
import { CHAT_RENDER_WINDOW_STEP } from "../chat-page-helpers";
import { ChatAutoDispatchController } from "./ChatAutoDispatchController";
import { ChatComposerFooter } from "./ChatComposerFooter";
import { ChatConversationWorkItemSync } from "./ChatConversationWorkItemSync";
import { ChatMessageFeed } from "./ChatMessageFeed";
import { ChatRequirementDraftCard } from "./ChatRequirementDraftCard";
import { ChatSessionHeader } from "./ChatSessionHeader";
import { ChatSummaryPanel } from "./ChatSummaryPanel";
import { ChatSyncStatusBanner } from "./ChatSyncStatusBanner";
import { ChatWaitingBanner } from "./ChatWaitingBanner";
import type { ChatPageBodyProps } from "../chat-page-types";

export function ChatPageBody({ base, missionState, presentationState }: ChatPageBodyProps) {
  if (base.loading) {
    return (
      <div className="p-8 text-center text-muted-foreground animate-pulse">
        正在建立会话连接...
      </div>
    );
  }

  if (!base.agentId || (!base.emp && !base.isGroup)) {
    return <div className="p-8 text-center">未找到这个成员会话或对应的群聊</div>;
  }

  const summaryPanelNode = (
    <ChatSummaryPanel
      open={base.isSummaryOpen}
      summaryPanelView={base.summaryPanelView}
      isGroup={base.isGroup}
      hasTechnicalSummary={missionState.hasTechnicalSummary || Boolean(presentationState.takeoverCaseSummary.primaryCase)}
      effectiveHeadline={presentationState.headerMissionHeadline}
      headerStatusBadgeClass={missionState.headerStatusBadgeClass}
      effectiveStatusLabel={presentationState.chatSurfaceStatusLabel}
      effectiveOwnerLabel={presentationState.chatSurfaceOwnerLabel}
      requirementTeamBatonLabel={base.requirementTeam?.batonLabel ?? null}
      displayNextBatonLabel={presentationState.chatSurfaceNextBatonLabel}
      effectiveStage={presentationState.chatSurfaceStage}
      effectiveActionHint={presentationState.chatSurfaceActionHint}
      onSummaryPanelViewChange={base.setSummaryPanelView}
      activeConversationMission={missionState.activeConversationMission}
      isRequirementBootstrapPending={base.isRequirementBootstrapPending}
      progressGroupSummary={presentationState.progressGroupSummary}
      latestProgressDisplay={presentationState.latestProgressDisplay}
      missionIsCompleted={missionState.missionIsCompleted}
      sending={base.sending}
      isGenerating={base.isGenerating}
      recentProgressEvents={presentationState.recentProgressEvents}
      actionWatchCards={presentationState.actionWatchCards}
      lifecycleSections={missionState.displayRequirementLifecycleSections ?? []}
      collaborationLifecycle={presentationState.collaborationLifecycle}
      detailActions={presentationState.detailActions}
      runningFocusActionId={base.runningFocusActionId}
      recoveringCommunication={base.recoveringCommunication}
      requirementTeam={base.requirementTeam}
      teamMemberCards={presentationState.teamMemberCards}
      displayNextBatonAgentId={presentationState.chatSurfaceNextBatonAgentId}
      targetAgentId={base.targetAgentId ?? null}
      teamGroupRoute={
        missionState.showRequirementTeamEntryResolved
          ? missionState.resolvedRequirementRoom
            ? buildRequirementRoomHrefFromRecord(missionState.resolvedRequirementRoom)
            : "__ensure__"
          : null
      }
      primaryOpenAction={missionState.chatSurfacePrimaryOpenAction}
      summaryRecoveryAction={missionState.summaryRecoveryAction}
      isTechnicalSummaryOpen={base.isTechnicalSummaryOpen}
      takeoverPack={
        base.takeoverPack
          ? {
              failureSummary: base.takeoverPack.failureSummary,
              recommendedNextAction: base.takeoverPack.recommendedNextAction,
            }
          : null
      }
      takeoverCaseSummary={presentationState.takeoverCaseSummary}
      takeoverCaseBusyId={presentationState.busyTakeoverCaseId}
      structuredTaskPreview={
        base.structuredTaskPreview
          ? {
              summary: base.structuredTaskPreview.summary ?? presentationState.chatSurfaceSummary,
              state: base.structuredTaskPreview.state ?? null,
            }
          : null
      }
      hasRequirementOverview={Boolean(base.requirementOverview)}
      effectiveSummary={presentationState.chatSurfaceSummary}
      requestPreview={base.requestPreview}
      requestHealth={base.requestHealth}
      ceoSurface={base.ceoSurface}
      collaborationSurface={base.requirementCollaborationSurface}
      orgAdvisorSummary={base.orgAdvisor?.summary ?? null}
      handoffPreview={base.handoffPreview}
      summaryAlertCount={base.summaryAlertCount}
      relatedSlaAlertCount={base.relatedSlaAlerts.length}
      localSlaFallbackAlertCount={base.localSlaFallbackAlerts.length}
      onClearSession={() => void presentationState.handleClearSession()}
      onRunAction={(action) => void presentationState.handleFocusAction(action)}
      onNavigateToChat={(nextAgentId) => base.navigate(buildCompanyChatRoute(nextAgentId, base.activeCompany?.id))}
      onNavigateToTeamGroup={missionState.openRequirementRoom}
      onToggleTechnicalSummary={() => base.setIsTechnicalSummaryOpen((open: boolean) => !open)}
      onCopyTakeoverPack={presentationState.handleCopyTakeoverPack}
      onOpenTakeoverCase={(caseItem) => {
        if (base.activeCompany) {
          void appendOperatorActionAuditEvent({
            companyId: base.activeCompany.id,
            action: "takeover_route_open",
            surface: "chat",
            outcome: "succeeded",
            details: {
              takeoverCaseId: caseItem.id,
              sessionKey: caseItem.sourceSessionKey,
              targetActorId: caseItem.ownerAgentId,
              route: caseItem.route,
              takeoverStatus: caseItem.status,
            },
          });
        }
        base.navigate(caseItem.route);
      }}
      onAcknowledgeTakeoverCase={(caseItem) => {
        void presentationState.runTakeoverAction({ caseItem, action: "acknowledge" });
      }}
      onAssignTakeoverCase={(caseItem) => {
        void presentationState.runTakeoverAction({
          caseItem,
          action: "assign",
          assigneeAgentId: caseItem.ownerAgentId,
          assigneeLabel: caseItem.ownerLabel,
        });
      }}
      onStartTakeoverCase={(caseItem) => {
        void presentationState.runTakeoverAction({ caseItem, action: "start" });
      }}
      onResolveTakeoverCase={(caseItem, note) => {
        void presentationState.runTakeoverAction({ caseItem, action: "resolve", note });
      }}
      onRedispatchTakeoverCase={
        base.providerManifest
          ? (caseItem, note) => {
              void presentationState.runTakeoverRedispatch({ caseItem, note });
            }
          : undefined
      }
      onArchiveTakeoverCase={(caseItem) => {
        void presentationState.runTakeoverAction({ caseItem, action: "archive" });
      }}
    />
  );

  return (
    <div
      className="relative flex h-full min-h-0 flex-col overflow-hidden bg-slate-50/50"
      onDragOver={base.handleDragOver}
      onDragLeave={base.handleDragLeave}
      onDrop={base.handleDrop}
    >
      <ChatConversationWorkItemSync
        activeCompany={base.activeCompany}
        authorityBackedState={base.authorityBackedState}
        conversationMissionRecord={missionState.conversationMissionRecord}
        conversationStateKey={base.conversationStateKey}
        effectiveRequirementRoom={base.effectiveRequirementRoom}
        persistedWorkItem={base.persistedWorkItem}
        productRoomId={base.productRoomId}
        requirementOverview={base.requirementOverview}
        sessionKey={base.sessionKey}
        shouldPersistConversationTruth={missionState.shouldPersistConversationTruth}
        activeArtifacts={base.activeArtifacts}
        activeDispatches={base.activeDispatches}
        upsertWorkItemRecord={base.upsertWorkItemRecord}
        setConversationCurrentWorkKey={base.setConversationCurrentWorkKey}
      />
      <ChatAutoDispatchController
        company={base.activeCompany}
        providerManifest={base.providerManifest}
        activeDispatches={base.activeDispatches}
        fromActorId={base.targetAgentId}
        workItemId={missionState.currentConversationWorkItemId}
        topicKey={missionState.currentConversationTopicKey}
        enabled={
          base.isCeoSession &&
          !base.isGroup &&
          !base.isArchiveView &&
          !base.isFreshConversation &&
          !base.isRequirementBootstrapPending &&
          !missionState.isManualConfirmationPending &&
          !base.routeCompanyConflictMessage
        }
        upsertDispatchRecord={base.upsertDispatchRecord}
        appendLocalProgressEvent={base.appendLocalProgressEvent}
        workTitle={missionState.effectiveHeadline}
        ownerLabel={missionState.effectiveOwnerLabel}
        summary={missionState.effectiveSummary}
        actionHint={missionState.effectiveActionHint}
        currentStep={missionState.displayPlanCurrentStep}
        nextBatonAgentId={presentationState.chatSurfaceNextBatonAgentId}
        nextBatonLabel={presentationState.chatSurfaceNextBatonLabel}
        shouldDispatchPublish={missionState.shouldDispatchPublish}
      />
      {base.isDragging ? (
        <div className="absolute inset-0 z-50 m-2 flex flex-col items-center justify-center rounded-xl border-4 border-dashed border-indigo-400 bg-indigo-500/10 backdrop-blur-[2px] transition-all pointer-events-none">
          <UploadCloud className="mb-4 h-16 w-16 animate-bounce text-indigo-500" />
          <h3 className="mb-2 text-2xl font-bold text-indigo-600">松手以投送文件</h3>
          <p className="text-indigo-500/80">
            文件将被推送至 {base.isGroup ? "全体参会成员" : base.emp?.nickname} 的工作区
          </p>
        </div>
      ) : null}
      <ChatSessionHeader
        isGroup={base.isGroup}
        groupTopic={base.groupTopic}
        groupTitle={missionState.displayGroupTitle}
        groupSubtitle={missionState.displayGroupSubtitle}
        groupSummaryItems={presentationState.headerGroupSummaryItems}
        groupMission={
          missionState.showIntegratedGroupHeader
            ? {
                contextTagLabel:
                  missionState.activeConversationMission || base.requirementOverview || base.isRequirementBootstrapPending
                    ? missionState.headerContextTagLabel
                    : null,
                headline: presentationState.headerMissionHeadline,
                tone: missionState.chatSurfaceTone,
                statusLabel: presentationState.chatSurfaceStatusLabel,
                isCollaborationMode: missionState.showGroupCollaborationMode,
                hasContextSummary: missionState.hasContextSummary,
                summaryOpen: base.isSummaryOpen,
                missionIsCompleted: missionState.missionIsCompleted,
                primaryOpenAction: missionState.chatSurfacePrimaryOpenAction,
                promotionActionLabel: missionState.promotionActionLabel,
                showRequirementTeamEntry: missionState.showRequirementTeamEntryResolved,
                hasTeamGroupRoute: missionState.primaryRequirementSurface?.roomStatus === "ready",
                showSettledRequirementSummary:
                  (base.isGroup &&
                    Boolean(
                      presentationState.headerSettledRequirementSummary ||
                        presentationState.headerDisplayGroupNextAction,
                    )) ||
                  missionState.showSettledRequirementCard,
                settledRequirementSummaryLabel: base.isGroup ? "主线目标" : "当前推进",
                settledRequirementSummary: presentationState.headerSettledRequirementSummary,
                settledRequirementNextAction: presentationState.headerDisplayGroupNextAction,
                onOpenRequirementTeam: presentationState.handleOpenRequirementTeam,
                onOpenSummaryPanel: () => base.openSummaryPanel("owner"),
                onRunPrimaryAction: (action) => void presentationState.handleFocusAction(action),
                onRunPromotionAction: () => void missionState.handlePromoteRequirementDraft(),
              }
            : null
        }
        emp={base.emp ?? null}
        isArchiveView={base.isArchiveView}
        showRequirementStatus={Boolean(base.requirementOverview || base.isRequirementBootstrapPending)}
        headerStatusBadgeClass={missionState.headerStatusBadgeClass}
        effectiveStatusLabel={presentationState.chatSurfaceStatusLabel}
        sessionExecution={base.sessionExecution}
        sessionKey={base.sessionKey}
        connected={base.connected}
        isSyncStale={presentationState.isSyncStale}
        historyLoading={base.historyLoading}
        canShowSessionHistory={presentationState.canShowSessionHistory}
        isHistoryMenuOpen={base.isHistoryMenuOpen}
        setIsHistoryMenuOpen={base.setIsHistoryMenuOpen}
        archiveId={base.archiveId}
        sending={base.sending}
        isGenerating={base.isGenerating}
        supportsSessionHistory={base.supportsSessionHistory}
        supportsSessionArchiveRestore={base.supportsSessionArchiveRestore}
        recentAgentSessions={base.recentAgentSessions}
        historySessionPresentations={base.historySessionPresentations}
        historyRoundItems={base.historyRoundItems}
        archiveSectionNotice={presentationState.archiveSectionNotice}
        deletingHistorySessionKey={presentationState.deletingHistorySessionKey}
        deletingArchiveId={presentationState.deletingArchiveId}
        restoringArchiveId={presentationState.restoringArchiveId}
        activeArchivedRound={base.activeArchivedRound}
        activeRunId={base.activeRunId}
        onNavigateToCurrentConversation={presentationState.navigateToCurrentConversation}
        onNavigateToRoute={base.navigate}
        onNavigateToArchivedRound={presentationState.navigateToArchivedRound}
        onClearSession={presentationState.handleClearSession}
        onDeleteRecentSession={presentationState.handleDeleteRecentSession}
        onRestoreArchivedRound={presentationState.handleRestoreArchivedRound}
        onDeleteArchivedRound={presentationState.handleDeleteArchivedRound}
        onStopTask={(currentSessionKey, activeRunId) => AgentOps.stopTask(currentSessionKey, activeRunId)}
      />
      <ChatSyncStatusBanner
        visible={!base.isArchiveView && presentationState.isSyncStale}
        detail={presentationState.syncStaleDetail}
        retrying={base.recoveringCommunication}
        onRetry={() => void presentationState.handleRecoverCommunication()}
      />

      {!base.isArchiveView ? (
        <>
          {missionState.conversationDraftRequirement ? (
            <ChatRequirementDraftCard
              visible={missionState.shouldShowDraftCard}
              draft={missionState.conversationDraftRequirement}
              onPromote={missionState.handlePromoteRequirementDraft}
              onContinueChat={missionState.handleContinueDraftChat}
            />
          ) : null}
          {missionState.hasContextSummary ? (
            <Dialog.Root open={base.isSummaryOpen} onOpenChange={base.setIsSummaryOpen}>
              {summaryPanelNode}
            </Dialog.Root>
          ) : null}
          {!base.isGroup && base.latestDirectTurnSummary?.state === "waiting" ? (
            <ChatWaitingBanner
              ownerLabel={base.emp?.nickname ?? "负责人"}
              questionPreview={base.latestDirectTurnSummary.questionPreview}
            />
          ) : null}
        </>
      ) : null}

      <main
        ref={base.scrollContainerRef}
        onWheelCapture={(event) => {
          if (event.deltaY < -2) {
            base.userScrollLockRef.current = true;
            base.shouldAutoScrollRef.current = false;
            base.forceScrollOnNextUpdateRef.current = false;
            base.lockedScrollTopRef.current = base.scrollContainerRef.current?.scrollTop ?? null;
          }
        }}
        onScroll={(event) => {
          const currentTop = event.currentTarget.scrollTop;
          if (base.programmaticScrollRef.current) {
            base.lastScrollTopRef.current = currentTop;
            return;
          }
          const nearBottom = base.isNearBottom(event.currentTarget);
          const movingUp = currentTop < base.lastScrollTopRef.current - 4;
          const leftAutoFollowZone = !nearBottom && base.shouldAutoScrollRef.current;

          if (movingUp || leftAutoFollowZone) {
            base.userScrollLockRef.current = true;
            base.shouldAutoScrollRef.current = false;
            base.forceScrollOnNextUpdateRef.current = false;
            base.lockedScrollTopRef.current = currentTop;
          } else if (nearBottom) {
            base.userScrollLockRef.current = false;
            base.shouldAutoScrollRef.current = true;
            base.lockedScrollTopRef.current = null;
          } else if (base.userScrollLockRef.current) {
            base.lockedScrollTopRef.current = currentTop;
          }

          base.lastScrollTopRef.current = currentTop;
        }}
        className="flex-1 min-h-0 space-y-6 overflow-y-auto p-3 md:p-6"
      >
        <ChatMessageFeed
          hiddenDisplayItemCount={presentationState.hiddenDisplayItemCount}
          renderWindowStep={CHAT_RENDER_WINDOW_STEP}
          displayItemsLength={presentationState.displayItems.length}
          visibleDisplayItems={presentationState.visibleDisplayItems}
          companyId={base.activeCompany?.id ?? null}
          sessionKey={base.sessionKey}
          employees={presentationState.companyEmployees}
          isCeoSession={base.isCeoSession}
          isGroup={base.isGroup}
          groupTopic={base.groupTopic}
          emp={base.emp ?? null}
          effectiveOwnerAgentId={missionState.effectiveOwnerAgentId}
          requirementRoomSessionsLength={base.requirementRoomSessions.length}
          targetAgentId={base.targetAgentId}
          currentConversationRequirementTopicKey={base.currentConversationRequirementHint?.topicKey ?? null}
          requirementOverviewTopicKey={base.requirementOverview?.topicKey ?? null}
          conversationMissionRecordId={missionState.conversationMissionRecord?.id ?? null}
          persistedWorkItemId={base.persistedWorkItem?.id ?? null}
          groupWorkItemId={base.groupWorkItemId ?? null}
          activeDispatches={base.activeDispatches}
          activeRoomRecords={base.activeRoomRecords}
          openRequirementDecisionTicket={missionState.openRequirementDecisionTicket}
          showLegacyDecisionCard={false}
          decisionSubmittingOptionId={base.decisionSubmittingOptionId}
          isGenerating={base.isGenerating}
          emptyStateText={presentationState.emptyStateText}
          onExpandDisplayWindow={base.expandDisplayWindow}
          onSelectDecisionOption={(optionId) => void presentationState.handleResolveRequirementDecision(optionId)}
          onNavigateToRoute={base.navigate}
          onStreamActivity={base.syncAutoScrollPosition}
        />
        <div ref={base.endRef} />
      </main>

      <ChatComposerFooter
        isArchiveView={base.isArchiveView}
        isGenerating={base.isGenerating}
        fileInputRef={base.fileInputRef}
        handleFileSelect={base.handleFileSelect}
        placeholder={
          base.isGroup
            ? "在需求团队房间里交流；输入 @成员名 定向派发，不写 @ 默认发给当前 baton / 负责人，切换“群发中”才会发给所有成员 (Enter 换行，Cmd/Ctrl+Enter 发送)..."
            : `向 ${base.emp?.nickname} 发送工作指令 (/new 新会话，Enter 换行，Cmd/Ctrl+Enter 发送)...`
        }
        sending={base.sending}
        uploadingFile={base.uploadingFile}
        attachments={base.attachments}
        thinkingLevel={base.thinkingLevel}
        roomBroadcastMode={base.roomBroadcastMode}
        requirementRoomMentionCandidates={base.isGroup ? base.requirementRoomMentionCandidates : undefined}
        composerPrefill={base.composerPrefill}
        routeComposerPrefill={base.routeComposerPrefill}
        showThinkingSelector={!base.isGroup}
        setRoomBroadcastMode={base.setRoomBroadcastMode}
        setThinkingLevel={base.setThinkingLevel}
        setAttachments={base.setAttachments}
        processImageFile={base.processImageFile}
        handleSend={presentationState.handleSend}
      />
    </div>
  );
}
