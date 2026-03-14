import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { RequirementAcceptancePanel } from "./RequirementAcceptancePanel";
import type { RequirementCloseoutReport } from "../../../application/mission/requirement-closeout-report";
import { buildRequirementAcceptanceGate } from "../../../application/mission/requirement-acceptance-gate";

function createCloseoutReport(
  overrides: Partial<RequirementCloseoutReport> = {},
): RequirementCloseoutReport {
  return {
    requirementId: "requirement-1",
    requirementRevision: 3,
    status: "warning",
    updatedAt: 12_000,
    deliverableCount: 2,
    traceabilityCount: 3,
    blockingReasons: [],
    advisoryReasons: ["验收依据：当前已有交付物，但还缺少报告/知识型验收依据。"],
    checks: [
      {
        id: "deliverables",
        label: "交付物摘要",
        status: "ready",
        summary: "当前主线已收敛出 2 份交付物镜像。",
        detail: "Requirement Center 可以直接看到最近的正式文件、报告或知识产物。",
      },
    ],
    deliverableHighlights: [
      {
        key: "file-1",
        title: "novel-outline.md",
        path: "/workspace/novel-outline.md",
        kind: "chapter",
        updatedAt: 12_000,
      },
    ],
    acceptanceEvidenceHighlights: [],
    consistencySummary: {
      status: "warning",
      summary: "当前还缺少显式规则校验结果，锚点覆盖 2/4。",
      detail: "建议先补齐时间线、伏笔追踪，并至少生成一次一致性/预检报告，再决定是否正式通过。",
      updatedAt: null,
      anchorReadyCount: 2,
      anchorTotalCount: 4,
      missingAnchors: ["时间线", "伏笔追踪"],
      reportHighlights: [],
    },
    knowledgeSummary: {
      status: "ready",
      summary: "当前已沉淀 1 条知识/验收摘要，其中 1 条已进入默认可用上下文。",
      detail: "你可以先核对自动沉淀出的知识摘要，再决定是否直接通过或退回修改。",
      updatedAt: 12_000,
      itemCount: 1,
      acceptedCount: 1,
      highlights: [
        {
          key: "knowledge-1",
          title: "章节验收总结",
          kindLabel: "最终汇总",
          summary: "自动沉淀出当前章节的验收要点。",
          sourcePath: "/workspace/acceptance-summary.md",
          updatedAt: 12_000,
        },
      ],
    },
    workspaceCloseoutSummary: {
      status: "warning",
      title: "Workspace 仍有待补齐项",
      summary: "仍有 1 项平台 closeout 待补齐。",
      detail: "仍有平台 closeout 项待处理。",
      totals: { ready: 1, attention: 1, missing: 0 },
      checks: [],
    } as any,
    ...overrides,
  };
}

describe("RequirementAcceptancePanel", () => {
  it("renders deliverables and evidence guidance from the closeout report", () => {
    const html = renderToStaticMarkup(
      <RequirementAcceptancePanel
        statusClassName="border-amber-200"
        productStatusLabel="待你验收"
        productStatusDescription="请核对当前交付是否满足预期。"
        acceptanceNote="待你验收"
        closeoutReport={createCloseoutReport()}
        acceptanceGate={buildRequirementAcceptanceGate({
          aggregate: {
            id: "requirement-1",
            acceptanceStatus: "pending",
            status: "waiting_review",
          } as any,
          closeoutReport: createCloseoutReport(),
        })}
        acceptanceSubmitting={null}
        canRequestAcceptance
        canRequestChange
        canAccept
        canContinueModify
        canRejectReopen
        onRunAcceptanceAction={() => undefined}
      />,
    );

    expect(html).toContain("最近交付物");
    expect(html).toContain("novel-outline.md");
    expect(html).toContain("验收依据");
    expect(html).toContain("还没有独立的知识页或报告型验收依据");
    expect(html).toContain("正式通过条件");
    expect(html).toContain("可继续但需确认");
    expect(html).toContain("规则校验结果");
    expect(html).toContain("时间线、伏笔追踪");
    expect(html).toContain("知识与验收摘要");
    expect(html).toContain("章节验收总结");
  });

  it("surfaces blocking reasons when closeout is blocked", () => {
    const html = renderToStaticMarkup(
      <RequirementAcceptancePanel
        statusClassName="border-rose-200"
        productStatusLabel="执行中"
        productStatusDescription="当前还有阻塞项。"
        closeoutReport={createCloseoutReport({
          status: "blocked",
          blockingReasons: ["交付物摘要：当前主线还没有稳定的交付物镜像。"],
          advisoryReasons: [],
        })}
        acceptanceGate={buildRequirementAcceptanceGate({
          aggregate: {
            id: "requirement-1",
            acceptanceStatus: "not_requested",
            status: "active",
          } as any,
          closeoutReport: createCloseoutReport({
            status: "blocked",
            blockingReasons: ["交付物摘要：当前主线还没有稳定的交付物镜像。"],
            advisoryReasons: [],
          }),
        })}
        acceptanceSubmitting={null}
        canRequestAcceptance={false}
        canRequestChange
        canAccept={false}
        canContinueModify
        canRejectReopen
        onRunAcceptanceAction={() => undefined}
      />,
    );

    expect(html).toContain("当前阻塞");
    expect(html).toContain("当前主线还没有稳定的交付物镜像");
    expect(html).toContain("发起验收条件");
    expect(html).toContain("未满足");
  });
});
