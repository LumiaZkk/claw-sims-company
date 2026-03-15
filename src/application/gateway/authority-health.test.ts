import { describe, expect, it } from "vitest";
import type { AuthorityHealthSnapshot } from "../../infrastructure/authority/contract";
import {
  buildAuthorityBannerModel,
  buildAuthorityControlPlaneSummaryModel,
  buildAuthorityGuidanceItems,
  buildAuthorityOperatorControlPlaneModel,
  buildAuthorityRuntimeSyncDiagnosticsModel,
  collectExecutorReadinessIssues,
  collectAuthorityGuidance,
  collectAuthorityRepairSteps,
  extractAuthorityHealthSnapshot,
  requiresAuthorityExecutorOnboarding,
  resolveAuthorityControlState,
  resolveAuthorityExecutorOnboardingIssue,
  resolveAuthorityStorageState,
} from "./authority-health";

function createHealthSnapshot(
  overrides: Partial<AuthorityHealthSnapshot> = {},
): AuthorityHealthSnapshot {
  return {
    ok: true,
    executor: {
      adapter: "openclaw-bridge",
      state: "ready",
      provider: "openclaw",
      note: "Authority 已接入 OpenClaw。",
    },
    executorConfig: {
      type: "openclaw",
      openclaw: {
        url: "ws://localhost:18789",
        tokenConfigured: true,
      },
      connectionState: "ready",
      lastError: null,
      lastConnectedAt: 2_000,
    },
    executorCapabilities: {
      sessionStatus: "supported",
      processRuntime: "unsupported",
      notes: [],
    },
    executorReadiness: [
      {
        id: "connection",
        label: "执行器连接",
        state: "ready",
        summary: "Authority 已接入 OpenClaw。",
        detail: "ws://localhost:18789",
      },
    ],
    authority: {
      dbPath: "/tmp/authority.sqlite",
      connected: true,
      startedAt: 1_000,
      doctor: {
        status: "ready",
        schemaVersion: 1,
        integrityStatus: "ok",
        integrityMessage: null,
        backupDir: "/tmp/backups",
        backupCount: 2,
        latestBackupAt: 3_000,
        companyCount: 1,
        runtimeCount: 1,
        eventCount: 12,
        latestRuntimeAt: 2_500,
        latestEventAt: 2_700,
        activeCompanyId: "company-1",
        issues: [],
      },
      preflight: {
        status: "ready",
        dataDir: "/tmp/authority",
        backupDir: "/tmp/backups",
        dbExists: true,
        schemaVersion: 1,
        integrityStatus: "ok",
        integrityMessage: null,
        backupCount: 2,
        latestBackupAt: 3_000,
        notes: ["Authority SQLite 已存在，启动时会直接复用。"],
        warnings: [],
        issues: [],
      },
    },
    ...overrides,
  };
}

describe("authority health helpers", () => {
  it("treats healthy doctor and preflight as ready", () => {
    const health = createHealthSnapshot();

    expect(resolveAuthorityStorageState(health)).toBe("ready");
    expect(resolveAuthorityControlState(health)).toBe("ready");
    expect(collectAuthorityGuidance(health)).toEqual([
      "Authority SQLite 已存在，启动时会直接复用。",
    ]);
  });

  it("degrades when doctor reports repairable issues", () => {
    const health = createHealthSnapshot({
      authority: {
        ...createHealthSnapshot().authority,
        doctor: {
          ...createHealthSnapshot().authority.doctor,
          status: "degraded",
          issues: ["Authority 数据库里还没有 runtime snapshot。"],
        },
      },
    });

    expect(resolveAuthorityStorageState(health)).toBe("degraded");
    expect(resolveAuthorityControlState(health)).toBe("degraded");
    expect(collectAuthorityGuidance(health)).toContain(
      "Authority 数据库里还没有 runtime snapshot。",
    );
  });

  it("blocks when preflight is blocked even if doctor can still read the db", () => {
    const health = createHealthSnapshot({
      authority: {
        ...createHealthSnapshot().authority,
        preflight: {
          ...createHealthSnapshot().authority.preflight,
          status: "blocked",
          issues: ["Authority backup dir 不可写。"],
        },
      },
      executor: {
        ...createHealthSnapshot().executor,
        state: "degraded",
      },
    });

    expect(resolveAuthorityStorageState(health)).toBe("blocked");
    expect(resolveAuthorityControlState(health)).toBe("blocked");
    expect(collectAuthorityGuidance(health)[0]).toBe("Authority backup dir 不可写。");
  });

  it("degrades when preflight warns that backups are missing", () => {
    const base = createHealthSnapshot();
    const health = createHealthSnapshot({
      authority: {
        ...base.authority,
        preflight: {
          ...base.authority.preflight,
          status: "degraded",
          warnings: ["Authority 已有 SQLite，但还没有标准备份。建议先运行 authority:backup。"],
        },
      },
    });

    expect(resolveAuthorityStorageState(health)).toBe("degraded");
    expect(resolveAuthorityControlState(health)).toBe("degraded");
    expect(collectAuthorityGuidance(health)[0]).toBe(
      "Authority 已有 SQLite，但还没有标准备份。建议先运行 authority:backup。",
    );
  });

  it("produces structured guidance for missing backups", () => {
    const base = createHealthSnapshot();
    const health = createHealthSnapshot({
      authority: {
        ...base.authority,
        preflight: {
          ...base.authority.preflight,
          status: "degraded",
          backupCount: 0,
          warnings: ["Authority 已有 SQLite，但还没有标准备份。建议先运行 authority:backup。"],
        },
        doctor: {
          ...base.authority.doctor,
          backupCount: 0,
          latestBackupAt: null,
        },
      },
    });

    const guidance = buildAuthorityGuidanceItems(health);
    expect(guidance[0]).toMatchObject({
      id: "authority-backup-missing",
      state: "degraded",
      title: "还没有标准备份",
      command: "npm run authority:backup",
    });
    expect(collectAuthorityRepairSteps(health)[0]).toContain("npm run authority:backup");
  });

  it("collects executor readiness issues separately from authority storage guidance", () => {
    const base = createHealthSnapshot();
    const health = createHealthSnapshot({
      executorCapabilities: {
        sessionStatus: "unsupported",
        processRuntime: "unsupported",
        notes: ["下游执行器不提供 session_status。"],
      },
      executorReadiness: [
        {
          id: "connection",
          label: "执行器连接",
          state: "ready",
          summary: "Authority 已接入 OpenClaw。",
          detail: "ws://localhost:18789",
        },
        {
          id: "session-status",
          label: "运行态探针",
          state: "degraded",
          summary: "当前执行器不支持 session_status。",
          detail: "Authority 会退回 lifecycle/chat 驱动的降级修复模式。",
        },
        {
          id: "process-runtime",
          label: "进程观测",
          state: "degraded",
          summary: "当前执行器不提供 process runtime 观测。",
          detail: "Runtime Inspector 会隐藏进程级 polling。",
        },
      ],
      authority: {
        ...base.authority,
      },
    });

    const issues = collectExecutorReadinessIssues(health);
    expect(issues).toHaveLength(2);
    expect(issues[0]?.id).toBe("session-status");
  });

  it("surfaces sqlite lock conflicts as a dedicated authority guidance item", () => {
    const base = createHealthSnapshot();
    const health = createHealthSnapshot({
      authority: {
        ...base.authority,
        preflight: {
          ...base.authority.preflight,
          status: "blocked",
          integrityStatus: "failed",
          integrityMessage: "database is locked",
          issues: [
            "Authority SQLite 当前被另一 authority 实例占用。请先停止另一实例，或改用标准备份启动隔离 authority。",
          ],
        },
      },
    });

    const guidance = buildAuthorityGuidanceItems(health);
    expect(guidance[0]).toMatchObject({
      id: "authority-db-locked",
      state: "blocked",
      title: "Authority SQLite 正被另一实例占用",
    });
    expect(collectAuthorityRepairSteps(health)[0]).toContain("停止另一份 authority");
  });

  it("recommends migrate plan when schema metadata is missing", () => {
    const base = createHealthSnapshot();
    const health = createHealthSnapshot({
      authority: {
        ...base.authority,
        doctor: {
          ...base.authority.doctor,
          status: "degraded",
          schemaVersion: null,
          issues: ["Authority SQLite 还没有 schemaVersion metadata。建议先运行 authority:migrate。"],
        },
        preflight: {
          ...base.authority.preflight,
          status: "degraded",
          schemaVersion: null,
          warnings: ["Authority SQLite 缺少 schemaVersion metadata。建议先运行 authority:migrate。"],
        },
      },
    });

    const guidance = buildAuthorityGuidanceItems(health);
    expect(guidance.some((item) => item.id === "authority-schema-metadata-missing")).toBe(true);
    expect(collectAuthorityRepairSteps(health).some((step) => step.includes("authority:migrate -- --plan"))).toBe(
      true,
    );
  });

  it("prioritizes restore planning when integrity check fails", () => {
    const base = createHealthSnapshot();
    const health = createHealthSnapshot({
      authority: {
        ...base.authority,
        doctor: {
          ...base.authority.doctor,
          status: "blocked",
          integrityStatus: "failed",
          integrityMessage: "database disk image is malformed",
          issues: ["Authority SQLite integrity_check 失败：database disk image is malformed"],
        },
        preflight: {
          ...base.authority.preflight,
          status: "blocked",
          integrityStatus: "failed",
          integrityMessage: "database disk image is malformed",
          issues: ["Authority SQLite integrity_check 失败：database disk image is malformed"],
        },
      },
    });

    const guidance = buildAuthorityGuidanceItems(health);
    expect(guidance[0]).toMatchObject({
      id: "authority-db-integrity-failed",
      state: "blocked",
      command: "npm run authority:restore -- --latest --plan",
    });
    expect(collectAuthorityRepairSteps(health)[0]).toContain("authority:restore -- --latest --plan");
  });

  it("prefers server-provided guidance over local fallback recomputation", () => {
    const health = createHealthSnapshot({
      authority: {
        ...createHealthSnapshot().authority,
        guidance: [
          {
            id: "authority-server-guidance",
            state: "degraded",
            title: "来自 authority /health 的统一建议",
            summary: "这条建议应直接作为单一真相返回给前台。",
            action: "先按 authority 提示处理，再做下一步判断。",
            command: "npm run authority:doctor",
          },
        ],
        preflight: {
          ...createHealthSnapshot().authority.preflight,
          status: "degraded",
          backupCount: 0,
          warnings: ["Authority 已有 SQLite，但还没有标准备份。建议先运行 authority:backup。"],
        },
      },
    });

    expect(buildAuthorityGuidanceItems(health)[0]).toMatchObject({
      id: "authority-server-guidance",
      command: "npm run authority:doctor",
    });
    expect(collectAuthorityRepairSteps(health)[0]).toContain("npm run authority:doctor");
  });

  it("extracts a valid authority health snapshot from gateway status payloads", () => {
    const health = createHealthSnapshot();

    expect(extractAuthorityHealthSnapshot(health)).toEqual(health);
    expect(extractAuthorityHealthSnapshot({ ok: true })).toBeNull();
    expect(extractAuthorityHealthSnapshot(null)).toBeNull();
  });

  it("builds a startup banner model when authority is degraded", () => {
    const base = createHealthSnapshot();
    const health = createHealthSnapshot({
      authority: {
        ...base.authority,
        preflight: {
          ...base.authority.preflight,
          status: "degraded",
          backupCount: 0,
          warnings: ["Authority 已有 SQLite，但还没有标准备份。建议先运行 authority:backup。"],
        },
        doctor: {
          ...base.authority.doctor,
          backupCount: 0,
          latestBackupAt: null,
        },
      },
    });

    expect(buildAuthorityBannerModel(createHealthSnapshot())).toBeNull();
    expect(buildAuthorityBannerModel(health)).toMatchObject({
      state: "degraded",
      title: "Authority 当前有待处理项：还没有标准备份",
    });
    expect(buildAuthorityBannerModel(health)?.steps[0]).toContain("npm run authority:backup");
  });

  it("builds a shared control plane summary model for healthy authority state", () => {
    const summary = buildAuthorityControlPlaneSummaryModel(createHealthSnapshot());

    expect(summary).toMatchObject({
      state: "ready",
      title: "Authority 控制面摘要",
      summary: "控制面已经响应，数据库、备份目录和执行器状态都已通过当前检查。",
    });
    expect(summary.layers.map((layer) => layer.label)).toEqual([
      "Authority",
      "Executor",
      "原生能力",
    ]);
    expect(summary.steps).toEqual([]);
  });

  it("surfaces executor readiness degradation in the shared control plane summary", () => {
    const summary = buildAuthorityControlPlaneSummaryModel(
      createHealthSnapshot({
        executorReadiness: [
          {
            id: "connection",
            label: "执行器连接",
            state: "ready",
            summary: "Authority 已接入 OpenClaw。",
            detail: "ws://localhost:18789",
          },
          {
            id: "session-status",
            label: "运行态探针",
            state: "degraded",
            summary: "当前执行器不支持 session_status。",
            detail: "Authority 会退回 lifecycle/chat 驱动的降级修复模式。",
          },
        ],
      }),
    );

    expect(summary.state).toBe("attention");
    expect(summary.summary).toContain("控制面已可继续运行，但执行器原生能力还有 1 项降级检查需要关注");
    expect(summary.layers[2]).toMatchObject({
      label: "原生能力",
      state: "degraded",
      summary: "当前执行器不支持 session_status。",
    });
  });

  it("requires executor onboarding when token is missing or executor is blocked", () => {
    const missingToken = createHealthSnapshot({
      executorConfig: {
        ...createHealthSnapshot().executorConfig,
        openclaw: {
          url: "ws://localhost:18789",
          tokenConfigured: false,
        },
      },
    });
    expect(resolveAuthorityExecutorOnboardingIssue(missingToken)).toBe("missing-token");
    expect(requiresAuthorityExecutorOnboarding(missingToken)).toBe(true);

    const missingScope = createHealthSnapshot({
      executor: {
        ...createHealthSnapshot().executor,
        state: "blocked",
      },
      executorConfig: {
        ...createHealthSnapshot().executorConfig,
        lastError: "OpenClaw 未授予 Authority 必需权限：operator.read, operator.admin。",
      },
    });
    expect(resolveAuthorityExecutorOnboardingIssue(missingScope)).toBe("missing-scope");
    expect(requiresAuthorityExecutorOnboarding(missingScope)).toBe(true);

    const blocked = createHealthSnapshot({
      executor: {
        ...createHealthSnapshot().executor,
        state: "blocked",
      },
    });
    expect(resolveAuthorityExecutorOnboardingIssue(blocked)).toBe("executor-blocked");
    expect(requiresAuthorityExecutorOnboarding(blocked)).toBe(true);
  });

  it("builds an operator control plane model that keeps restore and manual recovery in Connect/Settings", () => {
    const model = buildAuthorityOperatorControlPlaneModel(createHealthSnapshot());

    expect(model.title).toBe("恢复 / 导入 / 手工修复入口");
    expect(model.summary).toContain("Connect 或 Settings Doctor");
    expect(model.entries.map((entry) => entry.command)).toEqual([
      "npm run authority:doctor",
      "npm run authority:backup",
      "npm run authority:restore -- --latest --plan",
      "npm run authority:restore -- --latest --force",
      "npm run authority:rehearse -- --latest",
    ]);
    expect(model.entries[3]).toMatchObject({
      id: "restore-apply",
      actionLabel: "正式恢复 latest 备份",
      confirmationText: "RESTORE",
    });
  });

  it("prioritizes backup and migrate guidance in the operator control plane when metadata or backups are missing", () => {
    const base = createHealthSnapshot();
    const health = createHealthSnapshot({
      authority: {
        ...base.authority,
        doctor: {
          ...base.authority.doctor,
          schemaVersion: null,
          backupCount: 0,
          latestBackupAt: null,
        },
        preflight: {
          ...base.authority.preflight,
          schemaVersion: null,
          backupCount: 0,
          warnings: ["Authority 已有 SQLite，但还没有标准备份。建议先运行 authority:backup。"],
        },
      },
    });

    const model = buildAuthorityOperatorControlPlaneModel(health);
    expect(model.entries[1]).toMatchObject({
      id: "migrate-plan",
      command: "npm run authority:migrate -- --plan",
      actionLabel: "查看 migration plan",
    });
    expect(model.entries[2]).toMatchObject({
      id: "backup",
      title: "先补第一份标准备份",
    });
  });

  it("builds runtime sync diagnostics for command-preferred mode", () => {
    const diagnostics = buildAuthorityRuntimeSyncDiagnosticsModel({
      compatibilityPathEnabled: false,
      commandRoutes: ["requirement.transition", "artifact.upsert"],
      mode: "command_preferred",
      lastSnapshotUpdatedAt: 5_000,
      lastAppliedSignature: "sig-1",
      lastAppliedSource: "command",
      lastAppliedAt: 5_100,
      lastPushAt: null,
      lastPullAt: 5_000,
      lastCommandAt: 5_100,
      pushCount: 0,
      pullCount: 2,
      commandCount: 4,
      lastError: null,
      lastErrorAt: null,
      lastErrorOperation: null,
    });

    expect(diagnostics.state).toBe("ready");
    expect(diagnostics.summary).toContain("command 写入");
    expect(diagnostics.metrics).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ label: "command", value: "4" }),
        expect.objectContaining({ label: "compat", value: "off" }),
      ]),
    );
  });

  it("surfaces last sync error in diagnostics", () => {
    const diagnostics = buildAuthorityRuntimeSyncDiagnosticsModel({
      compatibilityPathEnabled: true,
      commandRoutes: ["requirement.transition"],
      mode: "command_preferred",
      lastSnapshotUpdatedAt: 5_000,
      lastAppliedSignature: "sig-1",
      lastAppliedSource: "pull",
      lastAppliedAt: 5_100,
      lastPushAt: null,
      lastPullAt: 5_100,
      lastCommandAt: null,
      pushCount: 0,
      pullCount: 1,
      commandCount: 1,
      lastError: "network timeout",
      lastErrorAt: 5_200,
      lastErrorOperation: "pull",
    });

    expect(diagnostics.state).toBe("degraded");
    expect(diagnostics.warning).toBe("pull：network timeout");
  });
});
