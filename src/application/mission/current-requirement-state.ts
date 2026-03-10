import { buildRequirementExecutionOverview, type RequirementExecutionOverview } from "./requirement-overview";
import type { RequirementSessionSnapshot } from "../../domain/mission/requirement-snapshot";
import { buildRequirementScope, type RequirementScope } from "./requirement-scope";
import {
  pickConversationScopedWorkItem,
  pickWorkItemRecord,
} from "./work-item";
import { reconcileWorkItemRecord } from "./work-item-reconciler";
import {
  isCanonicalProductWorkItemRecord,
  isReliableRequirementOverview,
  isReliableWorkItemRecord,
} from "./work-item-signal";
import { isArtifactRequirementTopic, isStrategicRequirementTopic } from "./requirement-kind";
import { isSyntheticWorkflowPromptText } from "./message-truth";
import type { Company, ConversationStateRecord, WorkItemRecord } from "../../domain";
import type { GatewaySessionRow } from "../gateway";

export type RequirementInstructionHint = {
  text: string;
  timestamp: number;
};

export type CurrentRequirementState = {
  ceoInstructionHint: RequirementInstructionHint | null;
  rawRequirementOverview: RequirementExecutionOverview | null;
  currentRequirementOwnerAgentId: string | null;
  canonicalWorkItems: WorkItemRecord[];
  latestOpenWorkItem: WorkItemRecord | null;
  latestStrategicWorkItem: WorkItemRecord | null;
  ceoConversationWorkItem: WorkItemRecord | null;
  requirementTopicKeyHint: string | null;
  requirementStartedAtHint: number | null;
  currentRequirementSessionKey: string | null;
  matchedWorkItem: WorkItemRecord | null;
  previewRequirementWorkItem: WorkItemRecord | null;
  shouldPreferPreviewRequirementWorkItem: boolean;
  activeWorkItem: WorkItemRecord | null;
  currentWorkItem: WorkItemRecord | null;
  requirementOverview: RequirementExecutionOverview | null;
  requirementScope: RequirementScope | null;
  primaryRequirementTopicKey: string | null;
  strategicRequirementOverview: RequirementExecutionOverview | null;
};

function findLatestOpenWorkItem(items: WorkItemRecord[]): WorkItemRecord | null {
  return (
    [...items]
      .filter((item) => item.status !== "completed" && item.status !== "archived")
      .sort((left, right) => {
        const leftSpecific = Number(Boolean(left.topicKey));
        const rightSpecific = Number(Boolean(right.topicKey));
        if (leftSpecific !== rightSpecific) {
          return rightSpecific - leftSpecific;
        }
        return right.updatedAt - left.updatedAt;
      })[0] ?? null
  );
}

function findLatestStrategicWorkItem(items: WorkItemRecord[]): WorkItemRecord | null {
  return (
    [...items]
      .filter(
        (item) =>
          isStrategicRequirementTopic(item.topicKey) &&
          item.status !== "completed" &&
          item.status !== "archived",
      )
      .sort((left, right) => right.updatedAt - left.updatedAt)[0] ?? null
  );
}

export function buildCurrentRequirementState(params: {
  company: Company;
  activeConversationStates: ConversationStateRecord[];
  activeWorkItems: WorkItemRecord[];
  companySessions: Array<GatewaySessionRow & { agentId: string }>;
  companySessionSnapshots: RequirementSessionSnapshot[];
  currentTime: number;
  ceoAgentId?: string | null;
}): CurrentRequirementState {
  const {
    company,
    activeConversationStates,
    activeWorkItems,
    companySessions,
    companySessionSnapshots,
    currentTime,
    ceoAgentId,
  } = params;
  const ceoInstructionHint =
    ceoAgentId
      ? (() => {
          const ceoSnapshot = companySessionSnapshots.find((snapshot) => snapshot.agentId === ceoAgentId);
          const latestUserMessage = [...(ceoSnapshot?.messages ?? [])]
            .reverse()
            .find(
              (message) =>
                message.role === "user" &&
                message.text.trim().length > 12 &&
                !isSyntheticWorkflowPromptText(message.text),
            );
          return latestUserMessage
            ? {
                text: latestUserMessage.text,
                timestamp: latestUserMessage.timestamp,
              }
            : null;
        })()
      : null;

  const shouldBootstrapRequirementOverview = Boolean(
    ceoInstructionHint?.text ||
      activeWorkItems.some(
        (item) =>
          isReliableWorkItemRecord(item) &&
          item.status !== "completed" &&
          item.status !== "archived",
      ),
  );

  const rawRequirementOverview =
    shouldBootstrapRequirementOverview
      ? buildRequirementExecutionOverview({
          company,
          sessionSnapshots: companySessionSnapshots,
          preferredTopicText: ceoInstructionHint?.text ?? null,
          preferredTopicTimestamp: ceoInstructionHint?.timestamp ?? null,
          includeArtifactTopics: false,
          now: currentTime,
        })
      : null;

  const currentRequirementOwnerAgentId = rawRequirementOverview?.currentOwnerAgentId ?? null;
  const canonicalWorkItems = activeWorkItems.filter(
    (item) =>
      isCanonicalProductWorkItemRecord(item, ceoAgentId) &&
      !isArtifactRequirementTopic(item.topicKey),
  );
  const latestOpenWorkItem = findLatestOpenWorkItem(canonicalWorkItems);
  const latestStrategicWorkItem = findLatestStrategicWorkItem(canonicalWorkItems);
  const ceoConversationWorkItem = pickConversationScopedWorkItem({
    items: canonicalWorkItems,
    conversationStates: activeConversationStates,
    actorId: ceoAgentId ?? null,
  });
  const requirementTopicKeyHint = rawRequirementOverview?.topicKey ?? latestOpenWorkItem?.topicKey ?? null;
  const requirementStartedAtHint = rawRequirementOverview?.startedAt ?? latestOpenWorkItem?.startedAt ?? null;
  const currentRequirementSessionKey =
    currentRequirementOwnerAgentId
      ? companySessions.find((session) => session.agentId === currentRequirementOwnerAgentId)?.key ?? null
      : latestOpenWorkItem?.ownerActorId
        ? companySessions.find((session) => session.agentId === latestOpenWorkItem.ownerActorId)?.key ?? null
        : null;
  const matchedWorkItem = pickWorkItemRecord({
    items: canonicalWorkItems,
    sessionKey: currentRequirementSessionKey,
    topicKey: requirementTopicKeyHint,
    startedAt: requirementStartedAtHint,
  });
  const previewRequirementWorkItem =
    rawRequirementOverview && isReliableRequirementOverview(rawRequirementOverview)
      ? reconcileWorkItemRecord({
          companyId: company.id,
          existingWorkItem:
            ceoConversationWorkItem ??
            latestStrategicWorkItem ??
            latestOpenWorkItem ??
            matchedWorkItem ??
            null,
          overview: rawRequirementOverview,
          fallbackSessionKey: currentRequirementSessionKey,
        })
      : null;
  const shouldPreferPreviewRequirementWorkItem =
    Boolean(previewRequirementWorkItem) &&
    (!ceoConversationWorkItem ||
      ceoConversationWorkItem.kind !== "strategic" ||
      ceoConversationWorkItem.topicKey !== previewRequirementWorkItem?.topicKey ||
      ceoConversationWorkItem.title !== previewRequirementWorkItem?.title);
  const activeWorkItem =
    shouldPreferPreviewRequirementWorkItem && previewRequirementWorkItem
      ? previewRequirementWorkItem
      : ceoConversationWorkItem ??
        latestStrategicWorkItem ??
        latestOpenWorkItem ??
        (activeWorkItems.length === 0 ? matchedWorkItem ?? null : null);
  const currentWorkItem =
    activeWorkItem && isReliableWorkItemRecord(activeWorkItem) ? activeWorkItem : null;
  const requirementOverview =
    currentWorkItem && rawRequirementOverview
      ? currentWorkItem.topicKey && rawRequirementOverview.topicKey !== currentWorkItem.topicKey
        ? null
        : rawRequirementOverview
      : null;
  const requirementScope = buildRequirementScope(company, requirementOverview, currentWorkItem);
  const primaryRequirementTopicKey = currentWorkItem?.topicKey ?? requirementOverview?.topicKey ?? null;
  const strategicRequirementOverview =
    requirementOverview && requirementOverview.topicKey === primaryRequirementTopicKey
      ? requirementOverview
      : null;

  return {
    ceoInstructionHint,
    rawRequirementOverview,
    currentRequirementOwnerAgentId,
    canonicalWorkItems,
    latestOpenWorkItem,
    latestStrategicWorkItem,
    ceoConversationWorkItem,
    requirementTopicKeyHint,
    requirementStartedAtHint,
    currentRequirementSessionKey,
    matchedWorkItem,
    previewRequirementWorkItem,
    shouldPreferPreviewRequirementWorkItem,
    activeWorkItem,
    currentWorkItem,
    requirementOverview,
    requirementScope,
    primaryRequirementTopicKey,
    strategicRequirementOverview,
  };
}
