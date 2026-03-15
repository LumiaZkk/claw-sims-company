import type {
  AgentRuntimeAvailability,
  CanonicalAgentStatusHealthRecord,
  CanonicalAgentStatusRecord,
  CoordinationState,
  InterventionState,
} from "../agent-runtime";
import type { Company, EmployeeRef } from "../../domain/org/types";
import type {
  RuntimeAttentionLevel,
  RuntimeInspectorAgentSurface,
  RuntimeInspectorHistoryEvent,
  RuntimeInspectorRecommendedAction,
  RuntimeInspectorReplayEvent,
  RuntimeInspectorSurface,
  RuntimeInspectorTimelineEvent,
  RuntimeSceneZoneId,
} from "./runtime-inspector-types";

export function resolveSceneZone(
  employee: EmployeeRef,
  departmentKind: "meta" | "support" | "business",
): RuntimeSceneZoneId {
  if (employee.metaRole === "ceo") {
    return "command-deck";
  }
  if (employee.metaRole === "cto" || /cto|技术|研发|工程|开发|架构/i.test(employee.role)) {
    return "tech-lab";
  }
  if (employee.metaRole === "coo" || /运营|交付|流程|项目|排期/i.test(employee.role)) {
    return "ops-rail";
  }
  if (employee.metaRole === "hr" || /hr|招聘|人事|组织|人才/i.test(employee.role)) {
    return "people-hub";
  }
  if (departmentKind === "support") {
    return "ops-rail";
  }
  return "studio-floor";
}

export function resolveSceneZoneLabel(zoneId: RuntimeSceneZoneId): string {
  switch (zoneId) {
    case "command-deck":
      return "Command Deck";
    case "tech-lab":
      return "Tech Lab";
    case "ops-rail":
      return "Ops Rail";
    case "people-hub":
      return "People Hub";
    case "studio-floor":
    default:
      return "Studio Floor";
  }
}

export function resolveSceneZoneDescription(zoneId: RuntimeSceneZoneId): string {
  switch (zoneId) {
    case "command-deck":
      return "CEO 与管理层做目标收敛、调度和拍板。";
    case "tech-lab":
      return "技术、工具和系统类任务在这里点亮。";
    case "ops-rail":
      return "协作编排、交接、发布和恢复动作在这里运转。";
    case "people-hub":
      return "组织、招聘、编制和岗位配置在这里推进。";
    case "studio-floor":
    default:
      return "业务执行、创作和交付主线在这里持续推进。";
  }
}

export function resolveSceneZoneTone(zoneId: RuntimeSceneZoneId): string {
  switch (zoneId) {
    case "command-deck":
      return "from-amber-50 via-white to-orange-50";
    case "tech-lab":
      return "from-cyan-50 via-white to-indigo-50";
    case "ops-rail":
      return "from-emerald-50 via-white to-teal-50";
    case "people-hub":
      return "from-rose-50 via-white to-fuchsia-50";
    case "studio-floor":
    default:
      return "from-sky-50 via-white to-violet-50";
  }
}

export function resolveActivityLabel(input: {
  employee: EmployeeRef;
  runtimeState: AgentRuntimeAvailability;
  coordinationState: CoordinationState;
  interventionState: InterventionState;
}): string {
  if (input.interventionState === "takeover_required") {
    return "接管中";
  }
  if (input.coordinationState === "explicit_blocked") {
    return "排障中";
  }
  if (
    input.coordinationState === "executing" &&
    (input.runtimeState === "idle" || input.runtimeState === "no_signal" || input.runtimeState === "degraded")
  ) {
    return "恢复执行中";
  }
  if (input.runtimeState === "offline") {
    return "离线";
  }
  if (input.runtimeState === "no_signal") {
    return "无信号";
  }
  if (input.runtimeState === "degraded") {
    return "恢复中";
  }
  if (input.coordinationState === "waiting_input") {
    return "待输入";
  }
  if (input.coordinationState === "waiting_peer") {
    return input.interventionState === "overdue" || input.interventionState === "escalated"
      ? "待催办"
      : "待协作";
  }
  if (input.coordinationState === "pending_ack") {
    return "待确认";
  }
  if (input.coordinationState === "completed") {
    return "已收口";
  }
  if (input.runtimeState === "busy") {
    if (input.employee.metaRole === "ceo") {
      return "调度中";
    }
    if (input.employee.metaRole === "cto" || /技术|工程|开发|研发|架构/i.test(input.employee.role)) {
      return "构建中";
    }
    if (input.employee.metaRole === "hr" || /招聘|人事|组织/i.test(input.employee.role)) {
      return "招募中";
    }
    if (input.employee.metaRole === "coo" || /运营|交付|排期|流程/i.test(input.employee.role)) {
      return "编排中";
    }
    if (/写|编辑|设计|内容|市场|产品/i.test(input.employee.role)) {
      return "创作中";
    }
    return "执行中";
  }
  return "待命中";
}

export function resolveSceneActivityLabel(input: {
  activityLabel: string;
  runtimeState: AgentRuntimeAvailability;
  currentAssignment: string;
}): string {
  if (
    (input.runtimeState === "busy" || input.activityLabel === "恢复执行中") &&
    input.currentAssignment.trim().length > 0
  ) {
    return input.currentAssignment;
  }
  return input.activityLabel;
}

export function resolveAttentionFromCanonical(status: CanonicalAgentStatusRecord): RuntimeAttentionLevel {
  if (
    status.interventionState === "takeover_required" ||
    status.interventionState === "escalated" ||
    status.coordinationState === "explicit_blocked"
  ) {
    return "critical";
  }
  if (
    status.interventionState === "overdue" ||
    status.coordinationState === "waiting_peer" ||
    status.coordinationState === "waiting_input" ||
    status.coordinationState === "pending_ack"
  ) {
    return "watch";
  }
  return "healthy";
}

export function resolveAttentionReasonFromCanonical(status: CanonicalAgentStatusRecord): string {
  if (status.interventionState === "takeover_required") {
    return "当前链路已要求人工接管，需要优先处理。";
  }
  if (status.interventionState === "escalated") {
    return "当前链路已升级处理，需要优先恢复。";
  }
  if (status.interventionState === "overdue") {
    return "当前链路等待时间已超过阈值，需要持续跟进。";
  }
  if (status.coordinationState === "explicit_blocked") {
    return "当前链路存在明确阻塞，需要优先恢复。";
  }
  if (status.coordinationState === "waiting_input") {
    return "当前主线在等待输入或 review。";
  }
  if (status.coordinationState === "waiting_peer" || status.coordinationState === "pending_ack") {
    return "当前链路仍在等待协作方继续推进。";
  }
  return status.reason;
}

export function describeStatusCoverage(
  health: CanonicalAgentStatusHealthRecord,
  company: Company,
): RuntimeInspectorSurface["statusCoverage"] {
  const missingLabels = health.missingAgentIds
    .map((agentId) => company.employees.find((employee) => employee.agentId === agentId)?.nickname ?? agentId)
    .slice(0, 4);
  if (health.coverage === "authority_complete") {
    return {
      label: "Authority 完整覆盖",
      detail: `已覆盖 ${health.coveredAgentCount}/${health.expectedAgentCount} 名成员。`,
      missingAgentIds: [],
    };
  }
  if (health.coverage === "authority_partial") {
    return {
      label: "Authority 局部覆盖",
      detail:
        missingLabels.length > 0
          ? `当前仅覆盖 ${health.coveredAgentCount}/${health.expectedAgentCount} 名成员，缺失 ${missingLabels.join("、")}；缺口部分仅作为恢复/兼容来源展示。`
          : `当前仅覆盖 ${health.coveredAgentCount}/${health.expectedAgentCount} 名成员。`,
      missingAgentIds: health.missingAgentIds,
    };
  }
  return {
    label: "恢复/兼容投影",
    detail:
      health.note ??
      `当前没有可用的 Authority canonical 状态，页面正在对 ${health.expectedAgentCount} 名成员展示恢复/兼容投影。`,
    missingAgentIds: health.missingAgentIds,
  };
}

export function rankAgentForFocus(agent: RuntimeInspectorAgentSurface): number {
  const attentionRank = { critical: 0, watch: 1, healthy: 2 } as const;
  const coordinationRank = {
    explicit_blocked: 0,
    waiting_input: 1,
    waiting_peer: 2,
    pending_ack: 3,
    executing: 4,
    completed: 5,
    none: 6,
  } as const;
  const runtimeRank = { busy: 0, degraded: 1, idle: 2, no_signal: 3, offline: 4 } as const;
  return (
    attentionRank[agent.attention] * 10_000 +
    coordinationRank[agent.coordinationState] * 1_000 +
    runtimeRank[agent.runtimeState] * 100 -
    Math.min(agent.latestSignalAt ?? 0, 99)
  );
}

export function buildTimelineEvent(agent: RuntimeInspectorAgentSurface): RuntimeInspectorTimelineEvent {
  if (agent.interventionState === "takeover_required") {
    return {
      id: `${agent.agentId}:takeover`,
      agentId: agent.agentId,
      nickname: agent.nickname,
      title: `${agent.nickname} 需要人工接管`,
      summary: agent.reason,
      timestamp: agent.latestSignalAt,
      tone: "danger",
    };
  }
  if (agent.coordinationState === "explicit_blocked" || agent.interventionState === "escalated") {
    return {
      id: `${agent.agentId}:blocked`,
      agentId: agent.agentId,
      nickname: agent.nickname,
      title: `${agent.nickname} 当前链路阻塞`,
      summary: agent.reason,
      timestamp: agent.latestSignalAt,
      tone: "danger",
    };
  }
  if (
    agent.interventionState === "overdue" ||
    agent.coordinationState === "waiting_input" ||
    agent.coordinationState === "waiting_peer"
  ) {
    return {
      id: `${agent.agentId}:waiting`,
      agentId: agent.agentId,
      nickname: agent.nickname,
      title: `${agent.nickname} 正在等待协作继续`,
      summary: agent.reason,
      timestamp: agent.latestSignalAt,
      tone: "warning",
    };
  }
  if (agent.coordinationState === "completed") {
    return {
      id: `${agent.agentId}:completed`,
      agentId: agent.agentId,
      nickname: agent.nickname,
      title: `${agent.nickname} 最近完成一段协作`,
      summary: agent.reason,
      timestamp: agent.latestSignalAt,
      tone: "success",
    };
  }
  if (agent.coordinationState === "executing") {
    return {
      id: `${agent.agentId}:executing`,
      agentId: agent.agentId,
      nickname: agent.nickname,
      title: `${agent.nickname} 正在执行`,
      summary: agent.reason,
      timestamp: agent.latestSignalAt,
      tone: "info",
    };
  }
  return {
    id: `${agent.agentId}:status`,
    agentId: agent.agentId,
    nickname: agent.nickname,
    title: `${agent.nickname} 当前待命`,
    summary: agent.reason,
    timestamp: agent.latestSignalAt,
    tone: agent.runtimeState === "no_signal" || agent.runtimeState === "offline" ? "warning" : "info",
  };
}

export function buildReplayEvent(agent: RuntimeInspectorAgentSurface): RuntimeInspectorReplayEvent | null {
  const activeRun = agent.runs[0] ?? null;
  const recoveredExecutionContext =
    agent.sessions
      .map((session) => session.executionContext ?? null)
      .filter((context): context is NonNullable<typeof agent.sessions[number]["executionContext"]> => Boolean(context))
      .sort((left, right) => right.updatedAt - left.updatedAt)[0] ?? null;
  const latestTerminalSession =
    agent.sessions.find((session) => session.lastTerminalRunState && session.lastTerminalSummary) ?? null;
  const recentEvidence = agent.runtimeEvidence[0] ?? null;

  if (activeRun) {
    const hasTool = activeRun.streamKindsSeen.includes("tool");
    const hasAssistant = activeRun.streamKindsSeen.includes("assistant");
    return {
      id: `${agent.agentId}:replay:run:${activeRun.runId}`,
      agentId: agent.agentId,
      nickname: agent.nickname,
      title: hasTool
        ? `${agent.nickname} 正在跑 ${activeRun.toolNamesSeen[0] ?? "工具链"}`
        : hasAssistant
          ? `${agent.nickname} 正在产出回复`
          : `${agent.nickname} 正在执行 run`,
      summary: agent.currentAssignment,
      timestamp: activeRun.lastEventAt,
      tone: "info",
      phaseLabel: activeRun.state === "streaming" ? "流式执行" : "执行中",
      modalityLabel: hasTool ? "Tool" : hasAssistant ? "Model" : "Run",
    };
  }

  if (recoveredExecutionContext?.checkoutState === "claimed") {
    return {
      id: `${agent.agentId}:replay:recovered:${recoveredExecutionContext.dispatchId}`,
      agentId: agent.agentId,
      nickname: agent.nickname,
      title: `${agent.nickname} 已恢复执行上下文`,
      summary: recoveredExecutionContext.objective,
      timestamp: recoveredExecutionContext.updatedAt,
      tone: agent.runtimeState === "degraded" ? "warning" : "info",
      phaseLabel: "恢复执行",
      modalityLabel: "Session",
    };
  }

  if (latestTerminalSession?.lastTerminalSummary) {
    const terminalState = latestTerminalSession.lastTerminalRunState;
    return {
      id: `${agent.agentId}:replay:terminal:${latestTerminalSession.sessionKey}`,
      agentId: agent.agentId,
      nickname: agent.nickname,
      title:
        terminalState === "completed"
          ? `${agent.nickname} 最近完成一次交付`
          : terminalState === "aborted"
            ? `${agent.nickname} 最近一次执行被中止`
            : `${agent.nickname} 最近一次执行失败`,
      summary: latestTerminalSession.lastTerminalSummary,
      timestamp: latestTerminalSession.lastSeenAt,
      tone:
        terminalState === "completed"
          ? "success"
          : terminalState === "aborted"
            ? "warning"
            : "danger",
      phaseLabel:
        terminalState === "completed"
          ? "完成"
          : terminalState === "aborted"
            ? "中止"
            : "失败",
      modalityLabel: "Terminal",
    };
  }

  if (recoveredExecutionContext) {
    const isBlocked = recoveredExecutionContext.releaseReason === "blocked";
    const isAnswered = recoveredExecutionContext.releaseReason === "answered";
    return {
      id: `${agent.agentId}:replay:context:${recoveredExecutionContext.dispatchId}`,
      agentId: agent.agentId,
      nickname: agent.nickname,
      title:
        isBlocked
          ? `${agent.nickname} 保留了一次阻塞交回记录`
          : isAnswered
            ? `${agent.nickname} 保留了一次交付收口记录`
            : `${agent.nickname} 保留了最近一次执行记录`,
      summary: recoveredExecutionContext.objective,
      timestamp: recoveredExecutionContext.updatedAt,
      tone: isBlocked ? "danger" : isAnswered ? "success" : "info",
      phaseLabel: isBlocked ? "恢复阻塞" : isAnswered ? "恢复记录" : "恢复上下文",
      modalityLabel: "Session",
    };
  }

  if (agent.coordinationState === "completed") {
    return {
      id: `${agent.agentId}:replay:completed`,
      agentId: agent.agentId,
      nickname: agent.nickname,
      title: `${agent.nickname} 当前链路已收口`,
      summary: agent.reason,
      timestamp: agent.latestSignalAt,
      tone: "success",
      phaseLabel: "收口",
      modalityLabel: "Flow",
    };
  }

  if (agent.coordinationState === "explicit_blocked" || agent.interventionState === "takeover_required") {
    return {
      id: `${agent.agentId}:replay:blocked`,
      agentId: agent.agentId,
      nickname: agent.nickname,
      title: `${agent.nickname} 进入恢复路径`,
      summary: recentEvidence?.summary ?? agent.reason,
      timestamp: agent.latestSignalAt,
      tone: "danger",
      phaseLabel: agent.interventionState === "takeover_required" ? "接管" : "阻塞",
      modalityLabel: recentEvidence?.kind === "error" ? "Error" : "Flow",
    };
  }

  return null;
}

export function buildHistoryWindow(input: {
  replay: RuntimeInspectorReplayEvent[];
  chainLinks: RuntimeInspectorChainLink[];
  timeline: RuntimeInspectorTimelineEvent[];
}): RuntimeInspectorHistoryEvent[] {
  const events: RuntimeInspectorHistoryEvent[] = [
    ...input.replay.map((item) => ({
      id: `history:${item.id}`,
      agentId: item.agentId,
      label: item.title,
      summary: item.summary,
      timestamp: item.timestamp,
      tone: item.tone,
      sourceLabel: `Replay · ${item.modalityLabel}`,
    })),
    ...input.chainLinks.map((item) => ({
      id: `history:${item.id}`,
      agentId: item.focusAgentId,
      label: `${item.fromLabel} -> ${item.toLabel}`,
      summary: item.summary,
      timestamp: item.updatedAt,
      tone: item.tone,
      sourceLabel: `${item.kindLabel} · ${item.stateLabel}`,
    })),
    ...input.timeline.map((item) => ({
      id: `history:${item.id}`,
      agentId: item.agentId,
      label: item.title,
      summary: item.summary,
      timestamp: item.timestamp,
      tone: item.tone,
      sourceLabel: "Signal",
    })),
  ];

  return events
    .sort((left, right) => (right.timestamp ?? 0) - (left.timestamp ?? 0))
    .slice(0, 10);
}

export function buildRecommendedActions(input: {
  focusAgent: RuntimeInspectorAgentSurface | null;
  agents: RuntimeInspectorAgentSurface[];
}): RuntimeInspectorRecommendedAction[] {
  const actions: RuntimeInspectorRecommendedAction[] = [];
  const focus = input.focusAgent;
  if (focus) {
    actions.push({
      id: `${focus.agentId}:chat`,
      label: `打开 ${focus.nickname} 会话`,
      summary: focus.coordinationState === "waiting_input" || focus.coordinationState === "waiting_peer"
        ? "先在会话里推进这条等待中的协作链。"
        : "直接查看这名成员的当前执行上下文。",
      to: `/chat/${encodeURIComponent(focus.agentId)}`,
      tone:
        focus.interventionState === "takeover_required" || focus.coordinationState === "explicit_blocked"
          ? "danger"
          : focus.interventionState === "overdue" || focus.interventionState === "escalated"
            ? "warning"
            : "default",
      agentId: focus.agentId,
    });
    actions.push({
      id: `${focus.agentId}:detail`,
      label: `查看 ${focus.nickname} 详情`,
      summary: "核对该成员的 session、run、证据和当前挂载任务。",
      to: `/employees/${encodeURIComponent(focus.agentId)}`,
      tone: "default",
      agentId: focus.agentId,
    });
  }
  const interventionAgent = input.agents.find(
    (agent) => agent.interventionState !== "healthy" || agent.coordinationState === "explicit_blocked",
  );
  if (interventionAgent) {
    actions.push({
      id: "board",
      label: "打开工作看板",
      summary: `结合 ${interventionAgent.nickname} 当前链路，确认 work item、dispatch 和升级状态。`,
      to: "/board",
      tone: interventionAgent.attention === "critical" ? "danger" : "warning",
      agentId: interventionAgent.agentId,
    });
  }
  if (actions.length === 0) {
    actions.push({
      id: "ops",
      label: "查看 Ops",
      summary: "当前没有明显瓶颈，可从运营视角继续观察整体负载。",
      to: "/ops",
      tone: "default",
    });
  }
  return actions.slice(0, 3);
}
