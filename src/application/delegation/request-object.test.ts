import { describe, expect, it } from "vitest";
import type { HandoffRecord } from "../../domain";
import { buildRequestRecords } from "./request-object";

function createHandoff(overrides: Partial<HandoffRecord> = {}): HandoffRecord {
  return {
    id: "handoff:dispatch:cto-plan",
    sessionKey: "agent:novel-co-cto:main",
    taskId: "task:cto-plan",
    fromAgentId: "novel-co-ceo",
    toAgentIds: ["novel-co-cto"],
    title: "【任务】规划番茄小说创作的技术支持方案",
    summary: "请 CTO 给出完整技术方案。",
    status: "pending",
    createdAt: 1_000,
    updatedAt: 1_000,
    ...overrides,
  };
}

describe("buildRequestRecords", () => {
  it("normalizes sessions_send fallback replies into answered requests", () => {
    const [request] = buildRequestRecords({
      sessionKey: "agent:novel-co-cto:main",
      handoffs: [createHandoff()],
      messages: [
        { role: "assistant", text: "任务", timestamp: 1_100 },
        { role: "assistant", text: "---", timestamp: 1_200 },
        {
          role: "assistant",
          text: [
            "技术方案已完成并尝试发送给CEO。由于company_report工具遇到配置问题，我通过sessions_send直接发送了完整报告。",
            "",
            "## 番茄小说创作团队技术方案",
            "- 创作工具：AI 大纲与章节编辑器",
            "- 数据监控：收益、曝光和竞品看板",
          ].join("\n"),
          timestamp: 1_300,
        },
      ],
    });

    expect(request).toMatchObject({
      id: "handoff:dispatch:cto-plan:request",
      status: "answered",
      resolution: "complete",
      transport: "sessions_send",
    });
    expect(request.responseDetails).toContain("## 番茄小说创作团队技术方案");
  });

  it("ignores placeholder and bridge messages instead of upgrading them to answered", () => {
    const [request] = buildRequestRecords({
      sessionKey: "agent:novel-co-ceo:main",
      handoffs: [
        createHandoff({
          id: "handoff:dispatch:summary",
          sessionKey: "agent:novel-co-ceo:main",
          fromAgentId: "novel-co-ceo",
          toAgentIds: ["novel-co-hr", "novel-co-cto", "novel-co-coo"],
          title: "番茄小说团队汇总",
          summary: "等待各部门回传方案后收口。",
        }),
      ],
      messages: [
        { role: "assistant", text: "任务", timestamp: 1_100 },
        { role: "assistant", text: "---", timestamp: 1_200 },
        {
          role: "assistant",
          text: "收到！HR 和 COO 已完成汇报，CTO 也通过消息发送了完整方案。让我更新任务看板并为您汇总完整的团队组建方案：",
          timestamp: 1_300,
        },
      ],
    });

    expect(request.status).toBe("pending");
    expect(request.responseSummary).toBeUndefined();
  });
});
