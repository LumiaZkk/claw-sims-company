import {
  buildWorkspaceWorkbenchRequest,
  withWorkspaceEmbeddedAppSelection,
  type WorkspaceAppManifestAction,
  type WorkspaceWorkbenchTool,
} from "../../application/workspace";
import { toast } from "../../system/toast-store";
import {
  isCapabilityIssueType,
  isWorkbenchTool,
} from "./workspace-page-constants";
import { createWorkspacePageAppActions } from "./workspace-page-app-actions";
import { createWorkspacePageCapabilityActions } from "./workspace-page-capability-actions";
import type { UseWorkspacePageActionsParams } from "./workspace-page-action-types";

export function useWorkspacePageActions({
  activeCompany,
  ctoEmployee,
  embeddedAppSnapshot,
  navigate,
  prefillSequenceRef,
  selectedApp,
  selectedAppManifest,
  selectedAppUsesEmbeddedHost,
  selectedEmbeddedSectionSlot,
  selectedFile,
  setEmbeddedAppSnapshot,
  setSelectedFileKey,
  workspaceFiles,
  ...params
}: UseWorkspacePageActionsParams) {
  const appActions = createWorkspacePageAppActions({
    activeCompany,
    ctoEmployee,
    embeddedAppSnapshot,
    navigate,
    prefillSequenceRef,
    selectedApp,
    selectedAppManifest,
    selectedAppUsesEmbeddedHost,
    selectedEmbeddedSectionSlot,
    selectedFile,
    setEmbeddedAppSnapshot,
    setSelectedFileKey,
    workspaceFiles,
    ...params,
  });
  const capabilityActions = createWorkspacePageCapabilityActions({
    activeCompany,
    ctoEmployee,
    embeddedAppSnapshot,
    navigate,
    prefillSequenceRef,
    selectedApp,
    selectedAppManifest,
    selectedAppUsesEmbeddedHost,
    selectedEmbeddedSectionSlot,
    selectedFile,
    setEmbeddedAppSnapshot,
    setSelectedFileKey,
    workspaceFiles,
    ...params,
  });

  const openCtoWorkbench = (tool: WorkspaceWorkbenchTool) => {
    if (!ctoEmployee) {
      toast.error("当前公司没有 CTO 节点", "至少需要一个 CTO 节点来承接公司级工具需求。");
      return;
    }

    const request = buildWorkspaceWorkbenchRequest(activeCompany, tool);
    prefillSequenceRef.current += 1;
    navigate(`/chat/${encodeURIComponent(ctoEmployee.agentId)}`, {
      state: {
        prefillText: request.prompt,
        prefillId: `${tool}:${prefillSequenceRef.current}`,
      },
    });
  };

  const runAppManifestAction = async (action: WorkspaceAppManifestAction) => {
    if (selectedAppUsesEmbeddedHost) {
      setEmbeddedAppSnapshot((current) =>
        withWorkspaceEmbeddedAppSelection(current, {
          lastActionId: action.id,
        }),
      );
    }
    switch (action.actionType) {
      case "refresh_manifest":
        await appActions.generateAppManifestDraft(selectedApp);
        return;
      case "open_chat":
        if (action.target === "cto" && ctoEmployee) {
          navigate(`/chat/${encodeURIComponent(ctoEmployee.agentId)}`);
        }
        return;
      case "request_capability":
      case "workbench_request":
        if (isWorkbenchTool(action.target)) {
          const activeSectionLabel =
            selectedAppUsesEmbeddedHost && selectedEmbeddedSectionSlot && selectedAppManifest
              ? selectedAppManifest.sections.find((section) => section.slot === selectedEmbeddedSectionSlot)?.label ?? null
              : null;
          await capabilityActions.createCapabilityRequestDraft(action.target, {
            actionId: action.id,
            sectionLabel: activeSectionLabel,
            fileKey: selectedFile?.key ?? null,
            fileName: selectedFile?.name ?? null,
          });
        }
        return;
      case "open_resource": {
        const targetFile =
          workspaceFiles.find((file) => file.artifactId === action.target || file.key === action.target)
          ?? null;
        if (targetFile) {
          setSelectedFileKey(targetFile.key);
        }
        return;
      }
      case "report_issue": {
        const activeSectionLabel =
          selectedAppUsesEmbeddedHost && selectedEmbeddedSectionSlot && selectedAppManifest
            ? selectedAppManifest.sections.find((section) => section.slot === selectedEmbeddedSectionSlot)?.label ?? null
            : null;
        const lastActionLabel =
          selectedAppUsesEmbeddedHost && embeddedAppSnapshot.lastActionId && selectedAppManifest?.actions
            ? selectedAppManifest.actions.find((candidate) => candidate.id === embeddedAppSnapshot.lastActionId)?.label ?? null
            : null;
        const contextLines = [
          `问题来自 ${selectedApp.title}。`,
          activeSectionLabel ? `当前分区：${activeSectionLabel}` : null,
          selectedFile ? `当前资源：${selectedFile.name}` : null,
          lastActionLabel ? `最近动作：${lastActionLabel}` : null,
          typeof action.input?.detail === "string" && action.input.detail.trim().length > 0 ? action.input.detail : null,
        ].filter((item): item is string => Boolean(item));
        const summaryParts = [
          selectedApp.title,
          selectedFile?.name ?? activeSectionLabel,
          action.label.replace(/^反馈/, ""),
        ].filter((item): item is string => Boolean(item && item.trim().length > 0));
        await capabilityActions.createCapabilityIssueDraft({
          type: isCapabilityIssueType(action.input?.type) ? action.input.type : "bad_result",
          summary:
            typeof action.input?.summary === "string" && action.input.summary.trim().length > 0
              ? action.input.summary
              : summaryParts.join(" · "),
          detail: contextLines.join(" "),
          appId: selectedApp.id,
          skillId: action.target === "dashboard" ? null : action.target,
          contextActionId: action.id,
          contextAppSection: activeSectionLabel,
          contextFileKey: selectedFile?.key ?? null,
          contextFileName: selectedFile?.name ?? null,
        });
        return;
      }
      case "trigger_capability":
      case "trigger_skill":
        await capabilityActions.triggerSkillFromManifest(action.target, selectedApp.id, action.id);
        return;
    }
  };

  return {
    ...appActions,
    ...capabilityActions,
    openCtoWorkbench,
    runAppManifestAction,
  };
}
