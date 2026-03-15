import { describe, expect, it } from "vitest";
import type { Company } from "./types";
import { planHiredEmployee, planHiredEmployeesBatch } from "./hiring";

function buildCompany(): Company {
  return {
    id: "0845da12-7cd7-45fe-af48-f340b4ee112e",
    name: "nl",
    description: "test",
    icon: "🏗",
    template: "blank",
    createdAt: 1,
    quickPrompts: [],
    departments: [
      {
        id: "dept-ceo",
        name: "管理中枢",
        leadAgentId: "nl-0845da-ceo",
        kind: "meta",
        color: "slate",
        order: 0,
        missionPolicy: "manager_delegated",
      },
      {
        id: "dept-hr",
        name: "人力资源部",
        leadAgentId: "nl-0845da-hr",
        kind: "support",
        color: "rose",
        order: 1,
        missionPolicy: "manager_delegated",
      },
    ],
    employees: [
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
        reportsTo: "nl-0845da-ceo",
        departmentId: "dept-hr",
      },
    ],
  };
}

describe("planHiredEmployee", () => {
  it("adds a new employee under the CEO by default", () => {
    const result = planHiredEmployee(buildCompany(), {
      role: "Content Director",
      description: "Own the content pipeline",
    });

    expect(result.employee.agentId).toBe("nl-0845da-content-director");
    expect(result.employee.nickname).toBe("Content Director");
    expect(result.employee.role).toBe("Content Director");
    expect(result.employee.reportsTo).toBe("nl-0845da-ceo");
    expect(result.company.employees).toHaveLength(3);
  });

  it("creates a department and assigns the new hire as lead when requested", () => {
    const result = planHiredEmployee(buildCompany(), {
      role: "内容总监",
      description: "统筹内容创作事业部",
      departmentName: "内容创作事业部",
      makeDepartmentLead: true,
    });

    expect(result.department).toMatchObject({
      name: "内容创作事业部",
      leadAgentId: "nl-0845da",
      kind: "business",
    });
    expect(result.employee.agentId).toBe("nl-0845da");
    expect(result.employee.departmentId).toBe(result.department?.id);
    expect(result.employee.reportsTo).toBe("nl-0845da-ceo");
  });

  it("deduplicates agent ids when the role already exists", () => {
    const company = buildCompany();
    company.employees.push({
      agentId: "nl-0845da-content-director",
      nickname: "Content Director",
      role: "Content Director",
      isMeta: false,
      reportsTo: "nl-0845da-ceo",
    });

    const result = planHiredEmployee(company, {
      role: "Content Director",
      description: "Own the content pipeline",
    });

    expect(result.employee.agentId).toBe("nl-0845da-content-director-2");
  });
});

describe("planHiredEmployeesBatch", () => {
  it("creates the lead first for a new department even when members are listed earlier", () => {
    const result = planHiredEmployeesBatch(buildCompany(), [
      {
        role: "内容主笔",
        description: "负责长文交付",
        departmentName: "内容创作事业部",
      },
      {
        role: "内容总监",
        description: "统筹内容创作事业部",
        departmentName: "内容创作事业部",
        makeDepartmentLead: true,
      },
      {
        role: "内容编辑",
        description: "负责校对与排版",
        departmentName: "内容创作事业部",
      },
    ]);

    expect(result.hires.map((item) => item.employee.role)).toEqual([
      "内容总监",
      "内容主笔",
      "内容编辑",
    ]);
    expect(result.company.departments?.find((department) => department.name === "内容创作事业部")).toMatchObject({
      leadAgentId: "nl-0845da",
    });
    expect(result.company.employees.find((employee) => employee.role === "内容主笔")).toMatchObject({
      departmentId: result.company.departments?.find((department) => department.name === "内容创作事业部")?.id,
      reportsTo: "nl-0845da",
    });
    expect(result.company.employees.find((employee) => employee.role === "内容编辑")).toMatchObject({
      reportsTo: "nl-0845da",
    });
    expect(result.company.employees.find((employee) => employee.role === "内容主笔")?.agentId).toBe("nl-0845da-2");
    expect(result.company.employees.find((employee) => employee.role === "内容编辑")?.agentId).toBe("nl-0845da-3");
  });

  it("rejects a new department batch when no lead hire is present", () => {
    expect(() =>
      planHiredEmployeesBatch(buildCompany(), [
        {
          role: "内容主笔",
          description: "负责长文交付",
          departmentName: "内容创作事业部",
        },
      ]),
    ).toThrow("makeDepartmentLead=true");
  });

  it("rejects multiple lead hires for the same department in one batch", () => {
    expect(() =>
      planHiredEmployeesBatch(buildCompany(), [
        {
          role: "内容总监",
          description: "统筹内容创作事业部",
          departmentName: "内容创作事业部",
          makeDepartmentLead: true,
        },
        {
          role: "执行总监",
          description: "同时尝试接管同一个部门",
          departmentName: "内容创作事业部",
          makeDepartmentLead: true,
        },
      ]),
    ).toThrow("多个负责人招聘请求");
  });
});
