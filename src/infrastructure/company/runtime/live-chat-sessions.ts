export type LiveChatSessionState = {
  sessionKey: string;
  agentId?: string | null;
  runId?: string | null;
  streamText?: string | null;
  isGenerating: boolean;
  startedAt: number;
  updatedAt: number;
};

const liveChatSessionsByCompany = new Map<string, Record<string, LiveChatSessionState>>();

function normalizeId(value: string | null | undefined): string | null {
  const normalized = value?.trim();
  return normalized && normalized.length > 0 ? normalized : null;
}

export function readLiveChatSession(
  companyId: string | null | undefined,
  sessionKey: string | null | undefined,
): LiveChatSessionState | null {
  const normalizedCompanyId = normalizeId(companyId);
  const normalizedSessionKey = normalizeId(sessionKey);
  if (!normalizedCompanyId || !normalizedSessionKey) {
    return null;
  }
  return liveChatSessionsByCompany.get(normalizedCompanyId)?.[normalizedSessionKey] ?? null;
}

export function upsertLiveChatSession(
  companyId: string | null | undefined,
  sessionKey: string | null | undefined,
  state: LiveChatSessionState,
): LiveChatSessionState | null {
  const normalizedCompanyId = normalizeId(companyId);
  const normalizedSessionKey = normalizeId(sessionKey);
  if (!normalizedCompanyId || !normalizedSessionKey) {
    return null;
  }
  const sessions = liveChatSessionsByCompany.get(normalizedCompanyId) ?? {};
  const nextState: LiveChatSessionState = {
    ...state,
    sessionKey: normalizedSessionKey,
  };
  liveChatSessionsByCompany.set(normalizedCompanyId, {
    ...sessions,
    [normalizedSessionKey]: nextState,
  });
  return nextState;
}

export function clearLiveChatSession(
  companyId: string | null | undefined,
  sessionKey: string | null | undefined,
) {
  const normalizedCompanyId = normalizeId(companyId);
  const normalizedSessionKey = normalizeId(sessionKey);
  if (!normalizedCompanyId || !normalizedSessionKey) {
    return;
  }
  const sessions = liveChatSessionsByCompany.get(normalizedCompanyId);
  if (!sessions || !(normalizedSessionKey in sessions)) {
    return;
  }
  const nextSessions = { ...sessions };
  delete nextSessions[normalizedSessionKey];
  if (Object.keys(nextSessions).length === 0) {
    liveChatSessionsByCompany.delete(normalizedCompanyId);
    return;
  }
  liveChatSessionsByCompany.set(normalizedCompanyId, nextSessions);
}
