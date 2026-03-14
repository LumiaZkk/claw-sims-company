import type {
  AuthorityExecutorReadinessCheck,
  AuthorityHealthGuidanceItem,
  AuthorityHealthSnapshot,
  AuthorityOperatorActionId,
} from "../../infrastructure/authority/contract";
import type {
  AuthorityRuntimeSyncMode,
  AuthorityRuntimeSyncOperation,
  AuthorityRuntimeSyncState,
} from "../../infrastructure/authority/runtime-sync-store";
import { buildAuthorityHealthGuidance } from "../../infrastructure/authority/health-guidance";

export type AuthorityUiState = "ready" | "degraded" | "blocked";
export type AuthorityGuidanceItem = AuthorityHealthGuidanceItem;
export type AuthorityBannerModel = {
  state: AuthorityUiState;
  title: string;
  summary: string;
  detail: string | null;
  steps: string[];
};
export type AuthorityOperatorControlPlaneEntry = {
  id: AuthorityOperatorActionId;
  title: string;
  summary: string;
  command: string;
  actionLabel: string;
  confirmationTitle?: string;
  confirmationDescription?: string;
  confirmationText?: string;
};
export type AuthorityOperatorControlPlaneModel = {
  title: string;
  summary: string;
  detail: string | null;
  entries: AuthorityOperatorControlPlaneEntry[];
};
export type AuthorityRuntimeSyncDiagnosticsModel = {
  state: AuthorityUiState;
  mode: AuthorityRuntimeSyncMode;
  title: string;
  summary: string;
  detail: string;
  lastActivityAt: number | null;
  lastAppliedAt: number | null;
  lastAppliedSource: AuthorityRuntimeSyncOperation | null;
  metrics: Array<{ label: string; value: string }>;
  warning: string | null;
};

export type AuthorityExecutorOnboardingIssue =
  | "missing-token"
  | "executor-blocked"
  | "missing-scope";

export function extractAuthorityHealthSnapshot(value: unknown): AuthorityHealthSnapshot | null {
  if (!value || typeof value !== "object") {
    return null;
  }
  const candidate = value as Partial<AuthorityHealthSnapshot>;
  if (!candidate.executor || !candidate.executorConfig || !candidate.authority) {
    return null;
  }
  return candidate as AuthorityHealthSnapshot;
}

export function foldAuthorityUiStates(states: AuthorityUiState[]): AuthorityUiState {
  if (states.includes("blocked")) {
    return "blocked";
  }
  if (states.includes("degraded")) {
    return "degraded";
  }
  return "ready";
}

export function resolveAuthorityStorageState(
  health: AuthorityHealthSnapshot,
): AuthorityUiState {
  return foldAuthorityUiStates([
    health.authority.preflight.status,
    health.authority.doctor.status,
  ]);
}

export function resolveAuthorityControlState(
  health: AuthorityHealthSnapshot,
): AuthorityUiState {
  return foldAuthorityUiStates([
    resolveAuthorityStorageState(health),
    health.executor.state,
  ]);
}

export function buildAuthorityGuidanceItems(
  health: AuthorityHealthSnapshot,
  limit = 5,
): AuthorityGuidanceItem[] {
  if (health.authority.guidance?.length) {
    return health.authority.guidance.slice(0, limit);
  }
  return buildAuthorityHealthGuidance(
    {
      doctor: health.authority.doctor,
      preflight: health.authority.preflight,
      executor: health.executor,
    },
    limit,
  );
}

export function collectExecutorReadinessIssues(
  health: AuthorityHealthSnapshot,
  limit = 5,
): AuthorityExecutorReadinessCheck[] {
  return (health.executorReadiness ?? [])
    .filter((check) => check.state !== "ready")
    .slice(0, limit);
}

export function collectAuthorityGuidance(
  health: AuthorityHealthSnapshot,
  limit = 5,
): string[] {
  const structured = buildAuthorityGuidanceItems(health, limit);
  if (structured.length > 0) {
    return structured.map((item) => item.summary);
  }
  const deduped = new Set<string>();
  for (const line of [
    ...health.authority.preflight.issues,
    ...health.authority.preflight.warnings,
    ...health.authority.doctor.issues,
    ...health.authority.preflight.notes,
  ]) {
    const trimmed = line.trim();
    if (!trimmed) {
      continue;
    }
    deduped.add(trimmed);
    if (deduped.size >= limit) {
      break;
    }
  }
  return [...deduped];
}

export function collectAuthorityRepairSteps(
  health: AuthorityHealthSnapshot,
  limit = 5,
): string[] {
  const items = buildAuthorityGuidanceItems(health, limit);
  if (items.length > 0) {
    return items.map((item) =>
      item.command ? `${item.action}（${item.command}）` : item.action,
    );
  }
  return collectAuthorityGuidance(health, limit);
}

export function buildAuthorityBannerModel(
  health: AuthorityHealthSnapshot,
  limit = 2,
): AuthorityBannerModel | null {
  const state = resolveAuthorityControlState(health);
  if (state === "ready") {
    return null;
  }

  const primary = buildAuthorityGuidanceItems(health, 1)[0] ?? null;
  const steps = collectAuthorityRepairSteps(health, limit);
  const detailParts = [
    `${health.authority.dbPath}`,
    `schema v${health.authority.doctor.schemaVersion ?? "?"}`,
    `integrity ${health.authority.doctor.integrityStatus}`,
    `备份 ${health.authority.doctor.backupCount} 份`,
  ];
  if (primary?.command) {
    detailParts.push(`推荐命令 ${primary.command}`);
  } else if (primary?.action) {
    detailParts.push(primary.action);
  }

  return {
    state,
    title: primary
      ? `Authority 当前${state === "blocked" ? "阻断运行" : "有待处理项"}：${primary.title}`
      : `Authority 当前${state === "blocked" ? "阻断运行" : "有待处理项"}`,
    summary:
      primary?.summary ??
      collectAuthorityGuidance(health, 1)[0] ??
      "Authority 当前还有待处理项，建议先完成诊断建议再继续推进。",
    detail: detailParts.join(" · "),
    steps,
  };
}

export function resolveAuthorityExecutorOnboardingIssue(
  health: AuthorityHealthSnapshot,
): AuthorityExecutorOnboardingIssue | null {
  if (!health.executorConfig.openclaw.tokenConfigured) {
    return "missing-token";
  }
  if ((health.executorConfig.lastError ?? "").includes("必需权限")) {
    return "missing-scope";
  }
  if (health.executor.state === "blocked") {
    return "executor-blocked";
  }
  return null;
}

export function requiresAuthorityExecutorOnboarding(
  health: AuthorityHealthSnapshot,
): boolean {
  return resolveAuthorityExecutorOnboardingIssue(health) !== null;
}

export function buildAuthorityOperatorControlPlaneModel(
  health: AuthorityHealthSnapshot | null | undefined,
): AuthorityOperatorControlPlaneModel {
  const primaryGuidance = health ? buildAuthorityGuidanceItems(health, 1)[0] ?? null : null;
  const staleBackupWarning = health?.authority.preflight.warnings.find((line) => line.includes("最新标准备份已超过"));
  const missingBackup = health ? health.authority.preflight.backupCount === 0 : false;
  const missingSchemaMetadata = health ? health.authority.preflight.schemaVersion === null : false;
  const integrityFailed = health ? health.authority.preflight.integrityStatus === "failed" : false;

  const entries: AuthorityOperatorControlPlaneEntry[] = [
    {
      id: "doctor",
      title: "先跑 Authority Doctor",
      summary:
        primaryGuidance?.summary ??
        "先确认当前控制面、SQLite 完整性和执行器状态，再决定是否要做恢复或手工修复。",
      command: "npm run authority:doctor",
      actionLabel: "运行 doctor",
    },
  ];

  if (missingSchemaMetadata) {
    entries.push({
      id: "migrate-plan",
      title: "先看 migration plan",
      summary: "当前库还缺 schema metadata，恢复或手工修复前先确认 migration 计划。",
      command: "npm run authority:migrate -- --plan",
      actionLabel: "查看 migration plan",
    });
  }

  entries.push({
    id: "backup",
    title: missingBackup ? "先补第一份标准备份" : "改库前先刷新标准备份",
    summary: missingBackup
      ? "当前 authority SQLite 已存在，但还没有标准备份；先补备份，再考虑恢复或手工修复。"
      : staleBackupWarning ??
        "任何 restore / import / manual recovery 之前，都先确认你手上的标准备份是新的。",
    command: "npm run authority:backup",
    actionLabel: "创建标准备份",
  });

  entries.push({
    id: "restore-plan",
    title: "恢复前先看 plan",
    summary: integrityFailed
      ? "当前 integrity_check 已失败，先看最新 restore plan，不要在业务页面里直接做手工补写。"
      : "任何 restore / import / manual recovery 都先在这里看计划，再决定是否 apply。",
    command: "npm run authority:restore -- --latest --plan",
    actionLabel: "查看 restore plan",
  });

  entries.push({
    id: "restore-apply",
    title: "确认 plan 后再正式恢复",
    summary:
      "正式恢复会用最新标准备份覆盖当前 authority SQLite，并自动补一份 safety backup。只有确认 plan 可接受时再执行。",
    command: "npm run authority:restore -- --latest --force",
    actionLabel: "正式恢复 latest 备份",
    confirmationTitle: "确认正式恢复 Authority",
    confirmationDescription:
      "这会用最新标准备份覆盖当前 authority SQLite，并在覆盖前创建一份 safety backup。请先确认上面的 restore plan 已可接受，再输入确认词继续。",
    confirmationText: "RESTORE",
  });

  entries.push({
    id: "rehearse",
    title: "需要验证备份时先 rehearsal",
    summary: "如果你想确认最新标准备份真的可恢复，先 rehearsal，再决定是否执行正式 restore。",
    command: "npm run authority:rehearse -- --latest",
    actionLabel: "演练 restore",
  });

  return {
    title: "恢复 / 导入 / 手工修复入口",
    summary:
      "所有 restore / import / manual recovery 都应该在 Connect 或 Settings Doctor 里判断并发起；Runtime、工作看板和 Ops 只负责观察与业务推进。",
    detail: health
      ? `${health.authority.dbPath} · schema v${health.authority.doctor.schemaVersion ?? "?"} · integrity ${
          health.authority.doctor.integrityStatus
        } · 标准备份 ${health.authority.doctor.backupCount} 份`
      : "还没拿到 Authority 运维快照时，也应先回到 Connect / Settings Doctor 判断控制面状态。",
    entries,
  };
}

export function buildAuthorityRuntimeSyncDiagnosticsModel(
  runtimeSync: AuthorityRuntimeSyncState,
): AuthorityRuntimeSyncDiagnosticsModel {
  const lastActivityAt =
    runtimeSync.lastCommandAt ?? runtimeSync.lastPullAt ?? runtimeSync.lastPushAt ?? null;
  const hasActivity =
    runtimeSync.commandCount > 0 || runtimeSync.pullCount > 0 || runtimeSync.pushCount > 0;
  const state: AuthorityUiState =
    runtimeSync.lastError
      ? "degraded"
      : runtimeSync.mode === "command_preferred" && !runtimeSync.compatibilityPathEnabled
        ? "ready"
        : hasActivity
          ? "degraded"
          : "degraded";

  const summary =
    runtimeSync.lastError
      ? "最近一次 Authority 同步留下了错误，说明当前仍有恢复/兼容或事件补写链路需要关注。"
      : runtimeSync.mode === "command_preferred" && !runtimeSync.compatibilityPathEnabled
        ? "正常主路径已经切到 command 写入，compatibility snapshot 不再作为日常主链。"
        : runtimeSync.mode === "command_preferred"
          ? "主链已经优先走 command，但 compatibility snapshot 仍保留作恢复/兼容补位。"
          : hasActivity
            ? "当前仍保留 snapshot 兼容同步，说明恢复/兼容链路还没有彻底退场。"
            : "当前还没有留下 runtime sync 活动记录，建议先完成一轮正常连接与主线推进，再回来验证。";

  const detailParts = [
    `模式 ${runtimeSync.mode}`,
    runtimeSync.compatibilityPathEnabled ? "compatibility path 仍开启" : "compatibility path 已关闭",
    runtimeSync.lastAppliedSource ? `最近应用 ${runtimeSync.lastAppliedSource}` : null,
    runtimeSync.commandRoutes.length > 0
      ? `command 路由 ${runtimeSync.commandRoutes.slice(0, 6).join(", ")}${
          runtimeSync.commandRoutes.length > 6 ? "..." : ""
        }`
      : null,
  ].filter(Boolean);

  return {
    state,
    mode: runtimeSync.mode,
    title: "Authority 同步诊断",
    summary,
    detail: detailParts.join(" · "),
    lastActivityAt,
    lastAppliedAt: runtimeSync.lastAppliedAt,
    lastAppliedSource: runtimeSync.lastAppliedSource,
    metrics: [
      { label: "command", value: String(runtimeSync.commandCount) },
      { label: "pull", value: String(runtimeSync.pullCount) },
      { label: "push", value: String(runtimeSync.pushCount) },
      {
        label: "compat",
        value: runtimeSync.compatibilityPathEnabled ? "on" : "off",
      },
    ],
    warning:
      runtimeSync.lastError
        ? `${runtimeSync.lastErrorOperation ?? "sync"}：${runtimeSync.lastError}`
        : null,
  };
}
