import {
  Activity,
  CheckCircle2,
  Cpu,
  MessageSquare,
  MoreVertical,
  Plus,
  Server,
  ShieldAlert,
  Trash2,
  Users,
} from "lucide-react";
import type { ReactNode } from "react";
import type {
  LobbyEmployeeCardData,
  LobbyUnifiedStreamItem,
} from "../../../application/governance/lobby-operations-surface";
import { resolveConversationPresentation } from "../../../lib/chat-routes";
import { formatTime, getAvatarUrl } from "../../../lib/utils";
import { ExecutionStateBadge } from "../../../components/execution-state-badge";
import { Avatar, AvatarFallback, AvatarImage } from "../../../components/ui/avatar";
import { Badge } from "../../../components/ui/badge";
import { Button } from "../../../components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "../../../components/ui/card";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "../../../components/ui/dropdown-menu";

type LobbyTeamActivitySectionProps = {
  hasRequirementOverview: boolean;
  displayEmployeesData: LobbyEmployeeCardData[];
  unifiedStream: LobbyUnifiedStreamItem[];
  activeCompanyEmployees: Array<{ agentId: string; nickname: string; role: string; metaRole?: string | null }>;
  activeRoomRecords: Parameters<typeof resolveConversationPresentation>[0]["rooms"];
  renderPresenceBadge: (status: string) => ReactNode;
  onOpenGroupChat: () => void;
  onOpenCeoChat: () => void;
  onOpenHire: () => void;
  onUpdateRole: (employee: LobbyEmployeeCardData) => void;
  onFireEmployee: (agentId: string) => void;
  onOpenRoute: (route: string) => void;
  onOpenBoard: () => void;
};

export function LobbyTeamActivitySection(props: LobbyTeamActivitySectionProps) {
  const {
    hasRequirementOverview,
    displayEmployeesData,
    unifiedStream,
    activeCompanyEmployees,
    activeRoomRecords,
    renderPresenceBadge,
    onOpenGroupChat,
    onOpenCeoChat,
    onOpenHire,
    onUpdateRole,
    onFireEmployee,
    onOpenRoute,
    onOpenBoard,
  } = props;

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between sm:gap-0">
        <h2 className="text-xl font-semibold flex items-center gap-2">团队成员</h2>
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" size="sm" onClick={onOpenGroupChat}>
            <Users className="mr-2 h-4 w-4 text-indigo-500" /> 跨部门会议
          </Button>
          <Button variant="outline" size="sm" onClick={onOpenCeoChat}>
            <MessageSquare className="mr-2 h-4 w-4" /> 联系 CEO
          </Button>
          <Button size="sm" onClick={onOpenHire}>
            <Plus className="mr-2 h-4 w-4" /> 新增成员
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 grid grid-cols-1 md:grid-cols-2 gap-4 auto-rows-max">
          {displayEmployeesData.map((employee) => {
            const isManager =
              employee.metaRole === "ceo" ||
              employee.metaRole === "cto" ||
              employee.metaRole === "coo" ||
              employee.metaRole === "hr";

            return (
              <Card
                key={employee.agentId}
                className={`transition-all ${
                  employee.status === "running"
                    ? "border-primary/50 ring-1 ring-primary/20"
                    : employee.status === "stopped"
                      ? "opacity-75"
                      : ""
                }`}
              >
                <CardHeader className="p-4 pb-2">
                  <div className="flex justify-between items-start">
                    <div className="flex items-center gap-3 overflow-hidden">
                      <Avatar className="h-10 w-10 border border-zinc-800 bg-zinc-900 rounded-lg">
                        <AvatarImage
                          src={getAvatarUrl(employee.agentId, employee.avatarJobId)}
                          className="object-cover"
                        />
                        <AvatarFallback className="bg-zinc-800 text-zinc-400 font-mono text-xs rounded-lg">
                          {employee.nickname.slice(0, 2)}
                        </AvatarFallback>
                      </Avatar>
                      <div className="min-w-0 flex-1">
                        <CardTitle className="text-base truncate" title={employee.nickname}>
                          {employee.nickname}
                        </CardTitle>
                        <CardDescription className="truncate text-xs flex items-center gap-1">
                          {isManager ? <Server className="w-3 h-3" /> : null}
                          {employee.role}
                        </CardDescription>
                        {employee.skills?.length ? (
                          <div className="flex gap-1 mt-2 flex-wrap">
                            {employee.skills.map((skill) => (
                              <Badge key={skill} variant="outline" className="text-[10px] bg-slate-100/50">
                                {skill}
                              </Badge>
                            ))}
                          </div>
                        ) : null}
                      </div>
                    </div>
                    <div className="shrink-0 ml-2 flex flex-col items-end gap-2">
                      <div className="flex items-center gap-1 flex-wrap justify-end">
                        {renderPresenceBadge(employee.status)}
                        <ExecutionStateBadge compact status={employee.execution} />
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="icon" className="h-6 w-6 hover:bg-slate-200">
                              <MoreVertical className="w-4 h-4 text-slate-500" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end" className="w-48 z-50 bg-white">
                            <DropdownMenuLabel>管理操作</DropdownMenuLabel>
                            <DropdownMenuSeparator />
                            <DropdownMenuItem onClick={() => onUpdateRole(employee)}>
                              <ShieldAlert className="w-4 h-4 mr-2" />
                              调整职责描述
                            </DropdownMenuItem>
                            <DropdownMenuItem disabled>
                              <Cpu className="w-4 h-4 mr-2" />
                              更换大脑模型 (WIP)
                            </DropdownMenuItem>
                            <DropdownMenuSeparator />
                            <DropdownMenuItem
                              className="text-red-600 hover:bg-red-50 hover:text-red-700 focus:text-red-700"
                              onClick={() => onFireEmployee(employee.agentId)}
                            >
                              <Trash2 className="w-4 h-4 mr-2" />
                              移除此成员
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </div>
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="p-4 pt-2">
                  <div className="text-xs text-muted-foreground mt-2 truncate" title={employee.realName}>
                    系统名称: {employee.realName}
                  </div>
                  <div className="mt-2 text-xs font-medium text-slate-700 line-clamp-2">
                    {employee.focusSummary.currentWork}
                  </div>
                  <div className="mt-1 text-[11px] text-slate-500 line-clamp-2">
                    下一步：{employee.focusSummary.nextStep}
                  </div>
                  {employee.focusSummary.blockReason ? (
                    <div className="mt-1 text-[11px] text-rose-700 line-clamp-2">
                      当前卡点：{employee.focusSummary.blockReason}
                    </div>
                  ) : null}
                  {employee.execution.state === "manual_takeover_required" ? (
                    <div className="mt-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-[11px] leading-5 text-amber-900">
                      该成员已进入人工接管态，建议直接打开会话复制接管包继续处理。
                    </div>
                  ) : null}
                  <div className="flex gap-2 mt-4">
                    <Button
                      variant="secondary"
                      size="sm"
                      className="w-full text-xs"
                      disabled={employee.status === "stopped"}
                      onClick={() => onOpenRoute(`/chat/${employee.agentId}`)}
                    >
                      <MessageSquare className="mr-1.5 h-3.5 w-3.5" /> 聊天
                    </Button>
                    <Button
                      variant="secondary"
                      size="sm"
                      className="w-full text-xs"
                      disabled={employee.status === "stopped"}
                      onClick={onOpenBoard}
                    >
                      <CheckCircle2 className="mr-1.5 h-3.5 w-3.5" /> 派单
                    </Button>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>

        <Card className="lg:col-span-1 flex flex-col max-h-[600px] border-l-4 border-l-slate-200">
          <CardHeader className="shrink-0 bg-slate-50 border-b">
            <CardTitle className="text-base flex items-center gap-2">
              <Activity className="w-4 h-4 text-blue-500" />
              {hasRequirementOverview ? "本次需求活动动态" : "全时序活动动态"}
            </CardTitle>
            <CardDescription className="text-xs">
              {hasRequirementOverview
                ? "这里只保留当前主线相关成员和自动化的最近活动。"
                : "按时间排列的所有交互流与自动化日志"}
            </CardDescription>
          </CardHeader>
          <CardContent className="flex-1 overflow-y-auto p-4 pt-6">
            <div className="relative border-l ml-3 space-y-6 pl-6">
              {unifiedStream.map((item) => (
                <div key={item.key} className="relative">
                  <div className="absolute -left-[31px] bg-background p-1 rounded-full border">
                    <Avatar className="h-8 w-8 border border-zinc-800 bg-zinc-900 rounded-lg shrink-0 overflow-hidden">
                      <AvatarImage
                        src={getAvatarUrl(
                          item.employee?.agentId,
                          item.employee?.avatarJobId,
                          item.agentId || item.jobId,
                        )}
                        className="object-cover"
                      />
                      <AvatarFallback className="bg-zinc-800 text-zinc-500 rounded-lg text-[10px] font-mono">
                        SYS
                      </AvatarFallback>
                    </Avatar>
                  </div>
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-sm font-semibold text-foreground">
                      {item.employee?.nickname || item.employee?.agentId || "Unknown"}
                    </span>
                    <Badge
                      variant="secondary"
                      className="text-[9px] uppercase px-1 py-0 scale-90 origin-left opacity-80"
                    >
                      {item.type === "cron" ? "自动化" : "会话"}
                    </Badge>
                    <ExecutionStateBadge compact status={item.execution} />
                  </div>
                  <div className="text-[10px] text-slate-400 font-mono flex items-center gap-1.5 mt-2 opacity-60">
                    {formatTime(item.timestamp || undefined)}
                  </div>
                  <div
                    className={`rounded-md p-2.5 text-xs ${
                      item.active
                        ? "bg-indigo-50 border border-indigo-100"
                        : "bg-slate-50 border border-slate-100"
                    }`}
                  >
                    <div className={item.active ? "text-indigo-800" : "text-slate-600"}>
                      <span className="font-medium">"{item.title}"</span>
                    </div>
                    <div className="mt-1 text-[11px] font-medium text-slate-700">
                      {item.focusSummary.currentWork}
                    </div>
                    <div className="mt-1 text-[11px] text-slate-500">
                      下一步：{item.focusSummary.nextStep}
                    </div>
                    {item.focusSummary.blockReason ? (
                      <div className="mt-1 text-[11px] text-rose-700">
                        当前卡点：{item.focusSummary.blockReason}
                      </div>
                    ) : null}
                    {item.execution.state === "manual_takeover_required" ? (
                      <button
                        type="button"
                        className="mt-2 inline-flex text-[11px] font-medium text-amber-800 hover:text-amber-900"
                        onClick={() =>
                          onOpenRoute(
                            resolveConversationPresentation({
                              sessionKey: item.key,
                              actorId: item.employee?.agentId ?? null,
                              rooms: activeRoomRecords,
                              employees: activeCompanyEmployees,
                            }).route,
                          )
                        }
                      >
                        查看接管包
                      </button>
                    ) : null}
                    {item.preview ? (
                      <div className="mt-1.5 text-[11px] text-slate-500 line-clamp-2 leading-relaxed border-t border-slate-200/50 pt-1.5 italic">
                        {item.preview
                          .slice(0, 100)
                          .replace(/([{["].{10,}$)/, "...[代码体隐藏]")
                          .replace(/__tool_call__[\s\S]*/, "...[正在调用系统工具]")}
                      </div>
                    ) : null}
                  </div>
                </div>
              ))}
              {unifiedStream.length === 0 ? (
                <div className="text-slate-400 text-sm py-4 border-l-transparent text-center">
                  系统还未产生任何活动记录
                </div>
              ) : null}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
