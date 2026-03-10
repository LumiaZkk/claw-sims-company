import { RefreshCcw } from "lucide-react";
import { Suspense, lazy, memo } from "react";

import { parseHrDepartmentPlan } from "../../../application/org/employee-ops";
import { HrDepartmentPlanCard } from "../../../components/chat/HrDepartmentPlanCard";
import {
  describeToolName,
  normalizeChatBlockType,
  sanitizeVisibleMessageText,
  stripTaskTrackerSection,
  summarizeToolResultText,
  type ChatBlock,
} from "../view-models/messages";
import {
  extractTaskTracker,
  hasRichMarkdownSyntax,
  TaskTrackerHint,
  TaskTrackerPanel,
} from "../view-models/task-tracker";

const ChatMarkdownContent = lazy(
  () => import("../../../components/chat/chat-markdown-content.runtime"),
);

type ChatContentProps = {
  content: unknown;
  isDarkBg?: boolean;
  hideTaskTrackerPanel?: boolean;
  hideToolActivityBlocks?: boolean;
  hasActiveRun?: boolean;
  streamText?: string | null;
};

export const ChatContent = memo(function ChatContent({
  content,
  isDarkBg = false,
  hideTaskTrackerPanel,
  hideToolActivityBlocks,
  hasActiveRun = false,
  streamText,
}: ChatContentProps) {
  const proseClass = isDarkBg
    ? "prose prose-sm max-w-none w-full break-words prose-invert prose-p:leading-relaxed prose-pre:bg-black/20 prose-pre:border prose-pre:border-white/10"
    : "prose prose-sm max-w-none w-full break-words prose-p:leading-relaxed prose-pre:bg-slate-50 prose-pre:text-slate-800 prose-code:text-slate-800 prose-pre:border prose-pre:border-slate-200";
  const plainTextClass = isDarkBg
    ? "w-full whitespace-pre-wrap break-words text-sm leading-7 text-white/95"
    : "w-full whitespace-pre-wrap break-words text-sm leading-7 text-slate-800";

  const formatPossibleJson = (text: string) => {
    const trimmed = text.trim();
    if (
      (trimmed.startsWith("{") && trimmed.endsWith("}")) ||
      (trimmed.startsWith("[") && trimmed.endsWith("]"))
    ) {
      try {
        JSON.parse(trimmed);
        return `\`\`\`json\n${trimmed}\n\`\`\``;
      } catch {
        return text;
      }
    }
    return text;
  };

  const renderRichOrPlainText = (text: string) => {
    if (!hasRichMarkdownSyntax(text)) {
      return <div className={plainTextClass}>{text}</div>;
    }

    return (
      <Suspense fallback={<div className={plainTextClass}>{text}</div>}>
        <ChatMarkdownContent text={text} proseClassName={proseClass} />
      </Suspense>
    );
  };

  const renderTextBlock = (text: string, key?: string | number) => {
    const normalizedText = sanitizeVisibleMessageText(text);
    const tracker = extractTaskTracker(normalizedText);
    const cleanText =
      tracker && !hideTaskTrackerPanel
        ? stripTaskTrackerSection(normalizedText)
        : normalizedText;
    const hrPlan = parseHrDepartmentPlan(cleanText);
    const textWithoutHrPlan = hrPlan
      ? cleanText.replace(/```json\s*[\s\S]*?\s*```/i, "").trim()
      : cleanText;
    const finalText = formatPossibleJson(textWithoutHrPlan);

    return (
      <div key={key} className="w-full">
        {hrPlan ? <HrDepartmentPlanCard plan={hrPlan} /> : null}
        {finalText ? renderRichOrPlainText(finalText) : null}
        {tracker
          ? hideTaskTrackerPanel
            ? <TaskTrackerHint />
            : <TaskTrackerPanel items={tracker} />
          : null}
      </div>
    );
  };

  if (typeof content === "string") {
    return renderTextBlock(content);
  }

  if (Array.isArray(content)) {
    return (
      <div className="w-full max-w-full space-y-2">
        {content.map((block, index) => {
          const normalizedBlock =
            typeof block === "object" && block ? (block as ChatBlock) : null;
          const blockType = normalizeChatBlockType(normalizedBlock?.type);
          if (blockType === "text" && normalizedBlock?.text) {
            return renderTextBlock(normalizedBlock.text, index);
          }
          if (blockType === "tool_use" || blockType === "tool_call") {
            if (hideToolActivityBlocks !== false) {
              return null;
            }
            const toolName = describeToolName(normalizedBlock?.name?.trim() ?? null);
            const friendlyText =
              hasActiveRun && streamText?.includes("search")
                ? "系统正在检索所需信息。"
                : hasActiveRun && streamText?.includes("write")
                  ? "系统正在整理并写入产物。"
                  : hasActiveRun && streamText?.includes("read")
                    ? "系统正在读取上下文和资料。"
                    : hasActiveRun &&
                        (streamText?.includes("run") || streamText?.includes("terminal"))
                      ? "系统正在执行当前步骤。"
                      : "系统正在处理这一步。";
            return (
              <div
                key={index}
                className="my-2 flex items-center gap-2 rounded-lg border border-slate-200/60 bg-slate-50 p-2.5 text-xs font-medium text-slate-600 shadow-sm"
              >
                <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-white shadow-sm ring-1 ring-slate-200">
                  <RefreshCcw className="h-3 w-3 animate-spin text-slate-400" />
                </span>
                {friendlyText}
                <span className="ml-auto rounded bg-white px-1.5 py-0.5 font-mono text-[10px] text-slate-400">
                  {toolName}
                </span>
              </div>
            );
          }
          if (blockType === "tool_result") {
            if (hideToolActivityBlocks !== false) {
              return null;
            }
            const resultText =
              typeof normalizedBlock?.text === "string"
                ? summarizeToolResultText(normalizedBlock.text)
                : "执行完成，结果已回传。";
            return (
              <div
                key={index}
                className="my-1 rounded-lg border border-emerald-200/80 bg-emerald-50/80 px-3 py-2 text-[11px] text-emerald-800"
              >
                <span className="font-semibold">系统回执</span>
                <div className="mt-1 leading-5">{resultText}</div>
              </div>
            );
          }
          return null;
        })}
      </div>
    );
  }

  return null;
});
