import {
  clearCachedAuthorityBootstrap,
  clearCachedAuthorityRuntimeSnapshot,
  hydrateAuthorityBootstrapCache,
  readCachedAuthorityConfig,
  writeCachedAuthorityConfig,
} from "../../authority/runtime-cache";
import {
  deleteAuthorityCompany,
  getAuthorityBootstrap,
  saveAuthorityConfig,
} from "../../../application/gateway/authority-control";
import type { CyberCompanyConfig } from "./types";

export function peekCachedCompanyConfig(): CyberCompanyConfig | null {
  return readCachedAuthorityConfig();
}

export function getPersistedActiveCompanyId(): string | null {
  return readCachedAuthorityConfig()?.activeCompanyId ?? null;
}

export function setPersistedActiveCompanyId(companyId: string) {
  const config = readCachedAuthorityConfig();
  if (!config) {
    return;
  }
  writeCachedAuthorityConfig({ ...config, activeCompanyId: companyId });
}

export function clearPersistedActiveCompanyId() {
  const config = readCachedAuthorityConfig();
  if (!config) {
    return;
  }
  writeCachedAuthorityConfig({ ...config, activeCompanyId: "" });
}

export function getConfigOwnerAgentId(): string | null {
  const config = readCachedAuthorityConfig();
  const activeCompany = config?.companies.find((company) => company.id === config.activeCompanyId) ?? null;
  return activeCompany?.employees.find((employee) => employee.metaRole === "ceo")?.agentId ?? null;
}

export function setConfigOwnerAgentId() {
  // Authority owns company metadata; browser no longer persists an owner pointer.
}

export function clearConfigOwnerAgentId() {
  // Authority owns company metadata; browser no longer persists an owner pointer.
}

export async function loadCompanyConfig(): Promise<CyberCompanyConfig | null> {
  const bootstrap = await getAuthorityBootstrap();
  hydrateAuthorityBootstrapCache(bootstrap);
  return bootstrap.config;
}

export async function saveCompanyConfig(config: CyberCompanyConfig): Promise<boolean> {
  const bootstrap = await saveAuthorityConfig(config);
  hydrateAuthorityBootstrapCache(bootstrap);
  return true;
}

export async function deleteCompanyCascade(
  currentConfig: CyberCompanyConfig,
  companyId: string,
): Promise<CyberCompanyConfig | null> {
  if (!currentConfig.companies.some((company) => company.id === companyId)) {
    return currentConfig;
  }
  const bootstrap = await deleteAuthorityCompany(companyId);
  clearCachedAuthorityRuntimeSnapshot(companyId);
  hydrateAuthorityBootstrapCache(bootstrap);
  return bootstrap.config;
}

export function clearConfigCache() {
  clearCachedAuthorityBootstrap();
}
