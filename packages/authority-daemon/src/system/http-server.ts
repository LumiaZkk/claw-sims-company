import { createServer, type IncomingMessage, type Server, type ServerResponse } from "node:http";
import type { AuthorityRouteDispatchSideEffects } from "./authority-http-route-dispatch";
import {
  sendAuthorityCaughtError,
  sendAuthorityError,
  sendAuthorityJson,
} from "./authority-http-route-dispatch";
import {
  handleAuthorityHttpRoute,
  type AuthorityRouteRegistryDependencies,
} from "./authority-route-registry";

type CodexAuthResult = {
  profileId?: string;
  syncedAgentIds?: string[];
  changed?: boolean;
  gatewayRefresh?: unknown;
  accountId?: string | null;
};

export function createAuthorityHttpServer(input: {
  readJsonBody: <T>(request: IncomingMessage) => Promise<T>;
  setCorsHeaders: (response: ServerResponse) => void;
  stringifyError: (error: unknown) => string;
  syncCompanyCodexAuth: (companyId: string, source: "cli" | "gateway") => Promise<CodexAuthResult>;
  routeDeps: Omit<AuthorityRouteRegistryDependencies, "sideEffects">;
  sideEffects: AuthorityRouteDispatchSideEffects;
  attachWebsocketBroadcast: (server: Server) => void;
}) {
  const server = createServer(async (request, response) => {
    input.setCorsHeaders(response);
    if (request.method === "OPTIONS") {
      response.statusCode = 204;
      response.end();
      return;
    }

    const url = new URL(request.url ?? "/", `http://${request.headers.host ?? "127.0.0.1"}`);
    try {
      const companyCodexAuthMatch = request.method === "POST"
        ? /^\/companies\/([^/]+)\/codex-auth\/sync$/u.exec(url.pathname)
        : null;
      if (companyCodexAuthMatch) {
        try {
          const companyId = decodeURIComponent(companyCodexAuthMatch[1] ?? "");
          const source = url.searchParams.get("source") === "gateway" ? "gateway" : "cli";
          const result = await input.syncCompanyCodexAuth(companyId, source);
          sendAuthorityJson(response, 200, {
            ok: true,
            companyId,
            source,
            profileId: result.profileId,
            syncedAgentIds: result.syncedAgentIds,
            changed: result.changed,
            ...("gatewayRefresh" in result ? { gatewayRefresh: result.gatewayRefresh } : {}),
            ...(result.accountId ? { accountId: result.accountId } : {}),
          });
        } catch (error) {
          sendAuthorityError(response, 400, input.stringifyError(error));
        }
        return;
      }

      if (
        await handleAuthorityHttpRoute({
          response,
          method: request.method,
          url,
          request,
          readJsonBody: input.readJsonBody,
          deps: {
            ...input.routeDeps,
            sideEffects: input.sideEffects,
          },
        })
      ) {
        return;
      }

      sendAuthorityError(response, 404, `Unknown route: ${request.method} ${url.pathname}`);
    } catch (error) {
      console.error("Authority request failed", error);
      sendAuthorityCaughtError(response, error);
    }
  });

  input.attachWebsocketBroadcast(server);
  return server;
}
