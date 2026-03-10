import type { AutoDispatchPlan } from "../assignment/dispatch-planning";
import { sendTurnToCompanyActor, type ProviderManifest } from "../gateway";
import { gateway } from "../gateway";
import { recordDispatchBlocked, recordDispatchSent } from "./closed-loop";
import type { DispatchRecord } from "../../domain/delegation/types";
import type { Company } from "../../domain/org/types";
import type { FocusProgressEvent } from "../governance/chat-progress";

type ExecuteAutoDispatchInput = {
  company: Company;
  providerManifest: ProviderManifest;
  plan: AutoDispatchPlan;
  fromActorId: string;
  workItemId: string;
  topicKey?: string | null;
  createdAt?: number;
};

type AutoDispatchResult = {
  dispatch: DispatchRecord;
  progressEvent: FocusProgressEvent;
};

export async function executeAutoDispatchPlan(
  input: ExecuteAutoDispatchInput,
): Promise<AutoDispatchResult> {
  const startedAt = input.createdAt ?? Date.now();
  try {
    const ack = await sendTurnToCompanyActor({
      backend: gateway,
      manifest: input.providerManifest,
      company: input.company,
      actorId: input.plan.targetAgentId,
      message: input.plan.message,
      timeoutMs: 300_000,
      targetActorIds: [input.plan.targetAgentId],
    });

    const dispatch: DispatchRecord = {
      id: input.plan.dispatchId,
      workItemId: input.workItemId,
      roomId: null,
      title: input.plan.title,
      summary: input.plan.summary,
      fromActorId: input.fromActorId,
      targetActorIds: [input.plan.targetAgentId],
      status: "sent",
      sourceMessageId: input.plan.sourceStepId,
      providerRunId: ack.runId,
      topicKey: input.topicKey ?? undefined,
      createdAt: startedAt,
      updatedAt: startedAt,
    };

    await recordDispatchSent({
      companyId: input.company.id,
      dispatchId: input.plan.dispatchId,
      workItemId: input.workItemId,
      topicKey: input.topicKey,
      fromActorId: input.fromActorId,
      targetActorId: input.plan.targetAgentId,
      sessionKey: `agent:${input.plan.targetAgentId}:main`,
      providerRunId: ack.runId,
      createdAt: startedAt,
      title: input.plan.title,
      message: input.plan.message,
      sourceStepId: input.plan.sourceStepId,
    });

    return {
      dispatch,
      progressEvent: {
        id: `auto-dispatch:${input.plan.dispatchId}`,
        timestamp: startedAt,
        actorLabel: "系统",
        actorAgentId: input.plan.targetAgentId,
        title: `已自动派单给 ${input.plan.targetLabel}`,
        summary: `已把当前主线的第一棒真实发给 ${input.plan.targetLabel}，后续会按回执继续推进。`,
        detail: input.plan.summary,
        tone: "indigo",
        category: "receipt",
        source: "local",
      },
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    const dispatch: DispatchRecord = {
      id: input.plan.dispatchId,
      workItemId: input.workItemId,
      roomId: null,
      title: input.plan.title,
      summary: input.plan.summary,
      fromActorId: input.fromActorId,
      targetActorIds: [input.plan.targetAgentId],
      status: "blocked",
      sourceMessageId: input.plan.sourceStepId,
      topicKey: input.topicKey ?? undefined,
      createdAt: startedAt,
      updatedAt: startedAt,
    };

    await recordDispatchBlocked({
      companyId: input.company.id,
      dispatchId: input.plan.dispatchId,
      workItemId: input.workItemId,
      topicKey: input.topicKey,
      fromActorId: input.fromActorId,
      targetActorId: input.plan.targetAgentId,
      createdAt: startedAt,
      title: input.plan.title,
      message: input.plan.message,
      sourceStepId: input.plan.sourceStepId,
      error: message,
    });

    return {
      dispatch,
      progressEvent: {
        id: `auto-dispatch-failed:${input.plan.dispatchId}`,
        timestamp: startedAt,
        actorLabel: "系统",
        actorAgentId: input.plan.targetAgentId,
        title: `自动派单失败：${input.plan.targetLabel}`,
        summary: message,
        detail: input.plan.summary,
        tone: "rose",
        category: "receipt",
        source: "local",
      },
    };
  }
}
