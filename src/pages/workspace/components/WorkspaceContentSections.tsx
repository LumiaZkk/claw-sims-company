import { ArrowUpRight } from "lucide-react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { formatKnowledgeKindLabel } from "../../../application/artifact/shared-knowledge";
import {
  RESOURCE_KIND_LABEL,
  formatWorkspaceBytes,
  formatWorkspaceFileKindLabel,
  isWorkspaceReaderManifestDraft,
  type WorkspaceFileRow,
  type WorkspaceWorkbenchTool,
} from "../../../application/workspace";
import { cn, formatTime } from "../../../lib/utils";
import { Badge } from "../../../ui/badge";
import { Button } from "../../../ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "../../../ui/card";
import type {
  WorkspaceAnchor,
  WorkspacePageContentProps,
} from "./workspace-page-types";

export function WorkspaceReaderSection({
  activeWorkspaceWorkItem,
  chapterFiles,
  canonFiles,
  reviewFiles,
  readerIndex,
  readerManifest,
  supplementaryFiles,
  selectedFile,
  selectedFileKey,
  selectedFileContent,
  loadingFileKey,
  onSelectFile,
  onOpenFileChat,
  onGenerateAppManifestDraft,
}: Pick<
  WorkspacePageContentProps,
  | "activeWorkspaceWorkItem"
  | "chapterFiles"
  | "canonFiles"
  | "reviewFiles"
  | "readerIndex"
  | "readerManifest"
  | "supplementaryFiles"
  | "selectedFile"
  | "selectedFileKey"
  | "selectedFileContent"
  | "loadingFileKey"
  | "onSelectFile"
  | "onOpenFileChat"
  | "onGenerateAppManifestDraft"
>) {
  const readerManifestIsDraft = isWorkspaceReaderManifestDraft(readerManifest);
  const readerManifestSourceLabel =
    readerManifest?.sourceLabel &&
    (!readerManifestIsDraft || readerManifest.sourceLabel !== "系统草案")
      ? readerManifest.sourceLabel
      : null;

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
      <Card className="xl:col-span-2 border-slate-200/80 shadow-sm">
        <CardHeader>
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <CardTitle className="text-base">阅读索引</CardTitle>
              <CardDescription>记住你上次看到哪，顺手把最近值得回看的内容放到前面。</CardDescription>
            </div>
            <div className="flex flex-wrap gap-2">
              {readerManifest ? (
                <>
                  <Badge variant={readerManifestIsDraft ? "secondary" : "default"}>
                    {readerManifestIsDraft ? "索引草案已接入" : "索引已接入"}
                  </Badge>
                  {readerManifestIsDraft ? <Badge variant="outline">待 CTO 校准</Badge> : null}
                  {readerManifestSourceLabel ? <Badge variant="outline">{readerManifestSourceLabel}</Badge> : null}
                </>
              ) : (
                <Badge variant="secondary">尚未接入 AppManifest</Badge>
              )}
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-3 md:grid-cols-4">
            <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-4">
              <div className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">正文</div>
              <div className="mt-2 text-2xl font-semibold text-slate-950">{chapterFiles.length}</div>
            </div>
            <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-4">
              <div className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">设定</div>
              <div className="mt-2 text-2xl font-semibold text-slate-950">{canonFiles.length}</div>
            </div>
            <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-4">
              <div className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">报告</div>
              <div className="mt-2 text-2xl font-semibold text-slate-950">{reviewFiles.length}</div>
            </div>
            <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-4">
              <div className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">上次阅读</div>
              <div className="mt-2 truncate text-sm font-semibold text-slate-950">
                {readerIndex.lastOpenedFile?.name ?? "还没有记录"}
              </div>
              <div className="mt-1 text-xs text-slate-500">
                {readerIndex.lastOpenedFile
                  ? `${formatWorkspaceFileKindLabel(readerIndex.lastOpenedFile)} · 继续打开`
                  : "第一次进入时会自动记录"}
              </div>
            </div>
          </div>
          <div className="grid gap-4 lg:grid-cols-2">
            <div className="space-y-2">
              <div className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">最近阅读</div>
              {readerIndex.recentFiles.length > 0 ? (
                <div className="flex flex-wrap gap-2">
                  {readerIndex.recentFiles.map((file) => (
                    <Button key={file.key} type="button" variant="outline" size="sm" onClick={() => onSelectFile(file.key)}>
                      {file.name}
                    </Button>
                  ))}
                </div>
              ) : (
                <div className="text-sm text-slate-500">还没有最近阅读记录。</div>
              )}
            </div>
            <div className="space-y-2">
              <div className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">最近更新</div>
              {readerIndex.latestUpdatedFiles.length > 0 ? (
                <div className="space-y-2">
                  {readerIndex.latestUpdatedFiles.map((file) => (
                    <button
                      key={file.key}
                      type="button"
                      onClick={() => onSelectFile(file.key)}
                      className="flex w-full items-center justify-between rounded-xl border border-slate-200 bg-white px-3 py-3 text-left hover:bg-slate-50"
                    >
                      <div className="min-w-0">
                        <div className="truncate text-sm font-semibold text-slate-950">{file.name}</div>
                        <div className="mt-1 text-xs text-slate-500">
                          {formatWorkspaceFileKindLabel(file)} · {formatTime(file.updatedAtMs)}
                        </div>
                      </div>
                      <ArrowUpRight className="h-4 w-4 shrink-0 text-slate-400" />
                    </button>
                  ))}
                </div>
              ) : (
                <div className="text-sm text-slate-500">
                  {readerManifest ? "索引已经接入，但当前还没有命中的可读产物。" : "还没有可展示的最近更新。"}
                </div>
              )}
            </div>
          </div>
          {readerManifestIsDraft ? (
            <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm leading-6 text-amber-950">
              <div>
                当前接入的是系统自动生成的阅读索引草案，已经先把候选设定和报告接进来了，但正文、设定、报告的映射仍建议由 CTO 校准
                <code className="mx-1 rounded bg-white/80 px-1 py-0.5 text-xs">workspace-app-manifest.reader.json</code>
                ，避免复杂项目里的系统文件继续混进主阅读视图。
              </div>
              <div className="mt-3 flex flex-wrap gap-2">
                <Button type="button" size="sm" variant="outline" onClick={() => void onGenerateAppManifestDraft()}>
                  重新生成草案
                </Button>
              </div>
            </div>
          ) : !readerManifest ? (
            <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm leading-6 text-amber-950">
              <div>
                当前阅读器仍主要靠文件名分类。要让复杂项目里的任意文档稳定进入阅读器，请让 CTO 产出
                <code className="mx-1 rounded bg-white/80 px-1 py-0.5 text-xs">workspace-app-manifest.reader.json</code>
                并把正文、设定、报告显式声明进去。
              </div>
              <div className="mt-3 flex flex-wrap gap-2">
                <Button type="button" size="sm" onClick={() => void onGenerateAppManifestDraft()}>
                  生成阅读器 AppManifest 草案
                </Button>
              </div>
            </div>
          ) : null}
        </CardContent>
      </Card>
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
                  ? `${selectedFile.agentLabel} · ${selectedFile.role} · ${
                      selectedFile.artifactId ? "产品产物" : "补充来源"
                    }`
                  : "从左侧挑一份正文、设定或审校报告，直接在页面里阅读。"}
              </CardDescription>
            </div>
            {selectedFile && (
              <div className="flex flex-wrap items-center gap-2 text-xs text-slate-500">
                <Badge variant="secondary">{formatWorkspaceFileKindLabel(selectedFile)}</Badge>
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

export function WorkspaceKnowledgeHub({
  knowledgeItems,
  selectedKnowledgeItem,
  selectedKnowledgeSourceFiles,
  selectedFile,
  selectedFileContent,
  loadingFileKey,
  onSelectKnowledge,
  onSelectFile,
  onOpenFileChat,
}: Pick<
  WorkspacePageContentProps,
  | "knowledgeItems"
  | "selectedKnowledgeItem"
  | "selectedKnowledgeSourceFiles"
  | "selectedFile"
  | "selectedFileContent"
  | "loadingFileKey"
  | "onSelectKnowledge"
  | "onSelectFile"
  | "onOpenFileChat"
>) {
  const readingSelectedSource =
    selectedFile && selectedKnowledgeSourceFiles.some((file) => file.key === selectedFile.key)
      ? selectedFile
      : null;
  const knowledgeBody =
    readingSelectedSource
      ? selectedFileContent
      : selectedKnowledgeItem?.content ??
        selectedKnowledgeItem?.details ??
        selectedKnowledgeItem?.summary ??
        "";

  return (
    <div className="grid gap-5 xl:grid-cols-[300px_320px_minmax(0,1fr)]">
      <Card className="border-slate-200/80 shadow-sm">
        <CardHeader>
          <CardTitle className="text-base">知识卡片</CardTitle>
          <CardDescription>自动收口后的治理产物会先落成公司知识，再决定是否关联原始文件。</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          {knowledgeItems.map((item) => (
            <button
              key={item.id}
              type="button"
              onClick={() => onSelectKnowledge(item.id)}
              className={cn(
                "w-full rounded-2xl border px-4 py-4 text-left transition-colors",
                selectedKnowledgeItem?.id === item.id
                  ? "border-indigo-200 bg-indigo-50 text-indigo-950"
                  : "border-slate-200 bg-white hover:bg-slate-50",
              )}
            >
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="text-sm font-semibold">{item.title}</div>
                  <div className="mt-1 text-xs leading-5 text-slate-500">{item.summary}</div>
                </div>
                <Badge variant="secondary">{formatKnowledgeKindLabel(item.kind)}</Badge>
              </div>
              <div className="mt-3 flex flex-wrap gap-2 text-[11px] text-slate-500">
                <Badge variant="outline">自动入库</Badge>
                <Badge variant="outline">{item.sourceAgentId ?? "公司知识"}</Badge>
                {item.transport ? <Badge variant="outline">{item.transport}</Badge> : null}
              </div>
            </button>
          ))}
          {knowledgeItems.length === 0 ? (
            <div className="rounded-xl border border-dashed border-slate-200 bg-slate-50 px-4 py-6 text-sm text-slate-500">
              当前还没有自动沉淀出的公司知识。闭环同步后，HR / CTO / COO / CEO 的正式方案会出现在这里。
            </div>
          ) : null}
        </CardContent>
      </Card>

      <Card className="border-slate-200/80 shadow-sm">
        <CardHeader>
          <CardTitle className="text-base">来源产物</CardTitle>
          <CardDescription>优先显示与当前知识卡片绑定的原始方案文件；没有文件时直接回看自动收口正文。</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          {selectedKnowledgeSourceFiles.map((file) => (
            <button
              key={file.key}
              type="button"
              onClick={() => onSelectFile(file.key)}
              className={cn(
                "w-full rounded-xl border px-3 py-3 text-left transition-colors",
                selectedFile?.key === file.key
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
          {selectedKnowledgeSourceFiles.length === 0 ? (
            <div className="rounded-xl border border-dashed border-slate-200 bg-slate-50 px-4 py-6 text-sm text-slate-500">
              当前知识卡片没有可直接打开的源文件，正文将直接显示自动收口内容。
            </div>
          ) : null}
        </CardContent>
      </Card>

      <Card className="border-slate-200/80 shadow-sm">
        <CardHeader className="border-b border-slate-100">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <CardTitle className="text-base">
                {readingSelectedSource?.name ?? selectedKnowledgeItem?.title ?? "选择一条知识卡片"}
              </CardTitle>
              <CardDescription className="mt-1">
                {readingSelectedSource
                  ? `${readingSelectedSource.agentLabel} · ${readingSelectedSource.role} · 原始来源`
                  : "这里直接显示自动验收后的知识正文，并保留来源链路。"}
              </CardDescription>
            </div>
            {selectedKnowledgeItem ? (
              <div className="flex flex-wrap items-center gap-2 text-xs text-slate-500">
                <Badge variant="secondary">{formatKnowledgeKindLabel(selectedKnowledgeItem.kind)}</Badge>
                <Badge variant="outline">自动入库</Badge>
                {selectedKnowledgeItem.transport ? (
                  <Badge variant="outline">{selectedKnowledgeItem.transport}</Badge>
                ) : null}
                <span>{formatTime(selectedKnowledgeItem.updatedAt)}</span>
                {selectedKnowledgeItem.sourceAgentId ? (
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    onClick={() => onOpenFileChat(selectedKnowledgeItem.sourceAgentId)}
                  >
                    打开 {selectedKnowledgeItem.sourceAgentId} 会话
                  </Button>
                ) : null}
              </div>
            ) : null}
          </div>
        </CardHeader>
        <CardContent className="min-h-[560px] p-0">
          {readingSelectedSource && loadingFileKey === readingSelectedSource.key ? (
            <div className="flex h-full min-h-[560px] items-center justify-center text-sm text-slate-500">
              正在读取 {readingSelectedSource.name}...
            </div>
          ) : knowledgeBody.trim().length > 0 ? (
            <div className="h-full overflow-auto px-6 py-6">
              <article className="prose prose-slate max-w-none prose-headings:font-semibold prose-p:text-slate-700">
                <ReactMarkdown remarkPlugins={[remarkGfm]}>{knowledgeBody}</ReactMarkdown>
              </article>
            </div>
          ) : (
            <div className="flex h-full min-h-[560px] items-center justify-center px-6 text-center text-sm text-slate-500">
              选择一条知识卡片后，这里会展示正文、来源和自动验收结果。
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

type WorkspaceConsistencyHubProps = {
  anchors: WorkspaceAnchor[];
  chapterFiles: WorkspaceFileRow[];
  reviewFiles: WorkspaceFileRow[];
  toolingFiles: WorkspaceFileRow[];
  onOpenCtoWorkbench: (tool: WorkspaceWorkbenchTool) => void;
  onOpenNovelReader: () => void;
};

export function WorkspaceConsistencyHub({
  anchors,
  chapterFiles,
  reviewFiles,
  toolingFiles,
  onOpenCtoWorkbench,
  onOpenNovelReader,
}: WorkspaceConsistencyHubProps) {
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
            <CardDescription>主体内容</CardDescription>
            <CardTitle>{chapterFiles.length} 份可读内容</CardTitle>
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
                    {anchor.found
                      ? "已经在当前公司 workspace 中找到对应文件。"
                      : "当前还没有稳定的唯一真相源文件。"}
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
            <CardDescription>如果你要把这家公司做成真正可运营的工作平台，下一步优先级应该这样排。</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm leading-6 text-slate-700">
              先把关键参考资料、状态流转和交接依据做成可检索的唯一真相源，再把对应能力需求正式交给 CTO 技术中台。
            </div>
            <Button type="button" className="w-full" onClick={() => onOpenCtoWorkbench("consistency-checker")}>
              发起规则校验能力需求
            </Button>
            <Button type="button" variant="outline" className="w-full" onClick={onOpenNovelReader}>
              先去内容查看 App 对照关键文件
            </Button>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
