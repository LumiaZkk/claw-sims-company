import type { AuthorityCompanyRuntimeSnapshot } from "./contract";

export const AUTHORITY_OWNED_RUNTIME_SLICE_KEYS = [
  "activeRoomRecords",
  "activeMissionRecords",
  "activeConversationStates",
  "activeWorkItems",
  "activeRequirementAggregates",
  "activeRequirementEvidence",
  "primaryRequirementId",
  "activeRoundRecords",
  "activeArtifacts",
  "activeDispatches",
  "activeRoomBindings",
  "activeSupportRequests",
  "activeEscalations",
  "activeDecisionTickets",
  "activeAgentSessions",
  "activeAgentRuns",
  "activeAgentRuntime",
  "activeAgentStatuses",
  "activeAgentStatusHealth",
] as const satisfies readonly (keyof AuthorityCompanyRuntimeSnapshot)[];

export const COMPATIBILITY_RUNTIME_SLICE_KEYS = [
] as const satisfies readonly (keyof AuthorityCompanyRuntimeSnapshot)[];

export const AUTHORITY_OWNED_RUNTIME_SLICE_LABELS: Record<
  (typeof AUTHORITY_OWNED_RUNTIME_SLICE_KEYS)[number],
  string
> = {
  activeRoomRecords: "rooms",
  activeMissionRecords: "missions",
  activeConversationStates: "conversation-state",
  activeWorkItems: "work-items",
  activeRequirementAggregates: "requirements",
  activeRequirementEvidence: "requirement-evidence",
  primaryRequirementId: "primary-requirement",
  activeRoundRecords: "rounds",
  activeArtifacts: "artifacts",
  activeDispatches: "dispatches",
  activeRoomBindings: "room-bindings",
  activeSupportRequests: "support-requests",
  activeEscalations: "escalations",
  activeDecisionTickets: "decision-tickets",
  activeAgentSessions: "agent-sessions",
  activeAgentRuns: "agent-runs",
  activeAgentRuntime: "agent-runtime",
  activeAgentStatuses: "agent-statuses",
  activeAgentStatusHealth: "agent-status-health",
};

export const COMPATIBILITY_RUNTIME_SLICE_LABELS: Record<
  (typeof COMPATIBILITY_RUNTIME_SLICE_KEYS)[number],
  string
> = {
};

export function hasCompatibilityRuntimeSlices(): boolean {
  return COMPATIBILITY_RUNTIME_SLICE_KEYS.length > 0;
}

export function applyAuthorityOwnedRuntimeSlices(input: {
  snapshot: AuthorityCompanyRuntimeSnapshot;
  authorityRuntime: AuthorityCompanyRuntimeSnapshot;
}): AuthorityCompanyRuntimeSnapshot {
  const authorityOwnedPatch: Partial<AuthorityCompanyRuntimeSnapshot> = {};
  for (const key of AUTHORITY_OWNED_RUNTIME_SLICE_KEYS) {
    const value = input.authorityRuntime[key];
    if (typeof value !== "undefined") {
      (authorityOwnedPatch as Record<string, unknown>)[key] = value;
    }
  }
  return {
    ...input.snapshot,
    ...authorityOwnedPatch,
  };
}

export function listAuthorityOwnedRuntimeSliceLabels(): string[] {
  return AUTHORITY_OWNED_RUNTIME_SLICE_KEYS.map((key) => AUTHORITY_OWNED_RUNTIME_SLICE_LABELS[key]);
}

export function listCompatibilityRuntimeSliceLabels(): string[] {
  return COMPATIBILITY_RUNTIME_SLICE_KEYS.map((key) => COMPATIBILITY_RUNTIME_SLICE_LABELS[key]);
}
