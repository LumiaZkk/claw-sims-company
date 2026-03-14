import { describe, expect, it } from "vitest";
import {
  refreshGatewayAuthRuntimeSnapshot,
  type GatewayRequestFn,
  waitForGatewayReconnect,
} from "./gateway-runtime-refresh";

describe("gateway-runtime-refresh", () => {
  it("reloads the gateway via config.patch after reading the current config hash", async () => {
    const calls: Array<{ method: string; params?: unknown }> = [];
    const request: GatewayRequestFn = async <T>(method: string, params?: unknown) => {
      calls.push({ method, params });
      if (method === "config.get") {
        return {
          path: "/tmp/openclaw.json",
          exists: true,
          valid: true,
          hash: "hash-123",
          config: {},
        } as T;
      }
      if (method === "config.patch") {
        return {
          ok: true,
          params,
        } as T;
      }
      throw new Error(`unexpected method ${method}`);
    };

    await expect(
      refreshGatewayAuthRuntimeSnapshot(request, "refresh codex auth/runtime snapshot"),
    ).resolves.toEqual({
      restarted: true,
      baseHash: "hash-123",
    });

    expect(calls).toEqual([
      { method: "config.get", params: {} },
      {
        method: "config.patch",
        params: {
          raw: "{}",
          baseHash: "hash-123",
          note: "refresh codex auth/runtime snapshot",
          restartDelayMs: 0,
        },
      },
    ]);
  });

  it("fails loudly when the gateway snapshot does not expose a config hash", async () => {
    const request: GatewayRequestFn = async <T>(method: string) => {
      if (method === "config.get") {
        return {
          path: "/tmp/openclaw.json",
          exists: true,
          valid: true,
          config: {},
        } as T;
      }
      throw new Error(`unexpected method ${method}`);
    };

    await expect(
      refreshGatewayAuthRuntimeSnapshot(request, "refresh codex auth/runtime snapshot"),
    ).rejects.toThrow("OpenClaw gateway 未返回 config hash");
  });

  it("surfaces restart failures instead of silently reporting success", async () => {
    const request: GatewayRequestFn = async <T>(method: string) => {
      if (method === "config.get") {
        return {
          path: "/tmp/openclaw.json",
          exists: true,
          valid: true,
          hash: "hash-123",
          config: {},
        } as T;
      }
      if (method === "config.patch") {
        throw new Error("gateway unavailable");
      }
      throw new Error(`unexpected method ${method}`);
    };

    await expect(
      refreshGatewayAuthRuntimeSnapshot(request, "refresh codex auth/runtime snapshot"),
    ).rejects.toThrow("已同步本地授权文件，但刷新 OpenClaw auth/runtime snapshot 失败：gateway unavailable");
  });

  it("waits for the authority bridge to reconnect after a gateway restart", async () => {
    let attempts = 0;
    await expect(
      waitForGatewayReconnect(async () => {
        attempts += 1;
        if (attempts < 3) {
          throw new Error("still restarting");
        }
      }, { timeoutMs: 5_000, retryDelayMs: 1 }),
    ).resolves.toEqual({
      reconnected: true,
      attempts: 3,
    });
  });

  it("fails if the authority bridge cannot reconnect before timeout", async () => {
    await expect(
      waitForGatewayReconnect(
        async () => {
          throw new Error("socket closed");
        },
        { timeoutMs: 1_000, retryDelayMs: 200 },
      ),
    ).rejects.toThrow("OpenClaw gateway 已重载，但 Authority 未能及时重新接入：socket closed");
  });
});
