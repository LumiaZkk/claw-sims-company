import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

type MockGateway = {
  providerId: string;
  stageConnectionDraft: ReturnType<typeof vi.fn>;
  connect: ReturnType<typeof vi.fn>;
  disconnect: ReturnType<typeof vi.fn>;
  onHello: ReturnType<typeof vi.fn>;
  onClose: ReturnType<typeof vi.fn>;
  probeCapabilities: ReturnType<typeof vi.fn>;
};

function createStorageMock() {
  const data = new Map<string, string>();
  return {
    getItem: (key: string) => data.get(key) ?? null,
    setItem: (key: string, value: string) => {
      data.set(key, value);
    },
    removeItem: (key: string) => {
      data.delete(key);
    },
    clear: () => {
      data.clear();
    },
  };
}

async function loadGatewayStore(input?: { hasEverConnected?: boolean }) {
  vi.resetModules();

  const gateway: MockGateway = {
    providerId: "authority",
    stageConnectionDraft: vi.fn(),
    connect: vi.fn(),
    disconnect: vi.fn(),
    onHello: vi.fn(),
    onClose: vi.fn(),
    probeCapabilities: vi.fn().mockResolvedValue({
      sessionHistory: true,
      sessionArchives: true,
      agentFiles: true,
    }),
  };
  const capabilities = {
    sessionHistory: true,
    sessionArchives: true,
    agentFiles: true,
  };
  const provider = {
    id: "authority",
    label: "Authority",
    description: "Authority control plane",
    defaultUrl: "http://127.0.0.1:18790",
    urlLabel: "Authority 地址",
    tokenLabel: "访问令牌",
    tokenOptional: true,
  };

  if (input?.hasEverConnected ?? true) {
    globalThis.localStorage?.setItem("cyber_company_gateway_connected_once", "1");
  }

  vi.doMock("./index", () => ({
    gateway,
    buildProviderManifest: ({
      providerId,
      capabilities: nextCapabilities,
    }: {
      providerId: string;
      capabilities: typeof capabilities;
    }) => ({
      providerId,
      capabilities: nextCapabilities,
      actorStrategy: "native-multi-actor",
      roomStrategy: "authority",
      archiveStrategy: "native",
      storageStrategy: "managed",
      notes: [],
    }),
    getActiveBackendCapabilities: () => capabilities,
    getActiveBackendProvider: () => provider,
    getActiveBackendProviderId: () => provider.id,
    listBackendProviders: () => [provider],
    setActiveBackendProvider: vi.fn(),
  }));

  const module = await import("./store");
  return {
    useGatewayStore: module.useGatewayStore,
    gateway,
  };
}

describe("useGatewayStore stageConnectionDraft", () => {
  const originalLocalStorage = globalThis.localStorage;

  beforeEach(() => {
    Object.defineProperty(globalThis, "localStorage", {
      configurable: true,
      value: createStorageMock(),
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.resetModules();
    Object.defineProperty(globalThis, "localStorage", {
      configurable: true,
      value: originalLocalStorage,
    });
  });

  it("stops stale reconnect state when a disconnected draft endpoint is edited", async () => {
    const { useGatewayStore, gateway } = await loadGatewayStore({ hasEverConnected: true });
    gateway.stageConnectionDraft.mockClear();
    gateway.disconnect.mockClear();
    useGatewayStore.setState({
      connected: false,
      connecting: true,
      phase: "reconnecting",
      reconnectAttempts: 2,
      autoReconnect: true,
      lastCloseReason: "socket closed",
      error: "old endpoint failed",
      connectError: {
        type: "gateway_unavailable",
        title: "连接失败",
        message: "旧 authority 已断开",
        debug: "ECONNREFUSED",
        steps: [],
      },
    });

    useGatewayStore.getState().stageConnectionDraft(" http://127.0.0.1:18898 ", " next-token ");

    expect(gateway.disconnect).toHaveBeenCalledTimes(1);
    expect(gateway.stageConnectionDraft).toHaveBeenCalledWith(
      "http://127.0.0.1:18898",
      "next-token",
    );
    expect(globalThis.localStorage.getItem("cyber_company_backend_url__authority")).toBe(
      "http://127.0.0.1:18898",
    );
    expect(globalThis.localStorage.getItem("cyber_company_backend_token__authority")).toBe(
      "next-token",
    );
    expect(useGatewayStore.getState()).toMatchObject({
      url: "http://127.0.0.1:18898",
      token: "next-token",
      connecting: false,
      phase: "offline",
      reconnectAttempts: 0,
      autoReconnect: false,
      lastCloseReason: null,
      error: null,
      connectError: null,
    });
  });

  it("keeps the active connection intact when staging a draft during a live session", async () => {
    const { useGatewayStore, gateway } = await loadGatewayStore({ hasEverConnected: true });
    gateway.stageConnectionDraft.mockClear();
    gateway.disconnect.mockClear();
    useGatewayStore.setState({
      connected: true,
      connecting: false,
      phase: "connected",
      hello: { backend: "authority" } as never,
      autoReconnect: true,
    });

    useGatewayStore.getState().stageConnectionDraft("http://127.0.0.1:18899", "draft-token");

    expect(gateway.disconnect).not.toHaveBeenCalled();
    expect(gateway.stageConnectionDraft).not.toHaveBeenCalled();
    expect(useGatewayStore.getState()).toMatchObject({
      connected: true,
      phase: "connected",
      hello: { backend: "authority" },
      url: "http://127.0.0.1:18899",
      token: "draft-token",
      autoReconnect: false,
    });
  });

  it("syncs the stored provider draft into the backend adapter on initial load", async () => {
    globalThis.localStorage?.setItem("cyber_company_backend_provider", "authority");
    globalThis.localStorage?.setItem("cyber_company_backend_url__authority", "http://127.0.0.1:19903");
    globalThis.localStorage?.setItem("cyber_company_backend_token__authority", "boot-token");

    const { useGatewayStore, gateway } = await loadGatewayStore({ hasEverConnected: true });

    expect(gateway.stageConnectionDraft).toHaveBeenCalledWith(
      "http://127.0.0.1:19903",
      "boot-token",
    );
    expect(useGatewayStore.getState()).toMatchObject({
      url: "http://127.0.0.1:19903",
      token: "boot-token",
    });
  });
});
