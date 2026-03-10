import type { ChatMessage } from "../gateway";
import { inferMissionTopicKey, inferRequestTopicKey } from "../delegation/request-topic";
import type { HandoffRecord, RequestRecord } from "../../domain/delegation/types";
import type { WorkItemRecord, ConversationStateRecord, TrackedTask } from "../../domain/mission/types";
import type { Company } from "../../domain/org/types";
import { isArtifactRequirementTopic, isStrategicRequirementTopic } from "./requirement-kind";
import { buildRequirementExecutionOverview, type RequirementExecutionOverview } from "./requirement-overview";
import type { RequirementSessionSnapshot } from "../../domain/mission/requirement-snapshot";
import {
  isCanonicalProductWorkItemRecord,
  shouldPreferReliableStrategicOverview,
  shouldReplaceLockedStrategicWorkItem,
} from "./work-item-signal";

export type ConversationRequirementHint = {
  text: string;
  topicKey: string | null;
  timestamp: number | null;
};

function extractTextFromChatMessage(message: ChatMessage | null | undefined): string {
  if (!message) {
    return "";
  }
  if (typeof message.text === "string" && message.text.trim().length > 0) {
    return message.text.trim();
  }
  if (typeof message.content === "string" && message.content.trim().length > 0) {
    return message.content.trim();
  }
  if (!Array.isArray(message.content)) {
    return "";
  }
  return message.content
    .map((block) => {
      if (typeof block === "string") {
        return block;
      }
      if (block && typeof block === "object") {
        const record = block as Record<string, unknown>;
        if (record.type === "text" && typeof record.text === "string") {
          return record.text;
        }
      }
      return "";
    })
    .join("\n")
    .trim();
}

function isSubstantiveConversationText(text: string | null | undefined): boolean {
  const normalized = text?.replace(/\s+/g, " ").trim() ?? "";
  if (!normalized) {
    return false;
  }
  if (normalized.length < 4) {
    return false;
  }
  if (/^(hi|hello|ok|好的|收到|继续|嗯|yes|no)$/i.test(normalized)) {
    return false;
  }
  return true;
}

function toConversationRequirementHint(
  text: string,
  timestamp: number | null,
): ConversationRequirementHint {
  const inferred = inferRequestTopicKey([text]) ?? inferMissionTopicKey([text]);
  return {
    text,
    topicKey: inferred && !isArtifactRequirementTopic(inferred) ? inferred : null,
    timestamp,
  };
}

function findLatestConversationRequirementHint(
  messages: ChatMessage[],
  predicate?: (text: string) => boolean,
): ConversationRequirementHint | null {
  for (let index = messages.length - 1; index >= 0; index -= 1) {
    const message = messages[index];
    if (message?.role !== "user") {
      continue;
    }
    const text = extractTextFromChatMessage(message);
    if (!text || !isSubstantiveConversationText(text)) {
      continue;
    }
    if (predicate && !predicate(text)) {
      continue;
    }
    return toConversationRequirementHint(
      text,
      typeof message.timestamp === "number" ? message.timestamp : null,
    );
  }
  return null;
}

export type ChatRequirementState = {
  currentConversationRequirementHint: ConversationRequirementHint | null;
  latestStrategicConversationHint: ConversationRequirementHint | null;
  resolvedConversationRequirementHint: ConversationRequirementHint | null;
  canonicalWorkItems: WorkItemRecord[];
  latestOpenCanonicalWorkItem: WorkItemRecord | null;
  latestStrategicCanonicalWorkItem: WorkItemRecord | null;
  stableConversationWorkItem: WorkItemRecord | null;
  stableConversationTopicKey: string | null;
  lockedStrategicConversationWorkItem: WorkItemRecord | null;
  rawConversationRequirementOverview: RequirementExecutionOverview | null;
  shouldReplaceLockedConversationWorkItem: boolean;
  shouldPreferStrategicOverviewOverStableConversationWorkItem: boolean;
  effectiveStableConversationWorkItem: WorkItemRecord | null;
  effectiveLockedStrategicConversationWorkItem: WorkItemRecord | null;
  preferredConversationTopicKey: string | null;
  preferredConversationTopicText: string | null;
  preferredConversationTopicTimestamp: number | null;
  requirementOverview: RequirementExecutionOverview | null;
};

export function buildChatRequirementState(input: {
  activeCompany: Company | null;
  activeConversationState: ConversationStateRecord | null;
  activeWorkItems: WorkItemRecord[];
  companySessionSnapshots: RequirementSessionSnapshot[];
  requestPreview: RequestRecord[];
  handoffPreview: HandoffRecord[];
  structuredTaskPreview: TrackedTask | null;
  messages: ChatMessage[];
  currentTime: number;
  historyAgentId: string | null;
  isGroup: boolean;
  isCeoSession: boolean;
  isFreshConversation: boolean;
  isRequirementBootstrapPending: boolean;
}): ChatRequirementState {
  const currentConversationRequirementHint = input.isGroup
    ? null
    : findLatestConversationRequirementHint(input.messages);
  const latestStrategicConversationHint =
    input.isGroup || !input.isCeoSession
      ? null
      : findLatestConversationRequirementHint(input.messages, (text) =>
          /从头开始|重新搭建|新立项|重新规划|旧任务.*作废|全部作废|先别管旧任务|搭建.*团队|创作团队|组织架构|招聘JD|兼任方案|世界观架构师|伏笔管理员|去AI味专员|方案|系统|工具|实现|规划|优先级|业务流程|技术架构|阅读|团队|组织|招聘|岗位|班底|专项|质量提升/iu.test(
            text,
          ),
        );
  const resolvedConversationRequirementHint =
    !input.isGroup && input.isCeoSession
      ? latestStrategicConversationHint ?? currentConversationRequirementHint
      : currentConversationRequirementHint;

  const canonicalWorkItems = input.activeWorkItems.filter((item) =>
    isCanonicalProductWorkItemRecord(item, input.historyAgentId),
  );
  const latestOpenCanonicalWorkItem =
    [...canonicalWorkItems]
      .filter((item) => item.status !== "completed" && item.status !== "archived")
      .sort((left, right) => right.updatedAt - left.updatedAt)[0] ?? null;
  const latestStrategicCanonicalWorkItem =
    [...canonicalWorkItems]
      .filter(
        (item) =>
          isStrategicRequirementTopic(item.topicKey) &&
          item.status !== "completed" &&
          item.status !== "archived",
      )
      .sort((left, right) => right.updatedAt - left.updatedAt)[0] ?? null;

  const activeConversationState = input.activeConversationState;
  const stableConversationWorkItem = (() => {
    if (!activeConversationState) {
      return null;
    }
    if (activeConversationState.currentWorkItemId) {
      const matchedById =
        canonicalWorkItems.find((item) => item.id === activeConversationState.currentWorkItemId) ?? null;
      if (matchedById) {
        return matchedById;
      }
    }
    if (activeConversationState.currentWorkKey) {
      return canonicalWorkItems.find((item) => item.workKey === activeConversationState.currentWorkKey) ?? null;
    }
    return null;
  })();

  const stableConversationTopicKey = stableConversationWorkItem?.topicKey
    ? stableConversationWorkItem.topicKey
    : (() => {
        const workKey = input.activeConversationState?.currentWorkKey?.trim() ?? "";
        return workKey.startsWith("topic:") ? workKey.slice("topic:".length) : null;
      })();

  const lockedStrategicConversationWorkItem =
    !input.isGroup &&
    input.isCeoSession &&
    stableConversationWorkItem &&
    isStrategicRequirementTopic(stableConversationWorkItem.topicKey) &&
    stableConversationWorkItem.status !== "completed" &&
    stableConversationWorkItem.status !== "archived"
      ? stableConversationWorkItem
      : null;

  const rawConversationRequirementOverview =
    input.activeCompany && !input.isRequirementBootstrapPending && !input.isFreshConversation
      ? buildRequirementExecutionOverview({
          company: input.activeCompany,
          includeArtifactTopics: false,
          preferredTopicKey:
            resolvedConversationRequirementHint?.topicKey ?? stableConversationTopicKey ?? null,
          preferredTopicText:
            resolvedConversationRequirementHint?.text ??
            stableConversationWorkItem?.title ??
            stableConversationWorkItem?.summary ??
            null,
          preferredTopicTimestamp:
            resolvedConversationRequirementHint?.timestamp ??
            stableConversationWorkItem?.updatedAt ??
            stableConversationWorkItem?.startedAt ??
            null,
          topicHints: [
            resolvedConversationRequirementHint?.text,
            stableConversationWorkItem?.title,
            stableConversationWorkItem?.summary,
            ...input.requestPreview.map((request) => request.topicKey ?? request.title ?? request.summary),
            ...input.handoffPreview.map((handoff) => `${handoff.title}\n${handoff.summary}`),
            input.structuredTaskPreview?.title,
          ],
          sessionSnapshots: input.companySessionSnapshots,
          now: input.currentTime,
        })
      : null;

  const shouldReplaceLockedConversationWorkItem = shouldReplaceLockedStrategicWorkItem({
    lockedWorkItem: lockedStrategicConversationWorkItem,
    latestHintText: resolvedConversationRequirementHint?.text,
    latestHintTopicKey: resolvedConversationRequirementHint?.topicKey,
    overview: rawConversationRequirementOverview,
  });

  const shouldPreferStrategicOverviewOverStableConversationWorkItem =
    !input.isGroup &&
    input.isCeoSession &&
    shouldPreferReliableStrategicOverview({
      stableWorkItem: stableConversationWorkItem,
      latestHintText: resolvedConversationRequirementHint?.text,
      latestHintTopicKey: resolvedConversationRequirementHint?.topicKey,
      overview: rawConversationRequirementOverview,
    });

  const effectiveStableConversationWorkItem =
    shouldReplaceLockedConversationWorkItem || shouldPreferStrategicOverviewOverStableConversationWorkItem
      ? null
      : stableConversationWorkItem;
  const effectiveLockedStrategicConversationWorkItem =
    shouldReplaceLockedConversationWorkItem ? null : lockedStrategicConversationWorkItem;

  const preferredConversationTopicKey =
    effectiveLockedStrategicConversationWorkItem?.topicKey ??
    resolvedConversationRequirementHint?.topicKey ??
    stableConversationTopicKey ??
    null;
  const preferredConversationTopicText =
    effectiveLockedStrategicConversationWorkItem?.title ??
    resolvedConversationRequirementHint?.text ??
    null;
  const preferredConversationTopicTimestamp =
    effectiveLockedStrategicConversationWorkItem?.updatedAt ??
    effectiveLockedStrategicConversationWorkItem?.startedAt ??
    resolvedConversationRequirementHint?.timestamp ??
    null;

  const requirementOverview =
    input.activeCompany && !input.isRequirementBootstrapPending && !input.isFreshConversation
      ? buildRequirementExecutionOverview({
          company: input.activeCompany,
          includeArtifactTopics: false,
          preferredTopicKey: preferredConversationTopicKey,
          preferredTopicText: preferredConversationTopicText,
          preferredTopicTimestamp: preferredConversationTopicTimestamp,
          topicHints: [
            resolvedConversationRequirementHint?.text,
            effectiveStableConversationWorkItem?.title,
            effectiveStableConversationWorkItem?.summary,
            ...input.requestPreview.map((request) => request.topicKey ?? request.title ?? request.summary),
            ...input.handoffPreview.map((handoff) => `${handoff.title}\n${handoff.summary}`),
            input.structuredTaskPreview?.title,
          ],
          sessionSnapshots: input.companySessionSnapshots,
          now: input.currentTime,
        })
      : null;

  return {
    currentConversationRequirementHint,
    latestStrategicConversationHint,
    resolvedConversationRequirementHint,
    canonicalWorkItems,
    latestOpenCanonicalWorkItem,
    latestStrategicCanonicalWorkItem,
    stableConversationWorkItem,
    stableConversationTopicKey,
    lockedStrategicConversationWorkItem,
    rawConversationRequirementOverview,
    shouldReplaceLockedConversationWorkItem,
    shouldPreferStrategicOverviewOverStableConversationWorkItem,
    effectiveStableConversationWorkItem,
    effectiveLockedStrategicConversationWorkItem,
    preferredConversationTopicKey,
    preferredConversationTopicText,
    preferredConversationTopicTimestamp,
    requirementOverview,
  };
}
