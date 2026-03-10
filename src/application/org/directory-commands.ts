import type { ProviderManifest } from "../../application/gateway";
import {
  gateway,
  sendTurnToCompanyActor,
  type ChatMessage,
} from "../../application/gateway";
import { AgentOps } from "../../application/org/employee-ops";
import type { Company } from "../../domain/org/types";
import {
  buildHrDepartmentBootstrapPrompt,
  extractChatMessageText,
  resolveHrBootstrapAgentId,
} from "./organization-commands";

export type HireEmployeeConfig = {
  avatarFile?: File;
  budget: number;
  description: string;
  modelTier: "standard" | "reasoning" | "ultra";
  role: string;
  traits: string;
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
  return AgentOps.hireEmployee(company, config);
}

export async function updateEmployeeRolePrompt(agentId: string, role: string, description: string) {
  await AgentOps.updateRole(agentId, role, description);
}

export async function updateEmployeeIdentityName(agentId: string, nickname: string) {
  await AgentOps.updateAgentName(agentId, nickname);
}

export async function fireCompanyEmployee(agentId: string) {
  await AgentOps.fireAgent(agentId);
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
