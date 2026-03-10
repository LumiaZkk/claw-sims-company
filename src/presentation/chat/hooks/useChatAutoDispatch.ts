import { useEffect, useRef } from "react";
import type { AutoDispatchPlan } from "../../../application/assignment/dispatch-planning";
import { executeAutoDispatchPlan } from "../../../application/delegation/chat-auto-dispatch";
import type { ProviderManifest } from "../../../application/gateway";
import type { FocusProgressEvent } from "../../../application/governance/chat-progress";
import type { DispatchRecord } from "../../../domain/delegation/types";
import type { Company } from "../../../domain/org/types";

export function useChatAutoDispatch(input: {
  plan: AutoDispatchPlan | null;
  company: Company | null;
  providerManifest: ProviderManifest;
  fromActorId: string | null;
  workItemId: string | null;
  topicKey?: string | null;
  enabled: boolean;
  upsertDispatchRecord: (dispatch: DispatchRecord) => void;
  appendLocalProgressEvent: (event: FocusProgressEvent) => void;
}) {
  const inFlightRef = useRef<Set<string>>(new Set());

  useEffect(() => {
    if (
      !input.enabled ||
      !input.plan ||
      !input.company ||
      !input.fromActorId ||
      !input.workItemId
    ) {
      return;
    }

    if (inFlightRef.current.has(input.plan.dispatchId)) {
      return;
    }

    const plan = input.plan;
    const company = input.company;
    const fromActorId = input.fromActorId;
    const workItemId = input.workItemId;

    inFlightRef.current.add(plan.dispatchId);
    void (async () => {
      try {
        const result = await executeAutoDispatchPlan({
          company,
          providerManifest: input.providerManifest,
          plan,
          fromActorId,
          workItemId,
          topicKey: input.topicKey,
        });
        input.upsertDispatchRecord(result.dispatch);
        input.appendLocalProgressEvent(result.progressEvent);
      } finally {
        inFlightRef.current.delete(plan.dispatchId);
      }
    })();
  }, [input]);
}
