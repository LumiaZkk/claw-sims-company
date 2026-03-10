export type WorkItemStatus =
  | "draft"
  | "active"
  | "waiting_review"
  | "waiting_owner"
  | "completed"
  | "blocked"
  | "archived";

export type WorkItemKind = "strategic" | "execution" | "artifact";

export type WorkStepStatus = "pending" | "active" | "done" | "blocked" | "skipped";

export interface WorkStepRecord {
  id: string;
  title: string;
  assigneeActorId?: string | null;
  assigneeLabel: string;
  status: WorkStepStatus;
  completionCriteria?: string | null;
  detail?: string | null;
  updatedAt: number;
}

export interface ConversationMissionStepRecord {
  id: string;
  title: string;
  assigneeLabel: string;
  assigneeAgentId?: string | null;
  status: "done" | "wip" | "pending";
  statusLabel: string;
  detail?: string | null;
  isCurrent: boolean;
  isNext: boolean;
}

export interface ConversationMissionRecord {
  id: string;
  sessionKey: string;
  topicKey?: string;
  roomId?: string;
  startedAt?: number;
  title: string;
  statusLabel: string;
  progressLabel: string;
  ownerAgentId?: string | null;
  ownerLabel: string;
  currentStepLabel: string;
  nextAgentId?: string | null;
  nextLabel: string;
  summary: string;
  guidance: string;
  completed: boolean;
  updatedAt: number;
  planSteps: ConversationMissionStepRecord[];
}

export interface WorkItemRecord {
  id: string;
  workKey: string;
  kind: WorkItemKind;
  roundId: string;
  companyId: string;
  sessionKey?: string;
  topicKey?: string;
  sourceActorId?: string | null;
  sourceActorLabel?: string | null;
  sourceSessionKey?: string | null;
  sourceConversationId?: string | null;
  providerId?: string | null;
  title: string;
  goal: string;
  headline: string;
  displayStage: string;
  displaySummary: string;
  displayOwnerLabel: string;
  displayNextAction: string;
  status: WorkItemStatus;
  stageLabel: string;
  ownerActorId?: string | null;
  ownerLabel: string;
  batonActorId?: string | null;
  batonLabel: string;
  roomId?: string | null;
  artifactIds: string[];
  dispatchIds: string[];
  startedAt: number;
  updatedAt: number;
  completedAt?: number | null;
  summary: string;
  nextAction: string;
  steps: WorkStepRecord[];
  sourceMissionId?: string;
}

export interface ConversationStateRecord {
  companyId: string;
  conversationId: string;
  currentWorkKey?: string | null;
  currentWorkItemId?: string | null;
  currentRoundId?: string | null;
  updatedAt: number;
}

export type RoundMessageSnapshot = {
  role: "user" | "assistant" | "system" | "toolResult";
  text: string;
  timestamp: number;
};

export interface RoundRecord {
  id: string;
  companyId: string;
  workItemId?: string | null;
  roomId?: string | null;
  title: string;
  preview?: string | null;
  reason?: "new" | "reset" | "deleted" | "product";
  sourceActorId?: string | null;
  sourceActorLabel?: string | null;
  sourceSessionKey?: string | null;
  sourceConversationId?: string | null;
  providerArchiveId?: string | null;
  providerId?: string | null;
  messages: RoundMessageSnapshot[];
  archivedAt: number;
  restorable: boolean;
}

export type TaskStepStatus = "done" | "wip" | "pending";

export type TaskExecutionState =
  | "idle"
  | "running"
  | "waiting_input"
  | "waiting_peer"
  | "blocked_timeout"
  | "blocked_tool_failure"
  | "manual_takeover_required"
  | "completed"
  | "unknown";

export interface TaskStep {
  text: string;
  status: TaskStepStatus;
  assignee?: string;
}

export interface TrackedTask {
  id: string;
  title: string;
  sessionKey: string;
  agentId: string;
  steps: TaskStep[];
  createdAt: number;
  updatedAt: number;
  source?: "session" | "file";
  sourceAgentId?: string;
  ownerAgentId?: string;
  assigneeAgentIds?: string[];
  state?: TaskExecutionState;
  summary?: string;
  blockedReason?: string;
  takeoverSessionKey?: string;
  lastSyncedAt?: number;
}
