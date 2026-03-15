import { describe, expect, it, vi } from "vitest";
import type { AuthorityCompanyRuntimeSnapshot } from "../../../src/infrastructure/authority/contract";
import type { DispatchRecord } from "../../../src/domain/delegation/types";
import {
  runAuthorityCompanyDispatchCommand,
  runAuthorityCompanyReportCommand,
} from "./company-dispatch-command";

function createRuntime(dispatches: DispatchRecord[] = []): AuthorityCompanyRuntimeSnapshot {
  return {
    companyId: "company-1",
    activeRoomRecords: [],
    activeMissionRecords: [],
    activeConversationStates: [],
    activeWorkItems: [],
    activeRequirementAggregates: [],
    activeRequirementEvidence: [],
    primaryRequirementId: null,
    activeRoundRecords: [],
    activeArtifacts: [],
    activeDispatches: dispatches,
    activeRoomBindings: [],
    activeSupportRequests: [],
    activeEscalations: [],
    activeDecisionTickets: [],
    updatedAt: 0,
  };
}

function createRepository(runtime: AuthorityCompanyRuntimeSnapshot) {
  return {
    hasCompany: vi.fn(() => true),
    getCollaborationScope: vi.fn(() => ({
      company: { id: "company-1" },
      scopeVersion: 1,
      generatedAt: 0,
      self: {
        agentId: "ceo",
        nickname: "CEO",
        role: "CEO",
        metaRole: "ceo" as const,
        isMeta: true,
        isDepartmentManager: true,
        departmentId: null,
        departmentName: null,
        departmentKind: "meta" as const,
      },
      manager: null,
      allowedDispatchTargets: [
        {
          agentId: "cto",
          nickname: "CTO",
          role: "CTO",
          metaRole: "cto" as const,
          isMeta: true,
          isDepartmentManager: true,
          departmentId: null,
          departmentName: null,
          departmentKind: "meta" as const,
          reason: "global_dispatch" as const,
        },
      ],
      defaultReportChain: [],
      supportTargets: [],
      escalationTargets: [],
    })),
    loadRuntime: vi.fn(() => runtime),
    appendCompanyEvent: vi.fn(),
  };
}

describe("company dispatch commands", () => {
  it("appends dispatch events and proxies chat.send", async () => {
    const runtime = createRuntime();
    const repository = createRepository(runtime);
    const proxyGatewayRequest = vi.fn().mockResolvedValue({ runId: "run-1" });

    const result = await runAuthorityCompanyDispatchCommand({
      body: {
        companyId: "company-1",
        fromActorId: "ceo",
        targetActorId: "cto",
        title: "启动A",
        summary: "请完成登录评估",
        message: "请完成登录评估并给出建议",
        dispatchId: "dispatch:test-1",
        workItemId: "work-1",
        createdAt: 123,
      },
      deps: {
        repository,
        proxyGatewayRequest,
        now: () => 456,
        randomUUID: () => "uuid-1",
      },
    });

    expect(proxyGatewayRequest).toHaveBeenCalledWith("chat.send", expect.objectContaining({
      sessionKey: "agent:cto:main",
      deliver: false,
      idempotencyKey: "uuid-1",
    }));
    const calls = repository.appendCompanyEvent.mock.calls.map((call) => call[0]);
    expect(calls[0]).toMatchObject({
      kind: "dispatch_enqueued",
      dispatchId: "dispatch:test-1",
      eventId: "dispatch_enqueued:dispatch:test-1",
      companyId: "company-1",
    });
    expect(calls[1]).toMatchObject({
      kind: "dispatch_sent",
      dispatchId: "dispatch:test-1",
      eventId: "dispatch_sent:dispatch:test-1",
      providerRunId: "run-1",
    });
    expect(result).toMatchObject({
      ok: true,
      dispatchId: "dispatch:test-1",
      workItemId: "work-1",
      sessionKey: "agent:cto:main",
      status: "sent",
    });
  });

  it("rejects disallowed dispatch targets", async () => {
    const runtime = createRuntime();
    const repository = createRepository(runtime);
    repository.getCollaborationScope.mockReturnValueOnce({
      company: { id: "company-1" },
      scopeVersion: 1,
      generatedAt: 0,
      self: {
        agentId: "ceo",
        nickname: "CEO",
        role: "CEO",
        metaRole: "ceo" as const,
        isMeta: true,
        isDepartmentManager: true,
        departmentId: null,
        departmentName: null,
        departmentKind: "meta" as const,
      },
      manager: null,
      allowedDispatchTargets: [],
      defaultReportChain: [],
      supportTargets: [],
      escalationTargets: [],
    });

    await expect(
      runAuthorityCompanyDispatchCommand({
        body: {
          companyId: "company-1",
          fromActorId: "ceo",
          targetActorId: "cto",
          message: "ship it",
        },
        deps: {
          repository,
          proxyGatewayRequest: vi.fn(),
        },
      }),
    ).rejects.toThrow("Dispatch target not allowed");
  });

  it("appends report events and proxies chat.send to owner", async () => {
    const dispatch: DispatchRecord = {
      id: "dispatch:test-1",
      workItemId: "work-1",
      title: "启动A",
      summary: "评估登录",
      fromActorId: "ceo",
      targetActorIds: ["cto"],
      status: "sent",
      createdAt: 100,
      updatedAt: 100,
    };
    const runtime = createRuntime([dispatch]);
    const repository = createRepository(runtime);
    const proxyGatewayRequest = vi.fn().mockResolvedValue({ runId: "run-9" });

    const result = await runAuthorityCompanyReportCommand({
      body: {
        companyId: "company-1",
        dispatchId: "dispatch:test-1",
        fromActorId: "cto",
        status: "answered",
        summary: "完成评估",
        details: "建议抖音授权优先",
        createdAt: 500,
      },
      deps: {
        repository,
        proxyGatewayRequest,
        now: () => 600,
        randomUUID: () => "uuid-9",
      },
    });

    expect(repository.appendCompanyEvent).toHaveBeenCalledWith(
      expect.objectContaining({
        kind: "report_answered",
        dispatchId: "dispatch:test-1",
        eventId: "report:dispatch:test-1:answered:cto:500",
      }),
    );
    expect(proxyGatewayRequest).toHaveBeenCalledWith("chat.send", expect.objectContaining({
      sessionKey: "agent:ceo:main",
      deliver: false,
      idempotencyKey: "uuid-9",
    }));
    expect(result).toMatchObject({
      ok: true,
      dispatchId: "dispatch:test-1",
      status: "answered",
      sessionKey: "agent:ceo:main",
    });
  });
});
