import { describe, expect, it, vi } from "vitest";
import { createAuthorityCompanyManagementCommands } from "./company-management-commands";
import type { Company, CyberCompanyConfig } from "../../../../src/domain/org/types";
import type {
  AuthorityBootstrapSnapshot,
  AuthorityCompanyRuntimeSnapshot,
  AuthorityExecutorStatus,
  AuthorityHireEmployeeInput,
  AuthorityHireEmployeeResponse,
} from "../../../../src/infrastructure/authority/contract";

function createCompany(id = "company-1"): Company {
  return {
    id,
    name: `Company ${id}`,
    description: "",
    icon: "🏢",
    template: "blank",
    employees: [],
    quickPrompts: [],
    createdAt: 1,
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

function createRuntime(companyId: string) {
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
    activeAgentStatusHealth: {
      source: "authority",
      coverage: "authority_partial",
      coveredAgentCount: 0,
      expectedAgentCount: 0,
      missingAgentIds: [],
      isComplete: false,
      generatedAt: 1,
      note: "test",
    },
    updatedAt: 1,
  } as AuthorityCompanyRuntimeSnapshot;
}

function createBootstrapSnapshot(config: CyberCompanyConfig) {
  return {
    config,
    activeCompany: config.companies[0] ?? null,
    runtime: createRuntime(config.activeCompanyId),
    executor: {
      adapter: "openclaw-bridge",
      state: "ready",
      provider: "openclaw",
      note: "ok",
    },
    executorConfig: {
      type: "openclaw",
      openclaw: { url: "ws://localhost:18789", tokenConfigured: false },
      connectionState: "idle",
      lastError: null,
      lastConnectedAt: null,
    },
    executorCapabilities: {
      sessionStatus: "unknown",
      processRuntime: "unsupported",
      notes: [],
    },
    executorReadiness: [],
    authority: {
      url: "http://127.0.0.1:18790",
      dbPath: "/tmp/authority.sqlite",
      connected: true,
    },
  } as AuthorityBootstrapSnapshot;
}

function createDeps() {
  const existingCompany = createCompany("company-1");
  let currentConfig: CyberCompanyConfig | null = createConfig(existingCompany);
  const runtimes = new Map<string, AuthorityCompanyRuntimeSnapshot>([
    [existingCompany.id, createRuntime(existingCompany.id)],
  ]);
  let executorState: AuthorityExecutorStatus["state"] = "ready";
  const runManagedExecutorMutation = <T,>(task: () => Promise<T>) => task();

  return {
    repository: {
      saveConfig: vi.fn((config: CyberCompanyConfig) => {
        currentConfig = config;
      }),
      loadConfig: vi.fn(() => currentConfig),
      saveRuntime: vi.fn((runtime: AuthorityCompanyRuntimeSnapshot) => {
        runtimes.set(runtime.companyId, runtime);
      }),
      loadRuntime: vi.fn((companyId: string) => runtimes.get(companyId) ?? createRuntime(companyId)),
      switchCompany: vi.fn((companyId: string) => {
        if (currentConfig) {
          currentConfig = { ...currentConfig, activeCompanyId: companyId };
        }
      }),
      deleteCompany: vi.fn((companyId: string) => {
        if (currentConfig) {
          currentConfig = {
            ...currentConfig,
            companies: currentConfig.companies.filter((company) => company.id !== companyId),
          };
        }
      }),
      clearManagedExecutorAgentsForCompany: vi.fn(),
      hasCompany: vi.fn((companyId: string) =>
        Boolean(currentConfig?.companies.some((company) => company.id === companyId)),
      ),
    },
    buildCompanyDefinition: vi.fn((input: { companyName: string }) => {
      const nextCompany = createCompany("company-new");
      return {
        company: { ...nextCompany, name: input.companyName || nextCompany.name },
        runtime: createRuntime(nextCompany.id),
      };
    }),
    runManagedExecutorMutation,
    ensureManagedCompanyExecutorProvisionedBestEffort: vi.fn(async () => undefined),
    ensureManagedCompanyExecutorProvisioned: vi.fn(async () => undefined),
    updateCompanyExecutorProvisioning: vi.fn((input: { companyId: string; state: string }) => ({
      ...createCompany(input.companyId),
      system: {
        executorProvisioning: {
          state: input.state as "ready" | "degraded" | "blocked",
          pendingAgentIds: [],
          lastError: null,
          updatedAt: 1,
        },
      },
    })),
    listManagedProvisioningAgentIds: vi.fn(() => ["agent-1", "agent-2"]),
    resolveProvisioningFailureState: vi.fn(() => "degraded" as const),
    stringifyError: vi.fn((error: unknown) => (error instanceof Error ? error.message : String(error))),
    hireCompanyEmployeeStrongConsistency: vi.fn(
      async (): Promise<AuthorityHireEmployeeResponse> =>
        ({
          company: createCompany(),
          config: currentConfig!,
          runtime: createRuntime(currentConfig?.activeCompanyId ?? "company-1"),
          warnings: [],
          employees: [],
          employee: {
            agentId: "employee-1",
            nickname: "Employee",
            role: "Writer",
            isMeta: false,
          },
        }) as AuthorityHireEmployeeResponse,
    ),
    hireCompanyEmployeesStrongConsistency: vi.fn(async ({ companyId, hires }) => ({
      company: createCompany(companyId),
      config: currentConfig!,
      runtime: createRuntime(companyId),
      warnings: [],
      employees: hires.map((_: AuthorityHireEmployeeInput, index: number) => ({
        agentId: `employee-${index + 1}`,
        nickname: `Employee ${index + 1}`,
        role: "Writer",
        isMeta: false,
      })),
    })),
    buildBootstrapSnapshot: vi.fn(() => createBootstrapSnapshot(currentConfig ?? createConfig(existingCompany))),
    getExecutorState: vi.fn<() => AuthorityExecutorStatus["state"]>(() => executorState),
    deleteManagedAgentFromExecutor: vi.fn(async () => undefined),
    listExecutorAgentIds: vi.fn(async () => new Set<string>()),
    cleanupCompanyWorkspace: vi.fn(async () => "/tmp/company"),
    now: vi.fn(() => 1234567890),
    logWarn: vi.fn(),
    setExecutorState: (state: AuthorityExecutorStatus["state"]) => {
      executorState = state;
    },
  };
}

describe("createAuthorityCompanyManagementCommands", () => {
  it("builds config save response with schedule and executor sync hint", async () => {
    const deps = createDeps();
    const commands = createAuthorityCompanyManagementCommands(deps);
    const nextConfig = createConfig(createCompany("company-2"));
    const expectedBootstrap = createBootstrapSnapshot(nextConfig);
    deps.buildBootstrapSnapshot.mockReturnValue(expectedBootstrap);

    const result = await commands.saveConfig(nextConfig);

    expect(deps.repository.saveConfig).toHaveBeenCalledWith(nextConfig);
    expect(result).toEqual({
      status: 200,
      payload: expectedBootstrap,
      postCommit: {
        schedule: { reason: "config.save" },
        managedExecutorSyncReason: "config.save",
        broadcasts: [{ type: "bootstrap.updated", timestamp: 1234567890 }],
      },
    });
  });

  it("marks company create as degraded when executor provisioning falls back", async () => {
    const deps = createDeps();
    deps.ensureManagedCompanyExecutorProvisionedBestEffort.mockRejectedValueOnce(
      new Error("executor down"),
    );
    const commands = createAuthorityCompanyManagementCommands(deps);

    const result = await commands.createCompany({
      companyName: "Nova",
    } as Parameters<typeof commands.createCompany>[0]);

    expect(deps.repository.saveConfig).toHaveBeenCalled();
    expect(deps.repository.saveRuntime).toHaveBeenCalled();
    expect(deps.updateCompanyExecutorProvisioning).toHaveBeenCalledWith(
      expect.objectContaining({
        companyId: "company-new",
        state: "degraded",
        pendingAgentIds: ["agent-1", "agent-2"],
        lastError: "executor down",
      }),
    );
    expect(deps.logWarn).toHaveBeenCalled();
    expect(result.postCommit).toEqual({
      schedule: { reason: "company.create", companyId: "company-new" },
      managedExecutorSyncReason: "company.create.degraded",
      broadcasts: [
        { type: "bootstrap.updated", companyId: "company-new", timestamp: 1234567890 },
        { type: "company.updated", companyId: "company-new", timestamp: 1234567890 },
      ],
    });
    expect((result.payload as { warnings: string[] }).warnings).toEqual([
      "执行器仍在补齐：executor down",
    ]);
  });

  it("maps strong company delete failures to response payloads", async () => {
    const deps = createDeps();
    deps.setExecutorState("blocked");
    const commands = createAuthorityCompanyManagementCommands(deps);

    const result = await commands.deleteCompany("company-1");

    expect(result).toEqual({
      status: 503,
      payload: { error: "OpenClaw 未就绪，未执行本地删除。" },
    });
  });
});
