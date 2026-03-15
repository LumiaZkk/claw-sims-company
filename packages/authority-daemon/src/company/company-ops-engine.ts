import { buildDefaultOrgSettings, evaluateHeartbeatSchedule } from "../../../../src/domain/org/autonomy-policy";
import type { Company, CyberCompanyConfig } from "../../../../src/domain/org/types";
import type { CompanyEvent } from "../../../../src/domain/delegation/events";
import type { AuthorityCompanyRuntimeSnapshot } from "../../../../src/infrastructure/authority/contract";
import {
  buildCompanyOpsAuditEvents,
  createHeartbeatCycleAuditEvent,
} from "./company-ops-audit";
import {
  applyHeartbeatStateUpdate,
  normalizeCompanyForOps,
  runCompanyOpsCycle,
} from "./company-ops-cycle";

type CompanyOpsEngineRepository = {
  loadConfig: () => CyberCompanyConfig | null;
  saveConfig: (config: CyberCompanyConfig) => void;
  loadRuntime: (companyId: string) => AuthorityCompanyRuntimeSnapshot;
  saveRuntime: (runtime: AuthorityCompanyRuntimeSnapshot) => AuthorityCompanyRuntimeSnapshot;
  appendCompanyEvent: (event: CompanyEvent) => unknown;
};

type CompanyOpsEngineOptions = {
  intervalMs?: number;
  onCompanyChanged?: (companyId: string, actions: string[]) => void;
  onRuntimeChanged?: (companyId: string, actions: string[]) => void;
};

export { buildCompanyOpsAuditEvents, createHeartbeatCycleAuditEvent, runCompanyOpsCycle };

export class CompanyOpsEngine {
  private readonly intervalMs: number;
  private readonly pendingCompanyIds = new Set<string>();
  private readonly pendingReasons = new Set<string>();
  private running = false;
  private timer: ReturnType<typeof setInterval> | null = null;
  private scheduled = false;

  constructor(
    private readonly repository: CompanyOpsEngineRepository,
    private readonly options: CompanyOpsEngineOptions = {},
  ) {
    this.intervalMs = options.intervalMs ?? 60_000;
  }

  start() {
    if (this.timer) {
      return;
    }
    this.timer = setInterval(() => {
      this.schedule("interval");
    }, this.intervalMs);
  }

  stop() {
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
    }
  }

  schedule(reason: string, companyId?: string | null) {
    this.pendingReasons.add(reason);
    if (companyId) {
      this.pendingCompanyIds.add(companyId);
    }
    if (this.scheduled) {
      return;
    }
    this.scheduled = true;
    queueMicrotask(() => {
      this.scheduled = false;
      void this.run();
    });
  }

  private async run() {
    if (this.running) {
      return;
    }
    this.running = true;
    try {
      const config = this.repository.loadConfig();
      if (!config) {
        return;
      }
      const reasons = [...this.pendingReasons];
      this.pendingReasons.clear();
      const intervalOnly = reasons.length > 0 && reasons.every((reason) => reason === "interval");
      const targetIds =
        this.pendingCompanyIds.size > 0
          ? [...this.pendingCompanyIds]
          : config.companies.map((company) => company.id);
      this.pendingCompanyIds.clear();

      let nextConfig = config;
      for (const companyId of targetIds) {
        const company = nextConfig.companies.find((item) => item.id === companyId);
        if (!company) {
          continue;
        }
        const currentCompany = normalizeCompanyForOps(company as Company);
        const cycleStartedAt = Date.now();
        const trigger = intervalOnly ? "interval" : "event";
        const auditReasons = intervalOnly ? ["interval"] : reasons.filter((reason) => reason !== "interval");
        if (intervalOnly) {
          const heartbeatSchedule = evaluateHeartbeatSchedule({
            orgSettings: buildDefaultOrgSettings(currentCompany.orgSettings),
            lastHeartbeatCheckAt:
              currentCompany.orgSettings?.autonomyState?.lastHeartbeatCheckAt
                ?? currentCompany.orgSettings?.autonomyState?.lastEngineRunAt
                ?? null,
            now: cycleStartedAt,
          });
          if (!heartbeatSchedule.shouldRun) {
            const skippedCompany = applyHeartbeatStateUpdate({
              company: currentCompany,
              now: cycleStartedAt,
              trigger: "interval",
              skipReason: heartbeatSchedule.skipReason,
            });
            this.repository.appendCompanyEvent(
              createHeartbeatCycleAuditEvent({
                companyId,
                createdAt: cycleStartedAt,
                trigger,
                ran: false,
                skipReason: heartbeatSchedule.skipReason,
                reasons: auditReasons,
                actions: [],
              }),
            );
            if (JSON.stringify(skippedCompany) !== JSON.stringify(company)) {
              nextConfig = {
                ...nextConfig,
                companies: nextConfig.companies.map((item) =>
                  item.id === companyId ? skippedCompany : item,
                ),
              };
            }
            continue;
          }
        }

        const runtime = this.repository.loadRuntime(companyId);
        const result = runCompanyOpsCycle({
          company: currentCompany,
          runtime,
        });
        const nextCompany = applyHeartbeatStateUpdate({
          company: result.company,
          now: cycleStartedAt,
          trigger,
          skipReason: null,
        });
        this.repository.appendCompanyEvent(
          createHeartbeatCycleAuditEvent({
            companyId,
            createdAt: cycleStartedAt,
            trigger,
            ran: true,
            skipReason: null,
            reasons: auditReasons,
            actions: result.actions,
          }),
        );

        if (!result.changed) {
          if (JSON.stringify(nextCompany) !== JSON.stringify(company)) {
            nextConfig = {
              ...nextConfig,
              companies: nextConfig.companies.map((item) =>
                item.id === companyId ? nextCompany : item,
              ),
            };
          }
          continue;
        }

        if (result.runtimeChanged) {
          const savedRuntime = this.repository.saveRuntime(result.runtime);
          const auditEvents = buildCompanyOpsAuditEvents({
            companyId,
            previousRuntime: runtime,
            nextRuntime: savedRuntime,
            actions: result.actions,
          });
          for (const event of auditEvents) {
            this.repository.appendCompanyEvent(event);
          }
          this.options.onRuntimeChanged?.(companyId, result.actions);
        }

        if (result.companyChanged) {
          nextConfig = {
            ...nextConfig,
            companies: nextConfig.companies.map((item) =>
              item.id === companyId ? nextCompany : item,
            ),
          };
          this.options.onCompanyChanged?.(companyId, result.actions);
        } else if (JSON.stringify(nextCompany) !== JSON.stringify(company)) {
          nextConfig = {
            ...nextConfig,
            companies: nextConfig.companies.map((item) =>
              item.id === companyId ? nextCompany : item,
            ),
          };
        }
      }

      if (nextConfig !== config) {
        this.repository.saveConfig(nextConfig);
      }
    } finally {
      this.running = false;
    }
  }
}
