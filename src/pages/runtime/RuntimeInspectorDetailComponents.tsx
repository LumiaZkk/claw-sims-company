import { BookOpenCheck, MessageSquare, UserRound, X } from "lucide-react";
import { useNavigate } from "react-router-dom";
import type {
  RuntimeInspectorAgentSurface,
  RuntimeInspectorProcessTelemetry,
} from "../../application/runtime-inspector";
import { cn, formatTime } from "../../lib/utils";
import { Badge } from "../../ui/badge";
import { Button } from "../../ui/button";
import { LiveProcessCard } from "./RuntimeInspectorOverviewComponents";
import {
  getCoordinationBadgeClass,
  getCoordinationLabel,
  getInterventionBadgeClass,
  getInterventionLabel,
  getRuntimeBadgeClass,
  getRuntimeDotClass,
  getRuntimeLabel,
  getStatusOriginBadgeClass,
  getStatusOriginLabel,
} from "./runtime-inspector-shared";

export function InspectorRow(props: {
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

export function DetailDrawer(props: {
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
