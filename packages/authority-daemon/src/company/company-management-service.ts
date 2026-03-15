import { parseCompanyBlueprint } from "../../../../src/application/company/blueprint";
import { COMPANY_TEMPLATES } from "../../../../src/application/company/templates";
import { buildDefaultOrgSettings } from "../../../../src/domain/org/autonomy-policy";
import { planHiredEmployeesBatch } from "../../../../src/domain/org/hiring";
import type {
  Company,
  CyberCompanyConfig,
  Department,
  EmployeeRef,
  QuickPrompt,
} from "../../../../src/domain/org/types";
import type {
  AuthorityBatchHireEmployeesResponse,
  AuthorityCompanyRuntimeSnapshot,
  AuthorityCreateCompanyRequest,
  AuthorityHireEmployeeInput,
  AuthorityHireEmployeeRequest,
  AuthorityHireEmployeeResponse,
} from "../../../../src/infrastructure/authority/contract";
import { buildManagedExecutorFilesForCompany } from "./company-executor-sync";
import { buildCompanyWorkspaceBootstrap } from "./company-workspace-bootstrap";
import {
  buildEmployeeBootstrapFile,
  normalizeCompany,
  slugify,
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
  syncAgentFileToExecutor: (input: { agentId: string; name: string; content: string }) => Promise<unknown>;
  deleteManagedAgentFromExecutor: (agentId: string) => Promise<void>;
};

export function buildCompanyDefinition(input: AuthorityCreateCompanyRequest): {
  company: Company;
  runtime: AuthorityCompanyRuntimeSnapshot;
  agentFiles: Array<{ agentId: string; name: string; content: string }>;
} {
  const blueprint = input.blueprintText ? parseCompanyBlueprint(input.blueprintText) : null;
  const template =
    COMPANY_TEMPLATES.find((entry) => entry.id === (blueprint?.template ?? input.templateId)) ??
    COMPANY_TEMPLATES.find((entry) => entry.id === "blank") ??
    COMPANY_TEMPLATES[0];
  const companyId = crypto.randomUUID();
  const companyName = input.companyName.trim() || blueprint?.sourceCompanyName || "新公司";
  const namespace = `${slugify(companyName)}-${companyId.slice(0, 6)}`;

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

  const reportsToMap: Record<string, string> = {
    ceo: `${namespace}-ceo`,
    hr: `${namespace}-hr`,
    cto: `${namespace}-cto`,
    coo: `${namespace}-coo`,
  };

  if (blueprint) {
    const blueprintIdMap = new Map<string, string>();
    blueprintIdMap.set("meta:ceo", `${namespace}-ceo`);
    blueprintIdMap.set("meta:hr", `${namespace}-hr`);
    blueprintIdMap.set("meta:cto", `${namespace}-cto`);
    blueprintIdMap.set("meta:coo", `${namespace}-coo`);

    for (const employee of blueprint.employees.filter((entry) => !entry.isMeta)) {
      const agentId = `${namespace}-${slugify(employee.nickname || employee.role)}-${employees.length}`;
      blueprintIdMap.set(employee.blueprintId, agentId);
      employees.push({
        agentId,
        nickname: employee.nickname,
        role: employee.role,
        isMeta: false,
        reportsTo: employee.reportsToBlueprintId
          ? blueprintIdMap.get(employee.reportsToBlueprintId) ?? reportsToMap.ceo
          : reportsToMap.ceo,
        departmentId: employee.departmentName ? deptByName.get(employee.departmentName) : undefined,
      });
    }

    for (const department of blueprint.departments) {
      if (deptByName.has(department.name)) {
        continue;
      }
      const nextDepartment: Department = {
        id: crypto.randomUUID(),
        name: department.name,
        leadAgentId: department.leadBlueprintId
          ? blueprintIdMap.get(department.leadBlueprintId) ?? reportsToMap.coo
          : reportsToMap.coo,
        kind: "business",
        color: department.color,
        order: department.order,
        missionPolicy: "manager_delegated",
      };
      departments.push(nextDepartment);
      deptByName.set(nextDepartment.name, nextDepartment.id);
    }
  } else {
    for (const employee of template?.employees ?? []) {
      const reportsTo = employee.reportsToRole ? reportsToMap[employee.reportsToRole] : reportsToMap.ceo;
      employees.push({
        agentId: `${namespace}-${slugify(employee.nickname || employee.role)}-${employees.length}`,
        nickname: employee.nickname,
        role: employee.role,
        isMeta: false,
        reportsTo,
        departmentId: departments.find((department) => department.leadAgentId === reportsTo)?.id,
      });
    }
  }

  const quickPrompts: QuickPrompt[] = blueprint
    ? blueprint.quickPrompts.map((prompt) => ({
        label: prompt.label,
        icon: prompt.icon,
        prompt: prompt.prompt,
        targetAgentId: employees[0]?.agentId ?? reportsToMap.ceo,
      }))
    : [];

  const baseCompany: Company = {
    id: companyId,
    name: companyName,
    description: blueprint?.description || template?.description || "",
    icon: blueprint?.icon || template?.icon || "🏢",
    template: blueprint?.template || template?.id || "blank",
    orgSettings: buildDefaultOrgSettings({ autoCalibrate: true }),
    departments,
    employees,
    quickPrompts,
    knowledgeItems: blueprint?.knowledgeItems ?? [],
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
    syncAgentFileToExecutor,
    deleteManagedAgentFromExecutor,
  } = deps;

  async function hireCompanyEmployeesStrongConsistency(input: {
    companyId: string;
    hires: AuthorityHireEmployeeInput[];
  }): Promise<AuthorityBatchHireEmployeesResponse> {
    const currentConfig = repository.loadConfig();
    if (!currentConfig) {
      throw new Error("当前没有可用的公司配置。");
    }

    const currentCompany = currentConfig.companies.find((company) => company.id === input.companyId) ?? null;
    if (!currentCompany) {
      throw new Error(`Unknown company: ${input.companyId}`);
    }

    const planned = planHiredEmployeesBatch(currentCompany, input.hires);
    const nextConfig: CyberCompanyConfig = {
      ...currentConfig,
      companies: currentConfig.companies.map((company) =>
        company.id === input.companyId ? planned.company : company,
      ),
      activeCompanyId:
        currentConfig.activeCompanyId === input.companyId ? input.companyId : currentConfig.activeCompanyId,
    };

    await runManagedExecutorMutation(async () => {
      repository.saveConfig(nextConfig);
      try {
        await ensureManagedCompanyExecutorProvisioned(
          planned.company,
          repository.loadRuntime(planned.company.id),
          input.hires.length > 1 ? "company.employee.batch_hire" : "company.employee.hire",
        );
        for (const hire of planned.hires) {
          const bootstrapFile = buildEmployeeBootstrapFile({
            ...input.hires[hire.inputIndex],
            agentId: hire.employee.agentId,
          });
          repository.setAgentFile(bootstrapFile.agentId, bootstrapFile.name, bootstrapFile.content);
          await syncAgentFileToExecutor(bootstrapFile);
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

  return {
    buildCompanyDefinition,
    hireCompanyEmployeesStrongConsistency,
    hireCompanyEmployeeStrongConsistency,
  };
}
