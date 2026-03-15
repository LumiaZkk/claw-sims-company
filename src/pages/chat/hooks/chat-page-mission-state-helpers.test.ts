import { describe, expect, it } from "vitest";
import {
  deriveChatPageDisplayState,
  deriveChatPageRequirementState,
} from "./chat-page-mission-state-helpers";
import { buildDefaultOrgSettings } from "../../../domain/org/autonomy-policy";
import type { Company } from "../../../domain/org/types";
import type { RequirementAggregateRecord } from "../../../domain/mission/types";

function createCompany(overrides: Partial<Company> = {}): Company {
  return {
    id: "company-1",
    name: "测试公司",
    description: "",
    icon: "🏢",
    template: "blank",
    orgSettings: buildDefaultOrgSettings(),
    employees: [
      {
        agentId: "ceo-1",
        nickname: "CEO",
        role: "CEO",
        isMeta: true,
        metaRole: "ceo",
      },
    ],
    quickPrompts: [],
    workspaceApps: [],
    skillDefinitions: [],
    skillRuns: [],
    capabilityRequests: [],
    capabilityIssues: [],
    capabilityAuditEvents: [],
    createdAt: 1,
    ...overrides,
  };
}

function createAggregate(overrides: Partial<RequirementAggregateRecord> = {}): RequirementAggregateRecord {
  return {
    id: "requirement-1",
    summary: "整理 CEO 主线",
    nextAction: "确认是否进入需求团队",
    ...overrides,
  } as RequirementAggregateRecord;
}

describe("chat-page-mission-state-helpers", () => {
  it("keeps the recent conversation headline stable even when a preferred topic key is present", () => {
    const state = deriveChatPageRequirementState({
      activeCompany: createCompany(),
      activeConversationStates: [],
      activeDecisionTickets: [],
      activeRequirementAggregates: [createAggregate({ topicKey: "requirement-topic" })],
      activeRequirementEvidence: [],
      activeRoomRecords: [],
      activeWorkItems: [],
      companySessionSnapshots: [],
      currentTime: 10_000,
      groupTitle: null,
      groupTopic: "group-topic",
      isArchiveView: false,
      isCeoSession: true,
      isGroup: false,
      messages: [
        {
          id: "message-1",
          role: "assistant",
          text: "我们聚焦用户增长漏斗",
          timestamp: 10_000,
        },
      ],
      persistedWorkItem: {
        id: "work-1",
        title: "用户增长漏斗",
        topicKey: "persisted-topic",
      } as ChatPageRequirementStateTestWorkItem,
      preferredConversationTopicKey: "preferred-topic",
      primaryRequirementId: "requirement-1",
      requirementOverview: {
        topicKey: "overview-topic",
        title: "需求总览标题",
        summary: "需求总览摘要",
      } as ChatPageRequirementStateTestOverview,
      stableDisplayWorkItem: {
        id: "stable-work-1",
        title: "稳定主线标题",
        headline: "稳定主线标题",
        displaySummary: "稳定摘要",
      } as ChatPageRequirementStateTestWorkItem,
    });

    expect(state.singleChatMainlineTitle).toBe("我们聚焦用户增长漏斗");
  });

  it("shows structured decision state ahead of room navigation actions", () => {
    const displayState = deriveChatPageDisplayState({
      authorityBackedState: false,
      displayNextBatonAgentId: "cto-1",
      displayNextBatonLabel: "CTO",
      effectiveActionHint: "继续推进",
      effectiveHeadline: "主线标题",
      effectiveOwnerLabel: "CEO",
      effectiveStatusLabel: "推进中",
      effectiveStepLabel: "方案确认",
      effectiveSummary: "等待确认方案",
      effectiveTone: "sky",
      groupMainlineHeadline: "多人协作主线",
      groupMainlineSummary: "多人协作摘要",
      groupTitle: "需求团队",
      hasStableDisplayWorkItem: true,
      isArchiveView: false,
      isCeoSession: true,
      isGroup: true,
      isRequirementBootstrapPending: false,
      primaryOpenAction: {
        href: "/rooms/requirement-1",
        label: "打开需求房间",
      },
      primaryRequirementSurface: {
        openDecisionTicket: {
          requiresHuman: true,
          decisionType: "requirement_change",
          summary: "请确认是否接受变更",
        },
        ownerLabel: "CEO",
        currentStep: "待确认",
        summary: "等待 CEO 决策",
        nextBatonLabel: "CTO",
        nextBatonActorId: "cto-1",
        title: "需求团队主线",
      } as ChatPageRequirementStateTestSurface,
      recentStructuredMissionNextAction: "请先确认当前决策",
      requirementCollaborationSurface: {
        phaseLabel: "方案确认",
        currentBlocker: "等待 CEO 点选结构化选项",
        latestConclusionSummary: "已收敛出两个可执行方案",
        headerSummary: {
          currentBlocker: "等待 CEO 点选结构化选项",
          phaseLabel: "方案确认",
          activeParticipantsLabel: "CEO、CTO",
        },
        isSingleOwnerClosure: false,
      } as ChatPageRequirementStateTestCollaborationSurface,
      resolvedRequirementRoom: {
        id: "room-1",
        route: "/rooms/requirement-1",
      } as ChatPageRequirementStateTestRoom,
      settledRequirementNextAction: "进入需求团队继续推进",
      settledRequirementSummary: "已经收敛成一条主线",
      showSettledRequirementCard: false,
      teamGroupRoute: "/rooms/requirement-1",
    });

    expect(displayState.chatSurfaceStatusLabel).toBe("待你确认");
    expect(displayState.chatSurfacePrimaryOpenAction).toBeNull();
    expect(displayState.displayGroupSummaryItems[0]).toEqual({
      label: "当前阻塞",
      value: "等待 CEO 点选结构化选项",
    });
  });
});

type ChatPageRequirementStateTestWorkItem = {
  id: string;
  title?: string | null;
  headline?: string | null;
  topicKey?: string | null;
  displaySummary?: string | null;
};

type ChatPageRequirementStateTestOverview = {
  topicKey?: string | null;
  title?: string | null;
  summary?: string | null;
};

type ChatPageRequirementStateTestSurface = {
  openDecisionTicket?: {
    requiresHuman?: boolean;
    decisionType?: string | null;
    summary?: string | null;
  } | null;
  ownerLabel?: string | null;
  currentStep?: string | null;
  summary?: string | null;
  nextBatonLabel?: string | null;
  nextBatonActorId?: string | null;
  title?: string | null;
};

type ChatPageRequirementStateTestCollaborationSurface = {
  phaseLabel?: string | null;
  currentBlocker?: string | null;
  latestConclusionSummary?: string | null;
  headerSummary: {
    currentBlocker?: string | null;
    phaseLabel?: string | null;
    activeParticipantsLabel?: string | null;
  };
  isSingleOwnerClosure?: boolean;
};

type ChatPageRequirementStateTestRoom = {
  id: string;
  route?: string | null;
};
