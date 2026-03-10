import type { RequirementParticipantProgress } from "../../../application/mission/requirement-overview";
import type { FocusProgressTone } from "../../../application/governance/chat-progress";
export {
  dedupeFocusActions,
  type FocusActionButton,
  type FocusActionWatch,
} from "../../../application/chat/focus-actions";

export type CollaborationLifecycleEntry = {
  id: string;
  timestamp: number;
  title: string;
  summary: string;
  detail?: string;
  actorLabel: string;
  actorAgentId?: string;
  tone: FocusProgressTone;
  kind: "action" | "feedback" | "state";
  isCurrent?: boolean;
};

export function formatRequirementGroupSummary(
  participants: RequirementParticipantProgress[],
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

export function formatWatchElapsed(startedAt: number): string {
  const seconds = Math.max(0, Math.floor((Date.now() - startedAt) / 1000));
  if (seconds < 60) {
    return `${seconds} 秒`;
  }
  const minutes = Math.floor(seconds / 60);
  const remainSeconds = seconds % 60;
  return remainSeconds > 0 ? `${minutes} 分 ${remainSeconds} 秒` : `${minutes} 分钟`;
}

export function isParticipantStepDone(statusLabel: string): boolean {
  return ["已确认", "已冻结待命", "已回复", "已交接", "已交付待下游"].includes(statusLabel);
}

export function isParticipantStepInProgress(statusLabel: string): boolean {
  return ["已开工", "已开工未交付", "已阻塞", "待回复", "未回复", "待接手", "部分完成"].includes(
    statusLabel,
  );
}

export function participantMatchesRole(
  participant: RequirementParticipantProgress | null | undefined,
  pattern: RegExp,
): boolean {
  if (!participant) {
    return false;
  }
  return pattern.test(`${participant.nickname} ${participant.role} ${participant.stage}`);
}

export function isCoordinatorWaitingStatus(statusLabel: string): boolean {
  return ["已冻结待命", "待接手", "待回复", "已接单", "已接单未推进"].includes(statusLabel);
}
