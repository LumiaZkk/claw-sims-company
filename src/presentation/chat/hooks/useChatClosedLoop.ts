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
  return useCallback(
    async (options?: { force?: boolean }) => {
      if (!input.activeCompany) {
        input.setCompanySessionSnapshots([]);
        return null;
      }

      const { companyPatch, dispatches, sessionSnapshots, summary } =
        await syncDelegationClosedLoopState({
          company: input.activeCompany,
          previousSnapshots: input.previousSnapshotsRef.current,
          activeArtifacts: input.activeArtifacts,
          activeDispatches: input.activeDispatches,
          force: options?.force,
        });

      input.setCompanySessionSnapshots(sessionSnapshots);
      input.replaceDispatchRecords(dispatches);

      const hasChanges =
        summary.requestsAdded > 0 ||
        summary.requestsUpdated > 0 ||
        summary.requestsSuperseded > 0 ||
        summary.handoffsRecovered > 0 ||
        summary.tasksRecovered > 0;
      if (hasChanges) {
        await input.updateCompany(companyPatch);
      }
      return summary;
    },
    [input],
  );
}
