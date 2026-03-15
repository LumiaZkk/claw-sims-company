import { describe, expect, it } from "vitest";
import type { Company } from "../../domain/org/types";
import { buildCompanyBlueprint, parseCompanyBlueprint } from "./blueprint";

function createCompany(): Company {
  return {
    id: "company-1",
    name: "测试公司",
    description: "",
    icon: "🏢",
    template: "blank",
    createdAt: 1,
    quickPrompts: [],
    departments: [
      {
        id: "dept-ops",
        name: "运营部",
        leadAgentId: "agent-ops",
        kind: "support",
        color: "emerald",
        order: 1,
        missionPolicy: "support_only",
      },
    ],
    employees: [
      {
        agentId: "agent-ops",
        nickname: "Ops",
        role: "Ops Coordinator",
        isMeta: false,
        reportsTo: "agent-ceo",
        departmentId: "dept-ops",
        templateBinding: {
          templateId: "template-ops",
          sourceType: "template",
          compiledAt: 123,
          compilerVersion: "tm-compiler@1",
          confidence: 0.82,
        },
        hireProvenance: {
          templateId: "template-ops",
          sourceType: "template",
          reasons: ["role match"],
        },
        bootstrapBundle: {
          roleMd: "# Ops Coordinator",
          soulMd: "负责运营协调。",
          onboardingMd: "请先阅读 SOP。",
        },
      },
      {
        agentId: "agent-ceo",
        nickname: "CEO",
        role: "Chief Executive Officer",
        isMeta: true,
        metaRole: "ceo",
      },
    ],
  };
}

describe("buildCompanyBlueprint", () => {
  it("keeps template lineage fields when present", () => {
    const blueprint = buildCompanyBlueprint({ company: createCompany(), jobs: [] });
    const ops = blueprint.employees.find((employee) => employee.nickname === "Ops");
    expect(ops?.templateBinding?.templateId).toBe("template-ops");
    expect(ops?.hireProvenance?.sourceType).toBe("template");
    expect(ops?.bootstrapBundle?.roleMd).toContain("Ops Coordinator");
  });

  it("parses blueprint with optional lineage fields", () => {
    const blueprint = buildCompanyBlueprint({ company: createCompany(), jobs: [] });
    const serialized = JSON.stringify(blueprint);
    const parsed = parseCompanyBlueprint(serialized);
    const ops = parsed?.employees.find((employee) => employee.nickname === "Ops");
    expect(ops?.templateBinding?.templateId).toBe("template-ops");
  });
});
