import { Sparkles } from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "../../../components/ui/avatar";
import type { ChatDisplayItem } from "../view-models/messages";
import {
  extractTextFromMessage,
  getRenderableMessageContent,
} from "../view-models/messages";
import { getChatSenderIdentity } from "../view-models/sender-identity";
import type { Company, EmployeeRef } from "../../../domain/org/types";
import type { RequirementRoomRecord } from "../../../domain/delegation/types";
import { cn, formatTime, getAvatarUrl } from "../../../lib/utils";
import { ChatContent } from "./ChatContent";
import { ChatAssignmentActions } from "./ChatAssignmentActions";

export function ChatMessageFeed(input: {
  hiddenDisplayItemCount: number;
  renderWindowStep: number;
  displayItemsLength: number;
  visibleDisplayItems: ChatDisplayItem[];
  activeCompany: Company | null;
  activeRoomRecords: RequirementRoomRecord[];
  isCeoSession: boolean;
  isGroup: boolean;
  groupTopic: string | null;
  emp: EmployeeRef | null;
  effectiveOwnerAgentId: string | null;
  requirementRoomSessionsLength: number;
  targetAgentId: string | null;
  currentConversationRequirementTopicKey: string | null;
  requirementOverviewTopicKey: string | null;
  conversationMissionRecordId: string | null;
  persistedWorkItemId: string | null;
  groupWorkItemId: string | null;
  hasActiveRun: boolean;
  streamText: string | null;
  isGenerating: boolean;
  emptyStateText: string;
  onExpandDisplayWindow: (nextSize: number) => void;
  onNavigateToRoute: (route: string) => void;
}) {
  return (
    <>
      {input.hiddenDisplayItemCount > 0 ? (
        <div className="flex justify-center pb-2">
          <button
            type="button"
            onClick={() => input.onExpandDisplayWindow(input.displayItemsLength)}
            className="rounded-full border border-slate-200 bg-white px-4 py-2 text-xs font-medium text-slate-600 shadow-sm transition-colors hover:bg-slate-50 hover:text-slate-900"
          >
            显示更早的 {Math.min(input.hiddenDisplayItemCount, input.renderWindowStep)} 条消息
          </button>
        </div>
      ) : null}
      {input.visibleDisplayItems.map((item) => {
        if (item.kind === "tool") {
          return (
            <div key={item.id} className="flex justify-center">
              <div
                className={cn(
                  "w-full max-w-3xl rounded-2xl px-4 py-3 text-sm shadow-sm",
                  item.tone === "sky"
                    ? "border border-sky-200 bg-sky-50/90 text-sky-900"
                    : "border border-slate-200 bg-slate-50/90 text-slate-700",
                )}
              >
                <div
                  className={cn(
                    "flex flex-wrap items-center gap-2 text-xs font-semibold uppercase tracking-[0.18em]",
                    item.tone === "sky" ? "text-sky-700" : "text-slate-500",
                  )}
                >
                  <span>{item.title}</span>
                  {item.count > 1 ? (
                    <span
                      className={cn(
                        "rounded-full px-2 py-0.5 text-[10px]",
                        item.tone === "sky"
                          ? "bg-white/80 text-sky-700"
                          : "bg-white/80 text-slate-500",
                      )}
                    >
                      x{item.count}
                    </span>
                  ) : null}
                </div>
                <div className="mt-1 text-sm leading-6">{item.detail}</div>
              </div>
            </div>
          );
        }

        const msg = item.message;
        const sender = getChatSenderIdentity({
          msg,
          activeCompany: input.activeCompany,
          isGroup: input.isGroup,
          groupTopic: input.groupTopic,
          emp: input.emp,
          effectiveOwnerAgentId: input.effectiveOwnerAgentId,
          requirementRoomSessionsLength: input.requirementRoomSessionsLength,
        });
        const renderableContent = getRenderableMessageContent(msg.content);
        const bubbleContent = renderableContent ?? msg.content;
        const assignmentText = msg.role === "assistant" ? extractTextFromMessage(msg) : null;

        return (
          <div
            key={item.id}
            className={`group flex max-w-full ${sender.isOutgoing ? "justify-end" : "justify-start"}`}
          >
            <div
              className={`flex max-w-full gap-3 lg:max-w-[95%] xl:max-w-[90%] ${sender.isOutgoing ? "flex-row-reverse" : "flex-row"}`}
            >
              {sender.isOutgoing ? (
                <Avatar className="mt-1 h-6 w-6 shrink-0 rounded-md border border-slate-200 bg-slate-100">
                  <AvatarImage
                    src={getAvatarUrl(undefined, undefined, sender.avatarSeed)}
                    className="object-cover"
                  />
                  <AvatarFallback className="rounded-md bg-zinc-800 font-mono text-[10px] text-zinc-500">
                    {sender.name.slice(0, 1)}
                  </AvatarFallback>
                </Avatar>
              ) : (
                <Avatar className="mt-1 h-8 w-8 shrink-0 border bg-white">
                  <AvatarImage src={`https://api.dicebear.com/7.x/bottts/svg?seed=${sender.avatarSeed}`} />
                </Avatar>
              )}
              <div
                className={`min-w-0 ${sender.isOutgoing ? "items-end" : "items-start"} flex flex-col`}
              >
                <div className="mb-1 flex items-center gap-2">
                  <span className="select-none text-xs text-muted-foreground">
                    {sender.name} · {formatTime(msg.timestamp || undefined)}
                  </span>
                  {sender.metaLabel ? (
                    <span className="text-[10px] text-slate-400">{sender.metaLabel}</span>
                  ) : null}
                  {sender.badgeLabel ? (
                    <span
                      className={cn(
                        "rounded border px-1 py-0.5 text-[9px] font-medium",
                        sender.badgeTone === "amber"
                          ? "border-amber-100 bg-amber-50 text-amber-700"
                          : "border-indigo-100 bg-indigo-50 text-indigo-500",
                      )}
                    >
                      {sender.badgeLabel}
                    </span>
                  ) : null}
                </div>
                <div
                  className={`max-w-full overflow-x-auto rounded-2xl px-4 py-3 text-sm shadow-sm ${
                    sender.isOutgoing
                      ? "rounded-tr-sm bg-indigo-600 text-white"
                      : sender.isRelayed
                        ? "rounded-tl-sm border border-slate-200/60 bg-slate-50 text-slate-800 shadow-inner"
                        : msg.role === "assistant" && msg.text?.includes("## 📋 任务追踪")
                          ? "rounded-tl-sm bg-indigo-600 text-white shadow-indigo-500/20"
                          : "rounded-tl-sm border bg-white text-slate-900"
                  }`}
                >
                  <ChatContent
                    content={bubbleContent}
                    isDarkBg={
                      sender.isOutgoing ||
                      (msg.role === "assistant" && !!msg.text?.includes("## 📋 任务追踪"))
                    }
                    hideTaskTrackerPanel={input.isCeoSession && msg.role === "assistant"}
                    hideToolActivityBlocks
                    hasActiveRun={input.hasActiveRun}
                    streamText={input.streamText}
                  />
                  {assignmentText ? (
                    <ChatAssignmentActions
                      messageText={assignmentText}
                      activeCompany={input.activeCompany}
                      isCeoSession={input.isCeoSession}
                      targetAgentId={input.targetAgentId}
                      currentConversationRequirementTopicKey={
                        input.currentConversationRequirementTopicKey
                      }
                      requirementOverviewTopicKey={input.requirementOverviewTopicKey}
                      conversationMissionRecordId={input.conversationMissionRecordId}
                      persistedWorkItemId={input.persistedWorkItemId}
                      groupWorkItemId={input.groupWorkItemId}
                      activeRoomRecords={input.activeRoomRecords}
                      onNavigateToRoute={input.onNavigateToRoute}
                    />
                  ) : null}
                </div>
              </div>
            </div>
          </div>
        );
      })}
      {input.displayItemsLength === 0 ? (
        <div className="flex h-full flex-col items-center justify-center space-y-3 text-muted-foreground opacity-50">
          <Sparkles className="h-10 w-10" />
          <p className="text-sm">{input.emptyStateText}</p>
        </div>
      ) : null}
      {input.streamText ? (
        <div className="group flex max-w-full justify-start">
          <div className="flex max-w-full gap-3 lg:max-w-[95%] xl:max-w-[90%] flex-row">
            <Avatar className="mt-1 h-8 w-8 shrink-0 border bg-white">
              <AvatarImage
                src={`https://api.dicebear.com/7.x/bottts/svg?seed=${input.isGroup ? input.groupTopic : input.emp?.agentId}`}
              />
            </Avatar>
            <div className="flex min-w-0 flex-col items-start">
              <span className="mb-1 select-none text-xs text-muted-foreground">
                {input.isGroup ? "需求团队成员" : input.emp?.nickname} · 正在思考…
              </span>
              <div className="rounded-2xl rounded-tl-sm border bg-white px-4 py-3 text-sm text-slate-900 shadow-sm">
                <ChatContent
                  content={[{ type: "text", text: input.streamText }]}
                  hasActiveRun={input.hasActiveRun}
                  streamText={input.streamText}
                />
              </div>
            </div>
          </div>
        </div>
      ) : null}
      {input.isGenerating && !input.streamText ? (
        <div className="group flex max-w-full justify-start">
          <div className="flex max-w-full gap-3 lg:max-w-[95%] xl:max-w-[90%] flex-row">
            <Avatar className="mt-1 h-8 w-8 shrink-0 border bg-white">
              <AvatarImage
                src={`https://api.dicebear.com/7.x/bottts/svg?seed=${input.isGroup ? input.groupTopic : input.emp?.agentId}`}
              />
            </Avatar>
            <div className="flex min-w-0 flex-col items-start">
              <span className="mb-1 select-none text-xs text-muted-foreground">
                {input.isGroup ? "需求团队成员" : input.emp?.nickname} · 思考中...
              </span>
              <div className="flex items-center gap-2 rounded-2xl rounded-tl-sm border bg-white px-4 py-3 text-sm text-slate-900 shadow-sm">
                <div className="flex h-5 items-center gap-1">
                  <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-indigo-500 [animation-delay:-0.3s]"></span>
                  <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-indigo-500 [animation-delay:-0.15s]"></span>
                  <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-indigo-500"></span>
                </div>
              </div>
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}
