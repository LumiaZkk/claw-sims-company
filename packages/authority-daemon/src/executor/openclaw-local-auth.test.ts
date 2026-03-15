import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import {
  ensureLocalOpenClawPluginEntriesEnabled,
  readLocalCodexCredential,
  resolveLocalOpenClawGatewayToken,
  resolveOpenClawAgentDir,
  resolveOpenClawConfigPath,
  resolveOpenClawStateDir,
  syncLocalCodexAuthToAgents,
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

  it("enables workspace plugin entries inside local openclaw config", () => {
    const root = createTempRoot();
    roots.push(root);
    const stateDir = path.join(root, ".openclaw");
    fs.mkdirSync(stateDir, { recursive: true });
    fs.writeFileSync(
      path.join(stateDir, "openclaw.json"),
      JSON.stringify({
        plugins: {
          entries: {
            feishu: { enabled: true },
          },
        },
      }),
    );

    const result = ensureLocalOpenClawPluginEntriesEnabled(["sims-company"], {
      env: { OPENCLAW_HOME: root } as NodeJS.ProcessEnv,
      homedir: () => "/unused",
    });

    expect(result).toEqual({
      configPath: path.join(stateDir, "openclaw.json"),
      enabledPluginIds: ["sims-company"],
      changed: true,
    });
    expect(JSON.parse(fs.readFileSync(path.join(stateDir, "openclaw.json"), "utf8"))).toMatchObject({
      plugins: {
        entries: {
          feishu: { enabled: true },
          "sims-company": { enabled: true },
        },
      },
    });
  });

  it("creates the local openclaw config file when enabling a plugin entry from scratch", () => {
    const root = createTempRoot();
    roots.push(root);

    const result = ensureLocalOpenClawPluginEntriesEnabled(["sims-company"], {
      env: { OPENCLAW_HOME: root } as NodeJS.ProcessEnv,
      homedir: () => "/unused",
    });

    expect(result.changed).toBe(true);
    expect(JSON.parse(fs.readFileSync(path.join(root, ".openclaw", "openclaw.json"), "utf8"))).toMatchObject({
      plugins: {
        entries: {
          "sims-company": { enabled: true },
        },
      },
    });
  });

  it("does not rewrite local openclaw config when plugin entry is already enabled", () => {
    const root = createTempRoot();
    roots.push(root);
    const stateDir = path.join(root, ".openclaw");
    fs.mkdirSync(stateDir, { recursive: true });
    const configPath = path.join(stateDir, "openclaw.json");
    fs.writeFileSync(
      configPath,
      JSON.stringify({
        plugins: {
          entries: {
            "company-dispatch": {
              enabled: true,
              config: { authorityUrl: "http://127.0.0.1:19789" },
            },
          },
        },
      }),
    );
    const before = fs.readFileSync(configPath, "utf8");

    const result = ensureLocalOpenClawPluginEntriesEnabled(["sims-company"], {
      env: { OPENCLAW_HOME: root } as NodeJS.ProcessEnv,
      homedir: () => "/unused",
    });

    expect(result.changed).toBe(false);
    expect(fs.readFileSync(configPath, "utf8")).toBe(before);
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

  it("resolves per-agent dir from openclaw config overrides", () => {
    const root = createTempRoot();
    roots.push(root);
    const stateDir = path.join(root, ".openclaw");
    fs.mkdirSync(stateDir, { recursive: true });
    fs.writeFileSync(
      path.join(stateDir, "openclaw.json"),
      JSON.stringify({
        agents: {
          list: [
            { id: "main", default: true },
            { id: "company-hr", agentDir: "~/custom-agents/company-hr/agent" },
          ],
        },
      }),
    );

    expect(
      resolveOpenClawAgentDir("company-hr", {
        env: { OPENCLAW_HOME: root } as NodeJS.ProcessEnv,
        homedir: () => "/unused",
      }),
    ).toBe(path.join(root, "custom-agents", "company-hr", "agent"));
  });

  it("prefers ~/.codex/auth.json over the primary openclaw auth store", () => {
    const root = createTempRoot();
    roots.push(root);
    const stateDir = path.join(root, ".openclaw");
    const mainAgentDir = path.join(stateDir, "agents", "main", "agent");
    const codexDir = path.join(root, ".codex");
    fs.mkdirSync(mainAgentDir, { recursive: true });
    fs.mkdirSync(codexDir, { recursive: true });
    fs.writeFileSync(
      path.join(mainAgentDir, "auth-profiles.json"),
      JSON.stringify(
        {
          version: 1,
          profiles: {
            "openai-codex:default": {
              type: "oauth",
              provider: "openai-codex",
              access: "store-access",
              refresh: "store-refresh",
              expires: 123456,
              accountId: "acct-store",
              email: "store@example.com",
            },
          },
        },
        null,
        2,
      ),
    );
    fs.writeFileSync(
      path.join(codexDir, "auth.json"),
      JSON.stringify(
        {
          tokens: {
            access_token: [
              "header",
              Buffer.from(JSON.stringify({ email: "cli@example.com" })).toString("base64url"),
              "sig",
            ].join("."),
            refresh_token: "cli-refresh",
            account_id: "acct-cli",
          },
        },
        null,
        2,
      ),
    );

    expect(
      readLocalCodexCredential({
        env: { OPENCLAW_HOME: root } as NodeJS.ProcessEnv,
        homedir: () => "/unused",
      }),
    ).toMatchObject({
      refresh: "cli-refresh",
      accountId: "acct-cli",
      email: "cli@example.com",
    });
  });

  it("uses the access token exp from ~/.codex/auth.json instead of file mtime", () => {
    const root = createTempRoot();
    roots.push(root);
    const codexDir = path.join(root, ".codex");
    fs.mkdirSync(codexDir, { recursive: true });
    const exp = 1_893_456_789;
    fs.writeFileSync(
      path.join(codexDir, "auth.json"),
      JSON.stringify(
        {
          tokens: {
            access_token: [
              "header",
              Buffer.from(JSON.stringify({ exp })).toString("base64url"),
              "sig",
            ].join("."),
            refresh_token: "cli-refresh",
            account_id: "acct-cli",
          },
        },
        null,
        2,
      ),
    );

    expect(
      readLocalCodexCredential({
        env: { OPENCLAW_HOME: root } as NodeJS.ProcessEnv,
        homedir: () => "/unused",
        statMtimeMs: () => 1,
      }),
    ).toMatchObject({
      refresh: "cli-refresh",
      expires: exp * 1000,
    });
  });

  it("can prefer the primary openclaw auth store for browser OAuth sync", () => {
    const root = createTempRoot();
    roots.push(root);
    const stateDir = path.join(root, ".openclaw");
    const mainAgentDir = path.join(stateDir, "agents", "main", "agent");
    const codexDir = path.join(root, ".codex");
    fs.mkdirSync(mainAgentDir, { recursive: true });
    fs.mkdirSync(codexDir, { recursive: true });
    fs.writeFileSync(
      path.join(mainAgentDir, "auth-profiles.json"),
      JSON.stringify(
        {
          version: 1,
          profiles: {
            "openai-codex:default": {
              type: "oauth",
              provider: "openai-codex",
              access: "store-access",
              refresh: "store-refresh",
              expires: 123456,
              accountId: "acct-store",
              email: "store@example.com",
            },
          },
        },
        null,
        2,
      ),
    );
    fs.writeFileSync(
      path.join(codexDir, "auth.json"),
      JSON.stringify(
        {
          tokens: {
            access_token: [
              "header",
              Buffer.from(JSON.stringify({ email: "cli@example.com" })).toString("base64url"),
              "sig",
            ].join("."),
            refresh_token: "cli-refresh",
            account_id: "acct-cli",
          },
        },
        null,
        2,
      ),
    );

    expect(
      readLocalCodexCredential({
        env: { OPENCLAW_HOME: root } as NodeJS.ProcessEnv,
        homedir: () => "/unused",
        preferredSource: "gateway",
      }),
    ).toMatchObject({
      access: "store-access",
      refresh: "store-refresh",
      accountId: "acct-store",
      email: "store@example.com",
    });
  });

  it("prefers a future JWT exp over a stale stored expires value in the gateway auth store", () => {
    const root = createTempRoot();
    roots.push(root);
    const stateDir = path.join(root, ".openclaw");
    const mainAgentDir = path.join(stateDir, "agents", "main", "agent");
    fs.mkdirSync(mainAgentDir, { recursive: true });
    const exp = 1_893_456_790;
    fs.writeFileSync(
      path.join(mainAgentDir, "auth-profiles.json"),
      JSON.stringify(
        {
          version: 1,
          profiles: {
            "openai-codex:default": {
              type: "oauth",
              provider: "openai-codex",
              access: [
                "header",
                Buffer.from(JSON.stringify({ exp })).toString("base64url"),
                "sig",
              ].join("."),
              refresh: "store-refresh",
              expires: 123456,
              accountId: "acct-store",
            },
          },
        },
        null,
        2,
      ),
    );

    expect(
      readLocalCodexCredential({
        env: { OPENCLAW_HOME: root } as NodeJS.ProcessEnv,
        homedir: () => "/unused",
        preferredSource: "gateway",
      }),
    ).toMatchObject({
      refresh: "store-refresh",
      expires: exp * 1000,
    });
  });

  it("syncs codex auth to the main agent and clears child codex overrides", () => {
    const root = createTempRoot();
    roots.push(root);
    const stateDir = path.join(root, ".openclaw");
    const mainAgentDir = path.join(stateDir, "agents", "main", "agent");
    const hrAgentDir = path.join(stateDir, "agents", "company-hr", "agent");
    const ctoAgentDir = path.join(stateDir, "agents", "company-cto", "agent");
    const codexDir = path.join(root, ".codex");
    fs.mkdirSync(mainAgentDir, { recursive: true });
    fs.mkdirSync(hrAgentDir, { recursive: true });
    fs.mkdirSync(ctoAgentDir, { recursive: true });
    fs.mkdirSync(codexDir, { recursive: true });
    fs.writeFileSync(
      path.join(mainAgentDir, "auth-profiles.json"),
      JSON.stringify(
        {
          version: 1,
          profiles: {
            "anthropic:default": {
              type: "api_key",
              provider: "anthropic",
              key: "anthropic-secret",
            },
            "openai-codex:default": {
              type: "oauth",
              provider: "openai-codex",
              access: "fresh-access",
              refresh: "fresh-refresh",
              expires: 200000,
              accountId: "acct-fresh",
              email: "fresh@example.com",
            },
          },
        },
        null,
        2,
      ),
    );
    fs.writeFileSync(
      path.join(codexDir, "auth.json"),
      JSON.stringify(
        {
          tokens: {
            access_token: [
              "header",
              Buffer.from(JSON.stringify({ email: "cli@example.com" })).toString("base64url"),
              "sig",
            ].join("."),
            refresh_token: "cli-refresh",
            account_id: "acct-cli",
          },
        },
        null,
        2,
      ),
    );
    fs.writeFileSync(
      path.join(ctoAgentDir, "auth-profiles.json"),
      JSON.stringify(
        {
          version: 1,
          profiles: {
            "minimax:default": {
              type: "api_key",
              provider: "nvidia",
              key: "nvapi-1",
            },
            "openai-codex:default": {
              type: "oauth",
              provider: "openai-codex",
              access: "old-access",
              refresh: "old-refresh",
              expires: 100000,
            },
          },
          usageStats: {
            "openai-codex:default": {
              errorCount: 3,
              cooldownUntil: 999999,
            },
          },
          order: {
            "openai-codex": ["openai-codex:default"],
          },
        },
        null,
        2,
      ),
    );

    const result = syncLocalCodexAuthToAgents(["company-hr", "company-cto"], {
      env: { OPENCLAW_HOME: root } as NodeJS.ProcessEnv,
      homedir: () => "/unused",
      preferredSource: "cli",
    });

    expect(result).toMatchObject({
      profileId: "openai-codex:default",
      syncedAgentIds: ["company-hr", "company-cto"],
      changed: true,
      accountId: "acct-cli",
    });

    const mainStore = JSON.parse(fs.readFileSync(path.join(mainAgentDir, "auth-profiles.json"), "utf8")) as {
      profiles?: Record<string, Record<string, unknown>>;
      order?: Record<string, string[]>;
      lastGood?: Record<string, string>;
      usageStats?: Record<string, unknown>;
    };
    const ctoStore = JSON.parse(fs.readFileSync(path.join(ctoAgentDir, "auth-profiles.json"), "utf8")) as {
      profiles?: Record<string, Record<string, unknown>>;
      order?: Record<string, string[]>;
      lastGood?: Record<string, string>;
      usageStats?: Record<string, unknown>;
    };

    expect(mainStore.profiles?.["openai-codex:default"]).toMatchObject({
      refresh: "cli-refresh",
      accountId: "acct-cli",
      email: "cli@example.com",
    });
    expect(mainStore.profiles?.["anthropic:default"]).toMatchObject({
      key: "anthropic-secret",
    });
    expect(mainStore.usageStats).toBeUndefined();
    expect(mainStore.order?.["openai-codex"]?.[0]).toBe("openai-codex:default");
    expect(mainStore.lastGood?.["openai-codex"]).toBe("openai-codex:default");

    expect(fs.existsSync(path.join(hrAgentDir, "auth-profiles.json"))).toBe(false);

    expect(ctoStore.profiles?.["minimax:default"]).toMatchObject({
      key: "nvapi-1",
    });
    expect(ctoStore.profiles?.["openai-codex:default"]).toBeUndefined();
    expect(ctoStore.usageStats).toBeUndefined();
    expect(ctoStore.order).toBeUndefined();
    expect(ctoStore.lastGood).toBeUndefined();
  });

  it("skips rewrites when local codex auth is already in the target state", () => {
    const root = createTempRoot();
    roots.push(root);
    const stateDir = path.join(root, ".openclaw");
    const mainAgentDir = path.join(stateDir, "agents", "main", "agent");
    const hrAgentDir = path.join(stateDir, "agents", "company-hr", "agent");
    const codexDir = path.join(root, ".codex");
    fs.mkdirSync(mainAgentDir, { recursive: true });
    fs.mkdirSync(hrAgentDir, { recursive: true });
    fs.mkdirSync(codexDir, { recursive: true });
    const exp = 1_893_456_789;
    fs.writeFileSync(
      path.join(codexDir, "auth.json"),
      JSON.stringify(
        {
          tokens: {
            access_token: [
              "header",
              Buffer.from(JSON.stringify({ exp, email: "cli@example.com" })).toString("base64url"),
              "sig",
            ].join("."),
            refresh_token: "cli-refresh",
            account_id: "acct-cli",
          },
        },
        null,
        2,
      ),
    );

    const first = syncLocalCodexAuthToAgents(["company-hr"], {
      env: { OPENCLAW_HOME: root } as NodeJS.ProcessEnv,
      homedir: () => "/unused",
      preferredSource: "cli",
    });
    const second = syncLocalCodexAuthToAgents(["company-hr"], {
      env: { OPENCLAW_HOME: root } as NodeJS.ProcessEnv,
      homedir: () => "/unused",
      preferredSource: "cli",
    });

    expect(first.changed).toBe(true);
    expect(second).toMatchObject({
      profileId: "openai-codex:default",
      syncedAgentIds: ["company-hr"],
      changed: false,
      accountId: "acct-cli",
    });
  });
});
