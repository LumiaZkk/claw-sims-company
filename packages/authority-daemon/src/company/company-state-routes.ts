import type { IncomingMessage } from "node:http";
import { randomUUID } from "node:crypto";
import type {
  AuthorityCollaborationScopeResponse,
  AuthorityCompanyEventsResponse,
  AuthorityCompanyProjectsResponse,
  AuthorityCompanyRuntimeSnapshot,
  AuthorityProjectCreateRequest,
  AuthorityProjectMutationResponse,
  AuthorityProjectPatchRequest,
  AuthorityRuntimeSyncRequest,
} from "../../../../src/infrastructure/authority/contract";
import type { ProjectRecord } from "../../../../src/domain/project/types";
import type { AuthorityRouteResult } from "../system/authority-route-result";
import { mergeAuthorityControlledRuntimeSlices } from "../collaboration/requirement-control-runtime";
import { authorityBadRequest, authorityNotFound } from "../system/authority-error";

export type AuthorityCompanyStateRouteDependencies = {
  loadRuntime: (companyId: string) => AuthorityCompanyRuntimeSnapshot;
  saveRuntime: (snapshot: AuthorityCompanyRuntimeSnapshot) => AuthorityCompanyRuntimeSnapshot;
  listCompanyEvents: (
    companyId: string,
    cursor?: string | null,
    since?: number,
    limit?: number,
    recent?: boolean,
  ) => AuthorityCompanyEventsResponse;
  getCollaborationScope: (
    companyId: string,
    agentId: string,
  ) => AuthorityCollaborationScopeResponse;
  listCompanyProjects: (companyId: string) => ProjectRecord[];
  loadCompanyProject: (companyId: string, projectId: string) => ProjectRecord | null;
  createCompanyProject: (
    project: Omit<ProjectRecord, "createdAt" | "updatedAt">,
  ) => ProjectRecord;
  patchCompanyProject: (
    companyId: string,
    projectId: string,
    patch: Partial<ProjectRecord>,
  ) => ProjectRecord;
};

export type AuthorityCompanyStateRouteResult = AuthorityRouteResult;

export async function resolveAuthorityCompanyStateRoute(input: {
  method?: string;
  url: URL;
  request: IncomingMessage;
  readJsonBody: <T>(request: IncomingMessage) => Promise<T>;
  deps: AuthorityCompanyStateRouteDependencies;
  now?: () => number;
}): Promise<AuthorityCompanyStateRouteResult | null> {
  const { method, url, request, readJsonBody, deps, now = Date.now } = input;

  const runtimeMatch = url.pathname.match(/^\/companies\/([^/]+)\/runtime$/);
  if (runtimeMatch) {
    const companyId = decodeURIComponent(runtimeMatch[1] ?? "");
    if (method === "GET") {
      return {
        status: 200,
        payload: deps.loadRuntime(companyId),
      };
    }

    if (method === "PUT") {
      const body = await readJsonBody<AuthorityRuntimeSyncRequest>(request);
      const currentRuntime = deps.loadRuntime(companyId);
      const mergedSnapshot = mergeAuthorityControlledRuntimeSlices({
        currentRuntime,
        incomingRuntime: { ...body.snapshot, companyId },
      });
      return {
        status: 200,
        payload: deps.saveRuntime(mergedSnapshot),
        postCommit: {
          schedule: { reason: "runtime.sync", companyId },
          broadcasts: [{ type: "company.updated", companyId, timestamp: now() }],
        },
      };
    }
  }

  const eventsMatch = url.pathname.match(/^\/companies\/([^/]+)\/events$/);
  if (method === "GET" && eventsMatch) {
    const companyId = decodeURIComponent(eventsMatch[1] ?? "");
    const cursor = url.searchParams.get("cursor");
    const since = url.searchParams.has("since")
      ? Number.parseInt(url.searchParams.get("since") ?? "", 10)
      : undefined;
    const limit = url.searchParams.has("limit")
      ? Number.parseInt(url.searchParams.get("limit") ?? "", 10)
      : undefined;
    const recent = ["1", "true"].includes((url.searchParams.get("recent") ?? "").toLowerCase());
    return {
      status: 200,
      payload: deps.listCompanyEvents(companyId, cursor, since, limit, recent),
    };
  }

  const collaborationScopeMatch = url.pathname.match(
    /^\/companies\/([^/]+)\/collaboration-scope\/([^/]+)$/,
  );
  if (method === "GET" && collaborationScopeMatch) {
    const companyId = decodeURIComponent(collaborationScopeMatch[1] ?? "");
    const agentId = decodeURIComponent(collaborationScopeMatch[2] ?? "");
    return {
      status: 200,
      payload: deps.getCollaborationScope(companyId, agentId),
    };
  }

  const projectsMatch = url.pathname.match(/^\/companies\/([^/]+)\/projects$/);
  if (projectsMatch) {
    const companyId = decodeURIComponent(projectsMatch[1] ?? "");
    if (method === "GET") {
      const projects = deps.listCompanyProjects(companyId);
      const payload: AuthorityCompanyProjectsResponse = {
        companyId,
        projects,
        updatedAt: projects[0]?.updatedAt ?? now(),
      };
      return { status: 200, payload };
    }

    if (method === "POST") {
      const body = await readJsonBody<AuthorityProjectCreateRequest>(request);
      if (body.companyId !== companyId) {
        throw authorityBadRequest("companyId mismatch");
      }
      const timestamp = now();
      const status =
        body.status ??
        (body.requirementAggregateId || body.workItemId || body.roomId ? "active" : "draft");
      const priority = body.priority ?? "medium";
      const project: Omit<ProjectRecord, "createdAt" | "updatedAt"> = {
        id: randomUUID(),
        companyId,
        title: body.title,
        goal: body.goal,
        summary: body.summary ?? "",
        status,
        priority,
        ownerActorId: body.ownerActorId ?? null,
        ownerLabel: body.ownerLabel ?? "待分配",
        participantActorIds: body.participantActorIds ?? [],
        currentRunId: null,
        latestAcceptedRunId: null,
        requirementAggregateId: body.requirementAggregateId ?? null,
        workItemId: body.workItemId ?? null,
        roomId: body.roomId ?? null,
        tagIds: body.tagIds ?? [],
        closedAt: null,
        archivedAt: null,
        archiveSummary: null,
      };
      const created = deps.createCompanyProject(project);
      const payload: AuthorityProjectMutationResponse = { companyId, project: created };
      return {
        status: 200,
        payload,
        postCommit: {
          schedule: { reason: "project.create", companyId },
          broadcasts: [{ type: "company.updated", companyId, timestamp }],
        },
      };
    }
  }

  const projectMatch = url.pathname.match(/^\/companies\/([^/]+)\/projects\/([^/]+)$/);
  if (projectMatch) {
    const companyId = decodeURIComponent(projectMatch[1] ?? "");
    const projectId = decodeURIComponent(projectMatch[2] ?? "");

    if (method === "GET") {
      const project = deps.loadCompanyProject(companyId, projectId);
      if (!project) {
        throw authorityNotFound(`Unknown project: ${projectId}`);
      }
      const payload: AuthorityProjectMutationResponse = { companyId, project };
      return { status: 200, payload };
    }

    if (method === "PATCH") {
      const body = await readJsonBody<AuthorityProjectPatchRequest>(request);
      if (body.companyId !== companyId) {
        throw authorityBadRequest("companyId mismatch");
      }
      if (body.projectId !== projectId) {
        throw authorityBadRequest("projectId mismatch");
      }
      const timestamp = typeof body.timestamp === "number" ? body.timestamp : now();
      const patch: Partial<ProjectRecord> = { ...body.patch };
      if (body.patch.status === "archived" && patch.archivedAt == null) {
        patch.archivedAt = timestamp;
      }
      if (["completed", "canceled"].includes(body.patch.status ?? "") && patch.closedAt == null) {
        patch.closedAt = timestamp;
      }
      const updated = deps.patchCompanyProject(companyId, projectId, patch);
      const payload: AuthorityProjectMutationResponse = { companyId, project: updated };
      return {
        status: 200,
        payload,
        postCommit: {
          schedule: { reason: "project.patch", companyId },
          broadcasts: [{ type: "company.updated", companyId, timestamp }],
        },
      };
    }
  }

  return null;
}
