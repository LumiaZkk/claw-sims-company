import { beforeEach, describe, expect, it, vi } from "vitest";
import type { ApprovalRecord } from "../../domain/governance/types";
import type { Company, Department } from "../../domain/org/types";
import {
  applyApprovedDirectoryDepartmentChange,
  saveDirectoryDepartments,
} from "./page-commands";

const { requestAuthorityApproval, loadConfig } = vi.hoisted(() => ({
  requestAuthorityApproval: vi.fn(),
  loadConfig: vi.fn(),
}));

vi.mock("../gateway/authority-control", () => ({
  requestAuthorityApproval,
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
    departments: [
      {
        id: "dep-ceo",
        name: "管理中枢",
        leadAgentId: "ceo-1",
        kind: "meta",
        color: "slate",
        order: 0,
        missionPolicy: "manager_delegated",
        archived: false,
      },
    ],
    employees: [
      {
        agentId: "ceo-1",
        nickname: "CEO",
        role: "CEO",
        isMeta: true,
        metaRole: "ceo",
        departmentId: "dep-ceo",
      },
      {
        agentId: "agent-1",
        nickname: "Ava",
        role: "Operator",
        isMeta: false,
      },
    ],
    quickPrompts: [],
    createdAt: 1,
    orgSettings: {
      autonomyPolicy: {
        humanApprovalRequiredForDepartmentCreateRemove: true,
      },
    },
    ...overrides,
  };
}

describe("department change approval gate", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("requests an approval instead of saving immediately when department create/remove needs review", async () => {
    const company = createCompany();
    const nextDepartments: Department[] = [
      ...(company.departments ?? []),
      {
        id: "dep-ops",
        name: "增长运营部",
        leadAgentId: "agent-1",
        kind: "business",
        color: "emerald",
        order: 10,
        missionPolicy: "direct_execution",
        archived: false,
      },
    ];
    const approval: ApprovalRecord = {
      id: "approval-2",
      companyId: company.id,
      revision: 1,
      scope: "org",
      actionType: "department_change",
      status: "pending",
      summary: "审批新增 1 个部门",
      detail: "detail",
      payload: {
        departments: nextDepartments,
      },
      requestedAt: 20,
      createdAt: 20,
      updatedAt: 20,
      resolvedAt: null,
    };
    requestAuthorityApproval.mockResolvedValue({
      bootstrap: {} as never,
      approval,
    });
    const updateCompany = vi.fn();

    const result = await saveDirectoryDepartments({
      company,
      nextDepartments,
      updateCompany,
    });

    expect(result.mode).toBe("approval_requested");
    expect(result.approval).toEqual(approval);
    expect(requestAuthorityApproval).toHaveBeenCalledWith(
      expect.objectContaining({
        companyId: company.id,
        scope: "org",
        actionType: "department_change",
        summary: "审批新增 1 个部门",
      }),
    );
    expect(updateCompany).not.toHaveBeenCalled();
    expect(loadConfig).toHaveBeenCalled();
  });

  it("saves directly when the change is only a department edit", async () => {
    const company = createCompany();
    const nextDepartments: Department[] = [
      {
        ...(company.departments ?? [])[0],
        name: "管理中枢（新版）",
      },
    ];
    const updateCompany = vi.fn();

    const result = await saveDirectoryDepartments({
      company,
      nextDepartments,
      updateCompany,
    });

    expect(result.mode).toBe("executed");
    expect(requestAuthorityApproval).not.toHaveBeenCalled();
    expect(updateCompany).toHaveBeenCalledWith(
      expect.objectContaining({
        departments: expect.arrayContaining([
          expect.objectContaining({
            id: "dep-ceo",
            name: "管理中枢（新版）",
          }),
        ]),
      }),
    );
  });

  it("applies approved department changes without re-requesting approval", async () => {
    const company = createCompany();
    const approval: ApprovalRecord = {
      id: "approval-3",
      companyId: company.id,
      revision: 2,
      scope: "org",
      actionType: "department_change",
      status: "approved",
      summary: "审批新增 1 个部门",
      detail: "detail",
      payload: {
        departments: [
          ...(company.departments ?? []),
          {
            id: "dep-ops",
            name: "增长运营部",
            leadAgentId: "agent-1",
            kind: "business",
            color: "emerald",
            order: 10,
            missionPolicy: "direct_execution",
            archived: false,
          },
        ],
      },
      requestedAt: 20,
      createdAt: 20,
      updatedAt: 30,
      resolvedAt: 30,
    };
    const updateCompany = vi.fn();

    const normalized = await applyApprovedDirectoryDepartmentChange({
      company,
      approval,
      updateCompany,
    });

    expect(requestAuthorityApproval).not.toHaveBeenCalled();
    expect(updateCompany).toHaveBeenCalledWith(
      expect.objectContaining({
        departments: expect.arrayContaining([
          expect.objectContaining({
            id: "dep-ops",
            name: "增长运营部",
          }),
        ]),
      }),
    );
    expect(normalized.departments.some((department) => department.id === "dep-ops")).toBe(true);
  });
});
