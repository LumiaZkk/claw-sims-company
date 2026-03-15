import { useMemo } from "react";
import { useShallow } from "zustand/react/shallow";
import {
  agentStatusNeedsIntervention,
  buildCanonicalAgentStatusHealth,
  buildCanonicalAgentStatusProjection,
  mapAgentRuntimeAvailabilityToLegacyStatus,
  type AgentRunRecord,
  type AgentSessionRecord,
} from "../agent-runtime";
import { inferDepartmentKind } from "../org/department-autonomy";
import { describeDispatchCheckout } from "../../domain/delegation/dispatch-checkout";
import type { WorkItemRecord } from "../../domain/mission/types";
import type { Company, EmployeeRef } from "../../domain/org/types";
import { useAuthorityRuntimeSyncStore } from "../../infrastructure/authority/runtime-sync-store";
import { useCompanyRuntimeStore } from "../../infrastructure/company/runtime/store";
import { selectRuntimeInspectorState } from "../../infrastructure/company/runtime/selectors";
import {
  buildHistoryWindow,
  buildRecommendedActions,
  buildReplayEvent,
  buildTimelineEvent,
  describeStatusCoverage,
  rankAgentForFocus,
  resolveActivityLabel,
  resolveAttentionFromCanonical,
  resolveAttentionReasonFromCanonical,
  resolveSceneActivityLabel,
  resolveSceneZone,
  resolveSceneZoneDescription,
  resolveSceneZoneLabel,
  resolveSceneZoneTone,
} from "./runtime-inspector-agent-helpers";
import {
  type RuntimeInspectorAgentSurface,
  type RuntimeInspectorChainLink,
  type RuntimeInspectorSceneZone,
  type RuntimeInspectorStatusSource,
  type RuntimeInspectorSurface,
  type RuntimeSceneZoneId,
} from "./runtime-inspector-types";

export type {
  RuntimeAttentionLevel,
  RuntimeInspectorAgentSurface,
  RuntimeInspectorChainLink,
  RuntimeInspectorHistoryEvent,
  RuntimeInspectorLiveProcess,
  RuntimeInspectorProcessTelemetry,
  RuntimeInspectorRecommendedAction,
  RuntimeInspectorReplayEvent,
  RuntimeInspectorSceneZone,
  RuntimeInspectorStatusSource,
  RuntimeInspectorSurface,
  RuntimeInspectorTimelineEvent,
  RuntimeSceneZoneId,
} from "./runtime-inspector-types";
export {
  useRuntimeInspectorGlobalProcessTelemetry,
  useRuntimeInspectorProcessTelemetry,
} from "./runtime-inspector-process-telemetry";

type RuntimeInspectorInput = ReturnType<typeof selectRuntimeInspectorState>;

function resolveActorLabel(
  actorId: string | null | undefined,
  employeeByActorId: Map<string, EmployeeRef>,
): string {
  if (!actorId) {
    return "系统";
  }
  return employeeByActorId.get(actorId)?.nickname ?? actorId;
}

function resolveDepartmentLabel(
  departmentId: string | null | undefined,
  company: Company,
): string {
  if (!departmentId) {
    return "相关团队";
  }
  return company.departments?.find((department) => department.id === departmentId)?.name ?? departmentId;
}

function buildRuntimeChainLinks(input: {
  company: Company;
  activeWorkItems: WorkItemRecord[];
  activeDispatches: RuntimeInspectorInput["activeDispatches"];
  activeSupportRequests: RuntimeInspectorInput["activeSupportRequests"];
  activeEscalations: RuntimeInspectorInput["activeEscalations"];
}): RuntimeInspectorChainLink[] {
  const employeeByActorId = new Map(
    input.company.employees.map((employee) => [employee.agentId, employee] as const),
  );
  const workItemsById = new Map(
    input.activeWorkItems.map((workItem) => [workItem.id, workItem] as const),
  );
  const supportRequestsById = new Map(
    input.activeSupportRequests.map((request) => [request.id, request] as const),
  );
  const links: RuntimeInspectorChainLink[] = [];

  const pushLink = (link: RuntimeInspectorChainLink) => {
    links.push(link);
  };

  [...input.activeWorkItems]
    .sort((left, right) => right.updatedAt - left.updatedAt)
    .forEach((workItem) => {
      if (
        (workItem.status === "waiting_owner" ||
          workItem.status === "waiting_review" ||
          workItem.stageGateStatus === "waiting_confirmation") &&
        workItem.ownerActorId &&
        workItem.batonActorId &&
        workItem.ownerActorId !== workItem.batonActorId
      ) {
        pushLink({
          id: `work:${workItem.id}:awaiting`,
          kind: "work_item",
          kindLabel: "Work",
          stateLabel:
            workItem.stageGateStatus === "waiting_confirmation" || workItem.status === "waiting_review"
              ? "待确认"
              : "待输入",
          tone: "warning",
          fromAgentId: workItem.ownerActorId,
          fromLabel: resolveActorLabel(workItem.ownerActorId, employeeByActorId),
          toAgentId: workItem.batonActorId,
          toLabel: resolveActorLabel(workItem.batonActorId, employeeByActorId),
          summary: workItem.displayNextAction || workItem.nextAction || workItem.title,
          updatedAt: workItem.updatedAt,
          focusAgentId: workItem.ownerActorId,
        });
      }

      const activeStep = workItem.steps.find(
        (step) =>
          step.status === "active" &&
          step.assigneeActorId &&
          step.assigneeActorId !== workItem.ownerActorId,
      );
      if (activeStep?.assigneeActorId) {
        pushLink({
          id: `work:${workItem.id}:step:${activeStep.id}`,
          kind: "work_item",
          kindLabel: "Work",
          stateLabel: "执行中",
          tone: "info",
          fromAgentId: workItem.ownerActorId ?? workItem.batonActorId ?? null,
          fromLabel: resolveActorLabel(workItem.ownerActorId ?? workItem.batonActorId, employeeByActorId),
          toAgentId: activeStep.assigneeActorId,
          toLabel: resolveActorLabel(activeStep.assigneeActorId, employeeByActorId),
          summary: activeStep.title || workItem.title,
          updatedAt: activeStep.updatedAt,
          focusAgentId: activeStep.assigneeActorId,
        });
      }

      if (workItem.status === "blocked") {
        pushLink({
          id: `work:${workItem.id}:blocked`,
          kind: "work_item",
          kindLabel: "Work",
          stateLabel: "阻塞",
          tone: "danger",
          fromAgentId: workItem.ownerActorId ?? null,
          fromLabel: resolveActorLabel(workItem.ownerActorId, employeeByActorId),
          toAgentId: workItem.batonActorId ?? null,
          toLabel: resolveActorLabel(workItem.batonActorId, employeeByActorId),
          summary: workItem.nextAction || workItem.displaySummary || workItem.title,
          updatedAt: workItem.updatedAt,
          focusAgentId: workItem.ownerActorId ?? workItem.batonActorId ?? null,
        });
      }
    });

  [...input.activeDispatches]
    .sort((left, right) => right.updatedAt - left.updatedAt)
    .forEach((dispatch) => {
      if (dispatch.status === "answered" || dispatch.status === "superseded") {
        return;
      }
      const checkout = describeDispatchCheckout({
        dispatch,
        resolveActorLabel: (actorId) => resolveActorLabel(actorId, employeeByActorId),
      });
      dispatch.targetActorIds.forEach((targetActorId) => {
        pushLink({
          id: `dispatch:${dispatch.id}:${targetActorId}`,
          kind: "dispatch",
          kindLabel: "Dispatch",
          stateLabel: checkout.stateLabel,
          tone: checkout.tone === "danger" ? "danger" : checkout.tone === "warning" ? "warning" : "info",
          fromAgentId: dispatch.fromActorId ?? null,
          fromLabel: resolveActorLabel(dispatch.fromActorId, employeeByActorId),
          toAgentId: targetActorId,
          toLabel: resolveActorLabel(targetActorId, employeeByActorId),
          summary: checkout.detail,
          updatedAt: dispatch.updatedAt,
          focusAgentId: targetActorId,
        });
      });
    });

  [...input.activeSupportRequests]
    .sort((left, right) => right.updatedAt - left.updatedAt)
    .forEach((request) => {
      if (request.status === "fulfilled" || request.status === "cancelled") {
        return;
      }
      pushLink({
        id: `support:${request.id}`,
        kind: "support_request",
        kindLabel: "Support",
        stateLabel:
          request.status === "blocked"
            ? "支援阻塞"
            : request.status === "in_progress"
              ? "支援中"
              : "待支援",
        tone:
          request.status === "blocked"
            ? "danger"
            : request.status === "in_progress"
              ? "info"
              : "warning",
        fromAgentId: request.requestedByActorId,
        fromLabel: resolveActorLabel(request.requestedByActorId, employeeByActorId),
        toAgentId: request.ownerActorId ?? null,
        toLabel:
          request.ownerActorId != null
            ? resolveActorLabel(request.ownerActorId, employeeByActorId)
            : `${resolveDepartmentLabel(request.targetDepartmentId, input.company)} 团队`,
        summary: request.detail || request.summary,
        updatedAt: request.updatedAt,
        focusAgentId: request.ownerActorId ?? request.requestedByActorId,
      });
    });

  [...input.activeEscalations]
    .sort((left, right) => right.updatedAt - left.updatedAt)
    .forEach((escalation) => {
      if (escalation.status !== "open" && escalation.status !== "acknowledged") {
        return;
      }
      const sourceSupportRequest = supportRequestsById.get(escalation.sourceId);
      const sourceWorkItem = workItemsById.get(escalation.sourceId) ?? (
        escalation.workItemId ? workItemsById.get(escalation.workItemId) : undefined
      );
      const sourceActorId =
        sourceSupportRequest?.ownerActorId ??
        sourceSupportRequest?.requestedByActorId ??
        sourceWorkItem?.ownerActorId ??
        sourceWorkItem?.batonActorId ??
        null;
      pushLink({
        id: `escalation:${escalation.id}`,
        kind: "escalation",
        kindLabel: "Escalation",
        stateLabel: escalation.status === "acknowledged" ? "处理中" : "已升级",
        tone: "danger",
        fromAgentId: sourceActorId,
        fromLabel: resolveActorLabel(sourceActorId, employeeByActorId),
        toAgentId: escalation.targetActorId,
        toLabel: resolveActorLabel(escalation.targetActorId, employeeByActorId),
        summary: escalation.reason,
        updatedAt: escalation.updatedAt,
        focusAgentId: escalation.targetActorId,
      });
    });

  const toneRank = { danger: 0, warning: 1, info: 2 } as const;
  return links
    .sort((left, right) => {
      if (toneRank[left.tone] !== toneRank[right.tone]) {
        return toneRank[left.tone] - toneRank[right.tone];
      }
      return right.updatedAt - left.updatedAt;
    })
    .slice(0, 8);
}

export function buildRuntimeInspectorSurface(input: RuntimeInspectorInput): RuntimeInspectorSurface | null {
  if (!input.activeCompany) {
    return null;
  }

  const company = input.activeCompany;
  const fallbackStatuses = buildCanonicalAgentStatusProjection({
    company,
    activeWorkItems: input.activeWorkItems,
    activeDispatches: input.activeDispatches,
    activeSupportRequests: input.activeSupportRequests,
    activeEscalations: input.activeEscalations,
    activeAgentRuntime: input.activeAgentRuntime,
    activeAgentSessions: input.activeAgentSessions,
  });
  const authorityHealth =
    input.activeAgentStatuses.length > 0
      ? input.activeAgentStatusHealth ??
        buildCanonicalAgentStatusHealth({
          company,
          statuses: input.activeAgentStatuses,
          source: "authority",
          generatedAt: Date.now(),
          note: null,
        })
      : null;
  const fallbackHealth = buildCanonicalAgentStatusHealth({
    company,
    statuses: fallbackStatuses,
    source: "fallback",
    generatedAt: Date.now(),
    note: authorityHealth?.coverage === "authority_partial"
      ? `Authority 仅覆盖 ${authorityHealth.coveredAgentCount}/${authorityHealth.expectedAgentCount} 名成员，缺失成员已局部标记为恢复/兼容来源。`
      : "Authority 当前没有可用的 canonical agent statuses，页面正在展示恢复/兼容投影。",
  });
  const statusHealth =
    authorityHealth?.coverage === "authority_complete"
      ? authorityHealth
      : authorityHealth?.coverage === "authority_partial"
        ? authorityHealth
        : fallbackHealth;
  const canonicalByAgentId = new Map(
    fallbackStatuses.map((status) => [status.agentId, status] as const),
  );
  const statusOriginByAgentId = new Map<string, "authority" | "fallback">(
    fallbackStatuses.map((status) => [status.agentId, "fallback"] as const),
  );
  input.activeAgentStatuses.forEach((status) => {
    canonicalByAgentId.set(status.agentId, status);
    statusOriginByAgentId.set(status.agentId, "authority");
  });
  const runtimeByAgentId = new Map(
    input.activeAgentRuntime.map((runtime) => [runtime.agentId, runtime] as const),
  );
  const sessionsByAgentId = new Map<string, AgentSessionRecord[]>();
  const runsByAgentId = new Map<string, AgentRunRecord[]>();

  input.activeAgentSessions.forEach((session) => {
    if (!session.agentId) {
      return;
    }
    const group = sessionsByAgentId.get(session.agentId) ?? [];
    group.push(session);
    sessionsByAgentId.set(session.agentId, group);
  });

  input.activeAgentRuns.forEach((run) => {
    if (!run.agentId) {
      return;
    }
    const group = runsByAgentId.get(run.agentId) ?? [];
    group.push(run);
    runsByAgentId.set(run.agentId, group);
  });

  const agents = company.employees
    .map((employee) => {
      const runtime = runtimeByAgentId.get(employee.agentId) ?? {
        agentId: employee.agentId,
        providerId: "openclaw",
        availability: "no_signal" as const,
        activeSessionKeys: [],
        activeRunIds: [],
        lastSeenAt: null,
        lastBusyAt: null,
        lastIdleAt: null,
        latestTerminalAt: null,
        latestTerminalSummary: null,
        currentWorkload: "free" as const,
        runtimeEvidence: [],
      };
      const canonical = canonicalByAgentId.get(employee.agentId) ?? {
        agentId: employee.agentId,
        runtimeState: runtime.availability,
        coordinationState: "none" as const,
        interventionState: "healthy" as const,
        reason: runtime.availability === "offline" ? "Provider 明确报告当前节点不可达。" : "当前没有观察到可信 runtime 信号。",
        currentAssignment: "当前没有显式挂载的任务",
        currentObjective: "当前没有新的协作目标。",
        latestSignalAt: null,
        activeSessionCount: runtime.activeSessionKeys.length,
        activeRunCount: runtime.activeRunIds.length,
        openDispatchCount: 0,
        blockedDispatchCount: 0,
        openSupportRequestCount: 0,
        blockedSupportRequestCount: 0,
        openRequestCount: 0,
        blockedRequestCount: 0,
        openHandoffCount: 0,
        blockedHandoffCount: 0,
        openEscalationCount: 0,
        blockedWorkItemCount: 0,
        primaryWorkItemId: null,
      };
      const sessions = [...(sessionsByAgentId.get(employee.agentId) ?? [])].sort(
        (left, right) => (right.lastSeenAt ?? 0) - (left.lastSeenAt ?? 0),
      );
      const runs = [...(runsByAgentId.get(employee.agentId) ?? [])].sort(
        (left, right) => right.lastEventAt - left.lastEventAt,
      );
      const department = company.departments?.find((entry) => entry.id === employee.departmentId) ?? null;
      const departmentKind = inferDepartmentKind(company, department);
      const primaryWorkItem =
        input.activeWorkItems.find((item) => item.id === canonical.primaryWorkItemId) ?? null;
      const attention = resolveAttentionFromCanonical(canonical);
      const activityLabel = resolveActivityLabel({
        employee,
        runtimeState: canonical.runtimeState,
        coordinationState: canonical.coordinationState,
        interventionState: canonical.interventionState,
      });
      const sceneZoneId = resolveSceneZone(employee, departmentKind);

      return {
        agentId: employee.agentId,
        nickname: employee.nickname,
        role: employee.role,
        avatarJobId: employee.avatarJobId,
        employee,
        departmentId: employee.departmentId ?? null,
        departmentName: department?.name ?? "未分配部门",
        departmentKind,
        statusOrigin: statusOriginByAgentId.get(employee.agentId) ?? "fallback",
        availability: canonical.runtimeState,
        runtimeState: canonical.runtimeState,
        coordinationState: canonical.coordinationState,
        interventionState: canonical.interventionState,
        legacyStatus: mapAgentRuntimeAvailabilityToLegacyStatus(canonical.runtimeState),
        workload: runtime.currentWorkload,
        attention,
        attentionReason: resolveAttentionReasonFromCanonical(canonical),
        reason: canonical.reason,
        activeSessionCount: canonical.activeSessionCount,
        activeRunCount: canonical.activeRunCount,
        lastSeenAt: runtime.lastSeenAt,
        lastBusyAt: runtime.lastBusyAt,
        lastIdleAt: runtime.lastIdleAt,
        latestSignalAt: canonical.latestSignalAt,
        currentAssignment: canonical.currentAssignment,
        currentObjective: canonical.currentObjective,
        activityLabel,
        sceneZoneId,
        sceneZoneLabel: resolveSceneZoneLabel(sceneZoneId),
        sceneActivityLabel: resolveSceneActivityLabel({
          activityLabel,
          runtimeState: canonical.runtimeState,
          currentAssignment: canonical.currentAssignment,
        }),
        runtimeEvidence: runtime.runtimeEvidence,
        sessions,
        runs,
        primaryWorkItem,
        openDispatchCount: canonical.openDispatchCount,
        blockedDispatchCount: canonical.blockedDispatchCount,
        openSupportRequestCount: canonical.openSupportRequestCount,
        blockedSupportRequestCount: canonical.blockedSupportRequestCount,
        openEscalationCount: canonical.openEscalationCount,
        blockedWorkItemCount: canonical.blockedWorkItemCount,
      } satisfies RuntimeInspectorAgentSurface;
    })
    .sort((left, right) => {
      const rankDelta = rankAgentForFocus(left) - rankAgentForFocus(right);
      if (rankDelta !== 0) {
        return rankDelta;
      }
      return (right.latestSignalAt ?? 0) - (left.latestSignalAt ?? 0);
    });

  const zoneOrder: RuntimeSceneZoneId[] = [
    "command-deck",
    "tech-lab",
    "ops-rail",
    "people-hub",
    "studio-floor",
  ];
  const sceneZones = zoneOrder.map((zoneId) => {
    const zoneAgents = agents.filter((agent) => agent.sceneZoneId === zoneId);
    return {
      id: zoneId,
      label: resolveSceneZoneLabel(zoneId),
      description: resolveSceneZoneDescription(zoneId),
      tone: resolveSceneZoneTone(zoneId),
      agents: zoneAgents,
      busyCount: zoneAgents.filter((agent) => agent.availability === "busy").length,
      attentionCount: zoneAgents.filter((agent) => agent.attention !== "healthy").length,
      status:
        zoneAgents.some((agent) => agent.attention === "critical")
          ? "critical"
          : zoneAgents.some((agent) => agent.attention === "watch")
            ? "watch"
            : "healthy",
    } satisfies RuntimeInspectorSceneZone;
  });

  const focusAgent = agents[0] ?? null;
  const replay = agents
    .map((agent) => buildReplayEvent(agent))
    .filter((event): event is NonNullable<ReturnType<typeof buildReplayEvent>> => Boolean(event))
    .sort((left, right) => (right.timestamp ?? 0) - (left.timestamp ?? 0))
    .slice(0, 8);
  const chainLinks = buildRuntimeChainLinks({
    company,
    activeWorkItems: input.activeWorkItems,
    activeDispatches: input.activeDispatches,
    activeSupportRequests: input.activeSupportRequests,
    activeEscalations: input.activeEscalations,
  });
  const triageQueue = agents
    .filter((agent) =>
      agent.attention !== "healthy" ||
      agent.coordinationState !== "none" ||
      agent.runtimeState === "busy",
    )
    .slice(0, 6);
  const watchlist = agents.filter((agent) => agent.attention !== "healthy").slice(0, 5);
  const timeline = agents
    .filter((agent) => agent.latestSignalAt != null || agent.coordinationState !== "none")
    .map((agent) => buildTimelineEvent(agent))
    .sort((left, right) => (right.timestamp ?? 0) - (left.timestamp ?? 0))
    .slice(0, 8);
  const historyWindow = buildHistoryWindow({
    replay,
    chainLinks,
    timeline,
  });
  const recommendedActions = buildRecommendedActions({
    focusAgent,
    agents,
  });

  return {
    company,
    agents,
    statusHealth,
    statusCoverage: describeStatusCoverage(statusHealth, company),
    sceneZones,
    focusAgent,
    replay,
    historyWindow,
    chainLinks,
    triageQueue,
    watchlist,
    timeline,
    recommendedActions,
    busyAgents: agents.filter((agent) => agent.availability === "busy").length,
    degradedAgents: agents.filter((agent) => agent.availability === "degraded").length,
    criticalAgents: agents.filter((agent) => agentStatusNeedsIntervention(canonicalByAgentId.get(agent.agentId) ?? {
      agentId: agent.agentId,
      runtimeState: agent.runtimeState,
      coordinationState: agent.coordinationState,
      interventionState: agent.interventionState,
      reason: agent.reason,
      currentAssignment: agent.currentAssignment,
      currentObjective: agent.currentObjective,
      latestSignalAt: agent.latestSignalAt,
      activeSessionCount: agent.activeSessionCount,
      activeRunCount: agent.activeRunCount,
      openDispatchCount: agent.openDispatchCount,
      blockedDispatchCount: agent.blockedDispatchCount,
      openSupportRequestCount: agent.openSupportRequestCount,
      blockedSupportRequestCount: agent.blockedSupportRequestCount,
      openRequestCount: 0,
      blockedRequestCount: 0,
      openHandoffCount: 0,
      blockedHandoffCount: 0,
      openEscalationCount: agent.openEscalationCount,
      blockedWorkItemCount: agent.blockedWorkItemCount,
      primaryWorkItemId: agent.primaryWorkItem?.id ?? null,
    })).length,
    activeRuns: input.activeAgentRuns.length,
    activeSessions: new Set(
      input.activeAgentRuntime.flatMap((runtime) => runtime.activeSessionKeys),
    ).size,
  };
}

export function useRuntimeInspectorQuery() {
  return useCompanyRuntimeStore(useShallow(selectRuntimeInspectorState));
}

export function useRuntimeInspectorViewModel() {
  const runtimeState = useRuntimeInspectorQuery();
  const authoritySync = useAuthorityRuntimeSyncStore(
    useShallow((state) => ({
      lastAppliedSource: state.lastAppliedSource,
      lastPullAt: state.lastPullAt,
      lastPushAt: state.lastPushAt,
      lastError: state.lastError,
      lastErrorAt: state.lastErrorAt,
    })),
  );
  const surface = useMemo(() => buildRuntimeInspectorSurface(runtimeState), [runtimeState]);
  const statusSource: RuntimeInspectorStatusSource =
    surface?.statusHealth.coverage ?? "fallback";
  return {
    ...runtimeState,
    surface,
    statusSource,
    authoritySync,
  };
}
