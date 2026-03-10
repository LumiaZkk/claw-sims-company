import { requiresTaskBackfill } from "../../domain/mission/task-backfill";
import type { TrackedTask } from "../../domain/mission/types";

export function selectBoardTasksRequiringBackfill(tasks: TrackedTask[]): TrackedTask[] {
  return tasks.filter(requiresTaskBackfill);
}
