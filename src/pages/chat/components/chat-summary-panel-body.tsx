import {
  ChatSummaryPanelOwnerSection,
  ChatSummaryPanelRequirementOverviewSection,
} from "./ChatSummaryPanelRequirementSections";
import {
  ChatSummaryPanelDebugSection,
  ChatSummaryPanelTeamSection,
} from "./ChatSummaryPanelTeamDebugSections";
import type { ChatSummaryPanelBodyProps } from "./chat-summary-panel-types";

export function ChatSummaryPanelBody(props: ChatSummaryPanelBodyProps) {
  const isRequirementOverviewMode =
    props.summaryPanelView === "owner" && Boolean(props.collaborationSurface);

  return (
    <div className="grid gap-4">
      {isRequirementOverviewMode ? (
        <ChatSummaryPanelRequirementOverviewSection {...props} />
      ) : props.summaryPanelView === "owner" ? (
        <ChatSummaryPanelOwnerSection {...props} />
      ) : null}

      {props.summaryPanelView === "team" ? (
        <ChatSummaryPanelTeamSection {...props} />
      ) : null}

      {props.summaryPanelView === "debug" ? (
        <ChatSummaryPanelDebugSection {...props} />
      ) : null}
    </div>
  );
}
