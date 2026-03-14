import { describe, expect, it } from "vitest";
import {
  buildAuthorityBootstrapSnapshot,
  buildAuthorityExecutorCapabilitySnapshot,
  buildAuthorityExecutorSnapshot,
  buildAuthorityHealthSnapshot,
  toPublicAuthorityExecutorConfig,
} from "./executor-status";
import type { CyberCompanyConfig } from "../../../src/domain/org/types";
import type { AuthorityCompanyRuntimeSnapshot } from "../../../src/infrastructure/authority/contract";

describe("executor-status", () => {
  it("builds public executor config with local token fallback", () => {
    const config = toPublicAuthorityExecutorConfig(
      {
        openclaw: {
          url: "ws://localhost:18789",
          token: "",
        },
        connectionState: "ready",
        lastError: null,
        lastConnectedAt: 123,
      },
      () => "local-device-token",
    );

    expect(config).toEqual({
      type: "openclaw",
      openclaw: {
        url: "ws://localhost:18789",
        tokenConfigured: true,
      },
      connectionState: "ready",
      lastError: null,
      lastConnectedAt: 123,
    });
  });

  it("degrades capability notes when session_status is unsupported", () => {
    const capabilities = buildAuthorityExecutorCapabilitySnapshot({
      executor: {
        adapter: "openclaw-bridge",
        state: "ready",
        provider: "openclaw",
        note: "Authority 已接入 OpenClaw。",
      },
      sessionStatusCapabilityState: "unsupported",
    });

    expect(capabilities.sessionStatus).toBe("unsupported");
    expect(capabilities.processRuntime).toBe("unsupported");
    expect(capabilities.notes[0]).toContain("session_status");
  });

  it("builds executor snapshot from stored config and bridge state", () => {
    const snapshot = buildAuthorityExecutorSnapshot({
      storedConfig: {
        openclaw: {
          url: "ws://old-host",
          token: "secret",
        },
        connectionState: "connecting",
        lastError: null,
        lastConnectedAt: null,
      },
      bridgeSnapshot: {
        openclaw: { url: "ws://localhost:18789" },
        connectionState: "ready",
        lastError: null,
        lastConnectedAt: 999,
      },
      executorStatus: {
        adapter: "openclaw-bridge",
        state: "ready",
        provider: "openclaw",
        note: "Authority 已接入 OpenClaw。",
      },
      sessionStatusCapabilityState: "unsupported",
    });

    expect(snapshot.nextStoredConfig.openclaw.url).toBe("ws://localhost:18789");
    expect(snapshot.executor.note).toContain("session_status");
    expect(snapshot.executorConfig.openclaw.tokenConfigured).toBe(true);
    expect(snapshot.executorCapabilities.sessionStatus).toBe("unsupported");
  });

  it("builds health snapshot with derived readiness checks", () => {
    const health = buildAuthorityHealthSnapshot({
      dbPath: "/tmp/authority.sqlite",
      startedAt: 42,
      storedConfig: {
        openclaw: {
          url: "ws://localhost:18789",
          token: "",
        },
        connectionState: "blocked",
        lastError: "executor offline",
        lastConnectedAt: null,
      },
      sessionStatusCapabilityState: "unknown",
      doctorSnapshot: {
        status: "ready",
        dataDir: "/tmp",
        schemaVersion: 1,
        integrityStatus: "ok",
        integrityMessage: null,
        dbPath: "/tmp/authority.sqlite",
        dbExists: true,
        dbSizeBytes: 1024,
        backupDir: "/tmp/backups",
        backupCount: 1,
        latestBackupAt: 100,
        companyCount: 1,
        runtimeCount: 1,
        eventCount: 10,
        latestRuntimeAt: 90,
        latestEventAt: 95,
        activeCompanyId: "company-1",
        executorConnectionState: "blocked",
        issues: [],
      },
      preflightSnapshot: {
        status: "ready",
        dataDir: "/tmp",
        dbPath: "/tmp/authority.sqlite",
        backupDir: "/tmp/backups",
        dbExists: true,
        schemaVersion: 1,
        integrityStatus: "ok",
        integrityMessage: null,
        backupCount: 1,
        latestBackupAt: 100,
        notes: [],
        warnings: [],
        issues: [],
      },
      guidance: [],
    });

    expect(health.executor.state).toBe("blocked");
    expect(health.executorConfig.openclaw.tokenConfigured).toBe(false);
    expect(health.executorReadiness.find((item) => item.id === "auth")?.state).toBe("blocked");
    expect(health.authority.startedAt).toBe(42);
  });

  it("builds bootstrap snapshot from health and active company runtime", () => {
    const config: CyberCompanyConfig = {
      version: 1,
      companies: [
        {
          id: "company-1",
          name: "Nova",
          description: "",
          icon: "🏢",
          template: "blank",
          employees: [],
          quickPrompts: [],
          createdAt: 1,
        },
      ],
      activeCompanyId: "company-1",
      preferences: { theme: "classic", locale: "zh-CN" },
    };
    const runtime = {
      companyId: "company-1",
      activeRoomRecords: [],
      activeMissionRecords: [],
      activeConversationStates: [],
      activeWorkItems: [],
      activeRequirementAggregates: [],
      activeRequirementEvidence: [],
      primaryRequirementId: null,
      activeRoundRecords: [],
      activeArtifacts: [],
      activeDispatches: [],
      activeRoomBindings: [],
      activeSupportRequests: [],
      activeEscalations: [],
      activeDecisionTickets: [],
      activeAgentSessions: [],
      activeAgentRuns: [],
      activeAgentRuntime: [],
      activeAgentStatuses: [],
      activeAgentStatusHealth: null,
      updatedAt: 1,
    } satisfies AuthorityCompanyRuntimeSnapshot;

    const health = buildAuthorityHealthSnapshot({
      dbPath: "/tmp/authority.sqlite",
      startedAt: 42,
      storedConfig: {
        openclaw: {
          url: "ws://localhost:18789",
          token: "secret",
        },
        connectionState: "ready",
        lastError: null,
        lastConnectedAt: 100,
      },
      sessionStatusCapabilityState: "supported",
      doctorSnapshot: {
        status: "ready",
        dataDir: "/tmp",
        schemaVersion: 1,
        integrityStatus: "ok",
        integrityMessage: null,
        dbPath: "/tmp/authority.sqlite",
        dbExists: true,
        dbSizeBytes: 1024,
        backupDir: "/tmp/backups",
        backupCount: 1,
        latestBackupAt: 100,
        companyCount: 1,
        runtimeCount: 1,
        eventCount: 10,
        latestRuntimeAt: 90,
        latestEventAt: 95,
        activeCompanyId: "company-1",
        executorConnectionState: "ready",
        issues: [],
      },
      preflightSnapshot: {
        status: "ready",
        dataDir: "/tmp",
        dbPath: "/tmp/authority.sqlite",
        backupDir: "/tmp/backups",
        dbExists: true,
        schemaVersion: 1,
        integrityStatus: "ok",
        integrityMessage: null,
        backupCount: 1,
        latestBackupAt: 100,
        notes: [],
        warnings: [],
        issues: [],
      },
      guidance: [],
    });

    const bootstrap = buildAuthorityBootstrapSnapshot({
      authorityUrl: "http://127.0.0.1:18896",
      config,
      loadRuntime: () => runtime,
      health,
    });

    expect(bootstrap.activeCompany?.id).toBe("company-1");
    expect(bootstrap.runtime?.companyId).toBe("company-1");
    expect(bootstrap.authority.url).toBe("http://127.0.0.1:18896");
    expect(bootstrap.executorReadiness.length).toBeGreaterThan(0);
  });
});
