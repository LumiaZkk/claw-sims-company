import type { AuthorityGatewayConfigSnapshot } from "../../../../src/infrastructure/authority/contract";

export type GatewayRequestFn = <T>(method: string, params?: unknown) => Promise<T>;

export type GatewayRuntimeRefreshResult = {
  restarted: true;
  baseHash: string;
};

export type GatewayReconnectResult = {
  reconnected: true;
  attempts: number;
};

function requireSnapshotHash(snapshot: AuthorityGatewayConfigSnapshot) {
  const hash = typeof snapshot.hash === "string" ? snapshot.hash.trim() : "";
  if (!hash) {
    throw new Error("OpenClaw gateway 未返回 config hash，无法刷新 auth/runtime snapshot。");
  }
  return hash;
}

export async function refreshGatewayAuthRuntimeSnapshot(
  request: GatewayRequestFn,
  reason: string,
): Promise<GatewayRuntimeRefreshResult> {
  let snapshot: AuthorityGatewayConfigSnapshot;
  try {
    snapshot = await request<AuthorityGatewayConfigSnapshot>("config.get", {});
  } catch (error) {
    const detail = error instanceof Error ? error.message : String(error);
    throw new Error(`无法读取 OpenClaw gateway 配置，不能刷新 auth/runtime snapshot：${detail}`);
  }

  const baseHash = requireSnapshotHash(snapshot);
  try {
    await request("config.patch", {
      raw: "{}",
      baseHash,
      note: reason,
      restartDelayMs: 0,
    });
  } catch (error) {
    const detail = error instanceof Error ? error.message : String(error);
    throw new Error(`已同步本地授权文件，但刷新 OpenClaw auth/runtime snapshot 失败：${detail}`);
  }

  return {
    restarted: true,
    baseHash,
  };
}

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export async function waitForGatewayReconnect(
  reconnect: () => Promise<void>,
  options: {
    timeoutMs?: number;
    retryDelayMs?: number;
  } = {},
): Promise<GatewayReconnectResult> {
  const timeoutMs = Math.max(1_000, options.timeoutMs ?? 15_000);
  const retryDelayMs = Math.max(100, options.retryDelayMs ?? 500);
  const deadline = Date.now() + timeoutMs;
  let attempts = 0;
  let lastError: unknown = null;

  while (Date.now() <= deadline) {
    attempts += 1;
    try {
      await reconnect();
      return {
        reconnected: true,
        attempts,
      };
    } catch (error) {
      lastError = error;
      if (Date.now() + retryDelayMs > deadline) {
        break;
      }
      await sleep(retryDelayMs);
    }
  }

  const detail =
    lastError instanceof Error
      ? lastError.message
      : lastError
        ? String(lastError)
        : "连接在等待窗口内未恢复";
  throw new Error(`OpenClaw gateway 已重载，但 Authority 未能及时重新接入：${detail}`);
}
