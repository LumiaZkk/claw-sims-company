import { gateway } from "../gateway";
import { createCompanyEvent, type CompanyEvent } from "../../domain/delegation/events";

export type OperatorActionAuditSurface =
  | "ceo"
  | "chat"
  | "board"
  | "requirement_center"
  | "lobby"
  | "automation";

export type OperatorActionAuditName =
  | "approval_request"
  | "approval_approve"
  | "approval_reject"
  | "blueprint_copy"
  | "communication_recovery"
  | "requirement_acceptance_request"
  | "requirement_acceptance_accept"
  | "requirement_acceptance_revise"
  | "requirement_acceptance_reopen"
  | "requirement_change_request"
  | "focus_action_dispatch"
  | "group_chat_route_open"
  | "knowledge_sync"
  | "ops_route_open"
  | "takeover_case_acknowledge"
  | "takeover_case_assign"
  | "takeover_case_start"
  | "takeover_case_resolve"
  | "takeover_case_redispatch"
  | "takeover_case_archive"
  | "takeover_pack_copy"
  | "takeover_route_open"
  | "quick_task_assign"
  | "employee_hire"
  | "employee_role_update"
  | "employee_fire";
export type OperatorActionAuditOutcome = "succeeded" | "failed";

export function buildOperatorActionAuditEvent(input: {
  companyId: string;
  action: OperatorActionAuditName;
  surface: OperatorActionAuditSurface;
  outcome: OperatorActionAuditOutcome;
  force?: boolean;
  actorId?: string | null;
  error?: string | null;
  requestsAdded?: number;
  requestsUpdated?: number;
  tasksRecovered?: number;
  handoffsRecovered?: number;
  details?: Record<string, unknown>;
  timestamp?: number;
}): CompanyEvent {
  return createCompanyEvent({
    companyId: input.companyId,
    kind: "operator_action_recorded",
    fromActorId: input.actorId?.trim() || "operator:local-user",
    createdAt: input.timestamp ?? Date.now(),
    payload: {
      action: input.action,
      surface: input.surface,
      outcome: input.outcome,
      force: Boolean(input.force),
      error: input.error ?? null,
      requestsAdded: input.requestsAdded ?? 0,
      requestsUpdated: input.requestsUpdated ?? 0,
      tasksRecovered: input.tasksRecovered ?? 0,
      handoffsRecovered: input.handoffsRecovered ?? 0,
      ...(input.details ?? {}),
    },
  });
}

export async function appendOperatorActionAuditEvent(input: {
  companyId: string;
  action: OperatorActionAuditName;
  surface: OperatorActionAuditSurface;
  outcome: OperatorActionAuditOutcome;
  force?: boolean;
  actorId?: string | null;
  error?: string | null;
  requestsAdded?: number;
  requestsUpdated?: number;
  tasksRecovered?: number;
  handoffsRecovered?: number;
  details?: Record<string, unknown>;
  timestamp?: number;
}) {
  try {
    await gateway.appendCompanyEvent(buildOperatorActionAuditEvent(input));
  } catch (error) {
    console.warn("Failed to append operator action audit event", error);
  }
}
