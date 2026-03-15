import { useMemo } from "react";
import { Badge } from "../../../ui/badge";
import { Button } from "../../../ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "../../../ui/card";
import {
  CAPABILITY_ISSUE_ACTION_LABEL,
  CAPABILITY_ISSUE_STATUS_LABEL,
  CAPABILITY_REQUEST_ACTION_LABEL,
  CAPABILITY_REQUEST_STATUS_LABEL,
  NEXT_CAPABILITY_ISSUE_STATUS,
  NEXT_CAPABILITY_REQUEST_STATUS,
} from "../../../application/workspace";
import { formatTime } from "../../../lib/utils";
import { formatBindingMatchLabel, SKILL_STATUS_LABEL } from "./workspace-page-helpers";
import type { WorkspacePageContentProps } from "./workspace-page-types";

export function WorkflowCapabilitySection({
  workflowCapabilityBindings: bindings,
  onSelectApp,
  onPublishTemplateApp,
  onTriggerSkill,
}: Pick<
  WorkspacePageContentProps,
  "workflowCapabilityBindings" | "onSelectApp" | "onPublishTemplateApp" | "onTriggerSkill"
>) {
  if (bindings.length === 0) {
    return null;
  }

  const publishableTemplates = new Set<"reader" | "consistency" | "review-console" | "dashboard">([
    "reader",
    "consistency",
    "review-console",
    "dashboard",
  ]);

  return (
    <Card className="border-slate-200/80 shadow-sm">
      <CardHeader>
        <CardTitle className="text-base">当前阶段建议能力</CardTitle>
        <CardDescription>
          这些 App / 能力是根据当前工作项的阶段和下一步动作自动匹配出来的，帮助团队知道现在该用什么。
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        {bindings.map((binding) => (
          <div key={binding.id} className="rounded-xl border border-slate-200 bg-white px-4 py-4">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div className="min-w-0">
                <div className="text-sm font-semibold text-slate-950">{binding.label}</div>
                {binding.guidance ? (
                  <div className="mt-1 text-xs leading-5 text-slate-500">{binding.guidance}</div>
                ) : null}
              </div>
              <div className="flex flex-wrap gap-2">
                <Badge variant={binding.required ? "default" : "secondary"}>
                  {binding.required ? "必用" : "建议"}
                </Badge>
                <Badge variant="outline">{formatBindingMatchLabel(binding.matchedBy)}</Badge>
              </div>
            </div>
            <div className="mt-3 flex flex-wrap gap-2">
              {binding.apps.map((app) => (
                <Button key={app.id} type="button" size="sm" variant="outline" onClick={() => onSelectApp(app.id)}>
                  打开 {app.title}
                </Button>
              ))}
              {binding.skills.map((skill) => (
                <Button
                  key={skill.id}
                  type="button"
                  size="sm"
                  variant="outline"
                  disabled={skill.status !== "ready"}
                  onClick={() => void onTriggerSkill(skill.id, binding.apps[0]?.id ?? null)}
                >
                  {skill.status === "ready"
                    ? `运行 ${skill.title}`
                    : `${skill.title} · ${SKILL_STATUS_LABEL[skill.status]}`}
                </Button>
              ))}
              {binding.missingAppTemplates
                .filter((template): template is "reader" | "consistency" | "review-console" | "dashboard" =>
                  publishableTemplates.has(
                    template as "reader" | "consistency" | "review-console" | "dashboard",
                  ),
                )
                .map((template) => (
                  <Button
                    key={`publish:${template}`}
                    type="button"
                    size="sm"
                    variant="secondary"
                    onClick={() => void onPublishTemplateApp(template)}
                  >
                    发布
                    {template === "reader"
                      ? "阅读器"
                      : template === "consistency"
                        ? "一致性中心"
                        : template === "dashboard"
                          ? "仪表盘"
                          : "审阅控制台"}
                  </Button>
                ))}
            </div>
            {binding.missingSkillIds.length > 0 ? (
              <div className="mt-3 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs leading-5 text-amber-950">
                缺少能力：{binding.missingSkillIds.join("、")}。当前阶段已经命中这条能力绑定，建议 CTO
                继续补齐对应能力实现。
              </div>
            ) : null}
          </div>
        ))}
      </CardContent>
    </Card>
  );
}

export function SelectedAppGovernanceSection({
  selectedApp,
  capabilityRequests,
  capabilityIssues,
  onOpenCtoChat,
  onUpdateCapabilityRequestStatus,
  onUpdateCapabilityIssueStatus,
}: Pick<
  WorkspacePageContentProps,
  | "selectedApp"
  | "capabilityRequests"
  | "capabilityIssues"
  | "onOpenCtoChat"
  | "onUpdateCapabilityRequestStatus"
  | "onUpdateCapabilityIssueStatus"
>) {
  const relatedRequests = useMemo(
    () =>
      [...capabilityRequests]
        .filter((request) => request.appId === selectedApp.id)
        .sort((left, right) => right.updatedAt - left.updatedAt)
        .slice(0, 3),
    [capabilityRequests, selectedApp.id],
  );
  const relatedIssues = useMemo(
    () =>
      [...capabilityIssues]
        .filter((issue) => issue.appId === selectedApp.id)
        .sort((left, right) => right.updatedAt - left.updatedAt)
        .slice(0, 3),
    [capabilityIssues, selectedApp.id],
  );
  const activeRequestCount = capabilityRequests.filter(
    (request) => request.appId === selectedApp.id && request.status !== "closed",
  ).length;
  const activeIssueCount = capabilityIssues.filter(
    (issue) => issue.appId === selectedApp.id && issue.status !== "closed",
  ).length;
  const verifyRequestCount = relatedRequests.filter(
    (request) => request.status === "ready" || request.status === "verified",
  ).length;
  const verifyIssueCount = relatedIssues.filter(
    (issue) => issue.status === "ready_for_verify" || issue.status === "verified",
  ).length;

  return (
    <Card className="border-slate-200/80 shadow-sm">
      <CardHeader className="pb-4">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <CardTitle className="text-base">当前 App 的反馈回路</CardTitle>
            <CardDescription className="mt-2 max-w-3xl leading-6">
              这张 App 上报过的能力需求和问题，会在这里直接显示状态，不需要先跳回 CTO
              工坊再确认有没有进入 backlog。
            </CardDescription>
          </div>
          <div className="flex flex-wrap gap-2">
            <Badge variant="outline">需求 {activeRequestCount}</Badge>
            <Badge variant="outline">问题 {activeIssueCount}</Badge>
            {verifyRequestCount + verifyIssueCount > 0 ? (
              <Badge variant="secondary">待验证 {verifyRequestCount + verifyIssueCount}</Badge>
            ) : null}
            <Button type="button" size="sm" variant="outline" onClick={onOpenCtoChat}>
              打开 CTO 会话
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent className="grid gap-4 lg:grid-cols-2">
        <div className="rounded-2xl border border-slate-200 bg-white p-4">
          <div className="flex items-center justify-between gap-3">
            <div>
              <div className="text-sm font-semibold text-slate-950">能力需求</div>
              <div className="mt-1 text-xs leading-5 text-slate-500">
                缺少页面、工具或检查器时，这里会显示已登记的需求。
              </div>
            </div>
            <Badge variant="outline">{activeRequestCount}</Badge>
          </div>
          <div className="mt-4 space-y-3">
            {relatedRequests.length > 0 ? (
              relatedRequests.map((request) => (
                <div key={request.id} className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-3">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="text-sm font-medium text-slate-950">{request.summary}</div>
                      <div className="mt-1 text-xs leading-5 text-slate-500">
                        {request.requesterLabel ?? "业务负责人"} · {formatTime(request.updatedAt)}
                      </div>
                      {request.detail ? (
                        <div className="mt-2 text-xs leading-5 text-slate-600">{request.detail}</div>
                      ) : null}
                      <div className="mt-2 flex flex-wrap gap-2 text-[11px] leading-5 text-slate-500">
                        {request.skillId ? <Badge variant="outline">能力 · {request.skillId}</Badge> : null}
                        {request.contextFileName ? (
                          <Badge variant="outline">资源 · {request.contextFileName}</Badge>
                        ) : null}
                        {request.contextRunId ? (
                          <Badge variant="outline">运行记录 · {request.contextRunId}</Badge>
                        ) : null}
                      </div>
                    </div>
                    <Badge variant={request.status === "closed" ? "secondary" : "outline"}>
                      {CAPABILITY_REQUEST_STATUS_LABEL[request.status]}
                    </Badge>
                  </div>
                  {NEXT_CAPABILITY_REQUEST_STATUS[request.status] ? (
                    <div className="mt-3 flex flex-wrap items-center justify-between gap-3 border-t border-slate-200 pt-3">
                      <div className="text-xs text-slate-500">
                        下一步：
                        {request.status === "ready" || request.status === "verified"
                          ? "业务负责人验收"
                          : request.status === "building"
                            ? "CTO 建设"
                            : request.status === "triaged"
                              ? "CTO 评估"
                              : "业务负责人分流"}
                      </div>
                      <Button
                        type="button"
                        size="sm"
                        variant={
                          request.status === "ready" || request.status === "verified"
                            ? "default"
                            : "outline"
                        }
                        onClick={() =>
                          void onUpdateCapabilityRequestStatus(
                            request.id,
                            NEXT_CAPABILITY_REQUEST_STATUS[request.status]!,
                          )
                        }
                      >
                        {CAPABILITY_REQUEST_ACTION_LABEL[request.status]}
                      </Button>
                    </div>
                  ) : null}
                </div>
              ))
            ) : (
              <div className="rounded-xl border border-dashed border-slate-200 bg-slate-50 px-4 py-5 text-sm leading-6 text-slate-500">
                这张 App 还没有登记过能力需求。需要补工具或页面时，直接使用上方动作入口即可。
              </div>
            )}
          </div>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white p-4">
          <div className="flex items-center justify-between gap-3">
            <div>
              <div className="text-sm font-semibold text-slate-950">能力问题</div>
              <div className="mt-1 text-xs leading-5 text-slate-500">
                结果不对、脚本异常或页面不可用时，这里会直接看到跟进状态。
              </div>
            </div>
            <Badge variant="outline">{activeIssueCount}</Badge>
          </div>
          <div className="mt-4 space-y-3">
            {relatedIssues.length > 0 ? (
              relatedIssues.map((issue) => (
                <div key={issue.id} className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-3">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="text-sm font-medium text-slate-950">{issue.summary}</div>
                      <div className="mt-1 text-xs leading-5 text-slate-500">
                        {issue.reporterLabel ?? "业务负责人"} · {formatTime(issue.updatedAt)}
                      </div>
                      {issue.detail ? (
                        <div className="mt-2 text-xs leading-5 text-slate-600">{issue.detail}</div>
                      ) : null}
                      <div className="mt-2 flex flex-wrap gap-2 text-[11px] leading-5 text-slate-500">
                        {issue.skillId ? <Badge variant="outline">能力 · {issue.skillId}</Badge> : null}
                        {issue.contextFileName ? (
                          <Badge variant="outline">资源 · {issue.contextFileName}</Badge>
                        ) : null}
                        {issue.contextRunId ? (
                          <Badge variant="outline">运行记录 · {issue.contextRunId}</Badge>
                        ) : null}
                      </div>
                    </div>
                    <Badge variant={issue.status === "closed" ? "secondary" : "outline"}>
                      {CAPABILITY_ISSUE_STATUS_LABEL[issue.status]}
                    </Badge>
                  </div>
                  {NEXT_CAPABILITY_ISSUE_STATUS[issue.status] ? (
                    <div className="mt-3 flex flex-wrap items-center justify-between gap-3 border-t border-slate-200 pt-3">
                      <div className="text-xs text-slate-500">
                        下一步：
                        {issue.status === "ready_for_verify" || issue.status === "verified"
                          ? "业务负责人回访"
                          : issue.status === "fixing" || issue.status === "acknowledged"
                            ? "CTO 修复"
                            : "业务负责人补事实"}
                      </div>
                      <Button
                        type="button"
                        size="sm"
                        variant={
                          issue.status === "ready_for_verify" || issue.status === "verified"
                            ? "default"
                            : "outline"
                        }
                        onClick={() =>
                          void onUpdateCapabilityIssueStatus(
                            issue.id,
                            NEXT_CAPABILITY_ISSUE_STATUS[issue.status]!,
                          )
                        }
                      >
                        {CAPABILITY_ISSUE_ACTION_LABEL[issue.status]}
                      </Button>
                    </div>
                  ) : null}
                </div>
              ))
            ) : (
              <div className="rounded-xl border border-dashed border-slate-200 bg-slate-50 px-4 py-5 text-sm leading-6 text-slate-500">
                这张 App 还没有登记过能力问题。等工具开始被真实使用后，这里会成为你确认修复进展的第一入口。
              </div>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
