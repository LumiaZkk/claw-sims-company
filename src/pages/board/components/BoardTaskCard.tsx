import { Clock, MessageSquare, Users } from "lucide-react";
import type { BoardTaskItem } from "../../../application/mission/board-task-surface";
import { resolveConversationPresentation } from "../../../lib/chat-routes";
import { formatTime } from "../../../lib/utils";
import { Badge } from "../../../ui/badge";
import { Button } from "../../../ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "../../../ui/card";
import { ExecutionStateBadge } from "../../../shared/presentation/execution-state-badge";

type BoardTaskCardProps = {
  item: BoardTaskItem;
  activeRoomRecords: Parameters<typeof resolveConversationPresentation>[0]["rooms"];
  activeCompanyEmployees: Parameters<typeof resolveConversationPresentation>[0]["employees"];
  onOpenRoute: (route: string) => void;
  isArchived?: boolean;
  orderLabel?: string;
};

export function BoardTaskCard(props: BoardTaskCardProps) {
  const { item, activeRoomRecords, activeCompanyEmployees, onOpenRoute, isArchived = false, orderLabel } = props;
  const { task, stepSummary, execution, ownerLabel, takeoverPack, focusSummary } = item;
  const { completedSteps, doneCount, total } = stepSummary;
  const pct = total > 0 ? Math.round((doneCount / total) * 100) : 0;
  const isComplete = execution.state === "completed";

  return (
    <Card
      className={`overflow-hidden transition-shadow hover:shadow-lg ${
        isArchived
          ? "border-slate-200 bg-slate-50 opacity-80"
          : isComplete
            ? "border-emerald-200 bg-emerald-50/30"
            : stepSummary.wipCount > 0
              ? "border-indigo-200 bg-white"
              : "border-slate-200 bg-white"
      }`}
    >
      <CardHeader className="pb-3 border-b">
        <div className="flex items-start justify-between">
          <div className="min-w-0 flex-1">
            {orderLabel ? (
              <div className="mb-2 text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-400">
                {orderLabel}
              </div>
            ) : null}
            <CardTitle
              className={`text-sm font-bold line-clamp-2 leading-relaxed ${
                isArchived ? "text-slate-600" : "text-slate-900"
              }`}
            >
              {task.title}
            </CardTitle>
            <div className="flex items-center gap-2 mt-2 flex-wrap">
              <Badge variant="outline" className="text-[10px] bg-slate-50 gap-1">
                <Users className="w-3 h-3" />
                负责人: {ownerLabel}
              </Badge>
              <ExecutionStateBadge compact status={execution} />
              {task.assigneeAgentIds?.length ? (
                <Badge variant="outline" className="text-[10px] bg-slate-50 gap-1">
                  协作 {task.assigneeAgentIds.length}
                </Badge>
              ) : null}
              {takeoverPack ? (
                <Badge
                  variant="outline"
                  className="text-[10px] border-amber-200 bg-amber-50 text-amber-800"
                >
                  需人工接管
                </Badge>
              ) : null}
              <Badge variant="outline" className="text-[10px] bg-slate-50 gap-1">
                <Clock className="w-3 h-3" />
                {formatTime(task.updatedAt)}
              </Badge>
            </div>
          </div>
          <div className="flex flex-col items-end gap-1 ml-2">
            <Badge
              variant={isComplete ? "default" : "secondary"}
              className={
                isComplete
                  ? isArchived
                    ? "bg-slate-400 text-white text-[10px]"
                    : "bg-emerald-600 text-white text-[10px]"
                  : "text-[10px]"
              }
            >
              {isComplete ? "✓ 已完成" : `${doneCount}/${total}`}
            </Badge>
            {!isArchived ? <span className="text-[10px] text-slate-400 font-mono">{pct}%</span> : null}
          </div>
        </div>
        {!isArchived ? (
          <>
            <div className="mt-3 text-[11px] font-medium leading-5 text-slate-700">
              {focusSummary.currentWork}
            </div>
            <div className="mt-1 text-[11px] leading-5 text-slate-500">下一步：{focusSummary.nextStep}</div>
            {focusSummary.blockReason ? (
              <div className="mt-1 text-[11px] leading-5 text-rose-700">
                当前卡点：{focusSummary.blockReason}
              </div>
            ) : null}
            <div className="w-full h-1.5 bg-slate-100 rounded-full overflow-hidden mt-3">
              <div
                className="h-full rounded-full transition-all duration-500"
                style={{
                  width: `${pct}%`,
                  background:
                    pct === 100
                      ? "linear-gradient(90deg, #22c55e, #16a34a)"
                      : stepSummary.wipCount > 0
                        ? "linear-gradient(90deg, #22c55e, #6366f1)"
                        : "linear-gradient(90deg, #22c55e, #22d3ee)",
                }}
              />
            </div>
          </>
        ) : null}
      </CardHeader>
      <CardContent className="space-y-4 p-4">
        {!isArchived ? (
          <div className="grid gap-3 md:grid-cols-3">
            <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
              <div className="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-500">
                当前在做
              </div>
              <div className="mt-2 text-sm leading-6 text-slate-900">{focusSummary.currentWork}</div>
            </div>
            <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
              <div className="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-500">
                接下来
              </div>
              <div className="mt-2 text-sm leading-6 text-slate-700">{focusSummary.nextStep}</div>
              {focusSummary.userAction ? (
                <div className="mt-2 text-xs leading-5 text-rose-700">{focusSummary.userAction}</div>
              ) : null}
            </div>
            <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
              <div className="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-500">
                已完成
              </div>
              <div className="mt-2 space-y-2 text-sm leading-6 text-slate-700">
                {completedSteps.length > 0 ? (
                  completedSteps.slice(-3).map((step, index) => (
                    <div key={`${task.id}:done:${index}`} className="line-through text-slate-500">
                      • {step.text}
                    </div>
                  ))
                ) : (
                  <div>还没有完成的子任务</div>
                )}
              </div>
            </div>
          </div>
        ) : null}

        {takeoverPack && !isArchived ? (
          <div className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-[11px] leading-5 text-amber-900">
            <div className="font-semibold">接管建议</div>
            <div className="mt-1">{takeoverPack.recommendedNextAction}</div>
          </div>
        ) : null}

        <details className="rounded-xl border border-slate-200 bg-white">
          <summary className="cursor-pointer list-none px-3 py-2 text-xs font-medium text-slate-600 [&::-webkit-details-marker]:hidden">
            查看全部子任务（{total}）
          </summary>
          <ul className="divide-y divide-slate-100 border-t border-slate-200">
            {task.steps.map((step, index) => {
              const assignee = step.assignee?.replace(/^@/, "") || null;
              return (
                <li
                  key={`${task.id}:step:${index}`}
                  className={`flex items-center gap-3 px-4 py-2.5 text-xs ${
                    step.status === "done"
                      ? "bg-emerald-50/30"
                      : step.status === "wip"
                        ? "bg-indigo-50/40"
                        : ""
                  }`}
                >
                  <span className="shrink-0 text-sm">
                    {step.status === "done" ? "✅" : step.status === "wip" ? "🔄" : "⏳"}
                  </span>
                  <span
                    className={`flex-1 leading-relaxed break-words break-all sm:break-normal ${
                      step.status === "done"
                        ? "line-through text-slate-400"
                        : step.status === "wip"
                          ? "text-indigo-800 font-semibold"
                          : "text-slate-600"
                    }`}
                  >
                    {step.text}
                  </span>
                  {assignee ? (
                    <Badge
                      variant="outline"
                      className={`text-[9px] shrink-0 px-1.5 ${
                        step.status === "done"
                          ? "bg-slate-50 text-slate-400 border-slate-200"
                          : step.status === "wip"
                            ? "bg-indigo-50 text-indigo-700 border-indigo-200"
                            : "bg-slate-50 text-slate-500"
                      }`}
                    >
                      @{assignee}
                    </Badge>
                  ) : null}
                </li>
              );
            })}
          </ul>
        </details>

        <div className="border-t pt-3 flex justify-end">
          {takeoverPack ? (
            <Button
              variant="ghost"
              size="sm"
              className="h-7 text-xs px-2 text-amber-700 hover:bg-amber-50"
              onClick={() =>
                onOpenRoute(
                  resolveConversationPresentation({
                    sessionKey: task.sessionKey,
                    actorId: task.ownerAgentId ?? task.agentId ?? null,
                    rooms: activeRoomRecords,
                    employees: activeCompanyEmployees,
                  }).route,
                )
              }
            >
              查看接管包
            </Button>
          ) : null}
          <Button
            variant="ghost"
            size="sm"
            className="h-7 text-xs px-2 text-indigo-500 hover:bg-indigo-50"
            onClick={() => {
              if (task.source === "file" && task.sourceAgentId) {
                onOpenRoute(`/chat/${encodeURIComponent(task.sourceAgentId)}`);
                return;
              }
              onOpenRoute(
                resolveConversationPresentation({
                  sessionKey: task.sessionKey,
                  actorId: task.sourceAgentId ?? task.ownerAgentId ?? task.agentId ?? null,
                  rooms: activeRoomRecords,
                  employees: activeCompanyEmployees,
                }).route,
              );
            }}
          >
            <MessageSquare className="w-3 h-3 mr-1" />
            直达会话
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
