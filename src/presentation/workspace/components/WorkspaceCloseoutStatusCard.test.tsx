import { describe, expect, it, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { WorkspaceCloseoutStatusCard } from "./WorkspaceCloseoutStatusCard";
import type { CapabilityPlatformCloseoutSummary } from "../../../application/workspace";
import type { SkillDefinition } from "../../../domain/org/types";

const closeoutSummary: CapabilityPlatformCloseoutSummary = {
  totals: {
    ready: 1,
    in_progress: 2,
    attention: 1,
  },
  checks: [
    {
      id: "app-manifest-coverage",
      label: "App 契约覆盖",
      status: "in_progress",
      summary: "1/2 个公司 App 已接入显式 AppManifest。",
      detail: "仍有一部分 App 没接入正式 manifest，当前只能算部分收口。",
      nextStep: "优先补齐 Reader 的正式 manifest。",
    },
    {
      id: "capability-validation",
      label: "能力验证与发布",
      status: "attention",
      summary: "0/1 条能力已有成功验证。",
      detail: "仍有能力缺少成功验证或发布条件，正式依赖前需要继续补齐。",
      nextStep: "先运行一次成功的能力验证，再继续发布为可用。",
    },
  ],
};

const firstSkillNeedingValidation: Pick<SkillDefinition, "id" | "title"> = {
  id: "skill-reader-index",
  title: "重建阅读索引",
};

describe("WorkspaceCloseoutStatusCard", () => {
  it("renders closeout totals and actionable next steps", () => {
    const html = renderToStaticMarkup(
      <WorkspaceCloseoutStatusCard
        closeoutSummary={closeoutSummary}
        firstAppWithoutManifest={{ id: "app-reader", title: "Reader" }}
        skillDefinitions={[{ id: "skill-reader-index", title: "重建阅读索引" } as SkillDefinition]}
        firstSkillNeedingValidation={firstSkillNeedingValidation}
        preferredDraftTool="novel-reader"
        onRetryCompanyProvisioning={vi.fn()}
        onGenerateAppManifestDraft={vi.fn()}
        onCreateSkillDraft={vi.fn()}
        onRunSkillSmokeTest={vi.fn()}
      />,
    );

    expect(html).toContain("中台收口状态");
    expect(html).toContain("已收口 1");
    expect(html).toContain("推进中 2");
    expect(html).toContain("待补齐 1");
    expect(html).toContain("先补 Reader 的 AppManifest");
    expect(html).toContain("先验证 重建阅读索引");
  });

  it("falls back to draft guidance when no skill exists yet", () => {
    const html = renderToStaticMarkup(
      <WorkspaceCloseoutStatusCard
        closeoutSummary={{
          ...closeoutSummary,
          checks: [closeoutSummary.checks[1]],
        }}
        firstAppWithoutManifest={null}
        skillDefinitions={[]}
        firstSkillNeedingValidation={null}
        preferredDraftTool="consistency-checker"
        onRetryCompanyProvisioning={vi.fn()}
        onGenerateAppManifestDraft={vi.fn()}
        onCreateSkillDraft={vi.fn()}
        onRunSkillSmokeTest={vi.fn()}
      />,
    );

    expect(html).toContain("登记首条能力草稿");
  });
});
