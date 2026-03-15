import { Activity, PauseCircle, PlayCircle } from "lucide-react";
import { Badge } from "../../../ui/badge";
import { Button } from "../../../ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "../../../ui/card";
import { formatTime } from "../../../lib/utils";
import type { ContinuousOpsRuntimeSummary } from "../../../application/automation/continuous-ops-runtime";
import type { CompanyHeartbeatSurface } from "../../../application/org";
import { ContinuousOpsRuntimeCard } from "../../../shared/presentation/ContinuousOpsRuntimeCard";
import { HeartbeatAuditList } from "../../../shared/presentation/HeartbeatAuditList";

function getHeartbeatTone(status: CompanyHeartbeatSurface["status"]) {
  if (status === "disabled") {
    return "border-slate-200 bg-white text-slate-600";
  }
  if (status === "paused") {
    return "border-amber-200 bg-amber-50 text-amber-700";
  }
  if (status === "scheduled") {
    return "border-emerald-200 bg-emerald-50 text-emerald-700";
  }
  return "border-sky-200 bg-sky-50 text-sky-700";
}

export function RequirementHeartbeatCard(props: {
  heartbeat: CompanyHeartbeatSurface;
  opsRuntime?: ContinuousOpsRuntimeSummary;
  onOpenSettings: () => void;
}) {
  const { heartbeat, opsRuntime, onOpenSettings } = props;

  return (
    <Card className="border-slate-200 bg-white shadow-sm">
      <CardHeader className="border-b bg-slate-50/70">
        <CardTitle className="flex items-center gap-2 text-base">
          <Activity className="h-4 w-4 text-sky-600" />
          CEO 巡检
        </CardTitle>
        <CardDescription>
          业务 heartbeat 以当前系统为权威源，OpenClaw 只负责执行/唤醒，不再维护第二套配置真相。
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4 p-4">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="space-y-1">
            <div className="text-sm font-semibold text-slate-950">{heartbeat.title}</div>
            <div className="text-sm leading-6 text-slate-600">{heartbeat.summary}</div>
            <div className="text-xs leading-5 text-slate-500">{heartbeat.detail}</div>
          </div>
          <Badge variant="outline" className={getHeartbeatTone(heartbeat.status)}>
            {heartbeat.paused ? "已暂停" : heartbeat.enabled ? "系统托管" : "已关闭"}
          </Badge>
        </div>

        <div className="grid gap-3 sm:grid-cols-2">
          <div className="rounded-2xl border border-slate-200 bg-slate-50/70 px-4 py-3 text-sm">
            <div className="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-500">最近巡检</div>
            <div className="mt-2 font-semibold text-slate-950">{formatTime(heartbeat.lastRunAt)}</div>
            <div className="mt-1 text-xs text-slate-500">
              最近检查 {formatTime(heartbeat.lastCheckAt)} · 触发方式 {heartbeat.lastTrigger ?? "--"}
            </div>
          </div>
          <div className="rounded-2xl border border-slate-200 bg-slate-50/70 px-4 py-3 text-sm">
            <div className="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-500">下一轮</div>
            <div className="mt-2 font-semibold text-slate-950">{formatTime(heartbeat.nextRunAt)}</div>
            <div className="mt-1 text-xs text-slate-500">
              周期 {heartbeat.intervalMinutes} 分钟 · 护栏 {heartbeat.budgetTitle}
            </div>
          </div>
        </div>

        {heartbeat.recentActions.length > 0 ? (
          <div className="rounded-2xl border border-slate-200 bg-slate-50/70 p-4">
            <div className="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-500">最近动作</div>
            <div className="mt-2 space-y-2 text-sm text-slate-700">
              {heartbeat.recentActions.slice(0, 3).map((action) => (
                <div key={action}>- {action}</div>
              ))}
            </div>
          </div>
        ) : null}

        <HeartbeatAuditList
          entries={heartbeat.recentAudit}
          className="rounded-2xl border border-slate-200 bg-slate-50/70 p-4"
        />

        <div className="flex flex-wrap gap-2">
          <Badge variant="outline" className="border-slate-200 bg-white text-slate-600">
            权威源 {heartbeat.sourceOfTruth}
          </Badge>
          <Badge variant="outline" className="border-slate-200 bg-white text-slate-600">
            同步目标 {heartbeat.syncTarget}
          </Badge>
          {heartbeat.paused ? (
            <Badge variant="outline" className="border-amber-200 bg-amber-50 text-amber-700">
              <PauseCircle className="mr-1 h-3.5 w-3.5" />
              暂停中
            </Badge>
          ) : (
            <Badge variant="outline" className="border-emerald-200 bg-emerald-50 text-emerald-700">
              <PlayCircle className="mr-1 h-3.5 w-3.5" />
              运行中
            </Badge>
          )}
        </div>

        <Button variant="outline" onClick={onOpenSettings}>
          管理 heartbeat 策略
        </Button>

        {opsRuntime ? <ContinuousOpsRuntimeCard summary={opsRuntime} /> : null}
      </CardContent>
    </Card>
  );
}
