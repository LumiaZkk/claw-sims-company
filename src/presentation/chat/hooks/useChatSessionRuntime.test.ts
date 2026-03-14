import { describe, expect, it } from "vitest";
import type { ProviderRuntimeEvent } from "../../../infrastructure/gateway/runtime/types";
import {
  extractRuntimeAssistantStreamUpdate,
  resolveHistoryStreamSyncCandidate,
  resolveMergedRuntimeAssistantText,
} from "./useChatSessionRuntime";

function createRuntimeEvent(
  overrides: Partial<ProviderRuntimeEvent> = {},
): ProviderRuntimeEvent {
  return {
    providerId: "openclaw",
    agentId: "agent-1",
    sessionKey: "agent:agent-1:main",
    runId: "run-1",
    streamKind: "assistant",
    runState: "streaming",
    timestamp: 1,
    raw: {
      stream: "assistant",
      data: {
        text: "Hello",
        delta: "Hello",
      },
    },
    ...overrides,
  };
}

describe("useChatSessionRuntime helpers", () => {
  it("extracts assistant text and delta from runtime raw payloads", () => {
    expect(extractRuntimeAssistantStreamUpdate(createRuntimeEvent())).toEqual({
      text: "Hello",
      delta: "Hello",
    });
  });

  it("ignores assistant runtime events without raw text payloads", () => {
    expect(
      extractRuntimeAssistantStreamUpdate(
        createRuntimeEvent({
          raw: {
            runId: "run-1",
            state: "delta",
            message: {
              role: "assistant",
            },
          },
        }),
      ),
    ).toBeNull();
  });

  it("prefers cumulative assistant text when it extends the previous stream", () => {
    expect(
      resolveMergedRuntimeAssistantText({
        previousText: "Hello",
        nextText: "Hello world",
        nextDelta: "",
      }),
    ).toBe("Hello world");
  });

  it("appends assistant deltas without duplicating overlaps", () => {
    expect(
      resolveMergedRuntimeAssistantText({
        previousText: "Hello",
        nextText: "",
        nextDelta: "lo world",
      }),
    ).toBe("Hello world");
  });

  it("keeps the longer existing stream when a shorter snapshot arrives without delta", () => {
    expect(
      resolveMergedRuntimeAssistantText({
        previousText: "Hello world",
        nextText: "Hello",
        nextDelta: "",
      }),
    ).toBe("Hello world");
  });

  it("syncs preview from history when the latest message is a plain assistant reply", () => {
    expect(
      resolveHistoryStreamSyncCandidate(
        [
          {
            role: "user",
            content: [{ type: "text", text: "Hi" }],
            timestamp: 10,
          },
          {
            role: "assistant",
            content: [{ type: "text", text: "Hello world" }],
            timestamp: 20,
          },
        ],
        15,
      ),
    ).toEqual({
      message: {
        role: "assistant",
        content: [{ type: "text", text: "Hello world" }],
        timestamp: 20,
      },
      text: "Hello world",
    });
  });

  it("ignores history replies that still contain tool calls", () => {
    expect(
      resolveHistoryStreamSyncCandidate(
        [
          {
            role: "assistant",
            content: [
              { type: "text", text: "Let me check that." },
              { type: "toolCall", id: "tool-1", name: "session_status", arguments: {} },
            ],
            timestamp: 20,
          },
        ],
        10,
      ),
    ).toBeNull();
  });

  it("ignores older assistant messages when newer non-terminal records exist", () => {
    expect(
      resolveHistoryStreamSyncCandidate(
        [
          {
            role: "assistant",
            content: [{ type: "text", text: "Final answer" }],
            timestamp: 20,
          },
          {
            role: "toolResult",
            content: [{ type: "text", text: "tool output" }],
            timestamp: 21,
          },
        ],
        10,
      ),
    ).toBeNull();
  });
});
