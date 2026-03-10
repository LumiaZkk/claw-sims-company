import { useConversationWorkspaceApp, useConversationWorkspaceQuery } from "./index";

export function useConversationWorkspaceViewModel() {
  return {
    ...useConversationWorkspaceQuery(),
    ...useConversationWorkspaceApp(),
  };
}
