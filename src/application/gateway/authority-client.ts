import { authorityClient, probeAuthorityHealth, runAuthorityOperatorActionAt } from "../../infrastructure/authority/client";
import type {
  AuthorityCompanyCodexAuthSyncResponse,
  AuthorityCompanyProjectsResponse,
  AuthorityProjectCreateRequest,
  AuthorityProjectMutationResponse,
  AuthorityProjectPatchRequest,
} from "./authority-types";

export { probeAuthorityHealth, runAuthorityOperatorActionAt };

export function syncCompanyCodexAuth(
  companyId: string,
  source: "cli" | "gateway" = "cli",
): Promise<AuthorityCompanyCodexAuthSyncResponse> {
  return authorityClient.syncCompanyCodexAuth(companyId, source);
}

export function listCompanyProjects(companyId: string): Promise<AuthorityCompanyProjectsResponse> {
  return authorityClient.listCompanyProjects(companyId);
}

export function getCompanyProject(
  companyId: string,
  projectId: string,
): Promise<AuthorityProjectMutationResponse> {
  return authorityClient.getCompanyProject(companyId, projectId);
}

export function createCompanyProject(
  input: AuthorityProjectCreateRequest,
): Promise<AuthorityProjectMutationResponse> {
  return authorityClient.createProject(input);
}

export function patchCompanyProject(
  input: AuthorityProjectPatchRequest,
): Promise<AuthorityProjectMutationResponse> {
  return authorityClient.patchProject(input);
}
