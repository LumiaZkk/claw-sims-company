import type { ArtifactRecord, ArtifactResourceType, ArtifactStatus } from "../../domain/artifact/types";
import type { CompanyWorkspaceApp, SkillDefinition } from "../../domain/org/types";

type SkillArtifactSource = {
  name?: string;
  path?: string;
  url?: string;
};

type BuildSkillResultArtifactInput = {
  id?: string;
  workItemId?: string | null;
  skill: Pick<SkillDefinition, "id" | "ownerAgentId" | "entryPath">;
  app?: Pick<CompanyWorkspaceApp, "id"> | null;
  companyId: string;
  now: number;
  sequence?: number;
  title: string;
  kind?: string;
  status?: ArtifactStatus;
  summary?: string;
  content?: string | null;
  resourceType?: ArtifactResourceType;
  resourceTags?: string[];
  source?: SkillArtifactSource;
  includeCompanyResourceTag?: boolean;
};

function uniqueTags(tags: Array<string | null | undefined>) {
  return [...new Set(tags.filter((tag): tag is string => Boolean(tag && tag.trim().length > 0)))];
}

export function buildSkillResultArtifactId(input: {
  companyId: string;
  skillId: string;
  now: number;
  sequence?: number;
}) {
  const suffix = typeof input.sequence === "number" ? `:${input.sequence}` : "";
  return `skill-result:${input.companyId}:${input.skillId}:${input.now}${suffix}`;
}

function buildDefaultSourcePath(input: { skillId: string; now: number; sequence?: number }) {
  const suffix = typeof input.sequence === "number" ? `-${input.sequence}` : "";
  return `skill-results/${input.skillId}/${input.now}${suffix}.md`;
}

export function buildSkillResultArtifact(input: BuildSkillResultArtifactInput): ArtifactRecord {
  return {
    id:
      input.id
      ?? buildSkillResultArtifactId({
        companyId: input.companyId,
        skillId: input.skill.id,
        now: input.now,
        sequence: input.sequence,
      }),
    workItemId: input.workItemId ?? null,
    title: input.title,
    kind: input.kind ?? "skill_result",
    status: input.status ?? "ready",
    ownerActorId: input.skill.ownerAgentId,
    sourceActorId: input.skill.ownerAgentId,
    sourceName: input.source?.name ?? input.skill.entryPath ?? input.title,
    sourcePath:
      input.source?.path
      ?? buildDefaultSourcePath({
        skillId: input.skill.id,
        now: input.now,
        sequence: input.sequence,
      }),
    sourceUrl: input.source?.url,
    summary: input.summary,
    content: input.content ?? null,
    resourceType: input.resourceType ?? "state",
    resourceTags: uniqueTags([
      input.includeCompanyResourceTag === false ? null : "company.resource",
      "tech.skill-result",
      `skill.${input.skill.id}`,
      input.app ? `app.${input.app.id}` : null,
      ...(input.resourceTags ?? []),
    ]),
    createdAt: input.now,
    updatedAt: input.now,
  };
}

export type { SkillArtifactSource, BuildSkillResultArtifactInput };
