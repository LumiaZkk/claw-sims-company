import { StrongCompanyDeleteError, deleteCompanyStrongConsistency } from "./company-delete";
import type { Company, CyberCompanyConfig } from "../../../../src/domain/org/types";
import type {
  AuthorityBatchHireEmployeesRequest,
  AuthorityBatchHireEmployeesResponse,
  AuthorityBootstrapSnapshot,
  AuthorityCompanyRuntimeSnapshot,
  AuthorityCreateCompanyRequest,
  AuthorityCreateCompanyResponse,
  AuthorityEvent,
  AuthorityExecutorStatus,
  AuthorityHireEmployeeInput,
  AuthorityHireEmployeeRequest,
  AuthorityHireEmployeeResponse,
  AuthorityRetryCompanyProvisioningResponse,
  AuthoritySwitchCompanyRequest,
} from "../../../../src/infrastructure/authority/contract";
import type { AuthorityRouteResult } from "../system/authority-route-result";

type AuthorityCompanyManagementBroadcastType = "bootstrap.updated" | "company.updated";

export type AuthorityCompanyManagementCommandResult = AuthorityRouteResult;

type AuthorityCompanyManagementRepository = {
  saveConfig: (config: CyberCompanyConfig) => void;
  loadConfig: () => CyberCompanyConfig | null;
  saveRuntime: (runtime: AuthorityCompanyRuntimeSnapshot) => void;
  loadRuntime: (companyId: string) => AuthorityCompanyRuntimeSnapshot;
  switchCompany: (companyId: string) => void;
  deleteCompany: (companyId: string) => void;
  clearManagedExecutorAgentsForCompany: (companyId: string) => void;
  hasCompany: (companyId: string) => boolean;
};

type AuthorityCompanyManagementCommandDependencies = {
  repository: AuthorityCompanyManagementRepository;
  buildCompanyDefinition: (input: AuthorityCreateCompanyRequest) => {
    company: Company;
    runtime: AuthorityCompanyRuntimeSnapshot;
  };
  runManagedExecutorMutation: <T>(task: () => Promise<T>) => Promise<T>;
  ensureManagedCompanyExecutorProvisionedBestEffort: (
    company: Company,
    runtime: AuthorityCompanyRuntimeSnapshot,
    reason: string,
  ) => Promise<void>;
  ensureManagedCompanyExecutorProvisioned: (
    company: Company,
    runtime: AuthorityCompanyRuntimeSnapshot,
    reason: string,
  ) => Promise<void>;
  updateCompanyExecutorProvisioning: (input: {
    companyId: string;
    state: "ready" | "degraded" | "blocked";
    pendingAgentIds?: string[];
    lastError?: string | null;
    activeCompanyId?: string | null;
    updatedAt?: number;
  }) => Company | null;
  listManagedProvisioningAgentIds: (company: Company) => string[];
  resolveProvisioningFailureState: () => "degraded" | "blocked";
  stringifyError: (error: unknown) => string;
  hireCompanyEmployeeStrongConsistency: (
    input: AuthorityHireEmployeeRequest,
  ) => Promise<AuthorityHireEmployeeResponse>;
  hireCompanyEmployeesStrongConsistency: (input: {
    companyId: string;
    hires: AuthorityHireEmployeeInput[];
  }) => Promise<AuthorityBatchHireEmployeesResponse>;
  buildBootstrapSnapshot: () => AuthorityBootstrapSnapshot;
  getExecutorState: () => AuthorityExecutorStatus["state"];
  deleteManagedAgentFromExecutor: (agentId: string) => Promise<void>;
  listExecutorAgentIds: () => Promise<Set<string>>;
  cleanupCompanyWorkspace: (companyId: string) => Promise<string>;
  now?: () => number;
  logWarn?: (message: string, error: unknown) => void;
};

function buildEvent(
  type: AuthorityCompanyManagementBroadcastType,
  timestamp: number,
  companyId?: string,
): AuthorityEvent {
  return companyId ? { type, companyId, timestamp } : { type, timestamp };
}

function buildEvents(
  types: AuthorityCompanyManagementBroadcastType[],
  timestamp: number,
  companyId?: string,
) {
  return types.map((type) => buildEvent(type, timestamp, companyId));
}

export function createAuthorityCompanyManagementCommands(
  deps: AuthorityCompanyManagementCommandDependencies,
) {
  const now = deps.now ?? Date.now;

  return {
    async saveConfig(
      config: CyberCompanyConfig,
    ): Promise<AuthorityCompanyManagementCommandResult> {
      deps.repository.saveConfig(config);
      return {
        status: 200,
        payload: deps.buildBootstrapSnapshot(),
        postCommit: {
          schedule: { reason: "config.save" },
          managedExecutorSyncReason: "config.save",
          broadcasts: buildEvents(["bootstrap.updated"], now()),
        },
      };
    },

    async createCompany(
      body: AuthorityCreateCompanyRequest,
    ): Promise<AuthorityCompanyManagementCommandResult> {
      const { company, runtime: seededRuntime } = deps.buildCompanyDefinition(body);
      const existingConfig = deps.repository.loadConfig();
      const nextConfig: CyberCompanyConfig = existingConfig
        ? {
            ...existingConfig,
            companies: [...existingConfig.companies, company],
            activeCompanyId: company.id,
          }
        : {
            version: 1,
            companies: [company],
            activeCompanyId: company.id,
            preferences: { theme: "classic", locale: "zh-CN" },
          };

      let provisioningFailure: unknown = null;
      let provisionedCompany: Company | null = null;

      await deps.runManagedExecutorMutation(async () => {
        deps.repository.saveConfig(nextConfig);
        deps.repository.saveRuntime(seededRuntime);
        try {
          await deps.ensureManagedCompanyExecutorProvisionedBestEffort(
            company,
            deps.repository.loadRuntime(company.id),
            "company.create",
          );
          provisionedCompany = deps.updateCompanyExecutorProvisioning({
            companyId: company.id,
            state: "ready",
            pendingAgentIds: [],
            lastError: null,
            activeCompanyId: company.id,
          });
        } catch (error) {
          provisioningFailure = error;
          provisionedCompany = deps.updateCompanyExecutorProvisioning({
            companyId: company.id,
            state: deps.resolveProvisioningFailureState(),
            pendingAgentIds: deps.listManagedProvisioningAgentIds(company),
            lastError: deps.stringifyError(error),
            activeCompanyId: company.id,
          });
          deps.logWarn?.(
            `Managed OpenClaw provisioning for ${company.id} degraded during company create.`,
            error,
          );
        }
      });

      const payload: AuthorityCreateCompanyResponse = {
        company:
          provisionedCompany
          ?? deps.repository.loadConfig()?.companies.find((item) => item.id === company.id)
          ?? company,
        config: deps.repository.loadConfig() ?? nextConfig,
        runtime: deps.repository.loadRuntime(company.id),
        warnings: provisioningFailure ? [`执行器仍在补齐：${deps.stringifyError(provisioningFailure)}`] : [],
      };

      return {
        status: 200,
        payload,
        postCommit: {
          schedule: { reason: "company.create", companyId: company.id },
          managedExecutorSyncReason:
            provisioningFailure ? "company.create.degraded" : "company.create",
          broadcasts: buildEvents(["bootstrap.updated", "company.updated"], now(), company.id),
        },
      };
    },

    async retryCompanyProvisioning(
      companyId: string,
    ): Promise<AuthorityCompanyManagementCommandResult> {
      const company =
        deps.repository.loadConfig()?.companies.find((item) => item.id === companyId) ?? null;
      if (!company) {
        return {
          status: 404,
          payload: { error: `Unknown company: ${companyId}` },
        };
      }

      const runtime = deps.repository.loadRuntime(companyId);
      let provisioningFailure: unknown = null;
      let nextCompany: Company | null = null;

      await deps.runManagedExecutorMutation(async () => {
        try {
          await deps.ensureManagedCompanyExecutorProvisioned(
            company,
            runtime,
            "company.provisioning.retry",
          );
          nextCompany = deps.updateCompanyExecutorProvisioning({
            companyId,
            state: "ready",
            pendingAgentIds: [],
            lastError: null,
          });
        } catch (error) {
          provisioningFailure = error;
          nextCompany = deps.updateCompanyExecutorProvisioning({
            companyId,
            state: deps.resolveProvisioningFailureState(),
            pendingAgentIds: deps.listManagedProvisioningAgentIds(company),
            lastError: deps.stringifyError(error),
          });
        }
      });

      const payload: AuthorityRetryCompanyProvisioningResponse = {
        company:
          nextCompany
          ?? deps.repository.loadConfig()?.companies.find((item) => item.id === companyId)
          ?? company,
        config: deps.repository.loadConfig()!,
        runtime: deps.repository.loadRuntime(companyId),
        warnings: provisioningFailure ? [`执行器仍在补齐：${deps.stringifyError(provisioningFailure)}`] : [],
      };

      return {
        status: 200,
        payload,
        postCommit: {
          managedExecutorSyncReason:
            provisioningFailure
              ? "company.provisioning.retry.degraded"
              : "company.provisioning.retry",
          broadcasts: buildEvents(["bootstrap.updated", "company.updated"], now(), companyId),
        },
      };
    },

    async hireEmployee(input: {
      companyId: string;
      body: AuthorityHireEmployeeRequest;
    }): Promise<AuthorityCompanyManagementCommandResult> {
      const payload = await deps.hireCompanyEmployeeStrongConsistency({
        ...input.body,
        companyId: input.companyId,
      });
      return {
        status: 200,
        payload,
        postCommit: {
          schedule: { reason: "company.employee.hire", companyId: input.companyId },
          broadcasts: buildEvents(["bootstrap.updated", "company.updated"], now(), input.companyId),
        },
      };
    },

    async batchHireEmployees(input: {
      companyId: string;
      body: AuthorityBatchHireEmployeesRequest;
    }): Promise<AuthorityCompanyManagementCommandResult> {
      const payload = await deps.hireCompanyEmployeesStrongConsistency({
        companyId: input.companyId,
        hires: Array.isArray(input.body.hires) ? input.body.hires : [],
      });
      return {
        status: 200,
        payload,
        postCommit: {
          schedule: { reason: "company.employee.batch_hire", companyId: input.companyId },
          broadcasts: buildEvents(["bootstrap.updated", "company.updated"], now(), input.companyId),
        },
      };
    },

    async deleteCompany(companyId: string): Promise<AuthorityCompanyManagementCommandResult> {
      let payload: AuthorityBootstrapSnapshot;
      try {
        payload = await deps.runManagedExecutorMutation(() =>
          deleteCompanyStrongConsistency({
            companyId,
            currentConfig: deps.repository.loadConfig(),
            executorState: deps.getExecutorState(),
            loadRuntime: (targetCompanyId) => deps.repository.loadRuntime(targetCompanyId),
            deleteManagedAgentFromExecutor: deps.deleteManagedAgentFromExecutor,
            listExecutorAgentIds: deps.listExecutorAgentIds,
            ensureManagedCompanyExecutorProvisioned: deps.ensureManagedCompanyExecutorProvisioned,
            deleteCompanyLocally: (targetCompanyId) => deps.repository.deleteCompany(targetCompanyId),
            clearManagedExecutorAgentsForCompany: (targetCompanyId) =>
              deps.repository.clearManagedExecutorAgentsForCompany(targetCompanyId),
            restoreLocalCompany: (config, runtime) => {
              deps.repository.saveConfig(config);
              deps.repository.saveRuntime(runtime);
            },
            hasCompany: (targetCompanyId) => deps.repository.hasCompany(targetCompanyId),
            cleanupCompanyWorkspace: deps.cleanupCompanyWorkspace,
            buildResult: deps.buildBootstrapSnapshot,
            logWarn: deps.logWarn,
          }),
        );
      } catch (error) {
        if (error instanceof StrongCompanyDeleteError) {
          return {
            status: error.status,
            payload: { error: error.message },
          };
        }
        throw error;
      }

      return {
        status: 200,
        payload,
        postCommit: {
          schedule: { reason: "company.delete" },
          broadcasts: buildEvents(["bootstrap.updated"], now(), companyId),
        },
      };
    },

    async switchCompany(
      body: AuthoritySwitchCompanyRequest,
    ): Promise<AuthorityCompanyManagementCommandResult> {
      deps.repository.switchCompany(body.companyId);
      return {
        status: 200,
        payload: deps.buildBootstrapSnapshot(),
        postCommit: {
          schedule: { reason: "company.switch", companyId: body.companyId },
          broadcasts: buildEvents(["bootstrap.updated"], now(), body.companyId),
        },
      };
    },
  };
}
