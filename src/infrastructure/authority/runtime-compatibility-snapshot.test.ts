import { describe, expect, it } from "vitest";
import type { AuthorityCompanyRuntimeSnapshot } from "./contract";
import { buildAuthorityCompatibilityRuntimeSnapshot } from "./runtime-compatibility-snapshot";

function createSnapshot(overrides: Partial<AuthorityCompanyRuntimeSnapshot> = {}): AuthorityCompanyRuntimeSnapshot {
  return {
    companyId: "company-1",
    activeRoomRecords: [],
    activeMissionRecords: [],
    activeConversationStates: [],
    activeWorkItems: [],
    activeRequirementAggregates: [],
    activeRequirementEvidence: [],
    primaryRequirementId: null,
    activeRoundRecords: [],
    activeArtifacts: [],
    activeDispatches: [],
    activeRoomBindings: [],
    activeSupportRequests: [],
    activeEscalations: [],
    activeDecisionTickets: [],
    activeAgentSessions: [],
    activeAgentRuns: [],
    activeAgentRuntime: [],
    activeAgentStatuses: [],
    updatedAt: 1_000,
    ...overrides,
  };
}

describe("buildAuthorityCompatibilityRuntimeSnapshot", () => {
  it("preserves authority-owned slices from the cached authority runtime", () => {
    const authorityRuntime = createSnapshot({
      activeRoomRecords: [{ id: "room-authority" } as never],
      activeMissionRecords: [{ id: "mission-authority" } as never],
      activeConversationStates: [{ conversationId: "conv-authority" } as never],
      activeWorkItems: [{ id: "work-authority" } as never],
      activeRequirementAggregates: [{ id: "aggregate-authority" } as never],
      activeRequirementEvidence: [{ id: "evidence-authority" } as never],
      primaryRequirementId: "aggregate-authority",
      activeRoundRecords: [{ id: "round-authority" } as never],
      activeArtifacts: [{ id: "artifact-authority" } as never],
      activeDispatches: [{ id: "dispatch-authority" } as never],
      activeRoomBindings: [{ roomId: "room-authority", conversationId: "conv-1" } as never],
      activeSupportRequests: [{ id: "support-authority" } as never],
      activeEscalations: [{ id: "escalation-authority" } as never],
      activeDecisionTickets: [{ id: "decision-authority" } as never],
      activeAgentSessions: [{ sessionKey: "session-authority" } as never],
      activeAgentRuns: [{ runId: "run-authority" } as never],
      activeAgentRuntime: [{ agentId: "agent-authority" } as never],
      activeAgentStatuses: [{ agentId: "agent-authority", runtimeState: "busy" } as never],
    });
    const localRuntime = createSnapshot({
      activeRoomRecords: [{ id: "room-local" } as never],
      activeMissionRecords: [{ id: "mission-local" } as never],
      activeConversationStates: [{ conversationId: "conv-1" } as never],
      activeWorkItems: [{ id: "work-local" } as never],
      activeRequirementAggregates: [{ id: "aggregate-local" } as never],
      activeRequirementEvidence: [{ id: "evidence-local" } as never],
      primaryRequirementId: "aggregate-local",
      activeRoundRecords: [{ id: "round-local" } as never],
      activeArtifacts: [{ id: "artifact-local" } as never],
      activeDispatches: [{ id: "dispatch-local" } as never],
      activeRoomBindings: [{ roomId: "room-local", conversationId: "conv-1" } as never],
      activeSupportRequests: [{ id: "support-local" } as never],
      activeEscalations: [{ id: "escalation-local" } as never],
      activeDecisionTickets: [{ id: "decision-local" } as never],
      activeAgentSessions: [{ sessionKey: "session-local" } as never],
      activeAgentRuns: [{ runId: "run-local" } as never],
      activeAgentRuntime: [{ agentId: "agent-local" } as never],
      activeAgentStatuses: [{ agentId: "agent-local", runtimeState: "idle" } as never],
    });

    const result = buildAuthorityCompatibilityRuntimeSnapshot({
      localRuntime,
      authorityRuntime,
    });

    expect(result.activeRoomRecords[0]).toMatchObject({ id: "room-authority" });
    expect(result.activeMissionRecords[0]).toMatchObject({ id: "mission-authority" });
    expect(result.activeConversationStates[0]).toMatchObject({ conversationId: "conv-authority" });
    expect(result.activeWorkItems[0]).toMatchObject({ id: "work-authority" });
    expect(result.activeRequirementAggregates[0]).toMatchObject({ id: "aggregate-authority" });
    expect(result.activeRequirementEvidence[0]).toMatchObject({ id: "evidence-authority" });
    expect(result.primaryRequirementId).toBe("aggregate-authority");
    expect(result.activeRoundRecords[0]).toMatchObject({ id: "round-authority" });
    expect(result.activeArtifacts[0]).toMatchObject({ id: "artifact-authority" });
    expect(result.activeDispatches[0]).toMatchObject({ id: "dispatch-authority" });
    expect(result.activeRoomBindings[0]).toMatchObject({ roomId: "room-authority" });
    expect(result.activeSupportRequests[0]).toMatchObject({ id: "support-authority" });
    expect(result.activeEscalations[0]).toMatchObject({ id: "escalation-authority" });
    expect(result.activeDecisionTickets[0]).toMatchObject({ id: "decision-authority" });
    expect(result.activeAgentSessions?.[0]).toMatchObject({ sessionKey: "session-authority" });
    expect(result.activeAgentRuns?.[0]).toMatchObject({ runId: "run-authority" });
    expect(result.activeAgentRuntime?.[0]).toMatchObject({ agentId: "agent-authority" });
    expect(result.activeAgentStatuses?.[0]).toMatchObject({ agentId: "agent-authority" });

  });

  it("falls back to the local snapshot when no cached authority runtime exists", () => {
    const localRuntime = createSnapshot({
      activeRoomRecords: [{ id: "room-local" } as never],
    });

    expect(
      buildAuthorityCompatibilityRuntimeSnapshot({
        localRuntime,
        authorityRuntime: null,
      }),
    ).toBe(localRuntime);
  });
});
