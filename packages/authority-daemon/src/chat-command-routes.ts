import type { IncomingMessage } from "node:http";
import type {
  AuthorityChatSendRequest,
  AuthorityEvent,
} from "../../../src/infrastructure/authority/contract";
import type { AuthorityRouteResult } from "./authority-route-result";
import type { AuthorityChatSendCommandResult } from "./chat-send-command";

export type AuthorityChatCommandRouteDependencies = {
  runChatSendCommand: (input: {
    body: AuthorityChatSendRequest;
  }) => Promise<AuthorityChatSendCommandResult>;
};

function buildRuntimeBroadcast(
  companyId: string,
  runtimeEvent: AuthorityChatSendCommandResult["runtimeEvent"],
): AuthorityEvent {
  return {
    type: "agent.runtime.updated",
    companyId,
    timestamp: runtimeEvent.timestamp,
    payload: {
      event: runtimeEvent,
    },
  };
}

export async function resolveAuthorityChatCommandRoute(input: {
  method?: string;
  pathname: string;
  request: IncomingMessage;
  readJsonBody: <T>(request: IncomingMessage) => Promise<T>;
  deps: AuthorityChatCommandRouteDependencies;
}): Promise<AuthorityRouteResult | null> {
  const { method, pathname, request, readJsonBody, deps } = input;
  if (!(method === "POST" && pathname === "/commands/chat.send")) {
    return null;
  }

  const body = await readJsonBody<AuthorityChatSendRequest>(request);
  const result = await deps.runChatSendCommand({
    body,
  });

  return {
    status: 200,
    payload: result.response,
    postCommit: {
      broadcasts: [
        buildRuntimeBroadcast(body.companyId, result.runtimeEvent),
        ...result.broadcasts,
      ],
    },
  };
}
