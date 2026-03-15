import type { CollaborationEdge, Department, EmployeeRef } from "../../../domain/org/types";

export type RunCommand = (
  command: () => Promise<{ title: string; description: string } | null>,
  fallbackError: string,
) => Promise<{ title: string; description: string } | null>;

export type EndpointKind = "department" | "agent";

export function stringifyPreview(value: unknown): string {
  try {
    return JSON.stringify(value, null, 2);
  } catch {
    return String(value);
  }
}

export function doctorToneClass(state: "ready" | "attention" | "degraded" | "blocked") {
  if (state === "ready") {
    return "border-emerald-200 bg-emerald-50 text-emerald-700";
  }
  if (state === "attention") {
    return "border-sky-200 bg-sky-50 text-sky-700";
  }
  if (state === "blocked") {
    return "border-red-200 bg-red-50 text-red-700";
  }
  return "border-amber-200 bg-amber-50 text-amber-700";
}

export function formatEmployeeLabel(employee: EmployeeRef) {
  return `${employee.nickname} (${employee.role})`;
}

export function formatDepartmentLabel(
  department: Department,
  employeesById: Map<string, EmployeeRef>,
) {
  const lead = employeesById.get(department.leadAgentId);
  return `${department.name}${lead ? ` · ${lead.nickname}` : ""}`;
}

export function formatUsd(value: number) {
  return `$${value.toFixed(2)}`;
}

export function describeCollaborationEdge(
  edge: CollaborationEdge,
  employeesById: Map<string, EmployeeRef>,
  departmentsById: Map<string, Department>,
) {
  const from =
    (edge.fromAgentId && employeesById.get(edge.fromAgentId)
      ? formatEmployeeLabel(employeesById.get(edge.fromAgentId)!)
      : null) ??
    (edge.fromDepartmentId && departmentsById.get(edge.fromDepartmentId)
      ? formatDepartmentLabel(departmentsById.get(edge.fromDepartmentId)!, employeesById)
      : null) ??
    edge.fromAgentId ??
    edge.fromDepartmentId ??
    "未知来源";
  const to =
    (edge.toAgentId && employeesById.get(edge.toAgentId)
      ? formatEmployeeLabel(employeesById.get(edge.toAgentId)!)
      : null) ??
    (edge.toDepartmentId && departmentsById.get(edge.toDepartmentId)
      ? formatDepartmentLabel(departmentsById.get(edge.toDepartmentId)!, employeesById)
      : null) ??
    edge.toAgentId ??
    edge.toDepartmentId ??
    "未知目标";
  const fromKind = edge.fromDepartmentId ? "部门" : "员工";
  const toKind = edge.toDepartmentId ? "部门" : "员工";
  return `${fromKind} ${from} -> ${toKind} ${to}`;
}

export function isSameEdge(left: CollaborationEdge, right: CollaborationEdge) {
  return (
    left.fromAgentId === right.fromAgentId &&
    left.fromDepartmentId === right.fromDepartmentId &&
    left.toAgentId === right.toAgentId &&
    left.toDepartmentId === right.toDepartmentId
  );
}

export function createCollaborationEdgeDraft(
  fromKind: EndpointKind,
  fromId: string,
  toKind: EndpointKind,
  toId: string,
): CollaborationEdge {
  return {
    ...(fromKind === "agent" ? { fromAgentId: fromId } : { fromDepartmentId: fromId }),
    ...(toKind === "agent" ? { toAgentId: toId } : { toDepartmentId: toId }),
  };
}
