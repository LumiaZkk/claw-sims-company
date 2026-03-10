import { resolveStepAssigneeAgentId } from "../assignment/chat-participants";
import { formatAgentLabel } from "../governance/focus-summary";
import type { FocusProgressEvent, FocusProgressTone } from "../governance/chat-progress";
import { summarizeStepLabel } from "./conversation-work-item-view";
import type { Company, HandoffRecord, RequestRecord, TrackedTask } from "../../domain";

export type ChatCollaborationTimelineItem = {
  id: string;
  title: string;
  assigneeAgentId: string | null;
  assigneeLabel: string;
  statusLabel: string;
  tone: FocusProgressTone;
  feedback: string | null;
  isCurrent: boolean;
};

export function buildChatCollaborationTimeline(input: {
  company: Company | null;
  structuredTaskPreview: TrackedTask | null;
  progressSignalEvents: FocusProgressEvent[];
  requestPreview: RequestRecord[];
  handoffPreview: HandoffRecord[];
}): ChatCollaborationTimelineItem[] {
  if (!input.company || !input.structuredTaskPreview) {
    return [];
  }

  return input.structuredTaskPreview.steps.slice(0, 5).map((step, index) => {
    const assigneeAgentId = resolveStepAssigneeAgentId(step, input.company!.employees);
    const assigneeLabel = assigneeAgentId
      ? formatAgentLabel(input.company, assigneeAgentId)
      : step.assignee?.replace(/^@/, "") || "待分配";
    const latestAgentProgress = assigneeAgentId
      ? input.progressSignalEvents.find((event) => event.actorAgentId === assigneeAgentId)
      : null;
    const relatedRequest = assigneeAgentId
      ? input.requestPreview.find((request) => request.toAgentIds.includes(assigneeAgentId))
      : null;
    const relatedHandoff = assigneeAgentId
      ? input.handoffPreview.find((handoff) => handoff.toAgentIds.includes(assigneeAgentId))
      : null;

    const feedback =
      latestAgentProgress?.summary ||
      relatedRequest?.responseSummary ||
      relatedHandoff?.summary ||
      null;

    const statusLabel =
      step.status === "done"
        ? "已完成"
        : latestAgentProgress?.tone === "rose"
          ? "执行失败"
          : step.status === "wip"
            ? "执行中"
            : index === 0 || input.structuredTaskPreview!.steps[index - 1]?.status === "done"
              ? "待处理"
              : "等待前一步";

    const tone: FocusProgressTone =
      step.status === "done"
        ? "emerald"
        : latestAgentProgress?.tone === "rose"
          ? "rose"
          : step.status === "wip"
            ? "indigo"
            : "amber";

    return {
      id: `${input.structuredTaskPreview!.id}:${index}`,
      title: summarizeStepLabel(step) ?? step.text,
      assigneeAgentId,
      assigneeLabel,
      statusLabel,
      tone,
      feedback,
      isCurrent:
        step.status !== "done" &&
        !input.structuredTaskPreview!.steps.slice(0, index).some((item) => item.status !== "done"),
    };
  });
}
