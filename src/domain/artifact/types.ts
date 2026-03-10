export type ArtifactStatus = "draft" | "ready" | "superseded" | "archived";

export interface ArtifactRecord {
  id: string;
  workItemId?: string | null;
  title: string;
  kind: string;
  status: ArtifactStatus;
  ownerActorId?: string | null;
  providerId?: string | null;
  sourceActorId?: string | null;
  sourceName?: string | null;
  sourcePath?: string;
  sourceUrl?: string;
  summary?: string;
  content?: string | null;
  createdAt: number;
  updatedAt: number;
}

export type SharedKnowledgeKind =
  | "canon"
  | "responsibility"
  | "roadmap"
  | "workflow"
  | "foreshadow";

export type SharedKnowledgeStatus = "active" | "watch" | "draft";

export interface SharedKnowledgeItem {
  id: string;
  kind: SharedKnowledgeKind;
  title: string;
  summary: string;
  details?: string;
  ownerAgentIds?: string[];
  source?: "seeded" | "derived" | "manual" | "imported";
  status: SharedKnowledgeStatus;
  updatedAt: number;
}

export interface RetrospectiveRecord {
  id: string;
  periodLabel: string;
  summary: string;
  wins: string[];
  risks: string[];
  actionItems: string[];
  generatedAt: number;
}
