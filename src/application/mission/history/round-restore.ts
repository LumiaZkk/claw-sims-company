import type { ChatMessage } from "../../gateway";
import type { RoundMessageSnapshot, RoundRecord } from "../../../domain/mission/types";
import {
  buildTruthComparableText,
  isInternalAssistantMonologueText,
  isSyntheticWorkflowPromptText,
  isTruthMirrorNoiseText,
  normalizeTruthText,
} from "../message-truth";

function stripChatControlMetadata(text: string): string {
  return text.replace(/<!--\s*chat-control:[\s\S]*?-->/gi, "").trim();
}

function extractTextFromMessage(message: ChatMessage): string {
  if (typeof message.text === "string" && message.text.trim().length > 0) {
    return message.text.trim();
  }
  if (typeof message.content === "string" && message.content.trim().length > 0) {
    return message.content.trim();
  }
  if (!Array.isArray(message.content)) {
    return "";
  }
  return message.content
    .map((block) => (typeof block === "object" && block && typeof (block as { text?: unknown }).text === "string"
      ? (block as { text: string }).text.trim()
      : ""))
    .filter((text) => text.length > 0)
    .join("\n")
    .trim();
}

function isToolMessage(message: ChatMessage): boolean {
  if (message.role === "toolResult") {
    return true;
  }
  if (!Array.isArray(message.content)) {
    return false;
  }
  return message.content.some((block) => {
    if (!block || typeof block !== "object") {
      return false;
    }
    const type = String((block as { type?: unknown }).type ?? "")
      .replace(/([a-z0-9])([A-Z])/g, "$1_$2")
      .toLowerCase();
    return type === "tool_call" || type === "tool_result" || type === "thinking";
  });
}

function isLikelyLegacyRelayUserMessage(message: ChatMessage, text: string): boolean {
  return (
    message.role === "user" &&
    /^(转发|relay|请转达|代发)/i.test(text.trim())
  );
}

export function resolveArchiveHistoryNotice(error: unknown): string | null {
  const message = error instanceof Error ? error.message : String(error);
  if (/unknown method:\s*sessions\.archives\.(list|get|delete|restore)/i.test(message)) {
    return "当前后端还不支持原生归档接口。系统会继续优先显示产品侧已保存的轮次历史。";
  }
  if (message.trim().length > 0) {
    return `归档轮次暂时不可用：${message}`;
  }
  return "归档轮次暂时不可用。";
}

export function compactRoundText(text: string, limit: number = 320): string {
  const normalized = normalizeTruthText(stripChatControlMetadata(text))
    .replace(/\*\*([^*]+)\*\*/g, "$1")
    .replace(/__([^_]+)__/g, "$1")
    .replace(/`([^`]+)`/g, "$1")
    .replace(/\s+/g, " ")
    .trim();
  if (/^a new session was started via \/new or \/reset/i.test(normalized)) {
    return "这是一条上一轮的会话切换提示，可在需要时恢复查看完整上下文。";
  }
  if (normalized.length <= limit) {
    return normalized;
  }
  const head = normalized.slice(0, Math.floor(limit * 0.7)).trimEnd();
  const tail = normalized.slice(-Math.floor(limit * 0.2)).trimStart();
  return `${head} … ${tail}`;
}

export function createRoundMessageSnapshots(
  messages: ChatMessage[],
  limit: number = 24,
): RoundMessageSnapshot[] {
  const snapshots = messages
    .filter((message) => !isToolMessage(message))
    .map((message) => {
      const text = extractTextFromMessage(message);
      if (!text) {
        return null;
      }
      const compacted = compactRoundText(text, 480);
      if (
        !compacted ||
        isTruthMirrorNoiseText(compacted) ||
        isSyntheticWorkflowPromptText(compacted) ||
        isInternalAssistantMonologueText(text) ||
        isLikelyLegacyRelayUserMessage(message, text)
      ) {
        return null;
      }
      return {
        role: message.role,
        text: compacted,
        timestamp: typeof message.timestamp === "number" ? message.timestamp : Date.now(),
      } satisfies RoundMessageSnapshot;
    })
    .filter((message): message is RoundMessageSnapshot => Boolean(message))
    .reduce<RoundMessageSnapshot[]>((result, snapshot) => {
      const last = result[result.length - 1];
      if (!last) {
        result.push(snapshot);
        return result;
      }

      const sameRole = last.role === snapshot.role;
      const sameTruth = buildTruthComparableText(last.text) === buildTruthComparableText(snapshot.text);
      const withinWindow = Math.abs(snapshot.timestamp - last.timestamp) <= 120_000;
      if (sameRole && sameTruth && withinWindow) {
        result[result.length - 1] = snapshot.text.length >= last.text.length ? snapshot : last;
        return result;
      }

      result.push(snapshot);
      return result;
    }, []);

  return snapshots.slice(-limit);
}

export function buildRoundPreview(messages: RoundMessageSnapshot[]): string | null {
  const latest = [...messages].reverse().find((message) => message.text.trim().length > 0);
  return latest ? compactRoundText(latest.text, 140) : null;
}

export function roundSnapshotToChatMessage(message: RoundMessageSnapshot): ChatMessage | null {
  if (message.role !== "user" && message.role !== "assistant") {
    return null;
  }
  const normalizedText = normalizeTruthText(message.text);
  if (
    !normalizedText ||
    isTruthMirrorNoiseText(normalizedText) ||
    isSyntheticWorkflowPromptText(normalizedText) ||
    (message.role === "assistant" && isInternalAssistantMonologueText(normalizedText))
  ) {
    return null;
  }
  return {
    role: message.role,
    text: normalizedText,
    content: normalizedText,
    timestamp: message.timestamp,
  };
}

export function buildProductRoundRestorePrompt(round: RoundRecord, actorLabel: string): string {
  const transcript = round.messages
    .slice(-8)
    .map((message) => {
      const normalizedText = normalizeTruthText(message.text);
      if (!normalizedText) {
        return null;
      }
      const speaker =
        message.role === "user"
          ? "用户"
          : message.role === "assistant"
            ? actorLabel
            : "系统";
      return `- ${speaker}: ${normalizedText}`;
    })
    .filter((entry): entry is string => Boolean(entry))
    .join("\n");

  return [
    "请恢复上一轮已归档会话的上下文，并从这里继续推进。",
    round.title ? `轮次标题：${round.title}` : null,
    round.preview ? `上一轮摘要：${round.preview}` : null,
    transcript ? `最近对话摘录：\n${transcript}` : null,
    "请先简短确认你已经接住这轮上下文，然后继续当前工作。",
  ]
    .filter(Boolean)
    .join("\n\n");
}

export function matchesProductRoundToActor(round: RoundRecord, actorId: string | null | undefined): boolean {
  return Boolean(actorId) && round.sourceActorId === actorId;
}

export function matchesProductRoundToRoom(input: {
  round: RoundRecord;
  roomId?: string | null;
  workItemId?: string | null;
}): boolean {
  const { round, roomId, workItemId } = input;
  if (roomId && round.roomId === roomId) {
    return true;
  }
  if (workItemId && round.workItemId === workItemId) {
    return true;
  }
  return false;
}
