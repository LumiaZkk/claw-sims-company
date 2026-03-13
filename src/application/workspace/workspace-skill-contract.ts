import type { ArtifactResourceType } from "../../domain/artifact/types";
import type {
  Company,
  CompanyWorkspaceApp,
  SkillDefinition,
  SkillRunTrigger,
} from "../../domain/org/types";
import type { WorkspaceAppManifest } from "./app-manifest";
import type { WorkspaceResourceOrigin } from "./index";
import type { WorkspaceSkillFile } from "./skill-executor";

type WorkspaceSkillInputTypeCount = {
  resourceType: ArtifactResourceType;
  count: number;
};

export type WorkspaceSkillExecutionInputResource = {
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

export type WorkspaceSkillExecutionInput = {
  version: 1;
  requestedAt: number;
  company: {
    id: string;
    name: string;
    template: string;
  };
  skill: {
    id: string;
    title: string;
    summary: string;
    entryPath: string;
    allowedTriggers: SkillDefinition["allowedTriggers"];
    writesResourceTypes: ArtifactResourceType[];
    manifestActionIds?: string[];
    appIds?: string[];
  };
  app?: {
    id: string;
    slug: string;
    title: string;
    template?: CompanyWorkspaceApp["template"];
    surface?: CompanyWorkspaceApp["surface"];
    manifestArtifactId?: string | null;
  } | null;
  manifest?: {
    appId?: string;
    appSlug?: string;
    title?: string;
    draft?: boolean;
    sectionIds: string[];
    actionIds: string[];
  } | null;
  workItem?: {
    id: string;
  } | null;
  trigger: {
    type: SkillRunTrigger;
    actionId?: string | null;
    label: string;
    requestedByActorId?: string | null;
    requestedByLabel?: string | null;
  };
  resources: {
    count: number;
    byType: WorkspaceSkillInputTypeCount[];
    entries: WorkspaceSkillExecutionInputResource[];
  };
};

const RESOURCE_TYPE_LABELS: Record<ArtifactResourceType, string> = {
  document: "文档",
  report: "报告",
  dataset: "数据",
  media: "媒体",
  state: "状态",
  tool: "工具",
  other: "其他",
};

function buildWorkspaceSkillInputTypeCounts(
  files: WorkspaceSkillFile[],
): WorkspaceSkillInputTypeCount[] {
  const counts = new Map<ArtifactResourceType, number>();
  for (const file of files) {
    counts.set(file.resourceType, (counts.get(file.resourceType) ?? 0) + 1);
  }
  return [...counts.entries()]
    .map(([resourceType, count]) => ({ resourceType, count }))
    .sort((left, right) => right.count - left.count || left.resourceType.localeCompare(right.resourceType));
}

export function buildWorkspaceSkillExecutionInput(input: {
  company: Company;
  skill: SkillDefinition;
  app: CompanyWorkspaceApp | null;
  manifest: WorkspaceAppManifest | null;
  files: WorkspaceSkillFile[];
  workItemId?: string | null;
  requestedByActorId?: string | null;
  requestedByLabel?: string | null;
  triggerType: SkillRunTrigger;
  triggerActionId?: string | null;
  triggerLabel: string;
  now: number;
}): WorkspaceSkillExecutionInput {
  return {
    version: 1,
    requestedAt: input.now,
    company: {
      id: input.company.id,
      name: input.company.name,
      template: input.company.template,
    },
    skill: {
      id: input.skill.id,
      title: input.skill.title,
      summary: input.skill.summary,
      entryPath: input.skill.entryPath,
      allowedTriggers: input.skill.allowedTriggers,
      writesResourceTypes: input.skill.writesResourceTypes ?? [],
      manifestActionIds: input.skill.manifestActionIds,
      appIds: input.skill.appIds,
    },
    app: input.app
      ? {
          id: input.app.id,
          slug: input.app.slug,
          title: input.app.title,
          template: input.app.template,
          surface: input.app.surface,
          manifestArtifactId: input.app.manifestArtifactId ?? null,
        }
      : null,
    manifest: input.manifest
      ? {
          appId: input.manifest.appId,
          appSlug: input.manifest.appSlug,
          title: input.manifest.title,
          draft: input.manifest.draft,
          sectionIds: input.manifest.sections.map((section) => section.id),
          actionIds: (input.manifest.actions ?? []).map((action) => action.id),
        }
      : null,
    workItem: input.workItemId ? { id: input.workItemId } : null,
    trigger: {
      type: input.triggerType,
      actionId: input.triggerActionId ?? null,
      label: input.triggerLabel,
      requestedByActorId: input.requestedByActorId ?? null,
      requestedByLabel: input.requestedByLabel ?? null,
    },
    resources: {
      count: input.files.length,
      byType: buildWorkspaceSkillInputTypeCounts(input.files),
      entries: input.files.map((file) => ({
        key: file.key,
        artifactId: file.artifactId,
        name: file.name,
        path: file.path,
        previewText: file.previewText,
        updatedAtMs: file.updatedAtMs,
        resourceType: file.resourceType,
        tags: file.tags,
        resourceOrigin: file.resourceOrigin,
      })),
    },
  };
}

export function summarizeWorkspaceSkillExecutionInput(
  input: WorkspaceSkillExecutionInput,
): string {
  const scopeLabel = input.app?.title ?? input.trigger.label;
  const requestedBy = input.trigger.requestedByLabel ? ` · ${input.trigger.requestedByLabel} 触发` : "";
  const typeSummary =
    input.resources.byType.length > 0
      ? input.resources.byType
          .slice(0, 3)
          .map((item) => `${RESOURCE_TYPE_LABELS[item.resourceType] ?? item.resourceType}${item.count}份`)
          .join("、")
      : "无资源输入";
  return `${input.company.name} · ${scopeLabel} · 输入 ${input.resources.count} 份资源（${typeSummary}）${requestedBy}`;
}

export function listWorkspaceSkillExecutionInputTypes(
  input: WorkspaceSkillExecutionInput,
): ArtifactResourceType[] {
  return input.resources.byType.map((item) => item.resourceType);
}
