import type {
  ProviderRuntimeStreamKind,
} from "../../infrastructure/gateway/runtime/types";
import type {
  DispatchCheckoutState,
  DispatchReleaseReason,
} from "../../domain/delegation/types";

export type AgentSessionState =
  | "unknown"
  | "idle"
  | "running"
  | "streaming"
  | "error"
  | "offline";

export type AgentRunState =
  | "accepted"
  | "running"
  | "streaming"
  | "completed"
  | "aborted"
  | "error";

export type AgentRuntimeAvailability =
  | "no_signal"
  | "idle"
  | "busy"
  | "degraded"
  | "offline";

export type AgentWorkloadState = "free" | "busy" | "saturated";

export type AgentSessionSource = "lifecycle" | "session_status" | "sessions_list" | "fallback";

export type AgentRuntimeEvidence = {
  kind: "run" | "session" | "status" | "error";
  summary: string;
  timestamp: number;
};

export type AgentSessionExecutionContext = {
  dispatchId: string;
  workItemId: string | null;
  assignment: string;
  objective: string;
  checkoutState: Extract<DispatchCheckoutState, "claimed" | "released">;
  actorId: string | null;
  sessionKey: string;
  updatedAt: number;
  checkedOutAt: number | null;
  releasedAt: number | null;
  releaseReason: DispatchReleaseReason | null;
  source: "dispatch_checkout";
};

export type AgentSessionRecord = {
  sessionKey: string;
  agentId: string | null;
  providerId: string;
  sessionState: AgentSessionState;
  lastSeenAt: number | null;
  lastStatusSyncAt: number | null;
  lastMessageAt: number | null;
  abortedLastRun: boolean;
  lastError: string | null;
  lastTerminalRunState?: Extract<AgentRunState, "completed" | "aborted" | "error"> | null;
  lastTerminalSummary?: string | null;
  executionContext?: AgentSessionExecutionContext | null;
  source: AgentSessionSource;
};

export type AgentRunRecord = {
  runId: string;
  agentId: string | null;
  sessionKey: string;
  providerId: string;
  state: AgentRunState;
  startedAt: number;
  lastEventAt: number;
  endedAt: number | null;
  streamKindsSeen: ProviderRuntimeStreamKind[];
  toolNamesSeen: string[];
  error: string | null;
};

export type AgentRuntimeRecord = {
  agentId: string;
  providerId: string;
  availability: AgentRuntimeAvailability;
  activeSessionKeys: string[];
  activeRunIds: string[];
  lastSeenAt: number | null;
  lastBusyAt: number | null;
  lastIdleAt: number | null;
  latestTerminalAt?: number | null;
  latestTerminalSummary?: string | null;
  currentWorkload: AgentWorkloadState;
  runtimeEvidence: AgentRuntimeEvidence[];
};

export type CoordinationState =
  | "none"
  | "pending_ack"
  | "executing"
  | "waiting_peer"
  | "waiting_input"
  | "explicit_blocked"
  | "completed";

export type InterventionState =
  | "healthy"
  | "overdue"
  | "escalated"
  | "takeover_required";

export type CanonicalAgentStatusSource = "authority" | "fallback";

export type CanonicalAgentStatusCoverage =
  | "authority_complete"
  | "authority_partial"
  | "fallback";

export type CanonicalAgentStatusHealthRecord = {
  source: CanonicalAgentStatusSource;
  coverage: CanonicalAgentStatusCoverage;
  coveredAgentCount: number;
  expectedAgentCount: number;
  missingAgentIds: string[];
  isComplete: boolean;
  generatedAt: number | null;
  note: string | null;
};

export type CanonicalAgentStatusRecord = {
  agentId: string;
  runtimeState: AgentRuntimeAvailability;
  coordinationState: CoordinationState;
  interventionState: InterventionState;
  reason: string;
  currentAssignment: string;
  currentObjective: string;
  latestSignalAt: number | null;
  activeSessionCount: number;
  activeRunCount: number;
  openDispatchCount: number;
  blockedDispatchCount: number;
  openSupportRequestCount: number;
  blockedSupportRequestCount: number;
  openRequestCount: number;
  blockedRequestCount: number;
  openHandoffCount: number;
  blockedHandoffCount: number;
  openEscalationCount: number;
  blockedWorkItemCount: number;
  primaryWorkItemId: string | null;
};

export type RuntimeProjectionInput = {
  agentIds?: string[];
  providerId: string;
  sessions: AgentSessionRecord[];
  runs: AgentRunRecord[];
};
