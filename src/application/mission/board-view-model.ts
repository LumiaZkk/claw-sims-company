import { useMissionBoardApp, useMissionBoardQuery } from "./index";

export function useBoardPageViewModel() {
  return {
    ...useMissionBoardQuery(),
    ...useMissionBoardApp(),
  };
}
