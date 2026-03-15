import {
  buildSkillReleaseReadiness,
  runWorkspaceSkill,
  type WorkspaceWorkbenchTool,
} from "../../application/workspace";
import { resolveWorkspaceAppTemplate } from "../../application/company/workspace-apps";
import { toast } from "../../system/toast-store";
import type {
  CapabilityIssueRecord,
  CapabilityIssueStatus,
  CapabilityRequestStatus,
  CompanyWorkspaceApp,
  SkillDefinitionStatus,
} from "../../domain/org/types";
import { WORKBENCH_SKILL_SEEDS } from "./workspace-page-constants";
import {
  attemptWorkspaceScriptExecution,
  type UseWorkspacePageActionsParams,
} from "./workspace-page-action-types";

export function createWorkspacePageCapabilityActions({
  activeCompany,
  activeWorkspaceWorkItem,
  businessLead,
  capabilityIssues,
  capabilityRequests,
  ctoEmployee,
  retryCompanyProvisioning,
  selectedApp,
  skillDefinitions,
  skillRuns,
  upsertArtifactRecord,
  upsertCapabilityAuditEvent,
  upsertCapabilityIssue,
  upsertCapabilityRequest,
  upsertSkillDefinition,
  upsertSkillRun,
  workspaceAppManifestsById,
  workspaceApps,
  workspaceFiles,
  writeWorkspaceApps,
}: UseWorkspacePageActionsParams) {
  const upsertSkillDraft = async (tool: WorkspaceWorkbenchTool) => {
    if (!ctoEmployee) {
      toast.error("当前公司没有 CTO 节点", "至少需要一个 CTO 节点来承接能力草稿。");
      return;
    }
    const seed = WORKBENCH_SKILL_SEEDS[tool];
    const existing = skillDefinitions.find((skill) => skill.id === seed.id) ?? null;
    const app = workspaceApps.find((candidate) => resolveWorkspaceAppTemplate(candidate) === seed.appTemplate) ?? null;
    const now = Date.now();
    await upsertSkillDefinition({
      id: seed.id,
      title: seed.title,
      summary: seed.summary,
      ownerAgentId: ctoEmployee.agentId,
      status: existing?.status ?? "draft",
      entryPath: seed.entryPath,
      inputSchema: { companyId: activeCompany.id, appId: app?.id ?? null },
      outputSchema: { writesResourceTypes: seed.writesResourceTypes },
      writesResourceTypes: seed.writesResourceTypes,
      allowedTriggers: ["app_action"],
      smokeTest: seed.smokeTest,
      manifestActionIds: seed.manifestActionIds,
      appIds: app ? [app.id] : undefined,
      createdAt: existing?.createdAt ?? now,
      updatedAt: now,
    });
    await upsertCapabilityAuditEvent({
      id: `capability-audit:${activeCompany.id}:skill:${seed.id}:created:${now}`,
      kind: "skill",
      entityId: seed.id,
      action: "created",
      summary: `${seed.title} 已登记为能力草稿`,
      detail: `${seed.title} 已进入 CTO 技术中台 backlog，等待继续验证和发布。`,
      actorId: ctoEmployee.agentId,
      actorLabel: ctoEmployee.nickname ?? ctoEmployee.agentId,
      appId: app?.id ?? null,
      skillId: seed.id,
      createdAt: now,
      updatedAt: now,
    });
    toast.success("已登记能力草稿", `${seed.title} 已进入 CTO 技术中台 backlog。`);
  };

  const createCapabilityRequestDraft = async (
    tool: WorkspaceWorkbenchTool,
    context?: {
      actionId?: string | null;
      sectionLabel?: string | null;
      fileKey?: string | null;
      fileName?: string | null;
      runId?: string | null;
    },
  ) => {
    const seed = WORKBENCH_SKILL_SEEDS[tool];
    const relatedApp =
      workspaceApps.find((app) => resolveWorkspaceAppTemplate(app) === seed.appTemplate) ?? selectedApp ?? null;
    const summaryPrefix = relatedApp?.title ?? activeCompany.name;
    const now = Date.now();
    const requestId = `capability-request:${activeCompany.id}:${seed.id}:${now}`;
    await upsertCapabilityRequest({
      id: requestId,
      type: seed.requestType,
      summary: `${summaryPrefix} 需要补齐 ${seed.title}`,
      detail: `${activeCompany.name} 当前希望补齐 ${seed.title}，优先服务 ${relatedApp?.title ?? selectedApp?.title ?? "工作目录"} 的实际使用场景。`,
      requesterActorId: businessLead?.agentId ?? activeWorkspaceWorkItem?.ownerActorId ?? null,
      requesterLabel:
        businessLead?.nickname ??
        activeWorkspaceWorkItem?.displayOwnerLabel ??
        activeWorkspaceWorkItem?.ownerLabel ??
        null,
      requesterDepartmentId: businessLead?.departmentId ?? activeWorkspaceWorkItem?.owningDepartmentId ?? null,
      ownerActorId: ctoEmployee?.agentId ?? null,
      appId: relatedApp?.id ?? null,
      skillId: seed.id,
      contextActionId: context?.actionId ?? null,
      contextAppSection: context?.sectionLabel ?? null,
      contextFileKey: context?.fileKey ?? null,
      contextFileName: context?.fileName ?? null,
      contextRunId: context?.runId ?? null,
      status: "open",
      createdAt: now,
      updatedAt: now,
    });
    await upsertCapabilityAuditEvent({
      id: `capability-audit:${activeCompany.id}:request:${seed.id}:created:${now}`,
      kind: "request",
      entityId: requestId,
      action: "created",
      summary: `${summaryPrefix} 已登记补齐 ${seed.title} 的能力需求`,
      detail: `${businessLead?.nickname ?? activeWorkspaceWorkItem?.displayOwnerLabel ?? "业务负责人"} 已把这条需求正式交给 CTO 技术中台。`,
      actorId: businessLead?.agentId ?? activeWorkspaceWorkItem?.ownerActorId ?? null,
      actorLabel:
        businessLead?.nickname ??
        activeWorkspaceWorkItem?.displayOwnerLabel ??
        activeWorkspaceWorkItem?.ownerLabel ??
        "业务负责人",
      appId: relatedApp?.id ?? null,
      skillId: seed.id,
      requestId,
      createdAt: now,
      updatedAt: now,
    });
    toast.success("已登记能力需求", "这条需求已经进入 CTO 技术中台 backlog。");
  };

  const createCapabilityIssueDraft = async (input?: {
    type?: CapabilityIssueRecord["type"];
    summary?: string;
    detail?: string;
    appId?: string | null;
    skillId?: string | null;
    contextActionId?: string | null;
    contextAppSection?: string | null;
    contextFileKey?: string | null;
    contextFileName?: string | null;
    contextRunId?: string | null;
  }) => {
    const now = Date.now();
    const issueId = `capability-issue:${activeCompany.id}:${input?.skillId ?? input?.appId ?? "workspace"}:${now}`;
    await upsertCapabilityIssue({
      id: issueId,
      type: input?.type ?? "unavailable",
      summary: input?.summary ?? `${selectedApp?.title ?? "当前公司应用"} 出现问题，需要 CTO 跟进`,
      detail:
        input?.detail ??
        `问题从 ${selectedApp?.title ?? "工作目录"} 反馈，建议 CTO 先复现并给出回访验证结论。`,
      reporterActorId: businessLead?.agentId ?? activeWorkspaceWorkItem?.ownerActorId ?? null,
      reporterLabel:
        businessLead?.nickname ??
        activeWorkspaceWorkItem?.displayOwnerLabel ??
        activeWorkspaceWorkItem?.ownerLabel ??
        null,
      reporterDepartmentId: businessLead?.departmentId ?? activeWorkspaceWorkItem?.owningDepartmentId ?? null,
      ownerActorId: ctoEmployee?.agentId ?? null,
      appId: input?.appId ?? selectedApp?.id ?? null,
      skillId: input?.skillId ?? null,
      contextActionId: input?.contextActionId ?? null,
      contextAppSection: input?.contextAppSection ?? null,
      contextFileKey: input?.contextFileKey ?? null,
      contextFileName: input?.contextFileName ?? null,
      contextRunId: input?.contextRunId ?? null,
      status: "open",
      createdAt: now,
      updatedAt: now,
    });
    await upsertCapabilityAuditEvent({
      id: `capability-audit:${activeCompany.id}:issue:${input?.skillId ?? input?.appId ?? "workspace"}:created:${now}`,
      kind: "issue",
      entityId: issueId,
      action: "created",
      summary: input?.summary ?? `${selectedApp?.title ?? "当前公司应用"} 已登记能力问题`,
      detail:
        input?.detail ??
        `${businessLead?.nickname ?? activeWorkspaceWorkItem?.displayOwnerLabel ?? "业务负责人"} 已把问题正式提交给 CTO 技术中台。`,
      actorId: businessLead?.agentId ?? activeWorkspaceWorkItem?.ownerActorId ?? null,
      actorLabel:
        businessLead?.nickname ??
        activeWorkspaceWorkItem?.displayOwnerLabel ??
        activeWorkspaceWorkItem?.ownerLabel ??
        "业务负责人",
      appId: input?.appId ?? selectedApp?.id ?? null,
      skillId: input?.skillId ?? null,
      issueId,
      createdAt: now,
      updatedAt: now,
    });
    toast.success("已登记能力问题", "问题已经交给 CTO 技术中台继续跟进。");
  };

  const updateSkillStatus = async (skillId: string, status: SkillDefinitionStatus) => {
    const skill = skillDefinitions.find((item) => item.id === skillId) ?? null;
    if (!skill) {
      return;
    }
    if (status === "ready") {
      const readiness = buildSkillReleaseReadiness({
        skill,
        skillRuns,
        workspaceApps,
      });
      if (!readiness.publishable) {
        const missingLabels = readiness.checks.filter((check) => !check.ok).map((check) => check.label);
        toast.error(
          "还不能发布为可用",
          `先补齐：${missingLabels.join("、")}。至少要有一次成功能力验证才能正式发布。`,
        );
        return;
      }
    }
    await upsertSkillDefinition({ ...skill, status, updatedAt: Date.now() });
    const now = Date.now();
    await upsertCapabilityAuditEvent({
      id: `capability-audit:${activeCompany.id}:skill:${skill.id}:status:${now}`,
      kind: "skill",
      entityId: skill.id,
      action: "status_changed",
      summary: `${skill.title} 已切换为${status === "ready" ? "可用" : status === "degraded" ? "降级" : status === "draft" ? "草稿" : "停用"}`,
      detail: `${skill.title} 的平台状态已更新，后续运行与依赖关系会按新状态生效。`,
      actorId: ctoEmployee?.agentId ?? null,
      actorLabel: ctoEmployee?.nickname ?? ctoEmployee?.agentId ?? "CTO",
      appId: skill.appIds?.[0] ?? null,
      skillId: skill.id,
      createdAt: now,
      updatedAt: now,
    });
    if (status === "ready") {
      toast.success("能力已发布为可用", `${skill.title} 现在可以被 App 和流程节点正式依赖。`);
    }
  };

  const runSkillSmokeTest = async (skillId: string) => {
    const skill = skillDefinitions.find((item) => item.id === skillId) ?? null;
    if (!skill) {
      return;
    }
    const triggerApp =
      (skill.appIds ?? [])
        .map((appId) => workspaceApps.find((item) => item.id === appId) ?? null)
        .find((item): item is CompanyWorkspaceApp => Boolean(item))
      ?? selectedApp
      ?? null;
    if ((skill.appIds?.length ?? 0) > 0 && !triggerApp) {
      toast.error("当前还不能跑能力验证", "这条能力依赖关联 App，但当前公司里还没有对应入口。");
      return;
    }
    const now = Date.now();
    let workspaceScriptFallbackMessage: string | null = null;
    const result = await runWorkspaceSkill(
      {
        company: activeCompany,
        skillId,
        skill,
        app: triggerApp,
        manifest: triggerApp ? workspaceAppManifestsById[triggerApp.id] ?? null : null,
        files: workspaceFiles,
        workItemId: activeWorkspaceWorkItem?.id ?? null,
        requestedByActorId: ctoEmployee?.agentId ?? null,
        requestedByLabel: ctoEmployee?.nickname ?? ctoEmployee?.agentId ?? "CTO",
        ownerLabel: ctoEmployee?.nickname ?? ctoEmployee?.agentId ?? "CTO",
        triggerType: "manual",
        triggerActionId: `smoke-test:${skill.id}`,
        triggerLabel: "CTO 工具工坊能力验证",
        now,
      },
      {
        upsertArtifactRecord,
        upsertSkillRun,
        writeWorkspaceApps,
        reportIssue: createCapabilityIssueDraft,
        executeWorkspaceScript: async (input) =>
          attemptWorkspaceScriptExecution({
            ...input,
            onFallback: (message) => {
              workspaceScriptFallbackMessage = message;
            },
          }),
      },
    );

    if (result.status === "succeeded") {
      await upsertCapabilityAuditEvent({
        id: `capability-audit:${activeCompany.id}:run:${result.runId}:smoke-success:${now}`,
        kind: "run",
        entityId: result.runId,
        action: "smoke_test_succeeded",
        summary: `${skill.title} 能力验证已通过`,
        detail: result.detail,
        actorId: ctoEmployee?.agentId ?? null,
        actorLabel: ctoEmployee?.nickname ?? ctoEmployee?.agentId ?? "CTO",
        appId: triggerApp?.id ?? null,
        skillId: skill.id,
        runId: result.runId,
        createdAt: now,
        updatedAt: now,
      });
      const successDetail =
        result.executionMode === "workspace_script"
          ? `${result.detail} 这次能力验证直接运行了 ${result.executionEntryPath ?? "CTO 工作区脚本"}。`
          : workspaceScriptFallbackMessage
            ? `${result.detail} 当前未直接跑到工作区脚本（${workspaceScriptFallbackMessage}），已自动回退到平台桥接。`
            : result.detail;
      toast.success("能力验证已通过", successDetail);
      return;
    }
    await upsertCapabilityAuditEvent({
      id: `capability-audit:${activeCompany.id}:run:${result.runId}:smoke-fail:${now}`,
      kind: "run",
      entityId: result.runId,
      action: "smoke_test_failed",
      summary: `${skill.title} 能力验证未通过`,
      detail: result.detail,
      actorId: ctoEmployee?.agentId ?? null,
      actorLabel: ctoEmployee?.nickname ?? ctoEmployee?.agentId ?? "CTO",
      appId: triggerApp?.id ?? null,
      skillId: skill.id,
      runId: result.runId,
      createdAt: now,
      updatedAt: now,
    });
    toast.error(result.title, result.detail);
  };

  const updateCapabilityRequestStatus = async (requestId: string, status: CapabilityRequestStatus) => {
    const request = capabilityRequests.find((item) => item.id === requestId) ?? null;
    if (!request) {
      return;
    }
    const now = Date.now();
    await upsertCapabilityRequest({ ...request, status, updatedAt: now });
    await upsertCapabilityAuditEvent({
      id: `capability-audit:${activeCompany.id}:request:${request.id}:status:${now}`,
      kind: "request",
      entityId: request.id,
      action: "status_changed",
      summary: `${request.summary} 已进入 ${status}`,
      detail: `${request.summary} 的治理状态已经更新。`,
      actorId: ctoEmployee?.agentId ?? null,
      actorLabel: ctoEmployee?.nickname ?? ctoEmployee?.agentId ?? "CTO",
      appId: request.appId ?? null,
      skillId: request.skillId ?? null,
      requestId: request.id,
      createdAt: now,
      updatedAt: now,
    });
  };

  const updateCapabilityIssueStatus = async (issueId: string, status: CapabilityIssueStatus) => {
    const issue = capabilityIssues.find((item) => item.id === issueId) ?? null;
    if (!issue) {
      return;
    }
    const now = Date.now();
    await upsertCapabilityIssue({ ...issue, status, updatedAt: now });
    await upsertCapabilityAuditEvent({
      id: `capability-audit:${activeCompany.id}:issue:${issue.id}:status:${now}`,
      kind: "issue",
      entityId: issue.id,
      action: "status_changed",
      summary: `${issue.summary} 已进入 ${status}`,
      detail: `${issue.summary} 的治理状态已经更新。`,
      actorId: ctoEmployee?.agentId ?? null,
      actorLabel: ctoEmployee?.nickname ?? ctoEmployee?.agentId ?? "CTO",
      appId: issue.appId ?? null,
      skillId: issue.skillId ?? null,
      issueId: issue.id,
      createdAt: now,
      updatedAt: now,
    });
  };

  const retryActiveCompanyProvisioning = async () => {
    await retryCompanyProvisioning(activeCompany.id);
    toast.success("已触发执行器补齐", "当前公司已重新发起 OpenClaw provisioning，不会阻止你继续使用工作目录。");
  };

  const triggerSkillFromManifest = async (
    skillId: string,
    appId?: string | null,
    triggerActionId?: string | null,
  ) => {
    const triggerApp = (appId ? workspaceApps.find((item) => item.id === appId) : null) ?? selectedApp ?? null;
    const now = Date.now();
    const requestedByActorId = businessLead?.agentId ?? activeWorkspaceWorkItem?.ownerActorId ?? null;
    const requestedByLabel =
      businessLead?.nickname ??
      activeWorkspaceWorkItem?.displayOwnerLabel ??
      activeWorkspaceWorkItem?.ownerLabel ??
      null;
    const skill = skillDefinitions.find((item) => item.id === skillId) ?? null;
    let workspaceScriptFallbackMessage: string | null = null;
    const result = await runWorkspaceSkill(
      {
        company: activeCompany,
        skillId,
        skill,
        app: triggerApp,
        manifest: triggerApp ? workspaceAppManifestsById[triggerApp.id] ?? null : null,
        files: workspaceFiles,
        workItemId: activeWorkspaceWorkItem?.id ?? null,
        requestedByActorId,
        requestedByLabel,
        ownerLabel: ctoEmployee?.nickname ?? ctoEmployee?.agentId ?? "CTO",
        triggerType: "app_action",
        triggerActionId: triggerActionId ?? skillId,
        triggerLabel: triggerApp?.title ?? "工作目录",
        now,
      },
      {
        upsertArtifactRecord,
        upsertSkillRun,
        writeWorkspaceApps,
        reportIssue: createCapabilityIssueDraft,
        executeWorkspaceScript: async (input) =>
          attemptWorkspaceScriptExecution({
            ...input,
            onFallback: (message) => {
              workspaceScriptFallbackMessage = message;
            },
          }),
      },
    );

    if (result.status === "succeeded") {
      await upsertCapabilityAuditEvent({
        id: `capability-audit:${activeCompany.id}:run:${result.runId}:run-success:${now}`,
        kind: "run",
        entityId: result.runId,
        action: "run_succeeded",
        summary: `${triggerApp?.title ?? "工作目录"} 已成功触发 ${skill?.title ?? skillId}`,
        detail: result.detail,
        actorId: requestedByActorId,
        actorLabel: requestedByLabel ?? "业务负责人",
        appId: triggerApp?.id ?? null,
        skillId: skill?.id ?? skillId,
        runId: result.runId,
        createdAt: now,
        updatedAt: now,
      });
      const successDetail =
        result.executionMode === "workspace_script"
          ? `${result.detail} 这次直接运行了 ${result.executionEntryPath ?? "CTO 工作区脚本"}。`
          : workspaceScriptFallbackMessage
            ? `${result.detail} 当前未直接跑到工作区脚本（${workspaceScriptFallbackMessage}），已自动回退到平台桥接。`
            : result.detail;
      toast.success(result.title, successDetail);
      return;
    }
    await upsertCapabilityAuditEvent({
      id: `capability-audit:${activeCompany.id}:run:${result.runId}:run-fail:${now}`,
      kind: "run",
      entityId: result.runId,
      action: "run_failed",
      summary: `${triggerApp?.title ?? "工作目录"} 触发 ${skill?.title ?? skillId} 失败`,
      detail: result.detail,
      actorId: requestedByActorId,
      actorLabel: requestedByLabel ?? "业务负责人",
      appId: triggerApp?.id ?? null,
      skillId: skill?.id ?? skillId,
      runId: result.runId,
      createdAt: now,
      updatedAt: now,
    });
    toast.error(result.title, result.detail);
  };

  return {
    createCapabilityIssueDraft,
    createCapabilityRequestDraft,
    retryActiveCompanyProvisioning,
    runSkillSmokeTest,
    triggerSkillFromManifest,
    updateCapabilityIssueStatus,
    updateCapabilityRequestStatus,
    updateSkillStatus,
    upsertSkillDraft,
  };
}
