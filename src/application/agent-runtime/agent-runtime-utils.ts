import type {
  ProviderProcessState,
  ProviderRunState,
  ProviderRuntimeStreamKind,
  ProviderSessionState,
} from "../../infrastructure/gateway/runtime/types";
import type {
  DispatchRecord,
} from "../../domain/delegation/types";
import { normalizeDispatchCheckout } from "../../domain/delegation/dispatch-checkout";
import type { AgentRunState, AgentSessionExecutionContext, AgentSessionRecord } from "./agent-runtime-types";

export function normalizeTimestamp(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

export function normalizeNonEmptyString(value: unknown): string | null {
  return typeof value === "string" && value.trim().length > 0 ? value.trim() : null;
}

export function normalizeExecutionCopy(value: string | null | undefined, fallback: string): string {
  const normalized = normalizeNonEmptyString(value);
  return normalized ?? fallback;
}

export function buildExecutionContextFromDispatch(dispatch: DispatchRecord): AgentSessionExecutionContext | null {
  const checkout = normalizeDispatchCheckout(dispatch);
  if (checkout.checkoutState === "open" || !checkout.checkoutSessionKey) {
    return null;
  }
  const checkoutState: AgentSessionExecutionContext["checkoutState"] = checkout.checkoutState === "claimed"
    ? "claimed"
    : "released";

  return {
    dispatchId: dispatch.id,
    workItemId: normalizeNonEmptyString(dispatch.workItemId) ?? null,
    assignment: normalizeExecutionCopy(dispatch.title, "未命名派单"),
    objective: normalizeExecutionCopy(dispatch.summary, dispatch.title || "等待执行结果回流。"),
    checkoutState,
    actorId: checkout.checkoutActorId ?? null,
    sessionKey: checkout.checkoutSessionKey,
    updatedAt: dispatch.updatedAt,
    checkedOutAt: checkout.checkedOutAt ?? null,
    releasedAt: checkout.releasedAt ?? null,
    releaseReason: checkout.releaseReason ?? null,
    source: "dispatch_checkout",
  };
}

export function isSameExecutionContext(
  left: AgentSessionExecutionContext | null | undefined,
  right: AgentSessionExecutionContext | null | undefined,
): boolean {
  if (!left && !right) {
    return true;
  }
  if (!left || !right) {
    return false;
  }
  return (
    left.dispatchId === right.dispatchId &&
    left.workItemId === right.workItemId &&
    left.assignment === right.assignment &&
    left.objective === right.objective &&
    left.checkoutState === right.checkoutState &&
    left.actorId === right.actorId &&
    left.sessionKey === right.sessionKey &&
    left.updatedAt === right.updatedAt &&
    left.checkedOutAt === right.checkedOutAt &&
    left.releasedAt === right.releasedAt &&
    left.releaseReason === right.releaseReason &&
    left.source === right.source
  );
}

export function pickLatestRecoveredExecutionContext(
  sessions: AgentSessionRecord[],
  predicate?: (context: AgentSessionExecutionContext) => boolean,
): AgentSessionExecutionContext | null {
  return (
    sessions
      .map((session) => session.executionContext ?? null)
      .filter((context): context is AgentSessionExecutionContext => Boolean(context))
      .filter((context) => (predicate ? predicate(context) : true))
      .sort((left, right) => right.updatedAt - left.updatedAt)[0] ?? null
  );
}

export function summarizeRecoveredExecutionContext(context: AgentSessionExecutionContext): string {
  if (context.checkoutState === "claimed") {
    return `${context.sessionKey} 已恢复执行上下文：${context.assignment}`;
  }
  if (context.releaseReason === "blocked") {
    return `${context.sessionKey} 最近一次以阻塞状态交回：${context.assignment}`;
  }
  if (context.releaseReason === "answered") {
    return `${context.sessionKey} 最近一次已交回结果：${context.assignment}`;
  }
  return `${context.sessionKey} 保留了最近一次执行记录：${context.assignment}`;
}

export function normalizeProviderSessionState(value: unknown): ProviderSessionState {
  switch (value) {
    case "idle":
    case "running":
    case "streaming":
    case "error":
    case "offline":
      return value;
    default:
      return "unknown";
  }
}

export function resolveProviderSessionStateCandidate(...values: unknown[]): ProviderSessionState {
  for (const value of values) {
    const normalized = normalizeProviderSessionState(value);
    if (normalized !== "unknown") {
      return normalized;
    }
  }
  return "unknown";
}

export function normalizeProviderRunState(value: unknown): ProviderRunState | null {
  switch (value) {
    case "accepted":
    case "running":
    case "streaming":
    case "completed":
    case "aborted":
    case "error":
      return value;
    case "started":
      return "running";
    case "done":
    case "completed_ok":
    case "end":
      return "completed";
    case "failed":
      return "error";
    case "cancelled":
      return "aborted";
    default:
      return null;
  }
}

export function normalizeProviderProcessState(value: unknown): ProviderProcessState {
  switch (value) {
    case "queued":
    case "pending":
      return "queued";
    case "running":
    case "in_progress":
    case "active":
      return "running";
    case "completed":
    case "done":
    case "finished":
    case "success":
      return "completed";
    case "aborted":
    case "cancelled":
    case "killed":
      return "aborted";
    case "error":
    case "failed":
      return "error";
    default:
      return "unknown";
  }
}

export function normalizeStreamKind(value: unknown): ProviderRuntimeStreamKind | null {
  switch (value) {
    case "lifecycle":
    case "assistant":
    case "tool":
      return value;
    case "job":
      return "lifecycle";
    default:
      return null;
  }
}

export function dedupeStreamKinds(kinds: ProviderRuntimeStreamKind[]): ProviderRuntimeStreamKind[] {
  return [...new Set(kinds)];
}

export function buildTerminalRunSummary(
  state: Extract<AgentRunState, "completed" | "aborted" | "error">,
  sessionKey: string,
  errorMessage?: string | null,
): string {
  if (state === "completed") {
    return `${sessionKey} 最近一次执行已完成。`;
  }
  if (state === "aborted") {
    return errorMessage?.trim() || `${sessionKey} 最近一次执行被中止。`;
  }
  return errorMessage?.trim() || `${sessionKey} 最近一次执行失败。`;
}

export function ageMs(updatedAt: number | null | undefined, now: number): number {
  return Math.max(0, now - (updatedAt ?? now));
}

export function latestTimestamp(values: Array<number | null | undefined>): number | null {
  const max = Math.max(...values.map((value) => value ?? 0), 0);
  return max > 0 ? max : null;
}
