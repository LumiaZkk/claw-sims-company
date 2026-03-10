import {
  formatLifecycleEventSummary,
  formatLifecycleEventTitle,
  type FocusProgressEvent,
  type FocusProgressTone,
} from "../../../application/governance/chat-progress";
import type { CollaborationLifecycleEntry } from "./focus";

type CollaborationTimelineItem = {
  id: string;
  title: string;
  feedback: string | null;
  assigneeLabel: string;
  assigneeAgentId: string | null;
  tone: FocusProgressTone;
};

export function buildCollaborationLifecycle(params: {
  recentProgressEvents: FocusProgressEvent[];
  progressSignalEvents: FocusProgressEvent[];
  currentTimelineItem: CollaborationTimelineItem | null;
  previewTimestamp: number;
}): CollaborationLifecycleEntry[] {
  const { recentProgressEvents, progressSignalEvents, currentTimelineItem, previewTimestamp } = params;
  const lifecycleSourceEvents =
    recentProgressEvents.length > 0 ? recentProgressEvents : progressSignalEvents;
  const progressEntries = lifecycleSourceEvents
    .slice()
    .reverse()
    .map((event, index, array) => ({
      id: event.id,
      timestamp: event.timestamp,
      title: formatLifecycleEventTitle(event),
      summary: formatLifecycleEventSummary(event),
      detail: event.detail,
      actorLabel: event.actorLabel,
      actorAgentId: event.actorAgentId,
      tone: event.tone,
      kind: event.source === "local" ? ("action" as const) : ("feedback" as const),
      isCurrent: index === array.length - 1,
    }));

  if (progressEntries.length > 0) {
    return progressEntries.slice(-5);
  }

  if (!currentTimelineItem) {
    return [];
  }

  return [
    {
      id: `${currentTimelineItem.id}:state`,
      timestamp: previewTimestamp,
      title: currentTimelineItem.title,
      summary: currentTimelineItem.feedback ?? "当前步骤还没完整闭环，需要继续追这一步。",
      actorLabel: currentTimelineItem.assigneeLabel,
      actorAgentId: currentTimelineItem.assigneeAgentId ?? undefined,
      tone: currentTimelineItem.tone,
      kind: "state",
      isCurrent: true,
    },
  ];
}
