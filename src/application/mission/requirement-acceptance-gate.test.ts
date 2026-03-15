import { describe, expect, it } from "vitest";
import { buildRequirementAcceptanceGate } from "./requirement-acceptance-gate";
import type { RequirementCloseoutReport } from "./requirement-closeout-report";
import type { CapabilityPlatformCloseoutSummary } from "../workspace";
import type { RequirementAggregateRecord } from "../../domain/mission/types";

function createCloseoutReport(
  overrides: Partial<RequirementCloseoutReport> = {},
): RequirementCloseoutReport {
  return {
    requirementId: "requirement-1",
    requirementRevision: 2,
    status: "ready",
    updatedAt: 12_000,
    deliverableCount: 2,
    traceabilityCount: 3,
    blockingReasons: [],
    advisoryReasons: [],
    checks: [],
    deliverableHighlights: [],
    acceptanceEvidenceHighlights: [],
    consistencySummary: {
      status: "ready",
      summary: "最近已有 1 份规则/校验结果可回看，锚点覆盖 4/4。",
      detail: "唯一真相源和最近一次规则检查结果都已经可见，可以直接作为验收前校对依据。",
      updatedAt: 12_000,
      anchorReadyCount: 4,
      anchorTotalCount: 4,
      missingAnchors: [],
      reportHighlights: [],
    },
    knowledgeSummary: {
      status: "ready",
      summary: "当前已沉淀 1 条知识/验收摘要，其中 1 条已进入默认可用上下文。",
      detail: "你可以先核对自动沉淀出的知识摘要，再决定是否直接通过或退回修改。",
      updatedAt: 12_000,
      itemCount: 1,
      acceptedCount: 1,
      highlights: [],
    },
    workspaceCloseoutSummary: {
      status: "ready",
      title: "Workspace closeout 已满足",
      summary: "没有待补齐项",
      detail: "可以继续验收。",
      totals: { ready: 3, attention: 0, missing: 0 },
      checks: [],
    } as CapabilityPlatformCloseoutSummary,
    ...overrides,
  };
}

describe("buildRequirementAcceptanceGate", () => {
  it("blocks request acceptance when execution has not entered review", () => {
    const gate = buildRequirementAcceptanceGate({
      aggregate: {
        id: "requirement-1",
        status: "active",
        acceptanceStatus: "not_requested",
      } as RequirementAggregateRecord,
      closeoutReport: createCloseoutReport(),
    });

    expect(gate.request.enabled).toBe(false);
    expect(gate.request.tone).toBe("blocked");
    expect(gate.request.summary).toContain("待你验收");
  });

  it("allows acceptance with warnings when only advisory closeout items remain", () => {
    const gate = buildRequirementAcceptanceGate({
      aggregate: {
        id: "requirement-1",
        status: "waiting_review",
        acceptanceStatus: "pending",
      } as RequirementAggregateRecord,
      closeoutReport: createCloseoutReport({
        status: "warning",
        advisoryReasons: ["验收依据：当前已有交付物，但还缺少报告/知识型验收依据。"],
      }),
    });

    expect(gate.accept.enabled).toBe(true);
    expect(gate.accept.tone).toBe("warning");
    expect(gate.accept.reasons).toEqual(
      expect.arrayContaining([expect.stringContaining("验收依据")]),
    );
  });

  it("blocks direct acceptance when closeout still has hard blockers", () => {
    const gate = buildRequirementAcceptanceGate({
      aggregate: {
        id: "requirement-1",
        status: "waiting_review",
        acceptanceStatus: "pending",
      } as RequirementAggregateRecord,
      closeoutReport: createCloseoutReport({
        status: "blocked",
        blockingReasons: ["交付物摘要：当前主线还没有稳定的交付物镜像。"],
      }),
    });

    expect(gate.accept.enabled).toBe(false);
    expect(gate.accept.reasons[0]).toContain("交付物摘要");
  });
});
