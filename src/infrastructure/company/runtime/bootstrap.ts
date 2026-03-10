import { loadArtifactRecords } from "../persistence/artifact-persistence";
import { loadConversationStateRecords } from "../persistence/conversation-state-persistence";
import { loadDispatchRecords } from "../persistence/dispatch-persistence";
import { loadConversationMissionRecords } from "../persistence/mission-persistence";
import { peekCachedCompanyConfig } from "../persistence/persistence";
import { loadRoomConversationBindings } from "../persistence/room-binding-persistence";
import { loadRequirementRoomRecords } from "../persistence/room-persistence";
import { loadRoundRecords } from "../persistence/round-persistence";
import { loadPersistedRequirementRuntimeState, reconcileActiveRequirementState } from "./requirements";
import type {
  ArtifactRecord,
  Company,
  ConversationMissionRecord,
  RequirementAggregateRecord,
  RequirementEvidenceEvent,
  ConversationStateRecord,
  DispatchRecord,
  RoomConversationBindingRecord,
  RoundRecord,
  WorkItemRecord,
} from "./types";
import { loadStoredWorkItems, syncArtifactLinks, syncDispatchLinks } from "./work-items";

export type LoadedCompanyProductState = {
  loadedRooms: ReturnType<typeof loadRequirementRoomRecords>;
  loadedMissions: ConversationMissionRecord[];
  loadedConversationStates: ConversationStateRecord[];
  loadedWorkItems: WorkItemRecord[];
  loadedRounds: RoundRecord[];
  loadedArtifacts: ArtifactRecord[];
  loadedDispatches: DispatchRecord[];
  loadedRoomBindings: RoomConversationBindingRecord[];
  loadedRequirementAggregates: RequirementAggregateRecord[];
  loadedRequirementEvidence: RequirementEvidenceEvent[];
  primaryRequirementId: string | null;
};

export function loadProductState(companyId: string): LoadedCompanyProductState {
  const loadedRooms = loadRequirementRoomRecords(companyId);
  const loadedMissions = loadConversationMissionRecords(companyId);
  const loadedConversationStates = loadConversationStateRecords(companyId);
  const loadedArtifacts = loadArtifactRecords(companyId);
  const loadedDispatches = loadDispatchRecords(companyId);
  const loadedRoomBindings = loadRoomConversationBindings(companyId);
  const loadedRounds = loadRoundRecords(companyId);
  const loadedWorkItems = loadStoredWorkItems({
    companyId,
    rooms: loadedRooms,
    artifacts: loadedArtifacts,
    dispatches: loadedDispatches,
  });
  const persistedRequirementState = loadPersistedRequirementRuntimeState(companyId);
  const reconciledRequirementState = reconcileActiveRequirementState({
    companyId,
    activeRequirementAggregates: persistedRequirementState.loadedRequirementAggregates,
    primaryRequirementId:
      persistedRequirementState.loadedRequirementAggregates.find((aggregate) => aggregate.primary)?.id ?? null,
    activeConversationStates: loadedConversationStates,
    activeWorkItems: loadedWorkItems,
    activeRoomRecords: loadedRooms,
    activeRequirementEvidence: persistedRequirementState.loadedRequirementEvidence,
  });

  return {
    loadedRooms,
    loadedMissions,
    loadedConversationStates,
    loadedWorkItems: syncArtifactLinks(syncDispatchLinks(loadedWorkItems, loadedDispatches), loadedArtifacts),
    loadedRounds,
    loadedArtifacts,
    loadedDispatches,
    loadedRoomBindings,
    loadedRequirementAggregates: reconciledRequirementState.activeRequirementAggregates,
    loadedRequirementEvidence: persistedRequirementState.loadedRequirementEvidence,
    primaryRequirementId: reconciledRequirementState.primaryRequirementId,
  };
}

export function createEmptyProductState(): LoadedCompanyProductState {
  return {
    loadedRooms: [],
    loadedMissions: [],
    loadedConversationStates: [],
    loadedWorkItems: [],
    loadedRounds: [],
    loadedArtifacts: [],
    loadedDispatches: [],
    loadedRoomBindings: [],
    loadedRequirementAggregates: [],
    loadedRequirementEvidence: [],
    primaryRequirementId: null,
  };
}

export function loadInitialCompanyState() {
  try {
    const config = peekCachedCompanyConfig();
    const activeCompany = config?.companies.find((company: Company) => company.id === config.activeCompanyId) ?? null;
    const state = activeCompany ? loadProductState(activeCompany.id) : createEmptyProductState();

    return {
      config: config ?? null,
      activeCompany,
      activeRoomRecords: state.loadedRooms,
      activeMissionRecords: state.loadedMissions,
      activeConversationStates: state.loadedConversationStates,
      activeWorkItems: state.loadedWorkItems,
      activeRequirementAggregates: state.loadedRequirementAggregates,
      activeRequirementEvidence: state.loadedRequirementEvidence,
      primaryRequirementId: state.primaryRequirementId,
      activeRoundRecords: state.loadedRounds,
      activeArtifacts: state.loadedArtifacts,
      activeDispatches: state.loadedDispatches,
      activeRoomBindings: state.loadedRoomBindings,
      bootstrapPhase: activeCompany ? ("ready" as const) : config ? ("missing" as const) : ("idle" as const),
    };
  } catch {
    return {
      config: null,
      activeCompany: null,
      activeRoomRecords: [],
      activeMissionRecords: [],
      activeConversationStates: [],
      activeWorkItems: [],
      activeRequirementAggregates: [],
      activeRequirementEvidence: [],
      primaryRequirementId: null,
      activeRoundRecords: [],
      activeArtifacts: [],
      activeDispatches: [],
      activeRoomBindings: [],
      bootstrapPhase: "idle" as const,
    };
  }
}
