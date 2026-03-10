import type {
  ConversationMissionStepRecord,
  TaskStep,
  WorkItemRecord,
} from "../../domain/mission/types";
import type { Company } from "../../domain/org/types";
import { formatAgentLabel } from "../governance/focus-summary";

export type WorkItemPrimaryView = {
  headline: string;
  ownerAgentId: string | null;
  ownerLabel: string;
  stage: string;
  statusLabel: string;
  summary: string;
  actionHint: string;
  nextAgentId: string | null;
  nextLabel: string;
  tone: "slate" | "emerald" | "amber" | "rose" | "indigo";
};

export function workItemToConversationMission(
  workItem: WorkItemRecord,
): {
  title: string;
  statusLabel: string;
  progressLabel: string;
  ownerLabel: string;
  currentStepLabel: string;
  nextLabel: string;
  summary: string;
  guidance: string;
  planSteps: ConversationMissionStepRecord[];
} {
  const completedCount = workItem.steps.filter((step) => step.status === "done").length;
  return {
    title: workItem.title,
    statusLabel:
      workItem.status === "waiting_review"
        ? "待你确认"
        : workItem.status === "waiting_owner"
          ? "待负责人收口"
          : workItem.status === "completed"
            ? "已完成"
            : workItem.status === "blocked"
              ? "阻塞"
              : "进行中",
    progressLabel:
      workItem.steps.length > 0 ? `${completedCount}/${workItem.steps.length}` : "进行中",
    ownerLabel: workItem.displayOwnerLabel || workItem.ownerLabel,
    currentStepLabel: workItem.displayStage || workItem.stageLabel,
    nextLabel: workItem.batonLabel,
    summary: workItem.displaySummary || workItem.summary,
    guidance: workItem.displayNextAction || workItem.nextAction,
    planSteps: workItem.steps.map((step) => ({
      id: step.id,
      title: step.title,
      assigneeLabel: step.assigneeLabel,
      assigneeAgentId: step.assigneeActorId ?? null,
      status: step.status === "done" ? "done" : step.status === "active" ? "wip" : "pending",
      statusLabel:
        step.status === "done" ? "已完成" : step.status === "active" ? "进行中" : "待处理",
      detail: step.detail ?? step.completionCriteria ?? null,
      isCurrent: step.status === "active",
      isNext: step.status === "pending",
    })),
  };
}

export function buildWorkItemPrimaryView(input: {
  company: Company | null | undefined;
  workItem: WorkItemRecord | null | undefined;
}): WorkItemPrimaryView | null {
  const { company, workItem } = input;
  if (!workItem) {
    return null;
  }

  const ownerAgentId = workItem.ownerActorId ?? null;
  const ownerLabel =
    workItem.displayOwnerLabel ||
    workItem.ownerLabel ||
    (ownerAgentId ? formatAgentLabel(company, ownerAgentId) : "当前负责人");
  const batonAgentId =
    workItem.batonActorId && workItem.batonActorId !== ownerAgentId
      ? workItem.batonActorId
      : null;
  const batonLabel =
    workItem.batonLabel ||
    (batonAgentId ? formatAgentLabel(company, batonAgentId) : ownerLabel);
  const currentStep =
    workItem.steps.find((step) => step.status === "active")
    ?? workItem.steps.find((step) => step.status === "pending")
    ?? null;
  const stage = workItem.displayStage || currentStep?.title || workItem.stageLabel;
  const summary = workItem.displaySummary || workItem.summary || workItem.goal || "当前任务正在推进。";
  const actionHint = workItem.displayNextAction || workItem.nextAction || stage || "继续推进当前工作项。";

  switch (workItem.status) {
    case "blocked":
      return {
        headline: workItem.title || workItem.headline || `当前卡点在 ${ownerLabel}`,
        ownerAgentId,
        ownerLabel,
        stage,
        statusLabel: "已阻塞",
        summary,
        actionHint,
        nextAgentId: batonAgentId ?? ownerAgentId,
        nextLabel: batonLabel || ownerLabel,
        tone: "rose",
      };
    case "waiting_owner":
      return {
        headline: workItem.title || workItem.headline || `等待 ${ownerLabel} 收口`,
        ownerAgentId,
        ownerLabel,
        stage,
        statusLabel: "待负责人收口",
        summary,
        actionHint,
        nextAgentId: ownerAgentId,
        nextLabel: ownerLabel,
        tone: "amber",
      };
    case "waiting_review":
      return {
        headline: workItem.title || workItem.headline || "等待确认当前阶段",
        ownerAgentId,
        ownerLabel,
        stage,
        statusLabel: "待你确认",
        summary,
        actionHint,
        nextAgentId: ownerAgentId,
        nextLabel: ownerLabel,
        tone: "amber",
      };
    case "completed":
      return {
        headline: workItem.title || workItem.headline || `${ownerLabel} 这一步已完成`,
        ownerAgentId,
        ownerLabel,
        stage,
        statusLabel: "已完成",
        summary,
        actionHint,
        nextAgentId: batonAgentId,
        nextLabel: batonLabel,
        tone: "emerald",
      };
    default:
      return {
        headline:
          workItem.title ||
          workItem.headline ||
          (batonAgentId ? `当前流转到 ${batonLabel}` : `当前流转到 ${ownerLabel}`),
        ownerAgentId,
        ownerLabel,
        stage,
        statusLabel: currentStep?.status === "pending" ? "待处理" : "进行中",
        summary,
        actionHint,
        nextAgentId: batonAgentId ?? ownerAgentId,
        nextLabel: batonLabel || ownerLabel,
        tone: batonAgentId ? "amber" : "indigo",
      };
  }
}

export function summarizeStepLabel(step: TaskStep | undefined): string | null {
  if (!step) {
    return null;
  }

  const cleaned = step.text
    .replace(/^\s*[-*]?\s*\[[ x/]\]\s*/i, "")
    .replace(/[\u2192→].*$/, "")
    .replace(/@([\p{L}\p{N}_-]+)/gu, "")
    .replace(/\s+/g, " ")
    .trim();

  return cleaned || null;
}
