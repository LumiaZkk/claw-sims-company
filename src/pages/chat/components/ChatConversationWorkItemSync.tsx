import { memo, useEffect, useMemo } from "react";
import { buildConversationWorkItemTruth } from "../../../application/mission/conversation-truth";
import { areWorkItemRecordsEquivalent } from "../../../application/mission/work-item-equivalence";
import type { RequirementExecutionOverview } from "../../../application/mission/requirement-overview";
import type { ArtifactRecord } from "../../../domain/artifact/types";
import type { DispatchRecord, RequirementRoomRecord } from "../../../domain/delegation/types";
import type {
  ConversationMissionRecord,
  WorkItemRecord,
} from "../../../domain/mission/types";
import type { Company } from "../../../domain/org/types";

type ChatConversationWorkItemSyncProps = {
  activeCompany: Company | null;
  authorityBackedState: boolean;
  conversationMissionRecord: ConversationMissionRecord | null;
  conversationStateKey: string | null;
  effectiveRequirementRoom: RequirementRoomRecord | null;
  persistedWorkItem: WorkItemRecord | null;
  productRoomId: string | null;
  requirementOverview: RequirementExecutionOverview | null;
  sessionKey: string | null;
  shouldPersistConversationTruth: boolean;
  activeArtifacts: ArtifactRecord[];
  activeDispatches: DispatchRecord[];
  upsertWorkItemRecord: (workItem: WorkItemRecord) => void;
  setConversationCurrentWorkKey: (
    conversationId: string,
    workKey: string | null,
    workItemId: string | null,
    roundId: string | null,
  ) => void;
};

export const ChatConversationWorkItemSync = memo(function ChatConversationWorkItemSync(
  input: ChatConversationWorkItemSyncProps,
) {
  const {
    activeCompany,
    authorityBackedState,
    conversationMissionRecord,
    conversationStateKey,
    effectiveRequirementRoom,
    persistedWorkItem,
    productRoomId,
    requirementOverview,
    sessionKey,
    shouldPersistConversationTruth,
    activeArtifacts,
    activeDispatches,
    upsertWorkItemRecord,
    setConversationCurrentWorkKey,
  } = input;

  const reconciledConversationWorkItem = useMemo(
    () =>
      buildConversationWorkItemTruth({
        shouldPersistConversationTruth,
        activeCompany,
        persistedWorkItem,
        conversationMissionRecord,
        requirementOverview,
        effectiveRequirementRoom,
        activeArtifacts,
        activeDispatches,
        sessionKey,
        productRoomId,
      }),
    [
      activeCompany,
      activeArtifacts,
      activeDispatches,
      conversationMissionRecord,
      effectiveRequirementRoom,
      persistedWorkItem,
      productRoomId,
      requirementOverview,
      sessionKey,
      shouldPersistConversationTruth,
    ],
  );

  const shouldPersistReconciledConversationWorkItem = useMemo(
    () =>
      Boolean(
        reconciledConversationWorkItem &&
          (!persistedWorkItem ||
            !areWorkItemRecordsEquivalent(
              reconciledConversationWorkItem,
              persistedWorkItem,
            )),
      ),
    [persistedWorkItem, reconciledConversationWorkItem],
  );

  useEffect(() => {
    if (
      authorityBackedState ||
      !shouldPersistConversationTruth ||
      !reconciledConversationWorkItem ||
      !shouldPersistReconciledConversationWorkItem
    ) {
      return;
    }
    upsertWorkItemRecord(reconciledConversationWorkItem);
    if (conversationStateKey) {
      setConversationCurrentWorkKey(
        conversationStateKey,
        reconciledConversationWorkItem.workKey,
        reconciledConversationWorkItem.id,
        reconciledConversationWorkItem.roundId,
      );
    }
  }, [
    authorityBackedState,
    conversationStateKey,
    setConversationCurrentWorkKey,
    shouldPersistConversationTruth,
    reconciledConversationWorkItem,
    shouldPersistReconciledConversationWorkItem,
    upsertWorkItemRecord,
  ]);

  return null;
});
