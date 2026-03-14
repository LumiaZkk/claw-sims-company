import type { RequirementAggregateRecord } from "../../domain/mission/types";
import type { RequirementCloseoutReport } from "./requirement-closeout-report";

export type RequirementAcceptanceActionMode =
  | "request"
  | "accept"
  | "revise"
  | "reopen"
  | "change";

export type RequirementAcceptanceActionGate = {
  mode: RequirementAcceptanceActionMode;
  enabled: boolean;
  tone: "ready" | "warning" | "blocked";
  title: string;
  summary: string;
  reasons: string[];
};

export type RequirementAcceptanceGate = Record<
  RequirementAcceptanceActionMode,
  RequirementAcceptanceActionGate
>;

function buildBlockedGate(
  mode: RequirementAcceptanceActionMode,
  title: string,
  summary: string,
  reasons: string[] = [],
): RequirementAcceptanceActionGate {
  return {
    mode,
    enabled: false,
    tone: "blocked",
    title,
    summary,
    reasons,
  };
}

function buildEnabledGate(input: {
  mode: RequirementAcceptanceActionMode;
  title: string;
  summary: string;
  reasons?: string[];
  tone?: RequirementAcceptanceActionGate["tone"];
}): RequirementAcceptanceActionGate {
  return {
    mode: input.mode,
    enabled: true,
    tone: input.tone ?? "ready",
    title: input.title,
    summary: input.summary,
    reasons: input.reasons ?? [],
  };
}

export function buildRequirementAcceptanceGate(input: {
  aggregate: RequirementAggregateRecord | null;
  closeoutReport: RequirementCloseoutReport;
}): RequirementAcceptanceGate {
  const { aggregate, closeoutReport } = input;
  const blockingReasons = closeoutReport.blockingReasons;
  const advisoryReasons = closeoutReport.advisoryReasons;

  const request = (() => {
    if (!aggregate) {
      return buildBlockedGate(
        "request",
        "还不能发起验收",
        "当前还没有稳定的主线需求，先让 CEO 或负责人完成主线收敛。",
      );
    }
    if (aggregate.acceptanceStatus !== "not_requested") {
      return buildBlockedGate(
        "request",
        "当前不需要再次发起验收",
        "这条主线已经在验收流里，先处理当前验收结论再继续。",
      );
    }
    if (aggregate.status !== "waiting_review" && aggregate.status !== "completed") {
      return buildBlockedGate(
        "request",
        "执行态还没进入待验收",
        "先让当前执行进入“待你验收”或“已完成”，再正式发起验收。",
      );
    }
    if (blockingReasons.length > 0) {
      return buildBlockedGate(
        "request",
        "Closeout 仍有阻塞项",
        "补齐交付物、来源链路或 Workspace closeout 阻塞后，才能正式发起验收。",
        blockingReasons,
      );
    }
    if (advisoryReasons.length > 0) {
      return buildEnabledGate({
        mode: "request",
        tone: "warning",
        title: "可以发起验收，但还有提醒项",
        summary: "系统允许进入待验收，但建议先确认这些提醒项，避免后面再次打回。",
        reasons: advisoryReasons,
      });
    }
    return buildEnabledGate({
      mode: "request",
      title: "可以发起验收",
      summary: "交付物、来源链路和 closeout 基线已满足正式进入待验收的最低条件。",
    });
  })();

  const accept = (() => {
    if (!aggregate) {
      return buildBlockedGate(
        "accept",
        "还不能直接通过",
        "当前没有可验收的主线，先完成主线收敛和交付沉淀。",
      );
    }
    if (aggregate.acceptanceStatus !== "pending") {
      return buildBlockedGate(
        "accept",
        "还没进入正式待验收",
        "请先发起验收，再决定是否正式通过。",
      );
    }
    if (blockingReasons.length > 0) {
      return buildBlockedGate(
        "accept",
        "当前还不能直接通过",
        "Closeout 报告仍有阻塞项，不能直接通过当前主线。",
        blockingReasons,
      );
    }
    if (advisoryReasons.length > 0) {
      return buildEnabledGate({
        mode: "accept",
        tone: "warning",
        title: "可以通过，但建议先确认提醒项",
        summary: "当前没有硬阻塞，但仍建议在通过前确认提醒项，或明确记录豁免理由。",
        reasons: advisoryReasons,
      });
    }
    return buildEnabledGate({
      mode: "accept",
      title: "可以正式通过",
      summary: "当前交付已经具备正式闭环的关键证据，可以进入已完成状态。",
    });
  })();

  const revise = (() => {
    if (!aggregate) {
      return buildBlockedGate(
        "revise",
        "当前不能退回修改",
        "还没有主线需求可回退。",
      );
    }
    if (aggregate.acceptanceStatus !== "pending" && aggregate.acceptanceStatus !== "accepted") {
      return buildBlockedGate(
        "revise",
        "当前不在可退回修改的阶段",
        "只有待验收或已通过的主线，才需要回到继续修改。",
      );
    }
    return buildEnabledGate({
      mode: "revise",
      tone: aggregate.acceptanceStatus === "accepted" ? "warning" : "ready",
      title: "可以继续修改",
      summary:
        aggregate.acceptanceStatus === "accepted"
          ? "这会把已通过的主线重新拉回执行态，建议同步说明原因。"
          : "这会把主线从待验收退回到执行态。",
    });
  })();

  const reopen = (() => {
    if (!aggregate) {
      return buildBlockedGate(
        "reopen",
        "当前不能驳回重开",
        "还没有主线需求可重开。",
      );
    }
    if (aggregate.acceptanceStatus !== "pending" && aggregate.status !== "completed") {
      return buildBlockedGate(
        "reopen",
        "当前不在可重开的阶段",
        "只有待验收或已完成的主线，才需要驳回重开。",
      );
    }
    return buildEnabledGate({
      mode: "reopen",
      tone: "warning",
      title: "可以驳回重开",
      summary: "这会明确否决当前结果，并把主线退回执行态重新推进。",
    });
  })();

  const change = (() => {
    if (!aggregate) {
      return buildBlockedGate(
        "change",
        "当前不能发起需求变更",
        "还没有正式主线时，不需要创建需求变更决策。",
      );
    }
    if (aggregate.status === "archived") {
      return buildBlockedGate(
        "change",
        "归档主线不能再发起变更",
        "请先恢复主线，或重新建立新的需求主线。",
      );
    }
    return buildEnabledGate({
      mode: "change",
      tone:
        aggregate.acceptanceStatus === "pending" || aggregate.status === "completed"
          ? "warning"
          : "ready",
      title: "可以发起需求变更",
      summary:
        aggregate.acceptanceStatus === "pending" || aggregate.status === "completed"
          ? "发起变更会打断当前验收结论，建议先确认范围和影响。"
          : "系统会先生成变更决策，再决定是否沿用当前主线继续推进。",
    });
  })();

  return {
    request,
    accept,
    revise,
    reopen,
    change,
  };
}
