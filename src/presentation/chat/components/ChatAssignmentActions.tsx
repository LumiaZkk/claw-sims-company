import { Users } from "lucide-react";
import { resolveMentionedEmployeesInText } from "../../../application/assignment/chat-mentions";
import { buildRequirementRoomRoute } from "../../../application/delegation/room-routing";
import { inferMissionTopicKey, inferRequestTopicKey } from "../../../application/delegation/request-topic";
import { Avatar, AvatarImage } from "../../../components/ui/avatar";
import type { RequirementRoomRecord } from "../../../domain/delegation/types";
import type { Company } from "../../../domain/org/types";
import { buildCompanyChatRoute } from "../../../lib/chat-routes";
import { resolveTaskTitle } from "../view-models/task-tracker";

export function ChatAssignmentActions(input: {
  messageText: string;
  activeCompany: Company | null;
  isCeoSession: boolean;
  targetAgentId: string | null;
  currentConversationRequirementTopicKey: string | null;
  requirementOverviewTopicKey: string | null;
  conversationMissionRecordId: string | null;
  persistedWorkItemId: string | null;
  groupWorkItemId: string | null;
  activeRoomRecords: RequirementRoomRecord[];
  onNavigateToRoute: (route: string) => void;
}) {
  const mentions = resolveMentionedEmployeesInText(input.messageText, input.activeCompany);
  const activeCompany = input.activeCompany;
  if (mentions.length === 0) {
    return null;
  }

  return (
    <div className="mt-4 space-y-2 border-t border-slate-200/60 pt-3">
      <div className="mb-2 flex items-center gap-1.5 text-xs font-semibold text-slate-500">
        <span>🚀 检测到任务分派</span>
      </div>
      <div className="flex flex-wrap gap-2">
        {(!input.isCeoSession ? mentions : mentions.slice(0, 1)).map((member) => (
          <button
            key={member.agentId}
            onClick={() =>
              input.onNavigateToRoute(
                buildCompanyChatRoute(member.agentId, input.activeCompany?.id),
              )
            }
            className="group/btn flex items-center gap-1.5 rounded-lg border border-indigo-100 bg-white px-2 py-1.5 shadow-sm transition-all hover:border-indigo-300 hover:bg-indigo-50"
          >
            <Avatar className="h-5 w-5 shrink-0 border border-indigo-100">
              <AvatarImage src={`https://api.dicebear.com/7.x/bottts/svg?seed=${member.agentId}`} />
            </Avatar>
            <span className="text-xs font-medium text-indigo-700">{member.nickname}</span>
            <span className="ml-1 text-[10px] text-indigo-400 group-hover/btn:text-indigo-600">
              → 直达
            </span>
          </button>
        ))}
        {activeCompany && mentions.length >= 2 ? (
          <button
            type="button"
            onClick={() => {
              const groupRoute = buildRequirementRoomRoute({
                company: activeCompany,
                memberIds: mentions.map((member) => member.agentId),
                topic: resolveTaskTitle(input.messageText, "任务小组"),
                topicKey:
                  input.currentConversationRequirementTopicKey ??
                  input.requirementOverviewTopicKey ??
                  inferRequestTopicKey([input.messageText]) ??
                  inferMissionTopicKey([input.messageText]),
                workItemId:
                  input.conversationMissionRecordId ??
                  input.persistedWorkItemId ??
                  input.groupWorkItemId ??
                  null,
                preferredInitiatorAgentId: input.targetAgentId,
                existingRooms: input.activeRoomRecords,
              });
              if (groupRoute) {
                input.onNavigateToRoute(groupRoute);
              }
            }}
            className="group/btn flex items-center gap-1.5 rounded-lg border border-emerald-100 bg-white px-2 py-1.5 shadow-sm transition-all hover:border-emerald-300 hover:bg-emerald-50"
          >
            <Users className="h-4 w-4 text-emerald-600" />
            <span className="text-xs font-medium text-emerald-700">打开需求团队房间</span>
          </button>
        ) : null}
      </div>
    </div>
  );
}
