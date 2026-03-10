import type { TaskStep } from "./types";

export type TaskStepSummary = {
  total: number;
  doneCount: number;
  wipCount: number;
  pendingCount: number;
  completedSteps: TaskStep[];
  currentStep: TaskStep | null;
  upcomingSteps: TaskStep[];
};

export function summarizeTaskSteps(steps: TaskStep[]): TaskStepSummary {
  const completedSteps = steps.filter((step) => step.status === "done");
  const currentStep =
    steps.find((step) => step.status === "wip") ??
    steps.find((step) => step.status === "pending") ??
    null;
  const upcomingSteps = steps
    .filter((step) => step.status === "pending" && step !== currentStep)
    .slice(0, 3);

  return {
    total: steps.length,
    doneCount: completedSteps.length,
    wipCount: steps.filter((step) => step.status === "wip").length,
    pendingCount: steps.filter((step) => step.status === "pending").length,
    completedSteps,
    currentStep,
    upcomingSteps,
  };
}
