export { useGatewayStore } from "../../infrastructure/gateway/store";
export {
  backend,
  backendManager,
  gateway,
  listBackendProviders,
  getActiveBackendCapabilities,
  getActiveBackendProvider,
  getActiveBackendProviderId,
  setActiveBackendProvider,
  buildProviderManifest,
  resolveCompanyActorConversation,
  sendTurnToCompanyActor,
} from "../../infrastructure/gateway";
export type * from "../../infrastructure/gateway";
export type * from "../../infrastructure/gateway/openclaw/client";
export type * from "../../infrastructure/gateway/openclaw/types";
