import { describe, expect, it } from "vitest";
import { buildBoardTaskSurface } from "./board-task-surface";
import type { Company } from "../../domain/org/types";
import type { TrackedTask } from "../../domain/mission/types";
import type { ManualTakeoverPack } from "../delegation/takeover-pack";

function createCompany(overrides: Partial<Company> = {}): Company {
  return {
    id: "company-no",
    name: "No",
    description: "Test company",
    icon: "🏢",
    template: "default",
    employees: [
      {
        agentId: "co-ceo",
        nickname: "CEO",
        role: "CEO",
        isMeta: true,
        metaRole: "ceo",
      },
      {
        agentId: "co-cto",
        nickname: "CTO",
        role: "CTO",
        isMeta: true,
        metaRole: "cto",
      },
    ],
    quickPrompts: [],
    tasks: [],
    handoffs: [],
    requests: [],
    createdAt: 1_000,
    ...overrides,
  };
}

function createFileTask(overrides: Partial<TrackedTask> = {}): TrackedTask {
  return {
    id: "task:file:1",
    title: "小说发布任务板",
    sessionKey: "agent:co-cto:main",
    agentId: "co-cto",
    ownerAgentId: "co-cto",
    source: "file",
    state: "running",
    summary: "CTO 先完成技术评估，再进入实现。",
    steps: [
      { text: "完成技术评估", status: "done", assignee: "co-cto" },
      { text: "拆解阶段计划", status: "wip", assignee: "co-cto" },
    ],
    createdAt: 1_000,
    updatedAt: 2_000,
    ...overrides,
  };
}

describe("buildBoardTaskSurface", () => {
  it("falls back to file-backed tasks when there is no active requirement", () => {
    const fileTask = createFileTask();

    const surface = buildBoardTaskSurface({
      activeCompany: createCompany(),
      companySessions: [],
      currentTime: 3_000,
      fileTasks: [fileTask],
      sessionStates: new Map(),
      sessionTakeoverPacks: new Map(),
      requirementScope: null,
      currentWorkItem: null,
      activeWorkItem: null,
      requirementOverview: null,
      strategicRequirementOverview: null,
      isStrategicRequirement: false,
      requirementSyntheticTask: null,
    });

    expect(surface.trackedTasks).toHaveLength(1);
    expect(surface.trackedTasks[0]?.id).toBe(fileTask.id);
    expect(surface.activeTasks).toHaveLength(1);
    expect(surface.totalSteps).toBe(2);
    expect(surface.doneSteps).toBe(1);
    expect(surface.wipSteps).toBe(1);
  });

  it("prefers canonical session execution over local task fallback states", () => {
    const fileTask = createFileTask({
      summary: "旧历史里还写着等待交接，但权威状态已经恢复。",
      state: "running",
    });

    const surface = buildBoardTaskSurface({
      activeCompany: createCompany(),
      companySessions: [],
      currentTime: 3_000,
      fileTasks: [fileTask],
      sessionStates: new Map([
        [
          fileTask.sessionKey,
          {
            state: "completed",
            label: "已完成",
            summary: "当前链路最近一次交付已经完成。",
            actionable: false,
            tone: "emerald",
            evidence: [],
          },
        ],
      ]),
      sessionTakeoverPacks: new Map(),
      requirementScope: null,
      currentWorkItem: null,
      activeWorkItem: null,
      requirementOverview: null,
      strategicRequirementOverview: null,
      isStrategicRequirement: false,
      requirementSyntheticTask: null,
    });

    expect(surface.taskSequence[0]?.execution.state).toBe("completed");
    expect(surface.taskSequence[0]?.execution.label).toBe("已完成");
  });

  it("hides takeover and request recovery counters for strategic requirements", () => {
    const fileTask = createFileTask();
    const takeoverPack = {
      title: "人工接管",
      ownerLabel: "CTO",
      sourceSessionKey: fileTask.sessionKey,
      failureSummary: "当前链路需要人工接管。",
      lastSuccessfulStep: null,
      failedStep: "等待外部处理",
      recommendedNextAction: "请人工继续推进。",
      urls: [],
      filePaths: [],
      operatorNote: "请人工继续推进。",
    } satisfies ManualTakeoverPack;

    const surface = buildBoardTaskSurface({
      activeCompany: createCompany({
        handoffs: [
          {
            id: "handoff-1",
            status: "waiting",
            updatedAt: 2_000,
          } as any,
        ],
        requests: [
          {
            id: "request-1",
            status: "blocked",
            updatedAt: 2_000,
          } as any,
        ],
      }),
      companySessions: [],
      currentTime: 3_000,
      fileTasks: [fileTask],
      sessionStates: new Map(),
      sessionTakeoverPacks: new Map([[fileTask.sessionKey, takeoverPack]]),
      requirementScope: null,
      currentWorkItem: null,
      activeWorkItem: null,
      requirementOverview: null,
      strategicRequirementOverview: {
        aggregateId: "requirement-1",
      } as any,
      isStrategicRequirement: true,
      requirementSyntheticTask: null,
    });

    expect(surface.visibleTakeoverCount).toBe(0);
    expect(surface.visiblePendingHandoffs).toEqual([]);
    expect(surface.visibleSlaAlerts).toEqual([]);
    expect(surface.visibleRequestHealth.active).toBe(0);
  });
});
