import { ChatContent } from "./ChatContent";
import { cn, formatTime } from "../../../lib/utils";
import type { DispatchRecord } from "../../../domain/delegation/types";

export function getDispatchStatusMeta(dispatch: DispatchRecord) {
  if (dispatch.status === "pending" && dispatch.deliveryState === "unknown") {
    return {
      label: "投递未确认",
      className: "border-amber-200 bg-amber-50 text-amber-700",
    };
  }
  if (dispatch.status === "pending" && dispatch.deliveryState === "pending") {
    return {
      label: "待发送",
      className: "border-slate-200 bg-slate-50 text-slate-500",
    };
  }
  const status = dispatch.status;
  if (status === "answered") {
    return {
      label: "已回复",
      className: "border-emerald-200 bg-emerald-50 text-emerald-700",
    };
  }
  if (status === "acknowledged") {
    return {
      label: "已接单",
      className: "border-sky-200 bg-sky-50 text-sky-700",
    };
  }
  if (status === "blocked") {
    return {
      label: "已阻塞",
      className: "border-rose-200 bg-rose-50 text-rose-700",
    };
  }
  if (status === "superseded") {
    return {
      label: "已覆盖",
      className: "border-slate-200 bg-slate-50 text-slate-500",
    };
  }
  if (status === "sent") {
    return {
      label: "已派发",
      className: "border-indigo-200 bg-indigo-50 text-indigo-700",
    };
  }
  return {
    label: "待发送",
    className: "border-slate-200 bg-slate-50 text-slate-500",
  };
}

export function ChatDetailDisclosure(input: {
  detailContent?: string | null;
  label?: string;
}) {
  if (!input.detailContent?.trim()) {
    return null;
  }
  return (
    <details className="mt-3 w-full rounded-xl border border-slate-200 bg-slate-50/80 px-3 py-2 text-slate-700">
      <summary className="cursor-pointer list-none text-xs font-medium text-slate-500">
        {input.label ?? "查看详情"}
      </summary>
      <div className="mt-3">
        <ChatContent content={[{ type: "text", text: input.detailContent }]} hideToolActivityBlocks />
      </div>
    </details>
  );
}

export function ChatStatusRow(input: {
  senderName: string;
  timestamp?: number;
  summary: string;
  badgeLabel?: string;
  badgeClassName?: string;
  metaLabel?: string;
  detailContent?: string | null;
}) {
  return (
    <div className="flex justify-start">
      <div className="w-full max-w-3xl rounded-2xl border border-slate-200/80 bg-slate-50/85 px-4 py-3 text-slate-700 shadow-sm">
        <div className="flex flex-wrap items-center gap-2 text-xs">
          <span className="font-medium text-slate-700">{input.senderName}</span>
          {typeof input.timestamp === "number" ? (
            <span className="text-slate-400">{formatTime(input.timestamp)}</span>
          ) : null}
          {input.badgeLabel ? (
            <span className={cn("rounded-full border px-2 py-0.5 text-[11px] font-medium", input.badgeClassName)}>
              {input.badgeLabel}
            </span>
          ) : null}
          {input.metaLabel ? <span className="text-slate-400">{input.metaLabel}</span> : null}
        </div>
        <div className="mt-2 text-sm leading-6 text-slate-800">{input.summary}</div>
        <ChatDetailDisclosure detailContent={input.detailContent} label="查看上下文详情" />
      </div>
    </div>
  );
}

export function extractTextFromRenderableBlocks(content: unknown): string | null {
  if (!Array.isArray(content)) {
    return typeof content === "string" && content.trim().length > 0 ? content : null;
  }
  const text = content
    .map((block) =>
      typeof block === "object" && block && typeof (block as { text?: unknown }).text === "string"
        ? (block as { text: string }).text.trim()
        : "",
    )
    .filter((value) => value.length > 0)
    .join("\n")
    .trim();
  return text.length > 0 ? text : null;
}
