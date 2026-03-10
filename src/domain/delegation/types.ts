export type DispatchStatus =
  | "pending"
  | "sent"
  | "acknowledged"
  | "answered"
  | "blocked"
  | "superseded";

export type RoomVisibility = "public" | "system" | "debug";

export type RoomMessageSource =
  | "user"
  | "owner_dispatch"
  | "member_reply"
  | "member_message"
  | "system";

export type RoomStatus = "active" | "paused" | "archived";

export interface ProviderConversationRef {
  providerId: string;
  conversationId: string;
  actorId?: string | null;
  nativeRoom?: boolean;
}

export interface DispatchRecord {
  id: string;
  workItemId: string;
  roomId?: string | null;
  title: string;
  summary: string;
  fromActorId?: string | null;
  targetActorIds: string[];
  status: DispatchStatus;
  sourceMessageId?: string;
  responseMessageId?: string;
  providerRunId?: string;
  topicKey?: string;
  syncSource?: "event" | "history";
  createdAt: number;
  updatedAt: number;
}

export interface RoomMessage {
  id: string;
  role: "user" | "assistant";
  roomId?: string;
  text?: string;
  content?: unknown;
  timestamp: number;
  senderAgentId?: string;
  senderLabel?: string;
  senderRole?: string;
  visibility?: RoomVisibility;
  source?: RoomMessageSource;
  targetActorIds?: string[];
  audienceAgentIds?: string[];
  sourceSessionKey?: string;
  sourceRefs?: {
    providerMessageId?: string;
    providerRunId?: string;
    providerSessionKey?: string;
  };
}

export interface RoomRecord {
  id: string;
  companyId?: string;
  workItemId?: string;
  title: string;
  headline?: string;
  ownerActorId?: string | null;
  batonActorId?: string | null;
  memberActorIds: string[];
  status: RoomStatus;
  progress?: string;
  lastConclusionAt?: number | null;
  providerConversationRefs?: ProviderConversationRef[];
  transcript: RoomMessage[];
  createdAt: number;
  updatedAt: number;
}

export type RequirementRoomMessage = RoomMessage;

export interface RoomConversationBindingRecord extends ProviderConversationRef {
  roomId: string;
  updatedAt: number;
}

export interface RequirementRoomRecord extends RoomRecord {
  sessionKey: string;
  topicKey?: string;
  memberIds: string[];
  ownerAgentId?: string | null;
  lastSourceSyncAt?: number;
}

export type HandoffStatus = "pending" | "acknowledged" | "blocked" | "completed";

export interface HandoffRecord {
  id: string;
  sessionKey: string;
  taskId?: string;
  fromAgentId?: string;
  toAgentIds: string[];
  title: string;
  summary: string;
  status: HandoffStatus;
  checklist?: string[];
  missingItems?: string[];
  artifactUrls?: string[];
  artifactPaths?: string[];
  sourceMessageTs?: number;
  syncSource?: "event" | "history";
  createdAt: number;
  updatedAt: number;
}

export type RequestStatus =
  | "pending"
  | "acknowledged"
  | "answered"
  | "blocked"
  | "superseded";

export type RequestResolution = "pending" | "complete" | "partial" | "manual_takeover";

export interface RequestRecord {
  id: string;
  sessionKey: string;
  topicKey?: string;
  taskId?: string;
  handoffId?: string;
  fromAgentId?: string;
  toAgentIds: string[];
  title: string;
  summary: string;
  status: RequestStatus;
  resolution: RequestResolution;
  requiredItems?: string[];
  responseSummary?: string;
  sourceMessageTs?: number;
  responseMessageTs?: number;
  syncSource?: "event" | "history";
  createdAt: number;
  updatedAt: number;
}
