import type { EscalationRecord, EscalationStatus } from "./types";

export function normalizeEscalationStatus(
  status: string | null | undefined,
): EscalationStatus {
  switch (status) {
    case "acknowledged":
    case "resolved":
    case "dismissed":
    case "open":
      return status;
    default:
      return "open";
  }
}

export function normalizeEscalationRevision(value: number | null | undefined): number {
  return Number.isFinite(value) && Number(value) > 0 ? Math.floor(Number(value)) : 1;
}

export function normalizeEscalationRecord(
  escalation: EscalationRecord,
): EscalationRecord {
  return {
    ...escalation,
    status: normalizeEscalationStatus(escalation.status),
    revision: normalizeEscalationRevision(escalation.revision),
  };
}
