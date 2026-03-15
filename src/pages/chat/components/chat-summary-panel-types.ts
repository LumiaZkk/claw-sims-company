import type { RequirementCollaborationSurface } from "../../../application/mission/requirement-collaboration-surface";
import type { TakeoverCase, TakeoverCaseSummary } from "../../../application/delegation/takeover-case";
import type { RequirementTeamMember, RequirementTeamView } from "../../../application/assignment/requirement-team";
import { formatRequestDeliveryStateLabel } from "../../../application/governance/focus-summary";

export type SummaryPanelView = "owner" | "team" | "debug";
export type FocusActionTone = "primary" | "secondary" | "ghost";
export type FocusActionKind = "message" | "navigate" | "recover" | "copy";

export type SummaryAction = {
  id: string;
  label: string;
  description: string;
  kind: FocusActionKind;
  tone: FocusActionTone;
};

export type MissionStep = {
  id: string;
  title: string;
  assigneeLabel: string;
  status: "done" | "wip" | "pending";
  statusLabel: string;
  detail?: string | null;
  isCurrent?: boolean;
  isNext?: boolean;
};

export type ActiveMission = {
  statusLabel: string;
  progressLabel: string;
  title: string;
  summary: string;
  guidance: string;
  ownerLabel: string;
  currentStepLabel: string;
  nextLabel: string;
  planSteps: MissionStep[];
};

export type ProgressGroupSummary = {
  working: string;
  waiting: string;
  completed: string;
};

export type ProgressEvent = {
  id: string;
  timestamp: number;
  actorLabel: string;
  title: string;
  summary: string;
  detail?: string;
  tone: "slate" | "emerald" | "amber" | "rose" | "indigo";
};

export type ActionWatchCard = {
  id: string;
  title: string;
  description: string;
  elapsedLabel: string;
};

export type LifecycleParticipant = {
  agentId: string;
  nickname: string;
  tone: "slate" | "emerald" | "amber" | "rose" | "indigo" | "violet" | "blue";
  statusLabel: string;
  isCurrent?: boolean;
  role: string;
  stage: string;
  detail: string;
  updatedAt: number;
};

export type LifecycleSection = {
  id: string;
  title: string;
  summary: string;
  items: LifecycleParticipant[];
};

export type LifecycleEvent = {
  id: string;
  title: string;
  summary: string;
  detail?: string;
  timestamp: number;
  actorLabel: string;
  tone: "slate" | "emerald" | "amber" | "rose" | "indigo";
  kind: "action" | "feedback" | "state";
  isCurrent?: boolean;
};

export type TeamMemberCard = RequirementTeamMember & {
  adjustAction: SummaryAction;
  isAdjustLoading: boolean;
};

export type TechnicalTakeoverPack = {
  failureSummary: string;
  recommendedNextAction: string;
};

export type StructuredTaskPreview = {
  summary?: string;
  state?: string | null;
};

export type RequestPreview = {
  id: string;
  title: string;
  summary: string;
  responseSummary?: string;
  deliveryState?: Parameters<typeof formatRequestDeliveryStateLabel>[0];
};

export type HandoffPreview = {
  id: string;
  title: string;
  summary: string;
};

export type RequestHealth = {
  active: number;
  pending: number;
  acknowledged: number;
  blocked: number;
};

export type CeoSurface = {
  activeBlockers: number;
  openRequests: number;
  pendingHandoffs: number;
  overdueItems: number;
  manualTakeovers: number;
};

export type TimelinePreviewItem = {
  id: string;
  title: string;
  subtitle: string;
  meta: string;
};

export type ChatSummaryPanelBodyProps = {
  summaryPanelView: SummaryPanelView;
  activeConversationMission: ActiveMission | null;
  isRequirementBootstrapPending: boolean;
  progressGroupSummary: ProgressGroupSummary | null;
  latestProgressDisplay: ProgressEvent | null;
  missionIsCompleted: boolean;
  sending: boolean;
  isGenerating: boolean;
  recentProgressEvents: ProgressEvent[];
  actionWatchCards: ActionWatchCard[];
  lifecycleSections: LifecycleSection[];
  collaborationLifecycle: LifecycleEvent[];
  detailActions: SummaryAction[];
  runningFocusActionId: string | null;
  recoveringCommunication: boolean;
  requirementTeam: RequirementTeamView | null;
  teamMemberCards: TeamMemberCard[];
  displayNextBatonLabel: string;
  displayNextBatonAgentId: string | null;
  targetAgentId: string | null;
  teamGroupRoute: string | null;
  primaryOpenAction: SummaryAction | null;
  summaryRecoveryAction: SummaryAction | null;
  hasTechnicalSummary: boolean;
  isTechnicalSummaryOpen: boolean;
  takeoverPack: TechnicalTakeoverPack | null;
  takeoverCaseSummary: TakeoverCaseSummary;
  takeoverCaseBusyId: string | null;
  structuredTaskPreview: StructuredTaskPreview | null;
  hasRequirementOverview: boolean;
  headerStatusBadgeClass: string;
  effectiveStatusLabel: string;
  effectiveSummary: string;
  requestPreview: RequestPreview[];
  requestHealth: RequestHealth;
  ceoSurface: CeoSurface | null;
  collaborationSurface?: RequirementCollaborationSurface | null;
  orgAdvisorSummary: string | null;
  handoffPreview: HandoffPreview[];
  summaryAlertCount: number;
  relatedSlaAlertCount: number;
  localSlaFallbackAlertCount: number;
  onClearSession: () => void;
  onRunAction: (action: SummaryAction) => void;
  onNavigateToChat: (agentId: string) => void;
  onNavigateToTeamGroup: () => void;
  onToggleTechnicalSummary: () => void;
  onCopyTakeoverPack: () => void;
  onOpenTakeoverCase: (caseItem: TakeoverCase) => void;
  onAcknowledgeTakeoverCase: (caseItem: TakeoverCase) => void;
  onAssignTakeoverCase: (caseItem: TakeoverCase) => void;
  onStartTakeoverCase: (caseItem: TakeoverCase) => void;
  onResolveTakeoverCase: (caseItem: TakeoverCase, note: string) => void | Promise<boolean>;
  onRedispatchTakeoverCase?: (caseItem: TakeoverCase, note: string) => void | Promise<boolean>;
  onArchiveTakeoverCase: (caseItem: TakeoverCase) => void;
};
