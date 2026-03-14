import type {
  AuthorityCompanyRuntimeSnapshot,
} from "../../../src/infrastructure/authority/contract";
import type { Company } from "../../../src/domain/org/types";
import type { SessionStatusCapabilityState } from "./runtime-authority";

function ageMs(timestamp: number | null | undefined, now: number): number {
  return Math.max(0, now - (timestamp ?? 0));
}

function collectCandidateSessionKeys(
  runtime: AuthorityCompanyRuntimeSnapshot,
  now: number,
): string[] {
  const latestSessionByAgentId = new Map<
    string,
    NonNullable<AuthorityCompanyRuntimeSnapshot["activeAgentSessions"]>[number]
  >();
  for (const session of runtime.activeAgentSessions ?? []) {
    if (session.agentId && !latestSessionByAgentId.has(session.agentId)) {
      latestSessionByAgentId.set(session.agentId, session);
    }
  }

  const candidateSessionKeys = new Set<string>();
  const busySessionKeys = new Set(
    (runtime.activeAgentRuntime ?? []).flatMap((entry) => entry.activeSessionKeys),
  );
  for (const session of runtime.activeAgentSessions ?? []) {
    if (
      busySessionKeys.has(session.sessionKey) &&
      ageMs(session.lastStatusSyncAt, now) >= 10_000
    ) {
      candidateSessionKeys.add(session.sessionKey);
    }
  }

  const openWorkAgentIds = new Set<string>();
  for (const workItem of runtime.activeWorkItems ?? []) {
    if (workItem.status === "completed" || workItem.status === "archived") {
      continue;
    }
    if (workItem.ownerActorId) {
      openWorkAgentIds.add(workItem.ownerActorId);
    }
    if (workItem.batonActorId) {
      openWorkAgentIds.add(workItem.batonActorId);
    }
    workItem.steps
      .filter((step) => step.status === "active")
      .forEach((step) => {
        if (step.assigneeActorId) {
          openWorkAgentIds.add(step.assigneeActorId);
        }
      });
  }
  for (const dispatch of runtime.activeDispatches ?? []) {
    if (
      dispatch.status === "answered"
      || dispatch.status === "blocked"
      || dispatch.status === "superseded"
    ) {
      continue;
    }
    dispatch.targetActorIds.forEach((agentId) => openWorkAgentIds.add(agentId));
  }
  for (const request of runtime.activeSupportRequests ?? []) {
    if (
      request.ownerActorId
      && (request.status === "open"
        || request.status === "acknowledged"
        || request.status === "in_progress")
    ) {
      openWorkAgentIds.add(request.ownerActorId);
    }
  }

  for (const agentId of openWorkAgentIds) {
    const session = latestSessionByAgentId.get(agentId);
    if (!session) {
      continue;
    }
    if (busySessionKeys.has(session.sessionKey)) {
      continue;
    }
    if (ageMs(session.lastStatusSyncAt, now) >= 30_000) {
      candidateSessionKeys.add(session.sessionKey);
    }
  }

  return [...candidateSessionKeys].slice(0, 24);
}

export function listRuntimeSessionStatusRepairCandidates(
  runtime: AuthorityCompanyRuntimeSnapshot,
  now = Date.now(),
) {
  return collectCandidateSessionKeys(runtime, now);
}

export async function runAuthorityRuntimeSessionStatusRepair<
  TStatus extends { agentId?: string | null },
>(input: {
  companies: Company[];
  executorState: string;
  sessionStatusCapabilityState: SessionStatusCapabilityState;
  loadRuntime: (companyId: string) => AuthorityCompanyRuntimeSnapshot;
  requestSessionStatus: (sessionKey: string) => Promise<unknown>;
  updateSessionStatusCapability: (outcome: "success" | "error", error?: unknown) => void;
  getSessionStatusCapabilityState: () => SessionStatusCapabilityState;
  normalizeProviderSessionStatus: (
    providerId: string,
    sessionKey: string,
    result: unknown,
  ) => TStatus;
  applyRuntimeSessionStatus: (companyId: string, status: TStatus) => void;
  broadcastCompanyUpdated: (companyId: string) => void;
  providerId: string;
  now?: () => number;
  logWarn?: (message: string, error: unknown) => void;
}) {
  if (input.executorState !== "ready") {
    return [];
  }
  if (input.sessionStatusCapabilityState === "unsupported") {
    return [];
  }
  if (!input.companies.length) {
    return [];
  }

  const touchedCompanyIds = new Set<string>();
  const now = input.now ?? (() => Date.now());

  for (const company of input.companies) {
    const runtime = input.loadRuntime(company.id);
    for (const sessionKey of collectCandidateSessionKeys(runtime, now())) {
      try {
        const result = await input.requestSessionStatus(sessionKey);
        input.updateSessionStatusCapability("success");
        const normalized = input.normalizeProviderSessionStatus(input.providerId, sessionKey, result);
        input.applyRuntimeSessionStatus(company.id, normalized);
        touchedCompanyIds.add(company.id);
      } catch (error) {
        input.updateSessionStatusCapability("error", error);
        if (input.getSessionStatusCapabilityState() === "unsupported") {
          break;
        }
        input.logWarn?.(`Failed runtime read-repair for ${sessionKey}.`, error);
      }
    }
  }

  touchedCompanyIds.forEach((companyId) => {
    input.broadcastCompanyUpdated(companyId);
  });
  return [...touchedCompanyIds];
}
