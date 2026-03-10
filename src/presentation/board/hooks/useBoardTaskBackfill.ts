import { useEffect, useMemo } from "react";
import { selectBoardTasksRequiringBackfill } from "../../../application/mission/board-task-backfill";
import type { TrackedTask } from "../../../domain/mission/types";

export function useBoardTaskBackfill(input: {
  tasks: TrackedTask[];
  upsertTask: (task: TrackedTask) => Promise<unknown>;
}) {
  const { tasks, upsertTask } = input;
  const tasksNeedingBackfill = useMemo(() => selectBoardTasksRequiringBackfill(tasks), [tasks]);

  useEffect(() => {
    if (tasksNeedingBackfill.length === 0) {
      return;
    }
    tasksNeedingBackfill.forEach((task) => {
      upsertTask(task).catch(console.error);
    });
  }, [tasksNeedingBackfill, upsertTask]);
}
