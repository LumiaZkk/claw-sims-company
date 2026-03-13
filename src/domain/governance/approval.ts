import type { ApprovalActionType, ApprovalRecord, ApprovalStatus } from "./types";

function normalizeRevision(value: number | null | undefined): number {
  return Number.isFinite(value) && Number(value) > 0 ? Math.floor(Number(value)) : 1;
}

function readString(value: unknown): string | null {
  return typeof value === "string" && value.trim().length > 0 ? value.trim() : null;
}

function normalizeApprovalStatus(value: unknown): ApprovalStatus {
  return value === "approved" || value === "rejected" ? value : "pending";
}

function normalizeApprovalActionType(value: unknown): ApprovalActionType {
  switch (value) {
    case "department_change":
    case "automation_enable":
    case "runtime_restore":
      return value;
    default:
      return "employee_fire";
  }
}

export function normalizeApprovalRecord(record: ApprovalRecord): ApprovalRecord {
  const requestedAt =
    (typeof record.requestedAt === "number" && Number.isFinite(record.requestedAt)
      ? record.requestedAt
      : 0) ||
    record.createdAt ||
    Date.now();
  const createdAt =
    (typeof record.createdAt === "number" && Number.isFinite(record.createdAt)
      ? record.createdAt
      : 0) || requestedAt;
  const updatedAt =
    (typeof record.updatedAt === "number" && Number.isFinite(record.updatedAt)
      ? record.updatedAt
      : 0) || createdAt;

  return {
    ...record,
    companyId: readString(record.companyId) ?? "",
    revision: normalizeRevision(record.revision),
    actionType: normalizeApprovalActionType(record.actionType),
    status: normalizeApprovalStatus(record.status),
    summary: record.summary.trim(),
    detail: readString(record.detail),
    requestedByActorId: readString(record.requestedByActorId),
    requestedByLabel: readString(record.requestedByLabel),
    targetActorId: readString(record.targetActorId),
    targetLabel: readString(record.targetLabel),
    resolution: readString(record.resolution),
    decidedByActorId: readString(record.decidedByActorId),
    decidedByLabel: readString(record.decidedByLabel),
    requestedAt,
    createdAt,
    updatedAt,
    resolvedAt:
      typeof record.resolvedAt === "number" && Number.isFinite(record.resolvedAt)
        ? record.resolvedAt
        : null,
  };
}

export function isApprovalPending(record: ApprovalRecord): boolean {
  return normalizeApprovalStatus(record.status) === "pending";
}

export function sortApprovals(records: ApprovalRecord[]): ApprovalRecord[] {
  return [...records]
    .map(normalizeApprovalRecord)
    .sort((left, right) => right.updatedAt - left.updatedAt);
}
