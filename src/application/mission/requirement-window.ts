import type { HandoffRecord, RequestRecord } from "../../domain";
import {
  type RequirementMessageSnapshot,
  type RequirementSessionSnapshot,
} from "../../domain/mission/requirement-snapshot";
import {
  findLatestRequirementInstruction,
  findLatestRequirementReply,
  snapshotsContainRestartInstruction,
} from "../../domain/mission/requirement-session";
import {
  inferMissionTopicKey,
  inferRequestTopicKey,
  requestTopicMatchesText,
} from "../../domain/delegation/topic-key";
import {
  isRestartInstructionText,
  isStrategicInstructionText,
} from "../../domain/mission/requirement-topic";
import { isArtifactRequirementTopic } from "./requirement-kind";
import { isInternalAssistantMonologueText, isSyntheticWorkflowPromptText } from "./message-truth";

export type RequirementInstructionCandidate = {
  timestamp: number;
  text: string;
  topicKey: string | null;
  isRestart: boolean;
};

export type RequirementAnchor = RequirementInstructionCandidate & {
  windowStart: number;
};

function inferHandoffTopic(handoff: HandoffRecord): string | null {
  return (
    inferRequestTopicKey([
      handoff.title,
      handoff.summary,
      ...(handoff.checklist ?? []),
      ...(handoff.missingItems ?? []),
      ...(handoff.artifactPaths ?? []),
    ]) ?? null
  );
}

export function extractTopicHints(values: Array<string | null | undefined>): string[] {
  return values
    .map((value) => (typeof value === "string" ? value.trim() : ""))
    .filter((value) => value.length > 0)
    .map((value) => inferRequestTopicKey([value]) ?? value)
    .filter((value, index, array) => array.indexOf(value) === index);
}

export function normalizeRequirementTopicCandidate(
  topicKey: string | null | undefined,
  includeArtifactTopics: boolean,
): string | null {
  if (!topicKey) {
    return null;
  }
  if (!includeArtifactTopics && isArtifactRequirementTopic(topicKey)) {
    return null;
  }
  return topicKey;
}

export function resolveTopicKey(
  requests: RequestRecord[],
  handoffs: HandoffRecord[],
  hints: string[],
): string | null {
  const explicitTopic = hints.find((hint) => hint.startsWith("chapter:") || hint.startsWith("artifact:"));
  if (explicitTopic) {
    return explicitTopic;
  }

  const latestRequest = [...requests]
    .filter((request) => Boolean(request.topicKey))
    .sort((left, right) => right.updatedAt - left.updatedAt)[0];
  if (latestRequest?.topicKey) {
    return latestRequest.topicKey;
  }

  const latestHandoff = [...handoffs]
    .map((handoff) => ({ handoff, topicKey: inferHandoffTopic(handoff) }))
    .filter((item): item is { handoff: HandoffRecord; topicKey: string } => Boolean(item.topicKey))
    .sort((left, right) => right.handoff.updatedAt - left.handoff.updatedAt)[0];
  return latestHandoff?.topicKey ?? null;
}

function collectInstructionCandidates(
  snapshots: RequirementSessionSnapshot[],
  hints: string[],
): RequirementInstructionCandidate[] {
  return snapshots.flatMap((snapshot) =>
    snapshot.messages
      .filter((message) => message.role === "user")
      .map((message) => ({
        timestamp: message.timestamp,
        text: message.text,
        topicKey:
          inferRequestTopicKey([message.text]) ??
          (isStrategicInstructionText(message.text) ? inferMissionTopicKey([message.text]) ?? null : null),
        isRestart: isRestartInstructionText(message.text),
      }))
      .filter((candidate) => {
        if (isSyntheticWorkflowPromptText(candidate.text)) {
          return false;
        }
        if (isInternalAssistantMonologueText(candidate.text)) {
          return false;
        }
        if (candidate.topicKey) {
          return true;
        }
        return hints.some((hint) => hint.length > 0 && candidate.text.includes(hint));
      }),
  );
}

export function resolveTopicKeyFromSnapshots(
  snapshots: RequirementSessionSnapshot[],
  hints: string[],
): string | null {
  const latest = collectInstructionCandidates(snapshots, hints)
    .filter((item): item is RequirementInstructionCandidate & { topicKey: string } => Boolean(item.topicKey))
    .sort((left, right) => {
      if (left.isRestart !== right.isRestart) {
        return Number(right.isRestart) - Number(left.isRestart);
      }
      return right.timestamp - left.timestamp;
    })[0];

  return latest?.topicKey ?? null;
}

export function resolveRequirementAnchor(
  snapshots: RequirementSessionSnapshot[],
  topicKey: string,
  hints: string[],
): RequirementAnchor | null {
  const candidates = collectInstructionCandidates(snapshots, hints)
    .filter((candidate) => {
      if (requestTopicMatchesText(topicKey, candidate.text)) {
        return true;
      }
      return candidate.topicKey === topicKey;
    })
    .sort((left, right) => {
      if (left.isRestart !== right.isRestart) {
        return Number(right.isRestart) - Number(left.isRestart);
      }
      return right.timestamp - left.timestamp;
    });

  const latest = candidates[0];
  if (!latest) {
    return null;
  }
  if (!latest.isRestart) {
    return { ...latest, windowStart: latest.timestamp };
  }
  const restartBurst = candidates.filter(
    (candidate) => candidate.isRestart && latest.timestamp - candidate.timestamp <= 2 * 60_000,
  );
  return {
    ...latest,
    windowStart: Math.min(...restartBurst.map((candidate) => candidate.timestamp)),
  };
}

export function matchesRequestTopic(request: RequestRecord, topicKey: string): boolean {
  return request.topicKey === topicKey;
}

export function matchesHandoffTopic(handoff: HandoffRecord, topicKey: string): boolean {
  return inferHandoffTopic(handoff) === topicKey;
}

export function findLatestRelevantInstruction(
  snapshot: RequirementSessionSnapshot,
  topicKey: string,
  hints: string[],
  minTimestamp = 0,
): RequirementMessageSnapshot | null {
  return findLatestRequirementInstruction(snapshot, {
    minTimestamp,
    ignoreInstruction: (text) =>
      isSyntheticWorkflowPromptText(text) || isInternalAssistantMonologueText(text),
    matchesInstruction: (text) =>
      requestTopicMatchesText(topicKey, text) || hints.some((hint) => hint.length > 0 && text.includes(hint)),
  });
}

export function findLatestReplyAfter(
  snapshot: RequirementSessionSnapshot,
  afterTimestamp: number,
): RequirementMessageSnapshot | null {
  return findLatestRequirementReply(snapshot, afterTimestamp, {
    ignoreReply: (text) =>
      text === "ANNOUNCE_SKIP" || text === "NO_REPLY" || isInternalAssistantMonologueText(text),
  });
}

export function snapshotsMentionRestart(snapshots: RequirementSessionSnapshot[]): boolean {
  return snapshotsContainRestartInstruction(snapshots, {
    isRestartInstruction: isRestartInstructionText,
    ignoreInstruction: (text) =>
      isSyntheticWorkflowPromptText(text) || isInternalAssistantMonologueText(text),
  });
}
