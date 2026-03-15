import { normalizeDispatchCheckout } from "../../domain/delegation/dispatch-checkout";
import type {
  DispatchRecord,
  EscalationRecord,
  HandoffRecord,
  RequestRecord,
  SupportRequestRecord,
} from "../../domain/delegation/types";
import type { WorkItemRecord } from "../../domain/mission/types";
import type { Company } from "../../domain/org/types";
import type {
  AgentRuntimeRecord,
  AgentSessionRecord,
  CanonicalAgentStatusHealthRecord,
  CanonicalAgentStatusRecord,
  CanonicalAgentStatusSource,
  InterventionState,
  CoordinationState,
} from "./agent-runtime-types";
import { ageMs, latestTimestamp, pickLatestRecoveredExecutionContext } from "./agent-runtime-utils";

const INITIAL_ACK_WINDOW_MS = 5 * 60_000;
const WAITING_WINDOW_MS = 15 * 60_000;

function isCurrentWorkItemForAgent(workItem: WorkItemRecord, agentId: string): boolean {
  return (
    workItem.ownerActorId === agentId ||
    workItem.batonActorId === agentId ||
    workItem.steps.some((step) => step.assigneeActorId === agentId && step.status === "active")
  );
}

function scoreCurrentWorkItemForAgent(workItem: WorkItemRecord, agentId: string): number {
  let score = 0;
  if (workItem.ownerActorId === agentId) {
    score += 40;
  }
  if (workItem.batonActorId === agentId) {
    score += 20;
  }
  if (workItem.steps.some((step) => step.assigneeActorId === agentId && step.status === "active")) {
    score += 30;
  }
  if (workItem.steps.some((step) => step.assigneeActorId === agentId && step.status === "pending")) {
    score += 10;
  }
  if (workItem.status === "blocked") {
    score += 16;
  }
  if (workItem.status === "active") {
    score += 12;
  }
  return score + Math.floor(workItem.updatedAt / 1000);
}

function isOpenDispatchStatus(status: DispatchRecord["status"]): boolean {
  return status === "pending" || status === "sent" || status === "acknowledged";
}

function isOpenSupportStatus(status: SupportRequestRecord["status"]): boolean {
  return status === "open" || status === "acknowledged" || status === "in_progress";
}

function isOpenRequestStatus(status: RequestRecord["status"]): boolean {
  return status === "pending" || status === "acknowledged";
}

function isOpenHandoffStatus(status: HandoffRecord["status"]): boolean {
  return status === "pending" || status === "acknowledged";
}

type WorkScope = {
  workItemId: string | null;
  topicKey: string | null;
  roomId: string | null;
  updatedAt: number;
};

function buildWorkScope(workItem: WorkItemRecord | null): WorkScope | null {
  if (!workItem) {
    return null;
  }
  return {
    workItemId: workItem.id,
    topicKey: workItem.topicKey ?? null,
    roomId: workItem.roomId ?? null,
    updatedAt: workItem.updatedAt,
  };
}

function matchesRequestScope(request: RequestRecord, scope: WorkScope | null): boolean {
  if (!scope) {
    return true;
  }
  if (request.status === "answered") {
    return (
      request.taskId === scope.workItemId ||
      request.topicKey === scope.topicKey ||
      request.updatedAt >= scope.updatedAt
    );
  }
  return request.updatedAt >= scope.updatedAt;
}

function matchesDispatchScope(dispatch: DispatchRecord, scope: WorkScope | null): boolean {
  if (!scope) {
    return true;
  }
  return dispatch.updatedAt >= scope.updatedAt;
}

function matchesHandoffScope(handoff: HandoffRecord, scope: WorkScope | null): boolean {
  if (!scope) {
    return true;
  }
  if (handoff.status === "completed") {
    return (
      handoff.taskId === scope.workItemId ||
      handoff.sessionKey === scope.roomId ||
      handoff.updatedAt >= scope.updatedAt
    );
  }
  return handoff.updatedAt >= scope.updatedAt;
}

function matchesEscalationScope(escalation: EscalationRecord, scope: WorkScope | null): boolean {
  if (!scope) {
    return false;
  }
  return (
    escalation.workItemId === scope.workItemId ||
    escalation.sourceId === scope.workItemId ||
    escalation.roomId === scope.roomId
  );
}

export function agentStatusNeedsIntervention(status: CanonicalAgentStatusRecord): boolean {
  return (
    status.coordinationState === "explicit_blocked" ||
    status.interventionState === "overdue" ||
    status.interventionState === "escalated" ||
    status.interventionState === "takeover_required"
  );
}

export function buildCanonicalAgentStatusHealth(input: {
  company: Company | null;
  statuses: CanonicalAgentStatusRecord[];
  source: CanonicalAgentStatusSource;
  generatedAt?: number | null;
  note?: string | null;
}): CanonicalAgentStatusHealthRecord {
  const expectedAgentIds = input.company?.employees.map((employee) => employee.agentId) ?? [];
  const expectedAgentCount = expectedAgentIds.length || input.statuses.length;
  const coveredAgentIds = new Set(
    input.statuses
      .map((status) => status.agentId)
      .filter((agentId) => expectedAgentIds.length === 0 || expectedAgentIds.includes(agentId)),
  );
  const missingAgentIds =
    expectedAgentIds.length > 0
      ? expectedAgentIds.filter((agentId) => !coveredAgentIds.has(agentId))
      : [];
  const isComplete =
    input.source === "authority"
      ? missingAgentIds.length === 0 && coveredAgentIds.size >= expectedAgentCount
      : false;
  return {
    source: input.source,
    coverage:
      input.source === "fallback"
        ? "fallback"
        : isComplete
          ? "authority_complete"
          : "authority_partial",
    coveredAgentCount: coveredAgentIds.size,
    expectedAgentCount,
    missingAgentIds,
    isComplete,
    generatedAt: input.generatedAt ?? null,
    note: input.note ?? null,
  };
}

export function buildCanonicalAgentStatusProjection(input: {
  company: Company;
  activeWorkItems: WorkItemRecord[];
  activeDispatches: DispatchRecord[];
  activeSupportRequests: SupportRequestRecord[];
  activeEscalations: EscalationRecord[];
  activeAgentRuntime: AgentRuntimeRecord[];
  activeAgentSessions?: AgentSessionRecord[];
  now?: number;
}): CanonicalAgentStatusRecord[] {
  const now = input.now ?? Date.now();
  const runtimeByAgentId = new Map(input.activeAgentRuntime.map((runtime) => [runtime.agentId, runtime] as const));
  const companyPrimaryWorkItem = [...input.activeWorkItems].sort((left, right) => right.updatedAt - left.updatedAt)[0] ?? null;
  const companyPrimaryScope = buildWorkScope(companyPrimaryWorkItem);
  const sessionsByAgentId = new Map<string, AgentSessionRecord[]>();
  for (const session of input.activeAgentSessions ?? []) {
    if (!session.agentId) {
      continue;
    }
    const existing = sessionsByAgentId.get(session.agentId) ?? [];
    existing.push(session);
    sessionsByAgentId.set(session.agentId, existing);
  }

  return input.company.employees.map((employee) => {
    const runtime = runtimeByAgentId.get(employee.agentId) ?? null;
    const runtimeState = runtime?.availability ?? "no_signal";
    const agentSessions = [...(sessionsByAgentId.get(employee.agentId) ?? [])].sort(
      (left, right) => (right.lastSeenAt ?? 0) - (left.lastSeenAt ?? 0),
    );
    const claimedRecoveredExecutionContext = pickLatestRecoveredExecutionContext(
      agentSessions,
      (context) => context.checkoutState === "claimed",
    );
    const blockedRecoveredExecutionContext = pickLatestRecoveredExecutionContext(
      agentSessions,
      (context) => context.checkoutState === "released" && context.releaseReason === "blocked",
    );
    const completedRecoveredExecutionContext = pickLatestRecoveredExecutionContext(
      agentSessions,
      (context) => context.checkoutState === "released" && context.releaseReason === "answered",
    );
    const latestRecoveredExecutionContext =
      claimedRecoveredExecutionContext
      ?? blockedRecoveredExecutionContext
      ?? completedRecoveredExecutionContext
      ?? pickLatestRecoveredExecutionContext(agentSessions);
    const relevantWorkItems = [...input.activeWorkItems]
      .filter((workItem) => isCurrentWorkItemForAgent(workItem, employee.agentId))
      .sort(
        (left, right) =>
          scoreCurrentWorkItemForAgent(right, employee.agentId) - scoreCurrentWorkItemForAgent(left, employee.agentId),
      );
    const primaryWorkItem = relevantWorkItems[0] ?? null;
    const effectiveScope = buildWorkScope(primaryWorkItem) ?? companyPrimaryScope;
    const agentDispatches = input.activeDispatches.filter(
      (dispatch) =>
        dispatch.targetActorIds.includes(employee.agentId) &&
        matchesDispatchScope(dispatch, effectiveScope),
    );
    const claimedDispatches = agentDispatches.filter(
      (dispatch) => normalizeDispatchCheckout(dispatch).checkoutState === "claimed",
    );
    const openDispatchCount = agentDispatches.filter((dispatch) => isOpenDispatchStatus(dispatch.status)).length;
    const blockedDispatches = agentDispatches.filter((dispatch) => dispatch.status === "blocked");
    const blockedDispatchCount = blockedDispatches.length;
    const ownedSupportRequests = input.activeSupportRequests.filter(
      (request) => request.ownerActorId === employee.agentId,
    );
    const openSupportRequests = ownedSupportRequests.filter((request) => isOpenSupportStatus(request.status));
    const openSupportRequestCount = openSupportRequests.length;
    const blockedSupportRequests = ownedSupportRequests.filter((request) => request.status === "blocked");
    const blockedSupportRequestCount = blockedSupportRequests.length;
    const relatedRequests = (input.company.requests ?? []).filter(
      (request) =>
        request.toAgentIds.includes(employee.agentId) &&
        matchesRequestScope(request, effectiveScope),
    );
    const openRequests = relatedRequests.filter((request) => isOpenRequestStatus(request.status));
    const blockedRequests = relatedRequests.filter((request) => request.status === "blocked");
    const relatedHandoffs = (input.company.handoffs ?? []).filter(
      (handoff) =>
        matchesHandoffScope(handoff, effectiveScope) &&
        (
          handoff.toAgentIds.includes(employee.agentId) ||
          (handoff.fromAgentId === employee.agentId && handoff.status === "blocked")
        ),
    );
    const openHandoffs = relatedHandoffs.filter((handoff) => isOpenHandoffStatus(handoff.status));
    const blockedHandoffs = relatedHandoffs.filter((handoff) => handoff.status === "blocked");
    const openEscalations = input.activeEscalations.filter(
      (escalation) =>
        escalation.targetActorId === employee.agentId &&
        matchesEscalationScope(escalation, effectiveScope) &&
        (escalation.status === "open" || escalation.status === "acknowledged"),
    );
    const openEscalationCount = openEscalations.length;
    const blockedWorkItems = relevantWorkItems.filter((workItem) => workItem.status === "blocked");
    const blockedWorkItemCount = blockedWorkItems.length;
    const latestSignalAt = latestTimestamp([
      runtime?.lastSeenAt,
      runtime?.lastBusyAt,
      runtime?.lastIdleAt,
      runtime?.latestTerminalAt,
      primaryWorkItem?.updatedAt,
      agentDispatches[0]?.updatedAt,
      ownedSupportRequests[0]?.updatedAt,
      relatedRequests[0]?.updatedAt,
      relatedHandoffs[0]?.updatedAt,
      agentSessions[0]?.lastSeenAt,
      latestRecoveredExecutionContext?.updatedAt,
    ]);

    const hasTakeoverRequired =
      (input.company.tasks ?? []).some(
        (task) =>
          (task.ownerAgentId === employee.agentId ||
            task.agentId === employee.agentId ||
            task.assigneeAgentIds?.includes(employee.agentId)) &&
          task.state === "manual_takeover_required",
      ) ||
      relatedRequests.some((request) => request.resolution === "manual_takeover");

    const hasWaitingInput =
      primaryWorkItem?.ownerActorId === employee.agentId &&
      (primaryWorkItem.status === "waiting_owner" || primaryWorkItem.status === "waiting_review");

    const pendingAckRecords = [
      ...agentDispatches.filter(
        (dispatch) => (dispatch.status === "pending" || dispatch.status === "sent") && ageMs(dispatch.updatedAt, now) < INITIAL_ACK_WINDOW_MS,
      ),
      ...openRequests.filter(
        (request) => request.status === "pending" && ageMs(request.updatedAt, now) < INITIAL_ACK_WINDOW_MS,
      ),
      ...openHandoffs.filter(
        (handoff) => handoff.status === "pending" && ageMs(handoff.updatedAt, now) < INITIAL_ACK_WINDOW_MS,
      ),
    ];

    const waitingPeerRecords = [
      ...agentDispatches.filter(
        (dispatch) =>
          isOpenDispatchStatus(dispatch.status) &&
          normalizeDispatchCheckout(dispatch).checkoutState !== "claimed" &&
          !(dispatch.status === "pending" || dispatch.status === "sent"
            ? ageMs(dispatch.updatedAt, now) < INITIAL_ACK_WINDOW_MS
            : false),
      ),
      ...openRequests.filter(
        (request) =>
          request.status === "acknowledged" ||
          (request.status === "pending" && ageMs(request.updatedAt, now) >= INITIAL_ACK_WINDOW_MS),
      ),
      ...openHandoffs.filter(
        (handoff) =>
          handoff.status === "acknowledged" ||
          (handoff.status === "pending" && ageMs(handoff.updatedAt, now) >= INITIAL_ACK_WINDOW_MS),
      ),
      ...openSupportRequests.filter((request) => request.status !== "fulfilled" && request.status !== "cancelled"),
    ];

    const completedSignals = [
      primaryWorkItem?.status === "completed" ? primaryWorkItem.updatedAt : null,
      completedRecoveredExecutionContext?.updatedAt ?? null,
      ...agentDispatches
        .filter((dispatch) => dispatch.status === "answered")
        .map((dispatch) => dispatch.updatedAt),
      ...relatedRequests
        .filter((request) => request.status === "answered")
        .map((request) => request.updatedAt),
      ...relatedHandoffs
        .filter((handoff) => handoff.status === "completed")
        .map((handoff) => handoff.updatedAt),
    ];
    const latestCompletedAt = Math.max(...completedSignals.filter((value): value is number => Boolean(value)), 0);
    const hasOpenBusinessChain =
      Boolean(primaryWorkItem) ||
      hasWaitingInput ||
      openDispatchCount > 0 ||
      openSupportRequestCount > 0 ||
      openRequests.length > 0 ||
      openHandoffs.length > 0;
    const latestExplicitBlockedAt = Math.max(
      ...blockedDispatches.map((dispatch) => dispatch.updatedAt),
      ...blockedSupportRequests.map((request) => request.updatedAt),
      ...blockedRequests.map((request) => request.updatedAt),
      ...blockedHandoffs.map((handoff) => handoff.updatedAt),
      ...blockedWorkItems.map((workItem) => workItem.updatedAt),
      blockedRecoveredExecutionContext?.updatedAt ?? 0,
      runtimeState === "degraded" && hasOpenBusinessChain ? runtime?.latestTerminalAt ?? 0 : 0,
      0,
    );
    const hasExplicitBlocked = latestExplicitBlockedAt > latestCompletedAt;

    let coordinationState: CoordinationState = "none";
    if (hasExplicitBlocked || hasTakeoverRequired) {
      coordinationState = "explicit_blocked";
    } else if (runtimeState === "busy" || claimedDispatches.length > 0 || Boolean(claimedRecoveredExecutionContext)) {
      coordinationState = "executing";
    } else if (hasWaitingInput) {
      coordinationState = "waiting_input";
    } else if (waitingPeerRecords.length > 0) {
      coordinationState = "waiting_peer";
    } else if (pendingAckRecords.length > 0) {
      coordinationState = "pending_ack";
    } else if (completedSignals.some((value) => Boolean(value))) {
      coordinationState = "completed";
    }

    const waitingPeerAge = Math.max(
      ...waitingPeerRecords.map((record) => ageMs(record.updatedAt, now)),
      0,
    );
    const waitingInputAge = hasWaitingInput ? ageMs(primaryWorkItem?.updatedAt, now) : 0;
    const hasOverdueWaiting =
      (coordinationState === "waiting_peer" && waitingPeerAge >= WAITING_WINDOW_MS) ||
      (coordinationState === "waiting_input" && waitingInputAge >= WAITING_WINDOW_MS) ||
      openSupportRequests.some(
        (request) => typeof request.slaDueAt === "number" && request.slaDueAt > 0 && request.slaDueAt < now,
      );

    let interventionState: InterventionState = "healthy";
    if (hasTakeoverRequired) {
      interventionState = "takeover_required";
    } else if (openEscalationCount > 0) {
      interventionState = "escalated";
    } else if (hasOverdueWaiting) {
      interventionState = "overdue";
    }

    const currentAssignment =
      primaryWorkItem?.title ??
      claimedDispatches[0]?.title ??
      claimedRecoveredExecutionContext?.assignment ??
      agentDispatches[0]?.title ??
      latestRecoveredExecutionContext?.assignment ??
      openSupportRequests[0]?.summary ??
      relatedRequests[0]?.title ??
      relatedHandoffs[0]?.title ??
      "当前没有显式挂载的任务";

    const currentObjective =
      primaryWorkItem?.displayNextAction ??
      primaryWorkItem?.nextAction ??
      primaryWorkItem?.displayStage ??
      claimedDispatches[0]?.summary ??
      claimedRecoveredExecutionContext?.objective ??
      latestRecoveredExecutionContext?.objective ??
      openSupportRequests[0]?.detail ??
      relatedRequests[0]?.responseSummary ??
      relatedRequests[0]?.summary ??
      relatedHandoffs[0]?.summary ??
      "当前没有新的协作目标。";

    let reason = "当前没有显式挂载任务，也没有新的运行信号。";
    if (interventionState === "takeover_required") {
      reason = "当前链路已要求人工接管或手动执行。";
    } else if (coordinationState === "explicit_blocked") {
      reason =
        runtime?.latestTerminalSummary ??
        (blockedRecoveredExecutionContext
          ? `最近一次恢复上下文显示该链路以阻塞状态交回：${blockedRecoveredExecutionContext.assignment}。`
          : null) ??
        blockedSupportRequests[0]?.detail ??
        blockedRequests[0]?.responseDetails ??
        blockedHandoffs[0]?.missingItems?.[0] ??
        blockedDispatches[0]?.summary ??
        primaryWorkItem?.nextAction ??
        "当前链路存在明确阻塞，需要优先恢复。";
    } else if (coordinationState === "executing") {
      reason =
        runtime?.activeRunIds.length
          ? `${runtime.activeRunIds.length} 条活跃 run 仍在执行，等待交付。`
          : claimedDispatches[0]
            ? `${claimedDispatches[0].targetActorIds[0] === employee.agentId ? "已认领当前派单" : "当前派单已被认领"}，等待执行结果回流。`
            : claimedRecoveredExecutionContext
              ? `执行信号暂时缺失，但已从 ${claimedRecoveredExecutionContext.dispatchId} 恢复当前上下文：${claimedRecoveredExecutionContext.assignment}。`
            : "runtime 仍在持续执行，等待当前链路回传结果。";
    } else if (coordinationState === "waiting_input") {
      reason =
        primaryWorkItem?.status === "waiting_review"
          ? "当前主线在等待 review/验收确认。"
          : "当前主线在等待 owner 或上游输入。";
    } else if (coordinationState === "waiting_peer") {
      reason =
        interventionState === "escalated"
          ? "当前链路已长时间等待同事，且已升级处理。"
          : interventionState === "overdue"
            ? "当前没有活跃 run，且等待同事已超过 SLA。"
            : "已转交同事，正在等待继续推进。";
    } else if (coordinationState === "pending_ack") {
      reason = "派单已发出，仍在等待首次确认。";
    } else if (coordinationState === "completed") {
      reason = completedRecoveredExecutionContext
        ? `最近一次恢复上下文显示该链路已交回结果：${completedRecoveredExecutionContext.assignment}。`
        : "最近一次协作链已完成并闭环。";
    } else if (runtimeState === "offline") {
      reason = "Provider 明确报告当前节点不可达。";
    } else if (runtimeState === "no_signal") {
      reason = "当前没有观察到可信 runtime 信号。";
    } else if (runtimeState === "idle") {
      reason = "当前没有活跃 run，可继续派单或观察。";
    }

    return {
      agentId: employee.agentId,
      runtimeState,
      coordinationState,
      interventionState,
      reason,
      currentAssignment,
      currentObjective,
      latestSignalAt,
      activeSessionCount: runtime?.activeSessionKeys.length ?? 0,
      activeRunCount: runtime?.activeRunIds.length ?? 0,
      openDispatchCount,
      blockedDispatchCount,
      openSupportRequestCount,
      blockedSupportRequestCount,
      openRequestCount: openRequests.length,
      blockedRequestCount: blockedRequests.length,
      openHandoffCount: openHandoffs.length,
      blockedHandoffCount: blockedHandoffs.length,
      openEscalationCount,
      blockedWorkItemCount,
      primaryWorkItemId: primaryWorkItem?.id ?? null,
    } satisfies CanonicalAgentStatusRecord;
  }).sort((left, right) => {
    const interventionRank = {
      takeover_required: 0,
      escalated: 1,
      overdue: 2,
      healthy: 3,
    } as const;
    if (interventionRank[left.interventionState] !== interventionRank[right.interventionState]) {
      return interventionRank[left.interventionState] - interventionRank[right.interventionState];
    }
    const coordinationRank = {
      explicit_blocked: 0,
      waiting_input: 1,
      waiting_peer: 2,
      pending_ack: 3,
      executing: 4,
      none: 5,
      completed: 6,
    } as const;
    if (coordinationRank[left.coordinationState] !== coordinationRank[right.coordinationState]) {
      return coordinationRank[left.coordinationState] - coordinationRank[right.coordinationState];
    }
    return (right.latestSignalAt ?? 0) - (left.latestSignalAt ?? 0);
  });
}
