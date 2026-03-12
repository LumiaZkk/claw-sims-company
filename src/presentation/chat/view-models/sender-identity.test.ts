import { describe, expect, it } from "vitest";
import { getChatSenderIdentity } from "./sender-identity";
import type { ChatMessage } from "../../../application/gateway";
import type { Company, EmployeeRef } from "../../../domain/org/types";

function createCompany(): Company {
  return {
    id: "company-1",
    name: "测试公司",
    description: "测试",
    icon: "🏢",
    template: "blank",
    employees: [
      {
        agentId: "co-ceo",
        nickname: "CEO",
        role: "Chief Executive Officer",
        isMeta: true,
        metaRole: "ceo",
      },
    ],
    quickPrompts: [],
    createdAt: 1_000,
  };
}

function createEmployeesByAgentId(): Map<string, EmployeeRef> {
  const company = createCompany();
  return new Map(company.employees.map((employee) => [employee.agentId, employee] as const));
}

function createInput(overrides: Partial<Parameters<typeof getChatSenderIdentity>[0]> = {}) {
  const company = createCompany();
  return {
    msg: { role: "user", text: "继续推进", timestamp: 1_000 } satisfies ChatMessage,
    activeCompany: company,
    employeesByAgentId: createEmployeesByAgentId(),
    isGroup: false,
    isCeoSession: false,
    groupTopic: null,
    emp: company.employees[0] ?? null,
    effectiveOwnerAgentId: null,
    requirementRoomSessionsLength: 0,
    ...overrides,
  };
}

describe("getChatSenderIdentity", () => {
  it("treats non-group user messages as the current user", () => {
    const identity = getChatSenderIdentity(
      createInput({
        msg: {
          role: "user",
          text: "张三：请继续推进",
          timestamp: 1_000,
        },
      }),
    );

    expect(identity).toMatchObject({
      name: "我",
      isOutgoing: true,
      isRelayed: false,
    });
  });

  it("uses neutral fallback labels for group relay guesses", () => {
    const identity = getChatSenderIdentity(
      createInput({
        isGroup: true,
        msg: {
          role: "user",
          text: "张三：请继续推进",
          timestamp: 1_000,
        },
      }),
    );

    expect(identity).toMatchObject({
      name: "张三",
      isRelayed: true,
      badgeLabel: "同步转发",
      metaLabel: "跨会话消息",
    });
  });

  it("keeps real group user prompts attributed to the current user", () => {
    const identity = getChatSenderIdentity(
      createInput({
        isGroup: true,
        requirementRoomSessionsLength: 1,
        msg: {
          role: "user",
          text: "@CEO 直接用我现有的账号，评估登录方式",
          timestamp: 1_000,
          roomMessageSource: "owner_dispatch",
          roomAudienceAgentIds: ["co-ceo"],
        },
      }),
    );

    expect(identity).toMatchObject({
      name: "我",
      isOutgoing: true,
      attributionKind: "user",
      metaLabel: "已发送给全体成员",
    });
  });

  it("does not attribute unowned collaborator reports in group chat to the current user", () => {
    const identity = getChatSenderIdentity(
      createInput({
        isGroup: true,
        msg: {
          role: "user",
          text: "[company_report:answered] dispatch=dispatch:1\n已完成登录方式评估，推荐优先抖音账号登录。",
          timestamp: 1_000,
        },
      }),
    );

    expect(identity).toMatchObject({
      name: "协作消息",
      isOutgoing: false,
      attributionKind: "unknown",
      badgeLabel: "协作者回执",
    });
  });
});
