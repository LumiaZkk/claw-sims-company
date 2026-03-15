import type {
  AuthorityChatSendRequest,
  AuthorityChatSendResponse,
  AuthorityEvent,
} from "../../../../src/infrastructure/authority/contract";
import type { ProviderRuntimeEvent } from "../../../../src/infrastructure/gateway/runtime/types";
import { authorityNotFound } from "../system/authority-error";

type AuthorityChatSendRepository = {
  hasCompany: (companyId: string) => boolean;
  beginChatDispatch: (input: AuthorityChatSendRequest) => {
    sessionKey: string;
    now: number;
  };
  createExecutorRun: (input: {
    runId: string;
    companyId: string;
    actorId: string;
    sessionKey: string;
    startedAt?: number;
    payload?: Record<string, unknown>;
  }) => void;
  applyRuntimeEvent: (companyId: string, event: ProviderRuntimeEvent) => void;
};

export type AuthorityChatSendCommandResult = {
  response: AuthorityChatSendResponse;
  runtimeEvent: ProviderRuntimeEvent;
  broadcasts: AuthorityEvent[];
};

export async function runAuthorityChatSendCommand(input: {
  body: AuthorityChatSendRequest;
  deps: {
    repository: AuthorityChatSendRepository;
    proxyGatewayRequest: <T = unknown>(method: string, params?: unknown) => Promise<T>;
    providerId: string;
    randomUUID?: () => string;
    now?: () => number;
  };
}): Promise<AuthorityChatSendCommandResult> {
  const {
    body,
    deps: {
      repository,
      proxyGatewayRequest,
      providerId,
      randomUUID = () => crypto.randomUUID(),
      now = Date.now,
    },
  } = input;

  if (!repository.hasCompany(body.companyId)) {
    throw authorityNotFound(`Unknown company: ${body.companyId}`);
  }

  const dispatch = repository.beginChatDispatch(body);
  const gatewayAck = await proxyGatewayRequest<Omit<AuthorityChatSendResponse, "sessionKey">>(
    "chat.send",
    {
      sessionKey: dispatch.sessionKey,
      message: body.message,
      deliver: false,
      ...(typeof body.timeoutMs === "number" ? { timeoutMs: body.timeoutMs } : {}),
      ...(body.attachments ? { attachments: body.attachments } : {}),
      idempotencyKey: randomUUID(),
    },
  );
  const response: AuthorityChatSendResponse = {
    ...gatewayAck,
    sessionKey: dispatch.sessionKey,
  };

  repository.createExecutorRun({
    runId: response.runId,
    companyId: body.companyId,
    actorId: body.actorId,
    sessionKey: dispatch.sessionKey,
    startedAt: dispatch.now,
    payload: {
      request: body.message,
      attachments: body.attachments ?? [],
    },
  });

  const runtimeEvent: ProviderRuntimeEvent = {
    providerId,
    agentId: body.actorId,
    sessionKey: dispatch.sessionKey,
    runId: response.runId,
    streamKind: "lifecycle",
    runState: "accepted",
    timestamp: dispatch.now,
    raw: response,
  };
  repository.applyRuntimeEvent(body.companyId, runtimeEvent);

  return {
    response,
    runtimeEvent,
    broadcasts: [
      {
        type: "conversation.updated",
        companyId: body.companyId,
        timestamp: now(),
      },
    ],
  };
}
