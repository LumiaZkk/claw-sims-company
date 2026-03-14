import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { TakeoverCasePanel } from "./TakeoverCasePanel";
import type { TakeoverCaseSummary } from "../../application/delegation/takeover-case";

function createSummary(
  overrides: Partial<TakeoverCaseSummary> = {},
): TakeoverCaseSummary {
  return {
    totalCount: 1,
    title: "人工接管警报",
    description: "当前有 1 条执行链路需要人工介入。",
    actionLabel: "查看接管项",
    primaryCase: {
      id: "takeover:session-coo",
      title: "COO 发布链路接管",
      ownerAgentId: "coo",
      ownerLabel: "COO",
      assigneeAgentId: "ceo",
      assigneeLabel: "CEO",
      sourceSessionKey: "session-coo",
      sourceWorkItemId: "work-1",
      sourceTopicKey: "topic:launch",
      sourceDispatchId: "dispatch-1",
      sourceRoomId: "room-1",
      failureSummary: "发布页面持续失败。",
      recommendedNextAction: "由 CEO 手工继续发布并回填结果。",
      route: "/chat/coo?cid=company-1",
      detectedAt: 10_000,
      updatedAt: 12_000,
      status: "assigned",
      auditTrail: [],
    },
    cases: [],
    ...overrides,
  };
}

describe("TakeoverCasePanel", () => {
  it("renders the shared takeover workflow summary and actions", () => {
    const summary = createSummary();
    const html = renderToStaticMarkup(
      <TakeoverCasePanel
        summary={{ ...summary, cases: [summary.primaryCase!] }}
        onOpenCase={() => undefined}
        onAcknowledgeCase={() => undefined}
        onAssignCase={() => undefined}
        onStartCase={() => undefined}
        onResolveCase={() => undefined}
        onArchiveCase={() => undefined}
      />,
    );

    expect(html).toContain("人工接管闭环");
    expect(html).toContain("COO 发布链路接管");
    expect(html).toContain("当前负责人：COO");
    expect(html).toContain("接管人：CEO");
    expect(html).toContain("开始处理");
    expect(html).toContain("回填人工结论并恢复");
  });

  it("shows redispatch and resolution evidence when a case is resolved", () => {
    const summary = createSummary({
      primaryCase: {
        ...createSummary().primaryCase!,
        status: "resolved",
        auditTrail: [
          {
            id: "resolved-1",
            action: "resolved",
            actorId: "operator:alice",
            actorLabel: "Alice",
            status: "resolved",
            timestamp: 12_300,
            note: "已人工补齐发布素材，可以继续推进。",
            assigneeAgentId: "ceo",
            assigneeLabel: "CEO",
          },
          {
            id: "redispatch-1",
            action: "redispatched",
            actorId: "operator:alice",
            actorLabel: "Alice",
            status: "resolved",
            timestamp: 12_500,
            note: "请从提测步骤继续。",
            assigneeAgentId: "coo",
            assigneeLabel: "COO",
            dispatchId: "dispatch:takeover:1",
          },
        ],
      },
      cases: [],
    });
    const html = renderToStaticMarkup(
      <TakeoverCasePanel
        summary={{ ...summary, cases: [summary.primaryCase!] }}
        onOpenCase={() => undefined}
        onResolveCase={() => undefined}
        onRedispatchCase={() => undefined}
        onArchiveCase={() => undefined}
      />,
    );

    expect(html).toContain("最近人工结论");
    expect(html).toContain("已人工补齐发布素材，可以继续推进。");
    expect(html).toContain("最近重新派发");
    expect(html).toContain("重新派发给 COO");
  });

  it("renders the empty state when there is no primary case", () => {
    const html = renderToStaticMarkup(
      <TakeoverCasePanel
        summary={createSummary({ totalCount: 0, primaryCase: null, cases: [] })}
        onOpenCase={() => undefined}
      />,
    );

    expect(html).toContain("人工接管闭环");
    expect(html).toContain("当前没有需要人工接管的链路");
  });
});
