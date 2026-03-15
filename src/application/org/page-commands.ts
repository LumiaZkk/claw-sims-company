import { useCallback, useEffect, useRef, useState } from "react";
import { requestAuthorityApproval } from "../gateway/authority-control";
import type { ApprovalRecord } from "../../domain/governance/types";
import type { Company, Department } from "../../domain/org/types";
import type { ProviderManifest } from "../gateway";
import {
  applyHrDepartmentPlanToCompany,
  applyOrgRecommendationToCompany,
  buildFixedOrganization,
  buildSavedDepartments,
  summarizeDepartmentCreateRemoveChanges,
  buildUpdatedEmployeeProfiles,
} from "./organization-commands";
import {
  fireCompanyEmployee,
  hireCompanyEmployee,
  openAgentWorkspaceFile,
  saveAgentWorkspaceFile,
  startHrDepartmentBootstrapRun,
  updateEmployeeIdentityName,
  updateEmployeeRolePrompt,
  type HireEmployeeConfig,
} from "./directory-commands";
import type { HrPlanRuntimeState } from "./directory-commands";
import type { OrgAdvisorSnapshot } from "../assignment/org-fit";
import type { HireConfig } from "../../ui/immersive-hire-dialog";
import { readCompanyRuntimeState } from "../../infrastructure/company/runtime/selectors";

type SavedDepartmentsResult = ReturnType<typeof buildSavedDepartments>;

export type SaveDirectoryDepartmentsResult =
  | {
      mode: "executed";
      approval: null;
      normalized: SavedDepartmentsResult;
    }
  | {
      mode: "approval_requested";
      approval: ApprovalRecord;
      normalized: SavedDepartmentsResult;
    };

function describeDepartmentLabels(departments: Department[]) {
  return departments
    .map((department) => department.name.trim() || department.id)
    .filter(Boolean)
    .slice(0, 4)
    .join("、");
}

function buildDepartmentChangeApprovalSummary(input: {
  created: Department[];
  removed: Department[];
}) {
  const createdCount = input.created.length;
  const removedCount = input.removed.length;
  if (createdCount > 0 && removedCount > 0) {
    return `审批更新部门配置（新增 ${createdCount} / 归档或移除 ${removedCount}）`;
  }
  if (createdCount > 0) {
    return `审批新增 ${createdCount} 个部门`;
  }
  return `审批归档或移除 ${removedCount} 个部门`;
}

function buildDepartmentChangeApprovalDetail(input: {
  created: Department[];
  removed: Department[];
}) {
  const details: string[] = [];
  if (input.created.length > 0) {
    details.push(`准备新增部门：${describeDepartmentLabels(input.created)}`);
  }
  if (input.removed.length > 0) {
    details.push(`准备归档或移除部门：${describeDepartmentLabels(input.removed)}`);
  }
  details.push("审批通过后才会把新的部门配置写回组织结构。");
  return details.join("；");
}

function readApprovalPayloadDepartments(payload: ApprovalRecord["payload"]): Department[] {
  if (!payload || !Array.isArray(payload.departments)) {
    return [];
  }
  return payload.departments
    .filter((item): item is Record<string, unknown> => Boolean(item && typeof item === "object"))
    .map((item): Department => {
      const kind =
        item.kind === "meta" || item.kind === "support" || item.kind === "business"
          ? item.kind
          : undefined;
      const missionPolicy =
        item.missionPolicy === "support_only"
        || item.missionPolicy === "manager_delegated"
        || item.missionPolicy === "direct_execution"
          ? item.missionPolicy
          : undefined;
      return {
        id: typeof item.id === "string" ? item.id : "",
        name: typeof item.name === "string" ? item.name : "",
        leadAgentId: typeof item.leadAgentId === "string" ? item.leadAgentId : "",
        kind,
        color: typeof item.color === "string" ? item.color : undefined,
        order: typeof item.order === "number" && Number.isFinite(item.order) ? item.order : undefined,
        missionPolicy,
        archived: item.archived === true,
      };
    })
    .filter((department) => department.id.trim().length > 0 && department.leadAgentId.trim().length > 0);
}

export async function openDirectoryWorkspaceFile(input: {
  agentId: string;
  fileName: string;
  supportsAgentFiles: boolean;
}) {
  return openAgentWorkspaceFile(input.agentId, input.fileName, input.supportsAgentFiles);
}

export async function saveDirectoryWorkspaceFile(input: {
  agentId: string;
  fileName: string;
  content: string;
}) {
  await saveAgentWorkspaceFile(input.agentId, input.fileName, input.content);
}

export async function hireDirectoryEmployee(company: Company, config: HireEmployeeConfig) {
  return hireCompanyEmployee(company, config);
}

export async function updateDirectoryRole(agentId: string, role: string, description: string) {
  await updateEmployeeRolePrompt(agentId, role, description);
}

export async function startDirectoryHrBootstrap(input: {
  company: Company;
  manifest: ProviderManifest;
  onStateChange: (state: HrPlanRuntimeState) => void;
}) {
  return startHrDepartmentBootstrapRun(input);
}

export async function applyDirectoryHrPlan(input: {
  company: Company;
  rawText: string;
  updateCompany: (patch: Partial<Company>) => Promise<void> | void;
}) {
  const appliedPlan = applyHrDepartmentPlanToCompany(input.company, input.rawText);
  if (!appliedPlan.ok) {
    return appliedPlan;
  }

  await input.updateCompany({
    departments: appliedPlan.normalized.departments,
    employees: appliedPlan.normalized.employees,
  });

  return appliedPlan;
}

export async function fixDirectoryOrganization(input: {
  company: Company;
  updateCompany: (patch: Partial<Company>) => Promise<void> | void;
}) {
  const fixed = buildFixedOrganization(input.company);
  await input.updateCompany({
    departments: fixed.normalized.departments,
    employees: fixed.normalized.employees,
  });
  return fixed;
}

export async function applyDirectoryRecommendation(input: {
  company: Company;
  orgAdvisor: OrgAdvisorSnapshot | null;
  recommendationId: string;
  updateCompany: (patch: Partial<Company>) => Promise<void> | void;
}) {
  const normalized = applyOrgRecommendationToCompany(
    input.company,
    input.orgAdvisor,
    input.recommendationId,
  );
  if (!normalized) {
    return null;
  }
  await input.updateCompany({
    departments: normalized.departments,
    employees: normalized.employees,
  });
  return normalized;
}

export async function updateDirectoryProfile(input: {
  company: Company;
  agentId: string;
  nickname: string;
  role: string;
  syncIdentityName: boolean;
  updateCompany: (patch: Partial<Company>) => Promise<void> | void;
}) {
  const employees = buildUpdatedEmployeeProfiles(
    input.company,
    input.agentId,
    input.nickname,
    input.role,
  );
  await input.updateCompany({ employees });

  let identitySyncError: string | null = null;
  if (input.syncIdentityName) {
    try {
      await updateEmployeeIdentityName(input.agentId, input.nickname);
    } catch (error) {
      identitySyncError = error instanceof Error ? error.message : String(error);
    }
  }

  return { employees, identitySyncError };
}

export async function saveDirectoryDepartments(input: {
  company: Company;
  nextDepartments: Department[];
  updateCompany: (patch: Partial<Company>) => Promise<void> | void;
  options?: {
    skipApproval?: boolean;
  };
}): Promise<SaveDirectoryDepartmentsResult> {
  const normalized = buildSavedDepartments(input.company, input.nextDepartments);
  const departmentChanges = summarizeDepartmentCreateRemoveChanges(
    input.company.departments,
    normalized.departments,
  );
  const needsApproval =
    !input.options?.skipApproval &&
    input.company.orgSettings?.autonomyPolicy?.humanApprovalRequiredForDepartmentCreateRemove !== false &&
    departmentChanges.hasRiskyChanges;

  if (needsApproval) {
    const result = await requestAuthorityApproval({
      companyId: input.company.id,
      scope: "org",
      actionType: "department_change",
      summary: buildDepartmentChangeApprovalSummary(departmentChanges),
      detail: buildDepartmentChangeApprovalDetail(departmentChanges),
      requestedByActorId: "operator:local-user",
      requestedByLabel: "当前操作者",
      payload: {
        departments: normalized.departments,
        createdDepartmentIds: departmentChanges.created.map((department) => department.id),
        createdDepartmentNames: departmentChanges.created.map(
          (department) => department.name.trim() || department.id,
        ),
        removedDepartmentIds: departmentChanges.removed.map((department) => department.id),
        removedDepartmentNames: departmentChanges.removed.map(
          (department) => department.name.trim() || department.id,
        ),
      },
    });
    await readCompanyRuntimeState().loadConfig();
    return {
      mode: "approval_requested",
      approval: result.approval,
      normalized,
    };
  }

  await input.updateCompany({
    departments: normalized.departments,
    employees: normalized.employees,
  });
  return {
    mode: "executed",
    approval: null,
    normalized,
  };
}

export async function applyApprovedDirectoryDepartmentChange(input: {
  company: Company;
  approval: ApprovalRecord;
  updateCompany: (patch: Partial<Company>) => Promise<void> | void;
}) {
  const nextDepartments = readApprovalPayloadDepartments(input.approval.payload);
  if (nextDepartments.length === 0) {
    throw new Error("当前审批缺少可应用的部门配置快照。");
  }
  const result = await saveDirectoryDepartments({
    company: input.company,
    nextDepartments,
    updateCompany: input.updateCompany,
    options: {
      skipApproval: true,
    },
  });
  if (result.mode !== "executed") {
    throw new Error("部门审批在批准后仍被再次拦截，请检查 approval gate 配置。");
  }
  return result.normalized;
}

export async function fireDirectoryEmployee(agentId: string) {
  return fireCompanyEmployee(agentId);
}

export function useOrgDirectoryCommands(input: {
  activeCompany: Company | null;
  manifest: ProviderManifest;
  orgAdvisor: OrgAdvisorSnapshot | null;
  orgIssueCount: number;
  updateCompany: (patch: Partial<Company>) => Promise<void> | void;
}) {
  const [hireSubmitting, setHireSubmitting] = useState(false);
  const [profileSubmitting, setProfileSubmitting] = useState(false);
  const [updateRoleSubmitting, setUpdateRoleSubmitting] = useState(false);
  const [departmentsSaving, setDepartmentsSaving] = useState(false);
  const [fixingOrg, setFixingOrg] = useState(false);
  const [hrPlanDialogState, setHrPlanDialogState] = useState<HrPlanRuntimeState>({ status: "idle" });
  const [applyingHrPlan, setApplyingHrPlan] = useState(false);
  const hrSubscriptionRef = useRef<null | (() => void)>(null);

  useEffect(() => {
    return () => {
      hrSubscriptionRef.current?.();
      hrSubscriptionRef.current = null;
    };
  }, []);

  const hireEmployee = useCallback(
    async (config: HireConfig) => {
      if (!input.activeCompany) {
        return null;
      }

      const role = (config.role ?? "").trim();
      const description = (config.description ?? "").trim();
      if (!role || !description) {
        return null;
      }

      setHireSubmitting(true);
      try {
        const result = await hireDirectoryEmployee(input.activeCompany, config);
        return result.agentId;
      } finally {
        setHireSubmitting(false);
      }
    },
    [input.activeCompany],
  );

  const updateRole = useCallback(async (agentId: string | null, role: string, description: string) => {
    const nextRole = role.trim();
    const nextDescription = description.trim();
    if (!agentId || !nextRole || !nextDescription) {
      return false;
    }

    setUpdateRoleSubmitting(true);
    try {
      await updateDirectoryRole(agentId, nextRole, nextDescription);
      return true;
    } finally {
      setUpdateRoleSubmitting(false);
    }
  }, []);

  const startHrBootstrap = useCallback(async () => {
    if (!input.activeCompany) {
      return false;
    }
    hrSubscriptionRef.current?.();
    hrSubscriptionRef.current = null;

    setHrPlanDialogState({ status: "waiting", sessionKey: "", runId: null });

    try {
      const run = await startDirectoryHrBootstrap({
        company: input.activeCompany,
        manifest: input.manifest,
        onStateChange: (nextState) => {
          setHrPlanDialogState(nextState);
          if (nextState.status === "ready" || nextState.status === "error") {
            hrSubscriptionRef.current?.();
            hrSubscriptionRef.current = null;
          }
        },
      });
      hrSubscriptionRef.current = run.unsubscribe;
      return true;
    } catch (error) {
      setHrPlanDialogState({
        status: "error",
        sessionKey: null,
        runId: null,
        message: error instanceof Error ? error.message : String(error),
      });
      return false;
    }
  }, [input.activeCompany, input.manifest]);

  const applyHrPlan = useCallback(async () => {
    if (!input.activeCompany || applyingHrPlan || hrPlanDialogState.status !== "ready") {
      return null;
    }

    setApplyingHrPlan(true);
    try {
      return await applyDirectoryHrPlan({
        company: input.activeCompany,
        rawText: hrPlanDialogState.rawText,
        updateCompany: input.updateCompany,
      });
    } finally {
      setApplyingHrPlan(false);
    }
  }, [applyingHrPlan, hrPlanDialogState, input.activeCompany, input.updateCompany]);

  const resetHrPlan = useCallback(() => {
    hrSubscriptionRef.current?.();
    hrSubscriptionRef.current = null;
    setHrPlanDialogState({ status: "idle" });
  }, []);

  const fixOrganization = useCallback(async () => {
    if (!input.activeCompany || input.orgIssueCount === 0 || fixingOrg) {
      return null;
    }

    setFixingOrg(true);
    try {
      return await fixDirectoryOrganization({
        company: input.activeCompany,
        updateCompany: input.updateCompany,
      });
    } finally {
      setFixingOrg(false);
    }
  }, [fixingOrg, input.activeCompany, input.orgIssueCount, input.updateCompany]);

  const applyRecommendation = useCallback(
    (recommendationId: string) => {
      if (!input.activeCompany) {
        return Promise.resolve(null);
      }
      return applyDirectoryRecommendation({
        company: input.activeCompany,
        orgAdvisor: input.orgAdvisor,
        recommendationId,
        updateCompany: input.updateCompany,
      });
    },
    [input.activeCompany, input.orgAdvisor, input.updateCompany],
  );

  const updateProfile = useCallback(
    async (params: {
      agentId: string | null;
      nickname: string;
      role: string;
      syncIdentityName: boolean;
    }) => {
      if (!input.activeCompany || !params.agentId) {
        return null;
      }

      setProfileSubmitting(true);
      try {
        return await updateDirectoryProfile({
          company: input.activeCompany,
          agentId: params.agentId,
          nickname: params.nickname,
          role: params.role,
          syncIdentityName: params.syncIdentityName,
          updateCompany: input.updateCompany,
        });
      } finally {
        setProfileSubmitting(false);
      }
    },
    [input.activeCompany, input.updateCompany],
  );

  const saveDepartments = useCallback(
    async (nextDepartments: Department[]) => {
      if (!input.activeCompany) {
        return null;
      }

      setDepartmentsSaving(true);
      try {
        return await saveDirectoryDepartments({
          company: input.activeCompany,
          nextDepartments,
          updateCompany: input.updateCompany,
        });
      } finally {
        setDepartmentsSaving(false);
      }
    },
    [input.activeCompany, input.updateCompany],
  );

  const fireEmployee = useCallback((agentId: string) => fireDirectoryEmployee(agentId), []);

  return {
    hireEmployee,
    updateRole,
    startHrBootstrap,
    applyHrPlan,
    resetHrPlan,
    fixOrganization,
    applyRecommendation,
    updateProfile,
    saveDepartments,
    fireEmployee,
    hireSubmitting,
    profileSubmitting,
    updateRoleSubmitting,
    departmentsSaving,
    fixingOrg,
    hrPlanDialogState,
    applyingHrPlan,
    hrPlanning: hrPlanDialogState.status === "waiting",
    canApplyHrPlan: hrPlanDialogState.status === "ready",
  };
}
