import { useCallback, useEffect, useReducer } from "react";

const CHAT_INITIAL_RENDER_WINDOW = 80;
const CHAT_RENDER_WINDOW_STEP = 80;

type ChatDisplayState = {
  displayWindowSize: number;
  roomBroadcastMode: boolean;
};

type ChatDisplayAction =
  | { type: "resetWindow" }
  | { type: "expandWindow"; totalCount: number }
  | { type: "setRoomBroadcastMode"; value: boolean }
  | { type: "resetRoomBroadcastMode" };

function reduceChatDisplayState(state: ChatDisplayState, action: ChatDisplayAction): ChatDisplayState {
  switch (action.type) {
    case "resetWindow":
      return {
        ...state,
        displayWindowSize: CHAT_INITIAL_RENDER_WINDOW,
      };
    case "expandWindow":
      return {
        ...state,
        displayWindowSize: Math.min(
          state.displayWindowSize + CHAT_RENDER_WINDOW_STEP,
          action.totalCount,
        ),
      };
    case "setRoomBroadcastMode":
      return {
        ...state,
        roomBroadcastMode: action.value,
      };
    case "resetRoomBroadcastMode":
      return {
        ...state,
        roomBroadcastMode: false,
      };
    default:
      return state;
  }
}

export function useChatDisplayState(input: {
  agentId: string | null;
  archiveId: string | null;
  historyAgentId: string | null;
  productRoomId: string | null;
  sessionKey: string | null;
}) {
  const [state, dispatch] = useReducer(reduceChatDisplayState, {
    displayWindowSize: CHAT_INITIAL_RENDER_WINDOW,
    roomBroadcastMode: false,
  });

  useEffect(() => {
    dispatch({ type: "resetWindow" });
  }, [input.agentId, input.archiveId, input.historyAgentId, input.productRoomId]);

  useEffect(() => {
    dispatch({ type: "resetRoomBroadcastMode" });
  }, [input.agentId, input.sessionKey]);

  const expandDisplayWindow = useCallback((totalCount: number) => {
    dispatch({ type: "expandWindow", totalCount });
  }, []);

  const setRoomBroadcastMode = useCallback((value: boolean) => {
    dispatch({ type: "setRoomBroadcastMode", value });
  }, []);

  return {
    displayWindowSize: state.displayWindowSize,
    roomBroadcastMode: state.roomBroadcastMode,
    expandDisplayWindow,
    setRoomBroadcastMode,
  };
}
