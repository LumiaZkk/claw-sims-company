import type { ChangeEventHandler, Dispatch, RefObject, SetStateAction } from "react";
import type { RequirementRoomMentionCandidate } from "../../../application/delegation/room-routing";
import { ChatComposer, type ChatAttachment } from "./ChatComposer";

export function ChatComposerFooter(input: {
  isArchiveView: boolean;
  isGenerating: boolean;
  fileInputRef: RefObject<HTMLInputElement | null>;
  handleFileSelect: ChangeEventHandler<HTMLInputElement>;
  placeholder: string;
  sending: boolean;
  uploadingFile: boolean;
  attachments: ChatAttachment[];
  roomBroadcastMode: boolean;
  requirementRoomMentionCandidates?: RequirementRoomMentionCandidate[];
  composerPrefill?: { id: string | number; text: string } | null;
  routeComposerPrefill?: { id: string | number; text: string } | null;
  setRoomBroadcastMode: (value: boolean) => void;
  setAttachments: Dispatch<SetStateAction<ChatAttachment[]>>;
  processImageFile: (file: File) => Promise<void> | void;
  handleSend: (draft: string) => Promise<boolean>;
}) {
  const {
    isArchiveView,
    isGenerating,
    fileInputRef,
    handleFileSelect,
    placeholder,
    sending,
    uploadingFile,
    attachments,
    roomBroadcastMode,
    requirementRoomMentionCandidates,
    composerPrefill,
    routeComposerPrefill,
    setRoomBroadcastMode,
    setAttachments,
    processImageFile,
    handleSend,
  } = input;

  if (isArchiveView) {
    return null;
  }

  return (
    <footer className="relative shrink-0 border-t bg-white p-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] md:p-4">
      {isGenerating ? (
        <div className="absolute -top-10 left-4 z-20 flex items-center gap-2 rounded-t-xl rounded-r-xl border border-slate-200/60 bg-white/90 px-4 py-2 pb-1 text-xs shadow-sm -translate-y-2 backdrop-blur">
          <span className="relative flex h-2 w-2">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-indigo-400 opacity-75"></span>
            <span className="relative inline-flex h-2 w-2 rounded-full bg-indigo-500"></span>
          </span>
          <span>正在生成中...</span>
        </div>
      ) : null}
      <input
        type="file"
        ref={fileInputRef}
        className="hidden"
        onChange={handleFileSelect}
        accept=".txt,.md,.json,.js,.ts,.csv,.yaml,.yml,.log,image/*"
      />
      <ChatComposer
        placeholder={placeholder}
        sending={sending}
        uploadingFile={uploadingFile}
        attachments={attachments}
        broadcastMode={roomBroadcastMode}
        mentionCandidates={requirementRoomMentionCandidates}
        prefill={composerPrefill ?? routeComposerPrefill}
        showBroadcastToggle={Boolean(requirementRoomMentionCandidates)}
        onBroadcastModeChange={setRoomBroadcastMode}
        onRemoveAttachment={(index) =>
          setAttachments((arr) => arr.filter((_, i) => i !== index))
        }
        onPickFile={() => fileInputRef.current?.click()}
        onPasteImage={processImageFile}
        onSend={handleSend}
      />
    </footer>
  );
}
