import { createCompanyEvent } from "../../../domain/delegation/events";
import { gateway } from "../../../application/gateway";
import {
  applyRequirementEvidenceToAggregates,
  reconcileRequirementAggregateState,
  sanitizeRequirementAggregateRecords,
} from "../../../application/mission/requirement-aggregate";
import {
  loadRequirementAggregateRecords,
  persistRequirementAggregateRecords,
} from "../persistence/requirement-aggregate-persistence";
import {
  loadRequirementEvidenceEvents,
  persistRequirementEvidenceEvents,
  sanitizeRequirementEvidenceEvents,
} from "../persistence/requirement-evidence-persistence";
import type {
  CompanyRuntimeState,
  RequirementAggregateRecord,
  RequirementEvidenceEvent,
  RuntimeGet,
  RuntimeSet,
} from "./types";

type RequirementWorkflowEventKind =
  | "requirement_seeded"
  | "requirement_promoted"
  | "requirement_progressed"
  | "requirement_owner_changed"
  | "requirement_room_bound"
  | "requirement_completed"
  | "requirement_acceptance_requested"
  | "requirement_accepted"
  | "requirement_reopened";

export function emitRequirementCompanyEvent(input: {
  companyId: string;
  kind: RequirementWorkflowEventKind;
  aggregate: RequirementAggregateRecord;
  actorId?: string | null;
}) {
  void gateway.appendCompanyEvent(
    createCompanyEvent({
      companyId: input.companyId,
      kind: input.kind,
      workItemId: input.aggregate.workItemId ?? undefined,
      topicKey: input.aggregate.topicKey ?? undefined,
      roomId: input.aggregate.roomId ?? undefined,
      fromActorId: input.actorId ?? input.aggregate.ownerActorId ?? "system:requirement-aggregate",
      targetActorId: input.aggregate.ownerActorId ?? undefined,
      sessionKey: input.aggregate.sourceConversationId ?? undefined,
      payload: {
        ownerActorId: input.aggregate.ownerActorId,
        ownerLabel: input.aggregate.ownerLabel,
        stage: input.aggregate.stage,
        summary: input.aggregate.summary,
        nextAction: input.aggregate.nextAction,
        memberIds: input.aggregate.memberIds,
        status: input.aggregate.status,
        acceptanceStatus: input.aggregate.acceptanceStatus,
        acceptanceNote: input.aggregate.acceptanceNote ?? null,
        revision: input.aggregate.revision,
      },
    }),
  ).catch((error) => {
    console.warn("Failed to append requirement company event", error);
  });
}

export function persistActiveRequirementAggregates(
  companyId: string | null | undefined,
  aggregates: RequirementAggregateRecord[],
) {
  persistRequirementAggregateRecords(companyId, aggregates);
}

export function persistActiveRequirementEvidence(
  companyId: string | null | undefined,
  evidence: RequirementEvidenceEvent[],
) {
  persistRequirementEvidenceEvents(companyId, evidence);
}

export function loadPersistedRequirementRuntimeState(companyId: string) {
  return {
    loadedRequirementAggregates: loadRequirementAggregateRecords(companyId),
    loadedRequirementEvidence: loadRequirementEvidenceEvents(companyId),
  };
}

export function reconcileActiveRequirementState(input: {
  companyId: string;
  activeRequirementAggregates: RequirementAggregateRecord[];
  primaryRequirementId: string | null;
  activeConversationStates: CompanyRuntimeState["activeConversationStates"];
  activeWorkItems: CompanyRuntimeState["activeWorkItems"];
  activeRoomRecords: CompanyRuntimeState["activeRoomRecords"];
  activeRequirementEvidence: RequirementEvidenceEvent[];
}) {
  return reconcileRequirementAggregateState({
    companyId: input.companyId,
    existingAggregates: input.activeRequirementAggregates,
    primaryRequirementId: input.primaryRequirementId,
    activeConversationStates: input.activeConversationStates,
    activeWorkItems: input.activeWorkItems,
    activeRoomRecords: input.activeRoomRecords,
    activeRequirementEvidence: input.activeRequirementEvidence,
  });
}

function resolveRequirementCompanyEventKind(input: {
  previousAggregate: RequirementAggregateRecord;
  nextAggregate: RequirementAggregateRecord;
  changes: Partial<
    Omit<RequirementAggregateRecord, "id" | "companyId" | "primary" | "revision">
  >;
}): RequirementWorkflowEventKind {
  const { previousAggregate, nextAggregate, changes } = input;
  if (nextAggregate.acceptanceStatus === "accepted") {
    return "requirement_accepted";
  }
  if (
    nextAggregate.acceptanceStatus === "pending" &&
    previousAggregate.acceptanceStatus !== "pending"
  ) {
    return "requirement_acceptance_requested";
  }
  if (
    nextAggregate.acceptanceStatus === "rejected" ||
    (previousAggregate.acceptanceStatus === "accepted" && nextAggregate.status === "active")
  ) {
    return "requirement_reopened";
  }
  if (nextAggregate.status === "completed" || nextAggregate.status === "archived") {
    return "requirement_completed";
  }
  if (changes.roomId && changes.roomId !== previousAggregate.roomId) {
    return "requirement_room_bound";
  }
  if (changes.ownerActorId && changes.ownerActorId !== previousAggregate.ownerActorId) {
    return "requirement_owner_changed";
  }
  return "requirement_progressed";
}

function buildRequirementEvidencePayload(input: {
  previousAggregate: RequirementAggregateRecord | null;
  nextAggregate: RequirementAggregateRecord;
}) {
  const { previousAggregate, nextAggregate } = input;
  return {
    ownerActorId: nextAggregate.ownerActorId,
    ownerLabel: nextAggregate.ownerLabel,
    stage: nextAggregate.stage,
    summary: nextAggregate.summary,
    nextAction: nextAggregate.nextAction,
    memberIds: nextAggregate.memberIds,
    status: nextAggregate.status,
    acceptanceStatus: nextAggregate.acceptanceStatus,
    acceptanceNote: nextAggregate.acceptanceNote ?? null,
    revision: nextAggregate.revision,
    workItemId: nextAggregate.workItemId,
    topicKey: nextAggregate.topicKey,
    roomId: nextAggregate.roomId,
    previousStatus: previousAggregate?.status ?? null,
    previousAcceptanceStatus: previousAggregate?.acceptanceStatus ?? null,
  };
}

export function buildRequirementLocalEvidence(input: {
  companyId: string;
  eventType: RequirementWorkflowEventKind;
  aggregate: RequirementAggregateRecord;
  previousAggregate: RequirementAggregateRecord | null;
  actorId?: string | null;
  timestamp: number;
  source?: RequirementEvidenceEvent["source"];
}): RequirementEvidenceEvent {
  return {
    id: `local:${input.aggregate.id}:${input.eventType}:${input.aggregate.revision}`,
    companyId: input.companyId,
    aggregateId: input.aggregate.id,
    source: input.source ?? "local-command",
    sessionKey: input.aggregate.sourceConversationId ?? null,
    actorId: input.actorId ?? input.aggregate.ownerActorId ?? null,
    eventType: input.eventType,
    timestamp: input.timestamp,
    payload: buildRequirementEvidencePayload({
      previousAggregate: input.previousAggregate,
      nextAggregate: input.aggregate,
    }),
    applied: true,
  };
}

export function appendRequirementLocalEvidence(input: {
  companyId: string;
  evidence: RequirementEvidenceEvent[];
  eventType: RequirementWorkflowEventKind;
  aggregate: RequirementAggregateRecord;
  previousAggregate: RequirementAggregateRecord | null;
  actorId?: string | null;
  timestamp: number;
  source?: RequirementEvidenceEvent["source"];
}) {
  return sanitizeRequirementEvidenceEvents(input.companyId, [
    buildRequirementLocalEvidence({
      companyId: input.companyId,
      eventType: input.eventType,
      aggregate: input.aggregate,
      previousAggregate: input.previousAggregate,
      actorId: input.actorId,
      timestamp: input.timestamp,
      source: input.source,
    }),
    ...input.evidence,
  ]);
}

export function buildRequirementActions(
  set: RuntimeSet,
  get: RuntimeGet,
): Pick<
  CompanyRuntimeState,
  "setPrimaryRequirement" | "applyRequirementTransition" | "ingestRequirementEvidence"
> {
  return {
    setPrimaryRequirement: (aggregateId) => {
      const {
        activeCompany,
        activeRequirementAggregates,
        activeRequirementEvidence,
        primaryRequirementId,
      } = get();
      if (!activeCompany) {
        return;
      }

      const nextPrimaryRequirementId =
        aggregateId && activeRequirementAggregates.some((record) => record.id === aggregateId)
          ? aggregateId
          : null;
      const nextAggregates = sanitizeRequirementAggregateRecords(
        activeRequirementAggregates,
        nextPrimaryRequirementId,
      );
      const promotedAggregate =
        nextPrimaryRequirementId
          ? nextAggregates.find((aggregate) => aggregate.id === nextPrimaryRequirementId) ?? null
          : null;
      const previousAggregate =
        primaryRequirementId
          ? activeRequirementAggregates.find((aggregate) => aggregate.id === primaryRequirementId) ?? null
          : null;
      const nextEvidence =
        promotedAggregate && nextPrimaryRequirementId !== primaryRequirementId
          ? appendRequirementLocalEvidence({
              companyId: activeCompany.id,
              evidence: activeRequirementEvidence,
              eventType: "requirement_promoted",
              aggregate: promotedAggregate,
              previousAggregate,
              actorId: promotedAggregate.ownerActorId,
              timestamp: Date.now(),
            })
          : activeRequirementEvidence;
      set({
        activeRequirementAggregates: nextAggregates,
        activeRequirementEvidence: nextEvidence,
        primaryRequirementId: nextPrimaryRequirementId,
      });
      persistActiveRequirementAggregates(activeCompany.id, nextAggregates);
      if (nextEvidence !== activeRequirementEvidence) {
        persistActiveRequirementEvidence(activeCompany.id, nextEvidence);
      }
      if (promotedAggregate && nextPrimaryRequirementId !== primaryRequirementId) {
        emitRequirementCompanyEvent({
          companyId: activeCompany.id,
          kind: "requirement_promoted",
          aggregate: promotedAggregate,
        });
      }
    },

    applyRequirementTransition: (transition) => {
      const {
        activeCompany,
        activeRequirementAggregates,
        activeRequirementEvidence,
        primaryRequirementId,
      } = get();
      if (!activeCompany) {
        return;
      }

      const target = activeRequirementAggregates.find((aggregate) => aggregate.id === transition.aggregateId);
      if (!target) {
        return;
      }

      const nextAggregates = sanitizeRequirementAggregateRecords(
        activeRequirementAggregates.map((aggregate) => {
          if (aggregate.id !== transition.aggregateId) {
            return aggregate;
          }
          return {
            ...aggregate,
            ...transition.changes,
            companyId: activeCompany.id,
            primary: aggregate.id === primaryRequirementId,
            revision: aggregate.revision + 1,
            updatedAt: Math.max(
              aggregate.updatedAt,
              transition.timestamp ?? Date.now(),
              transition.changes.updatedAt ?? 0,
            ),
            lastEvidenceAt:
              transition.changes.lastEvidenceAt ??
              transition.timestamp ??
              aggregate.lastEvidenceAt ??
              null,
          };
        }),
        primaryRequirementId,
      );

      const nextAggregate =
        nextAggregates.find((aggregate) => aggregate.id === transition.aggregateId) ?? null;
      const timestamp = transition.timestamp ?? Date.now();
      const kind = nextAggregate
        ? resolveRequirementCompanyEventKind({
            previousAggregate: target,
            nextAggregate,
            changes: transition.changes,
          })
        : null;
      const nextEvidence =
        nextAggregate && kind
          ? appendRequirementLocalEvidence({
              companyId: activeCompany.id,
              evidence: activeRequirementEvidence,
              eventType: kind,
              aggregate: nextAggregate,
              previousAggregate: target,
              actorId: transition.changes.ownerActorId ?? target.ownerActorId,
              timestamp,
              source: transition.source,
            })
          : activeRequirementEvidence;

      set({
        activeRequirementAggregates: nextAggregates,
        activeRequirementEvidence: nextEvidence,
      });
      persistActiveRequirementAggregates(activeCompany.id, nextAggregates);
      if (nextEvidence !== activeRequirementEvidence) {
        persistActiveRequirementEvidence(activeCompany.id, nextEvidence);
      }
      if (nextAggregate && kind) {
        emitRequirementCompanyEvent({
          companyId: activeCompany.id,
          kind,
          aggregate: nextAggregate,
          actorId: transition.changes.ownerActorId ?? target.ownerActorId,
        });
      }
    },

    ingestRequirementEvidence: (event) => {
      const {
        activeCompany,
        activeRequirementAggregates,
        activeRequirementEvidence,
        activeRoomRecords,
        primaryRequirementId,
      } = get();
      if (!activeCompany) {
        return;
      }

      const normalizedEvent: RequirementEvidenceEvent = {
        ...event,
        companyId: activeCompany.id,
        aggregateId: event.aggregateId?.trim() || null,
        sessionKey: event.sessionKey?.trim() || null,
        actorId: event.actorId?.trim() || null,
        payload: event.payload ?? {},
        applied: Boolean(event.applied),
      };
      const nextEvidence = sanitizeRequirementEvidenceEvents(activeCompany.id, [
        normalizedEvent,
        ...activeRequirementEvidence,
      ]);

      const applied = applyRequirementEvidenceToAggregates({
        company: activeCompany,
        activeRequirementAggregates,
        activeRoomRecords,
        primaryRequirementId,
        event: normalizedEvent,
      });
      const updatedEvidence = nextEvidence.map((entry) =>
        entry.id === normalizedEvent.id
          ? {
              ...entry,
              aggregateId: applied.aggregateId ?? entry.aggregateId,
              applied: applied.applied,
            }
          : entry,
      );

      set({
        activeRequirementAggregates: applied.activeRequirementAggregates,
        activeRequirementEvidence: updatedEvidence,
      });
      persistActiveRequirementEvidence(activeCompany.id, updatedEvidence);
      persistActiveRequirementAggregates(activeCompany.id, applied.activeRequirementAggregates);
    },
  };
}
