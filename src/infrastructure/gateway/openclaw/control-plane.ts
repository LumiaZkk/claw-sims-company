import type {
  GatewayCodexAuthTargetParams,
  GatewayAuthCodexOauthCallbackResult,
  GatewayAuthCodexOauthStatusResult,
  GatewayAuthCodexOauthStartResult,
  GatewayAuthImportCodexCliResult,
  GatewayModelChoice,
  GatewayModelsListParams,
} from "./types";

export type CostUsageTotals = {
  input: number;
  output: number;
  cacheRead: number;
  cacheWrite: number;
  totalTokens: number;
  totalCost: number;
  inputCost?: number;
  outputCost?: number;
  cacheReadCost?: number;
  cacheWriteCost?: number;
  missingCostEntries?: number;
};

export type CostUsageSummary = {
  updatedAt: number;
  days: number;
  totals: CostUsageTotals;
};

export type SessionCostSummary = CostUsageTotals & {
  sessionId?: string;
  sessionFile?: string;
  firstActivity?: number;
  lastActivity?: number;
  durationMs?: number;
};

export type SessionsUsageEntry = {
  key: string;
  label?: string;
  sessionId?: string;
  updatedAt?: number;
  agentId?: string;
  usage: SessionCostSummary | null;
};

export type SessionsUsageResult = {
  updatedAt: number;
  startDate: string;
  endDate: string;
  sessions: SessionsUsageEntry[];
  totals: CostUsageTotals;
};

export type CronJob = {
  id: string;
  name: string;
  agentId?: string;
  enabled?: boolean;
  schedule?: {
    kind: string;
    expr?: string;
    everyMs?: number;
  };
  payload?: {
    kind: string;
    message?: string;
  };
  state?: {
    lastRunAtMs?: number;
    lastStatus?: string;
    nextRunAtMs?: number;
  };
};

export type CronListResult = {
  jobs?: CronJob[];
  total?: number;
  offset?: number;
  limit?: number;
  hasMore?: boolean;
  nextOffset?: number | null;
};

type GatewayConfigSnapshot = {
  path: string;
  exists: boolean;
  valid: boolean;
  hash?: string;
  config: Record<string, unknown>;
};

type GatewayControlRequester = {
  request<T = unknown>(method: string, params?: unknown): Promise<T>;
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isCostUsageTotals(value: unknown): value is CostUsageTotals {
  if (!isRecord(value)) {
    return false;
  }

  return (
    typeof value.input === "number"
    && typeof value.output === "number"
    && typeof value.cacheRead === "number"
    && typeof value.cacheWrite === "number"
    && typeof value.totalTokens === "number"
    && typeof value.totalCost === "number"
  );
}

function isCostUsageSummary(value: unknown): value is CostUsageSummary {
  if (!isRecord(value)) {
    return false;
  }

  return (
    typeof value.updatedAt === "number"
    && typeof value.days === "number"
    && isCostUsageTotals(value.totals)
  );
}

function normalizeCostUsageSummary(value: unknown): CostUsageSummary | null {
  if (isCostUsageSummary(value)) {
    return value;
  }

  if (!isRecord(value)) {
    return null;
  }

  if (isCostUsageSummary(value.result)) {
    return value.result;
  }

  if (isCostUsageSummary(value.payload)) {
    return value.payload;
  }

  return null;
}

export function buildControlPlaneMethods(gateway: GatewayControlRequester) {
  return {
    async listModels(params?: GatewayModelsListParams): Promise<{ models: GatewayModelChoice[] }> {
      return gateway.request<{ models: GatewayModelChoice[] }>("models.list", params ?? {});
    },

    async refreshModels(): Promise<{ models: GatewayModelChoice[] }> {
      return gateway.request<{ models: GatewayModelChoice[] }>("models.refresh", {});
    },

    async startCodexOAuth(params?: GatewayCodexAuthTargetParams): Promise<GatewayAuthCodexOauthStartResult> {
      return gateway.request<GatewayAuthCodexOauthStartResult>("auth.codexOauthStart", params ?? {});
    },

    async getCodexOAuthStatus(state: string): Promise<GatewayAuthCodexOauthStatusResult> {
      return gateway.request<GatewayAuthCodexOauthStatusResult>("auth.codexOauthStatus", { state });
    },

    async completeCodexOAuth(params: {
      code: string;
      state: string;
      agentIds?: string[];
    }): Promise<GatewayAuthCodexOauthCallbackResult> {
      return gateway.request<GatewayAuthCodexOauthCallbackResult>("auth.codexOauthCallback", params);
    },

    async importCodexCliAuth(params?: GatewayCodexAuthTargetParams): Promise<GatewayAuthImportCodexCliResult> {
      return gateway.request<GatewayAuthImportCodexCliResult>("auth.importCodexCli", params ?? {});
    },

    async listCron(): Promise<CronListResult> {
      return gateway.request("cron.list", {});
    },

    async addCron(job: Record<string, unknown>) {
      return gateway.request("cron.add", job);
    },

    async updateCron(jobId: string, patch: Record<string, unknown>) {
      return gateway.request("cron.update", { jobId, patch });
    },

    async removeCron(id: string): Promise<boolean> {
      const res = await gateway.request<{ ok: boolean }>("cron.remove", { id });
      return res.ok;
    },

    async getUsageCost(params?: { days?: number }): Promise<CostUsageSummary> {
      const res = await gateway.request<unknown>("usage.cost", params || {});
      const summary = normalizeCostUsageSummary(res);
      if (!summary) {
        throw new Error("Failed to load usage cost");
      }
      return summary;
    },

    async getSessionsUsage(params?: {
      key?: string;
      startDate?: string;
      endDate?: string;
      mode?: "utc" | "gateway" | "specific";
      utcOffset?: string;
      limit?: number;
      includeContextWeight?: boolean;
    }): Promise<SessionsUsageResult> {
      return gateway.request<SessionsUsageResult>("sessions.usage", params ?? {});
    },

    async getChannelsStatus() {
      return gateway.request<Record<string, unknown>>("channels.status", {});
    },

    async getSkillsStatus(agentId?: string) {
      return gateway.request<Record<string, unknown>>(
        "skills.status",
        agentId ? { agentId } : {},
      );
    },

    async getHealth() {
      return gateway.request<Record<string, unknown>>("health", {});
    },

    async getStatus() {
      return gateway.request<Record<string, unknown>>("status", {});
    },

    async getConfigSnapshot(): Promise<GatewayConfigSnapshot> {
      return gateway.request<GatewayConfigSnapshot>("config.get", {});
    },

    async setConfig(config: Record<string, unknown>, baseHash: string) {
      return gateway.request("config.set", {
        raw: JSON.stringify(config, null, 2),
        baseHash,
      });
    },

    async patchConfig(patch: Record<string, unknown>, baseHash: string) {
      return gateway.request("config.patch", {
        raw: JSON.stringify(patch, null, 2),
        baseHash,
      });
    },
  };
}
