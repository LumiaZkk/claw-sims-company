import { useCallback, useEffect, useRef, useState } from "react";
import type { Department } from "../../domain/org/types";
import type { ProviderManifest } from "../gateway";
import {
  applyHrDepartmentPlanToCompany,
  applyOrgRecommendationToCompany,
  buildFixedOrganization,
  buildSavedDepartments,
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
import type { Company } from "../../domain/org/types";
import type { HrPlanRuntimeState } from "./directory-commands";
import type { OrgAdvisorSnapshot } from "../assignment/org-fit";
import type { HireConfig } from "../../components/ui/immersive-hire-dialog";

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
}) {
  const normalized = buildSavedDepartments(input.company, input.nextDepartments);
  await input.updateCompany({
    departments: normalized.departments,
    employees: normalized.employees,
  });
  return normalized;
}

export async function fireDirectoryEmployee(agentId: string) {
  await fireCompanyEmployee(agentId);
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
