export type ControlPlaneState = "ready" | "attention" | "degraded" | "blocked";

export function formatControlPlaneStateLabel(state: ControlPlaneState): string {
  if (state === "ready") {
    return "正常";
  }
  if (state === "attention") {
    return "关注";
  }
  if (state === "blocked") {
    return "阻断";
  }
  return "降级";
}
