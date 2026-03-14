import { afterEach, describe, expect, it, vi } from "vitest";
import { authorityClient } from "../../authority/client";
import { authorityBackend, resolveAuthorityBackendCapabilities } from "./adapter";

afterEach(() => {
  vi.restoreAllMocks();
});

describe("authority backend adapter capability snapshot", () => {
  it("keeps optimistic authority defaults before executor capability is known", () => {
    const capabilities = resolveAuthorityBackendCapabilities(null);

    expect(capabilities.sessionStatus).toBe(true);
    expect(capabilities.processRuntime).toBe(false);
    expect(capabilities.agentFiles).toBe(true);
    expect(capabilities.agentModelOverride).toBe(true);
    expect(capabilities.agentSkillsOverride).toBe(true);
  });

  it("disables session status when authority reports unsupported executor capability", () => {
    const capabilities = resolveAuthorityBackendCapabilities({
      sessionStatus: "unsupported",
      processRuntime: "unsupported",
      notes: [
        "下游执行器不提供 session_status，Authority 会退回 lifecycle/chat 驱动的运行态修复。",
      ],
    });

    expect(capabilities.sessionStatus).toBe(false);
    expect(capabilities.processRuntime).toBe(false);
    expect(capabilities.runtimeObservability).toBe(true);
  });

  it("re-enables session status once authority confirms native support", () => {
    const capabilities = resolveAuthorityBackendCapabilities({
      sessionStatus: "supported",
      processRuntime: "unsupported",
      notes: [],
    });

    expect(capabilities.sessionStatus).toBe(true);
    expect(capabilities.processRuntime).toBe(false);
  });
});

describe("authority backend adapter agent controls", () => {
  it("reads agent model settings from proxied gateway config", async () => {
    vi.spyOn(authorityClient, "requestGateway").mockImplementation(async (method) => {
      if (method === "config.get") {
        return {
          path: "/tmp/config.json",
          exists: true,
          valid: true,
          hash: "hash-1",
          config: {
            agents: {
              defaults: {
                model: "openai-codex/gpt-5-codex",
                skills: ["core"],
              },
              list: [
                {
                  id: "cto",
                  model: "openai-codex/gpt-5-codex",
                  skills: ["code"],
                },
              ],
            },
          },
        };
      }
      throw new Error(`unexpected method: ${method}`);
    });

    await expect(authorityBackend.getAgentControlSnapshot("cto")).resolves.toMatchObject({
      agentId: "cto",
      defaultModel: "openai-codex/gpt-5-codex",
      defaultSkills: ["core"],
      modelOverride: "openai-codex/gpt-5-codex",
      skillsOverride: ["code"],
    });
  });

  it("updates agent model overrides through proxied gateway methods", async () => {
    const requestGateway = vi.spyOn(authorityClient, "requestGateway").mockImplementation(async (method, params) => {
      if (method === "config.get") {
        return {
          path: "/tmp/config.json",
          exists: true,
          valid: true,
          hash: "hash-1",
          config: {
            agents: {
              defaults: {
                model: "openai-codex/gpt-5-codex",
              },
              list: [
                {
                  id: "cto",
                },
              ],
            },
          },
        };
      }
      if (method === "agents.update") {
        expect(params).toMatchObject({
          agentId: "cto",
          model: "openai-codex/gpt-5-codex",
        });
        return { ok: true, agentId: "cto" };
      }
      throw new Error(`unexpected method: ${method}`);
    });

    await expect(
      authorityBackend.setAgentModelOverride("cto", "openai-codex/gpt-5-codex"),
    ).resolves.toMatchObject({
      updated: true,
      modelOverride: "openai-codex/gpt-5-codex",
    });

    expect(requestGateway).toHaveBeenCalledWith("agents.update", {
      agentId: "cto",
      model: "openai-codex/gpt-5-codex",
    });
  });
});
