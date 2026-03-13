import type { RequirementAggregateRecord } from "../../domain/mission/types";

export const REQUIREMENT_AGGREGATE_MATERIAL_FIELDS = [
  "topicKey",
  "kind",
  "workItemId",
  "roomId",
  "ownerActorId",
  "ownerLabel",
  "lifecyclePhase",
  "stageGateStatus",
  "stage",
  "summary",
  "nextAction",
  "memberIds",
  "sourceConversationId",
  "startedAt",
  "status",
  "acceptanceStatus",
  "acceptanceNote",
] as const;

export type RequirementAggregateMaterialField =
  (typeof REQUIREMENT_AGGREGATE_MATERIAL_FIELDS)[number];

function normalizeString(value: string | null | undefined): string | null {
  return typeof value === "string" && value.trim().length > 0 ? value.trim() : null;
}

function normalizeMemberIds(memberIds: string[]): string[] {
  return [...new Set(memberIds.map((memberId) => normalizeString(memberId)).filter((memberId): memberId is string => Boolean(memberId)))]
    .sort((left, right) => left.localeCompare(right));
}

function readMaterialField(
  aggregate: RequirementAggregateRecord,
  field: RequirementAggregateMaterialField,
): string | number | null {
  switch (field) {
    case "memberIds":
      return normalizeMemberIds(aggregate.memberIds).join("|");
    case "acceptanceNote":
      return normalizeString(aggregate.acceptanceNote);
    case "topicKey":
    case "workItemId":
    case "roomId":
    case "ownerActorId":
    case "sourceConversationId":
      return normalizeString(aggregate[field]);
    default:
      return aggregate[field];
  }
}

export function diffRequirementAggregateMaterialFields(
  previousAggregate: RequirementAggregateRecord,
  nextAggregate: RequirementAggregateRecord,
): RequirementAggregateMaterialField[] {
  return REQUIREMENT_AGGREGATE_MATERIAL_FIELDS.filter(
    (field) => readMaterialField(previousAggregate, field) !== readMaterialField(nextAggregate, field),
  );
}

export function hasRequirementAggregateMaterialChanges(
  previousAggregate: RequirementAggregateRecord,
  nextAggregate: RequirementAggregateRecord,
): boolean {
  return diffRequirementAggregateMaterialFields(previousAggregate, nextAggregate).length > 0;
}
