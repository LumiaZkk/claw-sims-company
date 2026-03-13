import { useCallback, useState } from "react";
import { applyApprovedAutomationEnable } from "../automation/approval";
import { buildCompanyBlueprint } from "../company/blueprint";
import { resolveAuthorityApproval } from "../gateway/authority-control";
import { appendOperatorActionAuditEvent } from "../governance/operator-action-audit";
import { useLobbyCommunicationSyncState } from "./communication-sync";
import { buildRequirementRoomRoute } from "../delegation/room-routing";
import { requestTopicMatchesText } from "../delegation/request-topic";
import type { CronJob } from "../gateway";
import {
  assignEmployeeTask,
  fireCompanyEmployee,
  hireCompanyEmployee,
  type HireEmployeeConfig,
  updateEmployeeRolePrompt,
} from "../org/directory-commands";
import { applyApprovedDirectoryDepartmentChange } from "../org/page-commands";
import type { ArtifactRecord } from "../../domain/artifact/types";
import type { ApprovalRecord } from "../../domain/governance/types";
import type { RequirementRoomRecord } from "../../domain/delegation/types";
import type { DispatchRecord } from "../../domain/delegation/types";
import type { RequirementSessionSnapshot } from "../../domain/mission/requirement-snapshot";
import type { Company } from "../../domain/org/types";
import { readCompanyRuntimeState } from "../../infrastructure/company/runtime/selectors";

export function buildLobbyBlueprintText(input: {
  company: Company;
  knowledgeItems: Company["knowledgeItems"];
  jobs: CronJob[];
}) {
  const knowledgeItems = input.knowledgeItems ?? [];
  return JSON.stringify(
    buildCompanyBlueprint({
      company: {
        ...input.company,
        knowledgeItems,
      },
      jobs: input.jobs,
    }),
    null,
    2,
  );
}

export async function syncLobbyKnowledge(input: {
  knowledgeItems: Company["knowledgeItems"];
  updateCompany: (patch: Partial<Company>) => Promise<void> | void;
}) {
  const knowledgeItems = input.knowledgeItems ?? [];
  await input.updateCompany({ knowledgeItems });
  return knowledgeItems.length;
}

export async function hireLobbyEmployee(company: Company, config: HireEmployeeConfig) {
  const result = await hireCompanyEmployee(company, config);
  return result.agentId;
}

export async function updateLobbyEmployeeRole(agentId: string, role: string, description: string) {
  await updateEmployeeRolePrompt(agentId, role, description);
}

export async function fireLobbyEmployee(agentId: string, options?: { skipApproval?: boolean }) {
  return fireCompanyEmployee(agentId, options);
}

export async function resolveLobbyApproval(input: {
  companyId: string;
  approvalId: string;
  decision: "approved" | "rejected";
  resolution?: string | null;
}) {
  const result = await resolveAuthorityApproval({
    companyId: input.companyId,
    approvalId: input.approvalId,
    decision: input.decision,
    resolution: input.resolution ?? null,
    decidedByActorId: "operator:local-user",
    decidedByLabel: "当前操作者",
  });
  await readCompanyRuntimeState().loadConfig();
  return result.approval;
}

export async function assignLobbyQuickTask(agentId: string, text: string) {
  await assignEmployeeTask(agentId, text);
}

function buildLobbyActionTextPreview(text: string, limit = 48) {
  const trimmed = text.trim();
  if (trimmed.length <= limit) {
    return trimmed;
  }
  return `${trimmed.slice(0, limit)}...`;
}

function buildApprovalPayloadActorId(approval: ApprovalRecord): string | null {
  const payloadActorId =
    approval.payload && typeof approval.payload.agentId === "string"
      ? approval.payload.agentId.trim()
      : "";
  return payloadActorId || approval.targetActorId || null;
}

export function buildLobbyGroupChatRoute(input: {
  activeRoomRecords: RequirementRoomRecord[];
  company: Company;
  currentRequirementTopicKey?: string | null;
  currentRequirementWorkItemId?: string | null;
  memberIds: string[];
  topic: string;
}) {
  const requirementTopicKey =
    input.currentRequirementTopicKey &&
    requestTopicMatchesText(input.currentRequirementTopicKey, input.topic)
      ? input.currentRequirementTopicKey
      : null;

  return buildRequirementRoomRoute({
    company: input.company,
    memberIds: input.memberIds,
    topic: input.topic,
    topicKey: requirementTopicKey,
    workItemId: input.currentRequirementWorkItemId,
    existingRooms: input.activeRoomRecords,
  });
}

export function useLobbyPageCommands(input: {
  activeCompany: Company;
  activeArtifacts: ArtifactRecord[];
  activeDispatches: DispatchRecord[];
  activeRoomRecords: RequirementRoomRecord[];
  companySessionSnapshots: RequirementSessionSnapshot[];
  cronCache: CronJob[];
  connected: boolean;
  isPageVisible: boolean;
  knowledgeItems: Company["knowledgeItems"];
  currentRequirementTopicKey?: string | null;
  currentRequirementWorkItemId?: string | null;
  replaceDispatchRecords: (dispatches: DispatchRecord[]) => void;
  setCompanySessionSnapshots: (snapshots: RequirementSessionSnapshot[]) => void;
  updateCompany: (patch: Partial<Company>) => Promise<void> | void;
}) {
  const [hireSubmitting, setHireSubmitting] = useState(false);
  const [updateRoleSubmitting, setUpdateRoleSubmitting] = useState(false);
  const [quickTaskSubmitting, setQuickTaskSubmitting] = useState(false);
  const [groupChatSubmitting, setGroupChatSubmitting] = useState(false);
  const [approvalSubmittingId, setApprovalSubmittingId] = useState<string | null>(null);
  const { recoveringCommunication, recoverCommunication } = useLobbyCommunicationSyncState({
    activeCompany: input.activeCompany,
    surface: "lobby",
    companySessionSnapshots: input.companySessionSnapshots,
    setCompanySessionSnapshots: input.setCompanySessionSnapshots,
    activeArtifacts: input.activeArtifacts,
    activeDispatches: input.activeDispatches,
    replaceDispatchRecords: input.replaceDispatchRecords,
    updateCompany: input.updateCompany,
    connected: input.connected,
    isPageVisible: input.isPageVisible,
  });

  const buildBlueprintText = useCallback(
    () =>
      buildLobbyBlueprintText({
        company: input.activeCompany,
        knowledgeItems: input.knowledgeItems,
        jobs: input.cronCache,
      }),
    [input.activeCompany, input.cronCache, input.knowledgeItems],
  );

  const syncKnowledge = useCallback(
    () =>
      syncLobbyKnowledge({
        knowledgeItems: input.knowledgeItems,
        updateCompany: input.updateCompany,
      }),
    [input.knowledgeItems, input.updateCompany],
  );

  const hireEmployee = useCallback(
    async (config: HireEmployeeConfig) => {
      const role = (config.role ?? "").trim();
      const description = (config.description ?? "").trim();
      if (!role || !description) {
        return null;
      }

      setHireSubmitting(true);
      try {
        const agentId = await hireLobbyEmployee(input.activeCompany, config);
        await appendOperatorActionAuditEvent({
          companyId: input.activeCompany.id,
          action: "employee_hire",
          surface: "lobby",
          outcome: "succeeded",
          details: {
            targetActorId: agentId,
            role,
            descriptionPreview: buildLobbyActionTextPreview(description),
            modelTier: config.modelTier,
            budget: config.budget,
          },
        });
        return agentId;
      } catch (error) {
        await appendOperatorActionAuditEvent({
          companyId: input.activeCompany.id,
          action: "employee_hire",
          surface: "lobby",
          outcome: "failed",
          error: error instanceof Error ? error.message : String(error),
          details: {
            role,
            descriptionPreview: buildLobbyActionTextPreview(description),
            modelTier: config.modelTier,
            budget: config.budget,
          },
        });
        throw error;
      } finally {
        setHireSubmitting(false);
      }
    },
    [input.activeCompany],
  );

  const updateRole = useCallback(async (agentId: string | null, role: string, description: string) => {
    const nextRole = role.trim();
    const nextDescription = description.trim();
    if (!agentId || !nextRole || !nextDescription) {
      return false;
    }

    setUpdateRoleSubmitting(true);
    try {
      await updateLobbyEmployeeRole(agentId, nextRole, nextDescription);
      await appendOperatorActionAuditEvent({
        companyId: input.activeCompany.id,
        action: "employee_role_update",
        surface: "lobby",
        outcome: "succeeded",
        details: {
          targetActorId: agentId,
          role: nextRole,
          descriptionPreview: buildLobbyActionTextPreview(nextDescription),
          descriptionLength: nextDescription.length,
        },
      });
      return true;
    } catch (error) {
      await appendOperatorActionAuditEvent({
        companyId: input.activeCompany.id,
        action: "employee_role_update",
        surface: "lobby",
        outcome: "failed",
        error: error instanceof Error ? error.message : String(error),
        details: {
          targetActorId: agentId,
          role: nextRole,
          descriptionPreview: buildLobbyActionTextPreview(nextDescription),
          descriptionLength: nextDescription.length,
        },
      });
      throw error;
    } finally {
      setUpdateRoleSubmitting(false);
    }
  }, [input.activeCompany.id]);

  const fireEmployee = useCallback(
    async (agentId: string, options?: { skipApproval?: boolean }) => {
      try {
        const result = await fireLobbyEmployee(agentId, options);
        if (result.mode === "approval_requested") {
          await appendOperatorActionAuditEvent({
            companyId: input.activeCompany.id,
            action: "approval_request",
            surface: "lobby",
            outcome: "succeeded",
            details: {
              approvalId: result.approval.id,
              approvalActionType: result.approval.actionType,
              targetActorId: result.approval.targetActorId ?? null,
              targetLabel: result.approval.targetLabel ?? null,
            },
          });
          return result;
        }
        await appendOperatorActionAuditEvent({
          companyId: input.activeCompany.id,
          action: "employee_fire",
          surface: "lobby",
          outcome: "succeeded",
          details: {
            targetActorId: agentId,
          },
        });
        return result;
      } catch (error) {
        await appendOperatorActionAuditEvent({
          companyId: input.activeCompany.id,
          action: options?.skipApproval ? "employee_fire" : "approval_request",
          surface: "lobby",
          outcome: "failed",
          error: error instanceof Error ? error.message : String(error),
          details: {
            targetActorId: agentId,
          },
        });
        throw error;
      }
    },
    [input.activeCompany.id],
  );

  const resolveApproval = useCallback(async (approval: ApprovalRecord, decision: "approved" | "rejected") => {
    setApprovalSubmittingId(approval.id);
    try {
      const resolved = await resolveLobbyApproval({
        companyId: input.activeCompany.id,
        approvalId: approval.id,
        decision,
        resolution:
          decision === "approved"
            ? `已批准：${approval.summary}`
            : `已拒绝：${approval.summary}`,
      });
      await appendOperatorActionAuditEvent({
        companyId: input.activeCompany.id,
        action: decision === "approved" ? "approval_approve" : "approval_reject",
        surface: "lobby",
        outcome: "succeeded",
        details: {
          approvalId: resolved.id,
          approvalActionType: resolved.actionType,
          targetActorId: resolved.targetActorId ?? null,
          targetLabel: resolved.targetLabel ?? null,
        },
      });

      if (decision === "approved" && resolved.actionType === "employee_fire") {
        const targetActorId = buildApprovalPayloadActorId(resolved);
        if (targetActorId) {
          await fireEmployee(targetActorId, { skipApproval: true });
        }
      }
      if (decision === "approved" && resolved.actionType === "department_change") {
        await applyApprovedDirectoryDepartmentChange({
          company: input.activeCompany,
          approval: resolved,
          updateCompany: input.updateCompany,
        });
      }
      if (decision === "approved" && resolved.actionType === "automation_enable") {
        await applyApprovedAutomationEnable(resolved);
      }

      return resolved;
    } catch (error) {
      await appendOperatorActionAuditEvent({
        companyId: input.activeCompany.id,
        action: decision === "approved" ? "approval_approve" : "approval_reject",
        surface: "lobby",
        outcome: "failed",
        error: error instanceof Error ? error.message : String(error),
        details: {
          approvalId: approval.id,
          approvalActionType: approval.actionType,
          targetActorId: approval.targetActorId ?? null,
          targetLabel: approval.targetLabel ?? null,
        },
      });
      throw error;
    } finally {
      setApprovalSubmittingId(null);
    }
  }, [fireEmployee, input.activeCompany.id]);

  const assignQuickTask = useCallback(async (agentId: string, text: string) => {
    const nextText = text.trim();
    if (!agentId || !nextText) {
      return false;
    }

    const details = {
      targetActorId: agentId,
      taskPreview: buildLobbyActionTextPreview(nextText),
      taskLength: nextText.length,
    };

    setQuickTaskSubmitting(true);
    try {
      await assignLobbyQuickTask(agentId, nextText);
      await appendOperatorActionAuditEvent({
        companyId: input.activeCompany.id,
        action: "quick_task_assign",
        surface: "lobby",
        outcome: "succeeded",
        details,
      });
      return true;
    } catch (error) {
      await appendOperatorActionAuditEvent({
        companyId: input.activeCompany.id,
        action: "quick_task_assign",
        surface: "lobby",
        outcome: "failed",
        error: error instanceof Error ? error.message : String(error),
        details,
      });
      throw error;
    } finally {
      setQuickTaskSubmitting(false);
    }
  }, [input.activeCompany.id]);

  const buildGroupChatRoute = useCallback(
    async (inputValues: { memberIds: string[]; topic: string }) => {
      const topic = inputValues.topic.trim();
      if (!topic || inputValues.memberIds.length < 2) {
        return null;
      }

      setGroupChatSubmitting(true);
      try {
        return buildLobbyGroupChatRoute({
          activeRoomRecords: input.activeRoomRecords,
          company: input.activeCompany,
          currentRequirementTopicKey: input.currentRequirementTopicKey,
          currentRequirementWorkItemId: input.currentRequirementWorkItemId,
          memberIds: inputValues.memberIds,
          topic,
        });
      } finally {
        setGroupChatSubmitting(false);
      }
    },
    [
      input.activeCompany,
      input.activeRoomRecords,
      input.currentRequirementTopicKey,
      input.currentRequirementWorkItemId,
    ],
  );

  return {
    buildBlueprintText,
    syncKnowledge,
    hireEmployee,
    updateRole,
    fireEmployee,
    resolveApproval,
    assignQuickTask,
    buildGroupChatRoute,
    hireSubmitting,
    updateRoleSubmitting,
    quickTaskSubmitting,
    groupChatSubmitting,
    approvalSubmittingId,
    recoveringCommunication,
    recoverCommunication,
  };
}
