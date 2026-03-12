import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  setBaseUrl: vi.fn(),
  connectEvents: vi.fn(),
  batchHireEmployees: vi.fn(),
  hireEmployee: vi.fn(),
  requestGateway: vi.fn(),
}));

vi.mock("../../authority/client", () => ({
  authorityClient: {
    setBaseUrl: mocks.setBaseUrl,
    connectEvents: mocks.connectEvents,
    batchHireEmployees: mocks.batchHireEmployees,
    hireEmployee: mocks.hireEmployee,
    requestGateway: mocks.requestGateway,
  },
}));

import { authorityBackend } from "./adapter";

describe("authority backend adapter", () => {
  beforeEach(() => {
    mocks.setBaseUrl.mockReset();
    mocks.connectEvents.mockReset();
    mocks.batchHireEmployees.mockReset();
    mocks.hireEmployee.mockReset();
    mocks.requestGateway.mockReset();
    mocks.connectEvents.mockImplementation(({ onOpen }) => {
      onOpen?.();
      return () => {};
    });
  });

  afterEach(() => {
    authorityBackend.disconnect();
  });

  it("advertises batch hire in hello features", () => {
    const onHello = vi.fn();
    authorityBackend.onHello(onHello);

    authorityBackend.connect("http://authority.test");

    expect(onHello).toHaveBeenCalledWith(
      expect.objectContaining({
        features: expect.objectContaining({
          methods: expect.arrayContaining([
            "authority.company.employee.hire",
            "authority.company.employee.batch_hire",
          ]),
        }),
      }),
    );
  });

  it("routes authority.company.employee.batch_hire to authorityClient.batchHireEmployees", async () => {
    mocks.batchHireEmployees.mockResolvedValue({
      company: { id: "company-1", name: "测试公司", employees: [], departments: [] },
      config: {
        version: 1,
        companies: [],
        activeCompanyId: "company-1",
        preferences: { theme: "classic", locale: "zh-CN" },
      },
      runtime: {
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
        activeDispatches: [],
        activeRoomBindings: [],
        activeSupportRequests: [],
        activeEscalations: [],
        activeDecisionTickets: [],
        updatedAt: 1,
      },
      employees: [],
      warnings: [],
    });

    const payload = {
      companyId: "company-1",
      hires: [
        {
          role: "内容总监",
          description: "统筹内容团队",
          departmentName: "内容创作事业部",
          makeDepartmentLead: true,
        },
      ],
    };

    await authorityBackend.request("authority.company.employee.batch_hire", payload);

    expect(mocks.batchHireEmployees).toHaveBeenCalledWith(payload);
  });
});
