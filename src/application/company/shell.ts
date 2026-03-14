import { useCompanyRuntimeCommands } from "../../infrastructure/company/runtime/commands";
import { readCompanyRuntimeState, selectCompanyShellState } from "../../infrastructure/company/runtime/selectors";
import { useCompanyRuntimeStore } from "../../infrastructure/company/runtime/store";
import type { CompanyBootstrapPhase } from "../../infrastructure/company/runtime/types";
import type { Company, CyberCompanyConfig } from "../../domain/org/types";
import { useShallow } from "zustand/react/shallow";

export type CompanyShellState = {
  config: CyberCompanyConfig | null;
  activeCompany: Company | null;
  loading: boolean;
  error: string | null;
  bootstrapPhase: CompanyBootstrapPhase;
  hasPrimaryRequirement: boolean;
};

export function useCompanyShellQuery() {
  return useCompanyRuntimeStore(useShallow(selectCompanyShellState));
}

export function useCompanyShellCommands() {
  const { loadConfig, saveConfig, switchCompany, deleteCompany, retryCompanyProvisioning } =
    useCompanyRuntimeCommands();
  return { loadConfig, saveConfig, switchCompany, deleteCompany, retryCompanyProvisioning };
}

export function readCompanyShellState(): CompanyShellState {
  return selectCompanyShellState(readCompanyRuntimeState());
}
