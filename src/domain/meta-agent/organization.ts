import type { Company, Department, EmployeeRef } from "../org/types";
import type { MetaRole } from "./types";
import { isSupportMetaRole } from "./types";

export type MetaDepartmentSpec = {
  metaRole: MetaRole;
  name: string;
  kind: Department["kind"];
  color: string;
  order: number;
  missionPolicy: Department["missionPolicy"];
};

export const META_DEPARTMENT_SPECS: MetaDepartmentSpec[] = [
  { metaRole: "ceo", name: "管理中枢", kind: "meta", color: "slate", order: 0, missionPolicy: "manager_delegated" },
  { metaRole: "hr", name: "人力资源部", kind: "support", color: "rose", order: 1, missionPolicy: "support_only" },
  { metaRole: "cto", name: "技术部", kind: "support", color: "indigo", order: 2, missionPolicy: "support_only" },
  { metaRole: "coo", name: "运营部", kind: "support", color: "emerald", order: 3, missionPolicy: "support_only" },
];

export function resolveMetaEmployee(
  employees: EmployeeRef[],
  metaRole: MetaRole,
): EmployeeRef | null {
  return employees.find((employee) => employee.metaRole === metaRole) ?? null;
}

export function resolveCeoAgentId(employees: EmployeeRef[]): string | null {
  return resolveMetaEmployee(employees, "ceo")?.agentId ?? null;
}

export function resolveMetaDepartment(
  company: Company | null | undefined,
  metaRole: MetaRole,
): Department | null {
  if (!company) {
    return null;
  }
  const manager = resolveMetaEmployee(company.employees, metaRole);
  if (!manager) {
    return null;
  }
  return (
    company.departments?.find(
      (department) => !department.archived && department.leadAgentId === manager.agentId,
    ) ?? null
  );
}

export function inferMetaDepartmentKind(
  metaRole: MetaRole | null | undefined,
): Department["kind"] | null {
  if (!metaRole) {
    return null;
  }
  if (metaRole === "ceo") {
    return "meta";
  }
  if (isSupportMetaRole(metaRole)) {
    return "support";
  }
  return "business";
}
