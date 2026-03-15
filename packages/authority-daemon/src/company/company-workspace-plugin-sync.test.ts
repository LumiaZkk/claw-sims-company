import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { syncManagedExecutorWorkspacePlugin } from "./company-workspace-plugin-sync";

const tempDirs: string[] = [];

function createTempDir() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "company-workspace-plugin-sync-"));
  tempDirs.push(dir);
  return dir;
}

afterEach(() => {
  while (tempDirs.length > 0) {
    const dir = tempDirs.pop();
    if (dir) {
      fs.rmSync(dir, { recursive: true, force: true });
    }
  }
});

describe("company-workspace-plugin-sync", () => {
  it("writes sims-company plugin assets into the target workspace", async () => {
    const homeDir = createTempDir();

    const result = await syncManagedExecutorWorkspacePlugin(
      {
        agentId: "company-1-ceo",
        workspace: "~/.openclaw/workspaces/cyber-company/company-1/company-1-ceo",
      },
      { homeDir: () => homeDir },
    );

    expect(result.workspaceDir).toBe(
      path.join(homeDir, ".openclaw/workspaces/cyber-company/company-1/company-1-ceo"),
    );
    expect(result.changed).toBe(true);
    expect(result.syncedFiles).toEqual([
      ".openclaw/extensions/sims-company/index.js",
      ".openclaw/extensions/sims-company/openclaw.plugin.json",
      ".openclaw/extensions/sims-company/package.json",
    ]);
    expect(
      fs.readFileSync(
        path.join(result.workspaceDir, ".openclaw/extensions/sims-company/index.js"),
        "utf8",
      ),
    ).toContain('name: "company_dispatch"');
    expect(
      fs.readFileSync(
        path.join(result.workspaceDir, ".openclaw/extensions/sims-company/index.js"),
        "utf8",
      ),
    ).toContain('name: "authority.company.employee.preview_hire"');
  });

  it("removes the legacy company-dispatch plugin directory during sync", async () => {
    const homeDir = createTempDir();
    const workspace = path.join(
      homeDir,
      ".openclaw/workspaces/cyber-company/company-1/company-1-ceo/.openclaw/extensions/company-dispatch",
    );
    fs.mkdirSync(workspace, { recursive: true });
    fs.writeFileSync(path.join(workspace, "index.js"), "legacy");

    const result = await syncManagedExecutorWorkspacePlugin(
      {
        agentId: "company-1-ceo",
        workspace: "~/.openclaw/workspaces/cyber-company/company-1/company-1-ceo",
      },
      { homeDir: () => homeDir },
    );

    expect(result.changed).toBe(true);
    expect(fs.existsSync(workspace)).toBe(false);
  });

  it("is idempotent when plugin assets already match", async () => {
    const homeDir = createTempDir();
    const workspace = "~/.openclaw/workspaces/cyber-company/company-1/company-1-ceo";

    await syncManagedExecutorWorkspacePlugin(
      {
        agentId: "company-1-ceo",
        workspace,
      },
      { homeDir: () => homeDir },
    );

    const result = await syncManagedExecutorWorkspacePlugin(
      {
        agentId: "company-1-ceo",
        workspace,
      },
      { homeDir: () => homeDir },
    );

    expect(result.changed).toBe(false);
    expect(result.syncedFiles).toEqual([]);
  });
});
