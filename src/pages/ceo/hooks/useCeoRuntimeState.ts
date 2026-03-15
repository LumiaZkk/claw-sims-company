import { useEffect, useState } from "react";
import {
  gateway,
  type ProviderManifest,
  resolveCompanyActorConversation,
  type ChatMessage,
  type GatewaySessionRow,
} from "../../../application/gateway";
import type { Company, EmployeeRef } from "../../../domain/org/types";
import {
  readCompanyRuntimeSnapshot,
  writeCompanyRuntimeSnapshot,
} from "../../../application/company/runtime-snapshot";

export function useCeoRuntimeState(params: {
  activeCompany: Company | null;
  ceo: EmployeeRef | null;
  connected: boolean;
  manifest: ProviderManifest | null;
  isPageVisible: boolean;
}) {
  const { activeCompany, ceo, connected, manifest, isPageVisible } = params;
  const runtimeSnapshot = readCompanyRuntimeSnapshot(activeCompany?.id);
  const [sessions, setSessions] = useState<GatewaySessionRow[]>(() => runtimeSnapshot?.sessions ?? []);
  const [ceoHistory, setCeoHistory] = useState<ChatMessage[]>(() => {
    if (!ceo?.agentId) {
      return [];
    }
    return runtimeSnapshot?.ceoHistoryByActor?.[ceo.agentId] ?? [];
  });
  const [currentTime, setCurrentTime] = useState(() => Date.now());

  useEffect(() => {
    if (!activeCompany) {
      return;
    }
    const snapshot = readCompanyRuntimeSnapshot(activeCompany.id);
    if (!snapshot) {
      return;
    }
    queueMicrotask(() => {
      setSessions(snapshot.sessions ?? []);
      setCeoHistory(ceo?.agentId ? snapshot.ceoHistoryByActor?.[ceo.agentId] ?? [] : []);
    });
  }, [activeCompany, ceo?.agentId]);

  useEffect(() => {
    if (!activeCompany) {
      return;
    }
    writeCompanyRuntimeSnapshot(activeCompany.id, {
      sessions,
      ceoHistoryByActor:
        ceo?.agentId
          ? {
              ...(readCompanyRuntimeSnapshot(activeCompany.id)?.ceoHistoryByActor ?? {}),
              [ceo.agentId]: ceoHistory,
            }
          : readCompanyRuntimeSnapshot(activeCompany.id)?.ceoHistoryByActor,
    });
  }, [activeCompany, ceo?.agentId, ceoHistory, sessions]);

  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentTime(Date.now());
    }, 60_000);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    if (!activeCompany || !connected || !isPageVisible) {
      return;
    }

    let cancelled = false;
    const load = async () => {
      try {
        const sessionsResult = await gateway.listSessions({
          limit: 80,
          includeDerivedTitles: true,
          includeLastMessage: true,
        });
        if (!cancelled) {
          setSessions(sessionsResult.sessions ?? []);
        }
      } catch (error) {
        console.error("Failed to load CEO homepage data", error);
      }
    };

    void load();
    const timer = setInterval(() => void load(), 10_000);
    return () => {
      cancelled = true;
      clearInterval(timer);
    };
  }, [activeCompany, connected, isPageVisible]);

  useEffect(() => {
    if (!activeCompany || !ceo || !connected || !isPageVisible || !manifest) {
      return;
    }

    let cancelled = false;
    const loadHistory = async () => {
      try {
        const resolved = await resolveCompanyActorConversation({
          backend: gateway,
          manifest,
          company: activeCompany,
          actorId: ceo.agentId,
          kind: "direct",
        });
        const history = await gateway.readConversation(resolved.conversationRef, 8);
        if (!cancelled) {
          setCeoHistory(
            (history.messages ?? []).map((message) => ({
              role: message.role,
              text: message.text,
              content: message.content,
              timestamp: message.timestamp,
            })),
          );
        }
      } catch (error) {
        console.error("Failed to load CEO history", error);
      }
    };
    void loadHistory();
    return () => {
      cancelled = true;
    };
  }, [activeCompany, ceo, connected, isPageVisible, manifest]);

  return {
    sessions,
    ceoHistory,
    currentTime,
  };
}
