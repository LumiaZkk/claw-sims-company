const DEFAULT_AUTHORITY_URL = "http://127.0.0.1:19789";
const DEPARTMENT_KINDS = ["meta", "support", "business"];
const MODEL_TIERS = ["standard", "reasoning", "ultra"];
const REPORT_STATUSES = ["acknowledged", "answered", "blocked"];

function isHrAgent(agentId) {
  if (typeof agentId !== "string") {
    return false;
  }
  const normalized = agentId.trim().toLowerCase();
  return normalized === "hr" || normalized.endsWith("-hr");
}

function hasOwn(params, key) {
  return Boolean(params) && Object.prototype.hasOwnProperty.call(params, key);
}

function normalizeUrl(value) {
  if (typeof value !== "string") {
    return DEFAULT_AUTHORITY_URL;
  }
  const trimmed = value.trim();
  if (!trimmed) {
    return DEFAULT_AUTHORITY_URL;
  }
  return trimmed.replace(/\/+$/, "");
}

function readString(params, key) {
  const raw = params?.[key];
  if (typeof raw !== "string") {
    return null;
  }
  const trimmed = raw.trim();
  return trimmed.length > 0 ? trimmed : null;
}

function readNumber(params, key) {
  const raw = params?.[key];
  return typeof raw === "number" && Number.isFinite(raw) ? raw : null;
}

function readBoolean(params, key) {
  return typeof params?.[key] === "boolean" ? params[key] : null;
}

function readEnum(params, key, values) {
  const value = readString(params, key);
  if (value == null) {
    return null;
  }
  if (!values.includes(value)) {
    throw new Error(`${key} must be one of: ${values.join(", ")}`);
  }
  return value;
}

function readOptionalNullableString(params, key) {
  if (!hasOwn(params, key)) {
    return undefined;
  }
  const raw = params[key];
  if (raw == null) {
    return null;
  }
  if (typeof raw !== "string") {
    throw new Error(`${key} must be a string or null`);
  }
  const trimmed = raw.trim();
  return trimmed.length > 0 ? trimmed : null;
}

function readOptionalObject(params, key) {
  if (!hasOwn(params, key)) {
    return undefined;
  }
  const value = params[key];
  if (value == null) {
    return null;
  }
  if (typeof value !== "object" || Array.isArray(value)) {
    throw new Error(`${key} must be an object or null`);
  }
  return value;
}

function resolveCompanyId(params, defaultCompanyId) {
  return readString(params, "companyId") || defaultCompanyId || null;
}

function resolveFromActorId(params, ctx) {
  return readString(params, "fromActorId") || ctx?.agentId || null;
}

async function postJson(url, body) {
  const response = await fetch(url, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    const message = payload?.error ? String(payload.error) : `Authority error ${response.status}`;
    throw new Error(message);
  }
  return payload;
}

function textResult(text, details) {
  return {
    content: [{ type: "text", text }],
    details,
  };
}

function buildHireInput(params) {
  const role = readString(params, "role");
  if (!role) {
    throw new Error("role required");
  }
  const description = readString(params, "description");
  if (!description) {
    throw new Error("description required");
  }

  const input = { role, description };
  const nickname = readString(params, "nickname");
  if (nickname) {
    input.nickname = nickname;
  }

  const reportsTo = readOptionalNullableString(params, "reportsTo");
  if (reportsTo !== undefined) {
    input.reportsTo = reportsTo;
  }

  const departmentId = readOptionalNullableString(params, "departmentId");
  if (departmentId !== undefined) {
    input.departmentId = departmentId;
  }

  const departmentName = readOptionalNullableString(params, "departmentName");
  if (departmentName !== undefined) {
    input.departmentName = departmentName;
  }

  const departmentKind = readEnum(params, "departmentKind", DEPARTMENT_KINDS);
  if (departmentKind) {
    input.departmentKind = departmentKind;
  }

  const departmentColor = readOptionalNullableString(params, "departmentColor");
  if (departmentColor !== undefined) {
    input.departmentColor = departmentColor;
  }

  const makeDepartmentLead = readBoolean(params, "makeDepartmentLead");
  if (makeDepartmentLead !== null) {
    input.makeDepartmentLead = makeDepartmentLead;
  }

  const avatarJobId = readString(params, "avatarJobId");
  if (avatarJobId) {
    input.avatarJobId = avatarJobId;
  }

  const modelTier = readEnum(params, "modelTier", MODEL_TIERS);
  if (modelTier) {
    input.modelTier = modelTier;
  }

  const traits = readString(params, "traits");
  if (traits) {
    input.traits = traits;
  }

  const budget = readNumber(params, "budget");
  if (budget !== null) {
    input.budget = budget;
  }

  const templateId = readOptionalNullableString(params, "templateId");
  if (templateId !== undefined) {
    input.templateId = templateId;
  }

  const templateBinding = readOptionalObject(params, "templateBinding");
  if (templateBinding !== undefined) {
    input.templateBinding = templateBinding;
  }

  const compiledDraft = readOptionalObject(params, "compiledDraft");
  if (compiledDraft !== undefined) {
    input.compiledDraft = compiledDraft;
  }

  const bootstrapBundle = readOptionalObject(params, "bootstrapBundle");
  if (bootstrapBundle !== undefined) {
    input.bootstrapBundle = bootstrapBundle;
  }

  const provenance = readOptionalObject(params, "provenance");
  if (provenance !== undefined) {
    input.provenance = provenance;
  }

  return input;
}

function buildWarningsSuffix(warnings) {
  return warnings.length > 0 ? ` (${warnings.length} warning${warnings.length > 1 ? "s" : ""})` : "";
}

function createCompanyDispatchTool(options) {
  const { baseUrl, defaultCompanyId, defaultTimeoutMs, ctx } = options;
  return {
    name: "company_dispatch",
    label: "Company Dispatch",
    description: "Dispatch formal tasks to another company agent via authority.",
    parameters: {
      type: "object",
      properties: {
        companyId: { type: "string" },
        fromActorId: { type: "string" },
        targetActorId: { type: "string" },
        title: { type: "string" },
        summary: { type: "string" },
        message: { type: "string" },
        dispatchId: { type: "string" },
        workItemId: { type: "string" },
        topicKey: { type: "string" },
        roomId: { type: "string" },
        handoff: { type: "boolean" },
        timeoutMs: { type: "number" }
      },
      required: ["targetActorId"]
    },
    async execute(_id, params) {
      const companyId = resolveCompanyId(params, defaultCompanyId);
      if (!companyId) {
        throw new Error("companyId required");
      }
      const fromActorId = resolveFromActorId(params, ctx);
      if (!fromActorId) {
        throw new Error("fromActorId required");
      }
      const targetActorId = readString(params, "targetActorId");
      if (!targetActorId) {
        throw new Error("targetActorId required");
      }
      const summary = readString(params, "summary");
      const message = readString(params, "message") || summary || readString(params, "title");
      if (!message) {
        throw new Error("message or summary required");
      }
      const body = {
        companyId,
        fromActorId,
        targetActorId,
        title: readString(params, "title") || summary || message,
        summary: summary || message,
        message,
        dispatchId: readString(params, "dispatchId"),
        workItemId: readString(params, "workItemId"),
        topicKey: readString(params, "topicKey"),
        roomId: readString(params, "roomId"),
        handoff: params?.handoff === true,
        timeoutMs: typeof params?.timeoutMs === "number" ? params.timeoutMs : defaultTimeoutMs
      };
      const result = await postJson(`${baseUrl}/commands/company.dispatch`, body);
      const status = result.status || "sent";
      return textResult(
        `Dispatch ${status}: ${result.dispatchId || "(unknown)"}`,
        result,
      );
    }
  };
}

function createCompanyReportTool(options) {
  const { baseUrl, defaultCompanyId, defaultTimeoutMs, ctx } = options;
  return {
    name: "company_report",
    label: "Company Report",
    description: "Report dispatch status back to the owner via authority.",
    parameters: {
      type: "object",
      properties: {
        companyId: { type: "string" },
        dispatchId: { type: "string" },
        fromActorId: { type: "string" },
        status: { type: "string", enum: REPORT_STATUSES },
        summary: { type: "string" },
        details: { type: "string" },
        timeoutMs: { type: "number" }
      },
      required: ["dispatchId", "status"]
    },
    async execute(_id, params) {
      const companyId = resolveCompanyId(params, defaultCompanyId);
      if (!companyId) {
        throw new Error("companyId required");
      }
      const dispatchId = readString(params, "dispatchId");
      if (!dispatchId) {
        throw new Error("dispatchId required");
      }
      const status = readEnum(params, "status", REPORT_STATUSES);
      if (!status) {
        throw new Error("status required");
      }
      const fromActorId = resolveFromActorId(params, ctx);
      if (!fromActorId) {
        throw new Error("fromActorId required");
      }
      const summary = readString(params, "summary") || "已回执";
      const body = {
        companyId,
        dispatchId,
        fromActorId,
        status,
        summary,
        details: readString(params, "details"),
        timeoutMs: typeof params?.timeoutMs === "number" ? params.timeoutMs : defaultTimeoutMs
      };
      const result = await postJson(`${baseUrl}/commands/company.report`, body);
      return textResult(
        `Report ${status}: ${result.dispatchId || dispatchId}`,
        result,
      );
    }
  };
}

function createHireEmployeeTool(options) {
  const { baseUrl, defaultCompanyId } = options;
  return {
    name: "authority.company.employee.hire",
    label: "Authority Hire Employee",
    description: "Hire a canonical company employee through Authority and trigger roster plus provisioning updates.",
    parameters: {
      type: "object",
      properties: {
        companyId: { type: "string" },
        role: { type: "string" },
        description: { type: "string" },
        nickname: { type: "string" },
        reportsTo: { type: ["string", "null"] },
        departmentId: { type: ["string", "null"] },
        departmentName: { type: ["string", "null"] },
        departmentKind: { type: "string", enum: DEPARTMENT_KINDS },
        departmentColor: { type: ["string", "null"] },
        makeDepartmentLead: { type: "boolean" },
        avatarJobId: { type: "string" },
        modelTier: { type: "string", enum: MODEL_TIERS },
        traits: { type: "string" },
        budget: { type: "number" },
        templateId: { type: ["string", "null"] },
        templateBinding: { type: "object" },
        compiledDraft: { type: "object" },
        bootstrapBundle: { type: "object" },
        provenance: { type: "object" }
      },
      required: ["role", "description"]
    },
    async execute(_id, params) {
      const companyId = resolveCompanyId(params, defaultCompanyId);
      if (!companyId) {
        throw new Error("companyId required");
      }
      const body = {
        companyId,
        ...buildHireInput(params),
      };
      const result = await postJson(
        `${baseUrl}/companies/${encodeURIComponent(companyId)}/employees`,
        body,
      );
      const employee = result?.employee || {};
      const warnings = Array.isArray(result?.warnings) ? result.warnings.filter(Boolean) : [];
      const label = employee.nickname || employee.agentId || body.role;
      return textResult(`Hire completed: ${label}${buildWarningsSuffix(warnings)}`, result);
    }
  };
}

function createBatchHireEmployeesTool(options) {
  const { baseUrl, defaultCompanyId } = options;
  return {
    name: "authority.company.employee.batch_hire",
    label: "Authority Batch Hire Employees",
    description: "Hire multiple canonical company employees through Authority in one validated batch.",
    parameters: {
      type: "object",
      properties: {
        companyId: { type: "string" },
        hires: {
          type: "array",
          items: {
            type: "object",
            properties: {
              role: { type: "string" },
              description: { type: "string" },
              nickname: { type: "string" },
              reportsTo: { type: ["string", "null"] },
              departmentId: { type: ["string", "null"] },
              departmentName: { type: ["string", "null"] },
              departmentKind: { type: "string", enum: DEPARTMENT_KINDS },
              departmentColor: { type: ["string", "null"] },
              makeDepartmentLead: { type: "boolean" },
              avatarJobId: { type: "string" },
              modelTier: { type: "string", enum: MODEL_TIERS },
              traits: { type: "string" },
              budget: { type: "number" },
              templateId: { type: ["string", "null"] },
              templateBinding: { type: "object" },
              compiledDraft: { type: "object" },
              bootstrapBundle: { type: "object" },
              provenance: { type: "object" }
            },
            required: ["role", "description"]
          }
        }
      },
      required: ["hires"]
    },
    async execute(_id, params) {
      const companyId = resolveCompanyId(params, defaultCompanyId);
      if (!companyId) {
        throw new Error("companyId required");
      }
      if (!Array.isArray(params?.hires) || params.hires.length === 0) {
        throw new Error("hires must be a non-empty array");
      }
      const hires = params.hires.map((hire, index) => {
        if (!hire || typeof hire !== "object" || Array.isArray(hire)) {
          throw new Error(`hires[${index}] must be an object`);
        }
        return buildHireInput(hire);
      });
      const result = await postJson(
        `${baseUrl}/companies/${encodeURIComponent(companyId)}/employees/batch`,
        {
          companyId,
          hires,
        },
      );
      const employees = Array.isArray(result?.employees) ? result.employees : [];
      const warnings = Array.isArray(result?.warnings) ? result.warnings.filter(Boolean) : [];
      return textResult(
        `Batch hire completed: ${employees.length} employee${employees.length === 1 ? "" : "s"}${buildWarningsSuffix(warnings)}`,
        result,
      );
    }
  };
}

module.exports = {
  id: "sims-company",
  name: "Sims Company",
  description: "Company dispatch, reporting, and authority hiring tools backed by the Authority HTTP API.",
  register(api) {
    const config = api.pluginConfig && typeof api.pluginConfig === "object" ? api.pluginConfig : {};
    const baseUrl = normalizeUrl(config.authorityUrl || process.env.CYBER_COMPANY_AUTHORITY_URL || DEFAULT_AUTHORITY_URL);
    const defaultCompanyId = typeof config.companyId === "string" ? config.companyId.trim() : null;
    const defaultTimeoutMs = typeof config.timeoutMs === "number" ? config.timeoutMs : undefined;

    api.registerTool((ctx) => createCompanyDispatchTool({
      baseUrl,
      defaultCompanyId,
      defaultTimeoutMs,
      ctx,
    }));
    api.registerTool((ctx) => createCompanyReportTool({
      baseUrl,
      defaultCompanyId,
      defaultTimeoutMs,
      ctx,
    }));
    api.registerTool((ctx) => {
      if (!isHrAgent(ctx?.agentId)) {
        return null;
      }
      return createHireEmployeeTool({
        baseUrl,
        defaultCompanyId,
      });
    });
    api.registerTool((ctx) => {
      if (!isHrAgent(ctx?.agentId)) {
        return null;
      }
      return createBatchHireEmployeesTool({
        baseUrl,
        defaultCompanyId,
      });
    });
  },
};
