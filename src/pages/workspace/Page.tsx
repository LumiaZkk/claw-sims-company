import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useArtifactApp } from "../../application/artifact";
import {
  applyWorkspaceAppManifest,
  buildCapabilityPlatformCloseoutSnapshot,
  buildCapabilityPlatformCloseoutSummary,
  buildWorkspaceReaderIndex,
  getCompanyWorkflowCapabilityBindings,
  getKnowledgeSourceFilesForItem,
  hasStoredWorkflowCapabilityBindings,
  isCapabilityPlatformCloseoutSnapshotEqual,
  isWorkspaceEmbeddedAppSnapshotEqual,
  loadWorkspaceEmbeddedAppSnapshot,
  loadWorkspaceReaderSnapshot,
  pickDefaultWorkspaceFile,
  readWorkspaceAppManifestRegistrationMeta,
  recordWorkspaceFileVisit,
  resolveWorkflowCapabilityBindings,
  resolveWorkspaceEmbeddedAppRuntime,
  saveWorkspaceEmbeddedAppSnapshot,
  saveWorkspaceReaderSnapshot,
  useWorkspaceFileContent,
  useWorkspaceViewModel,
  withWorkspaceEmbeddedAppSelection,
  withWorkspaceSelection,
  type ResolvedWorkflowCapabilityBinding,
  type WorkspaceReaderPageSnapshot,
} from "../../application/workspace";
import {
  resolveWorkspaceAppSurface,
  resolveWorkspaceAppTemplate,
} from "../../application/company/workspace-apps";
import { useCompanyRuntimeCommands } from "../../application/company/runtime-commands";
import { useOrgApp } from "../../application/org";
import { usePageVisibility } from "../../lib/use-page-visibility";
import { Card, CardDescription, CardHeader, CardTitle } from "../../ui/card";
import { WorkspacePageContent } from "./components/WorkspacePageContent";
import {
  findBusinessLead,
  type RegisterableAppManifestCandidate,
} from "./workspace-page-constants";
import { useWorkspacePageActions } from "./useWorkspacePageActions";

export function WorkspacePresentationPage() {
  const navigate = useNavigate();
  const isPageVisible = usePageVisibility();
  const prefillSequenceRef = useRef(0);
  const { updateCompany } = useOrgApp();
  const { upsertArtifactRecord } = useArtifactApp();
  const {
    upsertCapabilityIssue,
    upsertCapabilityRequest,
    upsertCapabilityAuditEvent,
    retryCompanyProvisioning,
    upsertSkillDefinition,
    upsertSkillRun,
  } = useCompanyRuntimeCommands();
  const {
    activeCompany,
    activeWorkspaceWorkItem,
    agentLabelById,
    anchors,
    artifactBackedWorkspaceCount,
    canonFiles,
    chapterFiles,
    ctoEmployee,
    knowledgeFiles,
    knowledgeItems,
    loadingIndex,
    mirroredOnlyWorkspaceCount,
    readerManifest,
    refreshIndex,
    reviewFiles,
    shouldSyncProviderWorkspace,
    supplementaryFiles,
    toolingFiles,
    workspacePolicySummary,
    workspaceAppManifestsById,
    workspaceApps,
    workspaceAppsAreExplicit,
    workspaceFiles,
  } = useWorkspaceViewModel({ isPageVisible });
  const activeCompanyId = activeCompany?.id ?? null;
  const [selectedAppId, setSelectedAppId] = useState<string | null>(null);
  const [selectedKnowledgeId, setSelectedKnowledgeId] = useState<string | null>(null);
  const [selectedFileKey, setSelectedFileKey] = useState<string | null>(null);
  const [readerSnapshot, setReaderSnapshot] = useState<WorkspaceReaderPageSnapshot>(() =>
    loadWorkspaceReaderSnapshot(null),
  );
  const [embeddedAppSnapshot, setEmbeddedAppSnapshot] = useState(() =>
    loadWorkspaceEmbeddedAppSnapshot(null, null),
  );

  useEffect(() => {
    if (!activeCompanyId) {
      return;
    }
    const snapshot = loadWorkspaceReaderSnapshot(activeCompanyId);
    setReaderSnapshot(snapshot);
    setSelectedAppId(snapshot.lastSelectedAppId);
    setSelectedKnowledgeId(snapshot.lastSelectedKnowledgeId);
    setSelectedFileKey(snapshot.lastSelectedFileKey);
  }, [activeCompanyId]);

  const selectedApp =
    (selectedAppId ? workspaceApps.find((app) => app.id === selectedAppId) : null) ?? workspaceApps[0];
  const selectedAppTemplate = selectedApp ? resolveWorkspaceAppTemplate(selectedApp) : null;
  const selectedAppSurface = selectedApp ? resolveWorkspaceAppSurface(selectedApp) : null;
  const selectedAppManifest = selectedApp ? workspaceAppManifestsById[selectedApp.id] ?? null : null;
  const selectedAppResolvedFiles = useMemo(
    () =>
      selectedApp && selectedAppManifest
        ? applyWorkspaceAppManifest(workspaceFiles, selectedAppManifest)
        : workspaceFiles,
    [selectedApp, selectedAppManifest, workspaceFiles],
  );
  const selectedAppUsesEmbeddedHost =
    selectedAppSurface === "embedded"
    || selectedAppTemplate === "review-console"
    || selectedAppTemplate === "dashboard";
  const publishedAppTemplates = workspaceAppsAreExplicit
    ? workspaceApps.map((app) => resolveWorkspaceAppTemplate(app))
    : [];
  const selectedKnowledgeItem =
    (selectedKnowledgeId ? knowledgeItems.find((item) => item.id === selectedKnowledgeId) : null)
    ?? knowledgeItems[0]
    ?? null;
  const selectedKnowledgeSourceFiles = getKnowledgeSourceFilesForItem(
    selectedKnowledgeItem,
    knowledgeFiles,
  );
  const selectedEmbeddedRuntime = useMemo(
    () =>
      selectedAppUsesEmbeddedHost && selectedApp
        ? resolveWorkspaceEmbeddedAppRuntime({
            app: selectedApp,
            manifest: selectedAppManifest,
            files: selectedAppResolvedFiles,
            snapshot: embeddedAppSnapshot,
          })
        : null,
    [embeddedAppSnapshot, selectedApp, selectedAppManifest, selectedAppResolvedFiles, selectedAppUsesEmbeddedHost],
  );
  const selectedEmbeddedSections = selectedEmbeddedRuntime?.sections ?? [];
  const selectedEmbeddedSectionFiles = useMemo(
    () => new Map(selectedEmbeddedSections.map((section) => [section.slot, section.files])),
    [selectedEmbeddedSections],
  );
  const selectedEmbeddedSectionSlot = selectedEmbeddedRuntime?.activeSectionSlot ?? null;
  const selectedEmbeddedAllFiles = selectedEmbeddedRuntime?.allFiles ?? [];
  const selectedFile =
    (selectedFileKey
      ? (selectedAppUsesEmbeddedHost ? selectedEmbeddedAllFiles : workspaceFiles).find(
          (file) => file.key === selectedFileKey,
        )
      : null)
    ?? (selectedAppUsesEmbeddedHost
      ? selectedEmbeddedRuntime?.selectedFile ?? null
      : pickDefaultWorkspaceFile(
          selectedAppTemplate === "knowledge" ? selectedKnowledgeSourceFiles : workspaceFiles,
          selectedAppTemplate === "knowledge"
            ? ["knowledge", "chapter", "canon", "review"]
            : ["chapter", "canon", "review", "knowledge"],
        ));
  const { loadingFileKey, selectedFileContent } = useWorkspaceFileContent({
    activeCompanyId,
    activeWorkspaceWorkItemId: activeWorkspaceWorkItem?.id ?? null,
    selectedFile,
    shouldSyncProviderWorkspace,
  });
  const readerIndex = useMemo(
    () =>
      buildWorkspaceReaderIndex({
        files: [...chapterFiles, ...canonFiles, ...reviewFiles],
        snapshot: readerSnapshot,
      }),
    [canonFiles, chapterFiles, readerSnapshot, reviewFiles],
  );
  const skillDefinitions = activeCompany?.skillDefinitions ?? [];
  const skillRuns = activeCompany?.skillRuns ?? [];
  const capabilityRequests = activeCompany?.capabilityRequests ?? [];
  const capabilityIssues = activeCompany?.capabilityIssues ?? [];
  const capabilityAuditEvents = activeCompany?.capabilityAuditEvents ?? [];
  const executorProvisioning = activeCompany?.system?.executorProvisioning ?? null;
  const registerableAppManifestCandidates = useMemo<RegisterableAppManifestCandidate[]>(() => {
    const boundManifestIds = new Set(
      workspaceApps.map((app) => app.manifestArtifactId).filter((value): value is string => Boolean(value)),
    );
    return workspaceFiles
      .filter((file) => file.artifactId && file.tags.includes("tech.app-manifest"))
      .filter((file) => !boundManifestIds.has(file.artifactId!))
      .map((file) => {
        const meta = readWorkspaceAppManifestRegistrationMeta(file.content ?? file.previewText ?? "");
        if (!meta?.appSlug && !meta?.title) {
          return null;
        }
        return {
          artifactId: file.artifactId!,
          fileName: file.name,
          title: meta.title ?? file.name.replace(/^workspace-app-manifest\./, "").replace(/\.json$/i, ""),
          slug:
            meta.appSlug
            ?? file.name
              .replace(/^workspace-app-manifest\./, "")
              .replace(/\.json$/i, "")
              .trim()
              .toLowerCase(),
          appId: meta.appId,
          sourceLabel: meta.sourceLabel ?? null,
        };
      })
      .filter((candidate): candidate is RegisterableAppManifestCandidate => Boolean(candidate));
  }, [workspaceApps, workspaceFiles]);
  const primaryRegisterableAppManifest = registerableAppManifestCandidates[0] ?? null;
  const workflowCapabilityBindingCatalog = useMemo(
    () => getCompanyWorkflowCapabilityBindings(activeCompany),
    [activeCompany],
  );
  const workflowCapabilityBindingsAreExplicit = hasStoredWorkflowCapabilityBindings(activeCompany);
  const businessLead = activeCompany
    ? findBusinessLead(activeCompany, activeWorkspaceWorkItem?.ownerActorId ?? null)
    : null;
  const workflowCapabilityBindings = useMemo<ResolvedWorkflowCapabilityBinding[]>(
    () =>
      resolveWorkflowCapabilityBindings({
        bindings: workflowCapabilityBindingCatalog,
        workItem: activeWorkspaceWorkItem,
        apps: workspaceApps,
        skills: skillDefinitions,
      }),
    [activeWorkspaceWorkItem, skillDefinitions, workflowCapabilityBindingCatalog, workspaceApps],
  );
  const closeoutSummary = useMemo(
    () =>
      buildCapabilityPlatformCloseoutSummary({
        workspaceApps,
        workspaceFiles,
        skillDefinitions,
        skillRuns,
        capabilityRequests,
        capabilityIssues,
        capabilityAuditEvents,
        executorProvisioning,
      }),
    [
      capabilityAuditEvents,
      capabilityIssues,
      capabilityRequests,
      executorProvisioning,
      skillDefinitions,
      skillRuns,
      workspaceApps,
      workspaceFiles,
    ],
  );
  const closeoutUpdatedAt = useMemo(
    () =>
      Math.max(
        activeCompany?.createdAt ?? 0,
        executorProvisioning?.updatedAt ?? 0,
        ...workspaceFiles.map((file) => file.updatedAtMs ?? 0),
        ...skillDefinitions.map((skill) => skill.updatedAt),
        ...skillRuns.map((run) => run.updatedAt),
        ...capabilityRequests.map((request) => request.updatedAt),
        ...capabilityIssues.map((issue) => issue.updatedAt),
        ...capabilityAuditEvents.map((event) => event.updatedAt),
      ),
    [
      activeCompany?.createdAt,
      capabilityAuditEvents,
      capabilityIssues,
      capabilityRequests,
      executorProvisioning?.updatedAt,
      skillDefinitions,
      skillRuns,
      workspaceFiles,
    ],
  );
  const closeoutSnapshot = useMemo(
    () =>
      activeCompany
        ? buildCapabilityPlatformCloseoutSnapshot({
            summary: closeoutSummary,
            updatedAt: closeoutUpdatedAt,
          })
        : null,
    [activeCompany, closeoutSummary, closeoutUpdatedAt],
  );

  useEffect(() => {
    if (!activeCompanyId || !selectedApp?.id || !selectedAppUsesEmbeddedHost) {
      setEmbeddedAppSnapshot(loadWorkspaceEmbeddedAppSnapshot(null, null));
      return;
    }
    setEmbeddedAppSnapshot(loadWorkspaceEmbeddedAppSnapshot(activeCompanyId, selectedApp.id));
  }, [activeCompanyId, selectedApp?.id, selectedAppUsesEmbeddedHost]);

  useEffect(() => {
    if (!activeCompanyId || !selectedApp?.id || !selectedAppUsesEmbeddedHost) {
      return;
    }
    saveWorkspaceEmbeddedAppSnapshot(activeCompanyId, selectedApp.id, embeddedAppSnapshot);
  }, [activeCompanyId, embeddedAppSnapshot, selectedApp?.id, selectedAppUsesEmbeddedHost]);

  useEffect(() => {
    if (!selectedAppUsesEmbeddedHost || !selectedEmbeddedRuntime) {
      return;
    }
    if (!isWorkspaceEmbeddedAppSnapshotEqual(embeddedAppSnapshot, selectedEmbeddedRuntime.snapshot)) {
      setEmbeddedAppSnapshot(selectedEmbeddedRuntime.snapshot);
    }
    if (selectedFileKey !== selectedEmbeddedRuntime.selectedFileKey) {
      setSelectedFileKey(selectedEmbeddedRuntime.selectedFileKey);
    }
  }, [embeddedAppSnapshot, selectedAppUsesEmbeddedHost, selectedEmbeddedRuntime, selectedFileKey]);

  useEffect(() => {
    if (!activeCompany || !closeoutSnapshot) {
      return;
    }
    if (isCapabilityPlatformCloseoutSnapshotEqual(activeCompany.system?.platformCloseout ?? null, closeoutSnapshot)) {
      return;
    }
    void updateCompany({
      system: {
        ...(activeCompany.system ?? {}),
        platformCloseout: closeoutSnapshot,
      },
    });
  }, [activeCompany, closeoutSnapshot, updateCompany]);

  useEffect(() => {
    if (!activeCompanyId || !selectedApp) {
      return;
    }
    setReaderSnapshot((current) => {
      const next = withWorkspaceSelection(current, {
        selectedAppId: selectedApp.id,
        selectedKnowledgeId,
      });
      saveWorkspaceReaderSnapshot(activeCompanyId, next);
      return next;
    });
  }, [activeCompanyId, selectedApp, selectedKnowledgeId]);

  useEffect(() => {
    if (!activeCompanyId || !selectedFile?.key) {
      return;
    }
    setReaderSnapshot((current) => {
      const next = recordWorkspaceFileVisit(current, selectedFile.key);
      saveWorkspaceReaderSnapshot(activeCompanyId, next);
      return next;
    });
  }, [activeCompanyId, selectedFile?.key]);

  if (!activeCompany) {
    return <div className="p-8 text-center text-muted-foreground">未选择正在运营的公司组织</div>;
  }

  if (workspaceApps.length === 0) {
    return (
      <div className="p-8">
        <Card className="mx-auto max-w-2xl">
          <CardHeader>
            <CardTitle>当前公司还没有专属工作目录</CardTitle>
            <CardDescription>
              这家公司暂时没有启用公司级 workspace 应用。后续可以按公司类型继续扩展。
            </CardDescription>
          </CardHeader>
        </Card>
      </div>
    );
  }

  const writeWorkspaceApps = async (nextApps: typeof workspaceApps) => {
    await updateCompany({ workspaceApps: nextApps });
  };

  const writeWorkflowCapabilityBindings = async (nextBindings: typeof workflowCapabilityBindingCatalog) => {
    await updateCompany({ workflowCapabilityBindings: nextBindings });
  };

  const {
    createCapabilityIssueDraft,
    createCapabilityRequestDraft,
    generateAppManifestDraftById,
    openCtoWorkbench,
    publishRecommendedApps,
    publishTemplateApp,
    publishWorkflowCapabilityBindings,
    registerExistingAppFromManifest,
    restoreWorkflowCapabilityBindings,
    retryActiveCompanyProvisioning,
    runAppManifestAction,
    runSkillSmokeTest,
    toggleWorkflowCapabilityBindingRequired,
    triggerSkillFromManifest,
    updateCapabilityIssueStatus,
    updateCapabilityRequestStatus,
    updateSkillStatus,
    upsertSkillDraft,
  } = useWorkspacePageActions({
    activeCompany,
    activeWorkspaceWorkItem,
    businessLead,
    capabilityIssues,
    capabilityRequests,
    ctoEmployee,
    embeddedAppSnapshot,
    navigate,
    prefillSequenceRef,
    primaryRegisterableAppManifest,
    registerableAppManifestCandidates,
    retryCompanyProvisioning,
    selectedApp,
    selectedAppManifest,
    selectedAppUsesEmbeddedHost,
    selectedEmbeddedSectionSlot,
    selectedFile,
    setEmbeddedAppSnapshot,
    setSelectedAppId,
    setSelectedFileKey,
    skillDefinitions,
    skillRuns,
    upsertArtifactRecord,
    upsertCapabilityAuditEvent,
    upsertCapabilityIssue,
    upsertCapabilityRequest,
    upsertSkillDefinition,
    upsertSkillRun,
    workspaceAppManifestsById,
    workspaceApps,
    workspaceFiles,
    workflowCapabilityBindingCatalog,
    writeWorkflowCapabilityBindings,
    writeWorkspaceApps,
  });

  const selectEmbeddedSection = (slot: string) => {
    const nextFiles = selectedEmbeddedSectionFiles.get(slot) ?? [];
    setEmbeddedAppSnapshot((current) =>
      withWorkspaceEmbeddedAppSelection(current, {
        activeSectionSlot: slot,
        selectedFileKey: nextFiles[0]?.key ?? current.selectedFileKey,
      }),
    );
    if (nextFiles[0]) {
      setSelectedFileKey(nextFiles[0].key);
    }
  };

  const selectEmbeddedFile = (fileKey: string) => {
    setSelectedFileKey(fileKey);
    setEmbeddedAppSnapshot((current) =>
      withWorkspaceEmbeddedAppSelection(current, {
        selectedFileKey: fileKey,
      }),
    );
  };

  return (
    <WorkspacePageContent
      activeCompanyName={activeCompany.name}
      workspaceApps={workspaceApps}
      workspaceAppsAreExplicit={workspaceAppsAreExplicit}
      selectedApp={selectedApp}
      selectedAppManifest={selectedAppManifest}
      selectedFile={selectedFile}
      selectedFileKey={selectedFileKey}
      selectedFileContent={selectedFileContent}
      loadingFileKey={loadingFileKey}
      embeddedRuntime={selectedEmbeddedRuntime}
      activeWorkspaceWorkItem={
        activeWorkspaceWorkItem
          ? {
              id: activeWorkspaceWorkItem.id,
              title: activeWorkspaceWorkItem.title,
              displayOwnerLabel: activeWorkspaceWorkItem.displayOwnerLabel,
              ownerLabel: activeWorkspaceWorkItem.ownerLabel,
              displayStage: activeWorkspaceWorkItem.displayStage,
              stageLabel: activeWorkspaceWorkItem.stageLabel,
              displayNextAction: activeWorkspaceWorkItem.displayNextAction,
              nextAction: activeWorkspaceWorkItem.nextAction,
            }
          : null
      }
      artifactBackedWorkspaceCount={artifactBackedWorkspaceCount}
      mirroredOnlyWorkspaceCount={mirroredOnlyWorkspaceCount}
      shouldSyncProviderWorkspace={shouldSyncProviderWorkspace}
      workspacePolicySummary={workspacePolicySummary}
      chapterFiles={chapterFiles}
      canonFiles={canonFiles}
      reviewFiles={reviewFiles}
      readerIndex={readerIndex}
      readerManifest={readerManifest}
      knowledgeFiles={knowledgeFiles}
      knowledgeItems={knowledgeItems}
      selectedKnowledgeItem={selectedKnowledgeItem}
      selectedKnowledgeSourceFiles={selectedKnowledgeSourceFiles}
      toolingFiles={toolingFiles}
      supplementaryFiles={supplementaryFiles}
      workspaceFiles={workspaceFiles}
      anchors={anchors}
      workflowCapabilityBindingCatalog={workflowCapabilityBindingCatalog}
      workflowCapabilityBindingsAreExplicit={workflowCapabilityBindingsAreExplicit}
      workflowCapabilityBindings={workflowCapabilityBindings}
      skillDefinitions={skillDefinitions}
      skillRuns={skillRuns}
      capabilityRequests={capabilityRequests}
      capabilityIssues={capabilityIssues}
      capabilityAuditEvents={capabilityAuditEvents}
      manifestRegistrationCandidateCount={registerableAppManifestCandidates.length}
      ctoLabel={ctoEmployee ? agentLabelById.get(ctoEmployee.agentId) ?? ctoEmployee.agentId : null}
      businessLeadLabel={businessLead?.nickname ?? activeWorkspaceWorkItem?.displayOwnerLabel ?? null}
      publishedAppTemplates={publishedAppTemplates}
      loadingIndex={loadingIndex}
      executorProvisioning={executorProvisioning}
      onRefreshIndex={refreshIndex}
      onRetryCompanyProvisioning={retryActiveCompanyProvisioning}
      onRunAppManifestAction={runAppManifestAction}
      onSelectApp={(nextAppId) => {
        setSelectedAppId(nextAppId);
        setSelectedFileKey(null);
      }}
      onSelectFile={setSelectedFileKey}
      onSelectEmbeddedSection={selectEmbeddedSection}
      onSelectEmbeddedFile={selectEmbeddedFile}
      onSelectKnowledge={(knowledgeId) => {
        setSelectedKnowledgeId(knowledgeId);
        setSelectedFileKey(null);
      }}
      onOpenCtoWorkbench={openCtoWorkbench}
      onPublishTemplateApp={publishTemplateApp}
      onRegisterExistingApp={registerExistingAppFromManifest}
      onGenerateAppManifestDraft={generateAppManifestDraftById}
      onCreateSkillDraft={upsertSkillDraft}
      onCreateCapabilityRequest={createCapabilityRequestDraft}
      onCreateCapabilityIssue={createCapabilityIssueDraft}
      onUpdateSkillStatus={updateSkillStatus}
      onRunSkillSmokeTest={runSkillSmokeTest}
      onTriggerSkill={triggerSkillFromManifest}
      onPublishWorkflowCapabilityBindings={publishWorkflowCapabilityBindings}
      onRestoreWorkflowCapabilityBindings={restoreWorkflowCapabilityBindings}
      onToggleWorkflowCapabilityBindingRequired={toggleWorkflowCapabilityBindingRequired}
      onUpdateCapabilityRequestStatus={updateCapabilityRequestStatus}
      onUpdateCapabilityIssueStatus={updateCapabilityIssueStatus}
      onPublishRecommendedApps={workspaceAppsAreExplicit ? undefined : publishRecommendedApps}
      onOpenRequirementCenter={activeWorkspaceWorkItem ? () => navigate("/requirement") : undefined}
      onOpenFileChat={(nextAgentId) => navigate(`/chat/${encodeURIComponent(nextAgentId)}`)}
      onOpenCtoChat={() => {
        if (ctoEmployee) {
          navigate(`/chat/${encodeURIComponent(ctoEmployee.agentId)}`);
        }
      }}
    />
  );
}
