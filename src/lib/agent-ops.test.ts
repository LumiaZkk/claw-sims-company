import { beforeEach, describe, expect, it, vi } from "vitest";
import type {
  CompiledHireDraft,
  Company,
  EmployeeRef,
  EmployeeTemplateBinding,
  HireBootstrapBundle,
  HireProvenance,
} from "../domain/org/types";

const {
  hireAuthorityEmployeeMock,
  updateCompanyMock,
  toastInfoMock,
  toastSuccessMock,
  toastErrorMock,
} = vi.hoisted(() => ({
  hireAuthorityEmployeeMock: vi.fn(),
  updateCompanyMock: vi.fn(),
  toastInfoMock: vi.fn(),
  toastSuccessMock: vi.fn(),
  toastErrorMock: vi.fn(),
}));

vi.mock("../application/gateway", () => ({
  gateway: {
    isConnected: true,
    request: vi.fn(),
  },
  sendTurnToCompanyActor: vi.fn(),
  resolveCompanyActorConversation: vi.fn(),
  useGatewayStore: {
    getState: () => ({
      hello: { features: { methods: [] } },
      manifest: null,
    }),
  },
}));

vi.mock("../application/gateway/authority-control", () => ({
  hireAuthorityEmployee: hireAuthorityEmployeeMock,
}));

vi.mock("../infrastructure/company/runtime/selectors", () => ({
  readCompanyRuntimeState: () => ({
    activeCompany: null,
  }),
}));

vi.mock("../infrastructure/company/runtime/commands", () => ({
  readCompanyRuntimeCommands: () => ({
    updateCompany: updateCompanyMock,
  }),
}));

vi.mock("../system/toast-store", () => ({
  toast: {
    info: toastInfoMock,
    success: toastSuccessMock,
    error: toastErrorMock,
  },
}));

vi.mock("./utils", () => ({
  resolveLocalServiceOrigin: () => "http://127.0.0.1:7890",
}));

import { AgentOps } from "./agent-ops";

function createCompany(): Company {
  return {
    id: "company-1",
    name: "Acme",
    description: "Test company",
    icon: "🏢",
    template: "blank",
    employees: [],
    quickPrompts: [],
    createdAt: 1,
  };
}

describe("AgentOps.hireEmployee", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    updateCompanyMock.mockResolvedValue(undefined);
  });

  it("forwards template-backed hire payload and syncs runtime company state", async () => {
    const bootstrapBundle: HireBootstrapBundle = {
      roleMd: "# ROLE\nGrowth Strategist",
      soulMd: "负责增长战略。",
      onboardingMd: "完成增长实验盘点。",
      recommendedSkills: ["growth_planning"],
    };
    const provenance: HireProvenance = {
      templateId: "template-growth-strategist",
      sourceType: "template",
      reasons: ["角色描述与模板标题匹配"],
    };
    const compiledDraft: CompiledHireDraft = {
      companyId: "company-1",
      templateId: "template-growth-strategist",
      sourceType: "template",
      role: "Growth Strategist",
      description: "负责增长实验与渠道评估",
      nickname: null,
      reportsTo: null,
      departmentName: null,
      modelTier: "reasoning",
      budget: 12,
      traits: "数据驱动",
      bootstrapBundle,
      provenance,
    };
    const templateBinding: EmployeeTemplateBinding = {
      templateId: "template-growth-strategist",
      sourceType: "template",
      compiledAt: 1,
      compilerVersion: "tm-compiler@1",
      confidence: 0.88,
    };
    const employee: EmployeeRef = {
      agentId: "agent-growth-1",
      nickname: "Growth Strategist",
      role: "Growth Strategist",
      isMeta: false,
      templateBinding,
      hireProvenance: provenance,
      bootstrapBundle,
    };
    const company = createCompany();
    const nextCompany = {
      ...company,
      employees: [employee],
      departments: [],
      system: {
        executorProvisioning: {
          state: "degraded" as const,
          pendingAgentIds: ["agent-growth-1"],
          updatedAt: 10,
        },
      },
    };

    hireAuthorityEmployeeMock.mockResolvedValue({
      company: nextCompany,
      employee,
      warnings: ["executor still syncing ROLE.md"],
    });

    const result = await AgentOps.hireEmployee(company, {
      role: "Growth Strategist",
      description: "负责增长实验与渠道评估",
      modelTier: "reasoning",
      traits: "数据驱动",
      budget: 12,
      templateId: "template-growth-strategist",
      compiledDraft,
      bootstrapBundle,
      provenance,
      templateBinding,
    });

    expect(hireAuthorityEmployeeMock).toHaveBeenCalledWith({
      companyId: "company-1",
      role: "Growth Strategist",
      description: "负责增长实验与渠道评估",
      modelTier: "reasoning",
      traits: "数据驱动",
      budget: 12,
      avatarJobId: undefined,
      templateId: "template-growth-strategist",
      compiledDraft,
      bootstrapBundle,
      provenance,
      templateBinding,
    });
    expect(updateCompanyMock).toHaveBeenCalledWith({
      employees: nextCompany.employees,
      departments: nextCompany.departments,
      system: nextCompany.system,
    });
    expect(toastInfoMock).toHaveBeenCalledWith("组织校准", "executor still syncing ROLE.md");
    expect(toastSuccessMock).toHaveBeenCalledWith(
      "系统节点激活",
      "新员工「Growth Strategist」已入职并写入公司 roster",
    );
    expect(result).toEqual({
      agentId: "agent-growth-1",
      company: nextCompany,
    });
    expect(toastErrorMock).not.toHaveBeenCalled();
  });
});
