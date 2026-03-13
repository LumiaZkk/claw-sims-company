import type { ArtifactResourceType } from "../../domain/artifact/types";
import type {
  CompanyWorkspaceAppEmbeddedPermissions,
  CompanyWorkspaceAppTemplate,
} from "../../domain/org/types";
import {
  getWorkspaceAppFilesForSection,
  type WorkspaceAppManifest,
  type WorkspaceAppManifestAction,
} from "./app-manifest";
import {
  isWorkspaceEmbeddedAppSnapshotEqual,
  withWorkspaceEmbeddedAppSelection,
  type WorkspaceEmbeddedAppSnapshot,
} from "./embedded-app-state";

type EmbeddedRuntimeFile = {
  key: string;
  name: string;
  path: string;
  resourceType: ArtifactResourceType;
  tags: string[];
  updatedAtMs?: number;
};

type EmbeddedRuntimeApp = {
  id: string;
  title: string;
  template?: CompanyWorkspaceAppTemplate;
  manifestArtifactId?: string | null;
  embeddedHostKey?: string | null;
  embeddedPermissions?: CompanyWorkspaceAppEmbeddedPermissions | null;
};

type WorkspaceEmbeddedApiDescriptor = {
  id: string;
  label: string;
  description: string;
};

export type WorkspaceEmbeddedAppRuntimeSection<TFile extends EmbeddedRuntimeFile> = {
  id: string;
  label: string;
  slot: string;
  order: number;
  emptyState: string | null;
  active: boolean;
  files: TFile[];
};

export type WorkspaceEmbeddedAppRuntime<TFile extends EmbeddedRuntimeFile> = {
  appId: string;
  appTitle: string;
  hostKey: string;
  hostTitle: string;
  hostDescription: string;
  manifestStatus: "missing" | "default" | "bound";
  permissions: CompanyWorkspaceAppEmbeddedPermissions;
  apis: WorkspaceEmbeddedApiDescriptor[];
  sections: WorkspaceEmbeddedAppRuntimeSection<TFile>[];
  activeSectionSlot: string | null;
  activeSection: WorkspaceEmbeddedAppRuntimeSection<TFile> | null;
  visibleFiles: TFile[];
  allFiles: TFile[];
  totalScopedResources: number;
  latestFile: TFile | null;
  lastAction: WorkspaceAppManifestAction | null;
  selectedFileKey: string | null;
  selectedFile: TFile | null;
  snapshot: WorkspaceEmbeddedAppSnapshot;
};

const DEFAULT_EMBEDDED_PERMISSIONS: CompanyWorkspaceAppEmbeddedPermissions = {
  resources: "manifest-scoped",
  appState: "readwrite",
  companyWrites: "none",
  actions: "whitelisted",
};

function resolveEmbeddedHostMeta(hostKey: string): {
  title: string;
  description: string;
} {
  switch (hostKey) {
    case "review-console":
      return {
        title: "审阅控制台宿主",
        description:
          "把报告、预检和最终判断收在同一个受控壳子里。业务负责人打开后能先看事实，再决定是否触发下一步动作。",
      };
    case "dashboard":
      return {
        title: "仪表盘宿主",
        description: "把状态数据和关键结果聚合成可读页面，同时保留显式动作入口。",
      };
    default:
      return {
        title: "嵌入式 App 宿主",
        description:
          "这个公司内 App 运行在受控宿主中，只能读取 manifest 范围内资源、保存轻量状态，并触发白名单动作。",
      };
  }
}

function resolveEmbeddedApiDescriptors(
  permissions: CompanyWorkspaceAppEmbeddedPermissions,
): WorkspaceEmbeddedApiDescriptor[] {
  return [
    {
      id: "resources.read-scoped",
      label: "读取作用域资源",
      description:
        permissions.resources === "manifest-scoped"
          ? "只允许读取 manifest 选中的资源，避免宿主越权扫全公司数据。"
          : "当前没有声明资源读取权限。",
    },
    {
      id: "app-state",
      label: permissions.appState === "readwrite" ? "读写本地状态" : "只读本地状态",
      description:
        permissions.appState === "readwrite"
          ? "宿主可以保存当前分区、选中的资源和最近动作等轻量本地状态。"
          : "宿主只能读取已有本地状态，不能持久化新的交互选择。",
    },
    {
      id: "actions",
      label: permissions.actions === "whitelisted" ? "触发白名单动作" : "动作已禁用",
      description:
        permissions.actions === "whitelisted"
          ? "只能触发 AppManifest 明确声明过的动作，不允许任意执行。"
          : "当前宿主不允许直接触发动作。",
    },
    {
      id: "company-writes",
      label: "禁止直接写公司主数据",
      description:
        permissions.companyWrites === "none"
          ? "公司主数据只能通过平台桥接写入，宿主本身没有直写权限。"
          : "当前宿主存在额外写入权限，请谨慎检查配置。",
    },
  ];
}

export function resolveWorkspaceEmbeddedAppRuntime<TFile extends EmbeddedRuntimeFile>(input: {
  app: EmbeddedRuntimeApp;
  manifest: WorkspaceAppManifest | null;
  files: TFile[];
  snapshot: WorkspaceEmbeddedAppSnapshot;
}): WorkspaceEmbeddedAppRuntime<TFile> {
  const manifest = input.manifest;
  const permissions = input.app.embeddedPermissions ?? DEFAULT_EMBEDDED_PERMISSIONS;
  const hostKey = input.app.embeddedHostKey ?? input.app.template ?? "generic";
  const hostMeta = resolveEmbeddedHostMeta(hostKey);
  const manifestStatus = !manifest
    ? "missing"
    : input.app.manifestArtifactId
      ? "bound"
      : "default";

  const sections: WorkspaceEmbeddedAppRuntimeSection<TFile>[] = manifest
    ? [...manifest.sections]
        .sort((left, right) => left.order - right.order)
        .map((section) => ({
          id: section.id,
          label: section.label,
          slot: section.slot,
          order: section.order,
          emptyState: section.emptyState ?? null,
          active: false,
          files: getWorkspaceAppFilesForSection(input.files, manifest, section.slot),
        }))
    : [];

  const activeSectionSlot = input.snapshot.activeSectionSlot
    && sections.some((section) => section.slot === input.snapshot.activeSectionSlot)
    ? input.snapshot.activeSectionSlot
    : (sections[0]?.slot ?? null);
  const normalizedSections = sections.map((section) => ({
    ...section,
    active: section.slot === activeSectionSlot,
  }));
  const activeSection =
    (activeSectionSlot
      ? normalizedSections.find((section) => section.slot === activeSectionSlot)
      : null) ?? null;
  const visibleFiles = activeSection?.files ?? [];
  const allFiles = normalizedSections.flatMap((section) => section.files);
  const selectedFile =
    (input.snapshot.selectedFileKey
      ? allFiles.find((file) => file.key === input.snapshot.selectedFileKey)
      : null) ??
    visibleFiles[0] ??
    allFiles[0] ??
    null;
  const selectedFileKey = selectedFile?.key ?? null;
  const lastAction =
    input.snapshot.lastActionId && manifest?.actions
      ? manifest.actions.find((action) => action.id === input.snapshot.lastActionId) ?? null
      : null;
  const latestFile =
    [...allFiles].sort((left, right) => (right.updatedAtMs ?? 0) - (left.updatedAtMs ?? 0))[0] ?? null;
  const nextSnapshot = withWorkspaceEmbeddedAppSelection(input.snapshot, {
    activeSectionSlot,
    selectedFileKey,
    lastActionId: lastAction?.id ?? null,
  });

  return {
    appId: input.app.id,
    appTitle: input.app.title,
    hostKey,
    hostTitle: hostMeta.title,
    hostDescription: hostMeta.description,
    manifestStatus,
    permissions,
    apis: resolveEmbeddedApiDescriptors(permissions),
    sections: normalizedSections,
    activeSectionSlot,
    activeSection,
    visibleFiles,
    allFiles,
    totalScopedResources: allFiles.length,
    latestFile,
    lastAction,
    selectedFileKey,
    selectedFile,
    snapshot: isWorkspaceEmbeddedAppSnapshotEqual(input.snapshot, nextSnapshot)
      ? input.snapshot
      : nextSnapshot,
  };
}
