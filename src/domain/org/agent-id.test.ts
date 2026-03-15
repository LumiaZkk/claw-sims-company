import { describe, expect, it } from "vitest";
import {
  buildCanonicalAgentIdMigrationMap,
  buildCompanyAgentNamespace,
  normalizeCompanyAgentId,
  rewriteKnownAgentReferences,
} from "./agent-id";

describe("agent-id", () => {
  it("normalizes canonical agent ids using the OpenClaw-compatible rules", () => {
    expect(normalizeCompanyAgentId("pdd-03361e-电商运营负责人")).toBe("pdd-03361e");
    expect(buildCompanyAgentNamespace("拼多多", "03361e5b-a043-4a1c-a9f2-bc1c009beff4")).toBe("03361e");
  });

  it("deduplicates migrated canonical ids when multiple legacy ids collapse to the same base", () => {
    const mapping = buildCanonicalAgentIdMigrationMap([
      "pdd-03361e-电商运营负责人",
      "pdd-03361e-客服主管",
      "pdd-03361e-ceo",
    ]);

    expect(mapping.get("pdd-03361e-电商运营负责人")).toBe("pdd-03361e");
    expect(mapping.get("pdd-03361e-客服主管")).toBe("pdd-03361e-2");
    expect(mapping.get("pdd-03361e-ceo")).toBe("pdd-03361e-ceo");
  });

  it("rewrites known agent references and session keys", () => {
    const mapping = buildCanonicalAgentIdMigrationMap([
      "pdd-03361e-电商运营负责人",
      "pdd-03361e-ceo",
    ]);
    const canonicalIds = new Set(mapping.values());
    const payload = rewriteKnownAgentReferences(
      {
        agentId: "pdd-03361e-电商运营负责人",
        reportsTo: "pdd-03361e-ceo",
        sessionKey: "agent:pdd-03361e-电商运营负责人:main",
        pendingAgentIds: ["pdd-03361e-电商运营负责人"],
      },
      {
        exactMap: mapping,
        canonicalIds,
      },
    );

    expect(payload).toEqual({
      agentId: "pdd-03361e",
      reportsTo: "pdd-03361e-ceo",
      sessionKey: "agent:pdd-03361e:main",
      pendingAgentIds: ["pdd-03361e"],
    });
  });
});
