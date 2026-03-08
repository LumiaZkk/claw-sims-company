import type { GatewaySessionRow } from "../features/backend";
import type {
  RequirementRoomRecord,
  RoomConversationBindingRecord,
} from "../features/company/types";
import { resolveSessionActorId, resolveSessionTitle } from "./sessions";

type EmployeeIdentity = {
  agentId: string;
  nickname: string;
  role: string;
};

type ConversationPresentationInput = {
  sessionKey?: string | null;
  actorId?: string | null;
  displayName?: string | null;
  label?: string | null;
  rooms?: RequirementRoomRecord[];
  bindings?: RoomConversationBindingRecord[];
  employees?: EmployeeIdentity[];
};

function resolveBoundRoomId(input: ConversationPresentationInput): string | null {
  const sessionKey = input.sessionKey?.trim();
  if (!sessionKey) {
    return null;
  }

  const boundRoomId =
    input.bindings?.find((binding) => binding.conversationId === sessionKey)?.roomId ??
    null;

  return boundRoomId?.trim() || null;
}

export function resolveConversationPresentation(
  input: ConversationPresentationInput,
): { title: string; route: string } {
  const { rooms = [], employees = [] } = input;
  const roomId = resolveBoundRoomId(input);
  const room = roomId ? rooms.find((candidate) => candidate.id === roomId) ?? null : null;
  if (room) {
    return {
      title: room.title,
      route: `/chat/${encodeURIComponent(`room:${room.id}`)}`,
    };
  }

  const actorId =
    input.actorId?.trim() ||
    resolveSessionActorId(
      input.sessionKey
        ? {
            key: input.sessionKey,
            actorId: input.actorId ?? null,
          }
        : null,
    );
  if (actorId) {
    const employee = employees.find((candidate) => candidate.agentId === actorId) ?? null;
    return {
      title:
        employee?.nickname ??
        input.displayName?.trim() ??
        input.label?.trim() ??
        actorId,
      route: `/chat/${encodeURIComponent(actorId)}`,
    };
  }

  const fallbackTitle =
    input.displayName?.trim() ||
    input.label?.trim() ||
    "未知会话";

  return {
    title: fallbackTitle,
    route: input.sessionKey
      ? `/chat/${encodeURIComponent(input.sessionKey)}`
      : `/chat/${encodeURIComponent(fallbackTitle)}`,
  };
}

export function resolveSessionPresentation(input: {
  session: GatewaySessionRow;
  rooms?: RequirementRoomRecord[];
  bindings?: RoomConversationBindingRecord[];
  employees?: EmployeeIdentity[];
}): { title: string; route: string } {
  const { session } = input;
  return resolveConversationPresentation({
    sessionKey: session.key,
    actorId: resolveSessionActorId(session),
    displayName: session.displayName,
    label: resolveSessionTitle(session),
    rooms: input.rooms,
    bindings: input.bindings,
    employees: input.employees,
  });
}
