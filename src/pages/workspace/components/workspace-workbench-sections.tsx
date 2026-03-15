import { ArrowUpRight } from "lucide-react";
import type { ReactNode } from "react";
import {
  buildCapabilityVerificationQueue,
  type CapabilityBoardLane,
} from "../../../application/workspace";
import { formatTime } from "../../../lib/utils";
import { Badge } from "../../../ui/badge";
import { Button } from "../../../ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "../../../ui/card";
import type { WorkspacePageContentProps } from "./workspace-page-types";

export function CapabilityBoardSummary({ lanes }: { lanes: CapabilityBoardLane[] }) {
  return (
    <div className="flex flex-wrap gap-2">
      {lanes.map((lane) => (
        <Badge key={lane.id} variant={lane.count > 0 ? "secondary" : "outline"}>
          {lane.label} {lane.count}
        </Badge>
      ))}
    </div>
  );
}

export function CapabilityBoardLaneSection({
  lane,
  emptyText,
  renderActions,
}: {
  lane: CapabilityBoardLane;
  emptyText: string;
  renderActions: (item: CapabilityBoardLane["items"][number]) => ReactNode;
}) {
  return (
    <div className="rounded-xl border border-slate-200 bg-slate-50/70 px-4 py-4">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="text-sm font-semibold text-slate-950">{lane.label}</div>
          <div className="mt-1 text-xs leading-5 text-slate-500">{lane.description}</div>
        </div>
        <Badge variant={lane.count > 0 ? "secondary" : "outline"}>{lane.count}</Badge>
      </div>
      <div className="mt-3 space-y-3">
        {lane.items.length > 0 ? (
          lane.items.map((item) => (
            <div key={item.id} className="rounded-xl border border-slate-200 bg-white px-4 py-4">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="text-sm font-semibold text-slate-950">{item.summary}</div>
                  {item.detail ? (
                    <div className="mt-1 text-xs leading-5 text-slate-500">{item.detail}</div>
                  ) : null}
                </div>
                <ArrowUpRight className="mt-0.5 h-4 w-4 shrink-0 text-slate-300" />
              </div>
              <div className="mt-3 flex flex-wrap gap-2">
                <Badge variant="secondary">{item.statusLabel}</Badge>
                <Badge variant="outline">下一步 {item.nextActorLabel}</Badge>
                {item.requesterOrReporterLabel ? (
                  <Badge variant="outline">来自 {item.requesterOrReporterLabel}</Badge>
                ) : null}
                {item.relatedLabels.map((label) => (
                  <Badge key={`${item.id}:${label}`} variant="outline">
                    {label}
                  </Badge>
                ))}
              </div>
              <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
                <div className="text-xs text-slate-500">最近更新 {formatTime(item.updatedAt)}</div>
                <div className="flex flex-wrap gap-2">{renderActions(item)}</div>
              </div>
            </div>
          ))
        ) : (
          <div className="rounded-xl border border-dashed border-slate-200 bg-white px-4 py-4 text-xs leading-5 text-slate-500">
            {emptyText}
          </div>
        )}
      </div>
    </div>
  );
}

export function CapabilityVerificationQueueSection({
  queue,
  onSelectApp,
  onUpdateCapabilityRequestStatus,
  onUpdateCapabilityIssueStatus,
}: {
  queue: ReturnType<typeof buildCapabilityVerificationQueue>;
  onSelectApp: (appId: string) => void;
  onUpdateCapabilityRequestStatus: WorkspacePageContentProps["onUpdateCapabilityRequestStatus"];
  onUpdateCapabilityIssueStatus: WorkspacePageContentProps["onUpdateCapabilityIssueStatus"];
}) {
  return (
    <Card className="border-slate-200/80 shadow-sm">
      <CardHeader>
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <CardTitle className="text-base">待验证优先</CardTitle>
            <CardDescription className="mt-2 leading-6">
              这里会优先拉出已经交付、正等业务负责人验收或回访的项，减少在多个泳道之间来回翻找。
            </CardDescription>
          </div>
          <Badge variant={queue.length > 0 ? "secondary" : "outline"}>{queue.length}</Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        {queue.length > 0 ? (
          queue.map((item) => (
            <div key={`${item.kind}:${item.id}`} className="rounded-xl border border-slate-200 bg-white px-4 py-4">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="text-sm font-semibold text-slate-950">{item.summary}</div>
                  {item.detail ? <div className="mt-1 text-xs leading-5 text-slate-500">{item.detail}</div> : null}
                </div>
                <div className="flex flex-wrap gap-2">
                  <Badge variant={item.kind === "issue" ? "destructive" : "secondary"}>
                    {item.kind === "issue" ? "问题" : "需求"}
                  </Badge>
                  <Badge variant="outline">{item.statusLabel}</Badge>
                </div>
              </div>
              <div className="mt-3 flex flex-wrap gap-2">
                {item.appLabel ? <Badge variant="outline">App · {item.appLabel}</Badge> : null}
                {item.skillLabel ? <Badge variant="outline">能力 · {item.skillLabel}</Badge> : null}
                {item.contextFileName ? <Badge variant="outline">资源 · {item.contextFileName}</Badge> : null}
                {item.contextRunId ? (
                  <Badge variant="outline" className="max-w-full truncate">
                    运行记录 · {item.contextRunId}
                  </Badge>
                ) : null}
                {item.requesterOrReporterLabel ? (
                  <Badge variant="outline">来自 {item.requesterOrReporterLabel}</Badge>
                ) : null}
              </div>
              <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
                <div className="text-xs text-slate-500">最近更新 {formatTime(item.updatedAt)}</div>
                <div className="flex flex-wrap gap-2">
                  {item.appId ? (
                    <Button type="button" size="sm" variant="outline" onClick={() => onSelectApp(item.appId!)}>
                      打开相关 App
                    </Button>
                  ) : null}
                  {item.kind === "request" ? (
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      onClick={() =>
                        void onUpdateCapabilityRequestStatus(
                          item.id,
                          item.status === "verified" ? "closed" : "verified",
                        )
                      }
                    >
                      {item.nextActionLabel ?? (item.status === "verified" ? "归档关闭" : "标记已验证")}
                    </Button>
                  ) : (
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      onClick={() =>
                        void onUpdateCapabilityIssueStatus(
                          item.id,
                          item.status === "verified" ? "closed" : "verified",
                        )
                      }
                    >
                      {item.nextActionLabel ?? (item.status === "verified" ? "归档关闭" : "标记已验证")}
                    </Button>
                  )}
                </div>
              </div>
            </div>
          ))
        ) : (
          <div className="rounded-xl border border-dashed border-slate-200 bg-slate-50 px-4 py-6 text-sm leading-6 text-slate-500">
            当前还没有等待业务负责人验收的项。后续当需求进入“待验证”或问题进入“待回访”时，这里会优先冒出来。
          </div>
        )}
      </CardContent>
    </Card>
  );
}
