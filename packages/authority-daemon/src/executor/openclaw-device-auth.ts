import crypto from "node:crypto";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { resolveOpenClawStateDir } from "./openclaw-local-auth";

export type LocalOpenClawDeviceIdentity = {
  deviceId: string;
  publicKeyPem: string;
  privateKeyPem: string;
};

export type LocalOpenClawDeviceAuthEntry = {
  token: string;
  role: string;
  scopes: string[];
  updatedAtMs: number;
};

type StoredIdentity = {
  version: 1;
  deviceId: string;
  publicKeyPem: string;
  privateKeyPem: string;
  createdAtMs: number;
};

type DeviceAuthStore = {
  version: 1;
  deviceId: string;
  tokens: Record<string, LocalOpenClawDeviceAuthEntry>;
};

type LocalOpenClawDeviceAuthOptions = {
  env?: NodeJS.ProcessEnv;
  homedir?: () => string;
  fileExists?: (filePath: string) => boolean;
  readFile?: (filePath: string) => string;
  writeFile?: (filePath: string, content: string) => void;
  mkdir?: (dirPath: string) => void;
};

const ED25519_SPKI_PREFIX = Buffer.from("302a300506032b6570032100", "hex");

function normalizeRole(role: string): string {
  const trimmed = role.trim();
  return trimmed.length > 0 ? trimmed : "operator";
}

function normalizeScopes(scopes: string[] | undefined): string[] {
  return [...new Set((scopes ?? []).map((scope) => scope.trim()).filter((scope) => scope.length > 0))];
}

function resolveDeviceIdentityPath(
  env: NodeJS.ProcessEnv = process.env,
  homedir: () => string = os.homedir,
) {
  return path.join(resolveOpenClawStateDir(env, homedir), "identity", "device.json");
}

function resolveDeviceAuthStorePath(
  env: NodeJS.ProcessEnv = process.env,
  homedir: () => string = os.homedir,
) {
  return path.join(resolveOpenClawStateDir(env, homedir), "identity", "device-auth.json");
}

function ensureDir(
  dirPath: string,
  mkdir: (dirPath: string) => void,
) {
  mkdir(dirPath);
}

function base64UrlEncode(buf: Buffer) {
  return buf.toString("base64").replaceAll("+", "-").replaceAll("/", "_").replace(/=+$/g, "");
}

function derivePublicKeyRaw(publicKeyPem: string): Buffer {
  const key = crypto.createPublicKey(publicKeyPem);
  const spki = key.export({ type: "spki", format: "der" }) as Buffer;
  if (
    spki.length === ED25519_SPKI_PREFIX.length + 32
    && spki.subarray(0, ED25519_SPKI_PREFIX.length).equals(ED25519_SPKI_PREFIX)
  ) {
    return spki.subarray(ED25519_SPKI_PREFIX.length);
  }
  return spki;
}

function fingerprintPublicKey(publicKeyPem: string) {
  const raw = derivePublicKeyRaw(publicKeyPem);
  return crypto.createHash("sha256").update(raw).digest("hex");
}

function generateIdentity(): LocalOpenClawDeviceIdentity {
  const { publicKey, privateKey } = crypto.generateKeyPairSync("ed25519");
  const publicKeyPem = publicKey.export({ type: "spki", format: "pem" }).toString();
  const privateKeyPem = privateKey.export({ type: "pkcs8", format: "pem" }).toString();
  const deviceId = fingerprintPublicKey(publicKeyPem);
  return { deviceId, publicKeyPem, privateKeyPem };
}

function readDeviceAuthStore(
  filePath: string,
  fileExists: (filePath: string) => boolean,
  readFile: (filePath: string) => string,
): DeviceAuthStore | null {
  if (!fileExists(filePath)) {
    return null;
  }
  try {
    const parsed = JSON.parse(readFile(filePath)) as DeviceAuthStore;
    if (
      parsed?.version !== 1
      || typeof parsed.deviceId !== "string"
      || !parsed.tokens
      || typeof parsed.tokens !== "object"
    ) {
      return null;
    }
    return parsed;
  } catch {
    return null;
  }
}

export function buildDeviceAuthPayloadV3(params: {
  deviceId: string;
  clientId: string;
  clientMode: string;
  role: string;
  scopes: string[];
  signedAtMs: number;
  token?: string | null;
  nonce: string;
  platform?: string | null;
  deviceFamily?: string | null;
}) {
  const token = params.token ?? "";
  const platform = params.platform?.trim() ?? "";
  const deviceFamily = params.deviceFamily?.trim() ?? "";
  return [
    "v3",
    params.deviceId,
    params.clientId,
    params.clientMode,
    params.role,
    params.scopes.join(","),
    String(params.signedAtMs),
    token,
    params.nonce,
    platform,
    deviceFamily,
  ].join("|");
}

export function publicKeyRawBase64UrlFromPem(publicKeyPem: string) {
  return base64UrlEncode(derivePublicKeyRaw(publicKeyPem));
}

export function signDevicePayload(privateKeyPem: string, payload: string) {
  const key = crypto.createPrivateKey(privateKeyPem);
  const signature = crypto.sign(null, Buffer.from(payload, "utf8"), key);
  return base64UrlEncode(signature);
}

export function loadOrCreateLocalOpenClawDeviceIdentity(
  options: LocalOpenClawDeviceAuthOptions = {},
): LocalOpenClawDeviceIdentity {
  const env = options.env ?? process.env;
  const homedir = options.homedir ?? os.homedir;
  const fileExists = options.fileExists ?? ((filePath: string) => fs.existsSync(filePath));
  const readFile = options.readFile ?? ((filePath: string) => fs.readFileSync(filePath, "utf8"));
  const writeFile = options.writeFile ?? ((filePath: string, content: string) => {
    fs.writeFileSync(filePath, content, { mode: 0o600 });
    try {
      fs.chmodSync(filePath, 0o600);
    } catch {
      // best-effort
    }
  });
  const mkdir = options.mkdir ?? ((dirPath: string) => fs.mkdirSync(dirPath, { recursive: true }));
  const filePath = resolveDeviceIdentityPath(env, homedir);

  if (fileExists(filePath)) {
    try {
      const parsed = JSON.parse(readFile(filePath)) as StoredIdentity;
      if (
        parsed?.version === 1
        && typeof parsed.deviceId === "string"
        && typeof parsed.publicKeyPem === "string"
        && typeof parsed.privateKeyPem === "string"
      ) {
        const derivedId = fingerprintPublicKey(parsed.publicKeyPem);
        if (derivedId !== parsed.deviceId) {
          const updated: StoredIdentity = {
            ...parsed,
            deviceId: derivedId,
          };
          ensureDir(path.dirname(filePath), mkdir);
          writeFile(filePath, `${JSON.stringify(updated, null, 2)}\n`);
          return {
            deviceId: derivedId,
            publicKeyPem: parsed.publicKeyPem,
            privateKeyPem: parsed.privateKeyPem,
          };
        }
        return {
          deviceId: parsed.deviceId,
          publicKeyPem: parsed.publicKeyPem,
          privateKeyPem: parsed.privateKeyPem,
        };
      }
    } catch {
      // Fall through and regenerate.
    }
  }

  const identity = generateIdentity();
  const stored: StoredIdentity = {
    version: 1,
    deviceId: identity.deviceId,
    publicKeyPem: identity.publicKeyPem,
    privateKeyPem: identity.privateKeyPem,
    createdAtMs: Date.now(),
  };
  ensureDir(path.dirname(filePath), mkdir);
  writeFile(filePath, `${JSON.stringify(stored, null, 2)}\n`);
  return identity;
}

export function loadLocalOpenClawDeviceAuthToken(
  params: { deviceId: string; role: string } & LocalOpenClawDeviceAuthOptions,
): LocalOpenClawDeviceAuthEntry | null {
  const env = params.env ?? process.env;
  const homedir = params.homedir ?? os.homedir;
  const fileExists = params.fileExists ?? ((filePath: string) => fs.existsSync(filePath));
  const readFile = params.readFile ?? ((filePath: string) => fs.readFileSync(filePath, "utf8"));
  const filePath = resolveDeviceAuthStorePath(env, homedir);
  const store = readDeviceAuthStore(filePath, fileExists, readFile);
  if (!store || store.deviceId !== params.deviceId) {
    return null;
  }
  const role = normalizeRole(params.role);
  const entry = store.tokens[role];
  if (!entry || typeof entry.token !== "string") {
    return null;
  }
  return {
    token: entry.token,
    role,
    scopes: normalizeScopes(entry.scopes),
    updatedAtMs: typeof entry.updatedAtMs === "number" ? entry.updatedAtMs : Date.now(),
  };
}

export function storeLocalOpenClawDeviceAuthToken(
  params: {
    deviceId: string;
    role: string;
    token: string;
    scopes?: string[];
  } & LocalOpenClawDeviceAuthOptions,
): LocalOpenClawDeviceAuthEntry {
  const env = params.env ?? process.env;
  const homedir = params.homedir ?? os.homedir;
  const fileExists = params.fileExists ?? ((filePath: string) => fs.existsSync(filePath));
  const readFile = params.readFile ?? ((filePath: string) => fs.readFileSync(filePath, "utf8"));
  const writeFile = params.writeFile ?? ((filePath: string, content: string) => {
    fs.writeFileSync(filePath, content, { mode: 0o600 });
    try {
      fs.chmodSync(filePath, 0o600);
    } catch {
      // best-effort
    }
  });
  const mkdir = params.mkdir ?? ((dirPath: string) => fs.mkdirSync(dirPath, { recursive: true }));
  const filePath = resolveDeviceAuthStorePath(env, homedir);
  const existing = readDeviceAuthStore(filePath, fileExists, readFile);
  const role = normalizeRole(params.role);
  const entry: LocalOpenClawDeviceAuthEntry = {
    token: params.token,
    role,
    scopes: normalizeScopes(params.scopes),
    updatedAtMs: Date.now(),
  };
  const nextStore: DeviceAuthStore = {
    version: 1,
    deviceId: params.deviceId,
    tokens:
      existing && existing.deviceId === params.deviceId
        ? { ...existing.tokens, [role]: entry }
        : { [role]: entry },
  };
  ensureDir(path.dirname(filePath), mkdir);
  writeFile(filePath, `${JSON.stringify(nextStore, null, 2)}\n`);
  return entry;
}

export function clearLocalOpenClawDeviceAuthToken(
  params: { deviceId: string; role: string } & LocalOpenClawDeviceAuthOptions,
) {
  const env = params.env ?? process.env;
  const homedir = params.homedir ?? os.homedir;
  const fileExists = params.fileExists ?? ((filePath: string) => fs.existsSync(filePath));
  const readFile = params.readFile ?? ((filePath: string) => fs.readFileSync(filePath, "utf8"));
  const writeFile = params.writeFile ?? ((filePath: string, content: string) => {
    fs.writeFileSync(filePath, content, { mode: 0o600 });
    try {
      fs.chmodSync(filePath, 0o600);
    } catch {
      // best-effort
    }
  });
  const filePath = resolveDeviceAuthStorePath(env, homedir);
  const store = readDeviceAuthStore(filePath, fileExists, readFile);
  if (!store || store.deviceId !== params.deviceId) {
    return;
  }
  const role = normalizeRole(params.role);
  if (!store.tokens[role]) {
    return;
  }
  const nextStore: DeviceAuthStore = {
    version: 1,
    deviceId: store.deviceId,
    tokens: { ...store.tokens },
  };
  delete nextStore.tokens[role];
  writeFile(filePath, `${JSON.stringify(nextStore, null, 2)}\n`);
}
