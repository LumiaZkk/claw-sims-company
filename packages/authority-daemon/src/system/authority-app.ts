import { authorityBadRequest } from "./authority-error";
import { AuthorityRepository } from "../persistence/authority-repository";
import { AUTHORITY_PORT, DATA_DIR, DB_PATH, readJsonBody, setCorsHeaders, stringifyError } from "../persistence/authority-persistence-shared";
import { startAuthorityBackgroundJobs } from "./background-jobs";
import { removeManagedExecutorCompanyWorkspace } from "../company/company-delete";
import { createAuthorityCompanyManagementCommands } from "../company/company-management-commands";
import { CompanyOpsEngine } from "../company/company-ops-engine";
import { createAuthorityHttpServer } from "./http-server";
import { createAuthorityNativeIntegration } from "../executor/native/authority-native-integration";
import { createAuthorityOperatorActionRunner } from "./operator-actions";
import { createAuthorityChatService } from "../agent/chat-service";
import { createAuthorityCompanyManagementService } from "../company/company-management-service";
import { createAuthorityCompanyManagementRouteService } from "../company/company-management-route-service";
import { createAuthorityCompanyStateService } from "../company/company-state-service";
import { createAuthorityControlService } from "./control-service";
import { createAuthorityRuntimeCommandService } from "../collaboration/runtime-command-service";
import { createAuthorityWebsocketBroadcast } from "./websocket-broadcast";

const repository = new AuthorityRepository(DB_PATH);
repository.ensureManagedExecutorAgentInventory();
for (const company of repository.loadConfig()?.companies ?? []) {
  try {
    repository.repairRuntimeIfNeeded(company.id);
  } catch (error) {
    console.warn(`Authority startup runtime repair failed for ${company.id}.`, error);
  }
}

const websocketBroadcast = createAuthorityWebsocketBroadcast();
const companyOpsEngine = new CompanyOpsEngine(
  {
    loadConfig: () => repository.loadConfig(),
    saveConfig: (config) => repository.saveConfig(config),
    loadRuntime: (companyId) => repository.loadRuntime(companyId),
    saveRuntime: (runtime) => repository.saveRuntime(runtime),
    appendCompanyEvent: (event) => repository.appendCompanyEvent(event),
  },
  {
    onCompanyChanged: (companyId) => {
      websocketBroadcast.broadcast({ type: "bootstrap.updated", companyId, timestamp: Date.now() });
      websocketBroadcast.broadcast({ type: "company.updated", companyId, timestamp: Date.now() });
    },
    onRuntimeChanged: (companyId) => {
      websocketBroadcast.broadcast({ type: "company.updated", companyId, timestamp: Date.now() });
    },
  },
);

const nativeIntegration = createAuthorityNativeIntegration({
  repository,
  broadcast: websocketBroadcast.broadcast,
});

const companyManagementService = createAuthorityCompanyManagementService({
  repository: {
    loadConfig: () => repository.loadConfig(),
    saveConfig: (config) => repository.saveConfig(config),
    loadRuntime: (companyId) => repository.loadRuntime(companyId),
    setAgentFile: (agentId, name, content) => {
      repository.setAgentFile(agentId, name, content);
    },
    clearManagedExecutorAgent: (agentId) => {
      repository.clearManagedExecutorAgent(agentId);
    },
  },
  runManagedExecutorMutation: nativeIntegration.runManagedExecutorMutation,
  ensureManagedCompanyExecutorProvisioned: nativeIntegration.ensureManagedCompanyExecutorProvisioned,
  deleteManagedAgentFromExecutor: nativeIntegration.deleteManagedAgentFromExecutor,
});

const companyManagementCommands = createAuthorityCompanyManagementCommands({
  repository: {
    saveConfig: (config) => repository.saveConfig(config),
    loadConfig: () => repository.loadConfig(),
    saveRuntime: (runtime) => repository.saveRuntime(runtime),
    loadRuntime: (companyId) => repository.loadRuntime(companyId),
    switchCompany: (companyId) => repository.switchCompany(companyId),
    deleteCompany: (companyId) => repository.deleteCompany(companyId),
    clearManagedExecutorAgentsForCompany: (companyId) =>
      repository.clearManagedExecutorAgentsForCompany(companyId),
    hasCompany: (companyId) => repository.hasCompany(companyId),
  },
  buildCompanyDefinition: companyManagementService.buildCompanyDefinition,
  runManagedExecutorMutation: nativeIntegration.runManagedExecutorMutation,
  ensureManagedCompanyExecutorProvisionedBestEffort:
    nativeIntegration.ensureManagedCompanyExecutorProvisionedBestEffort,
  ensureManagedCompanyExecutorProvisioned: nativeIntegration.ensureManagedCompanyExecutorProvisioned,
  updateCompanyExecutorProvisioning: nativeIntegration.updateCompanyExecutorProvisioning,
  listManagedProvisioningAgentIds: nativeIntegration.listManagedProvisioningAgentIds,
  resolveProvisioningFailureState: nativeIntegration.resolveProvisioningFailureState,
  stringifyError,
  previewCompanyEmployeeHire: companyManagementService.previewCompanyEmployeeHire,
  previewCompanyEmployeesHire: companyManagementService.previewCompanyEmployeesHire,
  hireCompanyEmployeeStrongConsistency: companyManagementService.hireCompanyEmployeeStrongConsistency,
  hireCompanyEmployeesStrongConsistency: companyManagementService.hireCompanyEmployeesStrongConsistency,
  hireCompanyEmployeeWithProvisioningFallback:
    companyManagementService.hireCompanyEmployeeWithProvisioningFallback,
  hireCompanyEmployeesWithProvisioningFallback:
    companyManagementService.hireCompanyEmployeesWithProvisioningFallback,
  buildBootstrapSnapshot: nativeIntegration.buildBootstrapSnapshot,
  getExecutorState: nativeIntegration.getExecutorState,
  deleteManagedAgentFromExecutor: nativeIntegration.deleteManagedAgentFromExecutor,
  listExecutorAgentIds: nativeIntegration.listExecutorAgentIds,
  cleanupCompanyWorkspace: (companyId) =>
    removeManagedExecutorCompanyWorkspace({ companyId }),
  logWarn: (message, error) => {
    console.warn(message, error);
  },
});

const runAuthorityOperatorAction = createAuthorityOperatorActionRunner({
  dbPath: DB_PATH,
  dataDir: DATA_DIR,
  repository,
  companyOpsEngine,
  queueManagedExecutorSync: nativeIntegration.queueManagedExecutorSync,
  buildBootstrapSnapshot: nativeIntegration.buildBootstrapSnapshot,
  getExecutorSnapshot: nativeIntegration.getExecutorSnapshot,
  notifyBootstrapUpdated: () => {
    nativeIntegration.broadcastBootstrapUpdated();
  },
});

const controlService = createAuthorityControlService({
  buildHealthSnapshot: nativeIntegration.buildHealthSnapshot,
  buildBootstrapSnapshot: nativeIntegration.buildBootstrapSnapshot,
  runAuthorityOperatorAction,
  getExecutorConfig: nativeIntegration.getExecutorConfig,
  patchExecutorConfig: nativeIntegration.patchExecutorConfig,
  proxyGatewayRequest: async (method, params) => {
    if (!method || !method.trim()) {
      throw authorityBadRequest("Gateway proxy method is required.");
    }
    return nativeIntegration.proxyGatewayRequest(method.trim(), params);
  },
});

const companyStateService = createAuthorityCompanyStateService(repository);
const runtimeCommandService = createAuthorityRuntimeCommandService({
  repository,
  proxyGatewayRequest: nativeIntegration.proxyGatewayRequest,
});
const companyManagementRouteService = createAuthorityCompanyManagementRouteService(companyManagementCommands);
const chatService = createAuthorityChatService({
  repository,
  proxyGatewayRequest: nativeIntegration.proxyGatewayRequest,
});

const stopBackgroundJobs = startAuthorityBackgroundJobs({
  loadConfig: () => repository.loadConfig(),
  loadRuntime: (companyId) => repository.loadRuntime(companyId),
  applyRuntimeSessionStatus: nativeIntegration.applyRuntimeSessionStatus,
  companyOpsEngine,
  connectExecutor: nativeIntegration.connectExecutor,
  getExecutorState: nativeIntegration.getExecutorState,
  requestSessionStatus: nativeIntegration.requestSessionStatus,
  getSessionStatusCapabilityState: nativeIntegration.getSessionStatusCapabilityState,
  updateSessionStatusCapability: nativeIntegration.updateSessionStatusCapability,
  broadcastCompanyUpdated: nativeIntegration.broadcastCompanyUpdated,
  queueManagedExecutorSync: nativeIntegration.queueManagedExecutorSync,
});

const server = createAuthorityHttpServer({
  readJsonBody,
  setCorsHeaders,
  stringifyError,
  syncCompanyCodexAuth: nativeIntegration.syncCompanyCodexAuth,
  routeDeps: {
    control: controlService,
    companyState: companyStateService,
    runtimeCommands: runtimeCommandService,
    companyManagement: companyManagementRouteService,
    chatCommands: chatService,
  },
  sideEffects: {
    schedule: (reason, companyId) => companyOpsEngine.schedule(reason, companyId),
    broadcast: websocketBroadcast.broadcast,
    queueManagedExecutorSync: nativeIntegration.queueManagedExecutorSync,
  },
  attachWebsocketBroadcast: websocketBroadcast.attach,
});

server.on("close", () => {
  stopBackgroundJobs();
});

export function startAuthorityServer() {
  server.listen(AUTHORITY_PORT, "127.0.0.1", () => {
    console.log(`cyber-company authority listening on http://127.0.0.1:${AUTHORITY_PORT}`);
    console.log(`SQLite authority db: ${DB_PATH}`);
  });
}
