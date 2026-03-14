import { describe, expect, it, vi } from "vitest";
import { createAuthorityGatewayProxy } from "./gateway-proxy";

function asRequestExecutor<T>(value: T) {
  return vi.fn(async () => value) as <R>(method: string, params?: unknown) => Promise<R>;
}

function createRepository() {
  return {
    getCompanyAgentIds: vi.fn(() => ["ceo", "cto"]),
    getConversationContext: vi.fn((sessionKey: string) =>
      sessionKey === "agent:ceo:main" ? { companyId: "company-1", actorId: "ceo" } : null,
    ),
    findCompanyIdByAgentId: vi.fn((agentId: string) =>
      agentId === "cto" ? "company-2" : null,
    ),
    updateRuntimeFromSessionList: vi.fn(),
    applyRuntimeSessionStatus: vi.fn(),
    resetSession: vi.fn(),
    deleteSession: vi.fn(),
    setAgentFile: vi.fn(),
  };
}

describe("createAuthorityGatewayProxy", () => {
  it("filters sessions.list and updates runtime by company", async () => {
    const repository = createRepository();
    const requestExecutor = asRequestExecutor({
      count: 3,
      sessions: [
        { key: "agent:ceo:main", actorId: "ceo" },
        { key: "agent:cto:main", actorId: "cto" },
        { key: "agent:outsider:main", actorId: "outsider" },
      ],
    });
    const proxy = createAuthorityGatewayProxy({
      requestExecutor,
      repository,
      providerId: "openclaw",
      getSessionStatusCapabilityState: () => "unknown",
      updateSessionStatusCapability: vi.fn(),
      normalizeProviderSessionStatus: vi.fn(),
    });

    const result = await proxy("sessions.list");

    expect(result).toEqual({
      count: 2,
      sessions: [
        { key: "agent:ceo:main", actorId: "ceo" },
        { key: "agent:cto:main", actorId: "cto" },
      ],
    });
    expect(repository.updateRuntimeFromSessionList).toHaveBeenCalledWith("company-1", [
      { key: "agent:ceo:main", actorId: "ceo" },
    ]);
    expect(repository.updateRuntimeFromSessionList).toHaveBeenCalledWith("company-2", [
      { key: "agent:cto:main", actorId: "cto" },
    ]);
  });

  it("updates capability and runtime on session_status", async () => {
    const repository = createRepository();
    const updateSessionStatusCapability = vi.fn();
    const normalizeProviderSessionStatus = vi.fn(() => ({ agentId: "ceo" }));
    const requestExecutor = asRequestExecutor({ state: "ready" });
    const proxy = createAuthorityGatewayProxy({
      requestExecutor,
      repository,
      providerId: "openclaw",
      getSessionStatusCapabilityState: () => "unknown",
      updateSessionStatusCapability,
      normalizeProviderSessionStatus,
    });

    const result = await proxy("session_status", { sessionKey: "agent:ceo:main" });

    expect(result).toEqual({ state: "ready" });
    expect(updateSessionStatusCapability).toHaveBeenCalledWith("success");
    expect(normalizeProviderSessionStatus).toHaveBeenCalledWith(
      "openclaw",
      "agent:ceo:main",
      { state: "ready" },
    );
    expect(repository.applyRuntimeSessionStatus).toHaveBeenCalledWith("company-1", {
      agentId: "ceo",
    });
  });

  it("returns synthetic success when sessions.resolve sees missing session", async () => {
    const proxy = createAuthorityGatewayProxy({
      requestExecutor: (vi.fn(async () => {
        throw new Error("No session found");
      }) as unknown) as <R>(method: string, params?: unknown) => Promise<R>,
      repository: createRepository(),
      providerId: "openclaw",
      getSessionStatusCapabilityState: () => "unknown",
      updateSessionStatusCapability: vi.fn(),
      normalizeProviderSessionStatus: vi.fn(),
    });

    const result = await proxy("sessions.resolve", { key: "agent:ceo:main" });

    expect(result).toEqual({
      ok: true,
      key: "agent:ceo:main",
      error: "No session found",
    });
  });

  it("applies reset/delete/file-write side effects", async () => {
    const repository = createRepository();
    const requestExecutor = asRequestExecutor({ ok: true });
    const proxy = createAuthorityGatewayProxy({
      requestExecutor,
      repository,
      providerId: "openclaw",
      getSessionStatusCapabilityState: () => "unknown",
      updateSessionStatusCapability: vi.fn(),
      normalizeProviderSessionStatus: vi.fn(),
    });

    await proxy("sessions.reset", { key: "agent:ceo:main" });
    await proxy("sessions.delete", { key: "agent:ceo:main" });
    await proxy("agents.files.set", { agentId: "ceo", name: "brief.md", content: "hello" });

    expect(repository.resetSession).toHaveBeenCalledWith("agent:ceo:main");
    expect(repository.deleteSession).toHaveBeenCalledWith("agent:ceo:main");
    expect(repository.setAgentFile).toHaveBeenCalledWith("ceo", "brief.md", "hello");
  });

  it("rejects session_status when capability is unsupported", async () => {
    const proxy = createAuthorityGatewayProxy({
      requestExecutor: vi.fn(),
      repository: createRepository(),
      providerId: "openclaw",
      getSessionStatusCapabilityState: () => "unsupported",
      updateSessionStatusCapability: vi.fn(),
      normalizeProviderSessionStatus: vi.fn(),
    });

    await expect(proxy("session_status", { sessionKey: "agent:ceo:main" })).rejects.toThrow(
      "OpenClaw executor does not support session_status.",
    );
  });
});
