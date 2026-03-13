import { describe, expect, it } from "vitest";
import type { Company, CompanyWorkspaceApp, SkillDefinition } from "../../domain/org/types";
import type { AuthorityAgentFileRunResponse } from "../../infrastructure/authority/contract";
import {
  normalizeWorkspaceSkillScriptOutput,
  resolveWorkspaceSkillExecutionFromScriptRun,
} from "./workspace-skill-script";

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

const readerSkill: SkillDefinition = {
  id: "reader.build-index",
  title: "重建阅读索引",
  summary: "重建阅读索引",
  ownerAgentId: "cto-1",
  status: "ready",
  entryPath: "scripts/build-reader-index.ts",
  writesResourceTypes: ["document", "report"],
  allowedTriggers: ["app_action"],
  createdAt: 1,
  updatedAt: 1,
};

describe("workspace-skill-script", () => {
  it("parses versioned workspace script output", () => {
    const output = normalizeWorkspaceSkillScriptOutput(
      JSON.stringify({
        version: 1,
        runSummary: "已构建正式资源",
        resources: [
          {
            id: "resource:1",
            title: "章节索引",
            kind: "skill_result",
            resourceType: "document",
            resourceTags: ["story.chapter"],
            source: {
              name: "reader-index.md",
              path: "out/reader-index.md",
              url: "https://example.com/reader-index.md",
            },
          },
        ],
      }),
    );

    expect(output?.version).toBe(1);
    expect(output?.resources?.[0]?.source?.path).toBe("out/reader-index.md");
  });

  it("maps versioned workspace script resources into platform artifacts", () => {
    const response: AuthorityAgentFileRunResponse = {
      agentId: "cto-1",
      workspace: "/tmp/workspace",
      entryPath: "scripts/build-reader-index.ts",
      status: "executed",
      cwd: "/tmp/workspace",
      command: ["tsx", "scripts/build-reader-index.ts"],
      exitCode: 0,
      stdout: JSON.stringify({
        version: 1,
        runSummary: "已构建正式资源",
        successTitle: "脚本已执行",
        successDetail: "本次运行来自 workspace 脚本。",
        bindAppManifestArtifactId: "workspace-app-manifest:company-1:app:reader",
        resources: [
          {
            id: "resource:1",
            title: "章节索引",
            kind: "skill_result",
            summary: "脚本已生成章节索引。",
            content: "# 章节索引",
            resourceType: "document",
            resourceTags: ["story.chapter"],
            source: {
              name: "reader-index.md",
              path: "out/reader-index.md",
            },
          },
        ],
      }),
    };

    const result = resolveWorkspaceSkillExecutionFromScriptRun({
      company: createCompany(),
      skill: readerSkill,
      app: readerApp,
      response,
      workItemId: "work-1",
      now: 300,
    });

    expect(result).not.toBeNull();
    expect(result?.artifacts).toHaveLength(1);
    expect(result?.artifacts[0]?.id).toBe("resource:1");
    expect(result?.artifacts[0]?.sourcePath).toBe("out/reader-index.md");
    expect(result?.artifacts[0]?.resourceTags).toEqual(
      expect.arrayContaining([
        "company.resource",
        "tech.skill-result",
        "tech.workspace-script",
        "skill.reader.build-index",
        "app.app:reader",
        "story.chapter",
      ]),
    );
    expect(result?.nextApps?.[0]?.manifestArtifactId).toBe("workspace-app-manifest:company-1:app:reader");
  });
});
