import type { ProjectPriority, ProjectRecord, ProjectStatus } from "../../domain/project/types";

export type ProjectTab = "active" | "waiting_review" | "completed" | "archived" | "canceled" | "all";
export type ProjectTimeRange = "all" | "7" | "30" | "90";

export function formatTimestamp(ts: number | null | undefined): string {
  if (!ts || !Number.isFinite(ts)) {
    return "—";
  }
  try {
    return new Date(ts).toLocaleString();
  } catch {
    return String(ts);
  }
}

export function resolveProjectStatusLabel(status: ProjectStatus): string {
  switch (status) {
    case "draft":
      return "草稿";
    case "active":
      return "进行中";
    case "waiting_review":
      return "待验收";
    case "completed":
      return "已完成";
    case "archived":
      return "已归档";
    case "canceled":
      return "已取消";
    default:
      return status;
  }
}

export function resolveProjectPriorityLabel(priority: ProjectPriority): string {
  switch (priority) {
    case "low":
      return "低";
    case "medium":
      return "中";
    case "high":
      return "高";
    case "urgent":
      return "紧急";
    default:
      return priority;
  }
}

export function resolveProjectStatusBadgeVariant(
  status: ProjectStatus,
): "default" | "secondary" | "destructive" | "outline" {
  switch (status) {
    case "active":
      return "default";
    case "waiting_review":
      return "secondary";
    case "completed":
      return "outline";
    case "archived":
      return "outline";
    case "canceled":
      return "destructive";
    case "draft":
      return "secondary";
    default:
      return "secondary";
  }
}

export function filterProjects(projects: ProjectRecord[], tab: ProjectTab): ProjectRecord[] {
  if (tab === "all") {
    return projects;
  }
  if (tab === "active") {
    return projects.filter((project) => project.status === "active" || project.status === "draft");
  }
  return projects.filter((project) => project.status === tab);
}

export function parseMultilineList(value: string): string[] {
  return value
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => line.length > 0);
}

export function normalizeFilterText(value: string): string {
  return value.trim().toLowerCase();
}

export function buildProjectSearchCorpus(project: ProjectRecord): string {
  const archive = project.archiveSummary;
  return [
    project.title,
    project.goal,
    project.summary,
    project.ownerLabel,
    project.ownerActorId ?? "",
    project.requirementAggregateId ?? "",
    project.workItemId ?? "",
    project.roomId ?? "",
    archive?.goalSummary ?? "",
    archive?.deliverySummary ?? "",
    archive?.decisionSummary ?? "",
    archive?.blockerSummary ?? "",
    ...(archive?.evidenceAnchors ?? []),
    ...(archive?.reusableLinks ?? []),
  ]
    .filter((value) => value && value.trim().length > 0)
    .join("\n")
    .toLowerCase();
}

export function resolveProjectFilterTimestamp(project: ProjectRecord): number {
  return project.archivedAt ?? project.updatedAt ?? project.createdAt;
}

export function resolveRequirementLifecycleLabel(status?: string | null): string {
  switch (status) {
    case "draft":
      return "草稿";
    case "active":
      return "进行中";
    case "waiting_peer":
      return "等待协作";
    case "waiting_owner":
      return "等待负责人";
    case "waiting_review":
      return "待验收";
    case "blocked":
      return "阻塞";
    case "completed":
      return "已完成";
    case "archived":
      return "已归档";
    default:
      return status ?? "—";
  }
}

export function resolveAcceptanceStatusLabel(status?: string | null): string {
  switch (status) {
    case "not_requested":
      return "未发起";
    case "pending":
      return "待验收";
    case "accepted":
      return "已通过";
    case "rejected":
      return "已驳回";
    default:
      return status ?? "—";
  }
}

export function resolveWorkItemStatusLabel(status?: string | null): string {
  switch (status) {
    case "draft":
      return "草稿";
    case "active":
      return "进行中";
    case "waiting_review":
      return "待验收";
    case "waiting_owner":
      return "等待负责人";
    case "completed":
      return "已完成";
    case "blocked":
      return "阻塞";
    case "archived":
      return "已归档";
    default:
      return status ?? "—";
  }
}

export function resolveTaskStepProgress(task: { steps: Array<{ status: string }> }): string {
  const total = task.steps.length;
  if (total === 0) {
    return "无步骤";
  }
  const done = task.steps.filter((step) => step.status === "done").length;
  return `${done}/${total}`;
}
