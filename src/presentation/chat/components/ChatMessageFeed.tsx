import { Sparkles } from "lucide-react";
import { memo, useEffect, useMemo, useRef, useState } from "react";
import {
  readLiveChatSession,
  subscribeLiveChatSession,
} from "../../../application/chat/live-session-cache";
import { Avatar, AvatarFallback, AvatarImage } from "../../../components/ui/avatar";
import type {
  DecisionTicketRecord,
  DispatchRecord,
  RequirementRoomRecord,
} from "../../../domain/delegation/types";
import type { ChatDisplayItem } from "../view-models/messages";
import {
  extractTextFromMessage,
  findInlineRequirementDecisionAnchorId,
  getRenderableMessageContent,
} from "../view-models/messages";
import { getChatSenderIdentity } from "../view-models/sender-identity";
import type { EmployeeRef } from "../../../domain/org/types";
import { cn, formatTime, getAvatarUrl } from "../../../lib/utils";
import { ChatContent } from "./ChatContent";
import { ChatAssignmentActions } from "./ChatAssignmentActions";
import { ChatDecisionTicketCard } from "./ChatDecisionTicketCard";
import { pickBestAssignmentActionText, resolveStructuredAssignmentTargets } from "./chat-assignment-actions";

function getDispatchStatusMeta(dispatch: DispatchRecord) {
  if (dispatch.status === "pending" && dispatch.deliveryState === "unknown") {
    return {
      label: "投递未确认",
      className: "border-amber-200 bg-amber-50 text-amber-700",
    };
  }
  if (dispatch.status === "pending" && dispatch.deliveryState === "pending") {
    return {
      label: "待发送",
      className: "border-slate-200 bg-slate-50 text-slate-500",
    };
  }
  const status = dispatch.status;
  if (status === "answered") {
    return {
      label: "已回复",
      className: "border-emerald-200 bg-emerald-50 text-emerald-700",
    };
  }
  if (status === "acknowledged") {
    return {
      label: "已接单",
      className: "border-sky-200 bg-sky-50 text-sky-700",
    };
  }
  if (status === "blocked") {
    return {
      label: "已阻塞",
      className: "border-rose-200 bg-rose-50 text-rose-700",
    };
  }
  if (status === "superseded") {
    return {
      label: "已覆盖",
      className: "border-slate-200 bg-slate-50 text-slate-500",
    };
  }
  if (status === "sent") {
    return {
      label: "已派发",
      className: "border-indigo-200 bg-indigo-50 text-indigo-700",
    };
  }
  return {
    label: "待发送",
    className: "border-slate-200 bg-slate-50 text-slate-500",
  };
}

type ChatMessageFeedProps = {
  hiddenDisplayItemCount: number;
  renderWindowStep: number;
  displayItemsLength: number;
  visibleDisplayItems: ChatDisplayItem[];
  companyId: string | null;
  sessionKey: string | null;
  employees: EmployeeRef[];
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
  activeDispatches: DispatchRecord[];
  activeRoomRecords: RequirementRoomRecord[];
  openRequirementDecisionTicket: DecisionTicketRecord | null;
  showLegacyDecisionCard: boolean;
  decisionSubmittingOptionId: string | null;
  isGenerating: boolean;
  emptyStateText: string;
  onExpandDisplayWindow: (nextSize: number) => void;
  onSelectDecisionOption: (optionId: string) => Promise<unknown> | void;
  onNavigateToRoute: (route: string) => void;
  onStreamActivity?: () => void;
};

type ChatMessageListProps = Omit<
  ChatMessageFeedProps,
  "sessionKey" | "isGenerating" | "onStreamActivity"
>;

function ChatDetailDisclosure(input: {
  detailContent?: string | null;
  label?: string;
}) {
  if (!input.detailContent?.trim()) {
    return null;
  }
  return (
    <details className="mt-3 w-full rounded-xl border border-slate-200 bg-slate-50/80 px-3 py-2 text-slate-700">
      <summary className="cursor-pointer list-none text-xs font-medium text-slate-500">
        {input.label ?? "查看详情"}
      </summary>
      <div className="mt-3">
        <ChatContent content={[{ type: "text", text: input.detailContent }]} hideToolActivityBlocks />
      </div>
    </details>
  );
}

function ChatStatusRow(input: {
  senderName: string;
  timestamp?: number;
  summary: string;
  badgeLabel?: string;
  badgeClassName?: string;
  metaLabel?: string;
  detailContent?: string | null;
}) {
  return (
    <div className="flex justify-start">
      <div className="w-full max-w-3xl rounded-2xl border border-slate-200/80 bg-slate-50/85 px-4 py-3 text-slate-700 shadow-sm">
        <div className="flex flex-wrap items-center gap-2 text-xs">
          <span className="font-medium text-slate-700">{input.senderName}</span>
          {typeof input.timestamp === "number" ? (
            <span className="text-slate-400">{formatTime(input.timestamp)}</span>
          ) : null}
          {input.badgeLabel ? (
            <span className={cn("rounded-full border px-2 py-0.5 text-[11px] font-medium", input.badgeClassName)}>
              {input.badgeLabel}
            </span>
          ) : null}
          {input.metaLabel ? <span className="text-slate-400">{input.metaLabel}</span> : null}
        </div>
        <div className="mt-2 text-sm leading-6 text-slate-800">{input.summary}</div>
        <ChatDetailDisclosure detailContent={input.detailContent} label="查看上下文详情" />
      </div>
    </div>
  );
}

function extractTextFromRenderableBlocks(content: unknown): string | null {
  if (!Array.isArray(content)) {
    return typeof content === "string" && content.trim().length > 0 ? content : null;
  }
  const text = content
    .map((block) =>
      typeof block === "object" && block && typeof (block as { text?: unknown }).text === "string"
        ? (block as { text: string }).text.trim()
        : "",
    )
    .filter((value) => value.length > 0)
    .join("\n")
    .trim();
  return text.length > 0 ? text : null;
}

const ChatMessageList = memo(function ChatMessageList(input: ChatMessageListProps) {
  const employeesByAgentId = useMemo(() => {
    const records = new Map<string, EmployeeRef>();
    input.employees.forEach((employee) => {
      if (employee.agentId?.trim()) {
        records.set(employee.agentId, employee);
      }
    });
    return records;
  }, [input.employees]);

  const employeeNameByAgentId = useMemo(() => {
    const records = new Map<string, string>();
    employeesByAgentId.forEach((employee, agentId) => {
      records.set(agentId, employee.nickname ?? agentId);
    });
    return records;
  }, [employeesByAgentId]);

  const dispatchByRoomMessageId = useMemo(() => {
    const records = new Map<string, DispatchRecord>();
    input.activeDispatches.forEach((dispatch) => {
      if (dispatch.sourceMessageId?.trim()) {
        const current = records.get(dispatch.sourceMessageId);
        if (!current || dispatch.updatedAt >= current.updatedAt) {
          records.set(dispatch.sourceMessageId, dispatch);
        }
      }
      if (dispatch.responseMessageId?.trim()) {
        const current = records.get(dispatch.responseMessageId);
        if (!current || dispatch.updatedAt >= current.updatedAt) {
          records.set(dispatch.responseMessageId, dispatch);
        }
      }
    });
    return records;
  }, [input.activeDispatches]);

  const inlineDecisionAnchorId = useMemo(
    () =>
      findInlineRequirementDecisionAnchorId({
        displayItems: input.visibleDisplayItems,
        openDecisionTicket: input.openRequirementDecisionTicket,
        showLegacyPending: input.showLegacyDecisionCard,
      }),
    [input.openRequirementDecisionTicket, input.showLegacyDecisionCard, input.visibleDisplayItems],
  );

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
          activeCompany: null,
          employeesByAgentId,
          isGroup: input.isGroup,
          isCeoSession: input.isCeoSession,
          groupTopic: input.groupTopic,
          emp: input.emp,
          effectiveOwnerAgentId: input.effectiveOwnerAgentId,
          requirementRoomSessionsLength: input.requirementRoomSessionsLength,
        });
        if (item.kind === "report") {
          const statusClassName =
            item.report.status === "answered"
              ? "border-emerald-200 bg-emerald-50 text-emerald-700"
              : item.report.status === "acknowledged"
                ? "border-sky-200 bg-sky-50 text-sky-700"
                : "border-rose-200 bg-rose-50 text-rose-700";

          if (item.displayTier === "status") {
            return (
              <div key={item.id}>
                <ChatStatusRow
                  senderName={sender.name}
                  timestamp={msg.timestamp}
                  summary={item.report.summary}
                  badgeLabel={item.report.statusLabel}
                  badgeClassName={statusClassName}
                  metaLabel={item.report.reportType}
                  detailContent={item.detailContent}
                />
                {item.id === inlineDecisionAnchorId ? (
                  <ChatDecisionTicketCard
                    ticket={input.openRequirementDecisionTicket}
                    legacyPending={input.showLegacyDecisionCard && !input.openRequirementDecisionTicket}
                    submittingOptionId={input.decisionSubmittingOptionId}
                    disabled={false}
                    onSelectOption={input.onSelectDecisionOption}
                  />
                ) : null}
              </div>
            );
          }

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
                <div className={`min-w-0 ${sender.isOutgoing ? "items-end" : "items-start"} flex flex-col`}>
                  <div className="mb-1 flex items-center gap-2">
                    <span className="select-none text-xs text-muted-foreground">
                      {sender.name} · {formatTime(msg.timestamp || undefined)}
                    </span>
                    {sender.metaLabel ? (
                      <span className="text-[10px] text-slate-400">{sender.metaLabel}</span>
                    ) : null}
                  </div>
                  <div className="max-w-full rounded-2xl border border-indigo-200 bg-white px-4 py-3 shadow-sm">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="rounded-full border border-indigo-200 bg-indigo-50 px-2 py-0.5 text-[11px] font-medium text-indigo-700">
                        协作者回执
                      </span>
                      <span className={`rounded-full border px-2 py-0.5 text-[11px] font-medium ${statusClassName}`}>
                        {item.report.statusLabel}
                      </span>
                      <span className="text-[11px] font-medium text-slate-500">
                        {item.report.reportType}
                      </span>
                    </div>
                    <div className="mt-3 text-sm font-medium leading-6 text-slate-900">
                      {item.report.summary}
                    </div>
                    {item.report.detail && !item.report.showFullContent && !item.detailContent ? (
                      <div className="mt-2 text-sm leading-6 text-slate-600">
                        {item.report.detail}
                      </div>
                    ) : null}
                    <ChatDetailDisclosure
                      detailContent={item.detailContent ?? (item.report.showFullContent ? item.report.cleanText : null)}
                      label="查看完整回执"
                    />
                  </div>
                  {item.id === inlineDecisionAnchorId ? (
                    <ChatDecisionTicketCard
                      ticket={input.openRequirementDecisionTicket}
                      legacyPending={input.showLegacyDecisionCard && !input.openRequirementDecisionTicket}
                      submittingOptionId={input.decisionSubmittingOptionId}
                      disabled={false}
                      onSelectOption={input.onSelectDecisionOption}
                    />
                  ) : null}
                </div>
              </div>
            </div>
          );
        }
        const renderableContent = getRenderableMessageContent(msg.content);
        const bubbleContent =
          renderableContent ??
          msg.content ??
          (typeof msg.text === "string" && msg.text.trim().length > 0
            ? [{ type: "text", text: msg.text }]
            : undefined);
        const assignmentText = msg.role === "assistant" ? extractTextFromMessage(msg) : null;
        const roomMessageId =
          typeof msg.roomMessageId === "string" && msg.roomMessageId.trim().length > 0
            ? msg.roomMessageId.trim()
            : null;
        const linkedDispatch = roomMessageId ? dispatchByRoomMessageId.get(roomMessageId) ?? null : null;
        const audienceLabels =
          input.isGroup && Array.isArray(msg.roomAudienceAgentIds) && msg.roomAudienceAgentIds.length > 0
            ? msg.roomAudienceAgentIds
                .map((agentId) => employeeNameByAgentId.get(agentId) ?? agentId)
                .filter((label): label is string => Boolean(label))
            : [];
        const roomAgentId =
          typeof msg.roomAgentId === "string" && msg.roomAgentId.trim().length > 0
            ? msg.roomAgentId.trim()
            : null;
        const sourceLabel =
          roomAgentId
            ? employeeNameByAgentId.get(roomAgentId) ?? roomAgentId
            : typeof msg.roomSenderLabel === "string" && msg.roomSenderLabel.trim().length > 0
              ? msg.roomSenderLabel.trim()
              : null;
        const dispatchMeta = linkedDispatch ? getDispatchStatusMeta(linkedDispatch) : null;
        const assignmentTargets = resolveStructuredAssignmentTargets({
          linkedDispatchTargetAgentIds: linkedDispatch?.targetActorIds ?? null,
          roomAudienceAgentIds: Array.isArray(msg.roomAudienceAgentIds) ? msg.roomAudienceAgentIds : null,
          targetActorIds: Array.isArray(msg.targetActorIds) ? msg.targetActorIds.map((value) => String(value)) : null,
          roomMessageSource:
            typeof msg.roomMessageSource === "string" ? msg.roomMessageSource : null,
          messageIntent:
            typeof msg.messageIntent === "string" ? msg.messageIntent : null,
        });
        const assignmentSourceText =
          msg.role === "assistant"
            ? pickBestAssignmentActionText({
                candidateTexts: [
                  assignmentText ?? "",
                  extractTextFromRenderableBlocks(bubbleContent) ?? "",
                ],
                employees: input.employees,
                targetAgentIds: assignmentTargets.targetAgentIds,
                allowMentionFallback: assignmentTargets.allowMentionFallback,
              })
            : "";
        const showRoomMeta =
          input.isGroup &&
          !sender.isOutgoing &&
          (audienceLabels.length > 0 ||
            Boolean(sourceLabel) ||
            Boolean(linkedDispatch) ||
            typeof msg.roomMessageSource === "string");

        if (item.displayTier === "status") {
          return (
            <div key={item.id}>
              <ChatStatusRow
                senderName={sender.name}
                timestamp={msg.timestamp}
                summary={typeof msg.text === "string" ? msg.text : ""}
                badgeLabel={sender.badgeLabel}
                badgeClassName={
                  sender.badgeTone === "amber"
                    ? "border-amber-200 bg-amber-50 text-amber-700"
                    : "border-indigo-200 bg-indigo-50 text-indigo-700"
                }
                metaLabel={sender.metaLabel}
                detailContent={item.detailContent}
              />
              {item.id === inlineDecisionAnchorId ? (
                <ChatDecisionTicketCard
                  ticket={input.openRequirementDecisionTicket}
                  legacyPending={input.showLegacyDecisionCard && !input.openRequirementDecisionTicket}
                  submittingOptionId={input.decisionSubmittingOptionId}
                  disabled={false}
                  onSelectOption={input.onSelectDecisionOption}
                />
              ) : null}
            </div>
          );
        }

        if (item.displayTier === "detail") {
          return (
            <div key={item.id} className="flex justify-start">
              <div className="w-full max-w-3xl rounded-2xl border border-slate-200 bg-white/85 px-4 py-3 text-slate-700 shadow-sm">
                <div className="flex flex-wrap items-center gap-2 text-xs text-slate-500">
                  <span className="font-medium text-slate-700">{sender.name}</span>
                  {typeof msg.timestamp === "number" ? <span>{formatTime(msg.timestamp)}</span> : null}
                  <span className="rounded-full border border-slate-200 bg-slate-50 px-2 py-0.5 text-[11px]">
                    协作详情
                  </span>
                </div>
                <div className="mt-2 text-sm leading-6 text-slate-700">
                  {typeof msg.text === "string" && msg.text.trim() ? msg.text : "查看协作详情"}
                </div>
                <ChatDetailDisclosure detailContent={item.detailContent} label="展开完整内容" />
              </div>
            </div>
          );
        }

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
                  />
                  {assignmentSourceText ? (
                    <ChatAssignmentActions
                      messageText={assignmentSourceText}
                      targetAgentIds={assignmentTargets.targetAgentIds}
                      allowMentionFallback={assignmentTargets.allowMentionFallback}
                      companyId={input.companyId}
                      employees={input.employees}
                      isCeoSession={input.isCeoSession}
                      isGroup={input.isGroup}
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
                  {showRoomMeta ? (
                    <div
                      className={cn(
                        "mt-3 flex flex-wrap gap-1.5 text-[11px]",
                        sender.isOutgoing
                          ? "text-indigo-50/95"
                          : "text-slate-500",
                      )}
                    >
                      {audienceLabels.length > 0 ? (
                        <span
                          className={cn(
                            "rounded-full border px-2 py-0.5",
                            sender.isOutgoing
                              ? "border-white/20 bg-white/10 text-white/90"
                              : "border-slate-200 bg-slate-50 text-slate-600",
                          )}
                        >
                          派给 {audienceLabels.slice(0, 3).join("、")}
                          {audienceLabels.length > 3 ? ` +${audienceLabels.length - 3}` : ""}
                        </span>
                      ) : null}
                      {sourceLabel && !sender.isOutgoing ? (
                        <span className="rounded-full border border-slate-200 bg-slate-50 px-2 py-0.5 text-slate-600">
                          来自 {sourceLabel}
                        </span>
                      ) : null}
                      {linkedDispatch ? (
                        <>
                          <span
                            className={cn(
                              "rounded-full border px-2 py-0.5",
                              sender.isOutgoing
                                ? "border-white/20 bg-white/10 text-white/90"
                                : "border-slate-200 bg-slate-50 text-slate-600",
                            )}
                          >
                            对应派单 {linkedDispatch.title}
                          </span>
                          <span
                            className={cn(
                              "rounded-full border px-2 py-0.5",
                              sender.isOutgoing
                                ? "border-white/20 bg-white/10 text-white/90"
                                : dispatchMeta?.className ?? "border-slate-200 bg-slate-50 text-slate-500",
                            )}
                          >
                            {dispatchMeta?.label ?? "已关联"}
                          </span>
                        </>
                      ) : null}
                    </div>
                  ) : null}
                  <ChatDetailDisclosure detailContent={item.detailContent} />
                </div>
                {item.id === inlineDecisionAnchorId ? (
                  <ChatDecisionTicketCard
                    ticket={input.openRequirementDecisionTicket}
                    legacyPending={input.showLegacyDecisionCard && !input.openRequirementDecisionTicket}
                    submittingOptionId={input.decisionSubmittingOptionId}
                    disabled={false}
                    onSelectOption={input.onSelectDecisionOption}
                  />
                ) : null}
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
    </>
  );
});

type StreamingVisualMode = "hidden" | "thinking" | "text";

function resolveStreamingVisualState(
  companyId: string | null,
  sessionKey: string | null,
  isGeneratingFallback: boolean,
): { mode: StreamingVisualMode; text: string | null } {
  const liveSession = readLiveChatSession(companyId, sessionKey);
  const text = liveSession?.streamText?.trim().length ? liveSession.streamText : null;
  const isGenerating = isGeneratingFallback || Boolean(liveSession?.isGenerating);
  if (text) {
    return { mode: "text", text };
  }
  if (isGenerating) {
    return { mode: "thinking", text: null };
  }
  return { mode: "hidden", text: null };
}

const ChatStreamingState = memo(function ChatStreamingState(input: {
  companyId: string | null;
  sessionKey: string | null;
  isGeneratingFallback: boolean;
  groupTopic: string | null;
  emp: EmployeeRef | null;
  isGroup: boolean;
  onStreamActivity?: () => void;
}) {
  const initialVisualState = useMemo(
    () =>
      resolveStreamingVisualState(
        input.companyId,
        input.sessionKey,
        input.isGeneratingFallback,
      ),
    [input.companyId, input.isGeneratingFallback, input.sessionKey],
  );
  const [mode, setMode] = useState<StreamingVisualMode>(initialVisualState.mode);
  const modeRef = useRef<StreamingVisualMode>(initialVisualState.mode);
  const streamTextRef = useRef<string | null>(initialVisualState.text);
  const textElementRef = useRef<HTMLDivElement | null>(null);
  const onStreamActivityRef = useRef(input.onStreamActivity);

  useEffect(() => {
    onStreamActivityRef.current = input.onStreamActivity;
  }, [input.onStreamActivity]);

  useEffect(() => {
    const syncVisualState = () => {
      const nextState = resolveStreamingVisualState(
        input.companyId,
        input.sessionKey,
        input.isGeneratingFallback,
      );
      streamTextRef.current = nextState.text;
      if (textElementRef.current) {
        textElementRef.current.textContent = nextState.text ?? "";
      }
      if (nextState.mode !== modeRef.current) {
        modeRef.current = nextState.mode;
        setMode(nextState.mode);
      }
      if (nextState.mode !== "hidden") {
        onStreamActivityRef.current?.();
      }
    };

    syncVisualState();
    return subscribeLiveChatSession(input.companyId, input.sessionKey, syncVisualState);
  }, [input.companyId, input.isGeneratingFallback, input.sessionKey]);

  useEffect(() => {
    if (mode === "text" && textElementRef.current) {
      textElementRef.current.textContent = streamTextRef.current ?? "";
    }
  }, [mode]);

  if (mode === "text") {
    return (
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
                <div
                  ref={textElementRef}
                  className="w-full whitespace-pre-wrap break-words text-sm leading-7 text-slate-800"
                />
              </div>
            </div>
          </div>
        </div>
    );
  }

  if (mode === "thinking") {
    return (
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
    );
  }

  return null;
});

export const ChatMessageFeed = memo(function ChatMessageFeed(input: ChatMessageFeedProps) {
  return (
    <>
      <ChatMessageList
        hiddenDisplayItemCount={input.hiddenDisplayItemCount}
        renderWindowStep={input.renderWindowStep}
        displayItemsLength={input.displayItemsLength}
        visibleDisplayItems={input.visibleDisplayItems}
        companyId={input.companyId}
        employees={input.employees}
        isCeoSession={input.isCeoSession}
        isGroup={input.isGroup}
        groupTopic={input.groupTopic}
        emp={input.emp}
        effectiveOwnerAgentId={input.effectiveOwnerAgentId}
        requirementRoomSessionsLength={input.requirementRoomSessionsLength}
        targetAgentId={input.targetAgentId}
        currentConversationRequirementTopicKey={input.currentConversationRequirementTopicKey}
        requirementOverviewTopicKey={input.requirementOverviewTopicKey}
        conversationMissionRecordId={input.conversationMissionRecordId}
        persistedWorkItemId={input.persistedWorkItemId}
        groupWorkItemId={input.groupWorkItemId}
        activeDispatches={input.activeDispatches}
        activeRoomRecords={input.activeRoomRecords}
        openRequirementDecisionTicket={input.openRequirementDecisionTicket}
        showLegacyDecisionCard={input.showLegacyDecisionCard}
        decisionSubmittingOptionId={input.decisionSubmittingOptionId}
        emptyStateText={input.emptyStateText}
        onExpandDisplayWindow={input.onExpandDisplayWindow}
        onSelectDecisionOption={input.onSelectDecisionOption}
        onNavigateToRoute={input.onNavigateToRoute}
      />
      <ChatStreamingState
        companyId={input.companyId}
        sessionKey={input.sessionKey}
        isGeneratingFallback={input.isGenerating}
        groupTopic={input.groupTopic}
        emp={input.emp}
        isGroup={input.isGroup}
        onStreamActivity={input.onStreamActivity}
      />
    </>
  );
});
