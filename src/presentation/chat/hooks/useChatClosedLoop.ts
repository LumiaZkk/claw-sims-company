import { useCallback } from "react";
import type { Dispatch, RefObject, SetStateAction } from "react";
import { syncDelegationClosedLoopState } from "../../../application/delegation/closed-loop";
import type { ArtifactRecord } from "../../../domain/artifact/types";
import type { DispatchRecord } from "../../../domain/delegation/types";
import type { Company } from "../../../domain/org/types";
import type { RequirementSessionSnapshot } from "../../../domain/mission/requirement-snapshot";

export function useChatClosedLoop(input: {
  activeCompany: Company | null;
  activeArtifacts: ArtifactRecord[];
  activeDispatches: DispatchRecord[];
  previousSnapshotsRef: RefObject<RequirementSessionSnapshot[]>;
  setCompanySessionSnapshots: Dispatch<SetStateAction<RequirementSessionSnapshot[]>>;
  replaceDispatchRecords: (dispatches: DispatchRecord[]) => void;
  updateCompany: (company: Partial<Company>) => Promise<void>;
}) {
  const {
    activeCompany,
    activeArtifacts,
    activeDispatches,
    previousSnapshotsRef,
    replaceDispatchRecords,
    setCompanySessionSnapshots,
    updateCompany,
  } = input;

  return useCallback(
    async (options?: { force?: boolean }) => {
      if (!activeCompany) {
        setCompanySessionSnapshots([]);
        return null;
      }

      const { companyPatch, dispatches, sessionSnapshots, summary } =
        await syncDelegationClosedLoopState({
          company: activeCompany,
          previousSnapshots: previousSnapshotsRef.current,
          activeArtifacts,
          activeDispatches,
          force: options?.force,
        });

      setCompanySessionSnapshots(sessionSnapshots);
      replaceDispatchRecords(dispatches);

      const hasChanges =
        summary.requestsAdded > 0 ||
        summary.requestsUpdated > 0 ||
        summary.requestsSuperseded > 0 ||
        summary.handoffsRecovered > 0 ||
        summary.tasksRecovered > 0;
      if (hasChanges) {
        await updateCompany(companyPatch);
      }
      return summary;
    },
    [
      activeArtifacts,
      activeCompany,
      activeDispatches,
      previousSnapshotsRef,
      replaceDispatchRecords,
      setCompanySessionSnapshots,
      updateCompany,
    ],
  );
}
