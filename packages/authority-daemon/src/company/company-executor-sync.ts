import path from "node:path";
import { readFileSync } from "node:fs";
import {
  COMPANY_CONTEXT_FILE_NAME,
  CEO_OPERATIONS_FILE_NAME,
  DEPARTMENT_CONTEXT_FILE_NAME,
  DEPARTMENT_OPERATIONS_FILE_NAME,
  buildCeoOperationsGuide,
  buildCompanyContextSnapshot,
  buildDepartmentContextSnapshot,
  buildDepartmentOperationsGuide,
} from "../../../../src/application/company/agent-context";
import {
  COLLABORATION_CONTEXT_FILE_NAME,
  buildCollaborationContextSnapshot,
} from "../../../../src/application/company/collaboration-context";
import {
  generateDepartmentManagerSoul,
  generateCeoSoul,
  generateCooSoul,
  generateCtoSoul,
  generateHrSoul,
  generateIndividualContributorSoul,
} from "../../../../src/domain/meta-agent/souls";
import { isReservedSystemCompany } from "../../../../src/domain/org/system-company";
import type {
  Company,
  CompanySystemMetadata,
  CyberCompanyConfig,
  EmployeeRef,
} from "../../../../src/domain/org/types";
import {
  compileManagedExecutorProjection,
  type ManagedExecutorRuntimeFacts,
} from "./company-executor-projection";

export type ManagedExecutorAgentTarget = {
  agentId: string;
  companyId: string;
  workspace: string;
};

export type ManagedExecutorFile = {
  agentId: string;
  name: string;
  content: string;
};

export type ManagedExecutorTrackedAgent = {
  agentId: string;
  desiredPresent: boolean;
};

export type ManagedExecutorReconcilePlan = {
  deleteAgentIds: string[];
  createTargets: ManagedExecutorAgentTarget[];
};

export type ManagedExecutorWorkspacePluginFile = {
  name: string;
  content: string;
};

export type ManagedExecutorProvisioningResolution = NonNullable<
  CompanySystemMetadata["executorProvisioning"]
>;

export type ManagedCompanyRuntimeSnapshot = ManagedExecutorRuntimeFacts;

const MANAGED_EXECUTOR_WORKSPACE_ROOT = "~/.openclaw/workspaces/cyber-company";
const MANAGED_EXECUTOR_WORKSPACE_PLUGIN_ROOT = ".openclaw/extensions/sims-company";
const MANAGED_EXECUTOR_WORKSPACE_PLUGIN_PATHS = [
  `${MANAGED_EXECUTOR_WORKSPACE_PLUGIN_ROOT}/index.js`,
  `${MANAGED_EXECUTOR_WORKSPACE_PLUGIN_ROOT}/openclaw.plugin.json`,
  `${MANAGED_EXECUTOR_WORKSPACE_PLUGIN_ROOT}/package.json`,
] as const;

function readManagedExecutorWorkspacePluginAsset(relativePath: string) {
  const repoRelativeAsset = new URL(`../../../../${relativePath}`, import.meta.url);
  const cwdRelativeAsset = path.resolve(process.cwd(), relativePath);
  const candidates: Array<string | URL> = [repoRelativeAsset, cwdRelativeAsset];

  for (const candidate of candidates) {
    try {
      return readFileSync(candidate, "utf8");
    } catch {
      continue;
    }
  }

  throw new Error(`Missing managed executor workspace plugin asset: ${relativePath}`);
}

function isSystemMappedEmployee(company: Company, employee: EmployeeRef) {
  return isReservedSystemCompany(company) && company.system?.mappedAgentId === employee.agentId;
}

function buildMetaSoul(company: Company, employee: EmployeeRef): string | null {
  switch (employee.metaRole) {
    case "ceo":
      return generateCeoSoul(company.name);
    case "hr":
      return generateHrSoul(company.name);
    case "cto":
      return generateCtoSoul(company.name);
    case "coo":
      return generateCooSoul(company.name);
    default:
      return managesDepartment(company, employee)
        ? generateDepartmentManagerSoul(
            company.name,
            (company.departments ?? [])
              .filter((department) => !department.archived && department.leadAgentId === employee.agentId)
              .map((department) => department.name)
              .join(" / "),
          )
        : generateIndividualContributorSoul(company.name, employee.role, employee.nickname);
  }
}

function resolveEmployeeSoul(company: Company, employee: EmployeeRef): string | null {
  const canonicalSoul = employee.bootstrapBundle?.soulMd?.trim();
  if (canonicalSoul) {
    return canonicalSoul;
  }
  return buildMetaSoul(company, employee);
}

function managesDepartment(company: Company, employee: EmployeeRef): boolean {
  return (company.departments ?? []).some(
    (department) => !department.archived && department.leadAgentId === employee.agentId,
  );
}

export function buildManagedExecutorWorkspace(params: {
  companyId: string;
  agentId: string;
}) {
  return `${buildManagedExecutorCompanyWorkspace(params.companyId)}/${params.agentId}`;
}

export function buildManagedExecutorWorkspaceRoot() {
  return MANAGED_EXECUTOR_WORKSPACE_ROOT;
}

export function buildManagedExecutorCompanyWorkspace(companyId: string) {
  return `${MANAGED_EXECUTOR_WORKSPACE_ROOT}/${companyId}`;
}

export function listDesiredManagedExecutorAgents(
  config: CyberCompanyConfig | null | undefined,
): ManagedExecutorAgentTarget[] {
  if (!config) {
    return [];
  }

  return config.companies.flatMap((company) =>
    company.employees
      .filter((employee) => !isSystemMappedEmployee(company, employee))
      .map((employee) => ({
        agentId: employee.agentId,
        companyId: company.id,
        workspace: buildManagedExecutorWorkspace({
          companyId: company.id,
          agentId: employee.agentId,
        }),
      })),
  );
}

export function listDesiredManagedExecutorAgentIdsForCompany(company: Company): string[] {
  return company.employees
    .filter((employee) => !isSystemMappedEmployee(company, employee))
    .map((employee) => employee.agentId);
}

export function buildManagedExecutorFilesForCompany(
  company: Company,
  runtime?: ManagedCompanyRuntimeSnapshot,
): ManagedExecutorFile[] {
  const files: ManagedExecutorFile[] = [];

  for (const employee of company.employees) {
    const soul = resolveEmployeeSoul(company, employee);
    if (soul) {
      files.push({
        agentId: employee.agentId,
        name: "SOUL.md",
        content: soul,
      });
    }
    files.push({
      agentId: employee.agentId,
      name: COLLABORATION_CONTEXT_FILE_NAME,
      content: JSON.stringify(
        buildCollaborationContextSnapshot({
          company,
          agentId: employee.agentId,
        }),
        null,
        2,
      ),
    });
  }

  const ceo = company.employees.find((employee) => employee.metaRole === "ceo") ?? null;
  if (ceo) {
    files.push({
      agentId: ceo.agentId,
      name: COMPANY_CONTEXT_FILE_NAME,
      content: JSON.stringify(buildCompanyContextSnapshot(company, runtime), null, 2),
    });
    files.push({
      agentId: ceo.agentId,
      name: CEO_OPERATIONS_FILE_NAME,
      content: buildCeoOperationsGuide(company),
    });
  }

  const managerAgentIds = new Set(
    (company.departments ?? [])
      .filter((department) => !department.archived && department.leadAgentId !== ceo?.agentId)
      .map((department) => department.leadAgentId),
  );
  for (const managerAgentId of managerAgentIds) {
    files.push({
      agentId: managerAgentId,
      name: DEPARTMENT_CONTEXT_FILE_NAME,
      content: JSON.stringify(
        buildDepartmentContextSnapshot({
          company,
          managerAgentId,
          runtime,
        }),
        null,
        2,
      ),
    });
    files.push({
      agentId: managerAgentId,
      name: DEPARTMENT_OPERATIONS_FILE_NAME,
      content: buildDepartmentOperationsGuide({
        company,
        managerAgentId,
        runtime,
      }),
    });
  }

  const deduped = new Map<string, ManagedExecutorFile>();
  for (const file of [...files, ...buildManagedExecutorProjectionFilesForCompany(company, runtime)]) {
    deduped.set(`${file.agentId}:${file.name}`, file);
  }

  return [...deduped.values()];
}

export function buildManagedExecutorProjectionFilesForCompany(
  company: Company,
  runtime?: ManagedCompanyRuntimeSnapshot,
): ManagedExecutorFile[] {
  return company.employees.flatMap((employee) =>
    compileManagedExecutorProjection({
      company,
      employee,
      soul: resolveEmployeeSoul(company, employee),
      runtime,
    }),
  );
}

export function listManagedExecutorWorkspacePluginFiles(): ManagedExecutorWorkspacePluginFile[] {
  return MANAGED_EXECUTOR_WORKSPACE_PLUGIN_PATHS.map((name) => ({
    name,
    content: readManagedExecutorWorkspacePluginAsset(name),
  }));
}

export function buildManagedExecutorFiles(
  config: CyberCompanyConfig | null | undefined,
  runtimeByCompanyId?: ReadonlyMap<string, ManagedCompanyRuntimeSnapshot>,
): ManagedExecutorFile[] {
  if (!config) {
    return [];
  }
  return config.companies.flatMap((company) =>
    buildManagedExecutorFilesForCompany(company, runtimeByCompanyId?.get(company.id)),
  );
}

export function buildManagedExecutorProjectionFiles(
  config: CyberCompanyConfig | null | undefined,
  runtimeByCompanyId?: ReadonlyMap<string, ManagedCompanyRuntimeSnapshot>,
): ManagedExecutorFile[] {
  if (!config) {
    return [];
  }
  return config.companies.flatMap((company) =>
    buildManagedExecutorProjectionFilesForCompany(company, runtimeByCompanyId?.get(company.id)),
  );
}

export function planManagedExecutorReconcile(params: {
  trackedAgents: ReadonlyArray<ManagedExecutorTrackedAgent>;
  desiredTargets: ReadonlyArray<ManagedExecutorAgentTarget>;
  existingAgentIds: ReadonlySet<string>;
}): ManagedExecutorReconcilePlan {
  return {
    deleteAgentIds: params.trackedAgents
      .filter((agent) => !agent.desiredPresent)
      .map((agent) => agent.agentId),
    createTargets: params.desiredTargets.filter(
      (target) => !params.existingAgentIds.has(target.agentId),
    ),
  };
}

export function resolveManagedExecutorProvisioningState(params: {
  company: Company;
  visibleAgentIds: ReadonlySet<string>;
  bridgeState: "ready" | "degraded" | "blocked";
  fileSyncFailedAgentIds?: ReadonlySet<string>;
  updatedAt?: number;
}): ManagedExecutorProvisioningResolution {
  const desiredAgentIds = listDesiredManagedExecutorAgentIdsForCompany(params.company);
  const pendingAgentIds = desiredAgentIds.filter((agentId) => !params.visibleAgentIds.has(agentId));
  const failedSyncAgentIds = desiredAgentIds.filter((agentId) =>
    params.fileSyncFailedAgentIds?.has(agentId),
  );

  if (pendingAgentIds.length === 0 && failedSyncAgentIds.length === 0) {
    return {
      state: "ready",
      pendingAgentIds: [],
      lastError: null,
      updatedAt: params.updatedAt ?? Date.now(),
    };
  }

  const reasonParts: string[] = [];
  if (pendingAgentIds.length > 0) {
    reasonParts.push(`待可见 agent：${pendingAgentIds.join("、")}`);
  }
  if (failedSyncAgentIds.length > 0) {
    reasonParts.push(`待同步文件：${failedSyncAgentIds.join("、")}`);
  }

  return {
    state: params.bridgeState === "ready" ? "degraded" : "blocked",
    pendingAgentIds,
    lastError: reasonParts.join("；"),
    updatedAt: params.updatedAt ?? Date.now(),
  };
}
