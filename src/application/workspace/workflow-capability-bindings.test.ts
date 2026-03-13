import { describe, expect, it } from "vitest";
import type { Company, CompanyWorkspaceApp, SkillDefinition } from "../../domain/org/types";
import type { WorkItemRecord } from "../../domain/mission/types";
import {
  getCompanyWorkflowCapabilityBindings,
  hasStoredWorkflowCapabilityBindings,
  resolveWorkflowCapabilityBindings,
} from "./workflow-capability-bindings";

function createCompany(): Company {
  return {
    id: "company-1",
    name: "小说工坊",
    description: "围绕章节连载推进创作",
    icon: "🏢",
    template: "novel",
    createdAt: 1,
    employees: [
      {
        agentId: "cto-1",
        nickname: "CTO",
        role: "CTO",
        isMeta: true,
        metaRole: "cto",
      },
    ],
    quickPrompts: [],
  };
}

function createGenericCompany(): Company {
  return {
    id: "company-2",
    name: "游戏工坊",
    description: "围绕关卡、模拟和验收推进交付",
    icon: "🎮",
    template: "generic",
    createdAt: 1,
    employees: [
      {
        agentId: "cto-1",
        nickname: "CTO",
        role: "CTO",
        isMeta: true,
        metaRole: "cto",
      },
    ],
    quickPrompts: [],
  };
}

function createWorkItem(partial?: Partial<WorkItemRecord>): WorkItemRecord {
  return {
    id: "work-1",
    workKey: "topic:novel",
    kind: "execution",
    roundId: "round-1",
    companyId: "company-1",
    title: "推进小说第 2 章终审",
    goal: "完成终审",
    headline: "第 2 章终审",
    displayStage: "终审前检查",
    displaySummary: "进入终审前检查",
    displayOwnerLabel: "主编",
    displayNextAction: "先执行一致性检查，再决定是否进入终审。",
    status: "active",
    lifecyclePhase: "active_requirement",
    stageGateStatus: "none",
    stageLabel: "终审前检查",
    ownerLabel: "主编",
    batonLabel: "",
    artifactIds: [],
    dispatchIds: [],
    startedAt: 1,
    updatedAt: 1,
    summary: "终审前需要先做一致性检查",
    nextAction: "先执行一致性检查，再决定是否进入终审。",
    steps: [],
    ...partial,
  };
}

const apps: CompanyWorkspaceApp[] = [
  {
    id: "app:consistency",
    slug: "consistency-hub",
    title: "一致性中心",
    description: "一致性中心",
    icon: "🧭",
    kind: "custom",
    status: "ready",
    template: "consistency",
    surface: "template",
  },
  {
    id: "app:review",
    slug: "review-console",
    title: "审阅控制台",
    description: "审阅控制台",
    icon: "🧪",
    kind: "custom",
    status: "ready",
    template: "review-console",
    surface: "template",
  },
];

const skills: SkillDefinition[] = [
  {
    id: "consistency.check",
    title: "执行一致性检查",
    summary: "执行一致性检查",
    ownerAgentId: "cto-1",
    status: "ready",
    entryPath: "scripts/run-consistency-check.ts",
    allowedTriggers: ["app_action"],
    createdAt: 1,
    updatedAt: 1,
  },
];

describe("workflow capability bindings", () => {
  it("provides default bindings for novel companies", () => {
    const bindings = getCompanyWorkflowCapabilityBindings(createCompany());
    expect(bindings.map((binding) => binding.id)).toEqual([
      "reader-during-creation",
      "consistency-before-review",
      "review-before-publish",
    ]);
  });

  it("treats non-empty stored bindings as explicit organization configuration", () => {
    const company = {
      ...createCompany(),
      workflowCapabilityBindings: [
        {
          id: "custom-binding",
          label: "自定义绑定",
          required: true,
          appTemplates: ["reader" as const],
        },
      ],
    };
    expect(hasStoredWorkflowCapabilityBindings(company)).toBe(true);
    expect(getCompanyWorkflowCapabilityBindings(company).map((binding) => binding.id)).toEqual([
      "custom-binding",
    ]);
  });

  it("provides generic default bindings for non-novel companies", () => {
    const bindings = getCompanyWorkflowCapabilityBindings(createGenericCompany());
    expect(bindings.map((binding) => binding.id)).toEqual([
      "viewer-during-delivery",
      "consistency-before-review",
      "review-before-handoff",
    ]);
  });

  it("matches current work item to the consistency binding and resolves app + skill", () => {
    const resolved = resolveWorkflowCapabilityBindings({
      bindings: getCompanyWorkflowCapabilityBindings(createCompany()),
      workItem: createWorkItem(),
      apps,
      skills,
    });

    const consistency = resolved.find((binding) => binding.id === "consistency-before-review");
    expect(consistency).toBeTruthy();
    expect(consistency?.required).toBe(true);
    expect(consistency?.apps[0]?.title).toContain("一致性中心");
    expect(consistency?.skills[0]?.id).toBe("consistency.check");
    expect(consistency?.matchedBy).toContain("stage");
    expect(consistency?.matchedBy).toContain("nextAction");
  });

  it("surfaces missing app templates and missing skill ids when current company has not published them yet", () => {
    const resolved = resolveWorkflowCapabilityBindings({
      bindings: getCompanyWorkflowCapabilityBindings(createCompany()),
      workItem: createWorkItem({
        displayStage: "发布前验收",
        stageLabel: "发布前验收",
        displayNextAction: "先做预检再确认是否归档。",
        nextAction: "先做预检再确认是否归档。",
      }),
      apps: [],
      skills: [],
    });

    const review = resolved.find((binding) => binding.id === "review-before-publish");
    expect(review?.missingAppTemplates).toEqual(["review-console"]);
    expect(review?.missingSkillIds).toEqual(["review.precheck"]);
  });
});
