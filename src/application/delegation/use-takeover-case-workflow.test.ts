import { beforeEach, describe, expect, it, vi } from "vitest";
import type { Company } from "../../domain/org/types";
import type { TakeoverCase } from "./takeover-case";
import {
  persistTakeoverCaseRedispatch,
  persistTakeoverCaseWorkflowAction,
} from "./use-takeover-case-workflow";
import { transitionAuthorityTakeoverCase } from "../gateway/authority-control";
import { readCompanyRuntimeState } from "../../infrastructure/company/runtime/selectors";
import { applyAuthorityBootstrapToStore } from "../../infrastructure/authority/bootstrap-command";
import { enqueueDelegationDispatch } from "./async-dispatch";

vi.mock("../gateway/authority-control", () => ({
  transitionAuthorityTakeoverCase: vi.fn(),
}));

vi.mock("../../infrastructure/company/runtime/selectors", () => ({
  readCompanyRuntimeState: vi.fn(),
}));

vi.mock("../../infrastructure/authority/bootstrap-command", () => ({
  applyAuthorityBootstrapToStore: vi.fn(),
}));

vi.mock("./async-dispatch", () => ({
  enqueueDelegationDispatch: vi.fn(),
}));

function createCompany(): Company {
  return {
    id: "company-1",
    name: "Test Company",
    description: "",
    icon: "🏢",
    template: "blank",
    createdAt: 1,
    employees: [
      {
        agentId: "ceo",
        nickname: "CEO",
        role: "CEO",
        isMeta: true,
        metaRole: "ceo",
      },
      {
        agentId: "coo",
        nickname: "COO",
        role: "COO",
        isMeta: true,
        metaRole: "coo",
      },
    ],
    quickPrompts: [],
  };
}

function createCase(): TakeoverCase {
  return {
    id: "takeover:session-coo",
    title: "COO 发布链路接管",
    ownerAgentId: "coo",
    ownerLabel: "COO",
    assigneeAgentId: null,
    assigneeLabel: null,
    sourceSessionKey: "session-coo",
    sourceWorkItemId: "work-1",
    sourceTopicKey: "topic:launch",
    sourceDispatchId: "dispatch-1",
    sourceRoomId: "room-1",
    failureSummary: "发布链路持续失败。",
    recommendedNextAction: "由 CEO 手工继续发布并回填结果。",
    route: "/chat/coo?cid=company-1",
    detectedAt: 10_000,
    updatedAt: 10_000,
    status: "detected",
    auditTrail: [],
  };
}

function createBootstrap() {
  return {
    config: null,
    activeCompany: null,
    runtime: null,
    executor: {
      adapter: "openclaw-bridge" as const,
      state: "ready" as const,
      provider: "openclaw" as const,
      note: "ok",
    },
    executorConfig: {
      type: "openclaw" as const,
      openclaw: { url: "ws://localhost:18789", tokenConfigured: true },
      connectionState: "ready" as const,
      lastError: null,
      lastConnectedAt: null,
    },
    executorCapabilities: {
      sessionStatus: "supported" as const,
      processRuntime: "supported" as const,
      notes: [],
    },
    executorReadiness: [],
    authority: {
      url: "http://127.0.0.1:18890",
      dbPath: "/tmp/authority.sqlite",
      connected: true as const,
    },
  };
}

describe("persistTakeoverCaseWorkflowAction", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("falls back to local company updates outside authority-backed mode", async () => {
    vi.mocked(readCompanyRuntimeState).mockReturnValue({
      authorityBackedState: false,
    } as ReturnType<typeof readCompanyRuntimeState>);
    const updateCompany = vi.fn().mockResolvedValue(undefined);

    const result = await persistTakeoverCaseWorkflowAction({
      activeCompany: createCompany(),
      updateCompany,
      caseItem: createCase(),
      action: "assign",
      assigneeAgentId: "ceo",
      assigneeLabel: "CEO",
    });

    expect(transitionAuthorityTakeoverCase).not.toHaveBeenCalled();
    expect(updateCompany).toHaveBeenCalledWith({
      takeoverCases: [
        expect.objectContaining({
          id: "takeover:session-coo",
          status: "assigned",
          assigneeAgentId: "ceo",
          assigneeLabel: "CEO",
        }),
      ],
    });
    expect(applyAuthorityBootstrapToStore).not.toHaveBeenCalled();
    expect(result?.status).toBe("assigned");
  });

  it("uses the authority takeover command when authority-backed mode is active", async () => {
    vi.mocked(readCompanyRuntimeState).mockReturnValue({
      authorityBackedState: true,
    } as ReturnType<typeof readCompanyRuntimeState>);
    const updateCompany = vi.fn().mockResolvedValue(undefined);
    const bootstrap = createBootstrap();
    vi.mocked(transitionAuthorityTakeoverCase).mockResolvedValue({
      bootstrap,
      takeoverCase: {
        id: "takeover:session-coo",
        title: "COO 发布链路接管",
        route: "/chat/coo?cid=company-1",
        sourceSessionKey: "session-coo",
        sourceWorkItemId: "work-1",
        sourceTopicKey: "topic:launch",
        sourceDispatchId: "dispatch-1",
        sourceRoomId: "room-1",
        ownerAgentId: "coo",
        ownerLabel: "COO",
        assigneeAgentId: "ceo",
        assigneeLabel: "CEO",
        failureSummary: "发布链路持续失败。",
        recommendedNextAction: "由 CEO 手工继续发布并回填结果。",
        status: "in_progress",
        createdAt: 10_000,
        updatedAt: 12_000,
        detectedAt: 10_000,
        acknowledgedAt: 11_000,
        assignedAt: 11_000,
        startedAt: 12_000,
        auditTrail: [],
      },
    });

    const result = await persistTakeoverCaseWorkflowAction({
      activeCompany: createCompany(),
      updateCompany,
      caseItem: createCase(),
      action: "start",
      assigneeAgentId: "ceo",
      assigneeLabel: "CEO",
      note: "人工接手发布",
    });

    expect(transitionAuthorityTakeoverCase).toHaveBeenCalledWith({
      companyId: "company-1",
      caseRecord: expect.objectContaining({
        id: "takeover:session-coo",
        title: "COO 发布链路接管",
        status: "detected",
        createdAt: 10_000,
      }),
      action: "start",
      actorId: undefined,
      actorLabel: undefined,
      assigneeAgentId: "ceo",
      assigneeLabel: "CEO",
      note: "人工接手发布",
    });
    expect(updateCompany).not.toHaveBeenCalled();
    expect(applyAuthorityBootstrapToStore).toHaveBeenCalledWith(bootstrap);
    expect(result?.status).toBe("in_progress");
  });

  it("redispatches takeover cases and persists the follow-up audit trail", async () => {
    vi.mocked(readCompanyRuntimeState).mockReturnValue({
      authorityBackedState: false,
    } as ReturnType<typeof readCompanyRuntimeState>);
    vi.mocked(enqueueDelegationDispatch).mockResolvedValue({
      dispatch: {
        id: "dispatch:takeover:session-coo:coo:123",
        workItemId: "work-1",
        revision: 1,
        roomId: "room-1",
        title: "人工接管续推 · COO 发布链路接管",
        summary: "人工恢复后请继续执行",
        fromActorId: "operator:alice",
        targetActorIds: ["coo"],
        status: "pending",
        deliveryState: "pending",
        topicKey: "topic:launch",
        createdAt: 123,
        updatedAt: 123,
      },
      actorRef: { agentId: "coo" },
      conversationRef: { id: "conversation-1" },
      providerConversationRef: { conversationId: "session-coo" },
    } as unknown as Awaited<ReturnType<typeof enqueueDelegationDispatch>>);
    const upsertDispatchRecord = vi.fn();
    const updateCompany = vi.fn().mockResolvedValue(undefined);
    const activeCompany = createCompany();
    const caseItem = {
      ...createCase(),
      status: "resolved" as const,
      assigneeAgentId: "ceo",
      assigneeLabel: "CEO",
      auditTrail: [
        {
          id: "resolved-1",
          action: "resolved" as const,
          actorId: "operator:alice",
          actorLabel: "Alice",
          status: "resolved" as const,
          timestamp: 120,
          note: "已人工恢复并确认可继续。",
          assigneeAgentId: "ceo",
          assigneeLabel: "CEO",
        },
      ],
    };

    const result = await persistTakeoverCaseRedispatch({
      activeCompany,
      providerManifest: {} as Parameters<typeof persistTakeoverCaseRedispatch>[0]["providerManifest"],
      updateCompany,
      upsertDispatchRecord,
      caseItem,
      actorId: "operator:alice",
      actorLabel: "Alice",
      note: "人工恢复后请继续执行",
      authorityBackedState: false,
    });

    expect(enqueueDelegationDispatch).toHaveBeenCalledWith(
      expect.objectContaining({
        actorId: "coo",
        workItemId: "work-1",
        topicKey: "topic:launch",
        roomId: "room-1",
      }),
    );
    expect(upsertDispatchRecord).toHaveBeenCalledWith(
      expect.objectContaining({
        id: "dispatch:takeover:session-coo:coo:123",
      }),
    );
    const persistedTakeoverCases = vi.mocked(updateCompany).mock.calls[0]?.[0]?.takeoverCases;
    expect(persistedTakeoverCases).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: "takeover:session-coo",
          status: "resolved",
          assigneeAgentId: "coo",
          assigneeLabel: "COO",
          auditTrail: expect.arrayContaining([
            expect.objectContaining({
              action: "redispatched",
              note: "人工恢复后请继续执行",
              dispatchId: expect.stringContaining("dispatch:takeover:takeover:session-coo:coo:"),
            }),
          ]),
        }),
      ]),
    );
    expect(result.targetAgentId).toBe("coo");
    expect(result.targetLabel).toBe("COO");
    expect(result.dispatch.id).toBe("dispatch:takeover:session-coo:coo:123");
  });
});
