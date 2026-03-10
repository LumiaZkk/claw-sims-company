import {
  isInternalAssistantMonologueText,
  isSyntheticWorkflowPromptText,
  isTruthMirrorNoiseText,
  stripTruthInternalMonologue,
  stripTruthTaskTracker,
} from "../../../application/mission/message-truth";
import type { ChatMessage } from "../../../application/gateway";
import {
  dedupeVisibleChatMessages,
  extractTextFromMessage,
  normalizeMessage,
  sanitizeConversationText,
} from "./message-basics";
import { CHAT_UI_MESSAGE_LIMIT, type ChatBlock, type ChatDisplayItem } from "./message-types";
import { isToolActivityMessage, isToolResultMessage, summarizeToolMessage } from "./message-tooling";

export { CHAT_UI_MESSAGE_LIMIT } from "./message-types";
export type { ChatBlock, ChatDisplayItem } from "./message-types";
export {
  createChatMentionRegex,
  createComposerMentionBoundaryRegex,
  dedupeVisibleChatMessages,
  extractTextFromMessage,
  normalizeMessage,
  sanitizeConversationText,
  stripChatControlMetadata,
  truncateText,
} from "./message-basics";
export {
  describeToolName,
  isToolActivityMessage,
  isToolResultMessage,
  summarizeToolResultText,
} from "./message-tooling";

function isEphemeralConversationText(text: string): boolean {
  return /^\/new(?:\s|$)/i.test(text.trim());
}

export function extractNameFromMessage(text: string): string | null {
  const normalized = text.trim();
  if (!normalized) {
    return null;
  }

  const patterns = [
    /^(?:hi|hello|hey|你好|您好)[,，!！\s]+([A-Za-z0-9_\-\u4e00-\u9fa5]{1,32})\b/i,
    /^([A-Za-z0-9_\-\u4e00-\u9fa5]{1,32})[,，:：]\s*/,
    /^我是\s*([A-Za-z0-9_\-\u4e00-\u9fa5]{1,32})\b/i,
    /^my name is\s+([A-Za-z0-9_\-\u4e00-\u9fa5]{1,32})\b/i,
  ];

  for (const pattern of patterns) {
    const match = normalized.match(pattern);
    if (match?.[1]) {
      return match[1];
    }
  }
  return null;
}

export function isLikelyLegacyRelayUserMessage(message: ChatMessage, rawText: string | null): boolean {
  if (message.role !== "user" || !rawText) {
    return false;
  }
  if (message.roomSessionKey || message.roomAgentId) {
    return false;
  }
  const normalized = rawText.trim();
  if (!normalized) {
    return false;
  }
  if (normalized.includes("需求团队房间") || normalized.includes("请继续推进") || normalized.includes("请回复")) {
    return true;
  }
  return /^@[\p{L}\p{N}_-]+/u.test(normalized);
}

export function sanitizeVisibleMessageText(text: string): string {
  return stripTruthInternalMonologue(stripTruthTaskTracker(text)).trim();
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

function getChatBlocks(content: unknown): ChatBlock[] {
  if (!Array.isArray(content)) {
    return [];
  }
  return content
    .map((block) => (typeof block === "object" && block ? (block as ChatBlock) : null))
    .filter((block): block is ChatBlock => Boolean(block));
}

function sanitizeVisibleMessageContent(content: unknown): unknown {
  if (!Array.isArray(content)) {
    return content;
  }

  const sanitized = getChatBlocks(content)
    .map((block) => {
      const type = normalizeChatBlockType(block.type);
      if (type === "text") {
        const sanitizedText = sanitizeVisibleMessageText(block.text ?? "");
        return sanitizedText
          ? {
              ...block,
              type: "text",
              text: sanitizedText,
            }
          : null;
      }
      if (type === "image") {
        return { ...block, type: "image" };
      }
      return null;
    })
    .filter(Boolean) as ChatBlock[];

  return sanitized;
}

export function buildVisibleChatMessage(message: ChatMessage): ChatMessage {
  const normalizedText = sanitizeVisibleMessageText(extractTextFromMessage(message) ?? "");
  return {
    ...message,
    text: normalizedText || undefined,
    content: sanitizeVisibleMessageContent(message.content),
  };
}

export function getRenderableMessageContent(content: unknown): unknown {
  if (!Array.isArray(content)) {
    return typeof content === "string" ? content : undefined;
  }
  const blocks = getChatBlocks(content).filter((block) => {
    const type = normalizeChatBlockType(block.type);
    return type === "text" || type === "image";
  });
  return blocks.length > 0 ? blocks : undefined;
}

export function shouldKeepVisibleChatMessage(message: ChatMessage): boolean {
  const rawText = extractTextFromMessage(message);
  const text = rawText ? sanitizeConversationText(rawText) : "";
  const hasRenderableBlocks = Array.isArray(getRenderableMessageContent(message.content));
  if (hasRenderableBlocks && getChatBlocks(getRenderableMessageContent(message.content)).some((block) => normalizeChatBlockType(block.type) === "image")) {
    return true;
  }
  if (!text) {
    return false;
  }
  if (isEphemeralConversationText(text)) {
    return false;
  }
  if (isTruthMirrorNoiseText(text) || isSyntheticWorkflowPromptText(text) || isInternalAssistantMonologueText(text)) {
    return false;
  }
  if (isLikelyLegacyRelayUserMessage(message, rawText)) {
    return false;
  }
  return true;
}

export function limitChatMessages(messages: ChatMessage[]): ChatMessage[] {
  return messages.slice(-CHAT_UI_MESSAGE_LIMIT);
}

export function sanitizeVisibleChatFlow(messages: ChatMessage[]): ChatMessage[] {
  return limitChatMessages(
    dedupeVisibleChatMessages(messages.map(normalizeMessage))
      .filter((message) => shouldKeepVisibleChatMessage(message))
      .map((message) => buildVisibleChatMessage(message)),
  );
}

export function buildChatDisplayItems(
  messages: ChatMessage[],
  options?: { includeToolSummaries?: boolean; hideToolItems?: boolean },
): ChatDisplayItem[] {
  const includeToolSummaries = options?.hideToolItems ? false : (options?.includeToolSummaries ?? true);
  const sanitizedMessages = sanitizeVisibleChatFlow(messages);
  if (!includeToolSummaries) {
    return sanitizedMessages.map((message, index) => ({
      kind: "message",
      id: `${message.timestamp ?? index}:message`,
      message,
    }));
  }

  const displayItems: ChatDisplayItem[] = [];
  let pendingToolSummary: ChatDisplayItem | null = null;

  const flushToolSummary = () => {
    if (pendingToolSummary) {
      displayItems.push(pendingToolSummary);
      pendingToolSummary = null;
    }
  };

  for (const message of sanitizedMessages) {
    if (isToolActivityMessage(message) || isToolResultMessage(message)) {
      const summary = summarizeToolMessage(message);
      if (
        pendingToolSummary &&
        pendingToolSummary.kind === "tool" &&
        pendingToolSummary.title === summary.title &&
        pendingToolSummary.detail === summary.detail
      ) {
        const currentSummary: Extract<ChatDisplayItem, { kind: "tool" }> = pendingToolSummary;
        pendingToolSummary = {
          ...currentSummary,
          count: currentSummary.count + 1,
        };
      } else {
        flushToolSummary();
        pendingToolSummary = {
          kind: "tool",
          id: `${message.timestamp ?? Date.now()}:tool`,
          title: summary.title,
          detail: summary.detail,
          tone: isToolResultMessage(message) ? "sky" : "slate",
          count: 1,
        };
      }
      continue;
    }

    flushToolSummary();
    displayItems.push({
      kind: "message",
      id: `${message.timestamp ?? Date.now()}:message`,
      message,
    });
  }

  flushToolSummary();
  return displayItems;
}

export function isSubstantiveConversationText(text: string): boolean {
  const sanitized = sanitizeVisibleMessageText(text);
  if (!sanitized) {
    return false;
  }
  if (isEphemeralConversationText(sanitized)) {
    return false;
  }
  if (
    isTruthMirrorNoiseText(sanitized) ||
    isSyntheticWorkflowPromptText(sanitized) ||
    isInternalAssistantMonologueText(sanitized)
  ) {
    return false;
  }
  return true;
}

export function stripTaskTrackerSection(text: string): string {
  return stripTruthTaskTracker(text).trim();
}
