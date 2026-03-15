import { AlertTriangle, Wrench } from "lucide-react";
import {
  buildCapabilityAuditTimeline,
  buildCapabilityIssueBoard,
  buildCapabilityPlatformCloseoutSummary,
  buildCapabilityRequestBoard,
  buildCapabilityVerificationQueue,
  buildSkillReleaseReadiness,
  CAPABILITY_AUDIT_ACTION_LABEL,
  CAPABILITY_ISSUE_ACTION_LABEL,
  CAPABILITY_REQUEST_ACTION_LABEL,
  NEXT_CAPABILITY_ISSUE_STATUS,
  NEXT_CAPABILITY_REQUEST_STATUS,
  resolveWorkspaceAppTemplate,
  WORKBENCH_TOOL_CARDS,
  type WorkspaceWorkbenchTool,
} from "../../../application/workspace";
import { formatTime } from "../../../lib/utils";
import { Badge } from "../../../ui/badge";
import { Button } from "../../../ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "../../../ui/card";
import { WorkspaceCloseoutStatusCard } from "./WorkspaceCloseoutStatusCard";
import {
  CapabilityBoardLaneSection,
  CapabilityBoardSummary,
  CapabilityVerificationQueueSection,
} from "./workspace-workbench-sections";
import {
  artifactResourceTypeLabel,
  type WorkspacePageContentProps,
} from "./workspace-page-types";
import {
  CAPABILITY_RUN_TRIGGER_LABEL,
  SKILL_STATUS_LABEL,
} from "./workspace-page-helpers";

export function WorkspaceWorkbench({
  ctoLabel,
  businessLeadLabel,
  workflowCapabilityBindingCatalog,
  workflowCapabilityBindingsAreExplicit,
  skillDefinitions,
  skillRuns,
  workspaceApps,
  workspaceFiles,
  executorProvisioning,
  capabilityAuditEvents,
  manifestRegistrationCandidateCount,
  capabilityRequests,
  capabilityIssues,
  onSelectApp,
  onOpenCtoWorkbench,
  onPublishTemplateApp,
  onRegisterExistingApp,
  onCreateSkillDraft,
  onGenerateAppManifestDraft,
  onCreateCapabilityRequest,
  onCreateCapabilityIssue,
  onRetryCompanyProvisioning,
  onUpdateSkillStatus,
  onRunSkillSmokeTest,
  onPublishWorkflowCapabilityBindings,
  onRestoreWorkflowCapabilityBindings,
  onToggleWorkflowCapabilityBindingRequired,
  onUpdateCapabilityRequestStatus,
  onUpdateCapabilityIssueStatus,
  publishedAppTemplates,
}: Pick<
  WorkspacePageContentProps,
  | "ctoLabel"
  | "businessLeadLabel"
  | "workflowCapabilityBindingCatalog"
  | "workflowCapabilityBindingsAreExplicit"
  | "skillDefinitions"
  | "skillRuns"
  | "workspaceApps"
  | "workspaceFiles"
  | "executorProvisioning"
  | "capabilityAuditEvents"
  | "manifestRegistrationCandidateCount"
  | "capabilityRequests"
  | "capabilityIssues"
  | "onSelectApp"
  | "onOpenCtoWorkbench"
  | "onPublishTemplateApp"
  | "onRegisterExistingApp"
  | "onCreateSkillDraft"
  | "onGenerateAppManifestDraft"
  | "onCreateCapabilityRequest"
  | "onCreateCapabilityIssue"
  | "onRetryCompanyProvisioning"
  | "onUpdateSkillStatus"
  | "onRunSkillSmokeTest"
  | "onPublishWorkflowCapabilityBindings"
  | "onRestoreWorkflowCapabilityBindings"
  | "onToggleWorkflowCapabilityBindingRequired"
  | "onUpdateCapabilityRequestStatus"
  | "onUpdateCapabilityIssueStatus"
  | "publishedAppTemplates"
>) {
  const publishableTemplateByCard: Partial<
    Record<WorkspaceWorkbenchTool, "reader" | "consistency" | "review-console">
  > = {
    "novel-reader": "reader",
    "consistency-checker": "consistency",
    "chapter-review-console": "review-console",
  };
  const nextSkillStatusByCurrent = {
    draft: "ready",
    ready: "degraded",
    degraded: "ready",
    retired: "draft",
  } as const;
  const skillStatusActionLabel = {
    draft: "发布为可用",
    ready: "标记降级",
    degraded: "恢复可用",
    retired: "恢复草稿",
  } as const;
  const skillRunStatusLabel = {
    pending: "排队中",
    running: "运行中",
    succeeded: "已成功",
    failed: "已失败",
    cancelled: "已取消",
  } as const;
  const skillRunExecutionModeLabel = {
    builtin_bridge: "平台桥接",
    workspace_script: "工作区脚本",
  } as const;
  const recentSkillRuns = [...skillRuns].sort((left, right) => right.updatedAt - left.updatedAt).slice(0, 6);
  const skillLabelById = new Map(skillDefinitions.map((skill) => [skill.id, skill.title]));
  const appLabelById = new Map(workspaceApps.map((app) => [app.id, app.title]));
  const workspaceFileByArtifactId = new Map(
    workspaceFiles.filter((file) => file.artifactId).map((file) => [file.artifactId!, file]),
  );
  const capabilityRequestBoard = buildCapabilityRequestBoard(capabilityRequests, {
    appLabelById,
    skillLabelById,
  });
  const capabilityIssueBoard = buildCapabilityIssueBoard(capabilityIssues, {
    appLabelById,
    skillLabelById,
  });
  const verificationQueue = buildCapabilityVerificationQueue(capabilityRequests, capabilityIssues, {
    appLabelById,
    skillLabelById,
  });
  const capabilityAuditTimeline = buildCapabilityAuditTimeline(capabilityAuditEvents, {
    appLabelById,
    skillLabelById,
  });
  const closeoutSummary = buildCapabilityPlatformCloseoutSummary({
    workspaceApps,
    workspaceFiles,
    skillDefinitions,
    skillRuns,
    capabilityRequests,
    capabilityIssues,
    capabilityAuditEvents,
    executorProvisioning,
  });
  const firstAppWithoutManifest = workspaceApps.find((app) => !app.manifestArtifactId) ?? null;
  const firstSkillNeedingValidation =
    skillDefinitions.find(
      (skill) =>
        !buildSkillReleaseReadiness({
          skill,
          skillRuns,
          workspaceApps,
        }).latestSuccessfulSmokeTestRun,
    ) ?? null;
  const preferredDraftTool: WorkspaceWorkbenchTool = workspaceApps.some(
    (app) => resolveWorkspaceAppTemplate(app) === "consistency",
  )
    ? "consistency-checker"
    : workspaceApps.some((app) => resolveWorkspaceAppTemplate(app) === "reader")
      ? "novel-reader"
      : "chapter-review-console";

  return (
    <div className="space-y-5">
      <CapabilityVerificationQueueSection
        queue={verificationQueue}
        onSelectApp={onSelectApp}
        onUpdateCapabilityRequestStatus={onUpdateCapabilityRequestStatus}
        onUpdateCapabilityIssueStatus={onUpdateCapabilityIssueStatus}
      />

      <div className="grid gap-5 lg:grid-cols-3">
        {WORKBENCH_TOOL_CARDS.map((card) => {
          const publishableTemplate = publishableTemplateByCard[card.id];
          const isPublished = publishableTemplate ? publishedAppTemplates.includes(publishableTemplate) : false;

          return (
            <Card key={card.id} className="border-slate-200/80 shadow-sm">
              <CardHeader className="space-y-3">
                <div className="flex items-center justify-between">
                  <Badge variant="secondary">公司专属工具</Badge>
                  <Wrench className="h-4 w-4 text-slate-400" />
                </div>
                <div>
                  <CardTitle className="text-base">{card.title}</CardTitle>
                  <CardDescription className="mt-2 leading-6">{card.summary}</CardDescription>
                </div>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm leading-6 text-slate-700">
                  这条线会先由 {businessLeadLabel ?? "业务负责人"} 提需求，再交给 {ctoLabel ?? "CTO"} 做成工具能力、App
                  或资源契约。
                </div>
                {publishableTemplate ? (
                  <Button
                    type="button"
                    variant="outline"
                    className="w-full"
                    disabled={isPublished}
                    onClick={() => void onPublishTemplateApp(publishableTemplate)}
                  >
                    {isPublished ? "已作为预设入口发布" : "从预设创建"}
                  </Button>
                ) : null}
                <Button
                  type="button"
                  variant="outline"
                  className="w-full"
                  disabled={manifestRegistrationCandidateCount === 0}
                  onClick={() => void onRegisterExistingApp()}
                >
                  {manifestRegistrationCandidateCount > 0 ? "注册已有 App/Page" : "暂无可注册的 AppManifest"}
                </Button>
                <Button type="button" variant="outline" className="w-full" onClick={() => void onCreateSkillDraft(card.id)}>
                  登记能力草稿
                </Button>
                <Button type="button" variant="outline" className="w-full" onClick={() => void onCreateCapabilityRequest(card.id)}>
                  登记能力需求
                </Button>
                <Button type="button" className="w-full" onClick={() => onOpenCtoWorkbench(card.id)}>
                  去 CTO 会话带上需求
                </Button>
              </CardContent>
            </Card>
          );
        })}
      </div>

      <div className="grid gap-5 xl:grid-cols-2 2xl:grid-cols-4">
        <WorkspaceCloseoutStatusCard
          closeoutSummary={closeoutSummary}
          firstAppWithoutManifest={firstAppWithoutManifest}
          skillDefinitions={skillDefinitions}
          firstSkillNeedingValidation={firstSkillNeedingValidation}
          preferredDraftTool={preferredDraftTool}
          onRetryCompanyProvisioning={onRetryCompanyProvisioning}
          onGenerateAppManifestDraft={onGenerateAppManifestDraft}
          onCreateSkillDraft={onCreateSkillDraft}
          onRunSkillSmokeTest={onRunSkillSmokeTest}
        />

        <Card className="border-slate-200/80 shadow-sm">
          <CardHeader>
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <CardTitle className="text-base">流程绑定</CardTitle>
                <CardDescription>让“哪个阶段该用哪个 App / 工具能力”变成组织配置，而不是靠大家记忆。</CardDescription>
              </div>
              <Badge variant={workflowCapabilityBindingsAreExplicit ? "default" : "secondary"}>
                {workflowCapabilityBindingsAreExplicit ? "显式配置" : "系统默认"}
              </Badge>
            </div>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex flex-wrap gap-2">
              {workflowCapabilityBindingsAreExplicit ? (
                <Button type="button" size="sm" variant="outline" onClick={() => void onRestoreWorkflowCapabilityBindings()}>
                  恢复默认绑定
                </Button>
              ) : (
                <Button type="button" size="sm" variant="outline" onClick={() => void onPublishWorkflowCapabilityBindings()}>
                  固化当前默认绑定
                </Button>
              )}
            </div>
            {workflowCapabilityBindingCatalog.length > 0 ? (
              workflowCapabilityBindingCatalog.map((binding) => (
                <div key={binding.id} className="rounded-xl border border-slate-200 bg-white px-4 py-4">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="text-sm font-semibold text-slate-950">{binding.label}</div>
                      {binding.guidance ? (
                        <div className="mt-1 text-xs leading-5 text-slate-500">{binding.guidance}</div>
                      ) : null}
                    </div>
                    <Badge variant={binding.required ? "default" : "secondary"}>
                      {binding.required ? "必用" : "建议"}
                    </Badge>
                  </div>
                  <div className="mt-2 flex flex-wrap gap-2">
                    {binding.appTemplates?.map((template) => (
                      <Badge key={`${binding.id}:app:${template}`} variant="outline">
                        App · {template}
                      </Badge>
                    ))}
                    {binding.skillIds?.map((skillId) => (
                      <Badge key={`${binding.id}:skill:${skillId}`} variant="outline">
                        能力 · {skillId}
                      </Badge>
                    ))}
                  </div>
                  <div className="mt-3 flex flex-wrap gap-2">
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      onClick={() => void onToggleWorkflowCapabilityBindingRequired(binding.id)}
                    >
                      {binding.required ? "改成建议" : "改成必用"}
                    </Button>
                  </div>
                </div>
              ))
            ) : (
              <div className="rounded-xl border border-dashed border-slate-200 bg-slate-50 px-4 py-6 text-sm text-slate-500">
                当前还没有流程绑定。等系统命中默认规则或后续补自定义绑定后，这里会成为 CTO 的正式配置入口。
              </div>
            )}
          </CardContent>
        </Card>

        <Card className="border-slate-200/80 shadow-sm">
          <CardHeader>
            <CardTitle className="text-base">治理审计轨迹</CardTitle>
            <CardDescription>
              把能力草稿、需求、问题、运行和验证动作都收成正式时间线，方便 CTO 与业务负责人回看。
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {capabilityAuditTimeline.length > 0 ? (
              capabilityAuditTimeline.map((event) => (
                <div key={event.id} className="rounded-xl border border-slate-200 bg-white px-4 py-4">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="text-sm font-semibold text-slate-950">{event.summary}</div>
                      <div className="mt-1 text-xs leading-5 text-slate-500">
                        {event.actorLabel ?? "工作目录"} · {formatTime(event.updatedAt)}
                      </div>
                    </div>
                    <Badge variant="secondary">{CAPABILITY_AUDIT_ACTION_LABEL[event.action]}</Badge>
                  </div>
                  <div className="mt-2 flex flex-wrap gap-2">
                    <Badge variant="outline">{event.kindLabel}</Badge>
                    {event.appLabel ? <Badge variant="outline">App · {event.appLabel}</Badge> : null}
                    {event.skillLabel ? <Badge variant="outline">能力 · {event.skillLabel}</Badge> : null}
                  </div>
                  {event.detail ? (
                    <div className="mt-3 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-xs leading-5 text-slate-700">
                      {event.detail}
                    </div>
                  ) : null}
                </div>
              ))
            ) : (
              <div className="rounded-xl border border-dashed border-slate-200 bg-slate-50 px-4 py-6 text-sm text-slate-500">
                当前还没有治理审计轨迹。等你在工作目录里登记能力、推进需求、反馈问题或触发运行后，这里会开始积累正式记录。
              </div>
            )}
          </CardContent>
        </Card>

        <Card className="border-slate-200/80 shadow-sm">
          <CardHeader>
            <CardTitle className="text-base">能力草稿</CardTitle>
            <CardDescription>技术中台把可执行工具收成显式能力定义，避免它们只停留在会话里。</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {skillDefinitions.length > 0 ? (
              skillDefinitions.map((skill) => {
                const nextStatus = nextSkillStatusByCurrent[skill.status];
                const releaseReadiness = buildSkillReleaseReadiness({
                  skill,
                  skillRuns,
                  workspaceApps,
                });
                return (
                  <div key={skill.id} className="rounded-xl border border-slate-200 bg-white px-4 py-4">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <div className="text-sm font-semibold text-slate-950">{skill.title}</div>
                        <div className="mt-1 text-xs leading-5 text-slate-500">{skill.summary}</div>
                        <div className="mt-2 flex flex-wrap gap-2">
                          <Badge variant="secondary">{SKILL_STATUS_LABEL[skill.status]}</Badge>
                          <Badge variant="outline">{skill.entryPath}</Badge>
                          <Badge variant={releaseReadiness.publishable ? "default" : "secondary"}>
                            {releaseReadiness.publishable ? "可发布" : "待补齐"}
                          </Badge>
                        </div>
                      </div>
                    </div>
                    <div className="mt-3 rounded-xl border border-slate-200 bg-slate-50 px-3 py-3">
                      <div className="text-xs font-semibold text-slate-700">发布检查</div>
                      <div className="mt-2 flex flex-wrap gap-2">
                        {releaseReadiness.checks.map((check) => (
                          <Badge key={check.id} variant={check.ok ? "default" : "outline"}>
                            {check.ok ? "已满足" : "待补齐"} · {check.label}
                          </Badge>
                        ))}
                      </div>
                      {releaseReadiness.latestSuccessfulSmokeTestRun ? (
                        <div className="mt-2 text-xs leading-5 text-slate-600">
                          最近一次能力验证：{formatTime(releaseReadiness.latestSuccessfulSmokeTestRun.updatedAt)}
                        </div>
                      ) : (
                        <div className="mt-2 text-xs leading-5 text-slate-500">
                          当前还没有成功能力验证，发布为可用前至少需要先跑通一次能力验证。
                        </div>
                      )}
                    </div>
                    {nextStatus ? (
                      <div className="mt-3 flex flex-wrap gap-2">
                        <Button
                          type="button"
                          size="sm"
                          variant="outline"
                          disabled={skill.status === "retired"}
                          onClick={() => void onRunSkillSmokeTest(skill.id)}
                        >
                          运行能力验证
                        </Button>
                        <Button
                          type="button"
                          size="sm"
                          variant="outline"
                          disabled={nextStatus === "ready" && !releaseReadiness.publishable}
                          onClick={() => void onUpdateSkillStatus(skill.id, nextStatus)}
                        >
                          {skillStatusActionLabel[skill.status]}
                        </Button>
                        <Button
                          type="button"
                          size="sm"
                          variant="outline"
                          onClick={() =>
                            void onCreateCapabilityIssue({
                              type: "bad_result",
                              skillId: skill.id,
                              summary: `${skill.title} 返回结果异常，需要 CTO 复核`,
                            })
                          }
                        >
                          反馈结果异常
                        </Button>
                      </div>
                    ) : null}
                  </div>
                );
              })
            ) : (
              <div className="rounded-xl border border-dashed border-slate-200 bg-slate-50 px-4 py-6 text-sm text-slate-500">
                当前还没有登记过能力草稿。先从阅读器、一致性检查或审阅台里挑一项登记进去。
              </div>
            )}
          </CardContent>
        </Card>

        <Card className="border-slate-200/80 shadow-sm">
          <CardHeader>
            <CardTitle className="text-base">能力运行台账</CardTitle>
            <CardDescription>每次触发都会先留下正式运行记录，后续真实执行引擎会继续复用这条台账。</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {recentSkillRuns.length > 0 ? (
              recentSkillRuns.map((run) => (
                <div key={run.id} className="rounded-xl border border-slate-200 bg-white px-4 py-4">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="text-sm font-semibold text-slate-950">
                        {skillLabelById.get(run.skillId) ?? run.skillId}
                      </div>
                      <div className="mt-1 text-xs leading-5 text-slate-500">
                        {run.triggerLabel ?? "工作目录"} · {run.requestedByLabel ?? "待补触发人"} · {formatTime(run.updatedAt)}
                      </div>
                    </div>
                    <Badge variant={run.status === "failed" ? "destructive" : "secondary"}>
                      {skillRunStatusLabel[run.status]}
                    </Badge>
                  </div>
                  <div className="mt-2 flex flex-wrap gap-2">
                    <Badge variant="outline">{CAPABILITY_RUN_TRIGGER_LABEL[run.triggerType]}</Badge>
                    {run.executionMode ? (
                      <Badge variant="outline">{skillRunExecutionModeLabel[run.executionMode]}</Badge>
                    ) : null}
                    {run.executionEntryPath ? (
                      <Badge variant="outline" className="max-w-full truncate">
                        {run.executionEntryPath}
                      </Badge>
                    ) : null}
                    {typeof run.inputResourceCount === "number" ? (
                      <Badge variant="outline">输入 {run.inputResourceCount} 份资源</Badge>
                    ) : null}
                    {run.inputSchemaVersion ? <Badge variant="outline">Input v{run.inputSchemaVersion}</Badge> : null}
                    {run.executionNote ? <Badge variant="secondary">已自动回退</Badge> : null}
                    {run.outputArtifactIds?.length ? (
                      <Badge variant="outline">回写 {run.outputArtifactIds.length} 份产物</Badge>
                    ) : null}
                  </div>
                  {run.inputResourceTypes && run.inputResourceTypes.length > 0 ? (
                    <div className="mt-3 flex flex-wrap gap-2">
                      {run.inputResourceTypes.map((resourceType) => (
                        <Badge key={resourceType} variant="outline">
                          输入 · {artifactResourceTypeLabel[resourceType] ?? resourceType}
                        </Badge>
                      ))}
                    </div>
                  ) : null}
                  {run.outputArtifactIds && run.outputArtifactIds.length > 0 ? (
                    <div className="mt-3 flex flex-wrap gap-2">
                      {run.outputArtifactIds.map((artifactId) => {
                        const file = workspaceFileByArtifactId.get(artifactId);
                        return (
                          <Badge key={artifactId} variant="outline">
                            {file?.name ?? artifactId}
                          </Badge>
                        );
                      })}
                    </div>
                  ) : null}
                  {run.inputSummary ? (
                    <div className="mt-3 text-xs leading-5 text-slate-600">{run.inputSummary}</div>
                  ) : null}
                  {run.resultSummary ? (
                    <div className="mt-2 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-xs leading-5 text-slate-700">
                      {run.resultSummary}
                    </div>
                  ) : null}
                  {run.executionNote ? (
                    <div className="mt-3 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-xs leading-5 text-slate-600">
                      {run.executionNote}
                    </div>
                  ) : null}
                  {run.errorMessage ? (
                    <div className="mt-3 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs leading-5 text-amber-950">
                      {run.errorMessage}
                    </div>
                  ) : null}
                </div>
              ))
            ) : (
              <div className="rounded-xl border border-dashed border-slate-200 bg-slate-50 px-4 py-6 text-sm text-slate-500">
                当前还没有能力运行记录。等阅读器或一致性中心真正触发一次能力后，这里会开始积累正式台账。
              </div>
            )}
          </CardContent>
        </Card>

        <Card className="border-slate-200/80 shadow-sm">
          <CardHeader>
            <CardTitle className="text-base">能力需求</CardTitle>
            <CardDescription>业务负责人先筛选，再把明确需求流给 CTO，避免技术中台被零散想法打散。</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <CapabilityBoardSummary lanes={capabilityRequestBoard.lanes} />
            {capabilityRequests.length > 0 ? (
              capabilityRequestBoard.lanes.map((lane) => (
                <CapabilityBoardLaneSection
                  key={lane.id}
                  lane={lane}
                  emptyText="当前这一栏还没有请求。"
                  renderActions={(item) => {
                    const request = capabilityRequests.find((entry) => entry.id === item.id);
                    const nextStatus = request ? NEXT_CAPABILITY_REQUEST_STATUS[request.status] : undefined;
                    if (!request || !nextStatus) {
                      return null;
                    }
                    return (
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        onClick={() => void onUpdateCapabilityRequestStatus(request.id, nextStatus)}
                      >
                        {CAPABILITY_REQUEST_ACTION_LABEL[request.status]}
                      </Button>
                    );
                  }}
                />
              ))
            ) : (
              <div className="rounded-xl border border-dashed border-slate-200 bg-slate-50 px-4 py-6 text-sm text-slate-500">
                当前还没有能力需求。可以先把阅读器或一致性检查登记成第一条请求。
              </div>
            )}
          </CardContent>
        </Card>

        <Card className="border-slate-200/80 shadow-sm">
          <CardHeader>
            <div className="flex items-center justify-between gap-3">
              <div>
                <CardTitle className="text-base">能力问题</CardTitle>
                <CardDescription>工具不可用、脚本报错、结果不可信，都应该在这里有正式记录。</CardDescription>
              </div>
              <AlertTriangle className="h-4 w-4 text-amber-500" />
            </div>
          </CardHeader>
          <CardContent className="space-y-3">
            <Button
              type="button"
              variant="outline"
              className="w-full"
              onClick={() =>
                void onCreateCapabilityIssue({
                  summary: "当前公司应用出现问题，需要 CTO 跟进",
                  detail: "请补充报错现象、预期结果和复现步骤。",
                })
              }
            >
              记录一个新问题
            </Button>
            <CapabilityBoardSummary lanes={capabilityIssueBoard.lanes} />
            {capabilityIssues.length > 0 ? (
              capabilityIssueBoard.lanes.map((lane) => (
                <CapabilityBoardLaneSection
                  key={lane.id}
                  lane={lane}
                  emptyText="当前这一栏还没有问题。"
                  renderActions={(item) => {
                    const issue = capabilityIssues.find((entry) => entry.id === item.id);
                    const nextStatus = issue ? NEXT_CAPABILITY_ISSUE_STATUS[issue.status] : undefined;
                    if (!issue || !nextStatus) {
                      return null;
                    }
                    return (
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        onClick={() => void onUpdateCapabilityIssueStatus(issue.id, nextStatus)}
                      >
                        {CAPABILITY_ISSUE_ACTION_LABEL[issue.status]}
                      </Button>
                    );
                  }}
                />
              ))
            ) : (
              <div className="rounded-xl border border-dashed border-slate-200 bg-slate-50 px-4 py-6 text-sm text-slate-500">
                当前还没有登记过能力问题。等工具开始被使用后，这里会成为 CTO 的修复回路。
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
