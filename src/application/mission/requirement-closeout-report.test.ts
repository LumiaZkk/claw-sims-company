import { describe, expect, it } from "vitest";
import { buildRequirementCloseoutReport } from "./requirement-closeout-report";
import { buildDefaultOrgSettings } from "../../domain/org/autonomy-policy";
import type { Company } from "../../domain/org/types";
import type { RequirementAggregateRecord } from "../../domain/mission/types";
import type { WorkspaceFileRow } from "../workspace";

function createAggregate(overrides: Partial<RequirementAggregateRecord> = {}): RequirementAggregateRecord {
  return {
    id: "requirement-1",
    revision: 1,
    memberIds: [],
    ...overrides,
  } as RequirementAggregateRecord;
}

function createWorkspaceFile(overrides: Partial<WorkspaceFileRow>): WorkspaceFileRow {
  return {
    key: "file-1",
    agentId: "writer",
    agentLabel: "写手",
    role: "Writer",
    workspace: "workspace",
    name: "document.md",
    path: "/document.md",
    kind: "other",
    resourceType: "document",
    tags: [],
    resourceOrigin: "declared",
    updatedAtMs: 12_000,
    ...overrides,
  };
}

function createCompany(overrides?: Partial<Company>): Company {
  return {
    id: "company-1",
    name: "测试公司",
    description: "",
    icon: "🏢",
    template: "blank",
    orgSettings: buildDefaultOrgSettings(),
    employees: [],
    quickPrompts: [],
    workspaceApps: [
      {
        id: "app-knowledge",
        slug: "knowledge",
        title: "知识与验收",
        description: "集中查看正式方案与验收结论。",
        icon: "🧾",
        kind: "custom",
        status: "ready",
        surface: "template",
        template: "knowledge",
        manifestArtifactId: "artifact-manifest",
      },
    ],
    skillDefinitions: [],
    skillRuns: [],
    capabilityRequests: [],
    capabilityIssues: [],
    capabilityAuditEvents: [
      {
        id: "audit-1",
        type: "skill",
        action: "verified",
        summary: "已留下治理证据",
        detail: "已验证一轮。",
        status: "completed",
        updatedAt: 9_000,
        createdAt: 9_000,
      } as Company["capabilityAuditEvents"][number],
    ],
    createdAt: 1,
    ...overrides,
  };
}

describe("buildRequirementCloseoutReport", () => {
  it("blocks acceptance when deliverables and traceability are missing", () => {
    const report = buildRequirementCloseoutReport({
      aggregate: createAggregate({ revision: 2 }),
      activeCompany: createCompany(),
      workspaceFiles: [],
      deliverableFiles: [],
      requirementTimelineCount: 0,
      transcriptPreviewCount: 0,
      updatedAtCandidates: [],
    });

    expect(report.status).toBe("blocked");
    expect(report.blockingReasons).toEqual(
      expect.arrayContaining([
        expect.stringContaining("交付物摘要"),
        expect.stringContaining("来源链路"),
      ]),
    );
    expect(report.consistencySummary.status).toBe("warning");
    expect(report.knowledgeSummary.status).toBe("warning");
  });

  it("keeps acceptance available with warnings when deliverables exist but evidence is incomplete", () => {
    const report = buildRequirementCloseoutReport({
      aggregate: createAggregate({ revision: 3 }),
      activeCompany: createCompany(),
      workspaceFiles: [
        createWorkspaceFile({
          name: "chapter-1.md",
          path: "/chapter-1.md",
          kind: "chapter",
        }),
      ],
      deliverableFiles: [
        createWorkspaceFile({
          name: "chapter-1.md",
          path: "/chapter-1.md",
          kind: "chapter",
        }),
      ],
      requirementTimelineCount: 2,
      transcriptPreviewCount: 1,
      updatedAtCandidates: [12_000],
    });

    expect(report.status).toBe("warning");
    expect(report.blockingReasons).toHaveLength(0);
    expect(report.deliverableHighlights[0]).toMatchObject({
      title: "chapter-1.md",
      path: "/chapter-1.md",
    });
    expect(report.advisoryReasons).toEqual(
      expect.arrayContaining([expect.stringContaining("验收依据")]),
    );
    expect(report.consistencySummary.anchorReadyCount).toBe(0);
    expect(report.knowledgeSummary.itemCount).toBeGreaterThan(0);
  });

  it("surfaces evidence highlights when review artifacts exist", () => {
    const report = buildRequirementCloseoutReport({
      aggregate: createAggregate({ revision: 3 }),
      activeCompany: createCompany(),
      workspaceFiles: [],
      deliverableFiles: [
        createWorkspaceFile({
          key: "review-1",
          agentId: "reviewer",
          agentLabel: "审校",
          role: "Reviewer",
          name: "acceptance-report.md",
          path: "/acceptance-report.md",
          kind: "review",
          updatedAtMs: 13_000,
        }),
      ],
      requirementTimelineCount: 1,
      transcriptPreviewCount: 1,
      updatedAtCandidates: [13_000],
    });

    expect(report.status).toBe("warning");
    expect(report.acceptanceEvidenceHighlights[0]).toMatchObject({
      title: "acceptance-report.md",
      path: "/acceptance-report.md",
    });
    expect(report.knowledgeSummary.status).toBe("ready");
  });

  it("surfaces consistency and knowledge evidence alongside the closeout report", () => {
    const report = buildRequirementCloseoutReport({
      aggregate: createAggregate({ revision: 4, memberIds: ["coo-1"] }),
      activeCompany: createCompany({
        knowledgeItems: [
          {
            id: "knowledge-1",
            kind: "summary",
            title: "验收总结",
            summary: "已经汇总主要验收结论。",
            status: "active",
            acceptanceMode: "auto",
            sourceAgentId: "coo-1",
            sourcePath: "/knowledge/acceptance-summary.md",
            updatedAt: 14_000,
          } as NonNullable<Company["knowledgeItems"]>[number],
        ],
      }),
      workspaceFiles: [
        createWorkspaceFile({
          key: "canon-1",
          name: "shared-canon.md",
          path: "/shared-canon.md",
          kind: "canon",
          tags: ["domain.reference"],
          updatedAtMs: 10_000,
        }),
        createWorkspaceFile({
          key: "timeline-1",
          name: "timeline.md",
          path: "/timeline.md",
          kind: "canon",
          tags: ["domain.reference", "story.timeline"],
          updatedAtMs: 11_000,
        }),
      ],
      deliverableFiles: [
        createWorkspaceFile({
          key: "consistency-report-1",
          artifactId: "artifact-consistency-1",
          agentId: "coo-1",
          agentLabel: "COO",
          role: "COO",
          name: "consistency-report-17000.md",
          path: "/skill-results/consistency-report-17000.md",
          kind: "other",
          resourceType: "report",
          tags: ["qa.report"],
          updatedAtMs: 17_000,
        }),
      ],
      requirementTimelineCount: 2,
      transcriptPreviewCount: 1,
      updatedAtCandidates: [17_000],
    });

    expect(report.consistencySummary.reportHighlights[0]).toMatchObject({
      title: "consistency-report-17000.md",
    });
    expect(report.consistencySummary.summary).toContain("规则/校验结果");
    expect(report.knowledgeSummary.highlights[0]).toMatchObject({
      title: "验收总结",
      kindLabel: "最终汇总",
    });
  });
});
