import path from "node:path";
import {
  createAuthorityBackup,
  getLatestAuthorityBackup,
  migrateAuthoritySchemaVersion,
  readAuthorityDoctorSnapshot,
  readAuthorityPreflightSnapshot,
  readAuthorityRestorePlan,
  rehearseAuthorityRestore,
  renderAuthorityDoctorReport,
  renderAuthorityGuidanceReport,
  renderAuthorityMigrateReport,
  renderAuthorityRestorePlanReport,
  renderAuthorityRestoreRehearsalReport,
  type AuthorityRestoreResult,
} from "./ops";
import type {
  AuthorityBootstrapSnapshot,
  AuthorityExecutorStatus,
  AuthorityOperatorActionRequest,
  AuthorityOperatorActionResponse,
} from "../../../../src/infrastructure/authority/contract";
import { buildAuthorityHealthGuidance } from "../../../../src/infrastructure/authority/health-guidance";

type OperatorActionRepository = {
  restoreFromBackup: (backupPath: string, force?: boolean) => AuthorityRestoreResult;
};

type OperatorActionDependencies = {
  dbPath: string;
  dataDir: string;
  repository: OperatorActionRepository;
  companyOpsEngine: {
    schedule: (reason: string, companyId?: string | null) => void;
  };
  queueManagedExecutorSync: (reason: string) => Promise<void>;
  buildBootstrapSnapshot: () => AuthorityBootstrapSnapshot;
  getExecutorSnapshot: () => {
    executor: AuthorityExecutorStatus;
  };
  notifyBootstrapUpdated: () => void;
};

function resolveLatestStandardBackupPath(dataDir: string) {
  return getLatestAuthorityBackup({ backupDir: path.join(dataDir, "backups") })?.path ?? null;
}

export function createAuthorityOperatorActionRunner(deps: OperatorActionDependencies) {
  return async function runAuthorityOperatorAction(
    input: AuthorityOperatorActionRequest,
  ): Promise<AuthorityOperatorActionResponse> {
    if (input.id === "doctor") {
      const doctor = readAuthorityDoctorSnapshot({ dbPath: deps.dbPath });
      const preflight = readAuthorityPreflightSnapshot({ dbPath: deps.dbPath });
      const guidance = buildAuthorityHealthGuidance({
        doctor,
        preflight,
        executor: deps.getExecutorSnapshot().executor,
      });
      return {
        id: "doctor",
        state: doctor.status,
        title: "Authority doctor 已完成",
        summary: guidance[0]?.summary ?? "当前控制面、SQLite 完整性和执行器状态已重新诊断。",
        detail: `${doctor.dbPath} · schema v${doctor.schemaVersion ?? "?"} · integrity ${doctor.integrityStatus}`,
        command: "npm run authority:doctor",
        report: [renderAuthorityDoctorReport(doctor), renderAuthorityGuidanceReport(guidance)]
          .filter(Boolean)
          .join("\n\n"),
        timestamp: Date.now(),
      };
    }

    if (input.id === "migrate-plan") {
      const result = migrateAuthoritySchemaVersion({
        planOnly: true,
        dbPath: deps.dbPath,
      });
      return {
        id: "migrate-plan",
        state: result.status,
        title: "Authority migration plan 已生成",
        summary:
          result.actions[0]
          ?? (result.migrationRequired ? "当前 authority 还需要 migration，先确认计划再继续。" : "当前 authority 已是最新 schema。"),
        detail: `${result.dbPath} · ${result.previousSchemaVersion ?? "n/a"} -> ${result.targetSchemaVersion}`,
        command: "npm run authority:migrate -- --plan",
        report: renderAuthorityMigrateReport(result),
        timestamp: Date.now(),
      };
    }

    if (input.id === "backup") {
      const result = createAuthorityBackup({ dbPath: deps.dbPath });
      return {
        id: "backup",
        state: "ready",
        title: "Authority 标准备份已创建",
        summary: `已生成 ${path.basename(result.backupPath)}，后续可继续做 restore plan / rehearsal。`,
        detail: result.backupPath,
        command: "npm run authority:backup",
        report: [
          `Authority backup created: ${result.backupPath}`,
          `DB path: ${result.dbPath}`,
          `Created at: ${new Date(result.createdAt).toISOString()}`,
          `Size: ${result.sizeBytes} bytes`,
          result.prunedBackupPaths.length > 0 ? `Pruned backups: ${result.prunedBackupPaths.join(", ")}` : "",
        ]
          .filter(Boolean)
          .join("\n"),
        timestamp: Date.now(),
      };
    }

    if (input.id === "restore-plan") {
      const backupPath = resolveLatestStandardBackupPath(deps.dataDir);
      if (!backupPath) {
        throw new Error("Authority 备份目录里还没有可用的标准备份。请先创建标准备份。");
      }
      const plan = readAuthorityRestorePlan({
        backupPath,
        dbPath: deps.dbPath,
      });
      return {
        id: "restore-plan",
        state: plan.status,
        title: "Authority restore plan 已生成",
        summary:
          plan.issues[0]
          ?? plan.warnings[0]
          ?? "已基于最新标准备份生成 restore plan，可以据此决定是否 rehearsal 或正式恢复。",
        detail: `${path.basename(plan.backupPath)} · 当前 DB schema ${plan.dbSchemaVersion ?? "?"}`,
        command: "npm run authority:restore -- --latest --plan",
        report: renderAuthorityRestorePlanReport(plan),
        timestamp: Date.now(),
      };
    }

    if (input.id === "restore-apply") {
      const backupPath = resolveLatestStandardBackupPath(deps.dataDir);
      if (!backupPath) {
        throw new Error("Authority 备份目录里还没有可用的标准备份。请先创建标准备份。");
      }
      const result = deps.repository.restoreFromBackup(backupPath, true);
      let followUpWarning: string | null = null;
      deps.companyOpsEngine.schedule("operator.restore.apply");
      try {
        await deps.queueManagedExecutorSync("operator.restore.apply");
      } catch (error) {
        followUpWarning = `恢复已完成，但执行器同步刷新失败：${error instanceof Error ? error.message : String(error)}`;
        console.warn("Authority restore apply completed with executor sync warning.", error);
      }
      const bootstrap = deps.buildBootstrapSnapshot();
      deps.notifyBootstrapUpdated();
      return {
        id: "restore-apply",
        state: followUpWarning ? "degraded" : "ready",
        title: "Authority 已从最新标准备份恢复",
        summary: followUpWarning ?? "当前 authority SQLite 已恢复，并重新接回主链与前台 bootstrap。",
        detail:
          result.safetyBackupPath
            ? `Safety backup: ${result.safetyBackupPath}`
            : `Restored from ${result.restoredFrom}`,
        command: "npm run authority:restore -- --latest --force",
        report: [
          `Authority restored from: ${result.restoredFrom}`,
          `DB path: ${result.dbPath}`,
          `Restored at: ${new Date(result.restoredAt).toISOString()}`,
          `Size: ${result.sizeBytes} bytes`,
          result.safetyBackupPath ? `Safety backup: ${result.safetyBackupPath}` : "",
          followUpWarning ?? "",
        ]
          .filter(Boolean)
          .join("\n"),
        timestamp: Date.now(),
        bootstrap,
      };
    }

    if (input.id === "rehearse") {
      const backupPath = resolveLatestStandardBackupPath(deps.dataDir);
      if (!backupPath) {
        throw new Error("Authority 备份目录里还没有可用的标准备份。请先创建标准备份。");
      }
      const result = rehearseAuthorityRestore({
        backupPath,
        rehearsalRootDir: path.join(deps.dataDir, "rehearsals"),
      });
      return {
        id: "rehearse",
        state: result.status,
        title: "Authority restore rehearsal 已完成",
        summary:
          result.issues[0]
          ?? result.warnings[0]
          ?? "已在隔离 rehearsal 目录验证最新标准备份，可据此判断是否做正式恢复。",
        detail: `${result.rehearsalHomeDir} · integrity ${result.rehearsalDoctor.integrityStatus}`,
        command: "npm run authority:rehearse -- --latest",
        report: renderAuthorityRestoreRehearsalReport(result),
        timestamp: Date.now(),
      };
    }

    throw new Error(`Unsupported authority operator action: ${String((input as { id?: unknown }).id ?? "unknown")}`);
  };
}
