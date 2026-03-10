import { describe, expect, it } from "vitest";
import { sanitizeArtifactRecords } from "./artifact-persistence";
import type { ArtifactRecord } from "./types";

function createArtifact(overrides: Partial<ArtifactRecord> = {}): ArtifactRecord {
  return {
    id: "artifact:novel-reader:ch02",
    title: "第 2 章正文",
    kind: "chapter",
    status: "ready",
    ownerActorId: "co-writer",
    sourceActorId: "co-writer",
    sourceName: "ch02_clean.md",
    sourcePath: "chapters/ch02_clean.md",
    summary: "第 2 章纯正文。",
    content: "这里是正文内容。",
    createdAt: 1_000,
    updatedAt: 2_000,
    ...overrides,
  };
}

describe("sanitizeArtifactRecords", () => {
  it("preserves product-side content so workspace can render from artifacts first", () => {
    const [artifact] = sanitizeArtifactRecords([createArtifact()]);
    expect(artifact?.content).toBe("这里是正文内容。");
  });

  it("keeps the newest artifact version when mirror records collide", () => {
    const older = createArtifact({ updatedAt: 1_000, summary: "旧摘要", content: "旧内容" });
    const newer = createArtifact({ updatedAt: 3_000, summary: "新摘要", content: "新内容" });
    const [artifact] = sanitizeArtifactRecords([older, newer]);
    expect(artifact?.summary).toBe("新摘要");
    expect(artifact?.content).toBe("新内容");
  });
});
