export type RequestTransport = "company_report" | "sessions_send" | "inferred";

const ACK_PATTERNS = [
  /收到/i,
  /已收到/i,
  /明白/i,
  /了解/i,
  /开始处理/i,
  /处理中/i,
  /已接手/i,
  /已开始/i,
  /立即执行/i,
  /待命/i,
];

const COMPLETE_PATTERNS = [
  /已完成/i,
  /完成交付/i,
  /任务完成/i,
  /交付完成/i,
  /方案如下/i,
  /详细报告/i,
  /完整报告/i,
  /已提交.*方案/i,
  /已产出.*方案/i,
  /汇总如下/i,
  /处理完毕/i,
  /发布成功/i,
  /审校报告/i,
  /review result/i,
  /标准是否就位/i,
  /检查重点是否明确/i,
];

const PARTIAL_PATTERNS = [/已更新/i, /已产出/i, /已提交/i, /已补充/i, /已处理/i];
const START_PATTERNS = [/是否已开始/i, /预计交稿时间/i, /新稿文件路径/i, /立即开始/i];
const BLOCKED_PATTERNS = [
  /人工接管/i,
  /手动接管/i,
  /manual takeover/i,
  /请(?:你|用户).{0,8}(?:执行|处理|发布|接管)/i,
  /\btimeout\b/i,
  /超时/i,
  /失联/i,
  /无响应/i,
  /缺失项/i,
  /未回复/i,
  /工具.*失败/i,
  /配置问题/i,
];

const PLACEHOLDER_PATTERNS = [
  /^任务$/i,
  /^---+$/,
  /^\{$/,
  /^\|?\s*优先级\s*\|/i,
  /^\[company_report:(?:acknowledged|answered|blocked)\]/i,
];

const BRIDGE_PATTERNS = [
  /任务已派发完成/i,
  /让我更新任务看板/i,
  /让我为您重新整理完整的汇总报告/i,
  /我看到任务看板显示/i,
  /收到！.*已完成汇报/i,
  /当前任务总览/i,
];

const FILE_OR_LINK_PATTERN =
  /(?:\/(?:Users|tmp|var|home)\/[^\s`"'|]+|(?:\.{1,2}\/)[^\s`"'|]+|https?:\/\/[^\s`"'|]+|\b[^\s`"'|]+\.(?:md|txt|json|csv|pdf)\b)/i;

function nonEmptyLines(text: string): string[] {
  return text
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean);
}

export function summarizeReportText(text: string): string {
  return (
    nonEmptyLines(text).find((line) => line.length > 0 && line.length <= 160) ??
    text.trim().slice(0, 160)
  );
}

export function hasReportPattern(text: string, patterns: RegExp[]): boolean {
  return patterns.some((pattern) => pattern.test(text));
}

export function countChecklistConfirmations(text: string): number {
  return [...text.matchAll(/是否[^:\n]{0,48}[:：]\s*(?:\*\*)?(?:是|否)/gi)].length;
}

export function isPlaceholderOrBridgeText(text: string): boolean {
  const trimmed = text.trim();
  if (!trimmed) {
    return true;
  }
  const lines = nonEmptyLines(trimmed);
  const firstLine = lines[0] ?? trimmed;
  if (PLACEHOLDER_PATTERNS.some((pattern) => pattern.test(trimmed) || pattern.test(firstLine))) {
    return true;
  }
  return BRIDGE_PATTERNS.some((pattern) => pattern.test(trimmed));
}

export function looksLikeStructuredDeliverable(text: string): boolean {
  const trimmed = text.trim();
  if (!trimmed || isPlaceholderOrBridgeText(trimmed)) {
    return false;
  }
  if (trimmed.length >= 160) {
    return true;
  }
  if (/(^|\n)#{1,4}\s+/.test(trimmed)) {
    return true;
  }
  if (/(^|\n)(?:[-*]\s+|\d+\.\s+)/.test(trimmed)) {
    return true;
  }
  if (/(^|\n)\|.+\|/.test(trimmed)) {
    return true;
  }
  return FILE_OR_LINK_PATTERN.test(trimmed);
}

export function isFormalAnswerText(text: string): boolean {
  if (!text.trim() || isPlaceholderOrBridgeText(text) || hasReportPattern(text, START_PATTERNS)) {
    return false;
  }
  if (countChecklistConfirmations(text) >= 2) {
    return true;
  }
  if (hasReportPattern(text, COMPLETE_PATTERNS)) {
    return true;
  }
  return hasReportPattern(text, PARTIAL_PATTERNS) && looksLikeStructuredDeliverable(text);
}

export function isFormalBlockedText(text: string): boolean {
  return !isPlaceholderOrBridgeText(text) && hasReportPattern(text, BLOCKED_PATTERNS);
}

export function isFormalAckText(text: string): boolean {
  if (!text.trim() || isPlaceholderOrBridgeText(text)) {
    return false;
  }
  if (isFormalAnswerText(text) || isFormalBlockedText(text)) {
    return false;
  }
  return hasReportPattern(text, ACK_PATTERNS) || hasReportPattern(text, START_PATTERNS);
}

export function inferReportTransport(text: string): RequestTransport {
  if (/sessions?_send/i.test(text)) {
    return "sessions_send";
  }
  if (/company[_\s-]?report/i.test(text) || /\[company_report:/i.test(text)) {
    return "company_report";
  }
  return "inferred";
}

export function extractDeliverableHeading(text: string): string | undefined {
  const lines = nonEmptyLines(text);
  return lines.find((line) => {
    const normalized = line.replace(/^#+\s*/, "").replace(/^[\p{Emoji_Presentation}\p{Extended_Pictographic}\s]+/gu, "");
    return normalized.length >= 4 && normalized.length <= 48 && /方案|策略|规划|汇总|总览|架构|建议|报告/i.test(normalized);
  });
}

export function inferReportTextStatus(text: string): "acknowledged" | "answered" | "blocked" | null {
  if (isFormalBlockedText(text)) {
    return "blocked";
  }
  if (isFormalAnswerText(text)) {
    return "answered";
  }
  if (isFormalAckText(text)) {
    return "acknowledged";
  }
  return null;
}
