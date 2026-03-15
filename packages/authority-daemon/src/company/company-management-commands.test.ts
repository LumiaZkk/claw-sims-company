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
          const nextCompanies = currentConfig.companies.filter((company) => company.id !== companyId);
          currentConfig = {
            ...currentConfig,
            companies: nextCompanies,
            activeCompanyId:
              currentConfig.activeCompanyId === companyId
                ? (nextCompanies[0]?.id ?? currentConfig.activeCompanyId)
                : currentConfig.activeCompanyId,
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
    previewCompanyEmployeeHire: vi.fn((input: { companyId: string; role: string; description: string }) => ({
      companyId: input.companyId,
      intent: {
        companyId: input.companyId,
        rolePrompt: input.role,
        businessContext: input.description,
      },
      matches: [],
      selectionMode: "blank" as const,
      selectedTemplateId: null,
      selectedTemplateBinding: null,
      selectedDraft: null,
      blankTemplateBinding: {
        templateId: null,
        sourceType: "blank" as const,
        compiledAt: 1,
        compilerVersion: "tm-compiler@1",
        confidence: null,
      },
      blankDraft: {
        companyId: input.companyId,
        sourceType: "blank",
        role: input.role,
        description: input.description,
        bootstrapBundle: { roleMd: "# blank" },
        provenance: { sourceType: "blank", reasons: [] },
      },
      warnings: [],
    })),
    previewCompanyEmployeesHire: vi.fn((input: { companyId: string }) => ({
      companyId: input.companyId,
      previews: [],
      warnings: [],
    })),
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
    hireCompanyEmployeeWithProvisioningFallback: vi.fn(
      async (): Promise<{ payload: AuthorityHireEmployeeResponse; provisioningFailure: unknown | null }> => ({
        payload: {
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
        } as AuthorityHireEmployeeResponse,
        provisioningFailure: null,
      }),
    ),
    hireCompanyEmployeesWithProvisioningFallback: vi.fn(async ({ companyId, hires }) => ({
      payload: {
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
      },
      provisioningFailure: null,
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

  it("fails company create and rolls back local state when executor provisioning fails", async () => {
    const deps = createDeps();
    deps.ensureManagedCompanyExecutorProvisioned.mockRejectedValueOnce(
      new Error("executor down"),
    );
    const commands = createAuthorityCompanyManagementCommands(deps);

    await expect(
      commands.createCompany({
        companyName: "Nova",
      } as Parameters<typeof commands.createCompany>[0]),
    ).rejects.toThrow("创建公司失败，已回滚：executor down");

    expect(deps.repository.saveConfig).toHaveBeenCalled();
    expect(deps.repository.saveRuntime).toHaveBeenCalled();
    expect(deps.repository.deleteCompany).toHaveBeenCalledWith("company-new");
    expect(deps.repository.clearManagedExecutorAgentsForCompany).toHaveBeenCalledWith("company-new");
    expect(deps.deleteManagedAgentFromExecutor).toHaveBeenNthCalledWith(1, "agent-2");
    expect(deps.deleteManagedAgentFromExecutor).toHaveBeenNthCalledWith(2, "agent-1");
    expect(deps.updateCompanyExecutorProvisioning).not.toHaveBeenCalled();
    expect(deps.repository.loadConfig()).toEqual(createConfig(createCompany("company-1")));
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

  it("returns degraded hire payload with warning and executor sync hint", async () => {
    const deps = createDeps();
    deps.hireCompanyEmployeeWithProvisioningFallback.mockResolvedValueOnce({
      payload: {
        company: createCompany("company-1"),
        config: createConfig(createCompany("company-1")),
        runtime: createRuntime("company-1"),
        warnings: [],
        employee: {
          agentId: "employee-1",
          nickname: "Employee",
          role: "Writer",
          isMeta: false,
        },
      },
      provisioningFailure: new Error("executor offline"),
    });
    const commands = createAuthorityCompanyManagementCommands(deps);

    const result = await commands.hireEmployee({
      companyId: "company-1",
      body: {
        companyId: "company-1",
        role: "Writer",
        description: "Draft release notes",
      },
    });

    expect(deps.updateCompanyExecutorProvisioning).toHaveBeenCalledWith(
      expect.objectContaining({
        companyId: "company-1",
        state: "degraded",
        pendingAgentIds: ["agent-1", "agent-2"],
        lastError: "executor offline",
      }),
    );
    expect(result).toEqual({
      status: 200,
      payload: expect.objectContaining({
        warnings: ["执行器仍在补齐：executor offline"],
      }),
      postCommit: {
        schedule: { reason: "company.employee.hire", companyId: "company-1" },
        managedExecutorSyncReason: "company.employee.hire.degraded",
        broadcasts: [
          { type: "bootstrap.updated", companyId: "company-1", timestamp: 1234567890 },
          { type: "company.updated", companyId: "company-1", timestamp: 1234567890 },
        ],
      },
    });
    expect(deps.logWarn).toHaveBeenCalled();
  });

  it("returns preview payload without post-commit side effects", async () => {
    const deps = createDeps();
    const commands = createAuthorityCompanyManagementCommands(deps);

    const result = await commands.previewHireEmployee({
      companyId: "company-1",
      body: {
        companyId: "company-1",
        role: "Writer",
        description: "Draft release notes",
      },
    });

    expect(deps.previewCompanyEmployeeHire).toHaveBeenCalledWith({
      companyId: "company-1",
      role: "Writer",
      description: "Draft release notes",
    });
    expect(result).toEqual({
      status: 200,
      payload: expect.objectContaining({
        companyId: "company-1",
        selectionMode: "blank",
      }),
    });
    expect(result.postCommit).toBeUndefined();
  });

  it("returns batch preview payload without post-commit side effects", async () => {
    const deps = createDeps();
    const commands = createAuthorityCompanyManagementCommands(deps);

    const result = await commands.previewBatchHireEmployees({
      companyId: "company-1",
      body: {
        companyId: "company-1",
        hires: [
          {
            companyId: "company-1",
            role: "Writer",
            description: "Draft release notes",
          },
          {
            companyId: "company-1",
            role: "Designer",
            description: "Own visual delivery",
          },
        ],
      },
    });

    expect(deps.previewCompanyEmployeesHire).toHaveBeenCalledWith({
      companyId: "company-1",
      hires: [
        {
          companyId: "company-1",
          role: "Writer",
          description: "Draft release notes",
        },
        {
          companyId: "company-1",
          role: "Designer",
          description: "Own visual delivery",
        },
      ],
    });
    expect(result).toEqual({
      status: 200,
      payload: expect.objectContaining({
        companyId: "company-1",
        previews: [],
      }),
    });
    expect(result.postCommit).toBeUndefined();
  });

  it("marks hire provisioning ready when fallback path succeeds cleanly", async () => {
    const deps = createDeps();
    const commands = createAuthorityCompanyManagementCommands(deps);

    const result = await commands.hireEmployee({
      companyId: "company-1",
      body: {
        companyId: "company-1",
        role: "Writer",
        description: "Draft release notes",
      },
    });

    expect(deps.updateCompanyExecutorProvisioning).toHaveBeenCalledWith(
      expect.objectContaining({
        companyId: "company-1",
        state: "ready",
        pendingAgentIds: [],
        lastError: null,
      }),
    );
    expect(result.postCommit).toEqual({
      schedule: { reason: "company.employee.hire", companyId: "company-1" },
      broadcasts: [
        { type: "bootstrap.updated", companyId: "company-1", timestamp: 1234567890 },
        { type: "company.updated", companyId: "company-1", timestamp: 1234567890 },
      ],
    });
  });
});
