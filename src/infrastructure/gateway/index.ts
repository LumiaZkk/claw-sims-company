import { backendManager } from "./runtime/manager";
import { getBackendProviderDefinition } from "./runtime/providers";

export { backendManager };
export const backend = backendManager;
export const gateway = backendManager;
export const listBackendProviders = () => backendManager.listProviders();
export const getActiveBackendProviderId = () => backendManager.providerId;
export const getActiveBackendProvider = () =>
  getBackendProviderDefinition(backendManager.providerId);
export const getActiveBackendCapabilities = () => backendManager.capabilities;
export const setActiveBackendProvider = (providerId: string) =>
  backendManager.setActiveProvider(providerId);

export type * from "./runtime/types";
export type * from "./runtime/providers";
export type * from "./openclaw/client";
export type * from "./openclaw/types";
export * from "./runtime/bootstrap";
export * from "./runtime/core-adapter";
export * from "./runtime/runtime";
export * from "./runtime/virtual-actor";
