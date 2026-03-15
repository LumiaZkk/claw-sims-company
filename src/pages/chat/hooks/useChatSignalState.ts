import { useCallback, useEffect, useReducer, type Dispatch, type SetStateAction } from "react";
import type { FocusProgressEvent } from "../../../application/governance/chat-progress";
import type { FocusActionWatch } from "../view-models/focus";

type ChatSignalState = {
  localProgressEvents: FocusProgressEvent[];
  actionWatches: FocusActionWatch[];
};

type ChatSignalAction =
  | { type: "reset" }
  | { type: "setLocalProgressEvents"; value: SetStateAction<FocusProgressEvent[]> }
  | { type: "setActionWatches"; value: SetStateAction<FocusActionWatch[]> };

function reduceSetStateAction<T>(state: T, value: SetStateAction<T>): T {
  return typeof value === "function" ? (value as (previous: T) => T)(state) : value;
}

function reduceChatSignalState(state: ChatSignalState, action: ChatSignalAction): ChatSignalState {
  switch (action.type) {
    case "reset":
      return {
        localProgressEvents: [],
        actionWatches: [],
      };
    case "setLocalProgressEvents":
      return {
        ...state,
        localProgressEvents: reduceSetStateAction(state.localProgressEvents, action.value),
      };
    case "setActionWatches":
      return {
        ...state,
        actionWatches: reduceSetStateAction(state.actionWatches, action.value),
      };
    default:
      return state;
  }
}

export function useChatSignalState(sessionKey: string | null) {
  const [state, dispatch] = useReducer(reduceChatSignalState, {
    localProgressEvents: [],
    actionWatches: [],
  });

  useEffect(() => {
    dispatch({ type: "reset" });
  }, [sessionKey]);

  const setLocalProgressEvents = useCallback<Dispatch<SetStateAction<FocusProgressEvent[]>>>(
    (value) => {
      dispatch({ type: "setLocalProgressEvents", value });
    },
    [],
  );

  const setActionWatches = useCallback<Dispatch<SetStateAction<FocusActionWatch[]>>>(
    (value) => {
      dispatch({ type: "setActionWatches", value });
    },
    [],
  );

  const appendLocalProgressEvent = useCallback((event: Omit<FocusProgressEvent, "source">) => {
    dispatch({
      type: "setLocalProgressEvents",
      value: (previous) =>
        [
          {
            ...event,
            source: "local" as const,
          },
          ...previous,
        ]
          .sort((left, right) => right.timestamp - left.timestamp)
          .slice(0, 6),
    });
  }, []);

  return {
    ...state,
    setLocalProgressEvents,
    setActionWatches,
    appendLocalProgressEvent,
  };
}
