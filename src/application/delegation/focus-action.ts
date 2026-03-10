import { sendTurnToCompanyActor, type ProviderManifest } from "../gateway";
import { gateway } from "../gateway";
import { recordDispatchSent } from "./closed-loop";
import type { DispatchRecord } from "../../domain/delegation/types";
import type { Company } from "../../domain/org/types";

export type ChatFocusCommand = {
  id: string;
  label: string;
  description: string;
  targetAgentId?: string;
  followupTargetAgentId?: string;
  followupTargetLabel?: string;
  message?: string;
};

export type ExecutedFocusAction = {
  providerRunId: string;
  resolvedSessionKey: string;
  runtimeTargetAgentId: string | null;
  dispatchRecord: DispatchRecord | null;
};

export async function executeChatFocusAction(input: {
  action: ChatFocusCommand;
  company: Company | null;
  providerManifest: ProviderManifest;
  sessionKey: string | null;
  targetAgentId: string | null;
  currentWorkItemId: string | null;
  currentTopicKey?: string | null;
}): Promise<ExecutedFocusAction> {
  if (!input.action.message) {
    throw new Error("缺少可发送的动作消息");
  }

  const actionStartedAt = Date.now();
  const runtimeTargetAgentId = input.action.targetAgentId ?? input.targetAgentId ?? null;
  let resolvedSessionKey = input.sessionKey;
  let providerRunId: string | undefined;

  if (runtimeTargetAgentId && input.company) {
    const ack = await sendTurnToCompanyActor({
      backend: gateway,
      manifest: input.providerManifest,
      company: input.company,
      actorId: runtimeTargetAgentId,
      message: input.action.message,
      timeoutMs: 300_000,
    });
    resolvedSessionKey = ack.providerConversationRef.conversationId;
    providerRunId = ack.runId;
  } else if (input.sessionKey) {
    const ack = await gateway.sendChatMessage(input.sessionKey, input.action.message, { timeoutMs: 300_000 });
    resolvedSessionKey = input.sessionKey;
    providerRunId = ack.runId;
  }

  if (!resolvedSessionKey || !providerRunId) {
    throw new Error("未找到可发送的目标会话");
  }

  let dispatchRecord: DispatchRecord | null = null;
  if (input.currentWorkItemId && runtimeTargetAgentId) {
    const dispatchId = `dispatch:${input.currentWorkItemId}:${providerRunId}`;
    dispatchRecord = {
      id: dispatchId,
      workItemId: input.currentWorkItemId,
      roomId: null,
      title: input.action.label,
      summary: input.action.description,
      fromActorId: input.targetAgentId ?? null,
      targetActorIds: [runtimeTargetAgentId],
      status: "sent",
      providerRunId,
      topicKey: input.currentTopicKey ?? undefined,
      createdAt: actionStartedAt,
      updatedAt: actionStartedAt,
    };
    if (input.company) {
      await recordDispatchSent({
        companyId: input.company.id,
        dispatchId,
        workItemId: input.currentWorkItemId,
        topicKey: input.currentTopicKey,
        fromActorId: input.targetAgentId ?? "unknown",
        targetActorId: runtimeTargetAgentId,
        sessionKey: `agent:${runtimeTargetAgentId}:main`,
        providerRunId,
        createdAt: actionStartedAt,
        title: input.action.label,
        message: input.action.message,
        summary: input.action.description,
      });
    }
  }

  return {
    providerRunId,
    resolvedSessionKey,
    runtimeTargetAgentId,
    dispatchRecord,
  };
}
