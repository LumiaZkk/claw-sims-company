import { getDefaultGatewayUrl } from "../../../lib/utils";
import { authorityBackend } from "../authority/adapter";
import { openClawBackend } from "../openclaw/adapter";
import { createAgentBackendFromCore } from "./core-adapter";
import type { AgentBackend, BackendCore } from "./types";
import { DEFAULT_AUTHORITY_URL } from "../../authority/contract";

export type BackendProviderMeta = {
  id: string;
  label: string;
  description: string;
  urlLabel: string;
  tokenLabel: string;
  tokenOptional: boolean;
  defaultUrl: string;
  tokenPlaceholder: string;
  connectHint: string;
};

export type BackendProviderDefinition = BackendProviderMeta & {
  backend: AgentBackend;
};

export function createBackendProviderFromCore(
  meta: BackendProviderMeta,
  core: BackendCore,
): BackendProviderDefinition {
  return {
    ...meta,
    backend: createAgentBackendFromCore(core),
  };
}

export const backendProviders: BackendProviderDefinition[] = [
  {
    id: "openclaw",
    label: "OpenClaw",
    description: "通过 OpenClaw Gateway 连接真实多 Agent 运行时。",
    urlLabel: "Gateway 地址",
    tokenLabel: "访问令牌",
    tokenOptional: true,
    defaultUrl: getDefaultGatewayUrl(),
    tokenPlaceholder: "本地启动时通常可以留空",
    connectHint: "openclaw serve",
    backend: openClawBackend,
  },
  {
    id: "authority",
    label: "Authority",
    description: "连接本机 companion daemon，读取 SQLite 权威源并调度本地执行器。",
    urlLabel: "Authority 地址",
    tokenLabel: "访问令牌",
    tokenOptional: true,
    defaultUrl: DEFAULT_AUTHORITY_URL,
    tokenPlaceholder: "本机 authority 默认无需额外令牌",
    connectHint: "npm run authority:dev",
    backend: authorityBackend,
  },
];

export function getDefaultBackendProviderId(): string {
  return backendProviders[0]?.id ?? "openclaw";
}

export function getBackendProviderDefinition(providerId: string): BackendProviderDefinition {
  return (
    backendProviders.find((provider) => provider.id === providerId)
    ?? backendProviders[0]
  );
}

export function listBackendProviderMeta(): BackendProviderMeta[] {
  return backendProviders.map((provider) => ({
    id: provider.id,
    label: provider.label,
    description: provider.description,
    urlLabel: provider.urlLabel,
    tokenLabel: provider.tokenLabel,
    tokenOptional: provider.tokenOptional,
    defaultUrl: provider.defaultUrl,
    tokenPlaceholder: provider.tokenPlaceholder,
    connectHint: provider.connectHint,
  }));
}
