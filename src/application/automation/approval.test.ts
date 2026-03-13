import { beforeEach, describe, expect, it, vi } from "vitest";
import type { ApprovalRecord } from "../../domain/governance/types";
import type { Company } from "../../domain/org/types";
import {
  applyApprovedAutomationEnable,
  buildAutomationApprovalInputFromJob,
  requestAutomationEnableApproval,
} from "./approval";

const { requestAuthorityApproval, addCron, updateCron, loadConfig } = vi.hoisted(() => ({
  requestAuthorityApproval: vi.fn(),
  addCron: vi.fn(),
  updateCron: vi.fn(),
  loadConfig: vi.fn(),
}));

vi.mock("../gateway/authority-control", () => ({
  requestAuthorityApproval,
}));

vi.mock("../gateway", () => ({
  gateway: {
    addCron,
    updateCron,
  },
}));

vi.mock("../../infrastructure/company/runtime/selectors", () => ({
  readCompanyRuntimeState: vi.fn(() => ({
    loadConfig,
  })),
}));

function createCompany(overrides?: Partial<Company>): Company {
  return {
    id: "company-1",
    name: "Company",
    description: "desc",
    icon: "icon",
    template: "tpl",
    employees: [
      {
        agentId: "ceo-1",
        nickname: "CEO",
        role: "CEO",
        isMeta: true,
        metaRole: "ceo",
      },
      {
        agentId: "coo-1",
        nickname: "COO",
        role: "COO",
        isMeta: true,
        metaRole: "coo",
      },
    ],
    quickPrompts: [],
    createdAt: 1,
    orgSettings: {
      autonomyPolicy: {
        humanApprovalRequiredForAutomationEnable: true,
      },
    },
    ...overrides,
  };
}

describe("automation approval gate", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("requests approval instead of creating automation immediately when policy requires it", async () => {
    const company = createCompany();
    const approval: ApprovalRecord = {
      id: "approval-4",
      companyId: company.id,
      revision: 1,
      scope: "automation",
      actionType: "automation_enable",
      status: "pending",
      summary: "审批创建自动化 日报汇总",
      detail: "detail",
      targetActorId: "coo-1",
      targetLabel: "日报汇总",
      payload: {},
      requestedAt: 20,
      createdAt: 20,
      updatedAt: 20,
      resolvedAt: null,
    };
    requestAuthorityApproval.mockResolvedValue({
      bootstrap: {} as never,
      approval,
    });

    const result = await requestAutomationEnableApproval({
      company,
      automation: {
        name: "日报汇总",
        agentId: "coo-1",
        schedule: {
          kind: "cron",
          expr: "0 9 * * *",
        },
        message: "请生成今日日报",
      },
    });

    expect(result).toEqual({
      mode: "approval_requested",
      approval,
    });
    expect(requestAuthorityApproval).toHaveBeenCalledWith(
      expect.objectContaining({
        companyId: company.id,
        scope: "automation",
        actionType: "automation_enable",
      }),
    );
    expect(addCron).not.toHaveBeenCalled();
    expect(loadConfig).toHaveBeenCalled();
  });

  it("creates automation immediately when approval is skipped", async () => {
    const company = createCompany();

    const result = await requestAutomationEnableApproval({
      company,
      automation: {
        name: "日报汇总",
        agentId: "coo-1",
        schedule: {
          kind: "every",
          everyMs: 3_600_000,
        },
        message: "请生成今日日报",
      },
      skipApproval: true,
    });

    expect(result).toEqual({
      mode: "executed",
      approval: null,
    });
    expect(addCron).toHaveBeenCalledWith(
      expect.objectContaining({
        name: "日报汇总",
        agentId: "coo-1",
        enabled: true,
      }),
    );
    expect(requestAuthorityApproval).not.toHaveBeenCalled();
  });

  it("enables an existing automation after approval is resolved", async () => {
    const approval: ApprovalRecord = {
      id: "approval-5",
      companyId: "company-1",
      revision: 2,
      scope: "automation",
      actionType: "automation_enable",
      status: "approved",
      summary: "审批启用自动化 晚间巡检",
      detail: "detail",
      targetActorId: "coo-1",
      targetLabel: "晚间巡检",
      payload: {
        mode: "enable",
        jobId: "cron-1",
        job: {
          name: "晚间巡检",
          agentId: "coo-1",
          enabled: true,
          sessionTarget: "main",
          wakeMode: "now",
          schedule: {
            kind: "cron",
            expr: "0 22 * * *",
          },
          payload: {
            kind: "agentTurn",
            message: "请执行晚间巡检",
          },
        },
      },
      requestedAt: 20,
      createdAt: 20,
      updatedAt: 30,
      resolvedAt: 30,
    };

    await applyApprovedAutomationEnable(approval);

    expect(updateCron).toHaveBeenCalledWith("cron-1", { enabled: true });
  });

  it("builds reusable approval input from an existing cron job", () => {
    const input = buildAutomationApprovalInputFromJob({
      id: "cron-2",
      name: "夜间回放",
      agentId: "coo-1",
      enabled: false,
      schedule: {
        kind: "every",
        everyMs: 7_200_000,
      },
      payload: {
        kind: "agentTurn",
        message: "请回放夜间异常",
      },
    });

    expect(input).toEqual({
      name: "夜间回放",
      agentId: "coo-1",
      existingJobId: "cron-2",
      schedule: {
        kind: "every",
        everyMs: 7_200_000,
      },
      message: "请回放夜间异常",
    });
  });
});
