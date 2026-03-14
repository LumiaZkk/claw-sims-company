import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

class MockWebSocket {
  static instances: MockWebSocket[] = [];

  listeners = new Map<string, Set<(event?: unknown) => void>>();
  closed = false;
  readonly url: string;

  constructor(url: string) {
    this.url = url;
    MockWebSocket.instances.push(this);
  }

  addEventListener(type: string, handler: (event?: unknown) => void) {
    const set = this.listeners.get(type) ?? new Set();
    set.add(handler);
    this.listeners.set(type, set);
  }

  removeEventListener(type: string, handler: (event?: unknown) => void) {
    this.listeners.get(type)?.delete(handler);
  }

  emit(type: string, event?: unknown) {
    this.listeners.get(type)?.forEach((handler) => handler(event));
  }

  close() {
    this.closed = true;
    this.emit("close", { code: 1000, reason: "manual-close" });
  }
}

describe("authorityClient.connectEvents", () => {
  const originalWebSocket = globalThis.WebSocket;
  const originalLocalStorage = globalThis.localStorage;

  beforeEach(() => {
    const storage = new Map<string, string>();
    Object.defineProperty(globalThis, "localStorage", {
      configurable: true,
      value: {
        getItem: (key: string) => storage.get(key) ?? null,
        setItem: (key: string, value: string) => {
          storage.set(key, value);
        },
      },
    });
  });

  afterEach(() => {
    MockWebSocket.instances = [];
    vi.restoreAllMocks();
    globalThis.WebSocket = originalWebSocket;
    Object.defineProperty(globalThis, "localStorage", {
      configurable: true,
      value: originalLocalStorage,
    });
  });

  it("removes listeners before manual close so stale close callbacks do not fire", async () => {
    globalThis.WebSocket = MockWebSocket as unknown as typeof WebSocket;
    vi.resetModules();
    const { authorityClient } = await import("./client");
    authorityClient.setBaseUrl("http://127.0.0.1:18898");
    const onClose = vi.fn();

    const unsubscribe = authorityClient.connectEvents({
      onClose,
      onMessage: vi.fn(),
    });
    const socket = MockWebSocket.instances[0];
    expect(socket?.url).toContain("ws://127.0.0.1:18898/events");

    unsubscribe();

    expect(socket?.closed).toBe(true);
    expect(onClose).not.toHaveBeenCalled();
  });

  it("prefers the provider-scoped authority draft url from storage", async () => {
    globalThis.localStorage?.setItem("cyber_company_backend_provider", "authority");
    globalThis.localStorage?.setItem("cyber_company_backend_url__authority", "http://127.0.0.1:19901");
    globalThis.localStorage?.setItem("cyber_company_authority_url", "http://127.0.0.1:18898");

    vi.resetModules();
    const { authorityClient } = await import("./client");

    expect(authorityClient.url).toBe("http://127.0.0.1:19901");
  });

  it("writes both legacy and provider-scoped authority urls when updating the base url", async () => {
    vi.resetModules();
    const { authorityClient } = await import("./client");

    authorityClient.setBaseUrl("http://127.0.0.1:19902/");

    expect(globalThis.localStorage?.getItem("cyber_company_authority_url")).toBe(
      "http://127.0.0.1:19902",
    );
    expect(globalThis.localStorage?.getItem("cyber_company_backend_provider")).toBe("authority");
    expect(globalThis.localStorage?.getItem("cyber_company_backend_url__authority")).toBe(
      "http://127.0.0.1:19902",
    );
  });
});
