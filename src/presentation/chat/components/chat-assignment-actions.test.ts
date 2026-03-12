import { describe, expect, it } from "vitest";
import type { EmployeeRef } from "../../../domain/org/types";
import {
  pickBestAssignmentActionText,
  resolveAssignmentActionEmployees,
  resolveStructuredAssignmentTargets,
} from "./chat-assignment-actions";

const employees: EmployeeRef[] = [
  {
    agentId: "co-cto",
    nickname: "CTO",
    role: "Chief Technology Officer",
    isMeta: true,
    metaRole: "cto",
  },
  {
    agentId: "co-hr",
    nickname: "HR",
    role: "Human Resources Director",
    isMeta: true,
    metaRole: "hr",
  },
  {
    agentId: "co-coo",
    nickname: "COO",
    role: "Chief Operating Officer",
    isMeta: true,
    metaRole: "coo",
  },
];

describe("chat assignment actions", () => {
  it("prefers structured dispatch targets over mentions in summary text", () => {
    const target = resolveStructuredAssignmentTargets({
      linkedDispatchTargetAgentIds: ["co-cto", "co-hr", "co-coo"],
      roomMessageSource: "member_message",
      messageIntent: "work_update",
    });

    const resolved = resolveAssignmentActionEmployees({
      messageText: "任务 负责人\n【启动A】@CTO\n【启动B】@HR\n【启动C】@COO",
      employees,
      targetAgentIds: target.targetAgentIds,
      allowMentionFallback: target.allowMentionFallback,
    });

    expect(resolved.kind).toBe("dispatch");
    expect(resolved.employees.map((employee) => employee.agentId)).toEqual(["co-cto", "co-hr", "co-coo"]);
  });

  it("keeps summary mentions as related-member shortcuts instead of dispatch actions", () => {
    const target = resolveStructuredAssignmentTargets({
      roomMessageSource: "member_message",
      messageIntent: "work_update",
    });

    const resolved = resolveAssignmentActionEmployees({
      messageText: "【启动A】@CTO\n【启动B】@HR\n【启动C】@COO",
      employees,
      targetAgentIds: target.targetAgentIds,
      allowMentionFallback: target.allowMentionFallback,
    });

    expect(target).toEqual({
      targetAgentIds: [],
      allowMentionFallback: false,
    });
    expect(resolved.kind).toBe("related");
    expect(resolved.employees.map((employee) => employee.agentId)).toEqual(["co-cto", "co-hr", "co-coo"]);
  });

  it("falls back to mentions for legacy owner dispatches without structured targets", () => {
    const target = resolveStructuredAssignmentTargets({
      roomMessageSource: "owner_dispatch",
      messageIntent: "dispatch",
    });

    const resolved = resolveAssignmentActionEmployees({
      messageText: "@CTO 请继续推进",
      employees,
      targetAgentIds: target.targetAgentIds,
      allowMentionFallback: target.allowMentionFallback,
    });

    expect(target.allowMentionFallback).toBe(true);
    expect(resolved.kind).toBe("dispatch");
    expect(resolved.employees.map((employee) => employee.agentId)).toEqual(["co-cto"]);
  });

  it("prefers the richer content text when it resolves more mentioned members", () => {
    const text = pickBestAssignmentActionText({
      candidateTexts: [
        "👥 提到的成员\n@HR\n@COO",
        "任务完成总览\n【启动A】@CTO\n【启动B】@HR\n【启动C】@COO",
      ],
      employees,
      targetAgentIds: [],
      allowMentionFallback: false,
    });

    expect(text).toContain("@CTO");
  });
});
