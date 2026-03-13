import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import * as authorityControl from "../../../application/gateway/authority-control";
import type { AuthorityCompanyRuntimeSnapshot } from "../../authority/contract";
import { useAuthorityRuntimeSyncStore } from "../../authority/runtime-sync-store";
import { useCompanyRuntimeStore } from "./store";
import type {
  Company,
  ConversationMissionRecord,
  ConversationStateRecord,
  WorkItemRecord,
} from "./types";

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

function createMission(overrides: Partial<ConversationMissionRecord> = {}): ConversationMissionRecord {
  return {
    id: "mission:consistency-platform",
    sessionKey: "agent:co-ceo:main",
    topicKey: "mission:consistency-platform",
    startedAt: 1_000,
    lifecyclePhase: "active_requirement",
    stageGateStatus: "confirmed",
    title: "一致性底座与内部审阅系统执行方案",
    statusLabel: "待 CEO 收口",
    progressLabel: "2/3",
    ownerAgentId: "co-ceo",
    ownerLabel: "CEO",
    currentStepLabel: "整合团队方案并交付老板",
    nextAgentId: "co-ceo",
    nextLabel: "CEO 收口",
    summary: "CTO 与 COO 已回传方案，等待 CEO 汇总。",
    guidance: "输出最终执行方案和优先级。",
    completed: false,
    updatedAt: 2_000,
    planSteps: [],
    ...overrides,
  };
}

function createWorkItem(overrides: Partial<WorkItemRecord> = {}): WorkItemRecord {
  return {
    id: "topic:mission:consistency-platform",
    workKey: "topic:mission:consistency-platform",
    kind: "strategic",
    roundId: "topic:mission:consistency-platform",
    companyId: "company-1",
    sessionKey: "agent:co-ceo:main",
    topicKey: "mission:consistency-platform",
    sourceActorId: "co-ceo",
    sourceActorLabel: "CEO",
    sourceSessionKey: "agent:co-ceo:main",
    sourceConversationId: "agent:co-ceo:main",
    providerId: null,
    title: "一致性底座",
    goal: "建设一致性底座",
    headline: "一致性底座",
    displayStage: "CEO 统筹",
    displaySummary: "当前主线正在推进。",
    displayOwnerLabel: "CEO",
    displayNextAction: "继续推进 CTO 输出。",
    status: "active",
    lifecyclePhase: "active_requirement",
    stageGateStatus: "confirmed",
    stageLabel: "CEO 统筹",
    ownerActorId: "co-ceo",
    ownerLabel: "CEO",
    batonActorId: "co-cto",
    batonLabel: "CTO",
    roomId: "workitem:topic:mission:consistency-platform",
    artifactIds: [],
    dispatchIds: [],
    startedAt: 1_000,
    updatedAt: 2_000,
    completedAt: null,
    summary: "当前主线正在推进。",
    nextAction: "继续推进 CTO 输出。",
    steps: [],
    ...overrides,
  };
}

function createConversationState(
  overrides: Partial<ConversationStateRecord> = {},
): ConversationStateRecord {
  return {
    companyId: "company-1",
    conversationId: "agent:co-ceo:main",
    currentWorkKey: "topic:mission:consistency-platform",
    currentWorkItemId: "topic:mission:consistency-platform",
    currentRoundId: null,
    draftRequirement: null,
    updatedAt: 2_000,
    ...overrides,
  };
}

function createSnapshot(
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
    updatedAt: 2_000,
    ...overrides,
  };
}

describe("authority-backed runtime closeout commands", () => {
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
      compatibilityPathEnabled: false,
      commandRoutes: [
        "mission.upsert",
        "mission.delete",
        "conversation-state.upsert",
        "conversation-state.delete",
        "work-item.upsert",
        "work-item.delete",
      ],
      mode: "command_preferred",
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

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("routes mission upsert and delete through authority", async () => {
    const mission = createMission();
    const workItem = createWorkItem();
    const upsertMissionSpy = vi
      .spyOn(authorityControl, "upsertAuthorityMission")
      .mockResolvedValue(
        createSnapshot({
          activeMissionRecords: [mission],
          activeWorkItems: [workItem],
        }),
      );
    const deleteMissionSpy = vi
      .spyOn(authorityControl, "deleteAuthorityMission")
      .mockResolvedValue(createSnapshot());

    useCompanyRuntimeStore.getState().upsertMissionRecord(mission);

    await vi.waitFor(() => {
      expect(upsertMissionSpy).toHaveBeenCalledWith({
        companyId: "company-1",
        mission,
      });
      expect(useCompanyRuntimeStore.getState().activeMissionRecords[0]).toMatchObject({
        id: "topic:mission:consistency-platform",
        sessionKey: mission.sessionKey,
        topicKey: mission.topicKey,
      });
      expect(useCompanyRuntimeStore.getState().activeWorkItems).toEqual([workItem]);
    });

    useCompanyRuntimeStore.getState().deleteMissionRecord(mission.id);

    await vi.waitFor(() => {
      expect(deleteMissionSpy).toHaveBeenCalledWith({
        companyId: "company-1",
        missionId: mission.id,
      });
      expect(useCompanyRuntimeStore.getState().activeMissionRecords).toEqual([]);
    });
  });

  it("routes conversation state upsert and delete through authority", async () => {
    const state = createConversationState();
    const upsertConversationSpy = vi
      .spyOn(authorityControl, "upsertAuthorityConversationState")
      .mockResolvedValue(
        createSnapshot({
          activeConversationStates: [state],
        }),
      );
    const deleteConversationSpy = vi
      .spyOn(authorityControl, "deleteAuthorityConversationState")
      .mockResolvedValue(createSnapshot());

    useCompanyRuntimeStore.getState().setConversationCurrentWorkKey(
      state.conversationId,
      state.currentWorkKey ?? null,
      state.currentWorkItemId ?? null,
      state.currentRoundId ?? null,
    );

    await vi.waitFor(() => {
      expect(upsertConversationSpy).toHaveBeenCalledWith({
        companyId: "company-1",
        conversationId: state.conversationId,
        changes: {
          currentWorkKey: state.currentWorkKey,
          currentWorkItemId: state.currentWorkItemId,
          currentRoundId: state.currentRoundId,
        },
        timestamp: expect.any(Number),
      });
      expect(useCompanyRuntimeStore.getState().activeConversationStates).toEqual([state]);
    });

    useCompanyRuntimeStore.getState().clearConversationState(state.conversationId);

    await vi.waitFor(() => {
      expect(deleteConversationSpy).toHaveBeenCalledWith({
        companyId: "company-1",
        conversationId: state.conversationId,
      });
      expect(useCompanyRuntimeStore.getState().activeConversationStates).toEqual([]);
    });
  });

  it("routes work-item upsert and delete through authority", async () => {
    const workItem = createWorkItem();
    const upsertWorkItemSpy = vi
      .spyOn(authorityControl, "upsertAuthorityWorkItem")
      .mockResolvedValue(
        createSnapshot({
          activeWorkItems: [workItem],
        }),
      );
    const deleteWorkItemSpy = vi
      .spyOn(authorityControl, "deleteAuthorityWorkItem")
      .mockResolvedValue(createSnapshot());

    useCompanyRuntimeStore.getState().upsertWorkItemRecord(workItem);

    await vi.waitFor(() => {
      expect(upsertWorkItemSpy).toHaveBeenCalledWith({
        companyId: "company-1",
        workItem,
      });
      expect(useCompanyRuntimeStore.getState().activeWorkItems).toEqual([workItem]);
    });

    useCompanyRuntimeStore.getState().deleteWorkItemRecord(workItem.id);

    await vi.waitFor(() => {
      expect(deleteWorkItemSpy).toHaveBeenCalledWith({
        companyId: "company-1",
        workItemId: workItem.id,
      });
      expect(useCompanyRuntimeStore.getState().activeWorkItems).toEqual([]);
    });
  });
});
