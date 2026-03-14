import { beforeEach, describe, expect, it, vi } from "vitest";
import type { Company, CyberCompanyConfig } from "../../domain/org/types";
import type { AuthorityBootstrapSnapshot } from "./contract";
import {
  applyAuthorityBootstrapToStore,
  refreshAuthorityBootstrapSilently,
} from "./bootstrap-command";
import { getAuthorityBootstrap } from "../../application/gateway/authority-control";
import {
  clearCachedAuthorityBootstrap,
  readCachedAuthorityConfig,
  readCachedAuthorityRuntimeSnapshot,
} from "./runtime-cache";
import { createEmptyProductState } from "../company/runtime/bootstrap";
import { useCompanyRuntimeStore } from "../company/runtime/store";

vi.mock("../../application/gateway/authority-control", () => ({
  getAuthorityBootstrap: vi.fn(),
}));

function createCompany(): Company {
  return {
    id: "company-1",
    name: "测试公司",
    description: "authority bootstrap test",
    icon: "🏢",
    template: "blank",
    createdAt: 1,
    employees: [
      {
        agentId: "co-ceo",
        nickname: "CEO",
        role: "Chief Executive Officer",
        isMeta: true,
        metaRole: "ceo",
      },
    ],
    quickPrompts: [],
  };
}

function createConfig(company: Company): CyberCompanyConfig {
  return {
    version: 1,
    companies: [company],
    activeCompanyId: company.id,
    preferences: {
      theme: "classic",
      locale: "zh-CN",
    },
  };
}

function createBootstrap(): AuthorityBootstrapSnapshot {
  const activeCompany = createCompany();
  return {
    config: createConfig(activeCompany),
    activeCompany,
    runtime: {
      companyId: activeCompany.id,
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
      updatedAt: 2_000,
    },
    executor: {
      adapter: "openclaw-bridge",
      state: "ready",
      provider: "openclaw",
      note: "ok",
    },
    executorConfig: {
      type: "openclaw",
      openclaw: {
        url: "ws://127.0.0.1:18789",
        tokenConfigured: true,
      },
      connectionState: "ready",
      lastError: null,
      lastConnectedAt: null,
    },
    executorCapabilities: {
      sessionStatus: "supported",
      processRuntime: "supported",
      notes: [],
    },
    executorReadiness: [],
    authority: {
      url: "http://127.0.0.1:18890",
      dbPath: "/tmp/authority.sqlite",
      connected: true,
    },
  };
}

describe("bootstrap-command", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    clearCachedAuthorityBootstrap();
    useCompanyRuntimeStore.setState({
      config: null,
      activeCompany: null,
      ...createEmptyProductState(),
      loading: true,
      error: "stale failure",
      bootstrapPhase: "restoring",
    });
  });

  it("applies authority bootstrap without re-entering restoring state", () => {
    const snapshot = createBootstrap();

    const result = applyAuthorityBootstrapToStore(snapshot);
    const state = useCompanyRuntimeStore.getState();

    expect(result).toBe(snapshot);
    expect(state.loading).toBe(false);
    expect(state.error).toBeNull();
    expect(state.bootstrapPhase).toBe("ready");
    expect(state.authorityBackedState).toBe(true);
    expect(state.activeCompany?.id).toBe("company-1");
    expect(readCachedAuthorityConfig()?.activeCompanyId).toBe("company-1");
    expect(readCachedAuthorityRuntimeSnapshot("company-1")?.updatedAt).toBe(2_000);
  });

  it("refreshes bootstrap through authority and applies it silently", async () => {
    const snapshot = createBootstrap();
    vi.mocked(getAuthorityBootstrap).mockResolvedValue(snapshot);

    const result = await refreshAuthorityBootstrapSilently();
    const state = useCompanyRuntimeStore.getState();

    expect(getAuthorityBootstrap).toHaveBeenCalledTimes(1);
    expect(result).toBe(snapshot);
    expect(state.loading).toBe(false);
    expect(state.bootstrapPhase).toBe("ready");
    expect(state.activeCompany?.id).toBe("company-1");
    expect(readCachedAuthorityConfig()?.activeCompanyId).toBe("company-1");
  });
});
