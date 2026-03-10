import type {
  RequirementAcceptanceStatus,
  RequirementAggregateRecord,
  RequirementLifecycleState,
} from "./types";

const REQUIREMENT_AGGREGATE_CACHE_PREFIX = "cyber_company_requirement_aggregates:";
const REQUIREMENT_AGGREGATE_LIMIT = 64;

function isRequirementLifecycleState(value: unknown): value is RequirementLifecycleState {
  return (
    value === "draft" ||
    value === "active" ||
    value === "waiting_peer" ||
    value === "waiting_owner" ||
    value === "waiting_review" ||
    value === "blocked" ||
    value === "completed" ||
    value === "archived"
  );
}

function isRequirementAcceptanceStatus(value: unknown): value is RequirementAcceptanceStatus {
  return (
    value === "not_requested" ||
    value === "pending" ||
    value === "accepted" ||
    value === "rejected"
  );
}

function isRequirementAggregateRecord(value: unknown): value is RequirementAggregateRecord {
  if (!value || typeof value !== "object") {
    return false;
  }
  const candidate = value as Partial<RequirementAggregateRecord>;
  return (
    typeof candidate.id === "string" &&
    typeof candidate.companyId === "string" &&
    (candidate.kind === "strategic" || candidate.kind === "execution") &&
    typeof candidate.primary === "boolean" &&
    Array.isArray(candidate.memberIds) &&
    typeof candidate.ownerLabel === "string" &&
    typeof candidate.stage === "string" &&
    typeof candidate.summary === "string" &&
    typeof candidate.nextAction === "string" &&
    typeof candidate.startedAt === "number" &&
    typeof candidate.updatedAt === "number" &&
    typeof candidate.revision === "number" &&
    isRequirementLifecycleState(candidate.status) &&
    isRequirementAcceptanceStatus(candidate.acceptanceStatus ?? "not_requested")
  );
}

function getRequirementAggregateCacheKey(companyId: string) {
  return `${REQUIREMENT_AGGREGATE_CACHE_PREFIX}${companyId.trim()}`;
}

export function sanitizeRequirementAggregateRecords(
  companyId: string,
  records: RequirementAggregateRecord[],
): RequirementAggregateRecord[] {
  const deduped = new Map<string, RequirementAggregateRecord>();
  records.forEach((record) => {
    if (!isRequirementAggregateRecord(record) || record.companyId !== companyId) {
      return;
    }
    const previous = deduped.get(record.id);
    if (!previous || record.updatedAt >= previous.updatedAt) {
      deduped.set(record.id, {
        ...record,
        topicKey: record.topicKey?.trim() || null,
        workItemId: record.workItemId?.trim() || null,
        roomId: record.roomId?.trim() || null,
        ownerActorId: record.ownerActorId?.trim() || null,
        sourceConversationId: record.sourceConversationId?.trim() || null,
        memberIds: [...new Set(record.memberIds.filter(Boolean))].sort((left, right) =>
          left.localeCompare(right),
        ),
        lastEvidenceAt: typeof record.lastEvidenceAt === "number" ? record.lastEvidenceAt : null,
        acceptanceStatus: isRequirementAcceptanceStatus(record.acceptanceStatus)
          ? record.acceptanceStatus
          : "not_requested",
        acceptanceNote:
          typeof record.acceptanceNote === "string" && record.acceptanceNote.trim().length > 0
            ? record.acceptanceNote.trim()
            : null,
      });
    }
  });

  let primaryAssigned = false;
  return [...deduped.values()]
    .sort((left, right) => right.updatedAt - left.updatedAt)
    .map((record) => {
      if (record.primary && !primaryAssigned) {
        primaryAssigned = true;
        return record;
      }
      if (record.primary) {
        return { ...record, primary: false };
      }
      return record;
    });
}

export function loadRequirementAggregateRecords(
  companyId: string | null | undefined,
): RequirementAggregateRecord[] {
  if (!companyId) {
    return [];
  }
  const raw = localStorage.getItem(getRequirementAggregateCacheKey(companyId));
  if (!raw) {
    return [];
  }
  try {
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) {
      return [];
    }
    return sanitizeRequirementAggregateRecords(companyId, parsed);
  } catch {
    return [];
  }
}

export function persistRequirementAggregateRecords(
  companyId: string | null | undefined,
  records: RequirementAggregateRecord[],
) {
  if (!companyId) {
    return;
  }
  const sanitized = sanitizeRequirementAggregateRecords(companyId, records).slice(
    0,
    REQUIREMENT_AGGREGATE_LIMIT,
  );
  localStorage.setItem(getRequirementAggregateCacheKey(companyId), JSON.stringify(sanitized));
}

export function clearRequirementAggregateRecords(companyId: string | null | undefined) {
  if (!companyId) {
    return;
  }
  localStorage.removeItem(getRequirementAggregateCacheKey(companyId));
}
