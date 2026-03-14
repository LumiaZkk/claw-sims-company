import { describe, expect, it, vi } from "vitest";
import { createAuthorityOperatorActionRunner } from "./operator-actions";

describe("createAuthorityOperatorActionRunner", () => {
  it("fails restore-plan when there is no standard backup", async () => {
    const runAuthorityOperatorAction = createAuthorityOperatorActionRunner({
      dbPath: "/tmp/non-existent-authority.sqlite",
      dataDir: "/tmp/non-existent-authority-home",
      repository: {
        restoreFromBackup: vi.fn(),
      },
      companyOpsEngine: {
        schedule: vi.fn(),
      },
      queueManagedExecutorSync: vi.fn().mockResolvedValue(undefined),
      buildBootstrapSnapshot: vi.fn(),
      getExecutorSnapshot: vi.fn().mockReturnValue({
        executor: {
          adapter: "openclaw-bridge",
          state: "ready",
          provider: "openclaw",
          note: "ok",
        },
      }),
      notifyBootstrapUpdated: vi.fn(),
    });

    await expect(runAuthorityOperatorAction({ id: "restore-plan" })).rejects.toThrow(
      "Authority 备份目录里还没有可用的标准备份",
    );
  });
});
