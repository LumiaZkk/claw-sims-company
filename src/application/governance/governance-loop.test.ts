import { describe, expect, it } from "vitest";
import { buildGovernanceLoopSummary } from "./governance-loop";
import type { Company } from "../../domain/org/types";

function createCompany(): Company {
  return {
    id: "company-1",
    name: "Cyber Company",
    description: "governance loop test",
    icon: "building",
    template: "default",
    createdAt: 1,
    quickPrompts: [],
    employees: [],
    approvals: [],
    capabilityRequests: [],
    capabilityIssues: [],
  };
}

describe("buildGovernanceLoopSummary", () => {
  it("prioritizes pending decisions as action required", () => {
    const summary = buildGovernanceLoopSummary({
      company: {
        ...createCompany(),
        approvals: [
          {
            id: "approval-1",
            companyId: "company-1",
            scope: "org",
            actionType: "employee_fire",
            status: "pending",
            summary: "审批",
            requestedAt: 1,
            createdAt: 1,
            updatedAt: 1,
          },
        ],
      },
      pendingHumanDecisions: 1,
      manualTakeovers: 0,
      escalations: 0,
    });

    expect(summary.state).toBe("action_required");
    expect(summary.lanes[0]?.count).toBe(2);
  });

  it("surfaces capability verification as watch", () => {
    const summary = buildGovernanceLoopSummary({
      company: {
        ...createCompany(),
        capabilityRequests: [
          {
            id: "request-1",
            companyId: "company-1",
            summary: "补自动化面板",
            status: "ready",
            requestedAt: 1,
            createdAt: 1,
            updatedAt: 1,
          },
        ],
      },
      pendingHumanDecisions: 0,
      manualTakeovers: 0,
      escalations: 0,
    });

    expect(summary.state).toBe("watch");
    expect(summary.lanes[2]?.summary).toContain("待验证");
  });

  it("returns clear when all governance lanes are empty", () => {
    const summary = buildGovernanceLoopSummary({
      company: createCompany(),
      pendingHumanDecisions: 0,
      manualTakeovers: 0,
      escalations: 0,
    });

    expect(summary.state).toBe("clear");
    expect(summary.badgeLabel).toBe("已收口");
  });
});
