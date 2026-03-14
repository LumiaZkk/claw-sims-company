import { describe, expect, it, vi } from "vitest";
import { applyAuthorityRoutePostCommit } from "./authority-route-result";

describe("applyAuthorityRoutePostCommit", () => {
  it("skips empty post-commit payloads", () => {
    const schedule = vi.fn();
    const broadcast = vi.fn();
    const queueManagedExecutorSync = vi.fn();

    applyAuthorityRoutePostCommit({
      result: { status: 200, payload: { ok: true } },
      schedule,
      broadcast,
      queueManagedExecutorSync,
    });

    expect(schedule).not.toHaveBeenCalled();
    expect(broadcast).not.toHaveBeenCalled();
    expect(queueManagedExecutorSync).not.toHaveBeenCalled();
  });

  it("runs schedule, managed sync, and broadcasts", () => {
    const schedule = vi.fn();
    const broadcast = vi.fn();
    const queueManagedExecutorSync = vi.fn();

    applyAuthorityRoutePostCommit({
      result: {
        status: 200,
        payload: { ok: true },
        postCommit: {
          schedule: { reason: "company.create", companyId: "company-1" },
          managedExecutorSyncReason: "company.create",
          broadcasts: [
            { type: "bootstrap.updated", timestamp: 1 },
            { type: "company.updated", companyId: "company-1", timestamp: 1 },
          ],
        },
      },
      schedule,
      broadcast,
      queueManagedExecutorSync,
    });

    expect(schedule).toHaveBeenCalledWith("company.create", "company-1");
    expect(queueManagedExecutorSync).toHaveBeenCalledWith("company.create");
    expect(broadcast).toHaveBeenCalledTimes(2);
    expect(broadcast).toHaveBeenNthCalledWith(1, { type: "bootstrap.updated", timestamp: 1 });
    expect(broadcast).toHaveBeenNthCalledWith(2, {
      type: "company.updated",
      companyId: "company-1",
      timestamp: 1,
    });
  });
});
