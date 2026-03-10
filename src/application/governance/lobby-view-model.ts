import { useExceptionInboxQuery, useGovernanceApp } from "./index";

export function useCompanyLobbyViewModel() {
  return {
    ...useExceptionInboxQuery(),
    ...useGovernanceApp(),
  };
}
