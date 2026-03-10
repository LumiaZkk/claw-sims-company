import { describe, expect, it } from "vitest";
import type { ArtifactRecord, Company, RequestRecord } from "../company/types";
import { buildDerivedKnowledgeItems, mergeCompanyKnowledgeItems } from "./shared-knowledge";

function createCompany(overrides: Partial<Company> = {}): Company {
  return {
    id: "company-1",
    name: "novel",
    description: "番茄小说创作团队",
    icon: "📚",
    template: "novel",
    employees: [
      { agentId: "novel-co-ceo", nickname: "CEO", role: "CEO", isMeta: true, metaRole: "ceo" },
      { agentId: "novel-co-hr", nickname: "HR", role: "HR", isMeta: true, metaRole: "hr" },
      { agentId: "novel-co-cto", nickname: "CTO", role: "CTO", isMeta: true, metaRole: "cto" },
      { agentId: "novel-co-coo", nickname: "COO", role: "COO", isMeta: true, metaRole: "coo" },
    ],
    quickPrompts: [],
    createdAt: 1_000,
    ...overrides,
  };
}

function createRequest(overrides: Partial<RequestRecord>): RequestRecord {
  return {
    id: "request-default",
    sessionKey: "agent:default:main",
    fromAgentId: "novel-co-ceo",
    toAgentIds: [],
    title: "默认方案",
    summary: "默认方案摘要",
    status: "answered",
    resolution: "complete",
    responseSummary: "默认方案摘要",
    responseDetails: "## 默认方案\n- 细节",
    transport: "inferred",
    createdAt: 1_000,
    updatedAt: 1_200,
    ...overrides,
  };
}

describe("buildDerivedKnowledgeItems", () => {
  it("derives HR/CTO/COO/CEO knowledge with provenance and auto acceptance", () => {
    const company = createCompany();
    const requests: RequestRecord[] = [
      createRequest({
        id: "request:hr",
        sessionKey: "agent:novel-co-hr:main",
        fromAgentId: "novel-co-hr",
        toAgentIds: ["novel-co-ceo"],
        title: "HR 团队架构方案",
        responseSummary: "已完成番茄小说创作团队的人员配置方案。",
        responseDetails: "## HR 团队架构方案\n- 核心岗位\n- 招聘建议",
        updatedAt: 2_000,
      }),
      createRequest({
        id: "request:cto",
        sessionKey: "agent:novel-co-cto:main",
        fromAgentId: "novel-co-cto",
        toAgentIds: ["novel-co-ceo"],
        title: "CTO 技术方案",
        responseSummary: "@CEO 已完成技术方案规划，以下是详细报告：",
        responseDetails: "## 番茄小说创作团队技术方案\n- 创作工具\n- 数据监控",
        transport: "sessions_send",
        updatedAt: 2_100,
      }),
      createRequest({
        id: "request:ceo",
        sessionKey: "agent:novel-co-ceo:main",
        fromAgentId: "novel-co-ceo",
        toAgentIds: ["novel-co-hr", "novel-co-cto", "novel-co-coo"],
        title: "CEO 最终汇总方案",
        responseSummary: "## 🎉 番茄小说创作团队组建方案汇总",
        responseDetails: "## 🎉 番茄小说创作团队组建方案汇总\n- 人员配置\n- 技术路线\n- 运营节奏",
        updatedAt: 2_300,
      }),
    ];
    const artifacts: ArtifactRecord[] = [
      {
        id: "artifact:coo-plan",
        title: "番茄小说运营策略方案.md",
        kind: "knowledge",
        status: "ready",
        ownerActorId: "novel-co-coo",
        sourceActorId: "novel-co-coo",
        sourceName: "番茄小说运营策略方案.md",
        sourcePath: "/Users/zkk/.openclaw/workspaces/novel-co-coo/番茄小说运营策略方案.md",
        summary: "COO · 平台规则、发布节奏和收益策略",
        content: "## 番茄小说平台运营策略方案\n- 平台规则\n- 发布节奏\n- 数据运营",
        createdAt: 2_200,
        updatedAt: 2_200,
      },
    ];

    const derived = buildDerivedKnowledgeItems({
      company,
      artifacts,
      requests,
    });

    expect(derived.map((item) => item.id)).toEqual([
      "knowledge:company-1:derived:ceo",
      "knowledge:company-1:derived:coo",
      "knowledge:company-1:derived:cto",
      "knowledge:company-1:derived:hr",
    ]);
    expect(derived.every((item) => item.acceptanceMode === "auto")).toBe(true);
    expect(derived.find((item) => item.id.endsWith(":derived:coo"))).toMatchObject({
      sourceArtifactId: "artifact:coo-plan",
      sourcePath: "/Users/zkk/.openclaw/workspaces/novel-co-coo/番茄小说运营策略方案.md",
    });
    expect(derived.find((item) => item.id.endsWith(":derived:cto"))).toMatchObject({
      transport: "sessions_send",
      sourceRequestId: "request:cto",
    });
    expect(derived.find((item) => item.id.endsWith(":derived:ceo"))?.content).toContain("组建方案汇总");
  });

  it("preserves non-derived knowledge while refreshing derived entries", () => {
    const merged = mergeCompanyKnowledgeItems(
      [
        {
          id: "manual-note",
          kind: "canon",
          title: "手工知识",
          summary: "保留已有手工知识",
          source: "manual",
          status: "active",
          updatedAt: 1_000,
        },
      ],
      [
        {
          id: "knowledge:company-1:derived:cto",
          kind: "technology",
          title: "CTO 技术方案",
          summary: "自动入库技术方案",
          source: "derived",
          status: "active",
          updatedAt: 2_000,
        },
      ],
    );

    expect(merged.map((item) => item.id)).toEqual([
      "knowledge:company-1:derived:cto",
      "manual-note",
    ]);
  });
});
