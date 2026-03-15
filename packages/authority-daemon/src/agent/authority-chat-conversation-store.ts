import type { DatabaseSync } from "node:sqlite";
import { reconcileAuthorityRequirementRuntime, runtimeRequirementControlChanged } from "../collaboration/requirement-control-runtime";
import type { Company } from "../../../../src/domain/org/types";
import type {
  AuthorityChatSendRequest,
  AuthorityCompanyRuntimeSnapshot,
  AuthoritySessionHistoryResponse,
  AuthoritySessionListResponse,
} from "../../../../src/infrastructure/authority/contract";
import type { ChatMessage } from "../../../../src/infrastructure/gateway/openclaw/sessions";
import type { AgentRunRecord } from "../../../../src/application/agent-runtime";
import {
  parseJson,
  readString,
  type StoredChatMessage,
} from "../persistence/authority-persistence-shared";

type AuthorityChatConversationStoreDependencies = {
  getDb: () => DatabaseSync;
  dbPath: string;
  loadCompanyById: (companyId: string) => Company | null;
  loadRuntime: (companyId: string) => AuthorityCompanyRuntimeSnapshot;
  saveRuntime: (snapshot: AuthorityCompanyRuntimeSnapshot) => AuthorityCompanyRuntimeSnapshot;
};

export class AuthorityChatConversationStore {
  constructor(private readonly deps: AuthorityChatConversationStoreDependencies) {}

  private ensureConversationRow(companyId: string, actorId: string, sessionKey: string) {
    const db = this.deps.getDb();
    const existing = db.prepare("SELECT session_key FROM conversations WHERE session_key = ?").get(sessionKey) as
      | { session_key?: string }
      | undefined;
    if (existing?.session_key) {
      return;
    }
    db.prepare(`
      INSERT INTO conversations (session_key, company_id, actor_id, kind, label, updated_at)
      VALUES (?, ?, ?, ?, ?, ?)
    `).run(sessionKey, companyId, actorId, "direct", actorId, Date.now());
  }

  private appendConversationMessage(companyId: string, sessionKey: string, message: StoredChatMessage) {
    const db = this.deps.getDb();
    db.prepare(`
      INSERT INTO conversation_messages (id, company_id, session_key, role, timestamp, payload_json)
      VALUES (?, ?, ?, ?, ?, ?)
    `).run(
      crypto.randomUUID(),
      companyId,
      sessionKey,
      message.role,
      message.timestamp ?? Date.now(),
      JSON.stringify(message),
    );
    db.prepare(`
      INSERT INTO conversations (session_key, company_id, actor_id, kind, label, updated_at)
      VALUES (?, ?, ?, ?, ?, ?)
      ON CONFLICT(session_key) DO UPDATE SET
        updated_at = excluded.updated_at
    `).run(
      sessionKey,
      companyId,
      sessionKey.split(":")[1] ?? null,
      "direct",
      sessionKey.split(":")[1] ?? null,
      message.timestamp ?? Date.now(),
    );
  }

  listSessions(companyId?: string | null, agentId?: string | null): AuthoritySessionListResponse {
    const db = this.deps.getDb();
    const clauses: string[] = [];
    const args: Array<string> = [];
    if (companyId) {
      clauses.push("company_id = ?");
      args.push(companyId);
    }
    if (agentId) {
      clauses.push("actor_id = ?");
      args.push(agentId);
    }
    const where = clauses.length > 0 ? `WHERE ${clauses.join(" AND ")}` : "";
    const rows = db.prepare(`
      SELECT session_key, actor_id, kind, label, updated_at
      FROM conversations
      ${where}
      ORDER BY updated_at DESC
    `).all(...args) as Array<{
      session_key: string;
      actor_id?: string | null;
      kind?: string | null;
      label?: string | null;
      updated_at?: number | null;
    }>;
    const latestPreviewStmt = db.prepare(`
      SELECT payload_json
      FROM conversation_messages
      WHERE session_key = ?
      ORDER BY timestamp DESC
      LIMIT 1
    `);
    const sessions = rows.map((row) => {
      const previewRow = latestPreviewStmt.get(row.session_key) as { payload_json?: string } | undefined;
      const latest = previewRow?.payload_json
        ? parseJson<StoredChatMessage>(previewRow.payload_json, { role: "system" })
        : null;
      const kind: "direct" | "group" = row.kind === "group" ? "group" : "direct";
      return {
        key: row.session_key,
        actorId: row.actor_id ?? null,
        kind,
        label: row.label ?? row.actor_id ?? row.session_key,
        displayName: row.label ?? row.actor_id ?? row.session_key,
        derivedTitle: row.label ?? row.actor_id ?? row.session_key,
        lastMessagePreview: truncate(typeof latest?.text === "string" ? latest.text : ""),
        updatedAt: row.updated_at ?? Date.now(),
      };
    });
    return {
      ts: Date.now(),
      path: this.deps.dbPath,
      count: sessions.length,
      sessions,
    };
  }

  getChatHistory(sessionKey: string, limit = 80): AuthoritySessionHistoryResponse {
    const db = this.deps.getDb();
    const rows = db.prepare(`
      SELECT payload_json
      FROM conversation_messages
      WHERE session_key = ?
      ORDER BY timestamp DESC
      LIMIT ?
    `).all(sessionKey, limit) as Array<{ payload_json: string }>;
    const messages = rows
      .map((row) => parseJson<StoredChatMessage>(row.payload_json, { role: "system" }))
      .reverse();
    return {
      sessionKey,
      sessionId: sessionKey,
      messages,
      thinkingLevel: this.getLatestThinkingLevelForSession(sessionKey) ?? undefined,
    };
  }

  getExecutorRunThinkingLevel(runId: string): string | null {
    const db = this.deps.getDb();
    const row = db.prepare("SELECT payload_json FROM executor_runs WHERE id = ?").get(runId) as
      | { payload_json?: string }
      | undefined;
    return this.readThinkingLevelFromPayloadJson(row?.payload_json);
  }

  getLatestThinkingLevelForSession(sessionKey: string): string | null {
    const db = this.deps.getDb();
    const rows = db.prepare(`
      SELECT payload_json
      FROM executor_runs
      WHERE session_key = ?
      ORDER BY started_at DESC
      LIMIT 20
    `).all(sessionKey) as Array<{ payload_json?: string }>;
    for (const row of rows) {
      const thinkingLevel = this.readThinkingLevelFromPayloadJson(row.payload_json);
      if (thinkingLevel) {
        return thinkingLevel;
      }
    }
    return null;
  }

  private readThinkingLevelFromPayloadJson(payloadJson: string | null | undefined): string | null {
    const payload = parseJson<Record<string, unknown>>(payloadJson, {});
    return readString(payload.thinkingLevel) ?? readString(payload.thinking);
  }

  resetSession(sessionKey: string) {
    const db = this.deps.getDb();
    db.prepare("DELETE FROM conversation_messages WHERE session_key = ?").run(sessionKey);
    db.prepare("UPDATE conversations SET updated_at = ? WHERE session_key = ?").run(Date.now(), sessionKey);
    return { ok: true as const, key: sessionKey };
  }

  deleteSession(sessionKey: string) {
    const db = this.deps.getDb();
    db.prepare("DELETE FROM conversation_messages WHERE session_key = ?").run(sessionKey);
    const deleted = db.prepare("DELETE FROM conversations WHERE session_key = ?").run(sessionKey).changes > 0;
    return { ok: true, deleted };
  }

  listAgentFiles(agentId: string) {
    const db = this.deps.getDb();
    const rows = db.prepare(`
      SELECT name, content, updated_at
      FROM agent_files
      WHERE agent_id = ?
      ORDER BY name ASC
    `).all(agentId) as Array<{ name: string; content: string; updated_at: number }>;
    return {
      agentId,
      workspace: `authority://${agentId}`,
      files: rows.map((row) => ({
        name: row.name,
        path: `authority://${agentId}/${row.name}`,
        missing: false,
        size: row.content.length,
        updatedAtMs: row.updated_at,
        content: row.content,
      })),
    };
  }

  getAgentFile(agentId: string, name: string) {
    const db = this.deps.getDb();
    const row = db.prepare(`
      SELECT content, updated_at
      FROM agent_files
      WHERE agent_id = ? AND name = ?
    `).get(agentId, name) as { content?: string; updated_at?: number } | undefined;
    return {
      agentId,
      workspace: `authority://${agentId}`,
      file: row
        ? {
            name,
            path: `authority://${agentId}/${name}`,
            missing: false,
            size: row.content?.length ?? 0,
            updatedAtMs: row.updated_at,
            content: row.content,
          }
        : {
            name,
            path: `authority://${agentId}/${name}`,
            missing: true,
          },
    };
  }

  setAgentFile(agentId: string, name: string, content: string) {
    const db = this.deps.getDb();
    const existing = db.prepare(`
      SELECT content, updated_at
      FROM agent_files
      WHERE agent_id = ? AND name = ?
    `).get(agentId, name) as { content?: string; updated_at?: number } | undefined;
    if (existing?.content === content) {
      return {
        ok: true as const,
        changed: false as const,
        agentId,
        workspace: `authority://${agentId}`,
        file: {
          name,
          path: `authority://${agentId}/${name}`,
          missing: false,
          size: content.length,
          updatedAtMs: existing.updated_at ?? Date.now(),
          content,
        },
      };
    }
    const updatedAt = Date.now();
    db.prepare(`
      INSERT INTO agent_files (agent_id, name, content, updated_at)
      VALUES (?, ?, ?, ?)
      ON CONFLICT(agent_id, name) DO UPDATE SET
        content = excluded.content,
        updated_at = excluded.updated_at
    `).run(agentId, name, content, updatedAt);
    return {
      ok: true as const,
      changed: true as const,
      agentId,
      workspace: `authority://${agentId}`,
      file: {
        name,
        path: `authority://${agentId}/${name}`,
        missing: false,
        size: content.length,
        updatedAtMs: updatedAt,
        content,
      },
    };
  }

  getConversationContext(sessionKey: string): { companyId: string; actorId: string | null } | null {
    const db = this.deps.getDb();
    const row = db.prepare(`
      SELECT company_id, actor_id
      FROM conversations
      WHERE session_key = ?
    `).get(sessionKey) as
      | { company_id?: string; actor_id?: string | null }
      | undefined;
    if (!row?.company_id) {
      return null;
    }
    return {
      companyId: row.company_id,
      actorId: row.actor_id ?? null,
    };
  }

  beginChatDispatch(input: AuthorityChatSendRequest) {
    const sessionKey = input.sessionKey?.trim() || `agent:${input.actorId}:main`;
    const now = Date.now();
    this.ensureConversationRow(input.companyId, input.actorId, sessionKey);
    this.appendConversationMessage(input.companyId, sessionKey, {
      role: "user",
      text: input.message,
      content: [{ type: "text", text: input.message }],
      timestamp: now,
    });
    return { sessionKey, now };
  }

  createExecutorRun(input: {
    runId: string;
    companyId: string;
    actorId: string;
    sessionKey: string;
    startedAt?: number;
    thinkingLevel?: string | null;
    payload?: Record<string, unknown>;
  }) {
    const db = this.deps.getDb();
    db.prepare(`
      INSERT INTO executor_runs (id, company_id, actor_id, session_key, status, started_at, finished_at, payload_json)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      input.runId,
      input.companyId,
      input.actorId,
      input.sessionKey,
      "accepted",
      input.startedAt ?? Date.now(),
      null,
      JSON.stringify({
        ...(input.payload ?? {}),
        thinkingLevel: input.thinkingLevel ?? null,
        lastEventAt: input.startedAt ?? Date.now(),
      }),
    );
  }

  updateExecutorRun(
    runId: string,
    status: AgentRunRecord["state"],
    payload?: Record<string, unknown>,
  ) {
    const db = this.deps.getDb();
    const existing = db.prepare("SELECT payload_json FROM executor_runs WHERE id = ?").get(runId) as
      | { payload_json?: string }
      | undefined;
    const terminal = status === "completed" || status === "error" || status === "aborted";
    const timestamp = Date.now();
    const nextPayload = {
      ...parseJson<Record<string, unknown>>(existing?.payload_json, {}),
      ...(payload ?? {}),
      lastEventAt: timestamp,
    };
    db.prepare(`
      UPDATE executor_runs
      SET status = ?, finished_at = ?, payload_json = ?
      WHERE id = ?
    `).run(status, terminal ? timestamp : null, JSON.stringify(nextPayload), runId);
  }

  appendAssistantMessage(sessionKey: string, message: StoredChatMessage) {
    const context = this.getConversationContext(sessionKey);
    if (!context) {
      return null;
    }
    this.appendConversationMessage(context.companyId, sessionKey, message);
    return context;
  }

  applyAssistantControlMessage(sessionKey: string, message: StoredChatMessage) {
    const context = this.getConversationContext(sessionKey);
    if (!context) {
      return {
        context: null,
        changed: false,
        violations: [] as string[],
      };
    }
    const currentRuntime = this.deps.loadRuntime(context.companyId);
    const reconciled = reconcileAuthorityRequirementRuntime({
      company: this.deps.loadCompanyById(context.companyId),
      runtime: currentRuntime,
      controlUpdate: {
        sessionKey,
        message: message as unknown as ChatMessage,
        timestamp: typeof message.timestamp === "number" ? message.timestamp : Date.now(),
      },
    });
    const changed = runtimeRequirementControlChanged(currentRuntime, reconciled.runtime);
    if (changed) {
      this.deps.saveRuntime(reconciled.runtime);
    }
    return {
      context,
      changed,
      violations: reconciled.violations,
    };
  }
}

function truncate(input: string, max = 80) {
  return input.length > max ? `${input.slice(0, max - 1)}…` : input;
}
