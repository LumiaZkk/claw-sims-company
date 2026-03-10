import { useCompanyRuntimeCommands } from "../../infrastructure/company/runtime/commands";
import { selectWorkspaceArtifactsState } from "../../infrastructure/company/runtime/selectors";
import { useCompanyRuntimeStore } from "../../infrastructure/company/runtime/store";

export function useWorkspaceArtifactsQuery() {
  return useCompanyRuntimeStore(selectWorkspaceArtifactsState);
}

export function useArtifactApp() {
  const { syncArtifactMirrorRecords, upsertArtifactRecord } = useCompanyRuntimeCommands();
  return { syncArtifactMirrorRecords, upsertArtifactRecord };
}
