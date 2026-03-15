import {
  buildWorkspaceAppManifestDraft,
  type CompanyWorkspaceApp,
} from "../../application/workspace";
import {
  buildRecommendedWorkspaceApps,
  publishWorkspaceApp,
  registerWorkspaceApp,
  resolveWorkspaceAppTemplate,
} from "../../application/company/workspace-apps";
import { toast } from "../../system/toast-store";
import { getAppManifestArtifactId, getAppManifestFileName } from "./workspace-page-constants";
import type { UseWorkspacePageActionsParams } from "./workspace-page-action-types";

export function createWorkspacePageAppActions({
  activeCompany,
  activeWorkspaceWorkItem,
  ctoEmployee,
  primaryRegisterableAppManifest,
  registerableAppManifestCandidates,
  selectedApp,
  setSelectedAppId,
  upsertArtifactRecord,
  workspaceApps,
  workspaceFiles,
  writeWorkflowCapabilityBindings,
  workflowCapabilityBindingCatalog,
  writeWorkspaceApps,
}: UseWorkspacePageActionsParams) {
  const publishRecommendedApps = async () => {
    const recommendedApps = buildRecommendedWorkspaceApps(activeCompany);
    if (recommendedApps.length === 0) {
      toast.error("当前公司没有可固化的推荐应用", "先让 CTO 或业务团队明确这家公司真正需要哪些入口。");
      return;
    }

    await writeWorkspaceApps(recommendedApps);
    toast.success("已固化公司应用", "当前公司的工作目录入口已经从系统补位变成显式挂载。");
  };

  const publishWorkflowCapabilityBindings = async () => {
    if (workflowCapabilityBindingCatalog.length === 0) {
      toast.error("当前没有可固化的流程绑定", "先让这家公司命中默认流程绑定，或后续再补自定义规则。");
      return;
    }
    await writeWorkflowCapabilityBindings(workflowCapabilityBindingCatalog);
    toast.success("已固化流程绑定", "当前公司的阶段能力绑定已经从默认推荐变成显式组织配置。");
  };

  const restoreWorkflowCapabilityBindings = async () => {
    await writeWorkflowCapabilityBindings([]);
    toast.success("已恢复默认流程绑定", "当前公司会重新回到系统默认推荐的能力绑定。");
  };

  const toggleWorkflowCapabilityBindingRequired = async (bindingId: string) => {
    const target = workflowCapabilityBindingCatalog.find((binding) => binding.id === bindingId) ?? null;
    if (!target) {
      return;
    }
    const nextBindings = workflowCapabilityBindingCatalog.map((binding) =>
      binding.id === bindingId ? { ...binding, required: !binding.required } : binding,
    );
    await writeWorkflowCapabilityBindings(nextBindings);
    toast.success(
      target.required ? "已改成建议能力" : "已改成必用能力",
      `${target.label} 现在已经写入这家公司的显式流程绑定配置。`,
    );
  };

  const publishTemplateApp = async (
    template: "reader" | "consistency" | "review-console" | "dashboard",
  ) => {
    const nextApps = publishWorkspaceApp(activeCompany, {
      template,
      title:
        template === "reader"
          ? "内容查看器"
          : template === "consistency"
            ? "规则与校验"
            : template === "dashboard"
              ? "工作目录仪表盘"
              : undefined,
      description:
        template === "reader"
          ? "围绕当前公司的主体内容、参考资料、报告和版本切换提供统一查看入口。"
          : template === "consistency"
            ? "围绕关键参考资料、规则和状态流转管理当前公司的真相源与校验入口。"
            : template === "review-console"
              ? "把对象状态、验收结论和交付前检查结果收进同一个控制台。"
              : template === "dashboard"
                ? "把状态数据、异常样本和关键结果聚合成受控仪表盘。"
                : undefined,
      surface: template === "review-console" || template === "dashboard" ? "embedded" : undefined,
      embeddedHostKey:
        template === "review-console"
          ? "review-console"
          : template === "dashboard"
            ? "dashboard"
            : undefined,
      embeddedPermissions:
        template === "review-console" || template === "dashboard"
          ? {
              resources: "manifest-scoped",
              appState: "readwrite",
              companyWrites: "none",
              actions: "whitelisted",
            }
          : undefined,
      ownerAgentId: ctoEmployee?.agentId,
    });
    const nextApp = nextApps.find((app) => resolveWorkspaceAppTemplate(app) === template) ?? null;
    await writeWorkspaceApps(nextApps);
    if (nextApp) {
      setSelectedAppId(nextApp.id);
    }
    toast.success(
      template === "reader"
        ? "已发布内容查看 App"
        : template === "consistency"
          ? "已发布规则与校验 App"
          : template === "dashboard"
            ? "已发布工作目录仪表盘"
            : "已发布审阅与预检 App",
      "当前模板 App 已经正式挂到这家公司里，后续可以继续沿着这个入口迭代。",
    );
  };

  const registerExistingAppFromManifest = async (artifactId?: string) => {
    const candidate =
      (artifactId
        ? registerableAppManifestCandidates.find((item) => item.artifactId === artifactId) ?? null
        : primaryRegisterableAppManifest)
      ?? null;
    if (!candidate) {
      toast.error("当前没有可注册的 AppManifest", "先让 CTO 产出显式 manifest，再把它注册成正式公司应用。");
      return;
    }
    const nextApps = registerWorkspaceApp(activeCompany, {
      id: candidate.appId ?? `app:${candidate.slug}`,
      slug: candidate.slug,
      title: candidate.title,
      description: `由 ${candidate.fileName} 注册的公司内 App，后续继续通过 manifest 和受控宿主迭代。`,
      summary: candidate.sourceLabel
        ? `${candidate.sourceLabel} 提供的显式 App 契约。`
        : "由显式 AppManifest 注册的公司内 App。",
      status: "ready",
      ownerAgentId: ctoEmployee?.agentId,
      visibility: "company",
      shareScope: "company",
      surface: "embedded",
      template: "generic-app",
      manifestArtifactId: candidate.artifactId,
      embeddedHostKey: "generic-app",
      implementation: {
        kind: "embedded",
        preset: null,
        entry: null,
      },
      runtime: {
        kind: "controlled-host",
        permissions: {
          resources: "manifest-scoped",
          appState: "readwrite",
          companyWrites: "none",
          actions: "whitelisted",
        },
      },
      embeddedPermissions: {
        resources: "manifest-scoped",
        appState: "readwrite",
        companyWrites: "none",
        actions: "whitelisted",
      },
    });
    await writeWorkspaceApps(nextApps);
    const nextApp = nextApps.find((app) => app.manifestArtifactId === candidate.artifactId) ?? null;
    if (nextApp) {
      setSelectedAppId(nextApp.id);
    }
    toast.success("已注册公司内 App", `${candidate.title} 已通过显式 manifest 挂载到当前公司。`);
  };

  const generateAppManifestDraft = async (targetApp: CompanyWorkspaceApp = selectedApp) => {
    const draft = buildWorkspaceAppManifestDraft({
      app: targetApp,
      files: workspaceFiles,
      title: `${activeCompany.name} · ${targetApp.title} AppManifest 草案`,
      sourceLabel: "系统草案",
    });

    if (!draft) {
      toast.error(
        "当前还无法生成 AppManifest 草案",
        "工作目录里还没有足够明确的资源候选文件，先让团队把可读产物或报告固化下来。",
      );
      return;
    }

    const now = Date.now();
    const manifestArtifactId = getAppManifestArtifactId(activeCompany.id, targetApp.id);
    const fileName = getAppManifestFileName(targetApp);
    upsertArtifactRecord({
      id: manifestArtifactId,
      workItemId: activeWorkspaceWorkItem?.id ?? null,
      title: fileName,
      kind: "app_manifest",
      status: "draft",
      ownerActorId: ctoEmployee?.agentId ?? null,
      sourceActorId: ctoEmployee?.agentId ?? null,
      sourceName: fileName,
      sourcePath: fileName,
      summary: `系统根据当前工作目录自动生成的 ${targetApp.title} AppManifest 草案，待 CTO 校准资源分区和动作。`,
      content: JSON.stringify(draft, null, 2),
      resourceType: "other",
      resourceTags: ["tech.app-manifest", `app.${targetApp.slug}`],
      createdAt: now,
      updatedAt: now,
    });

    const nextApps = workspaceApps.map((app) =>
      app.id === targetApp.id ? { ...app, manifestArtifactId } : app,
    );
    await writeWorkspaceApps(nextApps);
    toast.success(
      "已生成 AppManifest 草案",
      `${targetApp.title} 已经接入一份显式 manifest，后续 CTO 可以继续校准资源分区和动作。`,
    );
  };

  const generateAppManifestDraftById = async (appId?: string) => {
    const targetApp = appId ? workspaceApps.find((app) => app.id === appId) ?? selectedApp : selectedApp;
    await generateAppManifestDraft(targetApp);
  };

  return {
    generateAppManifestDraft,
    generateAppManifestDraftById,
    publishRecommendedApps,
    publishTemplateApp,
    publishWorkflowCapabilityBindings,
    registerExistingAppFromManifest,
    restoreWorkflowCapabilityBindings,
    toggleWorkflowCapabilityBindingRequired,
  };
}
