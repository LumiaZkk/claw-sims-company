import { beforeEach, describe, expect, it } from "vitest";
import { clearRequirementRoomRecords, loadRequirementRoomRecords, persistRequirementRoomRecords } from "./room-persistence";
import type { RequirementRoomRecord } from "./types";

describe("room-persistence", () => {
  const companyId = "company-room-test";
  const storage = new Map<string, string>();

  beforeEach(() => {
    storage.clear();
    Object.defineProperty(globalThis, "localStorage", {
      value: {
        getItem: (key: string) => storage.get(key) ?? null,
        setItem: (key: string, value: string) => {
          storage.set(key, value);
        },
        removeItem: (key: string) => {
          storage.delete(key);
        },
      },
      configurable: true,
      writable: true,
    });
  });

  it("drops provider conversation refs and keeps product room data as the persisted truth source", () => {
    const room: RequirementRoomRecord = {
      id: "workitem:mission-consistency-foundation",
      companyId,
      workItemId: "mission:consistency-foundation",
      sessionKey: "room:workitem:mission-consistency-foundation",
      title: "一致性底座与内部审阅系统执行方案",
      topicKey: "mission:consistency-foundation",
      memberIds: ["co-ceo", "co-cto"],
      memberActorIds: ["co-ceo", "co-cto"],
      ownerAgentId: "co-ceo",
      ownerActorId: "co-ceo",
      status: "active",
      providerConversationRefs: [
        {
          providerId: "openclaw",
          conversationId: "agent:co-cto:group:legacy-room",
          actorId: "co-cto",
        },
      ],
      transcript: [
        {
          id: "room:user:1",
          role: "user",
          text: "@CTO 请输出执行方案",
          timestamp: 1_000,
        },
      ],
      createdAt: 1_000,
      updatedAt: 1_100,
    };

    persistRequirementRoomRecords(companyId, [room]);
    const [loaded] = loadRequirementRoomRecords(companyId);

    expect(loaded?.id).toBe(room.id);
    expect(loaded?.providerConversationRefs).toBeUndefined();
    expect(loaded?.memberIds).toEqual(["co-ceo", "co-cto"]);
    expect(loaded?.memberActorIds).toEqual(["co-ceo", "co-cto"]);
    expect(loaded?.transcript).toHaveLength(1);

    clearRequirementRoomRecords(companyId);
    expect(loadRequirementRoomRecords(companyId)).toEqual([]);
  });
});
