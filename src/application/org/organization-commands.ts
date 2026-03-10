import { applyOrgRecommendation, type OrgAdvisorSnapshot } from "../../application/assignment/org-fit";
import { type ChatMessage } from "../../application/gateway";
import {
  applyHrDepartmentPlan,
  parseHrDepartmentPlan,
  resolveMetaAgentId,
} from "../../application/org/employee-ops";
import type { Company, Department } from "../../domain/org/types";
import {
  applyDepartmentLeadConstraints,
  applyOneClickOrgFixups,
  resolveOrgIssues,
} from "../../domain/org/policies";

export function extractChatMessageText(message?: ChatMessage | null): string {
  if (!message) {
    return "";
  }
  if (typeof message.content === "string") {
    return message.content;
  }
  if (Array.isArray(message.content)) {
    return message.content
      .map((block) => {
        if (typeof block === "string") {
          return block;
        }
        if (block && typeof block === "object" && !Array.isArray(block)) {
          const record = block as Record<string, unknown>;
          if (record.type === "text" && typeof record.text === "string") {
            return record.text;
          }
        }
        return "";
      })
      .join("\n")
      .trim();
  }
  if (typeof message.text === "string") {
    return message.text;
  }
  return "";
}

export function buildHrDepartmentBootstrapPrompt(company: Company) {
  const snapshot = {
    companyId: company.id,
    companyName: company.name,
    template: company.template,
    departments: Array.isArray(company.departments) ? company.departments : [],
    employees: company.employees.map((employee) => ({
      agentId: employee.agentId,
      departmentId: employee.departmentId ?? null,
      isMeta: employee.isMeta,
      metaRole: employee.metaRole ?? null,
      nickname: employee.nickname,
      reportsTo: employee.reportsTo ?? null,
      role: employee.role,
    })),
  };

  return (
    `你是该公司的 HR。请你负责“部门建立 + 汇报线校准”。\n\n` +
    `目标：让组织图不割裂、部门边界清晰。\n` +
    `规则：\n` +
    `- 部门必须绑定一个真实员工节点作为负责人（leadAgentId 必须是 employees 里的 agentId）。\n` +
    `- 每个部门负责人默认向 CEO 汇报（reportsTo=CEO）。\n` +
    `- 必须包含元部门：管理中枢(CEO)、人力资源部(HR)、技术部(CTO)、运营部(COO)。\n` +
    `- 普通员工默认归入部门，并尽量挂到该部门负责人下面（除非你认为更合理）。\n` +
    `- 不要改 meta 管理层的岗位，只在必要时调整他们的 reportsTo 来保证结构合理。\n\n` +
    `请输出结构化 JSON 方案（不要输出解释性文字），格式必须是一个 \`\`\`json 代码块：\n` +
    `\n\`\`\`json\n` +
    `{\n` +
    `  "kind": "cyber-company.departmentPlan.v1",\n` +
    `  "companyId": "${company.id}",\n` +
    `  "departments": [ { "id": "dep-...", "name": "...", "leadAgentId": "...", "color": "amber", "order": 0 } ],\n` +
    `  "employees": [ { "agentId": "...", "departmentId": "dep-...", "reportsTo": "..." } ]\n` +
    `}\n` +
    `\`\`\`\n\n` +
    `当前快照如下：\n\n` +
    `\`\`\`json\n${JSON.stringify(snapshot, null, 2)}\n\`\`\`\n`
  );
}

export function resolveHrBootstrapAgentId(company: Company) {
  return resolveMetaAgentId(company, "hr");
}

export function applyHrDepartmentPlanToCompany(company: Company, rawText: string) {
  const plan = parseHrDepartmentPlan(rawText);
  if (!plan) {
    return {
      error: "请让 HR 严格输出 departmentPlan.v1 的 JSON 代码块。",
      ok: false as const,
    };
  }
  if (plan.companyId !== company.id) {
    return {
      error: `期望 companyId=${company.id}，实际=${plan.companyId}`,
      ok: false as const,
    };
  }

  const applied = applyHrDepartmentPlan({ company, plan });
  const normalized = applyOneClickOrgFixups({
    company,
    nextDepartments: applied.departments,
    nextEmployees: applied.employees,
  });

  return {
    ok: true as const,
    normalized,
    warnings: [...applied.warnings, ...normalized.warnings],
  };
}

export function buildFixedOrganization(company: Company) {
  const nextDepartments = Array.isArray(company.departments) ? company.departments : [];
  const normalized = applyOneClickOrgFixups({
    company,
    nextDepartments,
    nextEmployees: company.employees,
  });
  return {
    issuesAfter: resolveOrgIssues({ employees: normalized.employees }).length,
    normalized,
  };
}

export function applyOrgRecommendationToCompany(
  company: Company,
  advisor: OrgAdvisorSnapshot | null,
  recommendationId: string,
) {
  const recommendation = advisor?.recommendations.find((item) => item.id === recommendationId);
  if (!recommendation) {
    return null;
  }
  return applyOrgRecommendation({
    company,
    recommendation,
  });
}

export function buildUpdatedEmployeeProfiles(
  company: Company,
  agentId: string,
  nickname: string,
  role: string,
) {
  return company.employees.map((employee) => {
    if (employee.agentId === agentId) {
      return { ...employee, nickname, role };
    }
    return employee;
  });
}

export function buildSavedDepartments(company: Company, nextDepartments: Department[]) {
  return applyDepartmentLeadConstraints({
    company,
    nextDepartments,
    nextEmployees: company.employees,
  });
}
