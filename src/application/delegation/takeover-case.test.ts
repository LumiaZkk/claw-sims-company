import { describe, expect, it } from "vitest";
import {
  applyTakeoverCaseWorkflowAction,
  buildTakeoverCases,
  buildTakeoverCaseSummary,
  getTakeoverCaseLatestRedispatch,
  getTakeoverCaseResolutionNote,
} from "./takeover-case";
import type { Company } from "../../domain/org/types";
import type { ResolvedExecutionState } from "../mission/execution-state";

function createCompany(): Company {
  return {
    id: "company-1",
    name: "测试公司",
    description: "",
    icon: "🏢",
    template: "blank",
    employees: [
      {
        agentId: "ceo",
        nickname: "CEO",
        role: "Chief Executive Officer",
      } as any,
      {
        agentId: "coo",
        nickname: "COO",
        role: "Chief Operating Officer",
      } as any,
    ],
    quickPrompts: [],
    createdAt: 1,
  };
}

function createExecution(summary: string): ResolvedExecutionState {
  return {
    state: "manual_takeover_required",
    label: "需要接管",
    summary,
    actionable: true,
    tone: "red",
    evidence: [{ kind: "manual_takeover", text: summary }],
  };
}

describe("takeover-case", () => {
  it("builds takeover cases from session execution and takeover packs", () => {
    const cases = buildTakeoverCases({
      company: createCompany(),
      sessions: [
        {
          key: "session-coo",
          agentId: "coo",
          updatedAt: 12_000,
        },
      ],
      sessionExecutions: new Map([["session-coo", createExecution("当前链路已经无法自动闭环。")]]),
      takeoverPacks: new Map([
        [
          "session-coo",
          {
            title: "COO 发布链路接管",
            ownerLabel: "COO",
            sourceSessionKey: "session-coo",
            failureSummary: "发布页面持续失败。",
            lastSuccessfulStep: "成功打开发布后台",
            failedStep: "点击提交失败",
            recommendedNextAction: "打开原会话并人工继续发布。",
            urls: ["https://example.com"],
            filePaths: [],
            operatorNote: "operator-note",
          },
        ],
      ]),
    });

    expect(cases).toHaveLength(1);
    expect(cases[0]).toMatchObject({
      id: "takeover:session-coo",
      ownerLabel: "COO",
      title: "COO 发布链路接管",
      failureSummary: "发布页面持续失败。",
      recommendedNextAction: "打开原会话并人工继续发布。",
      status: "detected",
      route: "/chat/coo?cid=company-1",
    });
  });

  it("summarizes the newest takeover case first", () => {
    const cases = buildTakeoverCases({
      company: createCompany(),
      sessions: [
        { key: "session-ceo", agentId: "ceo", updatedAt: 10_000 },
        { key: "session-coo", agentId: "coo", updatedAt: 12_000 },
      ],
      sessionExecutions: new Map([
        ["session-ceo", createExecution("CEO 需要人工接管。")],
        ["session-coo", createExecution("COO 需要人工接管。")],
      ]),
    });

    const summary = buildTakeoverCaseSummary(cases);

    expect(summary.totalCount).toBe(2);
    expect(summary.primaryCase?.sourceSessionKey).toBe("session-coo");
    expect(summary.description).toContain("2 条执行链路");
    expect(summary.description).toContain(summary.primaryCase?.title ?? "");
  });

  it("reuses persisted takeover workflow status when a case has already been assigned", () => {
    const company = createCompany();
    company.takeoverCases = [
      {
        id: "takeover:session-coo",
        title: "COO 发布链路接管",
        route: "/chat/coo?cid=company-1",
        sourceSessionKey: "session-coo",
        sourceWorkItemId: "work-1",
        sourceTopicKey: "topic:launch",
        sourceDispatchId: "dispatch-1",
        ownerAgentId: "coo",
        ownerLabel: "COO",
        assigneeAgentId: "ceo",
        assigneeLabel: "CEO",
        failureSummary: "发布页面持续失败。",
        recommendedNextAction: "CEO 人工补发。",
        status: "assigned",
        createdAt: 10_000,
        updatedAt: 12_500,
        detectedAt: 10_000,
        acknowledgedAt: 11_000,
        assignedAt: 12_000,
        auditTrail: [],
      },
    ];

    const cases = buildTakeoverCases({
      company,
      sessions: [{ key: "session-coo", agentId: "coo", updatedAt: 13_000 }],
      sessionExecutions: new Map([["session-coo", createExecution("COO 需要人工接管。")]]),
    });

    expect(cases[0]).toMatchObject({
      status: "assigned",
      assigneeLabel: "CEO",
      sourceWorkItemId: "work-1",
      sourceTopicKey: "topic:launch",
      sourceDispatchId: "dispatch-1",
    });
  });

  it("persists takeover workflow actions into company records", () => {
    const company = createCompany();
    const [caseItem] = buildTakeoverCases({
      company,
      sessions: [{ key: "session-coo", agentId: "coo", updatedAt: 12_000 }],
      sessionExecutions: new Map([["session-coo", createExecution("COO 需要人工接管。")]]),
    });

    const acknowledged = applyTakeoverCaseWorkflowAction({
      company,
      caseItem,
      action: "acknowledge",
      actorId: "operator:alice",
      actorLabel: "Alice",
      timestamp: 20_000,
    });
    const assigned = applyTakeoverCaseWorkflowAction({
      company: { ...company, takeoverCases: acknowledged },
      caseItem,
      action: "assign",
      actorId: "operator:alice",
      actorLabel: "Alice",
      assigneeAgentId: "ceo",
      assigneeLabel: "CEO",
      timestamp: 21_000,
    });
    const resolved = applyTakeoverCaseWorkflowAction({
      company: { ...company, takeoverCases: assigned },
      caseItem,
      action: "resolve",
      actorId: "operator:alice",
      actorLabel: "Alice",
      note: "已人工补发并确认可恢复自动推进。",
      timestamp: 22_000,
    });
    const redispatched = applyTakeoverCaseWorkflowAction({
      company: { ...company, takeoverCases: resolved },
      caseItem,
      action: "redispatch",
      actorId: "operator:alice",
      actorLabel: "Alice",
      assigneeAgentId: "coo",
      assigneeLabel: "COO",
      note: "请从提测步骤继续执行。",
      dispatchId: "dispatch:takeover:1",
      timestamp: 23_000,
    });

    expect(acknowledged[0]).toMatchObject({
      status: "acknowledged",
      acknowledgedAt: 20_000,
    });
    expect(assigned[0]).toMatchObject({
      status: "assigned",
      assigneeAgentId: "ceo",
      assigneeLabel: "CEO",
      assignedAt: 21_000,
    });
    expect(resolved[0]).toMatchObject({
      status: "resolved",
      resolvedAt: 22_000,
    });
    expect(getTakeoverCaseResolutionNote({ auditTrail: resolved[0].auditTrail ?? [] })).toBe(
      "已人工补发并确认可恢复自动推进。",
    );
    expect(redispatched[0]).toMatchObject({
      status: "resolved",
      assigneeAgentId: "coo",
      assigneeLabel: "COO",
    });
    expect(
      getTakeoverCaseLatestRedispatch({ auditTrail: redispatched[0].auditTrail ?? [] }),
    ).toMatchObject({
      action: "redispatched",
      assigneeAgentId: "coo",
      assigneeLabel: "COO",
      note: "请从提测步骤继续执行。",
      dispatchId: "dispatch:takeover:1",
    });
    expect(redispatched[0].auditTrail?.map((entry) => entry.action)).toEqual([
      "acknowledged",
      "assigned",
      "resolved",
      "redispatched",
    ]);
  });

  it("keeps resolved takeover cases visible until they are archived", () => {
    const company = createCompany();
    company.takeoverCases = [
      {
        id: "takeover:session-coo",
        title: "COO 发布链路接管",
        route: "/chat/coo?cid=company-1",
        sourceSessionKey: "session-coo",
        failureSummary: "发布页面持续失败。",
        recommendedNextAction: "CEO 手工补发。",
        ownerAgentId: "coo",
        ownerLabel: "COO",
        assigneeAgentId: "ceo",
        assigneeLabel: "CEO",
        status: "resolved",
        createdAt: 10_000,
        updatedAt: 12_500,
        detectedAt: 10_000,
        resolvedAt: 12_500,
        auditTrail: [],
      },
    ];

    const cases = buildTakeoverCases({
      company,
      sessions: [],
      sessionExecutions: new Map(),
    });

    expect(cases).toHaveLength(1);
    expect(cases[0].status).toBe("resolved");
  });
});
