import { useMemo } from "react";
import {
  useRuntimeInspectorViewModel,
  type RuntimeInspectorAgentSurface,
  type RuntimeInspectorStatusSource,
  type RuntimeInspectorSurface,
} from "../runtime-inspector";

export type CanonicalRuntimeSummarySurface = {
  statusSource: RuntimeInspectorStatusSource;
  statusCoverageLabel: string;
  statusCoverageDetail: string;
  focusAgent: RuntimeInspectorAgentSurface | null;
  nextAgent: RuntimeInspectorAgentSurface | null;
  watchlist: RuntimeInspectorAgentSurface[];
  triageQueue: RuntimeInspectorAgentSurface[];
  executingCount: number;
  waitingCount: number;
  interventionCount: number;
  noSignalCount: number;
};

export function buildCanonicalRuntimeSummarySurface(input: {
  surface: RuntimeInspectorSurface | null;
  statusSource: RuntimeInspectorStatusSource;
}): CanonicalRuntimeSummarySurface | null {
  if (!input.surface) {
    return null;
  }
  const { surface } = input;
  return {
    statusSource: input.statusSource,
    statusCoverageLabel: surface.statusCoverage.label,
    statusCoverageDetail: surface.statusCoverage.detail,
    focusAgent: surface.focusAgent,
    nextAgent: surface.triageQueue[1] ?? surface.watchlist[0] ?? null,
    watchlist: surface.watchlist,
    triageQueue: surface.triageQueue,
    executingCount: surface.agents.filter(
      (agent) => agent.coordinationState === "executing" || agent.runtimeState === "busy",
    ).length,
    waitingCount: surface.agents.filter(
      (agent) =>
        agent.coordinationState === "waiting_peer" ||
        agent.coordinationState === "waiting_input" ||
        agent.coordinationState === "pending_ack",
    ).length,
    interventionCount: surface.agents.filter(
      (agent) =>
        agent.coordinationState === "explicit_blocked" || agent.interventionState !== "healthy",
    ).length,
    noSignalCount: surface.agents.filter((agent) => agent.runtimeState === "no_signal").length,
  };
}

export function useCanonicalRuntimeSummary() {
  const runtimeViewModel = useRuntimeInspectorViewModel();
  const summary = useMemo(
    () =>
      buildCanonicalRuntimeSummarySurface({
        surface: runtimeViewModel.surface,
        statusSource: runtimeViewModel.statusSource,
      }),
    [runtimeViewModel.surface, runtimeViewModel.statusSource],
  );
  return {
    ...runtimeViewModel,
    summary,
  };
}
