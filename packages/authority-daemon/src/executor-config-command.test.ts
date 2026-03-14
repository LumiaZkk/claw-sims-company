import { describe, expect, it, vi } from "vitest";
import type { AuthorityExecutorConfig } from "../../../src/infrastructure/authority/contract";
import { runAuthorityExecutorConfigPatch } from "./executor-config-command";

describe("runAuthorityExecutorConfigPatch", () => {
  it("persists trimmed url, preserves token, patches bridge, and queues sync", async () => {
    const saveExecutorConfig = vi.fn((config) => config);
    const patchExecutorBridgeConfig = vi.fn(async () => {});
    const broadcastExecutorStatus = vi.fn();
    const queueManagedExecutorSync = vi.fn(async () => {});
    const getExecutorSnapshotConfig = vi.fn<() => AuthorityExecutorConfig>(() => ({
      type: "openclaw",
      openclaw: { url: "ws://patched", tokenConfigured: true },
      connectionState: "ready",
      lastError: null,
      lastConnectedAt: null,
    }));

    const result = await runAuthorityExecutorConfigPatch({
      body: {
        openclaw: { url: "  ws://patched  " },
      },
      deps: {
        loadExecutorConfig: () => ({
          type: "openclaw",
          openclaw: { url: "ws://current", token: "secret" },
          connectionState: "ready",
          lastError: null,
          lastConnectedAt: null,
        }),
        saveExecutorConfig,
        patchExecutorBridgeConfig,
        broadcastExecutorStatus,
        queueManagedExecutorSync,
        getExecutorSnapshotConfig,
      },
    });

    expect(saveExecutorConfig).toHaveBeenCalledWith({
      type: "openclaw",
      openclaw: { url: "ws://patched", token: "secret" },
      connectionState: "ready",
      lastError: null,
      lastConnectedAt: null,
    });
    expect(patchExecutorBridgeConfig).toHaveBeenCalledWith({
      openclaw: { url: "ws://patched", token: "secret" },
      reconnect: true,
    });
    expect(broadcastExecutorStatus).toHaveBeenCalledTimes(1);
    expect(queueManagedExecutorSync).toHaveBeenCalledWith("executor.patch");
    expect(result).toEqual({
      type: "openclaw",
      openclaw: { url: "ws://patched", tokenConfigured: true },
      connectionState: "ready",
      lastError: null,
      lastConnectedAt: null,
    });
  });

  it("broadcasts status even when bridge patch throws and does not queue sync", async () => {
    const error = new Error("patch failed");
    const broadcastExecutorStatus = vi.fn();
    const queueManagedExecutorSync = vi.fn(async () => {});

    await expect(
      runAuthorityExecutorConfigPatch({
        body: { reconnect: false },
        deps: {
          loadExecutorConfig: () => ({
            type: "openclaw",
            openclaw: { url: "ws://current", token: "secret" },
            connectionState: "ready",
            lastError: null,
            lastConnectedAt: null,
          }),
          saveExecutorConfig: vi.fn((config) => config),
          patchExecutorBridgeConfig: vi.fn(async () => {
            throw error;
          }),
          broadcastExecutorStatus,
          queueManagedExecutorSync,
          getExecutorSnapshotConfig: vi.fn(),
        },
      }),
    ).rejects.toThrow("patch failed");

    expect(broadcastExecutorStatus).toHaveBeenCalledTimes(1);
    expect(queueManagedExecutorSync).not.toHaveBeenCalled();
  });
});
