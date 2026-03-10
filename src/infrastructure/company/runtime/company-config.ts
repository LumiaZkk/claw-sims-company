import {
  deleteCompanyCascade,
  loadCompanyConfig,
  saveCompanyConfig,
  setPersistedActiveCompanyId,
} from "../persistence/persistence";
import type {
  Company,
  CompanyRuntimeState,
  HandoffRecord,
  RequestRecord,
  SharedKnowledgeItem,
  TrackedTask,
} from "./types";
import { createEmptyProductState, loadProductState } from "./bootstrap";
import { persistActiveConversationStates } from "./conversation-state";
import { persistActiveWorkItems } from "./work-items";

type RuntimeSet = (partial: Partial<CompanyRuntimeState>) => void;
type RuntimeGet = () => CompanyRuntimeState;

function upsertTimestampedRecord<T extends { id: string; updatedAt: number }>(
  existingItems: T[],
  incomingItem: T,
): T[] | null {
  const index = existingItems.findIndex((item) => item.id === incomingItem.id);
  if (index >= 0) {
    const existing = existingItems[index];
    if (incomingItem.updatedAt <= existing.updatedAt) {
      return null;
    }
    const next = [...existingItems];
    next[index] = { ...existing, ...incomingItem };
    return next;
  }
  return [...existingItems, incomingItem];
}

export function buildCompanyConfigActions(
  set: RuntimeSet,
  get: RuntimeGet,
): Pick<
  CompanyRuntimeState,
  | "loadConfig"
  | "saveConfig"
  | "switchCompany"
  | "deleteCompany"
  | "updateCompany"
  | "upsertTask"
  | "upsertHandoff"
  | "upsertRequest"
  | "upsertKnowledgeItem"
> {
  return {
    loadConfig: async () => {
      set({ loading: true, error: null, bootstrapPhase: "restoring" });
      try {
        const config = await loadCompanyConfig();
        if (config) {
          const active = config.companies.find((c) => c.id === config.activeCompanyId) || null;
          const state = active ? loadProductState(active.id) : createEmptyProductState();
          set({
            config,
            activeCompany: active,
            activeRoomRecords: state.loadedRooms,
            activeMissionRecords: state.loadedMissions,
            activeConversationStates: state.loadedConversationStates,
            activeWorkItems: state.loadedWorkItems,
            activeRoundRecords: state.loadedRounds,
            activeArtifacts: state.loadedArtifacts,
            activeDispatches: state.loadedDispatches,
            activeRoomBindings: state.loadedRoomBindings,
            loading: false,
            bootstrapPhase: active ? "ready" : "missing",
          });
          if (active) {
            persistActiveWorkItems(active.id, state.loadedWorkItems);
          }
          return;
        }
        set({
          config: null,
          activeCompany: null,
          activeRoomRecords: [],
          activeMissionRecords: [],
          activeConversationStates: [],
          activeWorkItems: [],
          activeRoundRecords: [],
          activeArtifacts: [],
          activeDispatches: [],
          activeRoomBindings: [],
          loading: false,
          bootstrapPhase: "missing",
        });
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        set({
          error: message,
          activeRoomRecords: [],
          activeMissionRecords: [],
          activeConversationStates: [],
          activeWorkItems: [],
          activeRoundRecords: [],
          activeArtifacts: [],
          activeDispatches: [],
          activeRoomBindings: [],
          loading: false,
          bootstrapPhase: "error",
        });
      }
    },

    saveConfig: async () => {
      const { config } = get();
      if (!config) {
        return;
      }

      set({ loading: true, error: null });
      try {
        const success = await saveCompanyConfig(config);
        if (!success) {
          set({ error: "Failed to persist configuration" });
        }
        set({ loading: false });
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        set({ error: message, loading: false });
      }
    },

    switchCompany: (id: string) => {
      const { config } = get();
      if (!config) {
        return;
      }

      const company = config.companies.find((c) => c.id === id);
      if (!company) {
        return;
      }

      const newConfig = { ...config, activeCompanyId: id };
      const state = loadProductState(company.id);
      setPersistedActiveCompanyId(id);
      set({
        config: newConfig,
        activeCompany: company,
        activeRoomRecords: state.loadedRooms,
        activeMissionRecords: state.loadedMissions,
        activeConversationStates: state.loadedConversationStates,
        activeWorkItems: state.loadedWorkItems,
        activeRoundRecords: state.loadedRounds,
        activeArtifacts: state.loadedArtifacts,
        activeDispatches: state.loadedDispatches,
        activeRoomBindings: state.loadedRoomBindings,
        bootstrapPhase: "ready",
      });
      persistActiveWorkItems(company.id, state.loadedWorkItems);
      persistActiveConversationStates(company.id, state.loadedConversationStates);
      void get().saveConfig();
    },

    deleteCompany: async (id: string) => {
      const { config } = get();
      if (!config) {
        return;
      }

      set({ loading: true, error: null });
      try {
        const nextConfig = await deleteCompanyCascade(config, id);
        const nextActiveCompany =
          nextConfig?.companies.find((company) => company.id === nextConfig.activeCompanyId) ?? null;
        const nextState = nextActiveCompany ? loadProductState(nextActiveCompany.id) : createEmptyProductState();

        set({
          config: nextConfig,
          activeCompany: nextActiveCompany,
          activeRoomRecords: nextState.loadedRooms,
          activeMissionRecords: nextState.loadedMissions,
          activeConversationStates: nextState.loadedConversationStates,
          activeWorkItems: nextState.loadedWorkItems,
          activeRoundRecords: nextState.loadedRounds,
          activeArtifacts: nextState.loadedArtifacts,
          activeDispatches: nextState.loadedDispatches,
          activeRoomBindings: nextState.loadedRoomBindings,
          loading: false,
          bootstrapPhase: nextActiveCompany ? "ready" : "missing",
        });

        if (nextActiveCompany) {
          persistActiveWorkItems(nextActiveCompany.id, nextState.loadedWorkItems);
          persistActiveConversationStates(nextActiveCompany.id, nextState.loadedConversationStates);
        }
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        set({ error: message, loading: false });
        throw error;
      }
    },

    updateCompany: async (updates: Partial<Company>) => {
      const { config, activeCompany } = get();
      if (!config || !activeCompany) {
        return;
      }

      const newCompany = { ...activeCompany, ...updates };
      const newCompanies = config.companies.map((c) => (c.id === activeCompany.id ? newCompany : c));
      set({ config: { ...config, companies: newCompanies }, activeCompany: newCompany });
      await get().saveConfig();
    },

    upsertTask: async (task: TrackedTask) => {
      const { activeCompany } = get();
      if (!activeCompany) {
        return;
      }
      const existingTasks = activeCompany.tasks ?? [];
      const index = existingTasks.findIndex((item) => item.sessionKey === task.sessionKey);
      const nextTasks =
        index >= 0
          ? (() => {
              const existing = existingTasks[index];
              if (task.updatedAt <= existing.updatedAt) {
                return null;
              }
              const next = [...existingTasks];
              next[index] = { ...existing, ...task };
              return next;
            })()
          : [...existingTasks, task];
      if (!nextTasks) {
        return;
      }
      await get().updateCompany({ tasks: nextTasks });
    },

    upsertHandoff: async (handoff: HandoffRecord) => {
      const { activeCompany } = get();
      if (!activeCompany) {
        return;
      }
      const nextHandoffs = upsertTimestampedRecord(activeCompany.handoffs ?? [], handoff);
      if (!nextHandoffs) {
        return;
      }
      await get().updateCompany({ handoffs: nextHandoffs });
    },

    upsertRequest: async (request: RequestRecord) => {
      const { activeCompany } = get();
      if (!activeCompany) {
        return;
      }
      const nextRequests = upsertTimestampedRecord(activeCompany.requests ?? [], request);
      if (!nextRequests) {
        return;
      }
      await get().updateCompany({ requests: nextRequests });
    },

    upsertKnowledgeItem: async (knowledgeItem: SharedKnowledgeItem) => {
      const { activeCompany } = get();
      if (!activeCompany) {
        return;
      }
      const nextItems = upsertTimestampedRecord(activeCompany.knowledgeItems ?? [], knowledgeItem);
      if (!nextItems) {
        return;
      }
      await get().updateCompany({ knowledgeItems: nextItems });
    },
  };
}
