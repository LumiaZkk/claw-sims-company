import type { TrackedTask } from "./types";

export function requiresTaskBackfill(task: TrackedTask): boolean {
  return (
    !task.ownerAgentId ||
    !task.state ||
    !Array.isArray(task.assigneeAgentIds) ||
    typeof task.summary !== "string"
  );
}
