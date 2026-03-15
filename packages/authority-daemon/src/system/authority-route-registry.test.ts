import type { IncomingMessage, ServerResponse } from "node:http";
import { describe, expect, it, vi } from "vitest";
import { handleAuthorityHttpRoute } from "./authority-route-registry";

function createResponse() {
  return {
    statusCode: 0,
    setHeader: vi.fn(),
    end: vi.fn(),
  } as unknown as ServerResponse;
}

describe("handleAuthorityHttpRoute", () => {
  it("handles a matched control route through the shared registry", async () => {
    const response = createResponse();
    const handled = await handleAuthorityHttpRoute({
      response,
      method: "GET",
      url: new URL("http://127.0.0.1:18898/health"),
      request: {} as IncomingMessage,
      readJsonBody: vi.fn(),
      deps: {
        control: {
          buildHealthSnapshot: vi.fn().mockReturnValue({ authority: { connected: true } }),
          buildBootstrapSnapshot: vi.fn(),
          runAuthorityOperatorAction: vi.fn(),
          getExecutorConfig: vi.fn(),
          patchExecutorConfig: vi.fn(),
          proxyGatewayRequest: vi.fn(),
        },
        companyState: {} as never,
        runtimeCommands: {} as never,
        companyManagement: {} as never,
        chatCommands: {} as never,
        sideEffects: {
          schedule: vi.fn(),
          broadcast: vi.fn(),
        },
      },
    });

    expect(handled).toBe(true);
    expect(response.statusCode).toBe(200);
    expect(response.end).toHaveBeenCalledWith(
      JSON.stringify({ authority: { connected: true } }),
    );
  });

  it("returns false when no registered route matches", async () => {
    const response = createResponse();
    const handled = await handleAuthorityHttpRoute({
      response,
      method: "GET",
      url: new URL("http://127.0.0.1:18898/unknown"),
      request: {} as IncomingMessage,
      readJsonBody: vi.fn(),
      deps: {
        control: {
          buildHealthSnapshot: vi.fn(),
          buildBootstrapSnapshot: vi.fn(),
          runAuthorityOperatorAction: vi.fn(),
          getExecutorConfig: vi.fn(),
          patchExecutorConfig: vi.fn(),
          proxyGatewayRequest: vi.fn(),
        },
        companyState: {} as never,
        runtimeCommands: {} as never,
        companyManagement: {} as never,
        chatCommands: {} as never,
        sideEffects: {
          schedule: vi.fn(),
          broadcast: vi.fn(),
        },
      },
    });

    expect(handled).toBe(false);
    expect(response.end).not.toHaveBeenCalled();
  });
});
