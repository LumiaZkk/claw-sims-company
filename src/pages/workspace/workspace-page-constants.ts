import { WORKBENCH_TOOL_CARDS, type WorkspaceWorkbenchTool } from "../../application/workspace";
import type { ArtifactResourceType } from "../../domain/artifact/types";
import type {
  CapabilityIssueRecord,
  CapabilityRequestRecord,
  Company,
  CompanyWorkspaceApp,
  CompanyWorkspaceAppTemplate,
  EmployeeRef,
} from "../../domain/org/types";

export type SkillSeed = {
  id: string;
  tool: WorkspaceWorkbenchTool;
  appTemplate: CompanyWorkspaceAppTemplate;
  title: string;
  summary: string;
  entryPath: string;
  writesResourceTypes: ArtifactResourceType[];
  manifestActionIds: string[];
  requestType: CapabilityRequestRecord["type"];
  smokeTest: string;
};

export type RegisterableAppManifestCandidate = {
  artifactId: string;
  fileName: string;
  title: string;
  slug: string;
  appId?: string;
  sourceLabel: string | null;
};

export const WORKBENCH_TOOL_SET = new Set<WorkspaceWorkbenchTool>(
  WORKBENCH_TOOL_CARDS.map((card) => card.id),
);

export const WORKBENCH_SKILL_SEEDS: Record<WorkspaceWorkbenchTool, SkillSeed> = {
  "novel-reader": {
    id: "reader.build-index",
    tool: "novel-reader",
    appTemplate: "reader",
    title: "重建阅读索引",
    summary: "把当前公司的主体内容、参考资料和报告重新整理成查看器可直接消费的资源清单。",
    entryPath: "scripts/build-reader-index.ts",
    writesResourceTypes: ["document", "report"],
    manifestActionIds: ["trigger-reader-index"],
    requestType: "app",
    smokeTest: "验证当前公司至少能产出一份主体内容/参考资料/报告索引。",
  },
  "consistency-checker": {
    id: "consistency.check",
    tool: "consistency-checker",
    appTemplate: "consistency",
    title: "执行一致性检查",
    summary: "围绕唯一真相源、关键规则和状态流转做结构化校验，并输出检查报告。",
    entryPath: "scripts/run-consistency-check.ts",
    writesResourceTypes: ["report"],
    manifestActionIds: ["trigger-consistency-check"],
    requestType: "check",
    smokeTest: "使用一份主体内容和一份参考资料跑通一次检查并输出报告。",
  },
  "chapter-review-console": {
    id: "review.precheck",
    tool: "chapter-review-console",
    appTemplate: "review-console",
    title: "执行发布前检查",
    summary: "在评审、验收或交付前生成检查结果，帮助业务负责人快速判断是否可推进。",
    entryPath: "scripts/run-review-precheck.ts",
    writesResourceTypes: ["report"],
    manifestActionIds: ["trigger-review-precheck"],
    requestType: "app",
    smokeTest: "对当前公司至少生成一份可读预检报告。",
  },
};

export function getAppManifestFileName(app: Pick<CompanyWorkspaceApp, "slug">) {
  return `workspace-app-manifest.${app.slug}.json`;
}

export function getAppManifestArtifactId(companyId: string, appId: string) {
  return `workspace-app-manifest:${companyId}:${appId}`;
}

export function isWorkbenchTool(value: string): value is WorkspaceWorkbenchTool {
  return WORKBENCH_TOOL_SET.has(value as WorkspaceWorkbenchTool);
}

export function isCapabilityIssueType(value: unknown): value is CapabilityIssueRecord["type"] {
  return value === "unavailable" || value === "runtime_error" || value === "bad_result";
}

export function findBusinessLead(
  company: Company,
  workItemOwnerActorId?: string | null,
): EmployeeRef | null {
  if (workItemOwnerActorId) {
    const owner = company.employees.find((employee) => employee.agentId === workItemOwnerActorId) ?? null;
    if (owner && owner.metaRole !== "cto") {
      return owner;
    }
  }
  return (
    company.employees.find((employee) => employee.metaRole === "coo") ??
    company.employees.find((employee) => employee.metaRole === "ceo") ??
    company.employees.find((employee) => !employee.isMeta) ??
    company.employees[0] ??
    null
  );
}
