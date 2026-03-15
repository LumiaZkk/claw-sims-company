import { buildDelegationDispatchMessage } from "../../../../src/application/delegation/dispatch-policy";
import { createCompanyEvent, type CompanyEvent } from "../../../../src/domain/delegation/events";
import type { DispatchRecord } from "../../../../src/domain/delegation/types";
import { buildWorkItemIdentity } from "../../../../src/domain/mission/work-item-identity";
import type {
  AuthorityCollaborationScopeResponse,
  AuthorityCompanyDispatchRequest,
  AuthorityCompanyDispatchResponse,
  AuthorityCompanyReportRequest,
  AuthorityCompanyReportResponse,
  AuthorityCompanyRuntimeSnapshot,
} from "../../../../src/infrastructure/authority/contract";
import { authorityBadRequest, authorityNotFound } from "../system/authority-error";

type CompanyDispatchRepository = {
  hasCompany: (companyId: string) => boolean;
  getCollaborationScope: (companyId: string, agentId: string) => AuthorityCollaborationScopeResponse;
  loadRuntime: (companyId: string) => AuthorityCompanyRuntimeSnapshot;
  appendCompanyEvent: (event: CompanyEvent) => unknown;
};

type CompanyDispatchCommandDeps = {
  repository: CompanyDispatchRepository;
  proxyGatewayRequest: <T = unknown>(method: string, params?: unknown) => Promise<T>;
  now?: () => number;
  randomUUID?: () => string;
};

function readOptionalString(value: unknown): string | null {
  if (typeof value !== "string") {
    return null;
  }
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

function readRequiredString(value: unknown, label: string): string {
  const trimmed = readOptionalString(value);
  if (!trimmed) {
    throw authorityBadRequest(`${label} required`);
  }
  return trimmed;
}

function isDuplicateCompanyEventError(error: unknown) {
  const message = error instanceof Error ? error.message : String(error);
  return /UNIQUE constraint failed: event_log\.event_id/i.test(message);
}

function appendCompanyEventSafe(repository: CompanyDispatchRepository, event: CompanyEvent) {
  try {
    repository.appendCompanyEvent(event);
    return { ok: true as const, duplicate: false as const };
  } catch (error) {
    if (isDuplicateCompanyEventError(error)) {
      return { ok: true as const, duplicate: true as const };
    }
    throw error;
  }
}

function resolveDispatchMessage(input: {
  companyId: string;
  dispatchId: string;
  fromActorId: string;
  targetActorId: string;
  message: string;
}): string {
  const envelope = [
    "[company_dispatch]",
    `companyId=${input.companyId}`,
    `dispatchId=${input.dispatchId}`,
    `fromActorId=${input.fromActorId}`,
    `targetActorId=${input.targetActorId}`,
    "reportContract=use company_report with these exact ids",
    "reportStateGuide=acknowledged_only_if_still_working;answered_if_output_ready;blocked_if_owner_input_needed",
  ].join(" ");
  return `${envelope}\n${buildDelegationDispatchMessage(input.message, input.dispatchId)}`.trim();
}

function resolveReportMessage(input: {
  dispatchId: string;
  status: "acknowledged" | "answered" | "blocked";
  summary: string;
  details?: string | null;
}): string {
  const header = `[company_report:${input.status}] dispatch=${input.dispatchId}`;
  const detail = readOptionalString(input.details) ?? null;
  return `${header}\n${detail ? `${input.summary}\n${detail}` : input.summary}`.trim();
}

function resolveAllowedTargets(scope: AuthorityCollaborationScopeResponse) {
  return new Set(scope.allowedDispatchTargets.map((target) => target.agentId));
}

function resolveDispatchRecord(runtime: AuthorityCompanyRuntimeSnapshot, dispatchId: string): DispatchRecord | null {
  return runtime.activeDispatches.find((dispatch) => dispatch.id === dispatchId) ?? null;
}

export async function runAuthorityCompanyDispatchCommand(input: {
  body: AuthorityCompanyDispatchRequest;
  deps: CompanyDispatchCommandDeps;
}): Promise<AuthorityCompanyDispatchResponse> {
  const { body, deps } = input;
  const now = deps.now ?? Date.now;
  const randomUUID = deps.randomUUID ?? (() => crypto.randomUUID());

  const companyId = readRequiredString(body.companyId, "companyId");
  if (!deps.repository.hasCompany(companyId)) {
    throw authorityNotFound(`Unknown company: ${companyId}`);
  }
  const fromActorId = readRequiredString(body.fromActorId, "fromActorId");
  const targetActorId = readRequiredString(body.targetActorId, "targetActorId");

  const scope = deps.repository.getCollaborationScope(companyId, fromActorId);
  if (!resolveAllowedTargets(scope).has(targetActorId)) {
    throw authorityBadRequest(`Dispatch target not allowed: ${targetActorId}`);
  }

  const title =
    readOptionalString(body.title) ??
    readOptionalString(body.summary) ??
    readOptionalString(body.message) ??
    "Company dispatch";
  const message =
    readOptionalString(body.message) ??
    readOptionalString(body.summary) ??
    readOptionalString(body.title);
  if (!message) {
    throw authorityBadRequest("message required");
  }
  const summary = readOptionalString(body.summary) ?? message ?? title;

  const timestamp = typeof body.createdAt === "number" ? body.createdAt : now();
  const identity = buildWorkItemIdentity({
    topicKey: readOptionalString(body.topicKey),
    title,
    fallbackId: `work:${fromActorId}:${targetActorId}:${timestamp}`,
    startedAt: timestamp,
    updatedAt: timestamp,
  });
  const workItemId = readOptionalString(body.workItemId) ?? identity.id;
  const topicKey = readOptionalString(body.topicKey) ?? identity.topicKey ?? undefined;
  const dispatchId = readOptionalString(body.dispatchId) ?? `dispatch:${workItemId}:${timestamp}`;
  const sessionKey = `agent:${targetActorId}:main`;
  const roomId = readOptionalString(body.roomId) ?? undefined;
  const sourceStepId =
    readOptionalString(body.sourceStepId) ??
    readOptionalString(body.sourceMessageId) ??
    undefined;

  const payload = {
    title,
    message,
    summary,
    sourceStepId,
    handoff: body.handoff === true,
  };

  appendCompanyEventSafe(
    deps.repository,
    createCompanyEvent({
      eventId: `dispatch_enqueued:${dispatchId}`,
      companyId,
      kind: "dispatch_enqueued",
      dispatchId,
      workItemId,
      topicKey,
      roomId,
      fromActorId,
      targetActorId,
      sessionKey,
      createdAt: timestamp,
      payload,
    }),
  );

  let runId: string | null = null;
  try {
    const ack = await deps.proxyGatewayRequest<{ runId?: string }>("chat.send", {
      sessionKey,
      message: resolveDispatchMessage({
        companyId,
        dispatchId,
        fromActorId,
        targetActorId,
        message,
      }),
      deliver: false,
      ...(body.attachments ? { attachments: body.attachments } : {}),
      ...(typeof body.timeoutMs === "number" ? { timeoutMs: body.timeoutMs } : {}),
      idempotencyKey: randomUUID(),
    });
    runId = typeof ack?.runId === "string" ? ack.runId : null;

    appendCompanyEventSafe(
      deps.repository,
      createCompanyEvent({
        eventId: `dispatch_sent:${dispatchId}`,
        companyId,
        kind: "dispatch_sent",
        dispatchId,
        workItemId,
        topicKey,
        roomId,
        fromActorId,
        targetActorId,
        sessionKey,
        providerRunId: runId ?? undefined,
        createdAt: now(),
        payload,
      }),
    );

    return {
      ok: true,
      dispatchId,
      workItemId,
      sessionKey,
      runId,
      status: "sent",
    };
  } catch (error) {
    const messageText = error instanceof Error ? error.message : String(error);
    appendCompanyEventSafe(
      deps.repository,
      createCompanyEvent({
        eventId: `dispatch_blocked:${dispatchId}`,
        companyId,
        kind: "dispatch_blocked",
        dispatchId,
        workItemId,
        topicKey,
        roomId,
        fromActorId,
        targetActorId,
        sessionKey,
        createdAt: now(),
        payload: {
          ...payload,
          error: messageText,
        },
      }),
    );
    return {
      ok: true,
      dispatchId,
      workItemId,
      sessionKey,
      runId: null,
      status: "blocked",
      error: messageText,
    };
  }
}

export async function runAuthorityCompanyReportCommand(input: {
  body: AuthorityCompanyReportRequest;
  deps: CompanyDispatchCommandDeps;
}): Promise<AuthorityCompanyReportResponse> {
  const { body, deps } = input;
  const now = deps.now ?? Date.now;
  const randomUUID = deps.randomUUID ?? (() => crypto.randomUUID());

  const companyId = readRequiredString(body.companyId, "companyId");
  if (!deps.repository.hasCompany(companyId)) {
    throw authorityNotFound(`Unknown company: ${companyId}`);
  }

  const dispatchId = readRequiredString(body.dispatchId, "dispatchId");
  const fromActorId = readRequiredString(body.fromActorId, "fromActorId");
  const status = body.status;
  if (status !== "acknowledged" && status !== "answered" && status !== "blocked") {
    throw authorityBadRequest("status must be acknowledged, answered, or blocked");
  }

  const runtime = deps.repository.loadRuntime(companyId);
  const dispatch = resolveDispatchRecord(runtime, dispatchId);
  if (!dispatch) {
    throw authorityNotFound(`Unknown dispatch: ${dispatchId}`);
  }

  if (!dispatch.targetActorIds.includes(fromActorId)) {
    throw authorityBadRequest(`Dispatch reporter not allowed: ${fromActorId}`);
  }

  const targetActorId =
    readOptionalString(body.targetActorId) ??
    readOptionalString(dispatch.fromActorId) ??
    null;
  if (!targetActorId) {
    throw authorityBadRequest("dispatch owner missing");
  }

  const summary =
    readOptionalString(body.summary) ??
    readOptionalString(body.details) ??
    "已回执";
  const details = readOptionalString(body.details);

  const timestamp = typeof body.createdAt === "number" ? body.createdAt : now();
  const eventId = `report:${dispatchId}:${status}:${fromActorId}:${timestamp}`;
  const reportEvent = createCompanyEvent({
    eventId,
    companyId,
    kind: `report_${status}`,
    dispatchId,
    workItemId: dispatch.workItemId,
    topicKey: dispatch.topicKey ?? undefined,
    roomId: dispatch.roomId ?? undefined,
    fromActorId,
    targetActorId,
    sessionKey: `agent:${fromActorId}:main`,
    createdAt: timestamp,
    payload: {
      title: dispatch.title,
      summary,
      details,
      message: summary,
      transport: "company_report",
    },
  });
  appendCompanyEventSafe(deps.repository, reportEvent);

  const sessionKey = `agent:${targetActorId}:main`;
  const reportMessage = resolveReportMessage({
    dispatchId,
    status,
    summary,
    details,
  });

  try {
    const ack = await deps.proxyGatewayRequest<{ runId?: string }>("chat.send", {
      sessionKey,
      message: reportMessage,
      deliver: false,
      ...(typeof body.timeoutMs === "number" ? { timeoutMs: body.timeoutMs } : {}),
      idempotencyKey: randomUUID(),
    });
    const runId = typeof ack?.runId === "string" ? ack.runId : null;
    return {
      ok: true,
      dispatchId,
      status,
      eventId,
      sessionKey,
      runId,
    };
  } catch (error) {
    const messageText = error instanceof Error ? error.message : String(error);
    return {
      ok: true,
      dispatchId,
      status,
      eventId,
      sessionKey,
      runId: null,
      error: messageText,
    };
  }
}
