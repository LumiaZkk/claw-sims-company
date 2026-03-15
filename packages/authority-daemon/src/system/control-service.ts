import type {
  AuthorityBootstrapSnapshot,
  AuthorityExecutorConfig,
  AuthorityExecutorConfigPatch,
  AuthorityHealthSnapshot,
  AuthorityOperatorActionRequest,
  AuthorityOperatorActionResponse,
} from "../../../../src/infrastructure/authority/contract";
import type { AuthorityControlRouteDependencies } from "./control-routes";

export function createAuthorityControlService(input: {
  buildHealthSnapshot: () => AuthorityHealthSnapshot;
  buildBootstrapSnapshot: () => AuthorityBootstrapSnapshot;
  runAuthorityOperatorAction: (
    request: AuthorityOperatorActionRequest,
  ) => Promise<AuthorityOperatorActionResponse>;
  getExecutorConfig: () => AuthorityExecutorConfig;
  patchExecutorConfig: (patch: AuthorityExecutorConfigPatch) => Promise<AuthorityExecutorConfig>;
  proxyGatewayRequest: (method: string, params?: unknown) => Promise<unknown>;
}): AuthorityControlRouteDependencies {
  return {
    buildHealthSnapshot: input.buildHealthSnapshot,
    buildBootstrapSnapshot: input.buildBootstrapSnapshot,
    runAuthorityOperatorAction: input.runAuthorityOperatorAction,
    getExecutorConfig: input.getExecutorConfig,
    patchExecutorConfig: input.patchExecutorConfig,
    proxyGatewayRequest: input.proxyGatewayRequest,
  };
}
