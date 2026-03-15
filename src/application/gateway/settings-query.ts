import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useCompanyShellQuery } from "../company/shell";
import { getRecentCompanyEventsSince, RECENT_COMPANY_EVENTS_LIMIT } from "../org/company-events-query";
import { isOrgAutopilotEnabled } from "../assignment/org-fit";
import { gateway, type GatewayModelChoice, useGatewayStore } from "./index";
import type { CompanyEvent } from "../../domain/delegation/events";
import { useAuthorityRuntimeSyncStore } from "../../infrastructure/authority/runtime-sync-store";
import {
  listAuthorityOwnedRuntimeSliceLabels,
  listCompatibilityRuntimeSliceLabels,
} from "../../infrastructure/authority/runtime-slice-ownership";
import type {
  CompanyAutonomyPolicy,
  CompanyHeartbeatPolicy,
  CompanyCollaborationPolicy,
  CompanyWorkspacePolicy,
} from "../../domain/org/types";
import {
  buildAuthorityControlPlaneSummaryModel,
  formatAuthorityIntegrityLabel,
  buildAuthorityRuntimeSyncDiagnosticsModel,
  collectAuthorityGuidance,
  extractAuthorityHealthSnapshot,
  resolveAuthorityStorageState,
  type AuthorityRuntimeSyncDiagnosticsModel,
} from "./authority-health";
import {
  formatCodexAuthCompletionDescription,
  formatCodexRuntimeSyncDescription,
} from "./codex-runtime";
import {
  isTransientAuthorityFetchError,
  retryTransientAuthorityOperation,
} from "./settings-recovery";

type JsonMap = Record<string, unknown>;
type GatewayRefreshRequestId =
  | "health"
  | "status"
  | "channels"
  | "skills"
  | "configSnapshot"
  | "models"
  | "companyEvents";
type GatewayRefreshFailure = {
  id: GatewayRefreshRequestId;
  label: string;
  message: string;
  required: boolean;
};
type GatewayRefreshIssue = {
  severity: "warning" | "error";
  message: string;
  failures: GatewayRefreshFailure[];
};

const GATEWAY_REFRESH_REQUEST_LABELS: Record<GatewayRefreshRequestId, string> = {
  health: "Authority 健康快照",
  status: "Authority 状态",
  channels: "渠道状态",
  skills: "技能状态",
  configSnapshot: "配置快照",
  models: "模型目录",
  companyEvents: "最近巡检审计",
};

export type GatewayDoctorLayerState = "ready" | "attention" | "degraded" | "blocked";
export type GatewayDoctorLayer = {
  id: "gateway" | "authority" | "executor" | "runtime";
  label: string;
  state: GatewayDoctorLayerState;
  summary: string;
  detail: string;
  timestamp?: number | null;
};
export type GatewayDoctorBaseline = {
  overallState: GatewayDoctorLayerState;
  mode: "compatibility_snapshot" | "command_preferred";
  layers: GatewayDoctorLayer[];
  validationChecklist: string[];
  compatibilityPathEnabled: boolean;
  compatibilitySlices: string[];
  authorityOwnedSlices: string[];
  commandRoutes: string[];
  lastError: string | null;
  runtimeSync: AuthorityRuntimeSyncDiagnosticsModel;
};
export type GatewayConfigSnapshot = Awaited<ReturnType<typeof gateway.getConfigSnapshot>>;
export type GatewayProviderConfig = {
  apiKey?: string;
  baseUrl?: string;
  models?: string[];
} & Record<string, unknown>;
export type GatewayTelegramConfig = { enabled?: boolean; botToken?: string } | null;

export function sleep(ms: number) {
  return new Promise((resolve) => window.setTimeout(resolve, ms));
}

function foldLayerStates(states: GatewayDoctorLayerState[]): GatewayDoctorLayerState {
  if (states.includes("blocked")) {
    return "blocked";
  }
  if (states.includes("degraded")) {
    return "degraded";
  }
  if (states.includes("attention")) {
    return "attention";
  }
  return "ready";
}

function readSettledValue<T>(
  result: PromiseSettledResult<T>,
  onRejected: (message: string) => void,
): T | null {
  if (result.status === "fulfilled") {
    return result.value;
  }
  const message = result.reason instanceof Error ? result.reason.message : String(result.reason);
  onRejected(message);
  return null;
}

function normalizeGatewayRefreshFailureMessage(message: string) {
  const trimmed = message.trim();
  const scopeMatch = trimmed.match(/missing scope:\s*([a-zA-Z0-9._-]+)/i);
  if (scopeMatch) {
    return `下游 OpenClaw 尚未授予 ${scopeMatch[1]} 权限。`;
  }
  if (trimmed.startsWith("{") && trimmed.includes("\"error\"")) {
    try {
      const parsed = JSON.parse(trimmed) as { error?: unknown };
      if (typeof parsed.error === "string" && parsed.error.trim().length > 0) {
        return normalizeGatewayRefreshFailureMessage(parsed.error);
      }
    } catch {
      // Keep the original message when the payload is not valid JSON.
    }
  }
  return trimmed;
}

function isGatewayPermissionFailureMessage(message: string) {
  return message.includes("下游 OpenClaw 尚未授予");
}

export function buildGatewayRefreshIssue(
  failures: GatewayRefreshFailure[],
): GatewayRefreshIssue | null {
  if (failures.length === 0) {
    return null;
  }

  const normalizedFailures = failures.map((failure) => ({
    ...failure,
    message: normalizeGatewayRefreshFailureMessage(failure.message),
  }));
  const requiredFailures = normalizedFailures.filter((failure) => failure.required);
  const optionalFailures = normalizedFailures.filter((failure) => !failure.required);

  if (requiredFailures.length > 0) {
    const requiredPermissionFailures = requiredFailures.filter((failure) =>
      isGatewayPermissionFailureMessage(failure.message),
    );
    const labels = requiredFailures.map((failure) => failure.label).join("、");
    const detail = requiredFailures[0]?.message ?? "未知错误";
    if (requiredPermissionFailures.length === requiredFailures.length) {
      return {
        severity: "warning",
        message: `部分核心诊断受当前 OpenClaw 权限限制：${labels}。${detail}`,
        failures: normalizedFailures,
      };
    }
    return {
      severity: "error",
      message: `设置页核心数据刷新失败：${labels}。${detail}`,
      failures: normalizedFailures,
    };
  }

  const labels = optionalFailures.map((failure) => failure.label).join("、");
  const detail = optionalFailures[0]?.message ?? "未知错误";
  return {
    severity: "warning",
    message: `部分扩展诊断暂时不可用：${labels}。${detail}`,
    failures: normalizedFailures,
  };
}

export async function refreshAvailableModels() {
  const modelsResult = await gateway.listModels();
  return modelsResult.models ?? [];
}

export function scheduleFollowupRuntimeRefresh(refreshRuntime: () => Promise<unknown>, delayMs = 1_200) {
  void sleep(delayMs)
    .then(() =>
      retryTransientAuthorityOperation({
        operation: refreshRuntime,
      }),
    )
    .catch(() => undefined);
}

export function useGatewaySettingsQuery() {
  const { connected, error: gatewayError, modelsVersion, phase, token, url } = useGatewayStore();
  const { config: companyConfig, activeCompany } = useCompanyShellQuery();
  const previousModelsVersionRef = useRef(modelsVersion);
  const refreshRequestIdRef = useRef(0);
  const runtimeSync = useAuthorityRuntimeSyncStore();

  const [status, setStatus] = useState<JsonMap | null>(null);
  const [health, setHealth] = useState<JsonMap | null>(null);
  const [channels, setChannels] = useState<JsonMap | null>(null);
  const [skills, setSkills] = useState<JsonMap | null>(null);
  const [configSnapshot, setConfigSnapshot] = useState<GatewayConfigSnapshot | null>(null);
  const [availableModels, setAvailableModels] = useState<GatewayModelChoice[]>([]);
  const [companyEvents, setCompanyEvents] = useState<CompanyEvent[]>([]);
  const [loading, setLoading] = useState(false);
  const [warning, setWarning] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const activeCompanyId = activeCompany?.id ?? null;

  const refreshRuntime = useCallback(async () => {
    if (!gateway.isConnected) {
      setHealth(null);
      setCompanyEvents([]);
      return null;
    }

    const requestId = refreshRequestIdRef.current + 1;
    refreshRequestIdRef.current = requestId;
    setLoading(true);
    setWarning(null);
    setError(null);
    try {
      const failures: GatewayRefreshFailure[] = [];
      const recordFailure = (
        id: GatewayRefreshRequestId,
        message: string,
        required = false,
      ) => {
        failures.push({
          id,
          label: GATEWAY_REFRESH_REQUEST_LABELS[id],
          message,
          required,
        });
      };
      const [
        healthResult,
        statusResult,
        channelsResult,
        skillsResult,
        snapshotResult,
        modelsResult,
        companyEventsResult,
      ] = await Promise.allSettled([
        retryTransientAuthorityOperation({
          operation: () => gateway.getHealth(),
        }),
        retryTransientAuthorityOperation({
          operation: () => gateway.getStatus(),
        }),
        retryTransientAuthorityOperation({
          operation: () => gateway.getChannelsStatus(),
        }),
        retryTransientAuthorityOperation({
          operation: () => gateway.getSkillsStatus(),
        }),
        retryTransientAuthorityOperation({
          operation: () => gateway.getConfigSnapshot(),
        }),
        retryTransientAuthorityOperation({
          operation: () => gateway.listModels(),
        }),
        activeCompanyId
          ? retryTransientAuthorityOperation({
              operation: () =>
                gateway.listCompanyEvents({
                  companyId: activeCompanyId,
                  since: getRecentCompanyEventsSince(),
                  limit: RECENT_COMPANY_EVENTS_LIMIT,
                  recent: true,
                }),
            })
          : Promise.resolve(null),
      ]);
      const healthValue = readSettledValue(healthResult, (message) =>
        recordFailure("health", message, true),
      );
      const statusValue = readSettledValue(statusResult, (message) =>
        recordFailure("status", message, true),
      );
      const channelsValue = readSettledValue(channelsResult, (message) =>
        recordFailure("channels", message),
      );
      const skillsValue = readSettledValue(skillsResult, (message) =>
        recordFailure("skills", message),
      );
      const snapshotValue = readSettledValue(snapshotResult, (message) =>
        recordFailure("configSnapshot", message, true),
      );
      const modelsValue = readSettledValue(modelsResult, (message) =>
        recordFailure("models", message),
      );
      const companyEventsValue = readSettledValue(companyEventsResult, (message) =>
        recordFailure("companyEvents", message),
      );

      if (requestId !== refreshRequestIdRef.current) {
        return null;
      }

      setHealth(healthValue);
      setStatus(statusValue);
      setChannels(channelsValue);
      setSkills(skillsValue);
      setConfigSnapshot(snapshotValue);
      setAvailableModels(modelsValue?.models ?? []);
      setCompanyEvents(activeCompanyId ? companyEventsValue?.events ?? [] : []);

      const issue = buildGatewayRefreshIssue(failures);
      if (issue?.severity === "warning") {
        setWarning(issue.message);
      }
      if (issue?.severity === "error") {
        setError(issue.message);
        throw new Error(issue.message);
      }
      return {
        health: healthValue,
        status: statusValue,
        channels: channelsValue,
        skills: skillsValue,
        configSnapshot: snapshotValue,
        availableModels: modelsValue?.models ?? [],
        companyEvents: companyEventsValue?.events ?? [],
        warning: issue?.severity === "warning" ? issue.message : null,
      };
    } catch (runtimeError) {
      const message = runtimeError instanceof Error ? runtimeError.message : String(runtimeError);
      if (requestId === refreshRequestIdRef.current) {
        setError(message);
      }
      throw runtimeError;
    } finally {
      if (requestId === refreshRequestIdRef.current) {
        setLoading(false);
      }
    }
  }, [activeCompanyId]);

  useEffect(() => {
    setWarning(null);
    setError(null);
    setCompanyEvents([]);
  }, [activeCompanyId]);

  useEffect(() => {
    if (!connected) {
      setWarning(null);
      setError(null);
      setCompanyEvents([]);
      return;
    }
    void refreshRuntime().catch(() => undefined);
  }, [connected, refreshRuntime]);

  useEffect(() => {
    if (!connected || modelsVersion <= 0) {
      previousModelsVersionRef.current = modelsVersion;
      return;
    }
    if (previousModelsVersionRef.current === modelsVersion) {
      return;
    }
    previousModelsVersionRef.current = modelsVersion;
    void refreshRuntime().catch(() => undefined);
  }, [connected, modelsVersion, refreshRuntime]);

  useEffect(() => {
    if (!connected || !error || !isTransientAuthorityFetchError(error)) {
      return;
    }

    const timer = window.setTimeout(() => {
      void refreshRuntime().catch(() => undefined);
    }, 1_200);

    return () => {
      window.clearTimeout(timer);
    };
  }, [connected, error, refreshRuntime]);

  const companyCount = useMemo(() => companyConfig?.companies.length ?? 0, [companyConfig]);
  const codexModels = useMemo(
    () => availableModels.filter((model) => model.provider === "openai-codex"),
    [availableModels],
  );
  const orgAutopilotEnabled = activeCompany ? isOrgAutopilotEnabled(activeCompany) : false;
  const providerConfigs = ((configSnapshot?.config as { models?: { providers?: Record<string, GatewayProviderConfig> } })
    ?.models?.providers ?? {}) as Record<string, GatewayProviderConfig>;
  const telegramConfig = ((configSnapshot?.config as {
    channels?: { telegram?: { enabled?: boolean; botToken?: string } };
  })?.channels?.telegram ?? null) as GatewayTelegramConfig;
  const authorityHealth = useMemo(() => extractAuthorityHealthSnapshot(health), [health]);
  const executorStatus = authorityHealth?.executor ?? null;
  const executorConfig = authorityHealth?.executorConfig ?? null;
  const doctorBaseline = useMemo<GatewayDoctorBaseline>(() => {
    const authorityControlPlaneSummary = authorityHealth
      ? buildAuthorityControlPlaneSummaryModel(authorityHealth, 1)
      : null;
    const authorityStorageLayer = authorityControlPlaneSummary?.layers.find(
      (layer) => layer.id === "authority-storage",
    );
    const gatewayLayer: GatewayDoctorLayer = connected
      ? {
          id: "gateway",
          label: "Gateway",
          state: "ready",
          summary: "浏览器已连上当前后端。",
          detail: `当前阶段：${phase}。`,
        }
      : {
          id: "gateway",
          label: "Gateway",
          state: gatewayError ? "blocked" : "degraded",
          summary: gatewayError ? "浏览器与后端当前未连通。" : "浏览器尚未建立稳定连接。",
          detail: gatewayError ?? `当前阶段：${phase}。`,
        };

    const authorityLayer: GatewayDoctorLayer = authorityHealth
      ? {
          id: "authority",
          label: "Authority",
          state: authorityStorageLayer?.state ?? resolveAuthorityStorageState(authorityHealth),
          summary:
            authorityStorageLayer?.summary ??
            collectAuthorityGuidance(authorityHealth, 1)[0] ??
            "Authority 本地权威源在线，doctor 与 preflight 已通过。",
          detail:
            authorityControlPlaneSummary?.detail ??
            `${authorityHealth.authority.dbPath} · schema v${
              authorityHealth.authority.doctor.schemaVersion ?? "?"
            } · 完整性 ${formatAuthorityIntegrityLabel(authorityHealth.authority.doctor.integrityStatus)} · 备份 ${
              authorityHealth.authority.doctor.backupCount
            } 份` +
              (authorityHealth.authority.doctor.latestBackupAt
                ? ` · 最新 ${new Date(authorityHealth.authority.doctor.latestBackupAt).toLocaleString("zh-CN", {
                    hour12: false,
                  })}`
                : ""),
          timestamp: authorityHealth.authority.startedAt,
        }
      : {
          id: "authority",
          label: "Authority",
          state: connected ? "degraded" : "blocked",
          summary: connected ? "还没拿到 Authority 健康快照。" : "Authority 健康信息不可用。",
          detail: "请先重连 Gateway 或刷新运行时。",
        };

    const executorLayer: GatewayDoctorLayer = {
      id: "executor",
      label: "Executor",
      state: executorStatus?.state ?? "blocked",
      summary: executorStatus?.note ?? "下游执行器状态未知。",
      detail: [
        executorConfig?.openclaw.url ?? executorConfig?.lastError ?? "尚未检测到可用执行器地址。",
        authorityHealth?.executorCapabilities?.notes[0] ?? null,
      ].filter(Boolean).join(" · "),
      timestamp: executorConfig?.lastConnectedAt ?? null,
    };

    const runtimeLayerState: GatewayDoctorLayerState =
      runtimeSync.lastError
        ? "degraded"
        : runtimeSync.commandCount > 0 || runtimeSync.pushCount > 0 || runtimeSync.pullCount > 0
          ? "ready"
          : "degraded";
    const runtimeLayer: GatewayDoctorLayer = {
      id: "runtime",
      label: "Runtime",
      state: runtimeLayerState,
      summary:
        runtimeSync.mode === "command_preferred"
          ? "主线开始优先走 command 写入。"
          : "当前仍保留 snapshot 兼容同步。",
      detail:
        runtimeSync.lastError ??
        `push ${runtimeSync.pushCount} / pull ${runtimeSync.pullCount} / command ${runtimeSync.commandCount}`,
      timestamp:
        runtimeSync.lastCommandAt ??
        runtimeSync.lastPullAt ??
        runtimeSync.lastPushAt ??
        null,
    };

    return {
      overallState: foldLayerStates([
        gatewayLayer.state,
        authorityLayer.state,
        executorLayer.state,
        runtimeLayer.state,
      ]),
      mode: runtimeSync.mode,
      layers: [gatewayLayer, authorityLayer, executorLayer, runtimeLayer],
      validationChecklist: [
        "单 tab 正常推进一条 requirement",
        "刷新后主线不漂移",
        "断连重连后状态不回退",
        "晚到 control message 不会把主线改乱",
        "authority / gateway / executor 异常能分层定位",
      ],
      compatibilityPathEnabled: runtimeSync.compatibilityPathEnabled,
      compatibilitySlices: listCompatibilityRuntimeSliceLabels(),
      authorityOwnedSlices: listAuthorityOwnedRuntimeSliceLabels(),
      commandRoutes: runtimeSync.commandRoutes,
      lastError: runtimeSync.lastError,
      runtimeSync: buildAuthorityRuntimeSyncDiagnosticsModel(runtimeSync),
    };
  }, [authorityHealth, connected, executorConfig, executorStatus, gatewayError, phase, runtimeSync]);

  return {
    url,
    token,
    connected,
    companyConfig,
    activeCompany,
    status,
    channels,
    skills,
    configSnapshot,
    companyEvents,
    loading,
    warning,
    error,
    companyCount,
    codexModels,
    orgAutopilotEnabled,
    providerConfigs,
    telegramConfig,
    authorityHealth,
    doctorBaseline,
    executorStatus,
    executorConfig,
    refreshRuntime,
  };
}

export type GatewaySettingsQueryResult = ReturnType<typeof useGatewaySettingsQuery>;
