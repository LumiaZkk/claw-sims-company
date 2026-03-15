import {
  Activity,
  ChevronRight,
  Clock3,
  Radar,
} from "lucide-react";
import { useNavigate } from "react-router-dom";
import type {
  RuntimeInspectorAgentSurface,
  RuntimeInspectorChainLink,
  RuntimeInspectorHistoryEvent,
  RuntimeInspectorProcessTelemetry,
  RuntimeInspectorRecommendedAction,
  RuntimeInspectorReplayEvent,
  RuntimeInspectorSceneZone,
  RuntimeInspectorStatusSource,
  RuntimeInspectorTimelineEvent,
} from "../../application/runtime-inspector";
import { cn, formatTime } from "../../lib/utils";
import { Badge } from "../../ui/badge";
import { Button } from "../../ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "../../ui/card";
import {
  buildMetrics,
  getActionToneClass,
  getAttentionChipClass,
  getChainBadgeClass,
  getChainToneClass,
  getCoordinationBadgeClass,
  getCoordinationLabel,
  getHistoryToneClass,
  getInterventionBadgeClass,
  getInterventionLabel,
  getProcessBadgeClass,
  getProcessToneClass,
  getReplayBadgeClass,
  getReplayToneClass,
  getRuntimeLabel,
  getRuntimeDotClass,
  getSourceBadgeClass,
  getStatusOriginBadgeClass,
  getStatusOriginLabel,
  getStatusSourceBadgeLabel,
  getTimelineToneClass,
  getZoneStatusClass,
} from "./runtime-inspector-shared";

export function FocusHero(props: {
  agent: RuntimeInspectorAgentSurface | null;
  actions: RuntimeInspectorRecommendedAction[];
}) {
  const { agent, actions } = props;
  const navigate = useNavigate();

  if (!agent) {
    return (
      <Card className="border-slate-200 bg-white shadow-sm">
        <CardContent className="p-4 text-sm text-slate-500">
          当前没有需要聚焦的成员，系统处于平稳观察状态。
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="overflow-hidden border-slate-200 bg-[linear-gradient(135deg,rgba(15,23,42,0.98),rgba(30,41,59,0.94))] text-white shadow-sm">
      <CardContent className="grid gap-4 p-4 lg:grid-cols-[minmax(0,1.4fr)_minmax(280px,0.9fr)]">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <Badge variant="outline" className="border-white/20 bg-white/10 text-white/80">
              当前瓶颈
            </Badge>
            <Badge
              variant="outline"
              className={cn("border-white/10 bg-white/10 text-white", getStatusOriginBadgeClass(agent.statusOrigin))}
            >
              {getStatusOriginLabel(agent.statusOrigin)}
            </Badge>
            <Badge variant="outline" className={cn("border-white/10 bg-white/10 text-white", getCoordinationBadgeClass(agent))}>
              {getCoordinationLabel(agent)}
            </Badge>
            <Badge variant="outline" className={cn("border-white/10 bg-white/10 text-white", getInterventionBadgeClass(agent))}>
              {getInterventionLabel(agent)}
            </Badge>
          </div>
          <div className="mt-3 flex items-center gap-3">
            <span className={cn("h-3 w-3 rounded-full", getRuntimeDotClass(agent))} />
            <div className="min-w-0">
              <div className="truncate text-2xl font-black tracking-tight">{agent.nickname}</div>
              <div className="truncate text-sm text-white/70">
                {agent.role} · {agent.sceneZoneLabel}
              </div>
            </div>
          </div>
          <div className="mt-4 text-sm font-semibold text-white/90">{agent.currentAssignment}</div>
          <div className="mt-2 max-w-3xl text-sm leading-6 text-white/72">{agent.reason}</div>
          <div className="mt-4 flex flex-wrap gap-2">
            {actions.map((action) => (
              <Button
                key={action.id}
                size="sm"
                variant="outline"
                className={cn("border-white/15 bg-white/10 text-white hover:bg-white/15", getActionToneClass(action.tone))}
                onClick={() => navigate(action.to)}
              >
                {action.label}
              </Button>
            ))}
          </div>
        </div>

        <div className="grid gap-2 sm:grid-cols-3 lg:grid-cols-1">
          <div className="rounded-2xl border border-white/10 bg-white/5 p-3">
            <div className="text-[10px] font-semibold uppercase tracking-[0.2em] text-white/50">Runtime</div>
            <div className="mt-2 text-lg font-black">{getRuntimeLabel(agent)}</div>
            <div className="mt-1 text-xs text-white/60">S / R {agent.activeSessionCount} / {agent.activeRunCount}</div>
          </div>
          <div className="rounded-2xl border border-white/10 bg-white/5 p-3">
            <div className="text-[10px] font-semibold uppercase tracking-[0.2em] text-white/50">当前指令</div>
            <div className="mt-2 line-clamp-3 text-sm leading-5 text-white/80">{agent.currentObjective}</div>
          </div>
          <div className="rounded-2xl border border-white/10 bg-white/5 p-3">
            <div className="text-[10px] font-semibold uppercase tracking-[0.2em] text-white/50">最近信号</div>
            <div className="mt-2 text-sm font-semibold text-white">{formatTime(agent.latestSignalAt)}</div>
            <div className="mt-1 text-xs text-white/60">{agent.activityLabel}</div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

export function TheaterStatusBar(props: {
  agent: RuntimeInspectorAgentSurface | null;
  statusSource: RuntimeInspectorStatusSource;
  metrics: ReturnType<typeof buildMetrics>;
  processTelemetry: RuntimeInspectorProcessTelemetry;
  chainLinks: RuntimeInspectorChainLink[];
  broadcastEnabled: boolean;
  broadcastLabel: string;
  nextAgent: RuntimeInspectorAgentSurface | null;
}) {
  const { agent, statusSource, metrics, processTelemetry, chainLinks, broadcastEnabled, broadcastLabel, nextAgent } = props;
  const leadingChain = chainLinks[0] ?? null;
  const interventionMetric = metrics.find((metric) => metric.key === "intervention")?.value ?? 0;
  const waitingMetric = metrics.find((metric) => metric.key === "waiting")?.value ?? 0;

  return (
    <div className="grid gap-2 rounded-[28px] border border-white/12 bg-[linear-gradient(135deg,rgba(2,6,23,0.88),rgba(15,23,42,0.74))] p-2.5 text-white shadow-[0_18px_50px_rgba(15,23,42,0.28)] backdrop-blur-sm lg:grid-cols-[minmax(0,1.1fr)_repeat(4,minmax(0,0.52fr))]">
      <div className="rounded-2xl border border-white/10 bg-white/6 px-3 py-2.5">
        <div className="flex items-center justify-between gap-3">
          <div className="text-[10px] font-semibold uppercase tracking-[0.22em] text-white/45">Theater Feed</div>
          <Badge variant="outline" className={cn("border-white/10 bg-white/8", getSourceBadgeClass(statusSource))}>
            {getStatusSourceBadgeLabel(statusSource)}
          </Badge>
        </div>
        <div className="mt-2 flex items-center gap-2">
          <span className={cn("h-2.5 w-2.5 rounded-full", agent ? getRuntimeDotClass(agent) : "bg-emerald-400")} />
          <div className="truncate text-sm font-semibold text-white">
            {agent ? `${agent.nickname} · ${agent.currentAssignment}` : "当前没有显著瓶颈"}
          </div>
        </div>
        <div className="mt-1 line-clamp-2 text-[11px] leading-5 text-white/60">
          {leadingChain
            ? `${leadingChain.fromLabel} -> ${leadingChain.toLabel} · ${leadingChain.summary}`
            : agent?.reason ?? "系统当前处于平稳观察态。"}
        </div>
      </div>

      <div className="rounded-2xl border border-white/10 bg-white/6 px-3 py-2.5">
        <div className="text-[10px] font-semibold uppercase tracking-[0.22em] text-white/45">Intervention</div>
        <div className="mt-2 text-xl font-black tracking-tight text-white">{interventionMetric}</div>
        <div className="mt-1 text-[11px] text-white/60">当前需介入链路</div>
      </div>

      <div className="rounded-2xl border border-white/10 bg-white/6 px-3 py-2.5">
        <div className="text-[10px] font-semibold uppercase tracking-[0.22em] text-white/45">Waiting</div>
        <div className="mt-2 text-xl font-black tracking-tight text-white">{waitingMetric}</div>
        <div className="mt-1 text-[11px] text-white/60">待协作 / 待输入</div>
      </div>

      <div className="rounded-2xl border border-white/10 bg-white/6 px-3 py-2.5">
        <div className="text-[10px] font-semibold uppercase tracking-[0.22em] text-white/45">Global Process</div>
        <div className="mt-2 text-xl font-black tracking-tight text-white">{processTelemetry.runningCount}</div>
        <div className="mt-1 text-[11px] text-white/60">
          {processTelemetry.capabilityState === "ready"
            ? `运行中 / 共 ${processTelemetry.totalCount}`
            : processTelemetry.capabilityState === "unsupported"
              ? "provider 未开放"
              : processTelemetry.capabilityState === "loading"
                ? "遥测加载中"
                : processTelemetry.capabilityState === "error"
                  ? "遥测异常"
                  : "等待全局遥测"}
        </div>
      </div>

      <div className="rounded-2xl border border-white/10 bg-white/6 px-3 py-2.5">
        <div className="text-[10px] font-semibold uppercase tracking-[0.22em] text-white/45">Broadcast</div>
        <div className="mt-2 flex items-center gap-2">
          <span className={cn("h-2.5 w-2.5 rounded-full", broadcastEnabled ? "bg-cyan-400" : "bg-slate-500")} />
          <div className="text-sm font-black tracking-tight text-white">
            {broadcastEnabled ? `播报中 · ${broadcastLabel}` : "已暂停"}
          </div>
        </div>
        <div className="mt-1 line-clamp-2 text-[11px] text-white/60">
          {nextAgent ? `下一聚焦 ${nextAgent.nickname} · ${nextAgent.currentAssignment}` : "当前只有一个焦点对象。"}
        </div>
      </div>
    </div>
  );
}

export function MissionStrip(props: {
  agent: RuntimeInspectorAgentSurface | null;
  actions: RuntimeInspectorRecommendedAction[];
  metrics: ReturnType<typeof buildMetrics>;
  theater?: boolean;
}) {
  const { agent, actions, metrics, theater = false } = props;
  const navigate = useNavigate();

  return (
    <Card className={cn(
      "overflow-hidden text-white shadow-sm",
      theater
        ? "border-white/12 bg-[linear-gradient(135deg,rgba(15,23,42,0.82),rgba(30,41,59,0.72))] shadow-[0_16px_40px_rgba(15,23,42,0.2)] backdrop-blur-sm"
        : "border-slate-200 bg-[linear-gradient(135deg,rgba(15,23,42,0.98),rgba(30,41,59,0.94))]",
    )}>
      <CardContent className="grid gap-3 p-3 lg:grid-cols-[minmax(0,1.4fr)_minmax(0,0.95fr)] lg:items-center">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <Badge variant="outline" className={cn("border-white/15 text-white/75", theater ? "bg-white/6" : "bg-white/10")}>
              Mission Control
            </Badge>
            <Badge variant="outline" className={cn("border-white/15 text-white/75", theater ? "bg-white/6" : "bg-white/10")}>
              一屏总览
            </Badge>
          </div>
          {agent ? (
            <>
              <div className="mt-2 flex items-center gap-2">
                <span className={cn("h-2.5 w-2.5 rounded-full", getRuntimeDotClass(agent))} />
                <div className="truncate text-lg font-black tracking-tight">
                  {agent.nickname}
                  <span className="ml-2 text-sm font-semibold text-white/55">{agent.sceneZoneLabel}</span>
                </div>
              </div>
              <div className="mt-1 truncate text-sm font-semibold text-white/85">{agent.currentAssignment}</div>
              <div className="mt-1 line-clamp-2 text-xs leading-5 text-white/65">{agent.reason}</div>
            </>
          ) : (
            <div className="mt-2 text-sm text-white/70">当前没有明显瓶颈，系统处于稳定观察态。</div>
          )}
          <div className="mt-3 flex flex-wrap gap-2">
            {actions.slice(0, 3).map((action) => (
              <Button
                key={action.id}
                size="sm"
                variant="outline"
                className={cn("h-8 border-white/15 text-white hover:bg-white/15", theater ? "bg-white/6" : "bg-white/10", getActionToneClass(action.tone))}
                onClick={() => navigate(action.to)}
              >
                {action.label}
              </Button>
            ))}
          </div>
        </div>

        <div className="grid grid-cols-2 gap-2 xl:grid-cols-4">
          {metrics.map((metric) => {
            const Icon = metric.icon;
            return (
              <div key={metric.key} className={cn(
                "rounded-2xl border border-white/10 px-3 py-2 backdrop-blur-sm",
                theater ? "bg-white/[0.04]" : "bg-white/6",
              )}>
                <div className="flex items-center justify-between gap-2">
                  <div className="text-[10px] font-semibold uppercase tracking-[0.18em] text-white/45">{metric.label}</div>
                  <Icon className="h-3.5 w-3.5 text-white/45" />
                </div>
                <div className="mt-1 text-lg font-black tracking-tight text-white">{metric.value}</div>
              </div>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}

export function WatchlistCard(props: {
  agents: RuntimeInspectorAgentSurface[];
  selectedAgentId: string | null;
  onSelect: (agentId: string) => void;
}) {
  const { agents, selectedAgentId, onSelect } = props;
  return (
    <Card className="overflow-hidden border-slate-200 bg-white shadow-sm">
      <CardHeader className="border-b border-slate-100 px-4 py-3">
        <div className="flex items-center justify-between gap-3">
          <div>
            <CardTitle className="text-sm font-black tracking-tight text-slate-950">关注队列</CardTitle>
            <CardDescription>最该盯的等待、升级和恢复链路。</CardDescription>
          </div>
          <Badge variant="outline" className="border-slate-200 bg-slate-50 text-slate-600">
            {agents.length}
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="p-0">
        {agents.length > 0 ? (
          agents.map((agent) => (
            <button
              key={agent.agentId}
              type="button"
              onClick={() => onSelect(agent.agentId)}
              className={cn(
                "flex w-full items-start gap-3 border-b border-slate-100 px-4 py-3 text-left last:border-b-0 hover:bg-slate-50",
                selectedAgentId === agent.agentId ? "bg-sky-50/70" : "bg-white",
              )}
            >
              <span className={cn("mt-1 h-2.5 w-2.5 rounded-full", getRuntimeDotClass(agent))} />
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <div className="truncate text-sm font-semibold text-slate-950">{agent.nickname}</div>
                  <Badge variant="outline" className={cn("h-5 px-1.5 text-[10px]", getInterventionBadgeClass(agent))}>
                    {getInterventionLabel(agent)}
                  </Badge>
                </div>
                <div className="mt-1 truncate text-xs font-medium text-slate-700">{agent.currentAssignment}</div>
                <div className="mt-1 line-clamp-2 text-xs leading-5 text-slate-500">{agent.reason}</div>
              </div>
            </button>
          ))
        ) : (
          <div className="px-4 py-6 text-sm text-slate-500">当前没有需要特别关注的成员。</div>
        )}
      </CardContent>
    </Card>
  );
}

export function TimelineCard(props: {
  items: RuntimeInspectorTimelineEvent[];
  onSelect: (agentId: string) => void;
}) {
  const { items, onSelect } = props;
  return (
    <Card className="overflow-hidden border-slate-200 bg-white shadow-sm">
      <CardHeader className="border-b border-slate-100 px-4 py-3">
        <div className="flex items-center gap-2">
          <Clock3 className="h-4 w-4 text-slate-500" />
          <div>
            <CardTitle className="text-sm font-black tracking-tight text-slate-950">最近信号</CardTitle>
            <CardDescription>优先展示执行、等待、阻塞和恢复事件。</CardDescription>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-0 p-0">
        {items.length > 0 ? (
          items.map((item) => (
            <button
              key={item.id}
              type="button"
              onClick={() => onSelect(item.agentId)}
              className="flex w-full items-start gap-3 border-b border-slate-100 px-4 py-3 text-left last:border-b-0 hover:bg-slate-50"
            >
              <span className={cn("mt-1.5 h-2.5 w-2.5 rounded-full", getTimelineToneClass(item.tone))} />
              <div className="min-w-0 flex-1">
                <div className="flex items-center justify-between gap-3">
                  <div className="truncate text-sm font-semibold text-slate-950">{item.title}</div>
                  <div className="shrink-0 text-[11px] text-slate-400">{formatTime(item.timestamp)}</div>
                </div>
                <div className="mt-1 line-clamp-2 text-xs leading-5 text-slate-500">{item.summary}</div>
              </div>
            </button>
          ))
        ) : (
          <div className="px-4 py-6 text-sm text-slate-500">当前没有可展示的最新事件。</div>
        )}
      </CardContent>
    </Card>
  );
}

export function ZoneHealthCard(props: {
  zones: RuntimeInspectorSceneZone[];
}) {
  const { zones } = props;
  return (
    <Card className="overflow-hidden border-slate-200 bg-white shadow-sm">
      <CardHeader className="border-b border-slate-100 px-4 py-3">
        <div className="flex items-center gap-2">
          <Activity className="h-4 w-4 text-slate-500" />
          <div>
            <CardTitle className="text-sm font-black tracking-tight text-slate-950">区域热力</CardTitle>
            <CardDescription>查看各个区域是否在忙、是否有告警聚集。</CardDescription>
          </div>
        </div>
      </CardHeader>
      <CardContent className="grid gap-2 p-3 sm:grid-cols-2">
        {zones.map((zone) => (
          <div key={zone.id} className="rounded-2xl border border-slate-200 bg-slate-50 p-3">
            <div className="flex items-center justify-between gap-2">
              <div className="min-w-0">
                <div className="truncate text-xs font-semibold uppercase tracking-[0.16em] text-slate-700">
                  {zone.label}
                </div>
                <div className="mt-1 text-[11px] text-slate-500">
                  Busy {zone.busyCount} · Alert {zone.attentionCount}
                </div>
              </div>
              <Badge variant="outline" className={getZoneStatusClass(zone.status)}>
                {zone.status === "critical" ? "警报" : zone.status === "watch" ? "关注" : "平稳"}
              </Badge>
            </div>
          </div>
        ))}
      </CardContent>
    </Card>
  );
}

export function ChainLinksCard(props: {
  items: RuntimeInspectorChainLink[];
  compact?: boolean;
  onSelect: (agentId: string) => void;
}) {
  const { items, compact = false, onSelect } = props;
  const visibleItems = compact ? items.slice(0, 4) : items.slice(0, 6);

  return (
    <Card className="overflow-hidden border-slate-200 bg-white shadow-sm">
      <CardHeader className="border-b border-slate-100 px-4 py-3">
        <div className="flex items-center justify-between gap-3">
          <div>
            <CardTitle className="text-sm font-black tracking-tight text-slate-950">处理链</CardTitle>
            <CardDescription>直接看清当前谁在等谁，哪条链正在执行、等待或升级。</CardDescription>
          </div>
          <Badge variant="outline" className="border-slate-200 bg-slate-50 text-slate-600">
            {items.length}
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-0 p-0">
        {visibleItems.length > 0 ? (
          visibleItems.map((item) => (
            <button
              key={item.id}
              type="button"
              onClick={() => {
                if (item.focusAgentId) {
                  onSelect(item.focusAgentId);
                }
              }}
              className="flex w-full items-start gap-3 border-b border-slate-100 px-4 py-3 text-left last:border-b-0 hover:bg-slate-50"
              title={item.summary}
            >
              <span className={cn("mt-1.5 h-2.5 w-2.5 rounded-full", getChainToneClass(item.tone))} />
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <div className="truncate text-sm font-semibold text-slate-950">
                    {item.fromLabel}
                    <ChevronRight className="mx-1 inline h-3.5 w-3.5 text-slate-400" />
                    {item.toLabel}
                  </div>
                  <Badge variant="outline" className={cn("h-5 px-1.5 text-[10px]", getChainBadgeClass(item.tone))}>
                    {item.stateLabel}
                  </Badge>
                  <Badge variant="outline" className="h-5 border-slate-200 bg-slate-50 px-1.5 text-[10px] text-slate-600">
                    {item.kindLabel}
                  </Badge>
                </div>
                <div className="mt-1 truncate text-xs leading-5 text-slate-500">{item.summary}</div>
              </div>
              <div className="shrink-0 text-[11px] text-slate-400">{formatTime(item.updatedAt)}</div>
            </button>
          ))
        ) : (
          <div className="px-4 py-6 text-sm text-slate-500">当前没有需要特别追踪的协作链。</div>
        )}
      </CardContent>
    </Card>
  );
}

export function ReplayCard(props: {
  items: RuntimeInspectorReplayEvent[];
  compact?: boolean;
  onSelect: (agentId: string) => void;
}) {
  const { items, compact = false, onSelect } = props;
  const visibleItems = compact ? items.slice(0, 4) : items.slice(0, 6);

  return (
    <Card className="overflow-hidden border-slate-200 bg-white shadow-sm">
      <CardHeader className="border-b border-slate-100 px-4 py-3">
        <div className="flex items-center justify-between gap-3">
          <div>
            <CardTitle className="text-sm font-black tracking-tight text-slate-950">运行回放</CardTitle>
            <CardDescription>追踪刚完成、刚失败、或仍在工具链/模型链里执行的关键节点。</CardDescription>
          </div>
          <Badge variant="outline" className="border-slate-200 bg-slate-50 text-slate-600">
            {items.length}
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-0 p-0">
        {visibleItems.length > 0 ? (
          visibleItems.map((item) => (
            <button
              key={item.id}
              type="button"
              onClick={() => onSelect(item.agentId)}
              className="flex w-full items-start gap-3 border-b border-slate-100 px-4 py-3 text-left last:border-b-0 hover:bg-slate-50"
              title={item.summary}
            >
              <span className={cn("mt-1.5 h-2.5 w-2.5 rounded-full", getReplayToneClass(item.tone))} />
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <div className="truncate text-sm font-semibold text-slate-950">{item.title}</div>
                  <Badge variant="outline" className={cn("h-5 px-1.5 text-[10px]", getReplayBadgeClass(item.tone))}>
                    {item.phaseLabel}
                  </Badge>
                  <Badge variant="outline" className="h-5 border-slate-200 bg-slate-50 px-1.5 text-[10px] text-slate-600">
                    {item.modalityLabel}
                  </Badge>
                </div>
                <div className="mt-1 truncate text-xs leading-5 text-slate-500">{item.summary}</div>
              </div>
              <div className="shrink-0 text-[11px] text-slate-400">{formatTime(item.timestamp)}</div>
            </button>
          ))
        ) : (
          <div className="px-4 py-6 text-sm text-slate-500">当前还没有足够高信号的运行回放事件。</div>
        )}
      </CardContent>
    </Card>
  );
}

export function HistoryWindowCard(props: {
  items: RuntimeInspectorHistoryEvent[];
  compact?: boolean;
  onSelect: (agentId: string) => void;
}) {
  const { items, compact = false, onSelect } = props;
  const visibleItems = compact ? items.slice(0, 5) : items.slice(0, 7);

  return (
    <Card className="overflow-hidden border-slate-200 bg-white shadow-sm">
      <CardHeader className="border-b border-slate-100 px-4 py-3">
        <div className="flex items-center justify-between gap-3">
          <div>
            <CardTitle className="text-sm font-black tracking-tight text-slate-950">历史窗口</CardTitle>
            <CardDescription>把回放、处理链和最新信号并成一条总控时间窗。</CardDescription>
          </div>
          <Badge variant="outline" className="border-slate-200 bg-slate-50 text-slate-600">
            {items.length}
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-0 p-0">
        {visibleItems.length > 0 ? (
          visibleItems.map((item) => (
            <button
              key={item.id}
              type="button"
              onClick={() => {
                if (item.agentId) {
                  onSelect(item.agentId);
                }
              }}
              className="flex w-full items-start gap-3 border-b border-slate-100 px-4 py-3 text-left last:border-b-0 hover:bg-slate-50"
              title={item.summary}
            >
              <span className={cn("mt-1.5 h-2.5 w-2.5 rounded-full", getHistoryToneClass(item.tone))} />
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <div className="truncate text-sm font-semibold text-slate-950">{item.label}</div>
                  <Badge variant="outline" className="h-5 border-slate-200 bg-slate-50 px-1.5 text-[10px] text-slate-600">
                    {item.sourceLabel}
                  </Badge>
                </div>
                <div className="mt-1 truncate text-xs leading-5 text-slate-500">{item.summary}</div>
              </div>
              <div className="shrink-0 text-[11px] text-slate-400">{formatTime(item.timestamp)}</div>
            </button>
          ))
        ) : (
          <div className="px-4 py-6 text-sm text-slate-500">当前还没有足够高信号的历史窗口事件。</div>
        )}
      </CardContent>
    </Card>
  );
}

export function LiveProcessCard(props: {
  telemetry: RuntimeInspectorProcessTelemetry;
  compact?: boolean;
}) {
  const { telemetry, compact = false } = props;
  const visibleItems = compact ? telemetry.processes.slice(0, 4) : telemetry.processes.slice(0, 6);
  const title = telemetry.scope === "global" ? "Global Process" : "Focused Process";
  const description =
    telemetry.scope === "global"
      ? "展示全公司当前可观测的后台进程，用来区分局部成员遥测和全局 process 负载。"
      : "把当前聚焦成员的后台进程和工具链从抽象 runtime 里拆出来，单独看清它们是否还在跑。";

  return (
    <Card className="overflow-hidden border-slate-200 bg-white shadow-sm">
      <CardHeader className="border-b border-slate-100 px-4 py-3">
        <div className="flex items-center justify-between gap-3">
          <div>
            <CardTitle className="text-sm font-black tracking-tight text-slate-950">{title}</CardTitle>
            <CardDescription>{description}</CardDescription>
          </div>
          <Badge variant="outline" className="border-slate-200 bg-slate-50 text-slate-600">
            {telemetry.runningCount}/{telemetry.totalCount}
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-0 p-0">
        {telemetry.capabilityState === "loading" ? (
          <div className="px-4 py-6 text-sm text-slate-500">正在拉取 live process 遥测...</div>
        ) : null}
        {telemetry.capabilityState === "unsupported" ? (
          <div className="px-4 py-6 text-sm text-slate-500">
            当前 provider 没有开放 process runtime，这里只保留 canonical runtime 视图。
          </div>
        ) : null}
        {telemetry.capabilityState === "error" ? (
          <div className="px-4 py-6 text-sm text-amber-700">
            拉取 live process 失败。
            <div className="mt-1 text-xs leading-5 text-amber-600">{telemetry.error}</div>
          </div>
        ) : null}
        {telemetry.capabilityState === "ready" && visibleItems.length > 0 ? (
          visibleItems.map((item) => (
            <div
              key={item.processId}
              className="flex items-start gap-3 border-b border-slate-100 px-4 py-3 last:border-b-0"
              title={item.command ?? item.summary}
            >
              <span className={cn("mt-1.5 h-2.5 w-2.5 rounded-full", getProcessToneClass(item.tone))} />
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <div className="truncate text-sm font-semibold text-slate-950">{item.title}</div>
                  <Badge variant="outline" className={cn("h-5 px-1.5 text-[10px]", getProcessBadgeClass(item.tone))}>
                    {item.statusLabel}
                  </Badge>
                  {item.sessionKey ? (
                    <Badge variant="outline" className="h-5 max-w-[160px] truncate border-slate-200 bg-slate-50 px-1.5 text-[10px] text-slate-600">
                      {item.sessionKey}
                    </Badge>
                  ) : null}
                </div>
                <div className="mt-1 truncate text-xs leading-5 text-slate-500">{item.summary}</div>
                <div className="mt-1 flex flex-wrap items-center gap-2 text-[11px] text-slate-400">
                  <span>{formatTime(item.updatedAt ?? item.startedAt)}</span>
                  {item.exitCode != null ? <span>exit {item.exitCode}</span> : null}
                </div>
              </div>
            </div>
          ))
        ) : null}
        {telemetry.capabilityState === "ready" && visibleItems.length === 0 ? (
          <div className="px-4 py-6 text-sm text-slate-500">
            {telemetry.scope === "global"
              ? "当前没有观测到全局后台进程，说明系统当前主要在模型流或会话流里推进。"
              : "当前没有观测到后台进程，说明这名成员要么空闲，要么只在模型流里执行。"}
          </div>
        ) : null}
      </CardContent>
    </Card>
  );
}
