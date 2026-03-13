const STORAGE_PREFIX = "cyber-company:workspace-embedded-app";

export type WorkspaceEmbeddedAppSnapshot = {
  activeSectionSlot: string | null;
  selectedFileKey: string | null;
  lastActionId: string | null;
};

function createDefaultSnapshot(): WorkspaceEmbeddedAppSnapshot {
  return {
    activeSectionSlot: null,
    selectedFileKey: null,
    lastActionId: null,
  };
}

function getStorage(): Pick<Storage, "getItem" | "setItem"> {
  if (
    typeof globalThis === "object" &&
    globalThis &&
    "localStorage" in globalThis &&
    typeof globalThis.localStorage?.getItem === "function" &&
    typeof globalThis.localStorage?.setItem === "function"
  ) {
    return globalThis.localStorage;
  }

  return {
    getItem: () => null,
    setItem: () => {},
  };
}

function buildStorageKey(companyId: string, appId: string) {
  return `${STORAGE_PREFIX}:${companyId}:${appId}`;
}

function normalizeSnapshot(value: unknown): WorkspaceEmbeddedAppSnapshot {
  if (!value || typeof value !== "object") {
    return createDefaultSnapshot();
  }
  const record = value as Record<string, unknown>;
  return {
    activeSectionSlot:
      typeof record.activeSectionSlot === "string" && record.activeSectionSlot.trim().length > 0
        ? record.activeSectionSlot
        : null,
    selectedFileKey:
      typeof record.selectedFileKey === "string" && record.selectedFileKey.trim().length > 0
        ? record.selectedFileKey
        : null,
    lastActionId:
      typeof record.lastActionId === "string" && record.lastActionId.trim().length > 0
        ? record.lastActionId
        : null,
  };
}

export function isWorkspaceEmbeddedAppSnapshotEqual(
  left: WorkspaceEmbeddedAppSnapshot,
  right: WorkspaceEmbeddedAppSnapshot,
): boolean {
  return (
    left.activeSectionSlot === right.activeSectionSlot
    && left.selectedFileKey === right.selectedFileKey
    && left.lastActionId === right.lastActionId
  );
}

export function loadWorkspaceEmbeddedAppSnapshot(
  companyId: string | null | undefined,
  appId: string | null | undefined,
): WorkspaceEmbeddedAppSnapshot {
  if (!companyId || !appId) {
    return createDefaultSnapshot();
  }
  try {
    const raw = getStorage().getItem(buildStorageKey(companyId, appId));
    if (!raw) {
      return createDefaultSnapshot();
    }
    return normalizeSnapshot(JSON.parse(raw));
  } catch {
    return createDefaultSnapshot();
  }
}

export function saveWorkspaceEmbeddedAppSnapshot(
  companyId: string | null | undefined,
  appId: string | null | undefined,
  snapshot: WorkspaceEmbeddedAppSnapshot,
) {
  if (!companyId || !appId) {
    return;
  }
  try {
    getStorage().setItem(buildStorageKey(companyId, appId), JSON.stringify(snapshot));
  } catch {
    // Best-effort local UI state only.
  }
}

export function withWorkspaceEmbeddedAppSelection(
  snapshot: WorkspaceEmbeddedAppSnapshot,
  input: {
    activeSectionSlot?: string | null;
    selectedFileKey?: string | null;
    lastActionId?: string | null;
  },
): WorkspaceEmbeddedAppSnapshot {
  return {
    activeSectionSlot:
      input.activeSectionSlot !== undefined ? input.activeSectionSlot : snapshot.activeSectionSlot,
    selectedFileKey:
      input.selectedFileKey !== undefined ? input.selectedFileKey : snapshot.selectedFileKey,
    lastActionId: input.lastActionId !== undefined ? input.lastActionId : snapshot.lastActionId,
  };
}
