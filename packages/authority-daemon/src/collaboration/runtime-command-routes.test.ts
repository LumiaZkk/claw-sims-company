import { describe, expect, it, vi } from "vitest";
import type { IncomingMessage } from "node:http";
import { resolveAuthorityRuntimeCommandRoute } from "./runtime-command-routes";

function createDeps() {
  return {
    listActors: vi.fn().mockReturnValue([{ id: "ceo" }]),
    proxyGatewayRequest: vi.fn().mockResolvedValue({ ok: true }),
    runAgentFile: vi.fn().mockResolvedValue({ ok: true, output: "done" }),
    requestApproval: vi.fn().mockReturnValue({ id: "approval-1", status: "pending" }),
    resolveApproval: vi.fn().mockReturnValue({ id: "approval-1", status: "approved" }),
    transitionRequirement: vi.fn().mockReturnValue({ ok: true }),
    promoteRequirement: vi.fn().mockReturnValue({ ok: true }),
    upsertRoom: vi.fn().mockReturnValue({ ok: true }),
    deleteRoom: vi.fn().mockReturnValue({ ok: true }),
    upsertRoomBindings: vi.fn().mockReturnValue({ ok: true }),
    upsertRound: vi.fn().mockReturnValue({ ok: true }),
    deleteRound: vi.fn().mockReturnValue({ ok: true }),
    upsertMission: vi.fn().mockReturnValue({ ok: true }),
    deleteMission: vi.fn().mockReturnValue({ ok: true }),
    upsertConversationState: vi.fn().mockReturnValue({ ok: true }),
    deleteConversationState: vi.fn().mockReturnValue({ ok: true }),
    upsertWorkItem: vi.fn().mockReturnValue({ ok: true }),
    deleteWorkItem: vi.fn().mockReturnValue({ ok: true }),
    upsertDispatch: vi.fn().mockReturnValue({ ok: true }),
    deleteDispatch: vi.fn().mockReturnValue({ ok: true }),
    upsertArtifact: vi.fn().mockReturnValue({ ok: true }),
    syncArtifactMirrors: vi.fn().mockReturnValue({ ok: true }),
    deleteArtifact: vi.fn().mockReturnValue({ ok: true }),
    upsertDecisionTicket: vi.fn().mockReturnValue({ ok: true }),
    resolveDecisionTicket: vi.fn().mockReturnValue({ ok: true }),
    cancelDecisionTicket: vi.fn().mockReturnValue({ ok: true }),
    deleteDecisionTicket: vi.fn().mockReturnValue({ ok: true }),
    transitionTakeoverCase: vi.fn().mockReturnValue({ ok: true }),
    appendCompanyEvent: vi.fn().mockReturnValue({ ok: true }),
  };
}

describe("resolveAuthorityRuntimeCommandRoute", () => {
  it("delegates session listing with query params", async () => {
    const deps = createDeps();
    const result = await resolveAuthorityRuntimeCommandRoute({
      method: "GET",
      url: new URL("http://authority.local/sessions?agentId=ceo&limit=5&search=roadmap"),
      request: {} as IncomingMessage,
      readJsonBody: vi.fn(),
      deps,
    });

    expect(deps.proxyGatewayRequest).toHaveBeenCalledWith("sessions.list", {
      agentId: "ceo",
      limit: 5,
      search: "roadmap",
    });
    expect(result).toEqual({
      status: 200,
      payload: { ok: true },
    });
  });

  it("delegates agent file writes and emits artifact update broadcast", async () => {
    const deps = createDeps();
    const readJsonBody = vi.fn().mockResolvedValue({ content: "# spec" });
    const result = await resolveAuthorityRuntimeCommandRoute({
      method: "PUT",
      url: new URL("http://authority.local/agents/cto/files/docs%2Fspec.md"),
      request: {} as IncomingMessage,
      readJsonBody,
      deps,
      now: () => 111,
    });

    expect(deps.proxyGatewayRequest).toHaveBeenCalledWith("agents.files.set", {
      agentId: "cto",
      name: "docs/spec.md",
      content: "# spec",
    });
    expect(result).toEqual({
      status: 200,
      payload: { ok: true },
      postCommit: {
        broadcasts: [{ type: "artifact.updated", timestamp: 111 }],
      },
    });
  });

  it("delegates agent workspace runs", async () => {
    const deps = createDeps();
    const readJsonBody = vi.fn().mockResolvedValue({ entryPath: "scripts/check.ts", payload: { dryRun: true } });
    const result = await resolveAuthorityRuntimeCommandRoute({
      method: "POST",
      url: new URL("http://authority.local/agents/cto/run"),
      request: {} as IncomingMessage,
      readJsonBody,
      deps,
    });

    expect(deps.runAgentFile).toHaveBeenCalledWith({
      agentId: "cto",
      entryPath: "scripts/check.ts",
      payload: { dryRun: true },
      timeoutMs: undefined,
    });
    expect(result?.payload).toEqual({ ok: true, output: "done" });
  });

  it("routes company commands with schedule and broadcasts", async () => {
    const deps = createDeps();
    const readJsonBody = vi.fn().mockResolvedValue({ companyId: "company-1", ticketId: "decision-1" });
    const result = await resolveAuthorityRuntimeCommandRoute({
      method: "POST",
      url: new URL("http://authority.local/commands/decision.resolve"),
      request: {} as IncomingMessage,
      readJsonBody,
      deps,
      now: () => 222,
    });

    expect(deps.resolveDecisionTicket).toHaveBeenCalledWith({
      companyId: "company-1",
      ticketId: "decision-1",
    });
    expect(result).toEqual({
      status: 200,
      payload: { ok: true },
      postCommit: {
        schedule: { reason: "decision.resolve", companyId: "company-1" },
        broadcasts: [{ type: "decision.updated", companyId: "company-1", timestamp: 222 }],
      },
    });
  });

  it("adds dispatch broadcasts for dispatch/report/subtask company events", async () => {
    const deps = createDeps();
    const readJsonBody = vi.fn().mockResolvedValue({
      event: {
        companyId: "company-1",
        kind: "dispatch_created",
      },
    });
    const result = await resolveAuthorityRuntimeCommandRoute({
      method: "POST",
      url: new URL("http://authority.local/commands/company-event.append"),
      request: {} as IncomingMessage,
      readJsonBody,
      deps,
      now: () => 333,
    });

    expect(deps.appendCompanyEvent).toHaveBeenCalledWith(
      expect.objectContaining({
        companyId: "company-1",
        kind: "dispatch_created",
        fromActorId: "system:authority-command",
        payload: {},
        eventId: expect.any(String),
        createdAt: expect.any(Number),
      }),
    );
    expect(result).toEqual({
      status: 200,
      payload: { ok: true },
      postCommit: {
        broadcasts: [
          { type: "company.updated", companyId: "company-1", timestamp: 333 },
          { type: "dispatch.updated", companyId: "company-1", timestamp: 333 },
        ],
      },
    });
  });

  it("preserves explicit event metadata when appending company events", async () => {
    const deps = createDeps();
    const readJsonBody = vi.fn().mockResolvedValue({
      event: {
        companyId: "company-1",
        kind: "heartbeat_cycle_checked",
        eventId: "event-1",
        createdAt: 444,
        fromActorId: "system:test",
        payload: { ran: true },
      },
    });

    await resolveAuthorityRuntimeCommandRoute({
      method: "POST",
      url: new URL("http://authority.local/commands/company-event.append"),
      request: {} as IncomingMessage,
      readJsonBody,
      deps,
    });

    expect(deps.appendCompanyEvent).toHaveBeenCalledWith(
      expect.objectContaining({
        companyId: "company-1",
        kind: "heartbeat_cycle_checked",
        eventId: "event-1",
        createdAt: 444,
        fromActorId: "system:test",
        payload: { ran: true },
      }),
    );
  });

  it("returns null for unrelated routes", async () => {
    const deps = createDeps();
    const result = await resolveAuthorityRuntimeCommandRoute({
      method: "GET",
      url: new URL("http://authority.local/config"),
      request: {} as IncomingMessage,
      readJsonBody: vi.fn(),
      deps,
    });

    expect(result).toBeNull();
  });
});
