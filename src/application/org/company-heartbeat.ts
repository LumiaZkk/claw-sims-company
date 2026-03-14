import { evaluateAutomationBudgetGuardrail } from "../automation/budget-guardrail";
import {
  evaluateHeartbeatSchedule,
  getHeartbeatIntervalMs,
  resolveHeartbeatPolicy,
} from "../../domain/org/autonomy-policy";
import type { CompanyEvent } from "../../domain/delegation/events";
import type { Company } from "../../domain/org/types";
import {
  buildCompanyHeartbeatAuditEntries,
  type CompanyHeartbeatAuditEntry,
} from "./company-heartbeat-history";

export type CompanyHeartbeatSurfaceStatus =
  | "disabled"
  | "paused"
  | "idle"
  | "scheduled"
  | "attention";

export type CompanyHeartbeatSurface = {
  status: CompanyHeartbeatSurfaceStatus;
  title: string;
  summary: string;
  detail: string;
  intervalMinutes: number;
  enabled: boolean;
  paused: boolean;
  sourceOfTruth: "cyber_company";
  syncTarget: "openclaw" | "none";
  lastRunAt: number | null;
  lastCheckAt: number | null;
  nextRunAt: number | null;
  lastTrigger: "interval" | "event" | null;
  lastSkipReason: string | null;
  recentActions: string[];
  recentAudit: CompanyHeartbeatAuditEntry[];
  budgetStatus: ReturnType<typeof evaluateAutomationBudgetGuardrail>["status"];
  budgetTitle: string;
  budgetDetail: string;
};

function formatRelativeHeartbeatSummary(input: {
  enabled: boolean;
  paused: boolean;
  lastRunAt: number | null;
  nextRunAt: number | null;
  lastSkipReason: string | null;
}) {
  if (!input.enabled) {
    return {
      status: "disabled" as const,
      title: "CEO 巡检已关闭",
      summary: "当前只保留事件驱动的同步，不再按 heartbeat 周期自动巡检。",
    };
  }
  if (input.paused) {
    return {
      status: "paused" as const,
      title: "CEO 巡检已暂停",
      summary: "后台巡检处于暂停态，直到你重新开启。",
    };
  }
  if (input.lastSkipReason === "heartbeat_not_due" && input.nextRunAt) {
    return {
      status: "scheduled" as const,
      title: "CEO 巡检已排队",
      summary: "后台巡检正常运行中，会在下一轮周期到点后继续检查。",
    };
  }
  if (!input.lastRunAt) {
    return {
      status: "idle" as const,
      title: "CEO 巡检待首次运行",
      summary: "当前已开启 heartbeat，但还没有留下正式巡检记录。",
    };
  }
  return {
    status: "attention" as const,
    title: "CEO 巡检最近已运行",
    summary: "后台巡检已留下最近一次记录，可以继续查看动作和护栏状态。",
  };
}

export function buildCompanyHeartbeatSurface(input: {
  company: Company;
  events?: CompanyEvent[];
  now?: number;
  usageCost?: number | null;
}): CompanyHeartbeatSurface {
  const now = input.now ?? Date.now();
  const policy = resolveHeartbeatPolicy(input.company.orgSettings);
  const lastRunAt = input.company.orgSettings?.autonomyState?.lastEngineRunAt ?? null;
  const lastCheckAt = input.company.orgSettings?.autonomyState?.lastHeartbeatCheckAt ?? null;
  const intervalMs = getHeartbeatIntervalMs(input.company.orgSettings);
  const nextRunAt =
    policy.enabled && !policy.paused
      ? (lastCheckAt ?? lastRunAt ?? now) + intervalMs
      : null;
  const lastSkipReason = input.company.orgSettings?.autonomyState?.lastHeartbeatSkipReason ?? null;
  const schedule = evaluateHeartbeatSchedule({
    orgSettings: input.company.orgSettings,
    lastHeartbeatCheckAt: lastCheckAt ?? lastRunAt,
    now,
  });
  const budget = evaluateAutomationBudgetGuardrail({
    company: input.company,
    usageCost: input.usageCost ?? null,
  });
  const relative = formatRelativeHeartbeatSummary({
    enabled: policy.enabled,
    paused: policy.paused,
    lastRunAt,
    nextRunAt,
    lastSkipReason,
  });
  const scopedEvents = (input.events ?? []).filter((event) => event.companyId === input.company.id);
  const recentAudit = buildCompanyHeartbeatAuditEntries({
    events: scopedEvents,
  });

  let detail = `以 Cyber Company 为权威源，当前按 ${Math.floor(intervalMs / 60_000)} 分钟周期巡检。`;
  if (relative.status === "disabled") {
    detail = "业务 heartbeat 已关闭，OpenClaw 只保留执行器/唤醒层，不承接业务真相。";
  } else if (relative.status === "paused") {
    detail = "业务 heartbeat 已暂停，恢复后会继续沿用当前策略。";
  } else if (schedule.skipReason === "heartbeat_not_due" && nextRunAt) {
    detail = "当前 heartbeat 正常排队中，未到下一轮巡检时间。";
  }

  return {
    status: relative.status,
    title: relative.title,
    summary: relative.summary,
    detail,
    intervalMinutes: Math.floor(intervalMs / 60_000),
    enabled: policy.enabled,
    paused: policy.paused,
    sourceOfTruth: policy.sourceOfTruth,
    syncTarget: policy.syncTarget,
    lastRunAt,
    lastCheckAt,
    nextRunAt,
    lastTrigger: input.company.orgSettings?.autonomyState?.lastHeartbeatTrigger ?? null,
    lastSkipReason,
    recentActions: input.company.orgSettings?.autonomyState?.lastEngineActions ?? [],
    recentAudit,
    budgetStatus: budget.status,
    budgetTitle: budget.title,
    budgetDetail: budget.detail,
  };
}
