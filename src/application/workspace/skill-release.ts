import type { SkillDefinition, SkillRunRecord } from "../../domain/org/types";
import { hasRegisteredSkillExecutionAdapter } from "./skill-executor";

export type SkillReleaseCheck = {
  id: string;
  label: string;
  ok: boolean;
  detail: string;
};

export type SkillReleaseReadiness = {
  checks: SkillReleaseCheck[];
  publishable: boolean;
  latestSuccessfulSmokeTestRun: SkillRunRecord | null;
};

function findLatestSuccessfulSmokeTestRun(
  skill: SkillDefinition,
  skillRuns: SkillRunRecord[],
): SkillRunRecord | null {
  const candidates = skillRuns
    .filter((run) => run.skillId === skill.id && run.triggerType === "manual" && run.status === "succeeded")
    .sort((left, right) => right.updatedAt - left.updatedAt);
  return candidates[0] ?? null;
}

export function buildSkillReleaseReadiness(input: {
  skill: SkillDefinition;
  skillRuns: SkillRunRecord[];
  workspaceApps: Array<{
    id: string;
    title: string;
  }>;
}): SkillReleaseReadiness {
  const latestSuccessfulSmokeTestRun = findLatestSuccessfulSmokeTestRun(input.skill, input.skillRuns);
  const linkedApps = (input.skill.appIds ?? [])
    .map((appId) => input.workspaceApps.find((app) => app.id === appId) ?? null)
    .filter((app): app is { id: string; title: string } => Boolean(app));

  const checks: SkillReleaseCheck[] = [
    {
      id: "entry-path",
      label: "执行入口",
      ok: input.skill.entryPath.trim().length > 0,
      detail:
        input.skill.entryPath.trim().length > 0
          ? input.skill.entryPath
          : "还没有明确 workspace script 入口。",
    },
    {
      id: "execution-target",
      label: "平台适配器",
      ok: hasRegisteredSkillExecutionAdapter(input.skill),
      detail: hasRegisteredSkillExecutionAdapter(input.skill)
        ? `已为 ${input.skill.entryPath} 注册平台适配器`
        : "当前依赖真实 workspace script；如果脚本缺失，发布后会直接失败。",
    },
    {
      id: "outputs",
      label: "结果资源类型",
      ok: (input.skill.writesResourceTypes?.length ?? 0) > 0,
      detail:
        (input.skill.writesResourceTypes?.length ?? 0) > 0
          ? `会写回 ${input.skill.writesResourceTypes!.join(" / ")}`
          : "还没有声明这条 skill 会写回什么类型的资源。",
    },
    {
      id: "triggers",
      label: "触发入口",
      ok:
        (input.skill.manifestActionIds?.length ?? 0) > 0
        || input.skill.allowedTriggers.includes("workflow_step"),
      detail:
        (input.skill.manifestActionIds?.length ?? 0) > 0
          ? `已绑定 ${input.skill.manifestActionIds!.length} 个 App action`
          : input.skill.allowedTriggers.includes("workflow_step")
            ? "允许直接绑定到流程节点"
            : "还没有绑定 App action 或流程节点入口。",
    },
    {
      id: "linked-app",
      label: "关联 App",
      ok: (input.skill.appIds?.length ?? 0) === 0 || linkedApps.length > 0,
      detail:
        (input.skill.appIds?.length ?? 0) === 0
          ? "当前不强依赖固定 App。"
          : linkedApps.length > 0
            ? `已关联 ${linkedApps.map((app) => app.title).join("、")}`
            : "声明了关联 App，但当前公司还没有对应入口。",
    },
    {
      id: "smoke-test-plan",
      label: "Smoke test 说明",
      ok: (input.skill.smokeTest?.trim().length ?? 0) > 0,
      detail:
        input.skill.smokeTest?.trim().length
          ? input.skill.smokeTest!
          : "还没有说明这条 skill 的最小验证方式。",
    },
    {
      id: "smoke-test-run",
      label: "最近一次 smoke test",
      ok: Boolean(latestSuccessfulSmokeTestRun),
      detail: latestSuccessfulSmokeTestRun
        ? `最近一次成功验证：${new Date(latestSuccessfulSmokeTestRun.updatedAt).toLocaleString("zh-CN", {
            hour12: false,
          })}`
        : "还没有成功的 manual smoke test 记录。",
    },
  ];

  return {
    checks,
    publishable: checks.every((check) => check.ok),
    latestSuccessfulSmokeTestRun,
  };
}
