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

export interface ApprovalRecord {
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
