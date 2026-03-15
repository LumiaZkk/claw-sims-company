import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import {
  buildDeviceAuthPayloadV3,
  clearLocalOpenClawDeviceAuthToken,
  loadLocalOpenClawDeviceAuthToken,
  loadOrCreateLocalOpenClawDeviceIdentity,
  publicKeyRawBase64UrlFromPem,
  signDevicePayload,
  storeLocalOpenClawDeviceAuthToken,
} from "./openclaw-device-auth";

function createTempRoot() {
  return fs.mkdtempSync(path.join(os.tmpdir(), "authority-openclaw-device-auth-"));
}

describe("openclaw-device-auth", () => {
  const roots: string[] = [];

  afterEach(() => {
    for (const root of roots.splice(0)) {
      fs.rmSync(root, { recursive: true, force: true });
    }
  });

  it("reuses the existing local openclaw device identity", () => {
    const root = createTempRoot();
    roots.push(root);
    const firstIdentity = loadOrCreateLocalOpenClawDeviceIdentity({
      env: { OPENCLAW_HOME: root } as NodeJS.ProcessEnv,
      homedir: () => "/unused",
    });
    const identity = loadOrCreateLocalOpenClawDeviceIdentity({
      env: { OPENCLAW_HOME: root } as NodeJS.ProcessEnv,
      homedir: () => "/unused",
    });

    expect(identity).toEqual(firstIdentity);
  });

  it("creates a new device identity when missing", () => {
    const root = createTempRoot();
    roots.push(root);

    const identity = loadOrCreateLocalOpenClawDeviceIdentity({
      env: { OPENCLAW_HOME: root } as NodeJS.ProcessEnv,
      homedir: () => "/unused",
    });

    expect(identity.deviceId).toHaveLength(64);
    expect(identity.publicKeyPem).toContain("BEGIN PUBLIC KEY");
    expect(identity.privateKeyPem).toContain("BEGIN PRIVATE KEY");
    expect(fs.existsSync(path.join(root, ".openclaw", "identity", "device.json"))).toBe(true);
  });

  it("reads, stores, and clears local device auth tokens", () => {
    const root = createTempRoot();
    roots.push(root);

    expect(
      loadLocalOpenClawDeviceAuthToken({
        env: { OPENCLAW_HOME: root } as NodeJS.ProcessEnv,
        homedir: () => "/unused",
        deviceId: "dev-1",
        role: "operator",
      }),
    ).toBeNull();

    const stored = storeLocalOpenClawDeviceAuthToken({
      env: { OPENCLAW_HOME: root } as NodeJS.ProcessEnv,
      homedir: () => "/unused",
      deviceId: "dev-1",
      role: "operator",
      token: "tok-1",
      scopes: ["operator.admin", "operator.read", "operator.read"],
    });

    expect(stored.token).toBe("tok-1");
    expect(stored.scopes).toEqual(["operator.admin", "operator.read"]);
    expect(
      loadLocalOpenClawDeviceAuthToken({
        env: { OPENCLAW_HOME: root } as NodeJS.ProcessEnv,
        homedir: () => "/unused",
        deviceId: "dev-1",
        role: "operator",
      }),
    ).toMatchObject({
      token: "tok-1",
      role: "operator",
      scopes: ["operator.admin", "operator.read"],
    });

    clearLocalOpenClawDeviceAuthToken({
      env: { OPENCLAW_HOME: root } as NodeJS.ProcessEnv,
      homedir: () => "/unused",
      deviceId: "dev-1",
      role: "operator",
    });

    expect(
      loadLocalOpenClawDeviceAuthToken({
        env: { OPENCLAW_HOME: root } as NodeJS.ProcessEnv,
        homedir: () => "/unused",
        deviceId: "dev-1",
        role: "operator",
      }),
    ).toBeNull();
  });

  it("builds and signs v3 device auth payloads", () => {
    const root = createTempRoot();
    roots.push(root);
    const identity = loadOrCreateLocalOpenClawDeviceIdentity({
      env: { OPENCLAW_HOME: root } as NodeJS.ProcessEnv,
      homedir: () => "/unused",
    });

    const payload = buildDeviceAuthPayloadV3({
      deviceId: identity.deviceId,
      clientId: "gateway-client",
      clientMode: "backend",
      role: "operator",
      scopes: ["operator.read", "operator.admin"],
      signedAtMs: 123,
      token: "shared-token",
      nonce: "nonce-1",
      platform: "darwin",
      deviceFamily: "mac",
    });
    const signature = signDevicePayload(identity.privateKeyPem, payload);
    const publicKey = publicKeyRawBase64UrlFromPem(identity.publicKeyPem);

    expect(payload).toBe(
      `v3|${identity.deviceId}|gateway-client|backend|operator|operator.read,operator.admin|123|shared-token|nonce-1|darwin|mac`,
    );
    expect(signature.length).toBeGreaterThan(20);
    expect(publicKey.length).toBeGreaterThan(20);
  });
});
