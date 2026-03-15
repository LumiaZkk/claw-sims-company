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
  it("registers dispatch, report, preview, and authority hire tools together", () => {
    const fetchImpl = vi.fn<typeof fetch>();
    const tools = registerTools(fetchImpl);

    expect(tools.map((tool) => tool.name)).toEqual([
      "company_dispatch",
      "company_report",
      "authority.company.employee.preview_hire",
      "authority.company.employee.preview_batch_hire",
      "authority.company.employee.hire",
      "authority.company.employee.batch_hire",
    ]);
  });

  it("only exposes preview and hire tools to hr agents", () => {
    const fetchImpl = vi.fn<typeof fetch>();
    const tools = registerToolsForAgent(fetchImpl, "company-1-ceo");

    expect(tools.map((tool) => tool.name)).toEqual([
      "company_dispatch",
      "company_report",
    ]);
  });

  it("maps authority.company.employee.preview_hire to the preview endpoint", async () => {
    const fetchImpl = vi.fn<typeof fetch>(async () => ({
      ok: true,
      status: 200,
      json: async () => ({
        companyId: "company-1",
        matches: [
          {
            template: { id: "tm-template-designer", title: "Designer" },
            match: { templateId: "tm-template-designer", score: 0.9, confidence: 0.9, reasons: [], gaps: [], autoAdoptEligible: true },
          },
        ],
        selectionMode: "auto",
        selectedTemplateId: "tm-template-designer",
        selectedTemplateBinding: {
          templateId: "tm-template-designer",
          sourceType: "template",
          confidence: 0.9,
        },
        selectedDraft: {
          sourceType: "template",
          templateId: "tm-template-designer",
          role: "Designer",
          modelTier: "reasoning",
          budget: 9,
          traits: "visual",
          bootstrapBundle: {
            recommendedSkills: ["figma"],
          },
        },
        blankTemplateBinding: {
          templateId: null,
          sourceType: "blank",
          confidence: null,
        },
        blankDraft: {
          sourceType: "blank",
          templateId: null,
          role: "Designer",
          modelTier: "standard",
          budget: 5,
          traits: "visual",
          bootstrapBundle: {
            recommendedSkills: [],
          },
        },
        warnings: [],
      }),
    } as Response));
    const tools = registerTools(fetchImpl);

    const result = await tools.find((tool) => tool.name === "authority.company.employee.preview_hire")?.execute("1", {
      role: "Designer",
      description: "Own visual delivery",
      departmentName: "Design",
      makeDepartmentLead: true,
    });

    expect(fetchImpl).toHaveBeenCalledWith(
      "http://127.0.0.1:19789/companies/company-1/employees/preview",
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
      content: [{
        type: "text",
        text: expect.stringContaining("Preview ready: auto matched tm-template-designer"),
      }],
    });
    const text = (result as { content: Array<{ text: string }> }).content[0]?.text ?? "";
    expect(text).toContain("## Candidate Templates");
    expect(text).toContain("Designer (tm-template-designer)");
    expect(text).toContain("## Recommended Draft");
    expect(text).toContain("## Blank Fallback Draft");
  });

  it("maps authority.company.employee.preview_batch_hire to the batch preview endpoint", async () => {
    const fetchImpl = vi.fn<typeof fetch>(async () => ({
      ok: true,
      status: 200,
      json: async () => ({
        companyId: "company-1",
        previews: [
          {
            inputIndex: 0,
            matches: [],
            selectionMode: "auto",
            selectedTemplateId: "tm-template-designer",
            selectedTemplateBinding: {
              templateId: "tm-template-designer",
              sourceType: "template",
              confidence: 0.9,
            },
            selectedDraft: {
              sourceType: "template",
              templateId: "tm-template-designer",
              role: "Designer",
              modelTier: "reasoning",
              budget: 9,
              traits: "visual",
              bootstrapBundle: {
                recommendedSkills: ["figma"],
              },
            },
            blankTemplateBinding: {
              templateId: null,
              sourceType: "blank",
              confidence: null,
            },
            blankDraft: {
              sourceType: "blank",
              templateId: null,
              role: "Designer",
              modelTier: "standard",
              budget: 5,
              traits: "visual",
              bootstrapBundle: {
                recommendedSkills: [],
              },
            },
            warnings: [],
          },
          {
            inputIndex: 1,
            matches: [],
            selectionMode: "blank",
            selectedTemplateId: null,
            selectedTemplateBinding: null,
            selectedDraft: null,
            blankTemplateBinding: {
              templateId: null,
              sourceType: "blank",
              confidence: null,
            },
            blankDraft: {
              sourceType: "blank",
              templateId: null,
              role: "Writer",
              modelTier: "standard",
              budget: 5,
              traits: "clear",
              bootstrapBundle: {
                recommendedSkills: [],
              },
            },
            warnings: [],
          },
        ],
        warnings: [],
      }),
    } as Response));
    const tools = registerTools(fetchImpl);

    const result = await tools.find((tool) => tool.name === "authority.company.employee.preview_batch_hire")?.execute("1", {
      hires: [
        { role: "Designer", description: "Lead design" },
        { role: "Writer", description: "Own copy" },
      ],
    });

    expect(fetchImpl).toHaveBeenCalledWith(
      "http://127.0.0.1:19789/companies/company-1/employees/preview-batch",
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
      content: [{
        type: "text",
        text: expect.stringContaining("Batch preview ready: 2 hires (1 auto, 0 explicit, 1 blank)"),
      }],
    });
    const text = (result as { content: Array<{ text: string }> }).content[0]?.text ?? "";
    expect(text).toContain("# Hire 1");
    expect(text).toContain("# Hire 2");
    expect(text).toContain("## Blank Fallback Draft");
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
