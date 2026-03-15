import { describe, expect, it } from "vitest";
import { classifyMetaSupportNeed, resolveMetaSupportDepartment } from "./support-routing";
import type { Company } from "../../domain/org/types";

describe("meta-agent support routing", () => {
  it("routes technical support language to CTO", () => {
    expect(
      classifyMetaSupportNeed({
        title: "修复发布流水线",
        summary: "当前自动化部署和集成都失败了",
      }),
    ).toBe("cto");
  });

  it("routes staffing language to HR", () => {
    expect(
      classifyMetaSupportNeed({
        title: "补招聘编制",
        summary: "内容团队需要扩充 headcount",
      }),
    ).toBe("hr");
  });

  it("resolves the support department from company context", () => {
    const company: Company = {
      id: "company-1",
      name: "测试公司",
      description: "desc",
      icon: "icon",
      template: "novel",
      employees: [
        {
          agentId: "ceo-1",
          nickname: "CEO",
          role: "Chief Executive Officer",
          isMeta: true,
          metaRole: "ceo",
        },
        {
          agentId: "cto-1",
          nickname: "CTO",
          role: "Chief Technology Officer",
          isMeta: true,
          metaRole: "cto",
          reportsTo: "ceo-1",
          departmentId: "dep-cto",
        },
      ],
      departments: [
        {
          id: "dep-cto",
          name: "技术部",
          leadAgentId: "cto-1",
          kind: "support",
          missionPolicy: "support_only",
        },
      ],
      quickPrompts: [],
      createdAt: Date.now(),
    };

    expect(
      resolveMetaSupportDepartment(company, {
        title: "SDK 集成失败",
        nextAction: "需要技术支持",
      })?.id,
    ).toBe("dep-cto");
  });
});
