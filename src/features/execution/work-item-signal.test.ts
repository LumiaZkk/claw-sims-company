import { describe, expect, it } from "vitest";
import type { WorkItemRecord } from "../company/types";
import type { RequirementExecutionOverview } from "./requirement-overview";
import {
  isReliableRequirementOverview,
  isReliableWorkItemRecord,
} from "./work-item-signal";

function createStrategicOverview(
  overrides: Partial<RequirementExecutionOverview> = {},
): RequirementExecutionOverview {
  return {
    topicKey: "mission:consistency-platform",
    title: "一致性底座与内部审阅系统执行方案",
    headline: "当前卡点在 CEO",
    summary: "CTO、COO 已回传，等待 CEO 整合最终方案。",
    currentOwnerAgentId: "co-ceo",
    currentOwnerLabel: "CEO",
    currentStage: "CEO 整合团队方案并交付老板",
    nextAction: "让 CEO 输出最终执行方案和优先级。",
    startedAt: 1_000,
    participants: [],
    ...overrides,
  };
}

function createWorkItem(
  overrides: Partial<WorkItemRecord> = {},
): WorkItemRecord {
  return {
    id: "topic:mission:consistency-platform@1000",
    companyId: "novel-studio-001",
    sessionKey: "agent:co-ceo:main",
    topicKey: "mission:consistency-platform",
    sourceActorId: "co-ceo",
    sourceActorLabel: "CEO",
    sourceSessionKey: "agent:co-ceo:main",
    sourceConversationId: "agent:co-ceo:main",
    providerId: null,
    title: "一致性底座与内部审阅系统执行方案",
    goal: "围绕一致性校验和内部审阅系统给出正式执行方案。",
    status: "active",
    stageLabel: "CEO 整合团队方案并交付老板",
    ownerActorId: "co-ceo",
    ownerLabel: "CEO",
    batonActorId: "co-ceo",
    batonLabel: "CEO",
    roomId: "workitem:topic:mission:consistency-platform@1000",
    artifactIds: [],
    dispatchIds: [],
    startedAt: 1_000,
    updatedAt: 2_000,
    completedAt: null,
    summary: "CTO、COO 已回传，等待 CEO 收口。",
    nextAction: "让 CEO 输出最终执行方案和优先级。",
    steps: [],
    ...overrides,
  };
}

describe("work-item signal guards", () => {
  it("rejects chapter overviews whose content is clearly strategic", () => {
    const overview = createStrategicOverview({
      topicKey: "chapter:2",
      title: "重新完成第 2 章",
      currentOwnerAgentId: "co-coo",
      currentOwnerLabel: "COO",
      currentStage: "CEO 立即执行 · 流程治理缺口盘点",
      summary: "两份治理件已交付并入库，等待继续治理收口。",
      nextAction: "优先打开 COO 会话，把这一步补齐。",
    });

    expect(isReliableRequirementOverview(overview)).toBe(false);
  });

  it("rejects chapter work items whose stage and next action are strategic governance work", () => {
    const workItem = createWorkItem({
      topicKey: "chapter:2",
      title: "重新完成第 2 章",
      stageLabel: "CEO 立即执行 · 流程治理缺口盘点",
      ownerActorId: "co-coo",
      ownerLabel: "COO",
      batonActorId: "co-coo",
      batonLabel: "COO",
      summary: "两份治理件已交付并入库，等待继续治理收口。",
      nextAction: "优先打开 COO 会话，把这一步补齐。",
    });

    expect(isReliableWorkItemRecord(workItem)).toBe(false);
  });
});
