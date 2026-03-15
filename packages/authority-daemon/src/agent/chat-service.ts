import type { AuthorityRepository } from "../persistence/authority-repository";
import { EXECUTOR_PROVIDER_ID } from "../persistence/authority-persistence-shared";
import type { AuthorityChatCommandRouteDependencies } from "./chat-command-routes";
import { runAuthorityChatSendCommand } from "./chat-send-command";

export function createAuthorityChatService(input: {
  repository: AuthorityRepository;
  proxyGatewayRequest: <T = unknown>(method: string, params?: unknown) => Promise<T>;
}): AuthorityChatCommandRouteDependencies {
  return {
    runChatSendCommand: ({ body }) =>
      runAuthorityChatSendCommand({
        body,
        deps: {
          repository: input.repository,
          proxyGatewayRequest: input.proxyGatewayRequest,
          providerId: EXECUTOR_PROVIDER_ID,
        },
      }),
  };
}
