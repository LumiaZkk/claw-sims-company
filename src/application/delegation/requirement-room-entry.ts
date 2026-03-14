import type { RequirementRoomRecord } from "../../domain/delegation/types";
import { buildRequirementRoomHrefFromRecord } from "./room-routing";

export type RequirementRoomEntryTarget =
  | {
      kind: "room";
      href: string;
      roomId: string;
    }
  | {
      kind: "ensure";
      aggregateId: string;
    }
  | {
      kind: "route";
      href: string;
    }
  | {
      kind: "unavailable";
    };

export function resolveRequirementRoomEntryTarget(input: {
  room?: RequirementRoomRecord | null;
  aggregateId?: string | null;
  route?: string | null;
}): RequirementRoomEntryTarget {
  if (input.room) {
    return {
      kind: "room",
      href: buildRequirementRoomHrefFromRecord(input.room),
      roomId: input.room.id,
    };
  }

  const aggregateId = input.aggregateId?.trim();
  if (aggregateId) {
    return {
      kind: "ensure",
      aggregateId,
    };
  }

  const route = input.route?.trim();
  if (route) {
    return {
      kind: "route",
      href: route,
    };
  }

  return {
    kind: "unavailable",
  };
}
