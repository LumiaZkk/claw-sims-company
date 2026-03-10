import { GatewayBrowserClient } from "./browser-client";
import {
  type AgentControlSnapshot,
} from "./agent-controls";
import {
  alignAgentSkillsToDefaults as alignAgentSkillsToDefaultsFromConfig,
  getAgentControlSnapshot as getAgentControlSnapshotFromConfig,
  setAgentModelOverride as setAgentModelOverrideFromConfig,
  setAgentSkillsOverride as setAgentSkillsOverrideFromConfig,
} from "./agent-controls";
import { buildAgentMethods } from "./agents";
import type { AgentsDeleteResult, AgentsListResult } from "./agents";
import { buildControlPlaneMethods } from "./control-plane";
import {
  type CostUsageSummary,
  type CronListResult,
  type SessionsUsageResult,
} from "./control-plane";
import { buildSessionMethods } from "./sessions";
import type {
  ChatMessage,
  ChatSendAck,
  SessionsArchivesGetResult,
  SessionsArchivesListResult,
  SessionsArchivesRestoreResult,
  SessionsListResult,
} from "./sessions";
import type { GatewayEventFrame, GatewayHelloOk } from "./browser-client";
import type { CompanyEvent, CompanyEventsListResult } from "../../../domain/delegation/events";
import type {
  GatewayAuthCodexOauthCallbackResult,
  GatewayAuthCodexOauthStatusResult,
  GatewayAuthCodexOauthStartResult,
  GatewayAuthImportCodexCliResult,
  GatewayModelChoice,
  GatewayModelsListParams,
} from "./types";

export type {
  AgentListEntry,
  AgentsDeleteResult,
  AgentsListResult,
  GatewayAgentIdentity,
} from "./agents";
export type { AgentControlSnapshot } from "./agent-controls";
export type {
  CostUsageSummary,
  CostUsageTotals,
  CronJob,
  CronListResult,
  SessionCostSummary,
  SessionsUsageEntry,
  SessionsUsageResult,
} from "./control-plane";
export type {
  ChatEventPayload,
  ChatMessage,
  ChatSendAck,
  GatewaySessionArchiveRow,
  GatewaySessionRow,
  SessionsArchivesGetResult,
  SessionsArchivesListResult,
  SessionsArchivesRestoreResult,
  SessionsListResult,
} from "./sessions";
export type {
  GatewayAuthCodexOauthCallbackResult,
  GatewayAuthCodexOauthStatusResult,
  GatewayAuthCodexOauthStartResult,
  GatewayAuthImportCodexCliResult,
  GatewayModelChoice,
  GatewayModelsListParams,
} from "./types";

type GatewayCloseInfo = {
  code: number;
  reason: string;
  error?: { code: string; message: string; details?: unknown };
};

export class CyberGateway {
  public client: GatewayBrowserClient | null = null;
  private onEventHandler: ((event: GatewayEventFrame) => void) | null = null;
  private onHelloHandler: ((hello: GatewayHelloOk) => void) | null = null;
  private onCloseHandler: ((info: GatewayCloseInfo) => void) | null = null;
  private eventListeners = new Map<string, Set<(payload: unknown) => void>>();
  private readonly agentMethods = buildAgentMethods(this);
  private readonly controlPlaneMethods = buildControlPlaneMethods(this);
  private readonly sessionMethods = buildSessionMethods(this);

  constructor() {
    this.onEventHandler = (event) => {
      const handlers = this.eventListeners.get(event.event);
      handlers?.forEach((handler) => handler(event.payload));
      const wildcardHandlers = this.eventListeners.get("*");
      wildcardHandlers?.forEach((handler) => handler(event));
    };
  }

  subscribe(eventType: string, handler: (payload: unknown) => void) {
    if (!this.eventListeners.has(eventType)) {
      this.eventListeners.set(eventType, new Set());
    }
    this.eventListeners.get(eventType)?.add(handler);
    return () => {
      this.eventListeners.get(eventType)?.delete(handler);
    };
  }

  connect(url: string, token?: string) {
    this.client?.stop();

    this.client = new GatewayBrowserClient({
      url,
      token,
      clientName: "openclaw-control-ui",
      onHello: (hello) => {
        this.onHelloHandler?.(hello);
      },
      onEvent: (event) => {
        this.onEventHandler?.(event);
      },
      onClose: (info) => {
        this.onCloseHandler?.(info);
      },
    });

    this.client.start();
  }

  disconnect() {
    this.client?.stop();
    this.client = null;
  }

  get isConnected() {
    return this.client?.connected ?? false;
  }

  request<T = unknown>(method: string, params?: unknown): Promise<T> {
    if (!this.client) {
      return Promise.reject(new Error("gateway not connected"));
    }
    return this.client.request<T>(method, params);
  }

  onEvent(handler: (event: GatewayEventFrame) => void) {
    this.onEventHandler = handler;
  }

  onHello(handler: (hello: GatewayHelloOk) => void) {
    this.onHelloHandler = handler;
  }

  onClose(handler: (info: GatewayCloseInfo) => void) {
    this.onCloseHandler = handler;
  }

  async listAgents(): Promise<AgentsListResult> {
    return this.agentMethods.listAgents();
  }

  async listModels(params?: GatewayModelsListParams): Promise<{ models: GatewayModelChoice[] }> {
    return this.controlPlaneMethods.listModels(params);
  }

  async refreshModels(): Promise<{ models: GatewayModelChoice[] }> {
    return this.controlPlaneMethods.refreshModels();
  }

  async startCodexOAuth(): Promise<GatewayAuthCodexOauthStartResult> {
    return this.controlPlaneMethods.startCodexOAuth();
  }

  async getCodexOAuthStatus(state: string): Promise<GatewayAuthCodexOauthStatusResult> {
    return this.controlPlaneMethods.getCodexOAuthStatus(state);
  }

  async completeCodexOAuth(params: {
    code: string;
    state: string;
  }): Promise<GatewayAuthCodexOauthCallbackResult> {
    return this.controlPlaneMethods.completeCodexOAuth(params);
  }

  async importCodexCliAuth(): Promise<GatewayAuthImportCodexCliResult> {
    return this.controlPlaneMethods.importCodexCliAuth();
  }

  async updateAgent(params: {
    agentId: string;
    name?: string;
    workspace?: string;
    model?: string;
    avatar?: string;
  }): Promise<{ ok: true; agentId: string }> {
    return this.agentMethods.updateAgent(params);
  }

  async createAgent(
    name: string,
  ): Promise<{ ok: true; agentId: string; name: string; workspace: string }> {
    return this.agentMethods.createAgent(name);
  }

  async deleteAgent(
    agentId: string,
    opts?: { deleteFiles?: boolean; purgeState?: boolean },
  ): Promise<AgentsDeleteResult> {
    return this.agentMethods.deleteAgent(agentId, opts);
  }

  async listAgentFiles(
    agentId: string,
  ): Promise<{ agentId: string; workspace: string; files: Array<{
    name: string;
    path: string;
    missing: boolean;
    size?: number;
    updatedAtMs?: number;
    content?: string;
  }> }> {
    return this.agentMethods.listAgentFiles(agentId);
  }

  async getAgentFile(agentId: string, name: string) {
    return this.agentMethods.getAgentFile(agentId, name);
  }

  async setAgentFile(agentId: string, name: string, content: string) {
    return this.agentMethods.setAgentFile(agentId, name, content);
  }

  async listSessions(opts?: {
    limit?: number;
    activeMinutes?: number;
    includeGlobal?: boolean;
    includeUnknown?: boolean;
    includeDerivedTitles?: boolean;
    includeLastMessage?: boolean;
    label?: string;
    spawnedBy?: string;
    agentId?: string;
    search?: string;
  }): Promise<SessionsListResult> {
    return this.sessionMethods.listSessions(opts);
  }

  async resetSession(
    sessionKey: string,
    reason?: "new" | "reset",
  ): Promise<{ ok: true; key: string }> {
    return this.sessionMethods.resetSession(sessionKey, reason);
  }

  async deleteSession(sessionKey: string): Promise<{ ok: boolean; deleted: boolean }> {
    return this.sessionMethods.deleteSession(sessionKey);
  }

  async listSessionArchives(
    agentId: string,
    limit?: number,
  ): Promise<SessionsArchivesListResult> {
    return this.sessionMethods.listSessionArchives(agentId, limit);
  }

  async getSessionArchive(
    agentId: string,
    archiveId: string,
    limit?: number,
  ): Promise<SessionsArchivesGetResult> {
    return this.sessionMethods.getSessionArchive(agentId, archiveId, limit);
  }

  async deleteSessionArchive(
    agentId: string,
    archiveId: string,
  ): Promise<{ ok: boolean; removed: boolean }> {
    return this.sessionMethods.deleteSessionArchive(agentId, archiveId);
  }

  async restoreSessionArchive(
    agentId: string,
    archiveId: string,
    key: string,
  ): Promise<SessionsArchivesRestoreResult> {
    return this.sessionMethods.restoreSessionArchive(agentId, archiveId, key);
  }

  async compactSession(
    sessionKey: string,
    maxLines: number = 400,
  ): Promise<{ ok: boolean; compacted: boolean }> {
    return this.sessionMethods.compactSession(sessionKey, maxLines);
  }

  async resolveSession(agentId: string): Promise<{ ok: boolean; key: string; error?: string }> {
    return this.sessionMethods.resolveSession(agentId);
  }

  async getChatHistory(
    sessionKey: string,
    limit?: number,
  ): Promise<{
    sessionKey?: string;
    sessionId?: string;
    messages: ChatMessage[];
    thinkingLevel?: string;
  }> {
    return this.sessionMethods.getChatHistory(sessionKey, limit);
  }

  async sendChatMessage(
    sessionKey: string,
    message: string,
    opts?: {
      timeoutMs?: number;
      attachments?: Array<{ type: string; mimeType: string; content: string }>;
    },
  ): Promise<ChatSendAck> {
    return this.sessionMethods.sendChatMessage(sessionKey, message, opts);
  }

  async appendCompanyEvent(event: CompanyEvent): Promise<{ ok: true; event: CompanyEvent }> {
    return this.request("company.events.append", { event });
  }

  async listCompanyEvents(params: {
    companyId: string;
    since?: number;
    cursor?: string;
    limit?: number;
  }): Promise<CompanyEventsListResult> {
    return this.request("company.events.list", params);
  }

  async listCron(): Promise<CronListResult> {
    return this.controlPlaneMethods.listCron();
  }

  async addCron(job: Record<string, unknown>) {
    return this.controlPlaneMethods.addCron(job);
  }

  async updateCron(jobId: string, patch: Record<string, unknown>) {
    return this.controlPlaneMethods.updateCron(jobId, patch);
  }

  public async removeCron(id: string): Promise<boolean> {
    return this.controlPlaneMethods.removeCron(id);
  }

  public async getUsageCost(params?: { days?: number }): Promise<CostUsageSummary> {
    return this.controlPlaneMethods.getUsageCost(params);
  }

  async getSessionsUsage(params?: {
    key?: string;
    startDate?: string;
    endDate?: string;
    mode?: "utc" | "gateway" | "specific";
    utcOffset?: string;
    limit?: number;
    includeContextWeight?: boolean;
  }): Promise<SessionsUsageResult> {
    return this.controlPlaneMethods.getSessionsUsage(params);
  }

  async getChannelsStatus() {
    return this.controlPlaneMethods.getChannelsStatus();
  }

  async getSkillsStatus(agentId?: string) {
    return this.controlPlaneMethods.getSkillsStatus(agentId);
  }

  async getHealth() {
    return this.controlPlaneMethods.getHealth();
  }

  async getStatus() {
    return this.controlPlaneMethods.getStatus();
  }

  async getConfigSnapshot() {
    return this.controlPlaneMethods.getConfigSnapshot();
  }

  async setConfig(config: Record<string, unknown>, baseHash: string) {
    return this.controlPlaneMethods.setConfig(config, baseHash);
  }

  async patchConfig(patch: Record<string, unknown>, baseHash: string) {
    return this.controlPlaneMethods.patchConfig(patch, baseHash);
  }

  async alignAgentSkillsToDefaults(
    agentIds: string[],
  ): Promise<{ updated: number; defaultSkills: string[] | null }> {
    return alignAgentSkillsToDefaultsFromConfig(this, agentIds);
  }

  async getAgentControlSnapshot(agentId: string): Promise<AgentControlSnapshot> {
    return getAgentControlSnapshotFromConfig(this, agentId);
  }

  async setAgentModelOverride(
    agentId: string,
    model: string | null,
  ): Promise<{ updated: boolean; modelOverride: string | null }> {
    return setAgentModelOverrideFromConfig(this, agentId, model);
  }

  async setAgentSkillsOverride(
    agentId: string,
    skills: string[] | null,
  ): Promise<{ updated: boolean; skillsOverride: string[] | null }> {
    return setAgentSkillsOverrideFromConfig(this, agentId, skills);
  }

  async abortChatRunsForSessionKeyWithPartials(
    sessionKey: string,
    runId?: string,
  ): Promise<{ ok: boolean; aborted: number; runIds: string[] }> {
    return this.sessionMethods.abortChatRunsForSessionKeyWithPartials(sessionKey, runId);
  }
}

export const gateway = new CyberGateway();
