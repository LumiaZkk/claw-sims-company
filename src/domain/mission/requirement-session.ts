import type {
  RequirementMessageSnapshot,
  RequirementSessionSnapshot,
} from "./requirement-snapshot";

type RequirementTextPredicate = (text: string) => boolean;

export function findLatestRequirementInstruction(
  snapshot: RequirementSessionSnapshot,
  options: {
    minTimestamp?: number;
    matchesInstruction: RequirementTextPredicate;
    ignoreInstruction?: RequirementTextPredicate;
  },
): RequirementMessageSnapshot | null {
  return (
    [...snapshot.messages]
      .reverse()
      .find((message) => {
        if (message.role !== "user") {
          return false;
        }
        if ((options.minTimestamp ?? 0) > message.timestamp) {
          return false;
        }
        if (options.ignoreInstruction?.(message.text)) {
          return false;
        }
        return options.matchesInstruction(message.text);
      }) ?? null
  );
}

export function findLatestRequirementReply(
  snapshot: RequirementSessionSnapshot,
  afterTimestamp: number,
  options?: {
    ignoreReply?: RequirementTextPredicate;
  },
): RequirementMessageSnapshot | null {
  return (
    [...snapshot.messages]
      .reverse()
      .find((message) => {
        if (message.role !== "assistant" || message.timestamp < afterTimestamp) {
          return false;
        }
        return !options?.ignoreReply?.(message.text.trim());
      }) ?? null
  );
}

export function snapshotsContainRestartInstruction(
  snapshots: RequirementSessionSnapshot[],
  options: {
    isRestartInstruction: RequirementTextPredicate;
    ignoreInstruction?: RequirementTextPredicate;
  },
): boolean {
  return snapshots.some((snapshot) =>
    snapshot.messages.some(
      (message) =>
        message.role === "user" &&
        !options.ignoreInstruction?.(message.text) &&
        options.isRestartInstruction(message.text),
    ),
  );
}
