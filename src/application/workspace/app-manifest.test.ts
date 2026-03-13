import { describe, expect, it } from "vitest";
import type { ArtifactRecord } from "../../domain/artifact/types";
import type { CompanyWorkspaceApp } from "../../domain/org/types";
import type { WorkspaceFileRow } from "./index";
import {
  applyWorkspaceAppManifest,
  buildWorkspaceAppManifestDraft,
  getWorkspaceAppFilesForSection,
  resolveWorkspaceAppManifest,
} from "./app-manifest";

function makeReaderApp(overrides: Partial<CompanyWorkspaceApp> = {}): CompanyWorkspaceApp {
  return {
    id: "app:reader",
    slug: "reader",
    title: "公司阅读器",
    description: "阅读器",
    icon: "📖",
    kind: "custom",
    status: "ready",
    surface: "template",
    template: "reader",
    ...overrides,
  };
}

function makeWorkbenchApp(overrides: Partial<CompanyWorkspaceApp> = {}): CompanyWorkspaceApp {
  return {
    id: "app:workbench",
    slug: "cto-workbench",
    title: "CTO 工具工坊",
    description: "工坊",
    icon: "🛠️",
    kind: "custom",
    status: "ready",
    surface: "template",
    template: "workbench",
    ...overrides,
  };
}

function makeGenericReaderApp(overrides: Partial<CompanyWorkspaceApp> = {}): CompanyWorkspaceApp {
  return makeReaderApp({
    title: "内容查看器",
    description: "查看器",
    ...overrides,
  });
}

function makeReviewConsoleApp(overrides: Partial<CompanyWorkspaceApp> = {}): CompanyWorkspaceApp {
  return {
    id: "app:review-console",
    slug: "review-console",
    title: "审阅控制台",
    description: "审阅控制台",
    icon: "🧪",
    kind: "custom",
    status: "ready",
    surface: "embedded",
    template: "review-console",
    embeddedHostKey: "review-console",
    ...overrides,
  };
}

function makeFile(overrides: Partial<WorkspaceFileRow> = {}): WorkspaceFileRow {
  return {
    key: "file-1",
    artifactId: "artifact:chapter-1",
    agentId: "writer",
    agentLabel: "写手",
    role: "小说写手",
    workspace: "产品产物库",
    name: "chapters/第一章.md",
    path: "chapters/第一章.md",
    kind: "chapter",
    resourceType: "document",
    tags: ["story.chapter", "company.resource"],
    resourceOrigin: "declared",
    previewText: "第一章正文",
    updatedAtMs: 100,
    ...overrides,
  };
}

function makeArtifact(overrides: Partial<ArtifactRecord> = {}): ArtifactRecord {
  return {
    id: "artifact:manifest",
    title: "workspace-app-manifest.reader.json",
    kind: "app_manifest",
    status: "draft",
    createdAt: 1,
    updatedAt: 2,
    content: JSON.stringify({
      version: 1,
      title: "NovelCraft 阅读器",
      sections: [
        {
          id: "reader-content",
          label: "正文",
          slot: "content",
          order: 0,
          selectors: [{ tags: ["story.chapter"] }],
        },
      ],
      resources: [
        {
          id: "chapter-1",
          slot: "content",
          title: "第一章 开局",
          summary: "修订后的章节摘要",
          sourcePath: "chapters/第一章.md",
          resourceType: "document",
          tags: ["story.chapter", "company.resource"],
        },
      ],
      actions: [
        {
          id: "trigger-reader-index",
          label: "重建阅读索引",
          actionType: "trigger_skill",
          target: "reader.build-index",
        },
      ],
    }),
    ...overrides,
  };
}

describe("workspace app manifest", () => {
  it("migrates legacy reader-index artifacts into generic app manifests", () => {
    const manifest = resolveWorkspaceAppManifest({
      app: makeReaderApp(),
      artifacts: [
        makeArtifact({
          kind: "reader_index",
          title: "workspace-reader-index.json",
          content: JSON.stringify({
            version: 1,
            title: "Legacy Reader",
            draft: true,
            items: [
              {
                id: "chapter-1",
                kind: "chapter",
                sourcePath: "chapters/第一章.md",
              },
            ],
          }),
        }),
      ],
      files: [],
    });

    expect(manifest.title).toBe("Legacy Reader");
    expect(manifest.draft).toBe(true);
    expect(manifest.resources).toHaveLength(1);
    expect(manifest.resources?.[0]?.slot).toBe("content");
    expect(manifest.resources?.[0]?.tags).toContain("story.chapter");
  });

  it("builds reader manifest drafts from current workspace files", () => {
    const manifest = buildWorkspaceAppManifestDraft({
      app: makeReaderApp(),
      title: "小说阅读器 AppManifest 草案",
      sourceLabel: "系统草案",
      files: [
        makeFile(),
        makeFile({
          key: "canon-1",
          artifactId: "artifact:canon-1",
          name: "docs/人物设定.md",
          path: "docs/人物设定.md",
          kind: "canon",
          previewText: "设定说明",
          tags: ["story.canon", "company.resource"],
        }),
        makeFile({
          key: "review-1",
          artifactId: "artifact:review-1",
          name: "reports/审校报告.md",
          path: "reports/审校报告.md",
          kind: "review",
          resourceType: "report",
          previewText: "审校结果",
          tags: ["qa.report", "company.resource"],
        }),
      ],
    });

    expect(manifest?.draft).toBe(true);
    expect(manifest?.resources).toHaveLength(3);
    expect(manifest?.actions?.map((action) => action.id)).toContain("trigger-reader-index");
    expect(manifest?.actions?.map((action) => action.id)).toContain("report-reader-issue");
  });

  it("builds generic viewer drafts from generic resource tags", () => {
    const manifest = buildWorkspaceAppManifestDraft({
      app: makeGenericReaderApp(),
      files: [
        makeFile({
          key: "content-1",
          name: "content/overview.md",
          path: "content/overview.md",
          tags: ["content.primary", "company.resource"],
        }),
        makeFile({
          key: "reference-1",
          artifactId: "artifact:reference-1",
          name: "docs/reference-guide.md",
          path: "docs/reference-guide.md",
          kind: "knowledge",
          tags: ["domain.reference", "company.resource"],
        }),
        makeFile({
          key: "report-1",
          artifactId: "artifact:report-1",
          name: "reports/check.md",
          path: "reports/check.md",
          kind: "review",
          resourceType: "report",
          tags: ["ops.report", "company.resource"],
        }),
      ],
    });

    expect(manifest?.sections.map((section) => section.label)).toEqual(["内容", "参考", "报告"]);
    expect(manifest?.resources?.map((resource) => resource.slot)).toEqual(["content", "reference", "reports"]);
  });

  it("applies manifest resource overrides and selects files by section", () => {
    const files = [
      makeFile(),
      makeFile({
        key: "review-1",
        artifactId: "artifact:review-1",
        name: "reports/审校报告.md",
        path: "reports/审校报告.md",
        kind: "review",
        resourceType: "report",
        tags: ["qa.report", "company.resource"],
      }),
    ];
    const manifest = resolveWorkspaceAppManifest({
      app: makeReaderApp(),
      artifacts: [makeArtifact()],
      files,
    });

    const resolved = applyWorkspaceAppManifest(files, manifest);
    expect(resolved[0]?.name).toBe("第一章 开局");
    expect(resolved[0]?.previewText).toBe("修订后的章节摘要");
    expect(getWorkspaceAppFilesForSection(resolved, manifest, "content").map((file) => file.key)).toEqual(["file-1"]);
  });

  it("does not accidentally reuse another app's manifest when the slug does not match", () => {
    const manifest = resolveWorkspaceAppManifest({
      app: makeWorkbenchApp(),
      artifacts: [makeArtifact()],
      files: [],
    });

    expect(manifest.appSlug).toBe("cto-workbench");
    expect(manifest.actions?.map((action) => action.id)).toEqual(["open-cto-chat"]);
  });

  it("does not treat inferred manifest files as authoritative manifest sources", () => {
    const manifest = resolveWorkspaceAppManifest({
      app: makeReaderApp(),
      artifacts: [],
      files: [
        makeFile({
          key: "inferred-manifest",
          artifactId: undefined,
          name: "workspace-app-manifest.reader.json",
          path: "workspace-app-manifest.reader.json",
          previewText: JSON.stringify({
            version: 1,
            title: "推断来源的阅读器",
            sections: [
              {
                id: "custom",
                label: "自定义区",
                slot: "custom",
                order: 0,
                selectors: [{ tags: ["story.chapter"] }],
              },
            ],
          }),
          resourceType: "other",
          tags: ["tech.app-manifest"],
          resourceOrigin: "inferred",
        }),
      ],
    });

    expect(manifest.title).toBe("公司阅读器");
    expect(manifest.sections.map((section) => section.slot)).toEqual(["content", "reference", "reports"]);
  });

  it("does not treat mirrored workspace artifacts as authoritative manifest sources", () => {
    const manifest = resolveWorkspaceAppManifest({
      app: makeReaderApp(),
      artifacts: [
        makeArtifact({
          id: "workspace:company-1:cto-1:workspace-app-manifest.reader.json",
          kind: "other",
          title: "workspace-app-manifest.reader.json",
          content: JSON.stringify({
            version: 1,
            title: "镜像来源的阅读器",
            sections: [
              {
                id: "custom",
                label: "自定义区",
                slot: "custom",
                order: 0,
                selectors: [{ tags: ["story.chapter"] }],
              },
            ],
          }),
        }),
      ],
      files: [],
    });

    expect(manifest.title).toBe("公司阅读器");
    expect(manifest.sections.map((section) => section.slot)).toEqual(["content", "reference", "reports"]);
  });

  it("keeps standard governance actions even when an explicit manifest defines its own actions", () => {
    const manifest = resolveWorkspaceAppManifest({
      app: makeReviewConsoleApp({
        manifestArtifactId: "artifact:review-console-manifest",
      }),
      artifacts: [
        makeArtifact({
          id: "artifact:review-console-manifest",
          title: "workspace-app-manifest.review-console.json",
          content: JSON.stringify({
            version: 1,
            appSlug: "review-console",
            sections: [
              {
                id: "review-console-reports",
                label: "审阅报告",
                slot: "reports",
                order: 0,
                selectors: [{ tags: ["qa.report"] }],
              },
            ],
            actions: [
              {
                id: "custom-review-export",
                label: "导出审阅摘要",
                actionType: "open_chat",
                target: "cto",
              },
            ],
          }),
        }),
      ],
      files: [],
    });

    expect(manifest.actions?.map((action) => action.id)).toEqual([
      "custom-review-export",
      "trigger-review-precheck",
      "request-review-console",
      "report-review-precheck-issue",
    ]);
  });
});
