export type TaskItem = {
  status: "done" | "wip" | "pending";
  text: string;
};

export function hasRichMarkdownSyntax(text: string): boolean {
  return (
    /```/.test(text) ||
    /`[^`\n]+`/.test(text) ||
    /^\s{0,3}#{1,6}\s/m.test(text) ||
    /^\s*(?:[-*+]|\d+\.)\s/m.test(text) ||
    /^\s*>/m.test(text) ||
    /\[[^\]]+\]\([^)]+\)/.test(text) ||
    /^\s*\|.+\|\s*$/m.test(text)
  );
}

export function extractTaskTracker(text: string): TaskItem[] | null {
  const sectionMatch = text.match(/##\s*📋\s*任务追踪[\s\S]*?(?=\n##\s|$)/i);
  if (!sectionMatch) {
    return null;
  }

  const section = sectionMatch[0];
  const items: TaskItem[] = [];
  const lineRegex = /^\s*-\s*\[([ x/])\]\s*(.+)$/gm;
  let match: RegExpExecArray | null;

  while ((match = lineRegex.exec(section)) !== null) {
    const marker = match[1];
    const lineText = match[2].trim();
    let status: TaskItem["status"] = "pending";
    if (marker === "x") {
      status = "done";
    } else if (marker === "/") {
      status = "wip";
    }
    items.push({ status, text: lineText });
  }

  return items.length > 0 ? items : null;
}

export function resolveTaskTitle(text: string, fallback: string): string {
  const beforeTracker = text.split(/##\s*📋\s*任务追踪/i)[0]?.trim();
  if (beforeTracker) {
    const firstLine = beforeTracker
      .split("\n")
      .find((line) => line.trim().length > 0)
      ?.trim();
    if (firstLine && firstLine.length > 2 && firstLine.length < 80) {
      return firstLine
        .replace(/^#+\s*/, "")
        .replace(/[*_`]/g, "")
        .trim();
    }
  }
  return fallback.length > 30 ? `${fallback.slice(0, 30)}...` : fallback;
}
