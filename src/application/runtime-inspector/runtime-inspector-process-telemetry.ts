import { useEffect, useState } from "react";
import { backend } from "../gateway";
import type { ProviderProcessRecord } from "../../infrastructure/gateway/runtime/types";
import type {
  RuntimeInspectorAgentSurface,
  RuntimeInspectorLiveProcess,
  RuntimeInspectorProcessTelemetry,
} from "./runtime-inspector-types";

function isActiveProcessState(state: ProviderProcessRecord["state"]): boolean {
  return state === "queued" || state === "running";
}

function isUnsupportedProcessRuntimeError(error: unknown): boolean {
  const message = error instanceof Error ? error.message : String(error);
  return /unknown method:\s*process\.(list|poll)/i.test(message)
    || /process\.(list|poll)/i.test(message) && /method not found/i.test(message);
}

const PROCESS_POLL_INTERVAL_MS = 6_000;
const MAX_PROCESS_POLLS = 6;

function getProcessTone(state: ProviderProcessRecord["state"]): RuntimeInspectorLiveProcess["tone"] {
  if (state === "error" || state === "aborted") {
    return "danger";
  }
  if (state === "completed") {
    return "success";
  }
  if (state === "queued") {
    return "warning";
  }
  return "info";
}

function getProcessStatusLabel(state: ProviderProcessRecord["state"]): string {
  switch (state) {
    case "queued":
      return "排队中";
    case "running":
      return "运行中";
    case "completed":
      return "已完成";
    case "aborted":
      return "已中止";
    case "error":
      return "失败";
    case "unknown":
    default:
      return "未知";
  }
}

function buildLiveProcessSummary(process: ProviderProcessRecord): string {
  const command = process.command?.trim();
  const summary = process.summary?.trim();
  if (summary && command && summary !== command) {
    return `${summary} · ${command}`;
  }
  if (summary) {
    return summary;
  }
  if (command) {
    return command;
  }
  return process.title;
}

function normalizeLiveProcesses(processes: ProviderProcessRecord[]): RuntimeInspectorLiveProcess[] {
  const byId = new Map<string, RuntimeInspectorLiveProcess>();
  for (const process of processes) {
    const existing = byId.get(process.processId);
    const candidate: RuntimeInspectorLiveProcess = {
      processId: process.processId,
      sessionKey: process.sessionKey ?? null,
      title: process.title,
      command: process.command ?? null,
      status: process.state,
      statusLabel: getProcessStatusLabel(process.state),
      summary: buildLiveProcessSummary(process),
      tone: getProcessTone(process.state),
      startedAt: process.startedAt ?? null,
      updatedAt: process.updatedAt ?? process.startedAt ?? null,
      endedAt: process.endedAt ?? null,
      exitCode: process.exitCode ?? null,
    };
    if (!existing || (candidate.updatedAt ?? 0) >= (existing.updatedAt ?? 0)) {
      byId.set(process.processId, candidate);
    }
  }
  return [...byId.values()].sort((left, right) => {
    const activeDelta = Number(isActiveProcessState(right.status)) - Number(isActiveProcessState(left.status));
    if (activeDelta !== 0) {
      return activeDelta;
    }
    return (right.updatedAt ?? right.startedAt ?? 0) - (left.updatedAt ?? left.startedAt ?? 0);
  });
}

export function useRuntimeInspectorProcessTelemetry(
  agent: RuntimeInspectorAgentSurface | null,
): RuntimeInspectorProcessTelemetry {
  return useRuntimeInspectorProcessTelemetrySource({
    scope: "focused",
    agentId: agent?.agentId ?? null,
    sessionKeys: [...new Set((agent?.sessions ?? []).map((session) => session.sessionKey).filter(Boolean))],
  });
}

export function useRuntimeInspectorGlobalProcessTelemetry(): RuntimeInspectorProcessTelemetry {
  return useRuntimeInspectorProcessTelemetrySource({
    scope: "global",
    agentId: null,
    sessionKeys: null,
  });
}

function useRuntimeInspectorProcessTelemetrySource(input: {
  scope: "focused" | "global";
  agentId: string | null;
  sessionKeys: string[] | null;
}): RuntimeInspectorProcessTelemetry {
  const sessionKeySignature = input.sessionKeys?.join("|") ?? "__global__";
  const [telemetry, setTelemetry] = useState<RuntimeInspectorProcessTelemetry>({
    capabilityState: "idle",
    agentId: input.agentId,
    scope: input.scope,
    lastCheckedAt: null,
    error: null,
    processes: [],
    runningCount: 0,
    totalCount: 0,
  });

  useEffect(() => {
    const sessionKeys = input.sessionKeys ? [...new Set(input.sessionKeys)] : [];
    if (!backend.capabilities.processRuntime || !backend.listProcesses || !backend.pollProcess) {
      setTelemetry({
        capabilityState: "unsupported",
        agentId: input.agentId,
        scope: input.scope,
        lastCheckedAt: Date.now(),
        error: "当前 provider 未开放 process runtime。",
        processes: [],
        runningCount: 0,
        totalCount: 0,
      });
      return;
    }

    if (input.scope === "focused" && (!input.agentId || sessionKeys.length === 0)) {
      setTelemetry({
        capabilityState: "idle",
        agentId: input.agentId,
        scope: input.scope,
        lastCheckedAt: null,
        error: null,
        processes: [],
        runningCount: 0,
        totalCount: 0,
      });
      return;
    }

    let cancelled = false;
    let processRuntimeUnsupported = false;

    const refresh = async (initial = false) => {
      if (processRuntimeUnsupported) {
        return;
      }
      if (initial) {
        setTelemetry((previous: RuntimeInspectorProcessTelemetry) => ({
          ...previous,
          capabilityState: "loading",
          agentId: input.agentId,
          scope: input.scope,
          error: null,
        }));
      }

      try {
        const flattened =
          input.scope === "global"
            ? ((await backend.listProcesses()) ?? [])
            : (
                await Promise.all(
                  sessionKeys.map(async (sessionKey) => {
                    const processes = await backend.listProcesses(sessionKey);
                    return Array.isArray(processes) ? processes : [];
                  }),
                )
              ).flat();
        const activeProcessIds = normalizeLiveProcesses(flattened)
          .filter((process) => isActiveProcessState(process.status))
          .slice(0, MAX_PROCESS_POLLS)
          .map((process) => process.processId);
        const polled = await Promise.all(
          activeProcessIds.map(async (processId) => {
            try {
              return await backend.pollProcess(processId);
            } catch (error) {
              if (isUnsupportedProcessRuntimeError(error)) {
                throw error;
              }
              return null;
            }
          }),
        );
        if (cancelled) {
          return;
        }
        const normalized = normalizeLiveProcesses([
          ...flattened,
          ...polled.filter((process: ProviderProcessRecord | null): process is ProviderProcessRecord => Boolean(process)),
        ]);
        setTelemetry({
          capabilityState: "ready",
          agentId: input.agentId,
          scope: input.scope,
          lastCheckedAt: Date.now(),
          error: null,
          processes: normalized,
          runningCount: normalized.filter((process) => isActiveProcessState(process.status)).length,
          totalCount: normalized.length,
        });
      } catch (error) {
        if (cancelled) {
          return;
        }
        if (isUnsupportedProcessRuntimeError(error)) {
          processRuntimeUnsupported = true;
          setTelemetry({
            capabilityState: "unsupported",
            agentId: input.agentId,
            scope: input.scope,
            lastCheckedAt: Date.now(),
            error: error instanceof Error ? error.message : String(error),
            processes: [],
            runningCount: 0,
            totalCount: 0,
          });
          return;
        }
        setTelemetry({
          capabilityState: "error",
          agentId: input.agentId,
          scope: input.scope,
          lastCheckedAt: Date.now(),
          error: error instanceof Error ? error.message : String(error),
          processes: [],
          runningCount: 0,
          totalCount: 0,
        });
      }
    };

    void refresh(true);
    const intervalId = window.setInterval(() => {
      void refresh(false);
    }, PROCESS_POLL_INTERVAL_MS);

    return () => {
      cancelled = true;
      window.clearInterval(intervalId);
    };
  }, [input.agentId, input.scope, sessionKeySignature]);

  return telemetry;
}
