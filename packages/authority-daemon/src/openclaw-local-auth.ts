import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import vm from "node:vm";

type ResolveLocalOpenClawGatewayTokenOptions = {
  env?: NodeJS.ProcessEnv;
  homedir?: () => string;
  fileExists?: (filePath: string) => boolean;
  readFile?: (filePath: string) => string;
};

type EnvMap = Record<string, string>;

const OPENCLAW_STATE_DIR_NAME = ".openclaw";
const OPENCLAW_CONFIG_FILE_NAME = "openclaw.json";
const ENV_TEMPLATE_PATTERN = /^\$\{([A-Z][A-Z0-9_]*)\}$/;

function trimToUndefined(value: unknown): string | undefined {
  if (typeof value !== "string") {
    return undefined;
  }
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : undefined;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function resolveUserPath(
  input: string,
  env: NodeJS.ProcessEnv,
  homedir: () => string,
): string {
  const trimmed = input.trim();
  if (!trimmed) {
    return path.resolve(homedir());
  }
  if (trimmed === "~") {
    return path.resolve(resolveOpenClawHome(env, homedir));
  }
  if (trimmed.startsWith("~/") || trimmed.startsWith("~\\")) {
    return path.resolve(resolveOpenClawHome(env, homedir), trimmed.slice(2));
  }
  if (trimmed.startsWith("~")) {
    return path.resolve(resolveOpenClawHome(env, homedir), trimmed.slice(1));
  }
  return path.resolve(trimmed);
}

function resolveOpenClawHome(
  env: NodeJS.ProcessEnv,
  homedir: () => string,
): string {
  const explicitHome = trimToUndefined(env.OPENCLAW_HOME) ?? trimToUndefined(env.CLAWDBOT_HOME);
  if (explicitHome) {
    return resolveUserPath(explicitHome, { ...env, OPENCLAW_HOME: "" }, homedir);
  }
  const envHome = trimToUndefined(env.HOME);
  if (envHome) {
    return path.resolve(envHome);
  }
  return path.resolve(homedir());
}

export function resolveOpenClawStateDir(
  env: NodeJS.ProcessEnv = process.env,
  homedir: () => string = os.homedir,
) {
  const override = trimToUndefined(env.OPENCLAW_STATE_DIR) ?? trimToUndefined(env.CLAWDBOT_STATE_DIR);
  if (override) {
    return resolveUserPath(override, env, homedir);
  }
  return path.join(resolveOpenClawHome(env, homedir), OPENCLAW_STATE_DIR_NAME);
}

export function resolveOpenClawConfigPath(
  env: NodeJS.ProcessEnv = process.env,
  homedir: () => string = os.homedir,
) {
  const override = trimToUndefined(env.OPENCLAW_CONFIG_PATH) ?? trimToUndefined(env.CLAWDBOT_CONFIG_PATH);
  if (override) {
    return resolveUserPath(override, env, homedir);
  }
  return path.join(resolveOpenClawStateDir(env, homedir), OPENCLAW_CONFIG_FILE_NAME);
}

function parseDotEnv(raw: string): EnvMap {
  const result: EnvMap = {};
  for (const line of raw.split(/\r?\n/u)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) {
      continue;
    }
    const normalized = trimmed.startsWith("export ") ? trimmed.slice("export ".length) : trimmed;
    const separatorIndex = normalized.indexOf("=");
    if (separatorIndex <= 0) {
      continue;
    }
    const key = normalized.slice(0, separatorIndex).trim();
    if (!key) {
      continue;
    }
    let value = normalized.slice(separatorIndex + 1).trim();
    if (
      (value.startsWith("\"") && value.endsWith("\""))
      || (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    result[key] = value;
  }
  return result;
}

function readDotEnvMap(
  stateDir: string,
  fileExists: (filePath: string) => boolean,
  readFile: (filePath: string) => string,
): EnvMap {
  const envPath = path.join(stateDir, ".env");
  if (!fileExists(envPath)) {
    return {};
  }
  try {
    return parseDotEnv(readFile(envPath));
  } catch {
    return {};
  }
}

function readNamedEnv(
  env: NodeJS.ProcessEnv,
  dotEnv: EnvMap,
  name: string,
) {
  return trimToUndefined(env[name]) ?? trimToUndefined(dotEnv[name]);
}

function readGatewayTokenEnv(
  env: NodeJS.ProcessEnv,
  dotEnv: EnvMap,
) {
  return (
    readNamedEnv(env, dotEnv, "OPENCLAW_GATEWAY_TOKEN")
    ?? readNamedEnv(env, dotEnv, "CLAWDBOT_GATEWAY_TOKEN")
  );
}

function resolveTokenFromConfigValue(
  value: unknown,
  env: NodeJS.ProcessEnv,
  dotEnv: EnvMap,
) {
  const direct = trimToUndefined(value);
  if (direct) {
    const envTemplateMatch = ENV_TEMPLATE_PATTERN.exec(direct);
    if (envTemplateMatch) {
      return readNamedEnv(env, dotEnv, envTemplateMatch[1]);
    }
    return direct;
  }
  if (!isRecord(value) || value.source !== "env" || typeof value.id !== "string") {
    return undefined;
  }
  return readNamedEnv(env, dotEnv, value.id);
}

function parseConfigFile(raw: string): unknown {
  const trimmed = raw.trim();
  if (!trimmed) {
    return null;
  }
  try {
    return JSON.parse(trimmed) as unknown;
  } catch {
    try {
      return vm.runInNewContext(`(${trimmed})`, Object.create(null), { timeout: 50 }) as unknown;
    } catch {
      return null;
    }
  }
}

export function resolveLocalOpenClawGatewayToken(
  options: ResolveLocalOpenClawGatewayTokenOptions = {},
) {
  const env = options.env ?? process.env;
  const homedir = options.homedir ?? os.homedir;
  const fileExists = options.fileExists ?? ((filePath: string) => fs.existsSync(filePath));
  const readFile = options.readFile ?? ((filePath: string) => fs.readFileSync(filePath, "utf8"));
  const stateDir = resolveOpenClawStateDir(env, homedir);
  const dotEnv = readDotEnvMap(stateDir, fileExists, readFile);
  const configPath = resolveOpenClawConfigPath(env, homedir);

  if (fileExists(configPath)) {
    try {
      const parsed = parseConfigFile(readFile(configPath));
      if (isRecord(parsed) && isRecord(parsed.gateway) && isRecord(parsed.gateway.auth)) {
        const mode = trimToUndefined(parsed.gateway.auth.mode);
        if (mode === "password") {
          return undefined;
        }
        const configured = resolveTokenFromConfigValue(parsed.gateway.auth.token, env, dotEnv);
        if (configured) {
          return configured;
        }
      }
    } catch {
      // Fall through to env-based fallback.
    }
  }

  return readGatewayTokenEnv(env, dotEnv);
}
