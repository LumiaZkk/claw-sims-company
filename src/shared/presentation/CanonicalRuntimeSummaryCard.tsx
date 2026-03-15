import { Activity, ArrowRight, Radar, ShieldAlert, TimerReset, Waves } from "lucide-react";
import { useNavigate } from "react-router-dom";
import type { CanonicalRuntimeSummarySurface } from "../../application/runtime-summary";
import { Badge } from "../../ui/badge";
import { Button } from "../../ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "../../ui/card";
import { cn } from "../../lib/utils";

function getSourceBadgeClass(source: CanonicalRuntimeSummarySurface["statusSource"]) {
  if (source === "authority_complete") {
    return "border-emerald-200 bg-emerald-50 text-emerald-700";
  }
  if (source === "authority_partial") {
    return "border-amber-200 bg-amber-50 text-amber-700";
  }
  return "border-rose-200 bg-rose-50 text-rose-700";
}

function getAgentToneClass(tone: CanonicalRuntimeSummarySurface["watchlist"][number]["attention"]) {
  if (tone === "critical") {
    return "border-rose-200 bg-rose-50 text-rose-700";
  }
  if (tone === "watch") {
    return "border-amber-200 bg-amber-50 text-amber-700";
  }
  return "border-emerald-200 bg-emerald-50 text-emerald-700";
}

export function CanonicalRuntimeSummaryCard(props: {
  summary: CanonicalRuntimeSummarySurface | null;
  title?: string;
  description?: string;
  compact?: boolean;
  className?: string;
}) {
  const { summary, title = "运行态总览", description, compact = false, className } = props;
  const navigate = useNavigate();

  if (!summary) {
    return null;
  }

  return (
    <Card className={cn("border-slate-200 bg-white shadow-sm", className)}>
      <CardHeader className={cn("border-b border-slate-100", compact ? "px-4 py-3" : undefined)}>
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <CardTitle className="flex items-center gap-2 text-base">
              <Radar className="h-4 w-4 text-indigo-600" />
              {title}
            </CardTitle>
            <CardDescription>
              {description ?? "统一复用 `/runtime` 的 canonical summary，不再在业务页各自解释状态。"}
            </CardDescription>
          </div>
          <Badge variant="outline" className={getSourceBadgeClass(summary.statusSource)}>
            {summary.statusCoverageLabel}
          </Badge>
        </div>
      </CardHeader>
      <CardContent className={cn("space-y-4", compact ? "p-4" : "p-5")}>
        <div className="rounded-2xl border border-slate-200 bg-slate-50/80 p-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="min-w-0">
              <div className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">当前瓶颈</div>
              <div className="mt-1 truncate text-lg font-black tracking-tight text-slate-950">
                {summary.focusAgent
                  ? `${summary.focusAgent.nickname} · ${summary.focusAgent.currentAssignment}`
                  : "当前没有显著瓶颈"}
              </div>
              <div className="mt-1 line-clamp-2 text-sm leading-6 text-slate-600">
                {summary.focusAgent?.reason ?? summary.statusCoverageDetail}
              </div>
            </div>
            <div className="flex flex-wrap gap-2">
              {summary.focusAgent ? (
                <Button size="sm" variant="outline" onClick={() => navigate(`/chat/${encodeURIComponent(summary.focusAgent!.agentId)}`)}>
                  会话
                </Button>
              ) : null}
              <Button size="sm" onClick={() => navigate("/runtime")}>
                打开总控台
                <ArrowRight className="ml-2 h-3.5 w-3.5" />
              </Button>
            </div>
          </div>
        </div>

        <div className="grid gap-2 md:grid-cols-4">
          <div className="rounded-2xl border border-slate-200 bg-white p-3">
            <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
              <Activity className="h-3.5 w-3.5 text-sky-600" />
              执行中
            </div>
            <div className="mt-2 text-2xl font-black tracking-tight text-slate-950">{summary.executingCount}</div>
          </div>
          <div className="rounded-2xl border border-slate-200 bg-white p-3">
            <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
              <TimerReset className="h-3.5 w-3.5 text-violet-600" />
              待协作
            </div>
            <div className="mt-2 text-2xl font-black tracking-tight text-slate-950">{summary.waitingCount}</div>
          </div>
          <div className="rounded-2xl border border-slate-200 bg-white p-3">
            <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
              <ShieldAlert className="h-3.5 w-3.5 text-rose-600" />
              需介入
            </div>
            <div className="mt-2 text-2xl font-black tracking-tight text-slate-950">{summary.interventionCount}</div>
          </div>
          <div className="rounded-2xl border border-slate-200 bg-white p-3">
            <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
              <Waves className="h-3.5 w-3.5 text-slate-500" />
              无信号
            </div>
            <div className="mt-2 text-2xl font-black tracking-tight text-slate-950">{summary.noSignalCount}</div>
          </div>
        </div>

        <div className="grid gap-2 xl:grid-cols-[minmax(0,1.4fr)_minmax(220px,0.8fr)]">
          <div className="rounded-2xl border border-slate-200 bg-white p-3">
            <div className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">覆盖说明</div>
            <div className="mt-2 text-sm leading-6 text-slate-600">{summary.statusCoverageDetail}</div>
          </div>
          <div className="rounded-2xl border border-slate-200 bg-white p-3">
            <div className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">下一处理对象</div>
            <div className="mt-2 text-sm font-semibold text-slate-900">
              {summary.nextAgent ? `${summary.nextAgent.nickname} · ${summary.nextAgent.currentAssignment}` : "当前没有新的待处理对象"}
            </div>
          </div>
        </div>

        {summary.watchlist.length > 0 ? (
          <div className="space-y-2">
            <div className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">关注队列</div>
            <div className="grid gap-2 xl:grid-cols-2">
              {summary.watchlist.slice(0, compact ? 2 : 4).map((agent) => (
                <button
                  key={agent.agentId}
                  type="button"
                  onClick={() => navigate(`/chat/${encodeURIComponent(agent.agentId)}`)}
                  className="rounded-2xl border border-slate-200 bg-slate-50/80 px-3 py-2 text-left transition hover:border-slate-300 hover:bg-slate-100/80"
                >
                  <div className="flex items-center justify-between gap-2">
                    <div className="truncate text-sm font-semibold text-slate-950">{agent.nickname}</div>
                    <Badge variant="outline" className={getAgentToneClass(agent.attention)}>
                      {agent.attention === "critical" ? "需介入" : "关注"}
                    </Badge>
                  </div>
                  <div className="mt-1 truncate text-xs text-slate-600">{agent.currentAssignment}</div>
                  <div className="mt-1 line-clamp-2 text-xs leading-5 text-slate-500">{agent.reason}</div>
                </button>
              ))}
            </div>
          </div>
        ) : null}
      </CardContent>
    </Card>
  );
}
