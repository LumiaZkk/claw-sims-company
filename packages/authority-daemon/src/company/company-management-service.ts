import { buildDefaultOrgSettings } from "../../../../src/domain/org/autonomy-policy";
import { planHiredEmployeesBatch } from "../../../../src/domain/org/hiring";
import {
  buildDefaultTalentMarketTemplates,
  buildEmployeeTemplateBinding,
  buildHireIntentFromManualInput,
  compileHireDraft,
  matchTalentTemplates,
} from "../../../../src/domain/org/talent-market";
import { parseCompanyBlueprint } from "../../../../src/application/company/blueprint";
import type {
  AgentTemplateDefinition,
  Company,
  CyberCompanyConfig,
  Department,
  EmployeeRef,
  QuickPrompt,
} from "../../../../src/domain/org/types";
import type {
  AuthorityBatchPreviewHireRequest,
  AuthorityBatchPreviewHireResponse,
  AuthorityBatchHireEmployeesResponse,
  AuthorityCompanyRuntimeSnapshot,
  AuthorityCreateCompanyRequest,
  AuthorityHireEmployeeInput,
  AuthorityPreviewHireRequest,
  AuthorityPreviewHireResponse,
  AuthorityHireEmployeeRequest,
  AuthorityHireEmployeeResponse,
} from "../../../../src/infrastructure/authority/contract";
import {
  buildCompanyAgentNamespace,
  normalizeCompanyAgentId,
} from "../../../../src/domain/org/agent-id";
import { buildManagedExecutorFilesForCompany } from "./company-executor-sync";
import { buildCompanyWorkspaceBootstrap } from "./company-workspace-bootstrap";
import {
  buildEmployeeBootstrapFiles,
  normalizeCompany,
} from "../persistence/authority-persistence-shared";

type AuthorityCompanyManagementServiceRepository = {
  loadConfig: () => CyberCompanyConfig | null;
  saveConfig: (config: CyberCompanyConfig) => void;
  loadRuntime: (companyId: string) => AuthorityCompanyRuntimeSnapshot;
  setAgentFile: (agentId: string, name: string, content: string) => void;
  clearManagedExecutorAgent: (agentId: string) => void;
};

type AuthorityCompanyManagementServiceDependencies = {
  repository: AuthorityCompanyManagementServiceRepository;
  runManagedExecutorMutation: <T>(task: () => Promise<T>) => Promise<T>;
  ensureManagedCompanyExecutorProvisioned: (
    company: Company,
    runtime: AuthorityCompanyRuntimeSnapshot,
    reason: string,
  ) => Promise<void>;
  deleteManagedAgentFromExecutor: (agentId: string) => Promise<void>;
};

export type AuthorityHireEmployeesWithProvisioningFallbackResult = {
  payload: AuthorityBatchHireEmployeesResponse;
  provisioningFailure: unknown | null;
};

export type AuthorityHireEmployeeWithProvisioningFallbackResult = {
  payload: AuthorityHireEmployeeResponse;
  provisioningFailure: unknown | null;
};

function resolveDepartmentDefaults(metaRole?: EmployeeRef["metaRole"]) {
  if (metaRole === "ceo") {
    return { kind: "meta" as const, missionPolicy: "manager_delegated" as const };
  }
  if (metaRole === "hr" || metaRole === "cto" || metaRole === "coo") {
    return { kind: "support" as const, missionPolicy: "support_only" as const };
  }
  return { kind: "business" as const, missionPolicy: "direct_execution" as const };
}

function dedupeAgentId(base: string, taken: Set<string>) {
  if (!taken.has(base)) {
    taken.add(base);
    return base;
  }
  for (let index = 2; index < 10_000; index += 1) {
    const candidate = `${base}-${index}`;
    if (!taken.has(candidate)) {
      taken.add(candidate);
      return candidate;
    }
  }
  throw new Error(`无法为 blueprint 生成唯一 agentId：${base}`);
}

function buildCompanyDefinitionFromBlueprint(input: AuthorityCreateCompanyRequest) {
  const blueprint = parseCompanyBlueprint(input.blueprintText ?? "");
  if (!blueprint) {
    throw new Error("蓝图解析失败，请确认 blueprint.v1 JSON 内容完整且可解析。");
  }

  const companyId = crypto.randomUUID();
  const companyName = input.companyName.trim() || blueprint.sourceCompanyName || "新公司";
  const namespace = buildCompanyAgentNamespace(companyName, companyId);

  const agentIdMap = new Map<string, string>();
  const takenAgentIds = new Set<string>();
  const blueprintEmployees = blueprint.employees ?? [];
  const ceoBlueprint = blueprintEmployees.find((employee) => employee.metaRole === "ceo") ?? null;

  for (const employee of blueprintEmployees) {
    const baseId = employee.metaRole
      ? `${namespace}-${employee.metaRole}`
      : normalizeCompanyAgentId(`${namespace}-${employee.role || employee.nickname || "employee"}`);
    agentIdMap.set(employee.blueprintId, dedupeAgentId(baseId, takenAgentIds));
  }

  const departments: Department[] = [];
  const departmentByName = new Map<string, Department>();
  const ensureDepartment = (name: string, leadBlueprintId?: string | null, order?: number, color?: string) => {
    const existing = departmentByName.get(name);
    if (existing) {
      return existing;
    }
    const leadEmployee = leadBlueprintId
      ? blueprintEmployees.find((employee) => employee.blueprintId === leadBlueprintId) ?? null
      : null;
    const leadAgentId =
      (leadBlueprintId && agentIdMap.get(leadBlueprintId)) ??
      (ceoBlueprint ? agentIdMap.get(ceoBlueprint.blueprintId) : null) ??
      agentIdMap.values().next().value ??
      `${namespace}-ceo`;
    const defaults = resolveDepartmentDefaults(leadEmployee?.metaRole);
    const department: Department = {
      id: crypto.randomUUID(),
      name,
      leadAgentId,
      kind: defaults.kind,
      color: color ?? "slate",
      order: order ?? departments.length,
      missionPolicy: defaults.missionPolicy,
    };
    departments.push(department);
    departmentByName.set(name, department);
    return department;
  };

  for (const department of blueprint.departments ?? []) {
    ensureDepartment(department.name, department.leadBlueprintId ?? null, department.order, department.color);
  }

  const employees: EmployeeRef[] = blueprintEmployees.map((employee) => {
    const agentId = agentIdMap.get(employee.blueprintId);
    if (!agentId) {
      throw new Error(`蓝图成员缺少 agentId 映射：${employee.blueprintId}`);
    }
    const departmentName = employee.departmentName?.trim() || "";
    const department = departmentName ? ensureDepartment(departmentName) : null;
    return {
      agentId,
      nickname: employee.nickname,
      role: employee.role,
      isMeta: employee.isMeta,
      metaRole: employee.metaRole,
      reportsTo: employee.reportsToBlueprintId ? agentIdMap.get(employee.reportsToBlueprintId) : undefined,
      departmentId: department?.id ?? undefined,
      ...(employee.templateBinding ? { templateBinding: employee.templateBinding } : {}),
      ...(employee.hireProvenance ? { hireProvenance: employee.hireProvenance } : {}),
      ...(employee.bootstrapBundle ? { bootstrapBundle: employee.bootstrapBundle } : {}),
    };
  });

  const quickPrompts: QuickPrompt[] = (blueprint.quickPrompts ?? [])
    .map((prompt) => {
      const targetAgentId = prompt.targetBlueprintId ? agentIdMap.get(prompt.targetBlueprintId) : null;
      if (!targetAgentId) {
        return null;
      }
      return {
        label: prompt.label,
        icon: prompt.icon,
        prompt: prompt.prompt,
        targetAgentId,
      };
    })
    .filter((prompt): prompt is QuickPrompt => Boolean(prompt));

  const baseCompany: Company = {
    id: companyId,
    name: companyName,
    description: blueprint.description ?? "",
    icon: blueprint.icon ?? "🏢",
    template: blueprint.template || input.templateId || "blank",
    orgSettings: buildDefaultOrgSettings({ autoCalibrate: true }),
    departments,
    employees,
    talentMarket: {
      templates: buildDefaultTalentMarketTemplates(Date.now()),
      updatedAt: Date.now(),
    },
    quickPrompts,
    knowledgeItems: blueprint.knowledgeItems ?? [],
    createdAt: Date.now(),
  };

  const bootstrap = buildCompanyWorkspaceBootstrap(normalizeCompany(baseCompany));
  return {
    company: normalizeCompany(bootstrap.company),
    runtime: bootstrap.runtime,
    agentFiles: buildManagedExecutorFilesForCompany(normalizeCompany(bootstrap.company)),
  };
}

export function buildCompanyDefinition(input: AuthorityCreateCompanyRequest): {
  company: Company;
  runtime: AuthorityCompanyRuntimeSnapshot;
  agentFiles: Array<{ agentId: string; name: string; content: string }>;
} {
  if (input.blueprintText?.trim()) {
    return buildCompanyDefinitionFromBlueprint(input);
  }
  const companyId = crypto.randomUUID();
  const companyName = input.companyName.trim() || "新公司";
  const namespace = buildCompanyAgentNamespace(companyName, companyId);

  const departments: Department[] = [
    {
      id: crypto.randomUUID(),
      name: "管理中枢",
      leadAgentId: `${namespace}-ceo`,
      kind: "meta",
      color: "slate",
      order: 0,
      missionPolicy: "manager_delegated",
    },
    {
      id: crypto.randomUUID(),
      name: "人力资源部",
      leadAgentId: `${namespace}-hr`,
      kind: "support",
      color: "rose",
      order: 1,
      missionPolicy: "support_only",
    },
    {
      id: crypto.randomUUID(),
      name: "技术部",
      leadAgentId: `${namespace}-cto`,
      kind: "support",
      color: "indigo",
      order: 2,
      missionPolicy: "support_only",
    },
    {
      id: crypto.randomUUID(),
      name: "运营部",
      leadAgentId: `${namespace}-coo`,
      kind: "support",
      color: "emerald",
      order: 3,
      missionPolicy: "support_only",
    },
  ];
  const deptByName = new Map(departments.map((department) => [department.name, department.id] as const));
  const employees: EmployeeRef[] = [
    {
      agentId: `${namespace}-ceo`,
      nickname: "CEO",
      role: "Chief Executive Officer",
      isMeta: true,
      metaRole: "ceo",
      departmentId: deptByName.get("管理中枢"),
    },
    {
      agentId: `${namespace}-hr`,
      nickname: "HR",
      role: "Human Resources Director",
      isMeta: true,
      metaRole: "hr",
      reportsTo: `${namespace}-ceo`,
      departmentId: deptByName.get("人力资源部"),
    },
    {
      agentId: `${namespace}-cto`,
      nickname: "CTO",
      role: "Chief Technology Officer",
      isMeta: true,
      metaRole: "cto",
      reportsTo: `${namespace}-ceo`,
      departmentId: deptByName.get("技术部"),
    },
    {
      agentId: `${namespace}-coo`,
      nickname: "COO",
      role: "Chief Operating Officer",
      isMeta: true,
      metaRole: "coo",
      reportsTo: `${namespace}-ceo`,
      departmentId: deptByName.get("运营部"),
    },
  ];

  const quickPrompts: QuickPrompt[] = [];

  const baseCompany: Company = {
    id: companyId,
    name: companyName,
    description: "",
    icon: "🏢",
    template: "blank",
    orgSettings: buildDefaultOrgSettings({ autoCalibrate: true }),
    departments,
    employees,
    talentMarket: {
      templates: buildDefaultTalentMarketTemplates(Date.now()),
      updatedAt: Date.now(),
    },
    quickPrompts,
    knowledgeItems: [],
    createdAt: Date.now(),
  };

  const bootstrap = buildCompanyWorkspaceBootstrap(normalizeCompany(baseCompany));
  return {
    company: normalizeCompany(bootstrap.company),
    runtime: bootstrap.runtime,
    agentFiles: buildManagedExecutorFilesForCompany(normalizeCompany(bootstrap.company)),
  };
}

export function createAuthorityCompanyManagementService(
  deps: AuthorityCompanyManagementServiceDependencies,
) {
  const {
    repository,
    runManagedExecutorMutation,
    ensureManagedCompanyExecutorProvisioned,
    deleteManagedAgentFromExecutor,
  } = deps;

  function buildHirePlan(input: {
    companyId: string;
    hires: AuthorityHireEmployeeInput[];
  }) {
    const currentConfig = repository.loadConfig();
    if (!currentConfig) {
      throw new Error("当前没有可用的公司配置。");
    }

    const currentCompany = currentConfig.companies.find((company) => company.id === input.companyId) ?? null;
    if (!currentCompany) {
      throw new Error(`Unknown company: ${input.companyId}`);
    }

    const normalizedHires = input.hires.map((hire) => {
      const draft = hire.compiledDraft;
      if (!draft) {
        return {
          ...hire,
        };
      }
      return {
        ...hire,
        role: draft.role || hire.role,
        description: draft.description || hire.description,
        nickname: draft.nickname ?? hire.nickname,
        reportsTo: draft.reportsTo ?? hire.reportsTo,
        departmentName: draft.departmentName ?? hire.departmentName,
        modelTier: draft.modelTier ?? hire.modelTier,
        budget: typeof draft.budget === "number" ? draft.budget : hire.budget,
        traits: draft.traits ?? hire.traits,
        templateId: draft.templateId ?? hire.templateId,
        bootstrapBundle: hire.bootstrapBundle ?? draft.bootstrapBundle,
        provenance: hire.provenance ?? draft.provenance,
      };
    });
    const planned = planHiredEmployeesBatch(
      currentCompany,
      normalizedHires.map((hire) => ({
        role: hire.role,
        description: hire.description,
        nickname: hire.nickname,
        reportsTo: hire.reportsTo,
        departmentId: hire.departmentId,
        departmentName: hire.departmentName,
        departmentKind: hire.departmentKind,
        departmentColor: hire.departmentColor,
        makeDepartmentLead: hire.makeDepartmentLead,
        avatarJobId: hire.avatarJobId,
        templateBinding: hire.templateBinding,
        hireProvenance: hire.provenance,
        bootstrapBundle: hire.bootstrapBundle,
      })),
    );
    const nextConfig: CyberCompanyConfig = {
      ...currentConfig,
      companies: currentConfig.companies.map((company) =>
        company.id === input.companyId ? planned.company : company,
      ),
      activeCompanyId:
        currentConfig.activeCompanyId === input.companyId ? input.companyId : currentConfig.activeCompanyId,
    };
    const bootstrapFiles = planned.hires.flatMap((hire) =>
      buildEmployeeBootstrapFiles({
        ...normalizedHires[hire.inputIndex],
        agentId: hire.employee.agentId,
      }),
    );

    return {
      currentConfig,
      planned,
      nextConfig,
      bootstrapFiles,
      runtime: repository.loadRuntime(input.companyId),
      reason: input.hires.length > 1 ? "company.employee.batch_hire" : "company.employee.hire",
    };
  }

  function previewCompanyEmployeeHire(
    input: AuthorityPreviewHireRequest,
  ): AuthorityPreviewHireResponse {
    const currentConfig = repository.loadConfig();
    if (!currentConfig) {
      throw new Error("当前没有可用的公司配置。");
    }

    const currentCompany = currentConfig.companies.find((company) => company.id === input.companyId) ?? null;
    if (!currentCompany) {
      throw new Error(`Unknown company: ${input.companyId}`);
    }

    const templates = currentCompany.talentMarket?.templates ?? buildDefaultTalentMarketTemplates(Date.now());
    const intent = buildHireIntentFromManualInput({
      companyId: input.companyId,
      role: input.role,
      description: input.description,
      departmentName: input.departmentName,
      reportsTo: input.reportsTo,
      modelTier: input.modelTier,
      budget: input.budget,
      traits: input.traits,
    });
    const matches = matchTalentTemplates(intent, templates);
    const warnings: string[] = [];

    let selectionMode: AuthorityPreviewHireResponse["selectionMode"] = "blank";
    let selectedTemplate: AgentTemplateDefinition | null = null;
    let selectedMatch = null;

    if (typeof input.templateId === "string" && input.templateId.trim().length > 0) {
      const explicitTemplateId = input.templateId.trim();
      selectedTemplate = templates.find((template) => template.id === explicitTemplateId) ?? null;
      selectedMatch = matches.find((match) => match.templateId === explicitTemplateId) ?? null;
      selectionMode = "explicit";
      if (!selectedTemplate) {
        warnings.push(`未找到模板 ${explicitTemplateId}，已保留 blank 方案。`);
      }
    } else {
      const topMatch = matches[0] ?? null;
      if (topMatch?.autoAdoptEligible) {
        selectedTemplate = templates.find((template) => template.id === topMatch.templateId) ?? null;
        selectedMatch = topMatch;
        selectionMode = selectedTemplate ? "auto" : "blank";
      }
    }

    const selectedDraft = selectedTemplate
      ? compileHireDraft({
          intent,
          template: selectedTemplate,
          match: selectedMatch,
          roleOverride: input.role,
          descriptionOverride: input.description,
          traitsOverride: input.traits,
          modelTierOverride: input.modelTier,
          budgetOverride: input.budget,
        })
      : null;
    const selectedTemplateBinding = selectedTemplate
      ? buildEmployeeTemplateBinding({
          templateId: selectedTemplate.id,
          sourceType: "template",
          confidence: selectedMatch?.confidence ?? null,
        })
      : null;
    const blankDraft = compileHireDraft({
      intent,
      template: null,
      match: null,
      roleOverride: input.role,
      descriptionOverride: input.description,
      traitsOverride: input.traits,
      modelTierOverride: input.modelTier,
      budgetOverride: input.budget,
    });
    const blankTemplateBinding = buildEmployeeTemplateBinding({
      templateId: null,
      sourceType: "blank",
      confidence: null,
    });

    return {
      companyId: input.companyId,
      intent,
      matches: matches.map((match) => ({
        template: templates.find((template) => template.id === match.templateId)!,
        match,
      })),
      selectionMode,
      selectedTemplateId: selectedTemplate?.id ?? null,
      selectedTemplateBinding,
      selectedDraft,
      blankTemplateBinding,
      blankDraft,
      warnings,
    };
  }

  function previewCompanyEmployeesHire(
    input: AuthorityBatchPreviewHireRequest,
  ): AuthorityBatchPreviewHireResponse {
    const previews = (input.hires ?? []).map((hire, inputIndex) => ({
      inputIndex,
      ...previewCompanyEmployeeHire({
        ...hire,
        companyId: input.companyId,
      }),
    }));

    return {
      companyId: input.companyId,
      previews,
      warnings: previews.flatMap((preview) => preview.warnings),
    };
  }

  async function hireCompanyEmployeesStrongConsistency(input: {
    companyId: string;
    hires: AuthorityHireEmployeeInput[];
  }): Promise<AuthorityBatchHireEmployeesResponse> {
    const { currentConfig, planned, nextConfig, bootstrapFiles, runtime, reason } = buildHirePlan(input);

    await runManagedExecutorMutation(async () => {
      repository.saveConfig(nextConfig);
      try {
        await ensureManagedCompanyExecutorProvisioned(
          planned.company,
          runtime,
          reason,
        );
        for (const bootstrapFile of bootstrapFiles) {
          repository.setAgentFile(bootstrapFile.agentId, bootstrapFile.name, bootstrapFile.content);
        }
      } catch (error) {
        for (const hire of [...planned.hires].reverse()) {
          try {
            await deleteManagedAgentFromExecutor(hire.employee.agentId);
            repository.clearManagedExecutorAgent(hire.employee.agentId);
          } catch {
            // Best-effort rollback for partially provisioned hires.
          }
        }
        repository.saveConfig(currentConfig);
        throw error;
      }
    });

    return {
      company:
        repository.loadConfig()?.companies.find((company) => company.id === input.companyId) ?? planned.company,
      config: repository.loadConfig() ?? nextConfig,
      runtime: repository.loadRuntime(input.companyId),
      warnings: planned.warnings,
      employees: planned.hires
        .toSorted((left, right) => left.inputIndex - right.inputIndex)
        .map((hire) => hire.employee),
    };
  }

  async function hireCompanyEmployeeStrongConsistency(
    input: AuthorityHireEmployeeRequest,
  ): Promise<AuthorityHireEmployeeResponse> {
    const batch = await hireCompanyEmployeesStrongConsistency({
      companyId: input.companyId,
      hires: [input],
    });
    const [employee] = batch.employees;
    if (!employee) {
      throw new Error("招聘结果缺少新员工记录。");
    }
    return {
      ...batch,
      employee,
    };
  }

  async function hireCompanyEmployeesWithProvisioningFallback(input: {
    companyId: string;
    hires: AuthorityHireEmployeeInput[];
  }): Promise<AuthorityHireEmployeesWithProvisioningFallbackResult> {
    const { planned, nextConfig, bootstrapFiles, runtime, reason } = buildHirePlan(input);
    let provisioningFailure: unknown = null;

    await runManagedExecutorMutation(async () => {
      repository.saveConfig(nextConfig);
      for (const bootstrapFile of bootstrapFiles) {
        repository.setAgentFile(bootstrapFile.agentId, bootstrapFile.name, bootstrapFile.content);
      }
      try {
        await ensureManagedCompanyExecutorProvisioned(planned.company, runtime, reason);
      } catch (error) {
        provisioningFailure = error;
      }
    });

    return {
      payload: {
        company:
          repository.loadConfig()?.companies.find((company) => company.id === input.companyId) ?? planned.company,
        config: repository.loadConfig() ?? nextConfig,
        runtime: repository.loadRuntime(input.companyId),
        warnings: planned.warnings,
        employees: planned.hires
          .toSorted((left, right) => left.inputIndex - right.inputIndex)
          .map((hire) => hire.employee),
      },
      provisioningFailure,
    };
  }

  async function hireCompanyEmployeeWithProvisioningFallback(
    input: AuthorityHireEmployeeRequest,
  ): Promise<AuthorityHireEmployeeWithProvisioningFallbackResult> {
    const batch = await hireCompanyEmployeesWithProvisioningFallback({
      companyId: input.companyId,
      hires: [input],
    });
    const [employee] = batch.payload.employees;
    if (!employee) {
      throw new Error("招聘结果缺少新员工记录。");
    }
    return {
      payload: {
        ...batch.payload,
        employee,
      },
      provisioningFailure: batch.provisioningFailure,
    };
  }

  return {
    buildCompanyDefinition,
    previewCompanyEmployeeHire,
    previewCompanyEmployeesHire,
    hireCompanyEmployeesStrongConsistency,
    hireCompanyEmployeeStrongConsistency,
    hireCompanyEmployeesWithProvisioningFallback,
    hireCompanyEmployeeWithProvisioningFallback,
  };
}
