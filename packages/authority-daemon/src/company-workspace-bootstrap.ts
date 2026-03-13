import type { ArtifactRecord } from "../../../src/domain/artifact/types";
import type { Company, CompanyWorkspaceApp } from "../../../src/domain/org/types";
import type { AuthorityCompanyRuntimeSnapshot } from "../../../src/infrastructure/authority/contract";
import { buildRecommendedWorkspaceApps, resolveWorkspaceAppTemplate } from "../../../src/application/company/workspace-apps";
import type { WorkspaceAppManifest } from "../../../src/application/workspace/app-manifest";

function buildEmptyRuntime(companyId: string, now: number): AuthorityCompanyRuntimeSnapshot {
  return {
    companyId,
    activeRoomRecords: [],
    activeMissionRecords: [],
    activeConversationStates: [],
    activeWorkItems: [],
    activeRequirementAggregates: [],
    activeRequirementEvidence: [],
    primaryRequirementId: null,
    activeRoundRecords: [],
    activeArtifacts: [],
    activeDispatches: [],
    activeRoomBindings: [],
    activeSupportRequests: [],
    activeEscalations: [],
    activeDecisionTickets: [],
    activeAgentSessions: [],
    activeAgentRuns: [],
    activeAgentRuntime: [],
    activeAgentStatuses: [],
    activeAgentStatusHealth: {
      source: "authority",
      coverage: "authority_partial",
      coveredAgentCount: 0,
      expectedAgentCount: 0,
      missingAgentIds: [],
      isComplete: false,
      generatedAt: now,
      note: "Authority runtime has not projected canonical agent statuses yet.",
    },
    updatedAt: now,
  };
}

function getDefaultWorkspaceApps(company: Company) {
  return buildRecommendedWorkspaceApps(company);
}

function findAppByTemplate(apps: CompanyWorkspaceApp[], template: CompanyWorkspaceApp["template"]) {
  return apps.find((app) => resolveWorkspaceAppTemplate(app) === template) ?? null;
}

function buildSeedArtifact(input: {
  company: Company;
  id: string;
  title: string;
  kind: string;
  summary: string;
  content: string;
  sourceName: string;
  sourcePath: string;
  ownerActorId?: string | null;
  resourceType: NonNullable<ArtifactRecord["resourceType"]>;
  resourceTags: string[];
}) {
  return {
    id: input.id,
    title: input.title,
    kind: input.kind,
    status: "ready",
    ownerActorId: input.ownerActorId ?? null,
    sourceActorId: input.ownerActorId ?? null,
    sourceName: input.sourceName,
    sourcePath: input.sourcePath,
    summary: input.summary,
    content: input.content,
    resourceType: input.resourceType,
    resourceTags: input.resourceTags,
    createdAt: input.company.createdAt,
    updatedAt: input.company.createdAt,
  } satisfies ArtifactRecord;
}

function buildContentFactoryBaseline(company: Company, apps: CompanyWorkspaceApp[]) {
  const now = company.createdAt;
  const cooAgentId = company.employees.find((employee) => employee.metaRole === "coo")?.agentId ?? null;
  const ctoAgentId = company.employees.find((employee) => employee.metaRole === "cto")?.agentId ?? null;
  const businessOwnerId =
    company.employees.find((employee) => !employee.isMeta)?.agentId
    ?? cooAgentId
    ?? ctoAgentId
    ?? null;

  const contentArtifact = buildSeedArtifact({
    company,
    id: `seed:${company.id}:content-primary`,
    title: "本周主线内容计划",
    kind: "seed_document",
    summary: "用于验收内容查看器的主体内容样本，确保非小说场景也有稳定的主内容入口。",
    content: [
      "# 本周主线内容计划",
      "",
      "## 目标",
      "- 输出 1 篇深度行业分析",
      "- 输出 3 条社媒短帖",
      "- 统一语气与 CTA",
      "",
      "## 主体内容样本",
      "内容工厂本周聚焦“AI 内容工作流”的可复制流程，文章主体会围绕选题、提纲、事实校验和分发节奏展开。",
      "",
      "## 交付口径",
      "- 先出长文主稿",
      "- 再拆成社媒物料",
      "- 所有版本都要保留出处和事实校验说明",
    ].join("\n"),
    sourceName: "content-primary.md",
    sourcePath: "workspace-seeds/content-primary.md",
    ownerActorId: businessOwnerId,
    resourceType: "document",
    resourceTags: ["content.primary", "company.resource"],
  });

  const referenceArtifact = buildSeedArtifact({
    company,
    id: `seed:${company.id}:domain-reference`,
    title: "选题与风格约束",
    kind: "seed_document",
    summary: "用于验收内容查看器和规则校验入口的参考资料样本。",
    content: [
      "# 选题与风格约束",
      "",
      "## 事实要求",
      "- 不得捏造数据来源",
      "- 关键结论必须有出处",
      "",
      "## 风格要求",
      "- 结论先行",
      "- 避免空泛口号",
      "- 保持专业但不过度学术",
      "",
      "## CTA 约束",
      "- CTA 只允许 1 个主动作",
      "- 不要在同一段落混入多个转化目标",
    ].join("\n"),
    sourceName: "domain-reference.md",
    sourcePath: "workspace-seeds/domain-reference.md",
    ownerActorId: ctoAgentId ?? cooAgentId,
    resourceType: "document",
    resourceTags: ["domain.reference", "company.knowledge", "company.resource"],
  });

  const reportArtifact = buildSeedArtifact({
    company,
    id: `seed:${company.id}:ops-report`,
    title: "首轮交付复盘",
    kind: "seed_report",
    summary: "用于验收非小说场景报告回看和问题反馈链路的样本报告。",
    content: [
      "# 首轮交付复盘",
      "",
      "## 当前判断",
      "- 主体内容结构清晰",
      "- 参考资料仍需补 1 份外部来源",
      "- 社媒拆分节奏可以继续细化",
      "",
      "## 风险",
      "- 如果事实出处不足，后续预检会直接阻塞",
      "",
      "## 下一步",
      "- 补齐外部来源",
      "- 走一次预检",
      "- 再进入交付确认",
    ].join("\n"),
    sourceName: "ops-report.md",
    sourcePath: "workspace-seeds/ops-report.md",
    ownerActorId: cooAgentId,
    resourceType: "report",
    resourceTags: ["ops.report", "qa.report", "company.resource"],
  });

  const readerApp = findAppByTemplate(apps, "reader");
  if (!readerApp) {
    return {
      company: {
        ...company,
        workspaceApps: apps,
      },
      runtime: {
        ...buildEmptyRuntime(company.id, now),
        activeArtifacts: [contentArtifact, referenceArtifact, reportArtifact],
      },
    };
  }

  const manifestArtifactId = `workspace-app-manifest:${company.id}:${readerApp.id}`;
  const manifest: WorkspaceAppManifest = {
    version: 1,
    appId: readerApp.id,
    appSlug: readerApp.slug,
    title: `${company.name} · 内容查看器`,
    sourceLabel: "系统基线",
    draft: false,
    sections: [
      {
        id: "reader-content",
        label: "内容",
        slot: "content",
        order: 0,
        selectors: [{ tags: ["content.primary"] }],
        emptyState: "当前还没有主体内容。",
      },
      {
        id: "reader-reference",
        label: "参考",
        slot: "reference",
        order: 1,
        selectors: [{ tags: ["domain.reference"] }],
        emptyState: "当前还没有参考资料。",
      },
      {
        id: "reader-reports",
        label: "报告",
        slot: "reports",
        order: 2,
        selectors: [{ tags: ["ops.report", "qa.report"] }, { resourceTypes: ["report"] }],
        emptyState: "当前还没有报告。",
      },
    ],
    resources: [
      {
        id: "baseline-content",
        slot: "content",
        title: contentArtifact.title,
        artifactId: contentArtifact.id,
        resourceType: contentArtifact.resourceType,
        tags: contentArtifact.resourceTags,
      },
      {
        id: "baseline-reference",
        slot: "reference",
        title: referenceArtifact.title,
        artifactId: referenceArtifact.id,
        resourceType: referenceArtifact.resourceType,
        tags: referenceArtifact.resourceTags,
      },
      {
        id: "baseline-report",
        slot: "reports",
        title: reportArtifact.title,
        artifactId: reportArtifact.id,
        resourceType: reportArtifact.resourceType,
        tags: reportArtifact.resourceTags,
      },
    ],
    actions: [
      {
        id: "trigger-reader-index",
        label: "重建内容索引",
        actionType: "trigger_skill",
        target: "reader.build-index",
      },
      {
        id: "refresh-reader-manifest",
        label: "刷新 AppManifest",
        actionType: "refresh_manifest",
        target: "reader",
      },
      {
        id: "report-reader-issue",
        label: "反馈查看器问题",
        actionType: "report_issue",
        target: "reader.build-index",
        input: { type: "bad_result" },
      },
    ],
  };

  const manifestArtifact = buildSeedArtifact({
    company,
    id: manifestArtifactId,
    title: "workspace-app-manifest.reader.json",
    kind: "app_manifest",
    summary: "内容查看器的系统基线 manifest，用于验证非小说场景下的显式资源绑定。",
    content: JSON.stringify(manifest, null, 2),
    sourceName: "workspace-app-manifest.reader.json",
    sourcePath: "workspace-seeds/workspace-app-manifest.reader.json",
    ownerActorId: ctoAgentId,
    resourceType: "other",
    resourceTags: ["tech.app-manifest", `app.${readerApp.slug}`],
  });

  return {
    company: {
      ...company,
      workspaceApps: apps.map((app) =>
        app.id === readerApp.id ? { ...app, manifestArtifactId } : app,
      ),
    },
    runtime: {
      ...buildEmptyRuntime(company.id, now),
      activeArtifacts: [contentArtifact, referenceArtifact, reportArtifact, manifestArtifact],
    },
  };
}

export function buildCompanyWorkspaceBootstrap(company: Company): {
  company: Company;
  runtime: AuthorityCompanyRuntimeSnapshot;
} {
  const apps = getDefaultWorkspaceApps(company);
  if (company.template === "content-factory") {
    return buildContentFactoryBaseline(
      {
        ...company,
        workspaceApps: apps,
      },
      apps,
    );
  }
  return {
    company: {
      ...company,
      workspaceApps: apps,
    },
    runtime: buildEmptyRuntime(company.id, company.createdAt),
  };
}
