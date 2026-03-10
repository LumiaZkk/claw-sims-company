import type { Company } from "../../domain/org/types";
import type { TaskStep } from "../../domain/mission/types";
import type { RequirementExecutionOverview, RequirementParticipantProgress } from "../mission/requirement-overview";
import { isParticipantCompletedStatus, isParticipantRunningStatus, isParticipantWaitingStatus, isStrategicRequirementTopic } from "../mission/requirement-kind";
import { formatAgentLabel } from "../governance/focus-summary";

export type ChatFocusTone = "slate" | "emerald" | "amber" | "rose" | "indigo";

export type StrategicDirectParticipantView = {
  participant: RequirementParticipantProgress;
  headline: string;
  ownerAgentId: string;
  ownerLabel: string;
  stage: string;
  statusLabel: string;
  summary: string;
  actionHint: string;
  nextAgentId: string | null;
  nextLabel: string;
  tone: ChatFocusTone;
};

function normalizeAssigneeToken(value: string): string {
  return value.replace(/^@/, "").trim().toLowerCase();
}

export function resolveAgentIdFromToken(
  employees: Array<{ agentId: string; nickname: string; role: string }>,
  token: string | undefined,
): string | null {
  const normalized = normalizeAssigneeToken(token ?? "");
  if (!normalized) {
    return null;
  }

  const exact = employees.find((employee) => {
    const nickname = employee.nickname.trim().toLowerCase();
    const role = employee.role.trim().toLowerCase();
    const agentId = employee.agentId.trim().toLowerCase();
    return agentId === normalized || nickname === normalized || role === normalized;
  });
  if (exact) {
    return exact.agentId;
  }

  const fuzzy = employees.find((employee) => {
    const nickname = employee.nickname.trim().toLowerCase();
    const role = employee.role.trim().toLowerCase();
    return nickname.includes(normalized) || normalized.includes(nickname) || role.includes(normalized);
  });
  return fuzzy?.agentId ?? null;
}

export function resolveStepAssigneeAgentId(
  step: TaskStep | undefined,
  employees: Array<{ agentId: string; nickname: string; role: string }>,
): string | null {
  if (!step) {
    return null;
  }

  const direct = resolveAgentIdFromToken(employees, step.assignee);
  if (direct) {
    return direct;
  }

  const mentions = step.text.match(/@([\p{L}\p{N}_-]+)/gu) ?? [];
  for (const mention of mentions) {
    const resolved = resolveAgentIdFromToken(employees, mention);
    if (resolved) {
      return resolved;
    }
  }

  for (const employee of employees) {
    const tokens = [employee.nickname, employee.role, employee.agentId].filter(Boolean);
    if (
      employee.agentId.startsWith("co-") &&
      /CEO|HR|CTO|COO/i.test(step.text)
    ) {
      if (
        (employee.agentId === "co-ceo" && /CEO/i.test(step.text)) ||
        (employee.agentId === "co-hr" && /HR/i.test(step.text)) ||
        (employee.agentId === "co-cto" && /CTO/i.test(step.text)) ||
        (employee.agentId === "co-coo" && /COO/i.test(step.text))
      ) {
        return employee.agentId;
      }
    }

    if (tokens.some((token) => step.text.includes(token))) {
      return employee.agentId;
    }
  }

  return null;
}

function toFocusTone(
  tone: RequirementParticipantProgress["tone"],
): ChatFocusTone {
  if (tone === "rose") {
    return "rose";
  }
  if (tone === "amber") {
    return "amber";
  }
  if (tone === "emerald") {
    return "emerald";
  }
  if (tone === "blue" || tone === "violet") {
    return "indigo";
  }
  return "slate";
}

export function buildStrategicDirectParticipantView(input: {
  company: Company | null | undefined;
  overview: RequirementExecutionOverview | null;
  targetAgentId: string | null | undefined;
  isCeoSession: boolean;
}): StrategicDirectParticipantView | null {
  const { company, isCeoSession, overview, targetAgentId } = input;
  if (!company || !overview || !targetAgentId || isCeoSession || !isStrategicRequirementTopic(overview.topicKey)) {
    return null;
  }

  const participant = overview.participants.find((item) => item.agentId === targetAgentId) ?? null;
  if (!participant) {
    return null;
  }

  const ownerAgentId = participant.agentId;
  const ownerLabel = participant.nickname;
  const globalOwnerAgentId =
    overview.currentOwnerAgentId && overview.currentOwnerAgentId !== participant.agentId
      ? overview.currentOwnerAgentId
      : null;
  const globalOwnerLabel =
    globalOwnerAgentId && company
      ? formatAgentLabel(company, globalOwnerAgentId)
      : overview.currentOwnerLabel || "负责人";

  if (participant.isBlocking) {
    return {
      participant,
      headline: `${participant.nickname} 这一步卡住了`,
      ownerAgentId,
      ownerLabel,
      stage: participant.stage,
      statusLabel: participant.statusLabel,
      summary: participant.detail,
      actionHint: `先在这里把这一步补齐；完成后明确回传给 ${globalOwnerLabel}。`,
      nextAgentId: ownerAgentId,
      nextLabel: ownerLabel,
      tone: "rose",
    };
  }

  if (isParticipantCompletedStatus(participant.statusLabel)) {
    return {
      participant,
      headline: `${participant.nickname} 这一步已回传`,
      ownerAgentId,
      ownerLabel,
      stage: participant.stage,
      statusLabel: participant.statusLabel,
      summary: participant.detail,
      actionHint:
        globalOwnerAgentId && globalOwnerLabel !== participant.nickname
          ? `这一步已经完成并回传给 ${globalOwnerLabel}，现在去看负责人收口。`
          : "这一步已经完成，可以继续做总结、补充或进入下一棒。",
      nextAgentId: globalOwnerAgentId,
      nextLabel: globalOwnerAgentId ? `${globalOwnerLabel} 收口` : "等待负责人收口",
      tone: "emerald",
    };
  }

  if (isParticipantWaitingStatus(participant.statusLabel)) {
    return {
      participant,
      headline: `${participant.nickname} 正在等待接棒`,
      ownerAgentId,
      ownerLabel,
      stage: participant.stage,
      statusLabel: participant.statusLabel,
      summary: participant.detail,
      actionHint: `先确认这一步有没有真正接住；如果已经完成，明确回传给 ${globalOwnerLabel}。`,
      nextAgentId: ownerAgentId,
      nextLabel: ownerLabel,
      tone: "amber",
    };
  }

  if (isParticipantRunningStatus(participant.statusLabel) || participant.isCurrent) {
    return {
      participant,
      headline: `${participant.nickname} 正在处理这一步`,
      ownerAgentId,
      ownerLabel,
      stage: participant.stage,
      statusLabel: participant.statusLabel,
      summary: participant.detail,
      actionHint: `继续在这里完成 ${participant.stage}，完成后明确回传给 ${globalOwnerLabel}。`,
      nextAgentId: ownerAgentId,
      nextLabel: ownerLabel,
      tone: toFocusTone(participant.tone),
    };
  }

  return {
    participant,
    headline: `${participant.nickname} 负责这一环`,
    ownerAgentId,
    ownerLabel,
    stage: participant.stage,
    statusLabel: participant.statusLabel,
    summary: participant.detail || overview.summary,
    actionHint: globalOwnerAgentId
      ? `这条主线由 ${globalOwnerLabel} 收口；如果你在这里补充结论，记得回传给负责人。`
      : "继续在这里补充结论和下一步判断。",
    nextAgentId: globalOwnerAgentId,
    nextLabel: globalOwnerAgentId ? `${globalOwnerLabel} 收口` : ownerLabel,
    tone: toFocusTone(participant.tone),
  };
}
