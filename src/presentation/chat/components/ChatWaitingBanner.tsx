export function ChatWaitingBanner(input: {
  ownerLabel: string;
  questionPreview: string;
}) {
  return (
    <div className="border-b border-amber-200 bg-amber-50/80 px-4 py-2 backdrop-blur-sm">
      <div className="mx-auto flex max-w-5xl flex-col gap-1 text-sm text-amber-950 md:flex-row md:items-center md:justify-between">
        <div className="min-w-0">
          <span className="font-semibold">{input.ownerLabel} 还没有给出明确回复。</span>
          <span className="ml-2 text-amber-800/90">当前这轮问题：{input.questionPreview}</span>
        </div>
        <div className="shrink-0 text-[11px] text-amber-700">
          继续看正文即可；一旦回复出现，会直接显示在聊天流里。
        </div>
      </div>
    </div>
  );
}
