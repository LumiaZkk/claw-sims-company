import type { DatabaseSync } from "node:sqlite";
import type { CyberCompanyConfig } from "../../../../src/domain/org/types";
import {
  createDefaultStoredExecutorConfig,
  parseJson,
  sanitizeStoredExecutorConfig,
  type StoredExecutorConfig,
} from "../persistence/authority-persistence-shared";
import { listDesiredManagedExecutorAgents } from "../company/company-executor-sync";

export type ManagedExecutorAgentRow = {
  agentId: string;
  companyId: string | null;
  desiredPresent: boolean;
  updatedAt: number;
};

type AuthorityExecutorStateStoreDependencies = {
  getDb: () => DatabaseSync;
  readStoredConfig: () => CyberCompanyConfig | null;
};

export class AuthorityExecutorStateStore {
  constructor(private readonly deps: AuthorityExecutorStateStoreDependencies) {}

  loadExecutorConfig(): StoredExecutorConfig {
    const db = this.deps.getDb();
    const row = db.prepare("SELECT config_json FROM executor_configs WHERE id = ?").get("default") as
      | { config_json?: string }
      | undefined;
    return sanitizeStoredExecutorConfig(parseJson(row?.config_json, createDefaultStoredExecutorConfig()));
  }

  saveExecutorConfig(config: StoredExecutorConfig): StoredExecutorConfig {
    const db = this.deps.getDb();
    const normalized = sanitizeStoredExecutorConfig(config);
    db.prepare(`
      INSERT INTO executor_configs (id, adapter, config_json, updated_at)
      VALUES (?, ?, ?, ?)
      ON CONFLICT(id) DO UPDATE SET
        adapter = excluded.adapter,
        config_json = excluded.config_json,
        updated_at = excluded.updated_at
    `).run("default", "openclaw-bridge", JSON.stringify(normalized), Date.now());
    return normalized;
  }

  listManagedExecutorAgents(): ManagedExecutorAgentRow[] {
    const db = this.deps.getDb();
    const rows = db.prepare(`
      SELECT agent_id, company_id, desired_present, updated_at
      FROM managed_executor_agents
      ORDER BY updated_at ASC, agent_id ASC
    `).all() as Array<{
      agent_id: string;
      company_id: string | null;
      desired_present: number;
      updated_at: number;
    }>;
    return rows.map((row) => ({
      agentId: row.agent_id,
      companyId: row.company_id ?? null,
      desiredPresent: row.desired_present === 1,
      updatedAt: row.updated_at,
    }));
  }

  clearManagedExecutorAgent(agentId: string) {
    const db = this.deps.getDb();
    db.prepare("DELETE FROM managed_executor_agents WHERE agent_id = ?").run(agentId);
  }

  clearManagedExecutorAgentsForCompany(companyId: string) {
    const db = this.deps.getDb();
    db.prepare("DELETE FROM managed_executor_agents WHERE company_id = ?").run(companyId);
  }

  syncManagedExecutorAgentTargets(
    previousConfig: CyberCompanyConfig | null,
    nextConfig: CyberCompanyConfig | null,
  ) {
    const previousTargets = new Map(
      listDesiredManagedExecutorAgents(previousConfig).map((target) => [target.agentId, target] as const),
    );
    const nextTargets = new Map(
      listDesiredManagedExecutorAgents(nextConfig).map((target) => [target.agentId, target] as const),
    );
    const currentTargets = new Map(
      this.listManagedExecutorAgents().map((row) => [row.agentId, row] as const),
    );

    for (const target of nextTargets.values()) {
      this.upsertManagedExecutorAgent({
        agentId: target.agentId,
        companyId: target.companyId,
        desiredPresent: true,
      });
    }

    const absentIds = new Set<string>();
    for (const row of currentTargets.values()) {
      if (row.desiredPresent && !nextTargets.has(row.agentId)) {
        absentIds.add(row.agentId);
      }
    }
    for (const target of previousTargets.values()) {
      if (!nextTargets.has(target.agentId)) {
        absentIds.add(target.agentId);
      }
    }

    for (const agentId of absentIds) {
      this.upsertManagedExecutorAgent({
        agentId,
        companyId: currentTargets.get(agentId)?.companyId ?? previousTargets.get(agentId)?.companyId ?? null,
        desiredPresent: false,
      });
    }
  }

  ensureManagedExecutorAgentInventory() {
    const db = this.deps.getDb();
    const row = db.prepare("SELECT COUNT(*) as count FROM managed_executor_agents").get() as
      | { count?: number }
      | undefined;
    if ((row?.count ?? 0) > 0) {
      return;
    }
    this.syncManagedExecutorAgentTargets(null, this.deps.readStoredConfig());
  }

  private upsertManagedExecutorAgent(input: {
    agentId: string;
    companyId: string | null;
    desiredPresent: boolean;
  }) {
    const db = this.deps.getDb();
    db.prepare(`
      INSERT INTO managed_executor_agents (agent_id, company_id, desired_present, updated_at)
      VALUES (?, ?, ?, ?)
      ON CONFLICT(agent_id) DO UPDATE SET
        company_id = excluded.company_id,
        desired_present = excluded.desired_present,
        updated_at = excluded.updated_at
    `).run(
      input.agentId,
      input.companyId,
      input.desiredPresent ? 1 : 0,
      Date.now(),
    );
  }
}
