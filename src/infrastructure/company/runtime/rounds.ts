import { persistRoundRecords } from "../persistence/round-persistence";
import { sanitizeRoundRecords } from "../persistence/round-persistence";
import type { CompanyRuntimeState, RoundRecord, RuntimeGet, RuntimeSet } from "./types";
import {
  deleteAuthorityRound,
  upsertAuthorityRound,
} from "../../../application/gateway/authority-control";
import {
  applyAuthorityRuntimeCommandError,
  applyAuthorityRuntimeSnapshotToStore,
} from "../../authority/runtime-command";

export function persistActiveRounds(companyId: string | null | undefined, rounds: RoundRecord[]) {
  persistRoundRecords(companyId, rounds);
}

function areRoundRecordsEquivalent(left: RoundRecord, right: RoundRecord): boolean {
  return (
    left.id === right.id &&
    left.companyId === right.companyId &&
    left.title === right.title &&
    (left.preview ?? null) === (right.preview ?? null) &&
    (left.workItemId ?? null) === (right.workItemId ?? null) &&
    (left.roomId ?? null) === (right.roomId ?? null) &&
    (left.reason ?? null) === (right.reason ?? null) &&
    (left.sourceActorId ?? null) === (right.sourceActorId ?? null) &&
    (left.sourceActorLabel ?? null) === (right.sourceActorLabel ?? null) &&
    (left.sourceSessionKey ?? null) === (right.sourceSessionKey ?? null) &&
    (left.sourceConversationId ?? null) === (right.sourceConversationId ?? null) &&
    (left.providerArchiveId ?? null) === (right.providerArchiveId ?? null) &&
    left.archivedAt === right.archivedAt &&
    left.restorable === right.restorable &&
    left.messages.length === right.messages.length &&
    left.messages.every((message, index) => {
      const other = right.messages[index];
      if (!other) {
        return false;
      }
      return (
        message.role === other.role &&
        message.text === other.text &&
        message.timestamp === other.timestamp
      );
    })
  );
}

export function areRoundRecordCollectionsEquivalent(left: RoundRecord[], right: RoundRecord[]): boolean {
  if (left.length !== right.length) {
    return false;
  }
  return left.every((round, index) => {
    const other = right[index];
    return Boolean(other) && areRoundRecordsEquivalent(round, other);
  });
}

export function buildRoundActions(
  set: RuntimeSet,
  get: RuntimeGet,
): Pick<CompanyRuntimeState, "upsertRoundRecord" | "deleteRoundRecord"> {
  return {
    upsertRoundRecord: (round) => {
      const { activeCompany, activeRoundRecords, authorityBackedState } = get();
      if (!activeCompany) {
        return;
      }

      if (authorityBackedState) {
        void upsertAuthorityRound({
          companyId: activeCompany.id,
          round: {
            ...round,
            companyId: activeCompany.id,
          },
        })
          .then((snapshot) => {
            applyAuthorityRuntimeSnapshotToStore({
              operation: "command",
              snapshot,
              route: "round.upsert",
              set,
              get,
            });
          })
          .catch((error) => {
            applyAuthorityRuntimeCommandError({
              error,
              set,
              fallbackMessage: "Failed to upsert round through authority",
            });
          });
        return;
      }

      const next = [...activeRoundRecords];
      const index = next.findIndex((item) => item.id === round.id);
      const normalized = {
        ...round,
        companyId: activeCompany.id,
      };
      if (index >= 0) {
        const existing = next[index];
        if (normalized.archivedAt <= existing.archivedAt) {
          return;
        }
        next[index] = { ...existing, ...normalized };
      } else {
        next.push(normalized);
      }

      const sorted = sanitizeRoundRecords(next);
      if (areRoundRecordCollectionsEquivalent(activeRoundRecords, sorted)) {
        return;
      }
      set({ activeRoundRecords: sorted });
      persistActiveRounds(activeCompany.id, sorted);
    },

    deleteRoundRecord: (roundId) => {
      const { activeCompany, activeRoundRecords, authorityBackedState } = get();
      if (!activeCompany) {
        return;
      }

      if (authorityBackedState) {
        void deleteAuthorityRound({
          companyId: activeCompany.id,
          roundId,
        })
          .then((snapshot) => {
            applyAuthorityRuntimeSnapshotToStore({
              operation: "command",
              snapshot,
              route: "round.delete",
              set,
              get,
            });
          })
          .catch((error) => {
            applyAuthorityRuntimeCommandError({
              error,
              set,
              fallbackMessage: "Failed to delete round through authority",
            });
          });
        return;
      }

      const next = activeRoundRecords.filter((round) => round.id !== roundId);
      set({ activeRoundRecords: next });
      persistActiveRounds(activeCompany.id, next);
    },
  };
}
