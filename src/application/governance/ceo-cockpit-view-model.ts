import { useCeoCockpitQuery, useGovernanceApp } from "./index";

export function useCeoCockpitViewModel() {
  return {
    ...useCeoCockpitQuery(),
    ...useGovernanceApp(),
  };
}
