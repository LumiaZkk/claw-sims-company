import type { ArtifactRecord, ArtifactResourceType } from "../../domain/artifact/types";
import type { CompanyWorkspaceApp } from "../../domain/org/types";
import type { WorkspaceResourceOrigin } from "./index";

type AppManifestWorkspaceFile = {
  artifactId?: string;
  key: string;
  name: string;
  path: string;
  previewText?: string;
  resourceType: ArtifactResourceType;
  tags: string[];
  resourceOrigin?: WorkspaceResourceOrigin;
};

export type WorkspaceAppManifestSelector = {
  resourceTypes?: ArtifactResourceType[];
  tags?: string[];
};

export type WorkspaceAppManifestSection = {
  id: string;
  label: string;
  slot: string;
  order: number;
  selectors: WorkspaceAppManifestSelector[];
  emptyState?: string;
};

export type WorkspaceAppManifestResource = {
  id: string;
  slot: string;
  title?: string;
  summary?: string;
  artifactId?: string;
  sourcePath?: string;
  sourceName?: string;
  resourceType?: ArtifactResourceType;
  tags?: string[];
};

export type WorkspaceAppManifestAction = {
  id: string;
  label: string;
  actionType:
    | "request_capability"
    | "open_chat"
    | "refresh_manifest"
    | "trigger_capability"
    | "report_issue"
    | "open_resource"
    | "workbench_request"
    | "trigger_skill";
  target: string;
  input?: Record<string, unknown>;
};

export type WorkspaceAppManifest = {
  version: 1;
  appId?: string;
  appSlug?: string;
  title?: string;
  sourceLabel?: string;
  draft?: boolean;
  sections: WorkspaceAppManifestSection[];
  resources?: WorkspaceAppManifestResource[];
  actions?: WorkspaceAppManifestAction[];
};

export type WorkspaceAppManifestRegistrationMeta = {
  appId?: string;
  appSlug?: string;
  title?: string;
  sourceLabel?: string;
};

type LegacyReaderManifestResourceKind = "chapter" | "canon" | "review";

type LegacyReaderManifestEntry = {
  id: string;
  kind: LegacyReaderManifestResourceKind;
  title?: string;
  summary?: string;
  artifactId?: string;
  sourcePath?: string;
  sourceName?: string;
};

type LegacyReaderManifest = {
  version: 1;
  title?: string;
  items: LegacyReaderManifestEntry[];
  sourceLabel?: string;
  draft?: boolean;
};

const APP_MANIFEST_FILE_PATTERN = /(?:workspace-|company-)?app-manifest(?:\.[a-z0-9-]+)?\.json$/i;
const READER_MANIFEST_FILE_PATTERN = /(workspace-|novel-)?reader-index\.json$/i;
const MANAGED_WORKSPACE_CONTROL_FILE_NAMES = new Set([
  "company-context.json",
  "department-context.json",
  "collaboration-context.json",
  "operations.md",
  "department-operations.md",
]);

const PRIMARY_CONTENT_TAGS = ["content.primary", "story.chapter"] as const;
const REFERENCE_TAGS = ["domain.reference", "story.canon", "company.knowledge"] as const;
const REPORT_TAGS = ["ops.report", "qa.report"] as const;

function looksLikeNovelApp(app: Pick<CompanyWorkspaceApp, "template" | "title" | "slug">) {
  const haystack = `${app.title} ${app.slug}`.trim();
  return /小说|章节|正文|设定|审校|伏笔|novel|chapter|canon/i.test(haystack);
}

function buildPresetSections(
  app: Pick<CompanyWorkspaceApp, "template" | "title" | "slug">,
): WorkspaceAppManifestSection[] {
  const novelLike = looksLikeNovelApp(app);
  switch (app.template) {
    case "reader":
      return [
        {
          id: "reader-content",
          label: novelLike ? "正文" : "内容",
          slot: "content",
          order: 0,
          selectors: [{ tags: [...PRIMARY_CONTENT_TAGS] }],
          emptyState: novelLike ? "当前还没有可阅读的正文。" : "当前还没有可阅读的主体内容。",
        },
        {
          id: "reader-reference",
          label: novelLike ? "设定" : "参考",
          slot: "reference",
          order: 1,
          selectors: [{ tags: [...REFERENCE_TAGS] }],
          emptyState: novelLike ? "当前还没有可对照的设定文件。" : "当前还没有可对照的参考资料。",
        },
        {
          id: "reader-reports",
          label: "报告",
          slot: "reports",
          order: 2,
          selectors: [{ tags: [...REPORT_TAGS] }, { resourceTypes: ["report"] }],
          emptyState: novelLike ? "当前还没有审校或验收报告。" : "当前还没有可回看的检查或验收报告。",
        },
      ];
    case "consistency":
      return [
        {
          id: "consistency-truth",
          label: novelLike ? "真相源" : "规则参考",
          slot: "truth",
          order: 0,
          selectors: [{ tags: [...REFERENCE_TAGS] }, { resourceTypes: ["document", "dataset"] }],
        },
        {
          id: "consistency-reports",
          label: novelLike ? "过程报告" : "检查报告",
          slot: "reports",
          order: 1,
          selectors: [{ tags: [...REPORT_TAGS] }, { resourceTypes: ["report"] }],
        },
        {
          id: "consistency-tools",
          label: "工具脚本",
          slot: "tools",
          order: 2,
          selectors: [{ resourceTypes: ["tool"], tags: ["tech.tool"] }],
        },
      ];
    case "knowledge":
      return [
        {
          id: "knowledge-sources",
          label: "来源与依据",
          slot: "sources",
          order: 0,
          selectors: [{ tags: ["company.knowledge", "domain.reference"] }, { tags: [...REPORT_TAGS] }],
        },
      ];
    case "workbench":
      return [];
    case "review-console":
      return [
        {
          id: "review-console-reports",
          label: "审阅报告",
          slot: "reports",
          order: 0,
          selectors: [{ tags: [...REPORT_TAGS] }, { resourceTypes: ["report"] }],
        },
      ];
    case "dashboard":
      return [
        {
          id: "dashboard-state",
          label: "状态数据",
          slot: "state",
          order: 0,
          selectors: [{ resourceTypes: ["state", "dataset"] }],
        },
      ];
    case "generic-app":
      return [
        {
          id: "app-content",
          label: "资源",
          slot: "content",
          order: 0,
          selectors: [{ resourceTypes: ["document", "report", "dataset", "state", "media"] }],
        },
      ];
    default:
      return [];
  }
}

function buildPresetActions(
  app: Pick<CompanyWorkspaceApp, "template" | "title" | "slug">,
): WorkspaceAppManifestAction[] {
  const novelLike = looksLikeNovelApp(app);
  switch (app.template) {
    case "reader":
      return [
        {
          id: "trigger-reader-index",
          label: novelLike ? "重建阅读索引" : "重建内容索引",
          actionType: "trigger_capability",
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
          label: novelLike ? "反馈阅读器问题" : "反馈查看器问题",
          actionType: "report_issue",
          target: "reader.build-index",
          input: { type: "bad_result" },
        },
      ];
    case "consistency":
      return [
        {
          id: "trigger-consistency-check",
          label: "执行一致性检查",
          actionType: "trigger_capability",
          target: "consistency.check",
        },
        {
          id: "request-consistency-checker",
          label: novelLike ? "申请补齐一致性能力" : "申请补齐规则校验能力",
          actionType: "request_capability",
          target: "consistency-checker",
        },
        {
          id: "report-consistency-issue",
          label: "反馈检查结果异常",
          actionType: "report_issue",
          target: "consistency.check",
          input: { type: "bad_result" },
        },
      ];
    case "review-console":
      return [
        {
          id: "trigger-review-precheck",
          label: "执行发布前检查",
          actionType: "trigger_capability",
          target: "review.precheck",
        },
        {
          id: "request-review-console",
          label: novelLike ? "申请补齐审阅能力" : "申请补齐审阅与预检 App",
          actionType: "request_capability",
          target: "chapter-review-console",
        },
        {
          id: "report-review-precheck-issue",
          label: "反馈预检结果异常",
          actionType: "report_issue",
          target: "review.precheck",
          input: { type: "bad_result" },
        },
      ];
    case "dashboard":
      return [
        {
          id: "report-dashboard-issue",
          label: "反馈仪表盘问题",
          actionType: "report_issue",
          target: "dashboard",
          input: { type: "runtime_error" },
        },
      ];
    case "workbench":
      return [
        { id: "open-cto-chat", label: "打开 CTO 会话", actionType: "open_chat", target: "cto" },
      ];
    case "generic-app":
      return [
        {
          id: "report-generic-app-issue",
          label: "反馈 App 问题",
          actionType: "report_issue",
          target: "generic-app",
          input: { type: "runtime_error" },
        },
      ];
    default:
      return [];
  }
}

export function buildPresetWorkspaceAppManifest(input: {
  app: Pick<CompanyWorkspaceApp, "id" | "slug" | "title" | "template">;
  title?: string;
  sourceLabel?: string;
  draft?: boolean;
  sections?: WorkspaceAppManifestSection[];
  resources?: WorkspaceAppManifestResource[];
  actions?: WorkspaceAppManifestAction[];
}) {
  const sections = input.sections ?? buildPresetSections(input.app);
  const actions = input.actions ?? buildPresetActions(input.app);
  return {
    version: 1,
    appId: input.app.id,
    appSlug: input.app.slug,
    title: input.title ?? input.app.title,
    sourceLabel: input.sourceLabel,
    draft: input.draft,
    sections,
    resources: input.resources?.length ? input.resources : undefined,
    actions: actions.length > 0 ? actions : undefined,
  } satisfies WorkspaceAppManifest;
}

function mergeWorkspaceManifestActions(
  presetActions: WorkspaceAppManifestAction[],
  explicitActions?: WorkspaceAppManifestAction[],
) {
  if (!explicitActions?.length) {
    return presetActions;
  }
  const actionOrder: string[] = [];
  const actionsById = new Map<string, WorkspaceAppManifestAction>();

  for (const action of presetActions) {
    actionOrder.push(action.id);
    actionsById.set(action.id, action);
  }
  for (const action of explicitActions) {
    if (!actionsById.has(action.id)) {
      actionOrder.push(action.id);
    }
    actionsById.set(action.id, action);
  }

  return actionOrder
    .map((id) => actionsById.get(id) ?? null)
    .filter((action): action is WorkspaceAppManifestAction => Boolean(action));
}

export function buildWorkspaceAppManifestTemplate(input: {
  app: Pick<CompanyWorkspaceApp, "id" | "slug" | "title" | "template">;
  title?: string;
  sourceLabel?: string;
  draft?: boolean;
  sections?: WorkspaceAppManifestSection[];
  resources?: WorkspaceAppManifestResource[];
  actions?: WorkspaceAppManifestAction[];
}): WorkspaceAppManifest {
  return {
    version: 1,
    appId: input.app.id,
    appSlug: input.app.slug,
    title: input.title ?? input.app.title,
    sourceLabel: input.sourceLabel,
    draft: input.draft,
    sections: input.sections ?? [],
    resources: input.resources?.length ? input.resources : undefined,
    actions: input.actions?.length ? input.actions : undefined,
  };
}

function isManifestArtifactCandidate(input: {
  name?: string | null;
  path?: string | null;
  kind?: string | null;
}) {
  const haystack = `${input.name ?? ""} ${input.path ?? ""}`.trim();
  return (
    input.kind === "app_manifest" ||
    APP_MANIFEST_FILE_PATTERN.test(haystack) ||
    READER_MANIFEST_FILE_PATTERN.test(haystack)
  );
}

function isFormalManifestArtifactSource(artifact: Pick<ArtifactRecord, "id">) {
  return !artifact.id.startsWith("workspace:");
}

function isManifestArtifactCandidateForApp(
  input: {
    name?: string | null;
    path?: string | null;
    kind?: string | null;
  },
  app: Pick<CompanyWorkspaceApp, "slug" | "template">,
) {
  if (!isManifestArtifactCandidate(input)) {
    return false;
  }
  const haystack = `${input.name ?? ""} ${input.path ?? ""}`.toLowerCase();
  if (app.slug && haystack.includes(app.slug.toLowerCase())) {
    return true;
  }
  if (app.template === "reader" && READER_MANIFEST_FILE_PATTERN.test(haystack)) {
    return true;
  }
  return false;
}

function tagsForLegacyKind(kind: LegacyReaderManifestResourceKind) {
  switch (kind) {
    case "chapter":
      return {
        resourceType: "document" as const,
        tags: ["content.primary", "story.chapter", "company.resource"],
      };
    case "canon":
      return {
        resourceType: "document" as const,
        tags: ["domain.reference", "story.canon", "company.resource"],
      };
    case "review":
      return {
        resourceType: "report" as const,
        tags: ["ops.report", "qa.report", "company.resource"],
      };
  }
}

function isManagedWorkspaceControlFile(file: Pick<AppManifestWorkspaceFile, "name" | "path">) {
  const normalizedName = file.name.trim().toLowerCase();
  const normalizedPath = file.path.trim().toLowerCase();
  if (MANAGED_WORKSPACE_CONTROL_FILE_NAMES.has(normalizedName)) {
    return true;
  }
  if (MANAGED_WORKSPACE_CONTROL_FILE_NAMES.has(normalizedPath)) {
    return true;
  }
  return normalizedPath.split("/").some((segment) => MANAGED_WORKSPACE_CONTROL_FILE_NAMES.has(segment));
}

function isFormalManifestSourceFile(file: Pick<AppManifestWorkspaceFile, "resourceOrigin">) {
  return file.resourceOrigin === "declared" || file.resourceOrigin === "manifest";
}

function inferDraftSlot(file: AppManifestWorkspaceFile): { slot: string; resourceType: ArtifactResourceType; tags: string[] } | null {
  if (isManagedWorkspaceControlFile(file)) {
    return null;
  }

  const haystack = `${file.name} ${file.path} ${file.previewText ?? ""}`.toLowerCase();
  if (file.tags.some((tag) => PRIMARY_CONTENT_TAGS.includes(tag as (typeof PRIMARY_CONTENT_TAGS)[number]))) {
    return {
      slot: "content",
      resourceType: file.resourceType === "other" ? "document" : file.resourceType,
      tags: [...new Set(["content.primary", "company.resource", ...file.tags])],
    };
  }
  if (file.tags.some((tag) => REFERENCE_TAGS.includes(tag as (typeof REFERENCE_TAGS)[number]))) {
    return {
      slot: "reference",
      resourceType: file.resourceType === "other" ? "document" : file.resourceType,
      tags: [...new Set(["domain.reference", "company.resource", ...file.tags])],
    };
  }
  if (file.tags.some((tag) => REPORT_TAGS.includes(tag as (typeof REPORT_TAGS)[number])) || file.resourceType === "report") {
    return {
      slot: "reports",
      resourceType: "report",
      tags: [...new Set(["ops.report", "qa.report", "company.resource", ...file.tags])],
    };
  }
  if (/(第?\s*\d+\s*章|chapter|chapters\/|正文|剧情|段落)/i.test(haystack)) {
    return {
      slot: "content",
      resourceType: "document",
      tags: ["content.primary", "story.chapter", "company.resource"],
    };
  }
  if (
    /(设定|人物|时间线|伏笔|世界观|canon|timeline|character|world|reference|guide|manual|architecture|system-architecture|blueprint|技术架构|技术底座|架构|说明书|手册|规格)/i.test(
      haystack,
    )
  ) {
    const tags = new Set<string>(["domain.reference", "story.canon", "company.resource"]);
    if (/(时间线|timeline)/i.test(haystack)) {
      tags.add("story.timeline");
    }
    if (/(伏笔|foreshadow)/i.test(haystack)) {
      tags.add("story.foreshadow");
    }
    return { slot: "reference", resourceType: "document", tags: [...tags] };
  }
  if (
    /(审校|review|报告|验收|检查|check|summary|总结|precheck|assessment|plan|playbook|ops|operations|运营|流程|注册|登录|发布|复盘|incident)/i.test(
      haystack,
    )
  ) {
    return {
      slot: "reports",
      resourceType: "report",
      tags: ["ops.report", "qa.report", "company.resource"],
    };
  }
  if (/(^|\/)docs\//i.test(file.path) && /\.(md|mdx|txt)$/i.test(file.path)) {
    return {
      slot: "reference",
      resourceType: "document",
      tags: ["domain.reference", "company.knowledge", "company.resource"],
    };
  }
  return null;
}

function parseLegacyReaderManifest(
  content: string,
  app: Pick<CompanyWorkspaceApp, "id" | "slug" | "title" | "template">,
  sourceLabel?: string,
): WorkspaceAppManifest | null {
  try {
    const parsed = JSON.parse(content) as Partial<LegacyReaderManifest>;
    if (!Array.isArray(parsed.items) || parsed.items.length === 0) {
      return null;
    }
    const resources = parsed.items.reduce<WorkspaceAppManifestResource[]>((acc, item, index) => {
      if (!item || typeof item !== "object" || !item.kind) {
        return acc;
      }
      const descriptor = tagsForLegacyKind(item.kind);
      acc.push({
        id: typeof item.id === "string" ? item.id : `reader-resource-${index + 1}`,
        slot:
          item.kind === "chapter"
            ? "content"
            : item.kind === "canon"
              ? "reference"
              : "reports",
        title: item.title,
        summary: item.summary,
        artifactId: item.artifactId,
        sourcePath: item.sourcePath,
        sourceName: item.sourceName,
        resourceType: descriptor.resourceType,
        tags: descriptor.tags,
      });
      return acc;
    }, []);
    return {
      ...buildPresetWorkspaceAppManifest({
        app,
        title: typeof parsed.title === "string" ? parsed.title : undefined,
        sourceLabel:
          typeof parsed.sourceLabel === "string" && parsed.sourceLabel.trim().length > 0
            ? parsed.sourceLabel
            : sourceLabel,
        draft: parsed.draft === true || parsed.sourceLabel === "系统草案",
        resources,
      }),
    };
  } catch {
    return null;
  }
}

function looksLikeExplicitWorkspaceAppManifest(parsed: Partial<WorkspaceAppManifest>) {
  return (
    typeof parsed.appId === "string" ||
    typeof parsed.appSlug === "string" ||
    Array.isArray(parsed.sections) ||
    Array.isArray(parsed.resources) ||
    Array.isArray(parsed.actions)
  );
}

function parseWorkspaceAppManifestContent(
  content: string,
  app: Pick<CompanyWorkspaceApp, "id" | "slug" | "title" | "template">,
  sourceLabel?: string,
): WorkspaceAppManifest | null {
  try {
    const parsed = JSON.parse(content) as Partial<WorkspaceAppManifest>;
    if (!parsed || typeof parsed !== "object") {
      return null;
    }
    const sections = Array.isArray(parsed.sections)
      ? parsed.sections.reduce<WorkspaceAppManifestSection[]>((acc, section, index) => {
          if (!section || typeof section !== "object") {
            return acc;
          }
          const candidate = section as Partial<WorkspaceAppManifestSection>;
          if (
            typeof candidate.id !== "string" ||
            typeof candidate.label !== "string" ||
            typeof candidate.slot !== "string"
          ) {
            return acc;
          }
          acc.push({
            id: candidate.id,
            label: candidate.label,
            slot: candidate.slot,
            order: typeof candidate.order === "number" ? candidate.order : index,
            selectors: Array.isArray(candidate.selectors)
              ? candidate.selectors.filter(Boolean).map((selector) => ({
                  resourceTypes: Array.isArray(selector?.resourceTypes)
                    ? selector.resourceTypes.filter((item): item is ArtifactResourceType => typeof item === "string")
                    : undefined,
                  tags: Array.isArray(selector?.tags)
                    ? selector.tags.filter((item): item is string => typeof item === "string")
                    : undefined,
                }))
              : [],
            emptyState: typeof candidate.emptyState === "string" ? candidate.emptyState : undefined,
          });
          return acc;
        }, [])
      : [];

    const resources = Array.isArray(parsed.resources)
      ? parsed.resources.reduce<WorkspaceAppManifestResource[]>((acc, resource, index) => {
          if (!resource || typeof resource !== "object") {
            return acc;
          }
          const candidate = resource as Partial<WorkspaceAppManifestResource>;
          if (typeof candidate.slot !== "string") {
            return acc;
          }
          acc.push({
            id: typeof candidate.id === "string" ? candidate.id : `manifest-resource-${index + 1}`,
            slot: candidate.slot,
            title: typeof candidate.title === "string" ? candidate.title : undefined,
            summary: typeof candidate.summary === "string" ? candidate.summary : undefined,
            artifactId: typeof candidate.artifactId === "string" ? candidate.artifactId : undefined,
            sourcePath: typeof candidate.sourcePath === "string" ? candidate.sourcePath : undefined,
            sourceName: typeof candidate.sourceName === "string" ? candidate.sourceName : undefined,
            resourceType: typeof candidate.resourceType === "string" ? candidate.resourceType : undefined,
            tags: Array.isArray(candidate.tags)
              ? candidate.tags.filter((item): item is string => typeof item === "string")
              : undefined,
          });
          return acc;
        }, [])
      : [];

    const explicitActions = Array.isArray(parsed.actions)
      ? parsed.actions.reduce<WorkspaceAppManifestAction[]>((acc, action) => {
          if (!action || typeof action !== "object") {
            return acc;
          }
          const candidate = action as Partial<WorkspaceAppManifestAction>;
          if (
            typeof candidate.id !== "string" ||
            typeof candidate.label !== "string" ||
            typeof candidate.actionType !== "string" ||
            typeof candidate.target !== "string"
          ) {
            return acc;
          }
          acc.push({
            id: candidate.id,
            label: candidate.label,
            actionType: candidate.actionType,
            target: candidate.target,
            input: candidate.input && typeof candidate.input === "object" ? candidate.input : undefined,
          });
          return acc;
        }, [])
      : [];
    const actions = mergeWorkspaceManifestActions(buildPresetActions(app), explicitActions);
    const explicitManifest = looksLikeExplicitWorkspaceAppManifest(parsed);
    if (sections.length === 0) {
      if (!explicitManifest) {
        return parseLegacyReaderManifest(content, app, sourceLabel);
      }
      return buildWorkspaceAppManifestTemplate({
        app,
        title: typeof parsed.title === "string" ? parsed.title : undefined,
        sourceLabel:
          typeof parsed.sourceLabel === "string" && parsed.sourceLabel.trim().length > 0
            ? parsed.sourceLabel
            : sourceLabel,
        draft: parsed.draft === true || parsed.sourceLabel === "系统草案",
        resources,
        actions,
      });
    }

    return buildWorkspaceAppManifestTemplate({
      app,
      title: typeof parsed.title === "string" ? parsed.title : undefined,
      sourceLabel:
        typeof parsed.sourceLabel === "string" && parsed.sourceLabel.trim().length > 0
          ? parsed.sourceLabel
          : sourceLabel,
      draft: parsed.draft === true || parsed.sourceLabel === "系统草案",
      sections,
      resources,
      actions,
    });
  } catch {
    return parseLegacyReaderManifest(content, app, sourceLabel);
  }
}

export function readWorkspaceAppManifestRegistrationMeta(
  content: string,
): WorkspaceAppManifestRegistrationMeta | null {
  try {
    const parsed = JSON.parse(content) as Partial<WorkspaceAppManifest>;
    if (!parsed || typeof parsed !== "object") {
      return null;
    }
    return {
      appId: typeof parsed.appId === "string" ? parsed.appId : undefined,
      appSlug: typeof parsed.appSlug === "string" ? parsed.appSlug : undefined,
      title: typeof parsed.title === "string" ? parsed.title : undefined,
      sourceLabel: typeof parsed.sourceLabel === "string" ? parsed.sourceLabel : undefined,
    };
  } catch {
    return null;
  }
}

function matchesManifestResource(
  file: Pick<AppManifestWorkspaceFile, "artifactId" | "path" | "name">,
  resource: WorkspaceAppManifestResource,
) {
  if (resource.artifactId && file.artifactId === resource.artifactId) {
    return true;
  }
  if (resource.sourcePath && file.path === resource.sourcePath) {
    return true;
  }
  if (resource.sourceName && file.name === resource.sourceName) {
    return true;
  }
  return false;
}

function fileMatchesSelector(file: Pick<AppManifestWorkspaceFile, "resourceType" | "tags">, selector: WorkspaceAppManifestSelector) {
  const resourceTypeMatch =
    !selector.resourceTypes || selector.resourceTypes.length === 0
      ? true
      : selector.resourceTypes.includes(file.resourceType);
  const tagMatch =
    !selector.tags || selector.tags.length === 0
      ? true
      : selector.tags.some((tag) => file.tags.includes(tag));
  return resourceTypeMatch && tagMatch;
}

export function buildWorkspaceAppManifestDraft(input: {
  app: Pick<CompanyWorkspaceApp, "id" | "slug" | "title" | "template">;
  files: AppManifestWorkspaceFile[];
  title?: string;
  sourceLabel?: string;
}): WorkspaceAppManifest | null {
  const resources = input.files.reduce<WorkspaceAppManifestResource[]>((acc, file, index) => {
    if (isManifestArtifactCandidate({ name: file.name, path: file.path })) {
      return acc;
    }
    const descriptor = inferDraftSlot(file);
    if (!descriptor) {
      return acc;
    }
    acc.push({
      id: `draft-resource-${index + 1}`,
      slot: descriptor.slot,
      title: file.name,
      summary: file.previewText,
      artifactId: file.artifactId,
      sourcePath: file.path,
      sourceName: file.name,
      resourceType: descriptor.resourceType,
      tags: descriptor.tags,
    });
    return acc;
  }, []);

  if (resources.length === 0) {
    return null;
  }

  return buildPresetWorkspaceAppManifest({
    app: input.app,
    title: input.title ?? `${input.app.title} AppManifest 草案`,
    sourceLabel: input.sourceLabel ?? "系统草案",
    draft: true,
    resources,
  });
}

export function resolveWorkspaceAppManifest(input: {
  app: Pick<CompanyWorkspaceApp, "id" | "slug" | "title" | "template" | "manifestArtifactId">;
  artifacts: ArtifactRecord[];
  files: AppManifestWorkspaceFile[];
}): WorkspaceAppManifest | null {
  const directArtifact =
    input.app.manifestArtifactId
      ? input.artifacts.find(
          (artifact) => artifact.id === input.app.manifestArtifactId && isFormalManifestArtifactSource(artifact),
        ) ?? null
      : null;
  if (directArtifact) {
    const manifest = parseWorkspaceAppManifestContent(
      directArtifact.content ?? "",
      input.app,
      directArtifact.sourceName ?? directArtifact.title,
    );
    if (manifest) {
      return manifest;
    }
  }

  const artifactCandidates = input.artifacts
    .filter((artifact) => isFormalManifestArtifactSource(artifact))
    .filter((artifact) =>
      isManifestArtifactCandidateForApp(
        {
          name: artifact.sourceName ?? artifact.title,
          path: artifact.sourcePath ?? artifact.sourceUrl,
          kind: artifact.kind,
        },
        input.app,
      ),
    )
    .sort((left, right) => right.updatedAt - left.updatedAt);
  for (const artifact of artifactCandidates) {
    const manifest = parseWorkspaceAppManifestContent(
      artifact.content ?? "",
      input.app,
      artifact.sourceName ?? artifact.title,
    );
    if (manifest) {
      return manifest;
    }
  }

  const fileCandidates = input.files
    .filter((file) =>
      isFormalManifestSourceFile(file)
      && isManifestArtifactCandidateForApp({ name: file.name, path: file.path }, input.app),
    )
    .sort((left, right) => right.path.localeCompare(left.path));
  for (const file of fileCandidates) {
    const manifest = parseWorkspaceAppManifestContent(file.previewText ?? "", input.app, file.name);
    if (manifest) {
      return manifest;
    }
  }

  return null;
}

export function applyWorkspaceAppManifest<T extends AppManifestWorkspaceFile>(
  files: T[],
  manifest: WorkspaceAppManifest,
): T[] {
  return files.map((file) => {
    const resource = manifest.resources?.find((candidate) => matchesManifestResource(file, candidate));
    if (!resource) {
      return file;
    }
    const nextTags = new Set([...(file.tags ?? []), ...(resource.tags ?? [])]);
    return {
      ...file,
      name: resource.title ?? file.name,
      previewText: resource.summary ?? file.previewText,
      resourceType: resource.resourceType ?? file.resourceType,
      tags: [...nextTags],
      resourceOrigin: "manifest",
    };
  });
}

export function isWorkspaceAppManifestDraft(manifest: WorkspaceAppManifest | null | undefined) {
  return Boolean(manifest?.draft || manifest?.sourceLabel === "系统草案");
}

export function getWorkspaceAppFilesForSection<T extends AppManifestWorkspaceFile>(
  files: T[],
  manifest: WorkspaceAppManifest,
  slot: string,
): T[] {
  const section = manifest.sections.find((candidate) => candidate.slot === slot);
  if (!section) {
    return [];
  }
  const seen = new Set<string>();
  return files
    .filter((file) => section.selectors.some((selector) => fileMatchesSelector(file, selector)))
    .filter((file) => {
      if (seen.has(file.key)) {
        return false;
      }
      seen.add(file.key);
      return true;
    });
}
