import { ArrowRight, Files } from "lucide-react";
import { Badge } from "../../../components/ui/badge";
import { Button } from "../../../components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "../../../components/ui/card";
import { formatTime } from "../../../lib/utils";

type DeliverableFile = {
  key: string;
  name: string;
  agentLabel: string;
  workspace: string;
  kind: string;
  previewText?: string;
  path: string;
  updatedAtMs?: number;
  size?: number;
};

export function RequirementDeliverySummaryCard(props: {
  deliverableFiles: DeliverableFile[];
  formatSize: (size?: number) => string;
  onOpenWorkspace: () => void;
}) {
  const { deliverableFiles, formatSize, onOpenWorkspace } = props;

  return (
    <Card className="border-slate-200 bg-white shadow-sm">
      <CardHeader className="border-b bg-slate-50/70">
        <CardTitle className="flex items-center gap-2 text-base">
          <Files className="h-4 w-4 text-emerald-600" />
          交付区
        </CardTitle>
        <CardDescription>
          展示当前主线最近的文件、报告和镜像产物，完整内容仍在 Workspace。
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-3 p-4">
        {deliverableFiles.length > 0 ? (
          deliverableFiles.map((file) => (
            <div key={file.key} className="rounded-2xl border border-slate-200 bg-white p-4">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <div className="text-sm font-semibold text-slate-950">{file.name}</div>
                  <div className="mt-1 text-xs text-slate-500">
                    {file.agentLabel} · {file.workspace}
                  </div>
                </div>
                <Badge variant="outline" className="border-slate-200 bg-slate-50 text-slate-600">
                  {file.kind}
                </Badge>
              </div>
              <div className="mt-2 text-sm leading-6 text-slate-600">
                {file.previewText ?? file.path}
              </div>
              <div className="mt-3 flex flex-wrap gap-2 text-[11px] text-slate-500">
                <span>更新时间 {formatTime(file.updatedAtMs ?? null)}</span>
                {typeof file.size === "number" ? <span>· {formatSize(file.size)}</span> : null}
              </div>
            </div>
          ))
        ) : (
          <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50 p-4 text-sm leading-6 text-slate-500">
            当前主线还没有稳定的交付物镜像，先让团队继续产出，再回这里验收。
          </div>
        )}
        <Button variant="outline" onClick={onOpenWorkspace}>
          打开完整交付区
          <ArrowRight className="ml-2 h-4 w-4" />
        </Button>
      </CardContent>
    </Card>
  );
}
