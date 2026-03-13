import { describe, expect, it } from "vitest";
import type { Company } from "../../../src/domain/org/types";
import { buildDefaultOrgSettings } from "../../../src/domain/org/autonomy-policy";
import { buildCompanyWorkspaceBootstrap } from "./company-workspace-bootstrap";

function createCompany(template: string): Company {
  return {
    id: `company-${template}`,
    name: template === "content-factory" ? "内容工厂验收" : "测试公司",
    description: "用于验证公司工作目录 bootstrap。",
    icon: "🏢",
    template,
    orgSettings: buildDefaultOrgSettings(),
    departments: [
      { id: "dep-ceo", name: "管理中枢", leadAgentId: "company-ceo", kind: "meta", order: 0 },
      { id: "dep-cto", name: "技术部", leadAgentId: "company-cto", kind: "support", order: 1 },
      { id: "dep-coo", name: "运营部", leadAgentId: "company-coo", kind: "support", order: 2 },
    ],
    employees: [
      { agentId: "company-ceo", nickname: "CEO", role: "CEO", isMeta: true, metaRole: "ceo", departmentId: "dep-ceo" },
      { agentId: "company-cto", nickname: "CTO", role: "CTO", isMeta: true, metaRole: "cto", departmentId: "dep-cto" },
      { agentId: "company-coo", nickname: "COO", role: "COO", isMeta: true, metaRole: "coo", departmentId: "dep-coo" },
      { agentId: "writer-1", nickname: "主笔", role: "内容主笔", isMeta: false, reportsTo: "company-coo", departmentId: "dep-coo" },
    ],
    quickPrompts: [],
    createdAt: 1_710_000_000_000,
  };
}

describe("buildCompanyWorkspaceBootstrap", () => {
  it("stores explicit workspace apps for every company bootstrap", () => {
    const result = buildCompanyWorkspaceBootstrap(createCompany("blank"));

    expect(result.company.workspaceApps?.map((app) => app.template)).toEqual([
      "reader",
      "consistency",
      "knowledge",
      "workbench",
    ]);
    expect(result.runtime.activeArtifacts).toHaveLength(0);
  });

  it("seeds the content-factory baseline with explicit resources and a bound manifest", () => {
    const result = buildCompanyWorkspaceBootstrap(createCompany("content-factory"));

    const readerApp = result.company.workspaceApps?.find((app) => app.template === "reader");
    expect(readerApp?.title).toBe("内容查看器");
    expect(readerApp?.manifestArtifactId).toBe(`workspace-app-manifest:${result.company.id}:${readerApp?.id}`);

    expect(
      result.runtime.activeArtifacts.map((artifact) => ({
        title: artifact.title,
        resourceType: artifact.resourceType,
        tags: artifact.resourceTags,
      })),
    ).toEqual([
      {
        title: "本周主线内容计划",
        resourceType: "document",
        tags: ["content.primary", "company.resource"],
      },
      {
        title: "选题与风格约束",
        resourceType: "document",
        tags: ["domain.reference", "company.knowledge", "company.resource"],
      },
      {
        title: "首轮交付复盘",
        resourceType: "report",
        tags: ["ops.report", "qa.report", "company.resource"],
      },
      {
        title: "workspace-app-manifest.reader.json",
        resourceType: "other",
        tags: ["tech.app-manifest", "app.reader"],
      },
    ]);

    const manifestArtifact = result.runtime.activeArtifacts.find((artifact) => artifact.kind === "app_manifest");
    expect(manifestArtifact?.content).toContain("\"label\": \"内容\"");
    expect(manifestArtifact?.content).toContain("\"label\": \"参考\"");
    expect(manifestArtifact?.content).toContain("\"label\": \"报告\"");
  });
});
