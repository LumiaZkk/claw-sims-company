import { CheckCircle2, ShieldAlert } from "lucide-react";
import { Badge } from "../../../components/ui/badge";
import { Button } from "../../../components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "../../../components/ui/card";
import { formatTime } from "../../../lib/utils";
import type { RequirementCloseoutReport } from "../../../application/mission/requirement-closeout-report";
import type { RequirementAcceptanceGate } from "../../../application/mission/requirement-acceptance-gate";

function closeoutTone(status: RequirementCloseoutReport["status"]) {
  if (status === "blocked") {
    return "border-rose-200 bg-rose-50 text-rose-700";
  }
  if (status === "warning") {
    return "border-amber-200 bg-amber-50 text-amber-700";
  }
  return "border-emerald-200 bg-emerald-50 text-emerald-700";
}

export function RequirementAcceptancePanel(props: {
  statusClassName: string;
  productStatusLabel: string;
  productStatusDescription: string;
  acceptanceNote?: string | null;
  closeoutReport: RequirementCloseoutReport;
  acceptanceGate: RequirementAcceptanceGate;
  acceptanceSubmitting: null | "request" | "accept" | "revise" | "reopen" | "change";
  canRequestAcceptance: boolean;
  canRequestChange: boolean;
  canAccept: boolean;
  canContinueModify: boolean;
  canRejectReopen: boolean;
  onRunAcceptanceAction: (mode: "request" | "accept" | "revise" | "reopen" | "change") => void;
}) {
  const {
    statusClassName,
    productStatusLabel,
    productStatusDescription,
    acceptanceNote,
    closeoutReport,
    acceptanceGate,
    acceptanceSubmitting,
    canRequestAcceptance,
    canRequestChange,
    canAccept,
    canContinueModify,
    canRejectReopen,
    onRunAcceptanceAction,
  } = props;

  return (
    <Card className="border-slate-200 bg-white shadow-sm">
      <CardHeader className="border-b bg-slate-50/70">
        <CardTitle className="flex items-center gap-2 text-base">
          <CheckCircle2 className="h-4 w-4 text-amber-600" />
          验收区
        </CardTitle>
        <CardDescription>
          执行完成不等于闭环完成。这里明确区分待你验收、验收通过和驳回重开。
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4 p-4">
        <div className="grid gap-4 lg:grid-cols-[1.1fr,auto] lg:items-center">
          <div className="space-y-3">
            <div className="flex flex-wrap items-center gap-2">
              <Badge variant="outline" className={statusClassName}>
                {productStatusLabel}
              </Badge>
              {acceptanceNote?.trim() ? (
                <Badge variant="outline" className="border-slate-200 bg-slate-50 text-slate-600">
                  {acceptanceNote}
                </Badge>
              ) : null}
            </div>
            <div className="text-sm leading-6 text-slate-700">{productStatusDescription}</div>
            <div className="text-xs leading-6 text-slate-500">
              如果当前已经进入待你验收，你应该在这里决定是正式通过、继续修改，还是驳回重开，而不是继续在群聊里口头判断。
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button
              onClick={() => onRunAcceptanceAction("request")}
              disabled={!canRequestAcceptance || acceptanceSubmitting !== null}
            >
              {acceptanceSubmitting === "request" ? "处理中..." : "发起验收"}
            </Button>
            <Button
              variant="outline"
              onClick={() => onRunAcceptanceAction("change")}
              disabled={!canRequestChange || acceptanceSubmitting !== null}
            >
              {acceptanceSubmitting === "change" ? "处理中..." : "需求变更"}
            </Button>
            <Button
              variant="outline"
              onClick={() => onRunAcceptanceAction("accept")}
              disabled={!canAccept || acceptanceSubmitting !== null}
            >
              {acceptanceSubmitting === "accept" ? "处理中..." : "验收通过"}
            </Button>
            <Button
              variant="outline"
              onClick={() => onRunAcceptanceAction("revise")}
              disabled={!canContinueModify || acceptanceSubmitting !== null}
            >
              {acceptanceSubmitting === "revise" ? "处理中..." : "继续修改"}
            </Button>
            <Button
              variant="ghost"
              className="text-rose-600 hover:bg-rose-50 hover:text-rose-700"
              onClick={() => onRunAcceptanceAction("reopen")}
              disabled={!canRejectReopen || acceptanceSubmitting !== null}
            >
              {acceptanceSubmitting === "reopen" ? "处理中..." : "驳回重开"}
            </Button>
          </div>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-slate-50/70 p-4">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <div className="text-sm font-semibold text-slate-950">Closeout 报告</div>
              <div className="mt-1 text-xs leading-5 text-slate-500">
                验收通过前，至少要看到交付物、来源链路、规则校验结果、知识摘要和 Workspace closeout 的当前状态。
              </div>
            </div>
            <Badge variant="outline" className={closeoutTone(closeoutReport.status)}>
              {closeoutReport.status === "blocked" ? "存在阻塞" : closeoutReport.status === "warning" ? "可继续但需说明" : "可正式验收"}
            </Badge>
          </div>

          <div className="mt-3 grid gap-3 xl:grid-cols-4">
            <div className="rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm">
              <div className="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-500">交付物</div>
              <div className="mt-2 font-semibold text-slate-950">{closeoutReport.deliverableCount} 份</div>
              <div className="mt-1 text-xs text-slate-500">更新时间 {formatTime(closeoutReport.updatedAt)}</div>
            </div>
            <div className="rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm">
              <div className="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-500">来源链路</div>
              <div className="mt-2 font-semibold text-slate-950">{closeoutReport.traceabilityCount} 条</div>
              <div className="mt-1 text-xs text-slate-500">
                Workspace attention {closeoutReport.workspaceCloseoutSummary.totals.attention}
              </div>
            </div>
            <div className="rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm">
              <div className="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-500">规则校验</div>
              <div className="mt-2 font-semibold text-slate-950">
                {closeoutReport.consistencySummary.anchorReadyCount}/{closeoutReport.consistencySummary.anchorTotalCount} 锚点
              </div>
              <div className="mt-1 text-xs text-slate-500">
                {closeoutReport.consistencySummary.reportHighlights.length} 份校验结果
              </div>
            </div>
            <div className="rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm">
              <div className="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-500">知识摘要</div>
              <div className="mt-2 font-semibold text-slate-950">{closeoutReport.knowledgeSummary.itemCount} 条</div>
              <div className="mt-1 text-xs text-slate-500">
                已进入默认上下文 {closeoutReport.knowledgeSummary.acceptedCount} 条
              </div>
            </div>
          </div>

          <div className="mt-3 grid gap-3 lg:grid-cols-2">
            {[acceptanceGate.request, acceptanceGate.accept].map((gate) => (
              <div key={gate.mode} className="rounded-xl border border-slate-200 bg-white px-4 py-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="text-sm font-semibold text-slate-950">{gate.mode === "request" ? "发起验收条件" : "正式通过条件"}</div>
                  <Badge variant="outline" className={closeoutTone(gate.tone)}>
                    {gate.tone === "blocked" ? "未满足" : gate.tone === "warning" ? "可继续但需确认" : "已满足"}
                  </Badge>
                </div>
                <div className="mt-2 text-sm text-slate-700">{gate.summary}</div>
                {gate.reasons.length > 0 ? (
                  <div className="mt-2 space-y-1 text-xs text-slate-500">
                    {gate.reasons.map((reason) => (
                      <div key={reason}>- {reason}</div>
                    ))}
                  </div>
                ) : null}
              </div>
            ))}
          </div>

          <div className="mt-3 space-y-2">
            {closeoutReport.checks.map((check) => (
              <div key={check.id} className="rounded-xl border border-slate-200 bg-white px-4 py-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="text-sm font-semibold text-slate-950">{check.label}</div>
                  <Badge variant="outline" className={closeoutTone(check.status)}>
                    {check.status}
                  </Badge>
                </div>
                <div className="mt-2 text-sm text-slate-700">{check.summary}</div>
                <div className="mt-1 text-xs text-slate-500">{check.detail}</div>
              </div>
            ))}
          </div>

          <div className="mt-3 grid gap-3 lg:grid-cols-2">
            <div className="rounded-xl border border-slate-200 bg-white px-4 py-3">
              <div className="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-500">
                最近交付物
              </div>
              <div className="mt-2 space-y-2 text-sm text-slate-700">
                {closeoutReport.deliverableHighlights.length > 0 ? (
                  closeoutReport.deliverableHighlights.map((file) => (
                    <div key={file.key} className="rounded-lg border border-slate-100 bg-slate-50/80 px-3 py-2">
                      <div className="font-medium text-slate-950">{file.title}</div>
                      <div className="mt-1 text-xs text-slate-500">{file.path}</div>
                      <div className="mt-1 text-[11px] text-slate-400">
                        {file.kind} · {formatTime(file.updatedAt)}
                      </div>
                    </div>
                  ))
                ) : (
                  <div className="text-xs text-slate-500">当前还没有可直接核对的正式交付物。</div>
                )}
              </div>
            </div>

            <div className="rounded-xl border border-slate-200 bg-white px-4 py-3">
              <div className="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-500">
                验收依据
              </div>
              <div className="mt-2 space-y-2 text-sm text-slate-700">
                {closeoutReport.acceptanceEvidenceHighlights.length > 0 ? (
                  closeoutReport.acceptanceEvidenceHighlights.map((file) => (
                    <div key={file.key} className="rounded-lg border border-slate-100 bg-slate-50/80 px-3 py-2">
                      <div className="font-medium text-slate-950">{file.title}</div>
                      <div className="mt-1 text-xs text-slate-500">{file.path}</div>
                      <div className="mt-1 text-[11px] text-slate-400">
                        {file.kind} · {formatTime(file.updatedAt)}
                      </div>
                    </div>
                  ))
                ) : (
                  <div className="text-xs text-slate-500">
                    当前还没有独立的知识页或报告型验收依据，建议补齐后再决定是否直接通过。
                  </div>
                )}
              </div>
            </div>
          </div>

          <div className="mt-3 grid gap-3 lg:grid-cols-2">
            <div className="rounded-xl border border-slate-200 bg-white px-4 py-3">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <div className="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-500">
                    规则校验结果
                  </div>
                  <div className="mt-2 text-sm font-semibold text-slate-950">{closeoutReport.consistencySummary.summary}</div>
                </div>
                <Badge variant="outline" className={closeoutTone(closeoutReport.consistencySummary.status)}>
                  {closeoutReport.consistencySummary.status === "ready" ? "已满足" : "建议补齐"}
                </Badge>
              </div>
              <div className="mt-2 text-xs leading-5 text-slate-500">{closeoutReport.consistencySummary.detail}</div>
              {closeoutReport.consistencySummary.reportHighlights.length > 0 ? (
                <div className="mt-3 space-y-2 text-sm text-slate-700">
                  {closeoutReport.consistencySummary.reportHighlights.map((file) => (
                    <div key={file.key} className="rounded-lg border border-slate-100 bg-slate-50/80 px-3 py-2">
                      <div className="font-medium text-slate-950">{file.title}</div>
                      <div className="mt-1 text-xs text-slate-500">{file.path}</div>
                      <div className="mt-1 text-[11px] text-slate-400">
                        {file.kind} · {formatTime(file.updatedAt)}
                      </div>
                    </div>
                  ))}
                </div>
              ) : null}
              {closeoutReport.consistencySummary.missingAnchors.length > 0 ? (
                <div className="mt-3 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800">
                  待补齐锚点：{closeoutReport.consistencySummary.missingAnchors.join("、")}
                </div>
              ) : null}
            </div>

            <div className="rounded-xl border border-slate-200 bg-white px-4 py-3">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <div className="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-500">
                    知识与验收摘要
                  </div>
                  <div className="mt-2 text-sm font-semibold text-slate-950">{closeoutReport.knowledgeSummary.summary}</div>
                </div>
                <Badge variant="outline" className={closeoutTone(closeoutReport.knowledgeSummary.status)}>
                  {closeoutReport.knowledgeSummary.status === "ready" ? "已具备" : "建议补齐"}
                </Badge>
              </div>
              <div className="mt-2 text-xs leading-5 text-slate-500">{closeoutReport.knowledgeSummary.detail}</div>
              <div className="mt-3 space-y-2 text-sm text-slate-700">
                {closeoutReport.knowledgeSummary.highlights.length > 0 ? (
                  closeoutReport.knowledgeSummary.highlights.map((item) => (
                    <div key={item.key} className="rounded-lg border border-slate-100 bg-slate-50/80 px-3 py-2">
                      <div className="font-medium text-slate-950">{item.title}</div>
                      <div className="mt-1 text-xs text-slate-500">{item.kindLabel}</div>
                      <div className="mt-1 text-xs leading-5 text-slate-500">{item.summary}</div>
                      <div className="mt-1 text-[11px] text-slate-400">
                        {item.sourcePath ?? "公司知识层"} · {formatTime(item.updatedAt)}
                      </div>
                    </div>
                  ))
                ) : (
                  <div className="text-xs text-slate-500">当前还没有结构化知识摘要，建议先补齐自动验收后的知识卡片或正式总结。</div>
                )}
              </div>
            </div>
          </div>

          {closeoutReport.blockingReasons.length > 0 ? (
            <div className="mt-3 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
              <div className="flex items-center gap-2 font-semibold">
                <ShieldAlert className="h-4 w-4" />
                当前阻塞
              </div>
              <div className="mt-2 space-y-1">
                {closeoutReport.blockingReasons.map((reason) => (
                  <div key={reason}>- {reason}</div>
                ))}
              </div>
            </div>
          ) : null}

          {closeoutReport.advisoryReasons.length > 0 ? (
            <div className="mt-3 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
              <div className="font-semibold">继续通过前建议先确认</div>
              <div className="mt-2 space-y-1">
                {closeoutReport.advisoryReasons.map((reason) => (
                  <div key={reason}>- {reason}</div>
                ))}
              </div>
            </div>
          ) : null}
        </div>
      </CardContent>
    </Card>
  );
}
