import { describe, expect, it, vi } from "vitest";
import type { IncomingMessage } from "node:http";
import type { AuthorityCompanyRuntimeSnapshot } from "../../../src/infrastructure/authority/contract";
import { resolveAuthorityCompanyStateRoute } from "./company-state-routes";

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
    activeAgentStatusHealth: {
      source: "authority",
      coverage: "authority_partial",
      coveredAgentCount: 0,
      expectedAgentCount: 0,
      missingAgentIds: [],
      isComplete: false,
      generatedAt: 0,
      note: "test",
    },
    updatedAt: 0,
  };
}

function createDeps() {
  return {
    loadRuntime: vi.fn((companyId: string) => createRuntime(companyId)),
    saveRuntime: vi.fn((snapshot: AuthorityCompanyRuntimeSnapshot) => snapshot),
    listCompanyEvents: vi.fn().mockReturnValue({ companyId: "company-1", events: [], nextCursor: null }),
    getCollaborationScope: vi
      .fn()
      .mockReturnValue({ companyId: "company-1", agentId: "ceo", breadcrumbs: [], requirements: [] }),
  };
}

describe("resolveAuthorityCompanyStateRoute", () => {
  it("handles GET /companies/:id/runtime", async () => {
    const deps = createDeps();
    const result = await resolveAuthorityCompanyStateRoute({
      method: "GET",
      url: new URL("http://authority.local/companies/company-1/runtime"),
      request: {} as IncomingMessage,
      readJsonBody: vi.fn(),
      deps,
    });

    expect(deps.loadRuntime).toHaveBeenCalledWith("company-1");
    expect(result).toEqual({
      status: 200,
      payload: createRuntime("company-1"),
    });
  });

  it("handles PUT /companies/:id/runtime and emits follow-up effects", async () => {
    const deps = createDeps();
    const readJsonBody = vi.fn().mockResolvedValue({
      snapshot: {
        ...createRuntime("ignored"),
        activeWorkItems: [{ id: "work-1", companyId: "company-1", title: "Ship" }],
      },
    });

    const result = await resolveAuthorityCompanyStateRoute({
      method: "PUT",
      url: new URL("http://authority.local/companies/company-1/runtime"),
      request: {} as IncomingMessage,
      readJsonBody,
      deps,
      now: () => 123456,
    });

    expect(readJsonBody).toHaveBeenCalledTimes(1);
    expect(deps.saveRuntime).toHaveBeenCalledTimes(1);
    expect(result?.status).toBe(200);
    expect(result?.postCommit).toEqual({
      schedule: { reason: "runtime.sync", companyId: "company-1" },
      broadcasts: [{ type: "company.updated", companyId: "company-1", timestamp: 123456 }],
    });
    expect((result?.payload as AuthorityCompanyRuntimeSnapshot).companyId).toBe("company-1");
  });

  it("handles events and collaboration-scope queries", async () => {
    const deps = createDeps();

    const eventsResult = await resolveAuthorityCompanyStateRoute({
      method: "GET",
      url: new URL("http://authority.local/companies/company-1/events?cursor=abc&since=42&limit=20&recent=1"),
      request: {} as IncomingMessage,
      readJsonBody: vi.fn(),
      deps,
    });

    expect(deps.listCompanyEvents).toHaveBeenCalledWith("company-1", "abc", 42, 20, true);
    expect(eventsResult?.payload).toEqual({ companyId: "company-1", events: [], nextCursor: null });

    const collaborationResult = await resolveAuthorityCompanyStateRoute({
      method: "GET",
      url: new URL("http://authority.local/companies/company-1/collaboration-scope/ceo"),
      request: {} as IncomingMessage,
      readJsonBody: vi.fn(),
      deps,
    });

    expect(deps.getCollaborationScope).toHaveBeenCalledWith("company-1", "ceo");
    expect(collaborationResult?.payload).toEqual({
      companyId: "company-1",
      agentId: "ceo",
      breadcrumbs: [],
      requirements: [],
    });
  });

  it("returns null for non-company-state routes", async () => {
    const deps = createDeps();
    const result = await resolveAuthorityCompanyStateRoute({
      method: "GET",
      url: new URL("http://authority.local/actors"),
      request: {} as IncomingMessage,
      readJsonBody: vi.fn(),
      deps,
    });

    expect(result).toBeNull();
  });
});
