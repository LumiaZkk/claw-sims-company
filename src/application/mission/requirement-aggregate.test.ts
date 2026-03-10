import { describe, expect, it } from "vitest";
import {
  applyRequirementEvidenceToAggregates,
  buildAggregateBackedRequirementOverview,
  reconcileRequirementAggregateState,
} from "./requirement-aggregate";
import type { Company, RequirementAggregateRecord, RequirementEvidenceEvent, WorkItemRecord } from "../../domain";
import type { RequirementRoomRecord } from "../../domain/delegation/types";

function createCompany(): Company {
  return {
    id: "company-1",
    name: "测试公司",
    description: "test",
    icon: "C",
    template: "novel",
    employees: [
      { agentId: "co-ceo", nickname: "CEO", role: "Chief Executive Officer", isMeta: true, metaRole: "ceo" },
      { agentId: "co-cto", nickname: "CTO", role: "Chief Technology Officer", isMeta: true, metaRole: "cto" },
      { agentId: "co-coo", nickname: "COO", role: "Chief Operating Officer", isMeta: true, metaRole: "coo" },
    ],
    quickPrompts: [],
    createdAt: 1,
  };
}

function createWorkItem(overrides: Partial<WorkItemRecord> = {}): WorkItemRecord {
  return {
    id: "topic:mission:alpha",
    workKey: "topic:mission:alpha",
    kind: "strategic",
    roundId: "topic:mission:alpha",
    companyId: "company-1",
    sessionKey: "agent:co-ceo:main",
    topicKey: "mission:alpha",
    sourceActorId: "co-ceo",
    sourceActorLabel: "CEO",
    sourceSessionKey: "agent:co-ceo:main",
    sourceConversationId: "agent:co-ceo:main",
    providerId: null,
    title: "一致性底座",
    goal: "建设一致性底座",
    headline: "一致性底座",
    displayStage: "CTO 制定方案",
    displaySummary: "主线正在推进一致性底座。",
    displayOwnerLabel: "CEO",
    displayNextAction: "跟进 CTO 方案输出。",
    status: "active",
    stageLabel: "CTO 制定方案",
    ownerActorId: "co-ceo",
    ownerLabel: "CEO",
    batonActorId: "co-cto",
    batonLabel: "CTO",
    roomId: "workitem:topic:mission:alpha",
    artifactIds: [],
    dispatchIds: [],
    startedAt: 1_000,
    updatedAt: 2_000,
    completedAt: null,
    summary: "主线正在推进一致性底座。",
    nextAction: "跟进 CTO 方案输出。",
    steps: [
      {
        id: "step-cto",
        title: "CTO 输出技术方案",
        assigneeActorId: "co-cto",
        assigneeLabel: "CTO",
        status: "active",
        completionCriteria: "提交技术方案",
        detail: "正在起草方案。",
        updatedAt: 2_000,
      },
    ],
    ...overrides,
  };
}

function createRoom(overrides: Partial<RequirementRoomRecord> = {}): RequirementRoomRecord {
  return {
    id: "workitem:topic:mission:alpha",
    companyId: "company-1",
    workItemId: "topic:mission:alpha",
    sessionKey: "room:workitem:topic:mission:alpha",
    title: "一致性底座需求房",
    topicKey: "mission:alpha",
    memberIds: ["co-ceo", "co-cto"],
    memberActorIds: ["co-ceo", "co-cto"],
    ownerAgentId: "co-ceo",
    ownerActorId: "co-ceo",
    status: "active",
    headline: "一致性底座需求房",
    progress: "等待 CTO 输出方案",
    transcript: [],
    createdAt: 1_000,
    updatedAt: 2_000,
    ...overrides,
  };
}

describe("requirement aggregate", () => {
  it("keeps a single stable primary aggregate across newer unrelated work items", () => {
    const primaryWorkItem = createWorkItem();
    const result = reconcileRequirementAggregateState({
      companyId: "company-1",
      existingAggregates: [],
      primaryRequirementId: null,
      activeConversationStates: [
        {
          companyId: "company-1",
          conversationId: "agent:co-ceo:main",
          currentWorkKey: primaryWorkItem.workKey,
          currentWorkItemId: primaryWorkItem.id,
          currentRoundId: primaryWorkItem.roundId,
          updatedAt: 2_000,
        },
      ],
      activeWorkItems: [primaryWorkItem],
      activeRoomRecords: [createRoom()],
      activeRequirementEvidence: [],
    });

    const unrelatedWorkItem = createWorkItem({
      id: "topic:mission:beta",
      workKey: "topic:mission:beta",
      roundId: "topic:mission:beta",
      topicKey: "mission:beta",
      title: "发布链路重构",
      updatedAt: 9_000,
      startedAt: 8_000,
    });
    const next = reconcileRequirementAggregateState({
      companyId: "company-1",
      existingAggregates: result.activeRequirementAggregates,
      primaryRequirementId: result.primaryRequirementId,
      activeConversationStates: [
        {
          companyId: "company-1",
          conversationId: "agent:co-ceo:main",
          currentWorkKey: primaryWorkItem.workKey,
          currentWorkItemId: primaryWorkItem.id,
          currentRoundId: primaryWorkItem.roundId,
          updatedAt: 2_000,
        },
      ],
      activeWorkItems: [primaryWorkItem, unrelatedWorkItem],
      activeRoomRecords: [createRoom()],
      activeRequirementEvidence: [],
    });

    expect(result.primaryRequirementId).toBe(primaryWorkItem.id);
    expect(next.primaryRequirementId).toBe(primaryWorkItem.id);
    expect(next.activeRequirementAggregates.filter((aggregate) => aggregate.primary)).toHaveLength(1);
  });

  it("applies matching evidence without changing the primary aggregate", () => {
    const company = createCompany();
    const aggregate: RequirementAggregateRecord = {
      id: "topic:mission:alpha",
      companyId: "company-1",
      topicKey: "mission:alpha",
      kind: "strategic",
      primary: true,
      workItemId: "topic:mission:alpha",
      roomId: "workitem:topic:mission:alpha",
      ownerActorId: "co-ceo",
      ownerLabel: "CEO",
      stage: "CTO 制定方案",
      summary: "主线正在推进一致性底座。",
      nextAction: "跟进 CTO 方案输出。",
      memberIds: ["co-ceo", "co-cto"],
      sourceConversationId: "agent:co-ceo:main",
      startedAt: 1_000,
      updatedAt: 2_000,
      revision: 1,
      lastEvidenceAt: null,
      status: "active",
      acceptanceStatus: "not_requested",
    };
    const evidence: RequirementEvidenceEvent = {
      id: "evt-1",
      companyId: "company-1",
      aggregateId: "topic:mission:alpha",
      source: "company-event",
      sessionKey: "agent:co-cto:main",
      actorId: "co-cto",
      eventType: "requirement_progressed",
      timestamp: 3_000,
      payload: {
        workItemId: "topic:mission:alpha",
        ownerActorId: "co-cto",
        stage: "CTO 输出技术方案",
        summary: "CTO 已提交第一版技术方案。",
      },
      applied: false,
    };

    const result = applyRequirementEvidenceToAggregates({
      company,
      activeRequirementAggregates: [aggregate],
      activeRoomRecords: [createRoom()],
      primaryRequirementId: aggregate.id,
      event: evidence,
    });

    expect(result.applied).toBe(true);
    expect(result.aggregateId).toBe(aggregate.id);
    expect(result.activeRequirementAggregates[0]?.ownerActorId).toBe("co-cto");
    expect(result.activeRequirementAggregates[0]?.primary).toBe(true);
  });

  it("keeps an aggregate-backed overview when raw overview drifts to another topic", () => {
    const company = createCompany();
    const workItem = createWorkItem();
    const aggregate: RequirementAggregateRecord = {
      id: workItem.id,
      companyId: "company-1",
      topicKey: "mission:alpha",
      kind: "strategic",
      primary: true,
      workItemId: workItem.id,
      roomId: workItem.roomId ?? null,
      ownerActorId: "co-ceo",
      ownerLabel: "CEO",
      stage: "CTO 制定方案",
      summary: "主线正在推进一致性底座。",
      nextAction: "跟进 CTO 方案输出。",
      memberIds: ["co-ceo", "co-cto"],
      sourceConversationId: "agent:co-ceo:main",
      startedAt: 1_000,
      updatedAt: 2_000,
      revision: 1,
      lastEvidenceAt: null,
      status: "active",
      acceptanceStatus: "not_requested",
    };

    const overview = buildAggregateBackedRequirementOverview({
      company,
      aggregate,
      workItem,
      room: createRoom(),
      rawOverview: {
        topicKey: "mission:beta",
        title: "错误主线",
        startedAt: 5_000,
        headline: "错误主线",
        summary: "这条 overview 不应抢主线。",
        currentOwnerAgentId: "co-coo",
        currentOwnerLabel: "COO",
        currentStage: "错误阶段",
        nextAction: "错误 next",
        participants: [],
      },
    });

    expect(overview?.topicKey).toBe("mission:alpha");
    expect(overview?.currentOwnerAgentId).toBe("co-ceo");
    expect(overview?.title).toBe("一致性底座");
    expect(overview?.participants.length).toBeGreaterThan(0);
  });
});
