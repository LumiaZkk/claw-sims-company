export type { RetrospectiveRecord } from "../artifact/types";

export type VerificationState = "pending" | "verified" | "failed";

export type ClosureDecision = "keep_open" | "close_complete" | "close_partial" | "manual_takeover";

export interface RecoveryAction {
  id: string;
  workItemId?: string | null;
  kind: "retry" | "reassign" | "compact" | "manual_takeover" | "escalate";
  reason: string;
  createdAt: number;
}

export interface ExceptionRecord {
  id: string;
  scope: "dispatch" | "mission" | "artifact" | "runtime";
  status: "open" | "resolved";
  title: string;
  summary: string;
  relatedWorkItemId?: string | null;
  relatedDispatchId?: string | null;
  createdAt: number;
  updatedAt: number;
}

export interface RecoveryRule {
  id: string;
  name: string;
  trigger: "timeout" | "tool_failure" | "missing_reply" | "verification_failed";
  action: RecoveryAction["kind"];
  enabled: boolean;
}

export type ApprovalScope =
  | "mission"
  | "dispatch"
  | "artifact"
  | "org"
  | "automation"
  | "runtime";

export type ApprovalActionType =
  | "employee_fire"
  | "department_change"
  | "automation_enable"
  | "runtime_restore";

export type ApprovalStatus = "pending" | "approved" | "rejected";

export interface ApprovalRecord {
  id: string;
  companyId: string;
  revision?: number;
  scope: ApprovalScope;
  actionType: ApprovalActionType;
  status: ApprovalStatus;
  summary: string;
  detail?: string | null;
  requestedByActorId?: string | null;
  requestedByLabel?: string | null;
  targetActorId?: string | null;
  targetLabel?: string | null;
  payload?: Record<string, unknown>;
  requestedAt: number;
  resolution?: string | null;
  decidedByActorId?: string | null;
  decidedByLabel?: string | null;
  createdAt: number;
  updatedAt: number;
  resolvedAt?: number | null;
}

export interface LegacyApprovalRecord {
  id: string;
  scope: "mission" | "dispatch" | "artifact" | "org";
  status: "pending" | "approved" | "rejected";
  requestedAt: number;
  resolvedAt?: number;
}

export interface AutonomyPolicy {
  id: string;
  level: "manual" | "assisted" | "autonomous";
  allowAutoDispatch: boolean;
  allowAutoRetry: boolean;
  allowAutoClose: boolean;
}
