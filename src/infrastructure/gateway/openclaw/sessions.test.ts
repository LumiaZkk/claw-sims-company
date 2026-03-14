import { describe, expect, it, vi } from "vitest";
import { buildSessionMethods } from "./sessions";

describe("openclaw session methods", () => {
  it("preserves thinking level from chat.history", async () => {
    const request = vi.fn();
    request.mockResolvedValue({
      sessionKey: "agent:writer:main",
      sessionId: "agent:writer:main",
      messages: [{ role: "assistant", text: "OK", timestamp: 1 }],
      thinkingLevel: "low",
    });
    const methods = buildSessionMethods({
      request: request as unknown as <T = unknown>(method: string, params?: unknown) => Promise<T>,
    });

    const result = await methods.getChatHistory("agent:writer:main", 5);

    expect(request).toHaveBeenCalledWith("chat.history", {
      sessionKey: "agent:writer:main",
      limit: 5,
    });
    expect(result.thinkingLevel).toBe("low");
  });

  it("forwards thinking level on chat.send", async () => {
    const request = vi.fn();
    request.mockResolvedValue({
      runId: "run-1",
      status: "started" as const,
    });
    const methods = buildSessionMethods({
      request: request as unknown as <T = unknown>(method: string, params?: unknown) => Promise<T>,
    });

    await methods.sendChatMessage("agent:writer:main", "请总结一下", {
      thinkingLevel: "high",
      timeoutMs: 1234,
    });

    expect(request).toHaveBeenCalledWith(
      "chat.send",
      expect.objectContaining({
        sessionKey: "agent:writer:main",
        message: "请总结一下",
        thinking: "high",
        timeoutMs: 1234,
      }),
    );
  });
});
