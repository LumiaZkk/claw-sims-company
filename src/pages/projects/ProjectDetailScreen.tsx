import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { buildRequirementScope } from "../../application/mission/requirement-scope";
import { buildRequirementRoomHrefFromRecord } from "../../application/delegation/room-routing";
import { useMissionBoardQuery } from "../../application/mission";
import { toast } from "../../system/toast-store";
import { Badge } from "../../ui/badge";
import { Button } from "../../ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "../../ui/card";
import { ActionFormDialog } from "../../ui/action-form-dialog";
import { getCompanyProject, patchCompanyProject } from "../../application/gateway/authority-client";
import type { ProjectArchiveSummary, ProjectRecord, ProjectStatus } from "../../domain/project/types";
import {
  formatTimestamp,
  parseMultilineList,
  resolveAcceptanceStatusLabel,
  resolveProjectPriorityLabel,
  resolveProjectStatusBadgeVariant,
  resolveProjectStatusLabel,
  resolveRequirementLifecycleLabel,
  resolveTaskStepProgress,
  resolveWorkItemStatusLabel,
} from "./project-utils";

export function ProjectDetailScreen() {
  const navigate = useNavigate();
  const params = useParams();
  const {
    activeCompany,
    activeRequirementAggregates,
    activeWorkItems,
    activeRoomRecords,
    activeArtifacts,
    activeDispatches,
    activeSupportRequests,
    activeEscalations,
    activeDecisionTickets,
    activeRoundRecords,
  } = useMissionBoardQuery();
  const projectId = params.id ?? "";
  const [project, setProject] = useState<ProjectRecord | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [editBusy, setEditBusy] = useState(false);
  const [archiveDialogOpen, setArchiveDialogOpen] = useState(false);
  const [archiveBusy, setArchiveBusy] = useState(false);

  const refetch = async () => {
    if (!activeCompany || !projectId) {
      setProject(null);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const response = await getCompanyProject(activeCompany.id, projectId);
      setProject(response.project);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
      setProject(null);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void refetch();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeCompany?.id, projectId]);

  const patchProject = async (patch: Record<string, unknown>) => {
    if (!activeCompany || !projectId) {
      return;
    }
    const timestamp = Date.now();
    const res = await patchCompanyProject({
      companyId: activeCompany.id,
      projectId,
      patch: patch as never,
      timestamp,
    });
    setProject(res.project);
  };

  const statusActions: Array<{ status: ProjectStatus; label: string; variant?: "default" | "outline" | "secondary" | "destructive" }> = [
    { status: "active", label: "继续推进", variant: "default" },
    { status: "waiting_review", label: "进入验收", variant: "secondary" },
    { status: "completed", label: "标记完成", variant: "outline" },
    { status: "archived", label: "归档", variant: "outline" },
    { status: "canceled", label: "取消", variant: "destructive" },
  ];

  const linkedAggregate = useMemo(() => {
    if (!project) {
      return null;
    }
    if (project.requirementAggregateId) {
      return (
        activeRequirementAggregates.find((aggregate) => aggregate.id === project.requirementAggregateId) ??
        null
      );
    }
    if (project.workItemId) {
      return (
        activeRequirementAggregates.find((aggregate) => aggregate.workItemId === project.workItemId) ??
        null
      );
    }
    return null;
  }, [project, activeRequirementAggregates]);

  const linkedWorkItem = useMemo(() => {
    if (!project) {
      return null;
    }
    if (project.workItemId) {
      return activeWorkItems.find((item) => item.id === project.workItemId) ?? null;
    }
    if (linkedAggregate?.workItemId) {
      return activeWorkItems.find((item) => item.id === linkedAggregate.workItemId) ?? null;
    }
    return null;
  }, [project, activeWorkItems, linkedAggregate]);

  const linkedRoom = useMemo(() => {
    if (!project) {
      return null;
    }
    const roomId = project.roomId ?? linkedAggregate?.roomId ?? null;
    if (!roomId) {
      return null;
    }
    return activeRoomRecords.find((room) => room.id === roomId) ?? null;
  }, [project, linkedAggregate, activeRoomRecords]);

  const requirementScope = useMemo(() => {
    if (!activeCompany || !linkedWorkItem) {
      return null;
    }
    return buildRequirementScope(activeCompany, null, linkedWorkItem);
  }, [activeCompany, linkedWorkItem]);

  const projectDispatches = useMemo(() => {
    if (!linkedWorkItem && !linkedRoom) {
      return [];
    }
    return activeDispatches
      .filter((dispatch) => {
        if (linkedWorkItem && dispatch.workItemId === linkedWorkItem.id) {
          return true;
        }
        if (linkedRoom && dispatch.roomId === linkedRoom.id) {
          return true;
        }
        return false;
      })
      .sort((left, right) => right.updatedAt - left.updatedAt);
  }, [activeDispatches, linkedWorkItem, linkedRoom]);

  const projectDecisionTickets = useMemo(() => {
    if (!linkedWorkItem && !linkedAggregate) {
      return [];
    }
    return activeDecisionTickets
      .filter((ticket) => {
        if (linkedWorkItem && ticket.workItemId === linkedWorkItem.id) {
          return true;
        }
        if (linkedAggregate && ticket.aggregateId === linkedAggregate.id) {
          return true;
        }
        return false;
      })
      .sort((left, right) => right.updatedAt - left.updatedAt);
  }, [activeDecisionTickets, linkedWorkItem, linkedAggregate]);

  const projectSupportRequests = useMemo(() => {
    if (!linkedWorkItem) {
      return [];
    }
    return activeSupportRequests
      .filter((request) => request.workItemId === linkedWorkItem.id)
      .sort((left, right) => right.updatedAt - left.updatedAt);
  }, [activeSupportRequests, linkedWorkItem]);

  const projectEscalations = useMemo(() => {
    if (!linkedWorkItem) {
      return [];
    }
    return activeEscalations
      .filter((request) => request.workItemId === linkedWorkItem.id)
      .sort((left, right) => right.updatedAt - left.updatedAt);
  }, [activeEscalations, linkedWorkItem]);

  const projectArtifacts = useMemo(() => {
    if (!project) {
      return [];
    }
    return activeArtifacts
      .filter((artifact) => artifact.projectId === project.id)
      .sort((left, right) => right.updatedAt - left.updatedAt);
  }, [activeArtifacts, project]);

  const projectRounds = useMemo(() => {
    if (!linkedWorkItem && !linkedAggregate) {
      return [];
    }
    return activeRoundRecords
      .filter((round) => {
        if (linkedWorkItem && round.workItemId === linkedWorkItem.id) {
          return true;
        }
        if (linkedAggregate && round.aggregateId === linkedAggregate.id) {
          return true;
        }
        return false;
      })
      .sort((left, right) => right.updatedAt - left.updatedAt);
  }, [activeRoundRecords, linkedWorkItem, linkedAggregate]);

  const roomMemberCount = linkedRoom?.participants?.length ?? 0;
  const roomRoute = linkedRoom ? buildRequirementRoomHrefFromRecord(linkedRoom) : null;
  const runStatus = linkedWorkItem?.status ?? linkedAggregate?.status ?? null;
  const acceptanceStatus = linkedWorkItem?.acceptanceStatus ?? null;

  if (!projectId) {
    return <div className="p-6 text-sm text-muted-foreground">未提供项目 ID。</div>;
  }

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-start justify-between gap-4">
        <div className="space-y-2">
          <button
            type="button"
            onClick={() => navigate("/projects")}
            className="text-xs text-muted-foreground hover:text-foreground"
          >
            {"<- 返回项目列表"}
          </button>
          <div className="text-2xl font-bold tracking-tight">{project?.title ?? "项目详情"}</div>
          {project ? (
            <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
              <span>ID: {project.id}</span>
              <span>创建: {formatTimestamp(project.createdAt)}</span>
              <span>更新: {formatTimestamp(project.updatedAt)}</span>
              <span>关闭: {formatTimestamp(project.closedAt)}</span>
              <span>归档: {formatTimestamp(project.archivedAt)}</span>
            </div>
          ) : null}
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" onClick={() => void refetch()} disabled={loading}>
            刷新
          </Button>
          <Button variant="secondary" onClick={() => setEditDialogOpen(true)} disabled={!project}>
            编辑项目
          </Button>
          <Button variant="outline" onClick={() => setArchiveDialogOpen(true)} disabled={!project}>
            归档总结
          </Button>
        </div>
      </div>

      {error ? <div className="text-sm text-red-600">加载失败：{error}</div> : null}

      {!project ? (
        <div className="text-sm text-muted-foreground">正在加载项目详情...</div>
      ) : (
        <>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <div>
                <CardTitle>项目概览</CardTitle>
                <div className="mt-1 text-sm text-muted-foreground">当前状态与基础信息。</div>
              </div>
              <div className="flex flex-wrap gap-2">
                <Badge variant={resolveProjectStatusBadgeVariant(project.status)}>
                  {resolveProjectStatusLabel(project.status)}
                </Badge>
                <Badge variant="outline">优先级: {resolveProjectPriorityLabel(project.priority)}</Badge>
              </div>
            </CardHeader>
            <CardContent className="space-y-4 text-sm">
              <div className="grid gap-4 md:grid-cols-2">
                <div>
                  <div className="text-xs text-muted-foreground">目标</div>
                  <div className="mt-1">{project.goal || "未填写"}</div>
                </div>
                <div>
                  <div className="text-xs text-muted-foreground">摘要</div>
                  <div className="mt-1">{project.summary || "未填写"}</div>
                </div>
              </div>
              <div className="flex flex-wrap gap-3 text-xs text-muted-foreground">
                <span>负责人: {project.ownerLabel || "未指定"}</span>
                <span>ownerActorId: {project.ownerActorId || "—"}</span>
                <span>成员: {project.participantActorIds?.length ?? 0}</span>
                <span>tagIds: {project.tagIds?.length ?? 0}</span>
              </div>
              <div className="flex flex-wrap gap-2">
                {statusActions.map((action) => (
                  <Button
                    key={action.status}
                    size="sm"
                    variant={action.variant ?? "outline"}
                    onClick={() =>
                      void patchProject({ status: action.status })
                        .then(() => {
                          toast.success("状态已更新", `已切换为「${resolveProjectStatusLabel(action.status)}」。`);
                        })
                        .catch((err) =>
                          toast.error("更新失败", err instanceof Error ? err.message : String(err)),
                        )
                    }
                  >
                    {action.label}
                  </Button>
                ))}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>执行态摘要</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 text-sm">
              <div className="flex flex-wrap gap-2">
                <Badge variant="outline">run: {resolveRequirementLifecycleLabel(runStatus)}</Badge>
                <Badge variant="secondary">验收: {resolveAcceptanceStatusLabel(acceptanceStatus)}</Badge>
                <Badge variant="outline">scope: {requirementScope?.scopeLabel ?? "未匹配"}</Badge>
              </div>
              <div className="flex flex-wrap gap-3 text-xs text-muted-foreground">
                <span>开始: {formatTimestamp(linkedAggregate?.startedAt ?? linkedWorkItem?.startedAt)}</span>
                <span>当前阶段: {linkedAggregate?.stage ?? linkedWorkItem?.stage ?? "—"}</span>
                <span>Owner: {linkedAggregate?.ownerLabel ?? linkedWorkItem?.ownerLabel ?? "—"}</span>
              </div>
              {linkedWorkItem ? (
                <div className="text-xs text-muted-foreground">
                  workItem: {linkedWorkItem.id} · {resolveWorkItemStatusLabel(linkedWorkItem.status)}
                </div>
              ) : null}
            </CardContent>
          </Card>

          <div className="grid gap-6 lg:grid-cols-[1.05fr_0.95fr]">
            <Card>
              <CardHeader>
                <CardTitle>关联 Work Item</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3 text-sm">
                {!linkedWorkItem ? (
                  <div className="text-sm text-muted-foreground">暂无绑定 Work Item。</div>
                ) : (
                  <div className="space-y-2">
                    <div className="font-semibold">{linkedWorkItem.title || "未命名任务"}</div>
                    <div className="text-muted-foreground">{linkedWorkItem.goal || linkedWorkItem.summary}</div>
                    <div className="flex flex-wrap gap-2 text-xs text-muted-foreground">
                      <span>状态: {resolveWorkItemStatusLabel(linkedWorkItem.status)}</span>
                      <span>owner: {linkedWorkItem.ownerLabel ?? "未指定"}</span>
                      <span>成员: {linkedWorkItem.participantActorIds?.length ?? 0}</span>
                    </div>
                    {linkedWorkItem.activeTasks?.length ? (
                      <div className="space-y-2">
                        <div className="text-xs font-semibold text-muted-foreground">任务进度</div>
                        {linkedWorkItem.activeTasks.map((task) => (
                          <div key={task.id} className="rounded-lg border bg-card px-3 py-2 text-xs">
                            <div className="font-semibold">{task.title || "未命名任务"}</div>
                            <div className="text-muted-foreground">{task.summary || "暂无描述"}</div>
                            <div className="mt-1 flex flex-wrap gap-2 text-muted-foreground">
                              <span>进度: {resolveTaskStepProgress(task)} · 状态: {task.state ?? "unknown"}</span>
                              <span>Owner: {task.ownerLabel ?? "—"}</span>
                            </div>
                          </div>
                        ))}
                      </div>
                    ) : null}
                  </div>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>关联 Room</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3 text-sm">
                {!linkedRoom ? (
                  <div className="text-sm text-muted-foreground">暂无关联 Room。</div>
                ) : (
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <div className="font-semibold">{linkedRoom.title || linkedRoom.id}</div>
                      {roomRoute ? (
                        <Button size="sm" variant="outline" asChild>
                          <Link to={roomRoute}>进入对话</Link>
                        </Button>
                      ) : null}
                    </div>
                    <div className="text-xs text-muted-foreground">
                      状态: {linkedRoom.status} · 成员: {roomMemberCount} · 更新: {formatTimestamp(linkedRoom.updatedAt)}
                    </div>
                    {linkedRoom.summary ? (
                      <div className="rounded-lg border bg-card px-3 py-2 text-xs">
                        <div className="font-semibold">摘要</div>
                        <div className="mt-1 text-muted-foreground">{linkedRoom.summary}</div>
                      </div>
                    ) : null}
                  </div>
                )}
              </CardContent>
            </Card>
          </div>

          <Card>
            <CardHeader>
              <CardTitle>协作编排</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4 text-sm">
              <div className="grid gap-4 md:grid-cols-2">
                <div>
                  <div className="text-xs text-muted-foreground">派单记录</div>
                  {projectDispatches.length === 0 ? (
                    <div className="text-sm text-muted-foreground">暂无派单记录。</div>
                  ) : (
                    <div className="space-y-2">
                      {projectDispatches.map((dispatch) => (
                        <div key={dispatch.id} className="rounded-lg border bg-card px-3 py-2 text-xs">
                          <div className="font-semibold">{dispatch.title}</div>
                          <div className="text-muted-foreground">{dispatch.summary || "暂无描述"}</div>
                          <div className="mt-1 text-muted-foreground">
                            状态: {dispatch.status} · 更新: {formatTimestamp(dispatch.updatedAt)}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
                <div>
                  <div className="text-xs text-muted-foreground">验收决策</div>
                  {projectDecisionTickets.length === 0 ? (
                    <div className="text-sm text-muted-foreground">暂无验收决策。</div>
                  ) : (
                    <div className="space-y-2">
                      {projectDecisionTickets.map((ticket) => (
                        <div key={ticket.id} className="rounded-lg border bg-card px-3 py-2 text-xs">
                          <div className="font-semibold">{ticket.title}</div>
                          <div className="text-muted-foreground">{ticket.summary || "暂无摘要"}</div>
                          <div className="mt-1 text-muted-foreground">
                            状态: {ticket.status} · 更新: {formatTimestamp(ticket.updatedAt)}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
              <div className="grid gap-4 md:grid-cols-2">
                <div>
                  <div className="text-xs text-muted-foreground">支持请求</div>
                  {projectSupportRequests.length === 0 ? (
                    <div className="text-sm text-muted-foreground">暂无支持请求。</div>
                  ) : (
                    <div className="space-y-2">
                      {projectSupportRequests.map((request) => (
                        <div key={request.id} className="rounded-lg border bg-card px-3 py-2 text-xs">
                          <div className="font-semibold">{request.title}</div>
                          <div className="text-muted-foreground">{request.summary || "暂无摘要"}</div>
                          <div className="mt-1 text-muted-foreground">
                            状态: {request.status} · 更新: {formatTimestamp(request.updatedAt)}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
                <div>
                  <div className="text-xs text-muted-foreground">升级记录</div>
                  {projectEscalations.length === 0 ? (
                    <div className="text-sm text-muted-foreground">暂无升级记录。</div>
                  ) : (
                    <div className="space-y-2">
                      {projectEscalations.map((request) => (
                        <div key={request.id} className="rounded-lg border bg-card px-3 py-2 text-xs">
                          <div className="font-semibold">{request.title}</div>
                          <div className="text-muted-foreground">{request.summary || "暂无摘要"}</div>
                          <div className="mt-1 text-muted-foreground">
                            状态: {request.status} · 更新: {formatTimestamp(request.updatedAt)}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>

          <div className="grid gap-6 lg:grid-cols-[1.1fr_0.9fr]">
            <Card>
              <CardHeader>
                <CardTitle>产物库</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3 text-sm">
                {projectArtifacts.length === 0 ? (
                  <div className="text-sm text-muted-foreground">暂无项目产物。</div>
                ) : (
                  <div className="space-y-2">
                    {projectArtifacts.map((artifact) => (
                      <div key={artifact.id} className="rounded-lg border bg-card px-3 py-2 text-xs">
                        <div className="font-semibold">{artifact.title || artifact.id}</div>
                        <div className="text-muted-foreground">{artifact.summary || "暂无摘要"}</div>
                        <div className="mt-1 text-muted-foreground">
                          类型: {artifact.kind} · 状态: {artifact.status} · 更新: {formatTimestamp(artifact.updatedAt)}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Round 归档</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3 text-sm">
                {projectRounds.length === 0 ? (
                  <div className="text-sm text-muted-foreground">暂无 Round 记录。</div>
                ) : (
                  <div className="space-y-2">
                    {projectRounds.map((round) => (
                      <div key={round.id} className="rounded-lg border bg-card px-3 py-2 text-xs">
                        <div className="font-semibold">{round.title || round.id}</div>
                        <div className="text-muted-foreground">
                          {round.preview ?? "暂无摘要"} · 归档: {formatTimestamp(round.archivedAt)}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </>
      )}

      <ActionFormDialog
        open={editDialogOpen}
        title="编辑项目"
        description="调整项目标题、目标、负责人等信息。"
        confirmLabel={editBusy ? "保存中..." : "保存"}
        busy={editBusy}
        onOpenChange={(open) => setEditDialogOpen(open)}
        fields={[
          { name: "title", label: "标题", placeholder: project?.title ?? "", required: true },
          { name: "goal", label: "目标", placeholder: project?.goal ?? "", required: true, multiline: true },
          { name: "summary", label: "摘要", placeholder: project?.summary ?? "", multiline: true },
          { name: "ownerLabel", label: "负责人显示名", placeholder: project?.ownerLabel ?? "" },
          { name: "ownerActorId", label: "负责人 ActorId", placeholder: project?.ownerActorId ?? "" },
        ]}
        onSubmit={async (values) => {
          if (!project) {
            return;
          }
          setEditBusy(true);
          try {
            await patchProject({
              title: values.title,
              goal: values.goal,
              summary: values.summary,
              ownerLabel: values.ownerLabel,
              ownerActorId: values.ownerActorId || null,
            });
            toast.success("已更新项目", "项目基础信息已保存。");
            setEditDialogOpen(false);
          } catch (err) {
            toast.error("保存失败", err instanceof Error ? err.message : String(err));
          } finally {
            setEditBusy(false);
          }
        }}
      />

      <ActionFormDialog
        open={archiveDialogOpen}
        title="项目归档总结"
        description="记录项目的目标、交付、决策与复用入口，方便后续回溯。"
        confirmLabel={archiveBusy ? "保存中..." : "保存归档摘要"}
        busy={archiveBusy}
        onOpenChange={(open) => setArchiveDialogOpen(open)}
        fields={[
          { name: "goalSummary", label: "目标总结", placeholder: project?.archiveSummary?.goalSummary ?? "", multiline: true },
          { name: "deliverySummary", label: "交付总结", placeholder: project?.archiveSummary?.deliverySummary ?? "", multiline: true },
          { name: "decisionSummary", label: "关键决策", placeholder: project?.archiveSummary?.decisionSummary ?? "", multiline: true },
          { name: "blockerSummary", label: "阻塞/风险", placeholder: project?.archiveSummary?.blockerSummary ?? "", multiline: true },
          { name: "evidenceAnchors", label: "证据锚点（一行一个）", placeholder: project?.archiveSummary?.evidenceAnchors?.join("\n") ?? "", multiline: true },
          { name: "reusableLinks", label: "可复用链接（一行一个）", placeholder: project?.archiveSummary?.reusableLinks?.join("\n") ?? "", multiline: true },
        ]}
        onSubmit={async (values) => {
          if (!project) {
            return;
          }
          setArchiveBusy(true);
          try {
            const archiveSummary: ProjectArchiveSummary = {
              goalSummary: values.goalSummary,
              deliverySummary: values.deliverySummary,
              decisionSummary: values.decisionSummary,
              blockerSummary: values.blockerSummary,
              evidenceAnchors: parseMultilineList(values.evidenceAnchors),
              reusableLinks: parseMultilineList(values.reusableLinks),
              createdAt: project.archiveSummary?.createdAt ?? Date.now(),
              updatedAt: Date.now(),
            };
            await patchProject({
              archiveSummary,
              archivedAt: Date.now(),
              status: "archived",
            });
            toast.success("归档已更新", "项目归档摘要已保存。");
            setArchiveDialogOpen(false);
          } catch (err) {
            toast.error("归档失败", err instanceof Error ? err.message : String(err));
          } finally {
            setArchiveBusy(false);
          }
        }}
      />

      {project?.archiveSummary ? (
        <Card>
          <CardHeader>
            <CardTitle>归档摘要</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            <div className="text-xs text-muted-foreground">
              创建: {formatTimestamp(project.archiveSummary.createdAt)} · 更新: {formatTimestamp(project.archiveSummary.updatedAt)}
            </div>
            <div>
              <div className="text-xs text-muted-foreground">目标总结</div>
              <div className="mt-1">{project.archiveSummary.goalSummary || "未填写"}</div>
            </div>
            <div>
              <div className="text-xs text-muted-foreground">交付总结</div>
              <div className="mt-1">{project.archiveSummary.deliverySummary || "未填写"}</div>
            </div>
            <div>
              <div className="text-xs text-muted-foreground">关键决策</div>
              <div className="mt-1">{project.archiveSummary.decisionSummary || "未填写"}</div>
            </div>
            <div>
              <div className="text-xs text-muted-foreground">阻塞/风险</div>
              <div className="mt-1">{project.archiveSummary.blockerSummary || "未填写"}</div>
            </div>
          </CardContent>
        </Card>
      ) : null}
    </div>
  );
}
