import { afterEach, describe, expect, it, vi } from "vitest";
import {
  buildCodexSessionReapplyPlan,
  countCodexSessionReapplySuccesses,
  collectCodexAuthTargetAgentIds,
  formatCodexAccountChangeDescription,
  formatCodexAuthCompletionDescription,
  isCodexModelRef,
} from "./codex-runtime";

describe("isCodexModelRef", () => {
  it("matches OpenAI Codex model refs", () => {
    expect(isCodexModelRef("openai-codex/gpt-5-codex")).toBe(true);
    expect(isCodexModelRef(" openai-codex/gpt-5-codex ")).toBe(true);
  });

  it("rejects non-codex refs", () => {
    expect(isCodexModelRef("kimi/k2")).toBe(false);
    expect(isCodexModelRef("openai/gpt-5")).toBe(false);
    expect(isCodexModelRef(null)).toBe(false);
  });
});

describe("countCodexSessionReapplySuccesses", () => {
  it("only counts sessions whose active model really switched back to Codex", () => {
    expect(
      countCodexSessionReapplySuccesses({
        plan: [
          { actorId: "writer-01", model: "openai-codex/gpt-5.4", sessionKey: "agent:writer-01:main" },
          { actorId: "writer-02", model: "openai-codex/gpt-5.4", sessionKey: "agent:writer-02:main" },
        ],
        sessions: [
          { key: "agent:writer-01:main", modelProvider: "openai-codex", model: "gpt-5.4" },
          { key: "agent:writer-02:main", modelProvider: "bailian", model: "kimi-k2.5" },
        ],
      }),
    ).toBe(1);
  });
});

describe("buildCodexSessionReapplyPlan", () => {
  it("selects sessions whose effective model inherits Codex from defaults", () => {
    const plan = buildCodexSessionReapplyPlan({
      sessions: [
        { key: "agent:ceo:main", actorId: "ceo" },
        { key: "agent:hr:main", actorId: "hr" },
      ],
      controlSnapshots: {
        ceo: { defaultModel: "openai-codex/gpt-5-codex", modelOverride: null },
        hr: { defaultModel: "kimi/k2", modelOverride: null },
      },
    });

    expect(plan).toEqual([
      {
        actorId: "ceo",
        model: "openai-codex/gpt-5-codex",
        sessionKey: "agent:ceo:main",
      },
    ]);
  });

  it("prefers model override and skips duplicate session keys", () => {
    const plan = buildCodexSessionReapplyPlan({
      sessions: [
        { key: "agent:cto:main", actorId: "cto" },
        { key: "agent:cto:main", actorId: "cto" },
        { key: "agent:coo:main", actorId: "coo" },
      ],
      controlSnapshots: {
        cto: { defaultModel: "kimi/k2", modelOverride: "openai-codex/gpt-5-codex" },
        coo: { defaultModel: "openai-codex/gpt-5-codex", modelOverride: "kimi/k2" },
      },
    });

    expect(plan).toEqual([
      {
        actorId: "cto",
        model: "openai-codex/gpt-5-codex",
        sessionKey: "agent:cto:main",
      },
    ]);
  });
});

describe("collectCodexAuthTargetAgentIds", () => {
  it("returns unique non-empty employee agent ids", () => {
    expect(
      collectCodexAuthTargetAgentIds({
        employees: [
          { agentId: "z1-8776e4-hr" },
          { agentId: " z1-8776e4-cto " },
          { agentId: "z1-8776e4-hr" },
          { agentId: "" },
          null,
        ],
      }),
    ).toEqual(["z1-8776e4-hr", "z1-8776e4-cto"]);
  });
});

describe("formatCodexAccountChangeDescription", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("describes the first remembered account", () => {
    const storage = new Map<string, string>();
    vi.stubGlobal("localStorage", {
      getItem: (key: string) => storage.get(key) ?? null,
      setItem: (key: string, value: string) => storage.set(key, value),
    });

    expect(formatCodexAccountChangeDescription("60890c2d-9c67-4737-a151-f82b6e10382c")).toBe(
      "当前 OpenAI account 为 60890c2d...382c。",
    );
  });

  it("warns when oauth completes with the same account again", () => {
    const storage = new Map<string, string>([
      ["cyber-company.codex.last-account-id", "60890c2d-9c67-4737-a151-f82b6e10382c"],
    ]);
    vi.stubGlobal("localStorage", {
      getItem: (key: string) => storage.get(key) ?? null,
      setItem: (key: string, value: string) => storage.set(key, value),
    });

    expect(formatCodexAccountChangeDescription("60890c2d-9c67-4737-a151-f82b6e10382c")).toBe(
      "OpenAI account 未切换，仍为 60890c2d...382c。",
    );
  });

  it("reports when oauth switches to a different account", () => {
    const storage = new Map<string, string>([
      ["cyber-company.codex.last-account-id", "11111111-2222-3333-4444-555555555555"],
    ]);
    vi.stubGlobal("localStorage", {
      getItem: (key: string) => storage.get(key) ?? null,
      setItem: (key: string, value: string) => storage.set(key, value),
    });

    expect(formatCodexAccountChangeDescription("60890c2d-9c67-4737-a151-f82b6e10382c")).toBe(
      "OpenAI account 已切换为 60890c2d...382c（之前为 11111111...5555）。",
    );
  });
});

describe("formatCodexAuthCompletionDescription", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("includes account and reapply details in one message", () => {
    const storage = new Map<string, string>();
    vi.stubGlobal("localStorage", {
      getItem: (key: string) => storage.get(key) ?? null,
      setItem: (key: string, value: string) => storage.set(key, value),
    });

    expect(
      formatCodexAuthCompletionDescription({
        accountId: "60890c2d-9c67-4737-a151-f82b6e10382c",
        codexCount: 8,
        profileId: "openai-codex:default",
        reapplyResult: { failed: 0, matched: 2, reapplied: 2 },
      }),
    ).toBe(
      "已导入 openai-codex:default，当前发现 8 个 Codex 模型。当前 OpenAI account 为 60890c2d...382c。已完成 2 个活动会话的 Codex 模型重绑。",
    );
  });
});
