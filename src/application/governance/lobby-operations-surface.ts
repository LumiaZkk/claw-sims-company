import { buildExecutionFocusSummary, type ExecutionFocusSummary } from "./focus-summary";
import {
  buildEmployeeOperationalInsights,
  buildOutcomeReport,
  buildRetrospectiveSnapshot,
} from "./company-insights";
import { summarizeRequestHealth } from "../delegation/request-health";
import {
  isBlockedExecutionState,
  isWaitingExecutionState,
  resolveExecutionState,
} from "../mission/execution-state";
import { resolveCompanyKnowledge } from "../artifact/shared-knowledge";
import type { CeoControlSurfaceSnapshot } from "./ceo-control-surface";
import type { RequirementScope } from "../mission/requirement-scope";
import type { AgentListEntry, CronJob, GatewaySessionRow } from "../gateway";
import type { ResolvedExecutionState } from "../mission/execution-state";
import type { Company, EmployeeRef } from "../../domain/org/types";
import type { HandoffRecord, RequestRecord } from "../../domain/delegation/types";
import type { WorkItemRecord } from "../../domain/mission/types";
import type { SlaAlert } from "./sla-rules";
import {
  isSessionActive,
  resolveSessionTitle,
  resolveSessionUpdatedAt,
} from "../../lib/sessions";

export type LobbyUnifiedStreamItem = {
  key: string;
  type: "session" | "cron";
  timestamp: number;
  employee?: LobbyEmployeeCardData;
  agentId?: string;
  jobId?: string;
  active: boolean;
  title: string;
  preview?: string;
  execution: ResolvedExecutionState;
  focusSummary: ExecutionFocusSummary;
};

export type LobbyEmployeeCardData = EmployeeRef & {
  status: "running" | "idle" | "stopped";
  realName: string;
  skills: string[];
  lastActiveAt: number;
  execution: ResolvedExecutionState;
  focusSummary: ExecutionFocusSummary;
};

export type LobbyOperationsSurface = {
  employeesData: LobbyEmployeeCardData[];
  scopedEmployeesData: LobbyEmployeeCardData[];
  displayEmployeesData: LobbyEmployeeCardData[];
  activeSessions: Array<GatewaySessionRow & { agentId: string }>;
  completedSessions: Array<GatewaySessionRow & { agentId: string }>;
  unifiedStream: LobbyUnifiedStreamItem[];
  knowledgeItems: ReturnType<typeof resolveCompanyKnowledge>;
  retrospective: ReturnType<typeof buildRetrospectiveSnapshot>;
  blockedCount: number;
  waitingCount: number;
  runningCount: number;
  visibleManualCount: number;
  visibleHandoffRecords: HandoffRecord[];
  visiblePendingHandoffs: number;
  visibleBlockedHandoffs: number;
  visibleRequestHealth: ReturnType<typeof summarizeRequestHealth>;
  visibleSlaAlerts: SlaAlert[];
  teamHealthLabel: string;
  teamHealthClass: string;
};

function buildEmployeeFocusSummary(input: {
  company: Company;
  agentId: string;
  sessionKey?: string;
  execution: ResolvedExecutionState;
  roleLabel: string;
  companyTasks: LobbyOperationsSurfaceInput["companyTasks"];
  companyHandoffs: LobbyOperationsSurfaceInput["companyHandoffs"];
  companyRequests: LobbyOperationsSurfaceInput["companyRequests"];
  slaAlerts: LobbyOperationsSurfaceInput["slaAlerts"];
  ceoSurface: CeoControlSurfaceSnapshot;
}): ExecutionFocusSummary {
  const {
    company,
    agentId,
    sessionKey,
    execution,
    roleLabel,
    companyTasks,
    companyHandoffs,
    companyRequests,
    slaAlerts,
    ceoSurface,
  } = input;
  const relatedTask =
    [...companyTasks]
      .filter(
        (task) =>
          task.sessionKey === sessionKey ||
          task.ownerAgentId === agentId ||
          task.agentId === agentId ||
          task.assigneeAgentIds?.includes(agentId),
      )
      .sort((left, right) => right.updatedAt - left.updatedAt)[0] ?? null;
  const relatedHandoffs = companyHandoffs.filter(
    (handoff) =>
      handoff.sessionKey === sessionKey ||
      handoff.fromAgentId === agentId ||
      handoff.toAgentIds.includes(agentId),
  );
  const relatedRequests = companyRequests.filter(
    (request) =>
      request.sessionKey === sessionKey ||
      request.fromAgentId === agentId ||
      request.toAgentIds.includes(agentId),
  );
  const relatedAlerts = slaAlerts.filter(
    (alert) => alert.sessionKey === sessionKey || alert.ownerAgentId === agentId,
  );

  return buildExecutionFocusSummary({
    company,
    targetAgentId: agentId,
    targetRoleLabel: roleLabel,
    execution,
    task: relatedTask,
    requests: relatedRequests,
    handoffs: relatedHandoffs,
    takeoverPack: null,
    ceoSurface,
    alerts: relatedAlerts,
  });
}

type LobbyOperationsSurfaceInput = {
  activeCompany: Company;
  agentsCache: AgentListEntry[];
  cronCache: CronJob[];
  currentTime: number;
  companySessions: Array<GatewaySessionRow & { agentId: string }>;
  sessionsByAgent: Map<string, Array<GatewaySessionRow & { agentId: string }>>;
  sessionExecutions: Map<string, ResolvedExecutionState>;
  requirementScope: RequirementScope | null;
  companyTasks: NonNullable<Company["tasks"]>;
  companyHandoffs: HandoffRecord[];
  companyRequests: RequestRecord[];
  slaAlerts: SlaAlert[];
  ceoSurface: CeoControlSurfaceSnapshot;
  primaryWorkItem: WorkItemRecord | null;
  isStrategicRequirement: boolean;
};

export function buildLobbyOperationsSurface(
  input: LobbyOperationsSurfaceInput,
): LobbyOperationsSurface {
  const {
    activeCompany,
    agentsCache,
    cronCache,
    currentTime,
    companySessions,
    sessionsByAgent,
    sessionExecutions,
    requirementScope,
    companyTasks,
    companyHandoffs,
    companyRequests,
    slaAlerts,
    ceoSurface,
    primaryWorkItem,
    isStrategicRequirement,
  } = input;

  const employeesData = activeCompany.employees.map((employee) => {
    const liveAgent = agentsCache.find((agent) => agent.id === employee.agentId);
    const employeeSessions = sessionsByAgent.get(employee.agentId) ?? [];
    const lastActiveAt = employeeSessions.reduce(
      (latest, session) => Math.max(latest, resolveSessionUpdatedAt(session)),
      0,
    );
    const status: LobbyEmployeeCardData["status"] = employeeSessions.some((session) =>
      isSessionActive(session, currentTime),
    )
      ? "running"
      : lastActiveAt > 0 || Boolean(liveAgent)
        ? "idle"
        : "stopped";
    const latestSession = employeeSessions[0];
    const resolvedExecution =
      (latestSession
        ? sessionExecutions.get(latestSession.key) ??
          resolveExecutionState({
            session: latestSession,
            now: currentTime,
          })
        : resolveExecutionState({
            fallbackState: status === "stopped" ? "unknown" : "idle",
          }));
    const focusSummary = buildEmployeeFocusSummary({
      company: activeCompany,
      agentId: employee.agentId,
      sessionKey: latestSession?.key,
      execution: resolvedExecution,
      roleLabel: employee.role,
      companyTasks,
      companyHandoffs,
      companyRequests,
      slaAlerts,
      ceoSurface,
    });

    return {
      ...employee,
      status,
      realName: liveAgent?.name || `NO.${employee.agentId.slice(0, 8).toUpperCase()}`,
      skills: liveAgent?.identity?.theme ? [] : ((employee as { skills?: string[] }).skills ?? []),
      lastActiveAt,
      execution: resolvedExecution,
      focusSummary,
    };
  });

  const companyAgentIds = new Set(activeCompany.employees.map((employee) => employee.agentId));
  const requirementParticipantAgentIds = new Set(requirementScope?.participantAgentIds ?? []);
  const scopedEmployeesData = requirementScope
    ? employeesData.filter((employee) => requirementParticipantAgentIds.has(employee.agentId))
    : employeesData;
  const displayEmployeesData = requirementScope
    ? [
        ...employeesData.filter((employee) => requirementParticipantAgentIds.has(employee.agentId)),
        ...employeesData.filter((employee) => !requirementParticipantAgentIds.has(employee.agentId)),
      ]
    : employeesData;
  const scopedSessions = requirementScope
    ? companySessions.filter((session) => requirementParticipantAgentIds.has(session.agentId))
    : companySessions;
  const activeSessions = scopedSessions.filter((session) => isSessionActive(session, currentTime));
  const completedSessions = scopedSessions.filter((session) => !isSessionActive(session, currentTime));

  const unifiedStream: LobbyUnifiedStreamItem[] = [
    ...scopedSessions.map((session) => {
      const employee = employeesData.find((item) => item.agentId === session.agentId);
      const execution =
        sessionExecutions.get(session.key) ??
        employee?.execution ??
        resolveExecutionState({
          session,
          evidenceTexts: [session.lastMessagePreview],
          now: currentTime,
        });
      const focusSummary =
        employee?.focusSummary ??
        buildEmployeeFocusSummary({
          company: activeCompany,
          agentId: session.agentId,
          sessionKey: session.key,
          execution,
          roleLabel: employee?.role ?? "会话",
          companyTasks,
          companyHandoffs,
          companyRequests,
          slaAlerts,
          ceoSurface,
        });

      return {
        key: session.key,
        type: "session" as const,
        timestamp: resolveSessionUpdatedAt(session),
        employee,
        active: isSessionActive(session, currentTime),
        title: resolveSessionTitle(session),
        preview: session.lastMessagePreview,
        execution,
        focusSummary,
      };
    }),
    ...cronCache
      .filter(
        (cron) =>
          cron.agentId &&
          companyAgentIds.has(cron.agentId) &&
          cron.state?.lastRunAtMs &&
          (!requirementScope || requirementParticipantAgentIds.has(cron.agentId)),
      )
      .map((cron) => {
        const employee = employeesData.find((item) => item.agentId === cron.agentId);
        const execution =
          cron.state?.lastStatus === "error"
            ? resolveExecutionState({
                evidenceTexts: ["tool failure", "班次执行失败"],
                fallbackState: "blocked_tool_failure",
              })
            : resolveExecutionState({
                evidenceTexts: [cron.state?.lastStatus === "running" ? "正在执行" : "已完成"],
                fallbackState: cron.state?.lastStatus === "running" ? "running" : "completed",
              });

        return {
          key: `cron-${cron.id}`,
          type: "cron" as const,
          timestamp: cron.state!.lastRunAtMs!,
          employee,
          agentId: cron.agentId,
          jobId: cron.id,
          active: cron.state?.lastStatus === "running",
          title: `自动化执行: ${cron.name}`,
          preview: cron.state?.lastStatus === "error" ? "❌ 自动化执行失败" : "✅ 自动化已完成",
          execution,
          focusSummary: buildExecutionFocusSummary({
            company: activeCompany,
            targetAgentId: cron.agentId,
            targetRoleLabel: employee?.role ?? "自动化执行",
            execution,
            task: null,
            requests: [],
            handoffs: [],
            takeoverPack: null,
            alerts: [],
          }),
        };
      }),
  ]
    .sort((left, right) => right.timestamp - left.timestamp)
    .slice(0, 15);

  const knowledgeItems = resolveCompanyKnowledge(activeCompany);
  const employeeInsights = buildEmployeeOperationalInsights({
    company: activeCompany,
    sessions: companySessions,
    now: currentTime,
  });
  const outcomeReport = buildOutcomeReport({
    company: activeCompany,
    employeeInsights,
    now: currentTime,
  });
  const retrospective = buildRetrospectiveSnapshot({
    company: {
      ...activeCompany,
      knowledgeItems,
    },
    outcome: outcomeReport,
    employeeInsights,
  });
  const requestHealth = summarizeRequestHealth(companyRequests);

  const latestEmployeeStates = isStrategicRequirement
    ? []
    : scopedEmployeesData.map((employee) => employee.execution.state);
  const blockedCount = isStrategicRequirement
    ? primaryWorkItem?.status === "blocked"
      ? 1
      : 0
    : latestEmployeeStates.filter((state) => isBlockedExecutionState(state)).length;
  const waitingCount = isStrategicRequirement
    ? primaryWorkItem?.status === "waiting_owner" || primaryWorkItem?.status === "waiting_review"
      ? 1
      : 0
    : latestEmployeeStates.filter((state) => isWaitingExecutionState(state)).length;
  const manualCount = isStrategicRequirement
    ? 0
    : latestEmployeeStates.filter((state) => state === "manual_takeover_required").length;
  const runningCount = isStrategicRequirement
    ? primaryWorkItem && primaryWorkItem.status === "active"
      ? 1
      : 0
    : latestEmployeeStates.filter((state) => state === "running").length;
  const visibleHandoffRecords = isStrategicRequirement ? [] : companyHandoffs;
  const visiblePendingHandoffs = visibleHandoffRecords.filter((handoff) => handoff.status !== "completed").length;
  const visibleBlockedHandoffs = visibleHandoffRecords.filter((handoff) => handoff.status === "blocked").length;
  const visibleRequestHealth = isStrategicRequirement
    ? {
        total: 0,
        active: 0,
        pending: 0,
        acknowledged: 0,
        blocked: 0,
        answered: 0,
        superseded: 0,
      }
    : requestHealth;
  const visibleSlaAlerts = isStrategicRequirement ? [] : slaAlerts;
  const visibleManualCount = isStrategicRequirement ? 0 : manualCount;
  const teamHealthLabel =
    visibleManualCount > 0
      ? `${visibleManualCount} 处需人工介入`
      : blockedCount > 0
        ? `${blockedCount} 处阻塞待处理`
        : waitingCount > 0
          ? `${waitingCount} 项待跟进`
          : "当前推进稳定";
  const teamHealthClass =
    visibleManualCount > 0 || blockedCount > 0
      ? "text-rose-600 bg-rose-50"
      : waitingCount > 0
        ? "text-amber-700 bg-amber-50"
        : "text-green-600 bg-green-50";

  return {
    employeesData,
    scopedEmployeesData,
    displayEmployeesData,
    activeSessions,
    completedSessions,
    unifiedStream,
    knowledgeItems,
    retrospective,
    blockedCount,
    waitingCount,
    runningCount,
    visibleManualCount,
    visibleHandoffRecords,
    visiblePendingHandoffs,
    visibleBlockedHandoffs,
    visibleRequestHealth,
    visibleSlaAlerts,
    teamHealthLabel,
    teamHealthClass,
  };
}
