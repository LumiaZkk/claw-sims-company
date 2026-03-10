import {
  Building2,
  Cpu,
  Database,
  FileCode,
  FileJson,
  FileText,
  HardDrive,
  List,
  MessageSquare,
  MoreVertical,
  Network,
  Play,
  Settings,
  ShieldAlert,
  Trash2,
  UserCog,
  Wand2,
} from "lucide-react";
import { useNavigate } from "react-router-dom";
import type { OrgAdvisorSnapshot } from "../../../application/assignment/org-fit";
import type {
  AgentFileWorkspace,
  DirectoryEmployeeInsight,
  DirectoryEmployeeRow,
} from "../../../application/org/directory-query";
import type { Department } from "../../../domain/org/types";
import { resolveDepartmentLabel } from "../../../domain/org/policies";
import { ActionFormDialog } from "../../../components/ui/action-form-dialog";
import { Avatar, AvatarFallback, AvatarImage } from "../../../components/ui/avatar";
import { Badge } from "../../../components/ui/badge";
import { Button } from "../../../components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "../../../components/ui/card";
import { DepartmentManagerDialog } from "../../../components/ui/department-manager-dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "../../../components/ui/dropdown-menu";
import { HrDepartmentPlanDialog } from "../../../components/ui/hr-department-plan-dialog";
import { ImmersiveHireDialog, type HireConfig } from "../../../components/ui/immersive-hire-dialog";
import { OrgChart } from "../../../components/ui/org-chart";
import type { HrPlanDialogState } from "../../../components/ui/hr-department-plan-dialog";
import { formatTime, getAvatarUrl } from "../../../lib/utils";

type ViewMode = "org" | "list";

type UpdateRoleInitial = {
  role: string;
  description: string;
} | null;

export function EmployeeDirectoryHeader(props: {
  viewMode: ViewMode;
  setViewMode: (mode: ViewMode) => void;
  hrPlanning: boolean;
  fixingOrg: boolean;
  orgIssueCount: number;
  onStartHrBootstrap: () => void;
  onFixOrganization: () => void;
  onOpenDepartments: () => void;
  onOpenHire: () => void;
}) {
  const {
    viewMode,
    setViewMode,
    hrPlanning,
    fixingOrg,
    orgIssueCount,
    onStartHrBootstrap,
    onFixOrganization,
    onOpenDepartments,
    onOpenHire,
  } = props;

  return (
    <div className="flex flex-col lg:flex-row lg:items-center justify-between mb-8 gap-4 lg:gap-0">
      <div>
        <h1 className="text-2xl md:text-3xl font-bold tracking-tight">员工管理档案</h1>
        <p className="text-muted-foreground mt-1 text-sm">
          管理及调配赛博公司麾下的所有计算节点与 AI 特工
        </p>
      </div>
      <div className="flex flex-wrap items-center gap-2 md:gap-4">
        <div className="bg-slate-100 p-1 rounded-lg flex items-center">
          <Button
            variant="ghost"
            size="sm"
            className={`h-8 px-3 rounded-md ${viewMode === "org" ? "bg-white shadow-sm text-indigo-600" : "text-slate-500 hover:text-slate-700"}`}
            onClick={() => setViewMode("org")}
          >
            <Network className="w-4 h-4 mr-2" />
            架构图
          </Button>
          <Button
            variant="ghost"
            size="sm"
            className={`h-8 px-3 rounded-md ${viewMode === "list" ? "bg-white shadow-sm text-indigo-600" : "text-slate-500 hover:text-slate-700"}`}
            onClick={() => setViewMode("list")}
          >
            <List className="w-4 h-4 mr-2" />
            列表
          </Button>
        </div>
        {viewMode === "org" ? (
          <Button
            variant="secondary"
            onClick={onStartHrBootstrap}
            disabled={hrPlanning}
            title="由 HR agent 分析输出方案，前端仅负责落盘。"
          >
            <Building2 className="w-4 h-4 mr-2" />
            {hrPlanning ? "等待 HR..." : "HR 建部门"}
          </Button>
        ) : null}
        {viewMode === "org" ? (
          <Button
            variant="secondary"
            onClick={onFixOrganization}
            disabled={fixingOrg || orgIssueCount === 0}
            title={orgIssueCount > 0 ? `检测到 ${orgIssueCount} 个结构问题` : "未检测到结构问题"}
          >
            <Wand2 className="w-4 h-4 mr-2" />
            {fixingOrg
              ? "修复中..."
              : orgIssueCount > 0
                ? `一键修复 (${orgIssueCount})`
                : "一键修复"}
          </Button>
        ) : null}
        <Button variant="outline" onClick={onOpenDepartments}>
          部门管理
        </Button>
        <Button onClick={onOpenHire}>招募新员工</Button>
      </div>
    </div>
  );
}

export function EmployeeDirectorySummaryCards(props: {
  overloadedEmployees: Array<{ nickname: string }>;
  fragileEmployees: Array<{ nickname: string }>;
  balancedEmployees: Array<unknown>;
  employeeInsights: Array<{ nickname: string; loadScore: number }>;
}) {
  const { overloadedEmployees, fragileEmployees, balancedEmployees, employeeInsights } = props;

  return (
    <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
      <Card className="border-slate-200 bg-white">
        <CardContent className="p-4">
          <div className="text-xs font-semibold uppercase tracking-wider text-slate-500">过载角色</div>
          <div className="mt-2 text-3xl font-black text-rose-700">{overloadedEmployees.length}</div>
          <div className="mt-2 text-xs text-slate-500">
            {overloadedEmployees.length > 0
              ? overloadedEmployees.slice(0, 2).map((employee) => employee.nickname).join("、")
              : "当前没有明显过载节点"}
          </div>
        </CardContent>
      </Card>
      <Card className="border-slate-200 bg-white">
        <CardContent className="p-4">
          <div className="text-xs font-semibold uppercase tracking-wider text-slate-500">脆弱节点</div>
          <div className="mt-2 text-3xl font-black text-amber-700">{fragileEmployees.length}</div>
          <div className="mt-2 text-xs text-slate-500">
            {fragileEmployees.length > 0
              ? fragileEmployees.slice(0, 2).map((employee) => employee.nickname).join("、")
              : "当前没有明显脆弱节点"}
          </div>
        </CardContent>
      </Card>
      <Card className="border-slate-200 bg-white">
        <CardContent className="p-4">
          <div className="text-xs font-semibold uppercase tracking-wider text-slate-500">稳定补位</div>
          <div className="mt-2 text-3xl font-black text-emerald-700">{balancedEmployees.length}</div>
          <div className="mt-2 text-xs text-slate-500">适合承担补位、接管或新任务的平衡节点</div>
        </CardContent>
      </Card>
      <Card className="border-slate-200 bg-white">
        <CardContent className="p-4">
          <div className="text-xs font-semibold uppercase tracking-wider text-slate-500">最高负载</div>
          <div className="mt-2 text-lg font-black text-slate-900">
            {employeeInsights[0]
              ? `${employeeInsights[0].nickname} · ${employeeInsights[0].loadScore}`
              : "--"}
          </div>
          <div className="mt-2 text-xs text-slate-500">
            结合任务、交接、SLA 和会话活跃度的综合负载分
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

export function EmployeeOrgAdvisorCard(props: {
  viewMode: ViewMode;
  orgAdvisor: OrgAdvisorSnapshot | null;
  onApplyRecommendation: (recommendationId: string) => void;
}) {
  const { viewMode, orgAdvisor, onApplyRecommendation } = props;
  if (viewMode !== "org" || !orgAdvisor) {
    return null;
  }

  return (
    <Card className="border-slate-200 bg-white shadow-sm">
      <CardHeader className="border-b bg-slate-50/60">
        <CardTitle className="text-base">CEO 组织建议</CardTitle>
        <CardDescription>{orgAdvisor.headline}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-3 p-4">
        <div className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm leading-6 text-slate-600">
          {orgAdvisor.summary}
        </div>
        {orgAdvisor.recommendations.length > 0 ? (
          orgAdvisor.recommendations.map((recommendation) => (
            <div
              key={recommendation.id}
              className="flex flex-col gap-3 rounded-xl border border-slate-200 bg-white px-4 py-3 md:flex-row md:items-center md:justify-between"
            >
              <div>
                <div className="text-sm font-semibold text-slate-900">{recommendation.title}</div>
                <div className="mt-1 text-xs leading-5 text-slate-500">{recommendation.summary}</div>
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={() => onApplyRecommendation(recommendation.id)}
              >
                {recommendation.actionLabel}
              </Button>
            </div>
          ))
        ) : (
          <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-900">
            当前没有需要立刻重整的组织问题。
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function EmployeeListCard(props: {
  employee: DirectoryEmployeeRow;
  departments: Department[];
  insight: DirectoryEmployeeInsight | undefined;
  files: AgentFileWorkspace | undefined;
  onEditProfile: (employee: DirectoryEmployeeRow) => void;
  onUpdateRole: (employee: DirectoryEmployeeRow) => void;
  onFireEmployee: (agentId: string) => void;
  onOpenFile: (agentId: string, fileName: string) => void;
  formatBytes: (bytes?: number) => string;
}) {
  const { employee, departments, insight, files, onEditProfile, onUpdateRole, onFireEmployee, onOpenFile, formatBytes } = props;
  const navigate = useNavigate();
  const isActive = employee.status === "running" || employee.status === "idle";

  return (
    <Card className={employee.status === "stopped" ? "opacity-[0.85]" : ""}>
      <CardHeader className="flex flex-row items-start justify-between bg-slate-50/50 pb-4 border-b">
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-4">
            <Avatar
              className={`h-12 w-12 border ${isActive ? "border-zinc-700 bg-zinc-800 pl-0" : "border-zinc-800 bg-zinc-900"} rounded-xl`}
            >
              <AvatarImage
                src={getAvatarUrl(employee.agentId, employee.avatarJobId)}
                className="object-cover"
              />
              <AvatarFallback className="bg-zinc-800 text-zinc-400 font-mono text-sm rounded-xl">
                {employee.nickname.slice(0, 2)}
              </AvatarFallback>
            </Avatar>
          </div>
          <div>
            <CardTitle className="text-xl flex items-center gap-2">
              <span
                className={`w-2 h-2 rounded-full ${employee.status === "running" ? "bg-green-500 animate-pulse" : employee.status === "idle" ? "bg-emerald-400" : "bg-slate-300"}`}
                title={employee.status}
              ></span>
              {employee.nickname}
              {employee.metaRole && (
                <Badge
                  variant="secondary"
                  className="text-[10px] uppercase font-bold tracking-wider"
                >
                  {employee.metaRole}
                </Badge>
              )}
            </CardTitle>
            <CardDescription className="text-sm mt-1">{employee.role}</CardDescription>
            <div className="mt-2">
              <Badge variant="outline" className="text-[10px] bg-white">
                部门: {resolveDepartmentLabel({ deptId: employee.departmentId, departments })}
              </Badge>
            </div>
            {insight && (
              <div className="mt-2 flex flex-wrap gap-1.5">
                <Badge
                  variant="outline"
                  className={
                    insight.loadState === "overloaded"
                      ? "border-rose-200 bg-rose-50 text-rose-700"
                      : insight.loadState === "elevated"
                        ? "border-amber-200 bg-amber-50 text-amber-700"
                        : insight.loadState === "balanced"
                          ? "border-emerald-200 bg-emerald-50 text-emerald-700"
                          : "border-slate-200 bg-slate-50 text-slate-600"
                  }
                >
                  负载 {insight.loadScore}
                </Badge>
                <Badge
                  variant="outline"
                  className={
                    insight.reliabilityState === "strong"
                      ? "border-emerald-200 bg-emerald-50 text-emerald-700"
                      : insight.reliabilityState === "watch"
                        ? "border-amber-200 bg-amber-50 text-amber-700"
                        : "border-rose-200 bg-rose-50 text-rose-700"
                  }
                >
                  可靠性 {insight.reliabilityScore}
                </Badge>
              </div>
            )}
            {employee.skills && employee.skills.length > 0 && (
              <div className="flex gap-1 mt-2 flex-wrap">
                {employee.skills.map((skill) => (
                  <Badge key={skill} variant="outline" className="text-[10px] bg-white">
                    {skill}
                  </Badge>
                ))}
              </div>
            )}
          </div>
        </div>
        <div className="flex flex-col items-end gap-2 text-right">
          <div className="flex items-center gap-2">
            <Badge
              variant="outline"
              className={
                employee.status === "running"
                  ? "border-primary text-primary bg-primary/10"
                  : employee.status === "idle"
                    ? "border-green-500 text-green-600 bg-green-500/10"
                    : "text-slate-500"
              }
            >
              {employee.status === "running"
                ? "执行中 (Running)"
                : employee.status === "idle"
                  ? "空闲待命 (Idle)"
                  : "沉睡中 (Stopped)"}
            </Badge>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8 hover:bg-slate-200"
                >
                  <MoreVertical className="w-4 h-4 text-slate-500" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-48 z-50 bg-white">
                <DropdownMenuLabel>管理操作</DropdownMenuLabel>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={() => onEditProfile(employee)}>
                  <UserCog className="w-4 h-4 mr-2" />
                  编辑员工资料
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => onUpdateRole(employee)}>
                  <ShieldAlert className="w-4 h-4 mr-2" />
                  调整底层 Prompt
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
                  解雇此计算节点
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
          {employee.lastActive > 0 && (
            <span className="text-[10px] text-muted-foreground uppercase mt-1">
              最后活动: {formatTime(employee.lastActive)}
            </span>
          )}
          {insight && (
            <div className="max-w-[240px] rounded-lg border border-slate-200 bg-white px-3 py-2 text-[11px] leading-5 text-slate-600">
              {insight.focusSummary}
            </div>
          )}
        </div>
      </CardHeader>
      <CardContent className="p-6">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
          <div className="md:col-span-1 space-y-4 text-sm text-slate-600">
            <div className="flex justify-between items-center py-2 border-b border-slate-100">
              <span className="flex items-center gap-2">
                <HardDrive className="w-4 h-4" /> 底层代号
              </span>
              <span className="font-mono text-xs max-w-[120px] truncate" title={employee.realName}>
                {employee.realName}
              </span>
            </div>
            <div className="flex justify-between items-center py-2 border-b border-slate-100">
              <span className="flex items-center gap-2">
                <Database className="w-4 h-4" /> 独立进程库
              </span>
              <span className="font-medium">{employee.sessionCount} 卷</span>
            </div>
            <div className="flex justify-between items-center py-2 border-b border-slate-100">
              <span className="flex items-center gap-2">
                <Network className="w-4 h-4" /> 系统路由
              </span>
              <span
                className="font-mono text-[10px] max-w-[100px] truncate text-indigo-600 bg-indigo-50 px-1 rounded"
                title={employee.agentId}
              >
                {employee.agentId.split("-")[0]}...
              </span>
            </div>
            <div className="flex justify-between items-center py-2 border-b border-slate-100">
              <span className="flex items-center gap-2">
                <Cpu className="w-4 h-4" /> 负载 / 可靠性
              </span>
              <span className="font-medium">
                {insight ? `${insight.loadScore} / ${insight.reliabilityScore}` : "--"}
              </span>
            </div>
            <div className="flex justify-between items-center py-2 border-b border-slate-100">
              <span className="flex items-center gap-2">
                <ShieldAlert className="w-4 h-4" /> 告警 / 交接
              </span>
              <span className="font-medium">
                {insight ? `${insight.overdueAlerts} / ${insight.pendingHandoffs}` : "--"}
              </span>
            </div>
          </div>

          <div className="md:col-span-2 flex flex-col h-full max-h-48 min-h-[12rem]">
            <h4 className="text-sm font-semibold mb-3">工作区档案库 (Workspace)</h4>
            <div className="flex-1 bg-slate-50 border rounded-lg flex flex-col overflow-hidden">
              <div className="bg-slate-100/80 px-3 py-2 border-b text-[10px] flex items-center justify-between text-slate-500 font-mono shrink-0">
                <span
                  className="truncate max-w-[200px]"
                  title={files?.workspace || employee.workspace}
                >
                  {files?.workspace || employee.workspace}
                </span>
                <span>{files?.files?.length ?? 0} items</span>
              </div>
              <div className="p-1 overflow-y-auto flex-1">
                {files?.files?.map((file) => (
                  <div
                    key={file.name}
                    className="flex items-center justify-between px-2 py-1.5 hover:bg-white rounded cursor-pointer group text-sm border border-transparent hover:border-slate-200 transition-all shadow-sm hover:shadow"
                    onClick={() => onOpenFile(employee.agentId, file.name)}
                  >
                    <div className="flex items-center gap-2 overflow-hidden">
                      {file.name.endsWith(".md") || file.name.endsWith(".txt") ? (
                        <FileText className="w-4 h-4 text-blue-500 shrink-0" />
                      ) : file.name.endsWith(".json") ? (
                        <FileJson className="w-4 h-4 text-emerald-500 shrink-0" />
                      ) : (
                        <FileCode className="w-4 h-4 text-slate-400 shrink-0" />
                      )}
                      <span className="truncate group-hover:text-indigo-600 transition-colors text-xs">
                        {file.name}
                      </span>
                    </div>
                    <div className="flex items-center gap-3 text-[10px] text-slate-400 shrink-0 font-mono">
                      <span>{formatBytes(file.size)}</span>
                      <span>{file.updatedAtMs ? formatTime(file.updatedAtMs) : ""}</span>
                    </div>
                  </div>
                ))}
                {(!files?.files || files.files.length === 0) && (
                  <div className="text-center py-4 text-xs text-slate-400">
                    正在索引工作区节点...
                  </div>
                )}
              </div>
            </div>
          </div>

          <div className="md:col-span-1 flex flex-col justify-end gap-3 border-l pl-6">
            <span className="text-xs text-muted-foreground text-center">指令及沟通面板</span>
            <Button
              variant="default"
              className="w-full bg-indigo-600 hover:bg-indigo-700"
              onClick={() => navigate(`/chat/${employee.agentId}`)}
              disabled={employee.status === "stopped"}
            >
              <MessageSquare className="w-4 h-4 mr-2" />
              安全直连会话
            </Button>
            <Button
              variant="outline"
              className="w-full"
              disabled={employee.status === "stopped"}
            >
              <Play className="w-4 h-4 mr-2" />
              挂载新任务表
            </Button>
            <Button
              variant="ghost"
              className="w-full text-slate-500 hover:bg-slate-200"
              onClick={() => navigate(`/employees/${employee.agentId}`)}
            >
              <Settings className="w-4 h-4 mr-2" />
              参数微调
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

export function EmployeeDirectoryBody(props: {
  viewMode: ViewMode;
  employeesData: DirectoryEmployeeRow[];
  departments: Department[];
  insightByAgentId: Map<string, DirectoryEmployeeInsight>;
  agentFiles: Record<string, AgentFileWorkspace>;
  onEditProfile: (employee: DirectoryEmployeeRow) => void;
  onUpdateRole: (employee: DirectoryEmployeeRow) => void;
  onFireEmployee: (agentId: string) => void;
  onOpenFile: (agentId: string, fileName: string) => void;
  formatBytes: (bytes?: number) => string;
}) {
  const {
    viewMode,
    employeesData,
    departments,
    insightByAgentId,
    agentFiles,
    onEditProfile,
    onUpdateRole,
    onFireEmployee,
    onOpenFile,
    formatBytes,
  } = props;

  if (viewMode === "org") {
    return (
      <div className="w-full bg-slate-50/50 rounded-xl border border-slate-200 overflow-hidden">
        <OrgChart
          employees={employeesData}
          departments={departments}
          onAction={(action, employee) => {
            if (action === "editProfile") {
              const row = employeesData.find((item) => item.agentId === employee.agentId);
              if (row) {
                onEditProfile(row);
              }
              return;
            }
            if (action === "updateRole") {
              const row = employeesData.find((item) => item.agentId === employee.agentId);
              if (row) {
                onUpdateRole(row);
              }
              return;
            }
            if (action === "fire") {
              onFireEmployee(employee.agentId);
            }
          }}
        />
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 gap-6">
      {employeesData.map((employee) => (
        <EmployeeListCard
          key={employee.agentId}
          employee={employee}
          departments={departments}
          insight={insightByAgentId.get(employee.agentId)}
          files={agentFiles[employee.agentId]}
          onEditProfile={onEditProfile}
          onUpdateRole={onUpdateRole}
          onFireEmployee={onFireEmployee}
          onOpenFile={onOpenFile}
          formatBytes={formatBytes}
        />
      ))}
    </div>
  );
}

export function EmployeeFileEditorDialog(props: {
  editingFile: {
    agentId: string;
    name: string;
    content: string;
    loaded: boolean;
    saving: boolean;
  } | null;
  setEditingFile: React.Dispatch<
    React.SetStateAction<{
      agentId: string;
      name: string;
      content: string;
      loaded: boolean;
      saving: boolean;
    } | null>
  >;
  onSave: () => void;
}) {
  const { editingFile, setEditingFile, onSave } = props;
  if (!editingFile) {
    return null;
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-2xl flex flex-col overflow-hidden max-h-[90vh]">
        <div className="px-4 py-3 border-b flex items-center justify-between bg-slate-50">
          <div className="flex items-center gap-2">
            <FileText className="w-4 h-4 text-indigo-500" />
            <h3 className="font-semibold text-slate-800">{editingFile.name}</h3>
            <span className="text-xs text-slate-400 ml-2">({editingFile.agentId})</span>
          </div>
          <Button
            variant="ghost"
            size="sm"
            className="h-8 text-slate-500"
            onClick={() => setEditingFile(null)}
          >
            关闭
          </Button>
        </div>
        <div className="flex-1 p-0 overflow-hidden relative min-h-[400px]">
          {!editingFile.loaded ? (
            <div className="absolute inset-0 flex items-center justify-center bg-slate-50 text-slate-500 text-sm">
              读取文件中...
            </div>
          ) : (
            <textarea
              className="w-full h-full absolute inset-0 p-4 font-mono text-sm resize-none focus:outline-none bg-slate-950 text-slate-300"
              value={editingFile.content}
              onChange={(event) =>
                setEditingFile({ ...editingFile, content: event.target.value })
              }
              spellCheck={false}
            />
          )}
        </div>
        <div className="px-4 py-3 border-t flex items-center justify-between bg-slate-50">
          <span className="text-xs text-slate-500 font-mono">
            {editingFile.loaded ? `${editingFile.content.length} characters` : ""}
          </span>
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => setEditingFile(null)}>
              取消
            </Button>
            <Button disabled={!editingFile.loaded || editingFile.saving} onClick={onSave}>
              {editingFile.saving ? "保存中..." : "保存更改"}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}

export function EmployeeDirectoryDialogs(props: {
  hireDialogOpen: boolean;
  setHireDialogOpen: (open: boolean) => void;
  onHireEmployee: (config: HireConfig) => Promise<void>;
  hireSubmitting: boolean;
  updateProfileDialogOpen: boolean;
  setUpdateProfileDialogOpen: (open: boolean) => void;
  updateProfileEmployee: DirectoryEmployeeRow | null;
  updateProfileInitial: { nickname: string; role: string };
  profileSubmitting: boolean;
  onUpdateProfile: (values: Record<string, string>) => Promise<void>;
  updateRoleDialogOpen: boolean;
  setUpdateRoleDialogOpen: (open: boolean) => void;
  updateRoleInitial: UpdateRoleInitial;
  updateRoleSubmitting: boolean;
  onUpdateRoleSubmit: (values: Record<string, string>) => Promise<void>;
  fireEmployeeDialogOpen: boolean;
  setFireEmployeeDialogOpen: (open: boolean) => void;
  onFireEmployeeSubmit: () => Promise<void>;
  departmentsDialogOpen: boolean;
  setDepartmentsDialogOpen: (open: boolean) => void;
  departments: Department[];
  employees: DirectoryEmployeeRow[];
  departmentsSaving: boolean;
  onSaveDepartments: (nextDepartments: Department[]) => Promise<void>;
  hrPlanDialogOpen: boolean;
  setHrPlanDialogOpen: (open: boolean) => void;
  hrPlanDialogState: HrPlanDialogState;
  canApplyHrPlan: boolean;
  applyingHrPlan: boolean;
  onApplyHrPlan: () => Promise<void>;
}) {
  const {
    hireDialogOpen,
    setHireDialogOpen,
    onHireEmployee,
    hireSubmitting,
    updateProfileDialogOpen,
    setUpdateProfileDialogOpen,
    updateProfileEmployee,
    updateProfileInitial,
    profileSubmitting,
    onUpdateProfile,
    updateRoleDialogOpen,
    setUpdateRoleDialogOpen,
    updateRoleInitial,
    updateRoleSubmitting,
    onUpdateRoleSubmit,
    fireEmployeeDialogOpen,
    setFireEmployeeDialogOpen,
    onFireEmployeeSubmit,
    departmentsDialogOpen,
    setDepartmentsDialogOpen,
    departments,
    employees,
    departmentsSaving,
    onSaveDepartments,
    hrPlanDialogOpen,
    setHrPlanDialogOpen,
    hrPlanDialogState,
    canApplyHrPlan,
    applyingHrPlan,
    onApplyHrPlan,
  } = props;

  return (
    <>
      <ImmersiveHireDialog
        open={hireDialogOpen}
        onOpenChange={setHireDialogOpen}
        onSubmit={onHireEmployee}
        busy={hireSubmitting}
      />

      <ActionFormDialog
        open={updateProfileDialogOpen}
        onOpenChange={setUpdateProfileDialogOpen}
        title="编辑员工基本资料"
        description={
          updateProfileEmployee?.isMeta
            ? "修改花名和头衔；可选同步更新 Identity Name（Gateway 名称）。注意：meta 节点修改 Identity Name 可能影响系统自动识别。"
            : "修改花名和头衔；默认会把花名同步到 Identity Name（Gateway 名称），让会话/列表显示保持一致。"
        }
        confirmLabel="保存更新"
        busy={profileSubmitting}
        fields={[
          {
            name: "nickname",
            label: "展示花名",
            defaultValue: updateProfileInitial.nickname,
          },
          {
            name: "role",
            label: "展示头衔",
            defaultValue: updateProfileInitial.role,
          },
          {
            name: "syncIdentityName",
            label: "同步更新 Identity Name（Gateway 名称）",
            type: "checkbox",
            defaultValue: updateProfileEmployee?.isMeta ? "false" : "true",
          },
        ]}
        onSubmit={onUpdateProfile}
      />

      <ActionFormDialog
        open={updateRoleDialogOpen}
        onOpenChange={setUpdateRoleDialogOpen}
        title="调整计算节点职务"
        description="系统将联系 HR 下发结构变动与系统提示词修改命令。"
        confirmLabel="确认调岗"
        busy={updateRoleSubmitting}
        fields={[
          {
            name: "role",
            label: "岗位名称",
            defaultValue: updateRoleInitial?.role || "",
            required: true,
            placeholder: "例如：高级架构师",
          },
          {
            name: "description",
            label: "岗位补充说明",
            defaultValue: updateRoleInitial?.description || "",
            required: true,
            multiline: true,
            placeholder: "输入新的职责描述",
          },
        ]}
        onSubmit={onUpdateRoleSubmit}
      />

      <ActionFormDialog
        open={fireEmployeeDialogOpen}
        onOpenChange={setFireEmployeeDialogOpen}
        title="确认解约"
        description="此操作将从公司图谱中彻底除名该数字生物，且无法恢复参数。"
        confirmLabel="确认解约"
        fields={[]}
        onSubmit={onFireEmployeeSubmit}
      />

      <DepartmentManagerDialog
        open={departmentsDialogOpen}
        onOpenChange={setDepartmentsDialogOpen}
        departments={departments}
        employees={employees}
        busy={departmentsSaving}
        onSubmit={onSaveDepartments}
      />

      <HrDepartmentPlanDialog
        open={hrPlanDialogOpen}
        onOpenChange={setHrPlanDialogOpen}
        state={hrPlanDialogState}
        canApply={canApplyHrPlan}
        busy={applyingHrPlan}
        onApply={onApplyHrPlan}
      />
    </>
  );
}
