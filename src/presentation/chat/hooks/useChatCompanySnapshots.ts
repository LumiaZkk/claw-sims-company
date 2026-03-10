import { useCallback, useEffect, useReducer, type Dispatch, type SetStateAction } from "react";
import {
  readCompanyRuntimeSnapshot,
  writeCompanyRuntimeSnapshot,
} from "../../../application/company/runtime-snapshot";
import type { RequirementSessionSnapshot } from "../../../domain/mission/requirement-snapshot";

type CompanySnapshotState = {
  companyId: string | null;
  companySessionSnapshots: RequirementSessionSnapshot[];
  hasBootstrappedCompanySync: boolean;
};

type CompanySnapshotAction =
  | { type: "hydrate"; companyId: string | null }
  | { type: "setSnapshots"; value: SetStateAction<RequirementSessionSnapshot[]> }
  | { type: "setBootstrapped"; value: boolean };

function createCompanySnapshotState(companyId: string | null): CompanySnapshotState {
  const snapshot = readCompanyRuntimeSnapshot(companyId);
  const companySessionSnapshots = snapshot?.companySessionSnapshots ?? [];
  return {
    companyId,
    companySessionSnapshots,
    hasBootstrappedCompanySync: companySessionSnapshots.length > 0,
  };
}

function reduceCompanySnapshotState(
  state: CompanySnapshotState,
  action: CompanySnapshotAction,
): CompanySnapshotState {
  switch (action.type) {
    case "hydrate":
      return createCompanySnapshotState(action.companyId);
    case "setSnapshots": {
      const nextSnapshots =
        typeof action.value === "function"
          ? action.value(state.companySessionSnapshots)
          : action.value;
      return {
        ...state,
        companySessionSnapshots: nextSnapshots,
      };
    }
    case "setBootstrapped":
      return {
        ...state,
        hasBootstrappedCompanySync: action.value,
      };
    default:
      return state;
  }
}

export function useChatCompanySnapshots(
  activeCompanyId: string | null,
): {
  companySessionSnapshots: RequirementSessionSnapshot[];
  hasBootstrappedCompanySync: boolean;
  setCompanySessionSnapshots: Dispatch<SetStateAction<RequirementSessionSnapshot[]>>;
  setHasBootstrappedCompanySync: (value: boolean) => void;
} {
  const [state, dispatch] = useReducer(
    reduceCompanySnapshotState,
    activeCompanyId,
    createCompanySnapshotState,
  );

  useEffect(() => {
    dispatch({ type: "hydrate", companyId: activeCompanyId });
  }, [activeCompanyId]);

  useEffect(() => {
    if (!activeCompanyId) {
      return;
    }
    writeCompanyRuntimeSnapshot(activeCompanyId, {
      companySessionSnapshots: state.companySessionSnapshots,
    });
  }, [activeCompanyId, state.companySessionSnapshots]);

  const setCompanySessionSnapshots = useCallback<Dispatch<SetStateAction<RequirementSessionSnapshot[]>>>(
    (value) => {
      dispatch({ type: "setSnapshots", value });
    },
    [],
  );

  const setHasBootstrappedCompanySync = useCallback((value: boolean) => {
    dispatch({ type: "setBootstrapped", value });
  }, []);

  return {
    companySessionSnapshots: state.companySessionSnapshots,
    hasBootstrappedCompanySync: state.hasBootstrappedCompanySync,
    setCompanySessionSnapshots,
    setHasBootstrappedCompanySync,
  };
}
