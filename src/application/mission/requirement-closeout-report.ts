import {
  buildCapabilityPlatformCloseoutSummary,
  type CapabilityPlatformCloseoutSummary,
  type WorkspaceFileRow,
} from "../workspace";
import { formatKnowledgeKindLabel, resolveCompanyKnowledge } from "../artifact/shared-knowledge";
import { summarizeConsistencyAnchors } from "../company/workspace-apps";
import type { RequirementAggregateRecord } from "../../domain/mission/types";
import type { Company } from "../../domain/org/types";

export type RequirementCloseoutStatus = "ready" | "warning" | "blocked";

export type RequirementCloseoutCheck = {
  id: string;
  label: string;
  status: RequirementCloseoutStatus;
  summary: string;
  detail: string;
};

export type RequirementCloseoutArtifactHighlight = {
  key: string;
  title: string;
  path: string;
  kind: WorkspaceFileRow["kind"];
  updatedAt: number | null;
};

export type RequirementCloseoutKnowledgeHighlight = {
  key: string;
  title: string;
  kindLabel: string;
  summary: string;
  sourcePath: string | null;
  updatedAt: number | null;
};

export type RequirementCloseoutConsistencySummary = {
  status: RequirementCloseoutStatus;
  summary: string;
  detail: string;
  updatedAt: number | null;
  anchorReadyCount: number;
  anchorTotalCount: number;
  missingAnchors: string[];
  reportHighlights: RequirementCloseoutArtifactHighlight[];
};

export type RequirementCloseoutKnowledgeSummary = {
  status: RequirementCloseoutStatus;
  summary: string;
  detail: string;
  updatedAt: number | null;
  itemCount: number;
  acceptedCount: number;
  highlights: RequirementCloseoutKnowledgeHighlight[];
};

export type RequirementCloseoutReport = {
  requirementId: string | null;
  requirementRevision: number | null;
  status: RequirementCloseoutStatus;
  updatedAt: number | null;
  deliverableCount: number;
  traceabilityCount: number;
  blockingReasons: string[];
  advisoryReasons: string[];
  checks: RequirementCloseoutCheck[];
  deliverableHighlights: RequirementCloseoutArtifactHighlight[];
  acceptanceEvidenceHighlights: RequirementCloseoutArtifactHighlight[];
  consistencySummary: RequirementCloseoutConsistencySummary;
  knowledgeSummary: RequirementCloseoutKnowledgeSummary;
  workspaceCloseoutSummary: CapabilityPlatformCloseoutSummary;
};

function rankStatus(status: RequirementCloseoutStatus) {
  if (status === "blocked") {
    return 2;
  }
  if (status === "warning") {
    return 1;
  }
  return 0;
}

function foldRequirementCloseoutStatus(checks: RequirementCloseoutCheck[]): RequirementCloseoutStatus {
  return checks.reduce<RequirementCloseoutStatus>((current, check) => {
    return rankStatus(check.status) > rankStatus(current) ? check.status : current;
  }, "ready");
}

function toArtifactHighlights(files: WorkspaceFileRow[]): RequirementCloseoutArtifactHighlight[] {
  return files.slice(0, 3).map((file) => ({
    key: file.key,
    title: file.name,
    path: file.path,
    kind: file.kind,
    updatedAt: file.updatedAtMs ?? null,
  }));
}

function toKnowledgeHighlights(
  items: ReturnType<typeof resolveCompanyKnowledge>,
): RequirementCloseoutKnowledgeHighlight[] {
  return items.slice(0, 3).map((item) => ({
    key: item.id,
    title: item.title,
    kindLabel: formatKnowledgeKindLabel(item.kind),
    summary: item.summary,
    sourcePath: item.sourcePath ?? item.sourceUrl ?? null,
    updatedAt: item.updatedAt ?? null,
  }));
}

function isConsistencyEvidenceFile(file: WorkspaceFileRow) {
  const haystack = `${file.name} ${file.path} ${file.tags.join(" ")}`.toLowerCase();
  return (
    file.resourceType === "report" &&
    (file.tags.includes("qa.report")
      || file.tags.includes("ops.report")
      || /consistency|precheck|qa|一致性|规则|校验|检查报告|验收前检查/.test(haystack))
  );
}

function buildConsistencySummary(input: {
  workspaceFiles: WorkspaceFileRow[];
  deliverableFiles: WorkspaceFileRow[];
}): RequirementCloseoutConsistencySummary {
  const anchors = summarizeConsistencyAnchors(
    input.workspaceFiles.filter((file) => file.kind === "canon").map((file) => file.name),
  );
  const reportCandidates = [
    ...input.deliverableFiles.filter(isConsistencyEvidenceFile),
    ...input.workspaceFiles.filter(isConsistencyEvidenceFile),
  ];
  const reportHighlights = toArtifactHighlights(
    [...new Map(reportCandidates.map((file) => [file.key, file] as const)).values()].sort(
      (left, right) => (right.updatedAtMs ?? 0) - (left.updatedAtMs ?? 0),
    ),
  );
  const anchorReadyCount = anchors.filter((anchor) => anchor.found).length;
  const missingAnchors = anchors.filter((anchor) => !anchor.found).map((anchor) => anchor.label);
  const hasReports = reportHighlights.length > 0;
  const hasAllAnchors = anchorReadyCount === anchors.length && anchors.length > 0;
  const status: RequirementCloseoutStatus = hasReports && hasAllAnchors ? "ready" : "warning";

  return {
    status,
    summary:
      hasReports
        ? `最近已有 ${reportHighlights.length} 份规则/校验结果可回看，锚点覆盖 ${anchorReadyCount}/${anchors.length}。`
        : `当前还缺少显式规则校验结果，锚点覆盖 ${anchorReadyCount}/${anchors.length}。`,
    detail:
      hasReports
        ? hasAllAnchors
          ? "唯一真相源和最近一次规则检查结果都已经可见，可以直接作为验收前校对依据。"
          : `最近已有规则检查结果，但仍建议补齐 ${missingAnchors.join("、")} 这些唯一真相源锚点。`
        : missingAnchors.length > 0
          ? `建议先补齐 ${missingAnchors.join("、")}，并至少生成一次一致性/预检报告，再决定是否正式通过。`
          : "建议在正式通过前补一份一致性或预检报告，避免只靠人工目测做最终判断。",
    updatedAt: reportHighlights[0]?.updatedAt ?? null,
    anchorReadyCount,
    anchorTotalCount: anchors.length,
    missingAnchors,
    reportHighlights,
  };
}

function buildKnowledgeSummary(input: {
  aggregate: RequirementAggregateRecord | null;
  activeCompany: Company;
  deliverableFiles: WorkspaceFileRow[];
  acceptanceEvidenceHighlights: RequirementCloseoutArtifactHighlight[];
}): RequirementCloseoutKnowledgeSummary {
  const memberIds = new Set(input.aggregate?.memberIds ?? []);
  const deliverableArtifactIds = new Set(
    input.deliverableFiles
      .map((file) => file.artifactId)
      .filter((artifactId): artifactId is string => typeof artifactId === "string"),
  );
  const deliverablePaths = new Set(input.deliverableFiles.map((file) => file.path));
  const allKnowledgeItems = resolveCompanyKnowledge(input.activeCompany);
  const relatedKnowledgeItems = allKnowledgeItems.filter((item) => {
    if (item.sourceArtifactId && deliverableArtifactIds.has(item.sourceArtifactId)) {
      return true;
    }
    if (item.sourcePath && deliverablePaths.has(item.sourcePath)) {
      return true;
    }
    return Boolean(item.sourceAgentId && memberIds.has(item.sourceAgentId));
  });
  const displayKnowledgeItems =
    relatedKnowledgeItems.length > 0 ? relatedKnowledgeItems : allKnowledgeItems.slice(0, 6);
  const acceptedCount = displayKnowledgeItems.filter(
    (item) => item.acceptanceMode === "auto" || item.status === "active" || typeof item.acceptedAt === "number",
  ).length;
  const hasRequirementScopedKnowledge =
    relatedKnowledgeItems.length > 0 || input.acceptanceEvidenceHighlights.length > 0;
  const status: RequirementCloseoutStatus = hasRequirementScopedKnowledge ? "ready" : "warning";

  return {
    status,
    summary:
      hasRequirementScopedKnowledge
        ? `当前已沉淀 ${displayKnowledgeItems.length} 条知识/验收摘要，其中 ${acceptedCount} 条已进入默认可用上下文。`
        : "当前只看到公司级知识基线，还没有和这次需求直接绑定的知识/验收摘要。",
    detail:
      hasRequirementScopedKnowledge
        ? "你可以先核对自动沉淀出的知识摘要，再决定是否直接通过或退回修改。"
        : "建议至少补齐一条和当前需求直接关联的知识卡片、验收摘要或正式报告，让通过结论能回落到可复用的组织知识层。",
    updatedAt: displayKnowledgeItems[0]?.updatedAt ?? input.acceptanceEvidenceHighlights[0]?.updatedAt ?? null,
    itemCount: displayKnowledgeItems.length,
    acceptedCount,
    highlights: toKnowledgeHighlights(displayKnowledgeItems),
  };
}

export function buildRequirementCloseoutReport(input: {
  aggregate: RequirementAggregateRecord | null;
  activeCompany: Company;
  workspaceFiles: WorkspaceFileRow[];
  deliverableFiles: WorkspaceFileRow[];
  requirementTimelineCount: number;
  transcriptPreviewCount: number;
  updatedAtCandidates: number[];
}): RequirementCloseoutReport {
  const workspaceCloseoutSummary = buildCapabilityPlatformCloseoutSummary({
    workspaceApps: input.activeCompany.workspaceApps ?? [],
    workspaceFiles: input.workspaceFiles,
    skillDefinitions: input.activeCompany.skillDefinitions ?? [],
    skillRuns: input.activeCompany.skillRuns ?? [],
    capabilityRequests: input.activeCompany.capabilityRequests ?? [],
    capabilityIssues: input.activeCompany.capabilityIssues ?? [],
    capabilityAuditEvents: input.activeCompany.capabilityAuditEvents ?? [],
    executorProvisioning: input.activeCompany.system?.executorProvisioning ?? null,
  });
  const deliverableCount = input.deliverableFiles.length;
  const traceabilityCount = input.requirementTimelineCount + input.transcriptPreviewCount;
  const evidenceFiles = input.deliverableFiles.filter(
    (file) => file.kind === "review" || file.kind === "knowledge",
  );
  const acceptanceEvidenceHighlights = toArtifactHighlights(evidenceFiles);
  const consistencySummary = buildConsistencySummary({
    workspaceFiles: input.workspaceFiles,
    deliverableFiles: input.deliverableFiles,
  });
  const knowledgeSummary = buildKnowledgeSummary({
    aggregate: input.aggregate,
    activeCompany: input.activeCompany,
    deliverableFiles: input.deliverableFiles,
    acceptanceEvidenceHighlights,
  });
  const blockingWorkspaceChecks = workspaceCloseoutSummary.checks.filter(
    (check) => check.id === "executor-provisioning" && check.status === "attention",
  );
  const attentionWorkspaceChecks = workspaceCloseoutSummary.checks.filter(
    (check) => check.status === "attention",
  );

  const checks: RequirementCloseoutCheck[] = [
    {
      id: "deliverables",
      label: "交付物摘要",
      status: deliverableCount > 0 ? "ready" : "blocked",
      summary:
        deliverableCount > 0
          ? `当前主线已收敛出 ${deliverableCount} 份交付物镜像。`
          : "当前主线还没有稳定的交付物镜像。",
      detail:
        deliverableCount > 0
          ? "Requirement Center 可以直接看到最近的正式文件、报告或知识产物。"
          : "至少需要一份正式交付物后，才能进入正式待验收。",
    },
    {
      id: "traceability",
      label: "来源链路",
      status: traceabilityCount > 0 ? "ready" : "blocked",
      summary:
        traceabilityCount > 0
          ? `当前已有 ${traceabilityCount} 条时间线/协作来源可供回溯。`
          : "当前还看不到稳定的来源链路。",
      detail:
        traceabilityCount > 0
          ? "你可以从需求时间线或需求房回流继续追溯这次交付的来源。"
          : "进入正式验收前，需要至少一条时间线或协作回流来源。",
    },
    {
      id: "acceptance-evidence",
      label: "验收依据",
      status: evidenceFiles.length > 0 ? "ready" : deliverableCount > 0 ? "warning" : "blocked",
      summary:
        evidenceFiles.length > 0
          ? `当前已有 ${evidenceFiles.length} 份报告或知识型验收依据。`
          : deliverableCount > 0
            ? "当前已有交付物，但还缺少报告/知识型验收依据。"
            : "当前还没有可用的验收依据。",
      detail:
        evidenceFiles.length > 0
          ? "建议优先核对报告、知识页或预检结果，再决定是否通过。"
          : "没有结构化报告时仍可继续预览，但通过前应补齐至少一份验收依据。",
    },
    {
      id: "consistency-validation",
      label: "规则校验结果",
      status: consistencySummary.status,
      summary: consistencySummary.summary,
      detail: consistencySummary.detail,
    },
    {
      id: "knowledge-acceptance",
      label: "知识与验收摘要",
      status: knowledgeSummary.status,
      summary: knowledgeSummary.summary,
      detail: knowledgeSummary.detail,
    },
    {
      id: "workspace-closeout",
      label: "Workspace closeout",
      status:
        blockingWorkspaceChecks.length > 0
          ? "blocked"
          : attentionWorkspaceChecks.length > 0
            ? "warning"
            : "ready",
      summary:
        attentionWorkspaceChecks.length > 0
          ? `Workspace 仍有 ${attentionWorkspaceChecks.length} 项待补齐。`
          : "Workspace closeout 当前没有待补齐项。",
      detail:
        attentionWorkspaceChecks.length > 0
          ? attentionWorkspaceChecks[0]?.summary ?? "仍有平台 closeout 项待处理。"
          : "当前交付、资源和能力治理的 closeout 基线已经满足。",
    },
  ];

  const blockingReasons = checks
    .filter((check) => check.status === "blocked")
    .map((check) => `${check.label}：${check.summary}`);
  const advisoryReasons = checks
    .filter((check) => check.status === "warning")
    .map((check) => `${check.label}：${check.summary}`);

  return {
    requirementId: input.aggregate?.id ?? null,
    requirementRevision: input.aggregate?.revision ?? null,
    status: foldRequirementCloseoutStatus(checks),
    updatedAt:
      input.updatedAtCandidates.length > 0
        ? Math.max(...input.updatedAtCandidates)
        : null,
    deliverableCount,
    traceabilityCount,
    blockingReasons,
    advisoryReasons,
    checks,
    deliverableHighlights: toArtifactHighlights(input.deliverableFiles),
    acceptanceEvidenceHighlights,
    consistencySummary,
    knowledgeSummary,
    workspaceCloseoutSummary,
  };
}
