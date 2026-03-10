import { useEffect, type MutableRefObject } from "react";
import type { RequirementSessionSnapshot } from "../../../domain/mission/requirement-snapshot";

export function useChatCompanySync(input: {
  shouldRun: boolean;
  intervalMs: number;
  companySessionSnapshotsRef: MutableRefObject<RequirementSessionSnapshot[]>;
  syncCompanyCommunication: (options?: { force?: boolean }) => Promise<unknown>;
  setHasBootstrappedCompanySync: (value: boolean) => void;
}) {
  useEffect(() => {
    if (!input.shouldRun) {
      return;
    }

    let cancelled = false;
    const run = async () => {
      try {
        if (!cancelled) {
          await input.syncCompanyCommunication({
            force: input.companySessionSnapshotsRef.current.length === 0,
          });
        }
      } catch (error) {
        console.error("background company sync failed", error);
      } finally {
        if (!cancelled) {
          input.setHasBootstrappedCompanySync(true);
        }
      }
    };

    void run();
    const timer = window.setInterval(() => {
      void run();
    }, input.intervalMs);

    return () => {
      cancelled = true;
      window.clearInterval(timer);
    };
  }, [input]);
}
