import { describe, expect, it } from "vitest";
import { buildContinuousOpsRuntimeSummary } from "./continuous-ops-runtime";
import type { Company } from "../../domain/org/types";
import type { CompanyHeartbeatSurface } from "../org/company-heartbeat";
import type { AutomationBudgetGuardrail } from "./budget-guardrail";

function createCompany(): Company {
  return {
    id: "company-1",
    name: "Cyber Company",
    description: "continuous ops",
    icon: "building",
    template: "default",
    createdAt: 1,
    quickPrompts: [],
    employees: [],
    approvals: [],
    automationRuns: [],
  };
}

function createHeartbeat(overrides: Partial<CompanyHeartbeatSurface> = {}): CompanyHeartbeatSurface {
  return {
    status: "scheduled",
    title: "CEO 巡检已排队",
    summary: "后台巡检正常运行中。",
    detail: "当前 heartbeat 正常排队中。",
    intervalMinutes: 60,
    enabled: true,
    paused: false,
    sourceOfTruth: "cyber_company",
    syncTarget: "openclaw",
    lastRunAt: 1,
    lastCheckAt: 2,
    nextRunAt: 3,
    lastTrigger: "interval",
    lastSkipReason: "heartbeat_not_due",
    recentActions: [],
    recentAudit: [],
    budgetStatus: "within_budget",
    budgetTitle: "预算正常",
    budgetDetail: "预算正常",
    ...overrides,
  };
}

function createBudget(overrides: Partial<AutomationBudgetGuardrail> = {}): AutomationBudgetGuardrail {
  return {
    status: "within_budget",
    budgetUsd: 100,
    currentUsageCost: 20,
    remainingUsd: 80,
    usageRatio: 0.2,
    windowDays: 30,
    shouldEscalateToApproval: false,
    title: "自动化预算处于安全范围",
    detail: "预算安全。",
    ...overrides,
  };
}

describe("buildContinuousOpsRuntimeSummary", () => {
  it("marks runtime blocked when heartbeat is disabled", () => {
    const summary = buildContinuousOpsRuntimeSummary({
      company: createCompany(),
      heartbeat: createHeartbeat({
        status: "disabled",
        enabled: false,
        title: "CEO 巡检已关闭",
      }),
      budgetGuardrail: createBudget(),
      jobs: [],
    });

    expect(summary.state).toBe("blocked");
    expect(summary.summary).toContain("关闭");
  });

  it("surfaces failed automation runs as watch", () => {
    const summary = buildContinuousOpsRuntimeSummary({
      company: {
        ...createCompany(),
        automationRuns: [
          {
            id: "run-1",
            automationId: "cron-1",
            automationName: "日报",
            agentId: "agent-1",
            status: "failed",
            providerStatus: "failed",
            message: "provider failed",
            scheduleKind: "cron",
            scheduleExpr: "0 * * * *",
            scheduleEveryMs: null,
            runAt: 1,
            nextRunAt: 2,
            createdAt: 1,
            observedAt: 1,
            updatedAt: 1,
          },
        ],
      },
      heartbeat: createHeartbeat(),
      budgetGuardrail: createBudget(),
      jobs: [{ id: "cron-1", name: "日报", enabled: true }],
    });

    expect(summary.state).toBe("watch");
    expect(summary.metrics[1]?.value).toBe("1");
  });
});
