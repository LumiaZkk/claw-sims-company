import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { RequirementHeartbeatCard } from "./RequirementHeartbeatCard";
import type { ContinuousOpsRuntimeSummary } from "../../../application/automation/continuous-ops-runtime";
import type { CompanyHeartbeatSurface } from "../../../application/org";

function createHeartbeat(overrides: Partial<CompanyHeartbeatSurface> = {}): CompanyHeartbeatSurface {
  return {
    status: "scheduled",
    title: "CEO 巡检已排队",
    summary: "后台巡检正常运行中，会在下一轮周期到点后继续检查。",
    detail: "当前 heartbeat 正常排队中，未到下一轮巡检时间。",
    intervalMinutes: 5,
    enabled: true,
    paused: false,
    sourceOfTruth: "cyber_company",
    syncTarget: "openclaw",
    lastRunAt: 10_000,
    lastCheckAt: 11_000,
    nextRunAt: 310_000,
    lastTrigger: "interval",
    lastSkipReason: "heartbeat_not_due",
    recentActions: ["已自动升级支持请求"],
    recentAudit: [],
    budgetStatus: "within_budget",
    budgetTitle: "预算健康",
    budgetDetail: "当前预算护栏处于健康状态。",
    ...overrides,
  };
}

function createOpsRuntime(
  overrides: Partial<ContinuousOpsRuntimeSummary> = {},
): ContinuousOpsRuntimeSummary {
  return {
    state: "healthy",
    badgeLabel: "运行稳定",
    title: "持续运行基线当前稳定",
    summary: "heartbeat、自动化台账、预算护栏和审批链路当前都处于可继续运行的状态。",
    detail: "当前没有新的持续运行阻塞。",
    metrics: [
      { label: "启用班次", value: "1" },
      { label: "失败台账", value: "0" },
      { label: "自动化审批", value: "0" },
      { label: "Heartbeat", value: "运行中" },
    ],
    lanes: [
      {
        id: "heartbeat",
        label: "Heartbeat",
        state: "healthy",
        summary: "Heartbeat 正常",
        detail: "当前 heartbeat 正常排队中。",
        href: "/settings",
      },
      {
        id: "automation",
        label: "自动化台账",
        state: "healthy",
        summary: "当前有 1 条自动化班次处于启用状态。",
        detail: "最近台账没有失败。",
        href: "/automation",
      },
      {
        id: "guardrail",
        label: "预算护栏",
        state: "healthy",
        summary: "预算正常",
        detail: "预算正常。",
        href: "/automation",
      },
      {
        id: "approvals",
        label: "自动化审批",
        state: "healthy",
        summary: "没有待处理审批。",
        detail: "无需处理自动化审批。",
        href: "/ops",
      },
    ],
    ...overrides,
  };
}

describe("RequirementHeartbeatCard", () => {
  it("renders the single-source-of-truth heartbeat summary", () => {
    const html = renderToStaticMarkup(
      <RequirementHeartbeatCard
        heartbeat={createHeartbeat({
          recentAudit: [
            {
              id: "audit-1",
              createdAt: 12_345,
              trigger: "event",
              ran: true,
              skipReason: null,
              reasons: ["room.append"],
              reasonLabels: ["需求房新增回报"],
              actions: ["已自动升级支持请求"],
              actionCount: 1,
              summary: "事件续推完成，并执行了 1 条自治动作。",
              detail: "触发方式：事件续推 · 原因：需求房新增回报",
            },
          ],
        })}
        opsRuntime={createOpsRuntime()}
        onOpenSettings={() => undefined}
      />,
    );

    expect(html).toContain("CEO 巡检");
    expect(html).toContain("权威源");
    expect(html).toContain("cyber_company");
    expect(html).toContain("已自动升级支持请求");
    expect(html).toContain("最近巡检审计");
    expect(html).toContain("需求房新增回报");
    expect(html).toContain("持续运行基线");
  });

  it("shows paused state explicitly", () => {
    const html = renderToStaticMarkup(
      <RequirementHeartbeatCard
        heartbeat={createHeartbeat({
          status: "paused",
          title: "CEO 巡检已暂停",
          enabled: true,
          paused: true,
          syncTarget: "none",
          recentActions: [],
        })}
        opsRuntime={createOpsRuntime()}
        onOpenSettings={() => undefined}
      />,
    );

    expect(html).toContain("CEO 巡检已暂停");
    expect(html).toContain("暂停中");
    expect(html).toContain("同步目标");
    expect(html).toContain("none");
  });
});
