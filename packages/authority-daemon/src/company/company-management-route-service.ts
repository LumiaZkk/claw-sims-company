import type { AuthorityCompanyManagementRouteDependencies } from "./company-management-routes";
import { createAuthorityCompanyManagementCommands } from "./company-management-commands";

export function createAuthorityCompanyManagementRouteService(
  commands: ReturnType<typeof createAuthorityCompanyManagementCommands>,
): AuthorityCompanyManagementRouteDependencies {
  return {
    saveConfig: commands.saveConfig,
    createCompany: commands.createCompany,
    retryCompanyProvisioning: commands.retryCompanyProvisioning,
    hireEmployee: commands.hireEmployee,
    batchHireEmployees: commands.batchHireEmployees,
    deleteCompany: commands.deleteCompany,
    switchCompany: commands.switchCompany,
  };
}
