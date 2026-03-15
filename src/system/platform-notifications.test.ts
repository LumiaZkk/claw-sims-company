import { describe, expect, it } from "vitest";
import { buildPlatformNotification } from "./platform-notifications";

describe("buildPlatformNotification", () => {
  it("routes approval requests to ops", () => {
    const notification = buildPlatformNotification({
      eventName: "authority.approval.request",
      payload: {
        status: "pending",
        message: "需要审批",
      },
    });

    expect(notification?.category).toBe("approval_pending");
    expect(notification?.href).toBe("/ops");
  });

  it("routes restore risks to connect", () => {
    const notification = buildPlatformNotification({
      eventName: "authority.restore.plan.error",
      payload: {
        error: "restore blocked",
      },
    });

    expect(notification?.category).toBe("restore_risk");
    expect(notification?.href).toBe("/connect");
  });
});
