import { gateway } from "./index";
import type {
  AuthorityAppendRoomRequest,
  AuthorityApprovalMutationResponse,
  AuthorityApprovalRequest,
  AuthorityApprovalResolveRequest,
  AuthorityArtifactDeleteRequest,
  AuthorityArtifactMirrorSyncRequest,
  AuthorityArtifactUpsertRequest,
  AuthorityConversationStateDeleteRequest,
  AuthorityConversationStateUpsertRequest,
  AuthorityDecisionTicketCancelRequest,
  AuthorityDecisionTicketDeleteRequest,
  AuthorityDecisionTicketResolveRequest,
  AuthorityDecisionTicketUpsertRequest,
  AuthorityDispatchUpsertRequest,
  AuthorityDispatchDeleteRequest,
  AuthorityMissionDeleteRequest,
  AuthorityMissionUpsertRequest,
  AuthorityOperatorActionRequest,
  AuthorityOperatorActionResponse,
  AuthorityRequirementPromoteRequest,
  AuthorityRequirementTransitionRequest,
  AuthorityRoundDeleteRequest,
  AuthorityRoundUpsertRequest,
  AuthorityRoomDeleteRequest,
  AuthorityRoomBindingsUpsertRequest,
  AuthorityTakeoverCaseCommandRequest,
  AuthorityTakeoverCaseMutationResponse,
  AuthorityWorkItemDeleteRequest,
  AuthorityWorkItemUpsertRequest,
  AuthorityBootstrapSnapshot,
  AuthorityBatchPreviewHireRequest,
  AuthorityBatchPreviewHireResponse,
  AuthorityBatchHireEmployeesRequest,
  AuthorityBatchHireEmployeesResponse,
  AuthorityCompanyRuntimeSnapshot,
  AuthorityCreateCompanyRequest,
  AuthorityCreateCompanyResponse,
  AuthorityRetryCompanyProvisioningResponse,
  AuthorityExecutorConfig,
  AuthorityExecutorConfigPatch,
  AuthorityPreviewHireRequest,
  AuthorityPreviewHireResponse,
  AuthorityHireEmployeeRequest,
  AuthorityHireEmployeeResponse,
} from "../../infrastructure/authority/contract";

export function getAuthorityBootstrap() {
  return gateway.request<AuthorityBootstrapSnapshot>("authority.bootstrap");
}

export function saveAuthorityConfig(config: AuthorityBootstrapSnapshot["config"]) {
  return gateway.request<AuthorityBootstrapSnapshot>("authority.config.save", { config });
}

export function createAuthorityCompany(input: AuthorityCreateCompanyRequest) {
  return gateway.request<AuthorityCreateCompanyResponse>("authority.company.create", input);
}

export function retryAuthorityCompanyProvisioning(companyId: string) {
  return gateway.request<AuthorityRetryCompanyProvisioningResponse>(
    "authority.company.provisioning.retry",
    { companyId },
  );
}

export function hireAuthorityEmployee(input: AuthorityHireEmployeeRequest) {
  return gateway.request<AuthorityHireEmployeeResponse>("authority.company.employee.hire", input);
}

export function previewAuthorityHireEmployee(input: AuthorityPreviewHireRequest) {
  return gateway.request<AuthorityPreviewHireResponse>("authority.company.employee.preview_hire", input);
}

export function previewAuthorityBatchHireEmployees(input: AuthorityBatchPreviewHireRequest) {
  return gateway.request<AuthorityBatchPreviewHireResponse>(
    "authority.company.employee.preview_batch_hire",
    input,
  );
}

export function batchHireAuthorityEmployees(input: AuthorityBatchHireEmployeesRequest) {
  return gateway.request<AuthorityBatchHireEmployeesResponse>(
    "authority.company.employee.batch_hire",
    input,
  );
}

export function requestAuthorityApproval(input: AuthorityApprovalRequest) {
  return gateway.request<AuthorityApprovalMutationResponse>("authority.approval.request", input);
}

export function resolveAuthorityApproval(input: AuthorityApprovalResolveRequest) {
  return gateway.request<AuthorityApprovalMutationResponse>("authority.approval.resolve", input);
}

export function switchAuthorityCompany(companyId: string) {
  return gateway.request<AuthorityBootstrapSnapshot>("authority.company.switch", { companyId });
}

export function deleteAuthorityCompany(companyId: string) {
  return gateway.request<AuthorityBootstrapSnapshot>("authority.company.delete", { companyId });
}

export function getAuthorityCompanyRuntime(companyId: string) {
  return gateway.request<AuthorityCompanyRuntimeSnapshot>("authority.company.runtime.get", { companyId });
}

export function syncAuthorityCompanyRuntime(snapshot: AuthorityCompanyRuntimeSnapshot) {
  return gateway.request<AuthorityCompanyRuntimeSnapshot>("authority.company.runtime.sync", {
    companyId: snapshot.companyId,
    snapshot,
  });
}

export function transitionAuthorityRequirement(input: AuthorityRequirementTransitionRequest) {
  return gateway.request<AuthorityCompanyRuntimeSnapshot>("authority.requirement.transition", input);
}

export function promoteAuthorityRequirement(input: AuthorityRequirementPromoteRequest) {
  return gateway.request<AuthorityCompanyRuntimeSnapshot>("authority.requirement.promote", input);
}

export function appendAuthorityRoom(input: AuthorityAppendRoomRequest) {
  return gateway.request<AuthorityCompanyRuntimeSnapshot>("authority.room.append", input);
}

export function upsertAuthorityRoomBindings(input: AuthorityRoomBindingsUpsertRequest) {
  return gateway.request<AuthorityCompanyRuntimeSnapshot>("authority.room-bindings.upsert", input);
}

export function upsertAuthorityRound(input: AuthorityRoundUpsertRequest) {
  return gateway.request<AuthorityCompanyRuntimeSnapshot>("authority.round.upsert", input);
}

export function deleteAuthorityRound(input: AuthorityRoundDeleteRequest) {
  return gateway.request<AuthorityCompanyRuntimeSnapshot>("authority.round.delete", input);
}

export function upsertAuthorityMission(input: AuthorityMissionUpsertRequest) {
  return gateway.request<AuthorityCompanyRuntimeSnapshot>("authority.mission.upsert", input);
}

export function deleteAuthorityMission(input: AuthorityMissionDeleteRequest) {
  return gateway.request<AuthorityCompanyRuntimeSnapshot>("authority.mission.delete", input);
}

export function upsertAuthorityConversationState(input: AuthorityConversationStateUpsertRequest) {
  return gateway.request<AuthorityCompanyRuntimeSnapshot>("authority.conversation-state.upsert", input);
}

export function deleteAuthorityConversationState(input: AuthorityConversationStateDeleteRequest) {
  return gateway.request<AuthorityCompanyRuntimeSnapshot>("authority.conversation-state.delete", input);
}

export function upsertAuthorityWorkItem(input: AuthorityWorkItemUpsertRequest) {
  return gateway.request<AuthorityCompanyRuntimeSnapshot>("authority.work-item.upsert", input);
}

export function deleteAuthorityWorkItem(input: AuthorityWorkItemDeleteRequest) {
  return gateway.request<AuthorityCompanyRuntimeSnapshot>("authority.work-item.delete", input);
}

export function deleteAuthorityRoom(input: AuthorityRoomDeleteRequest) {
  return gateway.request<AuthorityCompanyRuntimeSnapshot>("authority.room.delete", input);
}

export function upsertAuthorityDispatch(input: AuthorityDispatchUpsertRequest) {
  return gateway.request<AuthorityCompanyRuntimeSnapshot>("authority.dispatch.create", input);
}

export function deleteAuthorityDispatch(input: AuthorityDispatchDeleteRequest) {
  return gateway.request<AuthorityCompanyRuntimeSnapshot>("authority.dispatch.delete", input);
}

export function upsertAuthorityArtifact(input: AuthorityArtifactUpsertRequest) {
  return gateway.request<AuthorityCompanyRuntimeSnapshot>("authority.artifact.upsert", input);
}

export function syncAuthorityArtifactMirrors(input: AuthorityArtifactMirrorSyncRequest) {
  return gateway.request<AuthorityCompanyRuntimeSnapshot>("authority.artifact.sync-mirror", input);
}

export function deleteAuthorityArtifact(input: AuthorityArtifactDeleteRequest) {
  return gateway.request<AuthorityCompanyRuntimeSnapshot>("authority.artifact.delete", input);
}

export function upsertAuthorityDecisionTicket(input: AuthorityDecisionTicketUpsertRequest) {
  return gateway.request<AuthorityCompanyRuntimeSnapshot>("authority.decision.upsert", input);
}

export function deleteAuthorityDecisionTicket(input: AuthorityDecisionTicketDeleteRequest) {
  return gateway.request<AuthorityCompanyRuntimeSnapshot>("authority.decision.delete", input);
}

export function resolveAuthorityDecisionTicket(input: AuthorityDecisionTicketResolveRequest) {
  return gateway.request<AuthorityCompanyRuntimeSnapshot>("authority.decision.resolve", input);
}

export function cancelAuthorityDecisionTicket(input: AuthorityDecisionTicketCancelRequest) {
  return gateway.request<AuthorityCompanyRuntimeSnapshot>("authority.decision.cancel", input);
}

export function transitionAuthorityTakeoverCase(input: AuthorityTakeoverCaseCommandRequest) {
  return gateway.request<AuthorityTakeoverCaseMutationResponse>("authority.takeover.transition", input);
}

export function runAuthorityOperatorAction(input: AuthorityOperatorActionRequest) {
  return gateway.request<AuthorityOperatorActionResponse>("authority.operator.run", input);
}

export function getAuthorityExecutorConfig() {
  return gateway.request<AuthorityExecutorConfig>("authority.executor.get");
}

export function patchAuthorityExecutorConfig(patch: AuthorityExecutorConfigPatch) {
  return gateway.request<AuthorityExecutorConfig>("authority.executor.patch", patch);
}
