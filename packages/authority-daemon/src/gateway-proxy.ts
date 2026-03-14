import type {
  AuthoritySessionListResponse,
} from "../../../src/infrastructure/authority/contract";
import { authorityUnsupported } from "./authority-error";
import type { SessionStatusCapabilityState } from "./runtime-authority";

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function readString(value: unknown): string | null {
  return typeof value === "string" && value.trim().length > 0 ? value.trim() : null;
}

function readActorIdFromSession(value: { actorId?: unknown; key?: unknown }) {
  return readString(value.actorId)
    ?? (typeof value.key === "string" && value.key.startsWith("agent:")
      ? value.key.split(":")[1] ?? null
      : null);
}

type AuthorityGatewayProxyRepository = {
  getCompanyAgentIds: (companyId?: string | null) => string[];
  getConversationContext: (sessionKey: string) => { companyId: string; actorId: string | null } | null;
  findCompanyIdByAgentId: (agentId: string) => string | null;
  updateRuntimeFromSessionList: (
    companyId: string,
    sessions: AuthoritySessionListResponse["sessions"],
  ) => unknown;
  resetSession: (sessionKey: string) => unknown;
  deleteSession: (sessionKey: string) => unknown;
  setAgentFile: (agentId: string, name: string, content: string) => unknown;
};

export function createAuthorityGatewayProxy<TStatus extends { agentId?: string | null }>(input: {
  requestExecutor: <T>(method: string, params?: unknown) => Promise<T>;
  repository: AuthorityGatewayProxyRepository & {
    applyRuntimeSessionStatus: (companyId: string, status: TStatus) => unknown;
  };
  providerId: string;
  getSessionStatusCapabilityState: () => SessionStatusCapabilityState;
  updateSessionStatusCapability: (outcome: "success" | "error", error?: unknown) => void;
  normalizeProviderSessionStatus: (providerId: string, sessionKey: string, result: unknown) => TStatus;
}) {
  const {
    requestExecutor,
    repository,
    providerId,
    getSessionStatusCapabilityState,
    updateSessionStatusCapability,
    normalizeProviderSessionStatus,
  } = input;

  return async function proxyGatewayRequest<T>(method: string, params?: unknown): Promise<T> {
    if (method === "sessions.list") {
      const result = await requestExecutor<AuthoritySessionListResponse>(method, params ?? {});
      const requestedAgentId = isRecord(params) ? readString(params.agentId) : null;
      if (requestedAgentId) {
        return result as T;
      }
      const allowedAgentIds = new Set(repository.getCompanyAgentIds());
      if (allowedAgentIds.size === 0) {
        return result as T;
      }
      const sessions = (result.sessions ?? []).filter((session) => {
        const actorId = readActorIdFromSession(session);
        return actorId ? allowedAgentIds.has(actorId) : false;
      });
      const sessionsByCompanyId = new Map<string, AuthoritySessionListResponse["sessions"]>();
      sessions.forEach((session) => {
        const actorId = readActorIdFromSession(session);
        const companyId =
          (typeof session.key === "string"
            ? repository.getConversationContext(session.key)?.companyId
            : null)
          ?? (actorId ? repository.findCompanyIdByAgentId(actorId) : null);
        if (!companyId) {
          return;
        }
        const existing = sessionsByCompanyId.get(companyId) ?? [];
        existing.push(session);
        sessionsByCompanyId.set(companyId, existing);
      });
      sessionsByCompanyId.forEach((companySessions, companyId) => {
        repository.updateRuntimeFromSessionList(companyId, companySessions);
      });
      return {
        ...result,
        count: sessions.length,
        sessions,
      } as T;
    }

    if (method === "session_status") {
      if (getSessionStatusCapabilityState() === "unsupported") {
        throw authorityUnsupported("OpenClaw executor does not support session_status.");
      }
      try {
        const result = await requestExecutor<T>(method, params ?? {});
        updateSessionStatusCapability("success");
        const sessionKey = isRecord(params)
          ? readString(params.sessionKey) ?? readString(params.key)
          : null;
        if (sessionKey) {
          const normalized = normalizeProviderSessionStatus(providerId, sessionKey, result);
          const companyId =
            repository.getConversationContext(sessionKey)?.companyId
            ?? (normalized.agentId ? repository.findCompanyIdByAgentId(normalized.agentId) : null);
          if (companyId) {
            repository.applyRuntimeSessionStatus(companyId, normalized);
          }
        }
        return result;
      } catch (error) {
        updateSessionStatusCapability("error", error);
        throw error;
      }
    }

    if (method === "sessions.resolve") {
      const sessionKey = isRecord(params) ? readString(params.key) : null;
      try {
        return await requestExecutor<T>(method, params ?? {});
      } catch (error) {
        if (
          sessionKey &&
          error instanceof Error &&
          error.message.includes("No session found")
        ) {
          return {
            ok: true,
            key: sessionKey,
            error: error.message,
          } as T;
        }
        throw error;
      }
    }

    if (method === "sessions.reset") {
      const sessionKey = isRecord(params) ? readString(params.key) : null;
      const result = await requestExecutor<T>(method, params ?? {});
      if (sessionKey) {
        repository.resetSession(sessionKey);
      }
      return result;
    }

    if (method === "sessions.delete") {
      const sessionKey = isRecord(params) ? readString(params.key) : null;
      const result = await requestExecutor<T>(method, params ?? {});
      if (sessionKey) {
        repository.deleteSession(sessionKey);
      }
      return result;
    }

    if (method === "agents.files.set" && isRecord(params)) {
      const agentId = readString(params.agentId);
      const name = readString(params.name);
      const content = typeof params.content === "string" ? params.content : null;
      if (agentId && name && content !== null) {
        repository.setAgentFile(agentId, name, content);
      }
    }

    return requestExecutor<T>(method, params ?? {});
  };
}
