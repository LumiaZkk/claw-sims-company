import {
  Activity,
  Cpu,
  Grid2x2,
  Radar,
  ShieldAlert,
  UserRound,
  WifiOff,
  Workflow,
} from "lucide-react";
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
import { cn } from "../../lib/utils";

export type RuntimeInspectorMode = "inspector" | "scene";
export type RuntimeInspectorFilter = "all" | "executing" | "waiting" | "intervention" | "no_signal";
export type MetricTone = "default" | "accent" | "warning" | "danger";
export type BroadcastSpeed = "fast" | "normal" | "slow";

export const MODE_OPTIONS: Array<{ id: RuntimeInspectorMode; label: string; icon: typeof Radar }> = [
  { id: "inspector", label: "Inspector", icon: Radar },
  { id: "scene", label: "Scene", icon: Grid2x2 },
];

export const FILTER_OPTIONS: Array<{ id: RuntimeInspectorFilter; label: string }> = [
  { id: "all", label: "全部" },
  { id: "executing", label: "执行中" },
  { id: "waiting", label: "待协作" },
  { id: "intervention", label: "需介入" },
  { id: "no_signal", label: "无信号" },
];

export const BROADCAST_SPEED_OPTIONS: Array<{ id: BroadcastSpeed; label: string; intervalMs: number }> = [
  { id: "fast", label: "快", intervalMs: 4_000 },
  { id: "normal", label: "中", intervalMs: 7_000 },
  { id: "slow", label: "慢", intervalMs: 10_000 },
];

export function getRuntimeLabel(agent: RuntimeInspectorAgentSurface): string {
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

export function getRuntimeBadgeClass(agent: RuntimeInspectorAgentSurface): string {
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

export function getRuntimeDotClass(agent: RuntimeInspectorAgentSurface): string {
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

export function getCoordinationLabel(agent: RuntimeInspectorAgentSurface): string {
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

export function getCoordinationBadgeClass(agent: RuntimeInspectorAgentSurface): string {
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

export function getInterventionLabel(agent: RuntimeInspectorAgentSurface): string {
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

export function getInterventionBadgeClass(agent: RuntimeInspectorAgentSurface): string {
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

export function matchesFilter(agent: RuntimeInspectorAgentSurface, filter: RuntimeInspectorFilter): boolean {
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

export function metricToneClass(tone: MetricTone): string {
  if (tone === "accent") return "border-sky-200 bg-sky-50 text-sky-700";
  if (tone === "warning") return "border-amber-200 bg-amber-50 text-amber-700";
  if (tone === "danger") return "border-rose-200 bg-rose-50 text-rose-700";
  return "border-slate-200 bg-white text-slate-700";
}

export function buildMetrics(agents: RuntimeInspectorAgentSurface[]) {
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

export function MetricCard(props: {
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

export function getBroadcastInterval(speed: BroadcastSpeed): number {
  return BROADCAST_SPEED_OPTIONS.find((option) => option.id === speed)?.intervalMs ?? 7_000;
}

export function getBroadcastLabel(speed: BroadcastSpeed): string {
  return BROADCAST_SPEED_OPTIONS.find((option) => option.id === speed)?.label ?? "中";
}

export function getActionToneClass(tone: RuntimeInspectorRecommendedAction["tone"]): string {
  if (tone === "danger") return "border-rose-200 bg-rose-50 text-rose-700";
  if (tone === "warning") return "border-amber-200 bg-amber-50 text-amber-700";
  return "border-slate-200 bg-white text-slate-700";
}

export function getChainToneClass(tone: RuntimeInspectorChainLink["tone"]): string {
  if (tone === "danger") return "bg-rose-500";
  if (tone === "warning") return "bg-amber-500";
  return "bg-sky-500";
}

export function getChainBadgeClass(tone: RuntimeInspectorChainLink["tone"]): string {
  if (tone === "danger") return "border-rose-200 bg-rose-50 text-rose-700";
  if (tone === "warning") return "border-amber-200 bg-amber-50 text-amber-700";
  return "border-sky-200 bg-sky-50 text-sky-700";
}

export function getTimelineToneClass(tone: RuntimeInspectorTimelineEvent["tone"]): string {
  if (tone === "danger") return "bg-rose-500";
  if (tone === "warning") return "bg-amber-500";
  if (tone === "success") return "bg-emerald-500";
  return "bg-sky-500";
}

export function getReplayToneClass(tone: RuntimeInspectorReplayEvent["tone"]): string {
  if (tone === "danger") return "bg-rose-500";
  if (tone === "warning") return "bg-amber-500";
  if (tone === "success") return "bg-emerald-500";
  return "bg-sky-500";
}

export function getReplayBadgeClass(tone: RuntimeInspectorReplayEvent["tone"]): string {
  if (tone === "danger") return "border-rose-200 bg-rose-50 text-rose-700";
  if (tone === "warning") return "border-amber-200 bg-amber-50 text-amber-700";
  if (tone === "success") return "border-emerald-200 bg-emerald-50 text-emerald-700";
  return "border-sky-200 bg-sky-50 text-sky-700";
}

export function getHistoryToneClass(tone: RuntimeInspectorHistoryEvent["tone"]): string {
  if (tone === "danger") return "bg-rose-500";
  if (tone === "warning") return "bg-amber-500";
  if (tone === "success") return "bg-emerald-500";
  return "bg-sky-500";
}

export function getProcessToneClass(tone: RuntimeInspectorProcessTelemetry["processes"][number]["tone"]): string {
  if (tone === "danger") return "bg-rose-500";
  if (tone === "warning") return "bg-amber-500";
  if (tone === "success") return "bg-emerald-500";
  return "bg-sky-500";
}

export function getProcessBadgeClass(tone: RuntimeInspectorProcessTelemetry["processes"][number]["tone"]): string {
  if (tone === "danger") return "border-rose-200 bg-rose-50 text-rose-700";
  if (tone === "warning") return "border-amber-200 bg-amber-50 text-amber-700";
  if (tone === "success") return "border-emerald-200 bg-emerald-50 text-emerald-700";
  return "border-sky-200 bg-sky-50 text-sky-700";
}

export function getZoneStatusClass(status: RuntimeInspectorAgentSurface["attention"]): string {
  if (status === "critical") return "border-rose-200 bg-rose-50 text-rose-700";
  if (status === "watch") return "border-amber-200 bg-amber-50 text-amber-700";
  return "border-emerald-200 bg-emerald-50 text-emerald-700";
}

export function getAttentionChipClass(agent: RuntimeInspectorAgentSurface): string {
  if (agent.attention === "critical") return "border-rose-200 bg-rose-50 text-rose-700";
  if (agent.attention === "watch") return "border-amber-200 bg-amber-50 text-amber-700";
  return "border-emerald-200 bg-emerald-50 text-emerald-700";
}

export function getZonePanelLayoutClass(zoneId: RuntimeInspectorSceneZone["id"]): string {
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

export function getZonePanelSurfaceClass(zoneId: RuntimeInspectorSceneZone["id"]): string {
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

export function getZoneAccentClass(zoneId: RuntimeInspectorSceneZone["id"]): string {
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

export function getZoneIcon(zoneId: RuntimeInspectorSceneZone["id"]): typeof Radar {
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

export function getStatusOriginBadgeClass(origin: RuntimeInspectorAgentSurface["statusOrigin"]): string {
  return origin === "authority"
    ? "border-emerald-200 bg-emerald-50 text-emerald-700"
    : "border-amber-200 bg-amber-50 text-amber-700";
}

export function getStatusOriginLabel(origin: RuntimeInspectorAgentSurface["statusOrigin"]): string {
  return origin === "authority" ? "Authority" : "Fallback";
}

export const SCENE_ZONE_ANCHORS: Record<
  RuntimeInspectorSceneZone["id"],
  { x: number; y: number }
> = {
  "command-deck": { x: 27, y: 14 },
  "tech-lab": { x: 82, y: 24 },
  "ops-rail": { x: 28, y: 49 },
  "people-hub": { x: 17, y: 87 },
  "studio-floor": { x: 70, y: 87 },
};

export type SceneChainOverlay = {
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

export function buildSceneChainOverlays(
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

export function getSpriteBodyClass(agent: RuntimeInspectorAgentSurface): string {
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

export function getSpriteShellClass(agent: RuntimeInspectorAgentSurface): string {
  if (agent.attention === "critical") return "bg-rose-950";
  if (agent.attention === "watch") return "bg-amber-950";
  return "bg-slate-950";
}

export function getSourceBadgeClass(source: RuntimeInspectorStatusSource): string {
  if (source === "authority_complete") {
    return "border-emerald-200 bg-emerald-50 text-emerald-700";
  }
  if (source === "authority_partial") {
    return "border-amber-200 bg-amber-50 text-amber-700";
  }
  return "border-rose-200 bg-rose-50 text-rose-700";
}

export function getStatusSourceBadgeLabel(source: RuntimeInspectorStatusSource): string {
  if (source === "authority_complete") {
    return "Authority canonical";
  }
  if (source === "authority_partial") {
    return "Authority partial";
  }
  return "Recovery / compat";
}

export function getStatusSourceInlineLabel(source: RuntimeInspectorStatusSource): string {
  if (source === "authority_complete") {
    return "完整权威状态机";
  }
  if (source === "authority_partial") {
    return "局部权威 + 恢复/兼容来源";
  }
  return "恢复/兼容投影";
}

