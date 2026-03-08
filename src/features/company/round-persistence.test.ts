import { describe, expect, it } from "vitest";
import { sanitizeRoundRecords } from "./round-persistence";
import type { RoundRecord } from "./types";

function createRound(overrides: Partial<RoundRecord> = {}): RoundRecord {
  return {
    id: "round:ceo:1",
    companyId: "novel-studio-001",
    title: "CEO 历史轮次",
    preview: "上一轮摘要",
    sourceActorId: null,
    sourceActorLabel: "CEO",
    sourceSessionKey: "agent:co-ceo:main",
    sourceConversationId: null,
    messages: [],
    archivedAt: 1_000,
    restorable: true,
    ...overrides,
  };
}

describe("sanitizeRoundRecords", () => {
  it("derives sourceActorId from legacy session fields during migration so old archives remain attributable", () => {
    const [round] = sanitizeRoundRecords([
      createRound({
        sourceActorId: null,
        sourceSessionKey: "agent:co-cto:main",
      }),
    ]);

    expect(round?.sourceActorId).toBe("co-cto");
  });
});
