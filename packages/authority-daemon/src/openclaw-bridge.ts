import { WebSocket } from "ws";
import type {
  AuthorityExecutorConnectionState,
  AuthorityExecutorStatus,
} from "../../../src/infrastructure/authority/contract";

type OpenClawBridgeConfig = {
  type: "openclaw";
  openclaw: {
    url: string;
    token?: string;
  };
  connectionState?: AuthorityExecutorConnectionState;
  lastError?: string | null;
  lastConnectedAt?: number | null;
};

type OpenClawExecutorBridgeOptions = {
  resolveFallbackToken?: () => string | undefined;
};

type GatewayEventFrame = {
  type: "event";
  event: string;
  payload?: unknown;
};

type GatewayResponseFrame = {
  type: "res";
  id: string;
  ok: boolean;
  payload?: unknown;
  error?: {
    code?: string;
    message?: string;
    details?: unknown;
  };
};

type Pending = {
  resolve: (value: unknown) => void;
  reject: (error: unknown) => void;
};

const CONNECT_TIMEOUT_MS = 8_000;
const GATEWAY_PROTOCOL_VERSION = 3;
const GATEWAY_CLIENT_ID = "gateway-client";
const GATEWAY_CLIENT_MODE = "backend";

function normalizeWsUrl(url: string) {
  const trimmed = url.trim().replace(/\/+$/, "");
  if (trimmed.startsWith("http://")) {
    return `ws://${trimmed.slice("http://".length)}`;
  }
  if (trimmed.startsWith("https://")) {
    return `wss://${trimmed.slice("https://".length)}`;
  }
  if (trimmed.startsWith("ws://") || trimmed.startsWith("wss://")) {
    return trimmed;
  }
  return `ws://${trimmed}`;
}

function toErrorMessage(error: unknown) {
  const raw = error instanceof Error ? error.message : String(error);
  if (raw.includes("device identity required")) {
    return "OpenClaw 需要设备身份或共享 token。请在设置页的 Authority 执行后端填写 OpenClaw token，或在启动前导出 OPENCLAW_GATEWAY_TOKEN。";
  }
  return raw;
}

class OpenClawExecutorBridge {
  private config: OpenClawBridgeConfig;
  private socket: WebSocket | null = null;
  private connectPromise: Promise<void> | null = null;
  private readonly pending = new Map<string, Pending>();
  private readonly eventHandlers = new Set<(event: GatewayEventFrame) => void>();
  private readonly stateHandlers = new Set<() => void>();

  constructor(
    initialConfig: OpenClawBridgeConfig,
    private readonly options: OpenClawExecutorBridgeOptions = {},
  ) {
    this.config = {
      ...initialConfig,
      connectionState: initialConfig.connectionState ?? "idle",
      lastError: initialConfig.lastError ?? null,
      lastConnectedAt: initialConfig.lastConnectedAt ?? null,
      openclaw: {
        url: initialConfig.openclaw.url,
        token: initialConfig.openclaw.token ?? "",
      },
    };
  }

  snapshot(): OpenClawBridgeConfig {
    return {
      ...this.config,
      openclaw: {
        url: this.config.openclaw.url,
        token: this.config.openclaw.token ?? "",
      },
    };
  }

  status(): AuthorityExecutorStatus {
    const state =
      this.config.connectionState === "ready"
        ? "ready"
        : this.config.connectionState === "blocked"
          ? "blocked"
          : "degraded";
    return {
      adapter: "openclaw-bridge",
      state,
      provider: this.config.connectionState === "ready" ? "openclaw" : "none",
      note:
        this.config.connectionState === "ready"
          ? "Authority 已接入 OpenClaw。"
          : this.config.lastError ?? "Authority 尚未接入 OpenClaw。",
    };
  }

  onEvent(handler: (event: GatewayEventFrame) => void) {
    this.eventHandlers.add(handler);
    return () => {
      this.eventHandlers.delete(handler);
    };
  }

  onStateChange(handler: () => void) {
    this.stateHandlers.add(handler);
    return () => {
      this.stateHandlers.delete(handler);
    };
  }

  async patchConfig(input: {
    openclaw?: { url?: string; token?: string };
    reconnect?: boolean;
  }) {
    const nextUrl = input.openclaw?.url?.trim() || this.config.openclaw.url;
    const nextToken =
      input.openclaw?.token !== undefined
        ? input.openclaw.token
        : (this.config.openclaw.token ?? "");
    const changed =
      nextUrl !== this.config.openclaw.url
      || nextToken !== (this.config.openclaw.token ?? "");
    this.config = {
      ...this.config,
      openclaw: {
        url: nextUrl,
        token: nextToken,
      },
    };
    if (changed || input.reconnect) {
      await this.reconnect();
      return;
    }
    this.emitStateChange();
  }

  async reconnect() {
    this.disconnect();
    await this.ensureConnected();
  }

  disconnect() {
    const socket = this.socket;
    this.socket = null;
    this.connectPromise = null;
    if (socket) {
      socket.removeAllListeners();
      try {
        socket.close();
      } catch {
        // noop
      }
    }
    this.flushPending(new Error("OpenClaw executor disconnected"));
    const nextState = this.config.openclaw.url.trim().length > 0 ? "degraded" : "blocked";
    this.updateState(
      nextState,
      nextState === "blocked" ? "OpenClaw 地址未配置。" : (this.config.lastError ?? null),
    );
  }

  async request<T = unknown>(method: string, params?: unknown): Promise<T> {
    await this.ensureConnected();
    const socket = this.socket;
    if (!socket || socket.readyState !== WebSocket.OPEN) {
      throw new Error("OpenClaw executor is not connected.");
    }
    return this.sendRequest<T>(socket, method, params);
  }

  private async ensureConnected() {
    if (this.socket && this.socket.readyState === WebSocket.OPEN && this.config.connectionState === "ready") {
      return;
    }
    if (!this.config.openclaw.url.trim()) {
      this.updateState("blocked", "OpenClaw 地址未配置。");
      throw new Error("OpenClaw 地址未配置。");
    }
    if (this.connectPromise) {
      return this.connectPromise;
    }

    this.updateState("connecting", null);
    this.connectPromise = new Promise<void>((resolve, reject) => {
      const socket = new WebSocket(normalizeWsUrl(this.config.openclaw.url));
      let settled = false;
      let connectTimer: NodeJS.Timeout | null = null;
      let connectRequested = false;

      const cleanupTimer = () => {
        if (connectTimer) {
          clearTimeout(connectTimer);
          connectTimer = null;
        }
      };

      const fail = (error: unknown) => {
        const message = toErrorMessage(error);
        cleanupTimer();
        if (!settled) {
          settled = true;
          reject(error);
        }
        if (this.socket === socket) {
          this.socket = null;
        }
        try {
          socket.close();
        } catch {
          // noop
        }
        this.flushPending(error);
        this.updateState("degraded", message);
      };

      socket.on("open", () => {
        this.socket = socket;
      });

      socket.on("message", (data) => {
        const raw = String(data);
        let parsed: GatewayEventFrame | GatewayResponseFrame | null = null;
        try {
          parsed = JSON.parse(raw) as GatewayEventFrame | GatewayResponseFrame;
        } catch {
          return;
        }
        if (!parsed) {
          return;
        }
        if (
          !settled
          && !connectRequested
          && parsed.type === "event"
          && parsed.event === "connect.challenge"
        ) {
          const authToken =
            this.config.openclaw.token?.trim()
            || this.options.resolveFallbackToken?.();
          connectRequested = true;
          void this.sendRequest(socket, "connect", {
            minProtocol: GATEWAY_PROTOCOL_VERSION,
            maxProtocol: GATEWAY_PROTOCOL_VERSION,
            client: {
              id: GATEWAY_CLIENT_ID,
              version: "1.0.0",
              platform: process.platform,
              mode: GATEWAY_CLIENT_MODE,
            },
            role: "operator",
            scopes: ["operator.admin", "operator.approvals", "operator.pairing"],
            caps: [],
            auth: authToken
              ? { token: authToken }
              : undefined,
            userAgent: "cyber-company-authority-daemon",
            locale: "zh-CN",
          })
            .then(() => {
              cleanupTimer();
              this.config.lastConnectedAt = Date.now();
              this.updateState("ready", null);
              if (!settled) {
                settled = true;
                resolve();
              }
            })
            .catch((error) => {
              fail(error);
            });
          return;
        }
        this.handleFrame(parsed);
      });

      socket.on("close", (code, reasonBuffer) => {
        cleanupTimer();
        const reason = String(reasonBuffer ?? "");
        if (!settled) {
          settled = true;
          reject(new Error(`OpenClaw executor closed during connect (${code}): ${reason}`));
        }
        if (this.socket === socket) {
          this.socket = null;
        }
        this.flushPending(new Error(`OpenClaw executor closed (${code}): ${reason}`));
        this.updateState(
          this.config.openclaw.url.trim().length > 0 ? "degraded" : "blocked",
          reason || "OpenClaw executor disconnected",
        );
      });

      socket.on("error", (error) => {
        fail(error);
      });

      connectTimer = setTimeout(() => {
        fail(new Error("连接 OpenClaw 超时。"));
      }, CONNECT_TIMEOUT_MS);
    }).finally(() => {
      this.connectPromise = null;
    });

    return this.connectPromise;
  }

  private handleFrame(parsed: GatewayEventFrame | GatewayResponseFrame) {
    if (parsed.type === "event") {
      if (parsed.event === "connect.challenge") {
        return;
      }
      for (const handler of this.eventHandlers) {
        handler(parsed);
      }
      return;
    }
    if (parsed.type !== "res") {
      return;
    }
    const pending = this.pending.get(parsed.id);
    if (!pending) {
      return;
    }
    this.pending.delete(parsed.id);
    if (parsed.ok) {
      pending.resolve(parsed.payload);
      return;
    }
    pending.reject(new Error(toErrorMessage(parsed.error?.message ?? "OpenClaw request failed")));
  }

  private sendRequest<T>(socket: WebSocket, method: string, params?: unknown): Promise<T> {
    if (socket.readyState !== WebSocket.OPEN) {
      return Promise.reject(new Error("OpenClaw executor socket is not open."));
    }
    const id = crypto.randomUUID();
    const frame = JSON.stringify({
      type: "req",
      id,
      method,
      params,
    });
    const promise = new Promise<T>((resolve, reject) => {
      this.pending.set(id, { resolve: (value) => resolve(value as T), reject });
    });
    socket.send(frame);
    return promise;
  }

  private flushPending(error: unknown) {
    for (const [, pending] of this.pending) {
      pending.reject(error);
    }
    this.pending.clear();
  }

  private updateState(state: AuthorityExecutorConnectionState, lastError: string | null) {
    this.config.connectionState = state;
    this.config.lastError = state === "ready" ? null : lastError;
    this.emitStateChange();
  }

  private emitStateChange() {
    for (const handler of this.stateHandlers) {
      handler();
    }
  }
}

export function createOpenClawExecutorBridge(
  initialConfig: OpenClawBridgeConfig,
  options?: OpenClawExecutorBridgeOptions,
) {
  return new OpenClawExecutorBridge(initialConfig, options);
}
