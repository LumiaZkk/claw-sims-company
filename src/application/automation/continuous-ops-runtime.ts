import { isApprovalPending } from "../../domain/governance/approval";
import type { AutomationRunRecord, Company } from "../../domain/org/types";
import type { CronJob } from "../gateway";
import type { AutomationBudgetGuardrail } from "./budget-guardrail";
import type { CompanyHeartbeatSurface } from "../org/company-heartbeat";

export type ContinuousOpsRuntimeState = "healthy" | "watch" | "blocked";

export type ContinuousOpsRuntimeLane = {
  id: "heartbeat" | "automation" | "guardrail" | "approvals";
  label: string;
  state: ContinuousOpsRuntimeState;
  summary: string;
  detail: string;
  href: "/settings" | "/automation" | "/ops";
};

export type ContinuousOpsRuntimeSummary = {
  state: ContinuousOpsRuntimeState;
  badgeLabel: string;
  title: string;
  summary: string;
  detail: string;
  metrics: Array<{ label: string; value: string }>;
  lanes: ContinuousOpsRuntimeLane[];
};

function foldRuntimeStates(states: ContinuousOpsRuntimeState[]): ContinuousOpsRuntimeState {
  if (states.includes("blocked")) {
    return "blocked";
  }
  if (states.includes("watch")) {
    return "watch";
  }
  return "healthy";
}

function buildHeartbeatLane(heartbeat: CompanyHeartbeatSurface): ContinuousOpsRuntimeLane {
  if (heartbeat.status === "disabled") {
    return {
      id: "heartbeat",
      label: "Heartbeat",
      state: "blocked",
      summary: heartbeat.title,
      detail: "业务 heartbeat 已关闭，持续运行基线不再完整。",
      href: "/settings",
    };
  }
  if (heartbeat.status === "paused" || heartbeat.status === "attention") {
    return {
      id: "heartbeat",
      label: "Heartbeat",
      state: "watch",
      summary: heartbeat.title,
      detail: heartbeat.detail,
      href: "/settings",
    };
  }
  return {
    id: "heartbeat",
    label: "Heartbeat",
    state: "healthy",
    summary: heartbeat.title,
    detail: heartbeat.detail,
    href: "/settings",
  };
}

function buildAutomationLane(input: {
  jobs: CronJob[];
  automationRuns: AutomationRunRecord[];
}): ContinuousOpsRuntimeLane {
  const enabledJobs = input.jobs.filter((job) => job.enabled !== false);
  const failedRuns = input.automationRuns.filter((run) => run.status === "failed");
  const runningRuns = input.automationRuns.filter((run) => run.status === "running");

  if (failedRuns.length > 0) {
    return {
      id: "automation",
      label: "自动化台账",
      state: "watch",
      summary: `最近有 ${failedRuns.length} 条自动化运行失败，需要继续回看原因。`,
      detail:
        failedRuns[0]?.message ??
        `当前启用 ${enabledJobs.length} 项班次，最近失败记录 ${failedRuns.length} 条。`,
      href: "/automation",
    };
  }

  if (enabledJobs.length === 0) {
    return {
      id: "automation",
      label: "自动化台账",
      state: "watch",
      summary: "当前还没有启用中的自动化班次。",
      detail: "持续运行现在主要靠 heartbeat 和人工触发，建议至少补一条正式班次。",
      href: "/automation",
    };
  }

  return {
    id: "automation",
    label: "自动化台账",
    state: "healthy",
    summary:
      runningRuns.length > 0
        ? `当前有 ${runningRuns.length} 条自动化正在运行。`
        : `当前有 ${enabledJobs.length} 条自动化班次处于启用状态。`,
    detail:
      input.automationRuns[0]?.message ??
      `最近台账共 ${input.automationRuns.length} 条记录，未发现新的失败项。`,
    href: "/automation",
  };
}

function buildGuardrailLane(budget: AutomationBudgetGuardrail): ContinuousOpsRuntimeLane {
  if (budget.status === "over_budget" || budget.status === "usage_unavailable") {
    return {
      id: "guardrail",
      label: "预算护栏",
      state: "blocked",
      summary: budget.title,
      detail: budget.detail,
      href: "/automation",
    };
  }
  if (budget.status === "warning" || budget.status === "inactive") {
    return {
      id: "guardrail",
      label: "预算护栏",
      state: "watch",
      summary: budget.title,
      detail: budget.detail,
      href: "/automation",
    };
  }
  return {
    id: "guardrail",
    label: "预算护栏",
    state: "healthy",
    summary: budget.title,
    detail: budget.detail,
    href: "/automation",
  };
}

function buildApprovalLane(company: Company): ContinuousOpsRuntimeLane {
  const pendingAutomationApprovals = (company.approvals ?? []).filter(
    (approval) =>
      isApprovalPending(approval) &&
      (approval.scope === "automation" || approval.actionType === "automation_enable"),
  );

  if (pendingAutomationApprovals.length > 0) {
    return {
      id: "approvals",
      label: "自动化审批",
      state: "watch",
      summary: `当前还有 ${pendingAutomationApprovals.length} 条自动化启用审批待处理。`,
      detail: pendingAutomationApprovals[0]?.summary ?? "需要先处理审批，相关班次才能继续启用。",
      href: "/ops",
    };
  }

  return {
    id: "approvals",
    label: "自动化审批",
    state: "healthy",
    summary: "当前没有新的自动化启用审批卡住运行基线。",
    detail: "后续若预算护栏触发人工拍板，会先在这里出现。",
    href: "/ops",
  };
}

export function buildContinuousOpsRuntimeSummary(input: {
  company: Company;
  heartbeat: CompanyHeartbeatSurface;
  budgetGuardrail: AutomationBudgetGuardrail;
  jobs: CronJob[];
}): ContinuousOpsRuntimeSummary {
  const automationRuns = [...(input.company.automationRuns ?? [])]
    .sort((left, right) => right.updatedAt - left.updatedAt)
    .slice(0, 8);
  const lanes = [
    buildHeartbeatLane(input.heartbeat),
    buildAutomationLane({ jobs: input.jobs, automationRuns }),
    buildGuardrailLane(input.budgetGuardrail),
    buildApprovalLane(input.company),
  ];
  const state = foldRuntimeStates(lanes.map((lane) => lane.state));
  const primaryLane =
    lanes.find((lane) => lane.state === "blocked") ??
    lanes.find((lane) => lane.state === "watch") ??
    lanes[0];
  const enabledJobs = input.jobs.filter((job) => job.enabled !== false).length;
  const failedRuns = automationRuns.filter((run) => run.status === "failed").length;
  const pendingApprovals = (input.company.approvals ?? []).filter(
    (approval) =>
      isApprovalPending(approval) &&
      (approval.scope === "automation" || approval.actionType === "automation_enable"),
  ).length;

  return {
    state,
    badgeLabel:
      state === "blocked" ? "有阻塞" : state === "watch" ? "需关注" : "运行稳定",
    title:
      state === "blocked"
        ? "持续运行基线当前有阻塞"
        : state === "watch"
          ? "持续运行基线当前需关注"
          : "持续运行基线当前稳定",
    summary:
      state === "healthy"
        ? "heartbeat、自动化台账、预算护栏和审批链路当前都处于可继续运行的状态。"
        : primaryLane.summary,
    detail:
      state === "healthy"
        ? "如果后续出现 heartbeat 暂停、自动化失败或预算护栏阻塞，这块会和 Automation / Ops 同步变化。"
        : primaryLane.detail,
    metrics: [
      { label: "启用班次", value: String(enabledJobs) },
      { label: "失败台账", value: String(failedRuns) },
      { label: "自动化审批", value: String(pendingApprovals) },
      { label: "Heartbeat", value: input.heartbeat.paused ? "暂停" : input.heartbeat.enabled ? "运行中" : "关闭" },
    ],
    lanes,
  };
}
