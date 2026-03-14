import type { IncomingMessage } from "node:http";
import type {
  AuthorityBootstrapSnapshot,
  AuthorityExecutorConfig,
  AuthorityExecutorConfigPatch,
  AuthorityHealthSnapshot,
  AuthorityOperatorActionRequest,
  AuthorityOperatorActionResponse,
} from "../../../src/infrastructure/authority/contract";
import type { AuthorityRouteResult } from "./authority-route-result";

type GatewayProxyRequest = {
  method: string;
  params?: unknown;
};

export type AuthorityControlRouteDependencies = {
  buildHealthSnapshot: () => AuthorityHealthSnapshot;
  buildBootstrapSnapshot: () => AuthorityBootstrapSnapshot;
  runAuthorityOperatorAction: (
    input: AuthorityOperatorActionRequest,
  ) => Promise<AuthorityOperatorActionResponse>;
  getExecutorConfig: () => AuthorityExecutorConfig;
  patchExecutorConfig: (input: AuthorityExecutorConfigPatch) => Promise<AuthorityExecutorConfig>;
  proxyGatewayRequest: (method: string, params?: unknown) => Promise<unknown>;
};

export type AuthorityControlRouteResult = AuthorityRouteResult;

export async function resolveAuthorityControlRoute(input: {
  method?: string;
  pathname: string;
  request: IncomingMessage;
  readJsonBody: <T>(request: IncomingMessage) => Promise<T>;
  deps: AuthorityControlRouteDependencies;
}): Promise<AuthorityControlRouteResult | null> {
  const { method, pathname, request, readJsonBody, deps } = input;

  if (method === "GET" && pathname === "/health") {
    return {
      status: 200,
      payload: deps.buildHealthSnapshot(),
    };
  }

  if (method === "GET" && pathname === "/bootstrap") {
    return {
      status: 200,
      payload: deps.buildBootstrapSnapshot(),
    };
  }

  if (method === "POST" && pathname === "/operator/actions") {
    const body = await readJsonBody<AuthorityOperatorActionRequest>(request);
    return {
      status: 200,
      payload: await deps.runAuthorityOperatorAction(body),
    };
  }

  if (method === "GET" && pathname === "/executor") {
    return {
      status: 200,
      payload: deps.getExecutorConfig(),
    };
  }

  if (method === "PATCH" && pathname === "/executor") {
    const body = await readJsonBody<AuthorityExecutorConfigPatch>(request);
    return {
      status: 200,
      payload: await deps.patchExecutorConfig(body),
    };
  }

  if (method === "POST" && pathname === "/gateway/request") {
    const body = await readJsonBody<GatewayProxyRequest>(request);
    return {
      status: 200,
      payload: await deps.proxyGatewayRequest(body.method.trim(), body.params),
    };
  }

  return null;
}
