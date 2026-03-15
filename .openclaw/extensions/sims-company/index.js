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

function buildPreviewHireInput(params) {
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

  return input;
}

function buildWarningsSuffix(warnings) {
  return warnings.length > 0 ? ` (${warnings.length} warning${warnings.length > 1 ? "s" : ""})` : "";
}

function toArray(value) {
  return Array.isArray(value) ? value : [];
}

function formatNumber(value, digits) {
  return typeof value === "number" && Number.isFinite(value) ? value.toFixed(digits) : "n/a";
}

function formatNullableScalar(value) {
  if (typeof value === "number" && Number.isFinite(value)) {
    return String(value);
  }
  if (typeof value === "string" && value.trim().length > 0) {
    return value.trim();
  }
  return "n/a";
}

function formatList(values) {
  const normalized = toArray(values)
    .filter((value) => typeof value === "string")
    .map((value) => value.trim())
    .filter((value) => value.length > 0);
  return normalized.length > 0 ? normalized.join("；") : "无";
}

function formatTemplateLabel(template) {
  if (!template || typeof template !== "object") {
    return "未知模板";
  }
  const title = typeof template.title === "string" && template.title.trim().length > 0 ? template.title.trim() : "未命名模板";
  const templateId =
    typeof template.id === "string" && template.id.trim().length > 0 ? template.id.trim() : "unknown-template";
  return `${title} (${templateId})`;
}

function formatDraftSummary(label, draft, templateBinding) {
  if (!draft || typeof draft !== "object") {
    return [`## ${label}`, "- 无"];
  }
  const lines = [`## ${label}`];
  lines.push(`- sourceType: ${formatNullableScalar(draft.sourceType)}`);
  lines.push(`- templateId: ${formatNullableScalar(draft.templateId)}`);
  lines.push(`- role: ${formatNullableScalar(draft.role)}`);
  lines.push(`- modelTier: ${formatNullableScalar(draft.modelTier)}`);
  lines.push(`- budget: ${formatNullableScalar(draft.budget)}`);
  lines.push(`- traits: ${formatNullableScalar(draft.traits)}`);
  if (templateBinding && typeof templateBinding === "object") {
    lines.push(`- confidence: ${formatNullableScalar(templateBinding.confidence)}`);
  }
  const recommendedSkills = toArray(draft.bootstrapBundle?.recommendedSkills)
    .filter((value) => typeof value === "string")
    .map((value) => value.trim())
    .filter((value) => value.length > 0);
  if (recommendedSkills.length > 0) {
    lines.push(`- recommendedSkills: ${recommendedSkills.join(", ")}`);
  }
  return lines;
}

function formatPreviewMatches(matches) {
  if (matches.length === 0) {
    return ["## Candidate Templates", "- 无匹配模板"];
  }
  const lines = ["## Candidate Templates"];
  matches.slice(0, 5).forEach((entry, index) => {
    const template = entry?.template;
    const match = entry?.match;
    lines.push(
      `${index + 1}. ${formatTemplateLabel(template)} | score=${formatNumber(match?.score, 2)} | confidence=${formatNumber(match?.confidence, 2)} | auto=${match?.autoAdoptEligible === true ? "yes" : "no"}`,
    );
    lines.push(`   reasons: ${formatList(match?.reasons)}`);
    lines.push(`   gaps: ${formatList(match?.gaps)}`);
  });
  return lines;
}

function summarizePreview(result) {
  const matches = Array.isArray(result?.matches) ? result.matches : [];
  const selectionMode = typeof result?.selectionMode === "string" ? result.selectionMode : "blank";
  const selectedTemplateId =
    typeof result?.selectedTemplateId === "string" && result.selectedTemplateId.trim().length > 0
      ? result.selectedTemplateId.trim()
      : null;
  const warnings = Array.isArray(result?.warnings) ? result.warnings.filter(Boolean) : [];

  if (selectionMode === "auto" && selectedTemplateId) {
    return `Preview ready: auto matched ${selectedTemplateId}${buildWarningsSuffix(warnings)}`;
  }
  if (selectionMode === "explicit" && selectedTemplateId) {
    return `Preview ready: selected ${selectedTemplateId}${buildWarningsSuffix(warnings)}`;
  }
  if (matches.length > 0) {
    return `Preview ready: ${matches.length} candidate template${matches.length === 1 ? "" : "s"}, blank fallback kept${buildWarningsSuffix(warnings)}`;
  }
  return `Preview ready: no template match, blank fallback kept${buildWarningsSuffix(warnings)}`;
}

function renderPreviewDetails(result) {
  const headline = summarizePreview(result);
  const matches = toArray(result?.matches);
  const warnings = toArray(result?.warnings)
    .filter((value) => typeof value === "string")
    .map((value) => value.trim())
    .filter((value) => value.length > 0);
  const lines = [headline, "", `- selectionMode: ${formatNullableScalar(result?.selectionMode)}`];
  if (typeof result?.selectedTemplateId === "string" && result.selectedTemplateId.trim().length > 0) {
    lines.push(`- selectedTemplateId: ${result.selectedTemplateId.trim()}`);
  } else {
    lines.push("- selectedTemplateId: none");
  }
  lines.push(...formatPreviewMatches(matches));
  lines.push("", ...formatDraftSummary("Recommended Draft", result?.selectedDraft, result?.selectedTemplateBinding));
  lines.push("", ...formatDraftSummary("Blank Fallback Draft", result?.blankDraft, result?.blankTemplateBinding));
  if (warnings.length > 0) {
    lines.push("", "## Warnings");
    warnings.forEach((warning) => {
      lines.push(`- ${warning}`);
    });
  }
  return lines.join("\n").trim();
}

function summarizeBatchPreview(result) {
  const previews = Array.isArray(result?.previews) ? result.previews : [];
  const warnings = Array.isArray(result?.warnings) ? result.warnings.filter(Boolean) : [];
  const autoSelectedCount = previews.filter((preview) => preview?.selectionMode === "auto").length;
  const explicitCount = previews.filter((preview) => preview?.selectionMode === "explicit").length;
  const blankCount = previews.filter((preview) => preview?.selectionMode === "blank").length;
  return `Batch preview ready: ${previews.length} hire${previews.length === 1 ? "" : "s"} (${autoSelectedCount} auto, ${explicitCount} explicit, ${blankCount} blank)${buildWarningsSuffix(warnings)}`;
}

function renderBatchPreviewDetails(result) {
  const headline = summarizeBatchPreview(result);
  const previews = toArray(result?.previews);
  const warnings = toArray(result?.warnings)
    .filter((value) => typeof value === "string")
    .map((value) => value.trim())
    .filter((value) => value.length > 0);
  const sections = [headline];
  previews.forEach((preview, index) => {
    const label = typeof preview?.inputIndex === "number" ? preview.inputIndex + 1 : index + 1;
    sections.push("", `# Hire ${label}`, renderPreviewDetails(preview));
  });
  if (warnings.length > 0) {
    sections.push("", "## Warnings");
    warnings.forEach((warning) => {
      sections.push(`- ${warning}`);
    });
  }
  return sections.join("\n").trim();
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

function createPreviewHireTool(options) {
  const { baseUrl, defaultCompanyId } = options;
  return {
    name: "authority.company.employee.preview_hire",
    label: "Authority Preview Hire",
    description: "Preview Talent Market template matches and a blank fallback before a formal Authority hire.",
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
        templateId: { type: ["string", "null"] }
      },
      required: ["role", "description"]
    },
    async execute(_id, params) {
      const companyId = resolveCompanyId(params, defaultCompanyId);
      if (!companyId) {
        throw new Error("companyId required");
      }
      const result = await postJson(
        `${baseUrl}/companies/${encodeURIComponent(companyId)}/employees/preview`,
        {
          companyId,
          ...buildPreviewHireInput(params),
        },
      );
      return textResult(renderPreviewDetails(result), result);
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

function createPreviewBatchHireEmployeesTool(options) {
  const { baseUrl, defaultCompanyId } = options;
  return {
    name: "authority.company.employee.preview_batch_hire",
    label: "Authority Preview Batch Hire",
    description: "Preview Talent Market matches for multiple hires in one round before formal batch hiring.",
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
              templateId: { type: ["string", "null"] }
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
        return buildPreviewHireInput(hire);
      });
      const result = await postJson(
        `${baseUrl}/companies/${encodeURIComponent(companyId)}/employees/preview-batch`,
        {
          companyId,
          hires,
        },
      );
      return textResult(renderBatchPreviewDetails(result), result);
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
      return createPreviewHireTool({
        baseUrl,
        defaultCompanyId,
      });
    });
    api.registerTool((ctx) => {
      if (!isHrAgent(ctx?.agentId)) {
        return null;
      }
      return createPreviewBatchHireEmployeesTool({
        baseUrl,
        defaultCompanyId,
      });
    });
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
