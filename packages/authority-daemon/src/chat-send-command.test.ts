import { describe, expect, it, vi } from "vitest";
import type { AuthorityChatSendResponse } from "../../../src/infrastructure/authority/contract";
import { runAuthorityChatSendCommand } from "./chat-send-command";

function createRepository() {
  return {
    hasCompany: vi.fn(() => true),
    beginChatDispatch: vi.fn(() => ({
      sessionKey: "agent:ceo:main",
      now: 123,
    })),
    createExecutorRun: vi.fn(),
    applyRuntimeEvent: vi.fn(),
  };
}

describe("runAuthorityChatSendCommand", () => {
  it("proxies chat.send, stores the executor run, and emits follow-up data", async () => {
    const repository = createRepository();
    const proxyGatewayRequest = vi.fn(
      async () =>
        ({
          runId: "run-1",
          status: "started",
        }) satisfies Omit<AuthorityChatSendResponse, "sessionKey">,
    ) as <T = unknown>(method: string, params?: unknown) => Promise<T>;

    const result = await runAuthorityChatSendCommand({
      body: {
        companyId: "company-1",
        actorId: "ceo",
        message: "Ship it",
        timeoutMs: 30_000,
        attachments: [{ type: "text", mimeType: "text/plain", content: "brief" }],
      },
      deps: {
        repository,
        proxyGatewayRequest,
        providerId: "openclaw",
        randomUUID: () => "uuid-1",
        now: () => 456,
      },
    });

    expect(proxyGatewayRequest).toHaveBeenCalledWith("chat.send", {
      sessionKey: "agent:ceo:main",
      message: "Ship it",
      deliver: false,
      timeoutMs: 30_000,
      attachments: [{ type: "text", mimeType: "text/plain", content: "brief" }],
      idempotencyKey: "uuid-1",
    });
    expect(repository.createExecutorRun).toHaveBeenCalledWith({
      runId: "run-1",
      companyId: "company-1",
      actorId: "ceo",
      sessionKey: "agent:ceo:main",
      startedAt: 123,
      payload: {
        request: "Ship it",
        attachments: [{ type: "text", mimeType: "text/plain", content: "brief" }],
      },
    });
    expect(repository.applyRuntimeEvent).toHaveBeenCalledWith("company-1", {
      providerId: "openclaw",
      agentId: "ceo",
      sessionKey: "agent:ceo:main",
      runId: "run-1",
      streamKind: "lifecycle",
      runState: "accepted",
      timestamp: 123,
      raw: {
        runId: "run-1",
        status: "started",
        sessionKey: "agent:ceo:main",
      },
    });
    expect(result).toEqual({
      response: {
        runId: "run-1",
        status: "started",
        sessionKey: "agent:ceo:main",
      },
      runtimeEvent: {
        providerId: "openclaw",
        agentId: "ceo",
        sessionKey: "agent:ceo:main",
        runId: "run-1",
        streamKind: "lifecycle",
        runState: "accepted",
        timestamp: 123,
        raw: {
          runId: "run-1",
          status: "started",
          sessionKey: "agent:ceo:main",
        },
      },
      broadcasts: [{ type: "conversation.updated", companyId: "company-1", timestamp: 456 }],
    });
  });

  it("throws when the company is unknown", async () => {
    const repository = createRepository();
    repository.hasCompany.mockReturnValue(false);

    await expect(
      runAuthorityChatSendCommand({
        body: {
          companyId: "missing",
          actorId: "ceo",
          message: "Ship it",
        },
        deps: {
          repository,
          proxyGatewayRequest: vi.fn(),
          providerId: "openclaw",
        },
      }),
    ).rejects.toThrow("Unknown company: missing");
  });
});
