import { ClipboardList } from "lucide-react";
import { Badge } from "../../../components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "../../../components/ui/card";

type TaskStep = {
  text: string;
  status: string;
  assignee?: string | null;
};

type TaskSequenceItem = {
  task: {
    id: string;
    title: string;
    steps: TaskStep[];
  };
  ownerLabel: string;
  execution: { label: string };
  stepSummary: {
    doneCount: number;
    total: number;
  };
};

export function RequirementExecutionPanel(props: {
  ownerLabel: string;
  stageLabel: string;
  nextAction: string;
  statusClassName: string;
  productStatusLabel: string;
  doneSteps: number;
  totalSteps: number;
  globalPct: number;
  taskSequence: TaskSequenceItem[];
}) {
  const {
    ownerLabel,
    stageLabel,
    nextAction,
    statusClassName,
    productStatusLabel,
    doneSteps,
    totalSteps,
    globalPct,
    taskSequence,
  } = props;

  return (
    <Card className="border-slate-200 bg-white shadow-sm">
      <CardHeader className="border-b bg-slate-50/70">
        <CardTitle className="flex items-center gap-2 text-base">
          <ClipboardList className="h-4 w-4 text-indigo-600" />
          执行区
        </CardTitle>
        <CardDescription>
          这里固定显示当前主线的负责人、任务顺序和推进状态，不再让旧会话抢主线。
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4 p-4">
        <div className="rounded-2xl border border-slate-200 bg-slate-50/70 p-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <div className="text-sm font-semibold text-slate-950">{ownerLabel}</div>
              <div className="mt-1 text-xs text-slate-500">{stageLabel}</div>
            </div>
            <Badge variant="outline" className={statusClassName}>
              {productStatusLabel}
            </Badge>
          </div>
          <div className="mt-3 text-sm leading-6 text-slate-700">{nextAction}</div>
          <div className="mt-4 h-2 overflow-hidden rounded-full bg-slate-100">
            <div
              className="h-full rounded-full bg-gradient-to-r from-indigo-500 via-sky-500 to-emerald-500"
              style={{ width: `${Math.max(globalPct, taskSequence.length > 0 ? 24 : 8)}%` }}
            />
          </div>
          <div className="mt-2 text-xs text-slate-500">
            已完成 {doneSteps} / {totalSteps} 步
          </div>
        </div>

        <div className="space-y-3">
          {taskSequence.length > 0 ? (
            taskSequence.map((item) => (
              <div key={item.task.id} className="rounded-2xl border border-slate-200 bg-white p-4">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <div className="text-sm font-semibold text-slate-950">{item.task.title}</div>
                    <div className="mt-1 text-xs text-slate-500">
                      {item.ownerLabel} · {item.execution.label}
                    </div>
                  </div>
                  <Badge variant="outline" className="border-slate-200 bg-slate-50 text-slate-600">
                    {item.stepSummary.doneCount}/{item.stepSummary.total} 步
                  </Badge>
                </div>
                <div className="mt-3 grid gap-2">
                  {item.task.steps.slice(0, 4).map((step, index) => (
                    <div
                      key={`${item.task.id}:${index}:${step.text}`}
                      className="flex items-start gap-3 rounded-xl border border-slate-100 bg-slate-50/60 px-3 py-2"
                    >
                      <span
                        className={`mt-1 h-2.5 w-2.5 rounded-full ${
                          step.status === "done"
                            ? "bg-emerald-500"
                            : step.status === "wip"
                              ? "bg-sky-500"
                              : "bg-slate-300"
                        }`}
                      />
                      <div className="min-w-0">
                        <div className="text-sm text-slate-900">{step.text}</div>
                        <div className="mt-1 text-xs text-slate-500">
                          {step.assignee ?? "待分配"}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ))
          ) : (
            <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50 p-4 text-sm leading-6 text-slate-500">
              当前主线还没有清晰的任务顺序，先去 CEO 深聊或需求房继续收敛。
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
