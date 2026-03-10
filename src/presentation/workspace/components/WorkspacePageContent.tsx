import {
  ArrowUpRight,
  BookOpen,
  BookOpenCheck,
  Compass,
  FileCode2,
  RefreshCcw,
  Wrench,
} from "lucide-react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { Badge } from "../../../components/ui/badge";
import { Button } from "../../../components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "../../../components/ui/card";
import {
  RESOURCE_KIND_LABEL,
  WORKBENCH_TOOL_CARDS,
  formatWorkspaceBytes,
  type WorkspaceFileRow,
  type WorkspaceWorkbenchTool,
} from "../../../application/workspace";
import { cn, formatTime } from "../../../lib/utils";

type WorkspaceAppSummary = {
  id: string;
  kind: string;
  icon: string;
  title: string;
  description: string;
  status: "ready" | "planned" | "recommended" | "building";
};

type WorkspaceAnchor = {
  id: string;
  label: string;
  found: boolean;
};

type WorkspacePageContentProps = {
  activeCompanyName: string;
  workspaceApps: WorkspaceAppSummary[];
  selectedApp: WorkspaceAppSummary;
  selectedFile: WorkspaceFileRow | null;
  selectedFileKey: string | null;
  selectedFileContent: string;
  loadingFileKey: string | null;
  activeWorkspaceWorkItem: {
    id: string;
    title: string;
    displayOwnerLabel: string;
    ownerLabel: string;
    displayStage: string;
    stageLabel: string;
    displayNextAction: string;
    nextAction: string;
  } | null;
  artifactBackedWorkspaceCount: number;
  mirroredOnlyWorkspaceCount: number;
  shouldSyncProviderWorkspace: boolean;
  chapterFiles: WorkspaceFileRow[];
  canonFiles: WorkspaceFileRow[];
  reviewFiles: WorkspaceFileRow[];
  toolingFiles: WorkspaceFileRow[];
  supplementaryFiles: WorkspaceFileRow[];
  workspaceFiles: WorkspaceFileRow[];
  anchors: WorkspaceAnchor[];
  ctoLabel: string | null;
  loadingIndex: boolean;
  onRefreshIndex: () => void;
  onSelectApp: (appId: string) => void;
  onSelectFile: (fileKey: string) => void;
  onOpenCtoWorkbench: (tool: WorkspaceWorkbenchTool) => void;
  onOpenFileChat: (agentId: string) => void;
  onOpenCtoChat: () => void;
  onOpenRequirementCenter?: () => void;
};

function WorkspaceReaderSection({
  activeWorkspaceWorkItem,
  chapterFiles,
  canonFiles,
  reviewFiles,
  supplementaryFiles,
  selectedFile,
  selectedFileKey,
  selectedFileContent,
  loadingFileKey,
  onSelectFile,
  onOpenFileChat,
}: Pick<
  WorkspacePageContentProps,
  | "activeWorkspaceWorkItem"
  | "chapterFiles"
  | "canonFiles"
  | "reviewFiles"
  | "supplementaryFiles"
  | "selectedFile"
  | "selectedFileKey"
  | "selectedFileContent"
  | "loadingFileKey"
  | "onSelectFile"
  | "onOpenFileChat"
>) {
  return (
    <div className="grid gap-5 xl:grid-cols-[320px_minmax(0,1fr)]">
      {activeWorkspaceWorkItem ? (
        <Card className="xl:col-span-2 border-indigo-200/70 bg-indigo-50/70 shadow-sm">
          <CardHeader className="gap-2">
            <CardDescription>当前工作项</CardDescription>
            <CardTitle className="text-base">{activeWorkspaceWorkItem.title}</CardTitle>
            <div className="flex flex-wrap items-center gap-2 text-xs text-slate-600">
              <Badge variant="secondary">
                负责人 {activeWorkspaceWorkItem.displayOwnerLabel || activeWorkspaceWorkItem.ownerLabel}
              </Badge>
              <Badge variant="secondary">
                当前阶段 {activeWorkspaceWorkItem.displayStage || activeWorkspaceWorkItem.stageLabel}
              </Badge>
              <Badge variant="secondary">
                下一步 {activeWorkspaceWorkItem.displayNextAction || activeWorkspaceWorkItem.nextAction}
              </Badge>
            </div>
          </CardHeader>
        </Card>
      ) : null}
      <Card className="border-slate-200/80 shadow-sm">
        <CardHeader>
          <CardTitle className="text-base">公司产物文档</CardTitle>
          <CardDescription>
            默认先看产品产物库里的正文、设定、审校报告和工具说明；后端文件镜像只作为补充来源。
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {([
            ["chapter", chapterFiles],
            ["canon", canonFiles],
            ["review", reviewFiles],
          ] as const).map(([kind, files]) => {
            if (files.length === 0) {
              return null;
            }
            return (
              <div key={kind} className="space-y-2">
                <div className="flex items-center justify-between">
                  <div className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
                    {RESOURCE_KIND_LABEL[kind]}
                  </div>
                  <Badge variant="secondary">{files.length}</Badge>
                </div>
                <div className="space-y-2">
                  {files.slice(0, 8).map((file) => (
                    <button
                      type="button"
                      key={file.key}
                      onClick={() => onSelectFile(file.key)}
                      className={cn(
                        "w-full rounded-xl border px-3 py-3 text-left transition-colors",
                        selectedFileKey === file.key
                          ? "border-indigo-200 bg-indigo-50 text-indigo-950"
                          : "border-slate-200 bg-white hover:bg-slate-50",
                      )}
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <div className="truncate text-sm font-semibold">{file.name}</div>
                          <div className="mt-1 text-xs leading-5 text-slate-500">
                            {file.agentLabel} · {file.role}
                          </div>
                        </div>
                        <ArrowUpRight className="mt-0.5 h-4 w-4 shrink-0 text-slate-400" />
                      </div>
                    </button>
                  ))}
                </div>
              </div>
            );
          })}
          {chapterFiles.length + canonFiles.length + reviewFiles.length === 0 && (
            <div className="rounded-xl border border-dashed border-slate-200 bg-slate-50 px-4 py-6 text-sm text-slate-500">
              当前产品产物库里还没有正文、设定或审校报告这类业务文档。先让 CTO/内容团队把可读产物固化下来，再回这里统一阅读。
            </div>
          )}
          {supplementaryFiles.length > 0 ? (
            <div className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-4 text-xs leading-6 text-slate-600">
              当前还有 {supplementaryFiles.length} 份工具/系统文档已收起，不再抢占阅读主视图。需要排查原始镜像时，再去“一致性中心”或“CTO 工具工坊”查看。
            </div>
          ) : null}
        </CardContent>
      </Card>

      <Card className="border-slate-200/80 shadow-sm">
        <CardHeader className="border-b border-slate-100">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <CardTitle className="text-base">{selectedFile?.name ?? "选择一份公司文档"}</CardTitle>
              <CardDescription className="mt-1">
                {selectedFile
                  ? `${selectedFile.agentLabel} · ${selectedFile.role} · ${selectedFile.artifactId ? "产品产物" : "补充来源"}`
                  : "从左侧挑一份正文、设定或审校报告，直接在页面里阅读。"}
              </CardDescription>
            </div>
            {selectedFile && (
              <div className="flex flex-wrap items-center gap-2 text-xs text-slate-500">
                <Badge variant="secondary">{RESOURCE_KIND_LABEL[selectedFile.kind]}</Badge>
                <span>{formatWorkspaceBytes(selectedFile.size)}</span>
                <span>{formatTime(selectedFile.updatedAtMs)}</span>
                <Button type="button" size="sm" variant="outline" onClick={() => onOpenFileChat(selectedFile.agentId)}>
                  打开 {selectedFile.agentLabel} 会话
                </Button>
              </div>
            )}
          </div>
        </CardHeader>
        <CardContent className="min-h-[560px] p-0">
          {!selectedFile ? (
            <div className="flex h-full min-h-[560px] items-center justify-center px-6 text-center text-sm text-slate-500">
              这里会直接显示当前公司的正文、设定和报告内容，让创作团队不用离开产品就能对照阅读。
            </div>
          ) : loadingFileKey === selectedFile.key ? (
            <div className="flex h-full min-h-[560px] items-center justify-center text-sm text-slate-500">
              正在读取 {selectedFile.name}...
            </div>
          ) : (
            <div className="h-full overflow-auto px-6 py-6">
              <article className="prose prose-slate max-w-none prose-headings:font-semibold prose-p:text-slate-700">
                <ReactMarkdown remarkPlugins={[remarkGfm]}>
                  {selectedFileContent || "*当前文件没有可展示的文本内容。*"}
                </ReactMarkdown>
              </article>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function WorkspaceConsistencyHub({
  anchors,
  chapterFiles,
  reviewFiles,
  toolingFiles,
  onOpenCtoWorkbench,
  onOpenNovelReader,
}: {
  anchors: WorkspaceAnchor[];
  chapterFiles: WorkspaceFileRow[];
  reviewFiles: WorkspaceFileRow[];
  toolingFiles: WorkspaceFileRow[];
  onOpenCtoWorkbench: (tool: WorkspaceWorkbenchTool) => void;
  onOpenNovelReader: () => void;
}) {
  return (
    <div className="space-y-5">
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <Card className="border-slate-200/80 shadow-sm">
          <CardHeader className="pb-3">
            <CardDescription>共享真相源</CardDescription>
            <CardTitle>{anchors.filter((anchor) => anchor.found).length}/4 已落盘</CardTitle>
          </CardHeader>
        </Card>
        <Card className="border-slate-200/80 shadow-sm">
          <CardHeader className="pb-3">
            <CardDescription>章节正文</CardDescription>
            <CardTitle>{chapterFiles.length} 份可读正文</CardTitle>
          </CardHeader>
        </Card>
        <Card className="border-slate-200/80 shadow-sm">
          <CardHeader className="pb-3">
            <CardDescription>审校与终审</CardDescription>
            <CardTitle>{reviewFiles.length} 份过程报告</CardTitle>
          </CardHeader>
        </Card>
        <Card className="border-slate-200/80 shadow-sm">
          <CardHeader className="pb-3">
            <CardDescription>工具脚本</CardDescription>
            <CardTitle>{toolingFiles.length} 份工具文件</CardTitle>
          </CardHeader>
        </Card>
      </div>

      <div className="grid gap-5 xl:grid-cols-[minmax(0,1.2fr)_360px]">
        <Card className="border-slate-200/80 shadow-sm">
          <CardHeader>
            <CardTitle className="text-base">一致性锚点</CardTitle>
            <CardDescription>先明确这家公司现在有哪些唯一真相源，哪些还缺位。</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {anchors.map((anchor) => (
              <div
                key={anchor.id}
                className={cn(
                  "flex items-center justify-between rounded-xl border px-4 py-3",
                  anchor.found
                    ? "border-emerald-200 bg-emerald-50 text-emerald-950"
                    : "border-amber-200 bg-amber-50 text-amber-950",
                )}
              >
                <div>
                  <div className="text-sm font-semibold">{anchor.label}</div>
                  <div className="mt-1 text-xs text-slate-600">
                    {anchor.found ? "已经在当前公司 workspace 中找到对应文件。" : "当前还没有稳定的唯一真相源文件。"}
                  </div>
                </div>
                <Badge variant={anchor.found ? "default" : "secondary"}>
                  {anchor.found ? "已具备" : "待补齐"}
                </Badge>
              </div>
            ))}
          </CardContent>
        </Card>

        <Card className="border-slate-200/80 shadow-sm">
          <CardHeader>
            <CardTitle className="text-base">下一步建议</CardTitle>
            <CardDescription>如果你要把这家公司做成真正可运营的创作系统，下一步优先级应该这样排。</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm leading-6 text-slate-700">
              先把共享设定库、时间线、伏笔追踪做成可检索的唯一真相源，再让 CTO 基于这些文件开发一致性工具。
            </div>
            <Button type="button" className="w-full" onClick={() => onOpenCtoWorkbench("consistency-checker")}>
              让 CTO 开发一致性工具
            </Button>
            <Button type="button" variant="outline" className="w-full" onClick={onOpenNovelReader}>
              先去小说阅读器查看关键文件
            </Button>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function WorkspaceWorkbench({
  onOpenCtoWorkbench,
}: Pick<WorkspacePageContentProps, "onOpenCtoWorkbench">) {
  return (
    <div className="grid gap-5 lg:grid-cols-3">
      {WORKBENCH_TOOL_CARDS.map((card) => (
        <Card key={card.id} className="border-slate-200/80 shadow-sm">
          <CardHeader className="space-y-3">
            <div className="flex items-center justify-between">
              <Badge variant="secondary">公司专属工具</Badge>
              <Wrench className="h-4 w-4 text-slate-400" />
            </div>
            <div>
              <CardTitle className="text-base">{card.title}</CardTitle>
              <CardDescription className="mt-2 leading-6">{card.summary}</CardDescription>
            </div>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm leading-6 text-slate-700">
              这次需求会带着当前公司的上下文和 workspace 诉求进入 CTO 会话，目标不是做通用工具，而是先服务这家公司。
            </div>
            <Button type="button" className="w-full" onClick={() => onOpenCtoWorkbench(card.id)}>
              去 CTO 会话带上需求
            </Button>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

export function WorkspacePageContent(props: WorkspacePageContentProps) {
  const {
    activeCompanyName,
    workspaceApps,
    selectedApp,
    artifactBackedWorkspaceCount,
    mirroredOnlyWorkspaceCount,
    shouldSyncProviderWorkspace,
    chapterFiles,
    canonFiles,
    ctoLabel,
    loadingIndex,
    onRefreshIndex,
    onSelectApp,
    onOpenCtoWorkbench,
    onOpenCtoChat,
    onOpenRequirementCenter,
  } = props;

  return (
    <div className="min-h-full bg-[radial-gradient(circle_at_top_left,_rgba(99,102,241,0.08),_transparent_34%),radial-gradient(circle_at_top_right,_rgba(16,185,129,0.08),_transparent_28%)] p-6 md:p-8">
      <div className="mx-auto max-w-7xl space-y-6">
        <Card className="overflow-hidden border-slate-200/80 shadow-sm">
          <CardContent className="grid gap-5 px-6 py-6 lg:grid-cols-[minmax(0,1fr)_340px]">
            <div className="space-y-4">
              <div className="flex flex-wrap items-center gap-2">
                <Badge variant="secondary">当前公司专属</Badge>
                <Badge variant="outline">只对 {activeCompanyName} 可见</Badge>
              </div>
              <div>
                <h2 className="text-2xl font-semibold tracking-tight text-slate-950">工作目录</h2>
                <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-600">
                  把当前公司的专属工具、产品产物和 CTO 工具需求收进一个页面里。对小说公司来说，这里就是阅读器、一致性中心和工具开发工坊的统一入口；底层工作区文件只作为补充镜像，不再是主真相源。
                </p>
              </div>
              <div className="flex flex-wrap gap-3">
                {onOpenRequirementCenter ? (
                  <Button type="button" variant="outline" onClick={onOpenRequirementCenter}>
                    <BookOpenCheck className="mr-2 h-4 w-4" />
                    返回需求中心
                  </Button>
                ) : null}
                <Button type="button" onClick={() => onOpenCtoWorkbench("consistency-checker")}>
                  让 CTO 开发一致性工具
                </Button>
                <Button type="button" variant="outline" onClick={() => onOpenCtoWorkbench("novel-reader")}>
                  让 CTO 开发小说阅读器
                </Button>
              </div>
            </div>

            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-1">
              <div className="rounded-2xl border border-slate-200 bg-white/80 px-4 py-4">
                <div className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">公司应用</div>
                <div className="mt-2 text-2xl font-semibold text-slate-950">{workspaceApps.length}</div>
                <div className="mt-1 text-sm text-slate-600">当前公司已经启用的专属菜单与工具入口。</div>
              </div>
              <div className="rounded-2xl border border-slate-200 bg-white/80 px-4 py-4">
                <div className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">产品产物索引</div>
                <div className="mt-2 text-2xl font-semibold text-slate-950">{artifactBackedWorkspaceCount}</div>
                <div className="mt-1 text-sm text-slate-600">
                  {shouldSyncProviderWorkspace
                    ? `当前可直接消费的产品产物 ${artifactBackedWorkspaceCount} 份；镜像补充 ${mirroredOnlyWorkspaceCount} 份，仅在产物缺位时兜底。`
                    : "当前后端不提供文件区，工作目录直接读取产品侧产物库。"}
                </div>
              </div>
              <div className="rounded-2xl border border-slate-200 bg-white/80 px-4 py-4">
                <div className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">当前可读业务文档</div>
                <div className="mt-2 text-2xl font-semibold text-slate-950">{chapterFiles.length + canonFiles.length}</div>
                <div className="mt-1 text-sm text-slate-600">
                  {chapterFiles.length + canonFiles.length > 0
                    ? "当前公司已经有可直接阅读的正文与设定文件。"
                    : "当前公司还没把正文/设定稳定固化进 workspace，这正是 CTO 下一步该补的能力。"}
                </div>
              </div>
              <div className="rounded-2xl border border-slate-200 bg-white/80 px-4 py-4">
                <div className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">当前 CTO</div>
                <div className="mt-2 text-lg font-semibold text-slate-950">{ctoLabel ?? "尚未配置"}</div>
                <div className="mt-1 text-sm text-slate-600">
                  {ctoLabel
                    ? `${ctoLabel} 负责公司专属工具方向。`
                    : "需要一个 CTO 节点来承接公司工具开发。"}
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        <div className="grid gap-6 xl:grid-cols-[300px_minmax(0,1fr)]">
          <Card className="border-slate-200/80 shadow-sm">
            <CardHeader>
              <CardTitle className="text-base">公司应用</CardTitle>
              <CardDescription>只显示当前公司的专属菜单和工具，不影响其他公司。</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              {workspaceApps.map((app) => (
                <button
                  type="button"
                  key={app.id}
                  onClick={() => onSelectApp(app.id)}
                  className={cn(
                    "w-full rounded-2xl border px-4 py-4 text-left transition-colors",
                    selectedApp.id === app.id
                      ? "border-indigo-200 bg-indigo-50 text-indigo-950"
                      : "border-slate-200 bg-white hover:bg-slate-50",
                  )}
                >
                  <div className="flex items-start gap-3">
                    <div className="mt-0.5 text-xl">{app.icon}</div>
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <div className="text-sm font-semibold">{app.title}</div>
                        <Badge variant={app.status === "ready" ? "default" : "secondary"}>
                          {app.status === "ready" ? "可直接使用" : "建议继续建设"}
                        </Badge>
                      </div>
                      <div className="mt-1 text-xs leading-5 text-slate-500">{app.description}</div>
                    </div>
                  </div>
                </button>
              ))}
              <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50 px-4 py-4 text-xs leading-6 text-slate-500">
                后续 CTO 为当前公司做出来的新工具，也应该继续挂在这里，而不是混进所有公司的公共菜单里。
              </div>
              <Button type="button" variant="outline" className="w-full" onClick={onOpenCtoChat} disabled={!ctoLabel}>
                直接打开 CTO 会话
              </Button>
            </CardContent>
          </Card>

          <div className="space-y-5">
            <Card className="border-slate-200/80 shadow-sm">
              <CardHeader className="pb-4">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <CardTitle className="flex items-center gap-2 text-lg">
                      {selectedApp.kind === "novel-reader" ? <BookOpen className="h-5 w-5" /> : null}
                      {selectedApp.kind === "consistency-hub" ? <Compass className="h-5 w-5" /> : null}
                      {selectedApp.kind === "cto-workbench" ? <FileCode2 className="h-5 w-5" /> : null}
                      {selectedApp.title}
                    </CardTitle>
                    <CardDescription className="mt-2 max-w-3xl leading-6">{selectedApp.description}</CardDescription>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <Badge variant="outline">产品产物优先</Badge>
                    <Badge variant="secondary">{artifactBackedWorkspaceCount} 份产物</Badge>
                    {shouldSyncProviderWorkspace && mirroredOnlyWorkspaceCount > 0 ? (
                      <Badge variant="outline">镜像补充 {mirroredOnlyWorkspaceCount}</Badge>
                    ) : null}
                    <Button type="button" size="sm" variant="outline" onClick={onRefreshIndex} disabled={loadingIndex}>
                      <RefreshCcw className={cn("mr-2 h-4 w-4", loadingIndex && "animate-spin")} />
                      刷新索引
                    </Button>
                  </div>
                </div>
              </CardHeader>
            </Card>

            {selectedApp.kind === "novel-reader" ? <WorkspaceReaderSection {...props} /> : null}
            {selectedApp.kind === "consistency-hub" ? (
              <WorkspaceConsistencyHub
                anchors={props.anchors}
                chapterFiles={props.chapterFiles}
                reviewFiles={props.reviewFiles}
                toolingFiles={props.toolingFiles}
                onOpenCtoWorkbench={props.onOpenCtoWorkbench}
                onOpenNovelReader={() => props.onSelectApp("novel-reader")}
              />
            ) : null}
            {selectedApp.kind === "cto-workbench" ? (
              <WorkspaceWorkbench onOpenCtoWorkbench={props.onOpenCtoWorkbench} />
            ) : null}
          </div>
        </div>
      </div>
    </div>
  );
}
