import type { Company, HandoffRecord, RequestRecord } from "../../domain";
import {
  buildRequirementOverviewTitle as buildOverviewTitle,
} from "../../domain/mission/requirement-topic";
import {
  pickCurrentParticipant,
} from "../../domain/mission/participant-progress";
import { type RequirementSessionSnapshot } from "../../domain/mission/requirement-snapshot";
import { getActiveHandoffs } from "../delegation/active-handoffs";
import { getActiveRequests } from "../delegation/request-health";
import { isReliableRequirementOverview } from "./work-item-signal";
import { buildTrackedDelegationOverview } from "./tracked-delegation-overview";
import {
  buildDispatchCoordinatorOverview,
  buildRequestParticipantProgress,
  orderParticipants,
  resolveSnapshotParticipant,
} from "./requirement-participants";
import {
  extractTopicHints,
  matchesHandoffTopic,
  matchesRequestTopic,
  normalizeRequirementTopicCandidate,
  resolveRequirementAnchor,
  resolveTopicKey,
  resolveTopicKeyFromSnapshots,
  snapshotsMentionRestart,
} from "./requirement-window";
import type {
  RequirementExecutionOverview,
  RequirementParticipantProgress,
} from "./requirement-overview-types";

export type {
  RequirementExecutionOverview,
  RequirementParticipantProgress,
} from "./requirement-overview-types";

type BuildRequirementExecutionOverviewInput = {
  company: Company | null | undefined;
  topicHints?: Array<string | null | undefined>;
  preferredTopicKey?: string | null;
  preferredTopicText?: string | null;
  preferredTopicTimestamp?: number | null;
  sessionSnapshots?: RequirementSessionSnapshot[];
  now?: number;
  includeArtifactTopics?: boolean;
};

function uniqueById<T extends { id: string }>(items: T[]): T[] {
  const byId = new Map<string, T>();
  for (const item of items) {
    byId.set(item.id, item);
  }
  return [...byId.values()];
}

function pickLatestRequest(requests: RequestRecord[], agentId: string): RequestRecord | null {
  return (
    [...requests]
      .filter((request) => request.toAgentIds.includes(agentId))
      .sort((left, right) => right.updatedAt - left.updatedAt)[0] ?? null
  );
}

function pickLatestHandoff(handoffs: HandoffRecord[], agentId: string): HandoffRecord | null {
  return (
    [...handoffs]
      .filter((handoff) => handoff.toAgentIds.includes(agentId))
      .sort((left, right) => right.updatedAt - left.updatedAt)[0] ?? null
  );
}


function buildLiveOverview(
  company: Company,
  topicKey: string,
  hints: string[],
  snapshots: RequirementSessionSnapshot[],
  now: number,
): RequirementExecutionOverview | null {
  const anchor = resolveRequirementAnchor(snapshots, topicKey, hints);
  const participants = orderParticipants(
    company,
    snapshots
      .map((snapshot) =>
        resolveSnapshotParticipant({
          company,
          snapshot,
          topicKey,
          hints,
          now,
          anchor,
        }),
      )
      .filter((participant): participant is RequirementParticipantProgress => Boolean(participant)),
  );

  if (participants.length === 0) {
    return null;
  }

  const current = pickCurrentParticipant(participants);
  if (!current) {
    return null;
  }

  const title =
    topicKey.startsWith("chapter:") && (anchor?.isRestart || snapshotsMentionRestart(snapshots))
      ? `重新完成第 ${topicKey.slice("chapter:".length)} 章`
      : buildOverviewTitle(topicKey, hints);
  const startedAt =
    anchor?.windowStart ??
    participants.reduce(
      (earliest, participant) => Math.min(earliest, participant.updatedAt),
      Number.MAX_SAFE_INTEGER,
    );
  const normalizedParticipants = participants.map((participant) => ({
    ...participant,
    isCurrent: participant.agentId === current.agentId,
  }));

  const dispatchOverview = buildDispatchCoordinatorOverview({
    company,
    topicKey,
    title,
    startedAt: Number.isFinite(startedAt) ? startedAt : now,
    participants: normalizedParticipants,
  });
  if (dispatchOverview) {
    return dispatchOverview;
  }

  let headline = `${current.nickname} 正在处理`;
  let nextAction = `打开 ${current.nickname} 会话继续跟进。`;

  if (current.isBlocking) {
    headline = `${current.nickname} 这一步卡住了`;
    nextAction = `优先打开 ${current.nickname} 会话，把这一步补齐。`;
  } else if (current.statusLabel === "已开工未交付") {
    headline = `${current.nickname} 还没交新稿`;
    nextAction = `优先打开 ${current.nickname} 会话，确认纯正文新稿是否已经落盘。`;
  } else if (current.statusLabel === "已开工") {
    headline = `${current.nickname} 正在处理`;
    nextAction = `先等 ${current.nickname} 交稿；如果久没有结果，再去会话里催。`;
  } else if (current.statusLabel === "未回复" || current.statusLabel === "待回复") {
    headline = `正在等 ${current.nickname} 回复`;
    nextAction = `优先催 ${current.nickname} 先确认是否接单。`;
  } else if (current.statusLabel === "已交付待下游") {
    headline = `${current.nickname} 已交付，下一棒要接住`;
    nextAction = "现在该去追下游环节，不要再盯上一棒。";
  } else if (current.statusLabel === "已冻结待命") {
    headline = `${current.nickname} 已待命`;
    nextAction = "这一步不用再追，继续盯当前真正的执行节点。";
  }

  return {
    topicKey,
    title,
    startedAt: Number.isFinite(startedAt) ? startedAt : now,
    headline,
    summary: current.detail,
    currentOwnerAgentId: current.agentId,
    currentOwnerLabel: current.nickname,
    currentStage: current.stage,
    nextAction,
    participants: normalizedParticipants,
  };
}

export function buildRequirementExecutionOverview(
  input: BuildRequirementExecutionOverviewInput,
): RequirementExecutionOverview | null {
  const { company, now = Date.now() } = input;
  const includeArtifactTopics = input.includeArtifactTopics ?? true;
  if (!company) {
    return null;
  }

  const activeRequests = uniqueById(getActiveRequests(company.requests ?? []));
  const activeHandoffs = uniqueById(getActiveHandoffs(company.handoffs ?? []));
  const hints = extractTopicHints(input.topicHints ?? []);
  const trackedDelegationOverview =
    input.sessionSnapshots && input.sessionSnapshots.length > 0
      ? buildTrackedDelegationOverview({
          company,
          snapshots: input.sessionSnapshots,
          now,
          preferredTopicKey: input.preferredTopicKey ?? null,
          preferredTopicText: input.preferredTopicText ?? null,
          preferredTopicTimestamp: input.preferredTopicTimestamp ?? null,
        })
      : null;
  if (
    trackedDelegationOverview &&
    normalizeRequirementTopicCandidate(trackedDelegationOverview.topicKey, includeArtifactTopics) &&
    isReliableRequirementOverview(trackedDelegationOverview)
  ) {
    return trackedDelegationOverview;
  }
  const preferredTopicKey = input.preferredTopicKey ?? null;
  const explicitHintTopic = hints.find((hint) => hint.startsWith("chapter:") || hint.startsWith("artifact:")) ?? null;
  const snapshotTopic =
    input.sessionSnapshots && input.sessionSnapshots.length > 0
      ? resolveTopicKeyFromSnapshots(input.sessionSnapshots, hints)
      : null;
  const topicKey =
    normalizeRequirementTopicCandidate(preferredTopicKey, includeArtifactTopics) ??
    normalizeRequirementTopicCandidate(snapshotTopic, includeArtifactTopics) ??
    normalizeRequirementTopicCandidate(explicitHintTopic, includeArtifactTopics) ??
    normalizeRequirementTopicCandidate(resolveTopicKey(activeRequests, activeHandoffs, hints), includeArtifactTopics);
  if (!topicKey) {
    return null;
  }

  const liveOverview =
    input.sessionSnapshots && input.sessionSnapshots.length > 0
      ? buildLiveOverview(company, topicKey, hints, input.sessionSnapshots, now)
      : null;
  if (liveOverview && isReliableRequirementOverview(liveOverview)) {
    return liveOverview;
  }

  const requests = activeRequests
    .filter((request) => matchesRequestTopic(request, topicKey))
    .sort((left, right) => right.updatedAt - left.updatedAt);
  const handoffs = activeHandoffs
    .filter((handoff) => matchesHandoffTopic(handoff, topicKey))
    .sort((left, right) => right.updatedAt - left.updatedAt);

  if (requests.length === 0 && handoffs.length === 0) {
    return null;
  }

  const participantIds = [
    ...requests.flatMap((request) => request.toAgentIds),
    ...handoffs.flatMap((handoff) => handoff.toAgentIds),
  ].filter((agentId, index, array) => array.indexOf(agentId) === index);

  const participants = orderParticipants(
    company,
    participantIds.map((agentId) =>
      buildRequestParticipantProgress(
        company,
        agentId,
        pickLatestRequest(requests, agentId),
        pickLatestHandoff(handoffs, agentId),
        now,
      ),
    ),
  );

  const current = pickCurrentParticipant(participants);
  if (!current) {
    return null;
  }

  const currentParticipants = participants.map((participant) => ({
    ...participant,
    isCurrent: participant.agentId === current.agentId,
  }));

  let headline = `${current.nickname} 正在处理`;
  const summary = current.detail;
  let nextAction = `打开 ${current.nickname} 会话继续跟进。`;
  const startedAt = [...requests, ...handoffs].reduce(
    (earliest, item) => Math.min(earliest, item.updatedAt),
    Number.MAX_SAFE_INTEGER,
  );

  if (current.isBlocking) {
    headline = `${current.nickname} 这一步卡住了`;
    nextAction = `优先打开 ${current.nickname} 会话，把这一步补齐。`;
  } else if (current.statusLabel === "已开工未交付") {
    headline = `${current.nickname} 还没交付结果`;
    nextAction = `优先找 ${current.nickname} 确认交稿和文件路径。`;
  } else if (current.statusLabel === "未回复" || current.statusLabel === "待回复") {
    headline = `正在等 ${current.nickname} 回复`;
    nextAction = `优先催 ${current.nickname} 先确认是否接单。`;
  } else if (current.statusLabel === "已冻结待命") {
    headline = `${current.nickname} 已待命`;
    nextAction = "这一步不用再追，继续盯当前真正的执行节点。";
  }

  const fallbackOverview = {
    topicKey,
    title: buildOverviewTitle(topicKey, hints),
    startedAt: Number.isFinite(startedAt) ? startedAt : now,
    headline,
    summary,
    currentOwnerAgentId: current.agentId,
    currentOwnerLabel: current.nickname,
    currentStage: current.stage,
    nextAction,
    participants: currentParticipants,
  };
  return isReliableRequirementOverview(fallbackOverview) ? fallbackOverview : null;
}
