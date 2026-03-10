import { isStageConfirmationMessage, parseStageGateSnapshot } from "./chat-progress";

export type ChatStageGateMessage = {
  role: string;
  text: string;
  timestamp: number;
};

export function findLatestChatStageGate(input: {
  isCeoSession: boolean;
  requirementTitle: string;
  messages: ChatStageGateMessage[];
}) {
  if (!input.isCeoSession) {
    return null;
  }

  const gateMessage = input.messages.find(
    (message) =>
      message.role === "assistant" &&
      Boolean(parseStageGateSnapshot(message.text, message.timestamp, input.requirementTitle)),
  );
  if (!gateMessage) {
    return null;
  }

  const parsed = parseStageGateSnapshot(gateMessage.text, gateMessage.timestamp, input.requirementTitle);
  if (!parsed) {
    return null;
  }

  const confirmationMessage =
    input.messages.find(
      (message) =>
        message.role === "user" &&
        message.timestamp > parsed.sourceTimestamp &&
        isStageConfirmationMessage(message.text),
    ) ?? null;

  if (!confirmationMessage) {
    return parsed;
  }

  const stageGateConsumed = input.messages.some(
    (message) =>
      message.role === "assistant" &&
      message.timestamp > confirmationMessage.timestamp &&
      message.text.trim().length > 0 &&
      !parseStageGateSnapshot(message.text, message.timestamp, input.requirementTitle),
  );

  if (stageGateConsumed) {
    return null;
  }

  return {
    ...parsed,
    status: "confirmed" as const,
    statusLabel: "已确认待启动",
  };
}
