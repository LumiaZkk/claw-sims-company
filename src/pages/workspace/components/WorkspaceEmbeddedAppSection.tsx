import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { Badge } from "../../../ui/badge";
import { Button } from "../../../ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "../../../ui/card";
import {
  formatWorkspaceFileKindLabel,
  type WorkspaceAppManifest,
  type WorkspaceAppManifestAction,
  type WorkspaceEmbeddedAppRuntime,
  type WorkspaceFileRow,
} from "../../../application/workspace";
import { cn, formatTime } from "../../../lib/utils";
import {
  resourceOriginLabel,
  type WorkspaceAppSummary,
} from "./workspace-page-types";

type WorkspaceEmbeddedAppSectionProps = {
  app: WorkspaceAppSummary;
  manifest: WorkspaceAppManifest | null;
  runtime: WorkspaceEmbeddedAppRuntime<WorkspaceFileRow> | null;
  selectedFileContent: string;
  loadingFileKey: string | null;
  onSelectEmbeddedSection: (slot: string) => void;
  onSelectEmbeddedFile: (fileKey: string) => void;
  onRunAppManifestAction: (action: WorkspaceAppManifestAction) => void | Promise<void>;
  onOpenCtoChat: () => void;
};

export function WorkspaceEmbeddedAppSection({
  app,
  manifest,
  runtime,
  selectedFileContent,
  loadingFileKey,
  onSelectEmbeddedSection,
  onSelectEmbeddedFile,
  onRunAppManifestAction,
  onOpenCtoChat,
}: WorkspaceEmbeddedAppSectionProps) {
  const sections = runtime?.sections ?? [];
  const activeSection = runtime?.activeSection ?? null;
  const activeSectionFiles = runtime?.visibleFiles ?? [];
  const totalScopedResources = runtime?.totalScopedResources ?? 0;
  const latestScopedFile = runtime?.latestFile ?? null;
  const lastAction = runtime?.lastAction ?? null;
  const selectedFile = runtime?.selectedFile ?? null;
  const hostMeta = runtime
    ? {
        title: runtime.hostTitle,
        description: runtime.hostDescription,
      }
    : {
        title: "嵌入式 App 宿主",
        description:
          "这个公司内 App 运行在受控宿主中，只能读取 manifest 范围内资源、保存轻量状态，并触发白名单动作。",
      };

  return (
    <Card className="border-slate-200/80 shadow-sm">
      <CardHeader>
        <CardTitle className="text-base">{hostMeta.title}</CardTitle>
        <CardDescription>{hostMeta.description}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex flex-wrap gap-2 text-xs text-slate-500">
          {!runtime || runtime.manifestStatus === "missing" ? <Badge variant="secondary">manifest 待接入</Badge> : null}
          {runtime?.manifestStatus === "bound" ? <Badge variant="outline">显式 manifest</Badge> : null}
          {runtime?.manifestStatus === "default" ? <Badge variant="secondary">默认 manifest</Badge> : null}
          {runtime ? <Badge variant="outline">host {runtime.hostKey}</Badge> : <Badge variant="outline">host 待配置</Badge>}
          {runtime ? <Badge variant="outline">动作 {runtime.permissions.actions}</Badge> : null}
          {runtime ? <Badge variant="outline">状态 {runtime.permissions.appState}</Badge> : null}
        </div>
        <div className="grid gap-3 md:grid-cols-4">
          <div className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-4">
            <div className="text-xs uppercase tracking-[0.18em] text-slate-500">分区</div>
            <div className="mt-2 text-2xl font-semibold text-slate-950">{sections.length}</div>
            <div className="mt-1 text-xs leading-5 text-slate-500">
              manifest 当前为 {app.title} 定义的交互区域。
            </div>
          </div>
          <div className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-4">
            <div className="text-xs uppercase tracking-[0.18em] text-slate-500">可读资源</div>
            <div className="mt-2 text-2xl font-semibold text-slate-950">{totalScopedResources}</div>
            <div className="mt-1 text-xs leading-5 text-slate-500">
              宿主只读取 manifest 范围内的资源，不直接扫全公司数据。
            </div>
          </div>
          <div className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-4">
            <div className="text-xs uppercase tracking-[0.18em] text-slate-500">最近动作</div>
            <div className="mt-2 text-sm font-semibold text-slate-950">{lastAction?.label ?? "尚未触发"}</div>
            <div className="mt-1 text-xs leading-5 text-slate-500">
              动作仍然走白名单桥接，不允许直接写公司主数据。
            </div>
          </div>
          <div className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-4">
            <div className="text-xs uppercase tracking-[0.18em] text-slate-500">最近更新</div>
            <div className="mt-2 text-sm font-semibold text-slate-950">{latestScopedFile?.name ?? "暂无"}</div>
            <div className="mt-1 text-xs leading-5 text-slate-500">
              {latestScopedFile
                ? `${latestScopedFile.agentLabel} · ${formatTime(latestScopedFile.updatedAtMs ?? 0)}`
                : "等资源进入这张 App 再展示。"}
            </div>
          </div>
        </div>

        {runtime ? (
          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
            {runtime.apis.map((api) => (
              <div key={api.id} className="rounded-xl border border-slate-200 bg-white px-4 py-4">
                <div className="text-sm font-semibold text-slate-950">{api.label}</div>
                <div className="mt-1 text-xs leading-5 text-slate-500">{api.description}</div>
              </div>
            ))}
          </div>
        ) : null}

        <div className="flex flex-wrap gap-2">
          {manifest?.actions?.map((action) => (
            <Button key={action.id} type="button" size="sm" variant="outline" onClick={() => void onRunAppManifestAction(action)}>
              {action.label}
            </Button>
          ))}
          <Button type="button" size="sm" variant="secondary" onClick={onOpenCtoChat}>
            打开 CTO 会话继续补齐
          </Button>
        </div>

        {sections.length > 0 ? (
          <div className="grid gap-4 xl:grid-cols-[240px_minmax(0,1fr)]">
            <div className="space-y-3">
              {sections.map((section) => {
                const files = section.files;
                const active = activeSection?.slot === section.slot;
                return (
                  <button
                    key={section.id}
                    type="button"
                    onClick={() => onSelectEmbeddedSection(section.slot)}
                    className={cn(
                      "w-full rounded-2xl border px-4 py-4 text-left transition-colors",
                      active
                        ? "border-indigo-200 bg-indigo-50 text-indigo-950"
                        : "border-slate-200 bg-white hover:bg-slate-50",
                    )}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <div className="text-sm font-semibold">{section.label}</div>
                        <div className="mt-1 text-xs leading-5 text-slate-500">
                          {files.length > 0
                            ? `当前有 ${files.length} 份资源进入这一区。`
                            : section.emptyState ?? "当前还没有资源进入这一分区。"}
                        </div>
                      </div>
                      <Badge variant={active ? "default" : "outline"}>{files.length}</Badge>
                    </div>
                  </button>
                );
              })}
            </div>

            <div className="grid gap-4 lg:grid-cols-[320px_minmax(0,1fr)]">
              <div className="rounded-2xl border border-slate-200 bg-white p-4">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <div className="text-sm font-semibold text-slate-950">{activeSection?.label ?? "资源列表"}</div>
                    <div className="mt-1 text-xs leading-5 text-slate-500">
                      {activeSectionFiles.length > 0
                        ? "切换资源后，右侧会直接显示当前内容，不需要离开工作目录。"
                        : activeSection?.emptyState ?? "当前还没有资源进入这个区域。"}
                    </div>
                  </div>
                  <Badge variant="outline">{activeSectionFiles.length}</Badge>
                </div>
                <div className="mt-4 space-y-2">
                  {activeSectionFiles.length > 0 ? (
                    activeSectionFiles.map((file) => (
                      <button
                        key={file.key}
                        type="button"
                        onClick={() => onSelectEmbeddedFile(file.key)}
                        className={cn(
                          "w-full rounded-xl border px-3 py-3 text-left transition-colors",
                          selectedFile?.key === file.key
                            ? "border-indigo-200 bg-indigo-50 text-indigo-950"
                            : "border-slate-200 bg-slate-50 hover:bg-slate-100",
                        )}
                      >
                        <div className="text-sm font-medium">{file.name}</div>
                        <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-slate-500">
                          <span>
                            {formatWorkspaceFileKindLabel(file)} · {file.agentLabel} · {formatTime(file.updatedAtMs ?? 0)}
                          </span>
                          {file.resourceOrigin === "inferred" ? (
                            <Badge variant="outline">{resourceOriginLabel[file.resourceOrigin]}</Badge>
                          ) : null}
                        </div>
                      </button>
                    ))
                  ) : (
                    <div className="rounded-xl border border-dashed border-slate-200 bg-slate-50 px-4 py-6 text-sm text-slate-500">
                      当前没有可读资源。等能力执行或业务团队把结果写回后，这里会直接出现。
                    </div>
                  )}
                </div>
              </div>

              <div className="rounded-2xl border border-slate-200 bg-white p-4">
                {selectedFile ? (
                  <div className="space-y-4">
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div>
                        <div className="text-base font-semibold text-slate-950">{selectedFile.name}</div>
                        <div className="mt-1 text-xs leading-5 text-slate-500">
                          {selectedFile.path} · {selectedFile.agentLabel}
                        </div>
                      </div>
                      <div className="flex flex-wrap gap-2">
                        <Badge variant="secondary">{formatWorkspaceFileKindLabel(selectedFile)}</Badge>
                        <Badge variant="outline">{selectedFile.resourceType}</Badge>
                        <Badge variant={selectedFile.resourceOrigin === "inferred" ? "outline" : "secondary"}>
                          {resourceOriginLabel[selectedFile.resourceOrigin]}
                        </Badge>
                      </div>
                    </div>
                    {selectedFile.resourceOrigin === "inferred" ? (
                      <div className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs leading-5 text-amber-950">
                        这份资源目前来自系统推断，只适合展示和草案生成；如果要用于正式检查、预检或流程判断，请先补显式标签或接入 AppManifest。
                      </div>
                    ) : null}
                    <div className="max-h-[560px] overflow-y-auto rounded-xl border border-slate-200 bg-slate-50 px-4 py-4">
                      {loadingFileKey === selectedFile.key ? (
                        <div className="text-sm text-slate-500">正在读取这份资源的正文...</div>
                      ) : selectedFileContent.trim().length > 0 ? (
                        <div className="prose prose-slate max-w-none prose-headings:scroll-mt-24 prose-pre:overflow-x-auto">
                          <ReactMarkdown remarkPlugins={[remarkGfm]}>{selectedFileContent}</ReactMarkdown>
                        </div>
                      ) : selectedFile.previewText ? (
                        <div className="text-sm leading-7 text-slate-700">{selectedFile.previewText}</div>
                      ) : (
                        <div className="text-sm text-slate-500">
                          这份资源当前还没有正文镜像，可先去来源文件或等待能力补全文本。
                        </div>
                      )}
                    </div>
                  </div>
                ) : (
                  <div className="rounded-xl border border-dashed border-slate-200 bg-slate-50 px-4 py-8 text-sm leading-6 text-slate-500">
                    当前还没有选中的资源。先从左侧分区挑一份报告、状态文件或数据结果。
                  </div>
                )}
              </div>
            </div>
          </div>
        ) : (
          <div className="rounded-xl border border-dashed border-slate-200 bg-slate-50 px-4 py-6 text-sm leading-6 text-slate-500">
            这张 App 还没有定义 manifest sections。先给它生成或校准 AppManifest，宿主才能知道该展示哪些资源。
          </div>
        )}
      </CardContent>
    </Card>
  );
}
