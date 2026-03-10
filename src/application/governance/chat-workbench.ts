import { formatAgentLabel, type ExecutionFocusSummary } from "./focus-summary";
import { buildCompanyChatRoute } from "../../lib/chat-routes";
import type { ChatCollaborationTimelineItem } from "../mission/chat-collaboration-timeline";
import type { FocusProgressEvent, FocusProgressTone } from "./chat-progress";
import type { Company } from "../../domain/org/types";

export type ChatWorkbenchActionLike = {
  id: string;
  label: string;
  description: string;
  kind: "message" | "navigate" | "recover" | "copy";
  tone: "primary" | "secondary" | "ghost";
  targetAgentId?: string;
  followupTargetAgentId?: string;
  followupTargetLabel?: string;
  preferResolvedSession?: boolean;
  href?: string;
  message?: string;
};

export type ChatWorkbenchState = {
  workbenchTone: FocusProgressTone;
  workbenchOwnerAgentId: string | null;
  workbenchOwnerLabel: string;
  workbenchStage: string;
  workbenchStatusLabel: string;
  workbenchHeadline: string;
  workbenchSummary: string;
  workbenchActionHint: string;
  workbenchOpenAction: ChatWorkbenchActionLike | null;
};

type BuildChatWorkbenchInput = {
  activeCompany: Company | null;
  latestBlockingProgressEvent: FocusProgressEvent | null;
  currentTimelineItem: ChatCollaborationTimelineItem | null;
  focusSummary: ExecutionFocusSummary;
  latestProgressEvent: FocusProgressEvent | null;
  sessionExecutionActionable: boolean;
  focusActions: ChatWorkbenchActionLike[];
  targetAgentId: string | null;
};

export function buildChatWorkbench(input: BuildChatWorkbenchInput): ChatWorkbenchState {
  const genericBlockerAction =
    input.focusActions.find((action) => action.kind === "navigate" && action.targetAgentId) ??
    input.focusActions.find((action) => action.kind === "navigate") ??
    null;
  const genericNudgingAction =
    input.focusActions.find((action) => action.kind === "message" && action.targetAgentId) ??
    input.focusActions.find((action) => action.kind === "recover") ??
    input.focusActions[0] ??
    null;

  const workbenchTone: FocusProgressTone =
    input.latestBlockingProgressEvent?.tone ??
    input.currentTimelineItem?.tone ??
    (input.focusSummary.userAction ? "rose" : input.sessionExecutionActionable ? "amber" : "slate");
  const workbenchOwnerAgentId =
    input.latestBlockingProgressEvent?.actorAgentId ??
    input.currentTimelineItem?.assigneeAgentId ??
    genericBlockerAction?.targetAgentId ??
    genericNudgingAction?.targetAgentId ??
    null;
  const workbenchOwnerLabel =
    workbenchOwnerAgentId && input.activeCompany
      ? formatAgentLabel(input.activeCompany, workbenchOwnerAgentId)
      : input.currentTimelineItem?.assigneeLabel ?? input.focusSummary.ownerLabel;
  const workbenchStage = input.currentTimelineItem?.title ?? input.focusSummary.currentWork;
  const workbenchStatusLabel =
    input.latestBlockingProgressEvent
      ? "已阻塞"
      : input.currentTimelineItem?.statusLabel ?? input.focusSummary.headline;
  const workbenchHeadline =
    input.latestBlockingProgressEvent && workbenchOwnerLabel
      ? `当前卡点在 ${workbenchOwnerLabel}`
      : input.currentTimelineItem?.assigneeLabel
        ? `当前流转到 ${input.currentTimelineItem.assigneeLabel}`
        : input.focusSummary.headline;
  const workbenchSummary =
    input.latestBlockingProgressEvent?.summary ??
    input.focusSummary.blockReason ??
    input.latestProgressEvent?.summary ??
    input.focusSummary.currentWork;
  const workbenchActionHint =
    genericBlockerAction?.description ??
    genericNudgingAction?.description ??
    input.focusSummary.userAction ??
    input.focusSummary.nextStep;
  const workbenchOpenAction =
    genericBlockerAction ??
    (workbenchOwnerAgentId && workbenchOwnerAgentId !== input.targetAgentId
      ? {
          id: `open-workbench:${workbenchOwnerAgentId}`,
          label: `打开 ${workbenchOwnerLabel} 会话`,
          description: `直接进入 ${workbenchOwnerLabel} 的会话继续处理当前卡点。`,
          kind: "navigate" as const,
          tone: "secondary" as const,
          targetAgentId: workbenchOwnerAgentId,
          href: buildCompanyChatRoute(workbenchOwnerAgentId, input.activeCompany?.id),
        }
      : null);

  return {
    workbenchTone,
    workbenchOwnerAgentId,
    workbenchOwnerLabel,
    workbenchStage,
    workbenchStatusLabel,
    workbenchHeadline,
    workbenchSummary,
    workbenchActionHint,
    workbenchOpenAction,
  };
}
