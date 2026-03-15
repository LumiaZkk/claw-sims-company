import { normalizeProviderSessionStatus } from "../../../../src/application/agent-runtime";
import type { CyberCompanyConfig } from "../../../../src/domain/org/types";
import type { AuthorityCompanyRuntimeSnapshot } from "../../../../src/infrastructure/authority/contract";
import { EXECUTOR_PROVIDER_ID } from "../persistence/authority-persistence-shared";
import { runAuthorityRuntimeSessionStatusRepair } from "../agent/runtime-session-status-repair";

export function startAuthorityBackgroundJobs(input: {
  loadConfig: () => CyberCompanyConfig | null;
  loadRuntime: (companyId: string) => AuthorityCompanyRuntimeSnapshot;
  applyRuntimeSessionStatus: (
    companyId: string,
    status: ReturnType<typeof normalizeProviderSessionStatus>,
  ) => void;
  companyOpsEngine: { start: () => void };
  connectExecutor: () => Promise<unknown>;
  getExecutorState: () => string;
  requestSessionStatus: (sessionKey: string) => Promise<unknown>;
  getSessionStatusCapabilityState: () => Parameters<
    typeof runAuthorityRuntimeSessionStatusRepair
  >[0]["sessionStatusCapabilityState"];
  updateSessionStatusCapability: Parameters<
    typeof runAuthorityRuntimeSessionStatusRepair
  >[0]["updateSessionStatusCapability"];
  broadcastCompanyUpdated: (companyId: string) => void;
  queueManagedExecutorSync: (reason: string) => void | Promise<void>;
}) {
  const repairTimer = setInterval(() => {
    const config = input.loadConfig();
    void runAuthorityRuntimeSessionStatusRepair({
      companies: config?.companies ?? [],
      executorState: input.getExecutorState(),
      sessionStatusCapabilityState: input.getSessionStatusCapabilityState(),
      loadRuntime: input.loadRuntime,
      requestSessionStatus: input.requestSessionStatus,
      updateSessionStatusCapability: input.updateSessionStatusCapability,
      getSessionStatusCapabilityState: input.getSessionStatusCapabilityState,
      normalizeProviderSessionStatus,
      applyRuntimeSessionStatus: input.applyRuntimeSessionStatus,
      broadcastCompanyUpdated: input.broadcastCompanyUpdated,
      providerId: EXECUTOR_PROVIDER_ID,
      logWarn: (message, error) => {
        console.warn(message, error);
      },
    });
  }, 10_000);

  const provisioningTimer = setInterval(() => {
    const config = input.loadConfig();
    if (!config?.companies.some((company) => company.system?.executorProvisioning?.state !== "ready")) {
      return;
    }
    void input.queueManagedExecutorSync("executor.provisioning.watchdog");
  }, 15_000);

  void input.connectExecutor().catch((error) => {
    console.warn("Authority executor bridge failed to connect on startup:", error);
  });
  input.companyOpsEngine.start();

  return () => {
    clearInterval(repairTimer);
    clearInterval(provisioningTimer);
  };
}
