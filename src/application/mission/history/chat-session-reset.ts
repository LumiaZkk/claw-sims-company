import { AgentOps } from "../../org/employee-ops";
import { buildRoundRecord, buildRoomRecordIdFromWorkItem } from "../work-item";
import { buildRoundPreview, createRoundMessageSnapshots } from "./round-restore";
import type { ChatMessage } from "../../gateway";
import type { RequirementRoomRecord } from "../../../domain/delegation/types";
import type { RoundRecord, WorkItemRecord } from "../../../domain/mission/types";
import type { Company } from "../../../domain/org/types";

export async function resetChatSession(input: {
  sessionKey: string;
  reason: "new" | "reset";
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
}) {
  const archivedMessages = createRoundMessageSnapshots(input.messages);
  const archivedRoomId =
    (input.isGroup
      ? input.effectiveRequirementRoom?.id ??
        (input.groupWorkItemId ? buildRoomRecordIdFromWorkItem(input.groupWorkItemId) : null)
      : null) ?? null;
  const archivedTitle =
    input.activeConversationMission?.title ||
    input.persistedWorkItem?.title ||
    input.effectiveRequirementRoom?.title ||
    `${input.currentActorLabel ?? "当前负责人"} 对话`;
  const archivedPreview = buildRoundPreview(archivedMessages);
  const nextRound: RoundRecord | null =
    input.activeCompany && !input.isArchiveView && archivedMessages.length > 0
      ? buildRoundRecord({
          companyId: input.activeCompany.id,
          title: archivedTitle,
          preview: archivedPreview,
          reason: input.reason,
          workItemId: input.currentConversationWorkItemId,
          roomId: archivedRoomId,
          sourceActorId:
            input.historyAgentId ??
            input.activeConversationMission?.ownerAgentId ??
            input.persistedWorkItem?.ownerActorId ??
            input.currentActorAgentId ??
            null,
          sourceActorLabel:
            input.currentActorLabel ??
            input.activeConversationMission?.ownerLabel ??
            input.persistedWorkItem?.ownerLabel ??
            input.effectiveRequirementRoom?.ownerAgentId ??
            null,
          sourceSessionKey: input.sessionKey,
          sourceConversationId: input.sessionKey,
          providerId: input.providerId,
          messages: archivedMessages,
          restorable: true,
        })
      : null;

  await AgentOps.resetSession(input.sessionKey, input.reason);
  return { nextRound };
}
