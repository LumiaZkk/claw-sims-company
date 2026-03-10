import { describe, expect, it } from "vitest";

import {
  buildDefaultMainCompany,
  DEFAULT_MAIN_AGENT_ID,
  DEFAULT_MAIN_COMPANY_ID,
  DEFAULT_MAIN_COMPANY_NAME,
  isDefaultMainCompany,
  isReservedSystemCompany,
} from "./system-company";

describe("system company helpers", () => {
  it("builds the reserved default company for the OpenClaw main agent", () => {
    const company = buildDefaultMainCompany();

    expect(company.id).toBe(DEFAULT_MAIN_COMPANY_ID);
    expect(company.name).toBe(DEFAULT_MAIN_COMPANY_NAME);
    expect(company.system).toMatchObject({
      reserved: true,
      kind: "openclaw-main",
      mappedAgentId: DEFAULT_MAIN_AGENT_ID,
    });
    expect(company.employees).toHaveLength(1);
    expect(company.employees[0]).toMatchObject({
      agentId: DEFAULT_MAIN_AGENT_ID,
      metaRole: "ceo",
      isMeta: true,
    });
  });

  it("identifies reserved and default system companies", () => {
    const company = buildDefaultMainCompany();

    expect(isReservedSystemCompany(company)).toBe(true);
    expect(isDefaultMainCompany(company)).toBe(true);
    expect(
      isReservedSystemCompany({
        ...company,
        system: {
          reserved: false,
        },
      }),
    ).toBe(false);
  });
});
