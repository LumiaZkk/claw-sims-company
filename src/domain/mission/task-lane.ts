export type TaskLane = "critical" | "needs_input" | "handoff" | "active" | "queued" | "done";

export function getTaskSortWeight(state?: string): number {
  switch (state) {
    case "manual_takeover_required":
      return 0;
    case "blocked_timeout":
    case "blocked_tool_failure":
      return 1;
    case "waiting_input":
      return 2;
    case "waiting_peer":
      return 3;
    case "running":
      return 4;
    case "idle":
      return 5;
    case "unknown":
      return 6;
    case "completed":
      return 7;
    default:
      return 6;
  }
}

export function getTaskLane(state?: string): TaskLane {
  switch (state) {
    case "manual_takeover_required":
    case "blocked_timeout":
    case "blocked_tool_failure":
      return "critical";
    case "waiting_input":
      return "needs_input";
    case "waiting_peer":
      return "handoff";
    case "running":
      return "active";
    case "completed":
      return "done";
    default:
      return "queued";
  }
}
