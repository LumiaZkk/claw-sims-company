import { describe, expect, it, vi } from "vitest";
import type { AuthorityCompanyRuntimeSnapshot } from "../../../../src/infrastructure/authority/contract";
import { resolveSessionStatusCapabilityState, type SessionStatusCapabilityState } from "./runtime-authority";
import {
  listRuntimeSessionStatusRepairCandidates,
  runAuthorityRuntimeSessionStatusRepair,
} from "./runtime-session-status-repair";

function createRuntimeSnapshot(
  overrides: Partial<AuthorityCompanyRuntimeSnapshot> = {},
): AuthorityCompanyRuntimeSnapshot {
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
    activeAgentStatusHealth: null,
    updatedAt: 0,
    ...overrides,
  };
}

describe("listRuntimeSessionStatusRepairCandidates", () => {
  it("collects busy and open-work sessions that are stale enough", () => {
    const now = 100_000;
    const runtime = createRuntimeSnapshot({
      activeAgentSessions: [
        { agentId: "agent-1", sessionKey: "agent:agent-1:main", lastStatusSyncAt: now - 12_000 } as never,
        { agentId: "agent-2", sessionKey: "agent:agent-2:main", lastStatusSyncAt: now - 31_000 } as never,
        { agentId: "agent-3", sessionKey: "agent:agent-3:main", lastStatusSyncAt: now - 5_000 } as never,
      ],
      activeAgentRuntime: [
        { activeSessionKeys: ["agent:agent-1:main"] } as never,
      ],
      activeWorkItems: [
        { status: "active", ownerActorId: "agent-2", batonActorId: null, steps: [] } as never,
      ],
    });

    expect(listRuntimeSessionStatusRepairCandidates(runtime, now)).toEqual([
      "agent:agent-1:main",
      "agent:agent-2:main",
    ]);
  });
});

describe("runAuthorityRuntimeSessionStatusRepair", () => {
  it("applies normalized session status updates and broadcasts touched companies", async () => {
    const now = 100_000;
    const requestSessionStatus = vi.fn(async (sessionKey: string) => ({ sessionKey, ok: true }));
    const applyRuntimeSessionStatus = vi.fn();
    const broadcastCompanyUpdated = vi.fn();
    const updateSessionStatusCapability = vi.fn();

    const runtime = createRuntimeSnapshot({
      activeAgentSessions: [
        { agentId: "agent-1", sessionKey: "agent:agent-1:main", lastStatusSyncAt: now - 12_000 } as never,
      ],
      activeAgentRuntime: [
        { activeSessionKeys: ["agent:agent-1:main"] } as never,
      ],
    });

    const touched = await runAuthorityRuntimeSessionStatusRepair({
      companies: [{ id: "company-1" } as never],
      executorState: "ready",
      sessionStatusCapabilityState: "unknown",
      loadRuntime: () => runtime,
      requestSessionStatus,
      updateSessionStatusCapability,
      getSessionStatusCapabilityState: () => "supported",
      normalizeProviderSessionStatus: (_providerId, sessionKey) => ({
        agentId: sessionKey.split(":")[1] ?? null,
      }),
      applyRuntimeSessionStatus,
      broadcastCompanyUpdated,
      providerId: "openclaw",
      now: () => now,
    });

    expect(touched).toEqual(["company-1"]);
    expect(requestSessionStatus).toHaveBeenCalledWith("agent:agent-1:main");
    expect(updateSessionStatusCapability).toHaveBeenCalledWith("success");
    expect(applyRuntimeSessionStatus).toHaveBeenCalledWith("company-1", { agentId: "agent-1" });
    expect(broadcastCompanyUpdated).toHaveBeenCalledWith("company-1");
  });

  it("stops requesting more sessions after session_status becomes unsupported", async () => {
    const now = 100_000;
    let capabilityState: SessionStatusCapabilityState = "unknown";
    const requestSessionStatus = vi
      .fn()
      .mockRejectedValueOnce(new Error("unknown method: session_status"))
      .mockResolvedValue({ ok: true });
    const updateSessionStatusCapability = vi.fn((outcome: "success" | "error", error?: unknown) => {
      capabilityState = resolveSessionStatusCapabilityState({
        current: capabilityState,
        outcome,
        error,
      });
    });

    const runtime = createRuntimeSnapshot({
      activeAgentSessions: [
        { agentId: "agent-1", sessionKey: "agent:agent-1:main", lastStatusSyncAt: now - 12_000 } as never,
        { agentId: "agent-2", sessionKey: "agent:agent-2:main", lastStatusSyncAt: now - 31_000 } as never,
      ],
      activeAgentRuntime: [
        { activeSessionKeys: ["agent:agent-1:main"] } as never,
      ],
      activeWorkItems: [
        { status: "active", ownerActorId: "agent-2", batonActorId: null, steps: [] } as never,
      ],
    });

    const touched = await runAuthorityRuntimeSessionStatusRepair({
      companies: [{ id: "company-1" } as never],
      executorState: "ready",
      sessionStatusCapabilityState: capabilityState,
      loadRuntime: () => runtime,
      requestSessionStatus,
      updateSessionStatusCapability,
      getSessionStatusCapabilityState: () => capabilityState,
      normalizeProviderSessionStatus: () => ({ agentId: null }),
      applyRuntimeSessionStatus: vi.fn(),
      broadcastCompanyUpdated: vi.fn(),
      providerId: "openclaw",
      now: () => now,
      logWarn: vi.fn(),
    });

    expect(touched).toEqual([]);
    expect(requestSessionStatus).toHaveBeenCalledTimes(1);
    expect(capabilityState).toBe("unsupported");
  });
});
