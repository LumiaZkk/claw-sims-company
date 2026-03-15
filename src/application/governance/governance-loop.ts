import { isApprovalPending } from "../../domain/governance/approval";
import type { Company } from "../../domain/org/types";
import type { AutomationBudgetGuardrailStatus } from "../automation/budget-guardrail";

export type GovernanceLoopState = "clear" | "watch" | "action_required";

export type GovernanceLoopLane = {
  id: "decisions" | "guardrails" | "capabilities" | "operations";
  label: string;
  state: GovernanceLoopState;
  count: number;
  summary: string;
  nextAction: string;
  href: "/ops" | "/automation" | "/workspace";
};

export type GovernanceLoopSummary = {
  state: GovernanceLoopState;
  badgeLabel: string;
  title: string;
  summary: string;
  detail: string;
  lanes: GovernanceLoopLane[];
};

function foldGovernanceStates(states: GovernanceLoopState[]): GovernanceLoopState {
  if (states.includes("action_required")) {
    return "action_required";
  }
  if (states.includes("watch")) {
    return "watch";
  }
  return "clear";
}

function buildDecisionLane(input: {
  company: Company;
  pendingHumanDecisions: number;
}): GovernanceLoopLane {
  const pendingApprovals = (input.company.approvals ?? []).filter(isApprovalPending).length;
  const count = pendingApprovals + Math.max(0, input.pendingHumanDecisions);

  if (count > 0) {
    return {
      id: "decisions",
      label: "待拍板",
      state: "action_required",
      count,
      summary: `当前还有 ${count} 条审批或决策没有正式拍板，继续推进会把执行闭环拖回人工等待。`,
      nextAction: "先去 Ops 处理审批和决策票，再继续推进主线。",
      href: "/ops",
    };
  }

  return {
    id: "decisions",
    label: "待拍板",
    state: "clear",
    count: 0,
    summary: "当前没有新的审批或决策票卡在人工拍板阶段。",
    nextAction: "继续沿着主线推进，后续若出现新的审批会在这里同步出现。",
    href: "/ops",
  };
}

function buildGuardrailLane(input: {
  budgetStatus: AutomationBudgetGuardrailStatus | null;
  budgetTitle: string | null;
  blockedAutomationCount: number;
}): GovernanceLoopLane {
  const budgetRisk =
    input.budgetStatus === "over_budget" || input.budgetStatus === "usage_unavailable"
      ? "action_required"
      : input.budgetStatus === "warning"
        ? "watch"
        : "clear";
  const count = Math.max(
    0,
    input.blockedAutomationCount + (budgetRisk === "clear" ? 0 : 1),
  );

  if (budgetRisk === "action_required") {
    return {
      id: "guardrails",
      label: "护栏阻塞",
      state: "action_required",
      count,
      summary: `自动化预算或运行护栏当前正在阻塞新动作${input.budgetTitle ? `：${input.budgetTitle}` : "。"} `,
      nextAction: "先去 Automation 查看预算与失败台账，再决定是否继续启用新班次。",
      href: "/automation",
    };
  }

  if (budgetRisk === "watch" || input.blockedAutomationCount > 0) {
    return {
      id: "guardrails",
      label: "护栏阻塞",
      state: "watch",
      count,
      summary:
        input.blockedAutomationCount > 0
          ? `当前有 ${input.blockedAutomationCount} 条自动化运行记录失败，需要继续回看原因和补救动作。`
          : input.budgetTitle ?? "自动化预算已经接近上限，继续扩容前需要先看护栏。",
      nextAction: "去 Automation 看最近运行台账和预算护栏，再决定是否追加自动化。",
      href: "/automation",
    };
  }

  return {
    id: "guardrails",
    label: "护栏阻塞",
    state: "clear",
    count: 0,
    summary: "预算和自动化护栏当前没有新的阻塞项。",
    nextAction: "如果后续出现预算告警或失败运行，会在这里统一提示。",
    href: "/automation",
  };
}

function buildCapabilityLane(company: Company): GovernanceLoopLane {
  const openRequests = (company.capabilityRequests ?? []).filter((request) => request.status !== "closed");
  const openIssues = (company.capabilityIssues ?? []).filter((issue) => issue.status !== "closed");
  const verifyCount =
    openRequests.filter((request) => request.status === "ready" || request.status === "verified").length +
    openIssues.filter((issue) => issue.status === "ready_for_verify" || issue.status === "verified").length;
  const count = openRequests.length + openIssues.length;

  if (verifyCount > 0) {
    return {
      id: "capabilities",
      label: "待验证能力",
      state: "watch",
      count,
      summary: `当前有 ${verifyCount} 条能力需求或问题已经进入待验证阶段，需要业务方尽快给出通过/打回结论。`,
      nextAction: "去 Workspace 看能力需求与问题看板，优先收口待验证项。",
      href: "/workspace",
    };
  }

  if (count > 0) {
    return {
      id: "capabilities",
      label: "待验证能力",
      state: "watch",
      count,
      summary: `当前有 ${count} 条能力需求或问题仍在 backlog/建设中，还没有彻底收口。`,
      nextAction: "去 Workspace 看 CTO 中台能力队列，确认是谁接下一步。",
      href: "/workspace",
    };
  }

  return {
    id: "capabilities",
    label: "待验证能力",
    state: "clear",
    count: 0,
    summary: "当前没有新的能力需求或问题挂在治理链路里。",
    nextAction: "能力治理保持清空时，就不需要额外切到 Workspace 做人工巡检。",
    href: "/workspace",
  };
}

function buildOperationsLane(input: {
  manualTakeovers: number;
  escalations: number;
}): GovernanceLoopLane {
  const count = Math.max(0, input.manualTakeovers) + Math.max(0, input.escalations);

  if (count > 0) {
    return {
      id: "operations",
      label: "人工介入",
      state: "watch",
      count,
      summary: `最近还有 ${count} 条人工接管或升级异常留在运营面上，说明系统仍处于收口中的治理态。`,
      nextAction: "在 Ops 里先清掉接管和升级异常，再回到业务页面继续推进。",
      href: "/ops",
    };
  }

  return {
    id: "operations",
    label: "人工介入",
    state: "clear",
    count: 0,
    summary: "最近没有新的人工接管或升级异常堆积。",
    nextAction: "当前可以把精力继续放在主线推进和验收闭环上。",
    href: "/ops",
  };
}

export function buildGovernanceLoopSummary(input: {
  company: Company;
  pendingHumanDecisions: number;
  manualTakeovers: number;
  escalations: number;
  budgetStatus?: AutomationBudgetGuardrailStatus | null;
  budgetTitle?: string | null;
  blockedAutomationCount?: number;
}): GovernanceLoopSummary {
  const lanes = [
    buildDecisionLane({
      company: input.company,
      pendingHumanDecisions: input.pendingHumanDecisions,
    }),
    buildGuardrailLane({
      budgetStatus: input.budgetStatus ?? null,
      budgetTitle: input.budgetTitle ?? null,
      blockedAutomationCount: input.blockedAutomationCount ?? 0,
    }),
    buildCapabilityLane(input.company),
    buildOperationsLane({
      manualTakeovers: input.manualTakeovers,
      escalations: input.escalations,
    }),
  ];
  const state = foldGovernanceStates(lanes.map((lane) => lane.state));
  const primaryLane =
    lanes.find((lane) => lane.state === "action_required") ??
    lanes.find((lane) => lane.state === "watch") ??
    lanes[0];
  const activeLaneCount = lanes.filter((lane) => lane.state !== "clear").length;

  return {
    state,
    badgeLabel:
      state === "action_required" ? "需拍板" : state === "watch" ? "需跟进" : "已收口",
    title:
      state === "action_required"
        ? "治理回路里还有阻断项"
        : state === "watch"
          ? "治理回路里还有待跟进项"
          : "治理回路当前已收口",
    summary:
      state === "action_required"
        ? primaryLane.summary
        : state === "watch"
          ? `当前有 ${activeLaneCount} 条治理分道仍在运行，最先需要关注的是「${primaryLane.label}」。`
          : "审批、护栏、能力治理和人工介入当前都没有新的堆积项。",
    detail:
      state === "clear"
        ? "后续若出现审批、预算告警、能力待验证或人工接管，这里会和 Activity Inbox 一起同步变化。"
        : primaryLane.nextAction,
    lanes,
  };
}
