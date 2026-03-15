import type { IncomingMessage, ServerResponse } from "node:http";
import { resolveAuthorityChatCommandRoute, type AuthorityChatCommandRouteDependencies } from "../agent/chat-command-routes";
import {
  resolveAuthorityCompanyManagementRoute,
  type AuthorityCompanyManagementRouteDependencies,
} from "../company/company-management-routes";
import {
  resolveAuthorityCompanyStateRoute,
  type AuthorityCompanyStateRouteDependencies,
} from "../company/company-state-routes";
import { resolveAuthorityControlRoute, type AuthorityControlRouteDependencies } from "./control-routes";
import {
  dispatchAuthorityRouteAttempts,
  type AuthorityRouteDispatchSideEffects,
} from "./authority-http-route-dispatch";
import {
  resolveAuthorityRuntimeCommandRoute,
  type AuthorityRuntimeCommandRouteDependencies,
} from "../collaboration/runtime-command-routes";
import type { AuthorityRouteResult } from "./authority-route-result";

export type AuthorityRouteRegistryDependencies = {
  control: AuthorityControlRouteDependencies;
  companyState: AuthorityCompanyStateRouteDependencies;
  runtimeCommands: AuthorityRuntimeCommandRouteDependencies;
  companyManagement: AuthorityCompanyManagementRouteDependencies;
  chatCommands: AuthorityChatCommandRouteDependencies;
  sideEffects: AuthorityRouteDispatchSideEffects;
};

export function createAuthorityRouteAttempts(input: {
  method?: string;
  url: URL;
  request: IncomingMessage;
  readJsonBody: <T>(request: IncomingMessage) => Promise<T>;
  deps: Omit<AuthorityRouteRegistryDependencies, "sideEffects">;
}): Array<() => Promise<AuthorityRouteResult | null>> {
  const { method, url, request, readJsonBody, deps } = input;

  return [
    () =>
      resolveAuthorityControlRoute({
        method,
        pathname: url.pathname,
        request,
        readJsonBody,
        deps: deps.control,
      }),
    () =>
      resolveAuthorityCompanyStateRoute({
        method,
        url,
        request,
        readJsonBody,
        deps: deps.companyState,
      }),
    () =>
      resolveAuthorityRuntimeCommandRoute({
        method,
        url,
        request,
        readJsonBody,
        deps: deps.runtimeCommands,
      }),
    () =>
      resolveAuthorityCompanyManagementRoute({
        method,
        url,
        request,
        readJsonBody,
        deps: deps.companyManagement,
      }),
    () =>
      resolveAuthorityChatCommandRoute({
        method,
        pathname: url.pathname,
        request,
        readJsonBody,
        deps: deps.chatCommands,
      }),
  ];
}

export async function handleAuthorityHttpRoute(input: {
  response: ServerResponse;
  method?: string;
  url: URL;
  request: IncomingMessage;
  readJsonBody: <T>(request: IncomingMessage) => Promise<T>;
  deps: AuthorityRouteRegistryDependencies;
}): Promise<boolean> {
  const { response, method, url, request, readJsonBody, deps } = input;

  return dispatchAuthorityRouteAttempts({
    response,
    attempts: createAuthorityRouteAttempts({
      method,
      url,
      request,
      readJsonBody,
      deps: {
        control: deps.control,
        companyState: deps.companyState,
        runtimeCommands: deps.runtimeCommands,
        companyManagement: deps.companyManagement,
        chatCommands: deps.chatCommands,
      },
    }),
    sideEffects: deps.sideEffects,
  });
}
