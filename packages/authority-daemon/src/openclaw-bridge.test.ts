import { describe, expect, it } from "vitest";
import {
  classifyExecutorReconnect,
  computeReconnectDelayMs,
  describeMissingScopes,
} from "./openclaw-bridge";

describe("openclaw-bridge helpers", () => {
  it("marks transient disconnects as retryable degraded states", () => {
    expect(classifyExecutorReconnect("OpenClaw executor disconnected")).toEqual({
      state: "degraded",
      shouldRetry: true,
    });
    expect(classifyExecutorReconnect("OpenClaw executor closed during connect (1000): ")).toEqual({
      state: "degraded",
      shouldRetry: true,
    });
    expect(classifyExecutorReconnect("gateway restarting")).toEqual({
      state: "degraded",
      shouldRetry: true,
    });
  });

  it("marks auth/config failures as blocked without retry", () => {
    expect(classifyExecutorReconnect("OpenClaw 需要设备身份或共享 token。")).toEqual({
      state: "blocked",
      shouldRetry: false,
    });
    expect(classifyExecutorReconnect("unauthorized")).toEqual({
      state: "blocked",
      shouldRetry: false,
    });
    expect(classifyExecutorReconnect("connect failed")).toEqual({
      state: "blocked",
      shouldRetry: false,
    });
  });

  it("backs off reconnect attempts up to the max cap", () => {
    expect(computeReconnectDelayMs(0)).toBe(500);
    expect(computeReconnectDelayMs(1)).toBe(1000);
    expect(computeReconnectDelayMs(2)).toBe(2000);
    expect(computeReconnectDelayMs(5)).toBe(10000);
    expect(computeReconnectDelayMs(8)).toBe(10000);
  });

  it("reports missing required operator scopes", () => {
    expect(describeMissingScopes(["operator.admin"])).toBeNull();
    expect(describeMissingScopes(["operator.write"])).toContain("operator.admin");
    expect(describeMissingScopes(["operator.read"])).toContain("operator.admin");
    expect(describeMissingScopes(["operator.read", "operator.admin"])).toBeNull();
  });
});
