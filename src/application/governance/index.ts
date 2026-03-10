import { useCompanyRuntimeCommands } from "../../infrastructure/company/runtime/commands";
import {
  selectCeoCockpitState,
  selectExceptionInboxState,
} from "../../infrastructure/company/runtime/selectors";
import { useCompanyRuntimeStore } from "../../infrastructure/company/runtime/store";

export function useCeoCockpitQuery() {
  return useCompanyRuntimeStore(selectCeoCockpitState);
}

export function useExceptionInboxQuery() {
  return useCompanyRuntimeStore(selectExceptionInboxState);
}

export function useGovernanceApp() {
  const { replaceDispatchRecords, updateCompany } = useCompanyRuntimeCommands();
  return { replaceDispatchRecords, updateCompany };
}
