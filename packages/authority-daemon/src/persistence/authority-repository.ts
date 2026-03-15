import { mkdirSync } from "node:fs";
import { DatabaseSync } from "node:sqlite";
import type {
  AuthorityBootstrapSnapshot,
  AuthorityCollaborationScopeResponse,
  AuthorityCompanyRuntimeSnapshot,
  AuthorityExecutorCapabilitySnapshot,
  AuthorityExecutorConfig,
  AuthorityExecutorStatus,
  AuthorityHealthSnapshot,
} from "../../../../src/infrastructure/authority/contract";
import { AuthorityChatConversationStore } from "../agent/authority-chat-conversation-store";
import { AuthorityCompanyEventStore } from "../company/authority-company-event-store";
import { AuthorityCompanyStore } from "../company/authority-company-store";
import { AuthorityExecutorStateStore } from "../executor/authority-executor-state-store";
import {
  buildAuthorityBootstrapSnapshot,
  buildAuthorityHealthSnapshot,
} from "../executor/executor-status";
import { resolveLocalOpenClawGatewayToken } from "../executor/openclaw-local-auth";
export {
  AUTHORITY_PORT,
  DB_PATH,
  DATA_DIR,
  DEFAULT_OPENCLAW_URL,
  EXECUTOR_PROVIDER_ID,
  buildEmployeeBootstrapFile,
  createDefaultStoredExecutorConfig,
  decisionTicketMaterialChanged,
  getSyncAuthorityAgentFileMirror,
  isAgentAlreadyExistsError,
  isAgentNotFoundError,
  isLegacyAgentsDeletePurgeStateError,
  isPresent,
  isRecord,
  normalizeApprovalRevision,
  normalizeCompany,
  normalizeDecisionTicketRecord,
  normalizeDecisionTicketRevision,
  normalizeRuntimeSnapshot,
  parseJson,
  readJsonBody,
  readNumber,
  readString,
  resetSessionStatusCapabilityState,
  sanitizeStoredExecutorConfig,
  setCorsHeaders,
  setSyncAuthorityAgentFileMirror,
  sessionStatusCapabilityState,
  shallowJsonEqual,
  slugify,
  stringifyError,
  updateSessionStatusCapability,
  type StoredChatMessage,
  type StoredExecutorConfig,
} from "./authority-persistence-shared";
import { applyAuthoritySchema } from "./authority-schema";
import { openAuthoritySqlite } from "./sqlite";
import {
  AUTHORITY_SCHEMA_VERSION,
  restoreAuthorityBackup,
} from "../system/ops";
import { AuthorityRuntimeStore } from "../collaboration/authority-runtime-store";
import {
  DATA_DIR,
  createDefaultStoredExecutorConfig,
  type StoredChatMessage,
  type StoredExecutorConfig,
  sessionStatusCapabilityState,
} from "./authority-persistence-shared";

const SQLITE_WRITE_RETRY_DELAYS_MS = [25, 50, 100];

export class AuthorityRepository {
  private db: DatabaseSync;
  private readonly startedAt = Date.now();
  private readonly chatStore: AuthorityChatConversationStore;
  private readonly eventStore: AuthorityCompanyEventStore;
  private readonly companyStore: AuthorityCompanyStore;
  private readonly executorStateStore: AuthorityExecutorStateStore;
  private readonly runtimeStore: AuthorityRuntimeStore;

  constructor(private readonly dbPath: string) {
    mkdirSync(DATA_DIR, { recursive: true });
    this.db = this.openDbConnection();
    this.initSchema();
    this.chatStore = new AuthorityChatConversationStore({
      getDb: () => this.db,
      dbPath: this.dbPath,
      loadCompanyById: (companyId) => this.companyStore.loadCompanyById(companyId),
      loadRuntime: (companyId) => this.runtimeStore.loadRuntime(companyId),
      saveRuntime: (snapshot) => this.runtimeStore.saveRuntime(snapshot),
    });
    this.eventStore = new AuthorityCompanyEventStore({
      getDb: () => this.db,
      loadCompanyById: (companyId) => this.companyStore.loadCompanyById(companyId),
      loadRuntime: (companyId) => this.runtimeStore.loadRuntime(companyId),
      saveRuntime: (snapshot) => this.runtimeStore.saveRuntime(snapshot),
    });
    this.executorStateStore = new AuthorityExecutorStateStore({
      getDb: () => this.db,
      readStoredConfig: () => this.companyStore.readStoredConfig(),
    });
    this.runtimeStore = new AuthorityRuntimeStore({
      getDb: () => this.db,
      runWriteTransaction: (operation) => this.runWriteTransaction(operation),
      runWithBusyRetry: (label, operation) => this.runWithBusyRetry(label, operation),
      loadCompanyById: (companyId) => this.companyStore.loadCompanyById(companyId),
      getCompanyAgentIds: (companyId) => this.companyStore.getCompanyAgentIds(companyId),
      setAgentFile: (agentId, name, content) => this.chatStore.setAgentFile(agentId, name, content),
      eventStore: this.eventStore,
    });
    this.companyStore = new AuthorityCompanyStore({
      getDb: () => this.db,
      getActiveCompanyId: () => this.getActiveCompanyId(),
      setActiveCompanyId: (companyId) => this.setActiveCompanyId(companyId),
      loadRuntime: (companyId) => this.runtimeStore.loadRuntime(companyId),
      saveRuntime: (snapshot) => this.runtimeStore.saveRuntime(snapshot),
      setAgentFile: (agentId, name, content) => this.chatStore.setAgentFile(agentId, name, content),
      syncManagedExecutorAgentTargets: (previousConfig, nextConfig) =>
        this.executorStateStore.syncManagedExecutorAgentTargets(previousConfig, nextConfig),
      appendCompanyEvent: (event) => this.eventStore.appendCompanyEvent(event),
      getBootstrap: () => this.getBootstrap(),
    });
  }

  private openDbConnection() {
    return openAuthoritySqlite(this.dbPath, { enableWal: true });
  }

  private runWriteTransaction<T>(operation: () => T): T {
    this.db.exec("BEGIN IMMEDIATE;");
    try {
      const result = operation();
      this.db.exec("COMMIT;");
      return result;
    } catch (error) {
      try {
        this.db.exec("ROLLBACK;");
      } catch {
        // Ignore rollback failures after a failed write.
      }
      throw error;
    }
  }

  private runWithBusyRetry<T>(label: string, operation: () => T): T {
    for (let attempt = 0; attempt <= SQLITE_WRITE_RETRY_DELAYS_MS.length; attempt += 1) {
      try {
        return operation();
      } catch (error) {
        if (!isSqliteBusyError(error) || attempt === SQLITE_WRITE_RETRY_DELAYS_MS.length) {
          throw error;
        }
        const delayMs = SQLITE_WRITE_RETRY_DELAYS_MS[attempt] ?? SQLITE_WRITE_RETRY_DELAYS_MS.at(-1) ?? 50;
        console.warn(`SQLite busy during ${label}; retrying in ${delayMs}ms (attempt ${attempt + 1}).`);
        sleepSync(delayMs);
      }
    }
    throw new Error(`SQLite write retry exhausted for ${label}.`);
  }

  restoreFromBackup(backupPath: string, force = false) {
    this.db.close();
    try {
      return restoreAuthorityBackup({
        backupPath,
        dbPath: this.dbPath,
        force,
      });
    } finally {
      this.db = this.openDbConnection();
      this.initSchema();
    }
  }

  getHealth(input?: {
    executor: AuthorityExecutorStatus;
    executorConfig: AuthorityExecutorConfig;
    executorCapabilities: AuthorityExecutorCapabilitySnapshot;
  }): AuthorityHealthSnapshot {
    return buildAuthorityHealthSnapshot({
      dbPath: this.dbPath,
      startedAt: this.startedAt,
      storedConfig: this.loadExecutorConfig(),
      sessionStatusCapabilityState,
      resolveLocalToken: resolveLocalOpenClawGatewayToken,
      executor: input?.executor,
      executorConfig: input?.executorConfig,
      executorCapabilities: input?.executorCapabilities,
    });
  }

  getBootstrap(input?: {
    executor: AuthorityExecutorStatus;
    executorConfig: AuthorityExecutorConfig;
    executorCapabilities: AuthorityExecutorCapabilitySnapshot;
  }): AuthorityBootstrapSnapshot {
    return buildAuthorityBootstrapSnapshot({
      authorityUrl: `http://127.0.0.1:${process.env.CYBER_COMPANY_AUTHORITY_PORT ?? "19789"}`,
      config: this.loadConfig(),
      loadRuntime: (companyId) => this.loadRuntime(companyId),
      health: this.getHealth(input),
    });
  }

  private initSchema() {
    applyAuthoritySchema({
      db: this.db,
      schemaVersion: AUTHORITY_SCHEMA_VERSION,
      defaultExecutorConfig: createDefaultStoredExecutorConfig(),
    });
  }

  private readMetadata(key: string) {
    const row = this.db.prepare("SELECT value FROM metadata WHERE key = ?").get(key) as
      | { value?: string }
      | undefined;
    return row?.value ?? null;
  }

  private writeMetadata(key: string, value: string) {
    this.db.prepare(`
      INSERT INTO metadata (key, value) VALUES (?, ?)
      ON CONFLICT(key) DO UPDATE SET value = excluded.value
    `).run(key, value);
  }

  private getActiveCompanyId() {
    return this.readMetadata("activeCompanyId");
  }

  private setActiveCompanyId(companyId: string | null) {
    this.writeMetadata("activeCompanyId", companyId ?? "");
  }

  loadExecutorConfig(): StoredExecutorConfig {
    return this.executorStateStore.loadExecutorConfig();
  }

  saveExecutorConfig(config: StoredExecutorConfig): StoredExecutorConfig {
    return this.executorStateStore.saveExecutorConfig(config);
  }

  listManagedExecutorAgents() {
    return this.executorStateStore.listManagedExecutorAgents();
  }

  clearManagedExecutorAgent(agentId: string) {
    return this.executorStateStore.clearManagedExecutorAgent(agentId);
  }

  clearManagedExecutorAgentsForCompany(companyId: string) {
    return this.executorStateStore.clearManagedExecutorAgentsForCompany(companyId);
  }

  syncManagedExecutorAgentTargets(previousConfig: Parameters<AuthorityExecutorStateStore["syncManagedExecutorAgentTargets"]>[0], nextConfig: Parameters<AuthorityExecutorStateStore["syncManagedExecutorAgentTargets"]>[1]) {
    return this.executorStateStore.syncManagedExecutorAgentTargets(previousConfig, nextConfig);
  }

  ensureManagedExecutorAgentInventory() {
    return this.executorStateStore.ensureManagedExecutorAgentInventory();
  }

  readStoredConfig() {
    return this.companyStore.readStoredConfig();
  }

  loadConfig() {
    return this.companyStore.loadConfig();
  }

  loadCompanyById(companyId: string) {
    return this.companyStore.loadCompanyById(companyId);
  }

  saveConfig(config: Parameters<AuthorityCompanyStore["saveConfig"]>[0]) {
    return this.companyStore.saveConfig(config);
  }

  deleteCompany(companyId: string) {
    return this.companyStore.deleteCompany(companyId);
  }

  switchCompany(companyId: string) {
    return this.companyStore.switchCompany(companyId);
  }

  requestApproval(input: Parameters<AuthorityCompanyStore["requestApproval"]>[0]) {
    return this.companyStore.requestApproval(input);
  }

  resolveApproval(input: Parameters<AuthorityCompanyStore["resolveApproval"]>[0]) {
    return this.companyStore.resolveApproval(input);
  }

  transitionTakeoverCase(input: Parameters<AuthorityCompanyStore["transitionTakeoverCase"]>[0]) {
    return this.companyStore.transitionTakeoverCase(input);
  }

  findCompanyIdByAgentId(agentId: string) {
    return this.companyStore.findCompanyIdByAgentId(agentId);
  }

  listActors() {
    return this.companyStore.listActors();
  }

  hasCompany(companyId: string): boolean {
    return this.companyStore.hasCompany(companyId);
  }

  getCompanyAgentIds(companyId?: string | null): string[] {
    return this.companyStore.getCompanyAgentIds(companyId);
  }

  updateRuntimeFromSessionList(
    companyId: string,
    sessions: Parameters<AuthorityRuntimeStore["updateRuntimeFromSessionList"]>[1],
  ) {
    return this.runtimeStore.updateRuntimeFromSessionList(companyId, sessions);
  }

  applyRuntimeSessionStatus(
    companyId: string,
    status: ReturnType<typeof import("../../../../src/application/agent-runtime").normalizeProviderSessionStatus>,
  ) {
    return this.runtimeStore.applyRuntimeSessionStatus(companyId, status);
  }

  applyRuntimeEvent(companyId: string, event: Parameters<AuthorityRuntimeStore["applyRuntimeEvent"]>[1]) {
    return this.runtimeStore.applyRuntimeEvent(companyId, event);
  }

  loadRuntime(companyId: string): AuthorityCompanyRuntimeSnapshot {
    return this.runtimeStore.loadRuntime(companyId);
  }

  repairRuntimeIfNeeded(companyId: string): AuthorityCompanyRuntimeSnapshot {
    return this.runtimeStore.repairRuntimeIfNeeded(companyId);
  }

  saveRuntime(snapshot: AuthorityCompanyRuntimeSnapshot): AuthorityCompanyRuntimeSnapshot {
    return this.runtimeStore.saveRuntime(snapshot);
  }

  listSessions(companyId?: string | null, agentId?: string | null) {
    return this.chatStore.listSessions(companyId, agentId);
  }

  getChatHistory(sessionKey: string, limit = 80) {
    return this.chatStore.getChatHistory(sessionKey, limit);
  }

  getExecutorRunThinkingLevel(runId: string): string | null {
    return this.chatStore.getExecutorRunThinkingLevel(runId);
  }

  getLatestThinkingLevelForSession(sessionKey: string): string | null {
    return this.chatStore.getLatestThinkingLevelForSession(sessionKey);
  }

  resetSession(sessionKey: string) {
    return this.chatStore.resetSession(sessionKey);
  }

  deleteSession(sessionKey: string) {
    return this.chatStore.deleteSession(sessionKey);
  }

  listAgentFiles(agentId: string) {
    return this.chatStore.listAgentFiles(agentId);
  }

  getAgentFile(agentId: string, name: string) {
    return this.chatStore.getAgentFile(agentId, name);
  }

  setAgentFile(agentId: string, name: string, content: string) {
    return this.chatStore.setAgentFile(agentId, name, content);
  }

  getConversationContext(sessionKey: string) {
    return this.chatStore.getConversationContext(sessionKey);
  }

  beginChatDispatch(input: Parameters<AuthorityChatConversationStore["beginChatDispatch"]>[0]) {
    return this.chatStore.beginChatDispatch(input);
  }

  createExecutorRun(input: Parameters<AuthorityChatConversationStore["createExecutorRun"]>[0]) {
    return this.chatStore.createExecutorRun(input);
  }

  updateExecutorRun(
    runId: string,
    status: Parameters<AuthorityChatConversationStore["updateExecutorRun"]>[1],
    payload?: Parameters<AuthorityChatConversationStore["updateExecutorRun"]>[2],
  ) {
    return this.chatStore.updateExecutorRun(runId, status, payload);
  }

  appendAssistantMessage(sessionKey: string, message: StoredChatMessage) {
    return this.chatStore.appendAssistantMessage(sessionKey, message);
  }

  applyAssistantControlMessage(sessionKey: string, message: StoredChatMessage) {
    return this.chatStore.applyAssistantControlMessage(sessionKey, message);
  }

  appendCompanyEvent(event: Parameters<AuthorityCompanyEventStore["appendCompanyEvent"]>[0]) {
    return this.eventStore.appendCompanyEvent(event);
  }

  appendDecisionTicketEvent(input: Parameters<AuthorityCompanyEventStore["appendDecisionTicketEvent"]>[0]) {
    return this.eventStore.appendDecisionTicketEvent(input);
  }

  appendDispatchAuditEvent(input: Parameters<AuthorityCompanyEventStore["appendDispatchAuditEvent"]>[0]) {
    return this.eventStore.appendDispatchAuditEvent(input);
  }

  appendRoomAuditEvent(input: Parameters<AuthorityCompanyEventStore["appendRoomAuditEvent"]>[0]) {
    return this.eventStore.appendRoomAuditEvent(input);
  }

  appendRoomBindingsAuditEvent(input: Parameters<AuthorityCompanyEventStore["appendRoomBindingsAuditEvent"]>[0]) {
    return this.eventStore.appendRoomBindingsAuditEvent(input);
  }

  appendArtifactAuditEvent(input: Parameters<AuthorityCompanyEventStore["appendArtifactAuditEvent"]>[0]) {
    return this.eventStore.appendArtifactAuditEvent(input);
  }

  appendArtifactMirrorSyncEvent(input: Parameters<AuthorityCompanyEventStore["appendArtifactMirrorSyncEvent"]>[0]) {
    return this.eventStore.appendArtifactMirrorSyncEvent(input);
  }

  appendRuntimeRepairEvent(input: Parameters<AuthorityCompanyEventStore["appendRuntimeRepairEvent"]>[0]) {
    return this.eventStore.appendRuntimeRepairEvent(input);
  }

  listCompanyEvents(...args: Parameters<AuthorityCompanyEventStore["listCompanyEvents"]>) {
    return this.eventStore.listCompanyEvents(...args);
  }

  getCollaborationScope(companyId: string, agentId: string): AuthorityCollaborationScopeResponse {
    return this.runtimeStore.getCollaborationScope(companyId, agentId);
  }

  transitionRequirement(input: Parameters<AuthorityRuntimeStore["transitionRequirement"]>[0]) {
    return this.runtimeStore.transitionRequirement(input);
  }

  promoteRequirement(input: Parameters<AuthorityRuntimeStore["promoteRequirement"]>[0]) {
    return this.runtimeStore.promoteRequirement(input);
  }

  upsertRoom(input: Parameters<AuthorityRuntimeStore["upsertRoom"]>[0]) {
    return this.runtimeStore.upsertRoom(input);
  }

  deleteRoom(input: Parameters<AuthorityRuntimeStore["deleteRoom"]>[0]) {
    return this.runtimeStore.deleteRoom(input);
  }

  upsertRoomBindings(input: Parameters<AuthorityRuntimeStore["upsertRoomBindings"]>[0]) {
    return this.runtimeStore.upsertRoomBindings(input);
  }

  upsertRound(input: Parameters<AuthorityRuntimeStore["upsertRound"]>[0]) {
    return this.runtimeStore.upsertRound(input);
  }

  deleteRound(input: Parameters<AuthorityRuntimeStore["deleteRound"]>[0]) {
    return this.runtimeStore.deleteRound(input);
  }

  upsertMission(input: Parameters<AuthorityRuntimeStore["upsertMission"]>[0]) {
    return this.runtimeStore.upsertMission(input);
  }

  deleteMission(input: Parameters<AuthorityRuntimeStore["deleteMission"]>[0]) {
    return this.runtimeStore.deleteMission(input);
  }

  upsertConversationState(input: Parameters<AuthorityRuntimeStore["upsertConversationState"]>[0]) {
    return this.runtimeStore.upsertConversationState(input);
  }

  deleteConversationState(input: Parameters<AuthorityRuntimeStore["deleteConversationState"]>[0]) {
    return this.runtimeStore.deleteConversationState(input);
  }

  upsertWorkItem(input: Parameters<AuthorityRuntimeStore["upsertWorkItem"]>[0]) {
    return this.runtimeStore.upsertWorkItem(input);
  }

  deleteWorkItem(input: Parameters<AuthorityRuntimeStore["deleteWorkItem"]>[0]) {
    return this.runtimeStore.deleteWorkItem(input);
  }

  upsertDispatch(input: Parameters<AuthorityRuntimeStore["upsertDispatch"]>[0]) {
    return this.runtimeStore.upsertDispatch(input);
  }

  deleteDispatch(input: Parameters<AuthorityRuntimeStore["deleteDispatch"]>[0]) {
    return this.runtimeStore.deleteDispatch(input);
  }

  upsertArtifact(input: Parameters<AuthorityRuntimeStore["upsertArtifact"]>[0]) {
    return this.runtimeStore.upsertArtifact(input);
  }

  syncArtifactMirrors(input: Parameters<AuthorityRuntimeStore["syncArtifactMirrors"]>[0]) {
    return this.runtimeStore.syncArtifactMirrors(input);
  }

  deleteArtifact(input: Parameters<AuthorityRuntimeStore["deleteArtifact"]>[0]) {
    return this.runtimeStore.deleteArtifact(input);
  }

  upsertDecisionTicket(input: Parameters<AuthorityRuntimeStore["upsertDecisionTicket"]>[0]) {
    return this.runtimeStore.upsertDecisionTicket(input);
  }

  resolveDecisionTicket(input: Parameters<AuthorityRuntimeStore["resolveDecisionTicket"]>[0]) {
    return this.runtimeStore.resolveDecisionTicket(input);
  }

  cancelDecisionTicket(input: Parameters<AuthorityRuntimeStore["cancelDecisionTicket"]>[0]) {
    return this.runtimeStore.cancelDecisionTicket(input);
  }

  deleteDecisionTicket(input: Parameters<AuthorityRuntimeStore["deleteDecisionTicket"]>[0]) {
    return this.runtimeStore.deleteDecisionTicket(input);
  }
}

function isSqliteBusyError(error: unknown): boolean {
  if (!error || typeof error !== "object") {
    return false;
  }
  const candidate = error as {
    code?: string;
    errcode?: number;
    message?: string;
    errstr?: string;
  };
  return (
    candidate.errcode === 5 ||
    candidate.code === "ERR_SQLITE_ERROR" ||
    candidate.message?.includes("database is locked") === true ||
    candidate.errstr?.includes("database is locked") === true
  );
}

function sleepSync(ms: number) {
  if (ms <= 0) {
    return;
  }
  Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, ms);
}
