import type { RequirementAggregateRecord, WorkItemRecord } from "../../domain";

export type RequirementProductStatusId =
  | "clarifying"
  | "aligned"
  | "executing"
  | "waiting_peer"
  | "blocked"
  | "pending_acceptance"
  | "accepted"
  | "reopened";

export type RequirementProductStatusTone = "slate" | "indigo" | "sky" | "amber" | "rose" | "emerald";

export type RequirementProductStatus = {
  id: RequirementProductStatusId;
  label: string;
  description: string;
  tone: RequirementProductStatusTone;
};

export function resolveRequirementProductStatus(input: {
  aggregate: RequirementAggregateRecord | null;
  workItem?: WorkItemRecord | null;
}): RequirementProductStatus {
  const aggregate = input.aggregate;
  const workItem = input.workItem ?? null;

  if (!aggregate) {
    return {
      id: "clarifying",
      label: "待澄清",
      description: "CEO 正在把这件事收敛成一条可推进的主线。",
      tone: "slate",
    };
  }

  if (aggregate.acceptanceStatus === "accepted") {
    return {
      id: "accepted",
      label: "已完成",
      description: "这条主线已经通过验收，可以作为当前结果归档。",
      tone: "emerald",
    };
  }

  if (aggregate.acceptanceStatus === "rejected") {
    return {
      id: "reopened",
      label: "驳回重开",
      description: "这条主线已根据验收反馈重开，团队需要继续修改。",
      tone: "rose",
    };
  }

  if (
    aggregate.acceptanceStatus === "pending" ||
    aggregate.status === "waiting_review" ||
    aggregate.status === "completed"
  ) {
    return {
      id: "pending_acceptance",
      label: "待你验收",
      description: "执行结果已经收口，下一步不是继续派单，而是由你确认是否达标。",
      tone: "amber",
    };
  }

  if (aggregate.status === "blocked") {
    return {
      id: "blocked",
      label: "有阻塞",
      description: "当前主线已有明确阻塞，建议先去 Ops 排障再继续推进。",
      tone: "rose",
    };
  }

  if (aggregate.status === "waiting_peer" || aggregate.status === "waiting_owner") {
    return {
      id: "waiting_peer",
      label: "待协作回复",
      description: "当前在等成员回复、接手或继续向下游推进。",
      tone: "amber",
    };
  }

  if (aggregate.status === "draft") {
    return {
      id: "clarifying",
      label: "待澄清",
      description: "主线已经出现，但目标、边界或执行路径还没完全收敛。",
      tone: "slate",
    };
  }

  const hasExecutionSurface = Boolean(
    aggregate.roomId || (workItem?.steps.length ?? 0) > 0 || aggregate.memberIds.length > 1,
  );

  if (!hasExecutionSurface || aggregate.revision <= 1) {
    return {
      id: "aligned",
      label: "已立项",
      description: "当前主线已经明确，下一步是进入执行或拉起协作。",
      tone: "indigo",
    };
  }

  return {
    id: "executing",
    label: "执行中",
    description: "团队正在围绕当前主线推进，详情页会持续同步负责人、阶段和交付。",
    tone: "sky",
  };
}

export function getRequirementStatusToneClass(
  tone: RequirementProductStatusTone,
): string {
  if (tone === "emerald") {
    return "border-emerald-200 bg-emerald-50 text-emerald-700";
  }
  if (tone === "amber") {
    return "border-amber-200 bg-amber-50 text-amber-800";
  }
  if (tone === "rose") {
    return "border-rose-200 bg-rose-50 text-rose-700";
  }
  if (tone === "sky") {
    return "border-sky-200 bg-sky-50 text-sky-700";
  }
  if (tone === "indigo") {
    return "border-indigo-200 bg-indigo-50 text-indigo-700";
  }
  return "border-slate-200 bg-slate-50 text-slate-600";
}
