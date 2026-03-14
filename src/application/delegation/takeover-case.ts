import type {
  DispatchRecord,
  RequirementRoomRecord,
  TakeoverCaseAuditAction,
  TakeoverCaseAuditEntry,
  TakeoverCaseRecord,
  TakeoverCaseStatus,
  TakeoverCaseWorkflowAction,
} from "../../domain/delegation/types";
import type { Company } from "../../domain/org/types";
import { resolveConversationPresentation } from "../../lib/chat-routes";
import type { ResolvedExecutionState } from "../mission/execution-state";
import type { ManualTakeoverPack } from "./takeover-pack";

export type {
  TakeoverCaseAuditEntry,
  TakeoverCaseRecord,
  TakeoverCaseStatus,
  TakeoverCaseWorkflowAction,
};

export type TakeoverCase = {
  id: string;
  title: string;
  ownerAgentId: string | null;
  ownerLabel: string;
  assigneeAgentId: string | null;
  assigneeLabel: string | null;
  sourceSessionKey: string;
  sourceWorkItemId: string | null;
  sourceTopicKey: string | null;
  sourceDispatchId: string | null;
  sourceRoomId: string | null;
  failureSummary: string;
  recommendedNextAction: string;
  route: string;
  detectedAt: number;
  updatedAt: number;
  status: TakeoverCaseStatus;
  auditTrail: TakeoverCaseAuditEntry[];
};

export type TakeoverCaseSummary = {
  totalCount: number;
  title: string;
  description: string;
  actionLabel: string;
  primaryCase: TakeoverCase | null;
  cases: TakeoverCase[];
};

type TakeoverSessionCandidate = {
  key: string;
  agentId?: string | null;
  updatedAt?: number | null;
  displayName?: string | null;
};

const OPEN_TAKEOVER_STATUSES: TakeoverCaseStatus[] = ["detected", "acknowledged", "assigned", "in_progress"];

function resolveActorLabel(
  company: Company,
  agentId: string | null | undefined,
  fallbackLabel?: string | null,
) {
  if (agentId) {
    return company.employees.find((employee) => employee.agentId === agentId)?.nickname ?? fallbackLabel ?? agentId;
  }
  return fallbackLabel ?? "人工值守";
}

function resolveSourceRoom(roomRecords: RequirementRoomRecord[] | undefined, sessionKey: string) {
  return roomRecords?.find((room) => room.sessionKey === sessionKey) ?? null;
}

function resolveSourceDispatch(dispatches: DispatchRecord[] | undefined, sessionKey: string) {
  return (
    dispatches
      ?.filter(
        (dispatch) =>
          dispatch.consumerSessionKey === sessionKey || dispatch.checkoutSessionKey === sessionKey,
      )
      .sort((left, right) => right.updatedAt - left.updatedAt)[0] ?? null
  );
}

function isRecordVisible(record: TakeoverCaseRecord) {
  return record.status !== "archived";
}

function sortCases(left: TakeoverCase, right: TakeoverCase) {
  const byUpdatedAt = right.updatedAt - left.updatedAt;
  if (byUpdatedAt !== 0) {
    return byUpdatedAt;
  }
  const byDetectedAt = right.detectedAt - left.detectedAt;
  if (byDetectedAt !== 0) {
    return byDetectedAt;
  }
  return left.title.localeCompare(right.title);
}

function toPersistedRecord(input: {
  company: Company;
  caseItem: TakeoverCase;
  existing?: TakeoverCaseRecord | null;
  timestamp: number;
}) {
  const { company, caseItem, existing = null, timestamp } = input;
  return {
    id: caseItem.id,
    title: caseItem.title,
    route: caseItem.route,
    sourceSessionKey: caseItem.sourceSessionKey,
    sourceWorkItemId: caseItem.sourceWorkItemId,
    sourceTopicKey: caseItem.sourceTopicKey,
    sourceDispatchId: caseItem.sourceDispatchId,
    sourceRoomId: caseItem.sourceRoomId,
    ownerAgentId: caseItem.ownerAgentId,
    ownerLabel: resolveActorLabel(company, caseItem.ownerAgentId, caseItem.ownerLabel),
    assigneeAgentId: existing?.assigneeAgentId ?? caseItem.assigneeAgentId ?? null,
    assigneeLabel:
      existing?.assigneeLabel
      ?? (
        existing?.assigneeAgentId || caseItem.assigneeAgentId
          ? resolveActorLabel(company, existing?.assigneeAgentId ?? caseItem.assigneeAgentId, caseItem.assigneeLabel)
          : null
      ),
    failureSummary: caseItem.failureSummary,
    recommendedNextAction: caseItem.recommendedNextAction,
    status: existing?.status ?? caseItem.status,
    createdAt: existing?.createdAt ?? timestamp,
    updatedAt: timestamp,
    detectedAt: existing?.detectedAt ?? caseItem.detectedAt ?? timestamp,
    acknowledgedAt: existing?.acknowledgedAt ?? null,
    assignedAt: existing?.assignedAt ?? null,
    startedAt: existing?.startedAt ?? null,
    resolvedAt: existing?.resolvedAt ?? null,
    archivedAt: existing?.archivedAt ?? null,
    auditTrail: [...(existing?.auditTrail ?? caseItem.auditTrail ?? [])],
  } satisfies TakeoverCaseRecord;
}

export function takeoverCaseRecordToCase(record: TakeoverCaseRecord): TakeoverCase {
  return {
    id: record.id,
    title: record.title,
    ownerAgentId: record.ownerAgentId ?? null,
    ownerLabel: record.ownerLabel ?? "人工值守",
    assigneeAgentId: record.assigneeAgentId ?? null,
    assigneeLabel: record.assigneeLabel ?? null,
    sourceSessionKey: record.sourceSessionKey,
    sourceWorkItemId: record.sourceWorkItemId ?? null,
    sourceTopicKey: record.sourceTopicKey ?? null,
    sourceDispatchId: record.sourceDispatchId ?? null,
    sourceRoomId: record.sourceRoomId ?? null,
    failureSummary: record.failureSummary,
    recommendedNextAction: record.recommendedNextAction,
    route: record.route,
    detectedAt: record.detectedAt,
    updatedAt: record.updatedAt,
    status: record.status,
    auditTrail: [...(record.auditTrail ?? [])],
  };
}

export function takeoverCaseToRecord(caseItem: TakeoverCase): TakeoverCaseRecord {
  return {
    id: caseItem.id,
    title: caseItem.title,
    route: caseItem.route,
    sourceSessionKey: caseItem.sourceSessionKey,
    sourceWorkItemId: caseItem.sourceWorkItemId,
    sourceTopicKey: caseItem.sourceTopicKey,
    sourceDispatchId: caseItem.sourceDispatchId,
    sourceRoomId: caseItem.sourceRoomId,
    ownerAgentId: caseItem.ownerAgentId,
    ownerLabel: caseItem.ownerLabel,
    assigneeAgentId: caseItem.assigneeAgentId,
    assigneeLabel: caseItem.assigneeLabel,
    failureSummary: caseItem.failureSummary,
    recommendedNextAction: caseItem.recommendedNextAction,
    status: caseItem.status,
    createdAt: caseItem.detectedAt,
    updatedAt: caseItem.updatedAt,
    detectedAt: caseItem.detectedAt,
    auditTrail: [...caseItem.auditTrail],
  };
}

function buildAuditEntry(input: {
  caseId: string;
  action: TakeoverCaseAuditAction;
  status: TakeoverCaseStatus;
  actorId: string;
  actorLabel: string;
  timestamp: number;
  note?: string | null;
  assigneeAgentId?: string | null;
  assigneeLabel?: string | null;
  dispatchId?: string | null;
}): TakeoverCaseAuditEntry {
  return {
    id: `${input.caseId}:${input.action}:${input.timestamp}`,
    action: input.action,
    actorId: input.actorId,
    actorLabel: input.actorLabel,
    status: input.status,
    timestamp: input.timestamp,
    note: input.note ?? null,
    assigneeAgentId: input.assigneeAgentId ?? null,
    assigneeLabel: input.assigneeLabel ?? null,
    dispatchId: input.dispatchId ?? null,
  };
}

export function getLatestTakeoverAuditEntry(
  caseItem: Pick<TakeoverCase, "auditTrail">,
  action: TakeoverCaseAuditAction,
) {
  return [...(caseItem.auditTrail ?? [])]
    .filter((entry) => entry.action === action)
    .sort((left, right) => right.timestamp - left.timestamp)[0] ?? null;
}

export function getTakeoverCaseResolutionNote(caseItem: Pick<TakeoverCase, "auditTrail">) {
  return getLatestTakeoverAuditEntry(caseItem, "resolved")?.note?.trim() || null;
}

export function getTakeoverCaseLatestRedispatch(caseItem: Pick<TakeoverCase, "auditTrail">) {
  return getLatestTakeoverAuditEntry(caseItem, "redispatched");
}

export function isTakeoverCaseOpen(status: TakeoverCaseStatus) {
  return OPEN_TAKEOVER_STATUSES.includes(status);
}

export function getTakeoverCaseStatusLabel(status: TakeoverCaseStatus) {
  switch (status) {
    case "detected":
      return "待确认";
    case "acknowledged":
      return "已确认";
    case "assigned":
      return "已指派";
    case "in_progress":
      return "处理中";
    case "resolved":
      return "已恢复";
    case "archived":
      return "已归档";
    default:
      return "人工接管";
  }
}

export function buildTakeoverCases(input: {
  company: Company;
  sessions: TakeoverSessionCandidate[];
  sessionExecutions: Map<string, ResolvedExecutionState>;
  takeoverPacks?: Map<string, ManualTakeoverPack>;
  activeRoomRecords?: RequirementRoomRecord[];
  activeDispatches?: DispatchRecord[];
  sessionKeys?: Set<string>;
}): TakeoverCase[] {
  const sessionsByKey = new Map(input.sessions.map((session) => [session.key, session]));
  const persistedBySessionKey = new Map(
    (input.company.takeoverCases ?? [])
      .filter((record) => {
        if (input.sessionKeys && !input.sessionKeys.has(record.sourceSessionKey)) {
          return false;
        }
        return isRecordVisible(record);
      })
      .map((record) => [record.sourceSessionKey, record]),
  );
  const candidateSessionKeys = new Set<string>();

  for (const session of input.sessions) {
    if (input.sessionKeys && !input.sessionKeys.has(session.key)) {
      continue;
    }
    const execution = input.sessionExecutions.get(session.key);
    if (execution?.state === "manual_takeover_required" || input.takeoverPacks?.has(session.key)) {
      candidateSessionKeys.add(session.key);
    }
  }

  for (const record of persistedBySessionKey.values()) {
    candidateSessionKeys.add(record.sourceSessionKey);
  }

  return [...candidateSessionKeys]
    .map((sessionKey) => {
      const session = sessionsByKey.get(sessionKey) ?? null;
      const execution = input.sessionExecutions.get(sessionKey) ?? null;
      const pack = input.takeoverPacks?.get(sessionKey) ?? null;
      const record = persistedBySessionKey.get(sessionKey) ?? null;
      const room = resolveSourceRoom(input.activeRoomRecords, sessionKey);
      const dispatch = resolveSourceDispatch(input.activeDispatches, sessionKey);
      const ownerAgentId = session?.agentId?.trim() || record?.ownerAgentId?.trim() || null;
      const presentation = resolveConversationPresentation({
        sessionKey,
        actorId: ownerAgentId,
        displayName: session?.displayName ?? record?.title ?? null,
        companyId: input.company.id,
        rooms: input.activeRoomRecords ?? [],
        employees: input.company.employees,
      });
      const hasLiveSignal =
        execution?.state === "manual_takeover_required" || Boolean(pack);
      const status =
        hasLiveSignal && (record?.status === "resolved" || record?.status === "archived")
          ? "detected"
          : record?.status ?? "detected";
      const detectedAt = record?.detectedAt ?? session?.updatedAt ?? Date.now();
      const updatedAt = record?.updatedAt ?? session?.updatedAt ?? detectedAt;

      return {
        id: record?.id ?? `takeover:${sessionKey}`,
        title: pack?.title ?? record?.title ?? presentation.title,
        ownerAgentId,
        ownerLabel: resolveActorLabel(
          input.company,
          ownerAgentId,
          record?.ownerLabel ?? session?.displayName ?? null,
        ),
        assigneeAgentId: record?.assigneeAgentId ?? null,
        assigneeLabel:
          record?.assigneeLabel
          ?? (record?.assigneeAgentId ? resolveActorLabel(input.company, record.assigneeAgentId, null) : null),
        sourceSessionKey: sessionKey,
        sourceWorkItemId: record?.sourceWorkItemId ?? room?.workItemId ?? dispatch?.workItemId ?? null,
        sourceTopicKey: record?.sourceTopicKey ?? room?.topicKey ?? dispatch?.topicKey ?? null,
        sourceDispatchId: record?.sourceDispatchId ?? dispatch?.id ?? null,
        sourceRoomId: record?.sourceRoomId ?? room?.id ?? null,
        failureSummary: pack?.failureSummary ?? record?.failureSummary ?? execution?.summary ?? "当前链路需要人工接管。",
        recommendedNextAction:
          pack?.recommendedNextAction
          ?? record?.recommendedNextAction
          ?? "打开原会话并继续手动处理，补齐结果后再决定是否回交给自动执行。",
        route: record?.route ?? presentation.route,
        detectedAt,
        updatedAt,
        status,
        auditTrail: [...(record?.auditTrail ?? [])],
      } satisfies TakeoverCase;
    })
    .sort(sortCases);
}

export function buildTakeoverCaseSummary(cases: TakeoverCase[]): TakeoverCaseSummary {
  const primaryCase = cases[0] ?? null;
  const totalCount = cases.length;

  if (!primaryCase) {
    return {
      totalCount,
      title: "人工接管警报",
      description: "当前没有需要人工接管的执行链路。",
      actionLabel: "查看接管项",
      primaryCase: null,
      cases,
    };
  }

  const primaryStatusLabel = getTakeoverCaseStatusLabel(primaryCase.status);
  return {
    totalCount,
    title: "人工接管警报",
    description:
      totalCount === 1
        ? `当前有 1 条执行链路需要人工介入，当前状态 ${primaryStatusLabel}，建议先处理「${primaryCase.title}」。`
        : `当前有 ${totalCount} 条执行链路进入人工接管闭环，优先处理「${primaryCase.title}」，其余接管项继续排队。`,
    actionLabel: "查看接管项",
    primaryCase,
    cases,
  };
}

export function applyTakeoverCaseWorkflowAction(input: {
  company: Company;
  caseItem: TakeoverCase;
  action: TakeoverCaseWorkflowAction;
  actorId?: string | null;
  actorLabel?: string | null;
  assigneeAgentId?: string | null;
  assigneeLabel?: string | null;
  note?: string | null;
  dispatchId?: string | null;
  timestamp?: number;
}) {
  const now = input.timestamp ?? Date.now();
  const records = [...(input.company.takeoverCases ?? [])];
  const index = records.findIndex((record) => record.id === input.caseItem.id);
  const existing = index >= 0 ? records[index] : null;
  const actorId = input.actorId?.trim() || "operator:local-user";
  const actorLabel = input.actorLabel?.trim() || "人工值守";
  const baseRecord = toPersistedRecord({
    company: input.company,
    caseItem: input.caseItem,
    existing,
    timestamp: now,
  });

  let nextStatus: TakeoverCaseStatus = baseRecord.status;
  let auditAction: TakeoverCaseAuditAction = "acknowledged";
  let assigneeAgentId = baseRecord.assigneeAgentId ?? null;
  let assigneeLabel = baseRecord.assigneeLabel ?? null;

  switch (input.action) {
    case "acknowledge":
      nextStatus = "acknowledged";
      auditAction = "acknowledged";
      break;
    case "assign":
      nextStatus = "assigned";
      auditAction = "assigned";
      assigneeAgentId =
        input.assigneeAgentId?.trim()
        ?? baseRecord.assigneeAgentId
        ?? input.caseItem.ownerAgentId
        ?? null;
      assigneeLabel =
        input.assigneeLabel?.trim()
        ?? resolveActorLabel(
          input.company,
          assigneeAgentId,
          baseRecord.assigneeLabel ?? input.caseItem.ownerLabel,
        );
      break;
    case "start":
      nextStatus = "in_progress";
      auditAction = "started";
      assigneeAgentId =
        input.assigneeAgentId?.trim()
        ?? baseRecord.assigneeAgentId
        ?? input.caseItem.ownerAgentId
        ?? null;
      assigneeLabel =
        input.assigneeLabel?.trim()
        ?? resolveActorLabel(
          input.company,
          assigneeAgentId,
          baseRecord.assigneeLabel ?? input.caseItem.ownerLabel,
        );
      break;
    case "resolve":
      nextStatus = "resolved";
      auditAction = "resolved";
      break;
    case "redispatch":
      nextStatus = baseRecord.status === "archived" ? "archived" : baseRecord.status;
      auditAction = "redispatched";
      assigneeAgentId =
        input.assigneeAgentId?.trim()
        ?? baseRecord.assigneeAgentId
        ?? input.caseItem.ownerAgentId
        ?? null;
      assigneeLabel =
        input.assigneeLabel?.trim()
        ?? resolveActorLabel(
          input.company,
          assigneeAgentId,
          baseRecord.assigneeLabel ?? input.caseItem.ownerLabel,
        );
      break;
    case "archive":
      nextStatus = "archived";
      auditAction = "archived";
      break;
    default:
      break;
  }

  const nextRecord: TakeoverCaseRecord = {
    ...baseRecord,
    assigneeAgentId,
    assigneeLabel,
    status: nextStatus,
    updatedAt: now,
    acknowledgedAt:
      nextStatus === "acknowledged" || nextStatus === "assigned" || nextStatus === "in_progress"
        ? baseRecord.acknowledgedAt ?? now
        : baseRecord.acknowledgedAt ?? null,
    assignedAt:
      nextStatus === "assigned" || nextStatus === "in_progress"
        ? baseRecord.assignedAt ?? now
        : baseRecord.assignedAt ?? null,
    startedAt: nextStatus === "in_progress" ? baseRecord.startedAt ?? now : baseRecord.startedAt ?? null,
    resolvedAt: nextStatus === "resolved" ? now : baseRecord.resolvedAt ?? null,
    archivedAt: nextStatus === "archived" ? now : baseRecord.archivedAt ?? null,
    auditTrail: [
      ...(baseRecord.auditTrail ?? []),
      buildAuditEntry({
        caseId: baseRecord.id,
        action: auditAction,
        actorId,
        actorLabel,
        status: nextStatus,
        timestamp: now,
        note: input.note ?? null,
        assigneeAgentId,
        assigneeLabel,
        dispatchId: input.dispatchId ?? null,
      }),
    ],
  };

  if (index >= 0) {
    records[index] = nextRecord;
  } else {
    records.push(nextRecord);
  }
  return records.sort((left, right) => right.updatedAt - left.updatedAt);
}
