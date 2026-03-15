import type { IncomingMessage } from "node:http";
import type {
  AuthorityAgentFileRunRequest,
  AuthorityAgentFileRunResponse,
  AuthorityAppendCompanyEventRequest,
  AuthorityAppendRoomRequest,
  AuthorityApprovalMutationResponse,
  AuthorityApprovalRequest,
  AuthorityApprovalResolveRequest,
  AuthorityArtifactDeleteRequest,
  AuthorityArtifactMirrorSyncRequest,
  AuthorityArtifactUpsertRequest,
  AuthorityCompanyDispatchRequest,
  AuthorityCompanyDispatchResponse,
  AuthorityCompanyReportRequest,
  AuthorityCompanyReportResponse,
  AuthorityConversationStateDeleteRequest,
  AuthorityConversationStateUpsertRequest,
  AuthorityDecisionTicketCancelRequest,
  AuthorityDecisionTicketDeleteRequest,
  AuthorityDecisionTicketResolveRequest,
  AuthorityDecisionTicketUpsertRequest,
  AuthorityDispatchDeleteRequest,
  AuthorityDispatchUpsertRequest,
  AuthorityEvent,
  AuthorityMissionDeleteRequest,
  AuthorityMissionUpsertRequest,
  AuthorityRequirementPromoteRequest,
  AuthorityRequirementTransitionRequest,
  AuthorityRoundDeleteRequest,
  AuthorityRoundUpsertRequest,
  AuthorityRoomDeleteRequest,
  AuthorityRoomBindingsUpsertRequest,
  AuthoritySessionHistoryResponse,
  AuthoritySessionListResponse,
  AuthorityTakeoverCaseCommandRequest,
  AuthorityWorkItemDeleteRequest,
  AuthorityWorkItemUpsertRequest,
} from "../../../../src/infrastructure/authority/contract";
import { createCompanyEvent, type CompanyEvent } from "../../../../src/domain/delegation/events";
import { authorityBadRequest } from "../system/authority-error";
import type { AuthorityRouteResult } from "../system/authority-route-result";

type BroadcastType =
  | "bootstrap.updated"
  | "company.updated"
  | "conversation.updated"
  | "requirement.updated"
  | "room.updated"
  | "round.updated"
  | "dispatch.updated"
  | "artifact.updated"
  | "decision.updated";

export type AuthorityRuntimeCommandRouteDependencies = {
  listActors: () => unknown;
  proxyGatewayRequest: <T = unknown>(method: string, params?: unknown) => Promise<T>;
  runAgentFile: (input: {
    agentId: string;
    entryPath: string;
    payload?: Record<string, unknown>;
    timeoutMs?: number;
  }) => Promise<AuthorityAgentFileRunResponse>;
  requestApproval: (body: AuthorityApprovalRequest) => AuthorityApprovalMutationResponse;
  resolveApproval: (body: AuthorityApprovalResolveRequest) => AuthorityApprovalMutationResponse;
  transitionRequirement: (body: AuthorityRequirementTransitionRequest) => unknown;
  promoteRequirement: (body: AuthorityRequirementPromoteRequest) => unknown;
  upsertRoom: (body: AuthorityAppendRoomRequest) => unknown;
  deleteRoom: (body: AuthorityRoomDeleteRequest) => unknown;
  upsertRoomBindings: (body: AuthorityRoomBindingsUpsertRequest) => unknown;
  upsertRound: (body: AuthorityRoundUpsertRequest) => unknown;
  deleteRound: (body: AuthorityRoundDeleteRequest) => unknown;
  upsertMission: (body: AuthorityMissionUpsertRequest) => unknown;
  deleteMission: (body: AuthorityMissionDeleteRequest) => unknown;
  upsertConversationState: (body: AuthorityConversationStateUpsertRequest) => unknown;
  deleteConversationState: (body: AuthorityConversationStateDeleteRequest) => unknown;
  upsertWorkItem: (body: AuthorityWorkItemUpsertRequest) => unknown;
  deleteWorkItem: (body: AuthorityWorkItemDeleteRequest) => unknown;
  upsertDispatch: (body: AuthorityDispatchUpsertRequest) => unknown;
  deleteDispatch: (body: AuthorityDispatchDeleteRequest) => unknown;
  upsertArtifact: (body: AuthorityArtifactUpsertRequest) => unknown;
  syncArtifactMirrors: (body: AuthorityArtifactMirrorSyncRequest) => unknown;
  deleteArtifact: (body: AuthorityArtifactDeleteRequest) => unknown;
  upsertDecisionTicket: (body: AuthorityDecisionTicketUpsertRequest) => unknown;
  resolveDecisionTicket: (body: AuthorityDecisionTicketResolveRequest) => unknown;
  cancelDecisionTicket: (body: AuthorityDecisionTicketCancelRequest) => unknown;
  deleteDecisionTicket: (body: AuthorityDecisionTicketDeleteRequest) => unknown;
  transitionTakeoverCase: (body: AuthorityTakeoverCaseCommandRequest) => unknown;
  appendCompanyEvent: (event: CompanyEvent) => unknown;
  runCompanyDispatch: (body: AuthorityCompanyDispatchRequest) => Promise<AuthorityCompanyDispatchResponse> | AuthorityCompanyDispatchResponse;
  runCompanyReport: (body: AuthorityCompanyReportRequest) => Promise<AuthorityCompanyReportResponse> | AuthorityCompanyReportResponse;
};

export type AuthorityRuntimeCommandRouteResult = AuthorityRouteResult;

function buildBroadcast(
  type: BroadcastType,
  timestamp: number,
  companyId?: string | null,
): AuthorityEvent {
  return companyId
    ? { type, companyId, timestamp }
    : { type, timestamp };
}

function buildBroadcasts(
  timestamp: number,
  types: BroadcastType[],
  companyId?: string | null,
): AuthorityEvent[] {
  return types.map((type) => buildBroadcast(type, timestamp, companyId));
}

function readOptionalString(value: string | null): string | null {
  if (typeof value !== "string") {
    return null;
  }
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

function readOptionalFiniteInt(value: string | null): number | undefined {
  if (typeof value !== "string" || value.trim().length === 0) {
    return undefined;
  }
  const parsed = Number.parseInt(value, 10);
  return Number.isFinite(parsed) ? parsed : undefined;
}

async function resolveSimpleCompanyCommandRoute<TBody>(input: {
  method?: string;
  pathname: string;
  expectedPath: string;
  request: IncomingMessage;
  readJsonBody: <T>(request: IncomingMessage) => Promise<T>;
  run: (body: TBody) => unknown | Promise<unknown>;
  companyId: (body: TBody) => string;
  scheduleReason?: string;
  broadcastTypes: BroadcastType[];
  now: () => number;
}): Promise<AuthorityRuntimeCommandRouteResult | null> {
  const {
    method,
    pathname,
    expectedPath,
    request,
    readJsonBody,
    run,
    companyId,
    scheduleReason,
    broadcastTypes,
    now,
  } = input;

  if (method !== "POST" || pathname !== expectedPath) {
    return null;
  }

  const body = await readJsonBody<TBody>(request);
  const nextCompanyId = companyId(body);
  return {
    status: 200,
    payload: await run(body),
    postCommit: {
      schedule: scheduleReason ? { reason: scheduleReason, companyId: nextCompanyId } : undefined,
      broadcasts: buildBroadcasts(now(), broadcastTypes, nextCompanyId),
    },
  };
}

export async function resolveAuthorityRuntimeCommandRoute(input: {
  method?: string;
  url: URL;
  request: IncomingMessage;
  readJsonBody: <T>(request: IncomingMessage) => Promise<T>;
  deps: AuthorityRuntimeCommandRouteDependencies;
  now?: () => number;
}): Promise<AuthorityRuntimeCommandRouteResult | null> {
  const { method, url, request, readJsonBody, deps, now = Date.now } = input;
  const { pathname } = url;

  if (method === "GET" && pathname === "/actors") {
    return {
      status: 200,
      payload: deps.listActors(),
    };
  }

  if (method === "GET" && pathname === "/sessions") {
    const agentId = readOptionalString(url.searchParams.get("agentId"));
    const limit = readOptionalFiniteInt(url.searchParams.get("limit"));
    const search = readOptionalString(url.searchParams.get("search"));
    return {
      status: 200,
      payload: await deps.proxyGatewayRequest<AuthoritySessionListResponse>("sessions.list", {
        ...(agentId ? { agentId } : {}),
        ...(typeof limit === "number" ? { limit } : {}),
        ...(search ? { search } : {}),
      }),
    };
  }

  if (method === "GET" && pathname.startsWith("/sessions/") && pathname.endsWith("/history")) {
    const sessionKey = decodeURIComponent(pathname.replace(/^\/sessions\//, "").replace(/\/history$/, ""));
    const limit = readOptionalFiniteInt(url.searchParams.get("limit"));
    return {
      status: 200,
      payload: await deps.proxyGatewayRequest<AuthoritySessionHistoryResponse>("chat.history", {
        sessionKey,
        ...(typeof limit === "number" ? { limit } : {}),
      }),
    };
  }

  if (method === "POST" && pathname.startsWith("/sessions/") && pathname.endsWith("/reset")) {
    const sessionKey = decodeURIComponent(pathname.replace(/^\/sessions\//, "").replace(/\/reset$/, ""));
    return {
      status: 200,
      payload: await deps.proxyGatewayRequest("sessions.reset", { key: sessionKey }),
      postCommit: {
        broadcasts: buildBroadcasts(now(), ["conversation.updated"]),
      },
    };
  }

  if (method === "DELETE" && pathname.startsWith("/sessions/")) {
    const sessionKey = decodeURIComponent(pathname.replace(/^\/sessions\//, ""));
    return {
      status: 200,
      payload: await deps.proxyGatewayRequest("sessions.delete", { key: sessionKey }),
      postCommit: {
        broadcasts: buildBroadcasts(now(), ["conversation.updated"]),
      },
    };
  }

  if (method === "GET" && pathname.startsWith("/agents/") && pathname.endsWith("/files")) {
    const agentId = decodeURIComponent(pathname.replace(/^\/agents\//, "").replace(/\/files$/, ""));
    return {
      status: 200,
      payload: await deps.proxyGatewayRequest("agents.files.list", { agentId }),
    };
  }

  if (method === "GET" && pathname.startsWith("/agents/") && pathname.includes("/files/")) {
    const [, , agentId, , ...nameParts] = pathname.split("/");
    return {
      status: 200,
      payload: await deps.proxyGatewayRequest("agents.files.get", {
        agentId: decodeURIComponent(agentId),
        name: decodeURIComponent(nameParts.join("/")),
      }),
    };
  }

  if (method === "PUT" && pathname.startsWith("/agents/") && pathname.includes("/files/")) {
    const [, , agentId, , ...nameParts] = pathname.split("/");
    const body = await readJsonBody<{ content: string }>(request);
    return {
      status: 200,
      payload: await deps.proxyGatewayRequest("agents.files.set", {
        agentId: decodeURIComponent(agentId),
        name: decodeURIComponent(nameParts.join("/")),
        content: body.content,
      }),
      postCommit: {
        broadcasts: buildBroadcasts(now(), ["artifact.updated"]),
      },
    };
  }

  if (method === "POST" && pathname.startsWith("/agents/") && pathname.endsWith("/run")) {
    const agentId = decodeURIComponent(pathname.replace(/^\/agents\//, "").replace(/\/run$/, ""));
    const body = await readJsonBody<Omit<AuthorityAgentFileRunRequest, "agentId">>(request);
    if (!body.entryPath) {
      throw authorityBadRequest("agent file run requires entryPath");
    }
    return {
      status: 200,
      payload: await deps.runAgentFile({
        agentId,
        entryPath: body.entryPath,
        payload:
          body.payload && typeof body.payload === "object" && !Array.isArray(body.payload)
            ? (body.payload as Record<string, unknown>)
            : undefined,
        timeoutMs: body.timeoutMs,
      }),
    };
  }

  const simpleCommandRoute =
    (await resolveSimpleCompanyCommandRoute({
      method,
      pathname,
      expectedPath: "/commands/approval.request",
      request,
      readJsonBody,
      run: (body: AuthorityApprovalRequest) => deps.requestApproval(body),
      companyId: (body) => body.companyId,
      broadcastTypes: ["bootstrap.updated", "company.updated"],
      now,
    }))
    ?? (await resolveSimpleCompanyCommandRoute({
      method,
      pathname,
      expectedPath: "/commands/approval.resolve",
      request,
      readJsonBody,
      run: (body: AuthorityApprovalResolveRequest) => deps.resolveApproval(body),
      companyId: (body) => body.companyId,
      broadcastTypes: ["bootstrap.updated", "company.updated"],
      now,
    }))
    ?? (await resolveSimpleCompanyCommandRoute({
      method,
      pathname,
      expectedPath: "/commands/requirement.transition",
      request,
      readJsonBody,
      run: (body: AuthorityRequirementTransitionRequest) => deps.transitionRequirement(body),
      companyId: (body) => body.companyId,
      scheduleReason: "requirement.transition",
      broadcastTypes: ["requirement.updated"],
      now,
    }))
    ?? (await resolveSimpleCompanyCommandRoute({
      method,
      pathname,
      expectedPath: "/commands/requirement.promote",
      request,
      readJsonBody,
      run: (body: AuthorityRequirementPromoteRequest) => deps.promoteRequirement(body),
      companyId: (body) => body.companyId,
      scheduleReason: "requirement.promote",
      broadcastTypes: ["requirement.updated"],
      now,
    }))
    ?? (await resolveSimpleCompanyCommandRoute({
      method,
      pathname,
      expectedPath: "/commands/room.append",
      request,
      readJsonBody,
      run: (body: AuthorityAppendRoomRequest) => deps.upsertRoom(body),
      companyId: (body) => body.companyId,
      scheduleReason: "room.append",
      broadcastTypes: ["room.updated"],
      now,
    }))
    ?? (await resolveSimpleCompanyCommandRoute({
      method,
      pathname,
      expectedPath: "/commands/room.delete",
      request,
      readJsonBody,
      run: (body: AuthorityRoomDeleteRequest) => deps.deleteRoom(body),
      companyId: (body) => body.companyId,
      scheduleReason: "room.delete",
      broadcastTypes: ["room.updated"],
      now,
    }))
    ?? (await resolveSimpleCompanyCommandRoute({
      method,
      pathname,
      expectedPath: "/commands/room-bindings.upsert",
      request,
      readJsonBody,
      run: (body: AuthorityRoomBindingsUpsertRequest) => deps.upsertRoomBindings(body),
      companyId: (body) => body.companyId,
      scheduleReason: "room-bindings.upsert",
      broadcastTypes: ["room.updated"],
      now,
    }))
    ?? (await resolveSimpleCompanyCommandRoute({
      method,
      pathname,
      expectedPath: "/commands/round.upsert",
      request,
      readJsonBody,
      run: (body: AuthorityRoundUpsertRequest) => deps.upsertRound(body),
      companyId: (body) => body.companyId,
      scheduleReason: "round.upsert",
      broadcastTypes: ["round.updated"],
      now,
    }))
    ?? (await resolveSimpleCompanyCommandRoute({
      method,
      pathname,
      expectedPath: "/commands/round.delete",
      request,
      readJsonBody,
      run: (body: AuthorityRoundDeleteRequest) => deps.deleteRound(body),
      companyId: (body) => body.companyId,
      scheduleReason: "round.delete",
      broadcastTypes: ["round.updated"],
      now,
    }))
    ?? (await resolveSimpleCompanyCommandRoute({
      method,
      pathname,
      expectedPath: "/commands/mission.upsert",
      request,
      readJsonBody,
      run: (body: AuthorityMissionUpsertRequest) => deps.upsertMission(body),
      companyId: (body) => body.companyId,
      scheduleReason: "mission.upsert",
      broadcastTypes: ["conversation.updated"],
      now,
    }))
    ?? (await resolveSimpleCompanyCommandRoute({
      method,
      pathname,
      expectedPath: "/commands/mission.delete",
      request,
      readJsonBody,
      run: (body: AuthorityMissionDeleteRequest) => deps.deleteMission(body),
      companyId: (body) => body.companyId,
      scheduleReason: "mission.delete",
      broadcastTypes: ["conversation.updated"],
      now,
    }))
    ?? (await resolveSimpleCompanyCommandRoute({
      method,
      pathname,
      expectedPath: "/commands/conversation-state.upsert",
      request,
      readJsonBody,
      run: (body: AuthorityConversationStateUpsertRequest) => deps.upsertConversationState(body),
      companyId: (body) => body.companyId,
      scheduleReason: "conversation-state.upsert",
      broadcastTypes: ["conversation.updated"],
      now,
    }))
    ?? (await resolveSimpleCompanyCommandRoute({
      method,
      pathname,
      expectedPath: "/commands/conversation-state.delete",
      request,
      readJsonBody,
      run: (body: AuthorityConversationStateDeleteRequest) => deps.deleteConversationState(body),
      companyId: (body) => body.companyId,
      scheduleReason: "conversation-state.delete",
      broadcastTypes: ["conversation.updated"],
      now,
    }))
    ?? (await resolveSimpleCompanyCommandRoute({
      method,
      pathname,
      expectedPath: "/commands/work-item.upsert",
      request,
      readJsonBody,
      run: (body: AuthorityWorkItemUpsertRequest) => deps.upsertWorkItem(body),
      companyId: (body) => body.companyId,
      scheduleReason: "work-item.upsert",
      broadcastTypes: ["conversation.updated"],
      now,
    }))
    ?? (await resolveSimpleCompanyCommandRoute({
      method,
      pathname,
      expectedPath: "/commands/work-item.delete",
      request,
      readJsonBody,
      run: (body: AuthorityWorkItemDeleteRequest) => deps.deleteWorkItem(body),
      companyId: (body) => body.companyId,
      scheduleReason: "work-item.delete",
      broadcastTypes: ["conversation.updated"],
      now,
    }))
    ?? (await resolveSimpleCompanyCommandRoute({
      method,
      pathname,
      expectedPath: "/commands/dispatch.create",
      request,
      readJsonBody,
      run: (body: AuthorityDispatchUpsertRequest) => deps.upsertDispatch(body),
      companyId: (body) => body.companyId,
      scheduleReason: "dispatch.create",
      broadcastTypes: ["dispatch.updated"],
      now,
    }))
    ?? (await resolveSimpleCompanyCommandRoute({
      method,
      pathname,
      expectedPath: "/commands/dispatch.delete",
      request,
      readJsonBody,
      run: (body: AuthorityDispatchDeleteRequest) => deps.deleteDispatch(body),
      companyId: (body) => body.companyId,
      scheduleReason: "dispatch.delete",
      broadcastTypes: ["dispatch.updated"],
      now,
    }))
    ?? (await resolveSimpleCompanyCommandRoute({
      method,
      pathname,
      expectedPath: "/commands/artifact.upsert",
      request,
      readJsonBody,
      run: (body: AuthorityArtifactUpsertRequest) => deps.upsertArtifact(body),
      companyId: (body) => body.companyId,
      scheduleReason: "artifact.upsert",
      broadcastTypes: ["artifact.updated"],
      now,
    }))
    ?? (await resolveSimpleCompanyCommandRoute({
      method,
      pathname,
      expectedPath: "/commands/artifact.sync-mirror",
      request,
      readJsonBody,
      run: (body: AuthorityArtifactMirrorSyncRequest) => deps.syncArtifactMirrors(body),
      companyId: (body) => body.companyId,
      scheduleReason: "artifact.sync-mirror",
      broadcastTypes: ["artifact.updated"],
      now,
    }))
    ?? (await resolveSimpleCompanyCommandRoute({
      method,
      pathname,
      expectedPath: "/commands/artifact.delete",
      request,
      readJsonBody,
      run: (body: AuthorityArtifactDeleteRequest) => deps.deleteArtifact(body),
      companyId: (body) => body.companyId,
      scheduleReason: "artifact.delete",
      broadcastTypes: ["artifact.updated"],
      now,
    }))
    ?? (await resolveSimpleCompanyCommandRoute({
      method,
      pathname,
      expectedPath: "/commands/decision.upsert",
      request,
      readJsonBody,
      run: (body: AuthorityDecisionTicketUpsertRequest) => deps.upsertDecisionTicket(body),
      companyId: (body) => body.companyId,
      scheduleReason: "decision.upsert",
      broadcastTypes: ["decision.updated"],
      now,
    }))
    ?? (await resolveSimpleCompanyCommandRoute({
      method,
      pathname,
      expectedPath: "/commands/decision.resolve",
      request,
      readJsonBody,
      run: (body: AuthorityDecisionTicketResolveRequest) => deps.resolveDecisionTicket(body),
      companyId: (body) => body.companyId,
      scheduleReason: "decision.resolve",
      broadcastTypes: ["decision.updated"],
      now,
    }))
    ?? (await resolveSimpleCompanyCommandRoute({
      method,
      pathname,
      expectedPath: "/commands/decision.cancel",
      request,
      readJsonBody,
      run: (body: AuthorityDecisionTicketCancelRequest) => deps.cancelDecisionTicket(body),
      companyId: (body) => body.companyId,
      scheduleReason: "decision.cancel",
      broadcastTypes: ["decision.updated"],
      now,
    }))
    ?? (await resolveSimpleCompanyCommandRoute({
      method,
      pathname,
      expectedPath: "/commands/decision.delete",
      request,
      readJsonBody,
      run: (body: AuthorityDecisionTicketDeleteRequest) => deps.deleteDecisionTicket(body),
      companyId: (body) => body.companyId,
      scheduleReason: "decision.delete",
      broadcastTypes: ["decision.updated"],
      now,
    }))
    ?? (await resolveSimpleCompanyCommandRoute({
      method,
      pathname,
      expectedPath: "/commands/takeover.transition",
      request,
      readJsonBody,
      run: (body: AuthorityTakeoverCaseCommandRequest) => deps.transitionTakeoverCase(body),
      companyId: (body) => body.companyId,
      scheduleReason: "takeover.transition",
      broadcastTypes: ["bootstrap.updated", "company.updated"],
      now,
    }));

  if (simpleCommandRoute) {
    return simpleCommandRoute;
  }

  if (method === "POST" && pathname === "/commands/company.dispatch") {
    const body = await readJsonBody<AuthorityCompanyDispatchRequest>(request);
    const timestamp = now();
    const result = await deps.runCompanyDispatch(body);
    return {
      status: 200,
      payload: result,
      postCommit: {
        broadcasts: buildBroadcasts(
          timestamp,
          ["company.updated", "dispatch.updated", "conversation.updated"],
          body.companyId,
        ),
      },
    };
  }

  if (method === "POST" && pathname === "/commands/company.report") {
    const body = await readJsonBody<AuthorityCompanyReportRequest>(request);
    const timestamp = now();
    const result = await deps.runCompanyReport(body);
    return {
      status: 200,
      payload: result,
      postCommit: {
        broadcasts: buildBroadcasts(
          timestamp,
          ["company.updated", "dispatch.updated", "conversation.updated"],
          body.companyId,
        ),
      },
    };
  }

  if (method === "POST" && pathname === "/commands/company-event.append") {
    const body = await readJsonBody<AuthorityAppendCompanyEventRequest>(request);
    const event = createCompanyEvent({
      ...body.event,
      fromActorId:
        typeof body.event.fromActorId === "string" && body.event.fromActorId.trim().length > 0
          ? body.event.fromActorId.trim()
          : "system:authority-command",
      payload:
        body.event.payload && typeof body.event.payload === "object" && !Array.isArray(body.event.payload)
          ? body.event.payload
          : {},
    });
    const timestamp = now();
    const broadcasts = buildBroadcasts(timestamp, ["company.updated"], event.companyId);
    if (
      event.kind.startsWith("dispatch_") ||
      event.kind.startsWith("report_") ||
      event.kind.startsWith("subtask_")
    ) {
      broadcasts.push(buildBroadcast("dispatch.updated", timestamp, event.companyId));
    }
    return {
      status: 200,
      payload: deps.appendCompanyEvent(event),
      postCommit: {
        broadcasts,
      },
    };
  }

  return null;
}
