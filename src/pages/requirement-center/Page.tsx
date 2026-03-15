import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { resolveRequirementRoomEntryTarget } from "../../application/delegation/requirement-room-entry";
import { buildRequirementRoomHrefFromRecord } from "../../application/delegation/room-routing";
import { evaluateAutomationBudgetGuardrail } from "../../application/automation/budget-guardrail";
import { buildContinuousOpsRuntimeSummary } from "../../application/automation/continuous-ops-runtime";
import { useMissionBoardApp, useMissionBoardQuery } from "../../application/mission";
import { useRequirementCenterPageState } from "../../application/mission/requirement-center-page-view-model";
import { buildRequirementDecisionTicketId } from "../../application/mission/requirement-decision-ticket";
import type { RequirementCloseoutReport } from "../../application/mission/requirement-closeout-report";
import { buildCompanyHeartbeatSurface } from "../../application/org/company-heartbeat";
import {
  loadRequirementMetricEvents,
  trackRequirementMetric,
  type RequirementMetricEvent,
} from "../../application/telemetry/requirement-center-metrics";
import { formatWorkspaceBytes } from "../../application/workspace";
import { toast } from "../../system/toast-store";
import { appendOperatorActionAuditEvent } from "../../application/governance/operator-action-audit";
import { RequirementAcceptancePanel } from "./components/RequirementAcceptancePanel";
import { RequirementCollaborationPanel } from "./components/RequirementCollaborationPanel";
import { RequirementDeliverySummaryCard } from "./components/RequirementDeliverySummaryCard";
import { RequirementEmptyStateCard } from "./components/RequirementEmptyStateCard";
import { RequirementExecutionPanel } from "./components/RequirementExecutionPanel";
import { RequirementHeartbeatCard } from "./components/RequirementHeartbeatCard";
import { RequirementOpsSummaryCard } from "./components/RequirementOpsSummaryCard";
import { RequirementSummaryCard } from "./components/RequirementSummaryCard";
import { RequirementTimelinePanel } from "./components/RequirementTimelinePanel";
import { CanonicalRuntimeSummaryCard } from "../../shared/presentation/CanonicalRuntimeSummaryCard";

function summarizeRequirementMetricEvents(events: RequirementMetricEvent[]) {
  return {
    requirementCenterOpened: events.filter((event) => event.name === "requirement_center_opened").length,
    collaborationOpened: events.filter((event) => event.name === "requirement_collaboration_opened").length,
    workspaceOpened: events.filter((event) => event.name === "requirement_workspace_opened").length,
    opsOpened: events.filter((event) => event.name === "requirement_ops_opened").length,
    acceptanceRequested: events.filter((event) => event.name === "requirement_acceptance_requested").length,
    acceptanceAccepted: events.filter((event) => event.name === "requirement_accepted").length,
    requirementReopened: events.filter((event) => event.name === "requirement_reopened").length,
  };
}

function openRequirementOpsRoute(input: {
  companyId: string;
  requirementId: string | null;
  visibleTakeoverCount: number;
  visibleSlaAlertCount: number;
  visiblePendingHandoffCount: number;
  navigate: (to: string) => void;
}) {
  trackRequirementMetric({
    companyId: input.companyId,
    requirementId: input.requirementId,
    name: "requirement_ops_opened",
  });
  void appendOperatorActionAuditEvent({
    companyId: input.companyId,
    action: "ops_route_open",
    surface: "requirement_center",
    outcome: "succeeded",
    details: {
      route: "/ops",
      requirementId: input.requirementId,
      visibleTakeoverCount: input.visibleTakeoverCount,
      visibleSlaAlertCount: input.visibleSlaAlertCount,
      visiblePendingHandoffCount: input.visiblePendingHandoffCount,
    },
  });
  input.navigate("/ops");
}

function recordRequirementAcceptanceAudit(input: {
  companyId: string;
  mode: "request" | "accept" | "revise" | "reopen" | "change";
  requirementId: string;
  workItemId: string | null;
  closeoutReport: RequirementCloseoutReport;
}) {
  const action =
    input.mode === "request"
      ? "requirement_acceptance_request"
      : input.mode === "accept"
        ? "requirement_acceptance_accept"
        : input.mode === "revise"
          ? "requirement_acceptance_revise"
          : input.mode === "reopen"
            ? "requirement_acceptance_reopen"
            : "requirement_change_request";
  void appendOperatorActionAuditEvent({
    companyId: input.companyId,
    action,
    surface: "requirement_center",
    outcome: "succeeded",
    details: {
      requirementId: input.requirementId,
      workItemId: input.workItemId,
      closeoutStatus: input.closeoutReport.status,
      deliverableCount: input.closeoutReport.deliverableCount,
      traceabilityCount: input.closeoutReport.traceabilityCount,
      blockingReasons: input.closeoutReport.blockingReasons,
      advisoryReasons: input.closeoutReport.advisoryReasons,
      acceptanceEvidenceCount: input.closeoutReport.acceptanceEvidenceHighlights.length,
      workspaceCloseoutStatus:
        input.closeoutReport.workspaceCloseoutSummary.totals.attention > 0
          ? "attention"
          : input.closeoutReport.workspaceCloseoutSummary.totals.in_progress > 0
            ? "in_progress"
            : "ready",
      workspaceCloseoutTotals: input.closeoutReport.workspaceCloseoutSummary.totals,
    },
  });
}

type RequirementCenterContentProps = Omit<ReturnType<typeof useMissionBoardQuery>, "activeCompany"> &
  ReturnType<typeof useMissionBoardApp> & {
    activeCompany: NonNullable<ReturnType<typeof useMissionBoardQuery>["activeCompany"]>;
  };

export function RequirementCenterScreen() {
  const viewModel = {
    ...useMissionBoardQuery(),
    ...useMissionBoardApp(),
  };
  const { activeCompany, ...restViewModel } = viewModel;

  if (!activeCompany) {
    return <div className="p-8 text-center text-muted-foreground">未选择正在运营的公司组织</div>;
  }

  return <RequirementCenterContent activeCompany={activeCompany} {...restViewModel} />;
}

function RequirementCenterContent({
  activeCompany,
  activeConversationStates,
  activeDispatches,
  activeRoomRecords,
  activeWorkItems,
  activeRequirementAggregates,
  activeRequirementEvidence,
  activeDecisionTickets,
  activeAgentSessions,
  activeAgentRuntime,
  activeAgentStatuses,
  primaryRequirementId,
  activeArtifacts,
  replaceDispatchRecords,
  upsertTask,
  updateCompany,
  applyRequirementTransition,
  upsertWorkItemRecord,
  resolveDecisionTicket,
  upsertDecisionTicketRecord,
  ensureRequirementRoomForAggregate,
}: RequirementCenterContentProps) {
  const navigate = useNavigate();
  const {
    ceo,
    runtimeSummary,
    recoveringCommunication,
    handleRecoverCommunication,
    pageSurface,
  } = useRequirementCenterPageState({
    activeCompany,
    activeConversationStates,
    activeDispatches,
    activeRoomRecords,
    activeWorkItems,
    activeRequirementAggregates,
    activeRequirementEvidence,
    activeDecisionTickets,
    activeAgentSessions,
    activeAgentRuntime,
    activeAgentStatuses,
    primaryRequirementId,
    activeArtifacts,
    replaceDispatchRecords,
    upsertTask,
    updateCompany,
  });
  const [acceptanceSubmitting, setAcceptanceSubmitting] = useState<null | "request" | "accept" | "revise" | "reopen" | "change">(null);
  const [decisionSubmittingOptionId, setDecisionSubmittingOptionId] = useState<string | null>(null);
  const [metricRevision, setMetricRevision] = useState(0);
  const trackedOpenKeyRef = useRef<string | null>(null);
  const {
    requirementSurface,
    boardTaskSurface,
    aggregate,
    workItem,
    room,
    openRequirementDecisionTicket,
    productStatus,
    statusClassName,
    ownerAgentId,
    ownerLabel,
    stageLabel,
    nextAction,
    summary,
    roomDispatches,
    roomDispatchCheckout,
    deliverableFiles,
    closeoutReport,
    acceptanceGate,
    heartbeatSurface,
    requirementTimeline,
    taskSequence,
    transcriptPreview,
    canRequestAcceptance,
    canAccept,
    canContinueModify,
    canRejectReopen,
    canRequestChange,
    activityInboxSummary,
    roomPreviewText,
    collaborationActionLabel,
  } = {
    ...pageSurface,
    openRequirementDecisionTicket: pageSurface.primaryRequirementSurface.openDecisionTicket,
  };
  const [metricEvents, setMetricEvents] = useState<RequirementMetricEvent[]>([]);
  const metricSummary = useMemo(
    () => summarizeRequirementMetricEvents(metricEvents),
    [metricEvents],
  );
  const budgetGuardrail = useMemo(
    () =>
      evaluateAutomationBudgetGuardrail({
        company: activeCompany,
        usageCost: null,
      }),
    [activeCompany],
  );
  const requirementContinuousOpsSummary = useMemo(
    () =>
      buildContinuousOpsRuntimeSummary({
        company: activeCompany,
        heartbeat:
          heartbeatSurface ??
          buildCompanyHeartbeatSurface({
            company: activeCompany,
            usageCost: null,
          }),
        budgetGuardrail,
        jobs: [],
      }),
    [activeCompany, budgetGuardrail, heartbeatSurface],
  );
  const openWorkspace = (source: string) => {
    trackRequirementMetric({
      companyId: activeCompany.id,
      requirementId: aggregate?.id ?? null,
      name: "requirement_workspace_opened",
      metadata: { source },
    });
    navigate("/workspace");
  };
  const openOps = () =>
    openRequirementOpsRoute({
      companyId: activeCompany.id,
      requirementId: aggregate?.id ?? null,
      visibleTakeoverCount: boardTaskSurface.visibleTakeoverCount,
      visibleSlaAlertCount: boardTaskSurface.visibleSlaAlerts.length,
      visiblePendingHandoffCount: boardTaskSurface.visiblePendingHandoffs.length,
      navigate,
    });

  const resolveRequirementDecision = (optionId: string) => {
    if (!openRequirementDecisionTicket) {
      return;
    }
    const option =
      openRequirementDecisionTicket.options.find((candidate) => candidate.id === optionId) ?? null;
    if (!option) {
      return;
    }
    setDecisionSubmittingOptionId(optionId);
    resolveDecisionTicket({
      ticketId: openRequirementDecisionTicket.id,
      optionId: option.id,
      resolution: option.summary ?? option.label,
      timestamp: Date.now(),
    });
    setDecisionSubmittingOptionId(null);
    toast.success("已记录你的决策", "当前主线会按这张决策票继续推进。");
  };

  const recordMetric = (input: {
    requirementId: string | null;
    name: RequirementMetricEvent["name"];
    metadata?: RequirementMetricEvent["metadata"];
  }) => {
    trackRequirementMetric({
      companyId: activeCompany.id,
      requirementId: input.requirementId,
      name: input.name,
      metadata: input.metadata,
    });
    setMetricRevision((revision) => revision + 1);
  };

  useEffect(() => {
    setMetricEvents(
      loadRequirementMetricEvents(activeCompany.id).filter(
        (event) => event.requirementId === (aggregate?.id ?? null),
      ),
    );
  }, [activeCompany.id, aggregate?.id, metricRevision]);

  const runAcceptanceAction = (mode: "request" | "accept" | "revise" | "reopen" | "change") => {
    if (!aggregate) {
      return;
    }
    const gate = acceptanceGate[mode];
    if (!gate.enabled) {
      toast.error(gate.title, gate.reasons[0] ?? gate.summary);
      return;
    }
    const timestamp = Date.now();
    setAcceptanceSubmitting(mode);
    try {
      if (mode === "request") {
        recordMetric({
          requirementId: aggregate.id,
          name: "requirement_acceptance_requested",
        });
        applyRequirementTransition({
          aggregateId: aggregate.id,
          timestamp,
          source: "local-command",
          changes: {
            status: "waiting_review",
            acceptanceStatus: "pending",
            acceptanceNote: "待你验收",
            stage: "待你验收",
            nextAction: "请确认当前交付是否满足预期，选择验收通过或继续修改。",
          },
        });
        if (workItem) {
          upsertWorkItemRecord({
            ...workItem,
            status: "waiting_review",
            displayStage: "待你验收",
            stageLabel: "待你验收",
            displayNextAction: "请确认当前交付是否满足预期。",
            nextAction: "请确认当前交付是否满足预期。",
            updatedAt: Math.max(workItem.updatedAt, timestamp),
          });
        }
        recordRequirementAcceptanceAudit({
          companyId: activeCompany.id,
          mode,
          requirementId: aggregate.id,
          workItemId: workItem?.id ?? aggregate.workItemId ?? null,
          closeoutReport,
        });
        toast.success("已发起验收", "当前主线已进入待你验收。");
      }
      if (mode === "accept") {
        recordMetric({
          requirementId: aggregate.id,
          name: "requirement_accepted",
        });
        applyRequirementTransition({
          aggregateId: aggregate.id,
          timestamp,
          source: "local-command",
          changes: {
            status: "completed",
            acceptanceStatus: "accepted",
            acceptanceNote: "验收通过",
            stage: "已完成",
            nextAction: "本次需求已通过验收，可以归档或开启下一条主线。",
          },
        });
        if (workItem) {
          upsertWorkItemRecord({
            ...workItem,
            status: "completed",
            displayStage: "已完成",
            stageLabel: "已完成",
            displayNextAction: "本次需求已通过验收，可以归档或开启下一条主线。",
            nextAction: "本次需求已通过验收，可以归档或开启下一条主线。",
            updatedAt: Math.max(workItem.updatedAt, timestamp),
            completedAt: timestamp,
          });
        }
        recordRequirementAcceptanceAudit({
          companyId: activeCompany.id,
          mode,
          requirementId: aggregate.id,
          workItemId: workItem?.id ?? aggregate.workItemId ?? null,
          closeoutReport,
        });
        toast.success(
          "验收已通过",
          closeoutReport.advisoryReasons.length > 0
            ? "当前主线已正式闭环；提醒项也已连同这次通过一起记入审计轨迹。"
            : "当前主线已正式闭环。",
        );
      }
      if (mode === "revise" || mode === "reopen") {
        recordMetric({
          requirementId: aggregate.id,
          name: "requirement_reopened",
          metadata: { mode },
        });
        const stage = mode === "revise" ? "继续修改" : "驳回重开";
        const next = mode === "revise"
          ? "根据验收反馈继续修改后，再次提交验收。"
          : "当前结果未达标，请重新推进后再提交验收。";
        applyRequirementTransition({
          aggregateId: aggregate.id,
          timestamp,
          source: "local-command",
          changes: {
            status: "active",
            acceptanceStatus: mode === "revise" ? "not_requested" : "rejected",
            acceptanceNote: mode === "revise" ? "继续修改" : stage,
            stage,
            nextAction: next,
          },
        });
        if (workItem) {
          upsertWorkItemRecord({
            ...workItem,
            status: "active",
            displayStage: stage,
            stageLabel: stage,
            displayNextAction: next,
            nextAction: next,
            updatedAt: Math.max(workItem.updatedAt, timestamp),
            completedAt: null,
          });
        }
        recordRequirementAcceptanceAudit({
          companyId: activeCompany.id,
          mode,
          requirementId: aggregate.id,
          workItemId: workItem?.id ?? aggregate.workItemId ?? null,
          closeoutReport,
        });
        toast.warning(stage, "当前主线已回到执行态。");
      }
      if (mode === "change") {
        const decisionTicketId = buildRequirementDecisionTicketId({
          sourceType: "requirement",
          sourceId: aggregate.id,
          decisionType: "requirement_change",
        });
        const existingDecisionTicket =
          activeDecisionTickets.find((ticket) => ticket.id === decisionTicketId) ?? null;
        recordMetric({
          requirementId: aggregate.id,
          name: "requirement_change_requested",
        });
        upsertDecisionTicketRecord({
          id: decisionTicketId,
          companyId: activeCompany.id,
          sourceType: "requirement",
          sourceId: aggregate.id,
          escalationId: null,
          aggregateId: aggregate.id,
          workItemId: workItem?.id ?? aggregate.workItemId ?? null,
          sourceConversationId:
            aggregate.sourceConversationId ?? workItem?.sourceConversationId ?? null,
          decisionOwnerActorId:
            ceo?.agentId ?? aggregate.ownerActorId ?? workItem?.ownerActorId ?? "system:requirement",
          decisionType: "requirement_change",
          summary: "请确认这次需求变更。系统会继续沿用当前需求主线，不会自动拆成新需求。",
          options: [
            {
              id: "confirm_change",
              label: "确认变更并继续",
              summary: "按新的范围继续推进当前需求。",
            },
            {
              id: "cancel_change",
              label: "取消这次变更",
              summary: "维持当前需求范围和执行计划。",
            },
          ],
          requiresHuman: true,
          status: "pending_human",
          resolution: null,
          resolutionOptionId: null,
          roomId: aggregate.roomId ?? workItem?.roomId ?? null,
          createdAt: existingDecisionTicket?.createdAt ?? timestamp,
          updatedAt: timestamp,
        });
        applyRequirementTransition({
          aggregateId: aggregate.id,
          timestamp,
          source: "local-command",
          changes: {
            status: "waiting_owner",
            acceptanceStatus: "not_requested",
            acceptanceNote: "需求变更待确认",
            stage: "需求变更中",
            nextAction: "请先在需求房确认变更范围、优先级和受影响任务，再决定是否继续执行。",
          },
        });
        if (workItem) {
          upsertWorkItemRecord({
            ...workItem,
            status: "waiting_owner",
            displayStage: "需求变更中",
            stageLabel: "需求变更中",
            displayNextAction: "请先在需求房确认变更范围、优先级和受影响任务，再决定是否继续执行。",
            nextAction: "请先在需求房确认变更范围、优先级和受影响任务，再决定是否继续执行。",
            updatedAt: Math.max(workItem.updatedAt, timestamp),
            completedAt: null,
          });
        }
        recordRequirementAcceptanceAudit({
          companyId: activeCompany.id,
          mode,
          requirementId: aggregate.id,
          workItemId: workItem?.id ?? aggregate.workItemId ?? null,
          closeoutReport,
        });
        toast.warning("需求变更待确认", "当前主线已进入需求变更确认态，下一棒回到你。");
      }
    } finally {
      setAcceptanceSubmitting(null);
    }
  };

  useEffect(() => {
    const openKey = `${activeCompany.id}:${aggregate?.id ?? "none"}`;
    if (trackedOpenKeyRef.current === openKey) {
      return;
    }
    trackedOpenKeyRef.current = openKey;
    trackRequirementMetric({
      companyId: activeCompany.id,
      requirementId: aggregate?.id ?? null,
      name: "requirement_center_opened",
      metadata: {
        hasRoom: Boolean(room),
        hasWorkItem: Boolean(workItem),
      },
    });
    setMetricRevision((revision) => revision + 1);
  }, [activeCompany.id, aggregate?.id, room, workItem]);

  const openCollaboration = () => {
    trackRequirementMetric({
      companyId: activeCompany.id,
      requirementId: aggregate?.id ?? null,
      name: "requirement_collaboration_opened",
      metadata: {
        hasRoom: Boolean(room),
      },
    });
    const target = resolveRequirementRoomEntryTarget({
      room,
      aggregateId: aggregate?.id ?? null,
    });
    if (target.kind === "room" || target.kind === "route") {
      navigate(target.href);
      return;
    }
    if (target.kind === "ensure") {
      const ensuredRoom = ensureRequirementRoomForAggregate(target.aggregateId);
      if (ensuredRoom) {
        navigate(buildRequirementRoomHrefFromRecord(ensuredRoom));
        return;
      }
    }
    if (ceo?.agentId) {
      toast.info("需求房还未就绪", "已为这条主线创建房间失败，先回 CEO 会话继续推进或稍后重试。");
      navigate(`/chat/${encodeURIComponent(ceo.agentId)}`);
      return;
    }
    toast.info("当前还没有需求房", "先让 CEO 或负责人继续收敛后再进入多人协作。");
  };

  return (
    <div className="mx-auto flex h-full max-w-7xl flex-col gap-6 p-4 md:p-6 lg:p-8">
      <RequirementSummaryCard
        productStatusLabel={productStatus.label}
        statusClassName={statusClassName}
        revision={aggregate?.revision ?? null}
        title={workItem?.title ?? requirementSurface.requirementDisplayTitle ?? "当前主线需求"}
        summary={summary}
        ownerLabel={ownerLabel}
        stageLabel={stageLabel}
        nextAction={nextAction}
        acceptanceNote={aggregate?.acceptanceNote}
        updatedAt={aggregate?.updatedAt ?? workItem?.updatedAt ?? null}
        collaborationActionLabel={collaborationActionLabel}
        ownerAgentId={ownerAgentId}
        decisionTicket={openRequirementDecisionTicket}
        decisionSubmittingOptionId={decisionSubmittingOptionId}
        onResolveDecision={resolveRequirementDecision}
        onOpenCollaboration={openCollaboration}
        onOpenWorkspace={() => openWorkspace("hero")}
        onOpenOps={openOps}
        onOpenOwner={
          ownerAgentId
            ? () => navigate(`/chat/${encodeURIComponent(ownerAgentId)}`)
            : null
        }
      />

      <CanonicalRuntimeSummaryCard
        summary={runtimeSummary}
        title="统一运行态摘要"
        description="需求中心继续负责验收、变更和决策；实时运行态、阻塞链和排障总览统一复用 `/runtime`。"
        compact
      />

      {!aggregate ? (
        <RequirementEmptyStateCard
          canOpenCeoChat={Boolean(ceo)}
          onOpenCeoChat={() => ceo && navigate(`/chat/${encodeURIComponent(ceo.agentId)}`)}
          onOpenCeoHome={() => navigate("/ceo")}
        />
      ) : (
        <>
          <RequirementHeartbeatCard
            heartbeat={heartbeatSurface}
            opsRuntime={requirementContinuousOpsSummary}
            onOpenSettings={() => navigate("/settings")}
          />

          <div className="grid gap-6 xl:grid-cols-[1.15fr,0.85fr]">
            <RequirementExecutionPanel
              ownerLabel={ownerLabel}
              stageLabel={stageLabel}
              nextAction={nextAction}
              statusClassName={statusClassName}
              productStatusLabel={productStatus.label}
              doneSteps={boardTaskSurface.doneSteps}
              totalSteps={boardTaskSurface.totalSteps}
              globalPct={boardTaskSurface.globalPct}
              taskSequence={taskSequence}
            />

            <div className="space-y-6">
              <RequirementTimelinePanel
                metricSummary={metricSummary}
                requirementTimeline={requirementTimeline}
                employees={activeCompany.employees}
              />

              <RequirementCollaborationPanel
                roomTitle={room?.title ?? requirementSurface.currentRequirementRoomTitle ?? "当前需求房"}
                roomPreviewText={roomPreviewText}
                roomUpdatedAt={room?.updatedAt ?? aggregate.updatedAt}
                roomMemberCount={(room?.memberIds ?? aggregate.memberIds).length}
                roomDispatches={roomDispatches}
                roomDispatchCheckout={roomDispatchCheckout}
                transcriptPreview={transcriptPreview}
                employees={activeCompany.employees}
              />

              <RequirementDeliverySummaryCard
                deliverableFiles={deliverableFiles}
                formatSize={formatWorkspaceBytes}
                onOpenWorkspace={() => openWorkspace("deliverables-card")}
              />
            </div>
          </div>

          <RequirementAcceptancePanel
            statusClassName={statusClassName}
            productStatusLabel={productStatus.label}
            productStatusDescription={productStatus.description}
            acceptanceNote={aggregate.acceptanceNote}
            closeoutReport={closeoutReport}
            acceptanceGate={acceptanceGate}
            acceptanceSubmitting={acceptanceSubmitting}
            canRequestAcceptance={canRequestAcceptance}
            canRequestChange={canRequestChange}
            canAccept={canAccept}
            canContinueModify={canContinueModify}
            canRejectReopen={canRejectReopen}
            onRunAcceptanceAction={runAcceptanceAction}
          />

          <RequirementOpsSummaryCard
            activityInboxSummary={activityInboxSummary}
            recoveringCommunication={recoveringCommunication}
            onRecover={() => void handleRecoverCommunication()}
            onOpenOps={openOps}
          />
        </>
      )}
    </div>
  );
}
