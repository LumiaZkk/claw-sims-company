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

type OpenClawLocalAuthOptions = ResolveLocalOpenClawGatewayTokenOptions & {
  writeFile?: (filePath: string, content: string) => void;
  mkdir?: (dirPath: string) => void;
  statMtimeMs?: (filePath: string) => number | null;
  preferredSource?: "cli" | "gateway";
};

type EnvMap = Record<string, string>;
type ParsedOpenClawConfig = {
  agents?: {
    list?: Array<{
      id?: unknown;
      default?: unknown;
      agentDir?: unknown;
    }>;
  };
};
type CodexCredential = {
  access: string;
  refresh: string;
  expires: number;
  accountId?: string;
  email?: string;
};
type AuthProfileStore = {
  version?: number;
  profiles?: Record<string, Record<string, unknown>>;
  order?: Record<string, string[]>;
  lastGood?: Record<string, string>;
  usageStats?: Record<string, unknown>;
};

type LocalCodexAuthSyncResult = {
  profileId: string;
  syncedAgentIds: string[];
  changed: boolean;
  accountId?: string;
};

const OPENCLAW_STATE_DIR_NAME = ".openclaw";
const OPENCLAW_CONFIG_FILE_NAME = "openclaw.json";
const CODEX_HOME_DIR_NAME = ".codex";
const CODEX_AUTH_FILE_NAME = "auth.json";
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

function decodeJwtPayload(token: string): Record<string, unknown> | null {
  try {
    const payload = token.split(".")[1];
    if (!payload) {
      return null;
    }
    return JSON.parse(Buffer.from(payload, "base64url").toString("utf8")) as Record<string, unknown>;
  } catch {
    return null;
  }
}

function dedupeStrings(values: string[]): string[] {
  return [...new Set(values.filter((value) => value.trim().length > 0))];
}

function resolveCredentialExpiresAtMs(input: {
  accessToken: string;
  storedExpiresMs?: number | null;
  fallbackExpiresMs: number;
}) {
  const payload = decodeJwtPayload(input.accessToken);
  const jwtExpMs =
    typeof payload?.exp === "number" && Number.isFinite(payload.exp) && payload.exp > 0
      ? payload.exp * 1000
      : null;
  const storedExpiresMs =
    typeof input.storedExpiresMs === "number"
      && Number.isFinite(input.storedExpiresMs)
      && input.storedExpiresMs > 0
      ? input.storedExpiresMs
      : null;

  if (jwtExpMs && storedExpiresMs) {
    return Math.max(jwtExpMs, storedExpiresMs);
  }
  if (jwtExpMs) {
    return jwtExpMs;
  }
  if (storedExpiresMs) {
    return storedExpiresMs;
  }
  return input.fallbackExpiresMs;
}

function resolveCodexHomePath(
  env: NodeJS.ProcessEnv = process.env,
  homedir: () => string = os.homedir,
) {
  const configured = trimToUndefined(env.CODEX_HOME);
  if (configured) {
    return resolveUserPath(configured, env, homedir);
  }
  return path.join(resolveOpenClawHome(env, homedir), CODEX_HOME_DIR_NAME);
}

function resolveCodexAuthPath(
  env: NodeJS.ProcessEnv = process.env,
  homedir: () => string = os.homedir,
) {
  return path.join(resolveCodexHomePath(env, homedir), CODEX_AUTH_FILE_NAME);
}

function readOpenClawConfig(
  env: NodeJS.ProcessEnv,
  homedir: () => string,
  fileExists: (filePath: string) => boolean,
  readFile: (filePath: string) => string,
): ParsedOpenClawConfig | null {
  const configPath = resolveOpenClawConfigPath(env, homedir);
  if (!fileExists(configPath)) {
    return null;
  }
  try {
    const parsed = parseConfigFile(readFile(configPath));
    return parsed && typeof parsed === "object" ? (parsed as ParsedOpenClawConfig) : null;
  } catch {
    return null;
  }
}

function resolveDefaultOpenClawAgentId(
  config: ParsedOpenClawConfig | null,
) {
  const agents = Array.isArray(config?.agents?.list) ? config?.agents?.list : [];
  const defaultAgent = agents.find((agent) => agent && agent.default === true);
  if (defaultAgent && typeof defaultAgent.id === "string" && defaultAgent.id.trim().length > 0) {
    return defaultAgent.id.trim();
  }
  const firstAgent = agents.find((agent) => agent && typeof agent.id === "string" && agent.id.trim().length > 0);
  if (firstAgent && typeof firstAgent.id === "string") {
    return firstAgent.id.trim();
  }
  return "main";
}

export function resolveOpenClawAgentDir(
  agentId: string,
  options: ResolveLocalOpenClawGatewayTokenOptions = {},
) {
  const env = options.env ?? process.env;
  const homedir = options.homedir ?? os.homedir;
  const fileExists = options.fileExists ?? ((filePath: string) => fs.existsSync(filePath));
  const readFile = options.readFile ?? ((filePath: string) => fs.readFileSync(filePath, "utf8"));
  const config = readOpenClawConfig(env, homedir, fileExists, readFile);
  const configuredAgents = Array.isArray(config?.agents?.list) ? config?.agents?.list : [];
  const configured = configuredAgents.find(
    (candidate) => typeof candidate?.id === "string" && candidate.id.trim() === agentId,
  );
  if (typeof configured?.agentDir === "string" && configured.agentDir.trim().length > 0) {
    return resolveUserPath(configured.agentDir, env, homedir);
  }
  return path.join(resolveOpenClawStateDir(env, homedir), "agents", agentId, "agent");
}

function resolvePrimaryCodexSourceAgentDir(options: ResolveLocalOpenClawGatewayTokenOptions = {}) {
  const env = options.env ?? process.env;
  const homedir = options.homedir ?? os.homedir;
  const fileExists = options.fileExists ?? ((filePath: string) => fs.existsSync(filePath));
  const readFile = options.readFile ?? ((filePath: string) => fs.readFileSync(filePath, "utf8"));
  const config = readOpenClawConfig(env, homedir, fileExists, readFile);
  return resolveOpenClawAgentDir(resolveDefaultOpenClawAgentId(config), options);
}

function extractCodexCredentialFromStore(store: AuthProfileStore | null): CodexCredential | null {
  if (!store || !store.profiles || typeof store.profiles !== "object") {
    return null;
  }
  const entries = Object.entries(store.profiles);
  const preferred =
    entries.find(([profileId]) => profileId === "openai-codex:default")
    ?? entries.find(([profileId]) => profileId.startsWith("openai-codex:"));
  if (!preferred) {
    return null;
  }
  const credential = preferred[1];
  if (credential?.type !== "oauth" || credential.provider !== "openai-codex") {
    return null;
  }
  if (typeof credential.access !== "string" || !credential.access) {
    return null;
  }
  if (typeof credential.refresh !== "string" || !credential.refresh) {
    return null;
  }
  const expires = resolveCredentialExpiresAtMs({
    accessToken: credential.access,
    storedExpiresMs:
      typeof credential.expires === "number" && Number.isFinite(credential.expires) && credential.expires > 0
        ? credential.expires
        : null,
    fallbackExpiresMs: Date.now() + 60 * 60 * 1000,
  });
  return {
    access: credential.access,
    refresh: credential.refresh,
    expires,
    accountId: typeof credential.accountId === "string" ? credential.accountId : undefined,
    email: typeof credential.email === "string" ? credential.email : undefined,
  };
}

function readAuthProfileStore(
  agentDir: string,
  options: ResolveLocalOpenClawGatewayTokenOptions = {},
): AuthProfileStore | null {
  const fileExists = options.fileExists ?? ((filePath: string) => fs.existsSync(filePath));
  const readFile = options.readFile ?? ((filePath: string) => fs.readFileSync(filePath, "utf8"));
  const authPath = path.join(agentDir, "auth-profiles.json");
  if (!fileExists(authPath)) {
    return null;
  }
  try {
    return JSON.parse(readFile(authPath)) as AuthProfileStore;
  } catch {
    return null;
  }
}

function readCodexCredentialFromAuthJson(
  options: OpenClawLocalAuthOptions = {},
): CodexCredential | null {
  const env = options.env ?? process.env;
  const homedir = options.homedir ?? os.homedir;
  const fileExists = options.fileExists ?? ((filePath: string) => fs.existsSync(filePath));
  const readFile = options.readFile ?? ((filePath: string) => fs.readFileSync(filePath, "utf8"));
  const statMtimeMs =
    options.statMtimeMs ?? ((filePath: string) => {
      try {
        return fs.statSync(filePath).mtimeMs;
      } catch {
        return null;
      }
    });
  const authPath = resolveCodexAuthPath(env, homedir);
  if (!fileExists(authPath)) {
    return null;
  }
  try {
    const parsed = JSON.parse(readFile(authPath)) as { tokens?: Record<string, unknown> };
    const tokens = parsed.tokens;
    if (!tokens || typeof tokens !== "object") {
      return null;
    }
    const access = tokens.access_token;
    const refresh = tokens.refresh_token;
    if (typeof access !== "string" || !access || typeof refresh !== "string" || !refresh) {
      return null;
    }
    const payload = decodeJwtPayload(access);
    const mtimeMs = statMtimeMs(authPath) ?? Date.now();
    return {
      access,
      refresh,
      expires: resolveCredentialExpiresAtMs({
        accessToken: access,
        storedExpiresMs: null,
        fallbackExpiresMs: mtimeMs + 60 * 60 * 1000,
      }),
      accountId: typeof tokens.account_id === "string" ? tokens.account_id : undefined,
      email: typeof payload?.email === "string" ? payload.email : undefined,
    };
  } catch {
    return null;
  }
}

export function readLocalCodexCredential(
  options: OpenClawLocalAuthOptions = {},
): CodexCredential | null {
  const env = options.env ?? process.env;
  const homedir = options.homedir ?? os.homedir;
  const fileExists = options.fileExists ?? ((filePath: string) => fs.existsSync(filePath));
  const readFile = options.readFile ?? ((filePath: string) => fs.readFileSync(filePath, "utf8"));
  const primaryAgentDir = resolvePrimaryCodexSourceAgentDir({ env, homedir, fileExists, readFile });
  const fromStore = extractCodexCredentialFromStore(
    readAuthProfileStore(primaryAgentDir, { env, homedir, fileExists, readFile }),
  );
  const fromCodexCli = readCodexCredentialFromAuthJson(options);
  if (options.preferredSource === "gateway") {
    return fromStore ?? fromCodexCli;
  }
  return fromCodexCli ?? fromStore;
}

function buildCanonicalCodexProfiles(credential: CodexCredential) {
  const canonical = {
    type: "oauth",
    provider: "openai-codex",
    access: credential.access,
    refresh: credential.refresh,
    expires: credential.expires,
    ...(credential.accountId ? { accountId: credential.accountId } : {}),
    ...(credential.email ? { email: credential.email } : {}),
  } satisfies Record<string, unknown>;
  const profileIds = dedupeStrings([
    "openai-codex:default",
    credential.email ? `openai-codex:${credential.email}` : "",
  ]);
  return { canonical, profileIds };
}

function clearCodexStateFromStore(
  store: AuthProfileStore,
  profileIds: string[],
): AuthProfileStore {
  const nextStore: AuthProfileStore = {
    version: Number.isFinite(store.version) ? store.version : 1,
    profiles: { ...(store.profiles ?? {}) },
    ...(store.order ? { order: { ...store.order } } : {}),
    ...(store.lastGood ? { lastGood: { ...store.lastGood } } : {}),
    ...(store.usageStats ? { usageStats: { ...store.usageStats } } : {}),
  };

  for (const profileId of profileIds) {
    delete nextStore.profiles?.[profileId];
    delete nextStore.usageStats?.[profileId];
  }

  if (nextStore.order?.["openai-codex"]) {
    const remaining = nextStore.order["openai-codex"].filter(
      (profileId) => !profileIds.includes(profileId),
    );
    if (remaining.length > 0) {
      nextStore.order["openai-codex"] = remaining;
    } else {
      delete nextStore.order["openai-codex"];
    }
  }
  if (nextStore.order && Object.keys(nextStore.order).length === 0) {
    delete nextStore.order;
  }

  if (nextStore.lastGood?.["openai-codex"]) {
    delete nextStore.lastGood["openai-codex"];
  }
  if (nextStore.lastGood && Object.keys(nextStore.lastGood).length === 0) {
    delete nextStore.lastGood;
  }

  if (nextStore.usageStats && Object.keys(nextStore.usageStats).length === 0) {
    delete nextStore.usageStats;
  }

  return nextStore;
}

function serializeAuthProfileStore(store: AuthProfileStore) {
  return `${JSON.stringify(store, null, 2)}\n`;
}

export function syncLocalCodexAuthToAgents(
  agentIds: string[],
  options: OpenClawLocalAuthOptions = {},
): LocalCodexAuthSyncResult {
  const env = options.env ?? process.env;
  const homedir = options.homedir ?? os.homedir;
  const fileExists = options.fileExists ?? ((filePath: string) => fs.existsSync(filePath));
  const readFile = options.readFile ?? ((filePath: string) => fs.readFileSync(filePath, "utf8"));
  const writeFile = options.writeFile ?? ((filePath: string, content: string) => fs.writeFileSync(filePath, content, "utf8"));
  const mkdir = options.mkdir ?? ((dirPath: string) => fs.mkdirSync(dirPath, { recursive: true }));
  const credential = readLocalCodexCredential({
    env,
    homedir,
    fileExists,
    readFile,
    statMtimeMs: options.statMtimeMs,
    preferredSource: options.preferredSource,
  });
  if (!credential) {
    throw new Error("未找到可同步的本地 Codex 授权。请先完成 Codex 登录或 OAuth。");
  }
  const normalizedAgentIds = dedupeStrings(agentIds.map((agentId) => agentId.trim()));
  const { canonical, profileIds } = buildCanonicalCodexProfiles(credential);
  const mainAgentDir = resolvePrimaryCodexSourceAgentDir({ env, homedir, fileExists, readFile });
  const mainAuthPath = path.join(mainAgentDir, "auth-profiles.json");
  const existingMainStore = readAuthProfileStore(mainAgentDir, { env, homedir, fileExists, readFile }) ?? {};
  const nextMainStore: AuthProfileStore = {
    version: 1,
    profiles: { ...(existingMainStore.profiles ?? {}) },
    order: { ...(existingMainStore.order ?? {}) },
    lastGood: { ...(existingMainStore.lastGood ?? {}) },
    ...(existingMainStore.usageStats ? { usageStats: { ...existingMainStore.usageStats } } : {}),
  };
  for (const profileId of profileIds) {
    nextMainStore.profiles![profileId] = { ...canonical };
  }
  const previousMainOrder = Array.isArray(nextMainStore.order?.["openai-codex"])
    ? nextMainStore.order?.["openai-codex"]
    : [];
  nextMainStore.order!["openai-codex"] = dedupeStrings([
    "openai-codex:default",
    ...profileIds,
    ...previousMainOrder,
  ]);
  nextMainStore.lastGood!["openai-codex"] = "openai-codex:default";
  if (nextMainStore.usageStats) {
    for (const key of Object.keys(nextMainStore.usageStats)) {
      if (key === "openai-codex:default" || key.startsWith("openai-codex:")) {
        delete nextMainStore.usageStats[key];
      }
    }
    if (Object.keys(nextMainStore.usageStats).length === 0) {
      delete nextMainStore.usageStats;
    }
  }
  let changed = false;
  const serializedExistingMainStore = serializeAuthProfileStore(existingMainStore);
  const serializedNextMainStore = serializeAuthProfileStore(nextMainStore);
  if (serializedExistingMainStore !== serializedNextMainStore) {
    mkdir(mainAgentDir);
    writeFile(mainAuthPath, serializedNextMainStore);
    changed = true;
  }

  for (const agentId of normalizedAgentIds) {
    const agentDir = resolveOpenClawAgentDir(agentId, { env, homedir, fileExists, readFile });
    const authPath = path.join(agentDir, "auth-profiles.json");
    const existingStore = readAuthProfileStore(agentDir, { env, homedir, fileExists, readFile });
    if (!existingStore) {
      continue;
    }
    const nextStore = clearCodexStateFromStore(existingStore, profileIds);
    const serializedExistingStore = serializeAuthProfileStore(existingStore);
    const serializedNextStore = serializeAuthProfileStore(nextStore);
    if (serializedExistingStore === serializedNextStore) {
      continue;
    }
    mkdir(agentDir);
    writeFile(authPath, serializedNextStore);
    changed = true;
  }

  return {
    profileId: "openai-codex:default",
    syncedAgentIds: normalizedAgentIds,
    changed,
    ...(credential.accountId ? { accountId: credential.accountId } : {}),
  };
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
