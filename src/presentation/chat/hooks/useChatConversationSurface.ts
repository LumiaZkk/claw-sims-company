import { useMemo } from "react";
import {
  buildChatConversationSurface,
  type ChatConversationSurface,
} from "../../../application/mission/chat-conversation-surface";
import type { ChatMessage } from "../../../application/gateway";
import type { RequirementSessionSnapshot } from "../../../domain/mission/requirement-snapshot";
import type { HandoffRecord, RequirementRoomRecord, RequestRecord } from "../../../domain/delegation/types";
import type { Company } from "../../../domain/org/types";
import type {
  ConversationStateRecord,
  RequirementAggregateRecord,
  TrackedTask,
  WorkItemRecord,
} from "../../../domain/mission/types";

type UseChatConversationSurfaceInput = {
  activeCompany: Company | null;
  activeConversationState: ConversationStateRecord | null;
  activeRequirementRoom: RequirementRoomRecord | null;
  activeRoomRecords: RequirementRoomRecord[];
  activeWorkItems: WorkItemRecord[];
  activeRequirementAggregates: RequirementAggregateRecord[];
  primaryRequirementId: string | null;
  companySessionSnapshots: RequirementSessionSnapshot[];
  requirementRoomSnapshots: RequirementSessionSnapshot[];
  requirementRoomSnapshotAgentIds: string[];
  requestPreview: RequestRecord[];
  handoffPreview: HandoffRecord[];
  structuredTaskPreview: TrackedTask | null;
  messages: ChatMessage[];
  currentTime: number;
  historyAgentId: string | null;
  sessionKey: string | null;
  productRoomId: string | null;
  groupTopicKey: string | null;
  groupWorkItemId: string | null;
  isGroup: boolean;
  isCeoSession: boolean;
  isFreshConversation: boolean;
  isRequirementBootstrapPending: boolean;
  isSummaryOpen: boolean;
  summaryPanelView: "owner" | "team" | "debug";
};

export function useChatConversationSurface(
  input: UseChatConversationSurfaceInput,
): ChatConversationSurface {
  return useMemo(
    () =>
      buildChatConversationSurface({
        activeCompany: input.activeCompany,
        activeConversationState: input.activeConversationState,
        activeRequirementRoom: input.activeRequirementRoom,
        activeRoomRecords: input.activeRoomRecords,
        activeWorkItems: input.activeWorkItems,
        activeRequirementAggregates: input.activeRequirementAggregates,
        primaryRequirementId: input.primaryRequirementId,
        companySessionSnapshots: input.companySessionSnapshots,
        requirementRoomSnapshots: input.requirementRoomSnapshots,
        requirementRoomSnapshotAgentIds: input.requirementRoomSnapshotAgentIds,
        requestPreview: input.requestPreview,
        handoffPreview: input.handoffPreview,
        structuredTaskPreview: input.structuredTaskPreview,
        messages: input.messages,
        currentTime: input.currentTime,
        historyAgentId: input.historyAgentId,
        sessionKey: input.sessionKey,
        productRoomId: input.productRoomId,
        groupTopicKey: input.groupTopicKey,
        groupWorkItemId: input.groupWorkItemId,
        isGroup: input.isGroup,
        isCeoSession: input.isCeoSession,
        isFreshConversation: input.isFreshConversation,
        isRequirementBootstrapPending: input.isRequirementBootstrapPending,
        isSummaryOpen: input.isSummaryOpen,
        summaryPanelView: input.summaryPanelView,
      }),
    [
      input.activeCompany,
      input.activeConversationState,
      input.activeRequirementRoom,
      input.activeRoomRecords,
      input.activeWorkItems,
      input.activeRequirementAggregates,
      input.primaryRequirementId,
      input.companySessionSnapshots,
      input.currentTime,
      input.groupTopicKey,
      input.groupWorkItemId,
      input.handoffPreview,
      input.historyAgentId,
      input.isCeoSession,
      input.isFreshConversation,
      input.isGroup,
      input.isRequirementBootstrapPending,
      input.isSummaryOpen,
      input.messages,
      input.productRoomId,
      input.requestPreview,
      input.requirementRoomSnapshotAgentIds,
      input.requirementRoomSnapshots,
      input.sessionKey,
      input.structuredTaskPreview,
      input.summaryPanelView,
    ],
  );
}
