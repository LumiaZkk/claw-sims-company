import type { AuthorityEvent } from "../../../../src/infrastructure/authority/contract";

export type AuthorityRoutePostCommit = {
  schedule?: {
    reason: string;
    companyId?: string;
  };
  managedExecutorSyncReason?: string;
  broadcasts?: AuthorityEvent[];
};

export type AuthorityRouteResult = {
  status: number;
  payload: unknown;
  postCommit?: AuthorityRoutePostCommit;
};

export function applyAuthorityRoutePostCommit(input: {
  result: AuthorityRouteResult;
  schedule: (reason: string, companyId?: string) => void;
  broadcast: (event: AuthorityEvent) => void;
  queueManagedExecutorSync?: (reason: string) => void | Promise<void>;
}): void {
  const { postCommit } = input.result;
  if (!postCommit) {
    return;
  }

  if (postCommit.schedule) {
    input.schedule(postCommit.schedule.reason, postCommit.schedule.companyId);
  }

  if (postCommit.managedExecutorSyncReason) {
    void input.queueManagedExecutorSync?.(postCommit.managedExecutorSyncReason);
  }

  postCommit.broadcasts?.forEach((event) => {
    input.broadcast(event);
  });
}
