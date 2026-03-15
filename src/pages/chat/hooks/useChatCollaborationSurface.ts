import { useMemo } from "react";
import { buildChatCollaborationTimeline } from "../../../application/mission/chat-collaboration-timeline";
import { type FocusProgressEvent } from "../../../application/governance/chat-progress";
import { buildChatFocusActions } from "../view-models/focus-actions";
import { buildCollaborationLifecycle } from "../view-models/collaboration-lifecycle";
import type { CollaborationLifecycleEntry } from "../view-models/focus";
import type { Company } from "../../../domain/org/types";
import type { HandoffRecord, RequestRecord } from "../../../domain/delegation/types";
import type { TrackedTask } from "../../../domain/mission/types";
import type { ExecutionFocusSummary } from "../../../application/governance/focus-summary";
import type { ManualTakeoverPack } from "../../../application/delegation/takeover-pack";

type UseChatCollaborationSurfaceInput = {
  activeCompany: Company | null;
  structuredTaskPreview: TrackedTask | null;
  localProgressEvents: FocusProgressEvent[];
  sessionProgressEvents: FocusProgressEvent[];
  requestPreview: RequestRecord[];
  handoffPreview: HandoffRecord[];
  previewTimestamp: number;
  takeoverPack: ManualTakeoverPack | null;
  nextOpenTaskStepLabel: string | null;
  nextOpenTaskStepAgentId: string | null;
  targetAgentId: string | null;
  focusSummary: ExecutionFocusSummary;
  sessionKey: string | null;
  structuredTaskOwnerAgentId: string | null;
  summaryAlertCount: number;
};

export function useChatCollaborationSurface(input: UseChatCollaborationSurfaceInput) {
  const progressSignalEvents = useMemo(() => {
    const merged = [...input.localProgressEvents, ...input.sessionProgressEvents].sort(
      (left, right) => right.timestamp - left.timestamp,
    );
    const deduped = new Map<string, FocusProgressEvent>();
    for (const event of merged) {
      const key = `${event.title}:${event.summary}:${event.actorLabel}`;
      if (!deduped.has(key)) {
        deduped.set(key, event);
      }
    }
    return [...deduped.values()].slice(0, 5);
  }, [input.localProgressEvents, input.sessionProgressEvents]);

  const recentProgressEvents = useMemo(
    () => progressSignalEvents.filter((event) => event.category === "receipt").slice(0, 5),
    [progressSignalEvents],
  );
  const latestProgressEvent = recentProgressEvents[0] ?? progressSignalEvents[0] ?? null;
  const latestBlockingProgressEvent =
    progressSignalEvents.find((event) => event.tone === "rose" && event.actorAgentId) ?? null;

  const collaborationTimeline = useMemo(
    () =>
      buildChatCollaborationTimeline({
        company: input.activeCompany,
        structuredTaskPreview: input.structuredTaskPreview,
        progressSignalEvents,
        requestPreview: input.requestPreview,
        handoffPreview: input.handoffPreview,
      }),
    [
      input.activeCompany,
      input.handoffPreview,
      progressSignalEvents,
      input.requestPreview,
      input.structuredTaskPreview,
    ],
  );

  const currentTimelineItem =
    collaborationTimeline.find((item) => item.isCurrent) ??
    collaborationTimeline.find((item) => item.statusLabel !== "已完成") ??
    collaborationTimeline[0] ??
    null;

  const focusActions = useMemo(
    () =>
      buildChatFocusActions({
        activeCompany: input.activeCompany,
        latestBlockingProgressEvent,
        hasTakeoverPack: Boolean(input.takeoverPack),
        nextOpenTaskStepLabel: input.nextOpenTaskStepLabel,
        nextOpenTaskStepAgentId: input.nextOpenTaskStepAgentId,
        targetAgentId: input.targetAgentId,
        focusSummary: input.focusSummary,
        requestPreview: input.requestPreview,
        handoffCount: input.handoffPreview.length,
        sessionKey: input.sessionKey,
        structuredTaskOwnerAgentId: input.structuredTaskOwnerAgentId,
        summaryAlertCount: input.summaryAlertCount,
      }),
    [
      input.activeCompany,
      input.focusSummary,
      input.handoffPreview.length,
      latestBlockingProgressEvent,
      input.nextOpenTaskStepAgentId,
      input.nextOpenTaskStepLabel,
      input.requestPreview,
      input.sessionKey,
      input.structuredTaskOwnerAgentId,
      input.summaryAlertCount,
      input.targetAgentId,
      input.takeoverPack,
    ],
  );

  const collaborationLifecycle = useMemo<CollaborationLifecycleEntry[]>(
    () =>
      buildCollaborationLifecycle({
        recentProgressEvents,
        progressSignalEvents,
        currentTimelineItem,
        previewTimestamp: input.previewTimestamp,
      }),
    [currentTimelineItem, input.previewTimestamp, progressSignalEvents, recentProgressEvents],
  );

  const summaryRecoveryAction = focusActions.find((action) => action.kind === "recover") ?? null;

  return {
    progressSignalEvents,
    recentProgressEvents,
    latestProgressEvent,
    latestBlockingProgressEvent,
    collaborationTimeline,
    currentTimelineItem,
    focusActions,
    collaborationLifecycle,
    summaryRecoveryAction,
  };
}
