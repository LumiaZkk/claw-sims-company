import { useEffect, useRef } from "react";
import type { MutableRefObject } from "react";
import { gateway, useGatewayStore } from "../../application/gateway";
import {
  getAuthorityCompanyRuntime,
  syncAuthorityCompanyRuntime,
} from "../../application/gateway/authority-control";
import type { AuthorityCompanyRuntimeSnapshot } from "../../infrastructure/authority/contract";
import { applyAuthorityRuntimeSnapshotToStore } from "../../infrastructure/authority/runtime-command";
import { refreshAuthorityBootstrapSilently } from "../../infrastructure/authority/bootstrap-command";
import {
  buildAuthorityRuntimeSignature,
  getLastAppliedAuthorityRuntimeSignature,
  recordAuthorityRuntimeSyncError,
  useAuthorityRuntimeSyncStore,
} from "../../infrastructure/authority/runtime-sync-store";
import { readCachedAuthorityRuntimeSnapshot } from "../../infrastructure/authority/runtime-cache";
import { buildAuthorityCompatibilityRuntimeSnapshot } from "../../infrastructure/authority/runtime-compatibility-snapshot";
import { useCompanyRuntimeStore } from "../../infrastructure/company/runtime/store";

function buildSnapshot(): AuthorityCompanyRuntimeSnapshot | null {
  const state = useCompanyRuntimeStore.getState();
  const companyId = state.activeCompany?.id ?? null;
  if (!companyId) {
    return null;
  }
  const snapshot: AuthorityCompanyRuntimeSnapshot = {
    companyId,
    activeRoomRecords: state.activeRoomRecords,
    activeMissionRecords: state.activeMissionRecords,
    activeConversationStates: state.activeConversationStates,
    activeWorkItems: state.activeWorkItems,
    activeRequirementAggregates: state.activeRequirementAggregates,
    activeRequirementEvidence: state.activeRequirementEvidence,
    primaryRequirementId: state.primaryRequirementId,
    activeRoundRecords: state.activeRoundRecords,
    activeArtifacts: state.activeArtifacts,
    activeDispatches: state.activeDispatches,
    activeRoomBindings: state.activeRoomBindings,
    activeSupportRequests: state.activeSupportRequests,
    activeEscalations: state.activeEscalations,
    activeDecisionTickets: state.activeDecisionTickets,
    activeAgentSessions: state.activeAgentSessions,
    activeAgentRuns: state.activeAgentRuns,
    activeAgentRuntime: state.activeAgentRuntime,
    activeAgentStatuses: state.activeAgentStatuses,
    activeAgentStatusHealth: state.activeAgentStatusHealth,
    updatedAt: Date.now(),
  };
  if (!state.authorityBackedState) {
    return snapshot;
  }
  return buildAuthorityCompatibilityRuntimeSnapshot({
    localRuntime: snapshot,
    authorityRuntime: readCachedAuthorityRuntimeSnapshot(companyId),
  });
}

export function CompanyAuthoritySyncHost() {
  const connected = useGatewayStore((state) => state.connected);
  const compatibilityPathEnabled = useAuthorityRuntimeSyncStore(
    (state) => state.compatibilityPathEnabled,
  );
  const authorityHydratedRef = useRef(false);
  const lastSyncWarningRef = useRef<{
    push: string | null;
    pull: string | null;
  }>({
    push: null,
    pull: null,
  });

  return (
    <>
      <CompanyAuthorityRecoveryBridge
        connected={connected}
        authorityHydratedRef={authorityHydratedRef}
        lastSyncWarningRef={lastSyncWarningRef}
      />
      <CompanyAuthorityCompatibilitySync
        connected={connected}
        compatibilityPathEnabled={compatibilityPathEnabled}
        authorityHydratedRef={authorityHydratedRef}
        lastSyncWarningRef={lastSyncWarningRef}
      />
    </>
  );
}

function CompanyAuthorityCompatibilitySync(props: {
  connected: boolean;
  compatibilityPathEnabled: boolean;
  authorityHydratedRef: MutableRefObject<boolean>;
  lastSyncWarningRef: MutableRefObject<{
    push: string | null;
    pull: string | null;
  }>;
}) {
  const { connected, compatibilityPathEnabled, authorityHydratedRef, lastSyncWarningRef } = props;
  const flushTimerRef = useRef<number | null>(null);
  const inFlightRef = useRef(false);

  useEffect(() => {
    if (!connected) {
      return;
    }

    const clearFlushTimer = () => {
      if (flushTimerRef.current !== null) {
        window.clearTimeout(flushTimerRef.current);
        flushTimerRef.current = null;
      }
    };

    const flush = () => {
      flushTimerRef.current = null;
      if (inFlightRef.current) {
        return;
      }
      if (!compatibilityPathEnabled) {
        return;
      }
      const snapshot = buildSnapshot();
      if (!snapshot) {
        return;
      }
      if (
        !authorityHydratedRef.current &&
        ((snapshot.activeAgentStatuses?.length ?? 0) === 0 ||
          snapshot.activeAgentStatusHealth?.coverage === "fallback")
      ) {
        return;
      }
      const signature = buildAuthorityRuntimeSignature(snapshot);
      if (signature === getLastAppliedAuthorityRuntimeSignature()) {
        return;
      }
      inFlightRef.current = true;
      void syncAuthorityCompanyRuntime(snapshot)
        .then((saved) => {
          lastSyncWarningRef.current.push = null;
          applyAuthorityRuntimeSnapshotToStore({
            operation: "push",
            snapshot: saved,
            set: useCompanyRuntimeStore.setState,
            get: useCompanyRuntimeStore.getState,
          });
        })
        .catch((error) => {
          const message = error instanceof Error ? error.message : String(error);
          if (lastSyncWarningRef.current.push !== message) {
            console.warn("Failed to sync runtime snapshot to authority", error);
            lastSyncWarningRef.current.push = message;
          }
          recordAuthorityRuntimeSyncError("push", error);
        })
        .finally(() => {
          inFlightRef.current = false;
        });
    };

    const unsubscribeStore = compatibilityPathEnabled
      ? useCompanyRuntimeStore.subscribe((state) => {
          if (!state.activeCompany) {
            return;
          }
          if (
            !authorityHydratedRef.current &&
            state.activeAgentStatuses.length > 0 &&
            state.activeAgentStatusHealth.coverage !== "fallback"
          ) {
            authorityHydratedRef.current = true;
          }
          clearFlushTimer();
          flushTimerRef.current = window.setTimeout(flush, 250);
        })
      : () => undefined;

    return () => {
      unsubscribeStore();
      clearFlushTimer();
    };
  }, [compatibilityPathEnabled, connected]);

  return null;
}

function CompanyAuthorityRecoveryBridge(props: {
  connected: boolean;
  authorityHydratedRef: MutableRefObject<boolean>;
  lastSyncWarningRef: MutableRefObject<{
    push: string | null;
    pull: string | null;
  }>;
}) {
  const { connected, authorityHydratedRef, lastSyncWarningRef } = props;
  const pullInFlightRef = useRef(false);

  useEffect(() => {
    if (!connected) {
      return;
    }

    const refreshRemoteRuntime = () => {
      if (pullInFlightRef.current) {
        return;
      }
      const activeCompany = useCompanyRuntimeStore.getState().activeCompany;
      if (!activeCompany) {
        return;
      }
      pullInFlightRef.current = true;
      void getAuthorityCompanyRuntime(activeCompany.id)
        .then((snapshot) => {
          lastSyncWarningRef.current.pull = null;
          const applied = applyAuthorityRuntimeSnapshotToStore({
            operation: "pull",
            snapshot,
            set: useCompanyRuntimeStore.setState,
            get: useCompanyRuntimeStore.getState,
          });
          if (applied) {
            authorityHydratedRef.current = true;
          }
        })
        .catch((error) => {
          const message = error instanceof Error ? error.message : String(error);
          if (lastSyncWarningRef.current.pull !== message) {
            console.warn("Failed to refresh runtime snapshot from authority", error);
            lastSyncWarningRef.current.pull = message;
          }
          recordAuthorityRuntimeSyncError("pull", error);
        })
        .finally(() => {
          pullInFlightRef.current = false;
        });
    };

    const refreshBootstrap = () => {
      void refreshAuthorityBootstrapSilently()
        .then((snapshot) => {
          lastSyncWarningRef.current.pull = null;
          authorityHydratedRef.current = Boolean(snapshot.runtime);
        })
        .catch((error) => {
          const message = error instanceof Error ? error.message : String(error);
          if (lastSyncWarningRef.current.pull !== message) {
            console.warn("Failed to refresh authority bootstrap snapshot", error);
            lastSyncWarningRef.current.pull = message;
          }
          recordAuthorityRuntimeSyncError("pull", error);
        });
    };

    const unsubscribeAuthority = gateway.subscribe("*", (raw) => {
      if (!raw || typeof raw !== "object") {
        return;
      }
      const event = raw as { event?: unknown; payload?: { companyId?: unknown } };
      const eventName = typeof event.event === "string" ? event.event : null;
      const activeCompany = useCompanyRuntimeStore.getState().activeCompany;
      if (!eventName || !activeCompany) {
        return;
      }
      const targetCompanyId =
        typeof event.payload?.companyId === "string" ? event.payload.companyId : activeCompany.id;
      if (targetCompanyId !== activeCompany.id) {
        return;
      }
      if (eventName === "bootstrap.updated") {
        refreshBootstrap();
        return;
      }
      if (
        eventName === "company.updated" ||
        eventName === "conversation.updated" ||
        eventName === "requirement.updated" ||
        eventName === "room.updated" ||
        eventName === "round.updated" ||
        eventName === "dispatch.updated" ||
        eventName === "artifact.updated" ||
        eventName === "decision.updated" ||
        eventName === "agent.runtime.updated"
      ) {
        refreshRemoteRuntime();
      }
    });

    refreshRemoteRuntime();

    return () => {
      unsubscribeAuthority();
    };
  }, [connected]);

  return null;
}
