import { describe, expect, it } from "vitest";
import type { EmployeeRef } from "../../domain/org/types";
import { resolveMentionedEmployeesInEmployees } from "./chat-mentions";

const employees: EmployeeRef[] = [
  {
    agentId: "nl-0845da-ceo",
    nickname: "CEO",
    role: "Chief Executive Officer",
    isMeta: true,
    metaRole: "ceo",
  },
  {
    agentId: "nl-0845da-hr",
    nickname: "HR",
    role: "Human Resources Director",
    isMeta: true,
    metaRole: "hr",
  },
  {
    agentId: "nl-0845da-cto",
    nickname: "CTO",
    role: "Chief Technology Officer",
    isMeta: true,
    metaRole: "cto",
  },
  {
    agentId: "nl-0845da-coo",
    nickname: "COO",
    role: "Chief Operating Officer",
    isMeta: true,
    metaRole: "coo",
  },
  {
    agentId: "nl-0845da-content-director",
    nickname: "内容总监",
    role: "Content Director",
    isMeta: false,
  },
];

describe("chat mention resolution", () => {
  it("matches role acronyms without colliding on unrelated role substrings", () => {
    const resolved = resolveMentionedEmployeesInEmployees(
      "@CTO @HR @COO",
      employees,
    );

    expect(resolved.map((employee) => employee.agentId)).toEqual([
      "nl-0845da-cto",
      "nl-0845da-hr",
      "nl-0845da-coo",
    ]);
  });

  it("supports normalized role names and agent id segments", () => {
    const resolved = resolveMentionedEmployeesInEmployees(
      "@contentdirector @cto @nl0845dahr",
      employees,
    );

    expect(resolved.map((employee) => employee.agentId)).toEqual([
      "nl-0845da-content-director",
      "nl-0845da-cto",
      "nl-0845da-hr",
    ]);
  });
});
