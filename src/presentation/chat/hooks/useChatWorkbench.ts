import { useMemo } from "react";
import {
  buildChatWorkbench,
  type ChatWorkbenchActionLike,
  type ChatWorkbenchState,
} from "../../../application/governance/chat-workbench";
import type { ExecutionFocusSummary } from "../../../application/governance/focus-summary";
import type { FocusProgressEvent } from "../../../application/governance/chat-progress";
import type { ChatCollaborationTimelineItem } from "../../../application/mission/chat-collaboration-timeline";
import type { Company } from "../../../domain/org/types";

type UseChatWorkbenchInput = {
  activeCompany: Company | null;
  latestBlockingProgressEvent: FocusProgressEvent | null;
  currentTimelineItem: ChatCollaborationTimelineItem | null;
  focusSummary: ExecutionFocusSummary;
  latestProgressEvent: FocusProgressEvent | null;
  sessionExecutionActionable: boolean;
  focusActions: ChatWorkbenchActionLike[];
  targetAgentId: string | null;
};

export function useChatWorkbench(input: UseChatWorkbenchInput): ChatWorkbenchState {
  return useMemo(
    () =>
      buildChatWorkbench({
        activeCompany: input.activeCompany,
        latestBlockingProgressEvent: input.latestBlockingProgressEvent,
        currentTimelineItem: input.currentTimelineItem,
        focusSummary: input.focusSummary,
        latestProgressEvent: input.latestProgressEvent,
        sessionExecutionActionable: input.sessionExecutionActionable,
        focusActions: input.focusActions,
        targetAgentId: input.targetAgentId,
      }),
    [
      input.activeCompany,
      input.currentTimelineItem,
      input.focusActions,
      input.focusSummary,
      input.latestBlockingProgressEvent,
      input.latestProgressEvent,
      input.sessionExecutionActionable,
      input.targetAgentId,
    ],
  );
}
