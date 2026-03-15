import type { ReactNode } from "react";
import { ChevronDown } from "lucide-react";
import { cn } from "../../../lib/utils";
import type {
  LifecycleEvent,
  LifecycleParticipant,
  ProgressEvent,
  TimelinePreviewItem,
} from "./chat-summary-panel-types";

export function cardToneClass(tone: ProgressEvent["tone"] | LifecycleEvent["tone"]) {
  if (tone === "rose") {
    return "border-rose-200 bg-rose-50/60";
  }
  if (tone === "emerald") {
    return "border-emerald-200 bg-emerald-50/60";
  }
  if (tone === "indigo") {
    return "border-indigo-200 bg-indigo-50/60";
  }
  return "border-amber-200 bg-amber-50/60";
}

export function participantToneClass(tone: LifecycleParticipant["tone"]) {
  if (tone === "rose") {
    return "border-rose-200 bg-rose-50/50";
  }
  if (tone === "amber") {
    return "border-amber-200 bg-amber-50/50";
  }
  if (tone === "emerald") {
    return "border-emerald-200 bg-emerald-50/50";
  }
  if (tone === "violet") {
    return "border-violet-200 bg-violet-50/50";
  }
  if (tone === "blue") {
    return "border-indigo-200 bg-indigo-50/50";
  }
  return "border-slate-200 bg-slate-50/70";
}

export function TimelinePreview({
  title,
  description,
  count,
  previewItems,
  children,
}: {
  title: string;
  description: string;
  count: number;
  previewItems: TimelinePreviewItem[];
  children: ReactNode;
}) {
  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-4">
      <details className="group" open={false}>
        <summary className="list-none cursor-pointer">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <div className="text-sm font-semibold text-slate-900">{title}</div>
              <div className="mt-1 text-xs leading-5 text-slate-500">{description}</div>
            </div>
            <span className="inline-flex items-center gap-1 rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-[11px] font-medium text-slate-600">
              <ChevronDown className="h-3.5 w-3.5 transition-transform duration-200 group-open:rotate-180" />
              {count} 条
            </span>
          </div>
          <div className="mt-3 space-y-2">
            {previewItems.map((item) => (
              <div
                key={item.id}
                className="rounded-xl border border-slate-200 bg-slate-50/70 px-3 py-3"
              >
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="text-sm font-medium text-slate-900">{item.title}</div>
                  <div className="text-[11px] text-slate-500">{item.meta}</div>
                </div>
                <div className="mt-1 text-xs leading-5 text-slate-500">{item.subtitle}</div>
              </div>
            ))}
          </div>
        </summary>
        <div className="mt-4 border-t border-slate-200 pt-4">{children}</div>
      </details>
    </section>
  );
}
