import { getActiveHandoffs } from "../delegation/active-handoffs";
import { filterRequirementSlaAlerts, type RequirementScope } from "./requirement-scope";
import { evaluateSlaAlerts, type SlaAlert } from "../governance/sla-rules";
import { isStrategicRequirementTopic } from "./requirement-kind";
import type { CurrentRequirementState } from "./current-requirement-state";
import type { Company } from "../../domain/org/types";
import type { HandoffRecord, RequestRecord } from "../../domain/delegation/types";
import type { WorkItemRecord } from "../../domain/mission/types";

export type LobbyRequirementSurface = {
  currentRequirementOwnerAgentId: string | null;
  currentWorkItem: WorkItemRecord | null;
  requirementOverview: CurrentRequirementState["requirementOverview"];
  requirementScope: RequirementScope | null;
  currentRequirementWorkItemId: string | null;
  primaryRequirementTopicKey: string | null;
  isStrategicRequirement: boolean;
  companyTasks: NonNullable<RequirementScope["tasks"]>;
  companyHandoffs: HandoffRecord[];
  companyRequests: RequestRecord[];
  slaAlerts: SlaAlert[];
  requirementDisplayTitle: string;
  requirementDisplayCurrentStep: string;
  requirementDisplaySummary: string;
  requirementDisplayOwner: string;
  requirementDisplayStage: string;
  requirementDisplayNext: string;
  primaryOwnerEmployee: Company["employees"][number] | null;
  completedWorkSteps: number;
  totalWorkSteps: number;
};

export function buildLobbyRequirementSurface(input: {
  company: Company;
  requirementState: CurrentRequirementState;
  currentTime: number;
}): LobbyRequirementSurface {
  const { company, requirementState, currentTime } = input;
  const {
    currentRequirementOwnerAgentId,
    currentWorkItem,
    requirementOverview,
    requirementScope,
    primaryRequirementTopicKey,
  } = requirementState;

  const companyTasks = currentWorkItem ? requirementScope?.tasks ?? [] : [];
  const companyHandoffs = currentWorkItem
    ? requirementScope?.handoffs ?? getActiveHandoffs(company.handoffs ?? [])
    : [];
  const companyRequests = currentWorkItem ? requirementScope?.requests ?? (company.requests ?? []) : [];
  const rawSlaAlerts = currentWorkItem ? evaluateSlaAlerts(company, currentTime) : [];
  const slaAlerts = filterRequirementSlaAlerts(rawSlaAlerts, requirementScope);
  const currentRequirementWorkItemId = currentWorkItem?.id ?? null;
  const isStrategicRequirement = Boolean(
    primaryRequirementTopicKey && isStrategicRequirementTopic(primaryRequirementTopicKey),
  );
  const strategicRequirementOverview =
    requirementOverview && requirementOverview.topicKey === primaryRequirementTopicKey
      ? requirementOverview
      : null;

  const requirementDisplayTitle =
    currentWorkItem
      ? currentWorkItem.title || currentWorkItem.headline || "当前需求"
      : (isStrategicRequirement && strategicRequirementOverview
          ? strategicRequirementOverview.title
          : requirementOverview?.title) ?? "当前需求";
  const requirementDisplayCurrentStep =
    currentWorkItem
      ? currentWorkItem.displayStage || currentWorkItem.stageLabel || "待确认"
      : (isStrategicRequirement && strategicRequirementOverview
          ? strategicRequirementOverview.headline
          : requirementOverview?.headline) ?? "待确认";
  const requirementDisplaySummary =
    currentWorkItem
      ? currentWorkItem.displaySummary || currentWorkItem.summary || "待确认"
      : (isStrategicRequirement && strategicRequirementOverview
          ? strategicRequirementOverview.summary
          : requirementOverview?.summary) ?? "待确认";
  const requirementDisplayOwner =
    currentWorkItem
      ? currentWorkItem.displayOwnerLabel || currentWorkItem.ownerLabel || "待确认"
      : (isStrategicRequirement && strategicRequirementOverview
          ? strategicRequirementOverview.currentOwnerLabel
          : requirementOverview?.currentOwnerLabel) || "待确认";
  const requirementDisplayStage =
    currentWorkItem
      ? currentWorkItem.displayStage || currentWorkItem.stageLabel || "待确认"
      : (isStrategicRequirement && strategicRequirementOverview
          ? strategicRequirementOverview.currentStage
          : requirementOverview?.currentStage) ?? "待确认";
  const requirementDisplayNext =
    currentWorkItem
      ? currentWorkItem.displayNextAction || currentWorkItem.nextAction || "待确认"
      : (isStrategicRequirement && strategicRequirementOverview
          ? strategicRequirementOverview.nextAction
          : requirementOverview?.nextAction) ?? "待确认";

  const primaryOwnerEmployee =
    currentWorkItem?.ownerActorId
      ? company.employees.find((employee) => employee.agentId === currentWorkItem.ownerActorId) ?? null
      : currentRequirementOwnerAgentId
        ? company.employees.find((employee) => employee.agentId === currentRequirementOwnerAgentId) ?? null
        : null;

  return {
    currentRequirementOwnerAgentId,
    currentWorkItem,
    requirementOverview,
    requirementScope,
    currentRequirementWorkItemId,
    primaryRequirementTopicKey,
    isStrategicRequirement,
    companyTasks,
    companyHandoffs,
    companyRequests,
    slaAlerts,
    requirementDisplayTitle,
    requirementDisplayCurrentStep,
    requirementDisplaySummary,
    requirementDisplayOwner,
    requirementDisplayStage,
    requirementDisplayNext,
    primaryOwnerEmployee,
    completedWorkSteps: currentWorkItem?.steps.filter((step) => step.status === "done").length ?? 0,
    totalWorkSteps: currentWorkItem?.steps.length ?? 0,
  };
}
