const SYNTHETIC_WORKFLOW_PATTERNS = [
  /^现在主线卡在你这里。当前需求：/u,
  /^最新结果已经回传，请你现在直接继续推进。/u,
  /^请优先回复[「“"].+[」”]/u,
  /^请不要停留在状态汇报，直接继续推进当前链路。/u,
  /^需求团队房间《.+》本轮已经收到回执。/u,
  /^先不要直接进入下一阶段。请你基于当前结果/u,
  /^写手、审校、主编都已经完成新版流程。现在不要再汇总现状/u,
  /^重开准备动作已经完成。现在不要再总结现状/u,
  /^现在不要再汇总现状，直接把/u,
];

const INTERNAL_ASSISTANT_MONOLOGUE_PATTERNS = [
  /^\*{0,2}reviewing\s+[a-z0-9_.-]+(?:\.md)?\*{0,2}\b/i,
  /^reviewing\s+[a-z0-9_.-]+(?:\.md)?\b/i,
  /\bi need to review my [a-z0-9_.-]+(?:\.md)?\b/i,
  /\blet me check (?:my identity|the current status|whether|what|which|the workspace)\b/i,
  /\bthe boss is now asking\b/i,
  /\bi need to get back on track\b/i,
  /\bi should not do the actual work myself\b/i,
  /\bi don't handle specific production work myself\b/i,
  /\bmy core value lies in decomposing, directing, and accepting results\b/i,
];

export function stripTruthControlMetadata(text: string): string {
  return text
    .replace(/^Sender \(untrusted metadata\):[\s\S]*?```[\s\S]*?```\s*/i, "")
    .replace(/\bANNOUNCE_SKIP\b/g, "")
    .trim();
}

export function stripTruthTaskTracker(text: string): string {
  return text.replace(/##\s*📋\s*任务追踪[\s\S]*?(?=\n\s*(?:【|##)\s*|$)/i, "").trim();
}

function looksLikeInternalAssistantMonologue(text: string): boolean {
  const normalized = text.replace(/\s+/g, " ").trim();
  if (!normalized) {
    return false;
  }
  return INTERNAL_ASSISTANT_MONOLOGUE_PATTERNS.some((pattern) => pattern.test(normalized));
}

export function stripTruthInternalMonologue(text: string): string {
  const cleaned = stripTruthControlMetadata(text);
  if (!cleaned) {
    return "";
  }

  const markerCandidates = [
    cleaned.indexOf("【当前状态】"),
    cleaned.search(/##\s*📋\s*任务追踪/i),
  ].filter((index) => index > 0);

  const earliestMarker = markerCandidates.length > 0 ? Math.min(...markerCandidates) : -1;
  if (earliestMarker > 0) {
    const prefix = cleaned.slice(0, earliestMarker).trim();
    if (looksLikeInternalAssistantMonologue(prefix)) {
      return cleaned.slice(earliestMarker).trim();
    }
  }

  return looksLikeInternalAssistantMonologue(cleaned) ? "" : cleaned.trim();
}

export function normalizeTruthText(text: string): string {
  return stripTruthTaskTracker(stripTruthInternalMonologue(text))
    .replace(/\s+/g, " ")
    .trim();
}

export function isInternalAssistantMonologueText(text: string): boolean {
  const cleaned = stripTruthControlMetadata(text);
  if (!cleaned) {
    return false;
  }
  return stripTruthInternalMonologue(cleaned).length === 0;
}

export function isSyntheticWorkflowPromptText(text: string): boolean {
  const normalized = normalizeTruthText(text);
  if (!normalized) {
    return false;
  }
  return SYNTHETIC_WORKFLOW_PATTERNS.some((pattern) => pattern.test(normalized));
}
