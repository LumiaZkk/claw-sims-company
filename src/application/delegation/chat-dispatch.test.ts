import { describe, expect, it } from "vitest";
import { parseChatEventPayload } from "./chat-dispatch";

describe("parseChatEventPayload", () => {
  it("keeps optional thinkingLevel from authority chat events", () => {
    const payload = parseChatEventPayload({
      runId: "run-1",
      sessionKey: "agent:writer:main",
      seq: 3,
      state: "delta",
      thinkingLevel: "low",
      message: {
        role: "assistant",
        text: "partial",
        timestamp: 123,
      },
    });

    expect(payload).toMatchObject({
      runId: "run-1",
      sessionKey: "agent:writer:main",
      seq: 3,
      state: "delta",
      thinkingLevel: "low",
    });
  });
});
