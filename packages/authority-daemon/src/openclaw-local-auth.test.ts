import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import {
  resolveLocalOpenClawGatewayToken,
  resolveOpenClawConfigPath,
  resolveOpenClawStateDir,
} from "./openclaw-local-auth";

function createTempRoot() {
  return fs.mkdtempSync(path.join(os.tmpdir(), "authority-openclaw-auth-"));
}

describe("openclaw-local-auth", () => {
  const roots: string[] = [];

  afterEach(() => {
    for (const root of roots.splice(0)) {
      fs.rmSync(root, { recursive: true, force: true });
    }
  });

  it("resolves the config path from OPENCLAW_HOME", () => {
    const root = createTempRoot();
    roots.push(root);
    const env = { OPENCLAW_HOME: root } as NodeJS.ProcessEnv;

    expect(resolveOpenClawStateDir(env, () => "/unused")).toBe(path.join(root, ".openclaw"));
    expect(resolveOpenClawConfigPath(env, () => "/unused")).toBe(
      path.join(root, ".openclaw", "openclaw.json"),
    );
  });

  it("reads a direct gateway auth token from config", () => {
    const root = createTempRoot();
    roots.push(root);
    const stateDir = path.join(root, ".openclaw");
    fs.mkdirSync(stateDir, { recursive: true });
    fs.writeFileSync(
      path.join(stateDir, "openclaw.json"),
      JSON.stringify({
        gateway: {
          auth: {
            mode: "token",
            token: "config-token",
          },
        },
      }),
    );

    expect(
      resolveLocalOpenClawGatewayToken({
        env: { OPENCLAW_HOME: root } as NodeJS.ProcessEnv,
        homedir: () => "/unused",
      }),
    ).toBe("config-token");
  });

  it("resolves env-template tokens from the local .env file", () => {
    const root = createTempRoot();
    roots.push(root);
    const stateDir = path.join(root, ".openclaw");
    fs.mkdirSync(stateDir, { recursive: true });
    fs.writeFileSync(
      path.join(stateDir, "openclaw.json"),
      JSON.stringify({
        gateway: {
          auth: {
            mode: "token",
            token: "${OPENCLAW_GATEWAY_TOKEN}",
          },
        },
      }),
    );
    fs.writeFileSync(path.join(stateDir, ".env"), "OPENCLAW_GATEWAY_TOKEN=env-file-token\n");

    expect(
      resolveLocalOpenClawGatewayToken({
        env: { OPENCLAW_HOME: root } as NodeJS.ProcessEnv,
        homedir: () => "/unused",
      }),
    ).toBe("env-file-token");
  });

  it("falls back to env token when config is absent", () => {
    const root = createTempRoot();
    roots.push(root);

    expect(
      resolveLocalOpenClawGatewayToken({
        env: {
          OPENCLAW_HOME: root,
          OPENCLAW_GATEWAY_TOKEN: "shell-token",
        } as NodeJS.ProcessEnv,
        homedir: () => "/unused",
      }),
    ).toBe("shell-token");
  });

  it("does not return a token when local gateway auth is password mode", () => {
    const root = createTempRoot();
    roots.push(root);
    const stateDir = path.join(root, ".openclaw");
    fs.mkdirSync(stateDir, { recursive: true });
    fs.writeFileSync(
      path.join(stateDir, "openclaw.json"),
      JSON.stringify({
        gateway: {
          auth: {
            mode: "password",
            token: "ignored-token",
          },
        },
      }),
    );

    expect(
      resolveLocalOpenClawGatewayToken({
        env: {
          OPENCLAW_HOME: root,
          OPENCLAW_GATEWAY_TOKEN: "shell-token",
        } as NodeJS.ProcessEnv,
        homedir: () => "/unused",
      }),
    ).toBeUndefined();
  });
});
