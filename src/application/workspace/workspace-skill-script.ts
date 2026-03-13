import type { ArtifactResourceType } from "../../domain/artifact/types";
import type { Company, CompanyWorkspaceApp, SkillDefinition } from "../../domain/org/types";
import type { AuthorityAgentFileRunResponse } from "../../infrastructure/authority/contract";
import type { ExecuteWorkspaceSkillResult } from "./skill-executor";
import { buildSkillResultArtifact } from "./skill-result-artifact";

type WorkspaceSkillScriptArtifactPayload = {
  id?: string;
  title: string;
  kind?: string;
  status?: "draft" | "ready" | "superseded" | "archived";
  summary?: string;
  content?: string;
  resourceType?: ArtifactResourceType;
  resourceTags?: string[];
  source?: {
    name?: string;
    path?: string;
    url?: string;
  };
  sourceName?: string;
  sourcePath?: string;
  sourceUrl?: string;
};

type WorkspaceSkillScriptOutput = {
  version?: 1;
  runSummary?: string;
  successTitle?: string;
  successDetail?: string;
  bindAppManifestArtifactId?: string | null;
  resources?: WorkspaceSkillScriptArtifactPayload[];
  artifacts?: WorkspaceSkillScriptArtifactPayload[];
};

function normalizeWorkspaceSkillScriptOutput(stdout: string | undefined): WorkspaceSkillScriptOutput | null {
  const raw = stdout?.trim();
  if (!raw) {
    return null;
  }
  try {
    const parsed = JSON.parse(raw) as WorkspaceSkillScriptOutput;
    if (!parsed || typeof parsed !== "object") {
      return null;
    }
    return parsed;
  } catch {
    return null;
  }
}

function buildGenericWorkspaceScriptArtifact(input: {
  company: Company;
  skill: SkillDefinition;
  app: CompanyWorkspaceApp | null;
  response: AuthorityAgentFileRunResponse;
  workItemId?: string | null;
  now: number;
}) {
  return buildSkillResultArtifact({
    id: `skill-result:${input.company.id}:${input.skill.id}:${input.now}:workspace-script`,
    companyId: input.company.id,
    workItemId: input.workItemId ?? null,
    skill: input.skill,
    app: input.app,
    now: input.now,
    title: `${input.skill.title} 脚本执行记录`,
    kind: "skill_result",
    summary: `${input.skill.title} 已通过 workspace script 执行，平台已记录 stdout / stderr 供回看。`,
    content: [
      `# ${input.skill.title} 脚本执行记录`,
      "",
      `- 公司：${input.company.name}`,
      `- 入口：${input.app?.title ?? "工作目录"}`,
      `- workspace：${input.response.workspace}`,
      `- entryPath：${input.response.entryPath}`,
      `- command：${input.response.command?.join(" ") ?? "未记录"}`,
      `- exitCode：${input.response.exitCode ?? "null"}`,
      `- durationMs：${input.response.durationMs ?? 0}`,
      "",
      "## stdout",
      "```text",
      input.response.stdout?.trim() || "(empty)",
      "```",
      "",
      "## stderr",
      "```text",
      input.response.stderr?.trim() || "(empty)",
      "```",
    ].join("\n"),
    resourceType: input.skill.writesResourceTypes?.[0] ?? "state",
    resourceTags: ["tech.workspace-script"],
    source: {
      name: input.response.entryPath,
      path: input.response.entryPath,
    },
  });
}

export function resolveWorkspaceSkillExecutionFromScriptRun(input: {
  company: Company;
  skill: SkillDefinition;
  app: CompanyWorkspaceApp | null;
  response: AuthorityAgentFileRunResponse;
  workItemId?: string | null;
  now: number;
}): ExecuteWorkspaceSkillResult | null {
  if (input.response.status !== "executed") {
    return null;
  }

  const output = normalizeWorkspaceSkillScriptOutput(input.response.stdout);
  const resourcePayloads = output?.resources?.length ? output.resources : output?.artifacts;
  const nextApps =
    output?.bindAppManifestArtifactId && input.app
      ? (input.company.workspaceApps ?? [input.app]).map((app) =>
          app.id === input.app?.id ? { ...app, manifestArtifactId: output.bindAppManifestArtifactId ?? null } : app,
        )
      : undefined;
  const artifacts =
    resourcePayloads && resourcePayloads.length > 0
      ? resourcePayloads.map((artifact, index) =>
          buildSkillResultArtifact({
            id: artifact.id ?? `skill-result:${input.company.id}:${input.skill.id}:${input.now}:${index + 1}`,
            companyId: input.company.id,
            workItemId: input.workItemId ?? null,
            skill: input.skill,
            app: input.app,
            now: input.now,
            sequence: index + 1,
            title: artifact.title,
            kind: artifact.kind ?? "skill_result",
            status: artifact.status ?? "ready",
            summary: artifact.summary ?? `${input.skill.title} 通过 workspace script 产出的结果资源。`,
            content: artifact.content ?? null,
            resourceType: artifact.resourceType ?? input.skill.writesResourceTypes?.[0] ?? "state",
            resourceTags: ["tech.workspace-script", ...(artifact.resourceTags ?? [])],
            source: {
              name: artifact.source?.name ?? artifact.sourceName ?? input.response.entryPath,
              path: artifact.source?.path ?? artifact.sourcePath ?? input.response.entryPath,
              url: artifact.source?.url ?? artifact.sourceUrl,
            },
          }),
        )
      : [buildGenericWorkspaceScriptArtifact(input)];

  return {
    artifacts,
    nextApps,
    runSummary:
      output?.runSummary ??
      `${input.skill.title} 已通过 workspace script 执行，当前结果已写回工作目录。`,
    successTitle: output?.successTitle ?? "已执行 workspace script",
    successDetail:
      output?.successDetail ?? "这次运行来自 CTO 工作区里的真实脚本，不是平台内置桥接。",
  };
}

export { normalizeWorkspaceSkillScriptOutput };
export type { WorkspaceSkillScriptOutput, WorkspaceSkillScriptArtifactPayload };
