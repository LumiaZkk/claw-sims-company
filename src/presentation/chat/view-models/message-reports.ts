import {
  extractDeliverableHeading,
  inferReportTextStatus,
  inferReportTransport,
  type RequestTransport,
  summarizeReportText,
} from "../../../application/delegation/report-classifier";
import type { ChatMessage } from "../../../application/gateway";
import { extractTextFromMessage } from "./message-basics";

export type StructuredCollaborationMetadata = {
  transport?: RequestTransport | null;
  reportStatus?: CollaboratorReportCardVM["status"] | null;
  intent?: "report" | "relay_notice" | "work_update" | "dispatch" | null;
  dispatchId?: string | null;
  requestId?: string | null;
  sourceTool?: string | null;
  summaryText?: string | null;
  detailText?: string | null;
};

export type CollaboratorReportCardVM = {
  status: "acknowledged" | "answered" | "blocked";
  transport: RequestTransport;
  statusLabel: string;
  reportType: string;
  summary: string;
  detail: string | null;
  cleanText: string;
  showFullContent: boolean;
};

export function readStructuredCollaborationMetadata(
  message: ChatMessage,
): StructuredCollaborationMetadata {
  const provenance =
    typeof message.provenance === "object" && message.provenance
      ? (message.provenance as Record<string, unknown>)
      : null;
  const metadata =
    typeof message.metadata === "object" && message.metadata
      ? (message.metadata as Record<string, unknown>)
      : null;
  const collaboration =
    metadata && typeof metadata.collaboration === "object" && metadata.collaboration
      ? (metadata.collaboration as Record<string, unknown>)
      : null;
  const sourceTool =
    typeof message.transport === "string"
      ? message.transport
      : provenance && typeof provenance.sourceTool === "string"
        ? provenance.sourceTool
        : null;
  const transport =
    message.transport === "company_report" ||
    message.transport === "sessions_send" ||
    message.transport === "inferred"
      ? message.transport
      : collaboration?.transport === "company_report" ||
          collaboration?.transport === "sessions_send" ||
          collaboration?.transport === "inferred"
        ? (collaboration.transport as RequestTransport)
        : sourceTool === "company_report" || sourceTool === "sessions_send"
          ? sourceTool
          : null;
  const reportStatus =
    message.reportStatus === "acknowledged" ||
    message.reportStatus === "answered" ||
    message.reportStatus === "blocked"
      ? message.reportStatus
      : collaboration?.reportStatus === "acknowledged" ||
          collaboration?.reportStatus === "answered" ||
          collaboration?.reportStatus === "blocked"
        ? (collaboration.reportStatus as CollaboratorReportCardVM["status"])
        : null;
  const intent =
    collaboration?.intent === "report" ||
    collaboration?.intent === "relay_notice" ||
    collaboration?.intent === "work_update" ||
    collaboration?.intent === "dispatch"
      ? (collaboration.intent as StructuredCollaborationMetadata["intent"])
      : message.messageIntent === "report" ||
          message.messageIntent === "relay_notice" ||
          message.messageIntent === "work_update" ||
          message.messageIntent === "dispatch"
        ? message.messageIntent
        : null;
  return {
    transport,
    reportStatus,
    intent,
    dispatchId:
      typeof collaboration?.dispatchId === "string" && collaboration.dispatchId.trim().length > 0
        ? collaboration.dispatchId.trim()
        : null,
    requestId:
      typeof collaboration?.requestId === "string" && collaboration.requestId.trim().length > 0
        ? collaboration.requestId.trim()
        : null,
    sourceTool: typeof sourceTool === "string" && sourceTool.trim().length > 0 ? sourceTool.trim() : null,
    summaryText:
      typeof collaboration?.summaryText === "string" && collaboration.summaryText.trim().length > 0
        ? collaboration.summaryText.trim()
        : null,
    detailText:
      typeof collaboration?.detailText === "string" && collaboration.detailText.trim().length > 0
        ? collaboration.detailText.trim()
        : null,
  };
}

function stripReportProtocol(text: string): string {
  return text.replace(/^\[company_report:(?:acknowledged|answered|blocked)\](?:\s*dispatch=[^\s]+)?\s*/i, "").trim();
}

function inferReportType(text: string): string {
  if (/阻塞|失败|超时|无响应/i.test(text)) {
    return "阻塞回报";
  }
  if (/技术|架构|可行性|开发周期|方案/i.test(text)) {
    return "技术评估";
  }
  if (/组织|招聘|岗位|jd|编制/i.test(text)) {
    return "组织方案";
  }
  if (/渠道|平台|投放|分发|增长/i.test(text)) {
    return "渠道调研";
  }
  const heading = extractDeliverableHeading(text);
  if (heading) {
    return heading.replace(/^#+\s*/, "");
  }
  return "部门回执";
}

function extractReportDetail(text: string, summary: string): string | null {
  const lines = text
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => line.length > 0);
  const detail = lines.find((line) => line !== summary) ?? null;
  return detail && detail !== summary ? detail : null;
}

function shouldShowFullReportContent(text: string, summary: string): boolean {
  const trimmed = text.trim();
  if (!trimmed || trimmed === summary.trim()) {
    return false;
  }
  if (trimmed.length >= 180) {
    return true;
  }
  return /(^|\n)(?:#{1,6}\s+|\|.+\||[-*]\s+|\d+\.\s+|```)/.test(trimmed);
}

function hasStructuredSource(message: ChatMessage): boolean {
  const provenance =
    typeof message.provenance === "object" && message.provenance
      ? (message.provenance as Record<string, unknown>)
      : null;
  return Boolean(
    (typeof message.roomAgentId === "string" && message.roomAgentId.trim().length > 0) ||
      (typeof message.senderAgentId === "string" && message.senderAgentId.trim().length > 0) ||
      (provenance && typeof provenance.sourceActorId === "string" && provenance.sourceActorId.trim().length > 0),
  );
}

export function parseCollaboratorReportMessage(
  message: ChatMessage,
): CollaboratorReportCardVM | null {
  const rawText = extractTextFromMessage(message)?.trim();
  if (!rawText) {
    return null;
  }
  const structured = readStructuredCollaborationMetadata(message);
  if (structured.intent === "relay_notice") {
    return null;
  }
  if (/^\s*"?\[company_dispatch\]/iu.test(rawText)) {
    return null;
  }
  if (message.displayTransport === "company_dispatch") {
    return null;
  }

  const explicitStatusMatch = rawText.match(/^\[company_report:(acknowledged|answered|blocked)\]/i);
  const fallbackCleanText = stripReportProtocol(rawText) || rawText;
  const explicitStatus = explicitStatusMatch?.[1]?.toLowerCase() as CollaboratorReportCardVM["status"] | undefined;
  const cleanText = structured.detailText ?? fallbackCleanText;
  const derivedStatus = structured.reportStatus ?? explicitStatus ?? inferReportTextStatus(cleanText);
  const transport = structured.transport ?? inferReportTransport(rawText);

  if (!derivedStatus) {
    return null;
  }
  if (!explicitStatusMatch && message.role !== "assistant") {
    return null;
  }
  if (transport !== "company_report" && !explicitStatusMatch && !hasStructuredSource(message)) {
    return null;
  }

  const summary = structured.summaryText ?? summarizeReportText(cleanText);
  const detail =
    structured.detailText && structured.detailText !== structured.summaryText
      ? structured.detailText
      : extractReportDetail(cleanText, summary);
  return {
    status: derivedStatus,
    transport,
    statusLabel:
      derivedStatus === "answered"
        ? "已提交"
        : derivedStatus === "acknowledged"
          ? "已接单"
          : "已阻塞",
    reportType: inferReportType(cleanText),
    summary,
    detail,
    cleanText,
    showFullContent: shouldShowFullReportContent(cleanText, summary),
  };
}
