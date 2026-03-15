import { WebSocket } from "ws";
import type {
  AuthorityExecutorConnectionState,
  AuthorityExecutorStatus,
} from "../../../../src/infrastructure/authority/contract";
import {
  buildDeviceAuthPayloadV3,
  clearLocalOpenClawDeviceAuthToken,
  loadLocalOpenClawDeviceAuthToken,
  loadOrCreateLocalOpenClawDeviceIdentity,
  publicKeyRawBase64UrlFromPem,
  signDevicePayload,
  storeLocalOpenClawDeviceAuthToken,
  type LocalOpenClawDeviceAuthEntry,
  type LocalOpenClawDeviceIdentity,
} from "./openclaw-device-auth";

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
  loadDeviceIdentity?: () => LocalOpenClawDeviceIdentity | null;
  loadStoredDeviceToken?: (params: {
    deviceId: string;
    role: string;
  }) => LocalOpenClawDeviceAuthEntry | null;
  storeDeviceToken?: (params: {
    deviceId: string;
    role: string;
    token: string;
    scopes?: string[];
  }) => LocalOpenClawDeviceAuthEntry;
  clearDeviceToken?: (params: { deviceId: string; role: string }) => void;
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

type GatewayHelloOk = {
  auth?: {
    deviceToken?: string;
    role?: string;
    scopes?: string[];
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
const RECONNECT_BASE_DELAY_MS = 500;
const RECONNECT_MAX_DELAY_MS = 10_000;
const REQUESTED_OPERATOR_SCOPES = [
  "operator.read",
  "operator.admin",
  "operator.approvals",
  "operator.pairing",
] as const;
const REQUIRED_OPERATOR_SCOPES = [
  "operator.read",
  "operator.admin",
] as const;

function hasGrantedOperatorScope(granted: Set<string>, requiredScope: (typeof REQUIRED_OPERATOR_SCOPES)[number]) {
  if (granted.has("operator.admin")) {
    return true;
  }
  if (requiredScope === "operator.read") {
    return granted.has("operator.read") || granted.has("operator.write");
  }
  return granted.has(requiredScope);
}

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
  if (raw.includes("pairing required")) {
    return "Authority 首次接入 OpenClaw 需要先完成本机设备授权。请保留可用的 shared token 重试一次，或先用 OpenClaw CLI/控制台完成本机设备配对。";
  }
  return raw;
}

export function describeMissingScopes(grantedScopes: string[] | null | undefined) {
  const granted = new Set((grantedScopes ?? []).filter((scope) => typeof scope === "string"));
  const missing = REQUIRED_OPERATOR_SCOPES.filter((scope) => !hasGrantedOperatorScope(granted, scope));
  if (missing.length === 0) {
    return null;
  }
  return `OpenClaw 未授予 Authority 必需权限：${missing.join(", ")}。请为当前连接配置带 operator scope 的 gateway token。`;
}

export function classifyExecutorReconnect(message: string | null | undefined): {
  state: AuthorityExecutorConnectionState;
  shouldRetry: boolean;
} {
  const normalized = (message ?? "").trim().toLowerCase();
  if (!normalized) {
    return { state: "degraded", shouldRetry: true };
  }

  const blockedPatterns = [
    "地址未配置",
    "device identity required",
    "共享 token",
    "unauthorized",
    "forbidden",
    "auth failed",
    "authentication failed",
    "invalid token",
    "token required",
    "connect failed",
  ];
  if (blockedPatterns.some((pattern) => normalized.includes(pattern.toLowerCase()))) {
    return { state: "blocked", shouldRetry: false };
  }
  return { state: "degraded", shouldRetry: true };
}

export function computeReconnectDelayMs(attempt: number) {
  const normalizedAttempt = Math.max(0, Math.floor(attempt));
  return Math.min(RECONNECT_MAX_DELAY_MS, RECONNECT_BASE_DELAY_MS * (2 ** normalizedAttempt));
}

class OpenClawExecutorBridge {
  private config: OpenClawBridgeConfig;
  private socket: WebSocket | null = null;
  private connectPromise: Promise<void> | null = null;
  private reconnectTimer: NodeJS.Timeout | null = null;
  private reconnectAttempt = 0;
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

  private loadDeviceIdentity() {
    return this.options.loadDeviceIdentity?.() ?? loadOrCreateLocalOpenClawDeviceIdentity();
  }

  private loadStoredDeviceToken(role: string, deviceId: string) {
    return this.options.loadStoredDeviceToken?.({ deviceId, role })
      ?? loadLocalOpenClawDeviceAuthToken({ deviceId, role });
  }

  private storeDeviceToken(params: {
    deviceId: string;
    role: string;
    token: string;
    scopes?: string[];
  }) {
    return this.options.storeDeviceToken?.(params)
      ?? storeLocalOpenClawDeviceAuthToken(params);
  }

  private clearDeviceToken(params: { deviceId: string; role: string }) {
    this.options.clearDeviceToken?.(params)
      ?? clearLocalOpenClawDeviceAuthToken(params);
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
    this.clearReconnectTimer(true);
    this.disconnect();
    await this.ensureConnected();
  }

  disconnect() {
    this.clearReconnectTimer(true);
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
      let terminated = false;
      let connectTimer: NodeJS.Timeout | null = null;
      let connectRequested = false;

      const cleanupTimer = () => {
        if (connectTimer) {
          clearTimeout(connectTimer);
          connectTimer = null;
        }
      };

      const fail = (error: unknown, override?: { state?: AuthorityExecutorConnectionState; retry?: boolean }) => {
        if (terminated) {
          return;
        }
        terminated = true;
        const message = toErrorMessage(error);
        const classified = classifyExecutorReconnect(message);
        const nextState = override?.state ?? classified.state;
        const shouldRetry = override?.retry ?? classified.shouldRetry;
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
        this.updateState(nextState, message);
        if (shouldRetry) {
          this.scheduleReconnect(message);
        }
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
          const role = "operator";
          const identity = this.loadDeviceIdentity();
          const storedDeviceToken = identity
            ? this.loadStoredDeviceToken(role, identity.deviceId)
            : null;
          const authToken =
            this.config.openclaw.token?.trim()
            || this.options.resolveFallbackToken?.();
          const resolvedAuthToken = authToken || storedDeviceToken?.token;
          const nonce = (() => {
            const value = parsed.payload;
            if (!value || typeof value !== "object" || !("nonce" in value)) {
              return "";
            }
            return typeof value.nonce === "string" ? value.nonce.trim() : "";
          })();
          const signedAtMs = Date.now();
          const device = identity && nonce
            ? (() => {
                const payload = buildDeviceAuthPayloadV3({
                  deviceId: identity.deviceId,
                  clientId: GATEWAY_CLIENT_ID,
                  clientMode: GATEWAY_CLIENT_MODE,
                  role,
                  scopes: [...REQUESTED_OPERATOR_SCOPES],
                  signedAtMs,
                  token: resolvedAuthToken ?? null,
                  nonce,
                  platform: process.platform,
                });
                return {
                  id: identity.deviceId,
                  publicKey: publicKeyRawBase64UrlFromPem(identity.publicKeyPem),
                  signature: signDevicePayload(identity.privateKeyPem, payload),
                  signedAt: signedAtMs,
                  nonce,
                };
              })()
            : undefined;
          connectRequested = true;
          void this.sendRequest<GatewayHelloOk>(socket, "connect", {
            minProtocol: GATEWAY_PROTOCOL_VERSION,
            maxProtocol: GATEWAY_PROTOCOL_VERSION,
            client: {
              id: GATEWAY_CLIENT_ID,
              version: "1.0.0",
              platform: process.platform,
              mode: GATEWAY_CLIENT_MODE,
            },
            role,
            scopes: [...REQUESTED_OPERATOR_SCOPES],
            device,
            caps: [],
            auth: resolvedAuthToken
              ? { token: resolvedAuthToken }
              : undefined,
            userAgent: "cyber-company-authority-daemon",
            locale: "zh-CN",
          })
            .then((hello) => {
              if (hello?.auth?.deviceToken && identity) {
                this.storeDeviceToken({
                  deviceId: identity.deviceId,
                  role: hello.auth.role ?? role,
                  token: hello.auth.deviceToken,
                  scopes: hello.auth.scopes ?? [...REQUESTED_OPERATOR_SCOPES],
                });
              }
              const missingScopeMessage = describeMissingScopes(hello?.auth?.scopes);
              if (missingScopeMessage) {
                fail(new Error(missingScopeMessage), { state: "blocked", retry: false });
                return;
              }
              cleanupTimer();
              this.clearReconnectTimer(true);
              this.config.lastConnectedAt = Date.now();
              this.updateState("ready", null);
              if (!settled) {
                settled = true;
                resolve();
              }
            })
            .catch((error) => {
              if (!authToken && storedDeviceToken && identity) {
                const errorMessage = error instanceof Error ? error.message : String(error);
                if (errorMessage.toLowerCase().includes("unauthorized")) {
                  this.clearDeviceToken({ deviceId: identity.deviceId, role });
                }
              }
              fail(error);
            });
          return;
        }
        this.handleFrame(parsed);
      });

      socket.on("close", (code, reasonBuffer) => {
        if (terminated) {
          return;
        }
        terminated = true;
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
        const detail = reason || "OpenClaw executor disconnected";
        const classified = classifyExecutorReconnect(detail);
        this.updateState(
          this.config.openclaw.url.trim().length > 0 ? classified.state : "blocked",
          detail,
        );
        if (this.config.openclaw.url.trim().length > 0 && classified.shouldRetry) {
          this.scheduleReconnect(detail);
        }
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

  private scheduleReconnect(reason: string | null) {
    if (this.reconnectTimer || !this.config.openclaw.url.trim()) {
      return;
    }
    const { shouldRetry } = classifyExecutorReconnect(reason);
    if (!shouldRetry) {
      return;
    }
    const delayMs = computeReconnectDelayMs(this.reconnectAttempt);
    this.reconnectAttempt += 1;
    this.reconnectTimer = setTimeout(() => {
      this.reconnectTimer = null;
      void this.ensureConnected().catch(() => {
        // The bridge state is already updated inside ensureConnected; keep retrying in background.
      });
    }, delayMs);
  }

  private clearReconnectTimer(resetAttempts: boolean) {
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
    if (resetAttempts) {
      this.reconnectAttempt = 0;
    }
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
