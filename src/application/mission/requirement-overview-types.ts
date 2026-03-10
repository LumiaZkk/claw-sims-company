import type { ParticipantProgressTone } from "../../domain/mission/participant-progress";

export type RequirementParticipantTone = ParticipantProgressTone;

export type RequirementParticipantProgress = {
  agentId: string;
  nickname: string;
  role: string;
  stage: string;
  statusLabel: string;
  detail: string;
  updatedAt: number;
  tone: RequirementParticipantTone;
  isBlocking: boolean;
  isCurrent: boolean;
};

export type RequirementExecutionOverview = {
  topicKey: string;
  title: string;
  startedAt: number;
  headline: string;
  summary: string;
  currentOwnerAgentId: string | null;
  currentOwnerLabel: string;
  currentStage: string;
  nextAction: string;
  participants: RequirementParticipantProgress[];
};
