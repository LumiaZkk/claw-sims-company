import { useCallback, useEffect, useReducer, type Dispatch, type SetStateAction } from "react";
import { gateway, type GatewaySessionArchiveRow, type GatewaySessionRow } from "../../../application/gateway";
import { resolveArchiveHistoryNotice } from "../../../application/mission/history/round-restore";
import {
  resolveSessionActorId,
  resolveSessionUpdatedAt,
} from "../../../lib/sessions";

type ChatSessionHistoryState = {
  recentAgentSessions: GatewaySessionRow[];
  recentArchivedRounds: GatewaySessionArchiveRow[];
  archiveHistoryNotice: string | null;
  historyLoading: boolean;
  historyRefreshNonce: number;
};

type ChatSessionHistoryAction =
  | { type: "reset" }
  | { type: "setLoading"; value: boolean }
  | { type: "setRecentAgentSessions"; value: SetStateAction<GatewaySessionRow[]> }
  | { type: "setRecentArchivedRounds"; value: SetStateAction<GatewaySessionArchiveRow[]> }
  | { type: "setArchiveHistoryNotice"; value: string | null }
  | { type: "incrementRefreshNonce" };

function reduceSetStateAction<T>(state: T, value: SetStateAction<T>): T {
  return typeof value === "function" ? (value as (previous: T) => T)(state) : value;
}

function reduceChatSessionHistoryState(
  state: ChatSessionHistoryState,
  action: ChatSessionHistoryAction,
): ChatSessionHistoryState {
  switch (action.type) {
    case "reset":
      return {
        ...state,
        recentAgentSessions: [],
        recentArchivedRounds: [],
        archiveHistoryNotice: null,
        historyLoading: false,
      };
    case "setLoading":
      return {
        ...state,
        historyLoading: action.value,
      };
    case "setRecentAgentSessions":
      return {
        ...state,
        recentAgentSessions: reduceSetStateAction(state.recentAgentSessions, action.value),
      };
    case "setRecentArchivedRounds":
      return {
        ...state,
        recentArchivedRounds: reduceSetStateAction(state.recentArchivedRounds, action.value),
      };
    case "setArchiveHistoryNotice":
      return {
        ...state,
        archiveHistoryNotice: action.value,
      };
    case "incrementRefreshNonce":
      return {
        ...state,
        historyRefreshNonce: state.historyRefreshNonce + 1,
      };
    default:
      return state;
  }
}

export function useChatSessionHistory(input: {
  connected: boolean;
  historyAgentId: string | null;
  isGroup: boolean;
  isHistoryMenuOpen: boolean;
  isArchiveView: boolean;
  sessionKey: string | null;
  supportsSessionHistory: boolean;
  supportsSessionArchives: boolean;
}) {
  const [state, dispatch] = useReducer(reduceChatSessionHistoryState, {
    recentAgentSessions: [],
    recentArchivedRounds: [],
    archiveHistoryNotice: null,
    historyLoading: false,
    historyRefreshNonce: 0,
  });

  useEffect(() => {
    if (!input.connected || input.isGroup || !input.historyAgentId) {
      dispatch({ type: "reset" });
      return;
    }

    if (!input.isHistoryMenuOpen && !input.isArchiveView) {
      dispatch({ type: "setLoading", value: false });
      return;
    }

    let cancelled = false;
    dispatch({ type: "setLoading", value: true });
    const loaders: Promise<void>[] = [];

    if (input.supportsSessionHistory) {
      loaders.push(
        gateway
          .listSessions({ limit: 80, includeGlobal: false })
          .then((sessionResult) => {
            if (cancelled) {
              return;
            }
            const sessions = (sessionResult.sessions ?? [])
              .filter((session) => resolveSessionActorId(session) === input.historyAgentId)
              .sort((left, right) => resolveSessionUpdatedAt(right) - resolveSessionUpdatedAt(left))
              .slice(0, 16);
            dispatch({ type: "setRecentAgentSessions", value: sessions });
          })
          .catch((error) => {
            if (!cancelled) {
              console.error("Failed to load recent sessions", error);
              dispatch({ type: "setRecentAgentSessions", value: [] });
            }
          }),
      );
    } else {
      dispatch({ type: "setRecentAgentSessions", value: [] });
    }

    if (input.supportsSessionArchives) {
      loaders.push(
        gateway
          .listSessionArchives(input.historyAgentId, 24)
          .then((archiveResult) => {
            if (cancelled) {
              return;
            }
            dispatch({
              type: "setRecentArchivedRounds",
              value: (archiveResult.archives ?? []).slice(0, 12),
            });
            dispatch({ type: "setArchiveHistoryNotice", value: null });
          })
          .catch((error) => {
            if (!cancelled) {
              console.error("Failed to load archived rounds", error);
              dispatch({ type: "setRecentArchivedRounds", value: [] });
              dispatch({
                type: "setArchiveHistoryNotice",
                value: resolveArchiveHistoryNotice(error),
              });
            }
          }),
      );
    } else {
      dispatch({ type: "setRecentArchivedRounds", value: [] });
      dispatch({
        type: "setArchiveHistoryNotice",
        value: "当前后端暂不支持归档轮次。",
      });
    }

    Promise.allSettled(loaders).finally(() => {
      if (!cancelled) {
        dispatch({ type: "setLoading", value: false });
      }
    });

    return () => {
      cancelled = true;
    };
  }, [
    input.connected,
    input.historyAgentId,
    input.isArchiveView,
    input.isGroup,
    input.isHistoryMenuOpen,
    input.sessionKey,
    input.supportsSessionArchives,
    input.supportsSessionHistory,
    state.historyRefreshNonce,
  ]);

  const setRecentAgentSessions = useCallback<Dispatch<SetStateAction<GatewaySessionRow[]>>>(
    (value) => {
      dispatch({ type: "setRecentAgentSessions", value });
    },
    [],
  );

  const setRecentArchivedRounds = useCallback<Dispatch<SetStateAction<GatewaySessionArchiveRow[]>>>(
    (value) => {
      dispatch({ type: "setRecentArchivedRounds", value });
    },
    [],
  );

  const incrementHistoryRefreshNonce = useCallback(() => {
    dispatch({ type: "incrementRefreshNonce" });
  }, []);

  return {
    ...state,
    setRecentAgentSessions,
    setRecentArchivedRounds,
    incrementHistoryRefreshNonce,
  };
}
