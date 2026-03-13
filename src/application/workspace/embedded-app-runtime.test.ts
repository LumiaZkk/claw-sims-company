import { describe, expect, it } from "vitest";
import { resolveWorkspaceEmbeddedAppRuntime } from "./embedded-app-runtime";
import type { WorkspaceAppManifest } from "./app-manifest";

const manifest: WorkspaceAppManifest = {
  version: 1,
  appId: "app:review-console",
  sections: [
    {
      id: "review-reports",
      label: "报告",
      slot: "reports",
      order: 0,
      selectors: [{ tags: ["qa.report"] }],
      emptyState: "当前还没有审阅报告。",
    },
    {
      id: "review-reference",
      label: "设定",
      slot: "reference",
      order: 1,
      selectors: [{ tags: ["story.canon"] }],
      emptyState: "当前还没有设定文件。",
    },
  ],
  actions: [
    {
      id: "trigger-review-precheck",
      label: "运行发布前检查",
      actionType: "trigger_skill",
      target: "review.precheck",
    },
  ],
};

describe("resolveWorkspaceEmbeddedAppRuntime", () => {
  it("normalizes invalid selection and exposes runtime capabilities", () => {
    const runtime = resolveWorkspaceEmbeddedAppRuntime({
      app: {
        id: "app:review-console",
        title: "审阅控制台",
        template: "review-console",
        manifestArtifactId: "artifact:manifest",
        embeddedHostKey: "review-console",
        embeddedPermissions: {
          resources: "manifest-scoped",
          appState: "readwrite",
          companyWrites: "none",
          actions: "whitelisted",
        },
      },
      manifest,
      files: [
        {
          key: "file:report-1",
          name: "终审报告.md",
          path: "docs/review.md",
          updatedAtMs: 30,
          resourceType: "report",
          tags: ["qa.report"],
        },
        {
          key: "file:canon-1",
          name: "设定集.md",
          path: "docs/canon.md",
          updatedAtMs: 20,
          resourceType: "document",
          tags: ["story.canon"],
        },
      ],
      snapshot: {
        activeSectionSlot: "missing-slot",
        selectedFileKey: "file:missing",
        lastActionId: "missing-action",
      },
    });

    expect(runtime.hostKey).toBe("review-console");
    expect(runtime.hostTitle).toBe("审阅控制台宿主");
    expect(runtime.manifestStatus).toBe("bound");
    expect(runtime.activeSectionSlot).toBe("reports");
    expect(runtime.selectedFileKey).toBe("file:report-1");
    expect(runtime.lastAction).toBeNull();
    expect(runtime.sections.map((section) => `${section.slot}:${section.files.length}`)).toEqual([
      "reports:1",
      "reference:1",
    ]);
    expect(runtime.apis.map((api) => api.id)).toEqual([
      "resources.read-scoped",
      "app-state",
      "actions",
      "company-writes",
    ]);
    expect(runtime.snapshot).toEqual({
      activeSectionSlot: "reports",
      selectedFileKey: "file:report-1",
      lastActionId: null,
    });
  });

  it("keeps explicit valid snapshot and falls back to default manifest mode", () => {
    const runtime = resolveWorkspaceEmbeddedAppRuntime({
      app: {
        id: "app:dashboard",
        title: "发布准备台",
        template: "dashboard",
      },
      manifest,
      files: [
        {
          key: "file:report-1",
          name: "终审报告.md",
          path: "docs/review.md",
          updatedAtMs: 30,
          resourceType: "report",
          tags: ["qa.report"],
        },
      ],
      snapshot: {
        activeSectionSlot: "reports",
        selectedFileKey: "file:report-1",
        lastActionId: "trigger-review-precheck",
      },
    });

    expect(runtime.manifestStatus).toBe("default");
    expect(runtime.lastAction?.id).toBe("trigger-review-precheck");
    expect(runtime.snapshot).toEqual({
      activeSectionSlot: "reports",
      selectedFileKey: "file:report-1",
      lastActionId: "trigger-review-precheck",
    });
  });
});
