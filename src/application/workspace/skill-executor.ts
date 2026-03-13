import type { ArtifactRecord, ArtifactResourceType } from "../../domain/artifact/types";
import type { Company, CompanyWorkspaceApp, SkillDefinition } from "../../domain/org/types";
import { isNovelCompany, summarizeConsistencyAnchors } from "../company/workspace-apps";
import { buildWorkspaceAppManifestDraft, type WorkspaceAppManifest } from "./app-manifest";
import { buildSkillResultArtifact } from "./skill-result-artifact";
import type { WorkspaceResourceOrigin } from "./index";

type WorkspaceSkillFile = {
  key: string;
  artifactId?: string;
  name: string;
  path: string;
  previewText?: string;
  updatedAtMs?: number;
  resourceType: ArtifactResourceType;
  tags: string[];
  resourceOrigin?: WorkspaceResourceOrigin;
};

type ExecuteWorkspaceSkillInput = {
  company: Company;
  skill: SkillDefinition;
  app: CompanyWorkspaceApp | null;
  manifest: WorkspaceAppManifest | null;
  files: WorkspaceSkillFile[];
  workItemId?: string | null;
  now: number;
};

type ExecuteWorkspaceSkillResult = {
  artifacts: ArtifactRecord[];
  nextApps?: CompanyWorkspaceApp[];
  runSummary: string;
  successTitle: string;
  successDetail: string;
};

type WorkspaceSkillExecutor = (input: ExecuteWorkspaceSkillInput) => ExecuteWorkspaceSkillResult;

export type SkillExecutionAdapter = {
  entryPath: string;
  execute: WorkspaceSkillExecutor;
};

const BUILTIN_WORKSPACE_SKILL_EXECUTORS: SkillExecutionAdapter[] = [
  {
    entryPath: "scripts/build-reader-index.ts",
    execute: buildReaderIndexArtifacts,
  },
  {
    entryPath: "scripts/run-consistency-check.ts",
    execute: buildConsistencyReportArtifacts,
  },
  {
    entryPath: "scripts/run-review-precheck.ts",
    execute: buildReviewPrecheckArtifacts,
  },
];

const SKILL_EXECUTION_ADAPTER_REGISTRY = new Map<string, SkillExecutionAdapter>(
  BUILTIN_WORKSPACE_SKILL_EXECUTORS.map((adapter) => [adapter.entryPath, adapter]),
);

const PRIMARY_CONTENT_TAGS = ["content.primary", "story.chapter"] as const;
const REFERENCE_TAGS = ["domain.reference", "story.canon", "company.knowledge"] as const;
const REPORT_TAGS = ["ops.report", "qa.report"] as const;

export function getRegisteredSkillExecutionAdapter(
  entryPath: string | null | undefined,
): SkillExecutionAdapter | null {
  const normalizedEntryPath = normalizeSkillEntryPath(entryPath);
  if (!normalizedEntryPath) {
    return null;
  }
  return SKILL_EXECUTION_ADAPTER_REGISTRY.get(normalizedEntryPath) ?? null;
}

export function hasRegisteredSkillExecutionAdapter(
  skill: Pick<SkillDefinition, "entryPath"> | string | null | undefined,
) {
  const entryPath = typeof skill === "string" ? skill : skill?.entryPath;
  return Boolean(getRegisteredSkillExecutionAdapter(entryPath));
}

function filterDeclaredFiles(files: WorkspaceSkillFile[]) {
  return files.filter((file) => file.resourceOrigin === "declared" || file.resourceOrigin === "manifest");
}

function filterFilesByAnyTag(files: WorkspaceSkillFile[], tags: readonly string[]) {
  return files.filter((file) => tags.some((tag) => file.tags.includes(tag)));
}

function filterDeclaredFilesByAnyTag(files: WorkspaceSkillFile[], tags: readonly string[]) {
  return filterFilesByAnyTag(filterDeclaredFiles(files), tags);
}

function listFileNames(files: WorkspaceSkillFile[], limit = 3) {
  return files
    .slice(0, limit)
    .map((file) => file.name)
    .join("、");
}

function normalizeSkillEntryPath(entryPath: string | null | undefined) {
  return (entryPath ?? "").trim().replace(/\\/g, "/");
}

function resolveWorkspaceSkillExecutor(
  skill: Pick<SkillDefinition, "entryPath">,
): WorkspaceSkillExecutor | null {
  return getRegisteredSkillExecutionAdapter(skill.entryPath)?.execute ?? null;
}

function getWorkspaceAppManifestFileName(app: Pick<CompanyWorkspaceApp, "slug">) {
  return `workspace-app-manifest.${app.slug}.json`;
}

function getWorkspaceAppManifestArtifactId(companyId: string, appId: string) {
  return `workspace-app-manifest:${companyId}:${appId}`;
}

function buildReaderIndexArtifacts(input: ExecuteWorkspaceSkillInput): ExecuteWorkspaceSkillResult {
  const app = input.app;
  if (!app) {
    throw new Error("内容索引 Skill 缺少对应 App，当前无法写回 AppManifest。");
  }
  const novelApp = isNovelCompany(input.company) || /小说|章节|正文|novel/i.test(`${app.title} ${app.slug}`);
  const draft = buildWorkspaceAppManifestDraft({
    app,
    files: filterDeclaredFiles(input.files),
    title: `${input.company.name} · ${app.title} AppManifest`,
    sourceLabel: "Skill 构建",
  });
  if (!draft) {
    throw new Error(
      novelApp
        ? "当前公司还没有足够明确的正式正文、设定或报告资源，无法生成阅读器 AppManifest。请先把推断资源发布为正式资源。"
        : "当前公司还没有足够明确的正式主体内容、参考资料或报告资源，无法生成查看器 AppManifest。请先把推断资源发布为正式资源。",
    );
  }

  const manifest = {
    ...draft,
    draft: false,
    sourceLabel: "Skill 构建",
  } satisfies WorkspaceAppManifest;
  const artifactId = getWorkspaceAppManifestArtifactId(input.company.id, app.id);
  const fileName = getWorkspaceAppManifestFileName(app);
  const artifact: ArtifactRecord = buildSkillResultArtifact({
    id: artifactId,
    companyId: input.company.id,
    workItemId: input.workItemId ?? null,
    skill: input.skill,
    app,
    now: input.now,
    title: fileName,
    kind: "app_manifest",
    summary: novelApp
      ? `${input.skill.title} 已生成新的 AppManifest，阅读器会优先按这份结果消费正文、设定和报告。`
      : `${input.skill.title} 已生成新的 AppManifest，查看器会优先按这份结果消费主体内容、参考资料和报告。`,
    content: JSON.stringify(manifest, null, 2),
    resourceType: "other",
    resourceTags: ["tech.app-manifest", `app.${app.slug}`],
    source: {
      name: fileName,
      path: fileName,
    },
    includeCompanyResourceTag: false,
  });
  const baseApps =
    input.company.workspaceApps && input.company.workspaceApps.length > 0
      ? input.company.workspaceApps
      : [app];
  const nextApps = baseApps.some((candidate) => candidate.id === app.id)
    ? baseApps.map((candidate) =>
        candidate.id === app.id ? { ...candidate, manifestArtifactId: artifactId } : candidate,
      )
    : [...baseApps, { ...app, manifestArtifactId: artifactId }];

  return {
    artifacts: [artifact],
    nextApps,
    runSummary: `${input.company.name} 的${novelApp ? "阅读器" : "查看器"}索引已重建，新的 AppManifest 会覆盖旧入口配置。`,
    successTitle: `已重建${novelApp ? "阅读器" : "查看器"} AppManifest`,
    successDetail: `${novelApp ? "阅读器" : "查看器"}现在会优先读取这次 skill 产出的显式资源索引。`,
  };
}

function buildConsistencyReportArtifacts(input: ExecuteWorkspaceSkillInput): ExecuteWorkspaceSkillResult {
  const novelCompany = isNovelCompany(input.company);
  const contentFiles = filterDeclaredFilesByAnyTag(input.files, PRIMARY_CONTENT_TAGS);
  const referenceFiles = filterDeclaredFilesByAnyTag(input.files, REFERENCE_TAGS);
  const reportFiles = filterDeclaredFilesByAnyTag(input.files, REPORT_TAGS);
  const anchors = novelCompany
    ? summarizeConsistencyAnchors(input.files.map((file) => `${file.name} ${file.path}`))
    : [
        { id: "reference", label: "关键参考资料", found: referenceFiles.length > 0 },
        { id: "content", label: "主体内容样本", found: contentFiles.length > 0 },
        { id: "report", label: "最近检查报告", found: reportFiles.length > 0 },
      ];
  const missingAnchors = anchors.filter((anchor) => !anchor.found);
  const artifact: ArtifactRecord = buildSkillResultArtifact({
    companyId: input.company.id,
    workItemId: input.workItemId ?? null,
    skill: input.skill,
    app: input.app,
    now: input.now,
    title: `${input.company.name} 一致性检查报告`,
    kind: "consistency_report",
    summary:
      missingAnchors.length === 0
        ? "共享真相源已基本具备，可以继续扩大自动化校验范围。"
        : `当前仍缺少 ${missingAnchors.length} 个一致性锚点，建议先补齐真相源再继续扩大自动化校验。`,
    content: [
      `# ${input.company.name} 一致性检查报告`,
      "",
      `- ${novelCompany ? "正文" : "主体内容"}：${contentFiles.length} 份`,
      `- ${novelCompany ? "设定" : "参考资料"}：${referenceFiles.length} 份`,
      `- 报告：${reportFiles.length} 份`,
      `- 锚点状态：${anchors.filter((anchor) => anchor.found).length}/${anchors.length} 已具备`,
      "",
      "## 缺口判断",
      missingAnchors.length > 0
        ? `待补齐：${missingAnchors.map((anchor) => anchor.label).join("、")}`
        : novelCompany
          ? "当前关键锚点已具备，可以继续接入更细的一致性规则。"
          : "当前关键参考资料与检查基础已具备，可以继续接入更细的规则校验。",
      "",
      "## 当前可用资源",
      contentFiles.length > 0
        ? `- ${novelCompany ? "正文样本" : "主体内容样本"}：${listFileNames(contentFiles)}`
        : `- 还没有稳定${novelCompany ? "正文" : "主体内容"}样本`,
      referenceFiles.length > 0
        ? `- ${novelCompany ? "设定真相源" : "参考资料"}：${listFileNames(referenceFiles)}`
        : `- 还没有稳定${novelCompany ? "设定真相源" : "参考资料"}可供校验`,
      reportFiles.length > 0 ? `- 已有过程报告：${listFileNames(reportFiles)}` : "- 还没有过程报告可供回看",
    ].join("\n"),
    resourceType: "report",
    resourceTags: ["ops.report", "qa.report"],
    source: {
      name: `consistency-report-${input.now}.md`,
      path: `skill-results/${input.skill.id}/${input.now}.md`,
    },
  });

  return {
    artifacts: [artifact],
    runSummary: `${input.company.name} 已完成一次一致性检查，当前锚点具备率为 ${anchors.filter((anchor) => anchor.found).length}/${anchors.length}。`,
    successTitle: "已生成一致性检查报告",
    successDetail: "新的报告已经写回工作目录，业务负责人可以直接回看缺口和当前资源情况。",
  };
}

function buildReviewPrecheckArtifacts(input: ExecuteWorkspaceSkillInput): ExecuteWorkspaceSkillResult {
  const novelCompany = isNovelCompany(input.company);
  const contentFiles = filterDeclaredFilesByAnyTag(input.files, PRIMARY_CONTENT_TAGS);
  const referenceFiles = filterDeclaredFilesByAnyTag(input.files, REFERENCE_TAGS);
  const reportFiles = filterDeclaredFilesByAnyTag(input.files, REPORT_TAGS);
  const blockers: string[] = [];
  if (contentFiles.length === 0) {
    blockers.push(novelCompany ? "缺少可发布正文" : "缺少可交付主体内容");
  }
  if (referenceFiles.length === 0) {
    blockers.push(novelCompany ? "缺少共享设定/真相源" : "缺少关键参考资料/真相源");
  }
  if (!input.manifest) {
    blockers.push("AppManifest 尚未接入");
  }

  const artifact: ArtifactRecord = buildSkillResultArtifact({
    companyId: input.company.id,
    workItemId: input.workItemId ?? null,
    skill: input.skill,
    app: input.app,
    now: input.now,
    title: `${input.company.name} 发布前检查报告`,
    kind: "review_precheck",
    summary:
      blockers.length === 0
        ? "当前发布前检查通过，可以继续进入业务验收或发布动作。"
        : `当前发布前检查发现 ${blockers.length} 个阻塞项，需要业务负责人和 CTO 一起确认。`,
    content: [
      `# ${input.company.name} 发布前检查报告`,
      "",
      `- 检查结论：${blockers.length === 0 ? "可推进" : "待补齐"}`,
      `- ${novelCompany ? "正文" : "主体内容"}：${contentFiles.length} 份`,
      `- ${novelCompany ? "设定" : "参考资料"}：${referenceFiles.length} 份`,
      `- 报告：${reportFiles.length} 份`,
      `- AppManifest：${input.manifest ? "已接入" : "未接入"}`,
      "",
      "## 阻塞项",
      blockers.length > 0 ? blockers.map((item) => `- ${item}`).join("\n") : "- 当前没有发现阻塞项",
      "",
      "## 最近可回看产物",
      contentFiles.length > 0
        ? `- ${novelCompany ? "正文" : "主体内容"}：${listFileNames(contentFiles)}`
        : `- ${novelCompany ? "正文" : "主体内容"}仍待产出`,
      referenceFiles.length > 0
        ? `- ${novelCompany ? "设定" : "参考资料"}：${listFileNames(referenceFiles)}`
        : `- ${novelCompany ? "设定" : "参考资料"}仍待固化`,
      reportFiles.length > 0 ? `- 报告：${listFileNames(reportFiles)}` : "- 报告仍待补充",
    ].join("\n"),
    resourceType: "report",
    resourceTags: ["ops.report", "qa.report"],
    source: {
      name: `review-precheck-${input.now}.md`,
      path: `skill-results/${input.skill.id}/${input.now}.md`,
    },
  });

  return {
    artifacts: [artifact],
    runSummary: `${input.company.name} 已完成一次发布前检查，当前结论为 ${blockers.length === 0 ? "可推进" : "待补齐"}。`,
    successTitle: "已生成发布前检查报告",
    successDetail: blockers.length === 0 ? "当前检查没有阻塞项。" : "报告里已经写清楚当前阻塞项，方便业务负责人回看。",
  };
}

export function executeWorkspaceSkill(
  input: ExecuteWorkspaceSkillInput,
): ExecuteWorkspaceSkillResult {
  const executor = resolveWorkspaceSkillExecutor(input.skill);
  if (executor) {
    return executor(input);
  }
  throw new Error(
    `${input.skill.title} 当前没有已注册的能力适配器（${normalizeSkillEntryPath(input.skill.entryPath) || "missing entryPath"}）。`,
  );
}

export type { ExecuteWorkspaceSkillInput, ExecuteWorkspaceSkillResult, WorkspaceSkillFile };
