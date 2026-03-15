import type { AuthorityCompanyRuntimeSnapshot } from "./authority-types";
import { applyAuthorityRuntimeSnapshotToStore } from "../../infrastructure/authority/runtime-command";
import { refreshAuthorityBootstrapSilently } from "../../infrastructure/authority/bootstrap-command";
import {
  buildAuthorityRuntimeSignature,
  getLastAppliedAuthorityRuntimeSignature,
  recordAuthorityRuntimeSyncError,
  useAuthorityRuntimeSyncStore,
} from "../../infrastructure/authority/runtime-sync-store";
import { readCachedAuthorityRuntimeSnapshot } from "../../infrastructure/authority/runtime-cache";
import { buildAuthorityCompatibilityRuntimeSnapshot } from "../../infrastructure/authority/runtime-compatibility-snapshot";

export type { AuthorityCompanyRuntimeSnapshot };
export {
  applyAuthorityRuntimeSnapshotToStore,
  refreshAuthorityBootstrapSilently,
  buildAuthorityRuntimeSignature,
  getLastAppliedAuthorityRuntimeSignature,
  recordAuthorityRuntimeSyncError,
  useAuthorityRuntimeSyncStore,
  readCachedAuthorityRuntimeSnapshot,
  buildAuthorityCompatibilityRuntimeSnapshot,
};
