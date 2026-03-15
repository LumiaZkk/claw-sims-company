export type ProjectStatus =
  | "draft"
  | "active"
  | "waiting_review"
  | "completed"
  | "archived"
  | "canceled";

export type ProjectPriority = "low" | "medium" | "high" | "urgent";

export type ProjectArchiveSummary = {
  goalSummary: string;
  deliverySummary: string;
  decisionSummary?: string | null;
  blockerSummary?: string | null;
  evidenceAnchors: string[];
  reusableLinks: string[];
  createdAt: number;
  updatedAt: number;
};

export type ProjectRecord = {
  id: string;
  companyId: string;
  title: string;
  goal: string;
  summary: string;
  status: ProjectStatus;
  priority: ProjectPriority;
  ownerActorId: string | null;
  ownerLabel: string;
  participantActorIds: string[];
  currentRunId: string | null;
  latestAcceptedRunId: string | null;
  requirementAggregateId: string | null;
  workItemId: string | null;
  roomId: string | null;
  tagIds: string[];
  createdAt: number;
  updatedAt: number;
  closedAt: number | null;
  archivedAt: number | null;
  archiveSummary: ProjectArchiveSummary | null;
};

