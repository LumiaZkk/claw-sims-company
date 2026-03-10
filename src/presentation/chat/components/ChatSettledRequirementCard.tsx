import { ArrowRight, BookOpenCheck, MessageSquare, Users } from "lucide-react";
import { Button } from "../../../components/ui/button";
import { Card, CardContent } from "../../../components/ui/card";

export function ChatSettledRequirementCard(input: {
  visible: boolean;
  title: string;
  statusLabel: string;
  statusClassName: string;
  summary: string;
  ownerLabel: string;
  stage: string;
  nextAction: string;
  onOpenRequirementCenter: () => void;
  onOpenOwner?: (() => void) | null;
  onOpenTeamRoom?: (() => void) | null;
}) {
  if (!input.visible) {
    return null;
  }

  return (
    <div className="px-3 pt-3 md:px-6">
      <Card className="border-indigo-200/80 bg-gradient-to-br from-white via-indigo-50/50 to-white shadow-sm">
        <CardContent className="grid gap-4 p-4 lg:grid-cols-[1.35fr,1fr,auto] lg:items-center">
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <span className="rounded-full border border-indigo-200 bg-indigo-50 px-2 py-0.5 text-[11px] font-semibold uppercase tracking-[0.16em] text-indigo-700">
                已收敛需求
              </span>
              <span className={`rounded-full border px-2 py-0.5 text-[11px] font-medium ${input.statusClassName}`}>
                {input.statusLabel}
              </span>
            </div>
            <div className="mt-3 text-lg font-semibold text-slate-950">{input.title}</div>
            <div className="mt-2 text-sm leading-6 text-slate-700">{input.summary}</div>
          </div>

          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-1">
            <div className="rounded-xl border border-white/80 bg-white px-3 py-3">
              <div className="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-500">
                当前负责人
              </div>
              <div className="mt-2 text-sm font-semibold text-slate-900">{input.ownerLabel}</div>
              <div className="mt-1 text-xs leading-5 text-slate-500">当前阶段：{input.stage}</div>
            </div>
            <div className="rounded-xl border border-white/80 bg-white px-3 py-3">
              <div className="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-500">
                下一步
              </div>
              <div className="mt-2 text-sm leading-6 text-slate-800">{input.nextAction}</div>
            </div>
          </div>

          <div className="flex flex-wrap gap-2 lg:justify-end">
            <Button onClick={input.onOpenRequirementCenter}>
              <BookOpenCheck className="mr-2 h-4 w-4" />
              开始推进这条需求
            </Button>
            {input.onOpenTeamRoom ? (
              <Button variant="outline" onClick={input.onOpenTeamRoom}>
                <Users className="mr-2 h-4 w-4" />
                进入需求房
              </Button>
            ) : null}
            {input.onOpenOwner ? (
              <Button variant="outline" onClick={input.onOpenOwner}>
                <MessageSquare className="mr-2 h-4 w-4" />
                打开负责人
              </Button>
            ) : null}
            <Button variant="ghost" className="text-slate-600" onClick={input.onOpenRequirementCenter}>
              查看详情
              <ArrowRight className="ml-2 h-4 w-4" />
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
