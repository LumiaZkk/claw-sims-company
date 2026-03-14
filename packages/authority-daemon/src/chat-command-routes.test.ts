import { describe, expect, it, vi } from "vitest";
import type { IncomingMessage } from "node:http";
import { resolveAuthorityChatCommandRoute } from "./chat-command-routes";

describe("resolveAuthorityChatCommandRoute", () => {
  it("handles POST /commands/chat.send and returns post-commit broadcasts", async () => {
    const readJsonBody = vi.fn().mockResolvedValue({
      companyId: "company-1",
      actorId: "main",
      message: "hi",
    });
    const runChatSendCommand = vi.fn().mockResolvedValue({
      response: {
        ok: true,
        runId: "run-1",
        sessionKey: "agent:main:main",
      },
      runtimeEvent: {
        providerId: "openclaw",
        agentId: "main",
        sessionKey: "agent:main:main",
        runId: "run-1",
        streamKind: "lifecycle",
        runState: "accepted",
        timestamp: 123,
        raw: { ok: true },
      },
      broadcasts: [
        {
          type: "conversation.updated",
          companyId: "company-1",
          timestamp: 124,
        },
      ],
    });

    const result = await resolveAuthorityChatCommandRoute({
      method: "POST",
      pathname: "/commands/chat.send",
      request: {} as IncomingMessage,
      readJsonBody,
      deps: {
        runChatSendCommand,
      },
    });

    expect(readJsonBody).toHaveBeenCalledTimes(1);
    expect(runChatSendCommand).toHaveBeenCalledWith({
      body: {
        companyId: "company-1",
        actorId: "main",
        message: "hi",
      },
    });
    expect(result).toEqual({
      status: 200,
      payload: {
        ok: true,
        runId: "run-1",
        sessionKey: "agent:main:main",
      },
      postCommit: {
        broadcasts: [
          {
            type: "agent.runtime.updated",
            companyId: "company-1",
            timestamp: 123,
            payload: {
              event: {
                providerId: "openclaw",
                agentId: "main",
                sessionKey: "agent:main:main",
                runId: "run-1",
                streamKind: "lifecycle",
                runState: "accepted",
                timestamp: 123,
                raw: { ok: true },
              },
            },
          },
          {
            type: "conversation.updated",
            companyId: "company-1",
            timestamp: 124,
          },
        ],
      },
    });
  });

  it("returns null for non-chat routes", async () => {
    const result = await resolveAuthorityChatCommandRoute({
      method: "GET",
      pathname: "/executor",
      request: {} as IncomingMessage,
      readJsonBody: vi.fn(),
      deps: {
        runChatSendCommand: vi.fn(),
      },
    });

    expect(result).toBeNull();
  });
});
