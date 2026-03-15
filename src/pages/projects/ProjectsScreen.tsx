import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useMissionBoardQuery } from "../../application/mission";
import { toast } from "../../system/toast-store";
import { Badge } from "../../ui/badge";
import { Button } from "../../ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "../../ui/card";
import { ActionFormDialog } from "../../ui/action-form-dialog";
import { createCompanyProject, listCompanyProjects } from "../../application/gateway/authority-client";
import type { ProjectRecord } from "../../domain/project/types";
import {
  buildProjectSearchCorpus,
  filterProjects,
  formatTimestamp,
  normalizeFilterText,
  resolveProjectFilterTimestamp,
  resolveProjectPriorityLabel,
  resolveProjectStatusBadgeVariant,
  resolveProjectStatusLabel,
  type ProjectTab,
  type ProjectTimeRange,
} from "./project-utils";

export function ProjectsScreen() {
  const navigate = useNavigate();
  const {
    activeCompany,
    primaryRequirementId,
    activeRequirementAggregates,
    activeWorkItems,
  } = useMissionBoardQuery();
  const [projects, setProjects] = useState<ProjectRecord[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [tab, setTab] = useState<ProjectTab>("active");
  const [searchText, setSearchText] = useState("");
  const [ownerFilter, setOwnerFilter] = useState("");
  const [timeRange, setTimeRange] = useState<ProjectTimeRange>("all");
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [createBusy, setCreateBusy] = useState(false);

  const primaryAggregate =
    (primaryRequirementId
      ? activeRequirementAggregates.find((agg) => agg.id === primaryRequirementId)
      : null) ??
    activeRequirementAggregates.find((agg) => agg.primary) ??
    null;
  const primaryWorkItem =
    primaryAggregate?.workItemId
      ? activeWorkItems.find((item) => item.id === primaryAggregate.workItemId) ?? null
      : null;

  const refetch = async () => {
    if (!activeCompany) {
      setProjects([]);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const response = await listCompanyProjects(activeCompany.id);
      setProjects(response.projects);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void refetch();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeCompany?.id]);

  const tabCounts = useMemo(() => {
    const counts: Record<ProjectTab, number> = {
      active: 0,
      waiting_review: 0,
      completed: 0,
      archived: 0,
      canceled: 0,
      all: projects.length,
    };
    for (const project of projects) {
      switch (project.status) {
        case "draft":
        case "active":
          counts.active += 1;
          break;
        case "waiting_review":
          counts.waiting_review += 1;
          break;
        case "completed":
          counts.completed += 1;
          break;
        case "archived":
          counts.archived += 1;
          break;
        case "canceled":
          counts.canceled += 1;
          break;
        default:
          break;
      }
    }
    return counts;
  }, [projects]);

  const ownerOptions = useMemo(() => {
    const options = new Set<string>();
    projects.forEach((project) => {
      if (project.ownerLabel?.trim()) {
        options.add(project.ownerLabel.trim());
      }
    });
    return Array.from(options).sort((a, b) => a.localeCompare(b));
  }, [projects]);

  const visibleProjects = useMemo(() => {
    const filteredProjects = filterProjects(projects, tab);
    const searchValue = normalizeFilterText(searchText);
    const ownerValue = normalizeFilterText(ownerFilter);
    const cutoff =
      timeRange === "all" ? null : Date.now() - Number(timeRange) * 24 * 60 * 60 * 1000;
    return filteredProjects.filter((project) => {
      if (searchValue && !buildProjectSearchCorpus(project).includes(searchValue)) {
        return false;
      }
      if (ownerValue && !normalizeFilterText(project.ownerLabel || "").includes(ownerValue)) {
        return false;
      }
      if (cutoff) {
        const timestamp = resolveProjectFilterTimestamp(project);
        if (!timestamp || timestamp < cutoff) {
          return false;
        }
      }
      return true;
    });
  }, [projects, tab, searchText, ownerFilter, timeRange]);

  const hasFilters =
    normalizeFilterText(searchText).length > 0 ||
    normalizeFilterText(ownerFilter).length > 0 ||
    timeRange !== "all";

  const createFromPrimaryRequirement = async () => {
    if (!activeCompany || !primaryAggregate) {
      toast.warning("缺少主线需求", "请先在需求中心固化一条主线需求，再创建项目。");
      return;
    }
    setCreateBusy(true);
    try {
      const title =
        primaryWorkItem?.title ||
        primaryAggregate.stage ||
        (primaryAggregate.topicKey ? `项目 · ${primaryAggregate.topicKey}` : "未命名项目");
      const goal = primaryWorkItem?.goal || primaryAggregate.summary || "";
      const summary = primaryAggregate.summary || primaryWorkItem?.summary || "";
      const res = await createCompanyProject({
        companyId: activeCompany.id,
        title,
        goal,
        summary,
        status: "active",
        priority: "medium",
        ownerActorId: primaryAggregate.ownerActorId,
        ownerLabel: primaryAggregate.ownerLabel,
        participantActorIds: primaryAggregate.memberIds ?? [],
        requirementAggregateId: primaryAggregate.id,
        workItemId: primaryAggregate.workItemId,
        roomId: primaryAggregate.roomId,
        tagIds: [],
      });
      toast.success("项目已创建", "已把主线需求提升为可追踪的 ProjectRecord。");
      await refetch();
      navigate(`/projects/${encodeURIComponent(res.project.id)}`);
    } catch (err) {
      toast.error("创建项目失败", err instanceof Error ? err.message : String(err));
    } finally {
      setCreateBusy(false);
    }
  };

  const canCreateFromPrimary = Boolean(activeCompany && primaryAggregate);

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <div className="text-2xl font-bold tracking-tight">项目追踪与归档</div>
          <div className="mt-1 text-sm text-muted-foreground">
            Project 是生命周期容器，用于人类与 AI 员工共同维护目标、进度、验收与归档摘要。
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" onClick={() => void refetch()} disabled={loading}>
            刷新
          </Button>
          <Button onClick={() => setCreateDialogOpen(true)} disabled={!activeCompany}>
            新建项目
          </Button>
        </div>
      </div>

      <ActionFormDialog
        open={createDialogOpen}
        title="新建项目"
        description="建议在主线需求明确后创建项目，以便后续验收与归档能稳定回看。"
        confirmLabel={createBusy ? "创建中..." : "创建"}
        busy={createBusy}
        fields={[
          { name: "title", label: "标题", placeholder: "例如：一致性底座与内部审阅系统", required: true },
          { name: "goal", label: "目标", placeholder: "一句话描述目标", required: true, multiline: true },
          { name: "summary", label: "摘要", placeholder: "当前背景、范围与边界", multiline: true },
        ]}
        onOpenChange={(open) => setCreateDialogOpen(open)}
        onSubmit={async (values) => {
          if (!activeCompany) {
            return;
          }
          setCreateBusy(true);
          try {
            const res = await createCompanyProject({
              companyId: activeCompany.id,
              title: values.title,
              goal: values.goal,
              summary: values.summary,
              status: "draft",
              priority: "medium",
              ownerActorId: null,
              ownerLabel: "待分配",
              participantActorIds: [],
              requirementAggregateId: null,
              workItemId: null,
              roomId: null,
              tagIds: [],
            });
            toast.success("项目已创建", "已创建草稿项目，可以继续绑定主线需求并推进执行。");
            setCreateDialogOpen(false);
            await refetch();
            navigate(`/projects/${encodeURIComponent(res.project.id)}`);
          } catch (err) {
            toast.error("创建项目失败", err instanceof Error ? err.message : String(err));
          } finally {
            setCreateBusy(false);
          }
        }}
      />

      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <div>
            <CardTitle>从主线需求创建项目</CardTitle>
            <div className="mt-1 text-sm text-muted-foreground">
              需求中心/Board 更像当前执行态投影，项目对象用于承接完整生命周期与归档复用。
            </div>
          </div>
          <Button onClick={() => void createFromPrimaryRequirement()} disabled={!canCreateFromPrimary || createBusy}>
            {createBusy ? "处理中..." : "提升为项目"}
          </Button>
        </CardHeader>
        <CardContent className="space-y-2">
          {!activeCompany ? (
            <div className="text-sm text-muted-foreground">未选择正在运营的公司组织</div>
          ) : !primaryAggregate ? (
            <div className="text-sm text-muted-foreground">
              当前没有主线需求。先去 <Link className="underline" to="/requirement">需求中心</Link> 固化一条主线，再回来创建项目。
            </div>
          ) : (
            <div className="text-sm">
              <div className="font-semibold">{primaryWorkItem?.title ?? primaryAggregate.stage}</div>
              <div className="mt-1 text-muted-foreground">
                {primaryWorkItem?.goal ?? primaryAggregate.summary}
              </div>
              <div className="mt-2 flex flex-wrap gap-2">
                <Badge variant="secondary">requirement: {primaryAggregate.id}</Badge>
                {primaryAggregate.workItemId ? <Badge variant="outline">workItem: {primaryAggregate.workItemId}</Badge> : null}
                {primaryAggregate.roomId ? <Badge variant="outline">room: {primaryAggregate.roomId}</Badge> : null}
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="space-y-4">
          <div className="flex flex-wrap items-center gap-2">
            <Button size="sm" variant={tab === "active" ? "default" : "outline"} onClick={() => setTab("active")}>
              进行中 ({tabCounts.active})
            </Button>
            <Button size="sm" variant={tab === "waiting_review" ? "default" : "outline"} onClick={() => setTab("waiting_review")}>
              待验收 ({tabCounts.waiting_review})
            </Button>
            <Button size="sm" variant={tab === "completed" ? "default" : "outline"} onClick={() => setTab("completed")}>
              已完成 ({tabCounts.completed})
            </Button>
            <Button size="sm" variant={tab === "archived" ? "default" : "outline"} onClick={() => setTab("archived")}>
              已归档 ({tabCounts.archived})
            </Button>
            <Button size="sm" variant={tab === "canceled" ? "default" : "outline"} onClick={() => setTab("canceled")}>
              已取消 ({tabCounts.canceled})
            </Button>
            <Button size="sm" variant={tab === "all" ? "default" : "outline"} onClick={() => setTab("all")}>
              全部 ({tabCounts.all})
            </Button>
          </div>
          <div className="grid gap-3 md:grid-cols-[minmax(0,1fr)_180px_180px_auto] md:items-end">
            <label className="block text-sm">
              <div className="mb-1 text-xs text-muted-foreground">关键词</div>
              <input
                value={searchText}
                onChange={(event) => setSearchText(event.target.value)}
                placeholder="搜索标题、目标、摘要、ID 或归档内容"
                className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none transition focus:border-indigo-500"
              />
            </label>
            <label className="block text-sm">
              <div className="mb-1 text-xs text-muted-foreground">负责人</div>
              <input
                list="project-owner-options"
                value={ownerFilter}
                onChange={(event) => setOwnerFilter(event.target.value)}
                placeholder="筛选负责人标签"
                className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none transition focus:border-indigo-500"
              />
              <datalist id="project-owner-options">
                {ownerOptions.map((option) => (
                  <option key={option} value={option} />
                ))}
              </datalist>
            </label>
            <label className="block text-sm">
              <div className="mb-1 text-xs text-muted-foreground">时间范围</div>
              <select
                value={timeRange}
                onChange={(event) => setTimeRange(event.target.value as ProjectTimeRange)}
                className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none transition focus:border-indigo-500"
              >
                <option value="all">全部</option>
                <option value="7">最近 7 天</option>
                <option value="30">最近 30 天</option>
                <option value="90">最近 90 天</option>
              </select>
            </label>
            <div className="flex md:justify-end">
              <Button
                size="sm"
                variant="outline"
                onClick={() => {
                  setSearchText("");
                  setOwnerFilter("");
                  setTimeRange("all");
                }}
                disabled={!hasFilters}
              >
                清除筛选
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {error ? (
            <div className="text-sm text-red-600">加载失败：{error}</div>
          ) : loading ? (
            <div className="text-sm text-muted-foreground">正在加载项目...</div>
          ) : visibleProjects.length === 0 ? (
            <div className="text-sm text-muted-foreground">
              {projects.length === 0 ? "当前没有项目记录。" : "没有符合筛选条件的项目。"}
            </div>
          ) : (
            <div className="space-y-3">
              {hasFilters ? (
                <div className="text-xs text-muted-foreground">筛选结果：{visibleProjects.length} 个项目</div>
              ) : null}
              {visibleProjects.map((project) => (
                <Link
                  key={project.id}
                  to={`/projects/${encodeURIComponent(project.id)}`}
                  className="block rounded-xl border bg-card hover:bg-accent/40 transition-colors"
                >
                  <div className="p-4">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <div className="font-semibold truncate">{project.title}</div>
                        <div className="mt-1 text-sm text-muted-foreground line-clamp-2">
                          {project.goal || project.summary || "未填写目标"}
                        </div>
                        {project.archiveSummary ? (
                          <div className="mt-2 text-xs text-muted-foreground line-clamp-2">
                            归档摘要：{project.archiveSummary.deliverySummary || project.archiveSummary.goalSummary}
                          </div>
                        ) : null}
                      </div>
                      <div className="flex flex-col items-end gap-2 shrink-0">
                        <Badge variant={resolveProjectStatusBadgeVariant(project.status)}>
                          {resolveProjectStatusLabel(project.status)}
                        </Badge>
                        <Badge variant="outline">优先级: {resolveProjectPriorityLabel(project.priority)}</Badge>
                      </div>
                    </div>
                    <div className="mt-3 flex flex-wrap gap-2 text-xs text-muted-foreground">
                      <span>更新: {formatTimestamp(project.updatedAt)}</span>
                      {project.ownerLabel ? <span>负责人: {project.ownerLabel}</span> : null}
                      {project.requirementAggregateId ? <span>requirement: {project.requirementAggregateId}</span> : null}
                      {project.workItemId ? <span>workItem: {project.workItemId}</span> : null}
                    </div>
                  </div>
                </Link>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
