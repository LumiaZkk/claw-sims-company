import { describe, expect, it, vi } from "vitest";
import type { ServerResponse } from "node:http";
import {
  dispatchAuthorityRouteAttempts,
  sendAuthorityCaughtError,
  sendAuthorityError,
} from "./authority-http-route-dispatch";
import { authorityBadRequest } from "./authority-error";
import type { AuthorityRouteResult } from "./authority-route-result";

function createResponse() {
  return {
    statusCode: 0,
    setHeader: vi.fn(),
    end: vi.fn(),
  } as unknown as ServerResponse;
}

describe("dispatchAuthorityRouteAttempts", () => {
  it("returns false when no route matches", async () => {
    const response = createResponse();
    const schedule = vi.fn();
    const broadcast = vi.fn();

    const handled = await dispatchAuthorityRouteAttempts({
      response,
      attempts: [vi.fn(async () => null), vi.fn(async () => null)],
      sideEffects: { schedule, broadcast },
    });

    expect(handled).toBe(false);
    expect(response.setHeader).not.toHaveBeenCalled();
    expect(schedule).not.toHaveBeenCalled();
    expect(broadcast).not.toHaveBeenCalled();
  });

  it("sends the first matched route result and applies post-commit", async () => {
    const response = createResponse();
    const schedule = vi.fn();
    const broadcast = vi.fn();
    const queueManagedExecutorSync = vi.fn();
    const first = vi.fn(async () => null);
    const second = vi.fn<() => Promise<AuthorityRouteResult | null>>(async () => ({
      status: 200,
      payload: { ok: true },
      postCommit: {
        schedule: { reason: "runtime.sync", companyId: "company-1" },
        managedExecutorSyncReason: "runtime.sync",
        broadcasts: [{ type: "company.updated", companyId: "company-1", timestamp: 1 }],
      },
    }));
    const third = vi.fn<() => Promise<AuthorityRouteResult | null>>(async () => ({
      status: 204,
      payload: null,
    }));

    const handled = await dispatchAuthorityRouteAttempts({
      response,
      attempts: [first, second, third],
      sideEffects: { schedule, broadcast, queueManagedExecutorSync },
    });

    expect(handled).toBe(true);
    expect(first).toHaveBeenCalledTimes(1);
    expect(second).toHaveBeenCalledTimes(1);
    expect(third).not.toHaveBeenCalled();
    expect(response.statusCode).toBe(200);
    expect(response.setHeader).toHaveBeenCalledWith(
      "Content-Type",
      "application/json; charset=utf-8",
    );
    expect(response.end).toHaveBeenCalledWith(JSON.stringify({ ok: true }));
    expect(schedule).toHaveBeenCalledWith("runtime.sync", "company-1");
    expect(queueManagedExecutorSync).toHaveBeenCalledWith("runtime.sync");
    expect(broadcast).toHaveBeenCalledWith({
      type: "company.updated",
      companyId: "company-1",
      timestamp: 1,
    });
  });
});

describe("sendAuthorityError", () => {
  it("writes a standard JSON error payload", () => {
    const response = createResponse();

    sendAuthorityError(response, 500, "boom");

    expect(response.statusCode).toBe(500);
    expect(response.setHeader).toHaveBeenCalledWith(
      "Content-Type",
      "application/json; charset=utf-8",
    );
    expect(response.end).toHaveBeenCalledWith(JSON.stringify({ error: "boom" }));
  });
});

describe("sendAuthorityCaughtError", () => {
  it("maps typed authority errors to their HTTP status", () => {
    const response = createResponse();

    sendAuthorityCaughtError(response, authorityBadRequest("missing method"));

    expect(response.statusCode).toBe(400);
    expect(response.end).toHaveBeenCalledWith(JSON.stringify({ error: "missing method" }));
  });

  it("falls back to 500 for untyped errors", () => {
    const response = createResponse();

    sendAuthorityCaughtError(response, new Error("boom"));

    expect(response.statusCode).toBe(500);
    expect(response.end).toHaveBeenCalledWith(JSON.stringify({ error: "boom" }));
  });
});
