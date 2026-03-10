import { useCallback } from "react";
import type { Dispatch, SetStateAction } from "react";
import { resetChatSession } from "../../../application/mission/history/chat-session-reset";
import type { ChatMessage } from "../../../application/gateway";
import type { FocusProgressEvent } from "../../../application/governance/chat-progress";
import type { FocusActionWatch } from "../view-models/focus";
import type { WorkItemRecord } from "../../../domain/mission/types";
import type { RequirementRoomRecord } from "../../../domain/delegation/types";
import type { Company } from "../../../domain/org/types";

export function useChatSessionReset(input: {
  sessionKey: string | null;
  messages: ChatMessage[];
  activeCompany: Company | null;
  isArchiveView: boolean;
  currentConversationWorkItemId: string | null;
  isGroup: boolean;
  effectiveRequirementRoom: RequirementRoomRecord | null;
  groupWorkItemId: string | null;
  activeConversationMission: {
    title?: string;
    ownerAgentId?: string | null;
    ownerLabel?: string | null;
  } | null;
  persistedWorkItem: WorkItemRecord | null;
  historyAgentId: string | null;
  currentActorAgentId: string | null;
  currentActorLabel: string | null;
  providerId: string;
  conversationStateKey: string | null;
  clearConversationState: (conversationId: string) => void;
  upsertRoundRecord: (round: import("../../../domain/mission/types").RoundRecord) => void;
  setMessages: Dispatch<SetStateAction<ChatMessage[]>>;
  setLoading: (value: boolean) => void;
  setLocalProgressEvents: Dispatch<SetStateAction<FocusProgressEvent[]>>;
  setActionWatches: Dispatch<SetStateAction<FocusActionWatch[]>>;
  setIsSummaryOpen: (value: boolean) => void;
  setIsTechnicalSummaryOpen: (value: boolean) => void;
  beginGeneratingState: (
    startedAt: number,
    options?: { runId?: string | null; streamText?: string | null; persist?: boolean },
  ) => void;
  clearGeneratingState: () => void;
  incrementHistoryRefreshNonce: () => void;
  navigate: (to: string, options?: { replace?: boolean }) => void;
  pathname: string;
  search: string;
}) {
  const navigateToCurrentConversation = useCallback(() => {
    const nextSearchParams = new URLSearchParams(input.search);
    nextSearchParams.delete("archive");
    const nextSearch = nextSearchParams.toString();
    input.navigate(`${input.pathname}${nextSearch ? `?${nextSearch}` : ""}`);
  }, [input]);

  const navigateToArchivedRound = useCallback(
    (nextArchiveId: string) => {
      const nextSearchParams = new URLSearchParams(input.search);
      nextSearchParams.set("archive", nextArchiveId);
      input.navigate(`${input.pathname}?${nextSearchParams.toString()}`);
    },
    [input],
  );

  const resetConversationView = useCallback(
    (options?: { isGenerating?: boolean }) => {
      input.setLoading(true);
      input.setMessages([]);
      input.setLocalProgressEvents([]);
      input.setActionWatches([]);
      input.setIsSummaryOpen(false);
      input.setIsTechnicalSummaryOpen(false);
      if (options?.isGenerating === true) {
        input.beginGeneratingState(Date.now(), { runId: null, streamText: null });
      } else {
        input.clearGeneratingState();
      }
    },
    [input],
  );

  const handleClearSession = useCallback(
    async (reason: "new" | "reset" = "reset") => {
      if (!input.sessionKey) {
        return false;
      }

      try {
        const result = await resetChatSession({
          sessionKey: input.sessionKey,
          reason,
          messages: input.messages,
          activeCompany: input.activeCompany,
          isArchiveView: input.isArchiveView,
          currentConversationWorkItemId: input.currentConversationWorkItemId,
          isGroup: input.isGroup,
          effectiveRequirementRoom: input.effectiveRequirementRoom,
          groupWorkItemId: input.groupWorkItemId,
          activeConversationMission: input.activeConversationMission,
          persistedWorkItem: input.persistedWorkItem,
          historyAgentId: input.historyAgentId,
          currentActorAgentId: input.currentActorAgentId,
          currentActorLabel: input.currentActorLabel,
          providerId: input.providerId,
        });

        if (result.nextRound) {
          input.upsertRoundRecord(result.nextRound);
        }
        if (input.conversationStateKey) {
          input.clearConversationState(input.conversationStateKey);
        }
        if (input.isArchiveView) {
          const nextSearchParams = new URLSearchParams(input.search);
          nextSearchParams.delete("archive");
          const nextSearch = nextSearchParams.toString();
          input.navigate(`${input.pathname}${nextSearch ? `?${nextSearch}` : ""}`, { replace: true });
        }

        resetConversationView();
        input.incrementHistoryRefreshNonce();
        return true;
      } catch (error) {
        console.error("Failed to reset session:", error);
        return false;
      }
    },
    [input, resetConversationView],
  );

  return {
    handleClearSession,
    navigateToCurrentConversation,
    navigateToArchivedRound,
    resetConversationView,
  };
}
