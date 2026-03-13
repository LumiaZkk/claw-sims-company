import { describe, expect, it } from "vitest";
import type { Company, CompanyWorkspaceApp, SkillDefinition } from "../../domain/org/types";
import type { WorkspaceAppManifest } from "./app-manifest";
import {
  buildWorkspaceSkillExecutionInput,
  listWorkspaceSkillExecutionInputTypes,
  summarizeWorkspaceSkillExecutionInput,
} from "./workspace-skill-contract";

const company: Company = {
  id: "company-1",
  name: "小说公司",
  description: "测试公司",
  icon: "🏢",
  template: "novel",
  createdAt: 1,
  employees: [],
  quickPrompts: [],
};

const app: CompanyWorkspaceApp = {
  id: "app:reader",
  slug: "reader",
  title: "小说阅读器",
  description: "阅读器",
  icon: "📖",
  kind: "custom",
  status: "ready",
  template: "reader",
  surface: "embedded",
  manifestArtifactId: "workspace-app-manifest:company-1:app:reader",
};

const skill: SkillDefinition = {
  id: "reader.build-index",
  title: "重建阅读索引",
  summary: "重建阅读索引",
  ownerAgentId: "cto-1",
  status: "ready",
  entryPath: "scripts/build-reader-index.ts",
  writesResourceTypes: ["document", "report"],
  allowedTriggers: ["app_action"],
  manifestActionIds: ["trigger-reader-index"],
  createdAt: 1,
  updatedAt: 1,
};

const manifest: WorkspaceAppManifest = {
  version: 1,
  appId: "app:reader",
  appSlug: "reader",
  title: "阅读器清单",
  sections: [
    {
      id: "reader-content",
      label: "正文",
      slot: "content",
      order: 0,
      selectors: [{ tags: ["story.chapter"] }],
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
};

describe("workspace-skill-contract", () => {
  it("builds a versioned execution input with manifest and resource context", () => {
    const input = buildWorkspaceSkillExecutionInput({
      company,
      skill,
      app,
      manifest,
      files: [
        {
          key: "chapter-1",
          artifactId: "artifact-1",
          name: "第1章.md",
          path: "chapters/chapter-1.md",
          resourceType: "document",
          tags: ["story.chapter"],
        },
        {
          key: "review-1",
          artifactId: "artifact-2",
          name: "终审报告.md",
          path: "reports/review.md",
          resourceType: "report",
          tags: ["qa.report"],
        },
      ],
      workItemId: "work-1",
      requestedByActorId: "coo-1",
      requestedByLabel: "COO",
      triggerType: "app_action",
      triggerActionId: "trigger-reader-index",
      triggerLabel: "小说阅读器",
      now: 100,
    });

    expect(input.version).toBe(1);
    expect(input.app?.manifestArtifactId).toBe("workspace-app-manifest:company-1:app:reader");
    expect(input.manifest?.sectionIds).toEqual(["reader-content"]);
    expect(input.resources.byType).toEqual([
      { resourceType: "document", count: 1 },
      { resourceType: "report", count: 1 },
    ]);
    expect(listWorkspaceSkillExecutionInputTypes(input)).toEqual(["document", "report"]);
    expect(summarizeWorkspaceSkillExecutionInput(input)).toContain("输入 2 份资源");
    expect(summarizeWorkspaceSkillExecutionInput(input)).toContain("COO 触发");
  });
});
