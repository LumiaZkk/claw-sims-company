import { History, RefreshCcw, Trash2 } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "../../../components/ui/dropdown-menu";
import type { GatewaySessionRow } from "../../../application/gateway";
import {
  getHistoryRoundBadgeLabel,
  type HistoryRoundItem,
} from "../../../application/mission/history/round-history";
import { resolveSessionTitle, resolveSessionUpdatedAt } from "../../../lib/sessions";
import { cn, formatTime } from "../../../lib/utils";

export function ChatHistoryMenu(input: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  isArchiveView: boolean;
  sessionKey: string | null;
  archiveId: string | null;
  sending: boolean;
  isGenerating: boolean;
  historyLoading: boolean;
  supportsSessionHistory: boolean;
  supportsSessionArchives: boolean;
  recentAgentSessions: GatewaySessionRow[];
  historySessionPresentations: Map<string, { title: string; route: string }>;
  historyRoundItems: HistoryRoundItem[];
  archiveSectionNotice: string | null;
  deletingHistorySessionKey: string | null;
  deletingArchiveId: string | null;
  restoringArchiveId: string | null;
  navigateToCurrentConversation: () => void;
  navigateToRoute: (route: string) => void;
  navigateToArchivedRound: (archiveId: string) => void;
  onClearSession: () => Promise<unknown> | void;
  onDeleteRecentSession: (sessionKey: string) => Promise<unknown> | void;
  onRestoreArchivedRound: (archiveId: string) => Promise<unknown> | void;
  onDeleteArchivedRound: (archiveId: string) => Promise<unknown> | void;
}) {
  return (
    <DropdownMenu open={input.open} onOpenChange={input.onOpenChange}>
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          className="inline-flex h-8 w-8 items-center justify-center rounded-full text-slate-500 transition-colors hover:bg-slate-100 hover:text-slate-900"
          title="查看并切换历史会话"
          aria-label="历史会话"
        >
          <History className="h-3.5 w-3.5" />
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="z-50 w-80 bg-white">
        <DropdownMenuLabel>当前 agent 的历史记录</DropdownMenuLabel>
        {input.isArchiveView ? (
          <DropdownMenuItem
            onClick={input.navigateToCurrentConversation}
            className="flex items-center justify-between gap-3"
          >
            <span>返回当前会话</span>
            <span className="text-[11px] text-slate-400">live</span>
          </DropdownMenuItem>
        ) : null}
        <DropdownMenuItem
          onClick={() => void input.onClearSession()}
          disabled={!input.sessionKey || input.sending || input.isGenerating}
          className="flex items-center justify-between gap-3"
        >
          <span>开启新会话</span>
          <span className="text-[11px] text-slate-400">/new</span>
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        {input.historyLoading ? (
          <DropdownMenuItem disabled>正在加载历史会话...</DropdownMenuItem>
        ) : (
          <>
            <DropdownMenuLabel className="text-[11px] text-slate-400">当前会话</DropdownMenuLabel>
            {!input.supportsSessionHistory ? (
              <DropdownMenuItem
                disabled
                className="whitespace-normal text-[11px] leading-5 text-slate-500"
              >
                当前后端暂不支持历史会话列表。
              </DropdownMenuItem>
            ) : input.recentAgentSessions.length === 0 ? (
              <DropdownMenuItem disabled>暂无当前会话</DropdownMenuItem>
            ) : (
              input.recentAgentSessions.map((session) => {
                const isCurrentLiveSession = session.key === input.sessionKey && !input.isArchiveView;
                const presentation = input.historySessionPresentations.get(session.key);
                return (
                  <div
                    key={session.key}
                    className={cn(
                      "flex items-start gap-2 rounded-md px-2 py-2",
                      isCurrentLiveSession ? "bg-slate-50" : "hover:bg-slate-50",
                    )}
                  >
                    <button
                      type="button"
                      disabled={isCurrentLiveSession}
                      onClick={() =>
                        input.navigateToRoute(
                          presentation?.route ?? `/chat/${encodeURIComponent(session.key)}`,
                        )
                      }
                      className="min-w-0 flex-1 text-left disabled:cursor-default"
                    >
                      <div className="flex w-full items-center justify-between gap-2">
                        <span className="line-clamp-1 text-sm font-medium text-slate-800">
                          {presentation?.title ?? resolveSessionTitle(session)}
                        </span>
                        {isCurrentLiveSession ? (
                          <span className="rounded-full border border-indigo-200 bg-indigo-50 px-2 py-0.5 text-[10px] text-indigo-700">
                            当前
                          </span>
                        ) : null}
                      </div>
                      <div className="line-clamp-1 w-full text-[11px] text-slate-500">
                        最后活跃于 {formatTime(resolveSessionUpdatedAt(session) || undefined)}
                      </div>
                    </button>
                    {!isCurrentLiveSession ? (
                      <button
                        type="button"
                        disabled={input.deletingHistorySessionKey === session.key}
                        onClick={() => void input.onDeleteRecentSession(session.key)}
                        className="rounded-md border border-slate-200 bg-white p-1.5 text-slate-400 transition-colors hover:bg-red-50 hover:text-red-600 disabled:opacity-50"
                        title="删除这条历史会话"
                      >
                        {input.deletingHistorySessionKey === session.key ? (
                          <RefreshCcw className="h-3.5 w-3.5 animate-spin" />
                        ) : (
                          <Trash2 className="h-3.5 w-3.5" />
                        )}
                      </button>
                    ) : null}
                  </div>
                );
              })
            )}
            <DropdownMenuSeparator />
            <DropdownMenuLabel className="text-[11px] text-slate-400">归档轮次</DropdownMenuLabel>
            {input.historyRoundItems.length === 0 && !input.supportsSessionArchives ? (
              <DropdownMenuItem
                disabled
                className="whitespace-normal text-[11px] leading-5 text-slate-500"
              >
                当前后端暂不支持归档轮次。
              </DropdownMenuItem>
            ) : input.archiveSectionNotice ? (
              <DropdownMenuItem
                disabled
                className="whitespace-normal text-[11px] leading-5 text-amber-700"
              >
                {input.archiveSectionNotice}
              </DropdownMenuItem>
            ) : input.historyRoundItems.length === 0 ? (
              <DropdownMenuItem disabled>暂无归档轮次</DropdownMenuItem>
            ) : (
              input.historyRoundItems.map((archive) => {
                const isCurrentArchive = archive.id === input.archiveId;
                const canRestoreArchive =
                  Boolean(input.sessionKey) &&
                  (archive.source === "product" || input.supportsSessionArchives);
                return (
                  <div
                    key={archive.id}
                    className={cn(
                      "flex items-start gap-2 rounded-md px-2 py-2",
                      isCurrentArchive ? "bg-slate-50" : "hover:bg-slate-50",
                    )}
                  >
                    <button
                      type="button"
                      disabled={isCurrentArchive}
                      onClick={() => input.navigateToArchivedRound(archive.id)}
                      className="min-w-0 flex-1 text-left disabled:cursor-default"
                    >
                      <div className="flex w-full items-center justify-between gap-2">
                        <span className="line-clamp-1 text-sm font-medium text-slate-800">
                          {archive.title || archive.fileName}
                        </span>
                        <div className="flex items-center gap-1">
                          <span className="rounded-full border border-slate-200 bg-white px-2 py-0.5 text-[10px] text-slate-700">
                            {getHistoryRoundBadgeLabel(archive)}
                          </span>
                          {isCurrentArchive ? (
                            <span className="rounded-full border border-indigo-200 bg-indigo-50 px-2 py-0.5 text-[10px] text-indigo-700">
                              查看中
                            </span>
                          ) : null}
                        </div>
                      </div>
                      <div className="line-clamp-1 w-full text-[11px] text-slate-500">
                        归档于 {formatTime(archive.archivedAt)}
                        {archive.preview ? ` · ${archive.preview}` : ""}
                      </div>
                    </button>
                    <button
                      type="button"
                      disabled={!canRestoreArchive || input.restoringArchiveId === archive.id}
                      onClick={() => void input.onRestoreArchivedRound(archive.id)}
                      className="rounded-md border border-slate-200 bg-white px-2 py-1 text-[11px] font-medium text-slate-500 transition-colors hover:bg-slate-50 hover:text-slate-700 disabled:opacity-50"
                      title="把这条归档恢复成当前会话"
                    >
                      {input.restoringArchiveId === archive.id ? "恢复中" : "恢复"}
                    </button>
                    <button
                      type="button"
                      disabled={input.deletingArchiveId === archive.id}
                      onClick={() => void input.onDeleteArchivedRound(archive.id)}
                      className="rounded-md border border-slate-200 bg-white p-1.5 text-slate-400 transition-colors hover:bg-red-50 hover:text-red-600 disabled:opacity-50"
                      title="删除这条归档轮次"
                    >
                      {input.deletingArchiveId === archive.id ? (
                        <RefreshCcw className="h-3.5 w-3.5 animate-spin" />
                      ) : (
                        <Trash2 className="h-3.5 w-3.5" />
                      )}
                    </button>
                  </div>
                );
              })
            )}
          </>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
