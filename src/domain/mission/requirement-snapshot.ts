export type RequirementArtifactCheck = {
  path: string;
  exists: boolean;
};

export type RequirementMessageInput = {
  role?: unknown;
  text?: unknown;
  content?: unknown;
  timestamp?: unknown;
};

export type RequirementMessageSnapshot = {
  role: string;
  text: string;
  timestamp: number;
};

export type RequirementSessionSnapshot = {
  agentId: string;
  sessionKey: string;
  updatedAt: number;
  messages: RequirementMessageSnapshot[];
  artifactChecks?: RequirementArtifactCheck[];
};

export const REQUIREMENT_SNAPSHOT_MESSAGE_LIMIT = 40;

const MAX_REQUIREMENT_MESSAGE_TEXT = 2_000;
const REQUIREMENT_MESSAGE_HEAD = 1_200;
const REQUIREMENT_MESSAGE_TAIL = 700;

export function extractRequirementMessageText(message: RequirementMessageInput): string {
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
    .map((block) => {
      if (typeof block === "string") {
        return block;
      }
      if (block && typeof block === "object") {
        const record = block as Record<string, unknown>;
        if (record.type === "text" && typeof record.text === "string") {
          return record.text;
        }
      }
      return "";
    })
    .join("\n")
    .trim();
}

export function compactRequirementMessageText(text: string): string {
  const trimmed = text.trim().replace(/\n{3,}/g, "\n\n");
  if (trimmed.length <= MAX_REQUIREMENT_MESSAGE_TEXT) {
    return trimmed;
  }

  const head = trimmed.slice(0, REQUIREMENT_MESSAGE_HEAD).trimEnd();
  const tail = trimmed.slice(-REQUIREMENT_MESSAGE_TAIL).trimStart();
  return `${head}\n\n[...已折叠过长内容...]\n\n${tail}`;
}

export function normalizeRequirementMessageTimestamp(value: unknown, fallback: number): number {
  return typeof value === "number" && Number.isFinite(value) ? value : fallback;
}

export function createRequirementMessageSnapshots(
  messages: RequirementMessageInput[],
  options?: {
    limit?: number;
    normalizeText?: (text: string) => string;
  },
): RequirementMessageSnapshot[] {
  const limit = Math.max(1, options?.limit ?? REQUIREMENT_SNAPSHOT_MESSAGE_LIMIT);
  return messages
    .map((message, index) => {
      const rawText = extractRequirementMessageText(message);
      const normalizedText = options?.normalizeText ? options.normalizeText(rawText) : rawText;
      return {
        role: typeof message.role === "string" ? message.role : "unknown",
        text: compactRequirementMessageText(normalizedText),
        timestamp: normalizeRequirementMessageTimestamp(message.timestamp, index + 1),
      };
    })
    .filter((message) => message.text.length > 0)
    .sort((left, right) => left.timestamp - right.timestamp)
    .slice(-limit);
}

export function countRequirementChecklistConfirmations(text: string): number {
  return [...text.matchAll(/是否[^:\n]{0,48}[:：]\s*(?:\*\*)?(?:是|否)/gi)].length;
}

export function extractRequirementArtifactPath(text: string): string | null {
  return text.match(/\/Users\/[^\s`"]+?\.md\b/)?.[0] ?? null;
}

export function findRequirementArtifactCheck(
  snapshot: RequirementSessionSnapshot,
  path: string | null,
): RequirementArtifactCheck | null {
  if (!path) {
    return null;
  }
  return snapshot.artifactChecks?.find((check) => check.path === path) ?? null;
}
