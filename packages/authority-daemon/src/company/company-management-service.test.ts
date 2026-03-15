import { describe, expect, it, vi } from "vitest";
import { buildCompanyDefinition, createAuthorityCompanyManagementService } from "./company-management-service";
import type { Company, CyberCompanyConfig } from "../../../../src/domain/org/types";
import type { AuthorityCompanyRuntimeSnapshot } from "../../../../src/infrastructure/authority/contract";
import { buildCompanyBlueprint } from "../../../../src/application/company/blueprint";

function createCompany(): Company {
  return {
    id: "company-1",
    name: "测试公司",
    description: "",
    icon: "🏢",
    template: "blank",
    createdAt: 1,
    quickPrompts: [],
    departments: [
      {
        id: "dept-ceo",
        name: "管理中枢",
        leadAgentId: "company-1-ceo",
        kind: "meta",
        color: "slate",
        order: 0,
        missionPolicy: "manager_delegated",
      },
    ],
    employees: [
      {
        agentId: "company-1-ceo",
        nickname: "CEO",
        role: "Chief Executive Officer",
        isMeta: true,
        metaRole: "ceo",
      },
    ],
  };
}

function createRuntime(companyId: string): AuthorityCompanyRuntimeSnapshot {
  return {
    companyId,
    activeRoomRecords: [],
    activeMissionRecords: [],
    activeConversationStates: [],
    activeWorkItems: [],
    activeRequirementAggregates: [],
    activeRequirementEvidence: [],
    primaryRequirementId: null,
    activeRoundRecords: [],
    activeArtifacts: [],
    activeDispatches: [],
    activeRoomBindings: [],
    activeSupportRequests: [],
    activeEscalations: [],
    activeDecisionTickets: [],
    activeAgentSessions: [],
    activeAgentRuns: [],
    activeAgentRuntime: [],
    activeAgentStatuses: [],
    activeAgentStatusHealth: null,
    updatedAt: 1,
  };
}

function createConfig(company: Company): CyberCompanyConfig {
  return {
    version: 1,
    companies: [company],
    activeCompanyId: company.id,
    preferences: { theme: "classic", locale: "zh-CN" },
  };
}

describe("createAuthorityCompanyManagementService", () => {
  it("builds company definition from blueprint text", () => {
    const sourceCompany: Company = {
      id: "source-company",
      name: "蓝图来源",
      description: "blueprint source",
      icon: "🏢",
      template: "blank",
      createdAt: 1,
      quickPrompts: [],
      departments: [
        {
          id: "dept-ops",
          name: "运营部",
          leadAgentId: "source-ops",
          kind: "support",
          color: "emerald",
          order: 1,
          missionPolicy: "support_only",
        },
      ],
      employees: [
        {
          agentId: "source-ceo",
          nickname: "CEO",
          role: "Chief Executive Officer",
          isMeta: true,
          metaRole: "ceo",
        },
        {
          agentId: "source-ops",
          nickname: "Ops",
          role: "Ops Coordinator",
          isMeta: false,
          reportsTo: "source-ceo",
          departmentId: "dept-ops",
          templateBinding: {
            templateId: "template-ops",
            sourceType: "template",
            compiledAt: 1,
            compilerVersion: "tm-compiler@1",
            confidence: 0.8,
          },
          hireProvenance: {
            templateId: "template-ops",
            sourceType: "template",
            reasons: ["role match"],
          },
          bootstrapBundle: {
            roleMd: "# Ops Coordinator",
          },
        },
      ],
    };

    const blueprint = buildCompanyBlueprint({ company: sourceCompany, jobs: [] });
    const definition = buildCompanyDefinition({
      companyName: "蓝图复制公司",
      templateId: "blank",
      blueprintText: JSON.stringify(blueprint),
    });

    expect(definition.company.name).toBe("蓝图复制公司");
    expect(definition.company.employees.length).toBeGreaterThan(1);
    expect(definition.company.employees.some((employee) => employee.templateBinding?.templateId === "template-ops"))
      .toBe(true);
  });

  it("keeps the hire in authority when executor provisioning degrades", async () => {
    const currentCompany = createCompany();
    let currentConfig = createConfig(currentCompany);
    const runtime = createRuntime(currentCompany.id);
    const repository = {
      loadConfig: vi.fn(() => currentConfig),
      saveConfig: vi.fn((config: CyberCompanyConfig) => {
        currentConfig = config;
      }),
      loadRuntime: vi.fn(() => runtime),
      setAgentFile: vi.fn(),
      clearManagedExecutorAgent: vi.fn(),
    };
    const service = createAuthorityCompanyManagementService({
      repository,
      runManagedExecutorMutation: async <T,>(task: () => Promise<T>) => task(),
      ensureManagedCompanyExecutorProvisioned: vi.fn(async () => {
        throw new Error("executor offline");
      }),
      deleteManagedAgentFromExecutor: vi.fn(async () => undefined),
    });

    const result = await service.hireCompanyEmployeeWithProvisioningFallback({
      companyId: currentCompany.id,
      role: "Writer",
      description: "Draft release notes",
    });

    expect(result.provisioningFailure).toBeInstanceOf(Error);
    expect(currentConfig.companies[0]?.employees).toHaveLength(2);
    expect(repository.setAgentFile).toHaveBeenCalledWith(
      expect.stringContaining("company-1-writer"),
      "ROLE.md",
      expect.stringContaining("Draft release notes"),
    );
    expect(result.payload.employee.role).toBe("Writer");
  });

  it("keeps ROLE.md authority-only when provisioning succeeds", async () => {
    const currentCompany = createCompany();
    let currentConfig = createConfig(currentCompany);
    const runtime = createRuntime(currentCompany.id);
    const repository = {
      loadConfig: vi.fn(() => currentConfig),
      saveConfig: vi.fn((config: CyberCompanyConfig) => {
        currentConfig = config;
      }),
      loadRuntime: vi.fn(() => runtime),
      setAgentFile: vi.fn(),
      clearManagedExecutorAgent: vi.fn(),
    };
    const service = createAuthorityCompanyManagementService({
      repository,
      runManagedExecutorMutation: async <T,>(task: () => Promise<T>) => task(),
      ensureManagedCompanyExecutorProvisioned: vi.fn(async () => undefined),
      deleteManagedAgentFromExecutor: vi.fn(async () => undefined),
    });

    const result = await service.hireCompanyEmployeeWithProvisioningFallback({
      companyId: currentCompany.id,
      role: "Writer",
      description: "Draft release notes",
    });

    expect(result.provisioningFailure).toBeNull();
    expect(repository.setAgentFile).toHaveBeenCalledWith(
      expect.stringContaining("company-1-writer"),
      "ROLE.md",
      expect.stringContaining("Draft release notes"),
    );
  });

  it("applies compiled draft data and stores template provenance", async () => {
    const currentCompany = createCompany();
    let currentConfig = createConfig(currentCompany);
    const runtime = createRuntime(currentCompany.id);
    const repository = {
      loadConfig: vi.fn(() => currentConfig),
      saveConfig: vi.fn((config: CyberCompanyConfig) => {
        currentConfig = config;
      }),
      loadRuntime: vi.fn(() => runtime),
      setAgentFile: vi.fn(),
      clearManagedExecutorAgent: vi.fn(),
    };
    const service = createAuthorityCompanyManagementService({
      repository,
      runManagedExecutorMutation: async <T,>(task: () => Promise<T>) => task(),
      ensureManagedCompanyExecutorProvisioned: vi.fn(async () => undefined),
      deleteManagedAgentFromExecutor: vi.fn(async () => undefined),
    });

    const compiledDraft = {
      companyId: currentCompany.id,
      templateId: "template-ops",
      sourceType: "template",
      role: "Ops Coordinator",
      description: "Handle ops coordination",
      nickname: "Ops",
      reportsTo: null,
      departmentName: null,
      modelTier: "reasoning" as const,
      budget: 9,
      traits: "clear",
      bootstrapBundle: {
        roleMd: "# Ops Coordinator",
        soulMd: "负责运营协调。",
        onboardingMd: "先读 SOP。",
      },
      provenance: {
        templateId: "template-ops",
        sourceType: "template",
        reasons: ["role match"],
      },
    };

    const result = await service.hireCompanyEmployeeWithProvisioningFallback({
      companyId: currentCompany.id,
      role: "Writer",
      description: "Draft release notes",
      compiledDraft,
      templateBinding: {
        templateId: "template-ops",
        sourceType: "template",
        compiledAt: 1,
        compilerVersion: "tm-compiler@1",
        confidence: 0.8,
      },
    });

    expect(result.payload.employee.role).toBe("Ops Coordinator");
    expect(result.payload.employee.hireProvenance?.templateId).toBe("template-ops");
    expect(result.payload.employee.bootstrapBundle?.soulMd).toBe("负责运营协调。");
  });

  it("previews talent-market matches and blank fallback before hire", () => {
    const currentCompany: Company = {
      ...createCompany(),
      talentMarket: {
        templates: [
          {
            id: "tm-template-writer",
            title: "Writer",
            summary: "Own product copy",
            roleFamily: "writer",
            tags: ["writing"],
            domainTags: ["content"],
            collaborationTags: ["briefing"],
            baseSoul: "负责内容交付。",
            defaultTraits: "清晰、稳定",
            recommendedModelTier: "reasoning",
            defaultBudgetUsd: 7,
            recommendedSkills: ["copywriting"],
            sourceType: "internal",
            sourceRef: "test",
            qualityScore: 0.8,
            validationScore: 0.8,
            adoptionCount: 0,
            status: "ready",
            updatedAt: 1,
          },
        ],
        updatedAt: 1,
      },
    };
    const repository = {
      loadConfig: vi.fn(() => createConfig(currentCompany)),
      saveConfig: vi.fn(),
      loadRuntime: vi.fn(() => createRuntime(currentCompany.id)),
      setAgentFile: vi.fn(),
      clearManagedExecutorAgent: vi.fn(),
    };
    const service = createAuthorityCompanyManagementService({
      repository,
      runManagedExecutorMutation: async <T,>(task: () => Promise<T>) => task(),
      ensureManagedCompanyExecutorProvisioned: vi.fn(async () => undefined),
      deleteManagedAgentFromExecutor: vi.fn(async () => undefined),
    });

    const preview = service.previewCompanyEmployeeHire({
      companyId: currentCompany.id,
      role: "Writer",
      description: "Own product copy",
    });

    expect(preview.matches[0]?.template.id).toBe("tm-template-writer");
    expect(preview.selectionMode).toBe("auto");
    expect(preview.selectedTemplateId).toBe("tm-template-writer");
    expect(preview.selectedDraft?.templateId).toBe("tm-template-writer");
    expect(preview.blankDraft.sourceType).toBe("blank");
  });

  it("previews multiple hires in one batch", () => {
    const currentCompany: Company = {
      ...createCompany(),
      talentMarket: {
        templates: [
          {
            id: "tm-template-writer",
            title: "Writer",
            summary: "Own product copy",
            roleFamily: "writer",
            tags: ["writing"],
            domainTags: ["content"],
            collaborationTags: ["briefing"],
            baseSoul: "负责内容交付。",
            defaultTraits: "清晰、稳定",
            recommendedModelTier: "reasoning",
            defaultBudgetUsd: 7,
            recommendedSkills: ["copywriting"],
            sourceType: "internal",
            sourceRef: "test",
            qualityScore: 0.8,
            validationScore: 0.8,
            adoptionCount: 0,
            status: "ready",
            updatedAt: 1,
          },
        ],
        updatedAt: 1,
      },
    };
    const repository = {
      loadConfig: vi.fn(() => createConfig(currentCompany)),
      saveConfig: vi.fn(),
      loadRuntime: vi.fn(() => createRuntime(currentCompany.id)),
      setAgentFile: vi.fn(),
      clearManagedExecutorAgent: vi.fn(),
    };
    const service = createAuthorityCompanyManagementService({
      repository,
      runManagedExecutorMutation: async <T,>(task: () => Promise<T>) => task(),
      ensureManagedCompanyExecutorProvisioned: vi.fn(async () => undefined),
      deleteManagedAgentFromExecutor: vi.fn(async () => undefined),
    });

    const preview = service.previewCompanyEmployeesHire({
      companyId: currentCompany.id,
      hires: [
        {
          companyId: currentCompany.id,
          role: "Writer",
          description: "Own product copy",
        },
        {
          companyId: currentCompany.id,
          role: "Analyst",
          description: "Research competition",
        },
      ],
    });

    expect(preview.previews).toHaveLength(2);
    expect(preview.previews[0]).toMatchObject({
      inputIndex: 0,
      selectionMode: "auto",
      selectedTemplateId: "tm-template-writer",
    });
    expect(preview.previews[1]).toMatchObject({
      inputIndex: 1,
      selectionMode: "blank",
      selectedTemplateId: null,
    });
    expect(preview.warnings).toEqual([]);
  });
});
