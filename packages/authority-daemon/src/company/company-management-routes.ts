import type { IncomingMessage } from "node:http";
import type { AuthorityCompanyManagementCommandResult } from "./company-management-commands";
import type {
  AuthorityBatchHireEmployeesRequest,
  AuthorityCreateCompanyRequest,
  AuthorityHireEmployeeRequest,
  AuthoritySwitchCompanyRequest,
} from "../../../../src/infrastructure/authority/contract";
import type { CyberCompanyConfig } from "../../../../src/domain/org/types";

export type AuthorityCompanyManagementRouteResult = AuthorityCompanyManagementCommandResult;

export type AuthorityCompanyManagementRouteDependencies = {
  saveConfig: (config: CyberCompanyConfig) => Promise<AuthorityCompanyManagementRouteResult> | AuthorityCompanyManagementRouteResult;
  createCompany: (body: AuthorityCreateCompanyRequest) => Promise<AuthorityCompanyManagementRouteResult> | AuthorityCompanyManagementRouteResult;
  retryCompanyProvisioning: (companyId: string) => Promise<AuthorityCompanyManagementRouteResult> | AuthorityCompanyManagementRouteResult;
  hireEmployee: (input: {
    companyId: string;
    body: AuthorityHireEmployeeRequest;
  }) => Promise<AuthorityCompanyManagementRouteResult> | AuthorityCompanyManagementRouteResult;
  batchHireEmployees: (input: {
    companyId: string;
    body: AuthorityBatchHireEmployeesRequest;
  }) => Promise<AuthorityCompanyManagementRouteResult> | AuthorityCompanyManagementRouteResult;
  deleteCompany: (companyId: string) => Promise<AuthorityCompanyManagementRouteResult> | AuthorityCompanyManagementRouteResult;
  switchCompany: (body: AuthoritySwitchCompanyRequest) => Promise<AuthorityCompanyManagementRouteResult> | AuthorityCompanyManagementRouteResult;
};

export async function resolveAuthorityCompanyManagementRoute(input: {
  method?: string;
  url: URL;
  request: IncomingMessage;
  readJsonBody: <T>(request: IncomingMessage) => Promise<T>;
  deps: AuthorityCompanyManagementRouteDependencies;
}): Promise<AuthorityCompanyManagementRouteResult | null> {
  const { method, url, request, readJsonBody, deps } = input;

  if (method === "PUT" && url.pathname === "/config") {
    const body = await readJsonBody<{ config: CyberCompanyConfig }>(request);
    return deps.saveConfig(body.config);
  }

  if (method === "POST" && url.pathname === "/companies") {
    const body = await readJsonBody<AuthorityCreateCompanyRequest>(request);
    return deps.createCompany(body);
  }

  if (method === "POST" && /\/companies\/[^/]+\/provisioning\/retry$/.test(url.pathname)) {
    const companyId = decodeURIComponent(url.pathname.split("/")[2] ?? "");
    return deps.retryCompanyProvisioning(companyId);
  }

  if (method === "POST" && /\/companies\/[^/]+\/employees$/.test(url.pathname)) {
    const companyId = decodeURIComponent(url.pathname.split("/")[2] ?? "");
    const body = await readJsonBody<AuthorityHireEmployeeRequest>(request);
    return deps.hireEmployee({ companyId, body });
  }

  if (method === "POST" && /\/companies\/[^/]+\/employees\/batch$/.test(url.pathname)) {
    const companyId = decodeURIComponent(url.pathname.split("/")[2] ?? "");
    const body = await readJsonBody<AuthorityBatchHireEmployeesRequest>(request);
    return deps.batchHireEmployees({ companyId, body });
  }

  if (method === "DELETE" && url.pathname.startsWith("/companies/")) {
    const companyId = decodeURIComponent(url.pathname.slice("/companies/".length));
    return deps.deleteCompany(companyId);
  }

  if (method === "POST" && url.pathname === "/company/switch") {
    const body = await readJsonBody<AuthoritySwitchCompanyRequest>(request);
    return deps.switchCompany(body);
  }

  return null;
}
