import type { DatabaseSync } from "node:sqlite";
import {
  applyTakeoverCaseWorkflowAction,
  takeoverCaseRecordToCase,
} from "../../../../src/application/delegation/takeover-case";
import { createCompanyEvent } from "../../../../src/domain/delegation/events";
import type { ApprovalRecord } from "../../../../src/domain/governance/types";
import { normalizeApprovalRecord, sortApprovals } from "../../../../src/domain/governance/approval";
import { buildDefaultMainCompany, isReservedSystemCompany } from "../../../../src/domain/org/system-company";
import type { Company, CyberCompanyConfig, EmployeeRef } from "../../../../src/domain/org/types";
import type {
  AuthorityApprovalMutationResponse,
  AuthorityApprovalRequest,
  AuthorityApprovalResolveRequest,
  AuthorityBootstrapSnapshot,
  AuthorityCompanyRuntimeSnapshot,
  AuthorityTakeoverCaseCommandRequest,
} from "../../../../src/infrastructure/authority/contract";
import {
  approvalMaterialChanged,
  isPresent,
  normalizeApprovalRevision,
  normalizeCompany,
  parseJson,
  shallowJsonEqual,
} from "../persistence/authority-persistence-shared";
import { buildManagedExecutorFiles, buildManagedExecutorFilesForCompany } from "./company-executor-sync";

type AuthorityCompanyStoreDependencies = {
  getDb: () => DatabaseSync;
  getActiveCompanyId: () => string | null;
  setActiveCompanyId: (companyId: string | null) => void;
  loadRuntime: (companyId: string) => AuthorityCompanyRuntimeSnapshot;
  saveRuntime: (snapshot: AuthorityCompanyRuntimeSnapshot) => AuthorityCompanyRuntimeSnapshot;
  setAgentFile: (agentId: string, name: string, content: string) => { changed: boolean };
  syncManagedExecutorAgentTargets: (
    previousConfig: CyberCompanyConfig | null,
    nextConfig: CyberCompanyConfig | null,
  ) => void;
  appendCompanyEvent: (event: ReturnType<typeof createCompanyEvent>) => unknown;
  getBootstrap: () => AuthorityBootstrapSnapshot;
};

export class AuthorityCompanyStore {
  constructor(private readonly deps: AuthorityCompanyStoreDependencies) {}

  readStoredConfig(): CyberCompanyConfig | null {
    const db = this.deps.getDb();
    const rows = db.prepare("SELECT company_json FROM companies ORDER BY created_at ASC").all() as Array<{
      company_json: string;
    }>;
    if (rows.length === 0) {
      return null;
    }
    const companies = rows
      .map((row) => parseJson<Company | null>(row.company_json, null))
      .map((company) => (company ? normalizeCompany(company) : null))
      .filter(isPresent);
    if (companies.length === 0) {
      return null;
    }
    const activeCompanyId =
      this.deps.getActiveCompanyId() && companies.some((company) => company.id === this.deps.getActiveCompanyId())
        ? this.deps.getActiveCompanyId()!
        : companies[0]!.id;
    return {
      version: 1,
      companies,
      activeCompanyId,
      preferences: { theme: "classic", locale: "zh-CN" },
    };
  }

  loadConfig(): CyberCompanyConfig | null {
    const stored = this.readStoredConfig();
    if (stored) {
      return stored;
    }
    const defaultCompany = this.ensureDefaultMainCompany();
    return {
      version: 1,
      companies: [defaultCompany],
      activeCompanyId: defaultCompany.id,
      preferences: { theme: "classic", locale: "zh-CN" },
    };
  }

  loadCompanyById(companyId: string): Company | null {
    const db = this.deps.getDb();
    const row = db.prepare("SELECT company_json FROM companies WHERE id = ?").get(companyId) as
      | { company_json?: string }
      | undefined;
    const company = parseJson<Company | null>(row?.company_json, null);
    return company ? normalizeCompany(company) : null;
  }

  saveConfig(config: CyberCompanyConfig) {
    const db = this.deps.getDb();
    const previousConfig = this.readStoredConfig();
    const existingCompanyRows = db.prepare("SELECT id FROM companies").all() as Array<{ id: string }>;
    const nextIds = new Set(config.companies.map((company) => company.id));
    for (const row of existingCompanyRows) {
      if (!nextIds.has(row.id)) {
        this.deleteCompanyData(row.id);
      }
    }

    for (const rawCompany of config.companies) {
      const company = normalizeCompany(rawCompany);
      db.prepare(`
        INSERT INTO companies (id, name, company_json, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?)
        ON CONFLICT(id) DO UPDATE SET
          name = excluded.name,
          company_json = excluded.company_json,
          updated_at = excluded.updated_at
      `).run(
        company.id,
        company.name,
        JSON.stringify(company),
        company.createdAt,
        Date.now(),
      );
      this.replaceCompanyTables(company);
      const currentRuntime = this.deps.loadRuntime(company.id);
      this.deps.saveRuntime({
        ...currentRuntime,
        companyId: company.id,
        activeSupportRequests:
          currentRuntime.activeSupportRequests.length > 0
            ? currentRuntime.activeSupportRequests
            : (company.supportRequests ?? []),
        activeEscalations:
          currentRuntime.activeEscalations.length > 0
            ? currentRuntime.activeEscalations
            : company.escalations ?? [],
        activeDecisionTickets:
          currentRuntime.activeDecisionTickets.length > 0
            ? currentRuntime.activeDecisionTickets
            : company.decisionTickets ?? [],
      });
    }

    this.syncManagedCompanyFiles(config);
    this.deps.setActiveCompanyId(config.companies.length > 0 ? config.activeCompanyId : null);
    this.deps.syncManagedExecutorAgentTargets(previousConfig, config);
  }

  deleteCompany(companyId: string) {
    const currentConfig = this.loadConfig();
    const company = currentConfig?.companies.find((entry) => entry.id === companyId) ?? this.loadCompanyById(companyId);
    if (isReservedSystemCompany(company)) {
      throw new Error("系统默认公司不可删除。");
    }
    if (!currentConfig || !currentConfig.companies.some((entry) => entry.id === companyId)) {
      return;
    }

    const nextCompanies = currentConfig.companies.filter((entry) => entry.id !== companyId);
    if (nextCompanies.length === 0) {
      this.deleteCompanyData(companyId);
      this.deps.syncManagedExecutorAgentTargets(currentConfig, null);
      this.deps.setActiveCompanyId(null);
      return;
    }

    this.saveConfig({
      ...currentConfig,
      companies: nextCompanies,
      activeCompanyId:
        currentConfig.activeCompanyId === companyId
          ? nextCompanies[0]!.id
          : currentConfig.activeCompanyId,
    });
  }

  switchCompany(companyId: string) {
    const config = this.loadConfig();
    if (!config || !config.companies.some((company) => company.id === companyId)) {
      throw new Error(`Unknown company: ${companyId}`);
    }
    this.deps.setActiveCompanyId(companyId);
  }

  requestApproval(input: AuthorityApprovalRequest): AuthorityApprovalMutationResponse {
    const config = this.loadConfig();
    if (!config) {
      throw new Error("Authority 尚未加载公司配置。");
    }
    const company = config.companies.find((item) => item.id === input.companyId) ?? null;
    if (!company) {
      throw new Error(`Unknown company: ${input.companyId}`);
    }

    const now = input.timestamp ?? Date.now();
    const candidate: ApprovalRecord = normalizeApprovalRecord({
      id: crypto.randomUUID(),
      companyId: company.id,
      revision: 1,
      scope: input.scope,
      actionType: input.actionType,
      status: "pending",
      summary: input.summary,
      detail: input.detail ?? null,
      requestedByActorId: input.requestedByActorId ?? "operator:local-user",
      requestedByLabel: input.requestedByLabel ?? "当前操作者",
      targetActorId: input.targetActorId ?? null,
      targetLabel: input.targetLabel ?? null,
      payload: input.payload ?? {},
      requestedAt: now,
      resolution: null,
      decidedByActorId: null,
      decidedByLabel: null,
      createdAt: now,
      updatedAt: now,
      resolvedAt: null,
    });

    const existingPending =
      (company.approvals ?? []).find((record) => {
        const normalized = normalizeApprovalRecord(record);
        return (
          normalized.status === "pending" &&
          normalized.scope === candidate.scope &&
          normalized.actionType === candidate.actionType &&
          (normalized.targetActorId ?? null) === (candidate.targetActorId ?? null) &&
          shallowJsonEqual(normalized.payload ?? {}, candidate.payload ?? {})
        );
      }) ?? null;

    if (existingPending) {
      return {
        bootstrap: this.deps.getBootstrap(),
        approval: normalizeApprovalRecord(existingPending),
      };
    }

    const nextCompany = normalizeCompany({
      ...company,
      approvals: sortApprovals([candidate, ...(company.approvals ?? [])]),
    });
    const nextConfig: CyberCompanyConfig = {
      ...config,
      companies: config.companies.map((item) => (item.id === company.id ? nextCompany : item)),
    };
    this.saveConfig(nextConfig);
    this.deps.appendCompanyEvent(
      createCompanyEvent({
        companyId: company.id,
        kind: "approval_record_upserted",
        fromActorId: candidate.requestedByActorId ?? "operator:local-user",
        targetActorId: candidate.targetActorId ?? undefined,
        createdAt: candidate.updatedAt,
        payload: {
          approvalId: candidate.id,
          revision: normalizeApprovalRevision(candidate.revision),
          scope: candidate.scope,
          actionType: candidate.actionType,
          status: candidate.status,
          summary: candidate.summary,
          detail: candidate.detail ?? null,
          requestedByLabel: candidate.requestedByLabel ?? null,
          targetLabel: candidate.targetLabel ?? null,
          payload: candidate.payload ?? {},
        },
      }),
    );
    return {
      bootstrap: this.deps.getBootstrap(),
      approval: candidate,
    };
  }

  resolveApproval(input: AuthorityApprovalResolveRequest): AuthorityApprovalMutationResponse {
    const config = this.loadConfig();
    if (!config) {
      throw new Error("Authority 尚未加载公司配置。");
    }
    const company = config.companies.find((item) => item.id === input.companyId) ?? null;
    if (!company) {
      throw new Error(`Unknown company: ${input.companyId}`);
    }
    const existing = (company.approvals ?? []).find((record) => record.id === input.approvalId) ?? null;
    if (!existing) {
      throw new Error(`Unknown approval: ${input.approvalId}`);
    }
    const normalizedExisting = normalizeApprovalRecord(existing);
    if (normalizedExisting.status !== "pending") {
      return {
        bootstrap: this.deps.getBootstrap(),
        approval: normalizedExisting,
      };
    }

    const resolvedAt = input.timestamp ?? Date.now();
    const candidate = normalizeApprovalRecord({
      ...normalizedExisting,
      status: input.decision,
      resolution: input.resolution ?? normalizedExisting.resolution ?? null,
      decidedByActorId: input.decidedByActorId ?? "operator:local-user",
      decidedByLabel: input.decidedByLabel ?? "当前操作者",
      resolvedAt,
      updatedAt: resolvedAt,
      revision: normalizeApprovalRevision(normalizedExisting.revision) + 1,
    });
    const nextApproval = approvalMaterialChanged(normalizedExisting, candidate)
      ? candidate
      : normalizedExisting;

    const nextCompany = normalizeCompany({
      ...company,
      approvals: sortApprovals(
        (company.approvals ?? []).map((record) =>
          record.id === nextApproval.id ? nextApproval : normalizeApprovalRecord(record),
        ),
      ),
    });
    const nextConfig: CyberCompanyConfig = {
      ...config,
      companies: config.companies.map((item) => (item.id === company.id ? nextCompany : item)),
    };
    this.saveConfig(nextConfig);
    this.deps.appendCompanyEvent(
      createCompanyEvent({
        companyId: company.id,
        kind: input.decision === "approved" ? "approval_resolved" : "approval_rejected",
        fromActorId: nextApproval.decidedByActorId ?? "operator:local-user",
        targetActorId: nextApproval.targetActorId ?? undefined,
        createdAt: nextApproval.updatedAt,
        payload: {
          approvalId: nextApproval.id,
          revision: normalizeApprovalRevision(nextApproval.revision),
          scope: nextApproval.scope,
          actionType: nextApproval.actionType,
          status: nextApproval.status,
          summary: nextApproval.summary,
          detail: nextApproval.detail ?? null,
          resolution: nextApproval.resolution ?? null,
          requestedByLabel: nextApproval.requestedByLabel ?? null,
          decidedByLabel: nextApproval.decidedByLabel ?? null,
          targetLabel: nextApproval.targetLabel ?? null,
          payload: nextApproval.payload ?? {},
        },
      }),
    );
    return {
      bootstrap: this.deps.getBootstrap(),
      approval: nextApproval,
    };
  }

  transitionTakeoverCase(input: AuthorityTakeoverCaseCommandRequest) {
    const config = this.loadConfig();
    if (!config) {
      throw new Error("Authority 尚未加载公司配置。");
    }
    const company = config.companies.find((item) => item.id === input.companyId) ?? null;
    if (!company) {
      throw new Error(`Unknown company: ${input.companyId}`);
    }

    const nextTakeoverCases = applyTakeoverCaseWorkflowAction({
      company,
      caseItem: takeoverCaseRecordToCase(input.caseRecord),
      action: input.action,
      actorId: input.actorId,
      actorLabel: input.actorLabel,
      assigneeAgentId: input.assigneeAgentId,
      assigneeLabel: input.assigneeLabel,
      note: input.note,
      dispatchId: input.dispatchId,
      timestamp: input.timestamp,
    });
    const nextTakeoverCase =
      nextTakeoverCases.find((record) => record.id === input.caseRecord.id)
      ?? nextTakeoverCases.find((record) => record.sourceSessionKey === input.caseRecord.sourceSessionKey)
      ?? null;
    if (!nextTakeoverCase) {
      throw new Error(`Failed to persist takeover case: ${input.caseRecord.id}`);
    }

    const nextCompany = normalizeCompany({
      ...company,
      takeoverCases: nextTakeoverCases,
    });
    const nextConfig: CyberCompanyConfig = {
      ...config,
      companies: config.companies.map((item) => (item.id === company.id ? nextCompany : item)),
    };
    this.saveConfig(nextConfig);
    this.deps.appendCompanyEvent(
      createCompanyEvent({
        companyId: company.id,
        kind: "takeover_case_updated",
        dispatchId: input.dispatchId ?? nextTakeoverCase.sourceDispatchId ?? undefined,
        workItemId: nextTakeoverCase.sourceWorkItemId ?? undefined,
        topicKey: nextTakeoverCase.sourceTopicKey ?? undefined,
        roomId: nextTakeoverCase.sourceRoomId ?? undefined,
        fromActorId: input.actorId ?? "operator:local-user",
        targetActorId: nextTakeoverCase.assigneeAgentId ?? nextTakeoverCase.ownerAgentId ?? undefined,
        sessionKey: nextTakeoverCase.sourceSessionKey,
        createdAt: nextTakeoverCase.updatedAt,
        payload: {
          takeoverCaseId: nextTakeoverCase.id,
          status: nextTakeoverCase.status,
          action: input.action,
          title: nextTakeoverCase.title,
          route: nextTakeoverCase.route,
          ownerAgentId: nextTakeoverCase.ownerAgentId ?? null,
          ownerLabel: nextTakeoverCase.ownerLabel ?? null,
          assigneeAgentId: nextTakeoverCase.assigneeAgentId ?? null,
          assigneeLabel: nextTakeoverCase.assigneeLabel ?? null,
          sourceSessionKey: nextTakeoverCase.sourceSessionKey,
          sourceWorkItemId: nextTakeoverCase.sourceWorkItemId ?? null,
          sourceTopicKey: nextTakeoverCase.sourceTopicKey ?? null,
          sourceDispatchId: nextTakeoverCase.sourceDispatchId ?? null,
          redispatchId: input.dispatchId ?? null,
          sourceRoomId: nextTakeoverCase.sourceRoomId ?? null,
          failureSummary: nextTakeoverCase.failureSummary,
          recommendedNextAction: nextTakeoverCase.recommendedNextAction,
          note: input.note ?? null,
          auditTrailLength: nextTakeoverCase.auditTrail?.length ?? 0,
        },
      }),
    );
    return {
      bootstrap: this.deps.getBootstrap(),
      takeoverCase: nextTakeoverCase,
    };
  }

  findCompanyIdByAgentId(agentId: string): string | null {
    const db = this.deps.getDb();
    const row = db.prepare("SELECT company_id FROM employees WHERE agent_id = ?").get(agentId) as
      | { company_id?: string | null }
      | undefined;
    return row?.company_id ?? null;
  }

  listActors() {
    const db = this.deps.getDb();
    const activeCompanyId = this.deps.getActiveCompanyId();
    const rows = activeCompanyId
      ? (db.prepare("SELECT payload_json FROM employees WHERE company_id = ? ORDER BY is_meta DESC, nickname ASC").all(activeCompanyId) as Array<{
          payload_json: string;
        }>)
      : (db.prepare("SELECT payload_json FROM employees ORDER BY nickname ASC").all() as Array<{
          payload_json: string;
        }>);
    const employees = rows
      .map((row) => parseJson<EmployeeRef | null>(row.payload_json, null))
      .filter(isPresent);
    return {
      agents: employees.map((employee) => ({
        id: employee.agentId,
        name: employee.nickname,
        identity: {
          name: employee.role,
        },
      })),
    };
  }

  hasCompany(companyId: string): boolean {
    return Boolean(this.loadCompanyById(companyId));
  }

  getCompanyAgentIds(companyId?: string | null): string[] {
    const db = this.deps.getDb();
    const targetCompanyId = companyId ?? this.deps.getActiveCompanyId();
    if (!targetCompanyId) {
      return [];
    }
    const rows = db.prepare("SELECT agent_id FROM employees WHERE company_id = ?").all(targetCompanyId) as Array<{
      agent_id: string;
    }>;
    return rows.map((row) => row.agent_id);
  }

  private ensureDefaultMainCompany(): Company {
    const defaultTemplate = buildDefaultMainCompany();
    const existing = this.loadCompanyById(defaultTemplate.id);
    if (existing) {
      return existing;
    }

    const { company, agentFiles } = buildDefaultMainCompanyDefinition();
    this.saveConfig({
      version: 1,
      companies: [company],
      activeCompanyId: company.id,
      preferences: { theme: "classic", locale: "zh-CN" },
    });
    for (const file of agentFiles) {
      this.deps.setAgentFile(file.agentId, file.name, file.content);
    }
    return company;
  }

  private replaceCompanyTables(company: Company) {
    const db = this.deps.getDb();
    db.prepare("DELETE FROM departments WHERE company_id = ?").run(company.id);
    db.prepare("DELETE FROM employees WHERE company_id = ?").run(company.id);
    for (const department of company.departments ?? []) {
      db.prepare(`
        INSERT INTO departments (id, company_id, name, lead_agent_id, color, sort_order, archived, payload_json)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        ON CONFLICT(id) DO UPDATE SET
          company_id = excluded.company_id,
          name = excluded.name,
          lead_agent_id = excluded.lead_agent_id,
          color = excluded.color,
          sort_order = excluded.sort_order,
          archived = excluded.archived,
          payload_json = excluded.payload_json
      `).run(
        department.id,
        company.id,
        department.name,
        department.leadAgentId ?? null,
        department.color ?? null,
        department.order ?? null,
        department.archived ? 1 : 0,
        JSON.stringify(department),
      );
    }
    for (const employee of company.employees) {
      db.prepare(`
        INSERT INTO employees (agent_id, company_id, nickname, role, is_meta, meta_role, reports_to, department_id, payload_json)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
        ON CONFLICT(agent_id) DO UPDATE SET
          company_id = excluded.company_id,
          nickname = excluded.nickname,
          role = excluded.role,
          is_meta = excluded.is_meta,
          meta_role = excluded.meta_role,
          reports_to = excluded.reports_to,
          department_id = excluded.department_id,
          payload_json = excluded.payload_json
      `).run(
        employee.agentId,
        company.id,
        employee.nickname,
        employee.role,
        employee.isMeta ? 1 : 0,
        employee.metaRole ?? null,
        employee.reportsTo ?? null,
        employee.departmentId ?? null,
        JSON.stringify(employee),
      );
    }
  }

  private syncManagedCompanyFiles(config: CyberCompanyConfig | null) {
    const runtimeByCompanyId = new Map(
      (config?.companies ?? []).map((company) => [company.id, this.deps.loadRuntime(company.id)] as const),
    );
    for (const file of buildManagedExecutorFiles(config, runtimeByCompanyId)) {
      this.deps.setAgentFile(file.agentId, file.name, file.content);
    }
  }

  private deleteCompanyData(companyId: string) {
    const db = this.deps.getDb();
    const employeeIds = db.prepare("SELECT agent_id FROM employees WHERE company_id = ?").all(companyId) as Array<{
      agent_id: string;
    }>;
    const tables = [
      "companies",
      "departments",
      "employees",
      "runtimes",
      "conversations",
      "conversation_messages",
      "conversation_states",
      "work_items",
      "projects",
      "requirement_aggregates",
      "requirement_evidence",
      "rooms",
      "room_bindings",
      "support_requests",
      "escalations",
      "decision_tickets",
      "dispatches",
      "rounds",
      "artifacts",
      "missions",
      "event_log",
      "executor_runs",
    ] as const;
    for (const table of tables) {
      const column =
        table === "companies"
          ? "id"
          : table === "conversations"
            ? "company_id"
            : table === "conversation_messages"
              ? "company_id"
              : "company_id";
      db.prepare(`DELETE FROM ${table} WHERE ${column} = ?`).run(companyId);
    }
    for (const employeeId of employeeIds) {
      db.prepare("DELETE FROM agent_files WHERE agent_id = ?").run(employeeId.agent_id);
    }
  }
}

function buildDefaultMainCompanyDefinition(): {
  company: Company;
  agentFiles: Array<{ agentId: string; name: string; content: string }>;
} {
  const company = buildDefaultMainCompany();
  return {
    company,
    agentFiles: buildManagedExecutorFilesForCompany(company),
  };
}
