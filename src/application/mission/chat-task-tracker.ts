import { resolveExecutionState } from "./execution-state";
import { buildTaskObjectSnapshot } from "./task-object";
import { extractTaskTracker, resolveTaskTitle } from "./task-tracker";
import type { Company } from "../../domain/org/types";
import type { TaskStep, TrackedTask } from "../../domain/mission/types";

export function buildTrackedTaskFromChatFinal(input: {
  finalText: string;
  sessionKey: string;
  agentId: string;
  company: Company | null;
  now?: number;
}): TrackedTask | null {
  const trackerItems = extractTaskTracker(input.finalText);
  if (!trackerItems || trackerItems.length === 0) {
    return null;
  }

  const now = input.now ?? Date.now();
  const steps: TaskStep[] = trackerItems.map((item) => {
    const assigneeMatch = item.text.match(/[\u2192→]\s*@(.+?)(?:\s|$)/);
    return {
      text: item.text,
      status: item.status,
      assignee: assigneeMatch?.[1]?.trim(),
    };
  });
  const task: TrackedTask = {
    id: input.sessionKey.replace(/[^a-zA-Z0-9]/g, "_").slice(0, 40),
    title: resolveTaskTitle(input.finalText, input.sessionKey),
    sessionKey: input.sessionKey,
    agentId: input.agentId,
    steps,
    createdAt: now,
    updatedAt: now,
  };

  if (!input.company) {
    return task;
  }

  return buildTaskObjectSnapshot({
    task,
    company: input.company,
    execution: resolveExecutionState({
      evidenceTexts: [input.finalText],
      taskSteps: steps,
      fallbackState: "running",
    }),
    now,
  });
}
