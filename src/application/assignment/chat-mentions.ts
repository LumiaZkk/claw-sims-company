import type { Company, EmployeeRef } from "../../domain/org/types";

function createChatMentionRegex(): RegExp {
  return /@([^\s@]+)/g;
}

function normalizeMentionToken(value: string): string {
  return value.trim().toLowerCase().replace(/[^\p{L}\p{N}]+/gu, "");
}

function buildRoleAcronym(role: string): string {
  const letters = role
    .trim()
    .split(/[^\p{L}\p{N}]+/u)
    .map((part) => part.trim())
    .filter((part) => part.length > 0)
    .map((part) => part[0] ?? "")
    .join("");
  return normalizeMentionToken(letters);
}

function buildEmployeeMentionAliases(employee: EmployeeRef): string[] {
  const agentId = normalizeMentionToken(employee.agentId);
  const nickname = normalizeMentionToken(employee.nickname);
  const role = normalizeMentionToken(employee.role);
  const roleAcronym = buildRoleAcronym(employee.role);
  const metaRole = normalizeMentionToken(employee.metaRole ?? "");
  const agentIdSegments = employee.agentId
    .split(/[^-\p{L}\p{N}_]+/u)
    .map((segment) => normalizeMentionToken(segment))
    .filter((segment) => segment.length > 0);

  return [...new Set([
    agentId,
    nickname,
    role,
    roleAcronym,
    metaRole,
    ...agentIdSegments,
    agentIdSegments.at(-1) ?? "",
  ].filter((alias) => alias.length > 0))];
}

function tokenMatchesEmployee(token: string, employee: EmployeeRef): boolean {
  const normalizedToken = normalizeMentionToken(token);
  if (!normalizedToken) {
    return false;
  }
  const aliases = buildEmployeeMentionAliases(employee);
  return aliases.some(
    (alias) =>
      alias === normalizedToken ||
      (normalizedToken.length >= 3 && alias.startsWith(normalizedToken)),
  );
}

function resolveMentionedEmployees(text: string, employees: EmployeeRef[]): EmployeeRef[] {
  const mentions = text.matchAll(createChatMentionRegex());
  const found: EmployeeRef[] = [];
  const seen = new Set<string>();
  for (const match of mentions) {
    const token = (match[1] ?? "").trim();
    if (!token) {
      continue;
    }
    const normalizedToken = normalizeMentionToken(token);
    if (seen.has(normalizedToken)) {
      continue;
    }
    seen.add(normalizedToken);
    const matched =
      employees.find((employee) => tokenMatchesEmployee(normalizedToken, employee)) ?? null;
    if (matched) {
      found.push(matched);
    }
  }
  return found;
}

export function resolveMentionedEmployeesInText(text: string, company: Company | null): EmployeeRef[] {
  if (!company) {
    return [];
  }

  return resolveMentionedEmployees(text, company.employees);
}

export function resolveMentionedEmployeesInEmployees(
  text: string,
  employees: EmployeeRef[] | null | undefined,
): EmployeeRef[] {
  if (!employees || employees.length === 0) {
    return [];
  }
  return resolveMentionedEmployees(text, employees);
}
