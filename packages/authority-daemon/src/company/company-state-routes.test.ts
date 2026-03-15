import { describe, expect, it, vi } from "vitest";
import type { IncomingMessage } from "node:http";
import type { AuthorityCompanyRuntimeSnapshot } from "../../../../src/infrastructure/authority/contract";
import { resolveAuthorityCompanyStateRoute, type AuthorityCompanyStateRouteDependencies } from "./company-state-routes";
import type { ProjectRecord } from "../../../../src/domain/project/types";

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
  const deps = {
    loadRuntime: vi.fn((companyId: string) => createRuntime(companyId)),
    saveRuntime: vi.fn((snapshot: AuthorityCompanyRuntimeSnapshot) => snapshot),
    listCompanyEvents: vi.fn().mockReturnValue({ companyId: "company-1", events: [], nextCursor: null }),
    getCollaborationScope: vi
      .fn()
      .mockReturnValue({ companyId: "company-1", agentId: "ceo", breadcrumbs: [], requirements: [] }),
    listCompanyProjects: vi.fn().mockReturnValue([]),
    loadCompanyProject: vi.fn().mockReturnValue(null),
    createCompanyProject: vi.fn<AuthorityCompanyStateRouteDependencies["createCompanyProject"]>(
      (project) => ({
        ...project,
        createdAt: 1000,
        updatedAt: 1000,
      }),
    ),
    patchCompanyProject: vi.fn<AuthorityCompanyStateRouteDependencies["patchCompanyProject"]>(
      (companyId, projectId, patch) =>
        ({
          id: projectId,
          companyId,
          title: "patched",
          goal: "goal",
          summary: "",
          status: "active",
          priority: "medium",
          ownerActorId: null,
          ownerLabel: "待分配",
          participantActorIds: [],
          currentRunId: null,
          latestAcceptedRunId: null,
          requirementAggregateId: null,
          workItemId: null,
          roomId: null,
          tagIds: [],
          createdAt: 1000,
          updatedAt: 2000,
          closedAt: patch.closedAt ?? null,
          archivedAt: patch.archivedAt ?? null,
          archiveSummary: null,
        }) satisfies ProjectRecord,
    ),
  } satisfies AuthorityCompanyStateRouteDependencies;

  return deps;
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

  it("handles GET /companies/:id/projects", async () => {
    const deps = createDeps();
    deps.listCompanyProjects.mockReturnValue([
      {
        id: "proj-1",
        companyId: "company-1",
        title: "Project",
        goal: "Goal",
        summary: "",
        status: "active",
        priority: "medium",
        ownerActorId: null,
        ownerLabel: "待分配",
        participantActorIds: [],
        currentRunId: null,
        latestAcceptedRunId: null,
        requirementAggregateId: null,
        workItemId: null,
        roomId: null,
        tagIds: [],
        createdAt: 1,
        updatedAt: 42,
        closedAt: null,
        archivedAt: null,
        archiveSummary: null,
      },
    ]);
    const result = await resolveAuthorityCompanyStateRoute({
      method: "GET",
      url: new URL("http://authority.local/companies/company-1/projects"),
      request: {} as IncomingMessage,
      readJsonBody: vi.fn(),
      deps,
      now: () => 123,
    });

    expect(deps.listCompanyProjects).toHaveBeenCalledWith("company-1");
    expect(result?.status).toBe(200);
    expect(result?.payload).toEqual({
      companyId: "company-1",
      projects: deps.listCompanyProjects.mock.results[0]?.value,
      updatedAt: 42,
    });
  });

  it("handles POST /companies/:id/projects", async () => {
    const deps = createDeps();
    const readJsonBody = vi.fn().mockResolvedValue({
      companyId: "company-1",
      title: "Ship v1",
      goal: "Done",
      summary: "Summary",
      status: "draft",
      priority: "high",
      ownerActorId: "ceo",
      ownerLabel: "CEO",
      participantActorIds: ["cto"],
      requirementAggregateId: "req-1",
      workItemId: "work-1",
      roomId: "room-1",
      tagIds: ["tag-1"],
    });
    const result = await resolveAuthorityCompanyStateRoute({
      method: "POST",
      url: new URL("http://authority.local/companies/company-1/projects"),
      request: {} as IncomingMessage,
      readJsonBody,
      deps,
      now: () => 555,
    });

    expect(readJsonBody).toHaveBeenCalledTimes(1);
    expect(deps.createCompanyProject).toHaveBeenCalledTimes(1);
    expect(result?.status).toBe(200);
    expect(result?.postCommit).toEqual({
      schedule: { reason: "project.create", companyId: "company-1" },
      broadcasts: [{ type: "company.updated", companyId: "company-1", timestamp: 555 }],
    });
    const payload = result?.payload as { companyId: string; project: ProjectRecord };
    expect(payload.companyId).toBe("company-1");
    expect(payload.project.title).toBe("Ship v1");
    expect(payload.project.createdAt).toBe(1000);
  });

  it("handles PATCH /companies/:id/projects/:projectId", async () => {
    const deps = createDeps();
    const readJsonBody = vi.fn().mockResolvedValue({
      companyId: "company-1",
      projectId: "proj-1",
      patch: { status: "archived" },
      timestamp: 777,
    });
    const result = await resolveAuthorityCompanyStateRoute({
      method: "PATCH",
      url: new URL("http://authority.local/companies/company-1/projects/proj-1"),
      request: {} as IncomingMessage,
      readJsonBody,
      deps,
      now: () => 999,
    });

    expect(deps.patchCompanyProject).toHaveBeenCalledWith("company-1", "proj-1", {
      status: "archived",
      archivedAt: 777,
    });
    expect(result?.postCommit).toEqual({
      schedule: { reason: "project.patch", companyId: "company-1" },
      broadcasts: [{ type: "company.updated", companyId: "company-1", timestamp: 777 }],
    });
    const payload = result?.payload as { companyId: string; project: ProjectRecord };
    expect(payload.project.id).toBe("proj-1");
    expect(payload.project.archivedAt).toBe(777);
  });

  it("handles GET /companies/:id/projects/:projectId", async () => {
    const deps = createDeps();
    deps.loadCompanyProject.mockReturnValue({
      id: "proj-1",
      companyId: "company-1",
      title: "Project",
      goal: "Goal",
      summary: "",
      status: "active",
      priority: "medium",
      ownerActorId: null,
      ownerLabel: "待分配",
      participantActorIds: [],
      currentRunId: null,
      latestAcceptedRunId: null,
      requirementAggregateId: null,
      workItemId: null,
      roomId: null,
      tagIds: [],
      createdAt: 1,
      updatedAt: 2,
      closedAt: null,
      archivedAt: null,
      archiveSummary: null,
    });
    const result = await resolveAuthorityCompanyStateRoute({
      method: "GET",
      url: new URL("http://authority.local/companies/company-1/projects/proj-1"),
      request: {} as IncomingMessage,
      readJsonBody: vi.fn(),
      deps,
    });

    expect(deps.loadCompanyProject).toHaveBeenCalledWith("company-1", "proj-1");
    expect(result?.payload).toEqual({ companyId: "company-1", project: deps.loadCompanyProject.mock.results[0]?.value });
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
