import type {
  AgentRunRecord,
  AgentRuntimeAvailability,
  AgentRuntimeRecord,
  AgentSessionRecord,
  CanonicalAgentStatusHealthRecord,
  CoordinationState,
  InterventionState,
} from "../agent-runtime";
import type { ProviderProcessRecord } from "../../infrastructure/gateway/runtime/types";
import type { WorkItemRecord } from "../../domain/mission/types";
import type { Company, EmployeeRef } from "../../domain/org/types";

export type RuntimeAttentionLevel = "healthy" | "watch" | "critical";
export type RuntimeSceneZoneId =
  | "command-deck"
  | "tech-lab"
  | "ops-rail"
  | "people-hub"
  | "studio-floor";

export type RuntimeInspectorAgentSurface = {
  agentId: string;
  nickname: string;
  role: string;
  avatarJobId?: string;
  employee: EmployeeRef;
  departmentId: string | null;
  departmentName: string;
  departmentKind: "meta" | "support" | "business";
  statusOrigin: "authority" | "fallback";
  availability: AgentRuntimeAvailability;
  runtimeState: AgentRuntimeAvailability;
  coordinationState: CoordinationState;
  interventionState: InterventionState;
  legacyStatus: "running" | "idle" | "stopped";
  workload: AgentRuntimeRecord["currentWorkload"];
  attention: RuntimeAttentionLevel;
  attentionReason: string;
  reason: string;
  activeSessionCount: number;
  activeRunCount: number;
  lastSeenAt: number | null;
  lastBusyAt: number | null;
  lastIdleAt: number | null;
  latestSignalAt: number | null;
  currentAssignment: string;
  currentObjective: string;
  activityLabel: string;
  sceneZoneId: RuntimeSceneZoneId;
  sceneZoneLabel: string;
  sceneActivityLabel: string;
  runtimeEvidence: AgentRuntimeRecord["runtimeEvidence"];
  sessions: AgentSessionRecord[];
  runs: AgentRunRecord[];
  primaryWorkItem: WorkItemRecord | null;
  openDispatchCount: number;
  blockedDispatchCount: number;
  openSupportRequestCount: number;
  blockedSupportRequestCount: number;
  openEscalationCount: number;
  blockedWorkItemCount: number;
};

export type RuntimeInspectorSceneZone = {
  id: RuntimeSceneZoneId;
  label: string;
  description: string;
  tone: string;
  agents: RuntimeInspectorAgentSurface[];
  busyCount: number;
  attentionCount: number;
  status: RuntimeAttentionLevel;
};

export type RuntimeInspectorTimelineEvent = {
  id: string;
  agentId: string;
  nickname: string;
  title: string;
  summary: string;
  timestamp: number | null;
  tone: "info" | "warning" | "danger" | "success";
};

export type RuntimeInspectorReplayEvent = {
  id: string;
  agentId: string;
  nickname: string;
  title: string;
  summary: string;
  timestamp: number | null;
  tone: "info" | "warning" | "danger" | "success";
  phaseLabel: string;
  modalityLabel: string;
};

export type RuntimeInspectorHistoryEvent = {
  id: string;
  agentId: string | null;
  label: string;
  summary: string;
  timestamp: number | null;
  tone: "info" | "warning" | "danger" | "success";
  sourceLabel: string;
};

export type RuntimeInspectorChainLink = {
  id: string;
  kind: "work_item" | "dispatch" | "support_request" | "escalation";
  kindLabel: string;
  stateLabel: string;
  tone: "info" | "warning" | "danger";
  fromAgentId: string | null;
  fromLabel: string;
  toAgentId: string | null;
  toLabel: string;
  summary: string;
  updatedAt: number;
  focusAgentId: string | null;
};

export type RuntimeInspectorRecommendedAction = {
  id: string;
  label: string;
  summary: string;
  to: string;
  tone: "default" | "warning" | "danger";
  agentId?: string;
};

export type RuntimeInspectorSurface = {
  company: Company;
  agents: RuntimeInspectorAgentSurface[];
  statusHealth: CanonicalAgentStatusHealthRecord;
  statusCoverage: {
    label: string;
    detail: string;
    missingAgentIds: string[];
  };
  sceneZones: RuntimeInspectorSceneZone[];
  focusAgent: RuntimeInspectorAgentSurface | null;
  replay: RuntimeInspectorReplayEvent[];
  historyWindow: RuntimeInspectorHistoryEvent[];
  chainLinks: RuntimeInspectorChainLink[];
  triageQueue: RuntimeInspectorAgentSurface[];
  watchlist: RuntimeInspectorAgentSurface[];
  timeline: RuntimeInspectorTimelineEvent[];
  recommendedActions: RuntimeInspectorRecommendedAction[];
  busyAgents: number;
  degradedAgents: number;
  criticalAgents: number;
  activeRuns: number;
  activeSessions: number;
};

export type RuntimeInspectorLiveProcess = {
  processId: string;
  sessionKey: string | null;
  title: string;
  command: string | null;
  status: ProviderProcessRecord["state"];
  statusLabel: string;
  summary: string;
  tone: "info" | "warning" | "danger" | "success";
  startedAt: number | null;
  updatedAt: number | null;
  endedAt: number | null;
  exitCode: number | null;
};

export type RuntimeInspectorProcessTelemetry = {
  capabilityState: "idle" | "loading" | "ready" | "unsupported" | "error";
  agentId: string | null;
  scope: "focused" | "global";
  lastCheckedAt: number | null;
  error: string | null;
  processes: RuntimeInspectorLiveProcess[];
  runningCount: number;
  totalCount: number;
};

export type RuntimeInspectorStatusSource = "authority_complete" | "authority_partial" | "fallback";
