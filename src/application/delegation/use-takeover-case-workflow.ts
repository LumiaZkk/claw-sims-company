import { useCallback, useState } from "react";
import type { Company } from "../../domain/org/types";
import { toast } from "../../components/system/toast-store";
import {
  applyTakeoverCaseWorkflowAction,
  getTakeoverCaseStatusLabel,
  getTakeoverCaseResolutionNote,
  takeoverCaseToRecord,
  type TakeoverCase,
  type TakeoverCaseWorkflowAction,
} from "./takeover-case";
import {
  appendOperatorActionAuditEvent,
  type OperatorActionAuditName,
  type OperatorActionAuditSurface,
} from "../governance/operator-action-audit";
import { transitionAuthorityTakeoverCase } from "../gateway/authority-control";
import { gateway, type ProviderManifest } from "../gateway";
import { readCompanyRuntimeState } from "../../infrastructure/company/runtime/selectors";
import { applyAuthorityBootstrapToStore } from "../../infrastructure/authority/bootstrap-command";
import { enqueueDelegationDispatch } from "./async-dispatch";
import type { DispatchRecord } from "../../domain/delegation/types";

function mapAuditAction(action: TakeoverCaseWorkflowAction): OperatorActionAuditName {
  switch (action) {
    case "acknowledge":
      return "takeover_case_acknowledge";
    case "assign":
      return "takeover_case_assign";
    case "start":
      return "takeover_case_start";
    case "resolve":
      return "takeover_case_resolve";
    case "redispatch":
      return "takeover_case_redispatch";
    case "archive":
      return "takeover_case_archive";
    default:
      return "takeover_case_acknowledge";
  }
}

function describeAction(action: TakeoverCaseWorkflowAction, nextStatusLabel: string) {
  switch (action) {
    case "acknowledge":
      return {
        title: "已确认接管",
        description: `人工接管项已进入「${nextStatusLabel}」状态。`,
      };
    case "assign":
      return {
        title: "已指派接管人",
        description: `接管项已进入「${nextStatusLabel}」状态。`,
      };
    case "start":
      return {
        title: "已开始人工处理",
        description: `接管项已进入「${nextStatusLabel}」状态。`,
      };
    case "resolve":
      return {
        title: "已标记恢复",
        description: `接管项已进入「${nextStatusLabel}」状态。`,
      };
    case "redispatch":
      return {
        title: "已重新派发给执行人",
        description: "人工接管结论已回填，并已把后续步骤重新派发给 agent。",
      };
    case "archive":
      return {
        title: "已归档接管项",
        description: `接管项已进入「${nextStatusLabel}」状态。`,
      };
    default:
      return {
        title: "接管状态已更新",
        description: `当前状态 ${nextStatusLabel}。`,
      };
  }
}

export async function persistTakeoverCaseWorkflowAction(input: {
  activeCompany: Company;
  updateCompany: (updates: Partial<Company>) => Promise<unknown>;
  caseItem: TakeoverCase;
  action: TakeoverCaseWorkflowAction;
  actorId?: string | null;
  actorLabel?: string | null;
  assigneeAgentId?: string | null;
  assigneeLabel?: string | null;
  note?: string | null;
  dispatchId?: string | null;
  authorityBackedState?: boolean;
}) {
  const authorityBackedState =
    input.authorityBackedState ?? readCompanyRuntimeState().authorityBackedState;

  if (authorityBackedState) {
    const result = await transitionAuthorityTakeoverCase({
      companyId: input.activeCompany.id,
      caseRecord: takeoverCaseToRecord(input.caseItem),
      action: input.action,
      actorId: input.actorId,
      actorLabel: input.actorLabel,
      assigneeAgentId: input.assigneeAgentId,
      assigneeLabel: input.assigneeLabel,
      note: input.note,
      dispatchId: input.dispatchId,
    });
    applyAuthorityBootstrapToStore(result.bootstrap);
    return result.takeoverCase;
  }

  const nextTakeoverCases = applyTakeoverCaseWorkflowAction({
    company: input.activeCompany,
    caseItem: input.caseItem,
    action: input.action,
    actorId: input.actorId,
    actorLabel: input.actorLabel,
    assigneeAgentId: input.assigneeAgentId,
    assigneeLabel: input.assigneeLabel,
    note: input.note,
    dispatchId: input.dispatchId,
  });
  const nextRecord = nextTakeoverCases.find((record) => record.id === input.caseItem.id) ?? null;
  await input.updateCompany({ takeoverCases: nextTakeoverCases });
  return nextRecord;
}

function resolveRedispatchTarget(caseItem: TakeoverCase) {
  const agentId = caseItem.ownerAgentId?.trim() || caseItem.assigneeAgentId?.trim() || null;
  const label = caseItem.ownerAgentId?.trim()
    ? caseItem.ownerLabel
    : caseItem.assigneeLabel ?? caseItem.ownerLabel;
  return {
    agentId,
    label,
  };
}

function buildTakeoverRedispatchMessage(caseItem: TakeoverCase, note: string) {
  const resolutionNote = getTakeoverCaseResolutionNote(caseItem);
  return [
    `这是对「${caseItem.title}」的重新派发。`,
    `当前接管结论：${note}`,
    resolutionNote && resolutionNote !== note ? `最近人工处理结果：${resolutionNote}` : null,
    `此前失败摘要：${caseItem.failureSummary}`,
    `建议下一步：${caseItem.recommendedNextAction}`,
    "请先明确回复“已收到并继续处理”，然后直接推进，不要只停留在状态汇报。",
  ]
    .filter((value): value is string => Boolean(value))
    .join("\n");
}

export async function persistTakeoverCaseRedispatch(input: {
  activeCompany: Company;
  providerManifest: ProviderManifest;
  updateCompany: (updates: Partial<Company>) => Promise<unknown>;
  upsertDispatchRecord?: ((dispatch: DispatchRecord) => void) | null;
  caseItem: TakeoverCase;
  actorId?: string | null;
  actorLabel?: string | null;
  note: string;
  authorityBackedState?: boolean;
}) {
  const authorityBackedState =
    input.authorityBackedState ?? readCompanyRuntimeState().authorityBackedState;
  const target = resolveRedispatchTarget(input.caseItem);
  const workItemId = input.caseItem.sourceWorkItemId?.trim() || null;
  if (!target.agentId || !workItemId) {
    throw new Error("当前接管项缺少可重新派发的负责人或 work item。");
  }

  const timestamp = Date.now();
  const dispatchId = `dispatch:takeover:${input.caseItem.id}:${target.agentId}:${timestamp}`;
  const note = input.note.trim();
  const dispatch = await enqueueDelegationDispatch({
    backend: gateway,
    manifest: input.providerManifest,
    company: input.activeCompany,
    actorId: target.agentId,
    dispatchId,
    workItemId,
    title: `人工接管续推 · ${input.caseItem.title}`,
    message: buildTakeoverRedispatchMessage(input.caseItem, note),
    summary: note || input.caseItem.recommendedNextAction,
    fromActorId: input.actorId?.trim() || "operator:local-user",
    targetActorIds: [target.agentId],
    topicKey: input.caseItem.sourceTopicKey,
    roomId: input.caseItem.sourceRoomId,
    sourceMessageId: input.caseItem.sourceDispatchId ?? undefined,
    sourceStepId: input.caseItem.sourceDispatchId ?? undefined,
    createdAt: timestamp,
  }).then((result) => result.dispatch);

  if (!authorityBackedState && input.upsertDispatchRecord) {
    input.upsertDispatchRecord(dispatch);
  }

  const takeoverCase = await persistTakeoverCaseWorkflowAction({
    activeCompany: input.activeCompany,
    updateCompany: input.updateCompany,
    caseItem: input.caseItem,
    action: "redispatch",
    actorId: input.actorId,
    actorLabel: input.actorLabel,
    assigneeAgentId: target.agentId,
    assigneeLabel: target.label,
    note,
    dispatchId,
    authorityBackedState,
  });

  return {
    dispatch,
    takeoverCase,
    targetAgentId: target.agentId,
    targetLabel: target.label,
  };
}

export function useTakeoverCaseWorkflow(input: {
  activeCompany: Company | null;
  updateCompany: (updates: Partial<Company>) => Promise<unknown>;
  providerManifest?: ProviderManifest | null;
  upsertDispatchRecord?: ((dispatch: DispatchRecord) => void) | null;
  surface: Extract<OperatorActionAuditSurface, "board" | "chat" | "lobby">;
  actorId?: string | null;
  actorLabel?: string | null;
}) {
  const [busyCaseId, setBusyCaseId] = useState<string | null>(null);

  const runTakeoverAction = useCallback(
    async (options: {
      caseItem: TakeoverCase;
      action: TakeoverCaseWorkflowAction;
      assigneeAgentId?: string | null;
      assigneeLabel?: string | null;
      note?: string | null;
    }) => {
      if (!input.activeCompany) {
        return false;
      }

      const { caseItem, action, assigneeAgentId, assigneeLabel, note } = options;
      setBusyCaseId(caseItem.id);
      try {
        const nextRecord = await persistTakeoverCaseWorkflowAction({
          activeCompany: input.activeCompany,
          updateCompany: input.updateCompany,
          caseItem,
          action,
          actorId: input.actorId,
          actorLabel: input.actorLabel,
          assigneeAgentId,
          assigneeLabel,
          note,
        });
        void appendOperatorActionAuditEvent({
          companyId: input.activeCompany.id,
          action: mapAuditAction(action),
          surface: input.surface,
          outcome: "succeeded",
          actorId: input.actorId,
          details: {
            takeoverCaseId: caseItem.id,
            sourceSessionKey: caseItem.sourceSessionKey,
            nextStatus: nextRecord?.status ?? caseItem.status,
            assigneeAgentId: nextRecord?.assigneeAgentId ?? null,
            assigneeLabel: nextRecord?.assigneeLabel ?? null,
            sourceWorkItemId: caseItem.sourceWorkItemId,
            sourceTopicKey: caseItem.sourceTopicKey,
            sourceDispatchId: caseItem.sourceDispatchId,
          },
        });
        const nextStatusLabel = getTakeoverCaseStatusLabel(nextRecord?.status ?? caseItem.status);
        const message = describeAction(action, nextStatusLabel);
        toast.success(message.title, message.description);
        return true;
      } catch (error) {
        void appendOperatorActionAuditEvent({
          companyId: input.activeCompany.id,
          action: mapAuditAction(action),
          surface: input.surface,
          outcome: "failed",
          actorId: input.actorId,
          error: error instanceof Error ? error.message : String(error),
          details: {
            takeoverCaseId: caseItem.id,
            sourceSessionKey: caseItem.sourceSessionKey,
          },
        });
        toast.error("接管状态更新失败", error instanceof Error ? error.message : String(error));
        return false;
      } finally {
        setBusyCaseId(null);
      }
    },
    [input],
  );

  const runTakeoverRedispatch = useCallback(
    async (options: {
      caseItem: TakeoverCase;
      note: string;
    }) => {
      if (!input.activeCompany || !input.providerManifest) {
        toast.error("重新派发失败", "当前还没有可用的执行器能力清单。");
        return false;
      }

      const { caseItem, note } = options;
      setBusyCaseId(caseItem.id);
      try {
        const result = await persistTakeoverCaseRedispatch({
          activeCompany: input.activeCompany,
          providerManifest: input.providerManifest,
          updateCompany: input.updateCompany,
          upsertDispatchRecord: input.upsertDispatchRecord ?? null,
          caseItem,
          actorId: input.actorId,
          actorLabel: input.actorLabel,
          note,
        });
        void appendOperatorActionAuditEvent({
          companyId: input.activeCompany.id,
          action: "takeover_case_redispatch",
          surface: input.surface,
          outcome: "succeeded",
          actorId: input.actorId,
          details: {
            takeoverCaseId: caseItem.id,
            sourceSessionKey: caseItem.sourceSessionKey,
            sourceWorkItemId: caseItem.sourceWorkItemId,
            sourceTopicKey: caseItem.sourceTopicKey,
            redispatchId: result.dispatch.id,
            targetActorId: result.targetAgentId,
            targetLabel: result.targetLabel,
          },
        });
        const message = describeAction("redispatch", getTakeoverCaseStatusLabel(result.takeoverCase?.status ?? caseItem.status));
        toast.success(message.title, message.description);
        return true;
      } catch (error) {
        void appendOperatorActionAuditEvent({
          companyId: input.activeCompany.id,
          action: "takeover_case_redispatch",
          surface: input.surface,
          outcome: "failed",
          actorId: input.actorId,
          error: error instanceof Error ? error.message : String(error),
          details: {
            takeoverCaseId: caseItem.id,
            sourceSessionKey: caseItem.sourceSessionKey,
          },
        });
        toast.error("重新派发失败", error instanceof Error ? error.message : String(error));
        return false;
      } finally {
        setBusyCaseId(null);
      }
    },
    [input],
  );

  return {
    busyCaseId,
    runTakeoverAction,
    runTakeoverRedispatch,
  };
}
