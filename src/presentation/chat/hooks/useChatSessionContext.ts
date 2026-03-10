import { useMemo } from "react";
import {
  buildChatSessionContext,
  type BuildChatSessionContextInput,
} from "../../../application/chat/session-context";

export function useChatSessionContext(input: BuildChatSessionContextInput) {
  return useMemo(() => buildChatSessionContext(input), [input]);
}
