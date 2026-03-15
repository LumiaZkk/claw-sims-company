import type { ArtifactResourceType, SharedKnowledgeItem } from "../../../domain/artifact/types";
import type {
  CapabilityAuditEventRecord,
  CapabilityIssueRecord,
  CapabilityIssueStatus,
  CapabilityRequestRecord,
  CapabilityRequestStatus,
  CompanyWorkspaceAppKind,
  CompanyWorkspaceAppStatus,
  CompanyWorkspaceAppSurface,
  CompanyWorkspaceAppTemplate,
  SkillDefinition,
  SkillDefinitionStatus,
  SkillRunRecord,
  WorkflowCapabilityBinding,
} from "../../../domain/org/types";
import type {
  ResolvedWorkflowCapabilityBinding,
  WorkspaceAppManifest,
  WorkspaceAppManifestAction,
  WorkspaceEmbeddedAppRuntime,
  WorkspaceFileRow,
  WorkspacePolicySummary,
  WorkspaceReaderIndex,
  WorkspaceReaderManifest,
  WorkspaceWorkbenchTool,
} from "../../../application/workspace";

export type WorkspaceAppSummary = {
  id: string;
  kind: CompanyWorkspaceAppKind;
  icon: string;
  title: string;
  description: string;
  summary?: string;
  status: CompanyWorkspaceAppStatus;
  surface?: CompanyWorkspaceAppSurface;
  template?: CompanyWorkspaceAppTemplate;
  manifestArtifactId?: string | null;
  embeddedHostKey?: string | null;
  embeddedPermissions?: {
    resources: "manifest-scoped";
    appState: "readwrite" | "readonly";
    companyWrites: "none";
    actions: "whitelisted" | "none";
  } | null;
};

export const artifactResourceTypeLabel: Record<ArtifactResourceType, string> = {
  document: "文档",
  report: "报告",
  dataset: "数据",
  media: "媒体",
  state: "状态",
  tool: "工具",
  other: "其他",
};

export const resourceOriginLabel: Record<WorkspaceFileRow["resourceOrigin"], string> = {
  declared: "正式资源",
  manifest: "Manifest",
  inferred: "推断",
};

export type WorkspaceAnchor = {
  id: string;
  label: string;
  found: boolean;
};

export type WorkspacePageContentProps = {
  activeCompanyName: string;
  workspaceApps: WorkspaceAppSummary[];
  workspaceAppsAreExplicit: boolean;
  selectedApp: WorkspaceAppSummary;
  selectedAppManifest: WorkspaceAppManifest | null;
  selectedFile: WorkspaceFileRow | null;
  selectedFileKey: string | null;
  selectedFileContent: string;
  loadingFileKey: string | null;
  embeddedRuntime: WorkspaceEmbeddedAppRuntime<WorkspaceFileRow> | null;
  activeWorkspaceWorkItem: {
    id: string;
    title: string;
    displayOwnerLabel: string;
    ownerLabel: string;
    displayStage: string;
    stageLabel: string;
    displayNextAction: string;
    nextAction: string;
  } | null;
  artifactBackedWorkspaceCount: number;
  mirroredOnlyWorkspaceCount: number;
  shouldSyncProviderWorkspace: boolean;
  workspacePolicySummary: WorkspacePolicySummary;
  chapterFiles: WorkspaceFileRow[];
  canonFiles: WorkspaceFileRow[];
  reviewFiles: WorkspaceFileRow[];
  readerIndex: WorkspaceReaderIndex;
  readerManifest: WorkspaceReaderManifest | null;
  knowledgeFiles: WorkspaceFileRow[];
  knowledgeItems: SharedKnowledgeItem[];
  selectedKnowledgeItem: SharedKnowledgeItem | null;
  selectedKnowledgeSourceFiles: WorkspaceFileRow[];
  toolingFiles: WorkspaceFileRow[];
  supplementaryFiles: WorkspaceFileRow[];
  workspaceFiles: WorkspaceFileRow[];
  anchors: WorkspaceAnchor[];
  workflowCapabilityBindingCatalog: WorkflowCapabilityBinding[];
  workflowCapabilityBindingsAreExplicit: boolean;
  workflowCapabilityBindings: ResolvedWorkflowCapabilityBinding[];
  skillDefinitions: SkillDefinition[];
  skillRuns: SkillRunRecord[];
  capabilityRequests: CapabilityRequestRecord[];
  capabilityIssues: CapabilityIssueRecord[];
  capabilityAuditEvents: CapabilityAuditEventRecord[];
  manifestRegistrationCandidateCount: number;
  ctoLabel: string | null;
  businessLeadLabel: string | null;
  publishedAppTemplates: CompanyWorkspaceAppTemplate[];
  loadingIndex: boolean;
  executorProvisioning: {
    state: "ready" | "degraded" | "blocked";
    pendingAgentIds?: string[];
    lastError?: string | null;
    updatedAt: number;
  } | null;
  onRefreshIndex: () => void;
  onRetryCompanyProvisioning: () => void | Promise<void>;
  onRunAppManifestAction: (action: WorkspaceAppManifestAction) => void | Promise<void>;
  onSelectApp: (appId: string) => void;
  onSelectFile: (fileKey: string) => void;
  onSelectEmbeddedSection: (section: string) => void;
  onSelectEmbeddedFile: (fileKey: string) => void;
  onSelectKnowledge: (knowledgeId: string) => void;
  onOpenCtoWorkbench: (tool: WorkspaceWorkbenchTool) => void;
  onPublishTemplateApp: (template: "reader" | "consistency" | "review-console" | "dashboard") => void | Promise<void>;
  onRegisterExistingApp: () => void | Promise<void>;
  onGenerateAppManifestDraft: (appId?: string) => void | Promise<void>;
  onCreateSkillDraft: (tool: WorkspaceWorkbenchTool) => void | Promise<void>;
  onCreateCapabilityRequest: (tool: WorkspaceWorkbenchTool) => void | Promise<void>;
  onCreateCapabilityIssue: (input?: {
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
  }) => void | Promise<void>;
  onUpdateSkillStatus: (skillId: string, status: SkillDefinitionStatus) => void | Promise<void>;
  onRunSkillSmokeTest: (skillId: string) => void | Promise<void>;
  onTriggerSkill: (skillId: string, appId?: string | null) => void | Promise<void>;
  onPublishWorkflowCapabilityBindings: () => void | Promise<void>;
  onRestoreWorkflowCapabilityBindings: () => void | Promise<void>;
  onToggleWorkflowCapabilityBindingRequired: (bindingId: string) => void | Promise<void>;
  onUpdateCapabilityRequestStatus: (
    requestId: string,
    status: CapabilityRequestStatus,
  ) => void | Promise<void>;
  onUpdateCapabilityIssueStatus: (
    issueId: string,
    status: CapabilityIssueStatus,
  ) => void | Promise<void>;
  onPublishRecommendedApps?: () => void;
  onOpenFileChat: (agentId: string) => void;
  onOpenCtoChat: () => void;
  onOpenRequirementCenter?: () => void;
};
