import { Radar } from "lucide-react";
import { useNavigate } from "react-router-dom";
import type {
  RuntimeInspectorAgentSurface,
  RuntimeInspectorChainLink,
  RuntimeInspectorHistoryEvent,
  RuntimeInspectorProcessTelemetry,
  RuntimeInspectorRecommendedAction,
  RuntimeInspectorReplayEvent,
  RuntimeInspectorSceneZone,
  RuntimeInspectorTimelineEvent,
} from "../../application/runtime-inspector";
import { cn, formatTime } from "../../lib/utils";
import { Badge } from "../../ui/badge";
import { Button } from "../../ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "../../ui/card";
import {
  FILTER_OPTIONS,
  buildSceneChainOverlays,
  getActionToneClass,
  getAttentionChipClass,
  getCoordinationBadgeClass,
  getCoordinationLabel,
  getRuntimeDotClass,
  getSpriteBodyClass,
  getSpriteShellClass,
  getStatusOriginBadgeClass,
  getStatusOriginLabel,
  getTimelineToneClass,
  getZoneAccentClass,
  getZoneIcon,
  getZonePanelLayoutClass,
  getZonePanelSurfaceClass,
  getZoneStatusClass,
  matchesFilter,
} from "./runtime-inspector-shared";
import {
  ChainLinksCard,
  HistoryWindowCard,
  LiveProcessCard,
  ReplayCard,
} from "./RuntimeInspectorOverviewComponents";
import type { RuntimeInspectorFilter } from "./runtime-inspector-shared";

export function TinySprite(props: { agent: RuntimeInspectorAgentSurface }) {
  const { agent } = props;
  return (
    <div className="relative h-5 w-4 shrink-0">
      <span className={cn("absolute left-1 top-0 h-1.5 w-1.5 rounded-[1px]", getSpriteShellClass(agent))} />
      <span className={cn("absolute left-0.5 top-1.5 h-2 w-2.5 rounded-[1px]", getSpriteBodyClass(agent))} />
      <span className={cn("absolute right-0 top-0 h-1.5 w-1.5 rounded-[1px]", getRuntimeDotClass(agent))} />
    </div>
  );
}

export function CrewStatusStrip(props: {
  agents: RuntimeInspectorAgentSurface[];
  selectedAgentId: string | null;
  onSelect: (agentId: string) => void;
  theater?: boolean;
}) {
  const { agents, selectedAgentId, onSelect, theater = false } = props;
  return (
    <Card className={cn(
      "overflow-hidden shadow-sm",
      theater
        ? "border-white/12 bg-[linear-gradient(135deg,rgba(15,23,42,0.8),rgba(30,41,59,0.7))] shadow-[0_16px_40px_rgba(15,23,42,0.16)]"
        : "border-slate-200 bg-white",
    )}>
      <CardContent className="flex flex-wrap gap-2 p-3">
        {agents.map((agent) => (
          <button
            key={agent.agentId}
            type="button"
            onClick={() => onSelect(agent.agentId)}
            className={cn(
              "inline-flex min-w-0 items-center gap-2 rounded-full border px-2.5 py-1.5 text-left text-[11px] transition-colors",
              theater
                ? selectedAgentId === agent.agentId
                  ? "border-sky-300/80 bg-sky-500/15 shadow-sm"
                  : "border-white/12 bg-white/[0.06] hover:bg-white/[0.1]"
                : selectedAgentId === agent.agentId
                  ? "border-sky-300 bg-sky-50 shadow-sm"
                  : "border-slate-200 bg-white hover:bg-slate-50",
            )}
            title={`${agent.nickname} · ${agent.role} · ${agent.reason}`}
          >
            <TinySprite agent={agent} />
            <span className={cn("truncate font-semibold", theater ? "text-white" : "text-slate-800")}>{agent.nickname}</span>
            <span className={cn("h-2 w-2 rounded-full", getRuntimeDotClass(agent))} />
          </button>
        ))}
      </CardContent>
    </Card>
  );
}

export function MissionAgentChip(props: {
  agent: RuntimeInspectorAgentSurface;
  selected: boolean;
  onSelect: () => void;
}) {
  const { agent, selected, onSelect } = props;
  return (
    <button
      type="button"
      onClick={onSelect}
      className={cn(
        "flex min-w-0 items-center gap-2 rounded-2xl border px-2.5 py-2 text-left transition-colors",
        selected ? "border-sky-300 bg-sky-50 shadow-sm ring-1 ring-sky-200" : "border-white/70 bg-white/75 hover:bg-white",
      )}
    >
      <TinySprite agent={agent} />
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-1.5">
          <div className="truncate text-xs font-semibold text-slate-950">{agent.nickname}</div>
          <span className={cn("h-1.5 w-1.5 shrink-0 rounded-full", getRuntimeDotClass(agent))} />
        </div>
        <div className="truncate text-[11px] text-slate-500">{agent.sceneActivityLabel}</div>
      </div>
      <Badge variant="outline" className={cn("h-5 shrink-0 px-1.5 text-[10px]", getAttentionChipClass(agent))}>
        {agent.attention === "critical" ? "警" : agent.attention === "watch" ? "看" : "稳"}
      </Badge>
    </button>
  );
}

export function MissionZonePanel(props: {
  zone: RuntimeInspectorSceneZone;
  agents: RuntimeInspectorAgentSurface[];
  selectedAgentId: string | null;
  onSelect: (agentId: string) => void;
  theater?: boolean;
}) {
  const { zone, agents, selectedAgentId, onSelect, theater = false } = props;
  const visibleAgents = agents.slice(0, zone.id === "studio-floor" ? 6 : 4);
  const hiddenCount = Math.max(agents.length - visibleAgents.length, 0);
  const ZoneIcon = getZoneIcon(zone.id);
  const hasSelectedAgent = visibleAgents.some((agent) => agent.agentId === selectedAgentId);
  const occupancy = agents.length > 0 ? Math.min(100, Math.round((zone.busyCount / agents.length) * 100)) : 0;
  const alertRate = agents.length > 0 ? Math.min(100, Math.round((zone.attentionCount / agents.length) * 100)) : 0;

  return (
    <div
      className={cn(
        "relative overflow-hidden rounded-[28px] border p-3 shadow-sm",
        getZonePanelLayoutClass(zone.id),
        theater
          ? "border-white/10 bg-[linear-gradient(145deg,rgba(15,23,42,0.62),rgba(30,41,59,0.48))] shadow-[0_22px_48px_rgba(2,6,23,0.24)] backdrop-blur-sm"
          : getZonePanelSurfaceClass(zone.id),
        zone.status === "critical" ? "ring-1 ring-rose-200" : zone.status === "watch" ? "ring-1 ring-amber-200" : "",
        hasSelectedAgent ? "ring-2 ring-sky-300" : "",
      )}
    >
      <div className={cn("pointer-events-none absolute inset-x-0 top-0 h-16 bg-gradient-to-b opacity-70", getZoneAccentClass(zone.id))} />
      <div className={cn(
        "pointer-events-none absolute inset-0 bg-[linear-gradient(transparent_0,transparent_23px,rgba(148,163,184,0.07)_24px)] bg-[length:100%_24px] opacity-50",
        theater ? "mix-blend-screen" : "",
      )} />
      {zone.status !== "healthy" ? (
        <div className={cn("pointer-events-none absolute right-3 top-3 h-2.5 w-2.5 rounded-full animate-pulse", zone.status === "critical" ? "bg-rose-500" : "bg-amber-500")} />
      ) : null}
      <div className="relative flex h-full flex-col">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <div className="rounded-xl border border-white/70 bg-white/75 p-1.5 shadow-sm">
                <ZoneIcon className={cn("h-3.5 w-3.5", theater ? "text-cyan-950" : "text-slate-700")} />
              </div>
              <div className={cn("truncate font-mono text-xs font-black uppercase tracking-[0.24em]", theater ? "text-white" : "text-slate-900")}>
                {zone.label}
              </div>
              <Badge variant="outline" className={getZoneStatusClass(zone.status)}>
                {zone.status === "critical" ? "警报" : zone.status === "watch" ? "关注" : "平稳"}
              </Badge>
            </div>
            <div className={cn("mt-1 line-clamp-2 text-[11px] leading-5", theater ? "text-white/55" : "text-slate-500")}>{zone.description}</div>
          </div>
          <div className={cn(
            "shrink-0 rounded-2xl border px-2.5 py-2 text-right shadow-sm",
            theater ? "border-white/10 bg-white/[0.06]" : "border-white/70 bg-white/75",
          )}>
            <div className={cn("text-[10px] font-semibold uppercase tracking-[0.16em]", theater ? "text-white/40" : "text-slate-400")}>Busy / Alert</div>
            <div className={cn("mt-1 text-sm font-black tracking-tight", theater ? "text-white" : "text-slate-900")}>
              {zone.busyCount} / {zone.attentionCount}
            </div>
          </div>
        </div>

        <div className="mt-3 grid flex-1 gap-2 sm:grid-cols-2">
          {visibleAgents.length > 0 ? (
            visibleAgents.map((agent) => (
              <MissionAgentChip
                key={agent.agentId}
                agent={agent}
                selected={selectedAgentId === agent.agentId}
                onSelect={() => onSelect(agent.agentId)}
              />
            ))
          ) : (
            <div className={cn(
              "col-span-full flex items-center rounded-2xl border px-3 py-4 text-xs",
              theater ? "border-dashed border-white/12 bg-white/[0.05] text-white/48" : "border-dashed border-slate-200 bg-white/60 text-slate-500",
            )}>
              当前过滤条件下，这个区域没有成员。
            </div>
          )}
        </div>

        <div className={cn(
          "relative mt-2 space-y-1.5 rounded-2xl border px-3 py-2",
          theater ? "border-white/10 bg-white/[0.06]" : "border-white/70 bg-white/60",
        )}>
          <div className={cn("flex items-center justify-between text-[10px] font-semibold uppercase tracking-[0.16em]", theater ? "text-white/45" : "text-slate-500")}>
            <span>Occupancy</span>
            <span>{occupancy}%</span>
          </div>
          <div className={cn("h-1.5 overflow-hidden rounded-full", theater ? "bg-white/10" : "bg-slate-200")}>
            <div className="h-full rounded-full bg-sky-500" style={{ width: `${occupancy}%` }} />
          </div>
          <div className={cn("flex items-center justify-between text-[10px] font-semibold uppercase tracking-[0.16em]", theater ? "text-white/45" : "text-slate-500")}>
            <span>Alert</span>
            <span>{alertRate}%</span>
          </div>
          <div className={cn("h-1.5 overflow-hidden rounded-full", theater ? "bg-white/10" : "bg-slate-200")}>
            <div
              className={cn(
                "h-full rounded-full",
                zone.status === "critical" ? "bg-rose-500" : zone.status === "watch" ? "bg-amber-500" : "bg-emerald-500",
              )}
              style={{ width: `${alertRate}%` }}
            />
          </div>
        </div>

        {hiddenCount > 0 ? (
          <div className={cn(
            "relative mt-2 flex items-center justify-between rounded-2xl border px-3 py-2 text-[11px]",
            theater ? "border-dashed border-white/12 bg-white/[0.05] text-white/45" : "border-dashed border-slate-200 bg-white/60 text-slate-500",
          )}>
            <span>还有 {hiddenCount} 位成员未在地图里展开</span>
            <span>切到 Inspector 查看完整 roster</span>
          </div>
        ) : null}
      </div>
    </div>
  );
}

export function MissionFloorplan(props: {
  zones: RuntimeInspectorSceneZone[];
  timeline: RuntimeInspectorTimelineEvent[];
  chainLinks: RuntimeInspectorChainLink[];
  selectedAgentId: string | null;
  filter: RuntimeInspectorFilter;
  onSelect: (agentId: string) => void;
  theater?: boolean;
}) {
  const { zones, timeline, chainLinks, selectedAgentId, filter, onSelect, theater = false } = props;
  const sceneChainOverlays = buildSceneChainOverlays(zones, chainLinks);
  return (
    <Card className={cn(
      "overflow-hidden shadow-sm",
      theater
        ? "border-white/12 bg-[linear-gradient(135deg,rgba(15,23,42,0.84),rgba(30,41,59,0.74))] shadow-[0_20px_50px_rgba(15,23,42,0.22)]"
        : "border-slate-200 bg-white",
    )}>
      <CardHeader className={cn("px-4 py-3", theater ? "border-b border-white/10" : "border-b border-slate-100")}>
        <div className="flex items-center justify-between gap-3">
          <div>
            <CardTitle className={cn("text-base font-black tracking-tight", theater ? "text-white" : "text-slate-950")}>Scene Overview</CardTitle>
            <CardDescription className={theater ? "text-white/55" : undefined}>把公司语义映射成楼层战情图，直接扫出谁在忙、谁在等、哪里亮红灯。</CardDescription>
          </div>
          <Badge variant="outline" className={theater ? "border-white/12 bg-white/[0.05] text-white/70" : "border-slate-200 bg-slate-50 text-slate-600"}>
            过滤：{FILTER_OPTIONS.find((option) => option.id === filter)?.label ?? "全部"}
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="p-3">
        <div className={cn(
          "relative overflow-hidden rounded-[32px] p-3 shadow-inner sm:p-4",
          theater
            ? "border border-white/10 bg-[linear-gradient(180deg,rgba(2,6,23,0.96)_0%,rgba(15,23,42,0.96)_100%)]"
            : "border border-slate-200 bg-[linear-gradient(180deg,#f8fbff_0%,#eef4ff_100%)]",
        )}>
          <div className={cn(
            "pointer-events-none absolute inset-0",
            theater
              ? "bg-[radial-gradient(circle_at_top_left,rgba(34,211,238,0.16),transparent_28%),radial-gradient(circle_at_bottom_right,rgba(129,140,248,0.18),transparent_28%),linear-gradient(transparent_0,transparent_31px,rgba(148,163,184,0.08)_32px)] bg-[length:auto,auto,100%_32px]"
              : "bg-[radial-gradient(circle_at_top_left,rgba(56,189,248,0.16),transparent_32%),radial-gradient(circle_at_bottom_right,rgba(129,140,248,0.14),transparent_30%)]",
          )} />
          <div className={cn("pointer-events-none absolute inset-x-[12%] top-[31%] h-px bg-gradient-to-r from-transparent to-transparent", theater ? "via-cyan-300/40" : "via-slate-300/80")} />
          <div className={cn("pointer-events-none absolute inset-x-[18%] top-[66%] h-px bg-gradient-to-r from-transparent to-transparent", theater ? "via-cyan-300/35" : "via-slate-300/80")} />
          <div className={cn("pointer-events-none absolute left-[57%] top-[18%] h-[55%] w-px bg-gradient-to-b from-transparent to-transparent", theater ? "via-cyan-300/35" : "via-slate-300/80")} />
          {sceneChainOverlays.length > 0 ? (
            <>
              <svg
                viewBox="0 0 100 100"
                preserveAspectRatio="none"
                className="pointer-events-none absolute inset-0 hidden xl:block"
                aria-hidden="true"
              >
                {sceneChainOverlays.map((overlay) =>
                  overlay.kind === "cross-zone" ? (
                    <g key={overlay.id}>
                      <line
                        x1={overlay.fromX}
                        y1={overlay.fromY}
                        x2={overlay.toX}
                        y2={overlay.toY}
                        className={cn("fill-none stroke-[1.05] opacity-90", overlay.toneClass)}
                        strokeDasharray="2.3 1.5"
                      />
                      <circle cx={overlay.fromX} cy={overlay.fromY} r="0.95" className={overlay.toneClass.replace("stroke-", "fill-")} />
                      <circle cx={overlay.toX} cy={overlay.toY} r="0.95" className={overlay.toneClass.replace("stroke-", "fill-")} />
                    </g>
                  ) : (
                    <g key={overlay.id}>
                      <path
                        d={`M ${overlay.fromX} ${overlay.fromY} C ${overlay.fromX + 6} ${overlay.fromY - 5}, ${overlay.toX - 3} ${overlay.toY + 2}, ${overlay.toX} ${overlay.toY}`}
                        className={cn("fill-none stroke-[1.05] opacity-90", overlay.toneClass)}
                        strokeDasharray="2.3 1.5"
                      />
                      <circle cx={overlay.fromX} cy={overlay.fromY} r="0.95" className={overlay.toneClass.replace("stroke-", "fill-")} />
                      <circle cx={overlay.toX} cy={overlay.toY} r="0.95" className={overlay.toneClass.replace("stroke-", "fill-")} />
                    </g>
                  ),
                )}
              </svg>
              {sceneChainOverlays.map((overlay) => (
                <div
                  key={`${overlay.id}:label`}
                  className={cn(
                    "pointer-events-none absolute hidden -translate-x-1/2 -translate-y-1/2 rounded-full border px-2 py-1 text-[10px] font-semibold shadow-sm backdrop-blur-sm xl:block",
                    overlay.haloClass,
                  )}
                  style={{ left: `${overlay.labelX}%`, top: `${overlay.labelY}%` }}
                  title={`${overlay.fromLabel} -> ${overlay.toLabel} · ${overlay.summary}`}
                >
                  {overlay.stateLabel}
                </div>
              ))}
            </>
          ) : null}
          <div className="relative">
            <div className="mb-3 grid gap-2 lg:grid-cols-3">
              {timeline.slice(0, 3).map((item) => (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => onSelect(item.agentId)}
                  className={cn(
                    "flex items-start gap-2 rounded-2xl border px-3 py-2 text-left shadow-sm backdrop-blur-sm",
                    theater
                      ? "border-white/10 bg-white/[0.06] hover:bg-white/[0.1]"
                      : "border-white/80 bg-white/80 hover:bg-white",
                  )}
                >
                  <span className={cn("mt-1.5 h-2 w-2 rounded-full", getTimelineToneClass(item.tone))} />
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center justify-between gap-2">
                      <div className={cn("truncate text-xs font-semibold", theater ? "text-white" : "text-slate-900")}>{item.title}</div>
                      <span className={cn("shrink-0 text-[10px]", theater ? "text-white/40" : "text-slate-400")}>{formatTime(item.timestamp)}</span>
                    </div>
                    <div className={cn("mt-1 line-clamp-2 text-[11px] leading-5", theater ? "text-white/55" : "text-slate-500")}>{item.summary}</div>
                  </div>
                </button>
              ))}
            </div>
          </div>
          <div className="relative grid gap-3 xl:h-[600px] xl:grid-cols-12 xl:grid-rows-[1fr_1fr_1fr_1fr]">
            {zones.map((zone) => (
              <MissionZonePanel
                key={zone.id}
                zone={zone}
                agents={zone.agents.filter((agent) => matchesFilter(agent, filter))}
                selectedAgentId={selectedAgentId}
                onSelect={onSelect}
                theater={theater}
              />
            ))}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

export function MissionSidebar(props: {
  agent: RuntimeInspectorAgentSurface | null;
  processTelemetry: RuntimeInspectorProcessTelemetry;
  historyWindow: RuntimeInspectorHistoryEvent[];
  replay: RuntimeInspectorReplayEvent[];
  chainLinks: RuntimeInspectorChainLink[];
  triageQueue: RuntimeInspectorAgentSurface[];
  actions: RuntimeInspectorRecommendedAction[];
  watchlist: RuntimeInspectorAgentSurface[];
  timeline: RuntimeInspectorTimelineEvent[];
  zones: RuntimeInspectorSceneZone[];
  selectedAgentId: string | null;
  onSelect: (agentId: string) => void;
  theater?: boolean;
}) {
  const {
    agent,
    processTelemetry,
    historyWindow,
    replay,
    chainLinks,
    triageQueue,
    actions,
    watchlist,
    timeline,
    zones,
    selectedAgentId,
    onSelect,
    theater = false,
  } = props;
  const navigate = useNavigate();

  return (
    <Card className={cn(
      "overflow-hidden shadow-sm",
      theater
        ? "border-white/12 bg-[linear-gradient(135deg,rgba(15,23,42,0.86),rgba(30,41,59,0.78))] shadow-[0_20px_50px_rgba(15,23,42,0.22)]"
        : "border-slate-200 bg-white",
    )}>
      <CardHeader className={cn("px-4 py-3", theater ? "border-b border-white/10" : "border-b border-slate-100")}>
        <div className="flex items-center gap-2">
          <Radar className={cn("h-4 w-4", theater ? "text-cyan-300" : "text-slate-500")} />
          <div>
            <CardTitle className={cn("text-sm font-black tracking-tight", theater ? "text-white" : "text-slate-950")}>指挥栏</CardTitle>
            <CardDescription className={theater ? "text-white/55" : undefined}>在同一张卡里完成关注、回放、跳转和区域判断。</CardDescription>
          </div>
        </div>
      </CardHeader>
      <CardContent className={cn("space-y-4 p-4", theater ? "bg-[radial-gradient(circle_at_top_right,rgba(34,211,238,0.08),transparent_32%)]" : "")}>
        {agent ? (
          <div className={cn(
            "rounded-[26px] border p-3 text-white shadow-sm",
            theater
              ? "border-white/10 bg-[linear-gradient(145deg,rgba(2,6,23,0.96),rgba(15,23,42,0.92))]"
              : "border-slate-200 bg-[linear-gradient(145deg,#0f172a,#1e293b)]",
          )}>
            <div className="flex items-center justify-between gap-3">
              <div className="min-w-0">
                <div className="text-[10px] font-semibold uppercase tracking-[0.18em] text-white/45">
                  {selectedAgentId === agent.agentId ? "Selected Agent" : "Focus Agent"}
                </div>
                <div className="mt-1 flex items-center gap-2">
                  <span className={cn("h-2.5 w-2.5 rounded-full", getRuntimeDotClass(agent))} />
                  <div className="truncate text-base font-black tracking-tight">{agent.nickname}</div>
                </div>
                <div className="mt-1 truncate text-xs text-white/60">{agent.role} · {agent.sceneZoneLabel}</div>
              </div>
              <div className="flex flex-wrap items-center justify-end gap-2">
                <Badge
                  variant="outline"
                  className={cn("border-white/15 bg-white/10 text-white", getStatusOriginBadgeClass(agent.statusOrigin))}
                >
                  {getStatusOriginLabel(agent.statusOrigin)}
                </Badge>
                <Badge variant="outline" className={cn("border-white/15 bg-white/10 text-white", getCoordinationBadgeClass(agent))}>
                  {getCoordinationLabel(agent)}
                </Badge>
              </div>
            </div>
            <div className="mt-3 line-clamp-3 text-xs leading-5 text-white/72">{agent.reason}</div>
            <div className="mt-3 flex flex-wrap gap-2">
              <Button
                size="sm"
                variant="outline"
                className={cn("h-8 border-white/15 text-white hover:bg-white/15", theater ? "bg-white/[0.06]" : "bg-white/10")}
                onClick={() => navigate(`/chat/${encodeURIComponent(agent.agentId)}`)}
              >
                会话
              </Button>
              <Button
                size="sm"
                variant="outline"
                className={cn("h-8 border-white/15 text-white hover:bg-white/15", theater ? "bg-white/[0.06]" : "bg-white/10")}
                onClick={() => navigate(`/employees/${encodeURIComponent(agent.agentId)}`)}
              >
                详情
              </Button>
            </div>
          </div>
        ) : null}

        <HistoryWindowCard items={historyWindow} compact onSelect={onSelect} />
        <LiveProcessCard telemetry={processTelemetry} compact />
        <ReplayCard items={replay} compact onSelect={onSelect} />
        <ChainLinksCard items={chainLinks} compact onSelect={onSelect} />

        <div>
          <div className="flex items-center justify-between gap-2">
            <div className="text-[10px] font-semibold uppercase tracking-[0.18em] text-slate-500">处理顺序</div>
            <span className="text-[11px] text-slate-400">{triageQueue.length}</span>
          </div>
          <div className="mt-2 space-y-2">
            {triageQueue.slice(0, 5).map((queuedAgent, index) => (
              <button
                key={queuedAgent.agentId}
                type="button"
                onClick={() => onSelect(queuedAgent.agentId)}
                className={cn(
                  "flex w-full items-start gap-3 rounded-2xl border px-3 py-2 text-left transition-colors",
                  selectedAgentId === queuedAgent.agentId ? "border-sky-300 bg-sky-50" : "border-slate-200 bg-white hover:bg-slate-50",
                )}
              >
                <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-slate-900 text-[11px] font-black text-white">
                  {index + 1}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <div className="truncate text-xs font-semibold text-slate-950">{queuedAgent.nickname}</div>
                    <Badge variant="outline" className={cn("h-5 px-1.5 text-[10px]", getCoordinationBadgeClass(queuedAgent))}>
                      {getCoordinationLabel(queuedAgent)}
                    </Badge>
                  </div>
                  <div className="mt-1 truncate text-[11px] text-slate-500">{queuedAgent.reason}</div>
                </div>
              </button>
            ))}
          </div>
        </div>

        <div>
          <div className="text-[10px] font-semibold uppercase tracking-[0.18em] text-slate-500">Recommended</div>
          <div className="mt-2 flex flex-wrap gap-2">
            {actions.slice(0, 3).map((action) => (
              <Button
                key={action.id}
                size="sm"
                variant="outline"
                className={cn("h-8", getActionToneClass(action.tone))}
                onClick={() => navigate(action.to)}
              >
                {action.label}
              </Button>
            ))}
          </div>
        </div>

        <div>
          <div className="flex items-center justify-between gap-2">
            <div className="text-[10px] font-semibold uppercase tracking-[0.18em] text-slate-500">Watchlist</div>
            <span className="text-[11px] text-slate-400">{watchlist.length}</span>
          </div>
          <div className="mt-2 space-y-2">
            {watchlist.slice(0, 4).map((agent) => (
              <button
                key={agent.agentId}
                type="button"
                onClick={() => onSelect(agent.agentId)}
                className={cn(
                  "flex w-full items-start gap-2 rounded-2xl border px-3 py-2 text-left transition-colors",
                  selectedAgentId === agent.agentId ? "border-sky-300 bg-sky-50" : "border-slate-200 bg-slate-50 hover:bg-slate-100",
                )}
              >
                <span className={cn("mt-1 h-2 w-2 rounded-full", getRuntimeDotClass(agent))} />
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <div className="truncate text-xs font-semibold text-slate-950">{agent.nickname}</div>
                    <Badge variant="outline" className={cn("h-5 px-1.5 text-[10px]", getCoordinationBadgeClass(agent))}>
                      {getCoordinationLabel(agent)}
                    </Badge>
                  </div>
                  <div className="mt-1 truncate text-[11px] text-slate-500">{agent.reason}</div>
                </div>
              </button>
            ))}
            {watchlist.length === 0 ? (
              <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50 px-3 py-4 text-xs text-slate-500">
                当前没有需要特别盯防的成员。
              </div>
            ) : null}
          </div>
        </div>

        <div>
          <div className="flex items-center justify-between gap-2">
            <div className="text-[10px] font-semibold uppercase tracking-[0.18em] text-slate-500">Timeline</div>
            <span className="text-[11px] text-slate-400">{timeline.length}</span>
          </div>
          <div className="mt-2 space-y-2">
            {timeline.slice(0, 5).map((item) => (
              <button
                key={item.id}
                type="button"
                onClick={() => onSelect(item.agentId)}
                className="flex w-full items-start gap-2 rounded-2xl border border-slate-200 bg-white px-3 py-2 text-left hover:bg-slate-50"
              >
                <span className={cn("mt-1.5 h-2 w-2 rounded-full", getTimelineToneClass(item.tone))} />
                <div className="min-w-0 flex-1">
                  <div className="flex items-center justify-between gap-2">
                    <div className="truncate text-xs font-semibold text-slate-950">{item.title}</div>
                    <span className="shrink-0 text-[10px] text-slate-400">{formatTime(item.timestamp)}</span>
                  </div>
                  <div className="mt-1 line-clamp-2 text-[11px] leading-5 text-slate-500">{item.summary}</div>
                </div>
              </button>
            ))}
          </div>
        </div>

        <div>
          <div className="text-[10px] font-semibold uppercase tracking-[0.18em] text-slate-500">Zone Heat</div>
          <div className="mt-2 grid gap-2 sm:grid-cols-2 xl:grid-cols-1 2xl:grid-cols-2">
            {zones.map((zone) => (
              <div key={zone.id} className="rounded-2xl border border-slate-200 bg-slate-50 px-3 py-2">
                <div className="flex items-center justify-between gap-2">
                  <div className="truncate text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-700">
                    {zone.label}
                  </div>
                  <Badge variant="outline" className={getZoneStatusClass(zone.status)}>
                    {zone.status === "critical" ? "警" : zone.status === "watch" ? "看" : "稳"}
                  </Badge>
                </div>
                <div className="mt-1 text-[11px] text-slate-500">Busy {zone.busyCount} · Alert {zone.attentionCount}</div>
              </div>
            ))}
          </div>
        </div>

        <div>
          <div className="text-[10px] font-semibold uppercase tracking-[0.18em] text-slate-500">Legend</div>
          <div className="mt-2 flex flex-wrap gap-2">
            <span className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white px-2.5 py-1 text-[11px] text-slate-600">
              <span className="h-2 w-2 rounded-full bg-sky-500" />
              执行中
            </span>
            <span className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white px-2.5 py-1 text-[11px] text-slate-600">
              <span className="h-2 w-2 rounded-full bg-amber-500" />
              等待 / 超时
            </span>
            <span className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white px-2.5 py-1 text-[11px] text-slate-600">
              <span className="h-2 w-2 rounded-full bg-rose-500" />
              阻塞 / 接管
            </span>
            <span className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white px-2.5 py-1 text-[11px] text-slate-600">
              <span className="h-2 w-2 rounded-full bg-violet-500" />
              无信号
            </span>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

