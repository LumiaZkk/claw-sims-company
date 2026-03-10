import { describe, expect, it } from "vitest";
import { buildCodexSessionReapplyPlan, isCodexModelRef } from "./codex-runtime";

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
