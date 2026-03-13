import type { AuthorityCompanyRuntimeSnapshot } from "./contract";
import { applyAuthorityOwnedRuntimeSlices } from "./runtime-slice-ownership";

export function buildAuthorityCompatibilityRuntimeSnapshot(input: {
  localRuntime: AuthorityCompanyRuntimeSnapshot;
  authorityRuntime: AuthorityCompanyRuntimeSnapshot | null;
}): AuthorityCompanyRuntimeSnapshot {
  const { localRuntime, authorityRuntime } = input;
  if (!authorityRuntime || authorityRuntime.companyId !== localRuntime.companyId) {
    return localRuntime;
  }

  return applyAuthorityOwnedRuntimeSlices({
    snapshot: localRuntime,
    authorityRuntime,
  });
}
