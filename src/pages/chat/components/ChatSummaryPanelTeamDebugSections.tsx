import { RefreshCcw, Users } from "lucide-react";
import { TakeoverCasePanel } from "../../../shared/presentation/TakeoverCasePanel";
import { Button } from "../../../ui/button";
import { ExecutionStateBadge } from "../../../shared/presentation/execution-state-badge";
import { formatRequestDeliveryStateLabel } from "../../../application/governance/focus-summary";
import { resolveExecutionState } from "../../../application/mission/execution-state";
import { cn, formatTime } from "../../../lib/utils";
import type { ChatSummaryPanelBodyProps } from "./chat-summary-panel-types";
import { TimelinePreview } from "./chat-summary-panel-shared";

export function ChatSummaryPanelTeamSection({
  collaborationSurface,
  detailActions,
  displayNextBatonAgentId,
  hasTechnicalSummary,
  onNavigateToChat,
  onNavigateToTeamGroup,
  onRunAction,
  primaryOpenAction,
  recoveringCommunication,
  requirementTeam,
  runningFocusActionId,
  summaryRecoveryAction,
  targetAgentId,
  teamGroupRoute,
  teamMemberCards,
}: ChatSummaryPanelBodyProps) {
  if (!requirementTeam) {
    return null;
  }

  return (
    <>
      <section className="rounded-2xl border border-slate-200 bg-slate-50/70 p-4">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <div className="text-sm font-semibold text-slate-900">团队总览</div>
            <div className="mt-1 text-xs leading-5 text-slate-500">负责人盯闭环，团队房间盯 baton、成员状态和结论发言。</div>
          </div>
          <div className="rounded-full border border-slate-200 bg-white px-3 py-1 text-[11px] text-slate-600">
            进度 {requirementTeam.progressLabel}
          </div>
        </div>
        <div className="mt-3 grid gap-3 md:grid-cols-3">
          <div className="rounded-xl border border-white/80 bg-white px-4 py-3">
            <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">
              协作模式
            </div>
            <div className="mt-2 text-sm font-semibold text-slate-900">
              {collaborationSurface?.collaborationLabel ?? "多人并行"}
            </div>
            <div className="mt-1 text-xs leading-5 text-slate-600">
              负责人：{requirementTeam.ownerLabel}
            </div>
          </div>
          <div className="rounded-xl border border-white/80 bg-white px-4 py-3">
            <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">
              当前卡点
            </div>
            <div className="mt-2 text-sm font-semibold text-slate-900">
              {collaborationSurface?.overviewSummary.currentBlocker ?? "暂无明确卡点"}
            </div>
            <div className="mt-1 text-xs leading-5 text-slate-600">多人协作默认并行推进，不强调单一接棒。</div>
          </div>
          <div className="rounded-xl border border-white/80 bg-white px-4 py-3">
            <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">当前判断</div>
            <div className="mt-2 text-sm leading-6 text-slate-800">{requirementTeam.summary}</div>
          </div>
        </div>
        <div className="mt-3 flex flex-wrap gap-2">
          {teamGroupRoute ? (
            <Button
              type="button"
              size="sm"
              variant="outline"
              className="border-slate-300 bg-white text-slate-900 hover:bg-slate-100"
              onClick={onNavigateToTeamGroup}
            >
              <Users className="mr-2 h-3.5 w-3.5" />
              打开需求团队房间
            </Button>
          ) : null}
          {primaryOpenAction ? (
            <Button
              type="button"
              size="sm"
              variant="outline"
              className="border-slate-300 bg-white text-slate-900 hover:bg-slate-100"
              onClick={() => onRunAction(primaryOpenAction)}
            >
              {primaryOpenAction.label}
            </Button>
          ) : null}
          {summaryRecoveryAction ? (
            <Button
              type="button"
              size="sm"
              variant="outline"
              className="border-slate-300 bg-white text-slate-900 hover:bg-slate-100"
              onClick={() => onRunAction(summaryRecoveryAction)}
            >
              同步当前阻塞
            </Button>
          ) : null}
        </div>
      </section>

      <section className="rounded-2xl border border-slate-200 bg-white p-4">
        <div className="text-sm font-semibold text-slate-900">团队成员</div>
        <div className="mt-1 text-xs leading-5 text-slate-500">这里只看这条需求相关的人。你可以直接打开会话，或者打断让他调整处理方式。</div>
        <div className="mt-4 space-y-3">
          {teamMemberCards.map((member) => (
            <div key={member.agentId} className="rounded-xl border border-slate-200 bg-slate-50/70 px-4 py-3">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <div className="text-sm font-medium text-slate-900">{member.label}</div>
                    <span className="rounded-full border border-slate-200 bg-white px-2 py-0.5 text-[11px] text-slate-600">
                      {member.statusLabel}
                    </span>
                    {member.isOwner ? (
                      <span className="rounded-full border border-slate-200 bg-slate-900 px-2 py-0.5 text-[11px] text-white">负责人</span>
                    ) : null}
                    {member.isCurrent ? (
                      <span className="rounded-full border border-rose-200 bg-rose-50 px-2 py-0.5 text-[11px] text-rose-700">
                        当前活跃
                      </span>
                    ) : null}
                    {!collaborationSurface?.isSingleOwnerClosure &&
                    (displayNextBatonAgentId === member.agentId || member.isNext) ? (
                      <span className="rounded-full border border-indigo-200 bg-indigo-50 px-2 py-0.5 text-[11px] text-indigo-700">
                        下一棒
                      </span>
                    ) : null}
                  </div>
                  <div className="mt-1 text-[11px] text-slate-500">
                    {member.role} · 当前环节：{member.stage}
                  </div>
                  <div className="mt-2 text-sm leading-6 text-slate-700">{member.detail}</div>
                </div>
                <div className="flex flex-wrap gap-2">
                  {member.agentId !== targetAgentId ? (
                    <Button type="button" size="sm" variant="outline" onClick={() => onNavigateToChat(member.agentId)}>
                      打开会话
                    </Button>
                  ) : null}
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    disabled={member.isAdjustLoading}
                    className="border-indigo-200 bg-white text-indigo-700 hover:bg-indigo-50"
                    onClick={() => onRunAction(member.adjustAction)}
                  >
                    {member.isAdjustLoading ? (
                      <>
                        <RefreshCcw className="mr-2 h-3.5 w-3.5 animate-spin" />
                        处理中...
                      </>
                    ) : (
                      `让 ${member.label} 调整`
                    )}
                  </Button>
                </div>
              </div>
            </div>
          ))}
        </div>
      </section>

      <TimelinePreview
        title="群聊式时间线"
        description="默认只看最近几条关键发言，展开后再看完整协作历史。"
        count={requirementTeam.timeline.length}
        previewItems={requirementTeam.timeline.slice(0, 3).map((event) => ({
          id: event.id,
          title: `${event.agentLabel} · ${event.headline}`,
          subtitle: event.summary,
          meta: formatTime(event.timestamp),
        }))}
      >
        <div className="space-y-3">
          {requirementTeam.timeline.map((event) => (
            <div key={event.id} className="rounded-xl border border-slate-200 bg-slate-50/70 px-4 py-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="flex flex-wrap items-center gap-2">
                  <div className="text-sm font-medium text-slate-900">{event.agentLabel}</div>
                  <span className="rounded-full border border-slate-200 bg-white px-2 py-0.5 text-[11px] text-slate-600">
                    {event.kind === "dispatch" ? "收到指令" : event.kind === "reply" ? "结论发言" : "团队状态"}
                  </span>
                </div>
                <div className="text-[11px] text-slate-400">{formatTime(event.timestamp)}</div>
              </div>
              <div className="mt-1 text-[11px] text-slate-500">{event.role}</div>
              <div className="mt-2 text-sm font-medium text-slate-900">{event.headline}</div>
              <div className="mt-1 text-sm leading-6 text-slate-700">{event.summary}</div>
              {event.detail ? <div className="mt-1 text-xs leading-5 text-slate-500">{event.detail}</div> : null}
            </div>
          ))}
        </div>
      </TimelinePreview>

      {requirementTeam.artifacts.length > 0 ? (
        <section className="rounded-2xl border border-slate-200 bg-white p-4">
          <div className="text-sm font-semibold text-slate-900">交付物</div>
          <div className="mt-1 text-xs leading-5 text-slate-500">这里看这条需求已经落下来的文件，方便判断某一步到底有没有真正交付。</div>
          <div className="mt-3 space-y-2">
            {requirementTeam.artifacts.map((artifact) => (
              <div
                key={artifact.id}
                className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-slate-200 bg-slate-50/70 px-4 py-3"
              >
                <div>
                  <div className="text-sm font-medium text-slate-900">{artifact.label}</div>
                  <div className="mt-1 text-xs leading-5 text-slate-500">
                    {artifact.ownerLabel} · {artifact.path}
                  </div>
                </div>
                <span
                  className={cn(
                    "rounded-full border px-2 py-0.5 text-[11px] font-medium",
                    artifact.exists
                      ? "border-emerald-200 bg-emerald-50 text-emerald-700"
                      : "border-amber-200 bg-amber-50 text-amber-800",
                  )}
                >
                  {artifact.exists ? "已落盘" : "未找到"}
                </span>
              </div>
            ))}
          </div>
        </section>
      ) : null}
    </>
  );
}

export function ChatSummaryPanelDebugSection({
  ceoSurface,
  collaborationSurface = null,
  effectiveStatusLabel,
  handoffPreview,
  hasRequirementOverview,
  headerStatusBadgeClass,
  hasTechnicalSummary,
  isTechnicalSummaryOpen,
  localSlaFallbackAlertCount,
  onAcknowledgeTakeoverCase,
  onArchiveTakeoverCase,
  onAssignTakeoverCase,
  onCopyTakeoverPack,
  onOpenTakeoverCase,
  onRedispatchTakeoverCase,
  onResolveTakeoverCase,
  onStartTakeoverCase,
  onToggleTechnicalSummary,
  orgAdvisorSummary,
  relatedSlaAlertCount,
  requestHealth,
  requestPreview,
  structuredTaskPreview,
  summaryAlertCount,
  takeoverCaseBusyId,
  takeoverCaseSummary,
  takeoverPack,
}: ChatSummaryPanelBodyProps) {
  if (!hasTechnicalSummary) {
    return null;
  }

  return (
    <section className="rounded-xl border border-slate-200 bg-white/90">
      <button
        type="button"
        className="flex w-full flex-wrap items-center justify-between gap-3 px-4 py-3 text-left"
        onClick={onToggleTechnicalSummary}
      >
        <div>
          <div className="text-sm font-semibold text-slate-900">调试信息</div>
          <div className="mt-1 text-xs leading-5 text-slate-500">这里只保留系统对象和异常提示，默认不影响正常阅读。</div>
        </div>
        <span className="inline-flex items-center gap-1 text-xs font-medium text-slate-500">
          {isTechnicalSummaryOpen ? "收起细节" : "展开细节"}
        </span>
      </button>
      {isTechnicalSummaryOpen ? (
        <div className="border-t border-slate-200 px-4 py-4">
          <div className="grid gap-4">
            {takeoverPack || takeoverCaseSummary.primaryCase ? (
              <TakeoverCasePanel
                summary={takeoverCaseSummary}
                busyCaseId={takeoverCaseBusyId}
                onOpenCase={onOpenTakeoverCase}
                onAcknowledgeCase={onAcknowledgeTakeoverCase}
                onAssignCase={onAssignTakeoverCase}
                onStartCase={onStartTakeoverCase}
                onResolveCase={onResolveTakeoverCase}
                onRedispatchCase={onRedispatchTakeoverCase}
                onArchiveCase={onArchiveTakeoverCase}
                extraActions={
                  takeoverPack ? (
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      className="border-amber-200 bg-white text-amber-900 hover:bg-amber-100"
                      onClick={onCopyTakeoverPack}
                    >
                      复制接管包
                    </Button>
                  ) : null
                }
              />
            ) : null}
            {structuredTaskPreview ? (
              <section className="rounded-xl border border-slate-200 bg-slate-50/70 p-4">
                <div className="flex flex-wrap items-center gap-2">
                  <div className="text-sm font-semibold text-slate-900">任务摘要</div>
                  {hasRequirementOverview ? (
                    <span className={headerStatusBadgeClass}>{effectiveStatusLabel}</span>
                  ) : structuredTaskPreview.state ? (
                    <ExecutionStateBadge
                      compact
                      status={resolveExecutionState({
                        fallbackState: undefined,
                        evidenceTexts: [structuredTaskPreview.summary ?? ""],
                      })}
                    />
                  ) : null}
                </div>
                <div className="mt-2 text-sm text-slate-700">
                  {hasRequirementOverview ? collaborationSurface?.overviewSummary.goalSummary ?? structuredTaskPreview.summary : structuredTaskPreview.summary}
                </div>
              </section>
            ) : null}
            {requestPreview.length > 0 ? (
              <section className="rounded-xl border border-sky-200 bg-sky-50/60 p-4">
                <div className="text-sm font-semibold text-sky-950">请求闭环</div>
                <div className="mt-1 text-xs leading-5 text-sky-800">
                  活跃 {requestHealth.active} · 待答 {requestHealth.pending} · 已接单 {requestHealth.acknowledged} · 阻塞 {requestHealth.blocked}
                </div>
                <div className="mt-3 space-y-2">
                  {requestPreview.slice(0, 3).map((request) => (
                    <div key={request.id} className="rounded-lg border border-sky-200 bg-white/90 px-3 py-3 text-sm text-slate-800">
                      <div className="flex items-center justify-between gap-3">
                        <div className="font-medium text-slate-900">{request.title}</div>
                        <div className="text-[11px] font-medium text-sky-700">
                          {formatRequestDeliveryStateLabel(request.deliveryState)}
                        </div>
                      </div>
                      <div className="mt-1 text-xs leading-5 text-slate-600">
                        {request.responseSummary ?? request.summary}
                      </div>
                    </div>
                  ))}
                </div>
              </section>
            ) : null}
            {ceoSurface ? (
              <section className="rounded-xl border border-slate-200 bg-white p-4">
                <div className="text-sm font-semibold text-slate-950">CEO 控制面</div>
                <div className="mt-1 text-xs leading-5 text-slate-500">
                  阻塞 {ceoSurface.activeBlockers} · 请求 {ceoSurface.openRequests} · 交接 {ceoSurface.pendingHandoffs} · SLA {ceoSurface.overdueItems} · 接管 {ceoSurface.manualTakeovers}
                </div>
                {orgAdvisorSummary ? <div className="mt-2 text-xs leading-5 text-slate-600">{orgAdvisorSummary}</div> : null}
              </section>
            ) : null}
            {handoffPreview.length > 0 ? (
              <section className="rounded-xl border border-violet-200 bg-violet-50/70 p-4">
                <div className="text-sm font-semibold text-violet-950">交接摘要</div>
                <div className="mt-3 space-y-2">
                  {handoffPreview.slice(0, 3).map((handoff) => (
                    <div key={handoff.id} className="rounded-lg border border-violet-200 bg-white/90 px-3 py-2 text-xs text-slate-700">
                      <div className="font-medium text-slate-900">{handoff.title}</div>
                      <div className="mt-1">{handoff.summary}</div>
                    </div>
                  ))}
                </div>
              </section>
            ) : null}
            {summaryAlertCount > 0 ? (
              <section className="rounded-xl border border-rose-200 bg-rose-50/70 p-4">
                <div className="text-sm font-semibold text-rose-950">升级提醒</div>
                <div className="mt-1 text-xs text-rose-700">
                  {relatedSlaAlertCount > 0 ? `${relatedSlaAlertCount} 条升级规则命中` : `${localSlaFallbackAlertCount} 条会话级 SLA 提示`}
                </div>
              </section>
            ) : null}
          </div>
        </div>
      ) : null}
    </section>
  );
}
