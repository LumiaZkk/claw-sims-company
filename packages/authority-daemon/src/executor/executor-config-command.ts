import type {
  AuthorityExecutorConfig,
  AuthorityExecutorConfigPatch,
} from "../../../../src/infrastructure/authority/contract";

type StoredExecutorConfig = {
  type: "openclaw";
  openclaw: {
    url: string;
    token?: string;
  };
  connectionState?: AuthorityExecutorConfig["connectionState"];
  lastError?: string | null;
  lastConnectedAt?: number | null;
};

export async function runAuthorityExecutorConfigPatch(input: {
  body: AuthorityExecutorConfigPatch;
  deps: {
    loadExecutorConfig: () => StoredExecutorConfig;
    saveExecutorConfig: (config: StoredExecutorConfig) => StoredExecutorConfig;
    patchExecutorBridgeConfig: (input: {
      openclaw: { url: string; token: string };
      reconnect: boolean;
    }) => Promise<void>;
    broadcastExecutorStatus: () => void;
    queueManagedExecutorSync: (reason: string) => Promise<unknown>;
    getExecutorSnapshotConfig: () => AuthorityExecutorConfig;
  };
}) {
  const { body, deps } = input;
  const current = deps.loadExecutorConfig();
  const desired = deps.saveExecutorConfig({
    ...current,
    openclaw: {
      url:
        typeof body.openclaw?.url === "string" && body.openclaw.url.trim().length > 0
          ? body.openclaw.url.trim()
          : current.openclaw.url,
      token:
        body.openclaw?.token !== undefined
          ? body.openclaw.token ?? ""
          : (current.openclaw.token ?? ""),
    },
  });

  try {
    await deps.patchExecutorBridgeConfig({
      openclaw: {
        url: desired.openclaw.url,
        token: desired.openclaw.token ?? "",
      },
      reconnect: body.reconnect ?? Boolean(body.openclaw),
    });
  } finally {
    deps.broadcastExecutorStatus();
  }

  await deps.queueManagedExecutorSync("executor.patch");
  return deps.getExecutorSnapshotConfig();
}
