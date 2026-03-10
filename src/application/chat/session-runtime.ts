import {
  buildRequirementRoomRecordSignature,
  buildRoomConversationBindingsFromSessions,
  convertRequirementRoomRecordToChatMessages,
  mergeRequirementRoomRecordFromSessions,
  mergeRequirementRoomRecordFromSnapshots,
} from "../delegation/room-routing";
import { gateway, type ChatMessage } from "../gateway";
import { roundSnapshotToChatMessage } from "../mission/history/round-restore";
import type { RequirementSessionSnapshot } from "../../domain/mission/requirement-snapshot";
import type {
  RequirementRoomRecord,
  RoomConversationBindingRecord,
} from "../../domain/delegation/types";
import type { RoundRecord } from "../../domain/mission/types";
import type { Company } from "../../domain/org/types";

const CHAT_HISTORY_FETCH_LIMIT = 80;

function normalizeMessage(raw: ChatMessage): ChatMessage {
  return {
    ...raw,
    timestamp: typeof raw.timestamp === "number" ? raw.timestamp : Date.now(),
  };
}

export type ChatSessionInitializationResult = {
  sessionKey: string | null;
  messages: ChatMessage[] | null;
  roomRecord?: RequirementRoomRecord | null;
  roomRecordSignature?: string | null;
  roomBindings?: RoomConversationBindingRecord[];
  isGenerating?: boolean;
  streamText?: string | null;
};

export async function initializeChatSession(input: {
  activeCompany: Company | null;
  archiveId: string | null;
  activeArchivedRound: RoundRecord | null;
  effectiveGroupSessionKey: string | null;
  effectiveOwnerAgentId: string | null;
  effectiveRequirementRoom: RequirementRoomRecord | null;
  effectiveRequirementRoomSnapshots: RequirementSessionSnapshot[];
  groupTitle: string;
  groupTopicKey?: string | null;
  groupWorkItemId: string | null;
  historyAgentId: string | null;
  isArchiveView: boolean;
  isGroup: boolean;
  persistedWorkItemStartedAt?: number | null;
  providerId: string;
  requirementRoomSessions: Array<{ sessionKey: string; agentId: string }>;
  requirementRoomTargetAgentIds: string[];
  targetAgentId: string | null;
}) : Promise<ChatSessionInitializationResult> {
  let actualKey = input.effectiveGroupSessionKey;
  if (!actualKey) {
    if (!input.targetAgentId) {
      return {
        sessionKey: null,
        messages: null,
      };
    }
    const result = await gateway.resolveSession(input.targetAgentId);
    if (result.ok && result.key) {
      actualKey = result.key;
    }
  }

  if (!actualKey) {
    return {
      sessionKey: null,
      messages: null,
    };
  }

  if (input.isArchiveView && input.archiveId) {
    if (input.activeArchivedRound) {
      return {
        sessionKey: actualKey,
        messages: input.activeArchivedRound.messages
          .map(roundSnapshotToChatMessage)
          .filter((message): message is ChatMessage => Boolean(message)),
        isGenerating: false,
        streamText: null,
      };
    }
    if (input.historyAgentId) {
      const archive = await gateway.getSessionArchive(
        input.historyAgentId,
        input.archiveId,
        200,
      );
      return {
        sessionKey: actualKey,
        messages: archive.messages || [],
        isGenerating: false,
        streamText: null,
      };
    }
  }

  if (!input.isGroup) {
    const history = await gateway.getChatHistory(actualKey, CHAT_HISTORY_FETCH_LIMIT);
    return {
      sessionKey: actualKey,
      messages: history.messages || [],
    };
  }

  const existingRoom = input.effectiveRequirementRoom ?? null;
  const roomBaseInput = {
    company: input.activeCompany,
    companyId: input.activeCompany?.id,
    workItemId: input.groupWorkItemId,
    sessionKey: actualKey,
    title: input.groupTitle,
    memberIds: input.requirementRoomTargetAgentIds,
    ownerAgentId:
      existingRoom?.ownerActorId ??
      existingRoom?.ownerAgentId ??
      input.effectiveOwnerAgentId ??
      input.targetAgentId ??
      null,
    topicKey: input.groupTopicKey ?? null,
    startedAt: input.persistedWorkItemStartedAt ?? null,
  } as const;

  if (input.requirementRoomSessions.length > 0) {
    const histories = await Promise.all(
      input.requirementRoomSessions.map(async (roomSession) => {
        try {
          const history = await gateway.getChatHistory(
            roomSession.sessionKey,
            CHAT_HISTORY_FETCH_LIMIT,
          );
          return {
            sessionKey: roomSession.sessionKey,
            agentId: roomSession.agentId,
            messages: (history.messages || []).map(normalizeMessage),
          };
        } catch {
          return {
            sessionKey: roomSession.sessionKey,
            agentId: roomSession.agentId,
            messages: [],
          };
        }
      }),
    );
    let roomRecord = mergeRequirementRoomRecordFromSessions({
      ...roomBaseInput,
      room: existingRoom,
      sessions: histories,
      providerId: input.providerId,
    });
    if (input.effectiveRequirementRoomSnapshots.length > 0) {
      roomRecord = mergeRequirementRoomRecordFromSnapshots({
        ...roomBaseInput,
        room: roomRecord,
        snapshots: input.effectiveRequirementRoomSnapshots,
      });
    }
    return {
      sessionKey: actualKey,
      roomRecord,
      roomRecordSignature: buildRequirementRoomRecordSignature(roomRecord),
      roomBindings: buildRoomConversationBindingsFromSessions({
        roomId: roomRecord.id,
        providerId: input.providerId,
        sessions: histories,
        updatedAt: roomRecord.updatedAt,
      }),
      messages: convertRequirementRoomRecordToChatMessages(roomRecord),
    };
  }

  if (input.effectiveRequirementRoomSnapshots.length > 0) {
    const roomRecord = mergeRequirementRoomRecordFromSnapshots({
      ...roomBaseInput,
      room: existingRoom,
      snapshots: input.effectiveRequirementRoomSnapshots,
    });
    return {
      sessionKey: actualKey,
      roomRecord,
      roomRecordSignature: buildRequirementRoomRecordSignature(roomRecord),
      roomBindings: buildRoomConversationBindingsFromSessions({
        roomId: roomRecord.id,
        providerId: input.providerId,
        sessions: input.effectiveRequirementRoomSnapshots.map((snapshot) => ({
          sessionKey: snapshot.sessionKey,
          agentId: snapshot.agentId,
        })),
        updatedAt: roomRecord.updatedAt,
      }),
      messages: convertRequirementRoomRecordToChatMessages(roomRecord),
    };
  }

  return {
    sessionKey: actualKey,
    messages: existingRoom ? convertRequirementRoomRecordToChatMessages(existingRoom) : null,
  };
}
