import { BookOpenCheck, MessageSquare } from "lucide-react";
import { Button } from "../../../ui/button";
import { Card, CardContent } from "../../../ui/card";

export function RequirementEmptyStateCard(props: {
  canOpenCeoChat: boolean;
  onOpenCeoChat: () => void;
  onOpenCeoHome: () => void;
}) {
  const { canOpenCeoChat, onOpenCeoChat, onOpenCeoHome } = props;

  return (
    <Card className="border-slate-200 bg-white shadow-sm">
      <CardContent className="flex flex-col items-center gap-4 px-6 py-10 text-center">
        <div className="rounded-full bg-slate-100 p-3 text-slate-500">
          <BookOpenCheck className="h-6 w-6" />
        </div>
        <div>
          <div className="text-lg font-semibold text-slate-950">当前还没有可推进的主线需求</div>
          <div className="mt-2 max-w-xl text-sm leading-6 text-slate-500">
            先去 CEO 深聊把目标、边界和下一步收敛出来，需求中心只承接已经形成主线的需求。
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          {canOpenCeoChat ? (
            <Button onClick={onOpenCeoChat}>
              <MessageSquare className="mr-2 h-4 w-4" />
              进入 CEO 深聊
            </Button>
          ) : null}
          <Button variant="outline" onClick={onOpenCeoHome}>
            返回 CEO 首页
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
