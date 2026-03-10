import { persistConversationStateRecords } from "../persistence/conversation-state-persistence";
import type { CompanyRuntimeState, ConversationStateRecord, RuntimeGet, RuntimeSet } from "./types";

export function persistActiveConversationStates(
  companyId: string | null | undefined,
  states: ConversationStateRecord[],
) {
  persistConversationStateRecords(companyId, states);
}

export function areConversationStateRecordsEquivalent(
  left: ConversationStateRecord,
  right: ConversationStateRecord,
): boolean {
  return (
    left.companyId === right.companyId &&
    left.conversationId === right.conversationId &&
    (left.currentWorkKey ?? null) === (right.currentWorkKey ?? null) &&
    (left.currentWorkItemId ?? null) === (right.currentWorkItemId ?? null) &&
    (left.currentRoundId ?? null) === (right.currentRoundId ?? null)
  );
}

export function buildConversationStateActions(
  set: RuntimeSet,
  get: RuntimeGet,
): Pick<CompanyRuntimeState, "setConversationCurrentWorkKey" | "clearConversationState"> {
  return {
    setConversationCurrentWorkKey: (conversationId, workKey, workItemId, roundId) => {
      const { activeCompany, activeConversationStates } = get();
      if (!activeCompany || !conversationId) {
        return;
      }

      const nextRecord: ConversationStateRecord = {
        companyId: activeCompany.id,
        conversationId,
        currentWorkKey: workKey ?? null,
        currentWorkItemId: workItemId ?? null,
        currentRoundId: roundId ?? null,
        updatedAt: Date.now(),
      };
      const next = [...activeConversationStates];
      const index = next.findIndex((record) => record.conversationId === conversationId);
      if (index >= 0) {
        const existing = next[index]!;
        const merged: ConversationStateRecord = {
          ...existing,
          ...nextRecord,
          companyId: activeCompany.id,
        };
        if (areConversationStateRecordsEquivalent(existing, merged)) {
          return;
        }
        next[index] = merged;
      } else {
        next.push(nextRecord);
      }
      const sorted = next.sort((left, right) => right.updatedAt - left.updatedAt);
      set({ activeConversationStates: sorted });
      persistActiveConversationStates(activeCompany.id, sorted);
    },

    clearConversationState: (conversationId) => {
      const { activeCompany, activeConversationStates } = get();
      if (!activeCompany || !conversationId) {
        return;
      }
      const next = activeConversationStates.filter((record) => record.conversationId !== conversationId);
      if (next.length === activeConversationStates.length) {
        return;
      }
      set({ activeConversationStates: next });
      persistActiveConversationStates(activeCompany.id, next);
    },
  };
}
