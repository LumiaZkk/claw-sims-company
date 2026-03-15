import type { AuthorityCompanyStateRouteDependencies } from "./company-state-routes";
import type { AuthorityRepository } from "../persistence/authority-repository";

export function createAuthorityCompanyStateService(
  repository: AuthorityRepository,
): AuthorityCompanyStateRouteDependencies {
  return {
    loadRuntime: (companyId) => repository.loadRuntime(companyId),
    saveRuntime: (snapshot) => repository.saveRuntime(snapshot),
    listCompanyEvents: (companyId, cursor, since, limit, recent) =>
      repository.listCompanyEvents(companyId, cursor, since, limit, recent),
    getCollaborationScope: (companyId, agentId) =>
      repository.getCollaborationScope(companyId, agentId),
    listCompanyProjects: (companyId) => repository.listCompanyProjects(companyId),
    loadCompanyProject: (companyId, projectId) => repository.loadCompanyProject(companyId, projectId),
    createCompanyProject: (project) => repository.createCompanyProject(project),
    patchCompanyProject: (companyId, projectId, patch) =>
      repository.patchCompanyProject(companyId, projectId, patch),
  };
}
