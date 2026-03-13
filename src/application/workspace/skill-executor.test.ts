import { describe, expect, it } from "vitest";
import type { Company, CompanyWorkspaceApp, SkillDefinition } from "../../domain/org/types";
import type { ArtifactResourceType } from "../../domain/artifact/types";
import type { WorkspaceAppManifest } from "./app-manifest";
import { executeWorkspaceSkill, listRegisteredSkillExecutionAdapters } from "./skill-executor";

function createCompany(): Company {
  return {
    id: "company-1",
    name: "小说公司",
    description: "测试用小说公司",
    icon: "🏢",
    template: "novel",
    createdAt: 1,
    employees: [
      {
        agentId: "cto-1",
        nickname: "CTO",
        role: "CTO",
        isMeta: true,
        metaRole: "cto",
      },
    ],
    quickPrompts: [],
    workspaceApps: [
      {
        id: "app:reader",
        slug: "reader",
        title: "小说阅读器",
        description: "阅读器",
        icon: "📖",
        kind: "custom",
        status: "ready",
        template: "reader",
        surface: "template",
      },
    ],
  };
}

function createGenericCompany(): Company {
  return {
    id: "company-2",
    name: "游戏公司",
    description: "测试用游戏公司",
    icon: "🎮",
    template: "generic",
    createdAt: 1,
    employees: [
      {
        agentId: "cto-1",
        nickname: "CTO",
        role: "CTO",
        isMeta: true,
        metaRole: "cto",
      },
    ],
    quickPrompts: [],
  };
}

function createSkill(
  id: string,
  title: string,
  writesResourceTypes: ArtifactResourceType[],
  entryPath =
    id === "reader.build-index"
      ? "scripts/build-reader-index.ts"
      : id === "consistency.check"
        ? "scripts/run-consistency-check.ts"
        : id === "review.precheck"
          ? "scripts/run-review-precheck.ts"
          : `scripts/${id}.ts`,
): SkillDefinition {
  return {
    id,
    title,
    summary: title,
    ownerAgentId: "cto-1",
    status: "ready",
    entryPath,
    writesResourceTypes,
    allowedTriggers: ["app_action"],
    createdAt: 1,
    updatedAt: 1,
  };
}

const readerApp: CompanyWorkspaceApp = {
  id: "app:reader",
  slug: "reader",
  title: "小说阅读器",
  description: "阅读器",
  icon: "📖",
  kind: "custom",
  status: "ready",
  template: "reader",
  surface: "template",
};

const genericReaderApp: CompanyWorkspaceApp = {
  id: "app:reader-generic",
  slug: "reader",
  title: "内容查看器",
  description: "查看器",
  icon: "📖",
  kind: "custom",
  status: "ready",
  template: "reader",
  surface: "template",
};

describe("executeWorkspaceSkill", () => {
  it("lists registered platform adapters for closeout review", () => {
    expect(listRegisteredSkillExecutionAdapters()).toEqual([
      {
        entryPath: "scripts/build-reader-index.ts",
        title: "内容索引适配器",
        summary: "把显式资源聚合成稳定的 AppManifest，供查看器或阅读器消费。",
      },
      {
        entryPath: "scripts/run-consistency-check.ts",
        title: "规则校验适配器",
        summary: "围绕显式真相源输出结构化一致性/规则检查报告。",
      },
      {
        entryPath: "scripts/run-review-precheck.ts",
        title: "交付预检适配器",
        summary: "根据显式资源与 AppManifest 产出发布前检查结论。",
      },
    ]);
  });

  it("builds a stable app manifest artifact for reader index skills", () => {
    const result = executeWorkspaceSkill({
      company: createCompany(),
      skill: createSkill("reader.build-index", "重建阅读索引", ["document", "report"]),
      app: readerApp,
      manifest: null,
      files: [
        {
          key: "chapter-1",
          artifactId: "chapter-1",
          name: "第1章.md",
          path: "chapters/chapter-1.md",
          resourceType: "document",
          tags: ["story.chapter", "company.resource"],
          resourceOrigin: "declared",
        },
        {
          key: "canon-1",
          artifactId: "canon-1",
          name: "人物设定.md",
          path: "docs/canon.md",
          resourceType: "document",
          tags: ["story.canon", "company.resource"],
          resourceOrigin: "declared",
        },
      ],
      workItemId: "work-1",
      now: 100,
    });

    expect(result.artifacts).toHaveLength(1);
    expect(result.artifacts[0]?.kind).toBe("app_manifest");
    expect(result.artifacts[0]?.id).toBe("workspace-app-manifest:company-1:app:reader");
    expect(result.artifacts[0]?.content).toContain('"draft": false');
    expect(result.nextApps?.[0]?.manifestArtifactId).toBe("workspace-app-manifest:company-1:app:reader");
  });

  it("writes consistency checks back as reviewable report resources", () => {
    const result = executeWorkspaceSkill({
      company: createCompany(),
      skill: createSkill("consistency.check", "执行一致性检查", ["report"]),
      app: null,
      manifest: null,
      files: [
        {
          key: "chapter-1",
          artifactId: "chapter-1",
          name: "第1章.md",
          path: "chapters/chapter-1.md",
          resourceType: "document",
          tags: ["story.chapter", "company.resource"],
          resourceOrigin: "declared",
        },
        {
          key: "canon-1",
          artifactId: "canon-1",
          name: "共享设定.md",
          path: "docs/canon.md",
          resourceType: "document",
          tags: ["story.canon", "company.resource"],
          resourceOrigin: "declared",
        },
      ],
      now: 200,
    });

    expect(result.artifacts[0]?.kind).toBe("consistency_report");
    expect(result.artifacts[0]?.resourceType).toBe("report");
    expect(result.artifacts[0]?.resourceTags).toContain("company.resource");
    expect(result.artifacts[0]?.resourceTags).toContain("qa.report");
    expect(result.artifacts[0]?.sourcePath).toBe("skill-results/consistency.check/200.md");
    expect(result.artifacts[0]?.content).toContain("一致性检查报告");
  });

  it("dispatches built-in adapters strictly by entryPath", () => {
    const result = executeWorkspaceSkill({
      company: createCompany(),
      skill: createSkill("reader.custom-index", "重建阅读索引", ["document", "report"], "scripts/build-reader-index.ts"),
      app: readerApp,
      manifest: null,
      files: [
        {
          key: "chapter-1",
          artifactId: "chapter-1",
          name: "第1章.md",
          path: "chapters/chapter-1.md",
          resourceType: "document",
          tags: ["story.chapter", "company.resource"],
          resourceOrigin: "declared",
        },
        {
          key: "canon-1",
          artifactId: "canon-1",
          name: "人物设定.md",
          path: "docs/canon.md",
          resourceType: "document",
          tags: ["story.canon", "company.resource"],
          resourceOrigin: "declared",
        },
      ],
      now: 250,
    });

    expect(result.artifacts[0]?.kind).toBe("app_manifest");
    expect(result.successTitle).toBe("已重建阅读器 AppManifest");
  });

  it("throws instead of fabricating a generic success when no adapter is registered", () => {
    expect(() =>
      executeWorkspaceSkill({
        company: createCompany(),
        skill: createSkill("custom.unimplemented", "未接执行器的能力", ["state"], "scripts/custom-unimplemented.ts"),
        app: null,
        manifest: null,
        files: [],
        now: 260,
      }),
    ).toThrow(/没有已注册的能力适配器/);
  });

  it("marks review precheck blockers when manifest or source material is missing", () => {
    const manifest: WorkspaceAppManifest = {
      version: 1,
      appId: "app:reader",
      appSlug: "reader",
      title: "小说阅读器",
      sections: [],
    };
    const result = executeWorkspaceSkill({
      company: createCompany(),
      skill: createSkill("review.precheck", "执行发布前检查", ["report"]),
      app: null,
      manifest,
      files: [],
      now: 300,
    });

    expect(result.artifacts[0]?.kind).toBe("review_precheck");
    expect(result.artifacts[0]?.summary).toContain("阻塞项");
    expect(result.artifacts[0]?.content).toContain("缺少可交付主体内容");
    expect(result.artifacts[0]?.content).toContain("缺少关键参考资料/真相源");
  });

  it("supports generic resource tags outside the novel scenario", () => {
    const result = executeWorkspaceSkill({
      company: createGenericCompany(),
      skill: createSkill("review.precheck", "执行发布前检查", ["report"]),
      app: null,
      manifest: null,
      files: [
        {
          key: "content-1",
          artifactId: "content-1",
          name: "content/level-overview.md",
          path: "content/level-overview.md",
          resourceType: "document",
          tags: ["content.primary", "company.resource"],
          resourceOrigin: "declared",
        },
        {
          key: "reference-1",
          artifactId: "reference-1",
          name: "docs/simulation-guide.md",
          path: "docs/simulation-guide.md",
          resourceType: "document",
          tags: ["domain.reference", "company.resource"],
          resourceOrigin: "declared",
        },
      ],
      now: 400,
    });

    expect(result.artifacts[0]?.content).toContain("主体内容：1 份");
    expect(result.artifacts[0]?.content).toContain("参考资料：1 份");
    expect(result.artifacts[0]?.summary).toContain("阻塞项");
  });

  it("uses explicit resource tags instead of app title heuristics when building reports", () => {
    const result = executeWorkspaceSkill({
      company: createGenericCompany(),
      skill: createSkill("review.precheck", "执行发布前检查", ["report"]),
      app: {
        ...genericReaderApp,
        title: "章节模拟台",
        slug: "chapter-simulator",
      },
      manifest: null,
      files: [
        {
          key: "content-1",
          artifactId: "content-1",
          name: "content/level-overview.md",
          path: "content/level-overview.md",
          resourceType: "document",
          tags: ["content.primary", "company.resource"],
          resourceOrigin: "declared",
        },
        {
          key: "reference-1",
          artifactId: "reference-1",
          name: "docs/simulation-guide.md",
          path: "docs/simulation-guide.md",
          resourceType: "document",
          tags: ["domain.reference", "company.resource"],
          resourceOrigin: "declared",
        },
      ],
      now: 420,
    });

    expect(result.artifacts[0]?.content).toContain("主体内容：1 份");
    expect(result.artifacts[0]?.content).toContain("参考资料：1 份");
    expect(result.artifacts[0]?.content).not.toContain("正文：1 份");
    expect(result.artifacts[0]?.content).not.toContain("设定：1 份");
  });

  it("builds a generic viewer manifest for non-novel companies", () => {
    const result = executeWorkspaceSkill({
      company: createGenericCompany(),
      skill: createSkill("reader.build-index", "重建内容索引", ["document", "report"]),
      app: genericReaderApp,
      manifest: null,
      files: [
        {
          key: "content-1",
          artifactId: "content-1",
          name: "content/level-overview.md",
          path: "content/level-overview.md",
          resourceType: "document",
          tags: ["content.primary", "company.resource"],
          resourceOrigin: "declared",
        },
        {
          key: "reference-1",
          artifactId: "reference-1",
          name: "docs/simulation-guide.md",
          path: "docs/simulation-guide.md",
          resourceType: "document",
          tags: ["domain.reference", "company.resource"],
          resourceOrigin: "declared",
        },
      ],
      now: 450,
    });

    expect(result.artifacts[0]?.kind).toBe("app_manifest");
    expect(result.artifacts[0]?.content).toContain('"label": "内容"');
    expect(result.successTitle).toBe("已重建查看器 AppManifest");
    expect(result.runSummary).toContain("查看器索引已重建");
  });
});
