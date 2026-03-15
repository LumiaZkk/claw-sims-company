import { useEffect, useMemo, useState } from "react";
import { Server, Settings2 } from "lucide-react";
import type { GatewaySettingsQueryResult } from "../../../application/gateway/settings";
import { buildCollaborationContextSnapshot } from "../../../application/company/collaboration-context";
import { buildCompanyHeartbeatSurface } from "../../../application/org";
import { buildWorkspacePolicySummary } from "../../../application/workspace/workspace-policy";
import { buildDefaultOrgSettings } from "../../../domain/org/autonomy-policy";
import type { CompanyEvent } from "../../../domain/delegation/events";
import type {
  CollaborationEdge,
  CompanyCollaborationPolicy,
} from "../../../domain/org/types";
import { Badge } from "../../../ui/badge";
import { Button } from "../../../ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "../../../ui/card";
import { formatTime } from "../../../lib/utils";
import { HeartbeatAuditList } from "../../../shared/presentation/HeartbeatAuditList";
import { CollaborationPolicyToggle } from "./CollaborationPolicyToggle";
import {
  createCollaborationEdgeDraft,
  describeCollaborationEdge,
  formatDepartmentLabel,
  formatEmployeeLabel,
  formatUsd,
  isSameEdge,
  type EndpointKind,
  type RunCommand,
} from "./settings-helpers";

export function SettingsGatewayCompanySection(props: {
  token: string | null;
  connected: boolean;
  companyConfig: {
    companies: Array<{ id: string; icon?: string; name: string }>;
    activeCompanyId?: string | null;
  } | null;
  activeCompany: GatewaySettingsQueryResult["activeCompany"];
  companyEvents: CompanyEvent[];
  loading: boolean;
  companyCount: number;
  orgAutopilotEnabled: boolean;
  orgAutopilotSaving: boolean;
  autonomyPolicySaving: boolean;
  heartbeatPolicySaving: boolean;
  collaborationPolicySaving: boolean;
  workspacePolicySaving: boolean;
  switchCompany: (id: string) => void;
  loadConfig: () => Promise<unknown>;
  reconnectGateway: () => void;
  disconnectGateway: () => void;
  handleToggleOrgAutopilot: () => Promise<{ title: string; description: string } | null>;
  handleUpdateCollaborationPolicy: (
    collaborationPolicy: CompanyCollaborationPolicy,
  ) => Promise<{ title: string; description: string } | null>;
  setAutomationBudgetDialogOpen: (open: boolean) => void;
  setHeartbeatDialogOpen: (open: boolean) => void;
  setWorkspacePolicyDialogOpen: (open: boolean) => void;
  runCommand: RunCommand;
}) {
  const {
    token,
    connected,
    companyConfig,
    activeCompany,
    companyEvents,
    loading,
    companyCount,
    orgAutopilotEnabled,
    orgAutopilotSaving,
    autonomyPolicySaving,
    heartbeatPolicySaving,
    collaborationPolicySaving,
    workspacePolicySaving,
    switchCompany,
    loadConfig,
    reconnectGateway,
    disconnectGateway,
    handleToggleOrgAutopilot,
    handleUpdateCollaborationPolicy,
    setAutomationBudgetDialogOpen,
    setHeartbeatDialogOpen,
    setWorkspacePolicyDialogOpen,
    runCommand,
  } = props;

  const orgSettings = activeCompany ? buildDefaultOrgSettings(activeCompany.orgSettings) : null;
  const autonomyPolicy = orgSettings?.autonomyPolicy ?? null;
  const heartbeatPolicy = orgSettings?.heartbeatPolicy ?? null;
  const collaborationPolicy = orgSettings?.collaborationPolicy ?? null;
  const workspacePolicy = orgSettings?.workspacePolicy ?? null;
  const heartbeatSurface = activeCompany
    ? buildCompanyHeartbeatSurface({ company: activeCompany, events: companyEvents })
    : null;
  const workspacePolicySummary = useMemo(
    () =>
      workspacePolicy
        ? buildWorkspacePolicySummary({
            deliverySource: workspacePolicy.deliverySource ?? "artifact_store",
            providerMirrorMode: workspacePolicy.providerMirrorMode ?? "fallback",
            executorWriteTarget: workspacePolicy.executorWriteTarget ?? "agent_workspace",
          })
        : null,
    [workspacePolicy],
  );
  const employeeOptions = useMemo(
    () =>
      (activeCompany?.employees ?? [])
        .slice()
        .sort((left, right) => left.nickname.localeCompare(right.nickname, "zh-CN")),
    [activeCompany],
  );
  const departmentOptions = useMemo(
    () =>
      (activeCompany?.departments ?? [])
        .filter((department) => !department.archived)
        .slice()
        .sort((left, right) => (left.order ?? 0) - (right.order ?? 0)),
    [activeCompany],
  );
  const employeesById = useMemo(
    () => new Map(employeeOptions.map((employee) => [employee.agentId, employee] as const)),
    [employeeOptions],
  );
  const departmentsById = useMemo(
    () => new Map(departmentOptions.map((department) => [department.id, department] as const)),
    [departmentOptions],
  );
  const [previewAgentId, setPreviewAgentId] = useState("");
  const [edgeFromKind, setEdgeFromKind] = useState<EndpointKind>("department");
  const [edgeFromId, setEdgeFromId] = useState("");
  const [edgeToKind, setEdgeToKind] = useState<EndpointKind>("department");
  const [edgeToId, setEdgeToId] = useState("");

  useEffect(() => {
    if (!employeeOptions.some((employee) => employee.agentId === previewAgentId)) {
      setPreviewAgentId(employeeOptions[0]?.agentId ?? "");
    }
  }, [employeeOptions, previewAgentId]);

  useEffect(() => {
    const options = edgeFromKind === "agent" ? employeeOptions : departmentOptions;
    const optionIds = new Set(
      options.map((option) => ("agentId" in option ? option.agentId : option.id)),
    );
    if (!optionIds.has(edgeFromId)) {
      setEdgeFromId(
        edgeFromKind === "agent"
          ? employeeOptions[0]?.agentId ?? ""
          : departmentOptions[0]?.id ?? "",
      );
    }
  }, [departmentOptions, edgeFromId, edgeFromKind, employeeOptions]);

  useEffect(() => {
    const options = edgeToKind === "agent" ? employeeOptions : departmentOptions;
    const optionIds = new Set(
      options.map((option) => ("agentId" in option ? option.agentId : option.id)),
    );
    if (!optionIds.has(edgeToId)) {
      setEdgeToId(
        edgeToKind === "agent"
          ? employeeOptions[0]?.agentId ?? ""
          : departmentOptions[0]?.id ?? "",
      );
    }
  }, [departmentOptions, edgeToId, edgeToKind, employeeOptions]);

  const previewScope = useMemo(() => {
    if (!activeCompany || !previewAgentId || !employeesById.has(previewAgentId)) {
      return null;
    }
    return buildCollaborationContextSnapshot({
      company: activeCompany,
      agentId: previewAgentId,
    });
  }, [activeCompany, previewAgentId]);

  const updatePolicy = (nextPolicy: CompanyCollaborationPolicy) =>
    runCommand(
      () => handleUpdateCollaborationPolicy(nextPolicy),
      "协作策略更新失败",
    );
  const automationBudgetUsd =
    typeof autonomyPolicy?.automationMonthlyBudgetUsd === "number" &&
    Number.isFinite(autonomyPolicy.automationMonthlyBudgetUsd) &&
    autonomyPolicy.automationMonthlyBudgetUsd > 0
      ? autonomyPolicy.automationMonthlyBudgetUsd
      : null;

  const explicitEdges = collaborationPolicy?.explicitEdges ?? [];

  const addExplicitEdge = async () => {
    if (!collaborationPolicy || !edgeFromId || !edgeToId) {
      return null;
    }
    const nextEdge = createCollaborationEdgeDraft(edgeFromKind, edgeFromId, edgeToKind, edgeToId);
    if (explicitEdges.some((edge) => isSameEdge(edge, nextEdge))) {
      return {
        title: "协作边未变化",
        description: "这条显式协作边已经存在。",
      };
    }
    return updatePolicy({
      ...collaborationPolicy,
      explicitEdges: [...explicitEdges, nextEdge],
    });
  };

  const removeExplicitEdge = async (edge: CollaborationEdge) => {
    if (!collaborationPolicy) {
      return null;
    }
    return updatePolicy({
      ...collaborationPolicy,
      explicitEdges: explicitEdges.filter((current) => !isSameEdge(current, edge)),
    });
  };

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
      <Card className="shadow-sm">
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-lg">
            <Server className="w-5 h-5 text-slate-500" />
            系统核心网关
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="text-sm bg-slate-50 p-3 rounded-lg border">
            <div className="text-slate-500 mb-1 text-xs font-bold tracking-wider">
              服务器通信端点
            </div>
            <div className="font-mono text-slate-400">****** (内部路由已屏蔽)</div>
            <div className="mt-2 text-slate-500 mb-1 text-xs font-bold tracking-wider">
              网关安全凭证
            </div>
            <div>{token ? "******** (签名已准入)" : "未挂载鉴权"}</div>
          </div>
          <div className="flex gap-2">
            <Button
              variant="outline"
              className="w-full"
              onClick={() => reconnectGateway()}
              disabled={loading || connected}
            >
              重连
            </Button>
            <Button
              variant="outline"
              className="w-full text-red-600 hover:text-red-700 hover:bg-red-50"
              onClick={() => disconnectGateway()}
              disabled={loading || !connected}
            >
              断开
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card className="shadow-sm">
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-lg">
            <Settings2 className="w-5 h-5 text-slate-500" />
            业务线运营实体
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="text-sm text-slate-600 bg-slate-50 p-3 rounded-lg border">
            当前挂载了 <strong>{companyCount}</strong> 家注册公司。
            <br />
            运营视口聚焦于：
            <strong className="text-indigo-600">{activeCompany?.name ?? "无"}</strong>
          </div>
          <div className="grid grid-cols-1 gap-2 max-h-32 overflow-y-auto pr-2">
            {companyConfig?.companies.map((company) => (
              <button
                key={company.id}
                className={`flex items-center justify-between rounded-lg border px-3 py-2 text-left text-sm ${company.id === companyConfig.activeCompanyId ? "border-indigo-500 bg-indigo-50/50 ring-1 ring-indigo-500" : "hover:bg-slate-50"}`}
                onClick={() => switchCompany(company.id)}
              >
                <span className="font-medium">
                  {company.icon} {company.name}
                </span>
                {company.id === companyConfig.activeCompanyId && (
                  <Badge className="scale-75 bg-indigo-500 text-white">Active</Badge>
                )}
              </button>
            ))}
          </div>
          <Button
            variant="outline"
            className="w-full"
            onClick={() => void loadConfig()}
            disabled={loading}
          >
            拉取注册表并校准当前参数
          </Button>
          {activeCompany && (
            <div className="rounded-xl border border-amber-200 bg-amber-50/60 p-4">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <div className="text-sm font-semibold text-slate-900">组织自校准</div>
                  <div className="mt-1 text-xs leading-5 text-slate-600">
                    开启后，系统会自动识别小团队直管、大团队设负责人的组织问题，并直接重整汇报链。
                  </div>
                  {activeCompany.orgSettings?.lastAutoCalibratedAt && (
                    <div className="mt-2 text-[11px] leading-5 text-slate-500">
                      最近一次自动校准：
                      {formatTime(activeCompany.orgSettings.lastAutoCalibratedAt)}
                      {activeCompany.orgSettings.lastAutoCalibrationActions?.length
                        ? ` · ${activeCompany.orgSettings.lastAutoCalibrationActions.join(" · ")}`
                        : ""}
                    </div>
                  )}
                </div>
                <div className="flex items-center gap-2">
                  <Badge
                    variant="outline"
                    className={
                      orgAutopilotEnabled
                        ? "border-emerald-200 bg-emerald-50 text-emerald-700"
                        : "border-slate-200 bg-white text-slate-500"
                    }
                  >
                    {orgAutopilotEnabled ? "已开启" : "已关闭"}
                  </Badge>
                  <Button
                    variant={orgAutopilotEnabled ? "outline" : "default"}
                    onClick={() =>
                      void runCommand(handleToggleOrgAutopilot, "组织自校准更新失败")
                    }
                    disabled={orgAutopilotSaving}
                  >
                    {orgAutopilotSaving
                      ? "保存中..."
                      : orgAutopilotEnabled
                        ? "关闭自动调整"
                        : "开启自动调整"}
                  </Button>
                </div>
              </div>
            </div>
          )}
          {activeCompany && autonomyPolicy && (
            <div className="rounded-xl border border-rose-200 bg-rose-50/40 p-4">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <div className="text-sm font-semibold text-slate-900">自动化预算护栏</div>
                  <div className="mt-1 text-xs leading-5 text-slate-600">
                    为近 30 天 usage 成本设置软上限。超过阈值后，新的自动化启用会自动升级为人工审批。
                  </div>
                  <div className="mt-2 text-[11px] leading-5 text-slate-500">
                    当前策略：
                    {automationBudgetUsd
                      ? ` 近 30 天预算上限 ${formatUsd(automationBudgetUsd)}`
                      : " 未配置预算上限，仅保留已有审批策略"}
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <Badge
                    variant="outline"
                    className={
                      automationBudgetUsd
                        ? "border-rose-200 bg-white text-rose-700"
                        : "border-slate-200 bg-white text-slate-500"
                    }
                  >
                    {automationBudgetUsd ? "软预算已启用" : "未配置预算"}
                  </Badge>
                  <Button
                    variant="outline"
                    onClick={() => setAutomationBudgetDialogOpen(true)}
                    disabled={autonomyPolicySaving}
                  >
                    {autonomyPolicySaving ? "保存中..." : "调整预算护栏"}
                  </Button>
                </div>
              </div>
            </div>
          )}
          {activeCompany && heartbeatPolicy && heartbeatSurface && (
            <div className="rounded-xl border border-sky-200 bg-sky-50/40 p-4">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <div className="text-sm font-semibold text-slate-900">CEO heartbeat</div>
                  <div className="mt-1 text-xs leading-5 text-slate-600">
                    业务 heartbeat 由 Cyber Company 自身系统保存和解释。OpenClaw 只做执行/唤醒层，不再维护第二套业务配置。
                  </div>
                  <div className="mt-2 text-[11px] leading-5 text-slate-500">
                    当前策略：
                    {!heartbeatPolicy.enabled
                      ? " 已关闭后台巡检"
                      : heartbeatPolicy.paused
                        ? ` 已暂停，恢复后按 ${heartbeatPolicy.intervalMinutes ?? 5} 分钟周期继续`
                        : ` 每 ${heartbeatPolicy.intervalMinutes ?? 5} 分钟巡检一次`}
                  </div>
                  <div className="mt-1 text-[11px] leading-5 text-slate-500">
                    最近巡检 {formatTime(heartbeatSurface.lastRunAt)} · 下一轮 {formatTime(heartbeatSurface.nextRunAt)}
                  </div>
                  <div className="mt-1 text-[11px] leading-5 text-slate-500">
                    最近检查 {formatTime(heartbeatSurface.lastCheckAt)} · 权威源 {heartbeatSurface.sourceOfTruth}
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <Badge
                    variant="outline"
                    className={
                      !heartbeatPolicy.enabled
                        ? "border-slate-200 bg-white text-slate-500"
                        : heartbeatPolicy.paused
                          ? "border-amber-200 bg-white text-amber-700"
                          : "border-sky-200 bg-white text-sky-700"
                    }
                  >
                    {!heartbeatPolicy.enabled ? "已关闭" : heartbeatPolicy.paused ? "已暂停" : "系统托管"}
                  </Badge>
                  <Button
                    variant="outline"
                    onClick={() => setHeartbeatDialogOpen(true)}
                    disabled={heartbeatPolicySaving}
                  >
                    {heartbeatPolicySaving ? "保存中..." : "调整 heartbeat"}
                  </Button>
                </div>
              </div>
              <HeartbeatAuditList
                entries={heartbeatSurface.recentAudit}
                className="mt-3 rounded-xl border border-sky-200/80 bg-white/80 p-3"
              />
            </div>
          )}
          {activeCompany && workspacePolicy && workspacePolicySummary && (
            <div className="rounded-xl border border-violet-200 bg-violet-50/40 p-4">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <div className="text-sm font-semibold text-slate-900">工作目录边界</div>
                  <div className="mt-1 text-xs leading-5 text-slate-600">
                    固定“正式交付看哪里、执行器镜像是否补位、执行结果先落哪里”的公司级工作目录策略。
                  </div>
                  <div className="mt-2 flex flex-wrap gap-2 text-[11px] leading-5 text-slate-500">
                    <Badge variant="secondary">{workspacePolicySummary.deliveryLabel}</Badge>
                    <Badge variant="outline">{workspacePolicySummary.mirrorLabel}</Badge>
                    <Badge variant="outline">{workspacePolicySummary.executionLabel}</Badge>
                  </div>
                  <div className="mt-2 text-[11px] leading-5 text-slate-500">
                    {workspacePolicySummary.deliveryDescription}
                  </div>
                  <div className="mt-1 text-[11px] leading-5 text-slate-500">
                    {workspacePolicySummary.mirrorDescription}
                  </div>
                  <div className="mt-1 text-[11px] leading-5 text-slate-500">
                    {workspacePolicySummary.executionDescription}
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <Badge
                    variant="outline"
                    className={
                      workspacePolicySummary.mirrorEnabled
                        ? "border-violet-200 bg-white text-violet-700"
                        : "border-slate-200 bg-white text-slate-500"
                    }
                  >
                    {workspacePolicySummary.mirrorEnabled ? "镜像补位开启" : "镜像补位关闭"}
                  </Badge>
                  <Button
                    variant="outline"
                    onClick={() => setWorkspacePolicyDialogOpen(true)}
                    disabled={workspacePolicySaving}
                  >
                    {workspacePolicySaving ? "保存中..." : "调整工作目录边界"}
                  </Button>
                </div>
              </div>
            </div>
          )}
          {activeCompany && collaborationPolicy && (
            <div className="rounded-xl border border-sky-200 bg-sky-50/40 p-4 space-y-4">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <div className="text-sm font-semibold text-slate-900">协作策略</div>
                  <div className="mt-1 text-xs leading-5 text-slate-600">
                    维护谁可以正式使用 <span className="font-mono">company_dispatch</span> 协作，以及默认汇报链与显式跨部门边。
                  </div>
                </div>
                <Badge
                  variant="outline"
                  className={
                    collaborationPolicySaving
                      ? "border-amber-200 bg-amber-50 text-amber-700"
                      : "border-sky-200 bg-white text-sky-700"
                  }
                >
                  {collaborationPolicySaving ? "保存中" : "中心规则"}
                </Badge>
              </div>

              <div className="grid grid-cols-1 gap-2">
                <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">
                  默认规则
                </div>
                <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                  <CollaborationPolicyToggle
                    label="CEO / HR 全局协作"
                    active={collaborationPolicy.globalDispatchMetaRoles?.includes("ceo") ?? false}
                    disabled={collaborationPolicySaving}
                    onToggle={(next) =>
                      void updatePolicy({
                        ...collaborationPolicy,
                        globalDispatchMetaRoles: next ? ["ceo", "hr"] : [],
                      })
                    }
                  />
                  <CollaborationPolicyToggle
                    label="负责人可派本部门成员"
                    active={collaborationPolicy.allowDepartmentLeadToDispatchWithinDepartment ?? false}
                    disabled={collaborationPolicySaving}
                    onToggle={(next) =>
                      void updatePolicy({
                        ...collaborationPolicy,
                        allowDepartmentLeadToDispatchWithinDepartment: next,
                      })
                    }
                  />
                  <CollaborationPolicyToggle
                    label="负责人可联系支持负责人"
                    active={collaborationPolicy.allowDepartmentLeadToDispatchToSupportLeads ?? false}
                    disabled={collaborationPolicySaving}
                    onToggle={(next) =>
                      void updatePolicy({
                        ...collaborationPolicy,
                        allowDepartmentLeadToDispatchToSupportLeads: next,
                      })
                    }
                  />
                  <CollaborationPolicyToggle
                    label="负责人可直接联系 CEO"
                    active={collaborationPolicy.allowDepartmentLeadToDispatchToCeo ?? false}
                    disabled={collaborationPolicySaving}
                    onToggle={(next) =>
                      void updatePolicy({
                        ...collaborationPolicy,
                        allowDepartmentLeadToDispatchToCeo: next,
                      })
                    }
                  />
                  <CollaborationPolicyToggle
                    label="员工可派同部门同事"
                    active={collaborationPolicy.allowDepartmentMembersWithinDepartment ?? false}
                    disabled={collaborationPolicySaving}
                    onToggle={(next) =>
                      void updatePolicy({
                        ...collaborationPolicy,
                        allowDepartmentMembersWithinDepartment: next,
                      })
                    }
                  />
                  <CollaborationPolicyToggle
                    label="员工可向直属经理派单"
                    active={collaborationPolicy.allowDepartmentMembersToManager ?? false}
                    disabled={collaborationPolicySaving}
                    onToggle={(next) =>
                      void updatePolicy({
                        ...collaborationPolicy,
                        allowDepartmentMembersToManager: next,
                      })
                    }
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 gap-3">
                <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">
                  显式协作边
                </div>
                <div className="grid grid-cols-1 gap-2 md:grid-cols-[auto,1fr,auto,1fr,auto]">
                  <select
                    value={edgeFromKind}
                    onChange={(event) => setEdgeFromKind(event.target.value as EndpointKind)}
                    className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm"
                  >
                    <option value="department">来源部门</option>
                    <option value="agent">来源员工</option>
                  </select>
                  <select
                    value={edgeFromId}
                    onChange={(event) => setEdgeFromId(event.target.value)}
                    className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm"
                  >
                    {(edgeFromKind === "agent" ? employeeOptions : departmentOptions).map((option) => (
                      <option
                        key={"agentId" in option ? option.agentId : option.id}
                        value={"agentId" in option ? option.agentId : option.id}
                      >
                        {"agentId" in option
                          ? formatEmployeeLabel(option)
                          : formatDepartmentLabel(option, employeesById)}
                      </option>
                    ))}
                  </select>
                  <div className="flex items-center justify-center text-xs font-semibold text-slate-500">
                    可以正式协作给
                  </div>
                  <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                    <select
                      value={edgeToKind}
                      onChange={(event) => setEdgeToKind(event.target.value as EndpointKind)}
                      className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm"
                    >
                      <option value="department">目标部门</option>
                      <option value="agent">目标员工</option>
                    </select>
                    <select
                      value={edgeToId}
                      onChange={(event) => setEdgeToId(event.target.value)}
                      className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm"
                    >
                      {(edgeToKind === "agent" ? employeeOptions : departmentOptions).map((option) => (
                        <option
                          key={"agentId" in option ? option.agentId : option.id}
                          value={"agentId" in option ? option.agentId : option.id}
                        >
                          {"agentId" in option
                            ? formatEmployeeLabel(option)
                            : formatDepartmentLabel(option, employeesById)}
                        </option>
                      ))}
                    </select>
                  </div>
                  <Button
                    variant="outline"
                    onClick={() => void addExplicitEdge()}
                    disabled={collaborationPolicySaving || !edgeFromId || !edgeToId}
                  >
                    添加
                  </Button>
                </div>
                <div className="space-y-2">
                  {explicitEdges.length === 0 ? (
                    <div className="rounded-lg border border-dashed border-slate-200 bg-white px-3 py-4 text-sm text-slate-500">
                      当前没有显式跨默认规则的协作边。新员工会先按默认部门规则自动获得通信范围。
                    </div>
                  ) : (
                    explicitEdges.map((edge, index) => (
                      <div
                        key={`${edge.fromAgentId ?? edge.fromDepartmentId ?? "?"}:${edge.toAgentId ?? edge.toDepartmentId ?? "?"}:${index}`}
                        className="flex items-center justify-between gap-3 rounded-lg border border-slate-200 bg-white px-3 py-2"
                      >
                        <div className="text-sm text-slate-700">
                          {describeCollaborationEdge(edge, employeesById, departmentsById)}
                        </div>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="text-red-600 hover:bg-red-50 hover:text-red-700"
                          onClick={() => void removeExplicitEdge(edge)}
                          disabled={collaborationPolicySaving}
                        >
                          删除
                        </Button>
                      </div>
                    ))
                  )}
                </div>
              </div>

              <div className="grid grid-cols-1 gap-3 rounded-xl border border-slate-200 bg-white p-3">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <div className="text-sm font-semibold text-slate-900">作用域预览</div>
                    <div className="mt-1 text-xs text-slate-500">
                      选择任意员工，查看当前协作策略实际展开后的可派单对象和汇报链。
                    </div>
                  </div>
                  <select
                    value={previewAgentId}
                    onChange={(event) => setPreviewAgentId(event.target.value)}
                    className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm"
                  >
                    {employeeOptions.map((employee) => (
                      <option key={employee.agentId} value={employee.agentId}>
                        {formatEmployeeLabel(employee)}
                      </option>
                    ))}
                  </select>
                </div>
                {previewScope && (
                  <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                    <div className="rounded-lg border border-slate-200 bg-slate-50/60 p-3">
                      <div className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
                        Allowed Dispatch Targets
                      </div>
                      <div className="mt-2 space-y-1 text-sm text-slate-700">
                        {previewScope.allowedDispatchTargets.map((target) => (
                          <div key={target.agentId}>
                            {target.nickname} · {target.reason}
                          </div>
                        ))}
                      </div>
                    </div>
                    <div className="rounded-lg border border-slate-200 bg-slate-50/60 p-3">
                      <div className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
                        Default Report Chain
                      </div>
                      <div className="mt-2 space-y-1 text-sm text-slate-700">
                        {previewScope.defaultReportChain.length === 0 ? (
                          <div>当前没有上级链路</div>
                        ) : (
                          previewScope.defaultReportChain.map((actor) => (
                            <div key={actor.agentId}>{actor.nickname}</div>
                          ))
                        )}
                      </div>
                    </div>
                    <div className="rounded-lg border border-slate-200 bg-slate-50/60 p-3">
                      <div className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
                        Support Targets
                      </div>
                      <div className="mt-2 space-y-1 text-sm text-slate-700">
                        {previewScope.supportTargets.map((target) => (
                          <div key={target.agentId}>{target.nickname}</div>
                        ))}
                      </div>
                    </div>
                    <div className="rounded-lg border border-slate-200 bg-slate-50/60 p-3">
                      <div className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
                        Escalation Targets
                      </div>
                      <div className="mt-2 space-y-1 text-sm text-slate-700">
                        {previewScope.escalationTargets.map((target) => (
                          <div key={target.agentId}>{target.nickname}</div>
                        ))}
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
