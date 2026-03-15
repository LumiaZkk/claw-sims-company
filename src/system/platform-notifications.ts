import type { ToastTone } from "./toast-store";

export type PlatformNotificationCategory =
  | "system_exception"
  | "approval_pending"
  | "automation_guardrail"
  | "restore_risk"
  | "governance_verify";

export type PlatformNotification = {
  category: PlatformNotificationCategory;
  tone: ToastTone;
  title: string;
  description: string;
  actionLabel: string;
  href: string;
};

function isErrorLikeEvent(eventName: string, payload: Record<string, unknown>) {
  return (
    eventName.endsWith(".error") ||
    eventName.includes("fail") ||
    eventName.includes("denied") ||
    payload.state === "error" ||
    payload.status === "error" ||
    (typeof payload.error === "string" && payload.error.length > 0)
  );
}

function readMessage(payload: Record<string, unknown>, fallback: string) {
  return String(payload.errorMessage || payload.error || payload.message || fallback);
}

export function buildPlatformNotification(input: {
  eventName: string;
  payload: Record<string, unknown>;
}): PlatformNotification | null {
  const eventName = input.eventName.trim();
  const payload = input.payload;

  if (
    eventName.includes("approval") &&
    (payload.status === "pending" || eventName.includes("request"))
  ) {
    return {
      category: "approval_pending",
      tone: "approval",
      title: "有新的审批待处理",
      description: readMessage(payload, "危险动作需要先在 Ops 里明确拍板。"),
      actionLabel: "打开 Ops",
      href: "/ops",
    };
  }

  if (
    eventName.includes("cron") ||
    eventName.includes("automation") ||
    payload.actionType === "automation_enable"
  ) {
    if (isErrorLikeEvent(eventName, payload) || payload.status === "blocked") {
      return {
        category: "automation_guardrail",
        tone: payload.status === "blocked" ? "warning" : "error",
        title: "自动化运行需要关注",
        description: readMessage(payload, "自动化班次失败、被拦截，或预算护栏触发了人工介入。"),
        actionLabel: "打开 Automation",
        href: "/automation",
      };
    }
  }

  if (
    eventName.includes("restore") ||
    eventName.includes("backup") ||
    eventName.includes("doctor") ||
    eventName.includes("preflight")
  ) {
    if (isErrorLikeEvent(eventName, payload) || payload.status === "degraded") {
      return {
        category: "restore_risk",
        tone: isErrorLikeEvent(eventName, payload) ? "error" : "warning",
        title: "Authority 恢复链路需要确认",
        description: readMessage(payload, "先在 Connect / Settings Doctor 确认 doctor、backup、restore plan。"),
        actionLabel: "打开 Connect",
        href: "/connect",
      };
    }
  }

  if (
    eventName.includes("capability") ||
    eventName.includes("verify") ||
    eventName.includes("workspace")
  ) {
    if (payload.status === "ready" || payload.status === "ready_for_verify" || payload.state === "warning") {
      return {
        category: "governance_verify",
        tone: "info",
        title: "有治理项进入待验证",
        description: readMessage(payload, "能力需求或问题已经到待验证阶段，建议尽快回看。"),
        actionLabel: "打开 Workspace",
        href: "/workspace",
      };
    }
  }

  if (isErrorLikeEvent(eventName, payload)) {
    return {
      category: "system_exception",
      tone: "error",
      title: `系统异常 (${eventName})`,
      description: readMessage(payload, "后台任务执行发生异常。"),
      actionLabel: "打开 Ops",
      href: "/ops",
    };
  }

  return null;
}
