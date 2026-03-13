import {
  Activity,
  BookOpenCheck,
  ChevronRight,
  Clock3,
  Cpu,
  Grid2x2,
  MessageSquare,
  Radar,
  ShieldAlert,
  UserRound,
  WifiOff,
  Workflow,
  X,
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import type {
  RuntimeInspectorAgentSurface,
  RuntimeInspectorChainLink,
  RuntimeInspectorHistoryEvent,
  RuntimeInspectorReplayEvent,
  RuntimeInspectorRecommendedAction,
  RuntimeInspectorSceneZone,
  RuntimeInspectorStatusSource,
  RuntimeInspectorTimelineEvent,
  RuntimeInspectorProcessTelemetry,
} from "../../application/runtime-inspector";
import {
  useRuntimeInspectorGlobalProcessTelemetry,
  useRuntimeInspectorProcessTelemetry,
  useRuntimeInspectorViewModel,
} from "../../application/runtime-inspector";
import { Badge } from "../../components/ui/badge";
import { Button } from "../../components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "../../components/ui/card";
import { cn, formatTime } from "../../lib/utils";

type RuntimeInspectorMode = "inspector" | "scene";
type RuntimeInspectorFilter = "all" | "executing" | "waiting" | "intervention" | "no_signal";
type MetricTone = "default" | "accent" | "warning" | "danger";
type BroadcastSpeed = "fast" | "normal" | "slow";

const MODE_OPTIONS: Array<{ id: RuntimeInspectorMode; label: string; icon: typeof Radar }> = [
  { id: "inspector", label: "Inspector", icon: Radar },
  { id: "scene", label: "Scene", icon: Grid2x2 },
];

const FILTER_OPTIONS: Array<{ id: RuntimeInspectorFilter; label: string }> = [
  { id: "all", label: "全部" },
  { id: "executing", label: "执行中" },
  { id: "waiting", label: "待协作" },
  { id: "intervention", label: "需介入" },
  { id: "no_signal", label: "无信号" },
];

const BROADCAST_SPEED_OPTIONS: Array<{ id: BroadcastSpeed; label: string; intervalMs: number }> = [
  { id: "fast", label: "快", intervalMs: 4_000 },
  { id: "normal", label: "中", intervalMs: 7_000 },
  { id: "slow", label: "慢", intervalMs: 10_000 },
];

function getRuntimeLabel(agent: RuntimeInspectorAgentSurface): string {
  switch (agent.runtimeState) {
    case "busy":
      return "执行中";
    case "idle":
      return "待命";
    case "degraded":
      return "降级";
    case "no_signal":
      return "无信号";
    case "offline":
    default:
      return "离线";
  }
}

function getRuntimeBadgeClass(agent: RuntimeInspectorAgentSurface): string {
  switch (agent.runtimeState) {
    case "busy":
      return "border-sky-200 bg-sky-50 text-sky-700";
    case "idle":
      return "border-emerald-200 bg-emerald-50 text-emerald-700";
    case "degraded":
      return "border-amber-200 bg-amber-50 text-amber-700";
    case "no_signal":
      return "border-violet-200 bg-violet-50 text-violet-700";
    case "offline":
    default:
      return "border-slate-200 bg-slate-50 text-slate-500";
  }
}

function getRuntimeDotClass(agent: RuntimeInspectorAgentSurface): string {
  switch (agent.runtimeState) {
    case "busy":
      return "bg-sky-500";
    case "idle":
      return "bg-emerald-500";
    case "degraded":
      return "bg-amber-500";
    case "no_signal":
      return "bg-violet-500";
    case "offline":
    default:
      return "bg-slate-400";
  }
}

function getCoordinationLabel(agent: RuntimeInspectorAgentSurface): string {
  if (agent.interventionState === "takeover_required") {
    return "人工接管";
  }
  switch (agent.coordinationState) {
    case "executing":
      return "执行中";
    case "pending_ack":
      return "待确认";
    case "waiting_peer":
      return agent.interventionState === "escalated"
        ? "待协作·已升级"
        : agent.interventionState === "overdue"
          ? "待协作·超时"
          : "待协作";
    case "waiting_input":
      return agent.interventionState === "overdue" ? "待输入·超时" : "待输入";
    case "explicit_blocked":
      return "明确阻塞";
    case "completed":
      return "已完成";
    case "none":
    default:
      return "无挂载";
  }
}

function getCoordinationBadgeClass(agent: RuntimeInspectorAgentSurface): string {
  if (agent.interventionState === "takeover_required" || agent.coordinationState === "explicit_blocked") {
    return "border-rose-200 bg-rose-50 text-rose-700";
  }
  if (
    agent.interventionState === "escalated" ||
    agent.interventionState === "overdue" ||
    agent.coordinationState === "waiting_peer" ||
    agent.coordinationState === "waiting_input" ||
    agent.coordinationState === "pending_ack"
  ) {
    return "border-amber-200 bg-amber-50 text-amber-700";
  }
  if (agent.coordinationState === "executing") {
    return "border-sky-200 bg-sky-50 text-sky-700";
  }
  if (agent.coordinationState === "completed") {
    return "border-emerald-200 bg-emerald-50 text-emerald-700";
  }
  return "border-slate-200 bg-slate-50 text-slate-600";
}

function getInterventionLabel(agent: RuntimeInspectorAgentSurface): string {
  switch (agent.interventionState) {
    case "takeover_required":
      return "需接管";
    case "escalated":
      return "已升级";
    case "overdue":
      return "超时";
    case "healthy":
    default:
      return "正常";
  }
}

function getInterventionBadgeClass(agent: RuntimeInspectorAgentSurface): string {
  switch (agent.interventionState) {
    case "takeover_required":
      return "border-rose-200 bg-rose-50 text-rose-700";
    case "escalated":
      return "border-orange-200 bg-orange-50 text-orange-700";
    case "overdue":
      return "border-amber-200 bg-amber-50 text-amber-700";
    case "healthy":
    default:
      return "border-emerald-200 bg-emerald-50 text-emerald-700";
  }
}

function matchesFilter(agent: RuntimeInspectorAgentSurface, filter: RuntimeInspectorFilter): boolean {
  switch (filter) {
    case "executing":
      return agent.coordinationState === "executing";
    case "waiting":
      return (
        agent.coordinationState === "pending_ack" ||
        agent.coordinationState === "waiting_peer" ||
        agent.coordinationState === "waiting_input"
      );
    case "intervention":
      return agent.interventionState !== "healthy" || agent.coordinationState === "explicit_blocked";
    case "no_signal":
      return agent.runtimeState === "no_signal";
    case "all":
    default:
      return true;
  }
}

function metricToneClass(tone: MetricTone): string {
  if (tone === "accent") return "border-sky-200 bg-sky-50 text-sky-700";
  if (tone === "warning") return "border-amber-200 bg-amber-50 text-amber-700";
  if (tone === "danger") return "border-rose-200 bg-rose-50 text-rose-700";
  return "border-slate-200 bg-white text-slate-700";
}

function buildMetrics(agents: RuntimeInspectorAgentSurface[]) {
  return [
    {
      key: "executing",
      label: "执行中",
      value: agents.filter((agent) => agent.coordinationState === "executing").length,
      icon: Cpu,
      tone: "accent" as MetricTone,
    },
    {
      key: "waiting",
      label: "待协作",
      value: agents.filter((agent) =>
        agent.coordinationState === "pending_ack" ||
        agent.coordinationState === "waiting_peer" ||
        agent.coordinationState === "waiting_input",
      ).length,
      icon: Workflow,
      tone: "warning" as MetricTone,
    },
    {
      key: "intervention",
      label: "需介入",
      value: agents.filter((agent) =>
        agent.interventionState !== "healthy" || agent.coordinationState === "explicit_blocked",
      ).length,
      icon: ShieldAlert,
      tone: "danger" as MetricTone,
    },
    {
      key: "no_signal",
      label: "无信号",
      value: agents.filter((agent) => agent.runtimeState === "no_signal").length,
      icon: WifiOff,
      tone: "default" as MetricTone,
    },
  ];
}

function MetricCard(props: {
  label: string;
  value: number;
  tone: MetricTone;
  icon: typeof Cpu;
}) {
  const { label, value, tone, icon: Icon } = props;
  return (
    <div className={cn("flex items-center gap-3 rounded-2xl border px-3 py-2 shadow-sm", metricToneClass(tone))}>
      <div className="rounded-xl bg-white/80 p-2 shadow-sm">
        <Icon className="h-4 w-4" />
      </div>
      <div>
        <div className="text-[10px] font-semibold uppercase tracking-[0.18em] opacity-80">{label}</div>
        <div className="text-lg font-black tracking-tight">{value}</div>
      </div>
    </div>
  );
}

function getBroadcastInterval(speed: BroadcastSpeed): number {
  return BROADCAST_SPEED_OPTIONS.find((option) => option.id === speed)?.intervalMs ?? 7_000;
}

function getBroadcastLabel(speed: BroadcastSpeed): string {
  return BROADCAST_SPEED_OPTIONS.find((option) => option.id === speed)?.label ?? "中";
}

function getActionToneClass(tone: RuntimeInspectorRecommendedAction["tone"]): string {
  if (tone === "danger") return "border-rose-200 bg-rose-50 text-rose-700";
  if (tone === "warning") return "border-amber-200 bg-amber-50 text-amber-700";
  return "border-slate-200 bg-white text-slate-700";
}

function getChainToneClass(tone: RuntimeInspectorChainLink["tone"]): string {
  if (tone === "danger") return "bg-rose-500";
  if (tone === "warning") return "bg-amber-500";
  return "bg-sky-500";
}

function getChainBadgeClass(tone: RuntimeInspectorChainLink["tone"]): string {
  if (tone === "danger") return "border-rose-200 bg-rose-50 text-rose-700";
  if (tone === "warning") return "border-amber-200 bg-amber-50 text-amber-700";
  return "border-sky-200 bg-sky-50 text-sky-700";
}

function getTimelineToneClass(tone: RuntimeInspectorTimelineEvent["tone"]): string {
  if (tone === "danger") return "bg-rose-500";
  if (tone === "warning") return "bg-amber-500";
  if (tone === "success") return "bg-emerald-500";
  return "bg-sky-500";
}

function getReplayToneClass(tone: RuntimeInspectorReplayEvent["tone"]): string {
  if (tone === "danger") return "bg-rose-500";
  if (tone === "warning") return "bg-amber-500";
  if (tone === "success") return "bg-emerald-500";
  return "bg-sky-500";
}

function getReplayBadgeClass(tone: RuntimeInspectorReplayEvent["tone"]): string {
  if (tone === "danger") return "border-rose-200 bg-rose-50 text-rose-700";
  if (tone === "warning") return "border-amber-200 bg-amber-50 text-amber-700";
  if (tone === "success") return "border-emerald-200 bg-emerald-50 text-emerald-700";
  return "border-sky-200 bg-sky-50 text-sky-700";
}

function getHistoryToneClass(tone: RuntimeInspectorHistoryEvent["tone"]): string {
  if (tone === "danger") return "bg-rose-500";
  if (tone === "warning") return "bg-amber-500";
  if (tone === "success") return "bg-emerald-500";
  return "bg-sky-500";
}

function getProcessToneClass(tone: RuntimeInspectorProcessTelemetry["processes"][number]["tone"]): string {
  if (tone === "danger") return "bg-rose-500";
  if (tone === "warning") return "bg-amber-500";
  if (tone === "success") return "bg-emerald-500";
  return "bg-sky-500";
}

function getProcessBadgeClass(tone: RuntimeInspectorProcessTelemetry["processes"][number]["tone"]): string {
  if (tone === "danger") return "border-rose-200 bg-rose-50 text-rose-700";
  if (tone === "warning") return "border-amber-200 bg-amber-50 text-amber-700";
  if (tone === "success") return "border-emerald-200 bg-emerald-50 text-emerald-700";
  return "border-sky-200 bg-sky-50 text-sky-700";
}

function getZoneStatusClass(status: RuntimeInspectorAgentSurface["attention"]): string {
  if (status === "critical") return "border-rose-200 bg-rose-50 text-rose-700";
  if (status === "watch") return "border-amber-200 bg-amber-50 text-amber-700";
  return "border-emerald-200 bg-emerald-50 text-emerald-700";
}

function getAttentionChipClass(agent: RuntimeInspectorAgentSurface): string {
  if (agent.attention === "critical") return "border-rose-200 bg-rose-50 text-rose-700";
  if (agent.attention === "watch") return "border-amber-200 bg-amber-50 text-amber-700";
  return "border-emerald-200 bg-emerald-50 text-emerald-700";
}

function getZonePanelLayoutClass(zoneId: RuntimeInspectorSceneZone["id"]): string {
  switch (zoneId) {
    case "command-deck":
      return "xl:col-start-1 xl:col-span-7 xl:row-start-1 xl:row-span-1";
    case "tech-lab":
      return "xl:col-start-8 xl:col-span-5 xl:row-start-1 xl:row-span-2";
    case "ops-rail":
      return "xl:col-start-1 xl:col-span-7 xl:row-start-2 xl:row-span-2";
    case "people-hub":
      return "xl:col-start-1 xl:col-span-4 xl:row-start-4 xl:row-span-1";
    case "studio-floor":
    default:
      return "xl:col-start-5 xl:col-span-8 xl:row-start-4 xl:row-span-1";
  }
}

function getZonePanelSurfaceClass(zoneId: RuntimeInspectorSceneZone["id"]): string {
  switch (zoneId) {
    case "command-deck":
      return "border-amber-200/80 bg-[linear-gradient(145deg,rgba(255,251,235,0.96),rgba(255,255,255,0.98))]";
    case "tech-lab":
      return "border-cyan-200/80 bg-[linear-gradient(145deg,rgba(236,254,255,0.96),rgba(248,250,252,0.98))]";
    case "ops-rail":
      return "border-emerald-200/80 bg-[linear-gradient(145deg,rgba(236,253,245,0.96),rgba(255,255,255,0.98))]";
    case "people-hub":
      return "border-fuchsia-200/80 bg-[linear-gradient(145deg,rgba(253,244,255,0.96),rgba(255,255,255,0.98))]";
    case "studio-floor":
    default:
      return "border-indigo-200/80 bg-[linear-gradient(145deg,rgba(239,246,255,0.96),rgba(248,250,252,0.98))]";
  }
}

function getZoneAccentClass(zoneId: RuntimeInspectorSceneZone["id"]): string {
  switch (zoneId) {
    case "command-deck":
      return "from-amber-400 via-orange-300 to-transparent";
    case "tech-lab":
      return "from-cyan-400 via-sky-300 to-transparent";
    case "ops-rail":
      return "from-emerald-400 via-teal-300 to-transparent";
    case "people-hub":
      return "from-fuchsia-400 via-rose-300 to-transparent";
    case "studio-floor":
    default:
      return "from-indigo-400 via-sky-300 to-transparent";
  }
}

function getZoneIcon(zoneId: RuntimeInspectorSceneZone["id"]): typeof Radar {
  switch (zoneId) {
    case "command-deck":
      return Radar;
    case "tech-lab":
      return Cpu;
    case "ops-rail":
      return Workflow;
    case "people-hub":
      return UserRound;
    case "studio-floor":
    default:
      return Activity;
  }
}

function getStatusOriginBadgeClass(origin: RuntimeInspectorAgentSurface["statusOrigin"]): string {
  return origin === "authority"
    ? "border-emerald-200 bg-emerald-50 text-emerald-700"
    : "border-amber-200 bg-amber-50 text-amber-700";
}

function getStatusOriginLabel(origin: RuntimeInspectorAgentSurface["statusOrigin"]): string {
  return origin === "authority" ? "Authority" : "Fallback";
}

const SCENE_ZONE_ANCHORS: Record<
  RuntimeInspectorSceneZone["id"],
  { x: number; y: number }
> = {
  "command-deck": { x: 27, y: 14 },
  "tech-lab": { x: 82, y: 24 },
  "ops-rail": { x: 28, y: 49 },
  "people-hub": { x: 17, y: 87 },
  "studio-floor": { x: 70, y: 87 },
};

type SceneChainOverlay = {
  id: string;
  kind: "cross-zone" | "intra-zone";
  fromX: number;
  fromY: number;
  toX: number;
  toY: number;
  labelX: number;
  labelY: number;
  toneClass: string;
  haloClass: string;
  stateLabel: string;
  summary: string;
  fromLabel: string;
  toLabel: string;
};

function buildSceneChainOverlays(
  zones: RuntimeInspectorSceneZone[],
  items: RuntimeInspectorChainLink[],
): SceneChainOverlay[] {
  const zoneByAgentId = new Map<string, RuntimeInspectorSceneZone["id"]>();
  zones.forEach((zone) => {
    zone.agents.forEach((agent) => {
      zoneByAgentId.set(agent.agentId, zone.id);
    });
  });

  const overlays: SceneChainOverlay[] = [];

  items.slice(0, 5).forEach((item) => {
    const fromZoneId = item.fromAgentId ? zoneByAgentId.get(item.fromAgentId) ?? null : null;
    const toZoneId = item.toAgentId ? zoneByAgentId.get(item.toAgentId) ?? null : null;
    if (!fromZoneId && !toZoneId) {
      return;
    }

    const toneClass =
      item.tone === "danger"
        ? "stroke-rose-400"
        : item.tone === "warning"
          ? "stroke-amber-400"
          : "stroke-sky-400";
    const haloClass =
      item.tone === "danger"
        ? "border-rose-300/70 bg-rose-500/12 text-rose-100"
        : item.tone === "warning"
          ? "border-amber-300/70 bg-amber-400/12 text-amber-50"
          : "border-sky-300/70 bg-sky-400/12 text-sky-50";

    const fromAnchor = SCENE_ZONE_ANCHORS[fromZoneId ?? toZoneId!];
    const toAnchor = SCENE_ZONE_ANCHORS[toZoneId ?? fromZoneId!];

    if ((fromZoneId ?? toZoneId) === (toZoneId ?? fromZoneId)) {
      const offsetX = Math.min(fromAnchor.x + 10, 92);
      const offsetY = Math.max(fromAnchor.y - 7, 8);
      overlays.push({
        id: item.id,
        kind: "intra-zone",
        fromX: fromAnchor.x,
        fromY: fromAnchor.y,
        toX: offsetX,
        toY: offsetY,
        labelX: Math.min(offsetX + 1.5, 93),
        labelY: Math.max(offsetY - 1.5, 6),
        toneClass,
        haloClass,
        stateLabel: item.stateLabel,
        summary: item.summary,
        fromLabel: item.fromLabel,
        toLabel: item.toLabel,
      });
      return;
    }

    overlays.push({
      id: item.id,
      kind: "cross-zone",
      fromX: fromAnchor.x,
      fromY: fromAnchor.y,
      toX: toAnchor.x,
      toY: toAnchor.y,
      labelX: (fromAnchor.x + toAnchor.x) / 2,
      labelY: (fromAnchor.y + toAnchor.y) / 2,
      toneClass,
      haloClass,
      stateLabel: item.stateLabel,
      summary: item.summary,
      fromLabel: item.fromLabel,
      toLabel: item.toLabel,
    });
  });

  return overlays;
}

function getSpriteBodyClass(agent: RuntimeInspectorAgentSurface): string {
  if (agent.runtimeState === "busy") {
    return "bg-sky-500";
  }
  if (agent.runtimeState === "degraded") {
    return "bg-amber-500 animate-pulse";
  }
  if (agent.runtimeState === "no_signal") {
    return "bg-violet-500/80";
  }
  if (agent.runtimeState === "offline") {
    return "bg-slate-400";
  }
  switch (agent.sceneZoneId) {
    case "command-deck":
      return "bg-orange-500";
    case "tech-lab":
      return "bg-cyan-500";
    case "ops-rail":
      return "bg-emerald-500";
    case "people-hub":
      return "bg-fuchsia-500";
    case "studio-floor":
    default:
      return "bg-indigo-500";
  }
}

function getSpriteShellClass(agent: RuntimeInspectorAgentSurface): string {
  if (agent.attention === "critical") return "bg-rose-950";
  if (agent.attention === "watch") return "bg-amber-950";
  return "bg-slate-950";
}

function getSourceBadgeClass(source: RuntimeInspectorStatusSource): string {
  if (source === "authority_complete") {
    return "border-emerald-200 bg-emerald-50 text-emerald-700";
  }
  if (source === "authority_partial") {
    return "border-amber-200 bg-amber-50 text-amber-700";
  }
  return "border-rose-200 bg-rose-50 text-rose-700";
}

function FocusHero(props: {
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
            <div className="text-[10px] font-semibold uppercase tracking-[0.2em] text-white/50">当前目标</div>
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

function TheaterStatusBar(props: {
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
            {statusSource === "authority_complete"
              ? "Authority"
              : statusSource === "authority_partial"
                ? "Authority Partial"
                : "Fallback"}
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

function MissionStrip(props: {
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

function WatchlistCard(props: {
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

function TimelineCard(props: {
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

function ZoneHealthCard(props: {
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

function ChainLinksCard(props: {
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

function ReplayCard(props: {
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

function HistoryWindowCard(props: {
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

function LiveProcessCard(props: {
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

function TinySprite(props: { agent: RuntimeInspectorAgentSurface }) {
  const { agent } = props;
  return (
    <div className="relative h-5 w-4 shrink-0">
      <span className={cn("absolute left-1 top-0 h-1.5 w-1.5 rounded-[1px]", getSpriteShellClass(agent))} />
      <span className={cn("absolute left-0.5 top-1.5 h-2 w-2.5 rounded-[1px]", getSpriteBodyClass(agent))} />
      <span className={cn("absolute right-0 top-0 h-1.5 w-1.5 rounded-[1px]", getRuntimeDotClass(agent))} />
    </div>
  );
}

function CrewStatusStrip(props: {
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

function MissionAgentChip(props: {
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

function MissionZonePanel(props: {
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

function MissionFloorplan(props: {
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

function MissionSidebar(props: {
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

function InspectorRow(props: {
  agent: RuntimeInspectorAgentSurface;
  selected: boolean;
  onSelect: () => void;
}) {
  const { agent, selected, onSelect } = props;
  const navigate = useNavigate();

  return (
    <div
      role="button"
      tabIndex={0}
      onClick={onSelect}
      onKeyDown={(event) => {
        if (event.key === "Enter" || event.key === " ") {
          event.preventDefault();
          onSelect();
        }
      }}
      className={cn(
        "grid w-full min-w-[1120px] cursor-pointer grid-cols-[minmax(190px,1.05fr)_118px_140px_minmax(320px,2fr)_110px_62px_132px] items-center gap-3 border-b border-slate-100 px-3 py-2 text-left transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-sky-300",
        selected ? "bg-sky-50/60" : "bg-white hover:bg-slate-50",
      )}
    >
      <div className="flex min-w-0 items-center gap-2.5">
        <span className={cn("h-2.5 w-2.5 shrink-0 rounded-full", getRuntimeDotClass(agent))} />
        <div className="min-w-0 truncate text-sm font-semibold text-slate-950" title={`${agent.nickname} · ${agent.role}`}>
          {agent.nickname}
          <span className="ml-2 text-xs font-medium text-slate-500">{agent.role}</span>
        </div>
      </div>

      <div className="min-w-0">
        <div className="flex min-w-0 items-center gap-1.5">
          <Badge variant="outline" className={cn("max-w-full truncate", getRuntimeBadgeClass(agent))}>
            {getRuntimeLabel(agent)}
          </Badge>
          <Badge variant="outline" className={cn("h-5 shrink-0 px-1.5 text-[10px]", getStatusOriginBadgeClass(agent.statusOrigin))}>
            {getStatusOriginLabel(agent.statusOrigin)}
          </Badge>
        </div>
      </div>

      <div className="min-w-0">
        <Badge variant="outline" className={cn("max-w-full truncate", getCoordinationBadgeClass(agent))}>
          {getCoordinationLabel(agent)}
        </Badge>
      </div>

      <div className="min-w-0 truncate text-xs text-slate-600" title={agent.reason}>
        {agent.reason}
      </div>

      <div className="truncate text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-500" title={agent.sceneZoneLabel}>
        {agent.sceneZoneLabel}
      </div>

      <div className="text-right text-[11px] font-semibold text-slate-500">
        {agent.activeSessionCount}/{agent.activeRunCount}
      </div>

      <div
        className="flex items-center justify-end gap-1"
        onClick={(event) => {
          event.stopPropagation();
        }}
      >
        <Button
          size="icon"
          variant="ghost"
          className="h-7 w-7 text-slate-500 hover:text-slate-900"
          title="打开会话"
          onClick={() => navigate(`/chat/${encodeURIComponent(agent.agentId)}`)}
        >
          <MessageSquare className="h-3.5 w-3.5" />
        </Button>
        <Button
          size="icon"
          variant="ghost"
          className="h-7 w-7 text-slate-500 hover:text-slate-900"
          title="查看详情"
          onClick={() => navigate(`/employees/${encodeURIComponent(agent.agentId)}`)}
        >
          <UserRound className="h-3.5 w-3.5" />
        </Button>
        <Button
          size="icon"
          variant="ghost"
          className="h-7 w-7 text-slate-500 hover:text-slate-900"
          title="打开工作看板"
          onClick={() => navigate("/board")}
        >
          <BookOpenCheck className="h-3.5 w-3.5" />
        </Button>
      </div>
    </div>
  );
}

function DetailDrawer(props: {
  agent: RuntimeInspectorAgentSurface | null;
  processTelemetry: RuntimeInspectorProcessTelemetry;
  open: boolean;
  onClose: () => void;
}) {
  const { agent, processTelemetry, open, onClose } = props;
  const navigate = useNavigate();

  if (!agent || !open) {
    return null;
  }

  return (
    <div className="pointer-events-none fixed inset-y-0 right-0 z-40 flex w-full justify-end">
      <div className="pointer-events-auto h-full w-full max-w-[420px] border-l border-slate-200 bg-white shadow-2xl">
        <div className="flex h-full flex-col">
          <div className="flex items-start justify-between gap-3 border-b border-slate-100 px-4 py-4">
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <span className={cn("h-2.5 w-2.5 rounded-full", getRuntimeDotClass(agent))} />
                <div className="truncate text-lg font-black tracking-tight text-slate-950">{agent.nickname}</div>
              </div>
              <div className="mt-1 truncate text-sm text-slate-500">{agent.role}</div>
              <div className="mt-3 flex flex-wrap gap-2">
                <Badge variant="outline" className={getRuntimeBadgeClass(agent)}>
                  {getRuntimeLabel(agent)}
                </Badge>
                <Badge variant="outline" className={getStatusOriginBadgeClass(agent.statusOrigin)}>
                  {getStatusOriginLabel(agent.statusOrigin)}
                </Badge>
                <Badge variant="outline" className={getCoordinationBadgeClass(agent)}>
                  {getCoordinationLabel(agent)}
                </Badge>
                <Badge variant="outline" className={getInterventionBadgeClass(agent)}>
                  {getInterventionLabel(agent)}
                </Badge>
              </div>
            </div>
            <Button size="icon" variant="ghost" className="h-8 w-8" onClick={onClose}>
              <X className="h-4 w-4" />
            </Button>
          </div>

          <div className="flex-1 space-y-4 overflow-auto px-4 py-4">
            <div className="rounded-2xl border border-slate-200 bg-slate-50 p-3">
              <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">Reason</div>
              <div className="mt-2 text-sm font-medium leading-6 text-slate-900">{agent.reason}</div>
            </div>

            <div className="grid gap-2 sm:grid-cols-2">
              <div className="rounded-2xl border border-slate-200 bg-white p-3">
                <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">当前任务</div>
                <div className="mt-2 text-sm font-semibold text-slate-900">{agent.currentAssignment}</div>
                <div className="mt-1 text-xs leading-5 text-slate-500">{agent.currentObjective}</div>
              </div>
              <div className="rounded-2xl border border-slate-200 bg-white p-3">
                <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">S / R / Esc</div>
                <div className="mt-2 text-sm font-semibold text-slate-900">
                  {agent.activeSessionCount} / {agent.activeRunCount} / {agent.openEscalationCount}
                </div>
                <div className="mt-1 text-xs leading-5 text-slate-500">最近信号 {formatTime(agent.latestSignalAt)}</div>
              </div>
            </div>

            <div className="rounded-2xl border border-slate-200 bg-white p-3">
              <div className="flex items-center justify-between gap-3">
                <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">证据</div>
                <span className="text-[11px] text-slate-400">{agent.sceneZoneLabel}</span>
              </div>
              <div className="mt-2 space-y-2">
                {agent.runtimeEvidence.length > 0 ? (
                  agent.runtimeEvidence.slice(0, 5).map((evidence, index) => (
                    <div key={`${evidence.kind}-${evidence.timestamp}-${index}`} className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2">
                      <div className="flex items-start justify-between gap-3">
                        <div className="text-xs leading-5 text-slate-700">{evidence.summary}</div>
                        <Badge variant="outline" className="border-slate-200 bg-white text-[10px] text-slate-500">
                          {evidence.kind}
                        </Badge>
                      </div>
                      <div className="mt-1 text-[11px] text-slate-400">{formatTime(evidence.timestamp)}</div>
                    </div>
                  ))
                ) : (
                  <div className="rounded-xl border border-dashed border-slate-200 bg-slate-50 px-3 py-4 text-xs text-slate-500">
                    当前没有可展示的 runtime evidence。
                  </div>
                )}
              </div>
            </div>

            <LiveProcessCard telemetry={processTelemetry} />

            <div className="rounded-2xl border border-slate-200 bg-white p-3">
              <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">Session / Run</div>
              <div className="mt-2 space-y-2">
                {agent.sessions.slice(0, 4).map((session) => (
                  <div key={session.sessionKey} className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2">
                    <div className="truncate text-xs font-semibold text-slate-900">{session.sessionKey}</div>
                    <div className="mt-1 flex items-center gap-2 text-[11px] text-slate-500">
                      <span>{session.sessionState}</span>
                      <span>·</span>
                      <span>{formatTime(session.lastStatusSyncAt ?? session.lastSeenAt)}</span>
                    </div>
                  </div>
                ))}
                {agent.runs.slice(0, 4).map((run) => (
                  <div key={run.runId} className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2">
                    <div className="truncate text-xs font-semibold text-slate-900">{run.runId}</div>
                    <div className="mt-1 flex items-center gap-2 text-[11px] text-slate-500">
                      <span>{run.state}</span>
                      <span>·</span>
                      <span>{formatTime(run.lastEventAt)}</span>
                    </div>
                  </div>
                ))}
                {agent.sessions.length === 0 && agent.runs.length === 0 ? (
                  <div className="rounded-xl border border-dashed border-slate-200 bg-slate-50 px-3 py-4 text-xs text-slate-500">
                    当前没有挂载到该成员的 session 或活跃 run。
                  </div>
                ) : null}
              </div>
            </div>
          </div>

          <div className="flex flex-wrap gap-2 border-t border-slate-100 px-4 py-4">
            <Button size="sm" variant="outline" onClick={() => navigate(`/chat/${encodeURIComponent(agent.agentId)}`)}>
              <MessageSquare className="mr-2 h-3.5 w-3.5" />
              会话
            </Button>
            <Button size="sm" variant="outline" onClick={() => navigate(`/employees/${encodeURIComponent(agent.agentId)}`)}>
              <UserRound className="mr-2 h-3.5 w-3.5" />
              详情
            </Button>
            <Button size="sm" variant="outline" onClick={() => navigate("/board")}>
              <BookOpenCheck className="mr-2 h-3.5 w-3.5" />
              看板
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}

export function RuntimeInspectorPageScreen() {
  const navigate = useNavigate();
  const { activeCompany, surface, statusSource, authoritySync } = useRuntimeInspectorViewModel();
  const [mode, setMode] = useState<RuntimeInspectorMode>("inspector");
  const [filter, setFilter] = useState<RuntimeInspectorFilter>("all");
  const [selectedAgentId, setSelectedAgentId] = useState<string | null>(null);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [broadcastEnabled, setBroadcastEnabled] = useState(true);
  const [broadcastSpeed, setBroadcastSpeed] = useState<BroadcastSpeed>("normal");

  const metrics = useMemo(() => buildMetrics(surface?.agents ?? []), [surface?.agents]);
  const filteredAgents = useMemo(
    () => (surface ? surface.agents.filter((agent) => matchesFilter(agent, filter)) : []),
    [filter, surface],
  );
  const broadcastCandidates = useMemo(() => {
    if (!surface) {
      return [] as RuntimeInspectorAgentSurface[];
    }
    const allowedAgentIds = new Set(filteredAgents.map((agent) => agent.agentId));
    const prioritized = surface.triageQueue.filter((agent) => allowedAgentIds.has(agent.agentId));
    const fallback = filteredAgents.filter((agent) => !prioritized.some((candidate) => candidate.agentId === agent.agentId));
    return [...prioritized, ...fallback];
  }, [filteredAgents, surface]);

  useEffect(() => {
    if (filteredAgents.length === 0) {
      setSelectedAgentId(null);
      setDrawerOpen(false);
      return;
    }
    if (!selectedAgentId || !filteredAgents.some((agent) => agent.agentId === selectedAgentId)) {
      setSelectedAgentId(filteredAgents[0]?.agentId ?? null);
    }
  }, [filteredAgents, selectedAgentId]);

  useEffect(() => {
    if (mode === "scene") {
      setDrawerOpen(false);
    }
  }, [mode]);

  useEffect(() => {
    if (mode !== "scene" || !broadcastEnabled || drawerOpen || broadcastCandidates.length <= 1) {
      return;
    }
    const currentIndex = Math.max(
      0,
      broadcastCandidates.findIndex((agent) => agent.agentId === selectedAgentId),
    );
    const timer = window.setTimeout(() => {
      const nextAgent = broadcastCandidates[(currentIndex + 1) % broadcastCandidates.length];
      if (nextAgent) {
        setSelectedAgentId(nextAgent.agentId);
      }
    }, getBroadcastInterval(broadcastSpeed));
    return () => window.clearTimeout(timer);
  }, [broadcastCandidates, broadcastEnabled, broadcastSpeed, drawerOpen, mode, selectedAgentId]);

  const selectedAgent =
    filteredAgents.find((agent) => agent.agentId === selectedAgentId)
    ?? filteredAgents[0]
    ?? null;
  const nextBroadcastAgent = useMemo(() => {
    if (broadcastCandidates.length <= 1) {
      return null;
    }
    const currentIndex = Math.max(
      0,
      broadcastCandidates.findIndex((agent) => agent.agentId === selectedAgent?.agentId),
    );
    return broadcastCandidates[(currentIndex + 1) % broadcastCandidates.length] ?? null;
  }, [broadcastCandidates, selectedAgent]);
  const focusedProcessTelemetry = useRuntimeInspectorProcessTelemetry(
    selectedAgent ?? surface?.focusAgent ?? null,
  );
  const globalProcessTelemetry = useRuntimeInspectorGlobalProcessTelemetry();

  if (!activeCompany) {
    return <div className="p-8 text-center text-muted-foreground">未选择正在运营的公司组织</div>;
  }

  if (!surface) {
    return <div className="p-8 text-center text-muted-foreground">正在汇聚运行态快照...</div>;
  }

  return (
    <div className="mx-auto flex max-w-[1600px] flex-col gap-3 p-3 md:p-4 lg:p-5">
      <Card className="overflow-hidden border-slate-200 bg-[radial-gradient(circle_at_top_left,_rgba(56,189,248,0.14),_transparent_38%),linear-gradient(180deg,#ffffff_0%,#f8fafc_100%)] shadow-sm">
        <CardContent className="flex flex-col gap-3 p-3 lg:p-4">
          <div className="flex flex-col gap-3 xl:flex-row xl:items-start xl:justify-between">
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-2">
                <Badge variant="outline" className="border-slate-200 bg-white text-slate-600">
                  {activeCompany.name}
                </Badge>
                <Badge variant="outline" className="border-indigo-200 bg-indigo-50 text-indigo-700">
                  Agent Runtime
                </Badge>
                <Badge variant="outline" className="border-slate-200 bg-white text-slate-500">
                  lifecycle-first
                </Badge>
                <Badge variant="outline" className={getSourceBadgeClass(statusSource)}>
                  {statusSource === "authority_complete"
                    ? "Authority canonical"
                    : statusSource === "authority_partial"
                      ? "Authority partial"
                      : "Fallback recomputed"}
                </Badge>
              </div>
              <h1 className="mt-2 text-xl font-black tracking-tight text-slate-950 md:text-2xl">
                公司运行态总览
              </h1>
              <p className="mt-1 max-w-4xl text-xs leading-5 text-slate-600 md:text-sm">
                一眼看清谁在执行、谁在等待、谁需要介入。详情只在右侧抽屉展开，不再挤占总览空间。
              </p>
              <div className="mt-2 flex flex-wrap items-center gap-2 text-[11px] text-slate-500">
                <span>
                  当前来源：
                  {statusSource === "authority_complete"
                    ? "完整权威状态机"
                    : statusSource === "authority_partial"
                      ? "局部权威 + 局部 fallback"
                      : "前端 fallback 重算"}
                </span>
                <span>{surface.statusCoverage.detail}</span>
                {authoritySync.lastPullAt ? <span>最近拉取 {formatTime(authoritySync.lastPullAt)}</span> : null}
                {authoritySync.lastAppliedSource ? <span>最近应用 {authoritySync.lastAppliedSource}</span> : null}
                {authoritySync.lastError ? <span className="text-rose-600">同步异常：{authoritySync.lastError}</span> : null}
              </div>
              <div
                className={cn(
                  "mt-2 rounded-2xl px-3 py-2 text-xs leading-5",
                  statusSource === "authority_complete"
                    ? "border border-emerald-200 bg-emerald-50 text-emerald-800"
                    : statusSource === "authority_partial"
                      ? "border border-amber-200 bg-amber-50 text-amber-800"
                      : "border border-rose-200 bg-rose-50 text-rose-800",
                )}
              >
                {surface.statusCoverage.detail}
              </div>
            </div>

            <div className="flex flex-wrap gap-2">
              <Button variant="outline" onClick={() => navigate("/ops")}>
                运营大厅
              </Button>
              <Button variant="outline" onClick={() => navigate("/board")}>
                工作看板
              </Button>
              <Button variant="outline" onClick={() => navigate("/ceo")}>
                CEO 首页
              </Button>
            </div>
          </div>

          <div className="grid gap-2 md:grid-cols-2 xl:grid-cols-4">
            {metrics.map((metric) => (
              <MetricCard
                key={metric.key}
                label={metric.label}
                value={metric.value}
                tone={metric.tone}
                icon={metric.icon}
              />
            ))}
          </div>

          <div className="flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between">
            <div className="flex flex-wrap gap-2">
              {MODE_OPTIONS.map((option) => {
                const Icon = option.icon;
                return (
                  <Button
                    key={option.id}
                    size="sm"
                    variant={mode === option.id ? "default" : "outline"}
                    className={cn("rounded-full", mode === option.id ? "" : "border-slate-200 bg-white text-slate-700")}
                    onClick={() => setMode(option.id)}
                  >
                    <Icon className="mr-2 h-4 w-4" />
                    {option.label}
                  </Button>
                );
              })}
              {mode === "scene" ? (
                <>
                  <Button
                    size="sm"
                    variant={broadcastEnabled ? "default" : "outline"}
                    className={cn(
                      "rounded-full",
                      broadcastEnabled
                        ? "bg-slate-900 text-white hover:bg-slate-800"
                        : "border-slate-200 bg-white text-slate-700",
                    )}
                    onClick={() => setBroadcastEnabled((current) => !current)}
                  >
                    {broadcastEnabled ? "播报中" : "暂停播报"}
                  </Button>
                  <div className="flex items-center gap-1 rounded-full border border-slate-200 bg-white p-1">
                    {BROADCAST_SPEED_OPTIONS.map((option) => (
                      <Button
                        key={option.id}
                        size="sm"
                        variant="ghost"
                        className={cn(
                          "h-7 rounded-full px-3 text-xs",
                          broadcastSpeed === option.id ? "bg-slate-900 text-white hover:bg-slate-800" : "text-slate-600",
                        )}
                        onClick={() => setBroadcastSpeed(option.id)}
                      >
                        {option.label}
                      </Button>
                    ))}
                  </div>
                </>
              ) : null}
            </div>

            <div className="flex flex-wrap gap-2">
              {FILTER_OPTIONS.map((option) => (
                <Button
                  key={option.id}
                  size="sm"
                  variant={filter === option.id ? "secondary" : "outline"}
                  className={cn(
                    "rounded-full",
                    filter === option.id ? "border-slate-200 bg-slate-900 text-white hover:bg-slate-800" : "",
                  )}
                  onClick={() => setFilter(option.id)}
                >
                  {option.label}
                  <span className="ml-2 rounded-full bg-white/15 px-2 py-0.5 text-[11px]">
                    {surface.agents.filter((agent) => matchesFilter(agent, option.id)).length}
                  </span>
                </Button>
              ))}
            </div>
          </div>
        </CardContent>
      </Card>

      {mode === "inspector" ? (
        <>
          <FocusHero agent={surface.focusAgent} actions={surface.recommendedActions} />

          <div className="grid gap-3 xl:grid-cols-[minmax(0,1.5fr)_minmax(360px,0.9fr)]">
            <Card className="overflow-hidden border-slate-200 bg-white shadow-sm">
              <CardHeader className="border-b border-slate-100 px-4 py-3">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <CardTitle className="text-base font-black tracking-tight text-slate-950">Inspector</CardTitle>
                    <CardDescription>按人查看 runtime、协作状态和当前处理原因。</CardDescription>
                  </div>
                  <Badge variant="outline" className="border-slate-200 bg-slate-50 text-slate-600">
                    {filteredAgents.length} / {surface.agents.length}
                  </Badge>
                </div>
              </CardHeader>
              <CardContent className="overflow-x-auto p-0">
                <div className="min-w-[1120px]">
                  <div className="grid grid-cols-[minmax(190px,1.05fr)_118px_140px_minmax(320px,2fr)_110px_62px_132px] gap-3 border-b border-slate-100 px-3 py-2 text-[10px] font-semibold uppercase tracking-[0.18em] text-slate-500">
                    <div>成员</div>
                    <div>Runtime</div>
                    <div>Coordination</div>
                    <div>Reason</div>
                    <div>区域</div>
                    <div className="text-right">S/R</div>
                    <div className="text-right">操作</div>
                  </div>
                  {filteredAgents.length > 0 ? (
                    filteredAgents.map((agent) => (
                      <InspectorRow
                        key={agent.agentId}
                        agent={agent}
                        selected={agent.agentId === selectedAgent?.agentId}
                        onSelect={() => {
                          setSelectedAgentId(agent.agentId);
                          setDrawerOpen(true);
                        }}
                      />
                    ))
                  ) : (
                    <div className="px-4 py-10 text-center text-sm text-slate-500">当前过滤条件下没有成员。</div>
                  )}
                </div>
              </CardContent>
            </Card>

            <div className="grid gap-3">
              <HistoryWindowCard
                items={surface.historyWindow}
                onSelect={(agentId) => {
                  setSelectedAgentId(agentId);
                  setDrawerOpen(true);
                }}
              />
              <LiveProcessCard telemetry={globalProcessTelemetry} compact />
              <LiveProcessCard telemetry={focusedProcessTelemetry} />
              <ReplayCard
                items={surface.replay}
                onSelect={(agentId) => {
                  setSelectedAgentId(agentId);
                  setDrawerOpen(true);
                }}
              />
              <ChainLinksCard
                items={surface.chainLinks}
                onSelect={(agentId) => {
                  setSelectedAgentId(agentId);
                  setDrawerOpen(true);
                }}
              />
              <WatchlistCard
                agents={surface.watchlist}
                selectedAgentId={selectedAgent?.agentId ?? null}
                onSelect={(agentId) => {
                  setSelectedAgentId(agentId);
                  setDrawerOpen(true);
                }}
              />
              <TimelineCard
                items={surface.timeline}
                onSelect={(agentId) => {
                  setSelectedAgentId(agentId);
                  setDrawerOpen(true);
                }}
              />
              <ZoneHealthCard zones={surface.sceneZones} />
            </div>
          </div>
        </>
      ) : (
        <>
          <TheaterStatusBar
            agent={selectedAgent ?? surface.focusAgent}
            statusSource={statusSource}
            metrics={metrics}
            processTelemetry={globalProcessTelemetry}
            chainLinks={surface.chainLinks}
            broadcastEnabled={broadcastEnabled}
            broadcastLabel={getBroadcastLabel(broadcastSpeed)}
            nextAgent={nextBroadcastAgent}
          />
          <div className="relative overflow-hidden rounded-[32px] border border-slate-900/70 bg-[linear-gradient(135deg,#020617_0%,#0f172a_52%,#111827_100%)] p-3 shadow-[0_30px_80px_rgba(2,6,23,0.35)] sm:p-4">
            <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top_left,rgba(34,211,238,0.15),transparent_26%),radial-gradient(circle_at_bottom_right,rgba(129,140,248,0.16),transparent_24%)]" />
            <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(transparent_0,transparent_35px,rgba(148,163,184,0.05)_36px)] bg-[length:100%_36px] opacity-50" />
            <div className="relative space-y-3">
              <MissionStrip
                agent={surface.focusAgent}
                actions={surface.recommendedActions}
                metrics={metrics}
                theater
              />
              <CrewStatusStrip
                agents={filteredAgents}
                selectedAgentId={selectedAgent?.agentId ?? null}
                theater
                onSelect={(agentId) => {
                  setSelectedAgentId(agentId);
                  setDrawerOpen(true);
                }}
              />
              <div className="grid gap-3 xl:grid-cols-[minmax(0,1.45fr)_minmax(340px,0.78fr)]">
                <MissionFloorplan
                  zones={surface.sceneZones}
                  timeline={surface.timeline}
                  chainLinks={surface.chainLinks}
                  selectedAgentId={selectedAgent?.agentId ?? null}
                  filter={filter}
                  theater
                  onSelect={(agentId) => {
                    setSelectedAgentId(agentId);
                  }}
                />
                <MissionSidebar
                  agent={selectedAgent ?? surface.focusAgent}
                  processTelemetry={focusedProcessTelemetry}
                  historyWindow={surface.historyWindow}
                  replay={surface.replay}
                  chainLinks={surface.chainLinks}
                  triageQueue={surface.triageQueue}
                  actions={surface.recommendedActions}
                  watchlist={surface.watchlist}
                  timeline={surface.timeline}
                  zones={surface.sceneZones}
                  selectedAgentId={selectedAgent?.agentId ?? null}
                  theater
                  onSelect={(agentId) => {
                    setSelectedAgentId(agentId);
                  }}
                />
              </div>
            </div>
          </div>
        </>
      )}

      {selectedAgent ? (
        <div className="pointer-events-none fixed bottom-4 right-4 z-30 hidden xl:flex">
          <button
            type="button"
            onClick={() => setDrawerOpen(true)}
            className="pointer-events-auto flex items-center gap-2 rounded-full border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-700 shadow-lg"
          >
            <span className={cn("h-2.5 w-2.5 rounded-full", getRuntimeDotClass(selectedAgent))} />
            {selectedAgent.nickname}
            <ChevronRight className="h-4 w-4" />
          </button>
        </div>
      ) : null}

        <DetailDrawer
          agent={selectedAgent}
          processTelemetry={focusedProcessTelemetry}
          open={drawerOpen}
          onClose={() => setDrawerOpen(false)}
        />
    </div>
  );
}
