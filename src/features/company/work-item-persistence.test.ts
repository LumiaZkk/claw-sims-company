import { describe, expect, it } from "vitest";
import type { WorkItemRecord } from "./types";
import { sanitizeWorkItemRecords } from "./work-item-persistence";

function createWorkItem(overrides: Partial<WorkItemRecord> = {}): WorkItemRecord {
  return {
    id: "workitem:mission:consistency",
    companyId: "novel-studio-001",
    topicKey: "mission:consistency-platform",
    title: "一致性底座与内部审阅系统执行方案",
    goal: "围绕一致性校验和内部审阅系统给出正式执行方案。",
    status: "active",
    stageLabel: "CEO 整合团队方案并交付老板",
    ownerActorId: "co-ceo",
    ownerLabel: "CEO",
    batonActorId: "co-ceo",
    batonLabel: "CEO",
    artifactIds: [],
    dispatchIds: [],
    startedAt: 1_000,
    updatedAt: 2_000,
    completedAt: null,
    summary: "CTO 与 COO 已回传，等待 CEO 收口输出。",
    nextAction: "让 CEO 输出最终执行方案和优先级。",
    steps: [],
    ...overrides,
  };
}

describe("sanitizeWorkItemRecords", () => {
  it("drops unreliable placeholder work items", () => {
    const records = sanitizeWorkItemRecords([
      createWorkItem({
        id: "bad",
        topicKey: "artifact:growth-plan.md",
        title: "当前需求",
        stageLabel: "{",
        goal: "\"count\": 20,",
        summary: "恢复中",
        nextAction: "恢复中",
      }),
      createWorkItem(),
    ]);

    expect(records).toHaveLength(1);
    expect(records[0]?.id).toBe("workitem:mission:consistency");
  });

  it("dedupes by id and keeps the newest reliable record", () => {
    const older = createWorkItem({ updatedAt: 1_000, summary: "旧总结" });
    const newer = createWorkItem({ updatedAt: 3_000, summary: "新总结" });

    const records = sanitizeWorkItemRecords([older, newer]);
    expect(records).toHaveLength(1);
    expect(records[0]?.summary).toBe("新总结");
  });

  it("derives sourceActorId from legacy session fields so pages do not need to parse session keys", () => {
    const [record] = sanitizeWorkItemRecords([
      createWorkItem({
        sourceActorId: null,
        sourceConversationId: "agent:co-cto:main",
      }),
    ]);

    expect(record?.sourceActorId).toBe("co-cto");
  });
});
