import { beforeEach, describe, expect, it, vi } from "vitest";
import type { ApprovalRecord } from "../../domain/governance/types";
import { fireCompanyEmployee } from "./directory-commands";

const {
  requestAuthorityApproval,
  fireAgent,
  loadConfig,
  toastInfo,
} = vi.hoisted(() => ({
  requestAuthorityApproval: vi.fn(),
  fireAgent: vi.fn(),
  loadConfig: vi.fn(),
  toastInfo: vi.fn(),
}));

vi.mock("../../application/gateway/authority-control", () => ({
  requestAuthorityApproval,
}));

vi.mock("../../application/org/employee-ops", () => ({
  AgentOps: {
    fireAgent,
  },
}));

vi.mock("../../components/system/toast-store", () => ({
  toast: {
    info: toastInfo,
  },
}));

vi.mock("../../infrastructure/company/runtime/selectors", () => ({
  readCompanyRuntimeState: vi.fn(),
}));

describe("fireCompanyEmployee", () => {
  beforeEach(async () => {
    vi.clearAllMocks();
    const { readCompanyRuntimeState } = await import("../../infrastructure/company/runtime/selectors");
    vi.mocked(readCompanyRuntimeState).mockReturnValue({
      activeCompany: {
        id: "company-1",
        name: "Company",
        description: "desc",
        icon: "icon",
        template: "tpl",
        employees: [
          {
            agentId: "agent-1",
            nickname: "Mina",
            role: "Designer",
            isMeta: false,
          },
        ],
        quickPrompts: [],
        createdAt: 1,
        orgSettings: {
          autonomyPolicy: {
            humanApprovalRequiredForLayoffs: true,
          },
        },
      },
      loadConfig,
    } as never);
  });

  it("requests an approval instead of firing immediately when layoffs require approval", async () => {
    const approval: ApprovalRecord = {
      id: "approval-1",
      companyId: "company-1",
      revision: 1,
      scope: "org",
      actionType: "employee_fire",
      status: "pending",
      summary: "审批解雇 Mina",
      detail: "detail",
      requestedByActorId: "operator:local-user",
      requestedByLabel: "当前操作者",
      targetActorId: "agent-1",
      targetLabel: "Mina",
      payload: { agentId: "agent-1" },
      requestedAt: 10,
      createdAt: 10,
      updatedAt: 10,
      resolvedAt: null,
    };
    requestAuthorityApproval.mockResolvedValue({
      bootstrap: {} as never,
      approval,
    });

    const result = await fireCompanyEmployee("agent-1");

    expect(result).toEqual({
      mode: "approval_requested",
      approval,
    });
    expect(requestAuthorityApproval).toHaveBeenCalledWith(
      expect.objectContaining({
        companyId: "company-1",
        actionType: "employee_fire",
        targetActorId: "agent-1",
      }),
    );
    expect(loadConfig).toHaveBeenCalled();
    expect(fireAgent).not.toHaveBeenCalled();
  });

  it("fires immediately when skipApproval is enabled", async () => {
    fireAgent.mockResolvedValue(undefined);

    const result = await fireCompanyEmployee("agent-1", { skipApproval: true });

    expect(result).toEqual({
      mode: "executed",
      approval: null,
    });
    expect(fireAgent).toHaveBeenCalledWith("agent-1");
    expect(requestAuthorityApproval).not.toHaveBeenCalled();
  });
});
