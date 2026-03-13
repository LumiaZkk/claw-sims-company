import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { runAgentWorkspaceEntry, resolveWorkspaceEntryCommand } from "./agent-file-runner";

const tempDirs: string[] = [];

function createTempWorkspace() {
  const workspace = mkdtempSync(path.join(os.tmpdir(), "cc-agent-runner-"));
  tempDirs.push(workspace);
  return workspace;
}

afterEach(() => {
  while (tempDirs.length > 0) {
    const target = tempDirs.pop();
    if (!target) {
      continue;
    }
    try {
      rmSync(target, { recursive: true, force: true });
    } catch {
      // noop in test cleanup
    }
  }
});

describe("resolveWorkspaceEntryCommand", () => {
  it("returns missing when entry path does not exist", () => {
    const workspace = createTempWorkspace();
    const result = resolveWorkspaceEntryCommand(workspace, "scripts/missing.js");

    expect(result.status).toBe("missing");
  });

  it("blocks path traversal outside the workspace root", () => {
    const workspace = createTempWorkspace();
    const result = resolveWorkspaceEntryCommand(workspace, "../escape.js");

    expect(result.status).toBe("unsupported");
    if (result.status !== "unsupported") {
      throw new Error(`expected unsupported status, got ${result.status}`);
    }
    expect(result.message).toContain("越过了 workspace 根目录");
  });
});

describe("runAgentWorkspaceEntry", () => {
  it("executes a workspace javascript file and captures stdout", async () => {
    const workspace = createTempWorkspace();
    mkdirSync(path.join(workspace, "scripts"), { recursive: true });
    writeFileSync(
      path.join(workspace, "scripts", "echo.js"),
      [
        "const payload = JSON.parse(process.env.CYBER_COMPANY_SKILL_INPUT_JSON || '{}');",
        "console.log(JSON.stringify({",
        "  successTitle: '脚本已执行',",
        "  successDetail: `收到 ${payload.companyId}`",
        "}));",
      ].join("\n"),
      "utf8",
    );

    const result = await runAgentWorkspaceEntry({
      agentId: "cto-1",
      workspace,
      entryPath: "scripts/echo.js",
      payload: { companyId: "company-1" },
    });

    expect(result.status).toBe("executed");
    expect(result.exitCode).toBe(0);
    expect(result.stdout).toContain('"successTitle":"脚本已执行"');
    expect(result.command?.[0]).toBe(process.execPath);
  });

  it("returns unsupported for non-local authority workspaces", async () => {
    const result = await runAgentWorkspaceEntry({
      agentId: "cto-1",
      workspace: "authority://cto-1",
      entryPath: "scripts/echo.js",
    });

    expect(result.status).toBe("unsupported");
    expect(result.message).toContain("不是本地文件系统路径");
  });
});
