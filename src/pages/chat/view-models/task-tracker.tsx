export {
  extractTaskTracker,
  hasRichMarkdownSyntax,
  resolveTaskTitle,
  type TaskItem,
} from "../../../application/mission/task-tracker";
import type { TaskItem } from "../../../application/mission/task-tracker";

export function TaskTrackerPanel({ items }: { items: TaskItem[] }) {
  const done = items.filter((item) => item.status === "done").length;
  const wip = items.filter((item) => item.status === "wip").length;
  const total = items.length;
  const pct = total > 0 ? Math.round((done / total) * 100) : 0;

  return (
    <div className="my-3 overflow-hidden rounded-xl border border-indigo-200/60 bg-gradient-to-br from-indigo-50/80 to-white shadow-sm">
      <div className="flex items-center justify-between border-b border-indigo-100/60 px-4 py-2.5">
        <span className="flex items-center gap-1.5 text-sm font-semibold text-indigo-900">
          📋 任务追踪
        </span>
        <span className="rounded-full bg-indigo-100/60 px-2 py-0.5 font-mono text-xs text-indigo-600">
          {done}/{total} 完成 ({pct}%)
        </span>
      </div>
      <div className="px-4 pb-1 pt-1">
        <div className="mb-1 h-1.5 w-full overflow-hidden rounded-full bg-slate-100">
          <div
            className="h-full rounded-full transition-all duration-500"
            style={{
              width: `${pct}%`,
              background:
                pct === 100
                  ? "linear-gradient(90deg, #22c55e, #16a34a)"
                  : wip > 0
                    ? "linear-gradient(90deg, #22c55e, #6366f1)"
                    : "linear-gradient(90deg, #22c55e, #22d3ee)",
            }}
          />
        </div>
      </div>
      <ul className="space-y-1.5 px-4 py-2">
        {items.map((item, index) => (
          <li
            key={index}
            className={`flex items-start gap-2 text-sm leading-relaxed ${
              item.status === "done"
                ? "text-emerald-700"
                : item.status === "wip"
                  ? "text-indigo-700"
                  : "text-slate-500"
            }`}
          >
            <span className="mt-0.5 shrink-0 text-base">
              {item.status === "done" ? "✅" : item.status === "wip" ? "🔄" : "⏳"}
            </span>
            <span className={item.status === "done" ? "line-through opacity-70" : ""}>
              {item.text}
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}

export function TaskTrackerHint() {
  return null;
}
