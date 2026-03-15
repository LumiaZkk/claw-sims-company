const DEFAULT_AUTHORITY_URL = "http://127.0.0.1:19789";

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
        status: { type: "string", enum: ["acknowledged", "answered", "blocked"] },
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
      const status = readString(params, "status");
      if (!status || !["acknowledged", "answered", "blocked"].includes(status)) {
        throw new Error("status must be acknowledged, answered, or blocked");
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

module.exports = {
  id: "company-dispatch",
  name: "Company Dispatch",
  description: "Company dispatch/report tools backed by authority HTTP API.",
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
  },
};
