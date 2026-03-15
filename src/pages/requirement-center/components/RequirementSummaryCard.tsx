import { MessageSquare, ShieldAlert, Sparkles, Users } from "lucide-react";
import { Badge } from "../../../ui/badge";
import { Button } from "../../../ui/button";
import { Card, CardDescription, CardHeader, CardTitle } from "../../../ui/card";
import { formatTime } from "../../../lib/utils";
import { RequirementDecisionPanel } from "./RequirementDecisionPanel";

export function RequirementSummaryCard(props: {
  productStatusLabel: string;
  statusClassName: string;
  revision: number | null;
  title: string;
  summary: string;
  ownerLabel: string;
  stageLabel: string;
  nextAction: string;
  acceptanceNote?: string | null;
  updatedAt: number | null;
  collaborationActionLabel: string;
  ownerAgentId: string | null;
  decisionTicket: {
    summary: string;
    options: Array<{ id: string; label: string }>;
  } | null;
  decisionSubmittingOptionId: string | null;
  onResolveDecision: (optionId: string) => void;
  onOpenCollaboration: () => void;
  onOpenWorkspace: () => void;
  onOpenOps: () => void;
  onOpenOwner: (() => void) | null;
}) {
  const {
    productStatusLabel,
    statusClassName,
    revision,
    title,
    summary,
    ownerLabel,
    stageLabel,
    nextAction,
    acceptanceNote,
    updatedAt,
    collaborationActionLabel,
    ownerAgentId,
    decisionTicket,
    decisionSubmittingOptionId,
    onResolveDecision,
    onOpenCollaboration,
    onOpenWorkspace,
    onOpenOps,
    onOpenOwner,
  } = props;
  return (
    <Card className="relative min-h-[240px] overflow-hidden border-slate-200 bg-[radial-gradient(circle_at_top_left,_rgba(99,102,241,0.18),_transparent_34%),linear-gradient(135deg,#ffffff_0%,#f8fafc_46%,#eef2ff_100%)] shadow-sm">
      <CardHeader className="border-b border-white/70 bg-white/70 backdrop-blur-sm">
        <div className="flex flex-col gap-6 md:grid md:grid-cols-[minmax(0,1fr)_auto] md:items-start md:gap-6">
          <div className="space-y-3">
            <div className="flex flex-wrap items-center gap-2">
              <Badge variant="outline" className="border-indigo-200 bg-indigo-50 text-indigo-700">
                <Sparkles className="mr-1 h-3.5 w-3.5" />
                需求中心
              </Badge>
              <Badge variant="outline" className={statusClassName}>
                {productStatusLabel}
              </Badge>
              {revision ? (
                <Badge variant="outline" className="border-slate-200 bg-white text-slate-600">
                  第 {revision} 次推进
                </Badge>
              ) : null}
            </div>
            <div>
              <CardTitle className="text-3xl font-black tracking-tight text-slate-950">
                {title}
              </CardTitle>
              <CardDescription className="mt-2 max-w-3xl text-sm leading-6 text-slate-600">
                {summary}
              </CardDescription>
            </div>
            <div className="grid gap-3 sm:grid-cols-3">
              <div className="rounded-2xl border border-white/70 bg-white/90 px-4 py-3 shadow-sm">
                <div className="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-500">
                  当前负责人
                </div>
                <div className="mt-2 text-sm font-semibold text-slate-950">{ownerLabel}</div>
                <div className="mt-1 text-xs text-slate-500">
                  最后更新 {formatTime(updatedAt)}
                </div>
              </div>
              <div className="rounded-2xl border border-white/70 bg-white/90 px-4 py-3 shadow-sm">
                <div className="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-500">
                  当前阶段
                </div>
                <div className="mt-2 text-sm font-semibold text-slate-950">{stageLabel}</div>
                <div className="mt-1 text-xs text-slate-500">{productStatusLabel}</div>
              </div>
              <div className="rounded-2xl border border-white/70 bg-white/90 px-4 py-3 shadow-sm">
                <div className="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-500">
                  下一步
                </div>
                <div className="mt-2 text-sm font-semibold text-slate-950">{nextAction}</div>
                <div className="mt-1 text-xs text-slate-500">
                  {acceptanceNote?.trim() ? `当前备注：${acceptanceNote}` : "主线会在这里持续同步。"}
                </div>
              </div>
            </div>
            <RequirementDecisionPanel
              decisionTicket={decisionTicket}
              decisionSubmittingOptionId={decisionSubmittingOptionId}
              onResolveDecision={onResolveDecision}
            />
          </div>

          <div className="flex flex-wrap gap-2 md:justify-end">
            <Button onClick={onOpenCollaboration}>
              <Users className="mr-2 h-4 w-4" />
              {collaborationActionLabel}
            </Button>
            <Button variant="outline" onClick={onOpenWorkspace}>
              看交付
            </Button>
            <Button variant="outline" onClick={onOpenOps}>
              <ShieldAlert className="mr-2 h-4 w-4" />
              去排障
            </Button>
            {ownerAgentId && onOpenOwner ? (
              <Button variant="outline" onClick={onOpenOwner}>
                <MessageSquare className="mr-2 h-4 w-4" />
                打开负责人
              </Button>
            ) : null}
          </div>
        </div>
      </CardHeader>
    </Card>
  );
}
