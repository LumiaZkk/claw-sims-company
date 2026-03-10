import type { Company, HandoffRecord, RequestRecord } from "../../domain";
import {
  countRequirementChecklistConfirmations,
  extractRequirementArtifactPath,
  findRequirementArtifactCheck,
  type RequirementSessionSnapshot,
} from "../../domain/mission/requirement-snapshot";
import {
  formatParticipantElapsedMinutes,
  isParticipantCompletedLike,
  resolveAcknowledgedParticipantStatus,
  resolveAnsweredParticipantStatus,
  resolveBlockedParticipantStatus,
  resolvePendingParticipantStatus,
} from "../../domain/mission/participant-progress";
import { formatAgentLabel, formatAgentRole } from "../governance/focus-summary";
import { extractRequirementTitleFromInstruction, summarizeRequirementText } from "../../domain/mission/requirement-topic";
import type {
  RequirementExecutionOverview,
  RequirementParticipantProgress,
  RequirementParticipantTone,
} from "./requirement-overview-types";
import {
  findLatestRelevantInstruction,
  findLatestReplyAfter,
  type RequirementAnchor,
} from "./requirement-window";

export function orderParticipants(
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

function summarizeRoleAction(
  role: string,
  statusLabel: string,
  instructionText: string,
  topicKey: string,
): string {
  const isChapterTopic = topicKey.startsWith("chapter:");
  if (isChapterTopic && /主笔|写手/i.test(role)) {
    if (statusLabel === "已交付待下游") {
      return "新版纯正文已交付";
    }
    return "写手重写纯正文";
  }
  if (isChapterTopic && /审校/i.test(role)) {
    return statusLabel === "已就绪待稿" ? "等待新版初稿" : "审校检查纯正文";
  }
  if (isChapterTopic && /主编|质量总监|终审/i.test(role)) {
    return "旧稿作废与终审口径重置";
  }
  if (isChapterTopic && /CTO|技术/i.test(role)) {
    return "发布冻结待命";
  }

  const title = extractRequirementTitleFromInstruction(instructionText);
  if (title) {
    return title.replace(/^[^｜]+｜/, "").trim() || title;
  }
  return "当前步骤";
}

export function resolveSnapshotParticipant(input: {
  company: Company;
  snapshot: RequirementSessionSnapshot;
  topicKey: string;
  hints: string[];
  now: number;
  anchor: RequirementAnchor | null;
}): RequirementParticipantProgress | null {
  const employee = input.company.employees.find((item) => item.agentId === input.snapshot.agentId);
  if (!employee || employee.metaRole === "ceo") {
    return null;
  }

  const instruction = findLatestRelevantInstruction(
    input.snapshot,
    input.topicKey,
    input.hints,
    input.anchor?.windowStart ?? 0,
  );
  if (!instruction) {
    return null;
  }
  const reply = findLatestReplyAfter(input.snapshot, instruction.timestamp);
  const nickname = formatAgentLabel(input.company, input.snapshot.agentId);
  const role = formatAgentRole(input.company, input.snapshot.agentId) ?? "当前节点";
  const updatedAt = reply?.timestamp ?? instruction.timestamp;

  if (!reply) {
    const stale = input.now - instruction.timestamp >= 15 * 60_000;
    return {
      agentId: input.snapshot.agentId,
      nickname,
      role,
      stage: summarizeRoleAction(role, stale ? "未回复" : "待回复", instruction.text, input.topicKey),
      statusLabel: stale ? "未回复" : "待回复",
      detail: stale
        ? `${formatParticipantElapsedMinutes(instruction.timestamp, input.now)} 仍未确认这一步。`
        : "这一步已发出，正在等待确认。",
      updatedAt,
      tone: stale ? "rose" : "amber",
      isBlocking: stale,
      isCurrent: false,
    };
  }

  const replyText = reply.text;
  const artifactPath = extractRequirementArtifactPath(replyText);
  const artifactCheck = findRequirementArtifactCheck(input.snapshot, artifactPath);
  const hasChecklistConfirmation = countRequirementChecklistConfirmations(replyText) >= 2;
  const isChapterTopic = input.topicKey.startsWith("chapter:");

  if (/失败|未成功|阻塞|超时|无法|没法|缺失/i.test(replyText)) {
    return {
      agentId: input.snapshot.agentId,
      nickname,
      role,
      stage: summarizeRoleAction(role, "已阻塞", instruction.text, input.topicKey),
      statusLabel: "已阻塞",
      detail: summarizeRequirementText(replyText, 160),
      updatedAt,
      tone: "rose",
      isBlocking: true,
      isCurrent: false,
    };
  }

  if (isChapterTopic && /等待新稿|等待新版|等待新指令|待命/i.test(replyText)) {
    const frozen = /冻结|发布/.test(replyText);
    return {
      agentId: input.snapshot.agentId,
      nickname,
      role,
      stage: summarizeRoleAction(
        role,
        frozen ? "已冻结待命" : "已就绪待稿",
        instruction.text,
        input.topicKey,
      ),
      statusLabel: frozen ? "已冻结待命" : "已就绪待稿",
      detail: frozen
        ? "旧链路已冻结，当前只等待新的终审通过指令。"
        : summarizeRequirementText(replyText, 140),
      updatedAt,
      tone: "emerald",
      isBlocking: false,
      isCurrent: false,
    };
  }

  if (/已开始|立即执行|开始写作|预计交稿时间|新稿文件路径|30 分钟内|开始处理/i.test(replyText)) {
    const stale = input.now - reply.timestamp >= 10 * 60_000;
    const fileName = artifactPath?.split("/").pop() ?? null;
    const artifactDetail =
      artifactPath && artifactCheck?.exists === false
        ? `已经承诺交付 ${fileName ?? "新稿"}，但系统还没看到这个文件，当前仍没有新的正文交付。`
        : artifactPath && artifactCheck?.exists === true
          ? `新稿 ${fileName ?? "文件"} 已存在，等待下一棒接手。`
          : null;
    const statusLabel = artifactCheck?.exists === true ? "已交付待下游" : stale ? "已开工未交付" : "已开工";
    return {
      agentId: input.snapshot.agentId,
      nickname,
      role,
      stage: summarizeRoleAction(role, statusLabel, instruction.text, input.topicKey),
      statusLabel,
      detail:
        artifactDetail ??
        (stale
          ? `${summarizeRequirementText(replyText, 120)}；但 ${formatParticipantElapsedMinutes(reply.timestamp, input.now)} 还没看到新的交付结果。`
          : summarizeRequirementText(replyText, 140)),
      updatedAt,
      tone: artifactCheck?.exists === true ? "emerald" : stale ? "amber" : "blue",
      isBlocking: artifactCheck?.exists !== true && stale,
      isCurrent: false,
    };
  }

  if (
    /纯正文已交付|已交付|交稿完成|审校报告|审校完成|终审复核完成|终审完成|可归档|可进入发布流程|准予发布|待主编终审|待终审|待发布|技术方案|实现方案|阅读系统|建议方案|方案如下|已整理方案|已输出方案|阶段总结/i.test(
      replyText,
    )
  ) {
    const statusLabel = /纯正文已交付|已交付|交稿完成|待主编终审|待终审/i.test(replyText)
      ? "已交付待下游"
      : "已确认";
    return {
      agentId: input.snapshot.agentId,
      nickname,
      role,
      stage: summarizeRoleAction(role, statusLabel, instruction.text, input.topicKey),
      statusLabel,
      detail: summarizeRequirementText(replyText, 160),
      updatedAt,
      tone: "emerald",
      isBlocking: false,
      isCurrent: false,
    };
  }

  if ((isChapterTopic && /作废|就位|检查重点|纯正文|已明确|标准/i.test(replyText)) || hasChecklistConfirmation) {
    const frozen = /冻结/i.test(replyText);
    return {
      agentId: input.snapshot.agentId,
      nickname,
      role,
      stage: summarizeRoleAction(role, frozen ? "已冻结待命" : "已确认", instruction.text, input.topicKey),
      statusLabel: frozen ? "已冻结待命" : "已确认",
      detail: summarizeRequirementText(replyText, 140),
      updatedAt,
      tone: "emerald",
      isBlocking: false,
      isCurrent: false,
    };
  }

  return {
    agentId: input.snapshot.agentId,
    nickname,
    role,
    stage: summarizeRoleAction(role, "已回复", instruction.text, input.topicKey),
    statusLabel: "已回复",
    detail: summarizeRequirementText(replyText, 140),
    updatedAt,
    tone: "violet",
    isBlocking: false,
    isCurrent: false,
  };
}

export function buildRequestParticipantProgress(
  company: Company,
  agentId: string,
  request: RequestRecord | null,
  handoff: HandoffRecord | null,
  now: number,
): RequirementParticipantProgress {
  const nickname = formatAgentLabel(company, agentId);
  const role = formatAgentRole(company, agentId) ?? "当前节点";
  const requestTimestamp = request?.updatedAt ?? 0;
  const handoffTimestamp = handoff?.updatedAt ?? 0;
  const updatedAt = Math.max(requestTimestamp, handoffTimestamp);
  const stage = request?.title ?? handoff?.title ?? "当前步骤";

  let statusLabel = "未接入";
  let detail = request?.summary ?? handoff?.summary ?? "当前还没有新的执行记录。";
  let tone: RequirementParticipantTone = "slate";
  let isBlocking = false;

  if (request?.status === "blocked") {
    ({ statusLabel, detail, tone, isBlocking } = resolveBlockedParticipantStatus(request));
  } else if (request?.status === "pending") {
    ({ statusLabel, detail, tone, isBlocking } = resolvePendingParticipantStatus(request, now));
  } else if (request?.status === "acknowledged") {
    ({ statusLabel, detail, tone, isBlocking } = resolveAcknowledgedParticipantStatus(request, now));
  } else if (request?.status === "answered") {
    ({ statusLabel, detail, tone, isBlocking } = resolveAnsweredParticipantStatus(request));
  } else if (handoff) {
    if (handoff.status === "blocked") {
      statusLabel = "交接阻塞";
      detail = handoff.missingItems?.[0] ?? handoff.summary;
      tone = "rose";
      isBlocking = true;
    } else if (handoff.status === "acknowledged") {
      statusLabel = "已接手";
      detail = handoff.summary;
      tone = "violet";
    } else if (handoff.status === "pending") {
      statusLabel = "待接手";
      detail = handoff.summary;
      tone = "amber";
    } else {
      statusLabel = "已交接";
      detail = handoff.summary;
      tone = "emerald";
    }
  }

  return {
    agentId,
    nickname,
    role,
    stage,
    statusLabel,
    detail,
    updatedAt,
    tone,
    isBlocking,
    isCurrent: false,
  };
}

function participantMatchesRole(
  participant: RequirementParticipantProgress,
  pattern: RegExp,
): boolean {
  return pattern.test(`${participant.role} ${participant.nickname}`);
}

export function buildDispatchCoordinatorOverview(input: {
  company: Company;
  topicKey: string;
  title: string;
  startedAt: number;
  participants: RequirementParticipantProgress[];
}): RequirementExecutionOverview | null {
  const { company, topicKey, title, startedAt, participants } = input;
  const ceo = company.employees.find((employee) => employee.metaRole === "ceo");
  if (!ceo) {
    return null;
  }

  const techParticipant =
    participants.find((participant) => participantMatchesRole(participant, /CTO|技术/i)) ?? null;
  if (!techParticipant || techParticipant.statusLabel !== "已冻结待命") {
    return null;
  }

  const coreParticipants = participants.filter((participant) =>
    participantMatchesRole(participant, /主笔|写手|审校|主编|质量总监|终审/i),
  );
  if (coreParticipants.length < 2 || !coreParticipants.every((participant) => isParticipantCompletedLike(participant.statusLabel))) {
    return null;
  }

  const ceoLabel = formatAgentLabel(company, ceo.agentId);
  const ceoRole = formatAgentRole(company, ceo.agentId) ?? "CEO";
  const syntheticCurrent: RequirementParticipantProgress = {
    agentId: ceo.agentId,
    nickname: ceoLabel,
    role: ceoRole,
    stage: "向 CTO 下发新版发布指令",
    statusLabel: "待派发",
    detail: "写手、审校、主编都已经完成本轮，当前只差 CEO 把新版终审通过结果正式转给 CTO。",
    updatedAt: Math.max(...participants.map((participant) => participant.updatedAt)),
    tone: "amber",
    isBlocking: true,
    isCurrent: true,
  };

  return {
    topicKey,
    title,
    startedAt,
    headline: "当前卡点在 CEO",
    summary: syntheticCurrent.detail,
    currentOwnerAgentId: ceo.agentId,
    currentOwnerLabel: ceoLabel,
    currentStage: syntheticCurrent.stage,
    nextAction: "现在通知 CTO 立即发布新版第 2 章，并要求他回传是否成功、发布链接和审核状态。",
    participants: [
      syntheticCurrent,
      ...participants.map((participant) => ({
        ...participant,
        isCurrent: false,
      })),
    ],
  };
}
