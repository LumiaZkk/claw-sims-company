import { gateway } from "./index";
import type {
  AuthorityBootstrapSnapshot,
  AuthorityCompanyRuntimeSnapshot,
  AuthorityCreateCompanyRequest,
  AuthorityCreateCompanyResponse,
  AuthorityExecutorConfig,
  AuthorityExecutorConfigPatch,
} from "../../infrastructure/authority/contract";

export function getAuthorityBootstrap() {
  return gateway.request<AuthorityBootstrapSnapshot>("authority.bootstrap");
}

export function saveAuthorityConfig(config: AuthorityBootstrapSnapshot["config"]) {
  return gateway.request<AuthorityBootstrapSnapshot>("authority.config.save", { config });
}

export function createAuthorityCompany(input: AuthorityCreateCompanyRequest) {
  return gateway.request<AuthorityCreateCompanyResponse>("authority.company.create", input);
}

export function switchAuthorityCompany(companyId: string) {
  return gateway.request<AuthorityBootstrapSnapshot>("authority.company.switch", { companyId });
}

export function deleteAuthorityCompany(companyId: string) {
  return gateway.request<AuthorityBootstrapSnapshot>("authority.company.delete", { companyId });
}

export function getAuthorityCompanyRuntime(companyId: string) {
  return gateway.request<AuthorityCompanyRuntimeSnapshot>("authority.company.runtime.get", { companyId });
}

export function syncAuthorityCompanyRuntime(snapshot: AuthorityCompanyRuntimeSnapshot) {
  return gateway.request<AuthorityCompanyRuntimeSnapshot>("authority.company.runtime.sync", {
    companyId: snapshot.companyId,
    snapshot,
  });
}

export function getAuthorityExecutorConfig() {
  return gateway.request<AuthorityExecutorConfig>("authority.executor.get");
}

export function patchAuthorityExecutorConfig(patch: AuthorityExecutorConfigPatch) {
  return gateway.request<AuthorityExecutorConfig>("authority.executor.patch", patch);
}
