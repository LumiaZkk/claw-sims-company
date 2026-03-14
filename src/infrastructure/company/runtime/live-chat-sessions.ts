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
const liveChatSessionListeners = new Map<string, Set<() => void>>();

function normalizeId(value: string | null | undefined): string | null {
  const normalized = value?.trim();
  return normalized && normalized.length > 0 ? normalized : null;
}

function getLiveChatSessionListenerKey(
  companyId: string | null | undefined,
  sessionKey: string | null | undefined,
): string | null {
  const normalizedCompanyId = normalizeId(companyId);
  const normalizedSessionKey = normalizeId(sessionKey);
  if (!normalizedCompanyId || !normalizedSessionKey) {
    return null;
  }
  return `${normalizedCompanyId}:${normalizedSessionKey}`;
}

function notifyLiveChatSessionListeners(
  companyId: string | null | undefined,
  sessionKey: string | null | undefined,
) {
  const listenerKey = getLiveChatSessionListenerKey(companyId, sessionKey);
  if (!listenerKey) {
    return;
  }
  liveChatSessionListeners.get(listenerKey)?.forEach((listener) => listener());
}

function isEquivalentLiveChatSessionState(
  left: LiveChatSessionState | undefined,
  right: LiveChatSessionState,
): boolean {
  if (!left) {
    return false;
  }
  return (
    left.sessionKey === right.sessionKey &&
    left.agentId === right.agentId &&
    left.runId === right.runId &&
    left.streamText === right.streamText &&
    left.isGenerating === right.isGenerating &&
    left.startedAt === right.startedAt
  );
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
  const existingState = sessions[normalizedSessionKey];
  if (isEquivalentLiveChatSessionState(existingState, nextState)) {
    return existingState;
  }
  liveChatSessionsByCompany.set(normalizedCompanyId, {
    ...sessions,
    [normalizedSessionKey]: nextState,
  });
  notifyLiveChatSessionListeners(normalizedCompanyId, normalizedSessionKey);
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
    notifyLiveChatSessionListeners(normalizedCompanyId, normalizedSessionKey);
    return;
  }
  liveChatSessionsByCompany.set(normalizedCompanyId, nextSessions);
  notifyLiveChatSessionListeners(normalizedCompanyId, normalizedSessionKey);
}

export function subscribeLiveChatSession(
  companyId: string | null | undefined,
  sessionKey: string | null | undefined,
  listener: () => void,
): () => void {
  const listenerKey = getLiveChatSessionListenerKey(companyId, sessionKey);
  if (!listenerKey) {
    return () => {};
  }
  const listeners = liveChatSessionListeners.get(listenerKey) ?? new Set<() => void>();
  listeners.add(listener);
  liveChatSessionListeners.set(listenerKey, listeners);
  return () => {
    const currentListeners = liveChatSessionListeners.get(listenerKey);
    if (!currentListeners) {
      return;
    }
    currentListeners.delete(listener);
    if (currentListeners.size === 0) {
      liveChatSessionListeners.delete(listenerKey);
    }
  };
}
