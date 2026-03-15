import type { DatabaseSync } from "node:sqlite";
import type { ProjectArchiveSummary, ProjectPriority, ProjectRecord, ProjectStatus } from "../../../../src/domain/project/types";
import { isPresent, parseJson } from "../persistence/authority-persistence-shared";

type AuthorityProjectStoreDependencies = {
  getDb: () => DatabaseSync;
  now?: () => number;
};

function normalizeProjectStatus(value: unknown): ProjectStatus {
  switch (value) {
    case "draft":
    case "active":
    case "waiting_review":
    case "completed":
    case "archived":
    case "canceled":
      return value;
    default:
      return "active";
  }
}

function normalizeProjectPriority(value: unknown): ProjectPriority {
  switch (value) {
    case "low":
    case "medium":
    case "high":
    case "urgent":
      return value;
    default:
      return "medium";
  }
}

function normalizeArchiveSummary(value: unknown, now: number): ProjectArchiveSummary | null {
  if (!value || typeof value !== "object") {
    return null;
  }
  const record = value as Partial<ProjectArchiveSummary>;
  const goalSummary = typeof record.goalSummary === "string" ? record.goalSummary : "";
  const deliverySummary = typeof record.deliverySummary === "string" ? record.deliverySummary : "";
  if (!goalSummary.trim() && !deliverySummary.trim()) {
    return null;
  }
  const evidenceAnchors = Array.isArray(record.evidenceAnchors)
    ? record.evidenceAnchors.filter((item): item is string => typeof item === "string" && item.trim().length > 0)
    : [];
  const reusableLinks = Array.isArray(record.reusableLinks)
    ? record.reusableLinks.filter((item): item is string => typeof item === "string" && item.trim().length > 0)
    : [];
  return {
    goalSummary,
    deliverySummary,
    decisionSummary: typeof record.decisionSummary === "string" ? record.decisionSummary : null,
    blockerSummary: typeof record.blockerSummary === "string" ? record.blockerSummary : null,
    evidenceAnchors,
    reusableLinks,
    createdAt: typeof record.createdAt === "number" ? record.createdAt : now,
    updatedAt: typeof record.updatedAt === "number" ? record.updatedAt : now,
  };
}

function normalizeProjectRecord(value: unknown, now: number): ProjectRecord | null {
  if (!value || typeof value !== "object") {
    return null;
  }
  const record = value as Partial<ProjectRecord>;
  if (typeof record.id !== "string" || typeof record.companyId !== "string") {
    return null;
  }
  const createdAt = typeof record.createdAt === "number" ? record.createdAt : now;
  const updatedAt = typeof record.updatedAt === "number" ? record.updatedAt : now;
  return {
    id: record.id,
    companyId: record.companyId,
    title: typeof record.title === "string" ? record.title : "未命名项目",
    goal: typeof record.goal === "string" ? record.goal : "",
    summary: typeof record.summary === "string" ? record.summary : "",
    status: normalizeProjectStatus(record.status),
    priority: normalizeProjectPriority(record.priority),
    ownerActorId: typeof record.ownerActorId === "string" ? record.ownerActorId : null,
    ownerLabel: typeof record.ownerLabel === "string" ? record.ownerLabel : "待分配",
    participantActorIds: Array.isArray(record.participantActorIds)
      ? record.participantActorIds.filter((item): item is string => typeof item === "string" && item.trim().length > 0)
      : [],
    currentRunId: typeof record.currentRunId === "string" ? record.currentRunId : null,
    latestAcceptedRunId: typeof record.latestAcceptedRunId === "string" ? record.latestAcceptedRunId : null,
    requirementAggregateId: typeof record.requirementAggregateId === "string" ? record.requirementAggregateId : null,
    workItemId: typeof record.workItemId === "string" ? record.workItemId : null,
    roomId: typeof record.roomId === "string" ? record.roomId : null,
    tagIds: Array.isArray(record.tagIds)
      ? record.tagIds.filter((item): item is string => typeof item === "string" && item.trim().length > 0)
      : [],
    createdAt,
    updatedAt,
    closedAt: typeof record.closedAt === "number" ? record.closedAt : null,
    archivedAt: typeof record.archivedAt === "number" ? record.archivedAt : null,
    archiveSummary: normalizeArchiveSummary(record.archiveSummary, now),
  };
}

export class AuthorityProjectStore {
  constructor(private readonly deps: AuthorityProjectStoreDependencies) {}

  listProjects(companyId: string): ProjectRecord[] {
    const now = this.deps.now?.() ?? Date.now();
    const db = this.deps.getDb();
    const rows = db
      .prepare("SELECT payload_json FROM projects WHERE company_id = ? ORDER BY updated_at DESC")
      .all(companyId) as Array<{ payload_json: string }>;
    return rows
      .map((row) => normalizeProjectRecord(parseJson<ProjectRecord | null>(row.payload_json, null), now))
      .filter(isPresent)
      .sort((left, right) => right.updatedAt - left.updatedAt);
  }

  loadProject(companyId: string, projectId: string): ProjectRecord | null {
    const now = this.deps.now?.() ?? Date.now();
    const db = this.deps.getDb();
    const row = db
      .prepare("SELECT payload_json FROM projects WHERE company_id = ? AND id = ?")
      .get(companyId, projectId) as { payload_json?: string } | undefined;
    return normalizeProjectRecord(parseJson<ProjectRecord | null>(row?.payload_json, null), now);
  }

  createProject(input: Omit<ProjectRecord, "createdAt" | "updatedAt">): ProjectRecord {
    const now = this.deps.now?.() ?? Date.now();
    const project: ProjectRecord = {
      ...input,
      createdAt: now,
      updatedAt: now,
    };
    this.upsertProject(project);
    return project;
  }

  upsertProject(project: ProjectRecord): ProjectRecord {
    const now = this.deps.now?.() ?? Date.now();
    const normalized = normalizeProjectRecord(project, now);
    if (!normalized) {
      throw new Error("Invalid project payload.");
    }
    const db = this.deps.getDb();
    db.prepare(`
      INSERT INTO projects (id, company_id, updated_at, payload_json)
      VALUES (?, ?, ?, ?)
      ON CONFLICT(id) DO UPDATE SET
        company_id = excluded.company_id,
        updated_at = excluded.updated_at,
        payload_json = excluded.payload_json
    `).run(normalized.id, normalized.companyId, normalized.updatedAt, JSON.stringify(normalized));
    return normalized;
  }

  patchProject(companyId: string, projectId: string, patch: Partial<ProjectRecord>): ProjectRecord {
    const now = this.deps.now?.() ?? Date.now();
    const current = this.loadProject(companyId, projectId);
    if (!current) {
      throw new Error(`Unknown project: ${projectId}`);
    }
    const next: ProjectRecord = normalizeProjectRecord(
      {
        ...current,
        ...patch,
        id: current.id,
        companyId: current.companyId,
        createdAt: current.createdAt,
        updatedAt: Math.max(current.updatedAt, now),
      },
      now,
    ) ?? current;
    return this.upsertProject(next);
  }
}

