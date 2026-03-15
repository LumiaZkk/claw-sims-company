import { describe, expect, it } from "vitest";
import type { Company } from "../../../../src/domain/org/types";
import type { AuthorityCompanyRuntimeSnapshot } from "../../../../src/infrastructure/authority/contract";
import { normalizeCompany, normalizeRuntimeSnapshot } from "./authority-persistence-shared";

function buildLegacyCompany(): Company {
  return {
    id: "03361e5b-a043-4a1c-a9f2-bc1c009beff4",
    name: "拼多多",
    description: "",
    icon: "🏢",
    template: "blank",
    createdAt: 1,
    quickPrompts: [
      {
        label: "找负责人",
        icon: "briefcase",
        prompt: "看看运营负责人",
        targetAgentId: "pdd-03361e-电商运营负责人",
      },
    ],
    departments: [
      {
        id: "dept-biz",
        name: "业务部",
        leadAgentId: "pdd-03361e-电商运营负责人",
        kind: "business",
        order: 0,
        missionPolicy: "manager_delegated",
      },
    ],
    employees: [
      {
        agentId: "pdd-03361e-ceo",
        nickname: "CEO",
        role: "CEO",
        isMeta: true,
        metaRole: "ceo",
      },
      {
        agentId: "pdd-03361e-电商运营负责人",
        nickname: "电商运营负责人",
        role: "电商运营负责人",
        isMeta: false,
        reportsTo: "pdd-03361e-ceo",
        departmentId: "dept-biz",
      },
      {
        agentId: "pdd-03361e-客服主管",
        nickname: "客服主管",
        role: "客服主管",
        isMeta: false,
        reportsTo: "pdd-03361e-电商运营负责人",
        departmentId: "dept-biz",
      },
    ],
    system: {
      executorProvisioning: {
        state: "degraded",
        pendingAgentIds: ["pdd-03361e-电商运营负责人", "pdd-03361e-客服主管"],
        updatedAt: 1,
      },
    },
  };
}

function buildLegacyRuntime(companyId: string): AuthorityCompanyRuntimeSnapshot {
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
    activeAgentSessions: [
      {
        sessionKey: "agent:pdd-03361e-电商运营负责人:main",
        agentId: "pdd-03361e-电商运营负责人",
        providerId: "openclaw",
        sessionState: "idle",
        lastSeenAt: 1,
        lastStatusSyncAt: 1,
        lastMessageAt: 1,
        abortedLastRun: false,
        lastError: null,
        source: "fallback",
      },
    ],
    activeAgentRuns: [],
    activeAgentRuntime: [],
    activeAgentStatuses: [
      {
        agentId: "pdd-03361e-电商运营负责人",
        runtimeState: "idle",
        coordinationState: "none",
        interventionState: "healthy",
        reason: "ok",
        currentAssignment: "",
        currentObjective: "",
        latestSignalAt: 1,
        activeSessionCount: 1,
        activeRunCount: 0,
        openDispatchCount: 0,
        blockedDispatchCount: 0,
        openSupportRequestCount: 0,
        blockedSupportRequestCount: 0,
        openRequestCount: 0,
        blockedRequestCount: 0,
        openHandoffCount: 0,
        blockedHandoffCount: 0,
        openEscalationCount: 0,
        blockedWorkItemCount: 0,
        primaryWorkItemId: null,
      },
    ],
    activeAgentStatusHealth: {
      source: "authority",
      coverage: "authority_partial",
      coveredAgentCount: 1,
      expectedAgentCount: 1,
      missingAgentIds: ["pdd-03361e-电商运营负责人"],
      isComplete: false,
      generatedAt: 1,
      note: null,
    },
    updatedAt: 1,
  };
}

describe("normalizeCompany", () => {
  it("migrates legacy Chinese canonical agent ids to OpenClaw-compatible ids", () => {
    const normalized = normalizeCompany(buildLegacyCompany());

    expect(normalized.employees.map((employee) => employee.agentId)).toEqual([
      "pdd-03361e-ceo",
      "pdd-03361e",
      "pdd-03361e-2",
    ]);
    expect(normalized.departments?.[0]?.leadAgentId).toBe("pdd-03361e");
    expect(normalized.quickPrompts[0]?.targetAgentId).toBe("pdd-03361e");
    expect(normalized.system?.executorProvisioning?.pendingAgentIds).toEqual([
      "pdd-03361e",
      "pdd-03361e-2",
    ]);
    expect(normalized.employees.find((employee) => employee.role === "客服主管")?.reportsTo).toBe("pdd-03361e");
  });
});

describe("normalizeRuntimeSnapshot", () => {
  it("rewrites legacy runtime agent ids and session keys to the canonical ids", () => {
    const company = normalizeCompany(buildLegacyCompany());
    const runtime = normalizeRuntimeSnapshot(company, buildLegacyRuntime(company.id));

    expect(runtime.activeAgentSessions?.[0]).toMatchObject({
      agentId: "pdd-03361e",
      sessionKey: "agent:pdd-03361e:main",
    });
    expect(runtime.activeAgentStatuses?.[0]?.agentId).toBe("pdd-03361e");
    expect(runtime.activeAgentStatusHealth?.missingAgentIds).toEqual(["pdd-03361e"]);
  });
});
