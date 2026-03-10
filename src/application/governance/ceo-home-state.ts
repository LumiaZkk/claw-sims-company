import {
  buildEmployeeOperationalInsights,
  buildOutcomeReport,
  buildRetrospectiveSnapshot,
  type EmployeeOperationalInsight,
  type OutcomeReport,
  type RetrospectiveSnapshot,
} from "./company-insights";
import { buildCeoControlSurface, type CeoControlSurfaceSnapshot } from "./ceo-control-surface";
import { buildOrgAdvisorSnapshot } from "../assignment/org-fit";
import { getActiveHandoffs } from "../delegation/active-handoffs";
import { resolveCompanyKnowledge } from "../artifact/shared-knowledge";
import type { OrgAdvisorSnapshot } from "../assignment/org-fit";
import type { ChatMessage, GatewaySessionRow } from "../gateway";
import type {
  Company,
  RequirementRoomRecord,
  RoomConversationBindingRecord,
  WorkItemRecord,
} from "../../infrastructure/company/runtime/types";
import { resolveConversationPresentation, resolveSessionPresentation } from "../../lib/chat-routes";
import {
  isSessionActive,
  resolveSessionActorId,
  resolveSessionTitle,
  resolveSessionUpdatedAt,
} from "../../lib/sessions";
import { formatTime } from "../../lib/utils";

export type ManagerStatusCard = {
  agentId: string;
  label: string;
  role: string;
  state: "running" | "idle" | "offline";
  subtitle: string;
};

export type CeoActivityItem = {
  id: string;
  title: string;
  summary: string;
  ts: number;
  href: string;
};

export type CeoHomeSnapshot = {
  ceoSurface: CeoControlSurfaceSnapshot;
  orgAdvisor: OrgAdvisorSnapshot;
  companySessions: Array<GatewaySessionRow & { agentId: string }>;
  employeeInsights: EmployeeOperationalInsight[];
  outcomeReport: OutcomeReport;
  retrospective: RetrospectiveSnapshot;
  ceoMemo: string;
  managerCards: ManagerStatusCard[];
  activityItems: CeoActivityItem[];
};

function extractText(message: ChatMessage | undefined): string {
  if (!message) {
    return "";
  }
  if (typeof message.text === "string" && message.text.trim()) {
    return message.text.trim();
  }
  if (typeof message.content === "string" && message.content.trim()) {
    return message.content.trim();
  }
  if (!Array.isArray(message.content)) {
    return "";
  }
  return message.content
    .map((block) => {
      if (typeof block === "string") {
        return block;
      }
      if (block && typeof block === "object") {
        const record = block as Record<string, unknown>;
        if (record.type === "text" && typeof record.text === "string") {
          return record.text;
        }
      }
      return "";
    })
    .join("\n")
    .trim();
}

export function buildCeoHomeSnapshot(params: {
  company: Company;
  sessions: GatewaySessionRow[];
  ceoHistory: ChatMessage[];
  currentTime: number;
  activeRoomRecords: RequirementRoomRecord[];
  activeRoomBindings: RoomConversationBindingRecord[];
  activeWorkItems: WorkItemRecord[];
}): CeoHomeSnapshot {
  const {
    company,
    sessions,
    ceoHistory,
    currentTime,
    activeRoomRecords,
    activeRoomBindings,
    activeWorkItems,
  } = params;
  const companyEmployees = company.employees;
  const companyAgentIds = new Set(companyEmployees.map((employee) => employee.agentId));
  const companySessions = sessions
    .map((session) => ({ ...session, agentId: resolveSessionActorId(session) }))
    .filter((session): session is GatewaySessionRow & { agentId: string } => {
      return typeof session.agentId === "string" && companyAgentIds.has(session.agentId);
    })
    .sort((left, right) => resolveSessionUpdatedAt(right) - resolveSessionUpdatedAt(left));

  const knowledgeItems = resolveCompanyKnowledge(company);
  const activeHandoffs = getActiveHandoffs(company.handoffs ?? []);
  const companyWithKnowledge = { ...company, knowledgeItems };
  const employeeInsights = buildEmployeeOperationalInsights({
    company: companyWithKnowledge,
    sessions: companySessions,
    now: currentTime,
  });
  const outcomeReport = buildOutcomeReport({
    company: companyWithKnowledge,
    employeeInsights,
    now: currentTime,
  });
  const retrospective = buildRetrospectiveSnapshot({
    company: companyWithKnowledge,
    outcome: outcomeReport,
    employeeInsights,
  });

  const lastAssistantMessage = [...ceoHistory]
    .reverse()
    .find((message) => message.role === "assistant");
  const ceoMemo =
    extractText(lastAssistantMessage).split("\n").find((line) => line.trim().length > 0) ??
    retrospective.summary;

  const managerCards: ManagerStatusCard[] = companyEmployees
    .filter((employee) => employee.metaRole === "hr" || employee.metaRole === "cto" || employee.metaRole === "coo")
    .map((employee) => {
      const latestSession = companySessions.find((session) => session.agentId === employee.agentId);
      const state: ManagerStatusCard["state"] = latestSession
        ? isSessionActive(latestSession, currentTime)
          ? "running"
          : "idle"
        : "offline";
      return {
        agentId: employee.agentId,
        label: employee.nickname,
        role: employee.role,
        state,
        subtitle: latestSession
          ? `${resolveSessionTitle(latestSession)} · ${formatTime(resolveSessionUpdatedAt(latestSession))}`
          : "当前待命，尚无最近会话",
      };
    });

  const activityItems = [
    ...companySessions.slice(0, 5).map((session) => ({
      id: session.key,
      title: resolveSessionPresentation({
        session,
        rooms: activeRoomRecords,
        bindings: activeRoomBindings,
        employees: companyEmployees,
      }).title,
      summary: session.lastMessagePreview ?? "最近一次会话更新",
      ts: resolveSessionUpdatedAt(session),
      href: resolveSessionPresentation({
        session,
        rooms: activeRoomRecords,
        bindings: activeRoomBindings,
        employees: companyEmployees,
      }).route,
    })),
    ...activeHandoffs.slice(-3).map((handoff) => ({
      id: handoff.id,
      title: `交接: ${handoff.title}`,
      summary: handoff.summary,
      ts: handoff.updatedAt,
      href:
        resolveConversationPresentation({
          sessionKey: handoff.sessionKey,
          actorId:
            activeWorkItems.find((item) => item.id === handoff.taskId)?.ownerActorId ??
            handoff.fromAgentId ??
            handoff.toAgentIds[0] ??
            null,
          rooms: activeRoomRecords,
          bindings: activeRoomBindings,
          employees: companyEmployees,
        }).route,
    })),
  ]
    .sort((left, right) => right.ts - left.ts)
    .slice(0, 3);

  return {
    ceoSurface: buildCeoControlSurface(company),
    orgAdvisor: buildOrgAdvisorSnapshot(company),
    companySessions,
    employeeInsights,
    outcomeReport,
    retrospective,
    ceoMemo,
    managerCards,
    activityItems,
  };
}
