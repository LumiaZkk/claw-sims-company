import type { Company } from "../../domain";
import {
  deriveStrategicRequirementTitle,
  isStrategicInstructionText,
  summarizeRequirementText as summarizeText,
} from "../../domain/mission/requirement-topic";
import { formatParticipantElapsedMinutes as formatElapsedMinutes } from "../../domain/mission/participant-progress";
import { findLatestRequirementReply } from "../../domain/mission/requirement-session";
import type { RequirementSessionSnapshot } from "../../domain/mission/requirement-snapshot";
import { inferMissionTopicKey, inferRequestTopicKey } from "../delegation/request-topic";
import { formatAgentLabel, formatAgentRole } from "../governance/focus-summary";
import {
  isInternalAssistantMonologueText,
  isSyntheticWorkflowPromptText,
} from "./message-truth";
import { buildStableStrategicTopicKey } from "./work-item";
import type {
  RequirementExecutionOverview,
  RequirementParticipantProgress,
} from "./requirement-overview-types";

type TrackerStepStatus = "done" | "wip" | "pending";

type TrackedDelegationStep = {
  title: string;
  status: TrackerStepStatus;
  assigneeAgentId: string | null;
  assigneeLabel: string;
};

type TrackedDelegationSeed = {
  title: string;
  topicKey: string;
  startedAt: number;
  userText: string;
  assistantText: string;
  steps: TrackedDelegationStep[];
};

function prefersTitleDerivedStrategicTopicKey(input: {
  preferredTopicKey?: string | null;
  title?: string | null;
  texts: Array<string | null | undefined>;
}): boolean {
  const preferredTopicKey = input.preferredTopicKey?.trim() ?? "";
  if (!preferredTopicKey.startsWith("mission:")) {
    return false;
  }

  const titleDerivedTopicKey = buildStableStrategicTopicKey({
    title: input.title,
  });
  if (!titleDerivedTopicKey || titleDerivedTopicKey === preferredTopicKey) {
    return false;
  }

  const corpus = input.texts
    .filter((value): value is string => typeof value === "string" && value.trim().length > 0)
    .join("\n");
  const normalizedTitle = input.title?.trim() ?? "";
  const hasTeamBootstrapSignals =
    /从头开始搭建\s*AI\s*小说创作团队|从头开始搭建小说创作团队|创作团队|组织架构|招聘JD|兼任方案|世界观架构师|伏笔管理员|去AI味专员|招聘|岗位|搭建.*团队|团队搭建|班底|质量提升专项|质量提升/i.test(
      `${normalizedTitle}\n${corpus}`,
    ) && /小说|网文|创作/i.test(`${normalizedTitle}\n${corpus}`);

  return hasTeamBootstrapSignals;
}

function normalizeLookupValue(value: string): string {
  return value.replace(/[@`*_：:（）()\-\s]/g, "").trim().toLowerCase();
}

function resolveTrackerAssignee(
  company: Company,
  rawLabel: string,
  fallbackText?: string,
): { agentId: string | null; label: string } {
  const cleanedLabel = rawLabel.replace(/^@/, "").trim();
  const normalized = normalizeLookupValue(cleanedLabel);
  const normalizedFallback = normalizeLookupValue(fallbackText ?? "");
  const candidates = company.employees.map((employee) => ({
    employee,
    values: [
      employee.agentId,
      employee.nickname,
      employee.role,
      employee.metaRole ?? "",
      `${employee.nickname}${employee.role}`,
    ].map(normalizeLookupValue),
  }));

  const exact = candidates.find((candidate) =>
    candidate.values.some((value) => value.length > 0 && value === normalized),
  );
  if (exact) {
    return {
      agentId: exact.employee.agentId,
      label: formatAgentLabel(company, exact.employee.agentId),
    };
  }

  const includes = candidates.find((candidate) =>
    candidate.values.some(
      (value) =>
        value.length > 0 &&
        (value.includes(normalized) ||
          normalized.includes(value) ||
          (normalizedFallback.length > 0 &&
            (normalizedFallback.includes(value) || value.includes(normalizedFallback)))),
    ),
  );
  if (includes) {
    return {
      agentId: includes.employee.agentId,
      label: formatAgentLabel(company, includes.employee.agentId),
    };
  }

  return { agentId: null, label: cleanedLabel || "未分配" };
}

function extractTrackerSteps(company: Company, text: string): TrackedDelegationStep[] {
  const sectionMatch = text.match(/##\s*📋\s*任务追踪[\s\S]*?(?=\n\s*(?:【|##)\s*|$)/i);
  if (!sectionMatch) {
    return [];
  }

  const steps: TrackedDelegationStep[] = [];
  const lineRegex = /^\s*(?:-\s*)?\[([ x/])\]\s*(.+)$/gm;
  let match: RegExpExecArray | null;

  while ((match = lineRegex.exec(sectionMatch[0])) !== null) {
    const marker = match[1];
    const rawText = match[2]?.trim() ?? "";
    if (!rawText) {
      continue;
    }

    const status: TrackerStepStatus = marker === "x" ? "done" : marker === "/" ? "wip" : "pending";
    const assigneeMatch = rawText.match(/[→>-]\s*@?([^\n]+)$/);
    const fallbackAssignee =
      !assigneeMatch && /\bCEO\b/i.test(rawText)
        ? "CEO"
        : !assigneeMatch && /\bCTO\b/i.test(rawText)
          ? "CTO"
          : !assigneeMatch && /\bCOO\b/i.test(rawText)
            ? "COO"
            : "";
    const rawAssignee = assigneeMatch?.[1]?.trim() ?? fallbackAssignee;
    const resolved = rawAssignee
      ? resolveTrackerAssignee(company, rawAssignee, rawText)
      : { agentId: null, label: "未分配" };

    steps.push({
      title: rawText.replace(/\s*[→>-]\s*@?[^\n]+$/, "").trim(),
      status,
      assigneeAgentId: resolved.agentId,
      assigneeLabel: resolved.label,
    });
  }

  return steps;
}

function findLatestTrackedDelegationSeed(
  company: Company,
  snapshots: RequirementSessionSnapshot[],
  options?: {
    preferredTopicKey?: string | null;
    preferredTopicText?: string | null;
    preferredTopicTimestamp?: number | null;
  },
): TrackedDelegationSeed | null {
  const ceo = company.employees.find((employee) => employee.metaRole === "ceo");
  if (!ceo) {
    return null;
  }

  const ceoSnapshot = snapshots.find((snapshot) => snapshot.agentId === ceo.agentId);
  if (!ceoSnapshot || ceoSnapshot.messages.length === 0) {
    return null;
  }

  for (let index = ceoSnapshot.messages.length - 1; index >= 0; index -= 1) {
    const assistantMessage = ceoSnapshot.messages[index];
    if (assistantMessage.role !== "assistant" || !assistantMessage.text.includes("## 📋 任务追踪")) {
      continue;
    }

    const steps = extractTrackerSteps(company, assistantMessage.text);
    if (steps.length === 0) {
      continue;
    }

    const latestUser = [...ceoSnapshot.messages.slice(0, index)]
      .reverse()
      .find(
        (message) =>
          message.role === "user" &&
          message.text.trim().length > 12 &&
          !isSyntheticWorkflowPromptText(message.text) &&
          !isInternalAssistantMonologueText(message.text) &&
          !inferRequestTopicKey([message.text]) &&
          isStrategicInstructionText(message.text),
      );
    const fallbackTopicKey =
      options?.preferredTopicKey && options.preferredTopicKey.startsWith("mission:")
        ? options.preferredTopicKey
        : null;
    const fallbackTopicText = options?.preferredTopicText?.trim() || null;
    const strategicTexts = [
      latestUser?.text ?? fallbackTopicText,
      assistantMessage.text,
      ...steps.map((step) => step.title),
    ];
    const title = deriveStrategicRequirementTitle(strategicTexts);
    const preferredTopicKey = prefersTitleDerivedStrategicTopicKey({
      preferredTopicKey: fallbackTopicKey,
      title,
      texts: strategicTexts,
    })
      ? null
      : fallbackTopicKey;
    const stableTopicKey = buildStableStrategicTopicKey({
      topicKey:
        preferredTopicKey ??
        inferMissionTopicKey([
          latestUser?.text ?? fallbackTopicText,
          assistantMessage.text,
          ...steps.map((step) => step.title),
        ]),
      title,
    });
    if (!stableTopicKey) {
      continue;
    }

    return {
      title,
      topicKey: stableTopicKey,
      startedAt: latestUser?.timestamp ?? options?.preferredTopicTimestamp ?? assistantMessage.timestamp,
      userText: latestUser?.text ?? fallbackTopicText ?? title,
      assistantText: assistantMessage.text,
      steps,
    };
  }

  return null;
}

function orderTrackedDelegationParticipants(
  company: Company,
  participants: RequirementParticipantProgress[],
): RequirementParticipantProgress[] {
  const employeeOrder = new Map(company.employees.map((employee, index) => [employee.agentId, index]));
  return [...participants].sort((left, right) => {
    const leftIndex = employeeOrder.get(left.agentId) ?? Number.MAX_SAFE_INTEGER;
    const rightIndex = employeeOrder.get(right.agentId) ?? Number.MAX_SAFE_INTEGER;
    if (leftIndex !== rightIndex) {
      return leftIndex - rightIndex;
    }
    return right.updatedAt - left.updatedAt;
  });
}

function buildTrackedDelegationParticipant(
  company: Company,
  snapshot: RequirementSessionSnapshot | undefined,
  step: TrackedDelegationStep,
  afterTimestamp: number,
  now: number,
): RequirementParticipantProgress {
  const agentId = step.assigneeAgentId ?? `unknown:${step.assigneeLabel}`;
  const nickname = step.assigneeAgentId ? formatAgentLabel(company, step.assigneeAgentId) : step.assigneeLabel;
  const role = step.assigneeAgentId ? formatAgentRole(company, step.assigneeAgentId) ?? "当前节点" : "当前节点";
  const reply = snapshot
    ? findLatestRequirementReply(snapshot, afterTimestamp, {
        ignoreReply: (text) =>
          text === "ANNOUNCE_SKIP" || text === "NO_REPLY" || isInternalAssistantMonologueText(text),
      })
    : null;

  if (!reply) {
    const stale = now - afterTimestamp >= 15 * 60_000;
    return {
      agentId,
      nickname,
      role,
      stage: step.title,
      statusLabel: stale ? "未回复" : "待回复",
      detail: stale ? `${formatElapsedMinutes(afterTimestamp, now)} 仍未回传这一步。` : "这一步已派发，正在等待回传。",
      updatedAt: afterTimestamp,
      tone: stale ? "rose" : "amber",
      isBlocking: stale,
      isCurrent: false,
    };
  }

  const replyText = reply.text.trim();
  const looksLikeStrategicReply =
    /极简结论|核心问题|优先级|最小闭环|分期建议|技术架构|规则层|状态机|模板系统|校验器|渲染协议|验收机制|建议|方案|Phase/i.test(
      replyText,
    ) || replyText.length >= 180;
  if (looksLikeStrategicReply) {
    return {
      agentId,
      nickname,
      role,
      stage: step.title,
      statusLabel: "已回复",
      detail: summarizeText(replyText, 160),
      updatedAt: reply.timestamp,
      tone: "emerald",
      isBlocking: false,
      isCurrent: false,
    };
  }

  if (/失败|阻塞|无法|没法|超时|缺失/i.test(replyText)) {
    return {
      agentId,
      nickname,
      role,
      stage: step.title,
      statusLabel: "已阻塞",
      detail: summarizeText(replyText, 160),
      updatedAt: reply.timestamp,
      tone: "rose",
      isBlocking: true,
      isCurrent: false,
    };
  }

  return {
    agentId,
    nickname,
    role,
    stage: step.title,
    statusLabel: "已回复",
    detail: summarizeText(replyText, 160),
    updatedAt: reply.timestamp,
    tone: "emerald",
    isBlocking: false,
    isCurrent: false,
  };
}

export function buildTrackedDelegationOverview(input: {
  company: Company;
  snapshots: RequirementSessionSnapshot[];
  now: number;
  preferredTopicKey?: string | null;
  preferredTopicText?: string | null;
  preferredTopicTimestamp?: number | null;
}): RequirementExecutionOverview | null {
  const seed = findLatestTrackedDelegationSeed(input.company, input.snapshots, {
    preferredTopicKey: input.preferredTopicKey ?? null,
    preferredTopicText: input.preferredTopicText ?? null,
    preferredTopicTimestamp: input.preferredTopicTimestamp ?? null,
  });
  if (!seed) {
    return null;
  }

  const ceo = input.company.employees.find((employee) => employee.metaRole === "ceo");
  if (!ceo) {
    return null;
  }

  const participantMap = new Map<string, RequirementParticipantProgress>();
  for (const step of seed.steps) {
    if (!step.assigneeAgentId || step.assigneeAgentId === ceo.agentId) {
      continue;
    }
    const snapshot = input.snapshots.find((item) => item.agentId === step.assigneeAgentId);
    participantMap.set(
      step.assigneeAgentId,
      buildTrackedDelegationParticipant(input.company, snapshot, step, seed.startedAt, input.now),
    );
  }

  const participants = orderTrackedDelegationParticipants(input.company, [...participantMap.values()]);
  const pendingParticipants = participants.filter((participant) => participant.statusLabel !== "已回复");
  const repliedLabels = participants
    .filter((participant) => participant.statusLabel === "已回复")
    .map((participant) => participant.nickname);
  const pendingLabels = pendingParticipants.map((participant) => participant.nickname);
  const ceoLabel = formatAgentLabel(input.company, ceo.agentId);

  const ceoParticipant: RequirementParticipantProgress = {
    agentId: ceo.agentId,
    nickname: ceoLabel,
    role: formatAgentRole(input.company, ceo.agentId) ?? "CEO",
    stage:
      pendingParticipants.length > 0
        ? `等待 ${pendingLabels.join("、")} 回传`
        : "整合团队方案并交付老板",
    statusLabel: pendingParticipants.length > 0 ? "待收口" : "待整合",
    detail:
      pendingParticipants.length > 0
        ? repliedLabels.length > 0
          ? `${repliedLabels.join("、")} 已回传，当前仍在等 ${pendingLabels.join("、")}。`
          : `当前已派发给 ${pendingLabels.join("、")}，等待他们回传。`
        : repliedLabels.length > 0
          ? `${repliedLabels.join("、")} 已回传，等待 CEO 整理成最终执行方案。`
          : "团队分工已生成，等待 CEO 继续推进。",
    updatedAt: Math.max(seed.startedAt, ...participants.map((participant) => participant.updatedAt)),
    tone: pendingParticipants.length > 0 ? "amber" : "blue",
    isBlocking: false,
    isCurrent: true,
  };

  return {
    topicKey: seed.topicKey,
    title: seed.title,
    startedAt: seed.startedAt,
    headline: pendingParticipants.length > 0 ? "CEO 正在收集团队回传" : "当前卡点在 CEO",
    summary: ceoParticipant.detail,
    currentOwnerAgentId: ceo.agentId,
    currentOwnerLabel: ceoLabel,
    currentStage: ceoParticipant.stage,
    nextAction:
      pendingParticipants.length > 0
        ? `优先催 ${pendingLabels.join("、")} 回传结果，然后让 CEO 汇总。`
        : "现在让 CEO 整合团队方案，给出最终优先级和执行提案。",
    participants: [ceoParticipant, ...participants],
  };
}
