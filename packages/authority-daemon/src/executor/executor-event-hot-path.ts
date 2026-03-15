import type { ProviderRuntimeEvent } from "../../../../src/infrastructure/gateway/runtime/types";
import type { AuthorityEvent } from "../../../../src/infrastructure/authority/contract";

type QueueTask = () => void | Promise<void>;

export function isStreamingAssistantRuntimeEvent(event: ProviderRuntimeEvent): boolean {
  return event.runState === "streaming" && event.streamKind === "assistant";
}

export function shouldPersistRuntimeProjectionEvent(event: ProviderRuntimeEvent): boolean {
  return !isStreamingAssistantRuntimeEvent(event);
}

export function shouldPersistChatRuntimeProjection(
  payload: Extract<AuthorityEvent, { type: "chat" }>["payload"],
): boolean {
  return payload.state !== "delta";
}

export function createSerialTaskQueue(options?: {
  onError?: (error: unknown, label: string) => void;
}) {
  let tail = Promise.resolve();
  return (label: string, task: QueueTask) => {
    tail = tail
      .catch(() => {})
      .then(async () => {
        try {
          await task();
        } catch (error) {
          options?.onError?.(error, label);
        }
      });
    return tail;
  };
}
