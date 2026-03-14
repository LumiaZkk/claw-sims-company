import { useState, type ReactNode } from "react";
import { AlertTriangle, ArrowRight, CheckCircle2, FolderArchive, UserRound } from "lucide-react";
import {
  getTakeoverCaseLatestRedispatch,
  getTakeoverCaseResolutionNote,
  getTakeoverCaseStatusLabel,
  type TakeoverCase,
  type TakeoverCaseSummary,
} from "../../application/delegation/takeover-case";
import { ActionFormDialog } from "../../components/ui/action-form-dialog";
import { Badge } from "../../components/ui/badge";
import { Button } from "../../components/ui/button";
import { cn } from "../../lib/utils";

function getStatusClass(status: TakeoverCase["status"]) {
  switch (status) {
    case "detected":
      return "border-amber-200 bg-amber-50 text-amber-900";
    case "acknowledged":
      return "border-sky-200 bg-sky-50 text-sky-900";
    case "assigned":
      return "border-violet-200 bg-violet-50 text-violet-900";
    case "in_progress":
      return "border-indigo-200 bg-indigo-50 text-indigo-900";
    case "resolved":
      return "border-emerald-200 bg-emerald-50 text-emerald-900";
    case "archived":
      return "border-slate-200 bg-slate-50 text-slate-700";
    default:
      return "border-slate-200 bg-white text-slate-700";
  }
}

function renderSourceMeta(caseItem: TakeoverCase) {
  const items = [
    caseItem.sourceTopicKey ? `主线 ${caseItem.sourceTopicKey}` : null,
    caseItem.sourceWorkItemId ? `工单 ${caseItem.sourceWorkItemId}` : null,
    caseItem.sourceDispatchId ? `派单 ${caseItem.sourceDispatchId}` : null,
  ].filter(Boolean);

  if (items.length === 0) {
    return "当前链路会话";
  }
  return items.join(" · ");
}

export function TakeoverCasePanel(props: {
  summary: TakeoverCaseSummary;
  busyCaseId?: string | null;
  emptyState?: string;
  onOpenCase: (caseItem: TakeoverCase) => void;
  onAcknowledgeCase?: (caseItem: TakeoverCase) => void;
  onAssignCase?: (caseItem: TakeoverCase) => void;
  onStartCase?: (caseItem: TakeoverCase) => void;
  onResolveCase?: (caseItem: TakeoverCase, note: string) => void | Promise<boolean>;
  onRedispatchCase?: (caseItem: TakeoverCase, note: string) => void | Promise<boolean>;
  onArchiveCase?: (caseItem: TakeoverCase) => void;
  extraActions?: ReactNode;
}) {
  const {
    summary,
    busyCaseId = null,
    emptyState = "当前没有需要人工接管的链路。",
    onOpenCase,
    onAcknowledgeCase,
    onAssignCase,
    onStartCase,
    onResolveCase,
    onRedispatchCase,
    onArchiveCase,
    extraActions = null,
  } = props;
  const [resolveDialogOpen, setResolveDialogOpen] = useState(false);
  const [redispatchDialogOpen, setRedispatchDialogOpen] = useState(false);

  if (!summary.primaryCase) {
    return (
      <section className="rounded-3xl border border-slate-200 bg-white p-4 shadow-sm">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-slate-100 text-slate-500">
            <CheckCircle2 className="h-5 w-5" />
          </div>
          <div>
            <div className="text-sm font-semibold text-slate-950">人工接管闭环</div>
            <div className="mt-1 text-sm text-slate-500">{emptyState}</div>
          </div>
        </div>
      </section>
    );
  }

  const primaryCase = summary.primaryCase;
  const busy = busyCaseId === primaryCase.id;
  const assignLabel = primaryCase.ownerLabel ? `指派给 ${primaryCase.ownerLabel}` : "指派给人工值守";
  const resolutionNote = getTakeoverCaseResolutionNote(primaryCase);
  const latestRedispatch = getTakeoverCaseLatestRedispatch(primaryCase);

  const handleResolveSubmit = async (values: Record<string, string>) => {
    if (!onResolveCase) {
      return;
    }
    const result = await onResolveCase(primaryCase, values.note.trim());
    if (result !== false) {
      setResolveDialogOpen(false);
    }
  };

  const handleRedispatchSubmit = async (values: Record<string, string>) => {
    if (!onRedispatchCase) {
      return;
    }
    const result = await onRedispatchCase(primaryCase, values.note.trim());
    if (result !== false) {
      setRedispatchDialogOpen(false);
    }
  };

  return (
    <>
      <section className="rounded-3xl border border-amber-200 bg-white p-4 shadow-sm">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="space-y-2">
            <div className="flex flex-wrap items-center gap-2">
              <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-amber-50 text-amber-700">
                <AlertTriangle className="h-5 w-5" />
              </div>
              <div>
                <div className="text-sm font-semibold text-slate-950">人工接管闭环</div>
                <div className="mt-1 text-sm text-slate-500">{summary.description}</div>
              </div>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <Badge variant="outline" className={cn("text-xs", getStatusClass(primaryCase.status))}>
                {getTakeoverCaseStatusLabel(primaryCase.status)}
              </Badge>
              <Badge variant="outline" className="border-slate-200 bg-slate-50 text-slate-600">
                {renderSourceMeta(primaryCase)}
              </Badge>
              <Badge variant="outline" className="border-slate-200 bg-slate-50 text-slate-600">
                会话 {primaryCase.sourceSessionKey}
              </Badge>
            </div>
          </div>
          <div className="min-w-[12rem] rounded-2xl border border-slate-200 bg-slate-50/80 px-4 py-3 text-xs leading-6 text-slate-600">
            <div className="font-semibold text-slate-900">{primaryCase.title}</div>
            <div className="mt-1">当前负责人：{primaryCase.ownerLabel}</div>
            <div>接管人：{primaryCase.assigneeLabel ?? "待指派"}</div>
          </div>
        </div>

        <div className="mt-4 grid gap-3 lg:grid-cols-2">
          <div className="rounded-2xl border border-amber-200 bg-amber-50/70 p-4">
            <div className="text-xs font-semibold uppercase tracking-[0.16em] text-amber-800">失败摘要</div>
            <div className="mt-2 text-sm leading-6 text-slate-900">{primaryCase.failureSummary}</div>
          </div>
          <div className="rounded-2xl border border-slate-200 bg-slate-50/70 p-4">
            <div className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">建议下一步</div>
            <div className="mt-2 text-sm leading-6 text-slate-700">{primaryCase.recommendedNextAction}</div>
          </div>
        </div>

        {resolutionNote || latestRedispatch ? (
          <div className="mt-4 grid gap-3 lg:grid-cols-2">
            {resolutionNote ? (
              <div className="rounded-2xl border border-emerald-200 bg-emerald-50/70 p-4">
                <div className="text-xs font-semibold uppercase tracking-[0.16em] text-emerald-800">
                  最近人工结论
                </div>
                <div className="mt-2 text-sm leading-6 text-slate-900">{resolutionNote}</div>
              </div>
            ) : null}
            {latestRedispatch ? (
              <div className="rounded-2xl border border-indigo-200 bg-indigo-50/70 p-4">
                <div className="text-xs font-semibold uppercase tracking-[0.16em] text-indigo-700">
                  最近重新派发
                </div>
                <div className="mt-2 text-sm leading-6 text-slate-900">
                  已续推给 {latestRedispatch.assigneeLabel ?? primaryCase.ownerLabel}
                  {latestRedispatch.note ? `，说明：${latestRedispatch.note}` : "。"}
                </div>
              </div>
            ) : null}
          </div>
        ) : null}

        <div className="mt-4 flex flex-wrap gap-2">
          <Button type="button" size="sm" className="gap-1.5" onClick={() => onOpenCase(primaryCase)}>
            打开会话
            <ArrowRight className="h-3.5 w-3.5" />
          </Button>
          {primaryCase.status === "detected" && onAcknowledgeCase ? (
            <Button type="button" size="sm" variant="outline" disabled={busy} onClick={() => onAcknowledgeCase(primaryCase)}>
              {busy ? "处理中..." : "确认接管"}
            </Button>
          ) : null}
          {(primaryCase.status === "detected" || primaryCase.status === "acknowledged") && onAssignCase ? (
            <Button type="button" size="sm" variant="outline" disabled={busy} onClick={() => onAssignCase(primaryCase)}>
              <UserRound className="mr-1 h-3.5 w-3.5" />
              {busy ? "处理中..." : assignLabel}
            </Button>
          ) : null}
          {(primaryCase.status === "acknowledged" || primaryCase.status === "assigned") && onStartCase ? (
            <Button type="button" size="sm" variant="outline" disabled={busy} onClick={() => onStartCase(primaryCase)}>
              {busy ? "处理中..." : "开始处理"}
            </Button>
          ) : null}
          {(primaryCase.status === "assigned"
            || primaryCase.status === "in_progress"
            || primaryCase.status === "acknowledged") && onResolveCase ? (
            <Button
              type="button"
              size="sm"
              variant="outline"
              disabled={busy}
              onClick={() => setResolveDialogOpen(true)}
            >
              {busy ? "处理中..." : "回填人工结论并恢复"}
            </Button>
          ) : null}
          {primaryCase.status === "resolved" && onRedispatchCase ? (
            <Button
              type="button"
              size="sm"
              variant="outline"
              disabled={busy}
              onClick={() => setRedispatchDialogOpen(true)}
            >
              {busy ? "处理中..." : `重新派发给 ${primaryCase.ownerLabel}`}
            </Button>
          ) : null}
          {primaryCase.status === "resolved" && onArchiveCase ? (
            <Button type="button" size="sm" variant="outline" disabled={busy} onClick={() => onArchiveCase(primaryCase)}>
              <FolderArchive className="mr-1 h-3.5 w-3.5" />
              {busy ? "处理中..." : "归档"}
            </Button>
          ) : null}
          {extraActions}
        </div>

        {summary.cases.length > 1 ? (
          <details className="mt-4 rounded-2xl border border-slate-200 bg-slate-50/70">
            <summary className="cursor-pointer list-none px-4 py-3 text-sm font-medium text-slate-700 [&::-webkit-details-marker]:hidden">
              其余接管项（{summary.cases.length - 1}）
            </summary>
            <div className="border-t border-slate-200 px-4 py-3">
              <div className="space-y-3">
                {summary.cases.slice(1).map((caseItem) => (
                  <div key={caseItem.id} className="rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-700">
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div>
                        <div className="font-semibold text-slate-900">{caseItem.title}</div>
                        <div className="mt-1 text-xs text-slate-500">
                          {renderSourceMeta(caseItem)} · 当前负责人 {caseItem.ownerLabel}
                        </div>
                      </div>
                      <Badge variant="outline" className={cn("text-xs", getStatusClass(caseItem.status))}>
                        {getTakeoverCaseStatusLabel(caseItem.status)}
                      </Badge>
                    </div>
                    <div className="mt-2 text-xs leading-5 text-slate-600">{caseItem.failureSummary}</div>
                  </div>
                ))}
              </div>
            </div>
          </details>
        ) : null}
      </section>

      {onResolveCase ? (
        <ActionFormDialog
          open={resolveDialogOpen}
          onOpenChange={setResolveDialogOpen}
          title="回填人工结论并恢复"
          description="请记录这次人工介入做了什么、当前为什么可以恢复。后续验收和审计都会直接引用这里的结论。"
          confirmLabel="确认恢复"
          busy={busy}
          fields={[
            {
              name: "note",
              label: "人工处理结论",
              defaultValue: resolutionNote ?? primaryCase.recommendedNextAction ?? "",
              required: true,
              multiline: true,
              placeholder: "例如：已人工补传发布素材，确认页面可正常进入下一步。",
            },
          ]}
          onSubmit={handleResolveSubmit}
        />
      ) : null}

      {onRedispatchCase ? (
        <ActionFormDialog
          open={redispatchDialogOpen}
          onOpenChange={setRedispatchDialogOpen}
          title={`重新派发给 ${primaryCase.ownerLabel}`}
          description="系统会把人工结论一并写入续推说明，然后将后续动作重新派发给负责人。"
          confirmLabel="确认重新派发"
          busy={busy}
          fields={[
            {
              name: "note",
              label: "重新派发说明",
              defaultValue: resolutionNote ?? primaryCase.recommendedNextAction ?? "",
              required: true,
              multiline: true,
              placeholder: "例如：人工补齐阻塞项，现请继续从提测步骤往后推进。",
            },
          ]}
          onSubmit={handleRedispatchSubmit}
        />
      ) : null}
    </>
  );
}
