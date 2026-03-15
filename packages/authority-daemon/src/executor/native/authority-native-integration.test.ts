import { describe, expect, it, vi } from "vitest";
import type { AuthorityCompanyRuntimeSnapshot } from "../../../../../src/infrastructure/authority/contract";
import { createAuthorityNativeIntegration } from "./authority-native-integration";

function createRepositoryStub() {
  const runtime: AuthorityCompanyRuntimeSnapshot = {
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
    activeAgentStatusHealth: {
      source: "authority",
      coverage: "authority_partial",
      coveredAgentCount: 0,
      expectedAgentCount: 0,
      missingAgentIds: [],
      isComplete: false,
      generatedAt: 0,
      note: "test",
    },
    updatedAt: 0,
  };

  return {
    loadExecutorConfig: vi.fn(() => ({
      type: "openclaw" as const,
      openclaw: { url: "ws://127.0.0.1:18789", token: "token" },
      connectionState: "degraded" as const,
      lastError: null,
      lastConnectedAt: null,
    })),
    saveExecutorConfig: vi.fn((config) => config),
    getHealth: vi.fn(() => ({})),
    getBootstrap: vi.fn(() => ({})),
    getCompanyAgentIds: vi.fn(() => []),
    getConversationContext: vi.fn(() => null),
    findCompanyIdByAgentId: vi.fn(() => null),
    updateRuntimeFromSessionList: vi.fn(),
    resetSession: vi.fn(),
    deleteSession: vi.fn(),
    setAgentFile: vi.fn(),
    applyRuntimeSessionStatus: vi.fn(),
    loadConfig: vi.fn(() => null),
    listManagedExecutorAgents: vi.fn(() => []),
    clearManagedExecutorAgent: vi.fn(),
    listAgentFiles: vi.fn(() => ({ files: [] })),
    loadRuntime: vi.fn(() => runtime),
    saveConfig: vi.fn(),
  };
}

describe("authority-native-integration", () => {
  it("auto-enables managed workspace plugin trust before queue sync", async () => {
    const repository = createRepositoryStub();
    const ensureLocalPluginEntriesEnabled = vi.fn(() => ({
      configPath: "/tmp/openclaw.json",
      enabledPluginIds: ["sims-company"],
      changed: true,
    }));
    const refreshGatewayRuntimeSnapshot = vi.fn(async () => ({
      restarted: true as const,
      baseHash: "hash-1",
    }));
    const waitForGatewayReconnect = vi.fn(async () => ({
      reconnected: true as const,
      attempts: 1,
    }));

    const integration = createAuthorityNativeIntegration({
      repository: repository as never,
      broadcast: vi.fn(),
      ensureLocalPluginEntriesEnabled,
      refreshGatewayRuntimeSnapshot,
      waitForGatewayReconnect,
    });

    await integration.queueManagedExecutorSync("test.sync");

    expect(ensureLocalPluginEntriesEnabled).toHaveBeenCalledWith(["sims-company"]);
    expect(refreshGatewayRuntimeSnapshot).toHaveBeenCalledTimes(1);
    expect(waitForGatewayReconnect).toHaveBeenCalledTimes(1);
  });

  it("runs plugin trust step before managed provisioning attempts", async () => {
    const repository = createRepositoryStub();
    const ensureLocalPluginEntriesEnabled = vi.fn(() => ({
      configPath: "/tmp/openclaw.json",
      enabledPluginIds: ["sims-company"],
      changed: false,
    }));

    const integration = createAuthorityNativeIntegration({
      repository: repository as never,
      broadcast: vi.fn(),
      ensureLocalPluginEntriesEnabled,
      refreshGatewayRuntimeSnapshot: vi.fn(),
      waitForGatewayReconnect: vi.fn(),
    });

    await expect(
      integration.ensureManagedCompanyExecutorProvisioned(
        {
          id: "company-1",
          name: "测试公司",
          description: "",
          icon: "🏢",
          template: "blank",
          createdAt: 0,
          employees: [],
          departments: [],
          quickPrompts: [],
        },
        repository.loadRuntime(),
        "company.create",
      ),
    ).rejects.toThrow("Authority 尚未连接到 OpenClaw");

    expect(ensureLocalPluginEntriesEnabled).toHaveBeenCalledWith(["sims-company"]);
  });
});
