import { describe, expect, it } from "vitest";
import {
  buildRequirementCenterPageSurface,
  buildRequirementRoomDispatchCheckout,
  buildRequirementTimeline,
  selectRequirementCenterDeliverableFiles,
} from "./requirement-center-page-view-model";

describe("requirement-center-page-view-model", () => {
  it("prefers scoped deliverables and falls back to the full workspace list", () => {
    const workspaceFiles = [
      { key: "a", agentId: "writer", artifactId: "artifact-1", name: "chapter-1.md" },
      { key: "b", agentId: "editor", artifactId: "artifact-2", name: "review.md" },
    ] as any[];

    const scoped = selectRequirementCenterDeliverableFiles({
      workspaceFiles: workspaceFiles as any,
      scopedArtifactIds: new Set(["artifact-2"]),
      memberIds: [],
    });
    expect(scoped.map((file) => file.key)).toEqual(["b"]);

    const fallback = selectRequirementCenterDeliverableFiles({
      workspaceFiles: workspaceFiles as any,
      scopedArtifactIds: new Set(["missing"]),
      memberIds: [],
    });
    expect(fallback.map((file) => file.key)).toEqual(["a", "b"]);
  });

  it("summarizes checkout state for the latest room dispatches", () => {
    const checkout = buildRequirementRoomDispatchCheckout({
      activeCompany: {
        employees: [
          { agentId: "writer", nickname: "阿墨" },
          { agentId: "editor", nickname: "小周" },
        ],
      } as any,
      roomDispatches: [
        {
          id: "dispatch-2",
          updatedAt: 20,
          status: "acknowledged",
          checkoutState: "claimed",
          checkoutActorId: "writer",
          targetActorIds: ["writer"],
          title: "第 2 章改稿",
        },
        {
          id: "dispatch-1",
          updatedAt: 10,
          status: "pending",
          checkoutState: "open",
          checkoutActorId: null,
          targetActorIds: ["editor"],
          title: "第 1 章初稿",
        },
      ] as any,
    });

    expect(checkout.claimedCount).toBe(1);
    expect(checkout.openCount).toBe(1);
    expect(checkout.latest?.checkoutState).toBe("claimed");
  });

  it("dedupes requirement events by revision while keeping the newest evidence first", () => {
    const timeline = buildRequirementTimeline({
      aggregate: {
        id: "requirement-1",
        workItemId: "work-1",
        roomId: "room-1",
        topicKey: "topic-1",
      } as any,
      activeRequirementEvidence: [
        {
          id: "event-older",
          aggregateId: "requirement-1",
          eventType: "requirement_acceptance_requested",
          timestamp: 10,
          source: "company-event",
          payload: { revision: 2 },
        },
        {
          id: "event-newer",
          aggregateId: "requirement-1",
          eventType: "requirement_acceptance_requested",
          timestamp: 20,
          source: "local-command",
          payload: { revision: 2 },
        },
        {
          id: "event-chat",
          aggregateId: "requirement-1",
          eventType: "chat_message_synced",
          timestamp: 15,
          source: "gateway-chat",
          payload: { roomId: "room-1" },
        },
      ] as any,
    });

    expect(timeline.map((event) => event.id)).toEqual(["event-newer", "event-chat"]);
  });

  it("includes recent heartbeat audit entries when company events are provided", () => {
    const surface = buildRequirementCenterPageSurface({
      activeCompany: {
        id: "company-1",
        name: "nl",
        employees: [],
        orgSettings: {
          heartbeatPolicy: {
            enabled: true,
            paused: false,
            intervalMinutes: 5,
            sourceOfTruth: "cyber_company",
            syncTarget: "openclaw",
          },
          autonomyState: {
            lastEngineRunAt: 100,
            lastHeartbeatCheckAt: 100,
            lastHeartbeatTrigger: "event",
            lastHeartbeatSkipReason: null,
            lastEngineActions: [],
          },
        },
      } as any,
      companyEvents: [
        {
          eventId: "heartbeat-1",
          companyId: "company-1",
          kind: "heartbeat_cycle_checked",
          fromActorId: "system:ops",
          createdAt: 120,
          payload: {
            trigger: "event",
            ran: true,
            reasons: ["room.append", "takeover.transition"],
            actions: ["已刷新主线汇报"],
            actionCount: 1,
          },
        },
      ] as any,
      activeConversationStates: [],
      activeDispatches: [],
      activeRoomRecords: [],
      activeWorkItems: [],
      activeRequirementAggregates: [],
      activeRequirementEvidence: [],
      activeDecisionTickets: [],
      primaryRequirementId: null,
      activeArtifacts: [],
      companySessions: [],
      companySessionSnapshots: [],
      currentTime: 200,
      fileTasks: [],
      sessionStates: new Map(),
      sessionTakeoverPacks: new Map(),
      workspaceFiles: [],
      ceoAgentId: null,
    });

    expect(surface.heartbeatSurface.recentAudit).toHaveLength(1);
    expect(surface.heartbeatSurface.recentAudit[0]?.reasonLabels).toEqual([
      "需求房新增回报",
      "接管状态已变化",
    ]);
  });
});
