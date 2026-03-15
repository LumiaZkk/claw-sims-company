import { describe, expect, it } from "vitest";
import type { AgentTemplateDefinition, HireIntent, TalentMarketState } from "./types";
import { applyTalentMarketFeedback, compileHireDraft, matchTalentTemplates } from "./talent-market";

function createIntent(): HireIntent {
  return {
    companyId: "company-1",
    rolePrompt: "Growth Strategist",
    businessContext: "负责增长实验与渠道评估",
    departmentName: null,
    reportsTo: null,
    desiredModelTier: "reasoning",
    budgetUsd: 10,
    mustHaveTags: ["growth"],
    avoidTags: ["finance"],
    operatorNotes: null,
  };
}

describe("matchTalentTemplates", () => {
  it("prefers ready templates when they exist", () => {
    const templates: AgentTemplateDefinition[] = [
      {
        id: "ready-template",
        title: "Growth Strategist",
        summary: "Ready",
        roleFamily: "growth",
        tags: ["growth"],
        domainTags: [],
        collaborationTags: [],
        status: "ready",
        updatedAt: 1,
      },
      {
        id: "draft-template",
        title: "Growth Strategist Draft",
        summary: "Draft",
        roleFamily: "growth",
        tags: ["growth"],
        domainTags: [],
        collaborationTags: [],
        status: "draft",
        updatedAt: 1,
      },
    ];

    const matches = matchTalentTemplates(createIntent(), templates);
    expect(matches).toHaveLength(1);
    expect(matches[0]?.templateId).toBe("ready-template");
  });

  it("falls back to non-retired templates when no ready candidates exist", () => {
    const templates: AgentTemplateDefinition[] = [
      {
        id: "draft-template",
        title: "Growth Strategist",
        summary: "Draft",
        roleFamily: "growth",
        tags: ["growth"],
        domainTags: [],
        collaborationTags: [],
        status: "draft",
        updatedAt: 1,
      },
    ];

    const matches = matchTalentTemplates(createIntent(), templates);
    expect(matches).toHaveLength(1);
    expect(matches[0]?.templateId).toBe("draft-template");
  });
});

describe("compileHireDraft", () => {
  it("builds a compiled draft with bootstrap and provenance", () => {
    const template: AgentTemplateDefinition = {
      id: "template-1",
      title: "Growth Strategist",
      summary: "Growth summary",
      roleFamily: "growth",
      tags: ["growth"],
      domainTags: [],
      collaborationTags: [],
      baseSoul: "负责增长战略。",
      strengths: ["增长实验"],
      cautions: ["避免短视指标"],
      defaultTraits: "数据驱动",
      recommendedModelTier: "reasoning",
      defaultBudgetUsd: 12,
      recommendedSkills: ["growth_planning"],
      recommendedApps: ["dashboard"],
      status: "ready",
      updatedAt: 1,
    };

    const draft = compileHireDraft({
      intent: createIntent(),
      template,
      match: null,
      roleOverride: "Growth Strategist",
      descriptionOverride: "负责增长实验",
    });

    expect(draft.templateId).toBe("template-1");
    expect(draft.bootstrapBundle.roleMd).toContain("Growth Strategist");
    expect(draft.bootstrapBundle.roleMd).toContain("负责增长实验");
    expect(draft.provenance.templateId).toBe("template-1");
  });
});

describe("applyTalentMarketFeedback", () => {
  it("promotes a draft template when performance is strong", () => {
    const market: TalentMarketState = {
      templates: [
        {
          id: "template-1",
          title: "Ops Coordinator",
          summary: "Ops",
          roleFamily: "ops",
          status: "draft",
          qualityScore: 0.7,
          validationScore: 0.7,
          updatedAt: 1,
        },
      ],
      updatedAt: 1,
    };

    const next = applyTalentMarketFeedback({
      market,
      signals: [{ templateId: "template-1", event: "performance", score: 0.95 }],
      now: 100,
    });

    expect(next.templates[0]?.status).toBe("ready");
  });

  it("retires templates explicitly when requested", () => {
    const market: TalentMarketState = {
      templates: [
        {
          id: "template-1",
          title: "Ops Coordinator",
          summary: "Ops",
          roleFamily: "ops",
          status: "ready",
          updatedAt: 1,
        },
      ],
      updatedAt: 1,
    };

    const next = applyTalentMarketFeedback({
      market,
      signals: [{ templateId: "template-1", event: "retire" }],
      now: 100,
    });

    expect(next.templates[0]?.status).toBe("retired");
  });
});
