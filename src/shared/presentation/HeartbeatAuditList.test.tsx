import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { HeartbeatAuditList } from "./HeartbeatAuditList";
import type { CompanyHeartbeatAuditEntry } from "../../application/org";

function createEntry(overrides: Partial<CompanyHeartbeatAuditEntry> = {}): CompanyHeartbeatAuditEntry {
  return {
    id: "audit-1",
    createdAt: 12_345,
    trigger: "interval",
    ran: true,
    skipReason: null,
    reasons: ["interval"],
    reasonLabels: ["周期到点"],
    actions: ["已自动升级支持请求", "已刷新决策票"],
    actionCount: 2,
    summary: "本轮巡检完成，并执行了 2 条自治动作。",
    detail: "触发方式：周期巡检",
    ...overrides,
  };
}

describe("HeartbeatAuditList", () => {
  it("renders recent heartbeat audit entries", () => {
    const html = renderToStaticMarkup(<HeartbeatAuditList entries={[createEntry()]} />);

    expect(html).toContain("最近巡检审计");
    expect(html).toContain("本轮巡检完成，并执行了 2 条自治动作。");
    expect(html).toContain("已运行");
    expect(html).toContain("已自动升级支持请求");
    expect(html).toContain("周期到点");
  });

  it("renders skipped entries without action bullets", () => {
    const html = renderToStaticMarkup(
      <HeartbeatAuditList
        entries={[
          createEntry({
            id: "audit-2",
            ran: false,
            skipReason: "heartbeat_not_due",
            reasons: ["interval"],
            reasonLabels: ["周期到点"],
            actions: [],
            actionCount: 0,
            summary: "未到下一轮巡检时间，系统按策略跳过本轮检查。",
            detail: "触发方式：周期巡检 · 跳过原因：heartbeat_not_due",
          }),
        ]}
      />,
    );

    expect(html).toContain("已跳过");
    expect(html).toContain("未到下一轮巡检时间");
    expect(html).toContain("周期到点");
    expect(html).not.toContain("已自动升级支持请求");
  });
});
