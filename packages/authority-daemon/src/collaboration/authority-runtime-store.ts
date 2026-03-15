import type { DatabaseSync } from "node:sqlite";
import {
  applyProviderRuntimeEvent,
  applyProviderSessionStatusToAgentRuntime,
  buildAgentRuntimeProjection,
  buildAgentSessionRecordsFromSessions,
  buildCanonicalAgentStatusHealth,
  buildCanonicalAgentStatusProjection,
  normalizeProviderSessionStatus,
  reconcileAgentSessionExecutionContext,
  type AgentRunRecord,
} from "../../../../src/application/agent-runtime";
import { buildCollaborationContextSnapshot } from "../../../../src/application/company/collaboration-context";
import {
  buildRoomConversationBindingKey,
  mergeRoomConversationBindings,
} from "../../../../src/application/delegation/room-records";
import {
  reconcileRequirementAggregateState,
  sanitizeRequirementAggregateRecords,
} from "../../../../src/application/mission/requirement-aggregate";
import { diffRequirementAggregateMaterialFields } from "../../../../src/application/mission/requirement-aggregate-diff";
import { isArtifactRequirementTopic } from "../../../../src/application/mission/requirement-kind";
import {
  buildRequirementWorkflowEvidence,
  buildRequirementWorkflowEvidencePayload,
  resolveRequirementWorkflowEventKind,
} from "../../../../src/application/mission/requirement-workflow";
import {
  buildRoomRecordIdFromWorkItem,
  buildWorkItemRecordFromMission,
} from "../../../../src/application/mission/work-item";
import { areWorkItemRecordsEquivalent } from "../../../../src/application/mission/work-item-equivalence";
import { reconcileWorkItemRecord } from "../../../../src/application/mission/work-item-reconciler";
import type { ArtifactRecord } from "../../../../src/domain/artifact/types";
import { createCompanyEvent } from "../../../../src/domain/delegation/events";
import type {
  DecisionTicketRecord,
  DispatchRecord,
  EscalationRecord,
  RequirementRoomRecord,
  RoomConversationBindingRecord,
  SupportRequestRecord,
} from "../../../../src/domain/delegation/types";
import type {
  ConversationMissionRecord,
  ConversationStateRecord,
  RequirementAggregateRecord,
  RequirementEvidenceEvent,
  RoundRecord,
  WorkItemRecord,
} from "../../../../src/domain/mission/types";
import type { Company } from "../../../../src/domain/org/types";
import type {
  AuthorityAppendRoomRequest,
  AuthorityArtifactDeleteRequest,
  AuthorityArtifactMirrorSyncRequest,
  AuthorityArtifactUpsertRequest,
  AuthorityCollaborationScopeResponse,
  AuthorityCompanyRuntimeSnapshot,
  AuthorityConversationStateDeleteRequest,
  AuthorityConversationStateUpsertRequest,
  AuthorityDecisionTicketCancelRequest,
  AuthorityDecisionTicketDeleteRequest,
  AuthorityDecisionTicketResolveRequest,
  AuthorityDecisionTicketUpsertRequest,
  AuthorityDispatchDeleteRequest,
  AuthorityDispatchUpsertRequest,
  AuthorityMissionDeleteRequest,
  AuthorityMissionUpsertRequest,
  AuthorityRequirementPromoteRequest,
  AuthorityRequirementTransitionRequest,
  AuthorityRoomBindingsUpsertRequest,
  AuthorityRoomDeleteRequest,
  AuthorityRoundDeleteRequest,
  AuthorityRoundUpsertRequest,
  AuthorityWorkItemDeleteRequest,
  AuthorityWorkItemUpsertRequest,
} from "../../../../src/infrastructure/authority/contract";
import { sanitizeRequirementEvidenceEvents } from "../../../../src/infrastructure/company/persistence/requirement-evidence-persistence";
import { sanitizeWorkItemRecords } from "../../../../src/infrastructure/company/persistence/work-item-persistence";
import { areConversationStateRecordsEquivalent } from "../../../../src/infrastructure/company/runtime/conversation-state";
import { isSameMissionRecord } from "../../../../src/infrastructure/company/runtime/missions";
import { reconcileStoredWorkItems } from "../../../../src/infrastructure/company/runtime/work-items";
import type { ProviderRuntimeEvent } from "../../../../src/infrastructure/gateway/runtime/types";
import type { AuthorityCompanyEventStore } from "../company/authority-company-event-store";
import {
  buildManagedExecutorFilesForCompany,
  buildManagedExecutorProjectionFilesForCompany,
} from "../company/company-executor-sync";
import {
  decisionTicketMaterialChanged,
  EXECUTOR_PROVIDER_ID,
  getSyncAuthorityAgentFileMirror,
  isPresent,
  normalizeCompany,
  normalizeDecisionTicketRecord,
  normalizeDecisionTicketRevision,
  normalizeExecutorRunState,
  normalizeRuntimeSnapshot,
  parseJson,
  readNumber,
  readString,
} from "../persistence/authority-persistence-shared";
import {
  reconcileAuthorityRequirementRuntime,
  runtimeRequirementControlChanged,
} from "./requirement-control-runtime";

type RuntimeSliceTables =
  | "missions"
  | "conversation_states"
  | "work_items"
  | "requirement_aggregates"
  | "requirement_evidence"
  | "rooms"
  | "rounds"
  | "artifacts"
  | "dispatches"
  | "room_bindings"
  | "support_requests"
  | "escalations"
  | "decision_tickets";

type AuthorityRuntimeStoreDependencies = {
  getDb: () => DatabaseSync;
  runWriteTransaction: <T>(operation: () => T) => T;
  runWithBusyRetry: <T>(label: string, operation: () => T) => T;
  loadCompanyById: (companyId: string) => Company | null;
  getCompanyAgentIds: (companyId?: string | null) => string[];
  setAgentFile: (agentId: string, name: string, content: string) => { changed: boolean };
  eventStore: Pick<
    AuthorityCompanyEventStore,
    | "replayRuntimeFromEventLog"
    | "appendCompanyEvent"
    | "appendDecisionTicketEvent"
    | "appendDispatchAuditEvent"
    | "appendRoomAuditEvent"
    | "appendRoomBindingsAuditEvent"
    | "appendArtifactAuditEvent"
    | "appendArtifactMirrorSyncEvent"
    | "appendRuntimeRepairEvent"
  >;
};

const EMPTY_RUNTIME = (companyId: string): AuthorityCompanyRuntimeSnapshot => ({
  companyId,
  activeRoomRecords: [],
  activeMissionRecords: [],
  activeConversationStates: [],
  activeWorkItems: [],
  activeRequirementAggregates: [],
  activeRequirementEvidence: [],
  primaryRequirementId: null,
  activeRoundRecords: [],
  activeArtifacts: [],
  activeDispatches: [],
  activeRoomBindings: [],
  activeSupportRequests: [],
  activeEscalations: [],
  activeDecisionTickets: [],
  activeAgentSessions: [],
  activeAgentRuns: [],
  activeAgentRuntime: [],
  activeAgentStatuses: [],
  activeAgentStatusHealth: {
    source: "authority",
    coverage: "authority_partial",
    coveredAgentCount: 0,
    expectedAgentCount: 0,
    missingAgentIds: [],
    isComplete: false,
    generatedAt: Date.now(),
    note: "Authority runtime has not projected canonical agent statuses yet.",
  },
  updatedAt: Date.now(),
});

export class AuthorityRuntimeStore {
  constructor(private readonly deps: AuthorityRuntimeStoreDependencies) {}

  updateRuntimeFromSessionList(
    companyId: string,
    sessions: Parameters<typeof buildAgentSessionRecordsFromSessions>[0]["sessions"],
  ) {
    const runtime = this.loadRuntime(companyId);
    const nextSessions = buildAgentSessionRecordsFromSessions({
      existing: runtime.activeAgentSessions ?? [],
      providerId: EXECUTOR_PROVIDER_ID,
      sessions,
    });
    return this.saveRuntime(
      this.computeAgentRuntimeSnapshot(companyId, runtime, {
        activeAgentSessions: nextSessions,
      }),
    );
  }

  applyRuntimeSessionStatus(companyId: string, status: ReturnType<typeof normalizeProviderSessionStatus>) {
    const runtime = this.loadRuntime(companyId);
    const next = applyProviderSessionStatusToAgentRuntime({
      sessions: runtime.activeAgentSessions ?? [],
      runs: runtime.activeAgentRuns ?? [],
      status,
    });
    return this.saveRuntime(
      this.computeAgentRuntimeSnapshot(companyId, runtime, {
        activeAgentSessions: next.sessions,
        activeAgentRuns: next.runs,
      }),
    );
  }

  applyRuntimeEvent(companyId: string, event: ProviderRuntimeEvent) {
    const runtime = this.loadRuntime(companyId);
    const next = applyProviderRuntimeEvent({
      sessions: runtime.activeAgentSessions ?? [],
      runs: runtime.activeAgentRuns ?? [],
      event,
    });
    return this.saveRuntime(
      this.computeAgentRuntimeSnapshot(companyId, runtime, {
        activeAgentSessions: next.sessions,
        activeAgentRuns: next.runs,
      }),
    );
  }

  loadRuntime(companyId: string): AuthorityCompanyRuntimeSnapshot {
    const stored = this.readStoredRuntime(companyId);
    return this.reconcileRuntimeForRead({
      company: stored.company,
      snapshot: stored.snapshot,
    }).runtime;
  }

  repairRuntimeIfNeeded(companyId: string): AuthorityCompanyRuntimeSnapshot {
    const stored = this.readStoredRuntime(companyId);
    const reconciled = this.reconcileRuntimeForRead({
      company: stored.company,
      snapshot: stored.snapshot,
    });
    if (!stored.exists || reconciled.changed) {
      const nextRuntime = this.saveRuntime(reconciled.runtime);
      this.deps.eventStore.appendRuntimeRepairEvent({
        companyId,
        timestamp: Date.now(),
        storedRuntimeExisted: stored.exists,
        reconciledChanged: reconciled.changed,
        runtime: nextRuntime,
      });
      return nextRuntime;
    }
    return reconciled.runtime;
  }

  saveRuntime(snapshot: AuthorityCompanyRuntimeSnapshot) {
    const company = this.deps.loadCompanyById(snapshot.companyId);
    const runtimeWithAgentProjection = this.computeAgentRuntimeSnapshot(snapshot.companyId, snapshot, {
      activeAgentSessions: snapshot.activeAgentSessions,
      activeAgentRuns: snapshot.activeAgentRuns,
    });
    const reconciled = reconcileAuthorityRequirementRuntime({
      company,
      runtime: normalizeRuntimeSnapshot(company, {
        ...runtimeWithAgentProjection,
        updatedAt: Date.now(),
      }),
    });
    const normalized = this.computeAgentRuntimeSnapshot(
      snapshot.companyId,
      normalizeRuntimeSnapshot(company, {
        ...reconciled.runtime,
        updatedAt: Date.now(),
      }),
      {
        activeAgentSessions: reconciled.runtime.activeAgentSessions,
        activeAgentRuns: reconciled.runtime.activeAgentRuns,
      },
    );
    this.deps.runWithBusyRetry(`saveRuntime(${snapshot.companyId})`, () =>
      this.deps.runWriteTransaction(() => {
        this.replacePayloadTable("missions", snapshot.companyId, normalized.activeMissionRecords);
        this.replacePayloadTable("conversation_states", snapshot.companyId, normalized.activeConversationStates);
        this.replacePayloadTable("work_items", snapshot.companyId, normalized.activeWorkItems);
        this.replacePayloadTable("requirement_aggregates", snapshot.companyId, normalized.activeRequirementAggregates);
        this.replacePayloadTable("requirement_evidence", snapshot.companyId, normalized.activeRequirementEvidence);
        this.replacePayloadTable("rooms", snapshot.companyId, normalized.activeRoomRecords);
        this.replacePayloadTable("rounds", snapshot.companyId, normalized.activeRoundRecords);
        this.replacePayloadTable("artifacts", snapshot.companyId, normalized.activeArtifacts);
        this.replacePayloadTable("dispatches", snapshot.companyId, normalized.activeDispatches);
        this.replacePayloadTable("room_bindings", snapshot.companyId, normalized.activeRoomBindings);
        this.replacePayloadTable("support_requests", snapshot.companyId, normalized.activeSupportRequests);
        this.replacePayloadTable("escalations", snapshot.companyId, normalized.activeEscalations);
        this.replacePayloadTable("decision_tickets", snapshot.companyId, normalized.activeDecisionTickets);
        this.deps.getDb().prepare(`
          INSERT INTO runtimes (company_id, snapshot_json, updated_at)
          VALUES (?, ?, ?)
          ON CONFLICT(company_id) DO UPDATE SET
            snapshot_json = excluded.snapshot_json,
            updated_at = excluded.updated_at
        `).run(snapshot.companyId, JSON.stringify(normalized), normalized.updatedAt);
      }),
    );
    this.refreshManagedContextFiles(snapshot.companyId, normalized);
    return normalized;
  }

  getCollaborationScope(companyId: string, agentId: string): AuthorityCollaborationScopeResponse {
    const company = this.deps.loadCompanyById(companyId);
    if (!company) {
      throw new Error(`Unknown company: ${companyId}`);
    }
    return buildCollaborationContextSnapshot({
      company,
      agentId,
    });
  }

  transitionRequirement(input: AuthorityRequirementTransitionRequest) {
    const runtime = this.loadRuntime(input.companyId);
    const previousAggregate =
      runtime.activeRequirementAggregates.find((aggregate) => aggregate.id === input.aggregateId) ?? null;
    if (!previousAggregate) {
      throw new Error(`Unknown requirement aggregate: ${input.aggregateId}`);
    }
    const timestamp = input.timestamp ?? Date.now();
    const nextAggregates = runtime.activeRequirementAggregates.map((aggregate) => {
      if (aggregate.id !== input.aggregateId) {
        return aggregate;
      }
      const nextLastEvidenceAt =
        input.changes.lastEvidenceAt ??
        timestamp ??
        aggregate.lastEvidenceAt ??
        null;
      const nextAggregateBase: RequirementAggregateRecord = {
        ...aggregate,
        ...input.changes,
        updatedAt: aggregate.updatedAt,
        revision: aggregate.revision,
        lastEvidenceAt: nextLastEvidenceAt,
      };
      const changedFields = diffRequirementAggregateMaterialFields(aggregate, nextAggregateBase);
      if (changedFields.length === 0 && nextLastEvidenceAt === (aggregate.lastEvidenceAt ?? null)) {
        return aggregate;
      }
      return {
        ...nextAggregateBase,
        updatedAt:
          changedFields.length > 0
            ? Math.max(aggregate.updatedAt, timestamp, input.changes.updatedAt ?? 0)
            : aggregate.updatedAt,
        revision: changedFields.length > 0 ? aggregate.revision + 1 : aggregate.revision,
      };
    });
    const nextAggregate =
      nextAggregates.find((aggregate) => aggregate.id === input.aggregateId) ?? null;
    const nextEvidence =
      nextAggregate && nextAggregate.revision !== previousAggregate.revision
        ? sanitizeRequirementEvidenceEvents(input.companyId, [
            buildRequirementWorkflowEvidence({
              companyId: input.companyId,
              eventType: resolveRequirementWorkflowEventKind({
                previousAggregate,
                nextAggregate,
                changes: input.changes,
              }),
              aggregate: nextAggregate,
              previousAggregate,
              actorId: input.changes.ownerActorId ?? previousAggregate.ownerActorId,
              timestamp,
              source: input.source,
              changes: input.changes,
            }),
            ...runtime.activeRequirementEvidence,
          ])
        : runtime.activeRequirementEvidence;
    const nextRuntime = this.saveRuntime({
      ...runtime,
      activeRequirementAggregates: nextAggregates,
      activeRequirementEvidence: nextEvidence,
      primaryRequirementId:
        nextAggregates.find((aggregate) => aggregate.primary)?.id ?? runtime.primaryRequirementId,
    });
    if (nextAggregate) {
      this.deps.eventStore.appendCompanyEvent(
        createCompanyEvent({
          companyId: input.companyId,
          kind: resolveRequirementWorkflowEventKind({
            previousAggregate,
            nextAggregate,
            changes: input.changes,
          }),
          workItemId: nextAggregate.workItemId ?? undefined,
          topicKey: nextAggregate.topicKey ?? undefined,
          roomId: nextAggregate.roomId ?? undefined,
          fromActorId:
            input.changes.ownerActorId ??
            previousAggregate.ownerActorId ??
            "system:requirement-aggregate",
          targetActorId: nextAggregate.ownerActorId ?? undefined,
          sessionKey: nextAggregate.sourceConversationId ?? undefined,
          payload: buildRequirementWorkflowEvidencePayload({
            previousAggregate,
            nextAggregate,
            source: input.source,
            changes: input.changes,
          }),
        }),
      );
    }
    return nextRuntime;
  }

  promoteRequirement(input: AuthorityRequirementPromoteRequest) {
    const runtime = this.loadRuntime(input.companyId);
    const nextPrimaryRequirementId =
      input.aggregateId && runtime.activeRequirementAggregates.some((aggregate) => aggregate.id === input.aggregateId)
        ? input.aggregateId
        : null;
    const previousPrimaryRequirementId = runtime.primaryRequirementId;
    const previousAggregate =
      previousPrimaryRequirementId
        ? runtime.activeRequirementAggregates.find((aggregate) => aggregate.id === previousPrimaryRequirementId) ?? null
        : null;
    const nextAggregates = sanitizeRequirementAggregateRecords(
      runtime.activeRequirementAggregates.map((aggregate) =>
        aggregate.id === nextPrimaryRequirementId
          ? {
              ...aggregate,
              updatedAt: aggregate.updatedAt,
            }
          : aggregate,
      ),
      nextPrimaryRequirementId,
    );
    const nextAggregate =
      nextPrimaryRequirementId
        ? nextAggregates.find((aggregate) => aggregate.id === nextPrimaryRequirementId) ?? null
        : null;
    const timestamp = input.timestamp ?? Date.now();
    const nextEvidence =
      nextAggregate && nextPrimaryRequirementId !== previousPrimaryRequirementId
        ? sanitizeRequirementEvidenceEvents(input.companyId, [
            buildRequirementWorkflowEvidence({
              companyId: input.companyId,
              eventType: "requirement_promoted",
              aggregate: nextAggregate,
              previousAggregate,
              actorId: nextAggregate.ownerActorId ?? previousAggregate?.ownerActorId,
              timestamp,
              source: input.source,
            }),
            ...runtime.activeRequirementEvidence,
          ])
        : runtime.activeRequirementEvidence;
    const nextRuntime = this.saveRuntime({
      ...runtime,
      activeRequirementAggregates: nextAggregates,
      activeRequirementEvidence: nextEvidence,
      primaryRequirementId: nextPrimaryRequirementId,
    });
    if (nextAggregate && nextPrimaryRequirementId !== previousPrimaryRequirementId) {
      this.deps.eventStore.appendCompanyEvent(
        createCompanyEvent({
          companyId: input.companyId,
          kind: "requirement_promoted",
          workItemId: nextAggregate.workItemId ?? undefined,
          topicKey: nextAggregate.topicKey ?? undefined,
          roomId: nextAggregate.roomId ?? undefined,
          fromActorId:
            nextAggregate.ownerActorId ??
            previousAggregate?.ownerActorId ??
            "system:requirement-aggregate",
          targetActorId: nextAggregate.ownerActorId ?? undefined,
          sessionKey: nextAggregate.sourceConversationId ?? undefined,
          payload: buildRequirementWorkflowEvidencePayload({
            previousAggregate,
            nextAggregate,
            source: input.source,
          }),
        }),
      );
    }
    return nextRuntime;
  }

  upsertRoom(input: AuthorityAppendRoomRequest) {
    const runtime = this.loadRuntime(input.companyId);
    const nextRooms = [
      input.room,
      ...runtime.activeRoomRecords.filter((room) => room.id !== input.room.id),
    ];
    const nextRuntime = this.saveRuntime({ ...runtime, activeRoomRecords: nextRooms });
    const nextRoom = nextRuntime.activeRoomRecords.find((room) => room.id === input.room.id) ?? null;
    if (nextRoom) {
      this.deps.eventStore.appendRoomAuditEvent({
        companyId: input.companyId,
        kind: "room_record_upserted",
        room: nextRoom,
        timestamp: nextRoom.updatedAt,
      });
    }
    return nextRuntime;
  }

  deleteRoom(input: AuthorityRoomDeleteRequest) {
    const runtime = this.loadRuntime(input.companyId);
    const deletedRoom = runtime.activeRoomRecords.find((room) => room.id === input.roomId) ?? null;
    const nextRooms = runtime.activeRoomRecords.filter((room) => room.id !== input.roomId);
    const nextBindings = runtime.activeRoomBindings.filter((binding) => binding.roomId !== input.roomId);
    const nextWorkItems = reconcileStoredWorkItems({
      company: this.deps.loadCompanyById(input.companyId),
      companyId: input.companyId,
      workItems: runtime.activeWorkItems,
      rooms: nextRooms,
      artifacts: runtime.activeArtifacts,
      dispatches: runtime.activeDispatches,
      targetWorkItemIds: [deletedRoom?.workItemId],
      targetRoomIds: [input.roomId],
      targetTopicKeys: [deletedRoom?.topicKey],
    });
    const reconciledRequirements = reconcileRequirementAggregateState({
      companyId: input.companyId,
      existingAggregates: runtime.activeRequirementAggregates,
      primaryRequirementId: runtime.primaryRequirementId,
      activeConversationStates: runtime.activeConversationStates,
      activeWorkItems: nextWorkItems,
      activeRoomRecords: nextRooms,
      activeRequirementEvidence: runtime.activeRequirementEvidence,
    });
    const nextRuntime = this.saveRuntime({
      ...runtime,
      activeRoomRecords: nextRooms,
      activeRoomBindings: nextBindings,
      activeWorkItems: nextWorkItems,
      activeRequirementAggregates: reconciledRequirements.activeRequirementAggregates,
      primaryRequirementId: reconciledRequirements.primaryRequirementId,
    });
    if (deletedRoom) {
      this.deps.eventStore.appendRoomAuditEvent({
        companyId: input.companyId,
        kind: "room_record_deleted",
        room: deletedRoom,
        timestamp: Date.now(),
      });
    }
    return nextRuntime;
  }

  upsertRoomBindings(input: AuthorityRoomBindingsUpsertRequest) {
    const runtime = this.loadRuntime(input.companyId);
    const nextBindings = mergeRoomConversationBindings({
      existing: runtime.activeRoomBindings,
      incoming: input.bindings,
    });
    const nextRuntime = this.saveRuntime({
      ...runtime,
      activeRoomBindings: nextBindings,
    });
    if (input.bindings.length > 0) {
      this.deps.eventStore.appendRoomBindingsAuditEvent({
        companyId: input.companyId,
        bindings: input.bindings,
        timestamp: Date.now(),
      });
    }
    return nextRuntime;
  }

  upsertRound(input: AuthorityRoundUpsertRequest) {
    const runtime = this.loadRuntime(input.companyId);
    const nextRounds = [
      {
        ...input.round,
        companyId: input.companyId,
      },
      ...runtime.activeRoundRecords.filter((round) => round.id !== input.round.id),
    ];
    return this.saveRuntime({
      ...runtime,
      activeRoundRecords: nextRounds,
    });
  }

  deleteRound(input: AuthorityRoundDeleteRequest) {
    const runtime = this.loadRuntime(input.companyId);
    const nextRounds = runtime.activeRoundRecords.filter((round) => round.id !== input.roundId);
    if (nextRounds.length === runtime.activeRoundRecords.length) {
      return runtime;
    }
    return this.saveRuntime({
      ...runtime,
      activeRoundRecords: nextRounds,
    });
  }

  upsertMission(input: AuthorityMissionUpsertRequest) {
    const runtime = this.loadRuntime(input.companyId);
    const nextMissions = [...runtime.activeMissionRecords];
    const index = nextMissions.findIndex((mission) => mission.id === input.mission.id);
    const normalizedMission = {
      ...input.mission,
      companyId: input.companyId,
    };
    if (index >= 0) {
      const existing = nextMissions[index]!;
      const merged = { ...existing, ...normalizedMission };
      if (isSameMissionRecord(existing, merged)) {
        return runtime;
      }
      if (normalizedMission.updatedAt <= existing.updatedAt) {
        return runtime;
      }
      nextMissions[index] = merged;
    } else {
      nextMissions.push(normalizedMission);
    }

    const sortedMissions = [...nextMissions].sort((left, right) => right.updatedAt - left.updatedAt);
    const roomIdFromBinding =
      normalizedMission.roomId
        ? runtime.activeRoomBindings.find((binding) => binding.conversationId === normalizedMission.roomId)?.roomId
          ?? null
        : null;
    const matchingRoom =
      runtime.activeRoomRecords.find(
        (room) => room.id === normalizedMission.roomId || room.workItemId === normalizedMission.id,
      )
      ?? (roomIdFromBinding
        ? runtime.activeRoomRecords.find((room) => room.id === roomIdFromBinding) ?? null
        : null);
    const existingWorkItem =
      runtime.activeWorkItems.find((item) => item.id === normalizedMission.id)
      ?? runtime.activeWorkItems.find((item) => item.sourceMissionId === normalizedMission.id)
      ?? null;
    const nextWorkItem =
      normalizedMission.topicKey && isArtifactRequirementTopic(normalizedMission.topicKey)
        ? null
        : reconcileWorkItemRecord({
            companyId: input.companyId,
            company: this.deps.loadCompanyById(input.companyId),
            existingWorkItem,
            mission: normalizedMission,
            room: matchingRoom,
            fallbackSessionKey: normalizedMission.sessionKey,
            fallbackRoomId: matchingRoom?.id ?? normalizedMission.roomId ?? null,
          })
          ?? buildWorkItemRecordFromMission({
            companyId: input.companyId,
            mission: normalizedMission,
            room: matchingRoom,
          });
    const nextWorkItems = [...runtime.activeWorkItems];
    if (nextWorkItem) {
      const workItemIndex = nextWorkItems.findIndex((item) => item.id === nextWorkItem.id);
      if (workItemIndex >= 0) {
        const existingLinked = nextWorkItems[workItemIndex]!;
        if (nextWorkItem.updatedAt > existingLinked.updatedAt) {
          nextWorkItems[workItemIndex] = {
            ...existingLinked,
            ...nextWorkItem,
            roomId: nextWorkItem.roomId ?? existingLinked.roomId,
            artifactIds:
              nextWorkItem.artifactIds.length > 0 ? nextWorkItem.artifactIds : existingLinked.artifactIds,
            dispatchIds:
              nextWorkItem.dispatchIds.length > 0 ? nextWorkItem.dispatchIds : existingLinked.dispatchIds,
          };
        }
      } else {
        nextWorkItems.push(nextWorkItem);
      }
    }

    return this.saveRuntime({
      ...runtime,
      activeMissionRecords: sortedMissions,
      activeWorkItems: sanitizeWorkItemRecords(nextWorkItems),
    });
  }

  deleteMission(input: AuthorityMissionDeleteRequest) {
    const runtime = this.loadRuntime(input.companyId);
    const nextMissions = runtime.activeMissionRecords.filter((mission) => mission.id !== input.missionId);
    if (nextMissions.length === runtime.activeMissionRecords.length) {
      return runtime;
    }
    return this.saveRuntime({
      ...runtime,
      activeMissionRecords: nextMissions,
    });
  }

  upsertConversationState(input: AuthorityConversationStateUpsertRequest) {
    const runtime = this.loadRuntime(input.companyId);
    const index = runtime.activeConversationStates.findIndex(
      (record) => record.conversationId === input.conversationId,
    );
    const timestamp = input.timestamp ?? Date.now();
    const nextRecord: ConversationStateRecord = index >= 0
      ? {
          ...runtime.activeConversationStates[index]!,
          ...input.changes,
          companyId: input.companyId,
          conversationId: input.conversationId,
          updatedAt: Math.max(runtime.activeConversationStates[index]!.updatedAt, timestamp),
        }
      : {
          companyId: input.companyId,
          conversationId: input.conversationId,
          currentWorkKey: input.changes.currentWorkKey ?? null,
          currentWorkItemId: input.changes.currentWorkItemId ?? null,
          currentRoundId: input.changes.currentRoundId ?? null,
          draftRequirement: input.changes.draftRequirement ?? null,
          updatedAt: timestamp,
        };
    if (index >= 0 && areConversationStateRecordsEquivalent(runtime.activeConversationStates[index]!, nextRecord)) {
      return runtime;
    }
    const nextConversationStates = [...runtime.activeConversationStates];
    if (index >= 0) {
      nextConversationStates[index] = nextRecord;
    } else {
      nextConversationStates.push(nextRecord);
    }
    return this.saveRuntime({
      ...runtime,
      activeConversationStates: nextConversationStates.sort((left, right) => right.updatedAt - left.updatedAt),
    });
  }

  deleteConversationState(input: AuthorityConversationStateDeleteRequest) {
    const runtime = this.loadRuntime(input.companyId);
    const nextConversationStates = runtime.activeConversationStates.filter(
      (record) => record.conversationId !== input.conversationId,
    );
    if (nextConversationStates.length === runtime.activeConversationStates.length) {
      return runtime;
    }
    return this.saveRuntime({
      ...runtime,
      activeConversationStates: nextConversationStates,
    });
  }

  upsertWorkItem(input: AuthorityWorkItemUpsertRequest) {
    const runtime = this.loadRuntime(input.companyId);
    if (input.workItem.topicKey && isArtifactRequirementTopic(input.workItem.topicKey)) {
      return runtime;
    }
    const nextWorkItems = [...runtime.activeWorkItems];
    const index = nextWorkItems.findIndex((item) => item.id === input.workItem.id);
    const normalizedWorkItem = {
      ...input.workItem,
      companyId: input.companyId,
      roomId: input.workItem.roomId ?? buildRoomRecordIdFromWorkItem(input.workItem.id),
    };
    if (index >= 0) {
      const existing = nextWorkItems[index]!;
      const merged = {
        ...existing,
        ...normalizedWorkItem,
        artifactIds:
          normalizedWorkItem.artifactIds.length > 0 ? normalizedWorkItem.artifactIds : existing.artifactIds,
        dispatchIds:
          normalizedWorkItem.dispatchIds.length > 0 ? normalizedWorkItem.dispatchIds : existing.dispatchIds,
        sourceActorId: normalizedWorkItem.sourceActorId ?? existing.sourceActorId ?? null,
        sourceActorLabel: normalizedWorkItem.sourceActorLabel ?? existing.sourceActorLabel ?? null,
        sourceSessionKey: normalizedWorkItem.sourceSessionKey ?? existing.sourceSessionKey ?? null,
        sourceConversationId:
          normalizedWorkItem.sourceConversationId ?? existing.sourceConversationId ?? null,
        providerId: normalizedWorkItem.providerId ?? existing.providerId ?? null,
        updatedAt: Math.max(existing.updatedAt, normalizedWorkItem.updatedAt),
      };
      if (areWorkItemRecordsEquivalent(existing, merged)) {
        return runtime;
      }
      nextWorkItems[index] = merged;
    } else {
      nextWorkItems.push(normalizedWorkItem);
    }

    const sortedWorkItems = sanitizeWorkItemRecords(nextWorkItems);
    const nextRooms = runtime.activeRoomRecords.map((room) =>
      room.workItemId === normalizedWorkItem.id || room.id === normalizedWorkItem.roomId
        ? {
            ...room,
            companyId: room.companyId ?? input.companyId,
            workItemId: normalizedWorkItem.id,
            ownerActorId: normalizedWorkItem.ownerActorId ?? room.ownerActorId ?? room.ownerAgentId ?? null,
            ownerAgentId: normalizedWorkItem.ownerActorId ?? room.ownerAgentId ?? null,
            status: normalizedWorkItem.status === "archived" ? "archived" : room.status ?? "active",
          }
        : room,
    );

    return this.saveRuntime({
      ...runtime,
      activeWorkItems: sortedWorkItems,
      activeRoomRecords: nextRooms,
    });
  }

  deleteWorkItem(input: AuthorityWorkItemDeleteRequest) {
    const runtime = this.loadRuntime(input.companyId);
    const nextWorkItems = runtime.activeWorkItems.filter((item) => item.id !== input.workItemId);
    if (nextWorkItems.length === runtime.activeWorkItems.length) {
      return runtime;
    }
    return this.saveRuntime({
      ...runtime,
      activeWorkItems: nextWorkItems,
    });
  }

  upsertDispatch(input: AuthorityDispatchUpsertRequest) {
    const runtime = this.loadRuntime(input.companyId);
    const nextDispatches = [
      input.dispatch,
      ...runtime.activeDispatches.filter((dispatch) => dispatch.id !== input.dispatch.id),
    ];
    const nextWorkItems = reconcileStoredWorkItems({
      company: this.deps.loadCompanyById(input.companyId),
      companyId: input.companyId,
      workItems: runtime.activeWorkItems,
      rooms: runtime.activeRoomRecords,
      artifacts: runtime.activeArtifacts,
      dispatches: nextDispatches,
      targetWorkItemIds: [input.dispatch.workItemId],
      targetRoomIds: [input.dispatch.roomId],
      targetTopicKeys: [input.dispatch.topicKey],
    });
    const nextRuntime = this.saveRuntime({
      ...runtime,
      activeWorkItems: nextWorkItems,
      activeDispatches: nextDispatches,
    });
    const nextDispatch = nextRuntime.activeDispatches.find((dispatch) => dispatch.id === input.dispatch.id) ?? null;
    if (nextDispatch) {
      this.deps.eventStore.appendDispatchAuditEvent({
        companyId: input.companyId,
        kind: "dispatch_record_upserted",
        dispatch: nextDispatch,
        timestamp: nextDispatch.updatedAt,
      });
    }
    return nextRuntime;
  }

  deleteDispatch(input: AuthorityDispatchDeleteRequest) {
    const runtime = this.loadRuntime(input.companyId);
    const deletedDispatch = runtime.activeDispatches.find((dispatch) => dispatch.id === input.dispatchId) ?? null;
    const nextDispatches = runtime.activeDispatches.filter((dispatch) => dispatch.id !== input.dispatchId);
    const nextWorkItems = reconcileStoredWorkItems({
      company: this.deps.loadCompanyById(input.companyId),
      companyId: input.companyId,
      workItems: runtime.activeWorkItems,
      rooms: runtime.activeRoomRecords,
      artifacts: runtime.activeArtifacts,
      dispatches: nextDispatches,
      targetWorkItemIds: [deletedDispatch?.workItemId],
      targetRoomIds: [deletedDispatch?.roomId],
      targetTopicKeys: [deletedDispatch?.topicKey],
    });
    const nextRuntime = this.saveRuntime({
      ...runtime,
      activeWorkItems: nextWorkItems,
      activeDispatches: nextDispatches,
    });
    if (deletedDispatch) {
      this.deps.eventStore.appendDispatchAuditEvent({
        companyId: input.companyId,
        kind: "dispatch_record_deleted",
        dispatch: deletedDispatch,
        timestamp: Date.now(),
      });
    }
    return nextRuntime;
  }

  upsertArtifact(input: AuthorityArtifactUpsertRequest) {
    const runtime = this.loadRuntime(input.companyId);
    const normalizedArtifact = {
      ...input.artifact,
      updatedAt: input.artifact.updatedAt || Date.now(),
      createdAt: input.artifact.createdAt || Date.now(),
    };
    const nextArtifacts = [
      normalizedArtifact,
      ...runtime.activeArtifacts.filter((artifact) => artifact.id !== normalizedArtifact.id),
    ].sort((left, right) => right.updatedAt - left.updatedAt);
    const nextWorkItems = reconcileStoredWorkItems({
      company: this.deps.loadCompanyById(input.companyId),
      companyId: input.companyId,
      workItems: runtime.activeWorkItems,
      rooms: runtime.activeRoomRecords,
      artifacts: nextArtifacts,
      dispatches: runtime.activeDispatches,
      targetWorkItemIds: [normalizedArtifact.workItemId],
    });
    const nextRuntime = this.saveRuntime({
      ...runtime,
      activeArtifacts: nextArtifacts,
      activeWorkItems: nextWorkItems,
    });
    const nextArtifact = nextRuntime.activeArtifacts.find((artifact) => artifact.id === normalizedArtifact.id) ?? null;
    if (nextArtifact) {
      this.deps.eventStore.appendArtifactAuditEvent({
        companyId: input.companyId,
        kind: "artifact_record_upserted",
        artifact: nextArtifact,
        timestamp: nextArtifact.updatedAt,
      });
    }
    return nextRuntime;
  }

  syncArtifactMirrors(input: AuthorityArtifactMirrorSyncRequest) {
    const runtime = this.loadRuntime(input.companyId);
    const mirrorPrefix = input.mirrorPrefix ?? "workspace:";
    const preserved = runtime.activeArtifacts.filter((artifact) => !artifact.id.startsWith(mirrorPrefix));
    const mergedById = new Map<string, ArtifactRecord>();
    for (const artifact of preserved) {
      mergedById.set(artifact.id, artifact);
    }
    const normalizedIncoming = input.artifacts.map((artifact) => ({
      ...artifact,
      updatedAt: artifact.updatedAt || Date.now(),
      createdAt: artifact.createdAt || Date.now(),
    }));
    for (const artifact of normalizedIncoming) {
      const existing = mergedById.get(artifact.id);
      if (!existing) {
        mergedById.set(artifact.id, artifact);
        continue;
      }
      mergedById.set(artifact.id, {
        ...existing,
        ...artifact,
        summary: artifact.summary ?? existing.summary,
        content: artifact.content ?? existing.content,
      });
    }
    const nextArtifacts = [...mergedById.values()].sort((left, right) => right.updatedAt - left.updatedAt);
    const nextWorkItems = reconcileStoredWorkItems({
      company: this.deps.loadCompanyById(input.companyId),
      companyId: input.companyId,
      workItems: runtime.activeWorkItems,
      rooms: runtime.activeRoomRecords,
      artifacts: nextArtifacts,
      dispatches: runtime.activeDispatches,
      targetWorkItemIds: normalizedIncoming.map((artifact) => artifact.workItemId),
    });
    const nextRuntime = this.saveRuntime({
      ...runtime,
      activeArtifacts: nextArtifacts,
      activeWorkItems: nextWorkItems,
    });
    if (normalizedIncoming.length > 0) {
      this.deps.eventStore.appendArtifactMirrorSyncEvent({
        companyId: input.companyId,
        mirrorPrefix,
        artifacts: normalizedIncoming,
        timestamp: Date.now(),
      });
    }
    return nextRuntime;
  }

  deleteArtifact(input: AuthorityArtifactDeleteRequest) {
    const runtime = this.loadRuntime(input.companyId);
    const deletedArtifact = runtime.activeArtifacts.find((artifact) => artifact.id === input.artifactId) ?? null;
    const nextArtifacts = runtime.activeArtifacts.filter((artifact) => artifact.id !== input.artifactId);
    const nextWorkItems = reconcileStoredWorkItems({
      company: this.deps.loadCompanyById(input.companyId),
      companyId: input.companyId,
      workItems: runtime.activeWorkItems,
      rooms: runtime.activeRoomRecords,
      artifacts: nextArtifacts,
      dispatches: runtime.activeDispatches,
      targetWorkItemIds: [deletedArtifact?.workItemId],
    });
    const nextRuntime = this.saveRuntime({
      ...runtime,
      activeArtifacts: nextArtifacts,
      activeWorkItems: nextWorkItems,
    });
    if (deletedArtifact) {
      this.deps.eventStore.appendArtifactAuditEvent({
        companyId: input.companyId,
        kind: "artifact_record_deleted",
        artifact: deletedArtifact,
        timestamp: Date.now(),
      });
    }
    return nextRuntime;
  }

  upsertDecisionTicket(input: AuthorityDecisionTicketUpsertRequest) {
    const runtime = this.loadRuntime(input.companyId);
    const normalizedTicket = normalizeDecisionTicketRecord(input.companyId, input.ticket);
    const existing =
      runtime.activeDecisionTickets.find((ticket) => ticket.id === normalizedTicket.id) ?? null;
    const nextTicket =
      existing
        ? (() => {
            const candidate = normalizeDecisionTicketRecord(input.companyId, {
              ...existing,
              ...normalizedTicket,
            });
            const existingRevision = normalizeDecisionTicketRevision(existing.revision);
            const requestedRevision = normalizeDecisionTicketRevision(normalizedTicket.revision);
            const candidateRevision = decisionTicketMaterialChanged(existing, candidate)
              ? Math.max(existingRevision, requestedRevision) + 1
              : Math.max(existingRevision, requestedRevision);
            if (
              candidateRevision < existingRevision ||
              (candidateRevision === existingRevision && candidate.updatedAt <= existing.updatedAt)
            ) {
              return existing;
            }
            return {
              ...candidate,
              revision: candidateRevision,
            };
          })()
        : normalizedTicket;
    const nextRuntime = this.saveRuntime({
      ...runtime,
      activeDecisionTickets: [
        nextTicket,
        ...runtime.activeDecisionTickets.filter((ticket) => ticket.id !== nextTicket.id),
      ].sort((left, right) => right.updatedAt - left.updatedAt),
    });
    if (!existing || nextTicket !== existing) {
      this.deps.eventStore.appendDecisionTicketEvent({
        companyId: input.companyId,
        kind: "decision_record_upserted",
        ticket: nextTicket,
        timestamp: nextTicket.updatedAt,
      });
    }
    return nextRuntime;
  }

  resolveDecisionTicket(input: AuthorityDecisionTicketResolveRequest) {
    const runtime = this.loadRuntime(input.companyId);
    const existing = runtime.activeDecisionTickets.find((ticket) => ticket.id === input.ticketId) ?? null;
    if (!existing) {
      throw new Error(`Unknown decision ticket: ${input.ticketId}`);
    }
    const option =
      input.optionId != null
        ? existing.options.find((candidate) => candidate.id === input.optionId) ?? null
        : null;
    const updatedAt = Math.max(existing.updatedAt, input.timestamp ?? Date.now());
    const resolution = input.resolution ?? option?.summary ?? option?.label ?? existing.resolution ?? null;
    const resolutionOptionId = option?.id ?? input.optionId ?? null;
    if (
      existing.status === "resolved" &&
      (existing.resolution ?? null) === resolution &&
      (existing.resolutionOptionId ?? null) === resolutionOptionId &&
      updatedAt <= existing.updatedAt
    ) {
      return runtime;
    }
    const nextTickets = runtime.activeDecisionTickets
      .map((ticket) =>
        ticket.id === input.ticketId
          ? {
              ...ticket,
              status: "resolved" as const,
              resolution,
              resolutionOptionId,
              revision: normalizeDecisionTicketRevision(ticket.revision) + 1,
              updatedAt,
            }
          : ticket,
      )
      .sort((left, right) => right.updatedAt - left.updatedAt);
    const nextRuntime = this.saveRuntime({
      ...runtime,
      activeDecisionTickets: nextTickets,
    });
    const nextTicket = nextTickets.find((ticket) => ticket.id === input.ticketId) ?? null;
    if (nextTicket) {
      this.deps.eventStore.appendDecisionTicketEvent({
        companyId: input.companyId,
        kind: "decision_resolved",
        ticket: nextTicket,
        timestamp: updatedAt,
      });
    }
    return nextRuntime;
  }

  cancelDecisionTicket(input: AuthorityDecisionTicketCancelRequest) {
    const runtime = this.loadRuntime(input.companyId);
    const existing = runtime.activeDecisionTickets.find((ticket) => ticket.id === input.ticketId) ?? null;
    if (!existing) {
      throw new Error(`Unknown decision ticket: ${input.ticketId}`);
    }
    const updatedAt = Math.max(existing.updatedAt, input.timestamp ?? Date.now());
    const resolution = input.resolution ?? existing.resolution ?? null;
    if (
      existing.status === "cancelled" &&
      (existing.resolution ?? null) === resolution &&
      updatedAt <= existing.updatedAt
    ) {
      return runtime;
    }
    const nextTickets = runtime.activeDecisionTickets
      .map((ticket) =>
        ticket.id === input.ticketId
          ? {
              ...ticket,
              status: "cancelled" as const,
              resolution,
              resolutionOptionId: null,
              revision: normalizeDecisionTicketRevision(ticket.revision) + 1,
              updatedAt,
            }
          : ticket,
      )
      .sort((left, right) => right.updatedAt - left.updatedAt);
    const nextRuntime = this.saveRuntime({
      ...runtime,
      activeDecisionTickets: nextTickets,
    });
    const nextTicket = nextTickets.find((ticket) => ticket.id === input.ticketId) ?? null;
    if (nextTicket) {
      this.deps.eventStore.appendDecisionTicketEvent({
        companyId: input.companyId,
        kind: "decision_cancelled",
        ticket: nextTicket,
        timestamp: updatedAt,
      });
    }
    return nextRuntime;
  }

  deleteDecisionTicket(input: AuthorityDecisionTicketDeleteRequest) {
    const runtime = this.loadRuntime(input.companyId);
    const deletedTicket = runtime.activeDecisionTickets.find((ticket) => ticket.id === input.ticketId) ?? null;
    const nextRuntime = this.saveRuntime({
      ...runtime,
      activeDecisionTickets: runtime.activeDecisionTickets.filter((ticket) => ticket.id !== input.ticketId),
    });
    if (deletedTicket) {
      this.deps.eventStore.appendDecisionTicketEvent({
        companyId: input.companyId,
        kind: "decision_record_deleted",
        ticket: deletedTicket,
        timestamp: Date.now(),
      });
    }
    return nextRuntime;
  }

  private buildRuntimeSnapshotFromTables(
    companyId: string,
    company: Company | null,
  ): AuthorityCompanyRuntimeSnapshot {
    const aggregates = this.readPayloadTable<RequirementAggregateRecord>("requirement_aggregates", companyId);
    return this.computeAgentRuntimeSnapshot(
      companyId,
      normalizeRuntimeSnapshot(company, {
        companyId,
        activeMissionRecords: this.readPayloadTable<ConversationMissionRecord>("missions", companyId),
        activeConversationStates: this.readPayloadTable<ConversationStateRecord>("conversation_states", companyId),
        activeWorkItems: this.readPayloadTable<WorkItemRecord>("work_items", companyId),
        activeRequirementAggregates: aggregates,
        activeRequirementEvidence: this.readPayloadTable<RequirementEvidenceEvent>("requirement_evidence", companyId),
        activeRoomRecords: this.readPayloadTable<RequirementRoomRecord>("rooms", companyId),
        activeRoundRecords: this.readPayloadTable<RoundRecord>("rounds", companyId),
        activeArtifacts: this.readPayloadTable<ArtifactRecord>("artifacts", companyId),
        activeDispatches: this.readPayloadTable<DispatchRecord>("dispatches", companyId),
        activeRoomBindings: this.readPayloadTable<RoomConversationBindingRecord>("room_bindings", companyId),
        activeSupportRequests: this.readPayloadTable<SupportRequestRecord>("support_requests", companyId),
        activeEscalations: this.readPayloadTable<EscalationRecord>("escalations", companyId),
        activeDecisionTickets: this.readPayloadTable<DecisionTicketRecord>("decision_tickets", companyId),
        activeAgentSessions: [],
        activeAgentRuns: [],
        activeAgentRuntime: [],
        activeAgentStatuses: [],
        activeAgentStatusHealth: null,
        primaryRequirementId: aggregates.find((aggregate) => aggregate.primary)?.id ?? null,
        updatedAt: Date.now(),
      }),
    );
  }

  private refreshManagedContextFiles(companyId: string, runtime: AuthorityCompanyRuntimeSnapshot) {
    const company = this.deps.loadCompanyById(companyId);
    if (!company) {
      return;
    }
    const syncAuthorityAgentFileMirror = getSyncAuthorityAgentFileMirror();
    const files = buildManagedExecutorFilesForCompany(company, {
      activeWorkItems: runtime.activeWorkItems,
      activeSupportRequests: runtime.activeSupportRequests,
      activeEscalations: runtime.activeEscalations,
      activeDecisionTickets: runtime.activeDecisionTickets,
    });
    const projectionKeys = new Set(
      buildManagedExecutorProjectionFilesForCompany(company, {
        activeWorkItems: runtime.activeWorkItems,
        activeSupportRequests: runtime.activeSupportRequests,
        activeEscalations: runtime.activeEscalations,
        activeDecisionTickets: runtime.activeDecisionTickets,
      }).map((file) => `${file.agentId}:${file.name}`),
    );
    for (const file of files) {
      const saved = this.deps.setAgentFile(file.agentId, file.name, file.content);
      if (!saved.changed || !projectionKeys.has(`${file.agentId}:${file.name}`)) {
        continue;
      }
      syncAuthorityAgentFileMirror?.({
        agentId: file.agentId,
        name: file.name,
        content: file.content,
      });
    }
  }

  private readActiveExecutorRuns(companyId: string): AgentRunRecord[] {
    const db = this.deps.getDb();
    const rows = db.prepare(`
      SELECT id, actor_id, session_key, status, started_at, finished_at, payload_json
      FROM executor_runs
      WHERE company_id = ?
      ORDER BY started_at DESC
    `).all(companyId) as Array<{
      id: string;
      actor_id: string;
      session_key: string;
      status: string;
      started_at: number;
      finished_at?: number | null;
      payload_json?: string;
    }>;

    return rows
      .map((row) => {
        const payload = parseJson<Record<string, unknown>>(row.payload_json, {});
        const state = normalizeExecutorRunState(row.status);
        if (!state || state === "completed" || state === "aborted" || state === "error") {
          return null;
        }
        return {
          runId: row.id,
          agentId: row.actor_id,
          sessionKey: row.session_key,
          providerId: EXECUTOR_PROVIDER_ID,
          state,
          startedAt: row.started_at,
          lastEventAt: readNumber(payload.lastEventAt) ?? row.finished_at ?? row.started_at,
          endedAt: row.finished_at ?? null,
          streamKindsSeen: ["lifecycle"],
          toolNamesSeen: [],
          error: readString(payload.errorMessage),
        } satisfies AgentRunRecord;
      })
      .filter(isPresent)
      .sort((left, right) => right.lastEventAt - left.lastEventAt);
  }

  private computeAgentRuntimeSnapshot(
    companyId: string,
    snapshot: AuthorityCompanyRuntimeSnapshot,
    overrides?: {
      activeAgentSessions?: AuthorityCompanyRuntimeSnapshot["activeAgentSessions"];
      activeAgentRuns?: AuthorityCompanyRuntimeSnapshot["activeAgentRuns"];
    },
  ): AuthorityCompanyRuntimeSnapshot {
    const company = this.deps.loadCompanyById(companyId);
    const normalizedCompany = company ? normalizeCompany(company) : null;
    const activeAgentSessions = reconcileAgentSessionExecutionContext({
      sessions: [...(overrides?.activeAgentSessions ?? snapshot.activeAgentSessions ?? [])].sort(
        (left, right) => (right.lastSeenAt ?? 0) - (left.lastSeenAt ?? 0),
      ),
      dispatches: snapshot.activeDispatches ?? [],
    });
    const activeAgentRuns = [...(overrides?.activeAgentRuns ?? this.readActiveExecutorRuns(companyId))]
      .filter((run) => run.state !== "completed" && run.state !== "aborted" && run.state !== "error")
      .sort((left, right) => right.lastEventAt - left.lastEventAt);
    const activeAgentRuntime = buildAgentRuntimeProjection({
      providerId: EXECUTOR_PROVIDER_ID,
      agentIds: this.deps.getCompanyAgentIds(companyId),
      sessions: activeAgentSessions,
      runs: activeAgentRuns,
    });
    const activeAgentStatuses = normalizedCompany
      ? buildCanonicalAgentStatusProjection({
          company: normalizedCompany,
          activeWorkItems: snapshot.activeWorkItems,
          activeDispatches: snapshot.activeDispatches,
          activeSupportRequests: snapshot.activeSupportRequests,
          activeEscalations: snapshot.activeEscalations,
          activeAgentRuntime,
          activeAgentSessions,
          now: Date.now(),
        })
      : [];
    return {
      ...snapshot,
      companyId,
      activeAgentSessions,
      activeAgentRuns,
      activeAgentRuntime,
      activeAgentStatuses,
      activeAgentStatusHealth: buildCanonicalAgentStatusHealth({
        company: normalizedCompany,
        statuses: activeAgentStatuses,
        source: "authority",
        generatedAt: Date.now(),
        note: normalizedCompany
          ? null
          : "Authority could not load the current company while projecting canonical agent statuses.",
      }),
    };
  }

  private readStoredRuntime(companyId: string): {
    company: Company | null;
    snapshot: AuthorityCompanyRuntimeSnapshot;
    exists: boolean;
  } {
    const company = this.deps.loadCompanyById(companyId);
    const row = this.deps.getDb().prepare("SELECT snapshot_json FROM runtimes WHERE company_id = ?").get(companyId) as
      | { snapshot_json?: string }
      | undefined;
    if (row?.snapshot_json) {
      return {
        company,
        snapshot: normalizeRuntimeSnapshot(
          company,
          parseJson<AuthorityCompanyRuntimeSnapshot>(row.snapshot_json, EMPTY_RUNTIME(companyId)),
        ),
        exists: true,
      };
    }

    return {
      company,
      snapshot: this.buildRuntimeSnapshotFromTables(companyId, company),
      exists: false,
    };
  }

  private reconcileRuntimeForRead(input: {
    company: Company | null;
    snapshot: AuthorityCompanyRuntimeSnapshot;
  }): {
    runtime: AuthorityCompanyRuntimeSnapshot;
    changed: boolean;
  } {
    const normalized = normalizeRuntimeSnapshot(input.company, input.snapshot);
    const runtimeAfterEvents = this.deps.eventStore.replayRuntimeFromEventLog(
      input.snapshot.companyId,
      input.company,
      normalized,
    );
    const eventReplayChanged =
      JSON.stringify(normalized.activeDispatches) !== JSON.stringify(runtimeAfterEvents.activeDispatches) ||
      JSON.stringify(normalized.activeAgentSessions ?? []) !== JSON.stringify(runtimeAfterEvents.activeAgentSessions ?? []);
    const reconciled = reconcileAuthorityRequirementRuntime({
      company: input.company,
      runtime: runtimeAfterEvents,
    });
    const requirementRuntimeChanged = runtimeRequirementControlChanged(runtimeAfterEvents, reconciled.runtime);
    const runtimeAfterRequirementControl = requirementRuntimeChanged ? reconciled.runtime : runtimeAfterEvents;
    const runtimeWithAgentProjection = this.computeAgentRuntimeSnapshot(
      input.snapshot.companyId,
      runtimeAfterRequirementControl,
    );
    const changed =
      eventReplayChanged ||
      requirementRuntimeChanged ||
      JSON.stringify(runtimeAfterRequirementControl.activeAgentSessions) !== JSON.stringify(runtimeWithAgentProjection.activeAgentSessions) ||
      JSON.stringify(runtimeAfterRequirementControl.activeAgentRuns) !== JSON.stringify(runtimeWithAgentProjection.activeAgentRuns) ||
      JSON.stringify(runtimeAfterRequirementControl.activeAgentRuntime) !== JSON.stringify(runtimeWithAgentProjection.activeAgentRuntime) ||
      JSON.stringify(runtimeAfterRequirementControl.activeAgentStatuses) !== JSON.stringify(runtimeWithAgentProjection.activeAgentStatuses);
    return {
      runtime: runtimeWithAgentProjection,
      changed,
    };
  }

  private readPayloadTable<T>(table: RuntimeSliceTables, companyId: string): T[] {
    const rows = this.deps.getDb().prepare(`SELECT payload_json FROM ${table} WHERE company_id = ? ORDER BY updated_at DESC`).all(companyId) as Array<{
      payload_json: string;
    }>;
    return rows.map((row) => parseJson<T | null>(row.payload_json, null)).filter(isPresent);
  }

  private replacePayloadTable<T extends object>(table: RuntimeSliceTables, companyId: string, records: T[]) {
    const db = this.deps.getDb();
    db.prepare(`DELETE FROM ${table} WHERE company_id = ?`).run(companyId);
    for (const record of records) {
      const recordMeta = record as { id?: string; updatedAt?: number };
      const id =
        typeof recordMeta.id === "string"
          ? recordMeta.id
          : table === "conversation_states"
            ? (record as ConversationStateRecord).conversationId
            : table === "room_bindings"
              ? buildRoomConversationBindingKey(record as RoomConversationBindingRecord)
              : crypto.randomUUID();
      const updatedAt =
        typeof recordMeta.updatedAt === "number"
          ? recordMeta.updatedAt
          : Date.now();
      db.prepare(`
        INSERT INTO ${table} (id, company_id, updated_at, payload_json)
        VALUES (?, ?, ?, ?)
      `).run(id, companyId, updatedAt, JSON.stringify(record));
    }
  }
}
