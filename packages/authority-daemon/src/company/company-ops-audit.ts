import { normalizeEscalationRevision } from "../../../../src/domain/delegation/escalation";
import {
  createCompanyEvent,
  type CompanyEvent,
} from "../../../../src/domain/delegation/events";
import type { AuthorityCompanyRuntimeSnapshot } from "../../../../src/infrastructure/authority/contract";

type HeartbeatCycleAuditEventInput = {
  companyId: string;
  createdAt: number;
  trigger: "interval" | "event";
  ran: boolean;
  skipReason: string | null;
  reasons: string[];
  actions: string[];
};

function normalizeRevision(value: number | null | undefined): number {
  return Number.isFinite(value) && Number(value) > 0 ? Math.floor(Number(value)) : 1;
}

function recordsChangedById<T extends { id: string }>(input: {
  previous: T[];
  next: T[];
}): T[] {
  const previousById = new Map(input.previous.map((record) => [record.id, record] as const));
  return input.next.filter((record) => {
    const previous = previousById.get(record.id);
    return !previous || JSON.stringify(previous) !== JSON.stringify(record);
  });
}

function recordsDeletedById<T extends { id: string }>(input: {
  previous: T[];
  next: T[];
}): T[] {
  const nextIds = new Set(input.next.map((record) => record.id));
  return input.previous.filter((record) => !nextIds.has(record.id));
}

export function createHeartbeatCycleAuditEvent(input: HeartbeatCycleAuditEventInput): CompanyEvent {
  return createCompanyEvent({
    companyId: input.companyId,
    kind: "heartbeat_cycle_checked",
    fromActorId: "system:company-ops-engine",
    createdAt: input.createdAt,
    payload: {
      trigger: input.trigger,
      ran: input.ran,
      skipReason: input.skipReason,
      reasons: input.reasons,
      actions: input.actions,
      actionCount: input.actions.length,
    },
  });
}

export function buildCompanyOpsAuditEvents(input: {
  companyId: string;
  previousRuntime: AuthorityCompanyRuntimeSnapshot;
  nextRuntime: AuthorityCompanyRuntimeSnapshot;
  actions: string[];
  createdAt?: number;
}): CompanyEvent[] {
  const createdAt = input.createdAt ?? Date.now();
  const events: CompanyEvent[] = [];

  if (input.actions.length > 0) {
    events.push(
      createCompanyEvent({
        companyId: input.companyId,
        kind: "ops_cycle_applied",
        fromActorId: "system:company-ops-engine",
        createdAt,
        payload: {
          actions: input.actions,
          actionCount: input.actions.length,
        },
      }),
    );
  }

  for (const request of recordsChangedById({
    previous: input.previousRuntime.activeSupportRequests,
    next: input.nextRuntime.activeSupportRequests,
  })) {
    events.push(
      createCompanyEvent({
        companyId: input.companyId,
        kind: "support_request_record_upserted",
        workItemId: request.workItemId,
        roomId: request.roomId ?? undefined,
        fromActorId: request.requestedByActorId || "system:company-ops-engine",
        targetActorId: request.ownerActorId ?? undefined,
        createdAt: request.updatedAt,
        payload: {
          requestId: request.id,
          revision: normalizeRevision(request.revision),
          requesterDepartmentId: request.requesterDepartmentId,
          targetDepartmentId: request.targetDepartmentId,
          requestedByActorId: request.requestedByActorId,
          ownerActorId: request.ownerActorId ?? null,
          summary: request.summary,
          detail: request.detail ?? null,
          status: request.status,
          slaDueAt: request.slaDueAt ?? null,
          escalationId: request.escalationId ?? null,
        },
      }),
    );
  }

  for (const request of recordsDeletedById({
    previous: input.previousRuntime.activeSupportRequests,
    next: input.nextRuntime.activeSupportRequests,
  })) {
    events.push(
      createCompanyEvent({
        companyId: input.companyId,
        kind: "support_request_record_deleted",
        workItemId: request.workItemId,
        roomId: request.roomId ?? undefined,
        fromActorId: request.requestedByActorId || "system:company-ops-engine",
        targetActorId: request.ownerActorId ?? undefined,
        createdAt,
        payload: {
          requestId: request.id,
          revision: normalizeRevision(request.revision),
          requesterDepartmentId: request.requesterDepartmentId,
          targetDepartmentId: request.targetDepartmentId,
          requestedByActorId: request.requestedByActorId,
          ownerActorId: request.ownerActorId ?? null,
          summary: request.summary,
          detail: request.detail ?? null,
          status: request.status,
          slaDueAt: request.slaDueAt ?? null,
          escalationId: request.escalationId ?? null,
        },
      }),
    );
  }

  for (const escalation of recordsChangedById({
    previous: input.previousRuntime.activeEscalations,
    next: input.nextRuntime.activeEscalations,
  })) {
    events.push(
      createCompanyEvent({
        companyId: input.companyId,
        kind: "escalation_record_upserted",
        workItemId: escalation.workItemId ?? undefined,
        roomId: escalation.roomId ?? undefined,
        fromActorId: "system:company-ops-engine",
        targetActorId: escalation.targetActorId,
        createdAt: escalation.updatedAt,
        payload: {
          escalationId: escalation.id,
          revision: normalizeEscalationRevision(escalation.revision),
          sourceType: escalation.sourceType,
          sourceId: escalation.sourceId,
          requesterDepartmentId: escalation.requesterDepartmentId ?? null,
          reason: escalation.reason,
          severity: escalation.severity,
          status: escalation.status,
          decisionTicketId: escalation.decisionTicketId ?? null,
        },
      }),
    );
  }

  for (const escalation of recordsDeletedById({
    previous: input.previousRuntime.activeEscalations,
    next: input.nextRuntime.activeEscalations,
  })) {
    events.push(
      createCompanyEvent({
        companyId: input.companyId,
        kind: "escalation_record_deleted",
        workItemId: escalation.workItemId ?? undefined,
        roomId: escalation.roomId ?? undefined,
        fromActorId: "system:company-ops-engine",
        targetActorId: escalation.targetActorId,
        createdAt,
        payload: {
          escalationId: escalation.id,
          revision: normalizeEscalationRevision(escalation.revision),
          sourceType: escalation.sourceType,
          sourceId: escalation.sourceId,
          requesterDepartmentId: escalation.requesterDepartmentId ?? null,
          reason: escalation.reason,
          severity: escalation.severity,
          status: escalation.status,
          decisionTicketId: escalation.decisionTicketId ?? null,
        },
      }),
    );
  }

  for (const ticket of recordsChangedById({
    previous: input.previousRuntime.activeDecisionTickets,
    next: input.nextRuntime.activeDecisionTickets,
  })) {
    events.push(
      createCompanyEvent({
        companyId: input.companyId,
        kind: "decision_record_upserted",
        workItemId: ticket.workItemId ?? undefined,
        roomId: ticket.roomId ?? undefined,
        fromActorId: ticket.decisionOwnerActorId || "system:company-ops-engine",
        targetActorId: ticket.decisionOwnerActorId || undefined,
        sessionKey: ticket.sourceConversationId ?? undefined,
        createdAt: ticket.updatedAt,
        payload: {
          ticketId: ticket.id,
          sourceType: ticket.sourceType,
          sourceId: ticket.sourceId,
          escalationId: ticket.escalationId ?? null,
          aggregateId: ticket.aggregateId ?? null,
          decisionType: ticket.decisionType,
          summary: ticket.summary,
          requiresHuman: ticket.requiresHuman,
          status: ticket.status,
          resolution: ticket.resolution ?? null,
          resolutionOptionId: ticket.resolutionOptionId ?? null,
          revision: normalizeRevision(ticket.revision),
        },
      }),
    );
  }

  for (const ticket of recordsDeletedById({
    previous: input.previousRuntime.activeDecisionTickets,
    next: input.nextRuntime.activeDecisionTickets,
  })) {
    events.push(
      createCompanyEvent({
        companyId: input.companyId,
        kind: "decision_record_deleted",
        workItemId: ticket.workItemId ?? undefined,
        roomId: ticket.roomId ?? undefined,
        fromActorId: ticket.decisionOwnerActorId || "system:company-ops-engine",
        targetActorId: ticket.decisionOwnerActorId || undefined,
        sessionKey: ticket.sourceConversationId ?? undefined,
        createdAt,
        payload: {
          ticketId: ticket.id,
          sourceType: ticket.sourceType,
          sourceId: ticket.sourceId,
          escalationId: ticket.escalationId ?? null,
          aggregateId: ticket.aggregateId ?? null,
          decisionType: ticket.decisionType,
          summary: ticket.summary,
          requiresHuman: ticket.requiresHuman,
          status: ticket.status,
          resolution: ticket.resolution ?? null,
          resolutionOptionId: ticket.resolutionOptionId ?? null,
          revision: normalizeRevision(ticket.revision),
        },
      }),
    );
  }

  return events;
}
