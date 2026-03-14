import { describe, expect, it } from "vitest";
import type { ProviderRuntimeEvent } from "../../../src/infrastructure/gateway/runtime/types";
import {
  createSerialTaskQueue,
  shouldPersistChatRuntimeProjection,
  shouldPersistRuntimeProjectionEvent,
} from "./executor-event-hot-path";

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
      data: {
        text: "hello",
        delta: "hello",
      },
    },
    ...overrides,
  };
}

describe("executor event hot path", () => {
  it("skips runtime projection persistence for streaming assistant chunks", () => {
    expect(shouldPersistRuntimeProjectionEvent(createRuntimeEvent())).toBe(false);
  });

  it("keeps runtime projection persistence for non-streaming lifecycle events", () => {
    expect(
      shouldPersistRuntimeProjectionEvent(
        createRuntimeEvent({
          streamKind: "lifecycle",
          runState: "completed",
        }),
      ),
    ).toBe(true);
  });

  it("skips chat runtime persistence for delta events", () => {
    expect(
      shouldPersistChatRuntimeProjection({
        runId: "run-1",
        sessionKey: "agent:agent-1:main",
        seq: 1,
        state: "delta",
      }),
    ).toBe(false);
  });

  it("keeps chat runtime persistence for terminal events", () => {
    expect(
      shouldPersistChatRuntimeProjection({
        runId: "run-1",
        sessionKey: "agent:agent-1:main",
        seq: 2,
        state: "final",
      }),
    ).toBe(true);
  });

  it("runs queued tasks serially", async () => {
    const observed: string[] = [];
    const queue = createSerialTaskQueue();

    await Promise.all([
      queue("first", async () => {
        observed.push("first:start");
        await Promise.resolve();
        observed.push("first:end");
      }),
      queue("second", async () => {
        observed.push("second:start");
        observed.push("second:end");
      }),
    ]);

    expect(observed).toEqual([
      "first:start",
      "first:end",
      "second:start",
      "second:end",
    ]);
  });
});
