import { useCallback, useEffect, useReducer, type SetStateAction } from "react";

type SummaryPanelView = "owner" | "team" | "debug";

type ChatPanelState = {
  isHistoryMenuOpen: boolean;
  isSummaryOpen: boolean;
  isTechnicalSummaryOpen: boolean;
  summaryPanelView: SummaryPanelView;
};

type ChatPanelAction =
  | { type: "resetSession" }
  | { type: "setHistoryMenuOpen"; value: boolean }
  | { type: "setSummaryOpen"; value: boolean }
  | { type: "setTechnicalSummaryOpen"; value: SetStateAction<boolean> }
  | { type: "setSummaryPanelView"; value: SummaryPanelView };

function reduceTechnicalSummaryOpen(
  state: boolean,
  value: SetStateAction<boolean>,
): boolean {
  return typeof value === "function" ? value(state) : value;
}

function reduceChatPanelState(state: ChatPanelState, action: ChatPanelAction): ChatPanelState {
  switch (action.type) {
    case "resetSession":
      return {
        isHistoryMenuOpen: false,
        isSummaryOpen: false,
        isTechnicalSummaryOpen: false,
        summaryPanelView: "owner",
      };
    case "setHistoryMenuOpen":
      return {
        ...state,
        isHistoryMenuOpen: action.value,
      };
    case "setSummaryOpen":
      return {
        ...state,
        isSummaryOpen: action.value,
        isTechnicalSummaryOpen: action.value ? state.isTechnicalSummaryOpen : false,
      };
    case "setTechnicalSummaryOpen":
      return {
        ...state,
        isTechnicalSummaryOpen: reduceTechnicalSummaryOpen(
          state.isTechnicalSummaryOpen,
          action.value,
        ),
      };
    case "setSummaryPanelView":
      return {
        ...state,
        summaryPanelView: action.value,
        isTechnicalSummaryOpen:
          action.value === "debug" ? true : state.isTechnicalSummaryOpen && action.value !== "owner",
      };
    default:
      return state;
  }
}

export function useChatPanelState(sessionKey: string | null) {
  const [state, dispatch] = useReducer(reduceChatPanelState, {
    isHistoryMenuOpen: false,
    isSummaryOpen: false,
    isTechnicalSummaryOpen: false,
    summaryPanelView: "owner" as SummaryPanelView,
  });

  useEffect(() => {
    dispatch({ type: "resetSession" });
  }, [sessionKey]);

  const setIsHistoryMenuOpen = useCallback((value: boolean) => {
    dispatch({ type: "setHistoryMenuOpen", value });
  }, []);

  const setIsSummaryOpen = useCallback((value: boolean) => {
    dispatch({ type: "setSummaryOpen", value });
  }, []);

  const setIsTechnicalSummaryOpen = useCallback((value: SetStateAction<boolean>) => {
    dispatch({ type: "setTechnicalSummaryOpen", value });
  }, []);

  const setSummaryPanelView = useCallback((value: SummaryPanelView) => {
    dispatch({ type: "setSummaryPanelView", value });
  }, []);

  const openSummaryPanel = useCallback((view: SummaryPanelView = "owner") => {
    dispatch({ type: "setSummaryPanelView", value: view });
    dispatch({ type: "setSummaryOpen", value: true });
  }, []);

  return {
    ...state,
    setIsHistoryMenuOpen,
    setIsSummaryOpen,
    setIsTechnicalSummaryOpen,
    setSummaryPanelView,
    openSummaryPanel,
  };
}
