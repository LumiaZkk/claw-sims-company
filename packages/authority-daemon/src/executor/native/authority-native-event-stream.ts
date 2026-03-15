import {
  normalizeProviderRuntimeEvent,
  type AgentRunRecord,
} from "../../../../../src/application/agent-runtime";
import type { AuthorityEvent } from "../../../../../src/infrastructure/authority/contract";
import type { ProviderRuntimeEvent } from "../../../../../src/infrastructure/gateway/runtime/types";
import {
  EXECUTOR_PROVIDER_ID,
  readNumber,
  readString,
  resetSessionStatusCapabilityState,
  type StoredChatMessage,
} from "../../persistence/authority-persistence-shared";
import type { AuthorityRepository } from "../../persistence/authority-repository";
import {
  createSerialTaskQueue,
  shouldPersistChatRuntimeProjection,
  shouldPersistRuntimeProjectionEvent,
} from "../executor-event-hot-path";
import { createOpenClawExecutorBridge } from "../openclaw-bridge";

export function registerAuthorityNativeEventStream(input: {
  repository: AuthorityRepository;
  executorBridge: ReturnType<typeof createOpenClawExecutorBridge>;
  broadcast: (event: AuthorityEvent) => void;
  queueManagedExecutorSync: (reason: string) => void | Promise<void>;
  broadcastExecutorStatus: () => void;
  broadcastCompanyUpdated: (companyId: string) => void;
}) {
  const {
    repository,
    executorBridge,
    broadcast,
    queueManagedExecutorSync,
    broadcastExecutorStatus,
    broadcastCompanyUpdated,
  } = input;

  let lastExecutorConnectionState = executorBridge.snapshot().connectionState;
  const queueExecutorProjectionPersist = createSerialTaskQueue({
    onError: (error, label) => {
      console.error(`Authority executor projection task failed (${label})`, error);
    },
  });
  const streamingExecutorRunIds = new Set<string>();

  function normalizeChatPayload(
    payload: unknown,
  ): Extract<AuthorityEvent, { type: "chat" }>["payload"] | null {
    if (!payload || typeof payload !== "object") {
      return null;
    }
    const runId = readString((payload as Record<string, unknown>).runId);
    const sessionKey = readString((payload as Record<string, unknown>).sessionKey);
    const state = readString((payload as Record<string, unknown>).state);
    if (!runId || !sessionKey || !state) {
      return null;
    }
    if (state !== "delta" && state !== "final" && state !== "aborted" && state !== "error") {
      return null;
    }
    return {
      runId,
      sessionKey,
      seq: readNumber((payload as Record<string, unknown>).seq) ?? 0,
      state,
      message: (payload as Record<string, unknown>).message as Extract<AuthorityEvent, { type: "chat" }>["payload"]["message"],
      errorMessage: readString((payload as Record<string, unknown>).errorMessage) ?? undefined,
      thinkingLevel: readString((payload as Record<string, unknown>).thinkingLevel) ?? undefined,
    };
  }

  function buildRuntimeEventFromChatPayload(input: {
    payload: Extract<AuthorityEvent, { type: "chat" }>["payload"];
    agentId?: string | null;
  }): ProviderRuntimeEvent {
    return {
      providerId: EXECUTOR_PROVIDER_ID,
      agentId: input.agentId ?? null,
      sessionKey: input.payload.sessionKey,
      runId: input.payload.runId,
      streamKind: input.payload.state === "delta" ? "assistant" : "lifecycle",
      runState:
        input.payload.state === "delta"
          ? "streaming"
          : input.payload.state === "final"
            ? "completed"
            : input.payload.state === "error"
              ? "error"
              : "aborted",
      timestamp: input.payload.message?.timestamp ?? Date.now(),
      errorMessage: input.payload.errorMessage ?? null,
      raw: input.payload,
    };
  }

  function broadcastAgentRuntimeEvent(companyId: string | null, event: ProviderRuntimeEvent) {
    broadcast({
      type: "agent.runtime.updated",
      companyId,
      timestamp: event.timestamp,
      payload: {
        event,
      },
    });
  }

  function broadcastConversationUpdated(companyId?: string | null) {
    broadcast({
      type: "conversation.updated",
      companyId: companyId ?? null,
      timestamp: Date.now(),
    });
  }

  function updateExecutorRunHotPath(
    runId: string | null | undefined,
    status: AgentRunRecord["state"],
    payload?: Record<string, unknown>,
  ) {
    if (!runId) {
      return;
    }
    if (status === "streaming") {
      if (streamingExecutorRunIds.has(runId)) {
        return;
      }
      streamingExecutorRunIds.add(runId);
    } else if (status === "completed" || status === "aborted" || status === "error") {
      streamingExecutorRunIds.delete(runId);
    }
    repository.updateExecutorRun(runId, status, payload);
  }

  const disposeStateChange = executorBridge.onStateChange(() => {
    const connectionState = executorBridge.snapshot().connectionState;
    const transitionedToReady = connectionState === "ready" && lastExecutorConnectionState !== "ready";
    lastExecutorConnectionState = connectionState;
    broadcastExecutorStatus();
    if (transitionedToReady) {
      resetSessionStatusCapabilityState();
      void queueManagedExecutorSync("executor.ready");
    }
  });

  const disposeEvent = executorBridge.onEvent((event) => {
    if (event.event === "agent") {
      const runtimeEvent = normalizeProviderRuntimeEvent(EXECUTOR_PROVIDER_ID, event.payload);
      if (!runtimeEvent) {
        return;
      }
      const companyId =
        (runtimeEvent.sessionKey
          ? repository.getConversationContext(runtimeEvent.sessionKey)?.companyId
          : null)
        ?? (runtimeEvent.agentId ? repository.findCompanyIdByAgentId(runtimeEvent.agentId) : null);
      if (runtimeEvent.runId && runtimeEvent.runState) {
        updateExecutorRunHotPath(runtimeEvent.runId, runtimeEvent.runState, {
          errorMessage: runtimeEvent.errorMessage ?? undefined,
        });
      }
      broadcastAgentRuntimeEvent(companyId, runtimeEvent);
      if (companyId && shouldPersistRuntimeProjectionEvent(runtimeEvent)) {
        void queueExecutorProjectionPersist(`agent:${runtimeEvent.runId ?? runtimeEvent.sessionKey ?? "unknown"}`, () => {
          repository.applyRuntimeEvent(companyId, runtimeEvent);
        });
      }
      return;
    }

    if (event.event !== "chat") {
      return;
    }
    const payload = normalizeChatPayload(event.payload);
    if (!payload) {
      return;
    }
    const thinkingLevel = repository.getExecutorRunThinkingLevel(payload.runId) ?? payload.thinkingLevel ?? undefined;
    const enrichedPayload =
      thinkingLevel && thinkingLevel !== payload.thinkingLevel
        ? { ...payload, thinkingLevel }
        : payload;
    const context = repository.getConversationContext(payload.sessionKey);
    const runtimeEvent = buildRuntimeEventFromChatPayload({
      payload: enrichedPayload,
      agentId: context?.actorId ?? (enrichedPayload.sessionKey.split(":")[1] ?? null),
    });
    if (enrichedPayload.state === "final" && enrichedPayload.message) {
      updateExecutorRunHotPath(enrichedPayload.runId, "completed", { response: enrichedPayload.message });
    } else if (enrichedPayload.state === "error") {
      updateExecutorRunHotPath(enrichedPayload.runId, "error", {
        errorMessage: enrichedPayload.errorMessage ?? "OpenClaw run failed",
      });
    } else if (enrichedPayload.state === "aborted") {
      updateExecutorRunHotPath(enrichedPayload.runId, "aborted");
    } else if (enrichedPayload.state === "delta") {
      updateExecutorRunHotPath(enrichedPayload.runId, "streaming");
    }
    broadcastAgentRuntimeEvent(context?.companyId ?? null, runtimeEvent);
    broadcast({
      type: "chat",
      companyId: context?.companyId ?? null,
      timestamp: Date.now(),
      payload: enrichedPayload,
    });
    if (!shouldPersistChatRuntimeProjection(enrichedPayload)) {
      return;
    }

    void queueExecutorProjectionPersist(`chat:${enrichedPayload.runId}:${enrichedPayload.state}`, () => {
      if (enrichedPayload.state === "final" && enrichedPayload.message) {
        repository.appendAssistantMessage(enrichedPayload.sessionKey, enrichedPayload.message as StoredChatMessage);
        const controlUpdate = repository.applyAssistantControlMessage(
          enrichedPayload.sessionKey,
          enrichedPayload.message as StoredChatMessage,
        );
        if (controlUpdate.violations.length > 0) {
          console.warn("Assistant control contract violations", controlUpdate.violations);
        }
        if (controlUpdate.changed && controlUpdate.context?.companyId) {
          broadcastCompanyUpdated(controlUpdate.context.companyId);
        }
      }
      if (context?.companyId) {
        repository.applyRuntimeEvent(context.companyId, runtimeEvent);
      }
      broadcastConversationUpdated(context?.companyId ?? null);
    });
  });

  return () => {
    disposeStateChange();
    disposeEvent();
  };
}
