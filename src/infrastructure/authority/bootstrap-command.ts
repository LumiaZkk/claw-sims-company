import type { AuthorityBootstrapSnapshot } from "./contract";
import { getAuthorityBootstrap } from "../../application/gateway/authority-control";
import { hydrateAuthorityBootstrapCache } from "./runtime-cache";
import { runtimeStateFromAuthorityBootstrap } from "./runtime-snapshot";
import { useCompanyRuntimeStore } from "../company/runtime/store";

export function applyAuthorityBootstrapToStore(snapshot: AuthorityBootstrapSnapshot) {
  hydrateAuthorityBootstrapCache(snapshot);
  useCompanyRuntimeStore.setState({
    ...runtimeStateFromAuthorityBootstrap(snapshot),
    loading: false,
    error: null,
    bootstrapPhase: snapshot.activeCompany ? "ready" : "missing",
  });
  return snapshot;
}

export async function refreshAuthorityBootstrapSilently() {
  const snapshot = await getAuthorityBootstrap();
  return applyAuthorityBootstrapToStore(snapshot);
}
