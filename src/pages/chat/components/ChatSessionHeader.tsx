import { MoreHorizontal, RefreshCcw, Trash2 } from "lucide-react";
import type { GatewaySessionRow } from "../../../application/gateway";
import type { ResolvedExecutionState } from "../../../application/mission/execution-state";
import type { HistoryRoundItem } from "../../../application/mission/history/round-history";
import type { RoundRecord } from "../../../domain/mission/types";
import type { EmployeeRef } from "../../../domain/org/types";
import { ExecutionStateBadge } from "../../../shared/presentation/execution-state-badge";
import { Button } from "../../../ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "../../../ui/dropdown-menu";
import { Avatar, AvatarFallback, AvatarImage } from "../../../ui/avatar";
import { cn, getAvatarUrl } from "../../../lib/utils";
import type { FocusActionButton } from "../view-models/focus";
import { ChatHistoryMenu } from "./ChatHistoryMenu";

type ChatSessionHeaderSummaryItem = {
  label: string;
  value: string;
};

type ChatSessionHeaderGroupMission = {
  contextTagLabel: string | null;
  headline: string;
  tone: "rose" | "amber" | "emerald" | "indigo" | string;
  statusLabel: string;
  isCollaborationMode: boolean;
  hasContextSummary: boolean;
  summaryOpen: boolean;
  missionIsCompleted: boolean;
  primaryOpenAction: FocusActionButton | null;
  promotionActionLabel?: string | null;
  showRequirementTeamEntry?: boolean;
  hasTeamGroupRoute?: boolean;
  showSettledRequirementSummary?: boolean;
  settledRequirementSummaryLabel?: string | null;
  settledRequirementSummary?: string | null;
  settledRequirementNextAction?: string | null;
  onOpenRequirementTeam?: (() => void) | null;
  onOpenSummaryPanel: () => void;
  onRunPrimaryAction: (action: FocusActionButton) => Promise<unknown> | void;
  onRunPromotionAction?: (() => Promise<unknown> | void) | null;
};

function getMissionToneClass(tone: ChatSessionHeaderGroupMission["tone"]): string {
  if (tone === "rose") {
    return "border-rose-200/80 bg-rose-50 text-rose-700";
  }
  if (tone === "amber") {
    return "border-amber-200/80 bg-amber-50 text-amber-800";
  }
  if (tone === "emerald") {
    return "border-emerald-200/80 bg-emerald-50 text-emerald-700";
  }
  if (tone === "indigo") {
    return "border-indigo-200/80 bg-indigo-50 text-indigo-700";
  }
  return "border-slate-200/80 bg-slate-50 text-slate-600";
}

function getMissionToneDotClass(tone: ChatSessionHeaderGroupMission["tone"]): string {
  if (tone === "rose") {
    return "bg-rose-500";
  }
  if (tone === "amber") {
    return "bg-amber-500";
  }
  if (tone === "emerald") {
    return "bg-emerald-500";
  }
  if (tone === "indigo") {
    return "bg-indigo-500";
  }
  return "bg-slate-400";
}

function getSummaryRailItemClass(emphasis: "primary" | "warning" | "muted" | "default"): string {
  if (emphasis === "primary") {
    return "text-slate-900";
  }
  if (emphasis === "warning") {
    return "text-amber-900";
  }
  if (emphasis === "muted") {
    return "text-slate-700";
  }
  return "text-slate-800";
}

function getSummaryRailAccentClass(emphasis: "primary" | "warning" | "muted" | "default"): string {
  if (emphasis === "primary") {
    return "bg-indigo-500";
  }
  if (emphasis === "warning") {
    return "bg-amber-500";
  }
  if (emphasis === "muted") {
    return "bg-slate-400";
  }
  return "bg-slate-500";
}

function getCompactActionLabel(label: string): string {
  if (label === "打开 COO 会话") {
    return "COO";
  }
  if (label === "打开需求房间") {
    return "需求房间";
  }
  if (label === "查看需求团队") {
    return "需求团队";
  }
  if (label === "查看规划/任务面板" || label === "规划/任务面板已开") {
    return "任务面板";
  }
  return label;
}

export function ChatSessionHeader(input: {
  isGroup: boolean;
  groupTopic: string | null;
  groupTitle: string;
  groupSubtitle?: string | null;
  groupSummaryItems?: ChatSessionHeaderSummaryItem[];
  groupMission?: ChatSessionHeaderGroupMission | null;
  emp: EmployeeRef | null;
  isArchiveView: boolean;
  showRequirementStatus: boolean;
  headerStatusBadgeClass: string;
  effectiveStatusLabel: string;
  sessionExecution: ResolvedExecutionState;
  sessionKey: string | null;
  connected: boolean;
  isSyncStale?: boolean;
  historyLoading: boolean;
  canShowSessionHistory: boolean;
  isHistoryMenuOpen: boolean;
  setIsHistoryMenuOpen: (open: boolean) => void;
  archiveId: string | null;
  sending: boolean;
  isGenerating: boolean;
  supportsSessionHistory: boolean;
  supportsSessionArchiveRestore: boolean;
  recentAgentSessions: GatewaySessionRow[];
  historySessionPresentations: Map<string, { title: string; route: string }>;
  historyRoundItems: HistoryRoundItem[];
  archiveSectionNotice: string | null;
  deletingHistorySessionKey: string | null;
  deletingArchiveId: string | null;
  restoringArchiveId: string | null;
  activeArchivedRound: RoundRecord | null;
  activeRunId: string | null;
  onNavigateToCurrentConversation: () => void;
  onNavigateToRoute: (route: string) => void;
  onNavigateToArchivedRound: (archiveId: string) => void;
  onClearSession: (mode?: "new") => Promise<unknown> | void;
  onDeleteRecentSession: (sessionKey: string) => Promise<unknown> | void;
  onRestoreArchivedRound: (archiveId: string) => Promise<unknown> | void;
  onDeleteArchivedRound: (archiveId: string) => Promise<unknown> | void;
  onStopTask: (sessionKey: string, activeRunId?: string) => void;
}) {
  const {
    isGroup,
    groupTopic,
    groupTitle,
    groupSubtitle,
    groupSummaryItems = [],
    groupMission = null,
    emp,
    isArchiveView,
    showRequirementStatus,
    headerStatusBadgeClass,
    effectiveStatusLabel,
    sessionExecution,
    sessionKey,
    connected,
    isSyncStale,
    historyLoading,
    canShowSessionHistory,
    isHistoryMenuOpen,
    setIsHistoryMenuOpen,
    archiveId,
    sending,
    isGenerating,
    supportsSessionHistory,
    supportsSessionArchiveRestore,
    recentAgentSessions,
    historySessionPresentations,
    historyRoundItems,
    archiveSectionNotice,
    deletingHistorySessionKey,
    deletingArchiveId,
    restoringArchiveId,
    activeArchivedRound,
    activeRunId,
    onNavigateToCurrentConversation,
    onNavigateToRoute,
    onNavigateToArchivedRound,
    onClearSession,
    onDeleteRecentSession,
    onRestoreArchivedRound,
    onDeleteArchivedRound,
    onStopTask,
  } = input;

  const showIntegratedGroupMission = !isArchiveView && Boolean(groupMission);
  const showGroupSettledMeta = Boolean(groupMission?.showSettledRequirementSummary);
  const showOverflowMenu = Boolean(groupMission?.isCollaborationMode && groupMission?.primaryOpenAction);
  const identityTitle = isGroup ? "需求团队房间" : emp?.nickname ?? "当前会话";
  const identitySubtitle = isArchiveView ? "归档轮次（只读）" : null;
  const missionMetaItems =
    showIntegratedGroupMission && groupMission
      ? [
          ...groupSummaryItems,
          showGroupSettledMeta && groupMission.settledRequirementNextAction
            ? {
                label: "下一步",
                value: groupMission.settledRequirementNextAction,
              }
            : null,
        ].filter((item): item is ChatSessionHeaderSummaryItem => Boolean(item))
      : [];
  const summaryRailItems =
    showIntegratedGroupMission && groupMission
      ? [
          ...(showGroupSettledMeta && groupMission.settledRequirementSummary
            ? [
                {
                  label: groupMission.settledRequirementSummaryLabel ?? "收敛",
                  value: groupMission.settledRequirementSummary,
                  emphasis: "primary" as const,
                },
              ]
            : []),
          ...missionMetaItems.map((item) => ({
            ...item,
            emphasis:
              item.label === "当前阻塞"
                ? ("warning" as const)
                : item.label === "下一步"
                  ? ("muted" as const)
                  : ("default" as const),
          })),
        ]
      : [];

  const sessionControlRail = (
    <div className="flex items-center gap-1.5">
      <div
        className={cn(
          "inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-medium",
          sessionKey && connected && !isSyncStale
            ? "bg-emerald-50 text-emerald-700"
            : sessionKey && isSyncStale
              ? "bg-amber-50 text-amber-700"
              : "bg-slate-100 text-slate-500",
        )}
      >
        {sessionKey && connected && !isSyncStale ? (
          <>
            <div className="h-1.5 w-1.5 animate-pulse rounded-full bg-green-500" />
            <span className="select-none">已连接</span>
          </>
        ) : sessionKey && isSyncStale ? (
          <>
            <div className="h-1.5 w-1.5 rounded-full bg-amber-500" />
            <span className="select-none">可能过期</span>
          </>
        ) : (
          <>
            <div className="h-1.5 w-1.5 rounded-full bg-slate-300" />
            <span className="select-none">准备中</span>
          </>
        )}
      </div>
      {!isGroup && (historyLoading || canShowSessionHistory) ? (
        <ChatHistoryMenu
          open={isHistoryMenuOpen}
          onOpenChange={setIsHistoryMenuOpen}
          isArchiveView={isArchiveView}
          sessionKey={sessionKey}
          archiveId={archiveId}
          sending={sending}
          isGenerating={isGenerating}
          historyLoading={historyLoading}
          supportsSessionHistory={supportsSessionHistory}
          supportsSessionArchives={supportsSessionArchiveRestore}
          recentAgentSessions={recentAgentSessions}
          historySessionPresentations={historySessionPresentations}
          historyRoundItems={historyRoundItems}
          archiveSectionNotice={archiveSectionNotice}
          deletingHistorySessionKey={deletingHistorySessionKey}
          deletingArchiveId={deletingArchiveId}
          restoringArchiveId={restoringArchiveId}
          navigateToCurrentConversation={onNavigateToCurrentConversation}
          navigateToRoute={onNavigateToRoute}
          navigateToArchivedRound={onNavigateToArchivedRound}
          onClearSession={() => onClearSession("new")}
          onDeleteRecentSession={onDeleteRecentSession}
          onRestoreArchivedRound={onRestoreArchivedRound}
          onDeleteArchivedRound={onDeleteArchivedRound}
        />
      ) : null}
      {sessionKey ? (
        <button
          onClick={() => void onClearSession()}
          disabled={sending || isGenerating}
          className="rounded-xl p-2 text-slate-400 transition-colors hover:bg-red-50 hover:text-red-500"
          title="一键清理对话记忆"
        >
          <Trash2 className="h-4 w-4" />
        </button>
      ) : null}
      {isGenerating && sessionKey ? (
        <button
          onClick={() => onStopTask(sessionKey, activeRunId ?? undefined)}
          className="cursor-pointer rounded-xl p-2 text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-600"
          title="强行中止所有下级进程"
        >
          <RefreshCcw className="h-3.5 w-3.5" />
        </button>
      ) : null}
    </div>
  );

  return (
    <>
      <header className="z-10 flex-none border-b border-slate-200/70 bg-white/92 backdrop-blur supports-[backdrop-filter]:bg-white/78">
        <div className="px-4 py-2.5 lg:px-6">
          <div className="flex items-start gap-3">
            <Avatar className="h-9 w-9 rounded-2xl border border-slate-200/80 bg-white shadow-[0_4px_12px_rgba(15,23,42,0.06)]">
              <AvatarImage
                src={
                  isGroup
                    ? `https://api.dicebear.com/7.x/shapes/svg?seed=${groupTopic}`
                    : getAvatarUrl(emp?.agentId, emp?.avatarJobId)
                }
                className="object-cover"
              />
              <AvatarFallback className="rounded-2xl bg-slate-100 font-mono text-xs text-slate-500">
                {isGroup ? "GRP" : emp?.nickname.slice(0, 2)}
              </AvatarFallback>
            </Avatar>
            <div className="min-w-0 flex-1 space-y-2">
              {showIntegratedGroupMission && groupMission ? (
                <>
                  <div className="flex flex-col gap-2 xl:flex-row xl:items-start xl:justify-between">
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-[11px] text-slate-500">
                        <span className="font-semibold tracking-[0.02em] text-slate-800">{identityTitle}</span>
                        {identitySubtitle ? <span className="text-slate-300">{identitySubtitle}</span> : null}
                        {groupMission.contextTagLabel ? (
                          <span className="rounded-full border border-slate-200/80 bg-slate-50 px-2 py-0.5 font-medium text-slate-600">
                            {groupMission.contextTagLabel}
                          </span>
                        ) : null}
                        <span className="min-w-0 max-w-[42rem] truncate text-[0.98rem] font-semibold leading-tight tracking-[-0.02em] text-slate-950 lg:max-w-[38rem] lg:text-[1rem]">
                          {groupMission.headline}
                        </span>
                        <span
                          className={cn(
                            "inline-flex items-center gap-1.5 rounded-full border px-2 py-0.5 font-medium",
                            getMissionToneClass(groupMission.tone),
                          )}
                        >
                          <span className={cn("h-1.5 w-1.5 rounded-full", getMissionToneDotClass(groupMission.tone))} />
                          {groupMission.statusLabel}
                        </span>
                      </div>
                    </div>
                    <div className="flex shrink-0 flex-wrap items-center justify-end gap-2 xl:ml-4 xl:max-w-[42rem]">
                      <div className="flex flex-wrap items-center gap-1 rounded-[1.05rem] border border-slate-200/80 bg-white/92 p-1 shadow-[0_8px_24px_rgba(15,23,42,0.06)]">
                        {groupMission.primaryOpenAction && !groupMission.isCollaborationMode ? (
                          <Button
                            type="button"
                            size="sm"
                            variant={
                              groupMission.showRequirementTeamEntry
                                ? "outline"
                                : groupMission.primaryOpenAction.kind === "message"
                                  ? "default"
                                  : "outline"
                            }
                            className={
                              groupMission.showRequirementTeamEntry
                                ? "h-8 rounded-full border-transparent bg-transparent px-3 text-[12px] text-slate-700 hover:bg-slate-100 hover:text-slate-950"
                                : groupMission.primaryOpenAction.kind === "message"
                                  ? "h-8 rounded-full bg-slate-950 px-3 text-[12px] text-white shadow-[0_4px_14px_rgba(15,23,42,0.14)] hover:bg-slate-900"
                                  : "h-8 rounded-full border-transparent bg-transparent px-3 text-[12px] text-slate-700 hover:bg-slate-100 hover:text-slate-950"
                            }
                            onClick={() => void groupMission.onRunPrimaryAction(groupMission.primaryOpenAction!)}
                          >
                            {getCompactActionLabel(groupMission.primaryOpenAction.label)}
                          </Button>
                        ) : null}
                        {!groupMission.primaryOpenAction &&
                        groupMission.promotionActionLabel &&
                        groupMission.onRunPromotionAction ? (
                          <Button
                            type="button"
                            size="sm"
                            className="h-8 rounded-full bg-slate-950 px-3 text-[12px] text-white shadow-[0_4px_14px_rgba(15,23,42,0.14)] hover:bg-slate-900"
                            onClick={() => void groupMission.onRunPromotionAction?.()}
                            disabled={sending || isGenerating}
                          >
                            {getCompactActionLabel(groupMission.promotionActionLabel)}
                          </Button>
                        ) : null}
                        {groupMission.showRequirementTeamEntry && !isGroup && groupMission.onOpenRequirementTeam ? (
                          <Button
                            type="button"
                            size="sm"
                            variant={groupMission.hasTeamGroupRoute ? "default" : "outline"}
                            className={
                              groupMission.hasTeamGroupRoute
                                ? "h-8 rounded-full bg-slate-950 px-3 text-[12px] text-white shadow-[0_4px_14px_rgba(15,23,42,0.14)] hover:bg-slate-900"
                                : "h-8 rounded-full border-transparent bg-transparent px-3 text-[12px] text-slate-700 hover:bg-slate-100 hover:text-slate-950"
                            }
                            onClick={groupMission.onOpenRequirementTeam}
                          >
                            {groupMission.hasTeamGroupRoute ? "需求房间" : "需求团队"}
                          </Button>
                        ) : null}
                        {groupMission.hasContextSummary ? (
                          <Button
                            type="button"
                            size="sm"
                            variant="outline"
                            className="h-8 rounded-full border-transparent bg-transparent px-3 text-[12px] text-slate-700 hover:bg-slate-100 hover:text-slate-950"
                            onClick={groupMission.onOpenSummaryPanel}
                          >
                            {groupMission.summaryOpen ? "面板中" : "面板"}
                          </Button>
                        ) : null}
                        {groupMission.missionIsCompleted ? (
                          <Button
                            type="button"
                            size="sm"
                            variant="outline"
                            className="h-8 rounded-full border-transparent bg-emerald-50 px-3 text-[12px] text-emerald-700 hover:bg-emerald-100"
                            onClick={() => void onClearSession()}
                            disabled={sending || isGenerating}
                          >
                            开启下一轮规划/任务
                          </Button>
                        ) : null}
                      </div>
                      <div className="flex flex-wrap items-center gap-1">
                        {showOverflowMenu ? (
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button
                                type="button"
                                size="sm"
                                variant="outline"
                                className="h-8 rounded-full border-transparent bg-transparent px-3 text-[12px] text-slate-600 hover:bg-slate-100 hover:text-slate-900"
                              >
                                <MoreHorizontal className="mr-1.5 h-3.5 w-3.5" />
                                更多
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end" className="z-50 w-56 bg-white">
                              {(() => {
                                const primaryOpenAction = groupMission.primaryOpenAction;
                                if (!primaryOpenAction) {
                                  return null;
                                }
                                return (
                                  <DropdownMenuItem
                                    onClick={() => void groupMission.onRunPrimaryAction(primaryOpenAction)}
                                  >
                                    {primaryOpenAction.label}
                                  </DropdownMenuItem>
                                );
                              })()}
                            </DropdownMenuContent>
                          </DropdownMenu>
                        ) : null}
                        {sessionControlRail}
                      </div>
                    </div>
                  </div>
                  {summaryRailItems.length > 0 ? (
                    <div className="rounded-2xl border border-slate-200/80 bg-[linear-gradient(90deg,rgba(248,250,252,0.96),rgba(241,245,249,0.92))] px-2 py-1.5 shadow-[inset_0_1px_0_rgba(255,255,255,0.7)]">
                      <div className="grid gap-1 lg:grid-cols-[1.7fr_1fr_1.35fr]">
                        {summaryRailItems.map((item, index) => (
                          <div
                            key={`${item.label}-${item.value}`}
                            className={cn(
                              "min-w-0 rounded-xl px-3 py-2",
                              index > 0 ? "lg:border-l lg:border-slate-200/80" : "",
                            )}
                            title={item.value}
                          >
                            <div className="flex items-center gap-2">
                              <span
                                className={cn(
                                  "h-2 w-2 shrink-0 rounded-full",
                                  getSummaryRailAccentClass(item.emphasis),
                                )}
                              />
                              <span className="shrink-0 text-[10px] font-semibold uppercase tracking-[0.12em] text-slate-400">
                                {item.label}
                              </span>
                            </div>
                            <div
                              className={cn(
                                "mt-1 truncate text-sm font-medium leading-5",
                                getSummaryRailItemClass(item.emphasis),
                              )}
                            >
                              {item.value}
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  ) : null}
                </>
              ) : (
                <div className="flex min-h-9 flex-wrap items-center justify-between gap-2">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="text-sm font-semibold tracking-[0.01em] text-slate-900">
                        {isGroup ? groupTitle : emp?.nickname}
                      </span>
                      {isArchiveView ? (
                        <span className="rounded-full border border-slate-200 bg-slate-100 px-2 py-0.5 text-[11px] text-slate-700">
                          已归档
                        </span>
                      ) : showRequirementStatus ? (
                        <span className={headerStatusBadgeClass}>{effectiveStatusLabel}</span>
                      ) : (
                        <ExecutionStateBadge compact status={sessionExecution} />
                      )}
                    </div>
                    {isArchiveView || isGroup ? (
                      <span className="text-[10px] tracking-[0.08em] text-slate-500">
                        {isArchiveView ? "归档轮次（只读）" : groupSubtitle?.trim() || "需求团队房间"}
                      </span>
                    ) : null}
                  </div>
                  {sessionControlRail}
                </div>
              )}
            </div>
          </div>
        </div>
      </header>

      {isArchiveView ? (
        <div className="border-b border-slate-200 bg-slate-50/80 px-4 py-3">
          <div className="mx-auto flex max-w-5xl flex-col gap-1 text-sm text-slate-700 md:flex-row md:items-center md:justify-between">
            <div className="min-w-0">
              <span className="font-semibold text-slate-900">正在查看归档轮次。</span>
              <span className="ml-2 text-slate-600">
                这里只读显示你之前跟 {emp?.nickname ?? "当前 agent"} 的旧记录，不会覆盖当前
                live 会话。
              </span>
            </div>
            <div className="flex shrink-0 items-center gap-2">
              <button
                type="button"
                className="rounded-md border border-slate-900 bg-slate-900 px-3 py-1.5 text-xs text-white transition-colors hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-60"
                onClick={() => void onRestoreArchivedRound(archiveId!)}
                disabled={
                  !sessionKey ||
                  restoringArchiveId === archiveId ||
                  (!activeArchivedRound && !supportsSessionArchiveRestore)
                }
              >
                {restoringArchiveId === archiveId ? "正在恢复..." : "恢复为当前会话"}
              </button>
              <button
                type="button"
                className="rounded-md border border-slate-200 bg-white px-3 py-1.5 text-xs text-slate-700 transition-colors hover:bg-slate-100"
                onClick={onNavigateToCurrentConversation}
              >
                返回当前会话
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}
