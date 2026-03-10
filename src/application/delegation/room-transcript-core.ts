import type {
  Company,
  RequirementRoomMessage,
  RequirementRoomRecord,
} from "../../domain";
import type { ChatMessage } from "../gateway";
import {
  isInternalAssistantMonologueText,
  isSyntheticWorkflowPromptText,
  isTruthMirrorNoiseText,
  normalizeTruthText,
} from "../mission/message-truth";
import { dedupeAgentIds } from "../assignment/room-members";

const ROOM_MESSAGE_LIMIT = 120;

function hashText(value: string): string {
  let hash = 0;
  for (const char of value) {
    hash = (hash * 33 + char.charCodeAt(0)) >>> 0;
  }
  return hash.toString(36);
}

export function normalizeChatBlockType(type?: string): string {
  if (!type) {
    return "";
  }
  if (type === "toolCall") {
    return "tool_call";
  }
  if (type === "toolResult") {
    return "tool_result";
  }
  return type
    .replace(/([a-z0-9])([A-Z])/g, "$1_$2")
    .toLowerCase();
}

export function normalizeSnapshotChatRole(role: string): ChatMessage["role"] {
  switch (role) {
    case "assistant":
    case "system":
    case "toolResult":
      return role;
    default:
      return "user";
  }
}

function getChatBlocks(content: unknown): Array<Record<string, unknown>> {
  if (!Array.isArray(content)) {
    return [];
  }
  return content
    .map((block) => (typeof block === "object" && block ? (block as Record<string, unknown>) : null))
    .filter((block): block is Record<string, unknown> => Boolean(block));
}

export function extractRequirementRoomText(message: ChatMessage | null | undefined): string {
  if (!message) {
    return "";
  }

  if (typeof message.text === "string" && message.text.trim().length > 0) {
    return message.text.trim();
  }

  if (typeof message.content === "string" && message.content.trim().length > 0) {
    return message.content.trim();
  }

  return getChatBlocks(message.content)
    .filter((block) => normalizeChatBlockType(String(block.type ?? "")) === "text")
    .map((block) => (typeof block.text === "string" ? block.text.trim() : ""))
    .filter((text) => text.length > 0)
    .join("\n")
    .trim();
}

function getRenderableMessageContent(message: ChatMessage): unknown {
  if (!Array.isArray(message.content)) {
    return typeof message.content === "string" ? message.content : undefined;
  }

  const renderable = getChatBlocks(message.content).filter((block) => {
    const type = normalizeChatBlockType(String(block.type ?? ""));
    return type === "text" || type === "image";
  });
  return renderable.length > 0 ? renderable : undefined;
}

function hasRenderableImage(message: ChatMessage): boolean {
  return getChatBlocks(message.content).some(
    (block) => normalizeChatBlockType(String(block.type ?? "")) === "image",
  );
}

function isToolOnlyAssistantMessage(message: ChatMessage): boolean {
  if (message.role !== "assistant") {
    return false;
  }
  if (extractRequirementRoomText(message)) {
    return false;
  }
  return getChatBlocks(message.content).some((block) => {
    const type = normalizeChatBlockType(String(block.type ?? ""));
    return type === "tool_call" || type === "tool_result" || type === "thinking";
  });
}

function normalizeRequirementRoomText(text: string): string {
  return text
    .replace(/^Sender \(untrusted metadata\):[\s\S]*?```[\s\S]*?```\s*/i, "")
    .replace(/\s+/g, " ")
    .trim();
}

export function isVisibleRequirementRoomMessage(
  message: RequirementRoomMessage | null | undefined,
): message is RequirementRoomMessage {
  if (!message) {
    return false;
  }
  if ((message.visibility ?? "public") !== "public") {
    return false;
  }
  if (message.source === "system") {
    return false;
  }

  const normalizedText = normalizeTruthText(message.text ?? "");
  const hasImage =
    Array.isArray(message.content) &&
    getChatBlocks(message.content).some(
      (block) => normalizeChatBlockType(String(block.type ?? "")) === "image",
    );

  if (!normalizedText) {
    return hasImage;
  }

  if (
    isTruthMirrorNoiseText(normalizedText) ||
    isSyntheticWorkflowPromptText(normalizedText) ||
    isInternalAssistantMonologueText(message.text ?? "")
  ) {
    return false;
  }

  return true;
}

export function annotateRequirementRoomMessage(input: {
  message: ChatMessage;
  sessionKey: string;
  agentId: string;
  roomId?: string;
  ownerAgentId?: string | null;
}): ChatMessage | null {
  const normalized: ChatMessage = {
    ...input.message,
    timestamp: typeof input.message.timestamp === "number" ? input.message.timestamp : Date.now(),
  };

  if (normalized.role === "system" || normalized.role === "toolResult" || isToolOnlyAssistantMessage(normalized)) {
    return null;
  }

  const normalizedText = normalizeRequirementRoomText(extractRequirementRoomText(normalized));
  if (!normalizedText && !hasRenderableImage(normalized)) {
    return null;
  }
  if (normalizedText === "ANNOUNCE_SKIP" || normalizedText === "NO_REPLY") {
    return null;
  }

  const roomMessage: ChatMessage = {
    ...normalized,
    roomSessionKey: input.roomId ?? input.sessionKey,
  };

  if (normalized.role === "assistant") {
    const provenance =
      typeof normalized.provenance === "object" && normalized.provenance
        ? (normalized.provenance as Record<string, unknown>)
        : {};
    roomMessage.roomAgentId = input.agentId;
    roomMessage.provenance = {
      ...provenance,
      sourceSessionKey:
        typeof provenance.sourceSessionKey === "string" ? provenance.sourceSessionKey : input.sessionKey,
    };
  }

  if (normalized.role === "user") {
    if (input.ownerAgentId && input.agentId !== input.ownerAgentId) {
      if (
        !normalizedText ||
        isSyntheticWorkflowPromptText(normalizedText) ||
        isTruthMirrorNoiseText(normalizedText) ||
        isInternalAssistantMonologueText(normalizedText)
      ) {
        return null;
      }
    }
    roomMessage.roomAudienceAgentIds = [input.agentId];
  }

  return roomMessage;
}

function buildRoomMessageId(input: {
  role: RequirementRoomMessage["role"];
  sessionKey: string;
  agentId?: string | null;
  timestamp: number;
  text: string;
  audienceAgentIds?: string[];
}): string {
  return [
    input.role,
    input.sessionKey,
    input.agentId ?? "room",
    input.timestamp,
    hashText(`${input.text}|${(input.audienceAgentIds ?? []).join(",")}`),
  ].join(":");
}

function toRequirementRoomMessage(input: {
  message: ChatMessage;
  sessionKey: string;
  agentId: string;
  roomId?: string;
  company?: Company | null;
  ownerAgentId?: string | null;
}): RequirementRoomMessage | null {
  const annotated = annotateRequirementRoomMessage(input);
  if (!annotated) {
    return null;
  }

  const text = extractRequirementRoomText(annotated);
  const timestamp = typeof annotated.timestamp === "number" ? annotated.timestamp : Date.now();
  const senderEmployee = input.company?.employees.find((employee) => employee.agentId === input.agentId) ?? null;
  const audienceAgentIds =
    annotated.role === "user" && Array.isArray(annotated.roomAudienceAgentIds)
      ? dedupeAgentIds(annotated.roomAudienceAgentIds.map((agentId) => String(agentId)))
      : undefined;

  return {
    id: buildRoomMessageId({
      role: annotated.role === "assistant" ? "assistant" : "user",
      sessionKey: input.sessionKey,
      agentId: annotated.role === "assistant" || input.agentId !== input.ownerAgentId ? input.agentId : null,
      timestamp,
      text,
      audienceAgentIds,
    }),
    roomId: input.roomId,
    role: annotated.role === "assistant" ? "assistant" : "user",
    text,
    content: getRenderableMessageContent(annotated),
    timestamp,
    senderAgentId:
      annotated.role === "assistant" || input.agentId !== input.ownerAgentId
        ? input.agentId
        : undefined,
    senderLabel:
      annotated.role === "assistant" || input.agentId !== input.ownerAgentId
        ? senderEmployee?.nickname ?? input.agentId
        : undefined,
    audienceAgentIds,
    visibility: "public",
    source:
      annotated.role === "assistant"
        ? "member_reply"
        : input.ownerAgentId && input.agentId === input.ownerAgentId
          ? "owner_dispatch"
          : "member_message",
    sourceSessionKey: input.sessionKey,
  };
}

function mergeRoomAudience(messages: RequirementRoomMessage[]): string[] {
  return dedupeAgentIds(messages.flatMap((message) => message.audienceAgentIds ?? []));
}

function isLikelyOwnerDispatchRelay(message: RequirementRoomMessage): boolean {
  if (message.role !== "user") {
    return false;
  }
  if (message.source === "owner_dispatch") {
    return true;
  }
  const normalizedText = normalizeTruthText(message.text ?? "");
  return normalizedText.startsWith("@");
}

function normalizeRequirementRoomTranscriptEntry(
  message: RequirementRoomMessage,
): RequirementRoomMessage {
  if (!isLikelyOwnerDispatchRelay(message)) {
    return message;
  }
  return {
    ...message,
    source: "owner_dispatch",
    senderAgentId: undefined,
    senderLabel: undefined,
    senderRole: undefined,
  };
}

function shouldMergeRequirementRoomTranscriptEntry(
  left: RequirementRoomMessage,
  right: RequirementRoomMessage,
): boolean {
  if (left.id === right.id) {
    return true;
  }
  if (!(isLikelyOwnerDispatchRelay(left) && isLikelyOwnerDispatchRelay(right))) {
    return false;
  }
  if (normalizeTruthText(left.text ?? "") !== normalizeTruthText(right.text ?? "")) {
    return false;
  }
  return Math.abs(left.timestamp - right.timestamp) <= 120_000;
}

function mergeRequirementRoomTranscriptEntry(
  left: RequirementRoomMessage,
  right: RequirementRoomMessage,
): RequirementRoomMessage {
  const merged = {
    ...left,
    ...right,
    id: left.id,
    timestamp: Math.min(left.timestamp, right.timestamp),
    content: right.content ?? left.content,
    text: right.text || left.text,
    audienceAgentIds: mergeRoomAudience([left, right]),
  };

  return normalizeRequirementRoomTranscriptEntry(merged);
}

export function mergeRequirementRoomTranscript(
  transcript: RequirementRoomMessage[],
): RequirementRoomMessage[] {
  const deduped: RequirementRoomMessage[] = [];

  for (const message of transcript
    .filter((candidate) => isVisibleRequirementRoomMessage(candidate))
    .sort((left, right) => left.timestamp - right.timestamp)) {
    const normalized = normalizeRequirementRoomTranscriptEntry(message);
    const previous = deduped[deduped.length - 1];
    if (previous && shouldMergeRequirementRoomTranscriptEntry(previous, normalized)) {
      deduped[deduped.length - 1] = mergeRequirementRoomTranscriptEntry(previous, normalized);
      continue;
    }
    deduped.push(normalized);
  }

  return deduped.slice(-ROOM_MESSAGE_LIMIT);
}

export function createOutgoingRequirementRoomMessage(input: {
  sessionKey: string;
  roomId?: string;
  authorAgentId?: string;
  text: string;
  content?: ChatMessage["content"];
  audienceAgentIds?: string[];
  timestamp?: number;
}): RequirementRoomMessage {
  const timestamp = input.timestamp ?? Date.now();
  const normalizedAudience = dedupeAgentIds(
    input.audienceAgentIds ?? (input.authorAgentId ? [input.authorAgentId] : []),
  );
  return {
    id: buildRoomMessageId({
      role: "user",
      sessionKey: input.sessionKey,
      agentId: input.authorAgentId ?? null,
      timestamp,
      text: input.text,
      audienceAgentIds: normalizedAudience,
    }),
    roomId: input.roomId,
    role: "user",
    text: input.text,
    content: input.content,
    timestamp,
    audienceAgentIds: normalizedAudience,
    visibility: "public",
    source: "owner_dispatch",
    sourceSessionKey: input.sessionKey,
  };
}

export function createIncomingRequirementRoomMessage(input: {
  company?: Company | null;
  message: ChatMessage;
  sessionKey: string;
  agentId: string;
  roomId?: string;
  ownerAgentId?: string | null;
}): RequirementRoomMessage | null {
  return toRequirementRoomMessage(input);
}

export function convertRequirementRoomRecordToChatMessages(
  room: RequirementRoomRecord | null | undefined,
): ChatMessage[] {
  if (!room) {
    return [];
  }

  return room.transcript
    .filter((message) => isVisibleRequirementRoomMessage(message))
    .map((message) => ({
      role: message.role === "assistant" ? "assistant" : "user",
      text: message.text,
      content: message.content,
      timestamp: message.timestamp,
      roomMessageId: message.id,
      roomMessageSource: message.source,
      roomAgentId: message.senderAgentId ?? undefined,
      roomSenderLabel: message.senderLabel ?? undefined,
      roomAudienceAgentIds: message.audienceAgentIds,
      roomSessionKey: room.id,
      senderAgentId: message.senderAgentId ?? undefined,
    }) satisfies ChatMessage);
}

function mergeAudienceIds(messages: ChatMessage[]): string[] {
  return dedupeAgentIds(
    messages.flatMap((message) =>
      Array.isArray(message.roomAudienceAgentIds)
        ? message.roomAudienceAgentIds.map((agentId) => String(agentId))
        : [],
    ),
  );
}

export function dedupeRequirementRoomMessages(messages: ChatMessage[]): ChatMessage[] {
  const deduped: ChatMessage[] = [];

  for (const message of messages) {
    const previous = deduped[deduped.length - 1];
    if (
      previous &&
      previous.role === message.role &&
      previous.roomAgentId === message.roomAgentId &&
      extractRequirementRoomText(previous) === extractRequirementRoomText(message)
    ) {
      deduped[deduped.length - 1] = {
        ...message,
        roomAudienceAgentIds: mergeAudienceIds([previous, message]),
      };
      continue;
    }
    deduped.push(message);
  }

  return deduped.slice(-ROOM_MESSAGE_LIMIT);
}

export function mergeRequirementRoomMessages(input:
  | {
      existing: ChatMessage[];
      incoming: ChatMessage[];
    }
  | {
      sessions: Array<{ sessionKey: string; agentId: string; messages: ChatMessage[] }>;
    }): ChatMessage[] {
  if ("sessions" in input) {
    return dedupeRequirementRoomMessages(
      input.sessions
        .flatMap((session) =>
          session.messages
            .map((message) =>
              annotateRequirementRoomMessage({
                message,
                sessionKey: session.sessionKey,
                agentId: session.agentId,
                roomId: session.sessionKey,
              }),
            )
            .filter((message): message is ChatMessage => Boolean(message)),
        )
        .sort(
          (left, right) =>
            (typeof left.timestamp === "number" ? left.timestamp : 0) -
            (typeof right.timestamp === "number" ? right.timestamp : 0),
        ),
    );
  }

  return dedupeRequirementRoomMessages(
    [...input.existing, ...input.incoming].sort(
      (left, right) =>
        (typeof left.timestamp === "number" ? left.timestamp : 0) -
        (typeof right.timestamp === "number" ? right.timestamp : 0),
    ),
  );
}
