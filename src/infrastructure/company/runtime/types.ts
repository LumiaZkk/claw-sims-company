import type { ArtifactRecord, SharedKnowledgeItem } from "../../../domain/artifact/types";
import type {
  DispatchRecord,
  HandoffRecord,
  RequestRecord,
  RequirementRoomMessage,
  RequirementRoomRecord,
  RoomConversationBindingRecord,
} from "../../../domain/delegation/types";
import type {
  ConversationMissionRecord,
  ConversationStateRecord,
  RoundRecord,
  TrackedTask,
  WorkItemRecord,
} from "../../../domain/mission/types";
import type { Company, CyberCompanyConfig } from "../../../domain/org/types";

export type { ArtifactRecord, SharedKnowledgeItem } from "../../../domain/artifact/types";
export type {
  DispatchRecord,
  HandoffRecord,
  RequestRecord,
  RequirementRoomMessage,
  RequirementRoomRecord,
  RoomConversationBindingRecord,
} from "../../../domain/delegation/types";
export type {
  ConversationMissionRecord,
  ConversationStateRecord,
  RoundRecord,
  TrackedTask,
  WorkItemRecord,
} from "../../../domain/mission/types";
export type { Company, CyberCompanyConfig } from "../../../domain/org/types";

export type CompanyBootstrapPhase = "idle" | "restoring" | "ready" | "missing" | "error";

export interface CompanyRuntimeState {
  config: CyberCompanyConfig | null;
  activeCompany: Company | null;
  activeRoomRecords: RequirementRoomRecord[];
  activeMissionRecords: ConversationMissionRecord[];
  activeConversationStates: ConversationStateRecord[];
  activeWorkItems: WorkItemRecord[];
  activeRoundRecords: RoundRecord[];
  activeArtifacts: ArtifactRecord[];
  activeDispatches: DispatchRecord[];
  activeRoomBindings: RoomConversationBindingRecord[];
  loading: boolean;
  error: string | null;
  bootstrapPhase: CompanyBootstrapPhase;
  loadConfig: () => Promise<void>;
  saveConfig: () => Promise<void>;
  switchCompany: (id: string) => void;
  deleteCompany: (id: string) => Promise<void>;
  updateCompany: (company: Partial<Company>) => Promise<void>;
  upsertTask: (task: TrackedTask) => Promise<void>;
  upsertHandoff: (handoff: HandoffRecord) => Promise<void>;
  upsertRequest: (request: RequestRecord) => Promise<void>;
  upsertKnowledgeItem: (knowledgeItem: SharedKnowledgeItem) => Promise<void>;
  upsertRoomRecord: (room: RequirementRoomRecord) => void;
  appendRoomMessages: (
    roomId: string,
    messages: RequirementRoomMessage[],
    meta?: Partial<Omit<RequirementRoomRecord, "id" | "transcript">>,
  ) => void;
  upsertRoomConversationBindings: (bindings: RoomConversationBindingRecord[]) => void;
  deleteRoomRecord: (roomId: string) => void;
  upsertMissionRecord: (mission: ConversationMissionRecord) => void;
  deleteMissionRecord: (missionId: string) => void;
  setConversationCurrentWorkKey: (
    conversationId: string,
    workKey: string | null,
    workItemId?: string | null,
    roundId?: string | null,
  ) => void;
  clearConversationState: (conversationId: string) => void;
  upsertWorkItemRecord: (workItem: WorkItemRecord) => void;
  deleteWorkItemRecord: (workItemId: string) => void;
  upsertRoundRecord: (round: RoundRecord) => void;
  deleteRoundRecord: (roundId: string) => void;
  upsertArtifactRecord: (artifact: ArtifactRecord) => void;
  syncArtifactMirrorRecords: (artifacts: ArtifactRecord[], mirrorPrefix?: string) => void;
  deleteArtifactRecord: (artifactId: string) => void;
  upsertDispatchRecord: (dispatch: DispatchRecord) => void;
  replaceDispatchRecords: (dispatches: DispatchRecord[]) => void;
  deleteDispatchRecord: (dispatchId: string) => void;
}

export type RuntimeSet = (partial: Partial<CompanyRuntimeState>) => void;
export type RuntimeGet = () => CompanyRuntimeState;
