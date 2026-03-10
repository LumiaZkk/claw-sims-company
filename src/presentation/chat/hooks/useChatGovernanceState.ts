import { useMemo } from "react";
import {
  buildChatGovernanceState,
  type ChatGovernanceState,
} from "../../../application/governance/chat-governance-state";
import type { ChatMessage } from "../../../application/gateway";
import type { CeoControlSurfaceSnapshot } from "../../../application/governance/ceo-control-surface";
import type { RequirementExecutionOverview } from "../../../application/mission/requirement-overview";
import type { ResolvedExecutionState } from "../../../application/mission/execution-state";
import type { ManualTakeoverPack } from "../../../application/delegation/takeover-pack";
import type { TrackedTask } from "../../../domain/mission/types";
import type { HandoffRecord, RequestRecord } from "../../../domain/delegation/types";
import type { Company } from "../../../domain/org/types";

type UseChatGovernanceStateInput = {
  activeCompany: Company | null;
  targetAgentId: string | null;
  targetRoleLabel: string;
  isGroup: boolean;
  isCeoSession: boolean;
  isFreshConversation: boolean;
  sessionKey: string | null;
  summaryAlertCount: number;
  sessionExecution: ResolvedExecutionState;
  structuredTaskPreview: TrackedTask | null;
  requestPreview: RequestRecord[];
  handoffPreview: HandoffRecord[];
  takeoverPack: ManualTakeoverPack | null;
  ceoSurface: CeoControlSurfaceSnapshot | null;
  alerts: Array<{ summary: string; recommendedAction?: string; detail?: string }>;
  requirementOverview: RequirementExecutionOverview | null;
  taskPlanOverview: {
    totalCount: number;
    doneCount: number;
    currentStep: { assigneeAgentId: string | null; title: string } | null;
  } | null;
  messages: ChatMessage[];
};

export function useChatGovernanceState(input: UseChatGovernanceStateInput): ChatGovernanceState {
  return useMemo(
    () =>
      buildChatGovernanceState({
        activeCompany: input.activeCompany,
        targetAgentId: input.targetAgentId,
        targetRoleLabel: input.targetRoleLabel,
        isGroup: input.isGroup,
        isCeoSession: input.isCeoSession,
        isFreshConversation: input.isFreshConversation,
        sessionKey: input.sessionKey,
        summaryAlertCount: input.summaryAlertCount,
        sessionExecution: input.sessionExecution,
        structuredTaskPreview: input.structuredTaskPreview,
        requestPreview: input.requestPreview,
        handoffPreview: input.handoffPreview,
        takeoverPack: input.takeoverPack,
        ceoSurface: input.ceoSurface,
        alerts: input.alerts,
        requirementOverview: input.requirementOverview,
        taskPlanOverview: input.taskPlanOverview,
        messages: input.messages,
      }),
    [
      input.activeCompany,
      input.alerts,
      input.ceoSurface,
      input.handoffPreview,
      input.isCeoSession,
      input.isFreshConversation,
      input.isGroup,
      input.messages,
      input.requestPreview,
      input.requirementOverview,
      input.sessionExecution,
      input.sessionKey,
      input.structuredTaskPreview,
      input.summaryAlertCount,
      input.takeoverPack,
      input.targetAgentId,
      input.targetRoleLabel,
      input.taskPlanOverview,
    ],
  );
}
