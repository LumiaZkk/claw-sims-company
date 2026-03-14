import type {
  AuthorityBootstrapSnapshot,
  AuthorityCompanyRuntimeSnapshot,
  AuthorityExecutorCapabilitySnapshot,
  AuthorityExecutorConfig,
  AuthorityExecutorConnectionState,
  AuthorityHealthSnapshot,
  AuthorityExecutorStatus,
} from "../../../src/infrastructure/authority/contract";
import type { CyberCompanyConfig } from "../../../src/domain/org/types";
import { buildAuthorityHealthGuidance } from "../../../src/infrastructure/authority/health-guidance";
import { buildAuthorityExecutorReadinessChecks } from "../../../src/infrastructure/authority/executor-readiness";
import { readAuthorityDoctorSnapshot, readAuthorityPreflightSnapshot } from "./ops";
import type { SessionStatusCapabilityState } from "./runtime-authority";

export type StoredAuthorityExecutorConfigLike = {
  type?: "openclaw";
  openclaw: {
    url: string;
    token?: string | null;
  };
  connectionState?: AuthorityExecutorConnectionState;
  lastError?: string | null;
  lastConnectedAt?: number | null;
};

export type AuthorityExecutorBridgeSnapshotLike = {
  openclaw: {
    url: string;
  };
  connectionState?: AuthorityExecutorConnectionState;
  lastError?: string | null;
  lastConnectedAt?: number | null;
};

type AuthorityDoctorSnapshotLike = ReturnType<typeof readAuthorityDoctorSnapshot>;
type AuthorityPreflightSnapshotLike = ReturnType<typeof readAuthorityPreflightSnapshot>;

export function toPublicAuthorityExecutorConfig(
  config: StoredAuthorityExecutorConfigLike,
  resolveLocalToken: () => string | null | undefined = () => null,
): AuthorityExecutorConfig {
  return {
    type: "openclaw",
    openclaw: {
      url: config.openclaw.url,
      tokenConfigured: Boolean(config.openclaw.token?.trim() || resolveLocalToken()),
    },
    connectionState: config.connectionState ?? "idle",
    lastError: config.lastError ?? null,
    lastConnectedAt: config.lastConnectedAt ?? null,
  };
}

export function buildAuthorityExecutorCapabilitySnapshot(input: {
  executor: AuthorityExecutorStatus;
  sessionStatusCapabilityState: SessionStatusCapabilityState;
}): AuthorityExecutorCapabilitySnapshot {
  const { executor, sessionStatusCapabilityState } = input;
  const sessionStatus =
    executor.state === "ready" ? sessionStatusCapabilityState : ("unknown" as const);
  const notes: string[] = [];

  if (sessionStatus === "unsupported") {
    notes.push("下游执行器不提供 session_status，Authority 会退回 lifecycle/chat 驱动的运行态修复。");
  } else if (sessionStatus === "unknown" && executor.state === "ready") {
    notes.push("Authority 尚未确认 session_status 能力，首次探测后会自动切换到真实边界。");
  }

  return {
    sessionStatus,
    processRuntime: "unsupported",
    notes,
  };
}

export function buildAuthorityExecutorSnapshot(input: {
  storedConfig: StoredAuthorityExecutorConfigLike;
  bridgeSnapshot: AuthorityExecutorBridgeSnapshotLike;
  executorStatus: AuthorityExecutorStatus;
  sessionStatusCapabilityState: SessionStatusCapabilityState;
  resolveLocalToken?: () => string | null | undefined;
}) {
  const {
    storedConfig,
    bridgeSnapshot,
    executorStatus,
    sessionStatusCapabilityState,
    resolveLocalToken = () => null,
  } = input;

  const nextStoredConfig: StoredAuthorityExecutorConfigLike = {
    ...storedConfig,
    openclaw: {
      url: bridgeSnapshot.openclaw.url,
      token: storedConfig.openclaw.token ?? "",
    },
    connectionState: bridgeSnapshot.connectionState ?? storedConfig.connectionState ?? "idle",
    lastError: bridgeSnapshot.lastError ?? storedConfig.lastError ?? null,
    lastConnectedAt: bridgeSnapshot.lastConnectedAt ?? storedConfig.lastConnectedAt ?? null,
  };

  const executor =
    sessionStatusCapabilityState === "unsupported" && executorStatus.state === "ready"
      ? {
          ...executorStatus,
          note: `${executorStatus.note} 当前 OpenClaw 未提供 session_status，Authority 已降级为 lifecycle/chat 修复。`,
        }
      : executorStatus;

  return {
    nextStoredConfig,
    executor,
    executorConfig: toPublicAuthorityExecutorConfig(nextStoredConfig, resolveLocalToken),
    executorCapabilities: buildAuthorityExecutorCapabilitySnapshot({
      executor,
      sessionStatusCapabilityState,
    }),
  };
}

function resolveFallbackExecutor(input: {
  executorConfig: AuthorityExecutorConfig;
}): AuthorityExecutorStatus {
  const { executorConfig } = input;
  return {
    adapter: "openclaw-bridge",
    state:
      executorConfig.connectionState === "ready"
        ? "ready"
        : executorConfig.connectionState === "blocked"
          ? "blocked"
          : "degraded",
    provider: executorConfig.connectionState === "ready" ? "openclaw" : "none",
    note:
      executorConfig.connectionState === "ready"
        ? "Authority 已接入 OpenClaw。"
        : executorConfig.lastError ?? "Authority 尚未接入 OpenClaw。",
  };
}

export function buildAuthorityHealthSnapshot(input: {
  dbPath: string;
  startedAt: number;
  storedConfig: StoredAuthorityExecutorConfigLike;
  sessionStatusCapabilityState: SessionStatusCapabilityState;
  resolveLocalToken?: () => string | null | undefined;
  executor?: AuthorityExecutorStatus;
  executorConfig?: AuthorityExecutorConfig;
  executorCapabilities?: AuthorityExecutorCapabilitySnapshot;
  doctorSnapshot?: AuthorityDoctorSnapshotLike;
  preflightSnapshot?: AuthorityPreflightSnapshotLike;
  guidance?: AuthorityHealthSnapshot["authority"]["guidance"];
}): AuthorityHealthSnapshot {
  const executorConfig =
    input.executorConfig ??
    toPublicAuthorityExecutorConfig(input.storedConfig, input.resolveLocalToken);
  const executor = input.executor ?? resolveFallbackExecutor({ executorConfig });
  const executorCapabilities =
    input.executorCapabilities ??
    buildAuthorityExecutorSnapshot({
      storedConfig: input.storedConfig,
      bridgeSnapshot: {
        openclaw: { url: executorConfig.openclaw.url },
        connectionState: executorConfig.connectionState,
        lastError: executorConfig.lastError,
        lastConnectedAt: executorConfig.lastConnectedAt,
      },
      executorStatus: executor,
      sessionStatusCapabilityState: input.sessionStatusCapabilityState,
      resolveLocalToken: input.resolveLocalToken,
    }).executorCapabilities;
  const doctor = input.doctorSnapshot ?? readAuthorityDoctorSnapshot({ dbPath: input.dbPath });
  const preflight =
    input.preflightSnapshot ?? readAuthorityPreflightSnapshot({ dbPath: input.dbPath });
  const guidance =
    input.guidance ?? buildAuthorityHealthGuidance({ doctor, preflight, executor });

  return {
    ok: true,
    executor,
    executorConfig,
    executorCapabilities,
    executorReadiness: buildAuthorityExecutorReadinessChecks({
      executor,
      executorConfig,
      executorCapabilities,
    }),
    authority: {
      dbPath: input.dbPath,
      connected: true,
      startedAt: input.startedAt,
      doctor: {
        status: doctor.status,
        schemaVersion: doctor.schemaVersion,
        integrityStatus: doctor.integrityStatus,
        integrityMessage: doctor.integrityMessage,
        backupDir: doctor.backupDir,
        backupCount: doctor.backupCount,
        latestBackupAt: doctor.latestBackupAt,
        companyCount: doctor.companyCount,
        runtimeCount: doctor.runtimeCount,
        eventCount: doctor.eventCount,
        latestRuntimeAt: doctor.latestRuntimeAt,
        latestEventAt: doctor.latestEventAt,
        activeCompanyId: doctor.activeCompanyId,
        issues: doctor.issues,
      },
      preflight: {
        status: preflight.status,
        dataDir: preflight.dataDir,
        backupDir: preflight.backupDir,
        dbExists: preflight.dbExists,
        schemaVersion: preflight.schemaVersion,
        integrityStatus: preflight.integrityStatus,
        integrityMessage: preflight.integrityMessage,
        backupCount: preflight.backupCount,
        latestBackupAt: preflight.latestBackupAt,
        notes: preflight.notes,
        warnings: preflight.warnings,
        issues: preflight.issues,
      },
      guidance,
    },
  };
}

export function buildAuthorityBootstrapSnapshot(input: {
  authorityUrl: string;
  config: CyberCompanyConfig | null;
  loadRuntime: (companyId: string) => AuthorityCompanyRuntimeSnapshot;
  health: AuthorityHealthSnapshot;
}): AuthorityBootstrapSnapshot {
  const config = input.config;
  const activeCompany =
    config?.companies.find((company) => company.id === config.activeCompanyId) ?? null;
  const runtime = activeCompany ? input.loadRuntime(activeCompany.id) : null;

  return {
    config,
    activeCompany,
    runtime,
    executor: input.health.executor,
    executorConfig: input.health.executorConfig,
    executorCapabilities: input.health.executorCapabilities,
    executorReadiness: input.health.executorReadiness,
    authority: {
      url: input.authorityUrl,
      dbPath: input.health.authority.dbPath,
      connected: true,
    },
  };
}
