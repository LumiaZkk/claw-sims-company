import { useMemo } from "react";
import { useLocation, useParams } from "react-router-dom";

export type ChatRouteContext = {
  agentId: string | null;
  searchParams: URLSearchParams;
  isRoomRoute: boolean;
  isGroup: boolean;
  routeRoomId: string | null;
  targetAgentId: string | null;
  historyAgentId: string | null;
  groupTopic: string | null;
  routeCompanyId: string | null;
  groupMembers: string[];
  routeGroupTopicKey: string | null;
  routeWorkItemId: string | null;
  archiveId: string | null;
  isArchiveView: boolean;
  isInvalidLegacyRoute: boolean;
};

export function useChatRouteContext(): ChatRouteContext {
  const { agentId } = useParams<{ agentId: string }>();
  const location = useLocation();

  return useMemo(() => {
    const normalizedAgentId = agentId?.trim() || null;
    const isRoomRoute = normalizedAgentId?.startsWith("room:") ?? false;
    const isInvalidLegacyRoute = Boolean(normalizedAgentId && !isRoomRoute && normalizedAgentId.includes(":"));
    const routeRoomId = isRoomRoute ? normalizedAgentId?.slice("room:".length).trim() || null : null;
    const searchParams = new URLSearchParams(location.search);
    const routeCompanyId = searchParams.get("cid")?.trim() || null;
    const groupMembersCsv = searchParams.get("m");
    const groupMembers = groupMembersCsv ? [...new Set(groupMembersCsv.split(",").filter(Boolean))] : [];
    const routeGroupTopicKey = isRoomRoute
      ? searchParams.get("tk")?.trim().toLowerCase() || null
      : null;
    const routeWorkItemId = isRoomRoute ? searchParams.get("wi")?.trim() || null : null;
    const archiveId = searchParams.get("archive")?.trim() || null;
    const targetAgentId = !normalizedAgentId || isRoomRoute || isInvalidLegacyRoute ? null : normalizedAgentId;
    const historyAgentId = targetAgentId;
    const isGroup = isRoomRoute;

    return {
      agentId: normalizedAgentId,
      searchParams,
      isRoomRoute,
      isGroup,
      routeRoomId,
      targetAgentId,
      historyAgentId,
      groupTopic: routeGroupTopicKey,
      routeCompanyId,
      groupMembers,
      routeGroupTopicKey,
      routeWorkItemId,
      archiveId,
      isArchiveView: Boolean(archiveId && (historyAgentId || isGroup)),
      isInvalidLegacyRoute,
    };
  }, [agentId, location.search]);
}
