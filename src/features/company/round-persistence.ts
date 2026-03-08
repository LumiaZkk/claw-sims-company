import { parseAgentIdFromSessionKey } from "../../lib/sessions";
import type { RoundMessageSnapshot, RoundRecord } from "./types";

const ROUND_CACHE_PREFIX = "cyber_company_round_records:";
const ROUND_LIMIT = 80;

function isRoundRecord(value: unknown): value is RoundRecord {
  if (!value || typeof value !== "object") {
    return false;
  }

  const candidate = value as Partial<RoundRecord>;
  return (
    typeof candidate.id === "string" &&
    typeof candidate.companyId === "string" &&
    typeof candidate.title === "string" &&
    (typeof candidate.preview === "string" || candidate.preview == null) &&
    (typeof candidate.sourceActorId === "string" || candidate.sourceActorId == null) &&
    (typeof candidate.sourceActorLabel === "string" || candidate.sourceActorLabel == null) &&
    (typeof candidate.sourceSessionKey === "string" || candidate.sourceSessionKey == null) &&
    (typeof candidate.sourceConversationId === "string" || candidate.sourceConversationId == null) &&
    typeof candidate.archivedAt === "number" &&
    Array.isArray(candidate.messages) &&
    candidate.messages.every(isRoundMessageSnapshot) &&
    typeof candidate.restorable === "boolean"
  );
}

function isRoundMessageSnapshot(value: unknown): value is RoundMessageSnapshot {
  if (!value || typeof value !== "object") {
    return false;
  }

  const candidate = value as Partial<RoundMessageSnapshot>;
  return (
    (candidate.role === "user" ||
      candidate.role === "assistant" ||
      candidate.role === "system" ||
      candidate.role === "toolResult") &&
    typeof candidate.text === "string" &&
    typeof candidate.timestamp === "number"
  );
}

function getRoundCacheKey(companyId: string) {
  return `${ROUND_CACHE_PREFIX}${companyId.trim()}`;
}

export function sanitizeRoundRecords(rounds: RoundRecord[]): RoundRecord[] {
  const deduped = new Map<string, RoundRecord>();
  for (const round of rounds) {
    if (!isRoundRecord(round)) {
      continue;
    }
    // Compatibility-only migration: old rounds may still only know the provider
    // conversation/session key. UI no longer depends on this path, but we keep
    // it here so previously archived rounds remain attributable after upgrade.
    const sourceActorId =
      round.sourceActorId
      ?? parseAgentIdFromSessionKey(round.sourceConversationId ?? "")
      ?? parseAgentIdFromSessionKey(round.sourceSessionKey ?? "")
      ?? null;
    const normalizedRound: RoundRecord = {
      ...round,
      sourceActorId,
      sourceActorLabel: round.sourceActorLabel ?? sourceActorId ?? null,
      sourceConversationId: round.sourceConversationId ?? round.sourceSessionKey ?? null,
    };
    const previous = deduped.get(round.id);
    if (!previous || normalizedRound.archivedAt >= previous.archivedAt) {
      deduped.set(round.id, normalizedRound);
    }
  }
  return [...deduped.values()].sort((left, right) => right.archivedAt - left.archivedAt);
}

export function loadRoundRecords(companyId: string | null | undefined): RoundRecord[] {
  if (!companyId) {
    return [];
  }

  const raw = localStorage.getItem(getRoundCacheKey(companyId));
  if (!raw) {
    return [];
  }

  try {
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) {
      return [];
    }
    return sanitizeRoundRecords(parsed.filter(isRoundRecord));
  } catch {
    return [];
  }
}

export function persistRoundRecords(companyId: string | null | undefined, rounds: RoundRecord[]) {
  if (!companyId) {
    return;
  }

  const trimmed = sanitizeRoundRecords(rounds)
    .slice(0, ROUND_LIMIT);
  localStorage.setItem(getRoundCacheKey(companyId), JSON.stringify(trimmed));
}

export function clearRoundRecords(companyId: string | null | undefined) {
  if (!companyId) {
    return;
  }
  localStorage.removeItem(getRoundCacheKey(companyId));
}
