import { useEffect, useMemo, useRef, type Dispatch, type MutableRefObject, type SetStateAction } from "react";
import {
  areRequirementRoomChatMessagesEqual,
  buildRequirementRoomRecordSignature,
  createIncomingRequirementRoomMessage,
} from "../../../application/delegation/room-routing";
import {
  readLiveChatSession,
  upsertLiveChatSession,
} from "../../../application/chat/live-session-cache";
import { initializeChatSession } from "../../../application/chat/session-runtime";
import { parseChatEventPayload, resolveDispatchReplyUpdates } from "../../../application/delegation/chat-dispatch";
import { gateway, type ChatMessage } from "../../../application/gateway";
import type { ProviderRuntimeEvent } from "../../../infrastructure/gateway/runtime/types";
import { readConversationWorkspaceState } from "../../../application/mission";
import { buildTrackedTaskFromChatFinal } from "../../../application/mission/chat-task-tracker";
import type { RequirementSessionSnapshot } from "../../../domain/mission/requirement-snapshot";
import type {
  DispatchRecord,
  RequirementRoomMessage,
  RequirementRoomRecord,
  RoomConversationBindingRecord,
} from "../../../domain/delegation/types";
import type { RoundRecord, TrackedTask } from "../../../domain/mission/types";
import type { Company } from "../../../domain/org/types";
import { toast } from "../../../components/system/toast-store";
import {
  buildVisibleChatMessage,
  CHAT_UI_MESSAGE_LIMIT,
  dedupeVisibleChatMessages,
  extractTextFromMessage,
  limitChatMessages,
  normalizeMessage,
  sanitizeVisibleChatFlow,
  shouldKeepVisibleChatMessage,
} from "../view-models/messages";

function mergeVisibleDirectMessages(previous: ChatMessage[], incoming: ChatMessage[]): ChatMessage[] {
  return limitChatMessages(
    dedupeVisibleChatMessages([...previous, ...incoming].map(normalizeMessage))
      .filter((message) => shouldKeepVisibleChatMessage(message))
      .map((message) => buildVisibleChatMessage(message)),
  );
}

function appendUniqueStreamSuffix(base: string, suffix: string): string {
  if (!suffix) {
    return base;
  }
  if (!base) {
    return suffix;
  }
  if (base.endsWith(suffix)) {
    return base;
  }
  const maxOverlap = Math.min(base.length, suffix.length);
  for (let overlap = maxOverlap; overlap > 0; overlap -= 1) {
    if (base.slice(-overlap) === suffix.slice(0, overlap)) {
      return base + suffix.slice(overlap);
    }
  }
  return base + suffix;
}

export function resolveMergedRuntimeAssistantText(params: {
  previousText: string;
  nextText: string;
  nextDelta: string;
}) {
  const { previousText, nextText, nextDelta } = params;
  if (nextText && previousText) {
    if (nextText.startsWith(previousText)) {
      return nextText;
    }
    if (previousText.startsWith(nextText) && !nextDelta) {
      return previousText;
    }
  }
  if (nextDelta) {
    return appendUniqueStreamSuffix(previousText, nextDelta);
  }
  if (nextText) {
    return nextText;
  }
  return previousText;
}

function readRuntimeAssistantString(record: Record<string, unknown> | null, key: string): string {
  if (!record) {
    return "";
  }
  const value = record[key];
  return typeof value === "string" ? value : "";
}

export function extractRuntimeAssistantStreamUpdate(
  runtimeEvent: ProviderRuntimeEvent,
): { text: string; delta: string } | null {
  if (runtimeEvent.streamKind !== "assistant" || !runtimeEvent.raw) {
    return null;
  }
  if (typeof runtimeEvent.raw !== "object" || Array.isArray(runtimeEvent.raw)) {
    return null;
  }

  const record = runtimeEvent.raw as Record<string, unknown>;
  const data =
    record.data && typeof record.data === "object" && !Array.isArray(record.data)
      ? (record.data as Record<string, unknown>)
      : null;
  const nested =
    record.payload && typeof record.payload === "object" && !Array.isArray(record.payload)
      ? (record.payload as Record<string, unknown>)
      : null;

  const text =
    readRuntimeAssistantString(data, "text")
    || readRuntimeAssistantString(nested, "text")
    || readRuntimeAssistantString(record, "text");
  const delta =
    readRuntimeAssistantString(data, "delta")
    || readRuntimeAssistantString(nested, "delta")
    || readRuntimeAssistantString(record, "delta");

  if (!text && !delta) {
    return null;
  }
  return { text, delta };
}

function messageContainsToolCall(message: ChatMessage | null | undefined) {
  if (!message || !Array.isArray(message.content)) {
    return false;
  }
  return message.content.some((block) => {
    if (!block || typeof block !== "object") {
      return false;
    }
    return (block as { type?: unknown }).type === "toolCall";
  });
}

export function resolveHistoryStreamSyncCandidate(
  messages: ChatMessage[],
  pendingSince: number,
): { message: ChatMessage; text: string } | null {
  const latestMessage = [...messages]
    .reverse()
    .find((message) => {
      const timestamp = typeof message.timestamp === "number" ? message.timestamp : 0;
      if (timestamp < pendingSince) {
        return false;
      }
      if (message.role !== "assistant" && message.role !== "system") {
        return false;
      }
      if (message.role === "assistant" && messageContainsToolCall(message)) {
        return false;
      }
      const text = extractTextFromMessage(message)?.trim() ?? "";
      return text.length > 0;
    }) ?? null;

  if (!latestMessage) {
    return null;
  }

  const latestMessageIndex = messages.lastIndexOf(latestMessage);
  if (latestMessageIndex !== messages.length - 1) {
    return null;
  }

  const text = extractTextFromMessage(latestMessage)?.trim() ?? "";
  if (!text) {
    return null;
  }

  return { message: latestMessage, text };
}

async function maybePersistTrackedTaskFromFinal(input: {
  finalText: string | null | undefined;
  sessionKey: string | null;
  agentId: string | null;
  activeCompany: Company | null;
  upsertTask: (task: TrackedTask) => Promise<void>;
}) {
  if (!input.finalText || !input.sessionKey) {
    return;
  }
  const trackedTask = buildTrackedTaskFromChatFinal({
    finalText: input.finalText,
    sessionKey: input.sessionKey,
    agentId: input.agentId || "",
    company: input.activeCompany,
  });
  if (trackedTask) {
    await input.upsertTask(trackedTask);
  }
}

function adoptDirectHistoryAsFinal(input: {
  historyMessages: ChatMessage[];
  sessionKey: string;
  agentId: string | null;
  activeCompany: Company | null;
  finalMessage: ChatMessage;
  setMessages: Dispatch<SetStateAction<ChatMessage[]>>;
  setSessionSyncStale: (value: boolean, error?: string | null) => void;
  clearGeneratingState: (options?: { preserveRuntime?: boolean }) => void;
  upsertTask: (task: TrackedTask) => Promise<void>;
}) {
  input.setMessages((previous) => mergeVisibleDirectMessages(previous, input.historyMessages));
  input.setSessionSyncStale(false, null);
  input.clearGeneratingState();
  void maybePersistTrackedTaskFromFinal({
    finalText: extractTextFromMessage(input.finalMessage),
    sessionKey: input.sessionKey,
    agentId: input.agentId,
    activeCompany: input.activeCompany,
    upsertTask: input.upsertTask,
  }).catch(console.error);
}

export type ChatSessionRuntimeInput = {
  activeCompany: Company | null;
  agentId: string | null;
  archiveId: string | null;
  activeArchivedRound: RoundRecord | null;
  authorityBackedState: boolean;
  companyRouteReady: boolean;
  connected: boolean;
  routeCompanyConflictMessage: string | null;
  groupTopicKey?: string | null;
  groupTitle: string;
  historyAgentId: string | null;
  isArchiveView: boolean;
  isGroup: boolean;
  providerId: string;
  persistedWorkItemStartedAt?: number | null;
  targetAgentId: string | null;
  effectiveOwnerAgentId: string | null;
  effectiveGroupSessionKey: string | null;
  effectiveRequirementRoom: RequirementRoomRecord | null;
  effectiveRequirementRoomSnapshots: RequirementSessionSnapshot[];
  requirementRoomSessions: Array<{ sessionKey: string; agentId: string }>;
  requirementRoomSessionKeys: Set<string>;
  requirementRoomTargetAgentIds: string[];
  groupWorkItemId: string | null;
  sessionKey: string | null;
  productRoomId: string | null;
  activeRoomBindings: RoomConversationBindingRecord[];
  currentConversationWorkItemId: string | null;
  currentConversationTopicKey?: string | null;
  lastSyncedRoomSignatureRef: MutableRefObject<string | null>;
  streamTextRef: MutableRefObject<string | null>;
  activeRunIdRef: MutableRefObject<string | null>;
  pendingGenerationStartedAtRef: MutableRefObject<number | null>;
  setActiveRunId: (value: string | null) => void;
  setLoading: (value: boolean) => void;
  setSessionSyncStale: (value: boolean, error?: string | null) => void;
  setSessionKey: (value: string | null) => void;
  setMessages: Dispatch<SetStateAction<ChatMessage[]>>;
  setIsGenerating: (value: boolean) => void;
  updateStreamText: (value: string | null) => void;
  restoreGeneratingState: (state: {
    runId?: string | null;
    startedAt: number;
    streamText?: string | null;
    isGenerating: boolean;
  } | null) => void;
  clearGeneratingState: (options?: { preserveRuntime?: boolean }) => void;
  upsertRoomRecord: (room: RequirementRoomRecord) => void;
  upsertRoomConversationBindings: (bindings: RoomConversationBindingRecord[]) => void;
  appendRoomMessages: (
    roomId: string,
    messages: RequirementRoomMessage[],
    meta?: Partial<Omit<RequirementRoomRecord, "id" | "transcript">>,
  ) => void;
  upsertDispatchRecord: (dispatch: DispatchRecord) => void;
  upsertTask: (task: TrackedTask) => Promise<void>;
};

export function useChatSessionRuntime(input: ChatSessionRuntimeInput) {
  const lastInitializationSignatureRef = useRef<string | null>(null);
  const inFlightInitializationSignatureRef = useRef<string | null>(null);
  const initializationRunRef = useRef(0);
  const mountedRef = useRef(true);
  const lastTerminalHydrationKeyRef = useRef<string | null>(null);
  const companyIdentitySignature = useMemo(
    () =>
      input.activeCompany
        ? [
            input.activeCompany.id,
            ...input.activeCompany.employees.map(
              (employee) => `${employee.agentId}:${employee.nickname}:${employee.role}`,
            ),
          ].join("|")
        : "",
    [input.activeCompany],
  );
  const roomSignature = useMemo(
    () => (input.isGroup ? buildRequirementRoomRecordSignature(input.effectiveRequirementRoom) : null),
    [input.effectiveRequirementRoom, input.isGroup],
  );
  const roomSessionsSignature = useMemo(
    () =>
      input.isGroup
        ? input.requirementRoomSessions
            .map((session) => `${session.agentId}:${session.sessionKey}`)
            .sort()
            .join("|")
        : "",
    [input.isGroup, input.requirementRoomSessions],
  );
  const roomSnapshotsSignature = useMemo(
    () =>
      input.isGroup
        ? input.effectiveRequirementRoomSnapshots
            .map((snapshot) => `${snapshot.agentId}:${snapshot.sessionKey}:${snapshot.updatedAt}`)
            .sort()
            .join("|")
        : "",
    [input.effectiveRequirementRoomSnapshots, input.isGroup],
  );
  const roomTargetAgentsSignature = useMemo(
    () => (input.isGroup ? [...input.requirementRoomTargetAgentIds].sort().join("|") : ""),
    [input.isGroup, input.requirementRoomTargetAgentIds],
  );

  useEffect(() => {
    let runId = 0;
    const initializationSignature = [
      input.agentId ?? "",
      input.archiveId ?? "",
      input.activeArchivedRound?.id ?? "",
      input.companyRouteReady ? "ready" : "not-ready",
      input.connected ? "connected" : "disconnected",
      input.routeCompanyConflictMessage ?? "",
      input.effectiveGroupSessionKey ?? "",
      input.effectiveOwnerAgentId ?? "",
      input.groupTitle,
      input.groupTopicKey ?? "",
      input.groupWorkItemId ?? "",
      input.historyAgentId ?? "",
      input.isArchiveView ? "archive" : "live",
      input.isGroup ? "group" : "direct",
      input.persistedWorkItemStartedAt ?? "",
      input.providerId,
      roomSignature ?? "",
      roomSessionsSignature,
      roomSnapshotsSignature,
      roomTargetAgentsSignature,
      input.targetAgentId ?? "",
    ].join("|");

    async function initChat() {
      if (
        !input.agentId ||
        !input.connected ||
        input.routeCompanyConflictMessage ||
        !input.companyRouteReady
      ) {
        if (input.routeCompanyConflictMessage) {
          input.setLoading(false);
          input.setMessages([]);
          input.setSessionKey(null);
        }
        return;
      }
      if (
        lastInitializationSignatureRef.current === initializationSignature &&
        input.sessionKey
      ) {
        input.setLoading(false);
        return;
      }
      if (inFlightInitializationSignatureRef.current === initializationSignature) {
        return;
      }

      try {
        runId = initializationRunRef.current + 1;
        initializationRunRef.current = runId;
        inFlightInitializationSignatureRef.current = initializationSignature;
        lastInitializationSignatureRef.current = initializationSignature;
        const initialization = await initializeChatSession({
          activeCompany: input.activeCompany,
          archiveId: input.archiveId,
          activeArchivedRound: input.activeArchivedRound,
          effectiveGroupSessionKey: input.effectiveGroupSessionKey,
          effectiveOwnerAgentId: input.effectiveOwnerAgentId,
          effectiveRequirementRoom: input.effectiveRequirementRoom,
          effectiveRequirementRoomSnapshots: input.effectiveRequirementRoomSnapshots,
          groupTitle: input.groupTitle,
          groupTopicKey: input.groupTopicKey,
          groupWorkItemId: input.groupWorkItemId,
          historyAgentId: input.historyAgentId,
          isArchiveView: input.isArchiveView,
          isGroup: input.isGroup,
          persistedWorkItemStartedAt: input.persistedWorkItemStartedAt,
          providerId: input.providerId,
          requirementRoomSessions: input.requirementRoomSessions,
          requirementRoomTargetAgentIds: input.requirementRoomTargetAgentIds,
          targetAgentId: input.targetAgentId,
        });

        if (!mountedRef.current || initializationRunRef.current !== runId || !initialization.sessionKey) {
          return;
        }

        input.setSessionKey(initialization.sessionKey);
        if (initialization.roomRecord && initialization.roomRecordSignature) {
          const existingRoomSignature = buildRequirementRoomRecordSignature(
            input.effectiveRequirementRoom,
          );
          if (
            initialization.roomRecordSignature !== input.lastSyncedRoomSignatureRef.current &&
            initialization.roomRecordSignature !== existingRoomSignature
          ) {
            input.lastSyncedRoomSignatureRef.current = initialization.roomRecordSignature;
            input.upsertRoomRecord(initialization.roomRecord);
          }
        }
        if (!input.authorityBackedState && initialization.roomBindings && initialization.roomBindings.length > 0) {
          input.upsertRoomConversationBindings(initialization.roomBindings);
        }
        if (initialization.messages) {
          const nextMessages = input.isGroup
            ? initialization.messages
            : sanitizeVisibleChatFlow(initialization.messages);
          input.setMessages((previous) =>
            areRequirementRoomChatMessagesEqual(previous, nextMessages)
              ? previous
              : nextMessages,
          );
        }
        if (!input.isGroup && initialization.lateHistoryMessagesPromise) {
          void initialization.lateHistoryMessagesPromise
            .then((lateHistoryMessages) => {
              if (
                !mountedRef.current ||
                initializationRunRef.current !== runId ||
                lateHistoryMessages.length === 0
              ) {
                return;
              }
              const lateVisibleMessages = sanitizeVisibleChatFlow(lateHistoryMessages);
              input.setMessages((previous) => {
                const mergedMessages = mergeVisibleDirectMessages(previous, lateVisibleMessages);
                return areRequirementRoomChatMessagesEqual(previous, mergedMessages)
                  ? previous
                  : mergedMessages;
              });
              input.setSessionSyncStale(false, null);
            })
            .catch(() => {});
        }
        if (typeof initialization.isGenerating === "boolean") {
          input.restoreGeneratingState(
            initialization.isGenerating
              ? {
                  runId: initialization.activeRunId ?? null,
                  startedAt: initialization.generationStartedAt ?? Date.now(),
                  streamText: initialization.streamText ?? null,
                  isGenerating: true,
                }
              : null,
          );
        } else {
          input.restoreGeneratingState(null);
        }
        input.setSessionSyncStale(false, null);
      } catch (error) {
        if (!mountedRef.current || initializationRunRef.current !== runId) {
          return;
        }
        console.error("Failed to init chat:", error);
        input.setSessionSyncStale(true, error instanceof Error ? error.message : String(error));
      } finally {
        if (inFlightInitializationSignatureRef.current === initializationSignature) {
          inFlightInitializationSignatureRef.current = null;
        }
        if (initializationRunRef.current === runId) {
          input.setLoading(false);
        }
      }
    }

    void initChat();
    return () => {
    };
  }, [
    input.activeArchivedRound,
    input.agentId,
    input.archiveId,
    input.companyRouteReady,
    companyIdentitySignature,
    input.connected,
    input.effectiveGroupSessionKey,
    input.effectiveOwnerAgentId,
    input.groupTitle,
      input.groupTopicKey,
      input.groupWorkItemId,
      input.historyAgentId,
      input.isArchiveView,
      input.isGroup,
      lastInitializationSignatureRef,
      input.lastSyncedRoomSignatureRef,
      input.persistedWorkItemStartedAt,
    input.providerId,
    roomTargetAgentsSignature,
    input.restoreGeneratingState,
    roomSessionsSignature,
    roomSignature,
    roomSnapshotsSignature,
    input.routeCompanyConflictMessage,
    input.setLoading,
    input.setMessages,
    input.setSessionKey,
    input.setSessionSyncStale,
    input.targetAgentId,
    input.upsertRoomConversationBindings,
    input.upsertRoomRecord,
  ]);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  useEffect(() => {
    if (!input.sessionKey || input.isArchiveView) {
      return;
    }

    const unsubscribe = gateway.subscribe("chat", (rawPayload) => {
      const payload = parseChatEventPayload(rawPayload);
      const payloadMatchesSession = input.isGroup
        ? input.requirementRoomSessionKeys.has(payload?.sessionKey ?? "")
        : payload?.sessionKey === input.sessionKey;
      if (!payload || !payloadMatchesSession) {
        return;
      }

      if (payload.state === "delta") {
        if (input.isGroup) {
          return;
        }
        const deltaText = extractTextFromMessage(payload.message);
        if (deltaText && deltaText.length >= (input.streamTextRef.current?.length ?? 0)) {
          input.activeRunIdRef.current = payload.runId || null;
          input.setActiveRunId(payload.runId || null);
          input.updateStreamText(deltaText);
          if (!input.pendingGenerationStartedAtRef.current) {
            input.pendingGenerationStartedAtRef.current = Date.now();
          }
          input.setIsGenerating(true);
        }
        return;
      }

      if (payload.state === "final") {
        const incoming = payload.message ? normalizeMessage(payload.message) : null;
        const visibleIncoming = incoming ? buildVisibleChatMessage(incoming) : null;
        if (input.isGroup) {
          const roomId = input.productRoomId ?? input.effectiveRequirementRoom?.id ?? null;
          const payloadSourceActorId =
            incoming &&
            typeof incoming.provenance === "object" &&
            incoming.provenance &&
            typeof (incoming.provenance as Record<string, unknown>).sourceActorId === "string"
              ? String((incoming.provenance as Record<string, unknown>).sourceActorId)
              : null;
          const agentKey =
            input.requirementRoomSessions.find((session) => session.sessionKey === payload.sessionKey)
              ?.agentId ??
            input.activeRoomBindings.find(
              (binding) =>
                binding.roomId === roomId &&
                binding.conversationId === payload.sessionKey &&
                typeof binding.actorId === "string" &&
                binding.actorId.trim().length > 0,
            )?.actorId ??
            payloadSourceActorId;
          const roomMessage =
            incoming && agentKey
              ? createIncomingRequirementRoomMessage({
                  company: input.activeCompany,
                  message: incoming,
                  sessionKey: payload.sessionKey,
                  agentId: agentKey,
                  roomId: roomId ?? undefined,
                  ownerAgentId:
                    input.effectiveRequirementRoom?.ownerAgentId ??
                    input.effectiveRequirementRoom?.ownerActorId ??
                    input.targetAgentId,
                })
              : null;

          if (roomMessage && input.sessionKey && agentKey) {
            input.upsertRoomConversationBindings([
              {
                roomId: roomId ?? "room:unknown",
                providerId: input.providerId,
                conversationId: payload.sessionKey,
                actorId: agentKey,
                nativeRoom: payload.sessionKey.includes(":group:"),
                updatedAt: roomMessage.timestamp,
              },
            ]);
            const currentDispatches = readConversationWorkspaceState().activeDispatches;
            const dispatchUpdates = resolveDispatchReplyUpdates({
              dispatches: currentDispatches,
              workItemId: input.currentConversationWorkItemId,
              roomId,
              actorId: agentKey,
              responseMessageId: roomMessage.id,
              timestamp: roomMessage.timestamp,
            });
            dispatchUpdates.forEach((dispatch) => input.upsertDispatchRecord(dispatch));
            input.appendRoomMessages(
              roomId ?? "room:unknown",
              [roomMessage],
              {
                sessionKey: input.sessionKey,
                companyId: input.activeCompany?.id,
                workItemId: input.currentConversationWorkItemId ?? undefined,
                title: input.effectiveRequirementRoom?.title ?? input.groupTitle,
                memberActorIds:
                  input.effectiveRequirementRoom?.memberActorIds ?? input.requirementRoomTargetAgentIds,
                memberIds:
                  input.effectiveRequirementRoom?.memberIds ?? input.requirementRoomTargetAgentIds,
                ownerActorId:
                  input.effectiveRequirementRoom?.ownerActorId ??
                  input.effectiveRequirementRoom?.ownerAgentId ??
                  input.targetAgentId,
                ownerAgentId:
                  input.effectiveRequirementRoom?.ownerAgentId ??
                  input.effectiveRequirementRoom?.ownerActorId ??
                  input.targetAgentId,
                topicKey: input.currentConversationTopicKey ?? undefined,
              },
            );
          }
          input.clearGeneratingState();
          return;
        }

        input.setMessages((previous) => {
          if (visibleIncoming && shouldKeepVisibleChatMessage(visibleIncoming)) {
            const base = previous.filter(
              (message) =>
                !(message.role === visibleIncoming.role && message.timestamp === visibleIncoming.timestamp),
            );
            return limitChatMessages([...base, visibleIncoming]) as ChatMessage[];
          }
          if (input.streamTextRef.current?.trim()) {
            return limitChatMessages([
              ...previous,
              {
                role: "assistant",
                content: [{ type: "text", text: input.streamTextRef.current }],
                timestamp: Date.now(),
              },
            ]) as ChatMessage[];
          }
          return previous;
        });
        input.clearGeneratingState();

        const finalText = incoming ? extractTextFromMessage(incoming) : input.streamTextRef.current;
        void maybePersistTrackedTaskFromFinal({
          finalText,
          sessionKey: input.sessionKey,
          agentId: input.agentId,
          activeCompany: input.activeCompany,
          upsertTask: input.upsertTask,
        }).catch(console.error);
        return;
      }

      if (payload.state === "aborted") {
        if (input.isGroup) {
          input.clearGeneratingState();
          return;
        }
        if (payload.runId && input.activeRunIdRef.current && payload.runId !== input.activeRunIdRef.current) {
          return;
        }

        input.setMessages((previous) => {
          if (input.streamTextRef.current?.trim()) {
            return limitChatMessages([
              ...previous,
              {
                role: "assistant",
                content: [{ type: "text", text: `${input.streamTextRef.current}\n\n[已中止]` }],
                timestamp: Date.now(),
              },
            ]) as ChatMessage[];
          }
          return previous;
        });
        input.clearGeneratingState();
        return;
      }

      if (payload.state === "error") {
        if (input.isGroup) {
          input.clearGeneratingState();
          toast.error("团队房间消息失败", payload.errorMessage ?? "请重试或改为直接联系成员。");
          return;
        }
        input.setMessages((previous) =>
          [
            ...limitChatMessages(previous),
            {
              role: "system" as const,
              content: payload.errorMessage ? `[Error] ${payload.errorMessage}` : "[Error] chat error",
              timestamp: Date.now(),
            },
          ].slice(-CHAT_UI_MESSAGE_LIMIT),
        );
        input.clearGeneratingState();
      }
    });

    return () => unsubscribe();
  }, [input]);

  useEffect(() => {
    if (!input.sessionKey || input.isArchiveView || input.isGroup) {
      return;
    }

    const currentSessionKey = input.sessionKey;
    let cancelled = false;
    let hydrationInFlight = false;

    const hydrateTerminalHistory = (runId: string | null | undefined) => {
      if (hydrationInFlight) {
        return;
      }
      const hydrationKey = [
        currentSessionKey,
        runId ?? input.activeRunIdRef.current ?? "",
        input.pendingGenerationStartedAtRef.current ?? 0,
      ].join("|");
      if (lastTerminalHydrationKeyRef.current === hydrationKey) {
        return;
      }
      lastTerminalHydrationKeyRef.current = hydrationKey;
      hydrationInFlight = true;

      void (async () => {
        try {
          for (let attempt = 0; attempt < 2; attempt += 1) {
            const history = await gateway.getChatHistory(currentSessionKey, 8);
            if (cancelled || !mountedRef.current) {
              return;
            }
            const pendingSince = input.pendingGenerationStartedAtRef.current ?? 0;
            const terminalMessage =
              [...(history.messages ?? [])]
                .reverse()
                .find((message) => {
                  const timestamp = typeof message.timestamp === "number" ? message.timestamp : 0;
                  return (
                    timestamp >= pendingSince &&
                    (message.role === "assistant" || message.role === "system")
                  );
                }) ?? null;

            if (terminalMessage) {
              adoptDirectHistoryAsFinal({
                historyMessages: history.messages ?? [],
                sessionKey: currentSessionKey,
                agentId: input.agentId,
                activeCompany: input.activeCompany,
                finalMessage: terminalMessage,
                setMessages: input.setMessages,
                setSessionSyncStale: input.setSessionSyncStale,
                clearGeneratingState: input.clearGeneratingState,
                upsertTask: input.upsertTask,
              });
              return;
            }

            if (attempt === 0) {
              await new Promise((resolve) => window.setTimeout(resolve, 250));
            }
          }
        } catch {
          lastTerminalHydrationKeyRef.current = null;
        } finally {
          hydrationInFlight = false;
        }
      })();
    };

    const unsubscribe = gateway.subscribe("*", (raw) => {
      if (!raw || typeof raw !== "object") {
        return;
      }
      const frame = raw as {
        event?: unknown;
        payload?: { event?: ProviderRuntimeEvent };
      };
      if (frame.event !== "agent.runtime.updated") {
        return;
      }
      const runtimeEvent = frame.payload?.event;
      if (!runtimeEvent || runtimeEvent.sessionKey !== currentSessionKey) {
        return;
      }
      if (
        input.activeRunIdRef.current &&
        runtimeEvent.runId &&
        runtimeEvent.runId !== input.activeRunIdRef.current
      ) {
        return;
      }

      const streamUpdate = extractRuntimeAssistantStreamUpdate(runtimeEvent);
      if (streamUpdate) {
        const liveSession = readLiveChatSession(input.activeCompany?.id, currentSessionKey);
        const previousText = input.streamTextRef.current ?? liveSession?.streamText ?? "";
        const nextText = resolveMergedRuntimeAssistantText({
          previousText,
          nextText: streamUpdate.text,
          nextDelta: streamUpdate.delta,
        });
        const startedAt = input.pendingGenerationStartedAtRef.current ?? liveSession?.startedAt ?? Date.now();
        const runId = runtimeEvent.runId ?? input.activeRunIdRef.current ?? liveSession?.runId ?? null;
        if (!input.pendingGenerationStartedAtRef.current) {
          input.pendingGenerationStartedAtRef.current = startedAt;
        }
        if (runId && runId !== input.activeRunIdRef.current) {
          input.activeRunIdRef.current = runId;
          input.setActiveRunId(runId);
        }
        if (nextText !== previousText) {
          input.updateStreamText(nextText);
        }
        input.setIsGenerating(true);
        upsertLiveChatSession(input.activeCompany?.id, currentSessionKey, {
          sessionKey: currentSessionKey,
          agentId: runtimeEvent.agentId ?? liveSession?.agentId ?? input.agentId,
          runId,
          streamText: nextText,
          isGenerating: true,
          startedAt,
          updatedAt: Date.now(),
        });
      }

      if (
        runtimeEvent.runState !== "completed" &&
        runtimeEvent.runState !== "aborted" &&
        runtimeEvent.runState !== "error"
      ) {
        return;
      }
      hydrateTerminalHistory(runtimeEvent.runId);
    });

    return () => {
      cancelled = true;
      unsubscribe();
    };
  }, [input]);

  useEffect(() => {
    if (!input.sessionKey || input.isArchiveView || input.isGroup) {
      return;
    }

    const currentSessionKey = input.sessionKey;
    let cancelled = false;
    let historySyncInFlight = false;

    const syncHistoryPreview = () => {
      if (historySyncInFlight) {
        return;
      }
      const liveSession = readLiveChatSession(input.activeCompany?.id, currentSessionKey);
      const pendingSince = input.pendingGenerationStartedAtRef.current ?? liveSession?.startedAt ?? 0;
      const isGenerating =
        Boolean(input.activeRunIdRef.current)
        || Boolean(input.pendingGenerationStartedAtRef.current)
        || Boolean(liveSession?.isGenerating);
      if (!isGenerating || pendingSince <= 0) {
        return;
      }

      historySyncInFlight = true;
      void (async () => {
        try {
          const history = await gateway.getChatHistory(currentSessionKey, 8);
          if (cancelled || !mountedRef.current) {
            return;
          }

          const candidate = resolveHistoryStreamSyncCandidate(history.messages ?? [], pendingSince);
          if (!candidate) {
            return;
          }
          adoptDirectHistoryAsFinal({
            historyMessages: history.messages ?? [],
            sessionKey: currentSessionKey,
            agentId: input.agentId,
            activeCompany: input.activeCompany,
            finalMessage: candidate.message,
            setMessages: input.setMessages,
            setSessionSyncStale: input.setSessionSyncStale,
            clearGeneratingState: input.clearGeneratingState,
            upsertTask: input.upsertTask,
          });
        } catch {
          // Best-effort preview sync: keep the live stream running even if history is temporarily unavailable.
        } finally {
          historySyncInFlight = false;
        }
      })();
    };

    syncHistoryPreview();
    const timer = window.setInterval(syncHistoryPreview, 200);
    return () => {
      cancelled = true;
      window.clearInterval(timer);
    };
  }, [input]);
}
