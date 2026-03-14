import { describe, expect, it } from "vitest";
import { buildCompanyHeartbeatSurface } from "./company-heartbeat";
import { buildDefaultOrgSettings } from "../../domain/org/autonomy-policy";
import { createCompanyEvent } from "../../domain/delegation/events";
import type { Company } from "../../domain/org/types";

function createCompany(orgSettings?: Company["orgSettings"]): Company {
  return {
    id: "company-1",
    name: "测试公司",
    description: "",
    icon: "🏢",
    template: "blank",
    orgSettings: buildDefaultOrgSettings(orgSettings),
    employees: [],
    quickPrompts: [],
    createdAt: 1,
  };
}

describe("buildCompanyHeartbeatSurface", () => {
  it("uses Cyber Company as the single source of truth and computes the next run", () => {
    const surface = buildCompanyHeartbeatSurface({
      company: createCompany({
        heartbeatPolicy: {
          enabled: true,
          paused: false,
          intervalMinutes: 10,
        },
        autonomyState: {
          lastHeartbeatCheckAt: 5_000,
          lastEngineRunAt: 4_500,
          lastHeartbeatSkipReason: "heartbeat_not_due",
          lastHeartbeatTrigger: "interval",
          lastEngineActions: ["已自动升级支持请求"],
        },
      }),
      events: [
        createCompanyEvent({
          companyId: "company-1",
          kind: "heartbeat_cycle_checked",
          fromActorId: "system:company-ops-engine",
          createdAt: 5_000,
          payload: {
            trigger: "event",
            ran: true,
            reasons: ["room.append"],
            actions: ["已自动升级支持请求"],
            actionCount: 1,
          },
        }),
      ],
      now: 6_000,
    });

    expect(surface.sourceOfTruth).toBe("cyber_company");
    expect(surface.syncTarget).toBe("openclaw");
    expect(surface.intervalMinutes).toBe(10);
    expect(surface.status).toBe("scheduled");
    expect(surface.nextRunAt).toBe(605_000);
    expect(surface.recentActions).toEqual(["已自动升级支持请求"]);
    expect(surface.recentAudit).toHaveLength(1);
    expect(surface.recentAudit[0]?.summary).toContain("事件续推完成");
    expect(surface.recentAudit[0]?.detail).toContain("需求房新增回报");
  });

  it("shows paused heartbeat without inventing a second config source", () => {
    const surface = buildCompanyHeartbeatSurface({
      company: createCompany({
        heartbeatPolicy: {
          enabled: true,
          paused: true,
          intervalMinutes: 5,
          syncTarget: "none",
        },
      }),
      now: 10_000,
    });

    expect(surface.status).toBe("paused");
    expect(surface.enabled).toBe(true);
    expect(surface.paused).toBe(true);
    expect(surface.syncTarget).toBe("none");
    expect(surface.title).toContain("已暂停");
  });

  it("ignores heartbeat audit events from other companies", () => {
    const surface = buildCompanyHeartbeatSurface({
      company: createCompany(),
      events: [
        createCompanyEvent({
          companyId: "company-2",
          kind: "heartbeat_cycle_checked",
          fromActorId: "system:company-ops-engine",
          createdAt: 8_000,
          payload: {
            trigger: "interval",
            ran: true,
            actionCount: 1,
          },
        }),
      ],
      now: 9_000,
    });

    expect(surface.recentAudit).toEqual([]);
  });
});
