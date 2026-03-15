import type { DatabaseSync } from "node:sqlite";
import { createCompanyEvent, type CompanyEvent } from "../../../../src/domain/delegation/events";
import type {
  DecisionTicketRecord,
  DispatchRecord,
  RequirementRoomRecord,
  RoomConversationBindingRecord,
} from "../../../../src/domain/delegation/types";
import type { ArtifactRecord } from "../../../../src/domain/artifact/types";
import type { Company } from "../../../../src/domain/org/types";
import type {
  AuthorityCompanyEventsResponse,
  AuthorityCompanyRuntimeSnapshot,
} from "../../../../src/infrastructure/authority/contract";
import {
  isPresent,
  normalizeDecisionTicketRevision,
  parseJson,
  shallowJsonEqual,
} from "../persistence/authority-persistence-shared";
import { normalizeCompanyEventsPageRows } from "./company-event-pagination";
import { reconcileDispatchesFromCompanyEvents, repairAgentSessionsFromDispatches } from "../agent/runtime-authority";

type AuthorityCompanyEventStoreDependencies = {
  getDb: () => DatabaseSync;
  loadCompanyById: (companyId: string) => Company | null;
  loadRuntime: (companyId: string) => AuthorityCompanyRuntimeSnapshot;
  saveRuntime: (snapshot: AuthorityCompanyRuntimeSnapshot) => AuthorityCompanyRuntimeSnapshot;
};

export class AuthorityCompanyEventStore {
  constructor(private readonly deps: AuthorityCompanyEventStoreDependencies) {}

  replayRuntimeFromEventLog(
    companyId: string,
    company: Company | null,
    runtime: AuthorityCompanyRuntimeSnapshot,
  ) {
    return this.replayCompanyEventsIntoRuntime(companyId, company, runtime);
  }

  appendCompanyEvent(event: CompanyEvent) {
    const db = this.deps.getDb();
    db.prepare(`
      INSERT INTO event_log (event_id, company_id, kind, timestamp, payload_json)
      VALUES (?, ?, ?, ?, ?)
    `).run(event.eventId, event.companyId, event.kind, event.createdAt, JSON.stringify(event));
    const runtimeChanged = this.reconcileDelegationEventLog(event.companyId);
    return { ok: true as const, event, runtimeChanged };
  }

  private readAllCompanyEvents(companyId: string): CompanyEvent[] {
    const db = this.deps.getDb();
    const rows = db.prepare(`
      SELECT payload_json
      FROM event_log
      WHERE company_id = ?
      ORDER BY seq ASC
    `).all(companyId) as Array<{ payload_json: string }>;
    return rows
      .map((row) => parseJson<CompanyEvent | null>(row.payload_json, null))
      .filter(isPresent);
  }

  private replayCompanyEventsIntoRuntime(
    companyId: string,
    company: Company | null,
    runtime: AuthorityCompanyRuntimeSnapshot,
  ): AuthorityCompanyRuntimeSnapshot {
    if (!company) {
      return runtime;
    }
    const nextEvents = this.readAllCompanyEvents(companyId);
    const nextDispatches = reconcileDispatchesFromCompanyEvents({
      company,
      events: nextEvents,
      existingDispatches: runtime.activeDispatches,
    });
    const nextSessions = repairAgentSessionsFromDispatches({
      sessions: runtime.activeAgentSessions ?? [],
      runs: runtime.activeAgentRuns ?? [],
      dispatches: nextDispatches,
    });
    const dispatchesChanged = !shallowJsonEqual(runtime.activeDispatches, nextDispatches);
    const sessionsChanged = !shallowJsonEqual(runtime.activeAgentSessions ?? [], nextSessions);
    return dispatchesChanged || sessionsChanged
      ? {
          ...runtime,
          activeDispatches: nextDispatches,
          activeAgentSessions: nextSessions,
        }
      : runtime;
  }

  private reconcileDelegationEventLog(companyId: string): boolean {
    const company = this.deps.loadCompanyById(companyId);
    if (!company) {
      return false;
    }
    const runtime = this.deps.loadRuntime(companyId);
    const replayed = this.replayCompanyEventsIntoRuntime(companyId, company, runtime);
    if (shallowJsonEqual(runtime, replayed)) {
      return false;
    }
    this.deps.saveRuntime({
      ...runtime,
      ...replayed,
    });
    return true;
  }

  appendDecisionTicketEvent(input: {
    companyId: string;
    kind:
      | "decision_record_upserted"
      | "decision_record_deleted"
      | "decision_resolved"
      | "decision_cancelled";
    ticket: DecisionTicketRecord;
    timestamp: number;
  }) {
    const actorId = input.ticket.decisionOwnerActorId?.trim() || "system:decision-ticket";
    return this.appendCompanyEvent(
      createCompanyEvent({
        companyId: input.companyId,
        kind: input.kind,
        workItemId: input.ticket.workItemId ?? undefined,
        roomId: input.ticket.roomId ?? undefined,
        fromActorId: actorId,
        targetActorId: actorId,
        sessionKey: input.ticket.sourceConversationId ?? undefined,
        createdAt: input.timestamp,
        payload: {
          ticketId: input.ticket.id,
          sourceType: input.ticket.sourceType,
          sourceId: input.ticket.sourceId,
          escalationId: input.ticket.escalationId ?? null,
          aggregateId: input.ticket.aggregateId ?? null,
          decisionType: input.ticket.decisionType,
          summary: input.ticket.summary,
          requiresHuman: input.ticket.requiresHuman,
          status: input.ticket.status,
          resolution: input.ticket.resolution ?? null,
          resolutionOptionId: input.ticket.resolutionOptionId ?? null,
          revision: normalizeDecisionTicketRevision(input.ticket.revision),
        },
      }),
    );
  }

  appendDispatchAuditEvent(input: {
    companyId: string;
    kind: "dispatch_record_upserted" | "dispatch_record_deleted";
    dispatch: DispatchRecord;
    timestamp: number;
  }) {
    const actorId = input.dispatch.fromActorId?.trim() || "system:dispatch-record";
    return this.appendCompanyEvent(
      createCompanyEvent({
        companyId: input.companyId,
        kind: input.kind,
        dispatchId: input.dispatch.id,
        workItemId: input.dispatch.workItemId,
        topicKey: input.dispatch.topicKey ?? undefined,
        roomId: input.dispatch.roomId ?? undefined,
        fromActorId: actorId,
        targetActorId: input.dispatch.targetActorIds[0] ?? undefined,
        sessionKey: input.dispatch.consumerSessionKey ?? undefined,
        providerRunId: input.dispatch.providerRunId ?? undefined,
        createdAt: input.timestamp,
        payload: {
          title: input.dispatch.title,
          summary: input.dispatch.summary,
          status: input.dispatch.status,
          deliveryState: input.dispatch.deliveryState ?? null,
          checkoutState: input.dispatch.checkoutState ?? null,
          checkoutActorId: input.dispatch.checkoutActorId ?? null,
          checkoutSessionKey: input.dispatch.checkoutSessionKey ?? null,
          checkedOutAt: input.dispatch.checkedOutAt ?? null,
          releasedAt: input.dispatch.releasedAt ?? null,
          releaseReason: input.dispatch.releaseReason ?? null,
          fromActorId: input.dispatch.fromActorId ?? null,
          targetActorIds: input.dispatch.targetActorIds,
          sourceMessageId: input.dispatch.sourceMessageId ?? null,
          responseMessageId: input.dispatch.responseMessageId ?? null,
          latestEventId: input.dispatch.latestEventId ?? null,
          revision:
            Number.isFinite(input.dispatch.revision) && Number(input.dispatch.revision) > 0
              ? Math.floor(Number(input.dispatch.revision))
              : 1,
        },
      }),
    );
  }

  appendRoomAuditEvent(input: {
    companyId: string;
    kind: "room_record_upserted" | "room_record_deleted";
    room: RequirementRoomRecord;
    timestamp: number;
  }) {
    const actorId =
      input.room.ownerActorId?.trim() || input.room.ownerAgentId?.trim() || "system:room-record";
    return this.appendCompanyEvent(
      createCompanyEvent({
        companyId: input.companyId,
        kind: input.kind,
        workItemId: input.room.workItemId ?? undefined,
        topicKey: input.room.topicKey ?? undefined,
        roomId: input.room.id,
        fromActorId: actorId,
        targetActorId: input.room.batonActorId ?? undefined,
        sessionKey: input.room.sessionKey,
        createdAt: input.timestamp,
        payload: {
          title: input.room.title,
          headline: input.room.headline ?? null,
          status: input.room.status,
          progress: input.room.progress ?? null,
          scope: input.room.scope ?? null,
          memberIds: input.room.memberIds,
          memberActorIds: input.room.memberActorIds,
          transcriptCount: input.room.transcript.length,
          lastMessageAt:
            input.room.transcript.length > 0
              ? Math.max(...input.room.transcript.map((message) => message.timestamp))
              : null,
          revision:
            Number.isFinite(input.room.revision) && Number(input.room.revision) > 0
              ? Math.floor(Number(input.room.revision))
              : 1,
        },
      }),
    );
  }

  appendRoomBindingsAuditEvent(input: {
    companyId: string;
    bindings: RoomConversationBindingRecord[];
    timestamp: number;
  }) {
    const bindings = input.bindings;
    return this.appendCompanyEvent(
      createCompanyEvent({
        companyId: input.companyId,
        kind: "room_bindings_upserted",
        roomId: bindings.length === 1 ? bindings[0]?.roomId : undefined,
        fromActorId: "system:room-bindings",
        createdAt: input.timestamp,
        payload: {
          bindingCount: bindings.length,
          roomIds: [...new Set(bindings.map((binding) => binding.roomId).filter(Boolean))],
          providerIds: [...new Set(bindings.map((binding) => binding.providerId).filter(Boolean))],
          conversationIds: bindings.map((binding) => binding.conversationId),
          actorIds: bindings
            .map((binding) => binding.actorId)
            .filter((value): value is string => typeof value === "string" && value.trim().length > 0),
        },
      }),
    );
  }

  appendArtifactAuditEvent(input: {
    companyId: string;
    kind: "artifact_record_upserted" | "artifact_record_deleted";
    artifact: ArtifactRecord;
    timestamp: number;
  }) {
    const actorId =
      input.artifact.ownerActorId?.trim() ||
      input.artifact.sourceActorId?.trim() ||
      "system:artifact-record";
    return this.appendCompanyEvent(
      createCompanyEvent({
        companyId: input.companyId,
        kind: input.kind,
        workItemId: input.artifact.workItemId ?? undefined,
        fromActorId: actorId,
        createdAt: input.timestamp,
        payload: {
          artifactId: input.artifact.id,
          title: input.artifact.title,
          kindLabel: input.artifact.kind,
          status: input.artifact.status,
          ownerActorId: input.artifact.ownerActorId ?? null,
          providerId: input.artifact.providerId ?? null,
          sourceActorId: input.artifact.sourceActorId ?? null,
          sourceName: input.artifact.sourceName ?? null,
          sourcePath: input.artifact.sourcePath ?? null,
          sourceUrl: input.artifact.sourceUrl ?? null,
          summary: input.artifact.summary ?? null,
          revision:
            Number.isFinite(input.artifact.revision) && Number(input.artifact.revision) > 0
              ? Math.floor(Number(input.artifact.revision))
              : 1,
        },
      }),
    );
  }

  appendArtifactMirrorSyncEvent(input: {
    companyId: string;
    mirrorPrefix: string;
    artifacts: ArtifactRecord[];
    timestamp: number;
  }) {
    return this.appendCompanyEvent(
      createCompanyEvent({
        companyId: input.companyId,
        kind: "artifact_mirror_synced",
        fromActorId: "system:artifact-mirror",
        createdAt: input.timestamp,
        payload: {
          mirrorPrefix: input.mirrorPrefix,
          artifactCount: input.artifacts.length,
          artifactIds: input.artifacts.map((artifact) => artifact.id),
          workItemIds: [...new Set(input.artifacts.map((artifact) => artifact.workItemId).filter(Boolean))],
        },
      }),
    );
  }

  appendRuntimeRepairEvent(input: {
    companyId: string;
    timestamp: number;
    storedRuntimeExisted: boolean;
    reconciledChanged: boolean;
    runtime: AuthorityCompanyRuntimeSnapshot;
  }) {
    return this.appendCompanyEvent(
      createCompanyEvent({
        companyId: input.companyId,
        kind: "runtime_repaired",
        fromActorId: "system:authority-repair",
        createdAt: input.timestamp,
        payload: {
          storedRuntimeExisted: input.storedRuntimeExisted,
          reconciledChanged: input.reconciledChanged,
          primaryRequirementId: input.runtime.primaryRequirementId,
          requirementCount: input.runtime.activeRequirementAggregates.length,
          roomCount: input.runtime.activeRoomRecords.length,
          dispatchCount: input.runtime.activeDispatches.length,
          artifactCount: input.runtime.activeArtifacts.length,
          decisionTicketCount: input.runtime.activeDecisionTickets.length,
        },
      }),
    );
  }

  listCompanyEvents(
    companyId: string,
    cursor?: string | null,
    since?: number,
    limit?: number,
    recent?: boolean,
  ): AuthorityCompanyEventsResponse {
    const db = this.deps.getDb();
    const clauses = ["company_id = ?"];
    const args: Array<string | number> = [companyId];
    const pageLimit =
      typeof limit === "number" && Number.isFinite(limit) ? Math.max(1, Math.floor(limit)) : 200;
    if (cursor) {
      clauses.push(recent ? "seq < ?" : "seq > ?");
      args.push(Number.parseInt(cursor, 10) || 0);
    }
    if (typeof since === "number") {
      clauses.push("timestamp >= ?");
      args.push(since);
    }
    const rows = db.prepare(`
      SELECT seq, payload_json
      FROM event_log
      WHERE ${clauses.join(" AND ")}
      ORDER BY seq ${recent ? "DESC" : "ASC"}
      LIMIT ${pageLimit + 1}
    `).all(...args) as Array<{ seq: number; payload_json: string }>;
    const page = normalizeCompanyEventsPageRows({
      rows,
      limit: pageLimit,
      recent,
    });
    const events = page.rows
      .map((row) => parseJson<CompanyEvent | null>(row.payload_json, null))
      .filter(isPresent);
    return {
      companyId,
      events,
      nextCursor: page.nextCursor,
    };
  }
}
