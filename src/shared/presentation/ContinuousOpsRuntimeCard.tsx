import { Badge } from "../../ui/badge";
import type { ContinuousOpsRuntimeSummary } from "../../application/automation/continuous-ops-runtime";

function toneClasses(state: ContinuousOpsRuntimeSummary["state"]) {
  if (state === "blocked") {
    return "border-rose-200 bg-rose-50 text-rose-800";
  }
  if (state === "watch") {
    return "border-amber-200 bg-amber-50 text-amber-800";
  }
  return "border-emerald-200 bg-emerald-50 text-emerald-800";
}

function laneToneClasses(state: ContinuousOpsRuntimeSummary["lanes"][number]["state"]) {
  if (state === "blocked") {
    return "border-rose-200 bg-rose-50/70 text-rose-800";
  }
  if (state === "watch") {
    return "border-amber-200 bg-amber-50/70 text-amber-800";
  }
  return "border-emerald-200 bg-emerald-50/70 text-emerald-800";
}

export function ContinuousOpsRuntimeCard(props: {
  summary: ContinuousOpsRuntimeSummary;
  onOpenHref?: (href: string) => void;
}) {
  const { summary, onOpenHref } = props;

  return (
    <div className="rounded-2xl border border-slate-200 bg-white px-4 py-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <div className="text-sm font-semibold text-slate-900">持续运行基线</div>
            <Badge variant="outline" className={toneClasses(summary.state)}>
              {summary.badgeLabel}
            </Badge>
          </div>
          <div className="text-sm font-medium text-slate-900">{summary.title}</div>
          <div className="text-sm text-slate-600">{summary.summary}</div>
          <div className="text-xs text-slate-500">{summary.detail}</div>
        </div>
        <div className="grid min-w-[240px] grid-cols-2 gap-3">
          {summary.metrics.map((metric) => (
            <div key={metric.label} className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2">
              <div className="text-[11px] uppercase tracking-[0.16em] text-slate-500">{metric.label}</div>
              <div className="mt-1 text-sm font-semibold text-slate-900">{metric.value}</div>
            </div>
          ))}
        </div>
      </div>

      <div className="mt-4 grid gap-3 md:grid-cols-2">
        {summary.lanes.map((lane) => (
          <div key={lane.id} className={`rounded-xl border px-3 py-3 ${laneToneClasses(lane.state)}`}>
            <div className="text-xs font-semibold uppercase tracking-[0.16em]">{lane.label}</div>
            <div className="mt-2 text-sm font-medium">{lane.summary}</div>
            <div className="mt-1 text-xs opacity-80">{lane.detail}</div>
            {onOpenHref ? (
              <button
                type="button"
                className="mt-3 text-xs font-semibold underline-offset-2 hover:underline"
                onClick={() => onOpenHref(lane.href)}
              >
                打开 {lane.href}
              </button>
            ) : null}
          </div>
        ))}
      </div>
    </div>
  );
}
