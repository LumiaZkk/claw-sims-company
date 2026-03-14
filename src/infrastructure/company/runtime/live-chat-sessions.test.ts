import { describe, expect, it, vi } from "vitest";
import {
  clearLiveChatSession,
  readLiveChatSession,
  subscribeLiveChatSession,
  upsertLiveChatSession,
} from "./live-chat-sessions";

describe("live chat session subscriptions", () => {
  it("notifies only subscribers for the matching company session", () => {
    const listener = vi.fn();
    const otherListener = vi.fn();

    const unsubscribe = subscribeLiveChatSession("company-a", "session-a", listener);
    const unsubscribeOther = subscribeLiveChatSession("company-a", "session-b", otherListener);

    upsertLiveChatSession("company-a", "session-a", {
      sessionKey: "session-a",
      isGenerating: true,
      streamText: "hello",
      startedAt: 1,
      updatedAt: 1,
    });

    expect(listener).toHaveBeenCalledTimes(1);
    expect(otherListener).not.toHaveBeenCalled();

    clearLiveChatSession("company-a", "session-a");
    unsubscribe();
    unsubscribeOther();
  });

  it("stops notifying after unsubscribe", () => {
    const listener = vi.fn();
    const unsubscribe = subscribeLiveChatSession("company-b", "session-a", listener);

    unsubscribe();
    upsertLiveChatSession("company-b", "session-a", {
      sessionKey: "session-a",
      isGenerating: true,
      streamText: "hello",
      startedAt: 1,
      updatedAt: 1,
    });

    expect(listener).not.toHaveBeenCalled();
    clearLiveChatSession("company-b", "session-a");
  });

  it("does not notify again when the live session state is unchanged", () => {
    const listener = vi.fn();
    const unsubscribe = subscribeLiveChatSession("company-d", "session-a", listener);

    upsertLiveChatSession("company-d", "session-a", {
      sessionKey: "session-a",
      isGenerating: true,
      streamText: "hello",
      startedAt: 1,
      updatedAt: 1,
      runId: "run-1",
    });
    upsertLiveChatSession("company-d", "session-a", {
      sessionKey: "session-a",
      isGenerating: true,
      streamText: "hello",
      startedAt: 1,
      updatedAt: 2,
      runId: "run-1",
    });

    expect(listener).toHaveBeenCalledTimes(1);
    unsubscribe();
    clearLiveChatSession("company-d", "session-a");
  });

  it("returns the latest snapshot for subscribed sessions", () => {
    upsertLiveChatSession("company-c", "session-a", {
      sessionKey: "session-a",
      isGenerating: true,
      streamText: "partial",
      startedAt: 1,
      updatedAt: 2,
      runId: "run-1",
    });

    expect(readLiveChatSession("company-c", "session-a")).toEqual({
      sessionKey: "session-a",
      isGenerating: true,
      streamText: "partial",
      startedAt: 1,
      updatedAt: 2,
      runId: "run-1",
    });

    clearLiveChatSession("company-c", "session-a");
    expect(readLiveChatSession("company-c", "session-a")).toBeNull();
  });
});
