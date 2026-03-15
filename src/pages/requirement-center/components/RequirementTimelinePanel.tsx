import { Sparkles } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "../../../ui/card";
import { formatTime } from "../../../lib/utils";

type MetricSummary = {
  requirementCenterOpened: number;
  collaborationOpened: number;
  workspaceOpened: number;
  opsOpened: number;
  acceptanceRequested: number;
  acceptanceAccepted: number;
  requirementReopened: number;
};

type TimelineEvent = {
  id: string;
  actorId?: string | null;
  eventType: string;
  source: string;
  timestamp: number;
  payload: Record<string, unknown>;
};

function getTimelineLabel(eventType: string) {
  if (eventType === "requirement_seeded") return "主线已立项";
  if (eventType === "requirement_promoted") return "主线已切换";
  if (eventType === "requirement_change_requested") return "需求变更待确认";
  if (eventType === "requirement_owner_changed") return "负责人已变更";
  if (eventType === "requirement_room_bound") return "需求房已绑定";
  if (eventType === "requirement_completed") return "执行已收口";
  if (eventType === "requirement_acceptance_requested") return "已发起验收";
  if (eventType === "requirement_accepted") return "验收已通过";
  if (eventType === "requirement_reopened") return "需求已重开";
  if (eventType.startsWith("chat_")) return "收到会话证据";
  return "主线已更新";
}

function getTimelineSummary(payload: Record<string, unknown>) {
  if (typeof payload.summary === "string" && payload.summary.trim().length > 0) {
    return payload.summary.trim();
  }
  if (typeof payload.messageText === "string" && payload.messageText.trim().length > 0) {
    return payload.messageText.trim();
  }
  if (typeof payload.nextAction === "string" && payload.nextAction.trim().length > 0) {
    return payload.nextAction.trim();
  }
  return "当前主线已收到新的推进证据。";
}

export function RequirementTimelinePanel(props: {
  metricSummary: MetricSummary;
  requirementTimeline: TimelineEvent[];
  employees: Array<{ agentId: string; nickname: string }>;
}) {
  const { metricSummary, requirementTimeline, employees } = props;

  return (
    <Card className="border-slate-200 bg-white shadow-sm">
      <CardHeader className="border-b bg-slate-50/70">
        <CardTitle className="flex items-center gap-2 text-base">
          <Sparkles className="h-4 w-4 text-indigo-600" />
          主线时间线
        </CardTitle>
        <CardDescription>
          把 workflow event、chat evidence 和验收动作收成一条时间线，方便从头验收。
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4 p-4">
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="rounded-2xl border border-slate-200 bg-slate-50/70 px-4 py-3">
            <div className="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-500">进入需求中心</div>
            <div className="mt-2 text-2xl font-semibold text-slate-950">{metricSummary.requirementCenterOpened}</div>
          </div>
          <div className="rounded-2xl border border-slate-200 bg-slate-50/70 px-4 py-3">
            <div className="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-500">进入协作 / 交付</div>
            <div className="mt-2 text-2xl font-semibold text-slate-950">
              {metricSummary.collaborationOpened + metricSummary.workspaceOpened}
            </div>
          </div>
          <div className="rounded-2xl border border-slate-200 bg-slate-50/70 px-4 py-3">
            <div className="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-500">进入 Ops</div>
            <div className="mt-2 text-2xl font-semibold text-slate-950">{metricSummary.opsOpened}</div>
          </div>
          <div className="rounded-2xl border border-slate-200 bg-slate-50/70 px-4 py-3">
            <div className="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-500">验收动作</div>
            <div className="mt-2 text-2xl font-semibold text-slate-950">
              {metricSummary.acceptanceRequested + metricSummary.acceptanceAccepted + metricSummary.requirementReopened}
            </div>
          </div>
        </div>

        <div className="space-y-3">
          {requirementTimeline.length > 0 ? (
            requirementTimeline.map((event) => {
              const actorId =
                typeof event.actorId === "string" && event.actorId.trim().length > 0
                  ? event.actorId.trim()
                  : null;
              const actorLabel =
                actorId
                  ? employees.find((employee) => employee.agentId === actorId)?.nickname ?? actorId
                  : event.source === "company-event"
                    ? "公司事件"
                    : "系统";
              return (
                <div key={event.id} className="rounded-2xl border border-slate-200 bg-white p-4">
                  <div className="flex flex-wrap items-center gap-2 text-xs text-slate-500">
                    <span className="rounded-full border border-slate-200 bg-slate-50 px-2 py-0.5 text-slate-600">
                      {getTimelineLabel(event.eventType)}
                    </span>
                    <span>{actorLabel}</span>
                    <span>·</span>
                    <span>{formatTime(event.timestamp)}</span>
                    <span>·</span>
                    <span>{event.source}</span>
                  </div>
                  <div className="mt-2 text-sm leading-6 text-slate-800">
                    {getTimelineSummary(event.payload)}
                  </div>
                </div>
              );
            })
          ) : (
            <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50 p-4 text-sm leading-6 text-slate-500">
              当前主线还没有足够多的事件证据。你从头创建公司并推进后，这里会逐步形成完整时间线。
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
