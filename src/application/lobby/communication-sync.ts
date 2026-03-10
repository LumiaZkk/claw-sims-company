import { useCallback, useEffect, useState } from "react";
import { syncDelegationClosedLoopState } from "../delegation/closed-loop";
import { gateway } from "../gateway";
import type { RequirementSessionSnapshot } from "../../domain/mission/requirement-snapshot";
import type { Company } from "../../domain/org/types";
import type { ArtifactRecord } from "../../domain/artifact/types";
import type { DispatchRecord } from "../../domain/delegation/types";
import { resolveSessionActorId } from "../../lib/sessions";

function extractChatSyncSessionKey(payload: unknown): string | null {
  if (!payload || typeof payload !== "object") {
    return null;
  }
  const candidate = payload as { sessionKey?: unknown; state?: unknown };
  if (typeof candidate.sessionKey !== "string") {
    return null;
  }
  if (
    candidate.state !== "final" &&
    candidate.state !== "error" &&
    candidate.state !== "aborted"
  ) {
    return null;
  }
  return candidate.sessionKey;
}

export function useLobbyCommunicationSyncState(params: {
  activeCompany: Company;
  companySessionSnapshots: RequirementSessionSnapshot[];
  setCompanySessionSnapshots: (snapshots: RequirementSessionSnapshot[]) => void;
  activeArtifacts: ArtifactRecord[];
  activeDispatches: DispatchRecord[];
  replaceDispatchRecords: (dispatches: DispatchRecord[]) => void;
  updateCompany: (patch: Partial<Company>) => Promise<unknown> | void;
  connected: boolean;
  isPageVisible: boolean;
}) {
  const {
    activeCompany,
    companySessionSnapshots,
    setCompanySessionSnapshots,
    activeArtifacts,
    activeDispatches,
    replaceDispatchRecords,
    updateCompany,
    connected,
    isPageVisible,
  } = params;
  const [recoveringCommunication, setRecoveringCommunication] = useState(false);

  const recoverCommunication = useCallback(
    async (options?: { silent?: boolean; force?: boolean }) => {
      setRecoveringCommunication(true);
      try {
        const { companyPatch, dispatches, sessionSnapshots, summary } =
          await syncDelegationClosedLoopState({
            company: activeCompany,
            previousSnapshots: companySessionSnapshots,
            activeArtifacts,
            activeDispatches,
            force: options?.force,
          });
        setCompanySessionSnapshots(sessionSnapshots);
        replaceDispatchRecords(dispatches);
        await updateCompany(companyPatch);
        return summary;
      } finally {
        setRecoveringCommunication(false);
      }
    },
    [
      activeArtifacts,
      activeCompany,
      activeDispatches,
      companySessionSnapshots,
      replaceDispatchRecords,
      setCompanySessionSnapshots,
      updateCompany,
    ],
  );

  useEffect(() => {
    if (!connected || !isPageVisible) {
      return;
    }
    void recoverCommunication({
      silent: true,
      force: companySessionSnapshots.length === 0,
    }).catch(() => undefined);
  }, [
    companySessionSnapshots.length,
    connected,
    recoverCommunication,
    isPageVisible,
  ]);

  useEffect(() => {
    if (!connected || !isPageVisible) {
      return;
    }
    const companyAgentIds = new Set(activeCompany.employees.map((employee) => employee.agentId));
    let timerId: number | null = null;
    const unsubscribe = gateway.subscribe("chat", (payload) => {
      const sessionKey = extractChatSyncSessionKey(payload);
      const actorId = resolveSessionActorId(sessionKey);
      if (!actorId || !companyAgentIds.has(actorId)) {
        return;
      }
      if (timerId !== null) {
        return;
      }
      timerId = window.setTimeout(() => {
        timerId = null;
        void recoverCommunication({ silent: true }).catch(() => undefined);
      }, 400);
    });
    return () => {
      unsubscribe();
      if (timerId !== null) {
        window.clearTimeout(timerId);
      }
    };
  }, [activeCompany.employees, connected, recoverCommunication, isPageVisible]);

  return {
    recoveringCommunication,
    recoverCommunication,
  };
}
