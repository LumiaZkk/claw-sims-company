import type { Company, Department, EmployeeRef } from "./types";
import { applyOneClickOrgFixups } from "./policies";

export type HireEmployeePlanInput = {
  role: string;
  description: string;
  nickname?: string;
  reportsTo?: string | null;
  departmentId?: string | null;
  departmentName?: string | null;
  departmentKind?: Department["kind"];
  departmentColor?: string | null;
  makeDepartmentLead?: boolean;
  avatarJobId?: string;
};

export type HireEmployeePlanResult = {
  company: Company;
  employee: EmployeeRef;
  department: Department | null;
  warnings: string[];
};

export type HireEmployeesBatchPlanResult = {
  company: Company;
  hires: Array<{
    inputIndex: number;
    employee: EmployeeRef;
    department: Department | null;
  }>;
  warnings: string[];
};

function slugify(input: string) {
  return input
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9\u4e00-\u9fa5]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 32);
}

function inferNamespace(company: Company) {
  const ceoAgentId = company.employees.find((employee) => employee.metaRole === "ceo")?.agentId ?? "";
  if (ceoAgentId.endsWith("-ceo")) {
    return ceoAgentId.slice(0, -"-ceo".length);
  }
  const base = slugify(company.name) || "company";
  return `${base}-${company.id.slice(0, 6)}`;
}

function buildUniqueAgentId(company: Company, role: string) {
  const namespace = inferNamespace(company);
  const roleSlug = slugify(role) || "employee";
  const taken = new Set(company.employees.map((employee) => employee.agentId));
  const base = `${namespace}-${roleSlug}`;
  if (!taken.has(base)) {
    return base;
  }
  for (let index = 2; index < 10_000; index += 1) {
    const candidate = `${base}-${index}`;
    if (!taken.has(candidate)) {
      return candidate;
    }
  }
  throw new Error(`无法为岗位 ${role} 生成唯一 agentId。`);
}

function buildUniqueDepartmentId(company: Company, departmentName: string) {
  const base = `dept-${slugify(departmentName) || "business"}`;
  const taken = new Set((company.departments ?? []).map((department) => department.id));
  if (!taken.has(base)) {
    return base;
  }
  for (let index = 2; index < 10_000; index += 1) {
    const candidate = `${base}-${index}`;
    if (!taken.has(candidate)) {
      return candidate;
    }
  }
  throw new Error(`无法为部门 ${departmentName} 生成唯一 id。`);
}

function resolveDefaultManager(company: Company) {
  return (
    company.employees.find((employee) => employee.metaRole === "ceo")?.agentId
    ?? company.employees[0]?.agentId
    ?? null
  );
}

function normalizeDepartmentLocator(input: HireEmployeePlanInput) {
  return {
    departmentId: input.departmentId?.trim() || "",
    departmentName: input.departmentName?.trim() || "",
  };
}

function resolveRequestedDepartmentKey(company: Company, input: HireEmployeePlanInput): string | null {
  const { departmentId, departmentName } = normalizeDepartmentLocator(input);
  const departments = company.departments ?? [];
  const byId = departmentId
    ? departments.find((department) => department.id === departmentId) ?? null
    : null;
  const byName = departmentName
    ? departments.find((department) => department.name === departmentName) ?? null
    : null;
  const matchedDepartment = byId ?? byName;
  if (matchedDepartment) {
    return `dept:${matchedDepartment.id}`;
  }
  if (departmentName) {
    return `name:${departmentName.toLowerCase()}`;
  }
  if (departmentId) {
    return `id:${departmentId}`;
  }
  return null;
}

function resolveRequestedDepartmentLabel(company: Company, input: HireEmployeePlanInput): string {
  const { departmentId, departmentName } = normalizeDepartmentLocator(input);
  const departments = company.departments ?? [];
  const matchedDepartment =
    (departmentId
      ? departments.find((department) => department.id === departmentId) ?? null
      : null)
    ?? (departmentName
      ? departments.find((department) => department.name === departmentName) ?? null
      : null);
  if (matchedDepartment) {
    return matchedDepartment.name;
  }
  if (departmentName) {
    return departmentName;
  }
  if (departmentId) {
    return departmentId;
  }
  return "未命名部门";
}

function dedupeWarnings(warnings: string[]) {
  return [...new Set(warnings)];
}

export function planHiredEmployee(company: Company, input: HireEmployeePlanInput): HireEmployeePlanResult {
  const role = input.role.trim();
  const description = input.description.trim();
  if (!role) {
    throw new Error("岗位名称不能为空。");
  }
  if (!description) {
    throw new Error("岗位职责不能为空。");
  }

  const nextDepartments = [...(company.departments ?? [])];
  const agentId = buildUniqueAgentId(company, role);
  const defaultManager = resolveDefaultManager(company);
  const requestedDepartmentName = input.departmentName?.trim() || "";
  const requestedDepartmentId = input.departmentId?.trim() || "";
  let department =
    nextDepartments.find((entry) => entry.id === requestedDepartmentId)
    ?? nextDepartments.find((entry) => entry.name === requestedDepartmentName)
    ?? null;

  if (!department && requestedDepartmentName) {
    department = {
      id: buildUniqueDepartmentId(company, requestedDepartmentName),
      name: requestedDepartmentName,
      leadAgentId: input.makeDepartmentLead ? agentId : (input.reportsTo?.trim() || defaultManager || agentId),
      kind: input.departmentKind ?? "business",
      color: input.departmentColor ?? "amber",
      order: nextDepartments.length,
      missionPolicy: "manager_delegated",
    };
    nextDepartments.push(department);
  }

  if (department && input.makeDepartmentLead) {
    department = { ...department, leadAgentId: agentId };
    const targetIndex = nextDepartments.findIndex((entry) => entry.id === department?.id);
    if (targetIndex >= 0) {
      nextDepartments[targetIndex] = department;
    }
  }

  const preferredManager =
    !input.makeDepartmentLead && department?.leadAgentId?.trim()
      ? department.leadAgentId.trim()
      : null;

  const employee: EmployeeRef = {
    agentId,
    nickname: input.nickname?.trim() || role,
    role,
    isMeta: false,
    reportsTo: input.makeDepartmentLead
      ? (defaultManager ?? undefined)
      : (input.reportsTo?.trim() || preferredManager || defaultManager || undefined),
    departmentId: department?.id ?? undefined,
    ...(input.avatarJobId ? { avatarJobId: input.avatarJobId } : {}),
  };

  const normalized = applyOneClickOrgFixups({
    company,
    nextDepartments,
    nextEmployees: [...company.employees, employee],
  });

  const nextCompany: Company = {
    ...company,
    departments: normalized.departments,
    employees: normalized.employees,
  };
  const normalizedEmployee = nextCompany.employees.find((entry) => entry.agentId === agentId);
  if (!normalizedEmployee) {
    throw new Error(`新员工 ${agentId} 未能写入公司 roster。`);
  }
  const normalizedDepartment = normalizedEmployee.departmentId
    ? nextCompany.departments?.find((entry) => entry.id === normalizedEmployee.departmentId) ?? null
    : null;

  return {
    company: nextCompany,
    employee: normalizedEmployee,
    department: normalizedDepartment,
    warnings: normalized.warnings,
  };
}

export function planHiredEmployeesBatch(
  company: Company,
  inputs: HireEmployeePlanInput[],
): HireEmployeesBatchPlanResult {
  if (inputs.length === 0) {
    throw new Error("至少提供一条招聘请求。");
  }

  const pending = inputs.map((input, inputIndex) => ({
    input,
    inputIndex,
  }));

  const leadByDepartmentKey = new Map<string, number[]>();
  for (const item of pending) {
    if (!item.input.makeDepartmentLead) {
      continue;
    }
    const departmentKey = resolveRequestedDepartmentKey(company, item.input);
    if (!departmentKey) {
      continue;
    }
    const indices = leadByDepartmentKey.get(departmentKey) ?? [];
    indices.push(item.inputIndex);
    leadByDepartmentKey.set(departmentKey, indices);
  }

  const duplicatedLeadDepartment = [...leadByDepartmentKey.entries()].find(
    ([, indices]) => indices.length > 1,
  );
  if (duplicatedLeadDepartment) {
    const [departmentKey] = duplicatedLeadDepartment;
    const sampleInput =
      pending.find((item) => resolveRequestedDepartmentKey(company, item.input) === departmentKey)?.input
      ?? { role: "部门负责人", description: "batch lead validation placeholder" };
    throw new Error(
      `部门「${resolveRequestedDepartmentLabel(company, sampleInput)}」在同一批次里出现了多个负责人招聘请求，请只保留一个 makeDepartmentLead=true。`,
    );
  }

  let nextCompany = company;
  const hires: HireEmployeesBatchPlanResult["hires"] = [];
  const warnings: string[] = [];
  const remaining = [...pending];

  while (remaining.length > 0) {
    const nextIndex = remaining.findIndex((candidate) => {
      if (candidate.input.makeDepartmentLead) {
        return true;
      }
      const departmentKey = resolveRequestedDepartmentKey(nextCompany, candidate.input);
      if (!departmentKey) {
        return true;
      }
      const hasPendingLeadForSameDepartment = remaining.some((other) =>
        other.inputIndex !== candidate.inputIndex
        && other.input.makeDepartmentLead
        && resolveRequestedDepartmentKey(nextCompany, other.input) === departmentKey,
      );
      if (hasPendingLeadForSameDepartment) {
        return false;
      }
      return departmentKey.startsWith("dept:");
    });

    if (nextIndex < 0) {
      const unresolvedDepartments = [
        ...new Set(
          remaining.map((item) => resolveRequestedDepartmentLabel(nextCompany, item.input)),
        ),
      ];
      throw new Error(
        `以下部门在本批次里没有可先落盘的负责人：${unresolvedDepartments.join("、")}。请确保每个新部门至少有一条 makeDepartmentLead=true 的招聘请求。`,
      );
    }

    const [nextHire] = remaining.splice(nextIndex, 1);
    const planned = planHiredEmployee(nextCompany, nextHire.input);
    nextCompany = planned.company;
    hires.push({
      inputIndex: nextHire.inputIndex,
      employee: planned.employee,
      department: planned.department,
    });
    warnings.push(...planned.warnings);
  }

  return {
    company: nextCompany,
    hires,
    warnings: dedupeWarnings(warnings),
  };
}
