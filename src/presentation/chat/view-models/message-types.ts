import type { ChatMessage } from "../../../application/gateway";
import type { CollaboratorReportCardVM } from "./message-reports";

export type ChatBlock = {
  type?: string;
  text?: string;
  name?: string;
  tool_use_id?: string;
  thinking?: string;
  source?: unknown;
};

export type ChatDisplayTier = "main" | "status" | "detail" | "hidden";

export type ChatNarrativeRole =
  | "user_prompt"
  | "executive_reply"
  | "member_update"
  | "workflow_status"
  | "final_summary"
  | "system_noise";

export type ChatDisplayItem =
  | {
      kind: "message";
      id: string;
      message: ChatMessage;
      displayTier: Exclude<ChatDisplayTier, "hidden">;
      narrativeRole: ChatNarrativeRole;
      detailContent?: string | null;
      threadGroupKey?: string | null;
    }
  | {
      kind: "report";
      id: string;
      message: ChatMessage;
      report: CollaboratorReportCardVM;
      displayTier: Exclude<ChatDisplayTier, "hidden">;
      narrativeRole: ChatNarrativeRole;
      detailContent?: string | null;
      threadGroupKey?: string | null;
    }
  | {
      kind: "tool";
      id: string;
      title: string;
      detail: string;
      tone: "slate" | "sky";
      count: number;
    };

export const CHAT_UI_MESSAGE_LIMIT = 120;
