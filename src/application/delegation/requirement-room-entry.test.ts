import { describe, expect, it } from "vitest";
import type { RequirementRoomRecord } from "../../domain/delegation/types";
import { resolveRequirementRoomEntryTarget } from "./requirement-room-entry";

function createRoom(overrides: Partial<RequirementRoomRecord> = {}): RequirementRoomRecord {
  return {
    id: "workitem:topic:mission:alpha",
    companyId: "company-1",
    title: "Alpha 需求房",
    topicKey: "mission:alpha",
    memberActorIds: ["ceo", "cto"],
    memberIds: ["ceo", "cto"],
    ownerActorId: "ceo",
    ownerAgentId: "ceo",
    createdAt: 1_000,
    updatedAt: 2_000,
    transcript: [],
    status: "active",
    scope: "decision",
    sessionKey: "room:workitem:topic:mission:alpha",
    ...overrides,
  };
}

describe("resolveRequirementRoomEntryTarget", () => {
  it("prefers an existing room href when a bound room is already available", () => {
    expect(
      resolveRequirementRoomEntryTarget({
        room: createRoom(),
        aggregateId: "topic:mission:alpha",
        route: "/chat/room-fallback",
      }),
    ).toEqual({
      kind: "room",
      href: "/chat/room%3Aworkitem%3Atopic%3Amission%3Aalpha?cid=company-1",
      roomId: "workitem:topic:mission:alpha",
    });
  });

  it("falls back to ensuring a room when the requirement exists but no room has been materialized yet", () => {
    expect(
      resolveRequirementRoomEntryTarget({
        aggregateId: "topic:mission:alpha",
        route: "/chat/room-fallback",
      }),
    ).toEqual({
      kind: "ensure",
      aggregateId: "topic:mission:alpha",
    });
  });

  it("uses a precomputed route when there is no aggregate to ensure", () => {
    expect(
      resolveRequirementRoomEntryTarget({
        route: "/chat/room-fallback",
      }),
    ).toEqual({
      kind: "route",
      href: "/chat/room-fallback",
    });
  });

  it("returns unavailable when there is no room, aggregate, or fallback route", () => {
    expect(resolveRequirementRoomEntryTarget({})).toEqual({
      kind: "unavailable",
    });
  });
});
