import { useCompanyRuntimeCommands } from "../../infrastructure/company/runtime/commands";
import { selectOrgState } from "../../infrastructure/company/runtime/selectors";
import { useCompanyRuntimeStore } from "../../infrastructure/company/runtime/store";
import { useShallow } from "zustand/react/shallow";
export { useOrgDirectoryQuery } from "./directory-query";
export { useOrgDirectoryCommands } from "./page-commands";
export * from "./directory-commands";
export * from "./organization-commands";

export function useOrgQuery() {
  return useCompanyRuntimeStore(useShallow(selectOrgState));
}

export function useOrgApp() {
  const { updateCompany } = useCompanyRuntimeCommands();
  return { updateCompany };
}
