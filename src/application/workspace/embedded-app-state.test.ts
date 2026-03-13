import { describe, expect, it } from "vitest";
import {
  isWorkspaceEmbeddedAppSnapshotEqual,
  loadWorkspaceEmbeddedAppSnapshot,
  withWorkspaceEmbeddedAppSelection,
} from "./embedded-app-state";

describe("workspace embedded app state", () => {
  it("returns a default snapshot when storage is empty", () => {
    expect(loadWorkspaceEmbeddedAppSnapshot(null, null)).toEqual({
      activeSectionSlot: null,
      selectedFileKey: null,
      lastActionId: null,
    });
  });

  it("tracks section, file, and last action selections", () => {
    const next = withWorkspaceEmbeddedAppSelection(
      {
        activeSectionSlot: null,
        selectedFileKey: null,
        lastActionId: null,
      },
      {
        activeSectionSlot: "reports",
        selectedFileKey: "file:review-1",
        lastActionId: "trigger-review-precheck",
      },
    );

    expect(next).toEqual({
      activeSectionSlot: "reports",
      selectedFileKey: "file:review-1",
      lastActionId: "trigger-review-precheck",
    });
  });

  it("compares snapshots by value", () => {
    expect(
      isWorkspaceEmbeddedAppSnapshotEqual(
        {
          activeSectionSlot: "reports",
          selectedFileKey: "file:review-1",
          lastActionId: "trigger-review-precheck",
        },
        {
          activeSectionSlot: "reports",
          selectedFileKey: "file:review-1",
          lastActionId: "trigger-review-precheck",
        },
      ),
    ).toBe(true);
    expect(
      isWorkspaceEmbeddedAppSnapshotEqual(
        {
          activeSectionSlot: "reports",
          selectedFileKey: "file:review-1",
          lastActionId: "trigger-review-precheck",
        },
        {
          activeSectionSlot: "truth",
          selectedFileKey: "file:review-1",
          lastActionId: "trigger-review-precheck",
        },
      ),
    ).toBe(false);
  });
});
