import type { AuthorityHealthGuidanceItem } from "./contract";

type GuidanceStatus = "ready" | "degraded" | "blocked";
type GuidanceIntegrity = "ok" | "failed" | "unknown";

type GuidanceDoctorSnapshot = {
  status: GuidanceStatus;
  schemaVersion: number | null;
  integrityStatus: GuidanceIntegrity;
  integrityMessage: string | null;
  backupCount: number;
  latestBackupAt: number | null;
  companyCount: number;
  runtimeCount: number;
  issues: string[];
};

type GuidancePreflightSnapshot = {
  status: GuidanceStatus;
  dbExists: boolean;
  schemaVersion: number | null;
  integrityStatus: GuidanceIntegrity;
  integrityMessage: string | null;
  backupCount: number;
  latestBackupAt: number | null;
  notes: string[];
  warnings: string[];
  issues: string[];
};

type GuidanceExecutorSnapshot = {
  state: GuidanceStatus;
  note: string;
};

export type AuthorityHealthGuidanceInput = {
  doctor: GuidanceDoctorSnapshot;
  preflight: GuidancePreflightSnapshot;
  executor?: GuidanceExecutorSnapshot | null;
};

function dedupeGuidance(
  items: AuthorityHealthGuidanceItem[],
  limit: number,
): AuthorityHealthGuidanceItem[] {
  const seen = new Set<string>();
  const results: AuthorityHealthGuidanceItem[] = [];
  for (const item of items) {
    if (seen.has(item.id)) {
      continue;
    }
    seen.add(item.id);
    results.push(item);
    if (results.length >= limit) {
      break;
    }
  }
  return results;
}

export function buildAuthorityHealthGuidance(
  input: AuthorityHealthGuidanceInput,
  limit = 5,
): AuthorityHealthGuidanceItem[] {
  const items: AuthorityHealthGuidanceItem[] = [];
  const { doctor, preflight, executor } = input;
  const primaryPreflightIssue = preflight.issues[0] ?? preflight.warnings[0] ?? null;
  const primaryDoctorIssue = doctor.issues[0] ?? null;
  const staleBackupWarning = preflight.warnings.find((line) => line.includes("最新标准备份已超过"));
  const unreadableBackupIssue = preflight.issues.find((line) => line.includes("最新标准备份不可读"));

  if (preflight.integrityStatus === "failed") {
    items.push({
      id: "authority-db-integrity-failed",
      state: "blocked",
      title: "Authority SQLite 当前不可读",
      summary:
        preflight.integrityMessage
          ? `integrity_check 失败：${preflight.integrityMessage}`
          : "authority.sqlite 当前无法通过完整性检查。",
      action: "先查看最近恢复计划，再决定是否从标准备份恢复。",
      command: "npm run authority:restore -- --latest --plan",
    });
  }

  if (unreadableBackupIssue) {
    items.push({
      id: "authority-backup-unreadable",
      state: "blocked",
      title: "最新标准备份不可用",
      summary: unreadableBackupIssue,
      action: "先重新生成一份标准备份，确保恢复路径可用。",
      command: "npm run authority:backup",
    });
  }

  if (preflight.dbExists && preflight.backupCount === 0) {
    items.push({
      id: "authority-backup-missing",
      state: "degraded",
      title: "还没有标准备份",
      summary: "当前 authority SQLite 已存在，但还没有任何标准备份。",
      action: "先创建第一份标准备份，再继续运行或做恢复判断。",
      command: "npm run authority:backup",
    });
  }

  if (staleBackupWarning) {
    items.push({
      id: "authority-backup-stale",
      state: "degraded",
      title: "标准备份已经过旧",
      summary: staleBackupWarning,
      action: "刷新标准备份，避免恢复时回到过旧快照。",
      command: "npm run authority:backup",
    });
  }

  if (preflight.dbExists && preflight.schemaVersion === null) {
    items.push({
      id: "authority-schema-metadata-missing",
      state: "degraded",
      title: "Authority 缺少 schema metadata",
      summary: "当前库缺少 schemaVersion metadata，诊断和恢复判断会退回 legacy 模式。",
      action: "先查看 migration plan，再决定是否执行 metadata backfill。",
      command: "npm run authority:migrate -- --plan",
    });
  }

  if (items.length === 0 && primaryPreflightIssue && preflight.status !== "ready") {
    items.push({
      id: "authority-generic-preflight",
      state: preflight.status,
      title:
        preflight.status === "blocked"
          ? "Authority 启动前检查当前阻断运行"
          : "Authority 启动前检查还有待处理项",
      summary: primaryPreflightIssue,
      action: "先处理这条 Authority 提示，再继续做连接、启动或恢复操作。",
      command: null,
    });
  }

  if (executor && executor.state !== "ready") {
    items.push({
      id: "authority-executor-not-ready",
      state: executor.state,
      title: "下游执行器还没 ready",
      summary: executor.note,
      action: "去 Settings 检查 OpenClaw 地址、Token 和最近连接错误。",
      command: null,
    });
  }

  if (doctor.companyCount === 0) {
    items.push({
      id: "authority-company-missing",
      state: "degraded",
      title: "Authority 里还没有公司配置",
      summary: primaryDoctorIssue ?? "当前 authority 数据库里还没有公司配置。",
      action: "先完成公司创建或切到已有公司，再继续同步 runtime。",
      command: null,
    });
  }

  if (doctor.runtimeCount === 0) {
    items.push({
      id: "authority-runtime-missing",
      state: "degraded",
      title: "Authority 里还没有 runtime snapshot",
      summary: primaryDoctorIssue ?? "当前 authority 数据库里还没有 runtime snapshot。",
      action: "先让产品前台完成一次正常加载和同步，再回来看 Doctor。",
      command: null,
    });
  }

  if (items.length === 0 && primaryDoctorIssue) {
    items.push({
      id: "authority-generic-doctor",
      state: doctor.status,
      title: "Authority Doctor 还有待处理项",
      summary: primaryDoctorIssue,
      action: "先处理 Doctor 提示，再继续做 runtime 或执行器诊断。",
      command: null,
    });
  }

  if (items.length === 0 && preflight.notes[0]) {
    items.push({
      id: "authority-ready-note",
      state: "ready",
      title: "Authority 当前检查通过",
      summary: preflight.notes[0],
      action: "可以继续连接、同步和推进当前主线。",
      command: null,
    });
  }

  return dedupeGuidance(items, limit);
}
