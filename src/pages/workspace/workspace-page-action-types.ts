import type { Dispatch, MutableRefObject, SetStateAction } from "react";
import type {
  WorkspaceAppManifest,
  WorkspaceEmbeddedAppSnapshot,
  WorkspaceFileRow,
  WorkspaceScriptExecutionAttempt,
} from "../../application/workspace";
import { resolveWorkspaceSkillExecutionFromScriptRun } from "../../application/workspace";
import { gateway } from "../../application/gateway";
import type { AuthorityAgentFileRunResponse } from "../../application/gateway/authority-types";
import type {
  Company,
  CompanyWorkspaceApp,
  EmployeeRef,
  SkillDefinition,
  WorkflowCapabilityBinding,
} from "../../domain/org/types";

export type MinimalWorkItem = {
  id: string;
  ownerActorId?: string | null;
  displayOwnerLabel?: string | null;
  ownerLabel?: string | null;
  owningDepartmentId?: string | null;
} | null;

export type NavigateLike = (to: string, options?: { state?: unknown }) => void;

export type UseWorkspacePageActionsParams = {
  activeCompany: Company;
  activeWorkspaceWorkItem: MinimalWorkItem;
  businessLead: EmployeeRef | null;
  capabilityIssues: Company["capabilityIssues"];
  capabilityRequests: Company["capabilityRequests"];
  ctoEmployee: EmployeeRef | null;
  embeddedAppSnapshot: WorkspaceEmbeddedAppSnapshot;
  navigate: NavigateLike;
  prefillSequenceRef: MutableRefObject<number>;
  primaryRegisterableAppManifest: {
    appId?: string | null;
    artifactId: string;
    fileName: string;
    slug: string;
    sourceLabel?: string | null;
    title: string;
  } | null;
  registerableAppManifestCandidates: Array<{
    appId?: string | null;
    artifactId: string;
    fileName: string;
    slug: string;
    sourceLabel?: string | null;
    title: string;
  }>;
  retryCompanyProvisioning: (companyId: string) => Promise<void>;
  selectedApp: CompanyWorkspaceApp;
  selectedAppManifest: WorkspaceAppManifest | null;
  selectedAppUsesEmbeddedHost: boolean;
  selectedEmbeddedSectionSlot: string | null;
  selectedFile: WorkspaceFileRow | null;
  setEmbeddedAppSnapshot: Dispatch<SetStateAction<WorkspaceEmbeddedAppSnapshot>>;
  setSelectedAppId: Dispatch<SetStateAction<string | null>>;
  setSelectedFileKey: Dispatch<SetStateAction<string | null>>;
  skillDefinitions: Company["skillDefinitions"];
  skillRuns: Company["skillRuns"];
  upsertArtifactRecord: (
    input: Parameters<
      ReturnType<typeof import("../../application/artifact").useArtifactApp>["upsertArtifactRecord"]
    >[0],
  ) => void;
  upsertCapabilityAuditEvent: (
    input: Parameters<
      ReturnType<
        typeof import("../../application/company/runtime-commands").useCompanyRuntimeCommands
      >["upsertCapabilityAuditEvent"]
    >[0],
  ) => Promise<void>;
  upsertCapabilityIssue: (
    input: Parameters<
      ReturnType<
        typeof import("../../application/company/runtime-commands").useCompanyRuntimeCommands
      >["upsertCapabilityIssue"]
    >[0],
  ) => Promise<void>;
  upsertCapabilityRequest: (
    input: Parameters<
      ReturnType<
        typeof import("../../application/company/runtime-commands").useCompanyRuntimeCommands
      >["upsertCapabilityRequest"]
    >[0],
  ) => Promise<void>;
  upsertSkillDefinition: (
    input: Parameters<
      ReturnType<
        typeof import("../../application/company/runtime-commands").useCompanyRuntimeCommands
      >["upsertSkillDefinition"]
    >[0],
  ) => Promise<void>;
  upsertSkillRun: ReturnType<
    typeof import("../../application/company/runtime-commands").useCompanyRuntimeCommands
  >["upsertSkillRun"];
  workspaceAppManifestsById: Record<string, WorkspaceAppManifest | undefined>;
  workspaceApps: CompanyWorkspaceApp[];
  workspaceFiles: WorkspaceFileRow[];
  writeWorkflowCapabilityBindings: (nextBindings: WorkflowCapabilityBinding[]) => Promise<void>;
  writeWorkspaceApps: (nextApps: CompanyWorkspaceApp[]) => Promise<void>;
  workflowCapabilityBindingCatalog: WorkflowCapabilityBinding[];
};

export async function attemptWorkspaceScriptExecution(input: {
  app: CompanyWorkspaceApp | null;
  company: Company;
  executionInput: unknown;
  now: number;
  onFallback: (message: string) => void;
  skill: SkillDefinition | null;
  workItemId: string | null;
}): Promise<WorkspaceScriptExecutionAttempt | null> {
  const { app, company, executionInput, now, onFallback, skill, workItemId } = input;
  if (!skill) {
    return null;
  }
  try {
    const response = await gateway.request<AuthorityAgentFileRunResponse>("authority.agent.file.run", {
      agentId: skill.ownerAgentId,
      entryPath: skill.entryPath,
      payload: executionInput,
      timeoutMs: 20_000,
    });
    if (response.status !== "executed") {
      const message =
        response.message?.trim()
        || (response.status === "missing"
          ? `工作区中未找到 ${skill.entryPath}`
          : `当前环境暂不支持直接执行 ${skill.entryPath}`);
      onFallback(message);
      return { status: "fallback", note: message } satisfies WorkspaceScriptExecutionAttempt;
    }
    if ((response.exitCode ?? 0) !== 0) {
      throw new Error(response.stderr?.trim() || `workspace script 以退出码 ${response.exitCode} 结束。`);
    }
    const executionFromScript = resolveWorkspaceSkillExecutionFromScriptRun({
      company,
      skill,
      app,
      response,
      workItemId,
      now,
    });
    if (!executionFromScript) {
      const message = "工作区脚本输出暂时无法解析，已自动回退到平台桥接。";
      onFallback(message);
      return { status: "fallback", note: message } satisfies WorkspaceScriptExecutionAttempt;
    }
    return { status: "executed", result: executionFromScript } satisfies WorkspaceScriptExecutionAttempt;
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    if (
      message.includes("authority.agent.file.run")
      || message.includes("requires agentId and entryPath")
      || message.includes("Unknown method")
      || message.includes("404")
    ) {
      const fallbackMessage = "当前 authority 还没有开启工作区脚本执行，已自动回退到平台桥接。";
      onFallback(fallbackMessage);
      return { status: "fallback", note: fallbackMessage } satisfies WorkspaceScriptExecutionAttempt;
    }
    throw error;
  }
}
