import { useCompanyRuntimeCommands } from "../../infrastructure/company/runtime/commands";
import { selectWorkspaceArtifactsState } from "../../infrastructure/company/runtime/selectors";
import { useCompanyRuntimeStore } from "../../infrastructure/company/runtime/store";
import { useShallow } from "zustand/react/shallow";

export function useWorkspaceArtifactsQuery() {
  return useCompanyRuntimeStore(useShallow(selectWorkspaceArtifactsState));
}

export function useArtifactApp() {
  const { syncArtifactMirrorRecords, upsertArtifactRecord } = useCompanyRuntimeCommands();
  return { syncArtifactMirrorRecords, upsertArtifactRecord };
}
