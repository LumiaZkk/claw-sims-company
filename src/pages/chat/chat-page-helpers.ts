import { buildRequirementOverviewTitle, deriveStrategicRequirementTitle } from "../../domain/mission/requirement-topic";
import { parseDraftRequirementSignals } from "../../application/mission/draft-requirement";
import type { ChatMessage } from "../../application/gateway";
import type { ChatDisplayItem } from "./view-models/message-types";
import type { EmployeeRef } from "../../domain/org/types";

export const CHAT_RENDER_WINDOW_STEP = 80;
export const EMPTY_EMPLOYEES: EmployeeRef[] = [];

export function isLowSignalProgressSummary(value: string | null | undefined): boolean {
  const normalized = value?.trim() ?? "";
  if (!normalized) {
    return true;
  }
  return /条结论回传|等待\s*[^，。]{1,16}\s*收口|团队成员已经给出结论反馈|当前主线正在推进|需求团队派单|待确认启动|已经给出反馈|^-{3,}$|---/.test(
    normalized,
  );
}

export function extractChatMessageText(message: ChatMessage | null | undefined): string {
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
          return record.text.trim();
        }
      }
      return "";
    })
    .filter((entry) => entry.length > 0)
    .join("\n")
    .trim();
}

export function normalizeMissionNoteText(text: string): string {
  return text.replace(
    /\*\*(当前理解|当前判断|建议下一步|下一步建议|是否可推进|当前负责人|当前阶段|当前状态|唯一阻塞点)\*\*/gu,
    "$1",
  );
}

export function extractMissionBlocker(text: string | null | undefined): string | null {
  const normalized = normalizeMissionNoteText(text ?? "").replace(/\s+/g, " ").trim();
  if (!normalized) {
    return null;
  }
  const labeledBlocker = normalized.match(
    /(?:唯一阻塞点|当前阻塞)[：:]\s*([\s\S]*?)(?=\s*(?:COO报告明确要求|当前理解|建议下一步|是否可推进|下一步执行计划|交付物清单|$))/u,
  )?.[1];
  const blocker = labeledBlocker?.trim().replace(/[。；;，,]+$/u, "") ?? "";
  if (blocker) {
    return blocker;
  }
  const impliedBlocker = normalized.match(
    /((?:等待|待)CEO[^。；;，,]*账号信息[^。；;，,]*(?:确认|补充))/u,
  )?.[1];
  return impliedBlocker?.trim() ?? null;
}

export function normalizeSingleChatBlocker(
  blocker: string | null | undefined,
  actorLabel: string | null | undefined,
): string | null {
  const normalized = blocker?.trim().replace(/[。；;，,]+$/u, "") ?? "";
  if (!normalized) {
    return null;
  }
  const actorPrefix = actorLabel?.trim() ?? "";
  const withoutActor = actorPrefix
    ? normalized.replace(new RegExp(`^${actorPrefix}\\s*`, "u"), "")
    : normalized;
  const cleaned = withoutActor.replace(/^CEO\s*/u, "").trim();
  if (!cleaned) {
    return null;
  }
  if (/账号信息待确认/u.test(cleaned)) {
    return actorPrefix ? `等待 ${actorPrefix} 确认账号信息` : "等待账号信息确认";
  }
  if (/结构化选项/u.test(cleaned)) {
    return actorPrefix ? `等待 ${actorPrefix} 补发结构化选项` : "等待结构化选项";
  }
  if (cleaned.startsWith("等待")) {
    return cleaned;
  }
  if (/待确认|待补充|待回复/u.test(cleaned)) {
    return `等待${cleaned.replace(/^待/u, "")}`;
  }
  return cleaned;
}

export function buildSingleChatMissionHeadline(input: {
  taskTitle: string | null;
  blocker: string | null;
  step: string | null;
  actorLabel: string | null;
  fallbackHeadline: string;
}): string {
  const taskTitle = input.taskTitle?.trim() ?? "";
  const blocker = normalizeSingleChatBlocker(input.blocker, input.actorLabel);
  const step = input.step?.trim() ?? "";
  if (taskTitle) {
    if (blocker) {
      return `${taskTitle} · ${blocker}`;
    }
    if (step && !isLowSignalProgressSummary(step) && step !== taskTitle) {
      return `${taskTitle} · ${step}`;
    }
    return taskTitle;
  }
  if (blocker) {
    return blocker;
  }
  return input.fallbackHeadline;
}

export function parseInlineMissionNote(text: string): {
  summary: string | null;
  nextAction: string | null;
} | null {
  const normalized = normalizeMissionNoteText(text).trim();
  if (!normalized) {
    return null;
  }
  const summaryMatch = normalized.match(
    /当前理解[：:]\s*([\s\S]*?)(?=\s*(?:建议下一步|下一步建议|是否可推进)[：:]|$)/u,
  );
  const nextActionMatch = normalized.match(
    /(?:建议下一步|下一步建议)[：:]\s*([\s\S]*?)(?=\s*是否可推进[：:]|$)/u,
  );
  const summary = summaryMatch?.[1]?.trim() ?? null;
  const nextAction = nextActionMatch?.[1]?.trim() ?? null;
  if (!summary && !nextAction) {
    return null;
  }
  return {
    summary,
    nextAction,
  };
}

export function findLatestStructuredMissionNote(messages: ChatMessage[]): {
  summary: string | null;
  nextAction: string | null;
  rawText: string;
} | null {
  for (let index = messages.length - 1; index >= 0; index -= 1) {
    const message = messages[index];
    if (message?.role !== "assistant") {
      continue;
    }
    const text = extractChatMessageText(message);
    if (!text) {
      continue;
    }
    const normalizedText = normalizeMissionNoteText(text);
    const parsed = parseDraftRequirementSignals(normalizedText);
    if (parsed.summary || parsed.nextAction) {
      return {
        summary: parsed.summary,
        nextAction: parsed.nextAction,
        rawText: normalizedText,
      };
    }
    const inlineParsed = parseInlineMissionNote(normalizedText);
    if (inlineParsed?.summary || inlineParsed?.nextAction) {
      return {
        summary: inlineParsed.summary,
        nextAction: inlineParsed.nextAction,
        rawText: normalizedText,
      };
    }
  }
  return null;
}

export function findMeaningfulMainlineSummary(
  candidates: Array<string | null | undefined>,
): string | null {
  for (const candidate of candidates) {
    const normalized = candidate?.trim() ?? "";
    if (!normalized || isLowSignalProgressSummary(normalized)) {
      continue;
    }
    return normalized;
  }
  return null;
}

export function isLowSignalMainlineHeadline(value: string | null | undefined): boolean {
  const normalized = value?.trim() ?? "";
  if (!normalized) {
    return true;
  }
  return (
    isLowSignalProgressSummary(normalized) ||
    /^(需求团队房间|需求团队|需求团队:|当前需求|当前战略任务|当前任务|本次需求|主线已绑定|等待同事)$/.test(
      normalized,
    ) ||
    /^等待.+(回复|回执)$/.test(normalized) ||
    /^团队已回复，等待.+收口$/.test(normalized)
  );
}

export function summarizeHeadline(value: string): string {
  return value.length > 30 ? `${value.slice(0, 29).trimEnd()}…` : value;
}

export function looksLikeNarrativeHeadline(value: string): boolean {
  const normalized = value.trim();
  if (!normalized) {
    return false;
  }
  return (
    normalized.length > 22 ||
    /[，。；：,.!?！？]/.test(normalized) ||
    /^(等待|继续|立即|目前|当前|已|正在|收到|请)/.test(normalized)
  );
}

export function normalizeMainlineHeadlineCandidate(input: {
  topicKey: string | null;
  candidate: string;
  summaryCandidates: Array<string | null | undefined>;
}): string {
  const normalized = input.candidate.trim();
  if (!normalized || isLowSignalMainlineHeadline(normalized)) {
    return "";
  }
  const hintPool = [
    normalized,
    ...input.summaryCandidates
      .map((candidate) => candidate?.trim() ?? "")
      .filter((candidate) => candidate.length > 0),
  ];
  const likelyMissionTopic =
    /(^|:)mission(?::|$)/.test(input.topicKey ?? "") ||
    hintPool.some((candidate) =>
      /小说|创作系统|运营评估|技术评估|执行方案|MVP|账号信息|部署|发布渠道/i.test(candidate),
    );
  if (likelyMissionTopic && looksLikeNarrativeHeadline(normalized)) {
    const derivedTitle = deriveStrategicRequirementTitle(hintPool).trim();
    if (
      derivedTitle &&
      derivedTitle !== "当前战略任务" &&
      !isLowSignalMainlineHeadline(derivedTitle) &&
      derivedTitle.length <= normalized.length
    ) {
      return derivedTitle;
    }
  }
  if (input.topicKey?.startsWith("mission:") && looksLikeNarrativeHeadline(normalized)) {
    const derivedTitle = buildRequirementOverviewTitle(input.topicKey, hintPool).trim();
    if (
      derivedTitle &&
      !isLowSignalMainlineHeadline(derivedTitle) &&
      derivedTitle.length <= normalized.length
    ) {
      return derivedTitle;
    }
  }
  return normalized;
}

export function deriveRecentMissionConversationTitle(messages: ChatMessage[]): string | null {
  const recentHints = messages
    .slice(-40)
    .map((message) => extractChatMessageText(message))
    .map((text) => text.trim())
    .filter((text) => text.length > 0);
  if (recentHints.length === 0) {
    return null;
  }
  const derivedTitle = deriveStrategicRequirementTitle(recentHints).trim();
  if (!derivedTitle || derivedTitle === "当前战略任务" || isLowSignalMainlineHeadline(derivedTitle)) {
    return null;
  }
  return derivedTitle;
}

export function extractDisplayItemText(item: ChatDisplayItem): string {
  if (item.kind === "tool") {
    return `${item.title}\n${item.detailContent?.trim() || item.detail}`.trim();
  }
  return item.detailContent?.trim() || extractChatMessageText(item.message);
}

export function findLatestDisplayMissionNote(displayItems: ChatDisplayItem[]): {
  summary: string | null;
  nextAction: string | null;
  rawText: string;
} | null {
  for (let index = displayItems.length - 1; index >= 0; index -= 1) {
    const text = extractDisplayItemText(displayItems[index]!).trim();
    if (!text) {
      continue;
    }
    const normalizedText = normalizeMissionNoteText(text);
    const parsed = parseDraftRequirementSignals(normalizedText);
    if (parsed.summary || parsed.nextAction) {
      return {
        summary: parsed.summary,
        nextAction: parsed.nextAction,
        rawText: normalizedText,
      };
    }
    const inlineParsed = parseInlineMissionNote(normalizedText);
    if (inlineParsed?.summary || inlineParsed?.nextAction) {
      return {
        summary: inlineParsed.summary,
        nextAction: inlineParsed.nextAction,
        rawText: normalizedText,
      };
    }
  }
  return null;
}

export function findMeaningfulMainlineHeadline(input: {
  topicKey: string | null;
  headlineCandidates: Array<string | null | undefined>;
  summaryCandidates: Array<string | null | undefined>;
}): string | null {
  const summary = findMeaningfulMainlineSummary(input.summaryCandidates);
  for (const candidate of input.headlineCandidates) {
    const normalized = candidate?.trim() ?? "";
    if (!normalized) {
      continue;
    }
    const resolvedHeadline = normalizeMainlineHeadlineCandidate({
      topicKey: input.topicKey,
      candidate: normalized,
      summaryCandidates: [summary, ...input.summaryCandidates],
    });
    if (!resolvedHeadline) {
      continue;
    }
    return summarizeHeadline(resolvedHeadline);
  }
  if (!summary) {
    return null;
  }
  const derivedHeadline = buildRequirementOverviewTitle(input.topicKey ?? "mission:", [summary]);
  if (!isLowSignalMainlineHeadline(derivedHeadline)) {
    return summarizeHeadline(derivedHeadline);
  }
  return summarizeHeadline(summary);
}
