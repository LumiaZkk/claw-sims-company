import type { Company } from "../../domain/org/types";

export type RequirementRoomMentionCandidate = {
  agentId: string;
  label: string;
  role: string;
};

function createRoomMentionRegex() {
  return /@([\p{L}\p{N}_-]+)/gu;
}

function normalizeToken(value: string): string {
  return value.replace(/^@/, "").trim().toLowerCase();
}

export function dedupeAgentIds(agentIds: Array<string | null | undefined>): string[] {
  return [
    ...new Set(
      agentIds.map((agentId) => agentId?.trim()).filter((agentId): agentId is string => Boolean(agentId)),
    ),
  ];
}

export function sortRequirementRoomMemberIds(
  agentIds: Array<string | null | undefined>,
): string[] {
  return dedupeAgentIds(agentIds).sort((left, right) => left.localeCompare(right, "en"));
}

function resolveEmployeeByToken(
  company: Company,
  token: string,
  allowedAgentIds?: Set<string>,
): string | null {
  const normalized = normalizeToken(token);
  if (!normalized) {
    return null;
  }

  const candidates = company.employees.filter((employee) =>
    allowedAgentIds ? allowedAgentIds.has(employee.agentId) : true,
  );

  const exact = candidates.find((employee) => {
    const nickname = employee.nickname.trim().toLowerCase();
    const role = employee.role.trim().toLowerCase();
    const agentId = employee.agentId.trim().toLowerCase();
    return agentId === normalized || nickname === normalized || role === normalized;
  });
  if (exact) {
    return exact.agentId;
  }

  const fuzzy = candidates.find((employee) => {
    const nickname = employee.nickname.trim().toLowerCase();
    const role = employee.role.trim().toLowerCase();
    return nickname.includes(normalized) || normalized.includes(nickname) || role.includes(normalized);
  });
  return fuzzy?.agentId ?? null;
}

export function resolveRequirementRoomMentionTargets(input: {
  text: string;
  company: Company | null | undefined;
  memberIds: string[];
}): string[] {
  const { company, text } = input;
  if (!company) {
    return [];
  }

  const allowedAgentIds = new Set(dedupeAgentIds(input.memberIds));
  const mentionedTargets = [...text.matchAll(createRoomMentionRegex())]
    .map((match) => resolveEmployeeByToken(company, match[1] ?? "", allowedAgentIds))
    .filter((agentId): agentId is string => Boolean(agentId));

  return dedupeAgentIds(mentionedTargets);
}

export function searchRequirementRoomMentionCandidates(input: {
  company: Company | null | undefined;
  memberIds: string[];
  query: string;
}): RequirementRoomMentionCandidate[] {
  const { company, query } = input;
  if (!company) {
    return [];
  }

  const normalizedQuery = normalizeToken(query);
  const allowedAgentIds = new Set(dedupeAgentIds(input.memberIds));

  return company.employees
    .filter((employee) => allowedAgentIds.has(employee.agentId))
    .map((employee) => ({
      agentId: employee.agentId,
      label: employee.nickname,
      role: employee.role,
      score: (() => {
        if (!normalizedQuery) {
          return 1;
        }
        const values = [employee.nickname, employee.role, employee.agentId].map(normalizeToken);
        if (values.some((value) => value === normalizedQuery)) {
          return 4;
        }
        if (values.some((value) => value.startsWith(normalizedQuery))) {
          return 3;
        }
        if (values.some((value) => value.includes(normalizedQuery))) {
          return 2;
        }
        return 0;
      })(),
    }))
    .filter((candidate) => candidate.score > 0)
    .sort((left, right) => right.score - left.score || left.label.localeCompare(right.label, "zh-Hans-CN"))
    .slice(0, 6)
    .map((candidate) => ({
      agentId: candidate.agentId,
      label: candidate.label,
      role: candidate.role,
    }));
}
