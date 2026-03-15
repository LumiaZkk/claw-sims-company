import type { ServerResponse } from "node:http";
import type { AuthorityEvent } from "../../../../src/infrastructure/authority/contract";
import {
  getAuthorityHttpErrorMessage,
  getAuthorityHttpErrorStatus,
} from "./authority-error";
import {
  applyAuthorityRoutePostCommit,
  type AuthorityRouteResult,
} from "./authority-route-result";

export type AuthorityRouteDispatchSideEffects = {
  schedule: (reason: string, companyId?: string) => void;
  broadcast: (event: AuthorityEvent) => void;
  queueManagedExecutorSync?: (reason: string) => void | Promise<void>;
};

export async function dispatchAuthorityRouteAttempts(input: {
  response: ServerResponse;
  attempts: Array<() => Promise<AuthorityRouteResult | null>>;
  sideEffects: AuthorityRouteDispatchSideEffects;
}): Promise<boolean> {
  const { response, attempts, sideEffects } = input;

  for (const attempt of attempts) {
    const result = await attempt();
    if (!result) {
      continue;
    }

    sendAuthorityJson(response, result.status, result.payload);
    applyAuthorityRoutePostCommit({
      result,
      schedule: sideEffects.schedule,
      broadcast: sideEffects.broadcast,
      queueManagedExecutorSync: sideEffects.queueManagedExecutorSync,
    });
    return true;
  }

  return false;
}

export function sendAuthorityJson(
  response: ServerResponse,
  status: number,
  payload: unknown,
): void {
  response.statusCode = status;
  response.setHeader("Content-Type", "application/json; charset=utf-8");
  response.end(JSON.stringify(payload));
}

export function sendAuthorityError(
  response: ServerResponse,
  status: number,
  message: string,
): void {
  sendAuthorityJson(response, status, { error: message });
}

export function sendAuthorityCaughtError(
  response: ServerResponse,
  error: unknown,
): void {
  sendAuthorityError(
    response,
    getAuthorityHttpErrorStatus(error),
    getAuthorityHttpErrorMessage(error),
  );
}
