import { memo, useEffect, useMemo, useRef, useState } from "react";
import {
  readLiveChatSession,
  subscribeLiveChatSession,
} from "../../../application/chat/live-session-cache";
import { Avatar, AvatarImage } from "../../../ui/avatar";
import type { EmployeeRef } from "../../../domain/org/types";

type StreamingVisualMode = "hidden" | "thinking" | "text";

function resolveStreamingVisualState(
  companyId: string | null,
  sessionKey: string | null,
  isGeneratingFallback: boolean,
): { mode: StreamingVisualMode; text: string | null } {
  const liveSession = readLiveChatSession(companyId, sessionKey);
  const text = liveSession?.streamText?.trim().length ? liveSession.streamText : null;
  const isGenerating = isGeneratingFallback || Boolean(liveSession?.isGenerating);
  if (text) {
    return { mode: "text", text };
  }
  if (isGenerating) {
    return { mode: "thinking", text: null };
  }
  return { mode: "hidden", text: null };
}

export const ChatStreamingState = memo(function ChatStreamingState(input: {
  companyId: string | null;
  sessionKey: string | null;
  isGeneratingFallback: boolean;
  groupTopic: string | null;
  emp: EmployeeRef | null;
  isGroup: boolean;
  onStreamActivity?: () => void;
}) {
  const initialVisualState = useMemo(
    () =>
      resolveStreamingVisualState(
        input.companyId,
        input.sessionKey,
        input.isGeneratingFallback,
      ),
    [input.companyId, input.isGeneratingFallback, input.sessionKey],
  );
  const [mode, setMode] = useState<StreamingVisualMode>(initialVisualState.mode);
  const modeRef = useRef<StreamingVisualMode>(initialVisualState.mode);
  const streamTextRef = useRef<string | null>(initialVisualState.text);
  const textElementRef = useRef<HTMLDivElement | null>(null);
  const onStreamActivityRef = useRef(input.onStreamActivity);

  useEffect(() => {
    onStreamActivityRef.current = input.onStreamActivity;
  }, [input.onStreamActivity]);

  useEffect(() => {
    const syncVisualState = () => {
      const nextState = resolveStreamingVisualState(
        input.companyId,
        input.sessionKey,
        input.isGeneratingFallback,
      );
      streamTextRef.current = nextState.text;
      if (textElementRef.current) {
        textElementRef.current.textContent = nextState.text ?? "";
      }
      if (nextState.mode !== modeRef.current) {
        modeRef.current = nextState.mode;
        setMode(nextState.mode);
      }
      if (nextState.mode !== "hidden") {
        onStreamActivityRef.current?.();
      }
    };

    syncVisualState();
    return subscribeLiveChatSession(input.companyId, input.sessionKey, syncVisualState);
  }, [input.companyId, input.isGeneratingFallback, input.sessionKey]);

  useEffect(() => {
    if (mode === "text" && textElementRef.current) {
      textElementRef.current.textContent = streamTextRef.current ?? "";
    }
  }, [mode]);

  if (mode === "text") {
    return (
      <div className="group flex max-w-full justify-start">
        <div className="flex max-w-full flex-row gap-3 lg:max-w-[95%] xl:max-w-[90%]">
          <Avatar className="mt-1 h-8 w-8 shrink-0 border bg-white">
            <AvatarImage
              src={`https://api.dicebear.com/7.x/bottts/svg?seed=${input.isGroup ? input.groupTopic : input.emp?.agentId}`}
            />
          </Avatar>
          <div className="flex min-w-0 flex-col items-start">
            <span className="mb-1 select-none text-xs text-muted-foreground">
              {input.isGroup ? "需求团队成员" : input.emp?.nickname} · 正在思考…
            </span>
            <div className="rounded-2xl rounded-tl-sm border bg-white px-4 py-3 text-sm text-slate-900 shadow-sm">
              <div
                ref={textElementRef}
                className="w-full whitespace-pre-wrap break-words text-sm leading-7 text-slate-800"
              />
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (mode === "thinking") {
    return (
      <div className="group flex max-w-full justify-start">
        <div className="flex max-w-full flex-row gap-3 lg:max-w-[95%] xl:max-w-[90%]">
          <Avatar className="mt-1 h-8 w-8 shrink-0 border bg-white">
            <AvatarImage
              src={`https://api.dicebear.com/7.x/bottts/svg?seed=${input.isGroup ? input.groupTopic : input.emp?.agentId}`}
            />
          </Avatar>
          <div className="flex min-w-0 flex-col items-start">
            <span className="mb-1 select-none text-xs text-muted-foreground">
              {input.isGroup ? "需求团队成员" : input.emp?.nickname} · 思考中...
            </span>
            <div className="flex items-center gap-2 rounded-2xl rounded-tl-sm border bg-white px-4 py-3 text-sm text-slate-900 shadow-sm">
              <div className="flex h-5 items-center gap-1">
                <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-indigo-500 [animation-delay:-0.3s]"></span>
                <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-indigo-500 [animation-delay:-0.15s]"></span>
                <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-indigo-500"></span>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return null;
});
