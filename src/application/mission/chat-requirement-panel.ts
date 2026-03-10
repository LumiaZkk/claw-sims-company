import { resolveStepAssigneeAgentId } from "../assignment/chat-participants";
import { buildRequirementTeamView, type RequirementTeamView } from "../assignment/requirement-team";
import { formatAgentLabel } from "../governance/focus-summary";
import { summarizeStepLabel } from "./conversation-work-item-view";
import type { RequirementExecutionOverview } from "./requirement-overview";
import type { Company } from "../../domain/org/types";
import type { RequirementRoomMessage } from "../../domain/delegation/types";
import type { TrackedTask } from "../../domain/mission/types";
import type { RequirementSessionSnapshot } from "../../domain/mission/requirement-snapshot";

export type ChatTaskPlanStep = {
  id: string;
  title: string;
  assigneeAgentId: string | null;
  assigneeLabel: string;
  status: "done" | "wip" | "pending";
  statusLabel: string;
  detail: string | null;
};

export type ChatTaskPlanOverview = {
  totalCount: number;
  doneCount: number;
  currentStep: ChatTaskPlanStep | null;
  nextStep: ChatTaskPlanStep | null;
  steps: ChatTaskPlanStep[];
};

function isParticipantStepDone(statusLabel: string): boolean {
  return ["已确认", "已冻结待命", "已回复", "已交接", "已交付待下游"].includes(statusLabel);
}

function isParticipantStepInProgress(statusLabel: string): boolean {
  return ["已开工", "已开工未交付", "已阻塞", "待回复", "未回复", "待接手", "部分完成"].includes(
    statusLabel,
  );
}

export function buildChatTaskPlanOverview(input: {
  company: Company | null;
  requirementOverview: RequirementExecutionOverview | null;
  structuredTaskPreview: TrackedTask | null;
}): ChatTaskPlanOverview | null {
  const { company, requirementOverview, structuredTaskPreview } = input;
  const supportsStructuredTaskPlan =
    !requirementOverview?.topicKey || requirementOverview.topicKey.startsWith("chapter:");
  if (!structuredTaskPreview || !company || !supportsStructuredTaskPlan) {
    return null;
  }

  const participantByAgentId = new Map(
    (requirementOverview?.participants ?? []).map((participant) => [participant.agentId, participant] as const),
  );

  const steps = structuredTaskPreview.steps.map((step, index) => {
    const assigneeAgentId = resolveStepAssigneeAgentId(step, company.employees);
    const assigneeLabel = assigneeAgentId
      ? formatAgentLabel(company, assigneeAgentId)
      : step.assignee?.replace(/^@/, "") || "待分配";
    const title = summarizeStepLabel(step) ?? step.text;
    const participant = assigneeAgentId ? participantByAgentId.get(assigneeAgentId) ?? null : null;
    const inferredStatus: ChatTaskPlanStep["status"] =
      step.status === "done" || (participant && isParticipantStepDone(participant.statusLabel))
        ? "done"
        : step.status === "wip" || (participant && isParticipantStepInProgress(participant.statusLabel))
          ? "wip"
          : "pending";
    const statusLabel =
      inferredStatus === "done" ? "已完成" : inferredStatus === "wip" ? "处理中" : "待处理";

    return {
      id: `${structuredTaskPreview.id}:plan:${index}`,
      title,
      assigneeAgentId,
      assigneeLabel,
      status: inferredStatus,
      statusLabel,
      detail: participant?.detail ?? null,
    };
  });

  const doneCount = steps.filter((step) => step.status === "done").length;
  const currentStep = steps.find((step) => step.status !== "done") ?? null;
  const nextStep = currentStep
    ? steps[steps.findIndex((step) => step.id === currentStep.id) + 1] ?? null
    : null;

  return {
    totalCount: steps.length,
    doneCount,
    currentStep,
    nextStep,
    steps,
  };
}

export function buildChatRequirementTeam(input: {
  company: Company | null;
  requirementOverview: RequirementExecutionOverview | null;
  plan: ChatTaskPlanOverview | null;
  roomTranscript?: RequirementRoomMessage[];
  sessionSnapshots?: RequirementSessionSnapshot[];
  includeTimeline: boolean;
  includeArtifacts: boolean;
}): RequirementTeamView | null {
  return buildRequirementTeamView({
    company: input.company,
    overview: input.requirementOverview,
    plan: input.plan,
    roomTranscript: input.roomTranscript,
    sessionSnapshots: input.sessionSnapshots,
    includeTimeline: input.includeTimeline,
    includeArtifacts: input.includeArtifacts,
  });
}
