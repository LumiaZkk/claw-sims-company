import type { SharedKnowledgeItem } from "../artifact/types";
import type {
  DecisionTicketRecord,
  EscalationRecord,
  HandoffRecord,
  RequestRecord,
  SupportRequestRecord,
  TakeoverCaseRecord,
} from "../delegation/types";
import type { TrackedTask } from "../mission/types";
import type { RetrospectiveRecord } from "../governance/types";
import type { ApprovalRecord } from "../governance/types";
import type { ArtifactResourceType } from "../artifact/types";
import type { MetaRole } from "../meta-agent/types";

export interface CyberCompanyConfig {
  version: 1;
  companies: Company[];
  activeCompanyId: string;
  preferences: { theme: string; locale: string };
}

export interface Company {
  id: string;
  name: string;
  description: string;
  icon: string;
  template: string;
  system?: CompanySystemMetadata;
  orgSettings?: CompanyOrgSettings;
  departments?: Department[];
  employees: EmployeeRef[];
  talentMarket?: TalentMarketState;
  quickPrompts: QuickPrompt[];
  workspaceApps?: CompanyWorkspaceApp[];
  workflowCapabilityBindings?: WorkflowCapabilityBinding[];
  skillDefinitions?: SkillDefinition[];
  skillRuns?: SkillRunRecord[];
  automationRuns?: AutomationRunRecord[];
  capabilityRequests?: CapabilityRequestRecord[];
  capabilityIssues?: CapabilityIssueRecord[];
  capabilityAuditEvents?: CapabilityAuditEventRecord[];
  tasks?: TrackedTask[];
  takeoverCases?: TakeoverCaseRecord[];
  handoffs?: HandoffRecord[];
  requests?: RequestRecord[];
  supportRequests?: SupportRequestRecord[];
  escalations?: EscalationRecord[];
  decisionTickets?: DecisionTicketRecord[];
  approvals?: ApprovalRecord[];
  knowledgeItems?: SharedKnowledgeItem[];
  retrospectives?: RetrospectiveRecord[];
  createdAt: number;
}

export interface CompanySystemMetadata {
  reserved?: boolean;
  kind?: "openclaw-main";
  mappedAgentId?: string;
  executorProvisioning?: {
    state: "ready" | "degraded" | "blocked";
    pendingAgentIds?: string[];
    lastError?: string | null;
    updatedAt: number;
  };
  platformCloseout?: {
    signature: string;
    status: "ready" | "in_progress" | "attention";
    readyCount: number;
    inProgressCount: number;
    attentionCount: number;
    totalCount: number;
    updatedAt: number;
  };
}

export interface CompanyOrgSettings {
  autoCalibrate?: boolean;
  lastAutoCalibratedAt?: number;
  lastAutoCalibrationActions?: string[];
  autonomyPolicy?: CompanyAutonomyPolicy;
  autonomyState?: CompanyAutonomyState;
  heartbeatPolicy?: CompanyHeartbeatPolicy;
  collaborationPolicy?: CompanyCollaborationPolicy;
  workspacePolicy?: CompanyWorkspacePolicy;
}

export interface CompanyAutonomyPolicy {
  autoApproveInternalReassignments?: boolean;
  autoApproveSupportRequests?: boolean;
  humanApprovalRequiredForLayoffs?: boolean;
  humanApprovalRequiredForDepartmentCreateRemove?: boolean;
  humanApprovalRequiredForAutomationEnable?: boolean;
  automationMonthlyBudgetUsd?: number;
  maxAutoHeadcountDelta?: number;
  maxAutoBudgetDelta?: number;
  supportSlaHours?: number;
  departmentBlockerEscalationHours?: number;
}

export interface CompanyDepartmentAutonomyCounter {
  departmentId: string;
  overloadStreak: number;
  underloadStreak: number;
  lastLoadScore: number;
  updatedAt: number;
}

export interface CompanyHeartbeatPolicy {
  enabled?: boolean;
  paused?: boolean;
  intervalMinutes?: number;
  sourceOfTruth?: "cyber_company";
  syncTarget?: "openclaw" | "none";
}

export interface CompanyAutonomyState {
  lastEngineRunAt?: number;
  lastEngineActions?: string[];
  lastHeartbeatCheckAt?: number;
  lastHeartbeatTrigger?: "interval" | "event";
  lastHeartbeatSkipReason?: string | null;
  departmentCounters?: CompanyDepartmentAutonomyCounter[];
}

export interface CollaborationEdge {
  fromAgentId?: string;
  fromDepartmentId?: string;
  toAgentId?: string;
  toDepartmentId?: string;
}

export interface CompanyCollaborationPolicy {
  globalDispatchMetaRoles?: MetaRole[];
  allowDepartmentLeadToDispatchWithinDepartment?: boolean;
  allowDepartmentLeadToDispatchToSupportLeads?: boolean;
  allowDepartmentLeadToDispatchToCeo?: boolean;
  allowDepartmentMembersWithinDepartment?: boolean;
  allowDepartmentMembersToManager?: boolean;
  explicitEdges?: CollaborationEdge[];
}

export interface CompanyWorkspacePolicy {
  deliverySource?: "artifact_store";
  providerMirrorMode?: "fallback" | "disabled";
  executorWriteTarget?: "agent_workspace" | "delivery_artifacts";
}

export interface Department {
  id: string;
  name: string;
  leadAgentId: string;
  kind?: "meta" | "support" | "business";
  color?: string;
  order?: number;
  missionPolicy?: "support_only" | "manager_delegated" | "direct_execution";
  archived?: boolean;
}

export interface EmployeeRef {
  agentId: string;
  nickname: string;
  role: string;
  isMeta: boolean;
  metaRole?: MetaRole;
  reportsTo?: string;
  departmentId?: string;
  avatarJobId?: string;
  templateBinding?: EmployeeTemplateBinding;
  hireProvenance?: HireProvenance;
  bootstrapBundle?: HireBootstrapBundle;
}

export type AgentTemplateStatus = "draft" | "ready" | "deprecated" | "retired";

export type AgentTemplateDefinition = {
  id: string;
  title: string;
  summary: string;
  roleFamily?: string | null;
  tags?: string[];
  domainTags?: string[];
  collaborationTags?: string[];
  baseSoul?: string | null;
  strengths?: string[];
  cautions?: string[];
  defaultTraits?: string | null;
  recommendedModelTier?: "standard" | "reasoning" | "ultra";
  defaultBudgetUsd?: number | null;
  recommendedSkills?: string[];
  recommendedApps?: string[];
  sourceType?: string;
  sourceRef?: {
    repo?: string | null;
    path?: string | null;
    commit?: string | null;
    license?: string | null;
    note?: string | null;
  } | string | null;
  qualityScore?: number | null;
  validationScore?: number | null;
  adoptionCount?: number;
  status: AgentTemplateStatus;
  updatedAt: number;
};

export type HireIntent = {
  companyId: string;
  rolePrompt: string;
  businessContext: string;
  departmentName?: string | null;
  reportsTo?: string | null;
  desiredModelTier?: "standard" | "reasoning" | "ultra";
  budgetUsd?: number | null;
  mustHaveTags?: string[];
  avoidTags?: string[];
  operatorNotes?: string | null;
};

export type TemplateMatch = {
  templateId: string;
  score: number;
  confidence: number;
  reasons: string[];
  gaps: string[];
  autoAdoptEligible: boolean;
};

export type HireBootstrapBundle = {
  roleMd: string;
  soulMd?: string | null;
  onboardingMd?: string | null;
  quickPrompts?: Array<{ label: string; prompt: string }>;
  recommendedSkills?: string[];
};

export type HireProvenance = {
  templateId?: string | null;
  sourceType: string;
  reasons: string[];
};

export type CompiledHireDraft = {
  companyId: string;
  templateId?: string | null;
  sourceType: string;
  role: string;
  description: string;
  nickname?: string | null;
  reportsTo?: string | null;
  departmentName?: string | null;
  modelTier?: "standard" | "reasoning" | "ultra";
  budget?: number | null;
  traits?: string | null;
  bootstrapBundle: HireBootstrapBundle;
  provenance: HireProvenance;
};

export type EmployeeTemplateBinding = {
  templateId: string | null;
  sourceType: "template" | "blank";
  compiledAt: number;
  compilerVersion: string;
  confidence: number | null;
};

export type TemplateFeedbackSignal = {
  templateId: string;
  event: "adopted" | "rejected" | "performance" | "promote" | "retire";
  score?: number | null;
  note?: string | null;
  occurredAt?: number;
};

export type TalentMarketState = {
  templates: AgentTemplateDefinition[];
  updatedAt?: number;
};

export interface QuickPrompt {
  label: string;
  icon: string;
  prompt: string;
  targetAgentId: string;
}

export type CompanyWorkspaceAppKind =
  | "novel-reader"
  | "consistency-hub"
  | "knowledge-hub"
  | "cto-workbench"
  | "custom";

export type CompanyWorkspaceAppStatus = "ready" | "recommended" | "building";

export type CompanyWorkspaceAppSurface = "template" | "embedded";
export type CompanyWorkspaceAppVisibility = "company" | "leadership" | "private";
export type CompanyWorkspaceAppShareScope = "company" | "department" | "leadership";

export type CompanyWorkspaceAppTemplate =
  | "reader"
  | "consistency"
  | "knowledge"
  | "workbench"
  | "review-console"
  | "dashboard"
  | "generic-app";

export interface CompanyWorkspaceAppEmbeddedPermissions {
  resources: "manifest-scoped";
  appState: "readwrite" | "readonly";
  companyWrites: "none";
  actions: "whitelisted" | "none";
}

export interface CompanyWorkspaceAppImplementation {
  kind: "preset" | "embedded";
  preset?: CompanyWorkspaceAppTemplate | null;
  entry?: string | null;
}

export interface CompanyWorkspaceAppRuntimeContract {
  kind: "controlled-host";
  permissions: CompanyWorkspaceAppEmbeddedPermissions;
}

export interface CompanyWorkspaceApp {
  id: string;
  slug: string;
  title: string;
  description: string;
  summary?: string;
  icon: string;
  kind: CompanyWorkspaceAppKind;
  status: CompanyWorkspaceAppStatus;
  ownerAgentId?: string;
  visibility?: CompanyWorkspaceAppVisibility;
  shareScope?: CompanyWorkspaceAppShareScope;
  implementation?: CompanyWorkspaceAppImplementation | null;
  runtime?: CompanyWorkspaceAppRuntimeContract | null;
  surface?: CompanyWorkspaceAppSurface;
  template?: CompanyWorkspaceAppTemplate;
  manifestArtifactId?: string | null;
  embeddedHostKey?: string | null;
  embeddedPermissions?: CompanyWorkspaceAppEmbeddedPermissions | null;
}

export interface WorkflowCapabilityBinding {
  id: string;
  label: string;
  required: boolean;
  guidance?: string | null;
  titleMatchers?: string[];
  stageMatchers?: string[];
  nextActionMatchers?: string[];
  appIds?: string[];
  appTemplates?: CompanyWorkspaceAppTemplate[];
  skillIds?: string[];
}

export type SkillDefinitionStatus = "draft" | "ready" | "degraded" | "retired";
export type SkillDefinitionTrigger = "app_action" | "workflow_step";
export type SkillRunTrigger = SkillDefinitionTrigger | "manual";
export type SkillRunStatus = "pending" | "running" | "succeeded" | "failed" | "cancelled";
export type SkillRunExecutionMode = "builtin_bridge" | "workspace_script";
export type AutomationRunStatus = "running" | "succeeded" | "failed" | "cancelled" | "unknown";

export interface SkillDefinition {
  id: string;
  title: string;
  summary: string;
  ownerAgentId: string;
  status: SkillDefinitionStatus;
  entryPath: string;
  inputSchema?: Record<string, unknown>;
  outputSchema?: Record<string, unknown>;
  writesResourceTypes?: ArtifactResourceType[];
  allowedTriggers: SkillDefinitionTrigger[];
  smokeTest?: string | null;
  manifestActionIds?: string[];
  appIds?: string[];
  createdAt: number;
  updatedAt: number;
}

export interface SkillRunRecord {
  id: string;
  skillId: string;
  appId?: string | null;
  triggerType: SkillRunTrigger;
  triggerActionId?: string | null;
  triggerLabel?: string | null;
  requestedByActorId?: string | null;
  requestedByLabel?: string | null;
  status: SkillRunStatus;
  executionMode?: SkillRunExecutionMode | null;
  executionEntryPath?: string | null;
  executionNote?: string | null;
  inputSchemaVersion?: number;
  inputSummary?: string;
  inputResourceCount?: number;
  inputResourceTypes?: ArtifactResourceType[];
  resultSummary?: string;
  outputArtifactIds?: string[];
  outputResourceTypes?: ArtifactResourceType[];
  errorMessage?: string | null;
  startedAt: number;
  completedAt?: number | null;
  updatedAt: number;
}

export interface AutomationRunRecord {
  id: string;
  automationId: string;
  automationName: string;
  agentId?: string | null;
  status: AutomationRunStatus;
  providerStatus?: string | null;
  message?: string | null;
  scheduleKind?: string | null;
  scheduleExpr?: string | null;
  scheduleEveryMs?: number | null;
  runAt: number;
  nextRunAt?: number | null;
  createdAt: number;
  observedAt: number;
  updatedAt: number;
}

export type CapabilityRequestType = "tool" | "app" | "check" | "import";
export type CapabilityRequestStatus =
  | "open"
  | "triaged"
  | "building"
  | "ready"
  | "verified"
  | "closed";

export interface CapabilityRequestRecord {
  id: string;
  type: CapabilityRequestType;
  summary: string;
  detail?: string;
  requesterActorId?: string | null;
  requesterLabel?: string | null;
  requesterDepartmentId?: string | null;
  ownerActorId?: string | null;
  appId?: string | null;
  skillId?: string | null;
  contextActionId?: string | null;
  contextAppSection?: string | null;
  contextFileKey?: string | null;
  contextFileName?: string | null;
  contextRunId?: string | null;
  status: CapabilityRequestStatus;
  createdAt: number;
  updatedAt: number;
}

export type CapabilityIssueType = "unavailable" | "runtime_error" | "bad_result";
export type CapabilityIssueStatus =
  | "open"
  | "acknowledged"
  | "fixing"
  | "ready_for_verify"
  | "verified"
  | "closed";

export interface CapabilityIssueRecord {
  id: string;
  type: CapabilityIssueType;
  summary: string;
  detail?: string;
  reporterActorId?: string | null;
  reporterLabel?: string | null;
  reporterDepartmentId?: string | null;
  ownerActorId?: string | null;
  appId?: string | null;
  skillId?: string | null;
  contextActionId?: string | null;
  contextAppSection?: string | null;
  contextFileKey?: string | null;
  contextFileName?: string | null;
  contextRunId?: string | null;
  status: CapabilityIssueStatus;
  createdAt: number;
  updatedAt: number;
}

export type CapabilityAuditEventKind = "skill" | "request" | "issue" | "run";

export interface CapabilityAuditEventRecord {
  id: string;
  kind: CapabilityAuditEventKind;
  entityId: string;
  action:
    | "created"
    | "status_changed"
    | "smoke_test_succeeded"
    | "smoke_test_failed"
    | "run_succeeded"
    | "run_failed";
  summary: string;
  detail?: string;
  actorId?: string | null;
  actorLabel?: string | null;
  appId?: string | null;
  skillId?: string | null;
  requestId?: string | null;
  issueId?: string | null;
  runId?: string | null;
  createdAt: number;
  updatedAt: number;
}
