import { useEffect } from "react";
import type { HandoffRecord, RequestRecord } from "../../../domain/delegation/types";

export function useChatPreviewPersistence(input: {
  activeCompanyId: string | null;
  sessionKey: string | null;
  isArchiveView: boolean;
  handoffPreview: HandoffRecord[];
  requestPreview: RequestRecord[];
  upsertHandoff: (handoff: HandoffRecord) => Promise<unknown>;
  upsertRequest: (request: RequestRecord) => Promise<unknown>;
}) {
  const {
    activeCompanyId,
    sessionKey,
    isArchiveView,
    handoffPreview,
    requestPreview,
    upsertHandoff,
    upsertRequest,
  } = input;

  useEffect(() => {
    if (!activeCompanyId || !sessionKey || isArchiveView || handoffPreview.length === 0) {
      return;
    }

    handoffPreview.forEach((handoff) => {
      upsertHandoff(handoff).catch(console.error);
    });
  }, [activeCompanyId, handoffPreview, isArchiveView, sessionKey, upsertHandoff]);

  useEffect(() => {
    if (!activeCompanyId || !sessionKey || isArchiveView || requestPreview.length === 0) {
      return;
    }

    requestPreview.forEach((request) => {
      upsertRequest(request).catch(console.error);
    });
  }, [activeCompanyId, isArchiveView, requestPreview, sessionKey, upsertRequest]);
}
