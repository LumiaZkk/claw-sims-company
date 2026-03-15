import {
  buildCeoOperationsGuide,
  buildCompanyContextSnapshot,
  buildDepartmentContextSnapshot,
  buildDepartmentOperationsGuide,
} from "../../../src/application/company/agent-context";
import {
  buildCollaborationContextSnapshot,
  type CollaborationActorSnapshot,
} from "../../../src/application/company/collaboration-context";
import type {
  DecisionTicketRecord,
  EscalationRecord,
  SupportRequestRecord,
} from "../../../src/domain/delegation/types";
import type { WorkItemRecord } from "../../../src/domain/mission/types";
import type { Company, EmployeeRef } from "../../../src/domain/org/types";

export const MANAGED_EXECUTOR_RULES_FILE_NAME = "AGENTS.md";
export const MANAGED_EXECUTOR_MEMORY_FILE_NAME = "MEMORY.md";
export const MANAGED_EXECUTOR_SOUL_FILE_NAME = "SOUL.md";

export type ManagedExecutorRuntimeFacts = {
  activeWorkItems?: WorkItemRecord[];
  activeSupportRequests?: SupportRequestRecord[];
  activeEscalations?: EscalationRecord[];
  activeDecisionTickets?: DecisionTicketRecord[];
};

function managesDepartment(company: Company, employee: EmployeeRef): boolean {
  return (company.departments ?? []).some(
    (department) => !department.archived && department.leadAgentId === employee.agentId,
  );
}

function normalizeProjectionReferences(content: string) {
  return content
    .replaceAll("`company-context.json`", "`MEMORY.md`")
    .replaceAll("`department-context.json`", "`MEMORY.md`")
    .replaceAll("`collaboration-context.json`", "`MEMORY.md`")
    .replaceAll("`OPERATIONS.md`", "`AGENTS.md`")
    .replaceAll("`DEPARTMENT-OPERATIONS.md`", "`AGENTS.md`");
}

function formatActorLine(actor: CollaborationActorSnapshot) {
  const dept = actor.departmentName ? ` · ${actor.departmentName}` : "";
  const meta = actor.metaRole ? ` · ${actor.metaRole}` : "";
  return `- ${actor.nickname} (${actor.agentId}) · ${actor.role}${dept}${meta}`;
}

function buildIndividualContributorGuide(input: {
  company: Company;
  employee: EmployeeRef;
}) {
  const manager = input.employee.reportsTo
    ? input.company.employees.find((candidate) => candidate.agentId === input.employee.reportsTo) ?? null
    : null;
  return `# 员工执行准则

公司：${input.company.name}
员工：${input.employee.nickname || input.employee.agentId}

## 开场动作
1. 先读取 \`MEMORY.md\`，确认当前公司、部门、默认汇报链和可协作对象。
2. 再读取 \`SOUL.md\`，明确你的角色边界、专业职责和沟通方式。
3. 如果任务不属于你的专业范围，先汇报阻塞或建议正确承接对象，不要硬接。

## 协作规则
1. 正式任务交接优先使用 \`company_dispatch\`。
2. 向上级或派单人回传进度时，必须使用 \`company_report\` 说明 acknowledged / answered / blocked。
3. 除非 \`MEMORY.md\` 明确列出允许协作对象，否则不要绕过默认汇报链私自横跳。
4. 需要工具、流程、招聘或跨部门支持时，先按 \`MEMORY.md\` 里的升级链路上报。
5. 不要冒充 CEO、部门负责人或支持负责人做决策。${manager ? `默认先向 ${manager.nickname} (${manager.agentId}) 汇报。` : ""}
`;
}

function resolveProjectionRulesSource(input: {
  company: Company;
  employee: EmployeeRef;
  runtime?: ManagedExecutorRuntimeFacts;
}) {
  if (input.employee.metaRole === "ceo") {
    return buildCeoOperationsGuide(input.company);
  }
  if (managesDepartment(input.company, input.employee)) {
    return buildDepartmentOperationsGuide({
      company: input.company,
      managerAgentId: input.employee.agentId,
      runtime: input.runtime,
    });
  }
  return buildIndividualContributorGuide(input);
}

function stringifySection(payload: unknown) {
  return `\`\`\`json\n${JSON.stringify(payload, null, 2)}\n\`\`\``;
}

export function renderAgentRulesMarkdown(input: {
  company: Company;
  employee: EmployeeRef;
  runtime?: ManagedExecutorRuntimeFacts;
}) {
  const collaboration = buildCollaborationContextSnapshot({
    company: input.company,
    agentId: input.employee.agentId,
  });
  const rulesSource = normalizeProjectionReferences(resolveProjectionRulesSource(input).trim());

  return [
    "# AGENTS.md",
    "",
    "这是一份由 Authority 从 canonical company state 编译出的 OpenClaw 投影文件。",
    "把它当作你在 OpenClaw 侧的稳定规则入口；完整对象真相仍由 Authority 持有。",
    "",
    rulesSource,
    "",
    "## 协作边界快照",
    `- 默认汇报链：${collaboration.defaultReportChain.length > 0 ? collaboration.defaultReportChain.map((actor) => `${actor.nickname} (${actor.agentId})`).join(" -> ") : "无"}`,
    `- 可正式派单对象：${collaboration.allowedDispatchTargets.length}`,
    `- 支持对象：${collaboration.supportTargets.length}`,
    `- 升级对象：${collaboration.escalationTargets.length}`,
    "",
    "### 默认汇报链",
    ...(collaboration.defaultReportChain.length > 0
      ? collaboration.defaultReportChain.map(formatActorLine)
      : ["- 无"]),
    "",
    "### 可正式协作对象",
    ...(collaboration.allowedDispatchTargets.length > 0
      ? collaboration.allowedDispatchTargets.map((target) => `${formatActorLine(target)} · reason=${target.reason}`)
      : ["- 当前没有额外正式协作对象"]),
    "",
    "### 支持 / 升级链路",
    ...(collaboration.supportTargets.length > 0
      ? collaboration.supportTargets.map((target) => `${formatActorLine(target)} · support`)
      : ["- 当前没有额外支持对象"]),
    ...(collaboration.escalationTargets.length > 0
      ? collaboration.escalationTargets.map((target) => `${formatActorLine(target)} · escalation`)
      : ["- 当前没有额外升级对象"]),
  ].join("\n");
}

export function renderAgentMemoryMarkdown(input: {
  company: Company;
  employee: EmployeeRef;
  runtime?: ManagedExecutorRuntimeFacts;
}) {
  const collaboration = buildCollaborationContextSnapshot({
    company: input.company,
    agentId: input.employee.agentId,
  });
  const companySnapshot = buildCompanyContextSnapshot(input.company, input.runtime);
  const managerId =
    input.employee.metaRole === "ceo"
      ? input.employee.agentId
      : input.employee.departmentId
        ? (input.company.departments ?? []).find((department) => department.id === input.employee.departmentId)?.leadAgentId
        : input.employee.reportsTo ?? null;
  const departmentSnapshot = managerId
    ? buildDepartmentContextSnapshot({
        company: input.company,
        managerAgentId: managerId,
        runtime: input.runtime,
      })
    : null;

  return [
    "# MEMORY.md",
    "",
    "这是一份由 Authority 从 canonical company state 编译出的 OpenClaw 事实快照。",
    "把它当作组织、协作和当前主线的只读参考；不要手改它来伪造状态。",
    "",
    "## Self Snapshot",
    stringifySection({
      self: collaboration.self,
      manager: collaboration.manager,
    }),
    "",
    "## Collaboration Snapshot",
    stringifySection({
      allowedDispatchTargets: collaboration.allowedDispatchTargets,
      defaultReportChain: collaboration.defaultReportChain,
      supportTargets: collaboration.supportTargets,
      escalationTargets: collaboration.escalationTargets,
    }),
    "",
    "## Company Snapshot",
    stringifySection(companySnapshot),
    "",
    "## Department Snapshot",
    stringifySection(departmentSnapshot),
  ].join("\n");
}

export function compileManagedExecutorProjection(input: {
  company: Company;
  employee: EmployeeRef;
  soul: string | null;
  runtime?: ManagedExecutorRuntimeFacts;
}) {
  const files: Array<{ agentId: string; name: string; content: string }> = [];

  if (input.soul) {
    files.push({
      agentId: input.employee.agentId,
      name: MANAGED_EXECUTOR_SOUL_FILE_NAME,
      content: input.soul,
    });
  }

  files.push({
    agentId: input.employee.agentId,
    name: MANAGED_EXECUTOR_RULES_FILE_NAME,
    content: renderAgentRulesMarkdown({
      company: input.company,
      employee: input.employee,
      runtime: input.runtime,
    }),
  });
  files.push({
    agentId: input.employee.agentId,
    name: MANAGED_EXECUTOR_MEMORY_FILE_NAME,
    content: renderAgentMemoryMarkdown({
      company: input.company,
      employee: input.employee,
      runtime: input.runtime,
    }),
  });

  return files;
}
