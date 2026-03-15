const DEFAULT_AGENT_ID = "main";
const VALID_ID_RE = /^[a-z0-9][a-z0-9_-]{0,63}$/i;
const INVALID_CHARS_RE = /[^a-z0-9_-]+/g;
const LEADING_DASH_RE = /^-+/;
const TRAILING_DASH_RE = /-+$/;
const AGENT_REFERENCE_KEYS = new Set([
  "agentId",
  "reportsTo",
  "leadAgentId",
  "mappedAgentId",
  "ownerAgentId",
  "sourceAgentId",
  "targetAgentId",
  "fromAgentId",
  "toAgentId",
  "managerAgentId",
  "requestedByActorId",
  "requesterActorId",
  "reporterActorId",
  "ownerActorId",
  "targetActorId",
  "fromActorId",
  "sourceActorId",
  "decisionOwnerActorId",
  "decidedByActorId",
  "batonActorId",
  "checkoutActorId",
  "memberActorId",
  "assigneeAgentId",
  "assigneeActorId",
  "participantActorId",
  "audienceAgentId",
  "senderAgentId",
  "nextAgentId",
]);
const AGENT_REFERENCE_ARRAY_KEYS = new Set([
  "pendingAgentIds",
  "targetActorIds",
  "missingAgentIds",
]);
const SESSION_KEY_KEYS = new Set(["sessionKey"]);
const SESSION_KEY_ARRAY_KEYS = new Set(["activeSessionKeys"]);

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function isAgentReferenceKey(key: string) {
  return (
    AGENT_REFERENCE_KEYS.has(key) ||
    key.endsWith("AgentId") ||
    key.endsWith("ActorId")
  );
}

function isAgentReferenceArrayKey(key: string) {
  return (
    AGENT_REFERENCE_ARRAY_KEYS.has(key) ||
    key.endsWith("AgentIds") ||
    key.endsWith("ActorIds")
  );
}

function isSessionKeyKey(key: string) {
  return SESSION_KEY_KEYS.has(key);
}

function isSessionKeyArrayKey(key: string) {
  return SESSION_KEY_ARRAY_KEYS.has(key);
}

function dedupeAgentId(base: string, taken: Set<string>) {
  if (!taken.has(base)) {
    taken.add(base);
    return base;
  }
  for (let index = 2; index < 10_000; index += 1) {
    const candidate = `${base}-${index}`;
    if (!taken.has(candidate)) {
      taken.add(candidate);
      return candidate;
    }
  }
  throw new Error(`无法为 agentId 生成唯一值：${base}`);
}

export function normalizeCompanyAgentId(value: string | undefined | null): string {
  const trimmed = (value ?? "").trim();
  if (!trimmed) {
    return DEFAULT_AGENT_ID;
  }
  if (VALID_ID_RE.test(trimmed)) {
    return trimmed.toLowerCase();
  }
  return (
    trimmed
      .toLowerCase()
      .replace(INVALID_CHARS_RE, "-")
      .replace(LEADING_DASH_RE, "")
      .replace(TRAILING_DASH_RE, "")
      .slice(0, 64) || DEFAULT_AGENT_ID
  );
}

export function buildCompanyAgentNamespace(companyName: string, companyId: string): string {
  const normalized = normalizeCompanyAgentId(`${companyName}-${companyId.slice(0, 6)}`);
  return normalized === DEFAULT_AGENT_ID ? `company-${companyId.slice(0, 6).toLowerCase()}` : normalized;
}

export function buildCanonicalAgentIdMigrationMap(agentIds: string[]): Map<string, string> {
  const taken = new Set<string>();
  const mapping = new Map<string, string>();
  for (const agentId of agentIds) {
    const base = normalizeCompanyAgentId(agentId);
    const normalizedBase = base === DEFAULT_AGENT_ID ? "agent" : base;
    mapping.set(agentId, dedupeAgentId(normalizedBase, taken));
  }
  return mapping;
}

function rewriteAgentReference(
  value: string,
  params: {
    exactMap?: ReadonlyMap<string, string>;
    canonicalIds?: ReadonlySet<string>;
  },
) {
  const direct = params.exactMap?.get(value);
  if (direct) {
    return direct;
  }
  const normalized = normalizeCompanyAgentId(value);
  const normalizedMapped = params.exactMap?.get(normalized);
  if (normalizedMapped) {
    return normalizedMapped;
  }
  if (params.canonicalIds?.has(normalized)) {
    return normalized;
  }
  return value;
}

function rewriteSessionKey(
  value: string,
  params: {
    exactMap?: ReadonlyMap<string, string>;
    canonicalIds?: ReadonlySet<string>;
  },
) {
  const match = /^agent:([^:]+):(.*)$/u.exec(value);
  if (!match) {
    return value;
  }
  const nextAgentId = rewriteAgentReference(match[1], params);
  return nextAgentId === match[1] ? value : `agent:${nextAgentId}:${match[2]}`;
}

export function rewriteKnownAgentReferences<T>(
  value: T,
  params: {
    exactMap?: ReadonlyMap<string, string>;
    canonicalIds?: ReadonlySet<string>;
  },
): T {
  const visit = (node: unknown, key?: string): unknown => {
    if (Array.isArray(node)) {
      if (key && isAgentReferenceArrayKey(key)) {
        return node.map((entry) =>
          typeof entry === "string" ? rewriteAgentReference(entry, params) : visit(entry),
        );
      }
      if (key && isSessionKeyArrayKey(key)) {
        return node.map((entry) =>
          typeof entry === "string" ? rewriteSessionKey(entry, params) : visit(entry),
        );
      }
      return node.map((entry) => visit(entry));
    }
    if (typeof node === "string") {
      if (key && isAgentReferenceKey(key)) {
        return rewriteAgentReference(node, params);
      }
      if (key && isSessionKeyKey(key)) {
        return rewriteSessionKey(node, params);
      }
      return node;
    }
    if (!isPlainObject(node)) {
      return node;
    }
    const nextEntries = Object.entries(node).map(([entryKey, entryValue]) => [
      entryKey,
      visit(entryValue, entryKey),
    ]);
    return Object.fromEntries(nextEntries);
  };

  return visit(value) as T;
}
