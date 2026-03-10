import { useCompanyRuntimeCommands } from "../../infrastructure/company/runtime/commands";
import {
  selectConversationWorkspaceState,
  selectMissionBoardState,
} from "../../infrastructure/company/runtime/selectors";
import { useCompanyRuntimeStore } from "../../infrastructure/company/runtime/store";
import { useShallow } from "zustand/react/shallow";

export function useMissionBoardQuery() {
  return useCompanyRuntimeStore(useShallow(selectMissionBoardState));
}

export function useMissionBoardApp() {
  const {
    replaceDispatchRecords,
    upsertTask,
    updateCompany,
    applyRequirementTransition,
    upsertWorkItemRecord,
  } = useCompanyRuntimeCommands();
  return {
    replaceDispatchRecords,
    upsertTask,
    updateCompany,
    applyRequirementTransition,
    upsertWorkItemRecord,
  };
}

export function useConversationWorkspaceQuery() {
  return useCompanyRuntimeStore(useShallow(selectConversationWorkspaceState));
}

export function useConversationWorkspaceApp() {
  const {
    updateCompany,
    upsertTask,
    upsertHandoff,
    upsertRequest,
    upsertRoomRecord,
    upsertRoundRecord,
    deleteRoundRecord,
    appendRoomMessages,
    upsertRoomConversationBindings,
    upsertMissionRecord,
    setConversationCurrentWorkKey,
    clearConversationState,
    upsertWorkItemRecord,
    upsertDispatchRecord,
    replaceDispatchRecords,
    switchCompany,
  } = useCompanyRuntimeCommands();
  return {
    updateCompany,
    upsertTask,
    upsertHandoff,
    upsertRequest,
    upsertRoomRecord,
    upsertRoundRecord,
    deleteRoundRecord,
    appendRoomMessages,
    upsertRoomConversationBindings,
    upsertMissionRecord,
    setConversationCurrentWorkKey,
    clearConversationState,
    upsertWorkItemRecord,
    upsertDispatchRecord,
    replaceDispatchRecords,
    switchCompany,
  };
}

export {
  getRequirementStatusToneClass,
  resolveRequirementProductStatus,
  type RequirementProductStatus,
  type RequirementProductStatusId,
  type RequirementProductStatusTone,
} from "./requirement-product-status";
