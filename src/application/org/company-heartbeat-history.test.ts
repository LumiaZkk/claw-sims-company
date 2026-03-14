import { describe, expect, it } from "vitest";
import { buildCompanyHeartbeatAuditEntries } from "./company-heartbeat-history";
import { createCompanyEvent } from "../../domain/delegation/events";

describe("buildCompanyHeartbeatAuditEntries", () => {
  it("sorts heartbeat audit entries and summarizes executed actions", () => {
    const entries = buildCompanyHeartbeatAuditEntries({
      events: [
        createCompanyEvent({
          companyId: "company-1",
          kind: "heartbeat_cycle_checked",
          fromActorId: "system:company-ops-engine",
          createdAt: 2_000,
          payload: {
            trigger: "event",
            ran: true,
            reasons: ["room.append", "takeover.transition"],
            actionCount: 2,
            actions: ["已自动升级支持请求", "已刷新决策票"],
          },
        }),
        createCompanyEvent({
          companyId: "company-1",
          kind: "ops_cycle_applied",
          fromActorId: "system:company-ops-engine",
          createdAt: 1_500,
          payload: {
            actions: ["ignore"],
            actionCount: 1,
          },
        }),
      ],
    });

    expect(entries).toHaveLength(1);
    expect(entries[0]).toMatchObject({
      trigger: "event",
      ran: true,
      reasonLabels: ["需求房新增回报", "接管状态已变化"],
      actionCount: 2,
      actions: ["已自动升级支持请求", "已刷新决策票"],
    });
    expect(entries[0]?.summary).toContain("事件续推完成");
    expect(entries[0]?.detail).toContain("需求房新增回报");
  });

  it("describes skipped heartbeat checks", () => {
    const entries = buildCompanyHeartbeatAuditEntries({
      events: [
        createCompanyEvent({
          companyId: "company-1",
          kind: "heartbeat_cycle_checked",
          fromActorId: "system:company-ops-engine",
          createdAt: 3_000,
          payload: {
            trigger: "interval",
            ran: false,
            skipReason: "heartbeat_not_due",
            reasons: ["interval"],
            actionCount: 0,
            actions: [],
          },
        }),
      ],
    });

    expect(entries[0]?.ran).toBe(false);
    expect(entries[0]?.skipReason).toBe("heartbeat_not_due");
    expect(entries[0]?.summary).toContain("未到下一轮巡检时间");
    expect(entries[0]?.detail).toContain("周期到点");
  });
});
