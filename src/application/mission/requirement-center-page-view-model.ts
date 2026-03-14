import { useEffect, useMemo, useState } from "react";
import {
  buildPrimaryRequirementProjection,
  buildRequirementExecutionProjection,
  describeRequirementRoomPreview,
} from "./requirement-execution-projection";
import { buildRequirementAcceptanceGate } from "./requirement-acceptance-gate";
import { buildPrimaryRequirementSurface } from "./primary-requirement-surface";
import { buildRequirementCloseoutReport } from "./requirement-closeout-report";
import {
  getRequirementStatusToneClass,
  resolveRequirementProductStatus,
} from "./requirement-product-status";
import { buildActivityInboxSummary } from "../governance/activity-inbox";
import { buildCompanyHeartbeatSurface } from "../org/company-heartbeat";
import { getRecentCompanyEventsSince, RECENT_COMPANY_EVENTS_LIMIT } from "../org/company-events-query";
import { describeDispatchCheckout } from "../../domain/delegation/dispatch-checkout";
import { useCanonicalRuntimeSummary } from "../runtime-summary";
import { useWorkspaceViewModel, type WorkspaceFileRow } from "../workspace";
import { gateway, useGatewayStore } from "../gateway";
import { usePageVisibility } from "../../lib/use-page-visibility";
import { useBoardCommunicationSync } from "./board-communication-sync";
import { useBoardRuntimeState } from "./board-runtime-state";
import { useBoardTaskBackfill } from "./board-task-backfill";
import type { GatewaySessionRow } from "../gateway";
import type { ResolvedExecutionState } from "./execution-state";
import type { ManualTakeoverPack } from "../delegation/takeover-pack";
import type { RequirementSessionSnapshot } from "../../domain/mission/requirement-snapshot";
import type { TrackedTask, WorkItemRecord } from "../../domain/mission/types";
import type { ArtifactRecord } from "../../domain/artifact/types";
import type {
  DecisionTicketRecord,
  DispatchRecord,
  RequirementRoomRecord,
} from "../../domain/delegation/types";
import type {
  Company,
  ConversationStateRecord,
  RequirementAggregateRecord,
  RequirementEvidenceEvent,
} from "../../domain";
import type { CompanyEvent } from "../../domain/delegation/events";
import type {
  AgentRuntimeRecord,
  AgentSessionRecord,
  CanonicalAgentStatusRecord,
} from "../agent-runtime";

type CompanyGatewaySession = GatewaySessionRow & { agentId: string };

type RequirementCenterPageInput = {
  activeCompany: Company;
  activeConversationStates: ConversationStateRecord[];
  activeDispatches: DispatchRecord[];
  activeRoomRecords: RequirementRoomRecord[];
  activeWorkItems: WorkItemRecord[];
  activeRequirementAggregates: RequirementAggregateRecord[];
  activeRequirementEvidence: RequirementEvidenceEvent[];
  activeDecisionTickets: DecisionTicketRecord[];
  activeAgentSessions: AgentSessionRecord[];
  activeAgentRuntime: AgentRuntimeRecord[];
  activeAgentStatuses: CanonicalAgentStatusRecord[];
  primaryRequirementId: string | null;
  activeArtifacts: ArtifactRecord[];
  replaceDispatchRecords: (dispatches: DispatchRecord[]) => void;
  upsertTask: (task: TrackedTask) => Promise<unknown>;
  updateCompany: (patch: Partial<Company>) => Promise<unknown>;
};

type RequirementTimelineEvent = RequirementCenterPageInput["activeRequirementEvidence"][number];

function getRequirementTimelinePriority(source: string) {
  if (source === "company-event") {
    return 0;
  }
  if (source === "local-command") {
    return 1;
  }
  if (source === "gateway-chat") {
    return 2;
  }
  return 3;
}

function buildRequirementTimelineDedupKey(event: RequirementTimelineEvent) {
  const revision = typeof event.payload.revision === "number" ? event.payload.revision : null;
  if (revision !== null && event.eventType.startsWith("requirement_")) {
    return `${event.eventType}:${revision}`;
  }
  return event.id;
}

export function buildRequirementRoomDispatchCheckout(input: {
  activeCompany: Company;
  roomDispatches: DispatchRecord[];
}) {
  const resolveActorLabel = (actorId: string | null) =>
    actorId
      ? input.activeCompany.employees.find((employee) => employee.agentId === actorId)?.nickname ?? actorId
      : "成员";
  const details = input.roomDispatches.map((dispatch) =>
    describeDispatchCheckout({
      dispatch,
      resolveActorLabel,
    }),
  );
  return {
    claimedCount: details.filter((detail) => detail.checkoutState === "claimed").length,
    openCount: details.filter((detail) => detail.checkoutState === "open").length,
    latest: details[0] ?? null,
  };
}

export function selectRequirementCenterDeliverableFiles(input: {
  workspaceFiles: WorkspaceFileRow[];
  scopedArtifactIds: Set<string>;
  memberIds: string[];
}) {
  const scopedFiles = input.workspaceFiles.filter((file) =>
    Boolean(
      (file.artifactId && input.scopedArtifactIds.has(file.artifactId)) ||
        input.memberIds.includes(file.agentId),
    ),
  );
  return (scopedFiles.length > 0 ? scopedFiles : input.workspaceFiles).slice(0, 6);
}

export function buildRequirementTimeline(input: {
  activeRequirementEvidence: RequirementEvidenceEvent[];
  aggregate: RequirementAggregateRecord | null;
}) {
  if (!input.aggregate) {
    return [];
  }
  const aggregate = input.aggregate;
  const events = input.activeRequirementEvidence
    .filter((event) =>
      Boolean(
        event.aggregateId === aggregate.id ||
          (aggregate.workItemId && event.payload.workItemId === aggregate.workItemId) ||
          (aggregate.roomId && event.payload.roomId === aggregate.roomId) ||
          (aggregate.topicKey && event.payload.topicKey === aggregate.topicKey),
      ),
    )
    .sort((left, right) => {
      if (right.timestamp !== left.timestamp) {
        return right.timestamp - left.timestamp;
      }
      return getRequirementTimelinePriority(left.source) - getRequirementTimelinePriority(right.source);
    });
  const seen = new Set<string>();
  return events
    .filter((event) => {
      const key = buildRequirementTimelineDedupKey(event);
      if (seen.has(key)) {
        return false;
      }
      seen.add(key);
      return true;
    })
    .slice(0, 8);
}

export function buildRequirementCenterPageSurface(input: {
  activeCompany: Company;
  companyEvents?: CompanyEvent[];
  activeConversationStates: ConversationStateRecord[];
  activeDispatches: DispatchRecord[];
  activeRoomRecords: RequirementRoomRecord[];
  activeWorkItems: WorkItemRecord[];
  activeRequirementAggregates: RequirementAggregateRecord[];
  activeRequirementEvidence: RequirementEvidenceEvent[];
  activeDecisionTickets: DecisionTicketRecord[];
  primaryRequirementId: string | null;
  activeArtifacts: ArtifactRecord[];
  companySessions: CompanyGatewaySession[];
  companySessionSnapshots: RequirementSessionSnapshot[];
  currentTime: number;
  fileTasks: TrackedTask[];
  sessionStates: Map<string, ResolvedExecutionState>;
  sessionTakeoverPacks: Map<string, ManualTakeoverPack>;
  workspaceFiles: WorkspaceFileRow[];
  ceoAgentId: string | null;
}) {
  const primaryRequirementSurface = buildPrimaryRequirementSurface({
    company: input.activeCompany,
    activeConversationStates: input.activeConversationStates,
    activeWorkItems: input.activeWorkItems,
    activeRequirementAggregates: input.activeRequirementAggregates,
    activeRequirementEvidence: input.activeRequirementEvidence,
    activeDecisionTickets: input.activeDecisionTickets,
    primaryRequirementId: input.primaryRequirementId,
    activeRoomRecords: input.activeRoomRecords,
    companySessions: input.companySessions,
    companySessionSnapshots: input.companySessionSnapshots,
    currentTime: input.currentTime,
    ceoAgentId: input.ceoAgentId,
  });

  const requirementSurface = buildPrimaryRequirementProjection({
    company: input.activeCompany,
    activeConversationStates: input.activeConversationStates,
    activeWorkItems: input.activeWorkItems,
    activeRequirementAggregates: input.activeRequirementAggregates,
    primaryRequirementId: input.primaryRequirementId,
    companySessions: input.companySessions,
    companySessionSnapshots: input.companySessionSnapshots,
    activeRoomRecords: input.activeRoomRecords,
    currentTime: input.currentTime,
    ceoAgentId: input.ceoAgentId,
  });

  const boardTaskSurface = buildRequirementExecutionProjection({
    activeCompany: input.activeCompany,
    companySessions: input.companySessions,
    currentTime: input.currentTime,
    fileTasks: input.fileTasks,
    sessionStates: input.sessionStates,
    sessionTakeoverPacks: input.sessionTakeoverPacks,
    requirementScope: requirementSurface.requirementScope,
    currentWorkItem: requirementSurface.currentWorkItem,
    activeWorkItem: requirementSurface.activeWorkItem,
    requirementOverview: requirementSurface.requirementOverview,
    strategicRequirementOverview: requirementSurface.strategicRequirementOverview,
    isStrategicRequirement: requirementSurface.isStrategicRequirement,
    requirementSyntheticTask: requirementSurface.requirementSyntheticTask,
  });

  const aggregate = primaryRequirementSurface.aggregate;
  const workItem = primaryRequirementSurface.workItem ?? requirementSurface.currentWorkItem ?? null;
  const room = primaryRequirementSurface.room ?? requirementSurface.requirementRoomRecords[0] ?? null;
  const productStatus = resolveRequirementProductStatus({
    aggregate,
    workItem,
  });
  const statusClassName = getRequirementStatusToneClass(productStatus.tone);
  const ownerAgentId = aggregate?.ownerActorId ?? workItem?.ownerActorId ?? null;
  const ownerLabel =
    workItem?.displayOwnerLabel ??
    workItem?.ownerLabel ??
    aggregate?.ownerLabel ??
    "当前负责人";
  const stageLabel =
    workItem?.displayStage ??
    workItem?.stageLabel ??
    aggregate?.stage ??
    "待推进";
  const nextAction =
    workItem?.displayNextAction ??
    workItem?.nextAction ??
    aggregate?.nextAction ??
    "继续在需求房推进。";
  const summary =
    workItem?.displaySummary ??
    workItem?.summary ??
    aggregate?.summary ??
    "CEO 正在把这条主线收敛为可执行的结果。";
  const roomDispatches = input.activeDispatches
    .filter((dispatch) =>
      Boolean(
        (room?.id && dispatch.roomId === room.id) ||
          (aggregate?.workItemId && dispatch.workItemId === aggregate.workItemId),
      ),
    )
    .sort((left, right) => right.updatedAt - left.updatedAt);
  const roomDispatchCheckout = buildRequirementRoomDispatchCheckout({
    activeCompany: input.activeCompany,
    roomDispatches,
  });
  const scopedArtifactIds = new Set(
    input.activeArtifacts
      .filter((artifact) =>
        Boolean(
          (aggregate?.workItemId && artifact.workItemId === aggregate.workItemId) ||
            (artifact.ownerActorId && aggregate?.memberIds.includes(artifact.ownerActorId)) ||
            (artifact.sourceActorId && aggregate?.memberIds.includes(artifact.sourceActorId)),
        ),
      )
      .map((artifact) => artifact.id),
  );
  const deliverableFiles = selectRequirementCenterDeliverableFiles({
    workspaceFiles: input.workspaceFiles,
    scopedArtifactIds,
    memberIds: aggregate?.memberIds ?? [],
  });
  const requirementTimeline = buildRequirementTimeline({
    activeRequirementEvidence: input.activeRequirementEvidence,
    aggregate,
  });
  const taskSequence = boardTaskSurface.taskSequence;
  const transcriptPreview = [...(room?.transcript ?? [])].slice(-4).reverse();
  const closeoutReport = buildRequirementCloseoutReport({
    aggregate,
    activeCompany: input.activeCompany,
    workspaceFiles: input.workspaceFiles,
    deliverableFiles,
    requirementTimelineCount: requirementTimeline.length,
    transcriptPreviewCount: transcriptPreview.length,
    updatedAtCandidates: [
      aggregate?.updatedAt ?? 0,
      workItem?.updatedAt ?? 0,
      ...deliverableFiles.map((file) => file.updatedAtMs ?? 0),
    ],
  });
  const heartbeatSurface = buildCompanyHeartbeatSurface({
    company: input.activeCompany,
    events: input.companyEvents,
    now: input.currentTime,
  });
  const acceptanceGate = buildRequirementAcceptanceGate({
    aggregate,
    closeoutReport,
  });
  const canRequestAcceptance = acceptanceGate.request.enabled;
  const canAccept = acceptanceGate.accept.enabled;
  const canContinueModify =
    Boolean(aggregate) &&
    (aggregate?.acceptanceStatus === "pending" || aggregate?.acceptanceStatus === "accepted");
  const canRejectReopen =
    Boolean(aggregate) &&
    (aggregate?.acceptanceStatus === "pending" || aggregate?.status === "completed");
  const canRequestChange = Boolean(aggregate) && aggregate?.status !== "archived";
  const activityInboxSummary = buildActivityInboxSummary({
    scopeLabel: "当前主线",
    handoffCount: boardTaskSurface.visiblePendingHandoffs.length,
    escalationCount: boardTaskSurface.visibleSlaAlerts.length,
    manualTakeoverCount: boardTaskSurface.visibleTakeoverCount,
  });
  const roomPreviewText = room
    ? describeRequirementRoomPreview(room, workItem)
    : aggregate
      ? "当前主线已经明确，但还没有固化出真实需求房。创建后会把已有派单和成员反馈回灌进来。"
      : "当前还没有绑定需求房，先由 CEO 或当前负责人继续收敛执行方式。";
  const collaborationActionLabel =
    primaryRequirementSurface.roomStatus === "ready"
      ? "进入需求房"
      : aggregate
        ? "创建并进入需求房"
        : "去协作";

  return {
    primaryRequirementSurface,
    requirementSurface,
    boardTaskSurface,
    aggregate,
    workItem,
    room,
    productStatus,
    statusClassName,
    ownerAgentId,
    ownerLabel,
    stageLabel,
    nextAction,
    summary,
    roomDispatches,
    roomDispatchCheckout,
    deliverableFiles,
    closeoutReport,
    acceptanceGate,
    heartbeatSurface,
    requirementTimeline,
    taskSequence,
    transcriptPreview,
    canRequestAcceptance,
    canAccept,
    canContinueModify,
    canRejectReopen,
    canRequestChange,
    activityInboxSummary,
    roomPreviewText,
    collaborationActionLabel,
  };
}

export function useRequirementCenterPageState(input: RequirementCenterPageInput) {
  const { summary: runtimeSummary } = useCanonicalRuntimeSummary();
  const isPageVisible = usePageVisibility();
  const connected = useGatewayStore((state) => state.connected);
  const supportsAgentFiles = useGatewayStore((state) => state.capabilities.agentFiles);
  const [companyEvents, setCompanyEvents] = useState<CompanyEvent[]>([]);
  const boardRuntimeState = useBoardRuntimeState({
    activeCompany: input.activeCompany,
    activeAgentRuntime: input.activeAgentRuntime,
    activeAgentStatuses: input.activeAgentStatuses,
    activeArtifacts: input.activeArtifacts,
    connected,
    isPageVisible,
    supportsAgentFiles,
  });
  const workspaceViewModel = useWorkspaceViewModel({ isPageVisible });

  useEffect(() => {
    if (!connected) {
      setCompanyEvents([]);
      return;
    }

    let cancelled = false;
    setCompanyEvents([]);
    void gateway
      .listCompanyEvents({
        companyId: input.activeCompany.id,
        since: getRecentCompanyEventsSince(),
        limit: RECENT_COMPANY_EVENTS_LIMIT,
        recent: true,
      })
      .then((result) => {
        if (!cancelled) {
          setCompanyEvents(result.events ?? []);
        }
      })
      .catch(() => {
        if (!cancelled) {
          setCompanyEvents([]);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [connected, input.activeCompany.id]);

  const ceo = input.activeCompany.employees.find((employee) => employee.metaRole === "ceo") ?? null;

  const pageSurface = useMemo(
    () =>
      buildRequirementCenterPageSurface({
        activeCompany: input.activeCompany,
        companyEvents,
        activeConversationStates: input.activeConversationStates,
        activeDispatches: input.activeDispatches,
        activeRoomRecords: input.activeRoomRecords,
        activeWorkItems: input.activeWorkItems,
        activeRequirementAggregates: input.activeRequirementAggregates,
        activeRequirementEvidence: input.activeRequirementEvidence,
        activeDecisionTickets: input.activeDecisionTickets,
        primaryRequirementId: input.primaryRequirementId,
        activeArtifacts: input.activeArtifacts,
        companySessions: boardRuntimeState.companySessions,
        companySessionSnapshots: boardRuntimeState.companySessionSnapshots,
        currentTime: boardRuntimeState.currentTime,
        fileTasks: boardRuntimeState.fileTasks,
        sessionStates: boardRuntimeState.sessionStates,
        sessionTakeoverPacks: boardRuntimeState.sessionTakeoverPacks,
        workspaceFiles: workspaceViewModel.workspaceFiles,
        ceoAgentId: ceo?.agentId ?? null,
      }),
    [
      boardRuntimeState.companySessionSnapshots,
      boardRuntimeState.companySessions,
      boardRuntimeState.currentTime,
      boardRuntimeState.fileTasks,
      boardRuntimeState.sessionStates,
      boardRuntimeState.sessionTakeoverPacks,
      ceo?.agentId,
      companyEvents,
      input.activeArtifacts,
      input.activeCompany,
      input.activeConversationStates,
      input.activeDecisionTickets,
      input.activeDispatches,
      input.activeRequirementAggregates,
      input.activeRequirementEvidence,
      input.activeRoomRecords,
      input.activeWorkItems,
      input.primaryRequirementId,
      workspaceViewModel.workspaceFiles,
    ],
  );

  useBoardTaskBackfill({
    tasks: pageSurface.boardTaskSurface.trackedTasks,
    upsertTask: input.upsertTask,
  });

  const communicationSync = useBoardCommunicationSync({
    activeCompany: input.activeCompany,
    surface: "requirement_center",
    companySessionSnapshots: boardRuntimeState.companySessionSnapshots,
    setCompanySessionSnapshots: boardRuntimeState.setCompanySessionSnapshots,
    activeArtifacts: input.activeArtifacts,
    activeDispatches: input.activeDispatches,
    replaceDispatchRecords: input.replaceDispatchRecords,
    updateCompany: input.updateCompany,
    connected,
    isPageVisible,
  });

  return {
    ceo,
    connected,
    supportsAgentFiles,
    isPageVisible,
    runtimeSummary,
    workspaceViewModel,
    ...boardRuntimeState,
    ...communicationSync,
    pageSurface,
  };
}
