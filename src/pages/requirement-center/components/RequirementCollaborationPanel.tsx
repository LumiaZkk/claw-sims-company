import { Users } from "lucide-react";
import { Badge } from "../../../ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "../../../ui/card";
import { formatTime } from "../../../lib/utils";

type TranscriptMessage = {
  id: string;
  role?: string;
  text?: string | null;
  timestamp: number;
  source?: string | null;
  senderLabel?: string | null;
  senderAgentId?: string | null;
  audienceAgentIds?: string[] | null;
};

type DispatchSummary = {
  id: string;
  title: string;
  sourceMessageId?: string | null;
  responseMessageId?: string | null;
};

type RoomDispatchCheckout = {
  claimedCount: number;
  openCount: number;
  latest: { detail: string } | null;
};

export function RequirementCollaborationPanel(props: {
  roomTitle: string;
  roomPreviewText: string;
  roomUpdatedAt: number | null;
  roomMemberCount: number;
  roomDispatches: DispatchSummary[];
  roomDispatchCheckout: RoomDispatchCheckout;
  transcriptPreview: TranscriptMessage[];
  employees: Array<{ agentId: string; nickname: string }>;
}) {
  const {
    roomTitle,
    roomPreviewText,
    roomUpdatedAt,
    roomMemberCount,
    roomDispatches,
    roomDispatchCheckout,
    transcriptPreview,
    employees,
  } = props;

  return (
    <Card className="border-slate-200 bg-white shadow-sm">
      <CardHeader className="border-b bg-slate-50/70">
        <CardTitle className="flex items-center gap-2 text-base">
          <Users className="h-4 w-4 text-violet-600" />
          协作区
        </CardTitle>
        <CardDescription>
          需求房是协作投影视图，底层可能拆成多个成员会话执行。
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4 p-4">
        <div className="rounded-2xl border border-slate-200 bg-slate-50/70 p-4">
          <div className="text-sm font-semibold text-slate-950">{roomTitle}</div>
          <div className="mt-2 text-sm leading-6 text-slate-600">{roomPreviewText}</div>
          <div className="mt-3 flex flex-wrap gap-2 text-xs">
            <Badge variant="outline" className="border-slate-200 bg-white text-slate-600">
              {roomDispatches.length} 条派单
            </Badge>
            {roomDispatchCheckout.claimedCount > 0 ? (
              <Badge variant="outline" className="border-emerald-200 bg-emerald-50 text-emerald-700">
                {roomDispatchCheckout.claimedCount} 条执行中
              </Badge>
            ) : null}
            {roomDispatchCheckout.openCount > 0 ? (
              <Badge variant="outline" className="border-amber-200 bg-amber-50 text-amber-700">
                {roomDispatchCheckout.openCount} 条待接手
              </Badge>
            ) : null}
            <Badge variant="outline" className="border-slate-200 bg-white text-slate-600">
              {roomMemberCount} 位成员
            </Badge>
            <Badge variant="outline" className="border-slate-200 bg-white text-slate-600">
              最近同步 {formatTime(roomUpdatedAt)}
            </Badge>
          </div>
          {roomDispatchCheckout.latest ? (
            <div className="mt-3 text-xs leading-5 text-slate-600">
              当前执行权：{roomDispatchCheckout.latest.detail}
            </div>
          ) : null}
        </div>

        <div className="space-y-3">
          {transcriptPreview.length > 0 ? (
            transcriptPreview.map((message) => {
              const audienceLabels = (message.audienceAgentIds ?? [])
                .map((agentId) => employees.find((employee) => employee.agentId === agentId)?.nickname ?? agentId)
                .filter(Boolean);
              const linkedDispatch = roomDispatches.find(
                (dispatch) =>
                  dispatch.sourceMessageId === message.id || dispatch.responseMessageId === message.id,
              );
              return (
                <div key={message.id} className="rounded-2xl border border-slate-200 bg-white p-4">
                  <div className="flex flex-wrap items-center gap-2 text-xs text-slate-500">
                    <span>{message.senderLabel ?? (message.role === "user" ? "用户" : "团队成员")}</span>
                    <span>·</span>
                    <span>{formatTime(message.timestamp)}</span>
                    {message.source ? (
                      <>
                        <span>·</span>
                        <span>{message.source}</span>
                      </>
                    ) : null}
                  </div>
                  <div className="mt-2 text-sm leading-6 text-slate-800">
                    {message.text?.trim() || "该消息包含结构化内容。"}
                  </div>
                  <div className="mt-3 flex flex-wrap gap-2 text-[11px]">
                    {audienceLabels.length > 0 ? (
                      <span className="rounded-full border border-slate-200 bg-slate-50 px-2 py-0.5 text-slate-600">
                        派给 {audienceLabels.join("、")}
                      </span>
                    ) : null}
                    {message.senderAgentId ? (
                      <span className="rounded-full border border-slate-200 bg-slate-50 px-2 py-0.5 text-slate-600">
                        来自 {employees.find((employee) => employee.agentId === message.senderAgentId)?.nickname ?? message.senderAgentId}
                      </span>
                    ) : null}
                    {linkedDispatch ? (
                      <span className="rounded-full border border-slate-200 bg-slate-50 px-2 py-0.5 text-slate-600">
                        对应派单 {linkedDispatch.title}
                      </span>
                    ) : null}
                  </div>
                </div>
              );
            })
          ) : (
            <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50 p-4 text-sm leading-6 text-slate-500">
              当前还没有可展示的协作回流。进入需求房后，派单和成员回复会回流到这里。
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
