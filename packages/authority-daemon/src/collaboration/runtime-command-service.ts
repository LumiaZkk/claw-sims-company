import type { AuthorityAgentFilesResponse } from "../../../../src/infrastructure/authority/contract";
import type { AuthorityRuntimeCommandRouteDependencies } from "./runtime-command-routes";
import type { AuthorityRepository } from "../persistence/authority-repository";
import { runAgentWorkspaceEntry } from "../executor/agent-file-runner";
import { runAuthorityCompanyDispatchCommand, runAuthorityCompanyReportCommand } from "./company-dispatch-command";

export function createAuthorityRuntimeCommandService(input: {
  repository: AuthorityRepository;
  proxyGatewayRequest: <T = unknown>(method: string, params?: unknown) => Promise<T>;
}): AuthorityRuntimeCommandRouteDependencies {
  const { repository, proxyGatewayRequest } = input;
  return {
    listActors: () => repository.listActors(),
    proxyGatewayRequest,
    runAgentFile: async ({ agentId, entryPath, payload, timeoutMs }) => {
      const filesResult = await proxyGatewayRequest<AuthorityAgentFilesResponse>("agents.files.list", { agentId });
      return runAgentWorkspaceEntry({
        agentId,
        workspace: filesResult.workspace,
        entryPath,
        payload,
        timeoutMs,
      });
    },
    requestApproval: (body) => repository.requestApproval(body),
    resolveApproval: (body) => repository.resolveApproval(body),
    transitionRequirement: (body) => repository.transitionRequirement(body),
    promoteRequirement: (body) => repository.promoteRequirement(body),
    upsertRoom: (body) => repository.upsertRoom(body),
    deleteRoom: (body) => repository.deleteRoom(body),
    upsertRoomBindings: (body) => repository.upsertRoomBindings(body),
    upsertRound: (body) => repository.upsertRound(body),
    deleteRound: (body) => repository.deleteRound(body),
    upsertMission: (body) => repository.upsertMission(body),
    deleteMission: (body) => repository.deleteMission(body),
    upsertConversationState: (body) => repository.upsertConversationState(body),
    deleteConversationState: (body) => repository.deleteConversationState(body),
    upsertWorkItem: (body) => repository.upsertWorkItem(body),
    deleteWorkItem: (body) => repository.deleteWorkItem(body),
    upsertDispatch: (body) => repository.upsertDispatch(body),
    deleteDispatch: (body) => repository.deleteDispatch(body),
    upsertArtifact: (body) => repository.upsertArtifact(body),
    syncArtifactMirrors: (body) => repository.syncArtifactMirrors(body),
    deleteArtifact: (body) => repository.deleteArtifact(body),
    upsertDecisionTicket: (body) => repository.upsertDecisionTicket(body),
    resolveDecisionTicket: (body) => repository.resolveDecisionTicket(body),
    cancelDecisionTicket: (body) => repository.cancelDecisionTicket(body),
    deleteDecisionTicket: (body) => repository.deleteDecisionTicket(body),
    transitionTakeoverCase: (body) => repository.transitionTakeoverCase(body),
    appendCompanyEvent: (event) => repository.appendCompanyEvent(event),
    runCompanyDispatch: (body) =>
      runAuthorityCompanyDispatchCommand({
        body,
        deps: {
          repository,
          proxyGatewayRequest,
        },
      }),
    runCompanyReport: (body) =>
      runAuthorityCompanyReportCommand({
        body,
        deps: {
          repository,
          proxyGatewayRequest,
        },
      }),
  };
}
