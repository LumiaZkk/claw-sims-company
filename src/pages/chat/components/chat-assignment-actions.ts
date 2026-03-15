import { resolveMentionedEmployeesInEmployees } from "../../../application/assignment/chat-mentions";
import type { EmployeeRef } from "../../../domain/org/types";

type ResolveStructuredAssignmentTargetsInput = {
  linkedDispatchTargetAgentIds?: string[] | null;
  roomAudienceAgentIds?: string[] | null;
  targetActorIds?: string[] | null;
  roomMessageSource?: string | null;
  messageIntent?: string | null;
};

type ResolveAssignmentActionEmployeesInput = {
  messageText: string;
  employees: EmployeeRef[];
  targetAgentIds: string[];
  allowMentionFallback: boolean;
};

export type ChatAssignmentActionSurfaceKind = "dispatch" | "related";

function dedupeAgentIds(agentIds: string[]): string[] {
  return [...new Set(agentIds.map((agentId) => agentId.trim()).filter((agentId) => agentId.length > 0))];
}

export function resolveStructuredAssignmentTargets(
  input: ResolveStructuredAssignmentTargetsInput,
): {
  targetAgentIds: string[];
  allowMentionFallback: boolean;
} {
  const targetAgentIds = dedupeAgentIds([
    ...(Array.isArray(input.linkedDispatchTargetAgentIds) ? input.linkedDispatchTargetAgentIds : []),
    ...(Array.isArray(input.roomAudienceAgentIds) ? input.roomAudienceAgentIds : []),
    ...(Array.isArray(input.targetActorIds) ? input.targetActorIds : []),
  ]);

  if (targetAgentIds.length > 0) {
    return {
      targetAgentIds,
      allowMentionFallback: false,
    };
  }

  const allowMentionFallback =
    input.roomMessageSource === "owner_dispatch" ||
    input.messageIntent === "dispatch";

  return {
    targetAgentIds: [],
    allowMentionFallback,
  };
}

export function resolveAssignmentActionEmployees(
  input: ResolveAssignmentActionEmployeesInput,
): {
  kind: ChatAssignmentActionSurfaceKind | null;
  employees: EmployeeRef[];
} {
  const employeesByAgentId = new Map(
    input.employees
      .filter((employee) => employee.agentId.trim().length > 0)
      .map((employee) => [employee.agentId, employee] as const),
  );

  const structuredTargets = dedupeAgentIds(input.targetAgentIds)
    .map((agentId) => employeesByAgentId.get(agentId) ?? null)
    .filter((employee): employee is EmployeeRef => Boolean(employee));
  if (structuredTargets.length > 0) {
    return {
      kind: "dispatch",
      employees: structuredTargets,
    };
  }

  const mentionedEmployees = [...new Map(
    resolveMentionedEmployeesInEmployees(input.messageText, input.employees).map((member) => [
      member.agentId,
      member,
    ]),
  ).values()];
  if (mentionedEmployees.length === 0) {
    return {
      kind: null,
      employees: [],
    };
  }

  return {
    kind: input.allowMentionFallback ? "dispatch" : "related",
    employees: mentionedEmployees,
  };
}

export function pickBestAssignmentActionText(input: {
  candidateTexts: string[];
  employees: EmployeeRef[];
  targetAgentIds: string[];
  allowMentionFallback: boolean;
}): string {
  const candidates = [...new Set(input.candidateTexts.map((text) => text.trim()).filter((text) => text.length > 0))];
  if (candidates.length === 0) {
    return "";
  }
  if (candidates.length === 1) {
    return candidates[0]!;
  }

  let bestText = candidates[0]!;
  let bestScore = -1;
  for (const candidate of candidates) {
    const resolved = resolveAssignmentActionEmployees({
      messageText: candidate,
      employees: input.employees,
      targetAgentIds: input.targetAgentIds,
      allowMentionFallback: input.allowMentionFallback,
    });
    const score = resolved.employees.length * 10_000 + candidate.length;
    if (score > bestScore) {
      bestScore = score;
      bestText = candidate;
    }
  }
  return bestText;
}
