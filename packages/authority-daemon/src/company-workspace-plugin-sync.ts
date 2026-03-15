import { access, readFile, mkdir, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import {
  listManagedExecutorWorkspacePluginFiles,
  type ManagedExecutorAgentTarget,
} from "./company/company-executor-sync";

type ManagedWorkspacePluginSyncOptions = {
  homeDir?: () => string;
  readFile?: (filePath: string) => Promise<string>;
  writeFile?: (filePath: string, content: string) => Promise<void>;
  mkdir?: (dirPath: string) => Promise<void>;
  access?: (filePath: string) => Promise<void>;
  rm?: (dirPath: string) => Promise<void>;
};

export type ManagedWorkspacePluginSyncResult = {
  agentId: string;
  workspaceDir: string;
  changed: boolean;
  syncedFiles: string[];
};

const LEGACY_WORKSPACE_PLUGIN_ROOTS = [
  ".openclaw/extensions/company-dispatch",
] as const;

function resolveWorkspacePath(workspace: string, homeDir: string) {
  if (workspace === "~") {
    return path.resolve(homeDir);
  }
  if (workspace.startsWith("~/") || workspace.startsWith("~\\")) {
    return path.resolve(homeDir, workspace.slice(2));
  }
  return path.resolve(workspace);
}

function isMissingFileError(error: unknown) {
  return error instanceof Error && "code" in error && error.code === "ENOENT";
}

async function pathExists(
  filePath: string,
  accessImpl: (filePath: string) => Promise<void>,
) {
  try {
    await accessImpl(filePath);
    return true;
  } catch (error) {
    if (isMissingFileError(error)) {
      return false;
    }
    throw error;
  }
}

export async function syncManagedExecutorWorkspacePlugin(
  target: Pick<ManagedExecutorAgentTarget, "agentId" | "workspace">,
  options: ManagedWorkspacePluginSyncOptions = {},
): Promise<ManagedWorkspacePluginSyncResult> {
  const homeDir = options.homeDir ?? os.homedir;
  const readFileImpl = options.readFile ?? ((filePath: string) => readFile(filePath, "utf8"));
  const writeFileImpl =
    options.writeFile ?? ((filePath: string, content: string) => writeFile(filePath, content, "utf8"));
  const mkdirImpl = options.mkdir ?? ((dirPath: string) => mkdir(dirPath, { recursive: true }));
  const accessImpl = options.access ?? ((filePath: string) => access(filePath));
  const rmImpl = options.rm ?? ((dirPath: string) => rm(dirPath, { recursive: true, force: true }));
  const workspaceDir = resolveWorkspacePath(target.workspace, homeDir());
  const syncedFiles: string[] = [];
  let changed = false;

  for (const legacyRoot of LEGACY_WORKSPACE_PLUGIN_ROOTS) {
    const legacyPath = path.join(workspaceDir, legacyRoot);
    if (!(await pathExists(legacyPath, accessImpl))) {
      continue;
    }
    await rmImpl(legacyPath);
    changed = true;
  }

  for (const file of listManagedExecutorWorkspacePluginFiles()) {
    const targetPath = path.join(workspaceDir, file.name);
    let currentContent: string | null = null;
    try {
      currentContent = await readFileImpl(targetPath);
    } catch (error) {
      if (!isMissingFileError(error)) {
        throw error;
      }
    }

    if (currentContent === file.content) {
      continue;
    }

    await mkdirImpl(path.dirname(targetPath));
    await writeFileImpl(targetPath, file.content);
    syncedFiles.push(file.name);
    changed = true;
  }

  return {
    agentId: target.agentId,
    workspaceDir,
    changed,
    syncedFiles,
  };
}
