import fs from "node:fs";
import path from "node:path";
import vm from "node:vm";
import { describe, expect, it, vi } from "vitest";

type RegisteredTool = {
  name: string;
  execute: (id: string, params: unknown) => Promise<unknown>;
};

function loadPlugin(fetchImpl: typeof fetch) {
  const pluginPath = path.resolve(process.cwd(), ".openclaw/extensions/sims-company/index.js");
  const source = fs.readFileSync(pluginPath, "utf8");
  const sandbox = {
    module: { exports: {} as Record<string, unknown> },
    exports: {},
    fetch: fetchImpl,
    process: { env: {} },
    console,
  };

  vm.runInNewContext(source, sandbox, { filename: pluginPath });
  return sandbox.module.exports as {
    register: (api: {
      pluginConfig: Record<string, unknown>;
      registerTool: (factory: (ctx: { agentId: string }) => RegisteredTool) => void;
    }) => void;
  };
}

function registerTools(fetchImpl: typeof fetch) {
  const plugin = loadPlugin(fetchImpl);
  const tools: RegisteredTool[] = [];

  plugin.register({
    pluginConfig: {
      authorityUrl: "http://127.0.0.1:19789",
      companyId: "company-1",
      timeoutMs: 1200,
    },
    registerTool(factory) {
      const result = factory({ agentId: "company-1-hr" });
      if (result) {
        tools.push(result);
      }
    },
  });

  return tools;
}

function registerToolsForAgent(fetchImpl: typeof fetch, agentId: string) {
  const plugin = loadPlugin(fetchImpl);
  const tools: RegisteredTool[] = [];

  plugin.register({
    pluginConfig: {
      authorityUrl: "http://127.0.0.1:19789",
      companyId: "company-1",
      timeoutMs: 1200,
    },
    registerTool(factory) {
      const result = factory({ agentId });
      if (result) {
        tools.push(result);
      }
    },
  });

  return tools;
}

describe("sims-company plugin", () => {
  it("registers dispatch, report, and authority hire tools together", () => {
    const fetchImpl = vi.fn<typeof fetch>();
    const tools = registerTools(fetchImpl);

    expect(tools.map((tool) => tool.name)).toEqual([
      "company_dispatch",
      "company_report",
      "authority.company.employee.hire",
      "authority.company.employee.batch_hire",
    ]);
  });

  it("only exposes authority hire tools to hr agents", () => {
    const fetchImpl = vi.fn<typeof fetch>();
    const tools = registerToolsForAgent(fetchImpl, "company-1-ceo");

    expect(tools.map((tool) => tool.name)).toEqual([
      "company_dispatch",
      "company_report",
    ]);
  });

  it("maps authority.company.employee.hire to the hire endpoint", async () => {
    const fetchImpl = vi.fn<typeof fetch>(async (_input, init) => ({
      ok: true,
      status: 200,
      json: async () => ({
        employee: { agentId: "company-1-designer", nickname: "Designer" },
        warnings: [],
      }),
    } as Response));
    const tools = registerTools(fetchImpl);

    const result = await tools.find((tool) => tool.name === "authority.company.employee.hire")?.execute("1", {
      role: "Designer",
      description: "Own visual delivery",
      departmentName: "Design",
      makeDepartmentLead: true,
    });

    expect(fetchImpl).toHaveBeenCalledWith(
      "http://127.0.0.1:19789/companies/company-1/employees",
      expect.objectContaining({
        method: "POST",
        headers: { "content-type": "application/json" },
      }),
    );
    expect(JSON.parse(String(fetchImpl.mock.calls[0]?.[1]?.body))).toMatchObject({
      companyId: "company-1",
      role: "Designer",
      description: "Own visual delivery",
      departmentName: "Design",
      makeDepartmentLead: true,
    });
    expect(result).toMatchObject({
      content: [{ type: "text", text: "Hire completed: Designer" }],
    });
  });

  it("maps authority.company.employee.batch_hire to the batch endpoint", async () => {
    const fetchImpl = vi.fn<typeof fetch>(async (_input, init) => ({
      ok: true,
      status: 200,
      json: async () => ({
        employees: [{ agentId: "company-1-designer" }, { agentId: "company-1-writer" }],
        warnings: ["executor degraded"],
      }),
    } as Response));
    const tools = registerTools(fetchImpl);

    const result = await tools.find((tool) => tool.name === "authority.company.employee.batch_hire")?.execute("1", {
      hires: [
        { role: "Designer", description: "Lead design" },
        { role: "Writer", description: "Own copy" },
      ],
    });

    expect(fetchImpl).toHaveBeenCalledWith(
      "http://127.0.0.1:19789/companies/company-1/employees/batch",
      expect.objectContaining({
        method: "POST",
        headers: { "content-type": "application/json" },
      }),
    );
    expect(JSON.parse(String(fetchImpl.mock.calls[0]?.[1]?.body))).toMatchObject({
      companyId: "company-1",
      hires: [
        { role: "Designer", description: "Lead design" },
        { role: "Writer", description: "Own copy" },
      ],
    });
    expect(result).toMatchObject({
      content: [{ type: "text", text: "Batch hire completed: 2 employees (1 warning)" }],
    });
  });
});
