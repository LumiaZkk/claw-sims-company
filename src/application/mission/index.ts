import { useCompanyRuntimeCommands } from "../../infrastructure/company/runtime/commands";
import {
  selectConversationWorkspaceState,
  selectMissionBoardState,
} from "../../infrastructure/company/runtime/selectors";
import { useCompanyRuntimeStore } from "../../infrastructure/company/runtime/store";

export function useMissionBoardQuery() {
  return useCompanyRuntimeStore(selectMissionBoardState);
}

export function useMissionBoardApp() {
  const { replaceDispatchRecords, upsertTask, updateCompany } = useCompanyRuntimeCommands();
  return { replaceDispatchRecords, upsertTask, updateCompany };
}

export function useConversationWorkspaceQuery() {
  return useCompanyRuntimeStore(selectConversationWorkspaceState);
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
