import type { IncomingMessage } from "node:http";
import type {
  AuthorityCollaborationScopeResponse,
  AuthorityCompanyEventsResponse,
  AuthorityCompanyRuntimeSnapshot,
  AuthorityRuntimeSyncRequest,
} from "../../../src/infrastructure/authority/contract";
import type { AuthorityRouteResult } from "./authority-route-result";
import { mergeAuthorityControlledRuntimeSlices } from "./requirement-control-runtime";

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

  return null;
}
