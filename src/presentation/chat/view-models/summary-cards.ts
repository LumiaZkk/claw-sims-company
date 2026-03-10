import type { RequirementTeamMember, RequirementTeamView } from "../../../application/assignment/requirement-team";
import {
  formatLifecycleEventSummary,
  formatLifecycleEventTitle,
  type FocusProgressEvent,
  type FocusProgressTone,
} from "../../../application/governance/chat-progress";
import {
  formatWatchElapsed,
  type FocusActionButton,
  type FocusActionWatch,
} from "./focus";

export type RequirementProgressGroups = {
  working: Array<{ nickname: string; stage: string }>;
  waiting: Array<{ nickname: string; stage: string }>;
  completed: Array<{ nickname: string; stage: string }>;
};

export type LatestProgressDisplay = {
  id: string;
  timestamp: number;
  actorLabel: string;
  title: string;
  summary: string;
  detail?: string;
  tone: FocusProgressTone;
};

export type ActionWatchCard = {
  id: string;
  title: string;
  description: string;
  elapsedLabel: string;
};

export type TeamMemberCard = RequirementTeamMember & {
  adjustAction: FocusActionButton;
  isAdjustLoading: boolean;
};

function summarizeProgressGroup(
  participants: Array<{ nickname: string; stage: string }>,
  emptyText: string,
): string {
  if (participants.length === 0) {
    return emptyText;
  }

  return participants
    .slice(0, 3)
    .map((participant) => `${participant.nickname} · ${participant.stage}`)
    .join("；");
}

export function buildProgressGroupSummary(
  groups: RequirementProgressGroups | null | undefined,
): {
  working: string;
  waiting: string;
  completed: string;
} | null {
  if (!groups) {
    return null;
  }
  return {
    working: summarizeProgressGroup(groups.working, "当前没有人在执行。"),
    waiting: summarizeProgressGroup(groups.waiting, "当前没有等待接棒的节点。"),
    completed: summarizeProgressGroup(groups.completed, "当前还没有完成节点。"),
  };
}

export function buildLatestProgressDisplay(
  latestProgressEvent: FocusProgressEvent | null | undefined,
): LatestProgressDisplay | null {
  if (!latestProgressEvent) {
    return null;
  }
  return {
    id: latestProgressEvent.id,
    timestamp: latestProgressEvent.timestamp,
    actorLabel: latestProgressEvent.actorLabel,
    title: formatLifecycleEventTitle(latestProgressEvent),
    summary: formatLifecycleEventSummary(latestProgressEvent),
    detail: latestProgressEvent.detail,
    tone: latestProgressEvent.tone,
  };
}

export function buildActionWatchCards(actionWatches: FocusActionWatch[]): ActionWatchCard[] {
  return actionWatches.slice(0, 3).map((watch) => ({
    id: watch.id,
    title: watch.kind === "handoff" ? `等待 ${watch.targetLabel} 接棒` : `等待 ${watch.targetLabel} 回执`,
    description:
      watch.kind === "handoff"
        ? "上一棒已经发出，当前在等下一棒真正接住任务并回传。"
        : "负责人动作已经发出，当前在等新的明确反馈。",
    elapsedLabel: `已等待 ${formatWatchElapsed(watch.startedAt)}`,
  }));
}

export function buildTeamMemberCards(
  requirementTeam: RequirementTeamView | null | undefined,
  runningFocusActionId: string | null,
  buildTeamAdjustmentAction: (member: RequirementTeamMember) => FocusActionButton,
): TeamMemberCard[] {
  if (!requirementTeam) {
    return [];
  }

  return requirementTeam.members.map((member) => {
    const adjustAction = buildTeamAdjustmentAction(member);
    return {
      ...member,
      adjustAction,
      isAdjustLoading: runningFocusActionId === adjustAction.id,
    };
  });
}
