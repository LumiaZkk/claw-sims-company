import { describe, expect, it, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import type { AuthorityHealthSnapshot } from "../../application/gateway/authority-types";
import { AuthorityControlPlaneSurface } from "./AuthorityControlPlaneSurface";

function createHealthSnapshot(): AuthorityHealthSnapshot {
  return {
    ok: true,
    executor: {
      adapter: "openclaw-bridge",
      state: "degraded",
      provider: "openclaw",
      note: "Authority 已接入 OpenClaw，但还存在原生能力降级。",
    },
    executorConfig: {
      type: "openclaw",
      openclaw: {
        url: "ws://localhost:18789",
        tokenConfigured: true,
      },
      connectionState: "ready",
      lastError: null,
      lastConnectedAt: 2_000,
    },
    executorCapabilities: {
      sessionStatus: "unsupported",
      processRuntime: "unsupported",
      notes: [],
    },
    executorReadiness: [
      {
        id: "connection",
        label: "执行器连接",
        state: "ready",
        summary: "Authority 已接入 OpenClaw。",
        detail: "ws://localhost:18789",
      },
      {
        id: "session-status",
        label: "运行态探针",
        state: "degraded",
        summary: "当前执行器不支持 session_status。",
        detail: "Authority 会退回 lifecycle/chat 驱动的降级修复模式。",
      },
    ],
    authority: {
      dbPath: "/tmp/authority.sqlite",
      connected: true,
      startedAt: 1_000,
      doctor: {
        status: "degraded",
        schemaVersion: 1,
        integrityStatus: "ok",
        integrityMessage: null,
        backupDir: "/tmp/backups",
        backupCount: 0,
        latestBackupAt: null,
        companyCount: 1,
        runtimeCount: 1,
        eventCount: 12,
        latestRuntimeAt: 2_500,
        latestEventAt: 2_700,
        activeCompanyId: "company-1",
        issues: [],
      },
      preflight: {
        status: "degraded",
        dataDir: "/tmp/authority",
        backupDir: "/tmp/backups",
        dbExists: true,
        schemaVersion: 1,
        integrityStatus: "ok",
        integrityMessage: null,
        backupCount: 0,
        latestBackupAt: null,
        notes: ["Authority SQLite 已存在，启动时会直接复用。"],
        warnings: ["Authority 已有 SQLite，但还没有标准备份。建议先运行 authority:backup。"],
        issues: [],
      },
    },
  };
}

describe("AuthorityControlPlaneSurface", () => {
  it("renders the shared summary, guidance, readiness checks, and operator actions", () => {
    const html = renderToStaticMarkup(
      <AuthorityControlPlaneSurface
        health={createHealthSnapshot()}
        summaryVariant="steady"
        onExecuteEntry={vi.fn()}
      />,
    );

    expect(html).toContain("Authority 控制面摘要");
    expect(html).toContain("优先修复建议");
    expect(html).toContain("还没有标准备份");
    expect(html).toContain("执行器环境检查");
    expect(html).toContain("当前执行器不支持 session_status。");
    expect(html).toContain("恢复 / 导入 / 手工修复入口");
    expect(html).toContain("npm run authority:backup");
  });
});
