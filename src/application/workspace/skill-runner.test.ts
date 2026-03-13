import { describe, expect, it, vi } from "vitest";
import type { Company, CompanyWorkspaceApp, SkillDefinition, SkillRunRecord } from "../../domain/org/types";
import type { ArtifactRecord, ArtifactResourceType } from "../../domain/artifact/types";
import {
  runWorkspaceSkill,
  type WorkspaceScriptExecutionAttempt,
  type WorkspaceSkillIssueDraft,
} from "./skill-runner";

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

function createSkill(
  id: string,
  title: string,
  writesResourceTypes: ArtifactResourceType[],
  input?: Partial<SkillDefinition>,
): SkillDefinition {
  return {
    id,
    title,
    summary: title,
    ownerAgentId: "cto-1",
    status: "ready",
    entryPath:
      id === "reader.build-index"
        ? "scripts/build-reader-index.ts"
        : id === "consistency.check"
          ? "scripts/run-consistency-check.ts"
          : id === "review.precheck"
            ? "scripts/run-review-precheck.ts"
            : `scripts/${id}.ts`,
    writesResourceTypes,
    allowedTriggers: ["app_action"],
    createdAt: 1,
    updatedAt: 1,
    ...input,
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

describe("runWorkspaceSkill", () => {
  it("persists run ledger, artifacts, and app updates for successful runs", async () => {
    const artifacts: ArtifactRecord[] = [];
    const runs: SkillRunRecord[] = [];
    const appWrites: CompanyWorkspaceApp[][] = [];
    const issues: WorkspaceSkillIssueDraft[] = [];

    const result = await runWorkspaceSkill(
      {
        company: createCompany(),
        skillId: "reader.build-index",
        skill: createSkill("reader.build-index", "重建阅读索引", ["document", "report"], {
          entryPath: "scripts/build-reader-index.ts",
        }),
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
        requestedByActorId: "coo-1",
        requestedByLabel: "COO",
        ownerLabel: "CTO",
        triggerActionId: "trigger-reader-index",
        triggerLabel: "小说阅读器",
        now: 100,
      },
      {
        upsertArtifactRecord: vi.fn(async (artifact) => {
          artifacts.push(artifact);
        }),
        upsertSkillRun: vi.fn(async (run) => {
          runs.push(run);
        }),
        writeWorkspaceApps: vi.fn(async (apps) => {
          appWrites.push(apps);
        }),
        reportIssue: vi.fn(async (issue) => {
          issues.push(issue);
        }),
      },
    );

    expect(result.status).toBe("succeeded");
    expect(runs).toHaveLength(2);
    expect(runs[0]?.status).toBe("running");
    expect(runs[1]?.status).toBe("succeeded");
    expect(runs[1]?.executionMode).toBe("builtin_bridge");
    expect(runs[1]?.triggerActionId).toBe("trigger-reader-index");
    expect(runs[1]?.executionNote).toBeNull();
    expect(runs[1]?.inputSchemaVersion).toBe(1);
    expect(runs[1]?.inputResourceCount).toBe(2);
    expect(runs[1]?.inputResourceTypes).toEqual(["document"]);
    expect(runs[1]?.inputSummary).toContain("输入 2 份资源");
    expect(runs[1]?.resultSummary).toContain("阅读器索引已重建");
    expect(artifacts.map((artifact) => artifact.kind)).toContain("app_manifest");
    expect(artifacts.map((artifact) => artifact.kind)).toContain("skill_receipt");
    expect(appWrites[0]?.[0]?.manifestArtifactId).toBe("workspace-app-manifest:company-1:app:reader");
    expect(issues).toHaveLength(0);
  });

  it("records workspace_script mode when a real script execution result is supplied", async () => {
    const runs: SkillRunRecord[] = [];
    const artifacts: ArtifactRecord[] = [];

    const result = await runWorkspaceSkill(
      {
        company: createCompany(),
        skillId: "reader.build-index",
        skill: createSkill("reader.build-index", "重建阅读索引", ["state"], {
          entryPath: "scripts/build-reader-index.js",
        }),
        app: readerApp,
        manifest: null,
        files: [],
        triggerActionId: "trigger-reader-index",
        triggerLabel: "小说阅读器",
        now: 150,
      },
      {
        upsertArtifactRecord: vi.fn(async (artifact) => {
          artifacts.push(artifact);
        }),
        upsertSkillRun: vi.fn(async (run) => {
          runs.push(run);
        }),
        executeWorkspaceScript: vi.fn(async ({ executionInput }): Promise<WorkspaceScriptExecutionAttempt> => {
          expect(executionInput.version).toBe(1);
          expect(executionInput.skill.entryPath).toBe("scripts/build-reader-index.js");
          expect(executionInput.resources.count).toBe(0);
          return {
            status: "executed",
            result: {
              artifacts: [
                {
                  id: "skill-result:workspace-script",
                  title: "脚本产物",
                  kind: "skill_result",
                  status: "ready" as const,
                  ownerActorId: "cto-1",
                  sourceActorId: "cto-1",
                  resourceType: "state" as const,
                  createdAt: 150,
                  updatedAt: 150,
                },
              ],
              runSummary: "已执行真实 workspace script。",
              successTitle: "脚本已执行",
              successDetail: "本次运行来自真实工作区脚本。",
            },
          };
        }),
      },
    );

    if (result.status !== "succeeded") {
      throw new Error(`Expected succeeded result, received ${result.status}`);
    }
    expect(result.status).toBe("succeeded");
    expect(runs[1]?.executionMode).toBe("workspace_script");
    expect(runs[1]?.executionEntryPath).toBe("scripts/build-reader-index.js");
    expect(runs[1]?.resultSummary).toBe("已执行真实 workspace script。");
    expect(artifacts.map((artifact) => artifact.kind)).toContain("skill_receipt");
  });

  it("ignores inferred resources when building formal execution input", async () => {
    const runs: SkillRunRecord[] = [];

    const result = await runWorkspaceSkill(
      {
        company: createCompany(),
        skillId: "reader.build-index",
        skill: createSkill("reader.build-index", "重建阅读索引", ["state"], {
          entryPath: "scripts/build-reader-index.js",
        }),
        app: readerApp,
        manifest: null,
        files: [
          {
            key: "chapter-1",
            artifactId: "chapter-1",
            name: "第1章.md",
            path: "chapters/chapter-1.md",
            resourceType: "document",
            tags: ["story.chapter"],
            resourceOrigin: "declared",
          },
          {
            key: "draft-note",
            name: "drafts/notes.md",
            path: "drafts/notes.md",
            resourceType: "document",
            tags: ["content.primary"],
            resourceOrigin: "inferred",
          },
        ],
        triggerActionId: "trigger-reader-index",
        triggerLabel: "小说阅读器",
        now: 160,
      },
      {
        upsertArtifactRecord: vi.fn(),
        upsertSkillRun: vi.fn(async (run) => {
          runs.push(run);
        }),
        executeWorkspaceScript: vi.fn(async ({ executionInput }): Promise<WorkspaceScriptExecutionAttempt> => {
          expect(executionInput.resources.count).toBe(1);
          expect(
            executionInput.resources.entries.map((entry: (typeof executionInput.resources.entries)[number]) => entry.path),
          ).toEqual(["chapters/chapter-1.md"]);
          return {
            status: "executed",
            result: {
              artifacts: [
                {
                  id: "skill-result:workspace-script-filtered",
                  title: "脚本产物",
                  kind: "skill_result",
                  status: "ready" as const,
                  ownerActorId: "cto-1",
                  sourceActorId: "cto-1",
                  resourceType: "state" as const,
                  createdAt: 160,
                  updatedAt: 160,
                },
              ],
              runSummary: "仅正式资源进入了执行输入。",
              successTitle: "脚本已执行",
              successDetail: "执行输入已经过滤掉推断资源。",
            },
          };
        }),
      },
    );

    if (result.status !== "succeeded") {
      throw new Error(`Expected succeeded result, received ${result.status}`);
    }
    expect(runs[1]?.inputResourceCount).toBe(1);
    expect(runs[1]?.inputSummary).toContain("已忽略 1 份推断资源");
  });

  it("records fallback notes when workspace script falls back to the builtin bridge", async () => {
    const runs: SkillRunRecord[] = [];
    const appWrites: CompanyWorkspaceApp[][] = [];

    const result = await runWorkspaceSkill(
      {
        company: createCompany(),
        skillId: "reader.build-index",
        skill: createSkill("reader.build-index", "重建阅读索引", ["document"], {
          entryPath: "scripts/build-reader-index.ts",
        }),
        app: readerApp,
        manifest: null,
        files: [
          {
            key: "chapter-1",
            artifactId: "chapter-1",
            name: "第1章.md",
            path: "chapters/chapter-1.md",
            resourceType: "document",
            tags: ["story.chapter"],
            resourceOrigin: "declared",
          },
        ],
        triggerActionId: "trigger-reader-index",
        triggerLabel: "小说阅读器",
        now: 175,
      },
      {
        upsertArtifactRecord: vi.fn(),
        upsertSkillRun: vi.fn(async (run) => {
          runs.push(run);
        }),
        writeWorkspaceApps: vi.fn(async (apps) => {
          appWrites.push(apps);
        }),
        executeWorkspaceScript: vi.fn(async (): Promise<WorkspaceScriptExecutionAttempt> => ({
          status: "fallback",
          note: "工作区中未找到 scripts/build-reader-index.ts",
        })),
      },
    );

    if (result.status !== "succeeded") {
      throw new Error(`Expected succeeded result, received ${result.status}`);
    }
    expect(result.status).toBe("succeeded");
    expect(result.executionMode).toBe("builtin_bridge");
    expect(result.executionNote).toContain("未找到");
    expect(runs[1]?.executionMode).toBe("builtin_bridge");
    expect(runs[1]?.executionNote).toContain("未找到");
    expect(runs[1]?.inputSummary).toContain("输入 1 份资源");
    expect(appWrites[0]?.[0]?.manifestArtifactId).toBe("workspace-app-manifest:company-1:app:reader");
  });

  it("fails honestly when no workspace script and no registered adapter are available", async () => {
    const runs: SkillRunRecord[] = [];
    const issues: WorkspaceSkillIssueDraft[] = [];

    const result = await runWorkspaceSkill(
      {
        company: createCompany(),
        skillId: "custom.unimplemented",
        skill: createSkill("custom.unimplemented", "未接执行器的能力", ["state"], {
          entryPath: "scripts/custom-unimplemented.ts",
        }),
        app: readerApp,
        manifest: null,
        files: [],
        triggerActionId: "trigger-custom-unimplemented",
        triggerLabel: "小说阅读器",
        now: 190,
      },
      {
        upsertArtifactRecord: vi.fn(),
        upsertSkillRun: vi.fn(async (run) => {
          runs.push(run);
        }),
        reportIssue: vi.fn(async (issue) => {
          issues.push(issue);
        }),
        executeWorkspaceScript: vi.fn(async (): Promise<WorkspaceScriptExecutionAttempt> => ({
          status: "fallback",
          note: "工作区中未找到 scripts/custom-unimplemented.ts",
        })),
      },
    );

    expect(result.status).toBe("failed");
    expect(runs[0]?.status).toBe("running");
    expect(runs[1]?.status).toBe("failed");
    expect(runs[1]?.errorMessage).toContain("未找到");
    expect(issues).toEqual([
      expect.objectContaining({
        type: "runtime_error",
        skillId: "custom.unimplemented",
        contextActionId: "trigger-custom-unimplemented",
      }),
    ]);
  });

  it("marks missing or unavailable skills as blocked and files an issue", async () => {
    const runs: SkillRunRecord[] = [];
    const issues: WorkspaceSkillIssueDraft[] = [];

    const result = await runWorkspaceSkill(
      {
        company: createCompany(),
        skillId: "consistency.check",
        skill: null,
        app: readerApp,
        manifest: null,
        files: [],
        triggerActionId: "trigger-consistency-check",
        triggerLabel: "小说阅读器",
        now: 200,
      },
      {
        upsertArtifactRecord: vi.fn(),
        upsertSkillRun: vi.fn(async (run) => {
          runs.push(run);
        }),
        reportIssue: vi.fn(async (issue) => {
          issues.push(issue);
        }),
      },
    );

    expect(result.status).toBe("blocked");
    expect(runs).toHaveLength(1);
    expect(runs[0]?.status).toBe("failed");
    expect(runs[0]?.triggerActionId).toBe("trigger-consistency-check");
    expect(runs[0]?.inputResourceCount).toBe(0);
    expect(issues).toEqual([
      expect.objectContaining({
        type: "unavailable",
        skillId: "consistency.check",
        appId: "app:reader",
        contextActionId: "trigger-consistency-check",
        contextRunId: "skill-run:company-1:consistency.check:200",
      }),
    ]);
  });

  it("allows manual smoke tests for draft skills without auto-filing issues", async () => {
    const runs: SkillRunRecord[] = [];
    const issues: WorkspaceSkillIssueDraft[] = [];
    const artifacts: ArtifactRecord[] = [];

    const result = await runWorkspaceSkill(
      {
        company: createCompany(),
        skillId: "reader.build-index",
        skill: createSkill("reader.build-index", "重建阅读索引", ["state"], {
          status: "draft",
          entryPath: "scripts/build-reader-index.js",
        }),
        app: readerApp,
        manifest: null,
        files: [],
        triggerType: "manual",
        triggerActionId: "smoke-test:reader.build-index",
        triggerLabel: "CTO 工具工坊 smoke test",
        now: 250,
      },
      {
        upsertArtifactRecord: vi.fn(async (artifact) => {
          artifacts.push(artifact);
        }),
        upsertSkillRun: vi.fn(async (run) => {
          runs.push(run);
        }),
        reportIssue: vi.fn(async (issue) => {
          issues.push(issue);
        }),
        executeWorkspaceScript: vi.fn(async (): Promise<WorkspaceScriptExecutionAttempt> => ({
          status: "executed",
          result: {
            artifacts: [
              {
                id: "skill-result:manual-smoke",
                title: "Smoke 结果",
                kind: "skill_result",
                status: "ready" as const,
                ownerActorId: "cto-1",
                sourceActorId: "cto-1",
                resourceType: "state" as const,
                createdAt: 250,
                updatedAt: 250,
              },
            ],
            runSummary: "Smoke test 已通过。",
            successTitle: "Smoke test 已执行",
            successDetail: "草稿 skill 已完成一次手工验证。",
          },
        })),
      },
    );

    expect(result.status).toBe("succeeded");
    expect(runs[1]?.triggerType).toBe("manual");
    expect(runs[1]?.status).toBe("succeeded");
    expect(issues).toHaveLength(0);
    expect(artifacts.map((artifact) => artifact.kind)).toContain("skill_receipt");
  });
});
