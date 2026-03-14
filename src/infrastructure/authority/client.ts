import type {
  AuthorityActorsResponse,
  AuthorityAppendRoomRequest,
  AuthorityAppendCompanyEventRequest,
  AuthorityApprovalMutationResponse,
  AuthorityApprovalRequest,
  AuthorityApprovalResolveRequest,
  AuthorityArtifactDeleteRequest,
  AuthorityArtifactMirrorSyncRequest,
  AuthorityArtifactUpsertRequest,
  AuthorityDecisionTicketCancelRequest,
  AuthorityBootstrapSnapshot,
  AuthorityBatchHireEmployeesRequest,
  AuthorityBatchHireEmployeesResponse,
  AuthorityChatSendRequest,
  AuthorityChatSendResponse,
  AuthorityCompanyCodexAuthSyncResponse,
  AuthorityCollaborationScopeResponse,
  AuthorityConversationStateDeleteRequest,
  AuthorityConversationStateUpsertRequest,
  AuthorityCompanyEventsResponse,
  AuthorityCompanyRuntimeSnapshot,
  AuthorityCreateCompanyRequest,
  AuthorityCreateCompanyResponse,
  AuthorityRetryCompanyProvisioningResponse,
  AuthorityDispatchDeleteRequest,
  AuthorityDispatchUpsertRequest,
  AuthorityDecisionTicketDeleteRequest,
  AuthorityDecisionTicketResolveRequest,
  AuthorityDecisionTicketUpsertRequest,
  AuthorityEvent,
  AuthorityExecutorConfig,
  AuthorityExecutorConfigPatch,
  AuthorityHealthSnapshot,
  AuthorityHireEmployeeRequest,
  AuthorityHireEmployeeResponse,
  AuthorityMissionDeleteRequest,
  AuthorityMissionUpsertRequest,
  AuthorityOperatorActionRequest,
  AuthorityOperatorActionResponse,
  AuthorityRequirementPromoteRequest,
  AuthorityRequirementTransitionRequest,
  AuthorityRoundDeleteRequest,
  AuthorityRoundUpsertRequest,
  AuthorityRoomDeleteRequest,
  AuthorityRoomBindingsUpsertRequest,
  AuthorityRuntimeSyncRequest,
  AuthoritySessionHistoryResponse,
  AuthoritySessionListResponse,
  AuthoritySwitchCompanyRequest,
  AuthorityTakeoverCaseCommandRequest,
  AuthorityTakeoverCaseMutationResponse,
  AuthorityWorkItemDeleteRequest,
  AuthorityWorkItemUpsertRequest,
} from "./contract";
import type { CompanyEvent } from "../gateway";
import { AUTHORITY_PROVIDER_ID, DEFAULT_AUTHORITY_URL } from "./contract";

const AUTHORITY_URL_KEY = "cyber_company_authority_url";
const LEGACY_DEFAULT_AUTHORITY_URL = "http://127.0.0.1:18790";
const BACKEND_PROVIDER_KEY = "cyber_company_backend_provider";

function providerUrlKey(providerId: string) {
  return `cyber_company_backend_url__${providerId}`;
}

function normalizeOptionalBaseUrl(url?: string | null) {
  const trimmed = url?.trim();
  if (!trimmed) {
    return null;
  }
  return trimmed.replace(/\/+$/, "");
}

function readStoredAuthorityBaseUrl() {
  const activeProviderId = storage.getItem(BACKEND_PROVIDER_KEY)?.trim() ?? "";
  const activeProviderUrl =
    activeProviderId === AUTHORITY_PROVIDER_ID
      ? normalizeOptionalBaseUrl(storage.getItem(providerUrlKey(activeProviderId)))
      : null;
  const providerScopedUrl = normalizeOptionalBaseUrl(storage.getItem(providerUrlKey(AUTHORITY_PROVIDER_ID)));
  const authorityUrl = normalizeOptionalBaseUrl(storage.getItem(AUTHORITY_URL_KEY));
  const selected = activeProviderUrl ?? providerScopedUrl ?? authorityUrl;
  const normalized = normalizeBaseUrl(selected);
  if (authorityUrl === LEGACY_DEFAULT_AUTHORITY_URL && normalized !== authorityUrl) {
    storage.setItem(AUTHORITY_URL_KEY, normalized);
  }
  if (providerScopedUrl === LEGACY_DEFAULT_AUTHORITY_URL && normalized !== providerScopedUrl) {
    storage.setItem(providerUrlKey(AUTHORITY_PROVIDER_ID), normalized);
  }
  if (activeProviderId === AUTHORITY_PROVIDER_ID && activeProviderUrl === LEGACY_DEFAULT_AUTHORITY_URL) {
    storage.setItem(providerUrlKey(activeProviderId), normalized);
  }
  return normalized;
}

function getStorage(): Pick<Storage, "getItem" | "setItem"> {
  if (
    typeof globalThis === "object" &&
    globalThis &&
    "localStorage" in globalThis &&
    typeof globalThis.localStorage?.getItem === "function" &&
    typeof globalThis.localStorage?.setItem === "function"
  ) {
    return globalThis.localStorage;
  }

  return {
    getItem: () => null,
    setItem: () => {},
  };
}

const storage = getStorage();

function normalizeBaseUrl(url?: string | null) {
  const trimmed = url?.trim();
  if (!trimmed) {
    return DEFAULT_AUTHORITY_URL;
  }
  if (trimmed === LEGACY_DEFAULT_AUTHORITY_URL) {
    return DEFAULT_AUTHORITY_URL;
  }
  return trimmed.replace(/\/+$/, "");
}

function buildWsUrl(baseUrl: string) {
  const normalized = normalizeBaseUrl(baseUrl);
  if (normalized.startsWith("https://")) {
    return `wss://${normalized.slice("https://".length)}/events`;
  }
  if (normalized.startsWith("http://")) {
    return `ws://${normalized.slice("http://".length)}/events`;
  }
  if (normalized.startsWith("ws://") || normalized.startsWith("wss://")) {
    return `${normalized.replace(/\/+$/, "")}/events`;
  }
  return `ws://${normalized}/events`;
}

function createAuthorityUnavailableError(baseUrl: string, path: string, error: unknown): Error {
  const message = error instanceof Error ? error.message : String(error);
  const normalizedBaseUrl = normalizeBaseUrl(baseUrl);
  return new Error(
    [
      `Authority 服务不可达（${normalizedBaseUrl}）。`,
      "公司配置、公司创建和本机权威源同步都依赖 authority。",
      "请先运行 `npm run dev`，或检查当前地址/端口是否正确。",
      `请求路径：${path}。`,
      `原始错误：${message}`,
    ].join(" "),
  );
}

async function requestJson<T>(baseUrl: string, path: string, init?: RequestInit): Promise<T> {
  let response: Response;
  try {
    response = await fetch(`${normalizeBaseUrl(baseUrl)}${path}`, {
      headers: {
        "Content-Type": "application/json",
        ...(init?.headers ?? {}),
      },
      ...init,
    });
  } catch (error) {
    throw createAuthorityUnavailableError(baseUrl, path, error);
  }

  if (!response.ok) {
    const text = await response.text().catch(() => "");
    throw new Error(text || `${response.status} ${response.statusText}`);
  }

  if (response.status === 204) {
    return undefined as T;
  }

  return (await response.json()) as T;
}

export async function probeAuthorityHealth(baseUrl: string) {
  return requestJson<AuthorityHealthSnapshot>(baseUrl, "/health");
}

export async function runAuthorityOperatorActionAt(
  baseUrl: string,
  body: AuthorityOperatorActionRequest,
) {
  return requestJson<AuthorityOperatorActionResponse>(baseUrl, "/operator/actions", {
    method: "POST",
    body: JSON.stringify(body),
  });
}

export class AuthorityClient {
  private baseUrl = readStoredAuthorityBaseUrl();

  private resolveBaseUrl() {
    const stored = readStoredAuthorityBaseUrl();
    if (stored !== this.baseUrl) {
      this.baseUrl = stored;
    }
    return this.baseUrl;
  }

  private requestJson<T>(path: string, init?: RequestInit) {
    return requestJson<T>(this.resolveBaseUrl(), path, init);
  }

  get url() {
    return this.resolveBaseUrl();
  }

  setBaseUrl(url: string) {
    this.baseUrl = normalizeBaseUrl(url);
    storage.setItem(AUTHORITY_URL_KEY, this.baseUrl);
    storage.setItem(BACKEND_PROVIDER_KEY, AUTHORITY_PROVIDER_ID);
    storage.setItem(providerUrlKey(AUTHORITY_PROVIDER_ID), this.baseUrl);
  }

  async health() {
    return probeAuthorityHealth(this.resolveBaseUrl());
  }

  async bootstrap() {
    return this.requestJson<AuthorityBootstrapSnapshot>("/bootstrap");
  }

  async runOperatorAction(body: AuthorityOperatorActionRequest) {
    return runAuthorityOperatorActionAt(this.resolveBaseUrl(), body);
  }

  async getExecutorConfig() {
    return this.requestJson<AuthorityExecutorConfig>("/executor");
  }

  async patchExecutorConfig(body: AuthorityExecutorConfigPatch) {
    return this.requestJson<AuthorityExecutorConfig>("/executor", {
      method: "PATCH",
      body: JSON.stringify(body),
    });
  }

  async requestGateway<T = unknown>(method: string, params?: unknown) {
    return this.requestJson<T>("/gateway/request", {
      method: "POST",
      body: JSON.stringify({ method, params }),
    });
  }

  async createCompany(body: AuthorityCreateCompanyRequest) {
    return this.requestJson<AuthorityCreateCompanyResponse>("/companies", {
      method: "POST",
      body: JSON.stringify(body),
    });
  }

  async retryCompanyProvisioning(companyId: string) {
    return this.requestJson<AuthorityRetryCompanyProvisioningResponse>(
      `/companies/${encodeURIComponent(companyId)}/provisioning/retry`,
      {
        method: "POST",
      },
    );
  }

  async syncCompanyCodexAuth(companyId: string, source: "cli" | "gateway" = "cli") {
    return requestJson<AuthorityCompanyCodexAuthSyncResponse>(
      this.resolveBaseUrl(),
      `/companies/${encodeURIComponent(companyId)}/codex-auth/sync?source=${encodeURIComponent(source)}`,
      {
        method: "POST",
      },
    );
  }

  async hireEmployee(body: AuthorityHireEmployeeRequest) {
    return this.requestJson<AuthorityHireEmployeeResponse>(
      `/companies/${encodeURIComponent(body.companyId)}/employees`,
      {
        method: "POST",
        body: JSON.stringify(body),
      },
    );
  }

  async batchHireEmployees(body: AuthorityBatchHireEmployeesRequest) {
    return this.requestJson<AuthorityBatchHireEmployeesResponse>(
      `/companies/${encodeURIComponent(body.companyId)}/employees/batch`,
      {
        method: "POST",
        body: JSON.stringify(body),
      },
    );
  }

  async requestApproval(body: AuthorityApprovalRequest) {
    return this.requestJson<AuthorityApprovalMutationResponse>("/commands/approval.request", {
      method: "POST",
      body: JSON.stringify(body),
    });
  }

  async resolveApproval(body: AuthorityApprovalResolveRequest) {
    return this.requestJson<AuthorityApprovalMutationResponse>("/commands/approval.resolve", {
      method: "POST",
      body: JSON.stringify(body),
    });
  }

  async deleteCompany(companyId: string) {
    return this.requestJson<AuthorityBootstrapSnapshot>(`/companies/${encodeURIComponent(companyId)}`, {
      method: "DELETE",
    });
  }

  async switchCompany(body: AuthoritySwitchCompanyRequest) {
    return this.requestJson<AuthorityBootstrapSnapshot>("/company/switch", {
      method: "POST",
      body: JSON.stringify(body),
    });
  }

  async updateConfig(config: AuthorityBootstrapSnapshot["config"]) {
    return this.requestJson<AuthorityBootstrapSnapshot>("/config", {
      method: "PUT",
      body: JSON.stringify({ config }),
    });
  }

  async getRuntime(companyId: string) {
    return this.requestJson<AuthorityCompanyRuntimeSnapshot>(
      `/companies/${encodeURIComponent(companyId)}/runtime`,
    );
  }

  async syncRuntime(companyId: string, body: AuthorityRuntimeSyncRequest) {
    return this.requestJson<AuthorityCompanyRuntimeSnapshot>(
      `/companies/${encodeURIComponent(companyId)}/runtime`,
      {
        method: "PUT",
        body: JSON.stringify(body),
      },
    );
  }

  async sendChat(body: AuthorityChatSendRequest) {
    return this.requestJson<AuthorityChatSendResponse>("/commands/chat.send", {
      method: "POST",
      body: JSON.stringify(body),
    });
  }

  async transitionRequirement(body: AuthorityRequirementTransitionRequest) {
    return this.requestJson<AuthorityCompanyRuntimeSnapshot>(
      "/commands/requirement.transition",
      {
        method: "POST",
        body: JSON.stringify(body),
      },
    );
  }

  async promoteRequirement(body: AuthorityRequirementPromoteRequest) {
    return this.requestJson<AuthorityCompanyRuntimeSnapshot>(
      "/commands/requirement.promote",
      {
        method: "POST",
        body: JSON.stringify(body),
      },
    );
  }

  async appendRoom(body: AuthorityAppendRoomRequest) {
    return this.requestJson<AuthorityCompanyRuntimeSnapshot>("/commands/room.append", {
      method: "POST",
      body: JSON.stringify(body),
    });
  }

  async upsertRoomBindings(body: AuthorityRoomBindingsUpsertRequest) {
    return this.requestJson<AuthorityCompanyRuntimeSnapshot>("/commands/room-bindings.upsert", {
      method: "POST",
      body: JSON.stringify(body),
    });
  }

  async upsertRound(body: AuthorityRoundUpsertRequest) {
    return this.requestJson<AuthorityCompanyRuntimeSnapshot>("/commands/round.upsert", {
      method: "POST",
      body: JSON.stringify(body),
    });
  }

  async deleteRound(body: AuthorityRoundDeleteRequest) {
    return this.requestJson<AuthorityCompanyRuntimeSnapshot>("/commands/round.delete", {
      method: "POST",
      body: JSON.stringify(body),
    });
  }

  async upsertMission(body: AuthorityMissionUpsertRequest) {
    return this.requestJson<AuthorityCompanyRuntimeSnapshot>("/commands/mission.upsert", {
      method: "POST",
      body: JSON.stringify(body),
    });
  }

  async deleteMission(body: AuthorityMissionDeleteRequest) {
    return this.requestJson<AuthorityCompanyRuntimeSnapshot>("/commands/mission.delete", {
      method: "POST",
      body: JSON.stringify(body),
    });
  }

  async upsertConversationState(body: AuthorityConversationStateUpsertRequest) {
    return this.requestJson<AuthorityCompanyRuntimeSnapshot>("/commands/conversation-state.upsert", {
      method: "POST",
      body: JSON.stringify(body),
    });
  }

  async deleteConversationState(body: AuthorityConversationStateDeleteRequest) {
    return this.requestJson<AuthorityCompanyRuntimeSnapshot>("/commands/conversation-state.delete", {
      method: "POST",
      body: JSON.stringify(body),
    });
  }

  async upsertWorkItem(body: AuthorityWorkItemUpsertRequest) {
    return this.requestJson<AuthorityCompanyRuntimeSnapshot>("/commands/work-item.upsert", {
      method: "POST",
      body: JSON.stringify(body),
    });
  }

  async deleteWorkItem(body: AuthorityWorkItemDeleteRequest) {
    return this.requestJson<AuthorityCompanyRuntimeSnapshot>("/commands/work-item.delete", {
      method: "POST",
      body: JSON.stringify(body),
    });
  }

  async deleteRoom(body: AuthorityRoomDeleteRequest) {
    return this.requestJson<AuthorityCompanyRuntimeSnapshot>("/commands/room.delete", {
      method: "POST",
      body: JSON.stringify(body),
    });
  }

  async upsertDispatch(body: AuthorityDispatchUpsertRequest) {
    return this.requestJson<AuthorityCompanyRuntimeSnapshot>("/commands/dispatch.create", {
      method: "POST",
      body: JSON.stringify(body),
    });
  }

  async deleteDispatch(body: AuthorityDispatchDeleteRequest) {
    return this.requestJson<AuthorityCompanyRuntimeSnapshot>("/commands/dispatch.delete", {
      method: "POST",
      body: JSON.stringify(body),
    });
  }

  async upsertArtifact(body: AuthorityArtifactUpsertRequest) {
    return this.requestJson<AuthorityCompanyRuntimeSnapshot>("/commands/artifact.upsert", {
      method: "POST",
      body: JSON.stringify(body),
    });
  }

  async syncArtifactMirrors(body: AuthorityArtifactMirrorSyncRequest) {
    return this.requestJson<AuthorityCompanyRuntimeSnapshot>("/commands/artifact.sync-mirror", {
      method: "POST",
      body: JSON.stringify(body),
    });
  }

  async deleteArtifact(body: AuthorityArtifactDeleteRequest) {
    return this.requestJson<AuthorityCompanyRuntimeSnapshot>("/commands/artifact.delete", {
      method: "POST",
      body: JSON.stringify(body),
    });
  }

  async upsertDecisionTicket(body: AuthorityDecisionTicketUpsertRequest) {
    return this.requestJson<AuthorityCompanyRuntimeSnapshot>("/commands/decision.upsert", {
      method: "POST",
      body: JSON.stringify(body),
    });
  }

  async deleteDecisionTicket(body: AuthorityDecisionTicketDeleteRequest) {
    return this.requestJson<AuthorityCompanyRuntimeSnapshot>("/commands/decision.delete", {
      method: "POST",
      body: JSON.stringify(body),
    });
  }

  async resolveDecisionTicket(body: AuthorityDecisionTicketResolveRequest) {
    return this.requestJson<AuthorityCompanyRuntimeSnapshot>("/commands/decision.resolve", {
      method: "POST",
      body: JSON.stringify(body),
    });
  }

  async cancelDecisionTicket(body: AuthorityDecisionTicketCancelRequest) {
    return this.requestJson<AuthorityCompanyRuntimeSnapshot>("/commands/decision.cancel", {
      method: "POST",
      body: JSON.stringify(body),
    });
  }

  async transitionTakeoverCase(body: AuthorityTakeoverCaseCommandRequest) {
    return this.requestJson<AuthorityTakeoverCaseMutationResponse>(
      "/commands/takeover.transition",
      {
        method: "POST",
        body: JSON.stringify(body),
      },
    );
  }

  async listCompanyEvents(
    companyId: string,
    cursor?: string | null,
    since?: number,
    limit?: number,
    recent?: boolean,
  ) {
    const search = new URLSearchParams();
    if (cursor) {
      search.set("cursor", cursor);
    }
    if (typeof since === "number") {
      search.set("since", String(since));
    }
    if (typeof limit === "number" && Number.isFinite(limit) && limit > 0) {
      search.set("limit", String(Math.max(1, Math.floor(limit))));
    }
    if (recent) {
      search.set("recent", "1");
    }
    const suffix = search.size > 0 ? `?${search.toString()}` : "";
    return this.requestJson<AuthorityCompanyEventsResponse>(
      `/companies/${encodeURIComponent(companyId)}/events${suffix}`,
    );
  }

  async getCollaborationScope(companyId: string, agentId: string) {
    return this.requestJson<AuthorityCollaborationScopeResponse>(
      `/companies/${encodeURIComponent(companyId)}/collaboration-scope/${encodeURIComponent(agentId)}`,
    );
  }

  async appendCompanyEvent(body: AuthorityAppendCompanyEventRequest) {
    return this.requestJson<{ ok: true; event: CompanyEvent }>(
      "/commands/company-event.append",
      {
        method: "POST",
        body: JSON.stringify(body),
      },
    );
  }

  async listActors() {
    return this.requestJson<AuthorityActorsResponse>("/actors");
  }

  async listSessions(companyId?: string | null, agentId?: string | null) {
    const search = new URLSearchParams();
    if (companyId) {
      search.set("companyId", companyId);
    }
    if (agentId) {
      search.set("agentId", agentId);
    }
    const suffix = search.size > 0 ? `?${search.toString()}` : "";
    return this.requestJson<AuthoritySessionListResponse>(`/sessions${suffix}`);
  }

  async getChatHistory(sessionKey: string, limit?: number) {
    const search = new URLSearchParams();
    if (typeof limit === "number") {
      search.set("limit", String(limit));
    }
    const suffix = search.size > 0 ? `?${search.toString()}` : "";
    return this.requestJson<AuthoritySessionHistoryResponse>(
      `/sessions/${encodeURIComponent(sessionKey)}/history${suffix}`,
    );
  }

  async resetSession(sessionKey: string) {
    return this.requestJson<{ ok: true; key: string }>(
      `/sessions/${encodeURIComponent(sessionKey)}/reset`,
      {
        method: "POST",
      },
    );
  }

  async deleteSession(sessionKey: string) {
    return this.requestJson<{ ok: boolean; deleted: boolean }>(
      `/sessions/${encodeURIComponent(sessionKey)}`,
      {
        method: "DELETE",
      },
    );
  }

  async getAgentFile(agentId: string, name: string) {
    return this.requestJson<{
      agentId: string;
      workspace: string;
      file: {
        name: string;
        path: string;
        missing: boolean;
        size?: number;
        updatedAtMs?: number;
        content?: string;
      };
    }>(`/agents/${encodeURIComponent(agentId)}/files/${encodeURIComponent(name)}`);
  }

  async listAgentFiles(agentId: string) {
    return this.requestJson<{
      agentId: string;
      workspace: string;
      files: Array<{
        name: string;
        path: string;
        missing: boolean;
        size?: number;
        updatedAtMs?: number;
        content?: string;
      }>;
    }>(`/agents/${encodeURIComponent(agentId)}/files`);
  }

  async setAgentFile(agentId: string, name: string, content: string) {
    return this.requestJson<{
      ok: true;
      agentId: string;
      workspace: string;
      file: {
        name: string;
        path: string;
        missing: boolean;
        size?: number;
        updatedAtMs?: number;
        content?: string;
      };
    }>(`/agents/${encodeURIComponent(agentId)}/files/${encodeURIComponent(name)}`, {
      method: "PUT",
      body: JSON.stringify({ content }),
    });
  }

  async runAgentFile(agentId: string, body: {
    entryPath: string;
    payload?: Record<string, unknown>;
    timeoutMs?: number;
  }) {
    return this.requestJson<import("./contract").AuthorityAgentFileRunResponse>(
      `/agents/${encodeURIComponent(agentId)}/run`,
      {
        method: "POST",
        body: JSON.stringify(body),
      },
    );
  }

  connectEvents(handlers: {
    onOpen?: () => void;
    onClose?: (event: CloseEvent) => void;
    onMessage: (event: AuthorityEvent) => void;
  }) {
    const socket = new WebSocket(buildWsUrl(this.resolveBaseUrl()));
    const handleOpen = () => handlers.onOpen?.();
    const handleClose = (event: CloseEvent) => handlers.onClose?.(event);
    const handleMessage = (event: MessageEvent) => {
      try {
        const payload = JSON.parse(String(event.data ?? "")) as AuthorityEvent;
        handlers.onMessage(payload);
      } catch (error) {
        console.warn("Failed to parse authority event payload", error);
      }
    };
    socket.addEventListener("open", handleOpen);
    socket.addEventListener("close", handleClose);
    socket.addEventListener("message", handleMessage);
    return () => {
      socket.removeEventListener("open", handleOpen);
      socket.removeEventListener("close", handleClose);
      socket.removeEventListener("message", handleMessage);
      socket.close();
    };
  }
}

export const authorityClient = new AuthorityClient();
