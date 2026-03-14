import { describe, expect, it, vi } from "vitest";
import type { IncomingMessage } from "node:http";
import { resolveAuthorityControlRoute } from "./control-routes";

function createDeps() {
  return {
    buildHealthSnapshot: vi.fn().mockReturnValue({ authority: { connected: true } }),
    buildBootstrapSnapshot: vi.fn().mockReturnValue({ activeCompanyId: "company-1" }),
    runAuthorityOperatorAction: vi.fn().mockResolvedValue({ id: "doctor", state: "ready" }),
    getExecutorConfig: vi.fn().mockReturnValue({ openclaw: { url: "ws://localhost:18789", token: "" } }),
    patchExecutorConfig: vi.fn().mockResolvedValue({ openclaw: { url: "ws://patched", token: "" } }),
    proxyGatewayRequest: vi.fn().mockResolvedValue({ ok: true }),
  };
}

describe("resolveAuthorityControlRoute", () => {
  it("handles GET /health", async () => {
    const deps = createDeps();
    const result = await resolveAuthorityControlRoute({
      method: "GET",
      pathname: "/health",
      request: {} as IncomingMessage,
      readJsonBody: vi.fn(),
      deps,
    });

    expect(result).toEqual({
      status: 200,
      payload: { authority: { connected: true } },
    });
    expect(deps.buildHealthSnapshot).toHaveBeenCalledTimes(1);
  });

  it("handles POST /operator/actions", async () => {
    const deps = createDeps();
    const readJsonBody = vi.fn().mockResolvedValue({ id: "doctor" });
    const result = await resolveAuthorityControlRoute({
      method: "POST",
      pathname: "/operator/actions",
      request: {} as IncomingMessage,
      readJsonBody,
      deps,
    });

    expect(readJsonBody).toHaveBeenCalledTimes(1);
    expect(deps.runAuthorityOperatorAction).toHaveBeenCalledWith({ id: "doctor" });
    expect(result).toEqual({
      status: 200,
      payload: { id: "doctor", state: "ready" },
    });
  });

  it("delegates executor patch and gateway proxy", async () => {
    const deps = createDeps();
    const executorReadJsonBody = vi.fn().mockResolvedValue({ openclaw: { url: "ws://patched" } });
    const executorResult = await resolveAuthorityControlRoute({
      method: "PATCH",
      pathname: "/executor",
      request: {} as IncomingMessage,
      readJsonBody: executorReadJsonBody,
      deps,
    });

    expect(deps.patchExecutorConfig).toHaveBeenCalledWith({ openclaw: { url: "ws://patched" } });
    expect(executorResult?.payload).toEqual({ openclaw: { url: "ws://patched", token: "" } });

    const proxyReadJsonBody = vi.fn().mockResolvedValue({ method: "sessions.list", params: { limit: 1 } });
    const proxyResult = await resolveAuthorityControlRoute({
      method: "POST",
      pathname: "/gateway/request",
      request: {} as IncomingMessage,
      readJsonBody: proxyReadJsonBody,
      deps,
    });

    expect(deps.proxyGatewayRequest).toHaveBeenCalledWith("sessions.list", { limit: 1 });
    expect(proxyResult).toEqual({
      status: 200,
      payload: { ok: true },
    });
  });

  it("returns null for non-control routes", async () => {
    const deps = createDeps();
    const result = await resolveAuthorityControlRoute({
      method: "GET",
      pathname: "/companies/company-1/runtime",
      request: {} as IncomingMessage,
      readJsonBody: vi.fn(),
      deps,
    });

    expect(result).toBeNull();
  });
});
