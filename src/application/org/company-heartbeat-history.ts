import type { CompanyEvent } from "../../domain/delegation/events";

export type CompanyHeartbeatAuditEntry = {
  id: string;
  createdAt: number;
  trigger: "interval" | "event";
  ran: boolean;
  skipReason: string | null;
  reasons: string[];
  reasonLabels: string[];
  actions: string[];
  actionCount: number;
  summary: string;
  detail: string;
};

function describeSkipReason(skipReason: string | null) {
  if (skipReason === "heartbeat_disabled") {
    return "当前公司已关闭业务 heartbeat，本轮没有自动巡检。";
  }
  if (skipReason === "heartbeat_paused") {
    return "当前公司已暂停业务 heartbeat，本轮没有自动巡检。";
  }
  if (skipReason === "heartbeat_not_due") {
    return "未到下一轮巡检时间，系统按策略跳过本轮检查。";
  }
  return "本轮巡检被跳过，请结合当前 heartbeat 策略继续排查。";
}

function describeTrigger(trigger: "interval" | "event") {
  return trigger === "interval" ? "周期巡检" : "事件续推";
}

function describeAuditReason(reason: string) {
  switch (reason) {
    case "interval":
      return "周期到点";
    case "room.append":
      return "需求房新增回报";
    case "dispatch.create":
      return "派单已更新";
    case "takeover.transition":
      return "接管状态已变化";
    case "requirement.transition":
      return "主线状态已变化";
    case "requirement.promote":
      return "主线已升级";
    case "decision.resolve":
      return "决策票已收口";
    case "approval.resolve":
      return "审批已处理";
    case "operator.restore.apply":
      return "恢复后续推";
    default:
      return reason;
  }
}

export function buildCompanyHeartbeatAuditEntries(input: {
  events: CompanyEvent[];
  limit?: number;
}): CompanyHeartbeatAuditEntry[] {
  const limit = input.limit ?? 5;
  return input.events
    .filter((event) => event.kind === "heartbeat_cycle_checked")
    .sort((left, right) => right.createdAt - left.createdAt)
    .slice(0, limit)
    .map((event) => {
      const trigger = event.payload.trigger === "event" ? "event" : "interval";
      const ran = event.payload.ran === true;
      const skipReason =
        typeof event.payload.skipReason === "string" && event.payload.skipReason.trim().length > 0
          ? event.payload.skipReason.trim()
          : null;
      const reasons = Array.isArray(event.payload.reasons)
        ? event.payload.reasons.filter((item): item is string => typeof item === "string" && item.trim().length > 0)
        : [];
      const reasonLabels = reasons.map(describeAuditReason);
      const actions = Array.isArray(event.payload.actions)
        ? event.payload.actions.filter((item): item is string => typeof item === "string" && item.trim().length > 0)
        : [];
      const actionCount =
        typeof event.payload.actionCount === "number" && Number.isFinite(event.payload.actionCount)
          ? Math.max(0, Math.floor(event.payload.actionCount))
          : actions.length;
      const summary = ran
        ? trigger === "event"
          ? actionCount > 0
            ? `事件续推完成，并执行了 ${actionCount} 条自治动作。`
            : "事件续推已检查，没有新增自治动作。"
          : actionCount > 0
            ? `本轮巡检完成，并执行了 ${actionCount} 条自治动作。`
            : "本轮巡检完成，没有新增自治动作。"
        : describeSkipReason(skipReason);
      const reasonDetail = reasonLabels.length > 0 ? ` · 原因：${reasonLabels.join(" / ")}` : "";
      const detail = ran
        ? `触发方式：${describeTrigger(trigger)}${reasonDetail}`
        : `触发方式：${describeTrigger(trigger)}${reasonDetail} · 跳过原因：${skipReason ?? "unknown"}`;

      return {
        id: event.eventId,
        createdAt: event.createdAt,
        trigger,
        ran,
        skipReason,
        reasons,
        reasonLabels,
        actions,
        actionCount,
        summary,
        detail,
      };
    });
}
