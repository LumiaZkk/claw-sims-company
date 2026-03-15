import os from "node:os";
import path from "node:path";
import type { Company } from "../../../../src/domain/org/types";
import type { AuthorityCompanyRuntimeSnapshot, AuthorityHireEmployeeInput } from "../../../../src/infrastructure/authority/contract";
import type { DecisionTicketRecord } from "../../../../src/domain/delegation/types";
import type { ApprovalRecord } from "../../../../src/domain/governance/types";
import { buildDefaultOrgSettings } from "../../../../src/domain/org/autonomy-policy";
import {
  buildCanonicalAgentIdMigrationMap,
  rewriteKnownAgentReferences,
} from "../../../../src/domain/org/agent-id";
import { buildDefaultTalentMarketTemplates } from "../../../../src/domain/org/talent-market";
import { normalizeEscalationRecord } from "../../../../src/domain/delegation/escalation";
import { isSupportRequestActive, normalizeSupportRequestRecord } from "../../../../src/domain/delegation/support-request";
import { sortApprovals } from "../../../../src/domain/governance/approval";
import { resolveSessionStatusCapabilityState, type SessionStatusCapabilityState } from "../agent/runtime-authority";
import { normalizeWorkItemDepartmentOwnership } from "../../../../src/application/org/department-autonomy";
import type { AgentRunRecord } from "../../../../src/application/agent-runtime";

export type StoredChatMessage = {
  role: "user" | "assistant" | "system" | "toolResult";
  content?: unknown;
  text?: string;
  timestamp?: number;
  [key: string]: unknown;
};

export const AUTHORITY_PORT = Number.parseInt(process.env.CYBER_COMPANY_AUTHORITY_PORT ?? "19789", 10);
export const DATA_DIR = path.join(os.homedir(), ".cyber-company", "authority");
export const DB_PATH = path.join(DATA_DIR, "authority.sqlite");
export const DEFAULT_OPENCLAW_URL = "ws://localhost:18789";
export const EXECUTOR_PROVIDER_ID = "openclaw";

export type StoredExecutorConfig = {
  type: "openclaw";
  openclaw: {
    url: string;
    token?: string;
  };
  connectionState?: "idle" | "connecting" | "ready" | "degraded" | "blocked";
  lastError?: string | null;
  lastConnectedAt?: number | null;
};

export let sessionStatusCapabilityState: SessionStatusCapabilityState = "unknown";
let sessionStatusUnsupportedLogged = false;
let syncAuthorityAgentFileMirror:
  | ((file: { agentId: string; name: string; content: string }) => void)
  | null = null;

export function setSyncAuthorityAgentFileMirror(
  handler: ((file: { agentId: string; name: string; content: string }) => void) | null,
) {
  syncAuthorityAgentFileMirror = handler;
}

export function getSyncAuthorityAgentFileMirror() {
  return syncAuthorityAgentFileMirror;
}

export function resetSessionStatusCapabilityState() {
  sessionStatusCapabilityState = "unknown";
  sessionStatusUnsupportedLogged = false;
}

export function createDefaultStoredExecutorConfig(): StoredExecutorConfig {
  return {
    type: "openclaw",
    openclaw: {
      url: DEFAULT_OPENCLAW_URL,
      token: "",
    },
    connectionState: "idle",
    lastError: null,
    lastConnectedAt: null,
  };
}

export function sanitizeStoredExecutorConfig(value: unknown): StoredExecutorConfig {
  if (!value || typeof value !== "object") {
    return createDefaultStoredExecutorConfig();
  }
  const candidate = value as Partial<StoredExecutorConfig>;
  return {
    type: "openclaw",
    openclaw: {
      url:
        typeof candidate.openclaw?.url === "string" && candidate.openclaw.url.trim().length > 0
          ? candidate.openclaw.url.trim()
          : DEFAULT_OPENCLAW_URL,
      token: typeof candidate.openclaw?.token === "string" ? candidate.openclaw.token : "",
    },
    connectionState:
      candidate.connectionState === "idle" ||
      candidate.connectionState === "connecting" ||
      candidate.connectionState === "ready" ||
      candidate.connectionState === "degraded" ||
      candidate.connectionState === "blocked"
        ? candidate.connectionState
        : "idle",
    lastError:
      typeof candidate.lastError === "string" || candidate.lastError === null
        ? candidate.lastError ?? null
        : null,
    lastConnectedAt:
      typeof candidate.lastConnectedAt === "number" ? candidate.lastConnectedAt : null,
  };
}

export function isPresent<T>(value: T | null | undefined | false): value is T {
  return Boolean(value);
}

export function shallowJsonEqual(left: unknown, right: unknown): boolean {
  return JSON.stringify(left) === JSON.stringify(right);
}

export function updateSessionStatusCapability(outcome: "success" | "error", error?: unknown) {
  const previous = sessionStatusCapabilityState;
  sessionStatusCapabilityState = resolveSessionStatusCapabilityState({
    current: previous,
    outcome,
    error,
  });
  if (
    sessionStatusCapabilityState === "unsupported" &&
    previous !== "unsupported" &&
    !sessionStatusUnsupportedLogged
  ) {
    sessionStatusUnsupportedLogged = true;
    console.warn(
      "OpenClaw executor does not support session_status; Authority runtime repair will stay lifecycle/chat-driven.",
    );
  }
}

export function normalizeDecisionTicketRevision(value: number | null | undefined): number {
  return Number.isFinite(value) && Number(value) > 0 ? Math.floor(Number(value)) : 1;
}

export function normalizeApprovalRevision(value: number | null | undefined): number {
  return Number.isFinite(value) && Number(value) > 0 ? Math.floor(Number(value)) : 1;
}

export function normalizeDecisionTicketRecord(
  companyId: string,
  ticket: DecisionTicketRecord,
): DecisionTicketRecord {
  return {
    ...ticket,
    companyId,
    revision: normalizeDecisionTicketRevision(ticket.revision),
    createdAt: ticket.createdAt || Date.now(),
    updatedAt: ticket.updatedAt || Date.now(),
  };
}

export function decisionTicketMaterialChanged(
  existing: DecisionTicketRecord,
  next: DecisionTicketRecord,
): boolean {
  return (
    existing.sourceType !== next.sourceType ||
    existing.sourceId !== next.sourceId ||
    (existing.escalationId ?? null) !== (next.escalationId ?? null) ||
    (existing.aggregateId ?? null) !== (next.aggregateId ?? null) ||
    (existing.workItemId ?? null) !== (next.workItemId ?? null) ||
    (existing.sourceConversationId ?? null) !== (next.sourceConversationId ?? null) ||
    existing.decisionOwnerActorId !== next.decisionOwnerActorId ||
    existing.decisionType !== next.decisionType ||
    existing.summary !== next.summary ||
    !shallowJsonEqual(existing.options, next.options) ||
    existing.requiresHuman !== next.requiresHuman ||
    existing.status !== next.status ||
    (existing.resolution ?? null) !== (next.resolution ?? null) ||
    (existing.resolutionOptionId ?? null) !== (next.resolutionOptionId ?? null) ||
    (existing.roomId ?? null) !== (next.roomId ?? null)
  );
}

export function approvalMaterialChanged(existing: ApprovalRecord, next: ApprovalRecord): boolean {
  return (
    existing.scope !== next.scope ||
    existing.actionType !== next.actionType ||
    existing.status !== next.status ||
    existing.summary !== next.summary ||
    (existing.detail ?? null) !== (next.detail ?? null) ||
    (existing.requestedByActorId ?? null) !== (next.requestedByActorId ?? null) ||
    (existing.requestedByLabel ?? null) !== (next.requestedByLabel ?? null) ||
    (existing.targetActorId ?? null) !== (next.targetActorId ?? null) ||
    (existing.targetLabel ?? null) !== (next.targetLabel ?? null) ||
    !shallowJsonEqual(existing.payload ?? {}, next.payload ?? {}) ||
    (existing.resolution ?? null) !== (next.resolution ?? null) ||
    (existing.decidedByActorId ?? null) !== (next.decidedByActorId ?? null) ||
    (existing.decidedByLabel ?? null) !== (next.decidedByLabel ?? null) ||
    (existing.resolvedAt ?? null) !== (next.resolvedAt ?? null)
  );
}

export function slugify(input: string) {
  return input
    .toLowerCase()
    .replace(/[^a-z0-9\u4e00-\u9fa5]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 24);
}

export function parseJson<T>(value: string | null | undefined, fallback: T): T {
  if (!value) {
    return fallback;
  }
  try {
    return JSON.parse(value) as T;
  } catch {
    return fallback;
  }
}

export function normalizeCompany(company: Company): Company {
  const agentIdMapping = buildCanonicalAgentIdMigrationMap(
    company.employees.map((employee) => employee.agentId),
  );
  const canonicalAgentIds = new Set(agentIdMapping.values());
  const migratedCompany = rewriteKnownAgentReferences(company, {
    exactMap: agentIdMapping,
    canonicalIds: canonicalAgentIds,
  });
  const talentMarket = migratedCompany.talentMarket ?? {
    templates: buildDefaultTalentMarketTemplates(Date.now()),
    updatedAt: Date.now(),
  };
  return {
    ...migratedCompany,
    talentMarket,
    orgSettings: buildDefaultOrgSettings(migratedCompany.orgSettings),
    approvals: sortApprovals(migratedCompany.approvals ?? []),
    supportRequests: (migratedCompany.supportRequests ?? [])
      .map(normalizeSupportRequestRecord)
      .filter(isSupportRequestActive),
    escalations: (migratedCompany.escalations ?? [])
      .map(normalizeEscalationRecord)
      .filter((item) => item.status === "open" || item.status === "acknowledged"),
    decisionTickets: (migratedCompany.decisionTickets ?? []).filter(
      (item) => item.status === "open" || item.status === "pending_human",
    ),
  };
}

export function normalizeRuntimeSnapshot(
  company: Company | null | undefined,
  snapshot: AuthorityCompanyRuntimeSnapshot,
): AuthorityCompanyRuntimeSnapshot {
  const normalizeRevision = (value: number | null | undefined) =>
    Number.isFinite(value) && Number(value) > 0 ? Math.floor(Number(value)) : 1;
  const canonicalAgentIds = new Set(company?.employees.map((employee) => employee.agentId) ?? []);
  const migratedSnapshot = canonicalAgentIds.size > 0
    ? rewriteKnownAgentReferences(snapshot, {
      canonicalIds: canonicalAgentIds,
    })
    : snapshot;
  return {
    ...migratedSnapshot,
    activeWorkItems: migratedSnapshot.activeWorkItems.map((workItem) =>
      normalizeWorkItemDepartmentOwnership({
        company,
        workItem,
      }),
    ),
    activeRoomRecords: (migratedSnapshot.activeRoomRecords ?? []).map((room) => ({
      ...room,
      revision: normalizeRevision(room.revision),
    })),
    activeArtifacts: (migratedSnapshot.activeArtifacts ?? []).map((artifact) => ({
      ...artifact,
      revision: normalizeRevision(artifact.revision),
    })),
    activeDispatches: (migratedSnapshot.activeDispatches ?? []).map((dispatch) => ({
      ...dispatch,
      revision: normalizeRevision(dispatch.revision),
    })),
    activeSupportRequests: (migratedSnapshot.activeSupportRequests ?? []).map(normalizeSupportRequestRecord),
    activeEscalations: (migratedSnapshot.activeEscalations ?? []).map(normalizeEscalationRecord),
    activeDecisionTickets: (migratedSnapshot.activeDecisionTickets ?? []).map((ticket) => ({
      ...ticket,
      revision: normalizeRevision(ticket.revision),
    })),
    activeAgentSessions: [...(migratedSnapshot.activeAgentSessions ?? [])].sort(
      (left, right) => (right.lastSeenAt ?? 0) - (left.lastSeenAt ?? 0),
    ),
    activeAgentRuns: [...(migratedSnapshot.activeAgentRuns ?? [])].sort(
      (left, right) => right.lastEventAt - left.lastEventAt,
    ),
    activeAgentRuntime: [...(migratedSnapshot.activeAgentRuntime ?? [])].sort((left, right) =>
      left.agentId.localeCompare(right.agentId),
    ),
    activeAgentStatuses: [...(migratedSnapshot.activeAgentStatuses ?? [])].sort((left, right) =>
      left.agentId.localeCompare(right.agentId),
    ),
    activeAgentStatusHealth: migratedSnapshot.activeAgentStatusHealth
      ? {
          ...migratedSnapshot.activeAgentStatusHealth,
          missingAgentIds: [...migratedSnapshot.activeAgentStatusHealth.missingAgentIds].sort((left, right) =>
            left.localeCompare(right),
          ),
        }
      : null,
  };
}

export function normalizeExecutorRunState(value: unknown): AgentRunRecord["state"] | null {
  switch (value) {
    case "accepted":
    case "running":
    case "streaming":
    case "completed":
    case "aborted":
    case "error":
      return value;
    case "started":
      return "accepted";
    default:
      return null;
  }
}

export function stringifyError(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

export function isAgentAlreadyExistsError(error: unknown) {
  return stringifyError(error).includes("already exists");
}

export function buildEmployeeBootstrapFiles(input: AuthorityHireEmployeeInput & { agentId: string }) {
  const files: Array<{ agentId: string; name: string; content: string }> = [];
  const roleMd =
    input.bootstrapBundle?.roleMd
    ?? [
      `# ${input.nickname?.trim() || input.role.trim()}`,
      "",
      "## Role",
      input.role.trim(),
      "",
      "## Responsibilities",
      input.description.trim(),
    ].join("\n");

  const lines = roleMd.split("\n");
  const hasReporting = lines.some((line) => line.trim().toLowerCase() === "## reporting");

  if (!input.bootstrapBundle?.roleMd) {
    if (input.traits?.trim()) {
      lines.push("", "## Traits", input.traits.trim());
    }
    if (typeof input.budget === "number") {
      lines.push("", "## Budget", `Daily budget target: ${input.budget} USD`);
    }
    if (input.modelTier) {
      lines.push("", "## Model Tier", input.modelTier);
    }
    if (input.bootstrapBundle?.recommendedSkills?.length) {
      lines.push(
        "",
        "## Recommended Skills",
        ...input.bootstrapBundle.recommendedSkills.map((skill) => `- ${skill}`),
      );
    }
    if (!hasReporting) {
      lines.push(
        "",
        "## Reporting",
        "Follow company dispatch and use `company_report` for structured status replies.",
      );
    }
  }

  files.push({
    agentId: input.agentId,
    name: "ROLE.md",
    content: lines.join("\n"),
  });

  if (input.bootstrapBundle?.soulMd?.trim()) {
    files.push({
      agentId: input.agentId,
      name: "SOUL.md",
      content: input.bootstrapBundle.soulMd.trim(),
    });
  }
  if (input.bootstrapBundle?.onboardingMd?.trim()) {
    files.push({
      agentId: input.agentId,
      name: "ONBOARDING.md",
      content: input.bootstrapBundle.onboardingMd.trim(),
    });
  }

  return files;
}

export function isAgentNotFoundError(error: unknown) {
  const message = stringifyError(error);
  return (
    message.includes("not found") ||
    message.includes("unknown agent id") ||
    message.includes("unknown agent")
  );
}

export function isLegacyAgentsDeletePurgeStateError(error: unknown) {
  const message = stringifyError(error);
  return (
    message.includes("invalid agents.delete params") &&
    message.includes("unexpected property") &&
    message.includes("purgeState")
  );
}

export function setCorsHeaders(response: import("node:http").ServerResponse) {
  response.setHeader("Access-Control-Allow-Origin", "*");
  response.setHeader("Access-Control-Allow-Methods", "GET,POST,PUT,PATCH,DELETE,OPTIONS");
  response.setHeader("Access-Control-Allow-Headers", "Content-Type");
}

export async function readJsonBody<T>(request: import("node:http").IncomingMessage): Promise<T> {
  const chunks: Buffer[] = [];
  for await (const chunk of request) {
    chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
  }
  const raw = Buffer.concat(chunks).toString("utf8").trim();
  if (!raw) {
    return {} as T;
  }
  return JSON.parse(raw) as T;
}

export function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

export function readString(value: unknown): string | null {
  return typeof value === "string" && value.trim().length > 0 ? value.trim() : null;
}

export function readNumber(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}
