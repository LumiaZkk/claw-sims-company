import * as Dialog from "@radix-ui/react-dialog";
import { ChevronDown, Users } from "lucide-react";
import type { ReactNode } from "react";
import type { ResolvedExecutionState } from "../../../application/mission/execution-state";
import { ExecutionStateBadge } from "../../../components/execution-state-badge";
import { Button } from "../../../components/ui/button";
import { cn } from "../../../lib/utils";
import type { FocusActionButton } from "../view-models/focus";

export function ChatMissionStrip(input: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  showRequirementContextTag: boolean;
  isGroup: boolean;
  isRequirementBootstrapPending: boolean;
  stableDisplayWorkItem: boolean;
  sessionExecution: ResolvedExecutionState;
  effectiveHeadline: string;
  effectiveTone: "rose" | "amber" | "emerald" | "indigo" | string;
  effectiveStatusLabel: string;
  effectiveOwnerLabel: string;
  effectiveStage: string;
  displayNextBatonLabel: string;
  missionIsCompleted: boolean;
  sending: boolean;
  isGenerating: boolean;
  primaryOpenAction: FocusActionButton | null;
  showRequirementTeamEntry: boolean;
  hasTeamGroupRoute: boolean;
  hasContextSummary: boolean;
  onClearSession: () => Promise<unknown> | void;
  onRunPrimaryAction: (action: FocusActionButton) => Promise<unknown> | void;
  onOpenRequirementTeam: () => void;
  onOpenSummaryPanel: () => void;
  summaryPanel: ReactNode;
}) {
  const {
    open,
    onOpenChange,
    showRequirementContextTag,
    isGroup,
    isRequirementBootstrapPending,
    stableDisplayWorkItem,
    sessionExecution,
    effectiveHeadline,
    effectiveTone,
    effectiveStatusLabel,
    effectiveOwnerLabel,
    effectiveStage,
    displayNextBatonLabel,
    missionIsCompleted,
    sending,
    isGenerating,
    primaryOpenAction,
    showRequirementTeamEntry,
    hasTeamGroupRoute,
    hasContextSummary,
    onClearSession,
    onRunPrimaryAction,
    onOpenRequirementTeam,
    onOpenSummaryPanel,
    summaryPanel,
  } = input;

  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <div className="border-b border-slate-200 bg-white/80 shadow-sm">
        <div className="px-6 py-2.5">
          <div className="rounded-2xl border border-slate-200 bg-slate-50/80 px-4 py-2.5">
            <div className="flex flex-col gap-2 xl:flex-row xl:items-center xl:justify-between">
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  {showRequirementContextTag ? (
                    <span className="rounded-full border border-slate-200 bg-white px-2 py-0.5 text-[11px] font-medium text-slate-600">
                      {isGroup
                        ? "需求团队房间"
                        : isRequirementBootstrapPending
                          ? "恢复中"
                          : stableDisplayWorkItem
                            ? "当前主线"
                            : "本轮规划/任务"}
                    </span>
                  ) : (
                    <ExecutionStateBadge status={sessionExecution} />
                  )}
                  <span className="text-sm font-semibold text-slate-900">{effectiveHeadline}</span>
                  <span
                    className={cn(
                      "rounded-full border px-2 py-0.5 text-[11px] font-medium",
                      effectiveTone === "rose"
                        ? "border-rose-200 bg-rose-50 text-rose-700"
                        : effectiveTone === "amber"
                          ? "border-amber-200 bg-amber-50 text-amber-800"
                          : effectiveTone === "emerald"
                            ? "border-emerald-200 bg-emerald-50 text-emerald-700"
                            : effectiveTone === "indigo"
                              ? "border-indigo-200 bg-indigo-50 text-indigo-700"
                              : "border-slate-200 bg-slate-50 text-slate-600",
                    )}
                  >
                    {effectiveStatusLabel}
                  </span>
                </div>
                <div className="mt-1 text-xs leading-5 text-slate-600">
                  <span className="font-medium text-slate-700">当前负责人：</span>
                  {effectiveOwnerLabel}
                  {" · "}
                  <span className="font-medium text-slate-700">当前待办：</span>
                  {effectiveStage}
                  {" · "}
                  <span className="font-medium text-slate-700">下一棒：</span>
                  {displayNextBatonLabel}
                </div>
              </div>
              <div className="flex shrink-0 flex-wrap items-center gap-2">
                {missionIsCompleted ? (
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    className="border-emerald-200 bg-emerald-50 text-emerald-700 hover:bg-emerald-100"
                    onClick={() => void onClearSession()}
                    disabled={sending || isGenerating}
                  >
                    开启下一轮规划/任务
                  </Button>
                ) : null}
                {primaryOpenAction ? (
                  <Button
                    type="button"
                    size="sm"
                    variant={primaryOpenAction.kind === "message" ? "default" : "outline"}
                    className={
                      primaryOpenAction.kind === "message"
                        ? "bg-slate-900 text-white hover:bg-slate-800"
                        : "border-slate-300 bg-white text-slate-900 hover:bg-slate-100"
                    }
                    onClick={() => void onRunPrimaryAction(primaryOpenAction)}
                  >
                    {primaryOpenAction.label}
                  </Button>
                ) : null}
                {showRequirementTeamEntry ? (
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    className="border-slate-300 bg-white text-slate-900 hover:bg-slate-100"
                    onClick={onOpenRequirementTeam}
                  >
                    <Users className="mr-2 h-3.5 w-3.5" />
                    {hasTeamGroupRoute ? "打开需求团队房间" : "查看需求团队"}
                  </Button>
                ) : null}
                {hasContextSummary ? (
                  <button
                    type="button"
                    className="inline-flex items-center gap-1 rounded-full border border-slate-200 bg-white px-3 py-1 text-xs font-medium text-slate-500 transition-colors hover:bg-slate-50"
                    onClick={onOpenSummaryPanel}
                  >
                    <ChevronDown className="h-3.5 w-3.5" />
                    {open ? "规划/任务面板已开" : "查看规划/任务面板"}
                  </button>
                ) : null}
              </div>
            </div>
          </div>
        </div>
      </div>
      {hasContextSummary && open ? summaryPanel : null}
    </Dialog.Root>
  );
}
