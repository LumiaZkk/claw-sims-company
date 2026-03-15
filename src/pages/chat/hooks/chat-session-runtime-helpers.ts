import type { Dispatch, SetStateAction } from "react";
import {
  buildVisibleChatMessage,
  CHAT_UI_MESSAGE_LIMIT,
  dedupeVisibleChatMessages,
  extractTextFromMessage,
  limitChatMessages,
  normalizeMessage,
  shouldKeepVisibleChatMessage,
} from "../view-models/messages";
import { buildTrackedTaskFromChatFinal } from "../../../application/mission/chat-task-tracker";
import type { ProviderRuntimeEvent } from "../../../application/gateway";
import type { ChatMessage } from "../../../application/gateway";
import type { Company } from "../../../domain/org/types";
import type { TrackedTask } from "../../../domain/mission/types";

export function mergeVisibleDirectMessages(previous: ChatMessage[], incoming: ChatMessage[]): ChatMessage[] {
  return limitChatMessages(
    dedupeVisibleChatMessages([...previous, ...incoming].map(normalizeMessage))
      .filter((message) => shouldKeepVisibleChatMessage(message))
      .map((message) => buildVisibleChatMessage(message)),
  );
}

function appendUniqueStreamSuffix(base: string, suffix: string): string {
  if (!suffix) {
    return base;
  }
  if (!base) {
    return suffix;
  }
  if (base.endsWith(suffix)) {
    return base;
  }
  const maxOverlap = Math.min(base.length, suffix.length);
  for (let overlap = maxOverlap; overlap > 0; overlap -= 1) {
    if (base.slice(-overlap) === suffix.slice(0, overlap)) {
      return base + suffix.slice(overlap);
    }
  }
  return base + suffix;
}

export function resolveMergedRuntimeAssistantText(params: {
  previousText: string;
  nextText: string;
  nextDelta: string;
}) {
  const { previousText, nextText, nextDelta } = params;
  if (nextText && previousText) {
    if (nextText.startsWith(previousText)) {
      return nextText;
    }
    if (previousText.startsWith(nextText) && !nextDelta) {
      return previousText;
    }
  }
  if (nextDelta) {
    return appendUniqueStreamSuffix(previousText, nextDelta);
  }
  if (nextText) {
    return nextText;
  }
  return previousText;
}

function readRuntimeAssistantString(record: Record<string, unknown> | null, key: string): string {
  if (!record) {
    return "";
  }
  const value = record[key];
  return typeof value === "string" ? value : "";
}

export function extractRuntimeAssistantStreamUpdate(
  runtimeEvent: ProviderRuntimeEvent,
): { text: string; delta: string } | null {
  if (runtimeEvent.streamKind !== "assistant" || !runtimeEvent.raw) {
    return null;
  }
  if (typeof runtimeEvent.raw !== "object" || Array.isArray(runtimeEvent.raw)) {
    return null;
  }

  const record = runtimeEvent.raw as Record<string, unknown>;
  const data =
    record.data && typeof record.data === "object" && !Array.isArray(record.data)
      ? (record.data as Record<string, unknown>)
      : null;
  const nested =
    record.payload && typeof record.payload === "object" && !Array.isArray(record.payload)
      ? (record.payload as Record<string, unknown>)
      : null;

  const text =
    readRuntimeAssistantString(data, "text")
    || readRuntimeAssistantString(nested, "text")
    || readRuntimeAssistantString(record, "text");
  const delta =
    readRuntimeAssistantString(data, "delta")
    || readRuntimeAssistantString(nested, "delta")
    || readRuntimeAssistantString(record, "delta");

  if (!text && !delta) {
    return null;
  }
  return { text, delta };
}

function messageContainsToolCall(message: ChatMessage | null | undefined) {
  if (!message || !Array.isArray(message.content)) {
    return false;
  }
  return message.content.some((block) => {
    if (!block || typeof block !== "object") {
      return false;
    }
    return (block as { type?: unknown }).type === "toolCall";
  });
}

export function resolveHistoryStreamSyncCandidate(
  messages: ChatMessage[],
  pendingSince: number,
): { message: ChatMessage; text: string } | null {
  const latestMessage = [...messages]
    .reverse()
    .find((message) => {
      const timestamp = typeof message.timestamp === "number" ? message.timestamp : 0;
      if (timestamp < pendingSince) {
        return false;
      }
      if (message.role !== "assistant" && message.role !== "system") {
        return false;
      }
      if (message.role === "assistant" && messageContainsToolCall(message)) {
        return false;
      }
      const text = extractTextFromMessage(message)?.trim() ?? "";
      return text.length > 0;
    }) ?? null;

  if (!latestMessage) {
    return null;
  }

  const latestMessageIndex = messages.lastIndexOf(latestMessage);
  if (latestMessageIndex !== messages.length - 1) {
    return null;
  }

  const text = extractTextFromMessage(latestMessage)?.trim() ?? "";
  if (!text) {
    return null;
  }

  return { message: latestMessage, text };
}

async function maybePersistTrackedTaskFromFinal(input: {
  finalText: string | null | undefined;
  sessionKey: string | null;
  agentId: string | null;
  activeCompany: Company | null;
  upsertTask: (task: TrackedTask) => Promise<void>;
}) {
  if (!input.finalText || !input.sessionKey) {
    return;
  }
  const trackedTask = buildTrackedTaskFromChatFinal({
    finalText: input.finalText,
    sessionKey: input.sessionKey,
    agentId: input.agentId || "",
    company: input.activeCompany,
  });
  if (trackedTask) {
    await input.upsertTask(trackedTask);
  }
}

export function adoptDirectHistoryAsFinal(input: {
  historyMessages: ChatMessage[];
  sessionKey: string;
  agentId: string | null;
  activeCompany: Company | null;
  finalMessage: ChatMessage;
  setMessages: Dispatch<SetStateAction<ChatMessage[]>>;
  setSessionSyncStale: (value: boolean, error?: string | null) => void;
  clearGeneratingState: (options?: { preserveRuntime?: boolean }) => void;
  upsertTask: (task: TrackedTask) => Promise<void>;
}) {
  input.setMessages((previous) => mergeVisibleDirectMessages(previous, input.historyMessages));
  input.setSessionSyncStale(false, null);
  input.clearGeneratingState();
  void maybePersistTrackedTaskFromFinal({
    finalText: extractTextFromMessage(input.finalMessage),
    sessionKey: input.sessionKey,
    agentId: input.agentId,
    activeCompany: input.activeCompany,
    upsertTask: input.upsertTask,
  }).catch(console.error);
}

export {
  buildVisibleChatMessage,
  CHAT_UI_MESSAGE_LIMIT,
  extractTextFromMessage,
  limitChatMessages,
  normalizeMessage,
  sanitizeVisibleChatFlow,
  shouldKeepVisibleChatMessage,
} from "../view-models/messages";
