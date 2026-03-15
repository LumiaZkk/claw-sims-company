import { AlertTriangle, BookOpenCheck, RefreshCcw } from "lucide-react";
import {
  resolveWorkspaceAppSurface,
  resolveWorkspaceAppTemplate,
} from "../../../application/company/workspace-apps";
import { cn } from "../../../lib/utils";
import { Badge } from "../../../ui/badge";
import { Button } from "../../../ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "../../../ui/card";
import {
  WorkspaceKnowledgeHub,
  WorkspaceReaderSection,
  WorkspaceConsistencyHub,
} from "./WorkspaceContentSections";
import { WorkspaceEmbeddedAppSection } from "./WorkspaceEmbeddedAppSection";
import { renderWorkspaceAppIcon } from "./workspace-page-helpers";
import type { WorkspacePageContentProps } from "./workspace-page-types";
import {
  SelectedAppGovernanceSection,
  WorkflowCapabilitySection,
} from "./WorkspaceSelectedAppFeedbackSections";
import { WorkspaceWorkbench } from "./WorkspaceWorkbench";

export function WorkspacePageContent(props: WorkspacePageContentProps) {
  const {
    activeCompanyName,
    workspaceApps,
    workspaceAppsAreExplicit,
    selectedApp,
    selectedAppManifest,
    artifactBackedWorkspaceCount,
    mirroredOnlyWorkspaceCount,
    shouldSyncProviderWorkspace,
    workspacePolicySummary,
    workflowCapabilityBindingCatalog,
    workflowCapabilityBindingsAreExplicit,
    workflowCapabilityBindings,
    chapterFiles,
    canonFiles,
    capabilityIssues,
    capabilityRequests,
    capabilityAuditEvents,
    manifestRegistrationCandidateCount,
    knowledgeItems,
    businessLeadLabel,
    ctoLabel,
    publishedAppTemplates,
    skillRuns,
    skillDefinitions,
    loadingIndex,
    executorProvisioning,
    onRefreshIndex,
    onRetryCompanyProvisioning,
    onRunAppManifestAction,
    onSelectApp,
    onTriggerSkill,
    onOpenCtoWorkbench,
    onRegisterExistingApp,
    onPublishRecommendedApps,
    onOpenCtoChat,
    onOpenRequirementCenter,
  } = props;
  const selectedAppTemplate = resolveWorkspaceAppTemplate(selectedApp);
  const selectedAppSurface = resolveWorkspaceAppSurface(selectedApp);
  const novelReaderAppId =
    workspaceApps.find((app) => resolveWorkspaceAppTemplate(app) === "reader")?.id ?? "novel-reader";

  return (
    <div className="min-h-full bg-[radial-gradient(circle_at_top_left,_rgba(99,102,241,0.08),_transparent_34%),radial-gradient(circle_at_top_right,_rgba(16,185,129,0.08),_transparent_28%)] p-6 md:p-8">
      <div className="mx-auto max-w-7xl space-y-6">
        {executorProvisioning && executorProvisioning.state !== "ready" ? (
          <Card className="border-amber-200 bg-amber-50/80 shadow-sm">
            <CardContent className="flex flex-col gap-4 px-6 py-5 md:flex-row md:items-center md:justify-between">
              <div className="space-y-2">
                <div className="flex items-center gap-2 text-sm font-semibold text-amber-950">
                  <AlertTriangle className="h-4 w-4" />
                  执行器仍在补齐
                </div>
                <div className="text-sm leading-6 text-amber-950/90">
                  这家公司已经创建成功，工作目录和公司应用可以继续使用；只是 OpenClaw agent 还在补齐，所以部分能力暂时可能回退或不可用。
                </div>
                {executorProvisioning.lastError ? (
                  <div className="text-xs leading-5 text-amber-900/80">
                    最近原因：{executorProvisioning.lastError}
                  </div>
                ) : null}
              </div>
              <Button type="button" variant="outline" onClick={() => void onRetryCompanyProvisioning()}>
                重试补齐执行器
              </Button>
            </CardContent>
          </Card>
        ) : null}

        <Card className="overflow-hidden border-slate-200/80 shadow-sm">
          <CardContent className="grid gap-5 px-6 py-6 lg:grid-cols-[minmax(0,1fr)_340px]">
            <div className="space-y-4">
              <div className="flex flex-wrap items-center gap-2">
                <Badge variant="secondary">当前公司专属</Badge>
                <Badge variant="outline">只对 {activeCompanyName} 可见</Badge>
              </div>
              <div>
                <h2 className="text-2xl font-semibold tracking-tight text-slate-950">工作目录</h2>
                <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-600">
                  把当前公司的专属工具、产品产物和 CTO 工具需求收进一个页面里。这里会承载查看器、规则与校验、知识与验收和工具工坊等正式入口；底层工作区文件只作为补充镜像，不再是主真相源。
                </p>
                {!workspaceAppsAreExplicit ? (
                  <div className="mt-4 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm leading-6 text-amber-950">
                    当前这些入口还是系统补位推荐，方便你先验证方向。点一下“固化推荐应用”后，它们才会正式挂到这家公司里，后续 CTO 产出的查看器、新页面或校验工具也会继续沿着这条显式链路发布。
                  </div>
                ) : null}
              </div>
              <div className="flex flex-wrap gap-3">
                {onOpenRequirementCenter ? (
                  <Button type="button" variant="outline" onClick={onOpenRequirementCenter}>
                    <BookOpenCheck className="mr-2 h-4 w-4" />
                    返回需求中心
                  </Button>
                ) : null}
                <Button type="button" onClick={() => onOpenCtoWorkbench("consistency-checker")}>
                  发起规则校验能力需求
                </Button>
                <Button type="button" variant="outline" onClick={() => onOpenCtoWorkbench("novel-reader")}>
                  发起内容查看 App 需求
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => void onRegisterExistingApp()}
                  disabled={manifestRegistrationCandidateCount === 0}
                >
                  {manifestRegistrationCandidateCount > 0 ? "注册已有 App/Page" : "暂无可注册的 AppManifest"}
                </Button>
                {onPublishRecommendedApps ? (
                  <Button type="button" variant="secondary" onClick={() => void onPublishRecommendedApps()}>
                    固化推荐应用
                  </Button>
                ) : null}
              </div>
            </div>

            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-1">
              <div className="rounded-2xl border border-slate-200 bg-white/80 px-4 py-4">
                <div className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">公司应用</div>
                <div className="mt-2 text-2xl font-semibold text-slate-950">{workspaceApps.length}</div>
                <div className="mt-1 text-sm text-slate-600">当前公司已经启用的专属菜单与工具入口。</div>
              </div>
              <div className="rounded-2xl border border-slate-200 bg-white/80 px-4 py-4">
                <div className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">产品产物索引</div>
                <div className="mt-2 text-2xl font-semibold text-slate-950">{artifactBackedWorkspaceCount}</div>
                <div className="mt-1 text-sm text-slate-600">
                  {shouldSyncProviderWorkspace
                    ? `当前可直接消费的产品产物 ${artifactBackedWorkspaceCount} 份；镜像补充 ${mirroredOnlyWorkspaceCount} 份，仅在产物缺位时兜底。`
                    : workspacePolicySummary.mirrorEnabled
                      ? "当前后端暂未提供文件区，工作目录直接读取产品侧产物库。"
                      : "镜像补位已在公司策略里关闭，工作目录只读取正式产品产物。"}
                </div>
              </div>
              <div className="rounded-2xl border border-violet-200 bg-violet-50/50 px-4 py-4">
                <div className="text-xs font-semibold uppercase tracking-[0.18em] text-violet-700">工作目录边界</div>
                <div className="mt-2 flex flex-wrap gap-2">
                  <Badge variant="secondary">{workspacePolicySummary.deliveryLabel}</Badge>
                  <Badge variant="outline">{workspacePolicySummary.mirrorLabel}</Badge>
                  <Badge variant="outline">{workspacePolicySummary.executionLabel}</Badge>
                </div>
                <div className="mt-2 text-sm text-slate-600">{workspacePolicySummary.mirrorDescription}</div>
                <div className="mt-1 text-xs text-slate-500">{workspacePolicySummary.executionDescription}</div>
              </div>
              <div className="rounded-2xl border border-slate-200 bg-white/80 px-4 py-4">
                <div className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">当前可读业务文档</div>
                <div className="mt-2 text-2xl font-semibold text-slate-950">{chapterFiles.length + canonFiles.length}</div>
                <div className="mt-1 text-sm text-slate-600">
                  {chapterFiles.length + canonFiles.length > 0
                    ? "当前公司已经有可直接阅读的正文与设定文件。"
                    : "当前公司还没把正文/设定稳定固化进 workspace，这正是 CTO 下一步该补的能力。"}
                </div>
              </div>
              <div className="rounded-2xl border border-slate-200 bg-white/80 px-4 py-4">
                <div className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">当前 CTO</div>
                <div className="mt-2 text-lg font-semibold text-slate-950">{ctoLabel ?? "尚未配置"}</div>
                <div className="mt-1 text-sm text-slate-600">
                  {ctoLabel
                    ? `${ctoLabel} 负责公司专属工具方向。`
                    : "需要一个 CTO 节点来承接公司工具开发。"}
                </div>
              </div>
              <div className="rounded-2xl border border-slate-200 bg-white/80 px-4 py-4">
                <div className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">技术中台回路</div>
                <div className="mt-2 text-lg font-semibold text-slate-950">
                  {skillDefinitions.length}/{skillRuns.length}/{capabilityRequests.length}/{capabilityIssues.length}
                </div>
                <div className="mt-1 text-sm text-slate-600">能力 / 运行 / 需求 / 问题 已经都能在工作目录里被追踪。</div>
              </div>
            </div>
          </CardContent>
        </Card>

        <div className="grid gap-6 xl:grid-cols-[300px_minmax(0,1fr)]">
          <Card className="border-slate-200/80 shadow-sm">
            <CardHeader>
              <CardTitle className="text-base">公司应用</CardTitle>
              <CardDescription>只显示当前公司的专属菜单和工具，不影响其他公司。</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              {workspaceApps.map((app) => (
                <button
                  type="button"
                  key={app.id}
                  onClick={() => onSelectApp(app.id)}
                  className={cn(
                    "w-full rounded-2xl border px-4 py-4 text-left transition-colors",
                    selectedApp.id === app.id
                      ? "border-indigo-200 bg-indigo-50 text-indigo-950"
                      : "border-slate-200 bg-white hover:bg-slate-50",
                  )}
                >
                  <div className="flex items-start gap-3">
                    <div className="mt-0.5 text-xl">{app.icon}</div>
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <div className="text-sm font-semibold">{app.title}</div>
                        <Badge variant={app.status === "ready" ? "default" : "secondary"}>
                          {app.status === "ready" ? "可直接使用" : "建议继续建设"}
                        </Badge>
                        {!workspaceAppsAreExplicit ? <Badge variant="outline">系统补位</Badge> : null}
                        {resolveWorkspaceAppSurface(app) === "embedded" ? (
                          <Badge variant="outline">嵌入式</Badge>
                        ) : null}
                      </div>
                      <div className="mt-1 text-xs leading-5 text-slate-500">{app.description}</div>
                    </div>
                  </div>
                </button>
              ))}
              <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50 px-4 py-4 text-xs leading-6 text-slate-500">
                后续 CTO 为当前公司做出来的新工具，也应该继续挂在这里，而不是混进所有公司的公共菜单里。
              </div>
              <Button type="button" variant="outline" className="w-full" onClick={onOpenCtoChat} disabled={!ctoLabel}>
                直接打开 CTO 会话
              </Button>
            </CardContent>
          </Card>

          <div className="space-y-5">
            <Card className="border-slate-200/80 shadow-sm">
              <CardHeader className="pb-4">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <CardTitle className="flex items-center gap-2 text-lg">
                      {renderWorkspaceAppIcon(selectedAppTemplate)}
                      {selectedApp.title}
                    </CardTitle>
                    <CardDescription className="mt-2 max-w-3xl leading-6">{selectedApp.description}</CardDescription>
                    <div className="mt-3 flex flex-wrap gap-2">
                      <Badge variant="outline">{workspacePolicySummary.deliveryLabel}</Badge>
                      <Badge variant="outline">{workspacePolicySummary.mirrorLabel}</Badge>
                      <Badge variant="outline">{workspacePolicySummary.executionLabel}</Badge>
                    </div>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <Badge variant="outline">产品产物优先</Badge>
                    <Badge variant="secondary">{artifactBackedWorkspaceCount} 份产物</Badge>
                    {selectedAppManifest ? (
                      <Badge variant="outline">{selectedAppManifest.draft ? "manifest 草案" : "manifest 已接入"}</Badge>
                    ) : (
                      <Badge variant="secondary">manifest 待接入</Badge>
                    )}
                    {selectedAppTemplate === "knowledge" ? (
                      <Badge variant="outline">{knowledgeItems.length} 条知识</Badge>
                    ) : null}
                    {selectedAppSurface === "embedded" ? <Badge variant="outline">嵌入式 App</Badge> : null}
                    {shouldSyncProviderWorkspace && mirroredOnlyWorkspaceCount > 0 ? (
                      <Badge variant="outline">镜像补充 {mirroredOnlyWorkspaceCount}</Badge>
                    ) : !workspacePolicySummary.mirrorEnabled ? (
                      <Badge variant="secondary">镜像补位已关闭</Badge>
                    ) : null}
                    <Button type="button" size="sm" variant="outline" onClick={onRefreshIndex} disabled={loadingIndex}>
                      <RefreshCcw className={cn("mr-2 h-4 w-4", loadingIndex && "animate-spin")} />
                      刷新索引
                    </Button>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="pt-0">
                <div className="flex flex-wrap gap-2">
                  {selectedAppManifest?.actions?.map((action) => (
                    <Button
                      key={action.id}
                      type="button"
                      size="sm"
                      variant="outline"
                      onClick={() => void onRunAppManifestAction(action)}
                    >
                      {action.label}
                    </Button>
                  ))}
                  {!selectedAppManifest ? (
                    <Button type="button" size="sm" variant="outline" onClick={() => void props.onGenerateAppManifestDraft()}>
                      生成 AppManifest 草案
                    </Button>
                  ) : null}
                </div>
              </CardContent>
            </Card>

            <WorkflowCapabilitySection
              workflowCapabilityBindings={workflowCapabilityBindings}
              onSelectApp={onSelectApp}
              onPublishTemplateApp={props.onPublishTemplateApp}
              onTriggerSkill={onTriggerSkill}
            />

            <SelectedAppGovernanceSection
              selectedApp={selectedApp}
              capabilityRequests={capabilityRequests}
              capabilityIssues={capabilityIssues}
              onOpenCtoChat={onOpenCtoChat}
              onUpdateCapabilityRequestStatus={props.onUpdateCapabilityRequestStatus}
              onUpdateCapabilityIssueStatus={props.onUpdateCapabilityIssueStatus}
            />

            {selectedAppSurface === "embedded" ||
            selectedAppTemplate === "review-console" ||
            selectedAppTemplate === "dashboard" ? (
              <WorkspaceEmbeddedAppSection
                app={selectedApp}
                manifest={selectedAppManifest}
                runtime={props.embeddedRuntime}
                selectedFileContent={props.selectedFileContent}
                loadingFileKey={props.loadingFileKey}
                onSelectEmbeddedSection={props.onSelectEmbeddedSection}
                onSelectEmbeddedFile={props.onSelectEmbeddedFile}
                onRunAppManifestAction={props.onRunAppManifestAction}
                onOpenCtoChat={onOpenCtoChat}
              />
            ) : null}
            {selectedAppSurface === "template" && selectedAppTemplate === "reader" ? (
              <WorkspaceReaderSection {...props} />
            ) : null}
            {selectedAppSurface === "template" && selectedAppTemplate === "consistency" ? (
              <WorkspaceConsistencyHub
                anchors={props.anchors}
                chapterFiles={props.chapterFiles}
                reviewFiles={props.reviewFiles}
                toolingFiles={props.toolingFiles}
                onOpenCtoWorkbench={props.onOpenCtoWorkbench}
                onOpenNovelReader={() => props.onSelectApp(novelReaderAppId)}
              />
            ) : null}
            {selectedAppSurface === "template" && selectedAppTemplate === "knowledge" ? (
              <WorkspaceKnowledgeHub {...props} />
            ) : null}
            {selectedAppSurface === "template" && selectedAppTemplate === "workbench" ? (
              <WorkspaceWorkbench
                ctoLabel={ctoLabel}
                businessLeadLabel={businessLeadLabel}
                workflowCapabilityBindingCatalog={workflowCapabilityBindingCatalog}
                workflowCapabilityBindingsAreExplicit={workflowCapabilityBindingsAreExplicit}
                skillDefinitions={skillDefinitions}
                skillRuns={skillRuns}
                workspaceApps={workspaceApps}
                workspaceFiles={props.workspaceFiles}
                executorProvisioning={executorProvisioning}
                capabilityRequests={capabilityRequests}
                capabilityIssues={capabilityIssues}
                capabilityAuditEvents={capabilityAuditEvents}
                manifestRegistrationCandidateCount={manifestRegistrationCandidateCount}
                onSelectApp={props.onSelectApp}
                onOpenCtoWorkbench={props.onOpenCtoWorkbench}
                onPublishTemplateApp={props.onPublishTemplateApp}
                onRegisterExistingApp={props.onRegisterExistingApp}
                onCreateSkillDraft={props.onCreateSkillDraft}
                onGenerateAppManifestDraft={props.onGenerateAppManifestDraft}
                onCreateCapabilityRequest={props.onCreateCapabilityRequest}
                onCreateCapabilityIssue={props.onCreateCapabilityIssue}
                onRetryCompanyProvisioning={props.onRetryCompanyProvisioning}
                onUpdateSkillStatus={props.onUpdateSkillStatus}
                onRunSkillSmokeTest={props.onRunSkillSmokeTest}
                onPublishWorkflowCapabilityBindings={props.onPublishWorkflowCapabilityBindings}
                onRestoreWorkflowCapabilityBindings={props.onRestoreWorkflowCapabilityBindings}
                onToggleWorkflowCapabilityBindingRequired={props.onToggleWorkflowCapabilityBindingRequired}
                onUpdateCapabilityRequestStatus={props.onUpdateCapabilityRequestStatus}
                onUpdateCapabilityIssueStatus={props.onUpdateCapabilityIssueStatus}
                publishedAppTemplates={publishedAppTemplates}
              />
            ) : null}
          </div>
        </div>
      </div>
    </div>
  );
}
