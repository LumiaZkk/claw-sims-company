import type { CompanyHeartbeatAuditEntry } from "../../application/org";
import { Badge } from "../../components/ui/badge";
import { formatTime } from "../../lib/utils";

export function HeartbeatAuditList(props: {
  entries: CompanyHeartbeatAuditEntry[];
  limit?: number;
  className?: string;
}) {
  const { entries, limit = 3, className } = props;
  if (entries.length === 0) {
    return null;
  }

  return (
    <div className={className ?? "rounded-xl border border-sky-200/80 bg-white/80 p-3"}>
      <div className="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-500">
        最近巡检审计
      </div>
      <div className="mt-2 space-y-2">
        {entries.slice(0, limit).map((entry) => (
          <div
            key={entry.id}
            className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs text-slate-600"
          >
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="font-medium text-slate-900">{entry.summary}</div>
              <Badge
                variant="outline"
                className={
                  entry.ran
                    ? "border-emerald-200 bg-emerald-50 text-emerald-700"
                    : "border-slate-200 bg-slate-50 text-slate-600"
                }
              >
                {entry.ran ? "已运行" : "已跳过"}
              </Badge>
            </div>
            <div className="mt-1 text-[11px] text-slate-500">
              {formatTime(entry.createdAt)} · {entry.detail}
            </div>
            {entry.reasonLabels.length > 0 ? (
              <div className="mt-2 flex flex-wrap gap-1.5">
                {entry.reasonLabels.slice(0, 3).map((reason) => (
                  <Badge key={reason} variant="outline" className="border-sky-200 bg-sky-50 text-sky-700">
                    {reason}
                  </Badge>
                ))}
              </div>
            ) : null}
            {entry.actions.length > 0 ? (
              <div className="mt-2 space-y-1 text-[11px] text-slate-600">
                {entry.actions.slice(0, 2).map((action) => (
                  <div key={action}>- {action}</div>
                ))}
              </div>
            ) : null}
          </div>
        ))}
      </div>
    </div>
  );
}
