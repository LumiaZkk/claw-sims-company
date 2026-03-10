import type { TaskStep, TrackedTask } from "../../domain/mission/types";

/**
 * Parse a CEO-style TASK-BOARD.md (markdown table format) into tracked tasks.
 * Expects a table with columns: 优先级 | 任务 | 负责人 | 状态 | 进度 | 截止时间
 */
export function parseTaskBoardMd(content: string, sourceAgentId: string): TrackedTask[] {
  const tasks: TrackedTask[] = [];

  const overviewMatch = content.match(/##\s*🎯\s*当前任务总览[\s\S]*?(?=\n---\s*\n|\n##\s|$)/);
  if (overviewMatch) {
    const tableLines = overviewMatch[0]
      .split("\n")
      .filter(
        (line) =>
          line.trim().startsWith("|") &&
          !line.includes("---") &&
          !line.includes("优先级") &&
          !line.includes("任务 |"),
      );

    const steps: TaskStep[] = [];
    for (const line of tableLines) {
      const cols = line
        .split("|")
        .map((cell) => cell.trim())
        .filter((cell) => cell.length > 0);
      if (cols.length < 4) {
        continue;
      }
      const [priority, taskName, assignee, statusEmoji, progressStr] = cols;
      const status: TaskStep["status"] =
        statusEmoji?.includes("🔄") || statusEmoji?.includes("进行")
          ? "wip"
          : statusEmoji?.includes("✅") || statusEmoji?.includes("完成")
            ? "done"
            : "pending";
      const pctMatch = progressStr?.match(/(\d+)%/);
      const pct = pctMatch ? parseInt(pctMatch[1], 10) : 0;
      const priorityLabel = (priority || "").replace(/\*/g, "").trim();
      const titlePrefix = priorityLabel ? `[${priorityLabel}] ` : "";

      steps.push({
        text: `${titlePrefix}${taskName}`,
        status: status === "done" ? "done" : pct >= 100 ? "done" : pct > 0 ? "wip" : status,
        assignee: assignee || undefined,
      });
    }

    if (steps.length > 0) {
      tasks.push({
        id: `file_overview_${sourceAgentId}`,
        title: "🎯 当前任务总览",
        sessionKey: `__file_task_overview_${sourceAgentId}`,
        agentId: sourceAgentId,
        source: "file",
        sourceAgentId,
        steps,
        createdAt: Date.now(),
        updatedAt: Date.now(),
      });
    }
  }

  const doneMatch = content.match(/##\s*✅\s*已完成任务[\s\S]*?(?=\n---\s*\n|\n##\s|$)/);
  if (doneMatch) {
    const doneLines = doneMatch[0]
      .split("\n")
      .filter((line) => line.trim().startsWith("|") && !line.includes("---") && !line.includes("任务 |"));

    const steps: TaskStep[] = [];
    for (const line of doneLines) {
      const cols = line
        .split("|")
        .map((cell) => cell.trim())
        .filter((cell) => cell.length > 0);
      if (cols.length < 2) {
        continue;
      }
      const [taskName, assignee] = cols;
      steps.push({ text: taskName, status: "done", assignee: assignee || undefined });
    }

    if (steps.length > 0) {
      tasks.push({
        id: `file_done_${sourceAgentId}`,
        title: "✅ 已完成任务",
        sessionKey: `__file_task_done_${sourceAgentId}`,
        agentId: sourceAgentId,
        source: "file",
        sourceAgentId,
        steps,
        createdAt: Date.now(),
        updatedAt: Date.now(),
      });
    }
  }

  return tasks;
}
