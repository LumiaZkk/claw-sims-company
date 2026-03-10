export type TeamAdjustmentAction = {
  id: string;
  label: string;
  description: string;
  kind: "message";
  tone: "secondary";
  targetAgentId: string;
  message: string;
};

export function buildRequirementTeamAdjustmentAction(input: {
  member: {
    agentId: string;
    label: string;
    stage: string;
    detail: string;
  };
  topicKey?: string | null;
  requirementTitle: string;
  ownerAgentId: string | null;
  ownerLabel: string;
  effectiveHeadline: string;
  effectiveSummary: string;
}): TeamAdjustmentAction {
  const isOwner = input.member.agentId === input.ownerAgentId;
  const requirementTitle = input.requirementTitle || input.effectiveHeadline;
  return {
    id: `team-adjust:${input.member.agentId}:${input.topicKey ?? "current"}`,
    label: isOwner ? `让 ${input.member.label} 继续负责` : `让 ${input.member.label} 调整处理`,
    description: `直接让 ${input.member.label} 接住当前 baton，并把结果回传给负责人。`,
    kind: "message",
    tone: "secondary",
    targetAgentId: input.member.agentId,
    message: isOwner
      ? `当前需求：${requirementTitle}。你仍是负责人。当前判断：${input.effectiveSummary}。请不要只汇报现状，直接继续推进，并明确回复：1. 你现在推动哪一步 2. 下一棒是谁 3. 你下一次会回传什么结果。`
      : `当前需求：${requirementTitle}。负责人：${input.ownerLabel}。你当前负责的环节：${input.member.stage}。当前判断：${input.member.detail || input.effectiveSummary}。请根据当前情况直接调整并推进，完成后明确回传给负责人：1. 你已完成什么 2. 还差什么 3. 是否需要其他成员配合。`,
  };
}
