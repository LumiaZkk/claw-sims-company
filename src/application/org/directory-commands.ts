import type { ProviderManifest } from "../../application/gateway";
import {
  gateway,
  sendTurnToCompanyActor,
  type ChatMessage,
} from "../../application/gateway";
import { requestAuthorityApproval } from "../../application/gateway/authority-control";
import { AgentOps } from "../../application/org/employee-ops";
import type { ApprovalRecord } from "../../domain/governance/types";
import type { Company } from "../../domain/org/types";
import type { TemplateMatch } from "../../domain/org/types";
import {
  buildHrDepartmentBootstrapPrompt,
  extractChatMessageText,
  resolveHrBootstrapAgentId,
} from "./organization-commands";
import { toast } from "../../system/toast-store";
import { readCompanyRuntimeState } from "../../infrastructure/company/runtime/selectors";
import { resolveTalentMarketHire } from "./talent-market-hire";

export type HireEmployeeConfig = {
  avatarFile?: File;
  budget: number;
  description: string;
  modelTier: "standard" | "reasoning" | "ultra";
  role: string;
  traits: string;
  templateSelection?: {
    templateId: string | null;
    sourceType: "template" | "blank";
    match?: TemplateMatch | null;
  };
};

export type HrPlanRuntimeState =
  | { status: "idle" }
  | { status: "waiting"; sessionKey: string; runId: string | null }
  | { status: "ready"; sessionKey: string; runId: string | null; rawText: string }
  | { status: "error"; sessionKey: string | null; runId: string | null; message: string };

export async function openAgentWorkspaceFile(
  agentId: string,
  fileName: string,
  supportsAgentFiles: boolean,
) {
  if (!supportsAgentFiles) {
    throw new Error("当前后端不提供文件区");
  }
  const response = await gateway.getAgentFile(agentId, fileName);
  return response.file?.content || "";
}

export async function saveAgentWorkspaceFile(agentId: string, fileName: string, content: string) {
  await gateway.setAgentFile(agentId, fileName, content);
}

export async function hireCompanyEmployee(company: Company, config: HireEmployeeConfig) {
  const resolved = resolveTalentMarketHire(company, config);
  return AgentOps.hireEmployee(company, {
    ...config,
    templateId: resolved.templateId,
    templateBinding: resolved.templateBinding,
    compiledDraft: resolved.compiledDraft,
    bootstrapBundle: resolved.compiledDraft.bootstrapBundle,
    provenance: resolved.compiledDraft.provenance,
  });
}

export async function updateEmployeeRolePrompt(agentId: string, role: string, description: string) {
  await AgentOps.updateRole(agentId, role, description);
}

export async function updateEmployeeIdentityName(agentId: string, nickname: string) {
  await AgentOps.updateAgentName(agentId, nickname);
}

export type FireCompanyEmployeeResult =
  | {
      mode: "executed";
      approval: null;
    }
  | {
      mode: "approval_requested";
      approval: ApprovalRecord;
    };

export async function fireCompanyEmployee(
  agentId: string,
  options?: { skipApproval?: boolean },
): Promise<FireCompanyEmployeeResult> {
  const activeCompany = readCompanyRuntimeState().activeCompany;
  if (!activeCompany) {
    throw new Error("无活跃公司，无法执行离职流程。");
  }
  const target = activeCompany.employees.find((employee) => employee.agentId === agentId) ?? null;
  if (!target) {
    throw new Error("在当前公司结构中未查找到该员工名片。");
  }

  const needsApproval =
    !options?.skipApproval &&
    activeCompany.orgSettings?.autonomyPolicy?.humanApprovalRequiredForLayoffs !== false;

  if (needsApproval) {
    const result = await requestAuthorityApproval({
      companyId: activeCompany.id,
      scope: "org",
      actionType: "employee_fire",
      summary: `审批解雇 ${target.nickname}`,
      detail: `准备移除成员 ${target.nickname}（${target.role || "未命名岗位"}）。审批通过后才会向 HR 下发离职流程。`,
      requestedByActorId: "operator:local-user",
      requestedByLabel: "当前操作者",
      targetActorId: target.agentId,
      targetLabel: target.nickname,
      payload: {
        agentId: target.agentId,
        nickname: target.nickname,
        role: target.role,
      },
    });
    await readCompanyRuntimeState().loadConfig();
    toast.info("已提交离职审批", `请先批准「${target.nickname}」的离职请求，再继续执行。`);
    return {
      mode: "approval_requested",
      approval: result.approval,
    };
  }

  await AgentOps.fireAgent(agentId);
  return {
    mode: "executed",
    approval: null,
  };
}

export async function assignEmployeeTask(agentId: string, task: string) {
  await AgentOps.assignTask(agentId, task);
}

type StartHrDepartmentBootstrapRunInput = {
  company: Company;
  manifest: ProviderManifest;
  onStateChange: (state: HrPlanRuntimeState) => void;
};

export async function startHrDepartmentBootstrapRun({
  company,
  manifest,
  onStateChange,
}: StartHrDepartmentBootstrapRunInput) {
  const hrAgentId = resolveHrBootstrapAgentId(company);
  if (!hrAgentId) {
    throw new Error("当前公司没有 HR 节点。");
  }

  const prompt = buildHrDepartmentBootstrapPrompt(company);
  const ack = await sendTurnToCompanyActor({
    backend: gateway,
    manifest,
    company,
    actorId: hrAgentId,
    message: prompt,
    timeoutMs: 300_000,
    targetActorIds: [hrAgentId],
  });

  const runId = ack?.runId ?? null;
  const providerConversationId = ack.providerConversationRef.conversationId;

  onStateChange({
    status: "waiting",
    sessionKey: ack.conversationRef.conversationId,
    runId,
  });

  const unsubscribe = gateway.subscribe("chat", (rawPayload) => {
    if (!rawPayload || typeof rawPayload !== "object") {
      return;
    }

    const payload = rawPayload as Record<string, unknown>;
    const sessionKey = typeof payload.sessionKey === "string" ? payload.sessionKey : null;
    const state = typeof payload.state === "string" ? payload.state : null;
    const payloadRunId = typeof payload.runId === "string" ? payload.runId : null;

    if (!sessionKey || !state || sessionKey !== providerConversationId) {
      return;
    }
    if (runId && payloadRunId && payloadRunId !== runId) {
      return;
    }

    if (state === "error") {
      onStateChange({
        status: "error",
        sessionKey: ack.conversationRef.conversationId,
        runId,
        message: typeof payload.errorMessage === "string" ? payload.errorMessage : "chat error",
      });
      return;
    }

    if (state === "final") {
      const message = payload.message as ChatMessage | undefined;
      onStateChange({
        status: "ready",
        sessionKey: ack.conversationRef.conversationId,
        runId,
        rawText: extractChatMessageText(message),
      });
    }
  });

  return {
    conversationId: ack.conversationRef.conversationId,
    runId,
    unsubscribe,
  };
}
