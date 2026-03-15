import { useCallback, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useLobbyPageCommands, useLobbyPageViewModel } from "../../application/lobby";
import { buildContinuousOpsRuntimeSummary } from "../../application/automation/continuous-ops-runtime";
import { evaluateAutomationBudgetGuardrail } from "../../application/automation/budget-guardrail";
import { gateway, useGatewayStore } from "../../application/gateway";
import { buildActivityInboxSummary } from "../../application/governance/activity-inbox";
import { buildGovernanceLoopSummary } from "../../application/governance/governance-loop";
import { buildTakeoverCaseSummary, buildTakeoverCases } from "../../application/delegation/takeover-case";
import { useTakeoverCaseWorkflow } from "../../application/delegation/use-takeover-case-workflow";
import { appendOperatorActionAuditEvent } from "../../application/governance/operator-action-audit";
import { useCanonicalRuntimeSummary } from "../../application/runtime-summary";
import { runAuthorityOperatorAction } from "../../application/gateway/authority-control";
import {
  extractAuthorityHealthSnapshot,
  resolveAuthorityControlState,
  type AuthorityOperatorControlPlaneEntry,
} from "../../application/gateway/authority-health";
import { Badge } from "../../ui/badge";
import { Button } from "../../ui/button";
import { usePageVisibility } from "../../lib/use-page-visibility";
import {
  LobbyActionStrip,
  LobbyAlertStrip,
  LobbyDialogs,
  LobbyHeroSection,
  LobbyKnowledgeSection,
  LobbyMetricCards,
  OpsSectionCard,
  LobbyRequirementCard,
} from "./components/LobbySections";
import { LobbyTeamActivitySection } from "./components/LobbyTeamActivitySection";
import { useLobbyPageState } from "./hooks/useLobbyPageState";
import { CanonicalRuntimeSummaryCard } from "../../shared/presentation/CanonicalRuntimeSummaryCard";
import { ContinuousOpsRuntimeCard } from "../../shared/presentation/ContinuousOpsRuntimeCard";
import { GovernanceLoopPanel } from "../../shared/presentation/GovernanceLoopPanel";
import { ActivityInboxStrip } from "../../shared/presentation/ActivityInboxStrip";
import { TakeoverCasePanel } from "../../shared/presentation/TakeoverCasePanel";
import { buildDefaultTalentMarketTemplates } from "../../domain/org/talent-market";
import { isApprovalPending } from "../../domain/governance/approval";
import type { AuthorityHealthSnapshot } from "../../application/gateway/authority-types";
import { AuthorityControlPlaneSurface } from "../../shared/presentation/AuthorityControlPlaneSurface";
import { formatControlPlaneStateLabel } from "../../shared/presentation/control-plane-labels";
import { toast } from "../../system/toast-store";

type CompanyLobbyPageContentProps = Omit<
  ReturnType<typeof useLobbyPageViewModel>,
  "activeCompany"
> & {
  activeCompany: NonNullable<ReturnType<typeof useLobbyPageViewModel>["activeCompany"]>;
};

export function CompanyLobbyPageScreen() {
  const isPageVisible = usePageVisibility();
  const viewModel = useLobbyPageViewModel({ isPageVisible });
  const { activeCompany, ...rest } = viewModel;

  if (!activeCompany) {
    return <div className="p-8 text-center text-muted-foreground">未选择正在运营的公司组织</div>;
  }

  return <CompanyLobbyPageContent activeCompany={activeCompany} {...rest} />;
}

function CompanyLobbyPageContent({
  activeCompany,
  activeArtifacts,
  activeDispatches,
  activeRoomRecords,
  cronCache,
  companySessionSnapshots,
  setCompanySessionSnapshots,
  connected,
  pageSurface,
  replaceDispatchRecords,
  upsertDispatchRecord,
  usageCost,
  updateCompany,
  sessionExecutions,
}: CompanyLobbyPageContentProps) {
  const navigate = useNavigate();
  const isPageVisible = usePageVisibility();
  const { summary: runtimeSummary } = useCanonicalRuntimeSummary();
  const providerManifest = useGatewayStore((state) => state.manifest);
  const { connected: gatewayConnected, phase: gatewayPhase } = useGatewayStore();
  const [authorityHealth, setAuthorityHealth] = useState<AuthorityHealthSnapshot | null>(null);
  const [authorityRefreshBusy, setAuthorityRefreshBusy] = useState(false);
  const {
    buildBlueprintText,
    syncKnowledge,
    hireEmployee,
    updateRole,
    fireEmployee,
    resolveApproval,
    assignQuickTask,
    buildGroupChatRoute,
    hireSubmitting,
    updateRoleSubmitting,
    quickTaskSubmitting,
    groupChatSubmitting,
    approvalSubmittingId,
    recoveringCommunication,
    recoverCommunication,
  } = useLobbyPageCommands({
    activeCompany,
    activeArtifacts,
    activeDispatches,
    activeRoomRecords,
    companySessionSnapshots,
    cronCache,
    connected,
    isPageVisible,
    knowledgeItems: pageSurface?.operationsSurface.knowledgeItems ?? [],
    currentRequirementTopicKey: pageSurface?.requirementSurface.requirementOverview?.topicKey ?? null,
    currentRequirementWorkItemId: pageSurface?.requirementSurface.currentRequirementWorkItemId ?? null,
    replaceDispatchRecords,
    setCompanySessionSnapshots,
    updateCompany,
  });
  const {
    ceoEmployee,
    ceoSurface,
    operationsSurface,
    primaryWorkItem,
    requirementSurface,
    scopedSessions,
    showOperationalQueues,
  } = pageSurface!;
  const {
    currentRequirementOwnerAgentId,
    requirementOverview,
    isStrategicRequirement,
    requirementDisplayTitle,
    requirementDisplayCurrentStep,
    requirementDisplaySummary,
    requirementDisplayOwner,
    requirementDisplayStage,
    requirementDisplayNext,
    primaryOwnerEmployee,
    completedWorkSteps,
    totalWorkSteps,
  } = requirementSurface;
  const {
    employeesData,
    scopedEmployeesData,
    displayEmployeesData,
    activeSessions,
    completedSessions,
    unifiedStream,
    knowledgeItems,
    retrospective,
    blockedCount,
    visibleManualCount,
    visiblePendingHandoffs,
    visibleRequestHealth,
    visibleSlaAlerts,
    teamHealthLabel,
    teamHealthClass,
  } = operationsSurface;
  const {
    fireEmployeeDialogOpen,
    groupChatDialogOpen,
    handleCopyBlueprint,
    handleFireEmployee,
    handleApprovalDecision,
    handleGroupChatSubmit,
    handleHireSubmit,
    handleQuickTaskSubmit,
    handleRecoverCommunication,
    handleSyncKnowledge,
    handleUpdateRoleSubmit,
    hireDialogOpen,
    onFireEmployeeSubmit,
    approvalBusyId,
    openCeoChat,
    quickTaskInput,
    quickTaskTarget,
    setFireEmployeeDialogOpen,
    setGroupChatDialogOpen,
    setHireDialogOpen,
    setQuickTaskInput,
    setQuickTaskTarget,
    setUpdateRoleDialogOpen,
    setUpdateRoleInitial,
    setUpdateRoleTarget,
    updateRoleDialogOpen,
    updateRoleInitial,
  } = useLobbyPageState({
    activeCompanyId: activeCompany.id,
    commands: {
      buildBlueprintText,
      syncKnowledge,
      hireEmployee,
      updateRole,
      fireEmployee,
      resolveApproval,
      assignQuickTask,
      buildGroupChatRoute,
      recoverCommunication,
    },
    ceoAgentId: ceoEmployee?.agentId ?? null,
  });
  const pendingApprovals = (activeCompany.approvals ?? []).filter(isApprovalPending);
  const templates = activeCompany.talentMarket?.templates ?? buildDefaultTalentMarketTemplates(Date.now());
  const authorityControlState = authorityHealth ? resolveAuthorityControlState(authorityHealth) : null;
  const budgetGuardrail = evaluateAutomationBudgetGuardrail({
    company: activeCompany,
    usageCost,
  });

  const refreshAuthorityHealth = useCallback(async () => {
    if (!gatewayConnected || gatewayPhase === "connecting" || gatewayPhase === "reconnecting") {
      setAuthorityHealth(null);
      return;
    }
    setAuthorityRefreshBusy(true);
    try {
      const status = await gateway.getStatus();
      setAuthorityHealth(extractAuthorityHealthSnapshot(status));
    } catch (error) {
      setAuthorityHealth(null);
      const message = error instanceof Error ? error.message : String(error);
      toast.warning("Authority 健康快照刷新失败", message);
    } finally {
      setAuthorityRefreshBusy(false);
    }
  }, [gatewayConnected, gatewayPhase]);

  useEffect(() => {
    if (!isPageVisible) {
      return;
    }
    void refreshAuthorityHealth();
  }, [isPageVisible, refreshAuthorityHealth]);

  const executeAuthorityOperatorEntry = async (entry: AuthorityOperatorControlPlaneEntry) => {
    try {
      const result = await runAuthorityOperatorAction({ id: entry.id });
      if (result.state === "blocked") {
        toast.error(result.title, result.summary);
      } else if (result.state === "degraded") {
        toast.warning(result.title, result.summary);
      } else {
        toast.success(result.title, result.summary);
      }
      void refreshAuthorityHealth();
      return result;
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      toast.error(`${entry.actionLabel}失败`, message);
      throw error;
    }
  };

  const getPresenceBadge = (status: string) => {
    if (status === "running") {
      return (
        <Badge variant="outline" className="bg-blue-500/10 text-blue-600 border-blue-500/20">
          <div className="w-1.5 h-1.5 rounded-full bg-blue-500 mr-1.5 animate-pulse" />
          运行中
        </Badge>
      );
    }
    if (status === "idle") {
      return (
        <Badge variant="outline" className="bg-green-500/10 text-green-600 border-green-500/20">
          <div className="w-1.5 h-1.5 rounded-full bg-green-500 mr-1.5" />
          空闲
        </Badge>
      );
    }
    if (status === "no_signal") {
      return (
        <Badge variant="outline" className="bg-violet-500/10 text-violet-600 border-violet-500/20">
          <div className="w-1.5 h-1.5 rounded-full bg-violet-500 mr-1.5" />
          无信号
        </Badge>
      );
    }
    return (
      <Badge variant="outline" className="bg-slate-500/10 text-slate-500 border-slate-500/20">
        <div className="w-1.5 h-1.5 rounded-full bg-slate-500 mr-1.5" />
        离线
      </Badge>
    );
  };
  const activityInboxSummary = buildActivityInboxSummary({
    scopeLabel: primaryWorkItem ? "当前主线" : "当前公司",
    blockerCount: blockedCount,
    requestCount: visibleRequestHealth.active,
    handoffCount: visiblePendingHandoffs,
    escalationCount: visibleSlaAlerts.length + ceoSurface.openEscalations,
    pendingHumanDecisionCount: ceoSurface.pendingHumanDecisions + ceoSurface.pendingApprovals,
    manualTakeoverCount: visibleManualCount,
  });
  const governanceLoopSummary = buildGovernanceLoopSummary({
    company: activeCompany,
    pendingHumanDecisions: ceoSurface.pendingHumanDecisions + ceoSurface.pendingApprovals,
    manualTakeovers: visibleManualCount,
    escalations: visibleSlaAlerts.length + ceoSurface.openEscalations,
    budgetStatus: budgetGuardrail.status,
    budgetTitle: budgetGuardrail.title,
    blockedAutomationCount: (activeCompany.automationRuns ?? []).filter((run) => run.status === "failed").length,
  });
  const continuousOpsSummary =
    requirementSurface.heartbeatSurface
      ? buildContinuousOpsRuntimeSummary({
          company: activeCompany,
          heartbeat: requirementSurface.heartbeatSurface,
          budgetGuardrail,
          jobs: cronCache,
        })
      : null;
  const takeoverCaseSummary = buildTakeoverCaseSummary(
    buildTakeoverCases({
      company: activeCompany,
      sessions: scopedSessions,
      sessionExecutions,
      activeRoomRecords,
      activeDispatches,
      sessionKeys:
        visibleManualCount > 0
          ? new Set(
              scopedSessions
                .filter((session) => sessionExecutions.get(session.key)?.state === "manual_takeover_required")
                .map((session) => session.key),
            )
          : undefined,
    }),
  );
  const { busyCaseId, runTakeoverAction, runTakeoverRedispatch } = useTakeoverCaseWorkflow({
    activeCompany,
    updateCompany,
    providerManifest,
    upsertDispatchRecord,
    surface: "lobby",
  });

  return (
    <div className="space-y-6 max-w-6xl mx-auto p-4 md:p-6 lg:p-8">
      <LobbyHeroSection
        title="Ops"
        description={
          requirementOverview
            ? isStrategicRequirement
              ? `当前默认只看「${requirementDisplayTitle}」这条战略主线，执行期超时、接管和历史请求已自动隐藏。`
              : `当前默认只看「${requirementDisplayTitle}」这条主线，历史交接、旧请求和过期活动已隐藏。`
            : "这里只看异常、成员状态和最近活动。完整任务顺序和子任务进度请去工作看板。"
        }
        canContactCeo={Boolean(ceoEmployee)}
        canOpenRequirementCenter={Boolean(requirementOverview || primaryWorkItem)}
        onOpenHire={() => setHireDialogOpen(true)}
        onOpenRequirementCenter={() => navigate("/requirement")}
        onOpenBoard={() => navigate("/board")}
        onOpenRuntimeInspector={() => navigate("/runtime")}
        onContactCeo={() => ceoEmployee && navigate(`/chat/${ceoEmployee.agentId}`)}
      />

      <LobbyRequirementCard
        visible={Boolean(requirementOverview)}
        title={requirementDisplayTitle}
        currentStep={requirementDisplayCurrentStep}
        summary={requirementDisplaySummary}
        owner={requirementDisplayOwner}
        stage={requirementDisplayStage}
        nextStep={requirementDisplayNext}
        onOpenOwner={
          primaryWorkItem?.ownerActorId ?? currentRequirementOwnerAgentId
            ? () =>
                navigate(
                  `/chat/${encodeURIComponent(
                    primaryWorkItem?.ownerActorId ?? currentRequirementOwnerAgentId!,
                  )}`,
                )
            : null
        }
        onOpenBoard={() => navigate("/board")}
        onOpenRequirementCenter={() => navigate("/requirement")}
      />

      <LobbyMetricCards
        hasRequirement={Boolean(requirementOverview)}
        scopedEmployeeCount={scopedEmployeesData.length}
        employeeCount={employeesData.length}
        teamHealthLabel={teamHealthLabel}
        teamHealthClass={teamHealthClass}
        activeSessions={activeSessions.length}
        completedSessions={completedSessions.length}
        usageCost={usageCost}
      />

      {pendingApprovals.length > 0 ? (
        <OpsSectionCard
          title="待处理审批"
          description="危险动作在继续执行前，先在这里经过一次明确确认。"
          meta={`待处理 ${pendingApprovals.length} 项`}
        >
          <div className="space-y-3">
            {pendingApprovals.map((approval) => {
              const busy = approvalBusyId === approval.id || approvalSubmittingId === approval.id;
              return (
                <div
                  key={approval.id}
                  className="rounded-2xl border border-amber-200 bg-amber-50/70 p-4 text-sm text-slate-700"
                >
                  <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                    <div className="space-y-2">
                      <div className="flex flex-wrap items-center gap-2">
                        <Badge variant="outline" className="border-amber-300 bg-white text-amber-700">
                          {approval.scope === "org" ? "组织审批" : "治理审批"}
                        </Badge>
                        {approval.targetLabel ? (
                          <span className="text-xs text-slate-500">目标：{approval.targetLabel}</span>
                        ) : null}
                      </div>
                      <div className="text-base font-semibold text-slate-900">{approval.summary}</div>
                      {approval.detail ? <div className="text-sm text-slate-600">{approval.detail}</div> : null}
                    </div>

                    <div className="flex flex-wrap gap-2 md:justify-end">
                      <button
                        type="button"
                        className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60"
                        disabled={busy}
                        onClick={() => {
                          void handleApprovalDecision(approval, "rejected");
                        }}
                      >
                        拒绝
                      </button>
                      <button
                        type="button"
                        className="rounded-lg bg-emerald-600 px-3 py-2 text-sm font-semibold text-white hover:bg-emerald-500 disabled:cursor-not-allowed disabled:bg-emerald-300"
                        disabled={busy}
                        onClick={() => {
                          void handleApprovalDecision(approval, "approved");
                        }}
                      >
                        {busy ? "处理中..." : "批准并继续"}
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </OpsSectionCard>
      ) : null}

      <OpsSectionCard
        title="Authority 控制面"
        description="这里统一呈现 health/doctor/repair/restore 的权威入口，避免在多个页面重复判断。"
        meta={
          authorityControlState
            ? `状态 ${formatControlPlaneStateLabel(authorityControlState)}`
            : gatewayConnected
              ? "状态未知"
              : "未连接"
        }
        defaultOpen
      >
        <div className="space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-slate-500">
            <div>Authority 控制面状态来自当前 gateway 快照。</div>
            <Button
              variant="outline"
              size="sm"
              disabled={authorityRefreshBusy}
              onClick={() => void refreshAuthorityHealth()}
            >
              {authorityRefreshBusy ? "刷新中..." : "刷新控制面"}
            </Button>
          </div>
          <AuthorityControlPlaneSurface
            health={authorityHealth}
            summaryVariant="steady"
            summaryLimit={4}
            guidanceLimit={4}
            readinessLimit={4}
            onExecuteEntry={executeAuthorityOperatorEntry}
          />
        </div>
      </OpsSectionCard>

      <OpsSectionCard
        title="平台运营面板"
        description="治理回路和持续运行基线在这里统一收口，operator 不需要先猜该去哪个页面。"
        meta={`治理 ${governanceLoopSummary.badgeLabel}${continuousOpsSummary ? ` · 运行 ${continuousOpsSummary.badgeLabel}` : ""}`}
        defaultOpen
      >
        <div className="space-y-3">
          <GovernanceLoopPanel summary={governanceLoopSummary} onOpenHref={(href) => navigate(href)} />
          {continuousOpsSummary ? (
            <ContinuousOpsRuntimeCard
              summary={continuousOpsSummary}
              onOpenHref={(href) => navigate(href)}
            />
          ) : null}
        </div>
      </OpsSectionCard>

      <CanonicalRuntimeSummaryCard
        summary={runtimeSummary}
        title="统一运行态摘要"
        description="监控、排障和关注队列统一从 `/runtime` 复用，Ops 只保留执行摘要和动作入口。"
        compact
      />

      <ActivityInboxStrip summary={activityInboxSummary} title="统一活动摘要" />

      <LobbyActionStrip
        title={primaryWorkItem ? "本次需求的卡点与下一步" : "先处理这些异常与下一步"}
        description={
          primaryWorkItem
            ? "这里默认只保留本次需求的负责人、阶段和下一步；旧请求、交接和 SLA 已降到次级视图。"
            : "这里是运营摘要和动作入口。完整运行态、阻塞链和值班判断统一在 `/runtime`。"
        }
        blockedCount={blockedCount}
        visiblePendingHandoffs={visiblePendingHandoffs}
        visibleRequestActive={visibleRequestHealth.active}
        visibleSlaAlerts={visibleSlaAlerts.length}
        visibleManualCount={visibleManualCount}
        recoveringCommunication={recoveringCommunication}
        hasPrimaryWorkItem={Boolean(primaryWorkItem)}
        completedWorkSteps={completedWorkSteps}
        totalWorkSteps={totalWorkSteps}
        ceoAvailable={Boolean(ceoEmployee)}
        topActions={ceoSurface.topActions}
        onRecoverCommunication={() => void handleRecoverCommunication()}
        onOpenCurrentOwner={
          primaryOwnerEmployee
            ? () => navigate(`/chat/${encodeURIComponent(primaryOwnerEmployee.agentId)}`)
            : undefined
        }
        onOpenCeo={ceoEmployee ? () => navigate(`/chat/${ceoEmployee.agentId}`) : undefined}
        onOpenBoard={() => navigate("/board")}
        onNavigateHref={(href) => navigate(href)}
      />

      {takeoverCaseSummary.totalCount > 0 ? (
        <TakeoverCasePanel
          summary={takeoverCaseSummary}
          busyCaseId={busyCaseId}
          onOpenCase={(caseItem) => {
            void appendOperatorActionAuditEvent({
              companyId: activeCompany.id,
              action: "takeover_route_open",
              surface: "lobby",
              outcome: "succeeded",
              details: {
                takeoverCaseId: caseItem.id,
                sessionKey: caseItem.sourceSessionKey,
                targetActorId: caseItem.ownerAgentId,
                route: caseItem.route,
                visibleTakeoverCount: takeoverCaseSummary.totalCount,
                takeoverStatus: caseItem.status,
              },
            });
            navigate(caseItem.route);
          }}
          onAcknowledgeCase={(caseItem) => {
            void runTakeoverAction({ caseItem, action: "acknowledge" });
          }}
          onAssignCase={(caseItem) => {
            void runTakeoverAction({
              caseItem,
              action: "assign",
              assigneeAgentId: caseItem.ownerAgentId,
              assigneeLabel: caseItem.ownerLabel,
            });
          }}
          onStartCase={(caseItem) => {
            void runTakeoverAction({ caseItem, action: "start" });
          }}
          onResolveCase={(caseItem, note) => {
            void runTakeoverAction({ caseItem, action: "resolve", note });
          }}
          onRedispatchCase={
            providerManifest
              ? (caseItem, note) => {
                  void runTakeoverRedispatch({ caseItem, note });
                }
              : undefined
          }
          onArchiveCase={(caseItem) => {
            void runTakeoverAction({ caseItem, action: "archive" });
          }}
        />
      ) : null}

      <LobbyAlertStrip
        visible={showOperationalQueues && visibleRequestHealth.active > 0}
        tone="sky"
        title={primaryWorkItem ? "当前主线请求闭环" : "请求闭环队列"}
        description={
          primaryWorkItem
            ? `当前这条主线还有 ${visibleRequestHealth.active} 条请求未真正闭环，其中阻塞 ${visibleRequestHealth.blocked} 条；历史请求已隐藏。`
            : `当前有 ${visibleRequestHealth.active} 条请求仍未真正闭环，其中阻塞 ${visibleRequestHealth.blocked} 条。`
        }
        actionLabel={recoveringCommunication ? "同步中..." : "同步请求闭环"}
        actionDisabled={recoveringCommunication}
        onAction={() => void handleRecoverCommunication()}
      />

      <LobbyAlertStrip
        visible={showOperationalQueues && visibleSlaAlerts.length > 0}
        tone="rose"
        title={primaryWorkItem ? "当前主线超时提醒" : "SLA 升级队列"}
        description={
          primaryWorkItem
            ? `当前这条主线有 ${visibleSlaAlerts.length} 条升级提醒，历史超时项已隐藏。`
            : `当前有 ${visibleSlaAlerts.length} 条规则触发升级，CEO 不需要手动轮询即可看到这些异常。`
        }
      >
        {primaryWorkItem ? (
          <div className="rounded-lg border border-rose-200 bg-white/80 px-3 py-3 text-xs leading-6 text-slate-700">
            具体超时条目已收起，避免旧提醒再次抢占视线。默认先按上面的“当前负责人 / 下一步 / 查看工作看板”推进主线。
          </div>
        ) : (
          <div className="grid gap-2 md:grid-cols-2">
            {visibleSlaAlerts.slice(0, 4).map((alert) => (
              <div
                key={alert.id}
                className="rounded-lg border border-rose-200 bg-white/80 px-3 py-2 text-xs text-slate-700"
              >
                <div className="font-medium text-slate-900">{alert.title}</div>
                <div className="mt-1">{alert.summary}</div>
                <div className="mt-1 text-[11px] text-rose-700">
                  {alert.ageMinutes} 分钟 · {alert.recommendedAction}
                </div>
              </div>
            ))}
          </div>
        )}
      </LobbyAlertStrip>

      <LobbyKnowledgeSection
        knowledgeItems={knowledgeItems}
        cronCount={cronCache.length}
        retrospectiveSummary={retrospective.summary}
        quickTaskTarget={quickTaskTarget}
        quickTaskInput={quickTaskInput}
        employees={employeesData}
        quickTaskSubmitting={quickTaskSubmitting}
        onChangeQuickTaskTarget={setQuickTaskTarget}
        onChangeQuickTaskInput={setQuickTaskInput}
        onSubmitQuickTask={() => void handleQuickTaskSubmit()}
        onKeyDownQuickTask={() => void handleQuickTaskSubmit()}
        onSyncKnowledge={() => void handleSyncKnowledge()}
        onCopyBlueprint={() => void handleCopyBlueprint()}
      />

      <OpsSectionCard
        title="成员状态与最近活动"
        description="只有在需要深挖谁在跑、谁阻塞、最近发生了什么时，再展开这一层。"
        meta={
          requirementOverview
            ? `当前主线成员 ${scopedEmployeesData.length} · 活动 ${unifiedStream.length}`
            : `成员 ${employeesData.length} · 活动 ${unifiedStream.length}`
        }
      >
        <LobbyTeamActivitySection
          hasRequirementOverview={Boolean(requirementOverview)}
          displayEmployeesData={displayEmployeesData}
          unifiedStream={unifiedStream}
          activeCompanyEmployees={activeCompany.employees}
          activeRoomRecords={activeRoomRecords}
          renderPresenceBadge={getPresenceBadge}
          onOpenGroupChat={() => setGroupChatDialogOpen(true)}
          onOpenCeoChat={openCeoChat}
          onOpenHire={() => setHireDialogOpen(true)}
          onUpdateRole={(employee) => {
            setUpdateRoleTarget(employee.agentId);
            setUpdateRoleInitial({ role: employee.role || "", description: "" });
            setUpdateRoleDialogOpen(true);
          }}
          onFireEmployee={handleFireEmployee}
          onOpenRoute={(route) => navigate(route)}
          onOpenBoard={() => navigate("/board")}
        />
      </OpsSectionCard>

        <LobbyDialogs
          companyId={activeCompany.id}
          templates={templates}
          hireDialogOpen={hireDialogOpen}
        setHireDialogOpen={setHireDialogOpen}
        onHireSubmit={handleHireSubmit}
        hireSubmitting={hireSubmitting}
        groupChatDialogOpen={groupChatDialogOpen}
        setGroupChatDialogOpen={setGroupChatDialogOpen}
        onGroupChatSubmit={handleGroupChatSubmit}
        groupChatSubmitting={groupChatSubmitting}
        employees={employeesData}
        updateRoleDialogOpen={updateRoleDialogOpen}
        setUpdateRoleDialogOpen={setUpdateRoleDialogOpen}
        updateRoleInitial={updateRoleInitial}
        onUpdateRoleSubmit={handleUpdateRoleSubmit}
        updateRoleSubmitting={updateRoleSubmitting}
        fireEmployeeDialogOpen={fireEmployeeDialogOpen}
        setFireEmployeeDialogOpen={setFireEmployeeDialogOpen}
        onFireEmployeeSubmit={onFireEmployeeSubmit}
      />
    </div>
  );
}
