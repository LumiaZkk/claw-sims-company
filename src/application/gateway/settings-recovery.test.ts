import { describe, expect, it, vi } from "vitest";
import {
  isTransientAuthorityFetchError,
  retryTransientAuthorityOperation,
} from "./settings-recovery";

describe("settings recovery helpers", () => {
  it("recognizes transient Authority fetch failures", () => {
    expect(
      isTransientAuthorityFetchError(
        new Error(
          "Authority 服务不可达（http://127.0.0.1:19789）。 请求路径：/executor。 原始错误：Failed to fetch",
        ),
      ),
    ).toBe(true);
    expect(isTransientAuthorityFetchError(new Error("fetch failed"))).toBe(true);
    expect(isTransientAuthorityFetchError(new Error("OpenClaw executor closed during connect (1000): "))).toBe(true);
    expect(isTransientAuthorityFetchError(new Error("missing scope: operator.read"))).toBe(false);
  });

  it("retries transient failures until the operation succeeds", async () => {
    const operation = vi
      .fn<() => Promise<string>>()
      .mockRejectedValueOnce(new Error("Authority 服务不可达（http://127.0.0.1:19789）。 原始错误：Failed to fetch"))
      .mockResolvedValueOnce("ready");
    const waitForMs = vi.fn<(ms: number) => Promise<void>>().mockResolvedValue();

    await expect(
      retryTransientAuthorityOperation({
        operation,
        delaysMs: [1, 2],
        waitForMs,
      }),
    ).resolves.toBe("ready");

    expect(operation).toHaveBeenCalledTimes(2);
    expect(waitForMs).toHaveBeenCalledTimes(1);
    expect(waitForMs).toHaveBeenCalledWith(1);
  });

  it("does not retry non-transient failures", async () => {
    const operation = vi
      .fn<() => Promise<string>>()
      .mockRejectedValue(new Error("missing scope: operator.read"));
    const waitForMs = vi.fn<(ms: number) => Promise<void>>().mockResolvedValue();

    await expect(
      retryTransientAuthorityOperation({
        operation,
        delaysMs: [1, 2],
        waitForMs,
      }),
    ).rejects.toThrow("missing scope: operator.read");

    expect(operation).toHaveBeenCalledTimes(1);
    expect(waitForMs).not.toHaveBeenCalled();
  });
});
