import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import * as authorityControl from "../../../application/gateway/authority-control";
import { useAuthorityRuntimeSyncStore } from "../../authority/runtime-sync-store";
import { useCompanyRuntimeStore } from "./store";
import type { Company, RoundRecord } from "./types";

function createCompany(): Company {
  return {
    id: "company-1",
    name: "小说创作工作室",
    description: "测试公司",
    icon: "🦞",
    template: "novel",
    employees: [
      { agentId: "co-ceo", nickname: "CEO", role: "Chief Executive Officer", isMeta: true, metaRole: "ceo" },
      { agentId: "co-cto", nickname: "CTO", role: "Chief Technology Officer", isMeta: true, metaRole: "cto" },
    ],
    quickPrompts: [],
    createdAt: 1,
  };
}

function createRound(overrides: Partial<RoundRecord> = {}): RoundRecord {
  return {
    id: "archive:round-1",
    companyId: "company-1",
    workItemId: "topic:mission:alpha",
    roomId: "workitem:topic:mission:alpha",
    title: "CEO 与 CTO 的上一轮协作归档",
    preview: "上一轮已经明确要先搭底座。",
    reason: "reset",
    sourceActorId: "co-ceo",
    sourceActorLabel: "CEO",
    sourceSessionKey: "agent:co-ceo:main",
    sourceConversationId: "agent:co-ceo:main",
    providerArchiveId: "provider:archive:1",
    providerId: "openclaw",
    messages: [
      {
        role: "user",
        text: "请先把技术底座搭出来。",
        timestamp: 1_000,
      },
    ],
    archivedAt: 2_000,
    restorable: true,
    ...overrides,
  };
}

describe("useCompanyRuntimeStore upsertRoundRecord", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  beforeEach(() => {
    const storage = new Map<string, string>();
    Object.defineProperty(globalThis, "localStorage", {
      value: {
        getItem: (key: string) => storage.get(key) ?? null,
        setItem: (key: string, value: string) => {
          storage.set(key, value);
        },
        removeItem: (key: string) => {
          storage.delete(key);
        },
      },
      configurable: true,
      writable: true,
    });

    useAuthorityRuntimeSyncStore.setState({
      compatibilityPathEnabled: true,
      commandRoutes: ["round.upsert", "round.delete"],
      mode: "compatibility_snapshot",
      lastSnapshotUpdatedAt: null,
      lastAppliedSignature: null,
      lastAppliedSource: null,
      lastAppliedAt: null,
      lastPushAt: null,
      lastPullAt: null,
      lastCommandAt: null,
      pushCount: 0,
      pullCount: 0,
      commandCount: 0,
      lastError: null,
      lastErrorAt: null,
      lastErrorOperation: null,
    });

    useCompanyRuntimeStore.setState({
      config: null,
      activeCompany: createCompany(),
      authorityBackedState: true,
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
      loading: false,
      error: null,
      bootstrapPhase: "ready",
    });
  });

  it("routes authority-backed round writes through authority and applies the returned runtime", async () => {
    const round = createRound();
    const upsertRoundSpy = vi
      .spyOn(authorityControl, "upsertAuthorityRound")
      .mockResolvedValue({
        companyId: "company-1",
        activeRoomRecords: [],
        activeMissionRecords: [],
        activeConversationStates: [],
        activeWorkItems: [],
        activeRequirementAggregates: [],
        activeRequirementEvidence: [],
        primaryRequirementId: null,
        activeRoundRecords: [round],
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
        updatedAt: 2_000,
      });

    useCompanyRuntimeStore.getState().upsertRoundRecord(round);

    await vi.waitFor(() => {
      expect(upsertRoundSpy).toHaveBeenCalledWith({
        companyId: "company-1",
        round,
      });
      expect(useCompanyRuntimeStore.getState().activeRoundRecords).toEqual([round]);
    });
  });

  it("routes authority-backed round deletion through authority", async () => {
    const round = createRound();
    const deleteRoundSpy = vi
      .spyOn(authorityControl, "deleteAuthorityRound")
      .mockResolvedValue({
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
        updatedAt: 3_000,
      });

    useCompanyRuntimeStore.setState({
      activeRoundRecords: [round],
    });

    useCompanyRuntimeStore.getState().deleteRoundRecord(round.id);

    await vi.waitFor(() => {
      expect(deleteRoundSpy).toHaveBeenCalledWith({
        companyId: "company-1",
        roundId: round.id,
      });
      expect(useCompanyRuntimeStore.getState().activeRoundRecords).toEqual([]);
    });
  });
});
