import { existsSync } from "node:fs";
import { spawn, spawnSync } from "node:child_process";
import path from "node:path";

export type AgentWorkspaceEntryRunStatus = "executed" | "missing" | "unsupported";

export type AgentWorkspaceEntryRunResult = {
  agentId: string;
  workspace: string;
  entryPath: string;
  status: AgentWorkspaceEntryRunStatus;
  cwd: string;
  command?: string[];
  exitCode?: number | null;
  stdout?: string;
  stderr?: string;
  durationMs?: number;
  message?: string | null;
};

type AgentWorkspaceEntryRunInput = {
  agentId: string;
  workspace: string;
  entryPath: string;
  payload?: Record<string, unknown>;
  timeoutMs?: number;
};

type ResolvedWorkspaceCommand =
  | {
      status: "ready";
      cwd: string;
      filePath: string;
      command: string[];
    }
  | {
      status: "missing" | "unsupported";
      cwd: string;
      message: string;
    };

function normalizeWorkspacePath(workspace: string) {
  return path.resolve(workspace);
}

function isPathInside(parentDir: string, childPath: string) {
  const relative = path.relative(parentDir, childPath);
  return relative === "" || (!relative.startsWith("..") && !path.isAbsolute(relative));
}

function canExecute(command: string, args: string[] = []) {
  const result = spawnSync(command, args, {
    stdio: "ignore",
    timeout: 3_000,
  });
  return !result.error;
}

function resolvePythonCommand() {
  if (process.platform === "win32") {
    if (canExecute("py", ["-3", "--version"])) {
      return ["py", "-3"];
    }
    if (canExecute("python", ["--version"])) {
      return ["python"];
    }
    return null;
  }
  if (canExecute("python3", ["--version"])) {
    return ["python3"];
  }
  if (canExecute("python", ["--version"])) {
    return ["python"];
  }
  return null;
}

function resolveShellCommand() {
  if (process.platform === "win32") {
    return ["cmd.exe", "/c"];
  }
  return [process.env.SHELL?.trim() || "sh"];
}

function resolveTsxCommand() {
  const executable = process.platform === "win32" ? "tsx.cmd" : "tsx";
  const localTsxPath = path.resolve(process.cwd(), "node_modules", ".bin", executable);
  if (existsSync(localTsxPath)) {
    return [localTsxPath];
  }
  if (canExecute("tsx", ["--version"])) {
    return ["tsx"];
  }
  return null;
}

function resolveWorkspaceEntryCommand(workspace: string, entryPath: string): ResolvedWorkspaceCommand {
  if (!path.isAbsolute(workspace)) {
    return {
      status: "unsupported",
      cwd: workspace,
      message: `当前 workspace 不是本地文件系统路径：${workspace}`,
    };
  }

  const cwd = normalizeWorkspacePath(workspace);
  const filePath = path.resolve(cwd, entryPath);
  if (!isPathInside(cwd, filePath)) {
    return {
      status: "unsupported",
      cwd,
      message: `Skill entryPath 越过了 workspace 根目录：${entryPath}`,
    };
  }
  if (!existsSync(filePath)) {
    return {
      status: "missing",
      cwd,
      message: `workspace 中未找到脚本：${entryPath}`,
    };
  }

  const extension = path.extname(filePath).toLowerCase();
  switch (extension) {
    case ".js":
    case ".mjs":
    case ".cjs":
      return {
        status: "ready",
        cwd,
        filePath,
        command: [process.execPath, filePath],
      };
    case ".ts":
    case ".mts":
    case ".cts": {
      const tsxCommand = resolveTsxCommand();
      if (!tsxCommand) {
        return {
          status: "unsupported",
          cwd,
          message: "当前环境没有可用的 tsx 运行器，无法执行 TypeScript workspace script。",
        };
      }
      return {
        status: "ready",
        cwd,
        filePath,
        command: [...tsxCommand, filePath],
      };
    }
    case ".py": {
      const pythonCommand = resolvePythonCommand();
      if (!pythonCommand) {
        return {
          status: "unsupported",
          cwd,
          message: "当前环境没有可用的 Python 解释器，无法执行 Python workspace script。",
        };
      }
      return {
        status: "ready",
        cwd,
        filePath,
        command: [...pythonCommand, filePath],
      };
    }
    case ".sh": {
      const shellCommand = resolveShellCommand();
      return {
        status: "ready",
        cwd,
        filePath,
        command: [...shellCommand, filePath],
      };
    }
    default:
      return {
        status: "unsupported",
        cwd,
        message: `当前只支持 .js/.mjs/.cjs/.ts/.mts/.cts/.py/.sh 脚本，暂不支持 ${extension || "无扩展名"}。`,
      };
  }
}

export async function runAgentWorkspaceEntry(
  input: AgentWorkspaceEntryRunInput,
): Promise<AgentWorkspaceEntryRunResult> {
  const resolution = resolveWorkspaceEntryCommand(input.workspace, input.entryPath);
  if (resolution.status !== "ready") {
    return {
      agentId: input.agentId,
      workspace: input.workspace,
      entryPath: input.entryPath,
      status: resolution.status,
      cwd: resolution.cwd,
      message: resolution.message,
    };
  }

  const [command, ...args] = resolution.command;
  const startedAt = Date.now();
  return new Promise<AgentWorkspaceEntryRunResult>((resolve, reject) => {
    const child = spawn(command, args, {
      cwd: resolution.cwd,
      env: {
        ...process.env,
        CYBER_COMPANY_SKILL_INPUT_JSON: JSON.stringify(input.payload ?? {}),
      },
      stdio: ["pipe", "pipe", "pipe"],
    });
    let stdout = "";
    let stderr = "";
    let settled = false;
    const timeoutMs = input.timeoutMs ?? 20_000;
    const timer = setTimeout(() => {
      if (settled) {
        return;
      }
      settled = true;
      child.kill("SIGTERM");
      resolve({
        agentId: input.agentId,
        workspace: input.workspace,
        entryPath: input.entryPath,
        status: "executed",
        cwd: resolution.cwd,
        command: resolution.command,
        exitCode: null,
        stdout,
        stderr: `${stderr}\n[timeout] 执行超过 ${timeoutMs}ms，已停止。`.trim(),
        durationMs: Date.now() - startedAt,
        message: "Skill workspace script 执行超时。",
      });
    }, timeoutMs);

    child.stdout.on("data", (chunk) => {
      stdout += String(chunk);
    });
    child.stderr.on("data", (chunk) => {
      stderr += String(chunk);
    });
    child.on("error", (error) => {
      if (settled) {
        return;
      }
      settled = true;
      clearTimeout(timer);
      reject(error);
    });
    child.on("close", (exitCode) => {
      if (settled) {
        return;
      }
      settled = true;
      clearTimeout(timer);
      resolve({
        agentId: input.agentId,
        workspace: input.workspace,
        entryPath: input.entryPath,
        status: "executed",
        cwd: resolution.cwd,
        command: resolution.command,
        exitCode,
        stdout,
        stderr,
        durationMs: Date.now() - startedAt,
        message: exitCode === 0 ? "Skill workspace script 执行完成。" : "Skill workspace script 返回非零退出码。",
      });
    });
  });
}

export { resolveWorkspaceEntryCommand };
