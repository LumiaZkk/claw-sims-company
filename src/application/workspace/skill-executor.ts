import type { ArtifactRecord, ArtifactResourceType } from "../../domain/artifact/types";
import type { Company, CompanyWorkspaceApp, SkillDefinition } from "../../domain/org/types";
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
  title: string;
  summary: string;
  execute: WorkspaceSkillExecutor;
};

const BUILTIN_WORKSPACE_SKILL_EXECUTORS: SkillExecutionAdapter[] = [
  {
    entryPath: "scripts/build-reader-index.ts",
    title: "内容索引适配器",
    summary: "把显式资源聚合成稳定的 AppManifest，供查看器或阅读器消费。",
    execute: buildReaderIndexArtifacts,
  },
  {
    entryPath: "scripts/run-consistency-check.ts",
    title: "规则校验适配器",
    summary: "围绕显式真相源输出结构化一致性/规则检查报告。",
    execute: buildConsistencyReportArtifacts,
  },
  {
    entryPath: "scripts/run-review-precheck.ts",
    title: "交付预检适配器",
    summary: "根据显式资源与 AppManifest 产出发布前检查结论。",
    execute: buildReviewPrecheckArtifacts,
  },
];

const SKILL_EXECUTION_ADAPTER_REGISTRY = new Map<string, SkillExecutionAdapter>(
  BUILTIN_WORKSPACE_SKILL_EXECUTORS.map((adapter) => [adapter.entryPath, adapter]),
);

const PRIMARY_CONTENT_TAGS = ["content.primary", "story.chapter"] as const;
const REFERENCE_TAGS = ["domain.reference", "story.canon", "company.knowledge"] as const;
const REPORT_TAGS = ["ops.report", "qa.report"] as const;
const NARRATIVE_CONTEXT_TAGS = ["story.chapter", "story.canon", "story.timeline", "story.foreshadow"] as const;

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

export function listRegisteredSkillExecutionAdapters(): Array<
  Pick<SkillExecutionAdapter, "entryPath" | "title" | "summary">
> {
  return BUILTIN_WORKSPACE_SKILL_EXECUTORS.map((adapter) => ({
    entryPath: adapter.entryPath,
    title: adapter.title,
    summary: adapter.summary,
  }));
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

function usesNarrativeResourceVocabulary(files: WorkspaceSkillFile[]) {
  return filterDeclaredFilesByAnyTag(files, NARRATIVE_CONTEXT_TAGS).length > 0;
}

function resolveSkillResultLabels(files: WorkspaceSkillFile[]) {
  if (usesNarrativeResourceVocabulary(files)) {
    return {
      appLabel: "阅读器",
      contentLabel: "正文",
      referenceLabel: "设定",
      referenceTruthLabel: "设定真相源",
      reportLabel: "过程报告",
      precheckContentLabel: "可发布正文",
      precheckReferenceLabel: "共享设定/真相源",
    };
  }
  return {
    appLabel: "查看器",
    contentLabel: "主体内容",
    referenceLabel: "参考资料",
    referenceTruthLabel: "关键参考资料",
    reportLabel: "最近检查报告",
    precheckContentLabel: "可交付主体内容",
    precheckReferenceLabel: "关键参考资料/真相源",
  };
}

function buildConsistencyAnchors(files: WorkspaceSkillFile[]) {
  const labels = resolveSkillResultLabels(files);
  const contentFiles = filterDeclaredFilesByAnyTag(files, PRIMARY_CONTENT_TAGS);
  const referenceFiles = filterDeclaredFilesByAnyTag(files, REFERENCE_TAGS);
  const reportFiles = filterDeclaredFilesByAnyTag(files, REPORT_TAGS);
  return [
    { id: "content", label: `${labels.contentLabel}样本`, found: contentFiles.length > 0 },
    { id: "reference", label: labels.referenceTruthLabel, found: referenceFiles.length > 0 },
    { id: "report", label: labels.reportLabel, found: reportFiles.length > 0 },
  ];
}

function buildReaderIndexArtifacts(input: ExecuteWorkspaceSkillInput): ExecuteWorkspaceSkillResult {
  const app = input.app;
  if (!app) {
    throw new Error("内容索引 Skill 缺少对应 App，当前无法写回 AppManifest。");
  }
  const labels = resolveSkillResultLabels(input.files);
  const draft = buildWorkspaceAppManifestDraft({
    app,
    files: filterDeclaredFiles(input.files),
    title: `${input.company.name} · ${app.title} AppManifest`,
    sourceLabel: "Skill 构建",
  });
  if (!draft) {
    throw new Error(
      `当前公司还没有足够明确的正式${labels.contentLabel}、${labels.referenceLabel}或报告资源，无法生成${labels.appLabel} AppManifest。请先把推断资源发布为正式资源。`,
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
    summary: `${input.skill.title} 已生成新的 AppManifest，${labels.appLabel}会优先按这份结果消费${labels.contentLabel}、${labels.referenceLabel}和报告。`,
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
    runSummary: `${input.company.name} 的${labels.appLabel}索引已重建，新的 AppManifest 会覆盖旧入口配置。`,
    successTitle: `已重建${labels.appLabel} AppManifest`,
    successDetail: `${labels.appLabel}现在会优先读取这次能力产出的显式资源索引。`,
  };
}

function buildConsistencyReportArtifacts(input: ExecuteWorkspaceSkillInput): ExecuteWorkspaceSkillResult {
  const labels = resolveSkillResultLabels(input.files);
  const contentFiles = filterDeclaredFilesByAnyTag(input.files, PRIMARY_CONTENT_TAGS);
  const referenceFiles = filterDeclaredFilesByAnyTag(input.files, REFERENCE_TAGS);
  const reportFiles = filterDeclaredFilesByAnyTag(input.files, REPORT_TAGS);
  const anchors = buildConsistencyAnchors(input.files);
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
      `- ${labels.contentLabel}：${contentFiles.length} 份`,
      `- ${labels.referenceLabel}：${referenceFiles.length} 份`,
      `- 报告：${reportFiles.length} 份`,
      `- 锚点状态：${anchors.filter((anchor) => anchor.found).length}/${anchors.length} 已具备`,
      "",
      "## 缺口判断",
      missingAnchors.length > 0
        ? `待补齐：${missingAnchors.map((anchor) => anchor.label).join("、")}`
        : "当前关键真相源与检查基础已具备，可以继续接入更细的规则校验。",
      "",
      "## 当前可用资源",
      contentFiles.length > 0
        ? `- ${labels.contentLabel}样本：${listFileNames(contentFiles)}`
        : `- 还没有稳定${labels.contentLabel}样本`,
      referenceFiles.length > 0
        ? `- ${labels.referenceTruthLabel}：${listFileNames(referenceFiles)}`
        : `- 还没有稳定${labels.referenceTruthLabel}可供校验`,
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
  const labels = resolveSkillResultLabels(input.files);
  const contentFiles = filterDeclaredFilesByAnyTag(input.files, PRIMARY_CONTENT_TAGS);
  const referenceFiles = filterDeclaredFilesByAnyTag(input.files, REFERENCE_TAGS);
  const reportFiles = filterDeclaredFilesByAnyTag(input.files, REPORT_TAGS);
  const blockers: string[] = [];
  if (contentFiles.length === 0) {
    blockers.push(`缺少${labels.precheckContentLabel}`);
  }
  if (referenceFiles.length === 0) {
    blockers.push(`缺少${labels.precheckReferenceLabel}`);
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
      `- ${labels.contentLabel}：${contentFiles.length} 份`,
      `- ${labels.referenceLabel}：${referenceFiles.length} 份`,
      `- 报告：${reportFiles.length} 份`,
      `- AppManifest：${input.manifest ? "已接入" : "未接入"}`,
      "",
      "## 阻塞项",
      blockers.length > 0 ? blockers.map((item) => `- ${item}`).join("\n") : "- 当前没有发现阻塞项",
      "",
      "## 最近可回看产物",
      contentFiles.length > 0
        ? `- ${labels.contentLabel}：${listFileNames(contentFiles)}`
        : `- ${labels.contentLabel}仍待产出`,
      referenceFiles.length > 0
        ? `- ${labels.referenceLabel}：${listFileNames(referenceFiles)}`
        : `- ${labels.referenceLabel}仍待固化`,
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
