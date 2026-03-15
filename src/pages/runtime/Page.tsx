import { ChevronRight } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import type { RuntimeInspectorAgentSurface } from "../../application/runtime-inspector";
import {
  useRuntimeInspectorGlobalProcessTelemetry,
  useRuntimeInspectorProcessTelemetry,
  useRuntimeInspectorViewModel,
} from "../../application/runtime-inspector";
import { cn, formatTime } from "../../lib/utils";
import { Badge } from "../../ui/badge";
import { Button } from "../../ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "../../ui/card";
import { DetailDrawer, InspectorRow } from "./RuntimeInspectorDetailComponents";
import {
  ChainLinksCard,
  FocusHero,
  HistoryWindowCard,
  LiveProcessCard,
  MissionStrip,
  ReplayCard,
  TheaterStatusBar,
  TimelineCard,
  WatchlistCard,
  ZoneHealthCard,
} from "./RuntimeInspectorOverviewComponents";
import {
  CrewStatusStrip,
  MissionFloorplan,
  MissionSidebar,
} from "./RuntimeInspectorSceneComponents";
import {
  BROADCAST_SPEED_OPTIONS,
  buildMetrics,
  FILTER_OPTIONS,
  getBroadcastInterval,
  getBroadcastLabel,
  MetricCard,
  getRuntimeDotClass,
  getSourceBadgeClass,
  getStatusSourceBadgeLabel,
  getStatusSourceInlineLabel,
  matchesFilter,
  MODE_OPTIONS,
  type BroadcastSpeed,
  type RuntimeInspectorFilter,
  type RuntimeInspectorMode,
} from "./runtime-inspector-shared";

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
    const fallback = filteredAgents.filter(
      (agent) => !prioritized.some((candidate) => candidate.agentId === agent.agentId),
    );
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
    filteredAgents.find((agent) => agent.agentId === selectedAgentId) ?? filteredAgents[0] ?? null;
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
                  {getStatusSourceBadgeLabel(statusSource)}
                </Badge>
              </div>
              <h1 className="mt-2 text-xl font-black tracking-tight text-slate-950 md:text-2xl">
                公司运行态总览
              </h1>
              <p className="mt-1 max-w-4xl text-xs leading-5 text-slate-600 md:text-sm">
                一眼看清谁在执行、谁在等待、谁需要介入。详情只在右侧抽屉展开，不再挤占总览空间。
              </p>
              <div className="mt-2 flex flex-wrap items-center gap-2 text-[11px] text-slate-500">
                <span>当前来源：{getStatusSourceInlineLabel(statusSource)}</span>
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
              {statusSource !== "authority_complete" ? (
                <div className="mt-2 text-[11px] leading-5 text-slate-500">
                  恢复/兼容来源只用于补齐观察面和排障，不代表新的业务主写入路径。
                </div>
              ) : null}
            </div>

            <div className="flex flex-wrap gap-2">
              <Button variant="outline" onClick={() => navigate("/ops")}>
                Ops
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
                    className={cn(
                      "rounded-full",
                      mode === option.id ? "" : "border-slate-200 bg-white text-slate-700",
                    )}
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
                          broadcastSpeed === option.id
                            ? "bg-slate-900 text-white hover:bg-slate-800"
                            : "text-slate-600",
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
                    filter === option.id
                      ? "border-slate-200 bg-slate-900 text-white hover:bg-slate-800"
                      : "",
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
                    <CardTitle className="text-base font-black tracking-tight text-slate-950">
                      Inspector
                    </CardTitle>
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
                    <div className="px-4 py-10 text-center text-sm text-slate-500">
                      当前过滤条件下没有成员。
                    </div>
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
