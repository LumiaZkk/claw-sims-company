import { useCompanyRuntimeCommands } from "../../infrastructure/company/runtime/commands";
import {
  selectCeoCockpitState,
  selectExceptionInboxState,
} from "../../infrastructure/company/runtime/selectors";
import { useCompanyRuntimeStore } from "../../infrastructure/company/runtime/store";
import { useShallow } from "zustand/react/shallow";

export function useCeoCockpitQuery() {
  return useCompanyRuntimeStore(useShallow(selectCeoCockpitState));
}

export function useExceptionInboxQuery() {
  return useCompanyRuntimeStore(useShallow(selectExceptionInboxState));
}

export function useGovernanceApp() {
  const { replaceDispatchRecords, upsertDispatchRecord, updateCompany } = useCompanyRuntimeCommands();
  return { replaceDispatchRecords, upsertDispatchRecord, updateCompany };
}
