import { RefreshCcw, RotateCcw, ShieldAlert } from "lucide-react";
import { Button } from "../../../components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "../../../components/ui/card";
import { ActivityInboxStrip } from "../../shared/ActivityInboxStrip";

export function RequirementOpsSummaryCard(props: {
  activityInboxSummary: Parameters<typeof ActivityInboxStrip>[0]["summary"];
  recoveringCommunication: boolean;
  onRecover: () => void;
  onOpenOps: () => void;
}) {
  const { activityInboxSummary, recoveringCommunication, onRecover, onOpenOps } = props;

  return (
    <Card className="border-slate-200 bg-white shadow-sm">
      <CardHeader className="border-b bg-slate-50/70">
        <CardTitle className="flex items-center gap-2 text-base">
          <ShieldAlert className="h-4 w-4 text-rose-600" />
          排障入口
        </CardTitle>
        <CardDescription>
          这里不承担排障细节，只保留最短跳转和同步入口，避免把需求中心再次做成第二个 Ops。
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-wrap items-center justify-between gap-3 p-4">
        <div className="min-w-0 flex-1">
          <ActivityInboxStrip summary={activityInboxSummary} title="统一活动摘要" />
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" onClick={onRecover} disabled={recoveringCommunication}>
            <RefreshCcw className="mr-2 h-4 w-4" />
            {recoveringCommunication ? "同步中..." : "恢复当前阻塞"}
          </Button>
          <Button variant="outline" onClick={onOpenOps}>
            <RotateCcw className="mr-2 h-4 w-4" />
            打开 Ops
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
