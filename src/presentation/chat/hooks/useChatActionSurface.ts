import { useMemo } from "react";
import {
  buildChatActionSurface,
  type BuildChatActionSurfaceInput,
} from "../../../application/chat/action-surface";

export function useChatActionSurface(input: BuildChatActionSurfaceInput) {
  return useMemo(() => buildChatActionSurface(input), [input]);
}
