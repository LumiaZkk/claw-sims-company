import { describe, expect, it } from "vitest";
import {
  mergeAuthorityControlledRuntimeSlices,
  reconcileAuthorityRequirementRuntime,
} from "./requirement-control-runtime";
import type { AuthorityCompanyRuntimeSnapshot } from "../../../../src/infrastructure/authority/contract";
import type { ChatMessage } from "../../../../src/infrastructure/gateway/openclaw/sessions";
import type { Company } from "../../../../src/domain";

function createCompany(): Company {
  return {
    id: "company-1",
    name: "测试公司",
    description: "",
    icon: "🏢",
    template: "blank",
    employees: [
      {
        agentId: "co-ceo",
        nickname: "CEO",
        role: "Chief Executive Officer",
        isMeta: true,
        metaRole: "ceo",
      },
      {
        agentId: "co-coo",
        nickname: "COO",
        role: "Chief Operating Officer",
        isMeta: true,
        metaRole: "coo",
      },
    ],
    quickPrompts: [],
    createdAt: 1,
  };
}

function createRuntime(): AuthorityCompanyRuntimeSnapshot {
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
  };
}

function createControlMessage(): ChatMessage {
  return {
    role: "assistant",
    text: "请选择接下来先启动哪一项。",
    metadata: {
      control: {
        version: 1,
        requirementDraft: {
          summary: "搭建 AI 小说创作系统，并先确定当前启动优先级。",
          nextAction: "先由你在结构化选项里决定先启哪一棒。",
          ownerLabel: "CEO",
          stage: "等待老板决策",
          topicKey: "mission:novel-system",
          canProceed: true,
          stageGateStatus: "waiting_confirmation",
        },
        decision: {
          key: "launch-plan",
          type: "requirement_gate",
          summary: "请选择当前要先启动的执行项。",
          options: [
            { id: "launch_a", label: "先启动 A", summary: "先让 CTO 开始搭建技术底座。" },
            { id: "launch_all", label: "全部启动", summary: "让 CTO / COO / HR 并行推进。" },
          ],
          requiresHuman: true,
        },
      },
    },
    timestamp: 2_000,
  };
}

describe("reconcileAuthorityRequirementRuntime", () => {
  it("creates requirement-controlled waiting state only from structured control metadata", () => {
    const result = reconcileAuthorityRequirementRuntime({
      company: createCompany(),
      runtime: createRuntime(),
      controlUpdate: {
        sessionKey: "agent:co-ceo:main",
        message: createControlMessage(),
        timestamp: 2_000,
      },
    });

    expect(result.violations).toEqual([]);
    expect(result.runtime.activeConversationStates[0]?.draftRequirement).toMatchObject({
      summary: "搭建 AI 小说创作系统，并先确定当前启动优先级。",
      stageGateStatus: "waiting_confirmation",
    });
    expect(result.runtime.activeDecisionTickets[0]).toMatchObject({
      sourceType: "requirement",
      decisionType: "requirement_gate",
      status: "pending_human",
    });
    expect(result.runtime.primaryRequirementId).toBeTruthy();
    expect(result.runtime.activeRequirementAggregates[0]).toMatchObject({
      stageGateStatus: "waiting_confirmation",
      lifecyclePhase: "pre_requirement",
    });
  });

  it("does not change requirement state when assistant message has only natural language", () => {
    const runtime = createRuntime();
    runtime.activeConversationStates = [
      {
        companyId: "company-1",
        conversationId: "agent:co-ceo:main",
        currentWorkKey: null,
        currentWorkItemId: null,
        currentRoundId: null,
        draftRequirement: {
          topicKey: "mission:novel-system",
          topicText: "搭建 AI 小说创作系统",
          summary: "现有主线已经收敛。",
          ownerActorId: "co-ceo",
          ownerLabel: "CEO",
          stage: "执行准备中",
          nextAction: "继续推进现有主线。",
          stageGateStatus: "confirmed",
          state: "active_requirement",
          promotionReason: null,
          promotable: true,
          updatedAt: 1_500,
        },
        updatedAt: 1_500,
      },
    ];

    const result = reconcileAuthorityRequirementRuntime({
      company: createCompany(),
      runtime,
      controlUpdate: {
        sessionKey: "agent:co-ceo:main",
        message: {
          role: "assistant",
          text: "请确认后我就继续推进。",
          timestamp: 2_000,
        },
        timestamp: 2_000,
      },
    });

    expect(result.runtime.activeConversationStates[0]?.draftRequirement?.stageGateStatus).toBe(
      "confirmed",
    );
    expect(result.runtime.activeDecisionTickets).toHaveLength(0);
  });

  it("derives confirmed stage gate from a resolved requirement ticket", () => {
    const seeded = reconcileAuthorityRequirementRuntime({
      company: createCompany(),
      runtime: createRuntime(),
      controlUpdate: {
        sessionKey: "agent:co-ceo:main",
        message: createControlMessage(),
        timestamp: 2_000,
      },
    }).runtime;

    seeded.activeDecisionTickets = seeded.activeDecisionTickets.map((ticket) => ({
      ...ticket,
      status: "resolved",
      resolutionOptionId: "launch_all",
      resolution: "全部启动",
      updatedAt: 3_000,
    }));

    const result = reconcileAuthorityRequirementRuntime({
      company: createCompany(),
      runtime: seeded,
    });

    expect(result.runtime.activeDecisionTickets[0]?.status).toBe("resolved");
    expect(result.runtime.activeConversationStates[0]?.draftRequirement?.stageGateStatus).toBe(
      "confirmed",
    );
    expect(result.runtime.activeRequirementAggregates[0]?.stageGateStatus).toBe("confirmed");
  });

  it("preserves authority-owned slices when runtime sync merges compatibility data", () => {
    const currentRuntime = createRuntime();
    currentRuntime.activeRoomRecords = [{ id: "room-authority", companyId: "company-1" } as never];
    currentRuntime.activeMissionRecords = [{ id: "mission-authority", companyId: "company-1" } as never];
    currentRuntime.activeConversationStates = [
      {
        companyId: "company-1",
        conversationId: "conv-authority",
        currentWorkKey: "authority-work",
        currentWorkItemId: "work-authority",
        currentRoundId: null,
        draftRequirement: null,
        updatedAt: 1_800,
      },
    ];
    currentRuntime.activeWorkItems = [{ id: "work-authority", companyId: "company-1" } as never];
    currentRuntime.activeRequirementAggregates = [
      {
        id: "topic:topic-1",
        companyId: "company-1",
        topicKey: "topic-1",
        kind: "strategic",
        primary: true,
        workItemId: "work-1",
        roomId: "room-authority",
        ownerActorId: "co-ceo",
        ownerLabel: "CEO",
        lifecyclePhase: "pre_requirement",
        stageGateStatus: "waiting_confirmation",
        stage: "待确认启动",
        summary: "authority requirement",
        nextAction: "请选择当前要先启动的执行项。",
        memberIds: ["co-ceo"],
        sourceConversationId: "conv-1",
        startedAt: 1_500,
        updatedAt: 1_500,
        revision: 2,
        lastEvidenceAt: 1_500,
        status: "waiting_owner",
        acceptanceStatus: "not_requested",
        acceptanceNote: null,
      } as never,
    ];
    currentRuntime.activeRequirementEvidence = [
      {
        id: "evidence-authority",
        companyId: "company-1",
        aggregateId: "topic:topic-1",
        source: "local-command",
        sessionKey: "conv-1",
        actorId: "co-ceo",
        eventType: "requirement_promoted",
        timestamp: 1_500,
        payload: { source: "authority" },
        applied: true,
      },
    ];
    currentRuntime.primaryRequirementId = "topic:topic-1";
    currentRuntime.activeRoundRecords = [{ id: "round-authority", companyId: "company-1" } as never];
    currentRuntime.activeArtifacts = [{ id: "artifact-authority", companyId: "company-1" } as never];
    currentRuntime.activeDispatches = [{ id: "dispatch-authority", companyId: "company-1" } as never];
    currentRuntime.activeRoomBindings = [
      { roomId: "room-authority", conversationId: "conv-1", companyId: "company-1" } as never,
    ];
    currentRuntime.activeSupportRequests = [{ id: "support-authority", companyId: "company-1" } as never];
    currentRuntime.activeEscalations = [{ id: "escalation-authority", companyId: "company-1" } as never];
    currentRuntime.activeDecisionTickets = [
      {
        id: "decision-authority",
        companyId: "company-1",
        revision: 3,
        sourceType: "requirement",
        sourceId: "aggregate-1",
        escalationId: null,
        aggregateId: "aggregate-1",
        workItemId: "work-1",
        sourceConversationId: "conv-1",
        decisionOwnerActorId: "co-ceo",
        decisionType: "requirement_gate",
        summary: "authority decision",
        options: [],
        requiresHuman: true,
        status: "pending_human",
        resolution: null,
        resolutionOptionId: null,
        roomId: "room-authority",
        createdAt: 1_500,
        updatedAt: 1_500,
      },
    ];
    currentRuntime.activeAgentSessions = [{ sessionKey: "session-authority", companyId: "company-1" } as never];
    currentRuntime.activeAgentRuns = [{ runId: "run-authority", companyId: "company-1" } as never];
    currentRuntime.activeAgentRuntime = [{ agentId: "agent-authority", providerId: "openclaw" } as never];
    currentRuntime.activeAgentStatuses = [
      { agentId: "agent-authority", runtimeState: "busy", reason: "authority" } as never,
    ];

    const incomingRuntime = createRuntime();
    incomingRuntime.activeRoomRecords = [{ id: "room-local", companyId: "company-1" } as never];
    incomingRuntime.activeMissionRecords = [{ id: "mission-local", companyId: "company-1" } as never];
    incomingRuntime.activeConversationStates = [
      {
        companyId: "company-1",
        conversationId: "conv-1",
        currentWorkKey: "draft",
        currentWorkItemId: "work-1",
        currentRoundId: null,
        draftRequirement: null,
        updatedAt: 2_000,
      },
    ];
    incomingRuntime.activeWorkItems = [
      {
        id: "work-1",
        companyId: "company-1",
        roomId: "room-local",
        title: "local work item",
        summary: "compatibility sync",
        status: "active",
        priority: "medium",
        ownerActorId: "co-ceo",
        ownerActorLabel: "CEO",
        artifactIds: [],
        dispatchIds: [],
        blockerIds: [],
        dependentIds: [],
        sourceMissionId: null,
        sourceConversationId: "conv-1",
        sourceActorId: "co-ceo",
        sourceActorLabel: "CEO",
        sourceSessionKey: "conv-1",
        sessionKey: "conv-1",
        topicKey: "topic-1",
        kind: "task",
        createdAt: 2_000,
        updatedAt: 2_000,
        nextAction: "继续推进",
        stageGateStatus: "waiting_confirmation",
      } as never,
    ];
    incomingRuntime.activeRequirementAggregates = [
      {
        id: "aggregate-local",
        companyId: "company-1",
        topicKey: "topic-1",
        kind: "task",
        primary: false,
        workItemId: "work-1",
        roomId: "room-local",
        ownerActorId: "co-ceo",
        ownerLabel: "CEO",
        lifecyclePhase: "pre_requirement",
        stageGateStatus: "waiting_confirmation",
        stage: "待确认启动",
        summary: "compatibility sync",
        nextAction: "继续推进",
        memberIds: ["co-ceo"],
        sourceConversationId: "conv-1",
        startedAt: 2_000,
        updatedAt: 2_000,
        revision: 1,
        lastEvidenceAt: 2_000,
        status: "draft",
        acceptanceStatus: "not_requested",
        acceptanceNote: null,
      } as never,
    ];
    incomingRuntime.activeRequirementEvidence = [
      {
        id: "evidence-local",
        companyId: "company-1",
        aggregateId: "aggregate-local",
        source: "backfill",
        sessionKey: "conv-1",
        actorId: "co-coo",
        eventType: "requirement_seeded",
        timestamp: 2_000,
        payload: { source: "local" },
        applied: false,
      },
    ];
    incomingRuntime.primaryRequirementId = "aggregate-local";
    incomingRuntime.activeArtifacts = [{ id: "artifact-local", companyId: "company-1" } as never];
    incomingRuntime.activeDispatches = [{ id: "dispatch-local", companyId: "company-1" } as never];
    incomingRuntime.activeRoomBindings = [
      { roomId: "room-local", conversationId: "conv-1", companyId: "company-1" } as never,
    ];
    incomingRuntime.activeSupportRequests = [{ id: "support-local", companyId: "company-1" } as never];
    incomingRuntime.activeEscalations = [{ id: "escalation-local", companyId: "company-1" } as never];
    incomingRuntime.activeDecisionTickets = [
      { id: "decision-local", companyId: "company-1", updatedAt: 2_000 } as never,
    ];
    incomingRuntime.activeRoundRecords = [{ id: "round-local", companyId: "company-1" } as never];
    incomingRuntime.activeAgentSessions = [{ sessionKey: "session-local", companyId: "company-1" } as never];
    incomingRuntime.activeAgentRuns = [{ runId: "run-local", companyId: "company-1" } as never];
    incomingRuntime.activeAgentRuntime = [{ agentId: "agent-local", providerId: "openclaw" } as never];
    incomingRuntime.activeAgentStatuses = [{ agentId: "agent-local", runtimeState: "idle" } as never];
    incomingRuntime.updatedAt = 2_000;

    const merged = mergeAuthorityControlledRuntimeSlices({
      currentRuntime,
      incomingRuntime,
    });

    expect(merged.activeRoomRecords[0]).toMatchObject({ id: "room-authority" });
    expect(merged.activeMissionRecords[0]).toMatchObject({ id: "mission-authority" });
    expect(merged.activeConversationStates[0]).toMatchObject({ conversationId: "conv-authority" });
    expect(merged.activeWorkItems[0]).toMatchObject({ id: "work-authority" });
    expect(merged.activeRequirementAggregates[0]).toMatchObject({ id: "topic:topic-1" });
    expect(merged.activeRequirementEvidence[0]).toMatchObject({ id: "evidence-authority" });
    expect(merged.primaryRequirementId).toBe("topic:topic-1");
    expect(merged.activeRoundRecords[0]).toMatchObject({ id: "round-authority" });
    expect(merged.activeArtifacts[0]).toMatchObject({ id: "artifact-authority" });
    expect(merged.activeDispatches[0]).toMatchObject({ id: "dispatch-authority" });
    expect(merged.activeRoomBindings[0]).toMatchObject({ roomId: "room-authority" });
    expect(merged.activeSupportRequests[0]).toMatchObject({ id: "support-authority" });
    expect(merged.activeEscalations[0]).toMatchObject({ id: "escalation-authority" });
    expect(merged.activeDecisionTickets[0]).toMatchObject({ id: "decision-authority" });
    expect(merged.activeAgentSessions?.[0]).toMatchObject({ sessionKey: "session-authority" });
    expect(merged.activeAgentRuns?.[0]).toMatchObject({ runId: "run-authority" });
    expect(merged.activeAgentRuntime?.[0]).toMatchObject({ agentId: "agent-authority" });
    expect(merged.activeAgentStatuses?.[0]).toMatchObject({ agentId: "agent-authority" });

  });
});
