import { AlertTriangle, Key, MessageCircle, Plus, RefreshCw } from "lucide-react";
import type {
  GatewayConfigSnapshot,
  GatewayProviderConfig,
  GatewaySettingsCommandsResult,
  GatewaySettingsQueryResult,
  GatewayTelegramConfig,
} from "../../../application/gateway/settings";
import { Badge } from "../../../ui/badge";
import { Button } from "../../../ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "../../../ui/card";
import { formatTime } from "../../../lib/utils";
import type { RunCommand } from "./settings-helpers";

export function SettingsProvidersChannelsSection(props: {
  executorStatus: GatewaySettingsQueryResult["executorStatus"];
  executorConfig: GatewaySettingsQueryResult["executorConfig"];
  authorityHealth: GatewaySettingsQueryResult["authorityHealth"];
  configSnapshot: GatewayConfigSnapshot | null;
  codexModels: GatewaySettingsQueryResult["codexModels"];
  providerConfigs: Record<string, GatewayProviderConfig>;
  telegramConfig: GatewayTelegramConfig;
  loading: boolean;
  executorSaving: boolean;
  codexAuthorizing: boolean;
  codexImporting: boolean;
  codexRefreshing: boolean;
  addProviderSaving: boolean;
  syncingProvider: string | null;
  setExecutorDialogOpen: (open: boolean) => void;
  setAddProviderDialogOpen: (open: boolean) => void;
  setTelegramDialogOpen: (open: boolean) => void;
  updateProviderKey: (provider: string) => void;
  handleExecutorReconnect: GatewaySettingsCommandsResult["handleExecutorReconnect"];
  handleStartCodexOAuth: GatewaySettingsCommandsResult["handleStartCodexOAuth"];
  handleImportCodexAuth: GatewaySettingsCommandsResult["handleImportCodexAuth"];
  handleRefreshCodexModels: GatewaySettingsCommandsResult["handleRefreshCodexModels"];
  handleSyncModels: (
    providerName: string,
    config: GatewayProviderConfig,
  ) => Promise<{ title: string; description: string } | null>;
  runCommand: RunCommand;
}) {
  const {
    executorStatus,
    executorConfig,
    authorityHealth,
    configSnapshot,
    codexModels,
    providerConfigs,
    telegramConfig,
    loading,
    executorSaving,
    codexAuthorizing,
    codexImporting,
    codexRefreshing,
    syncingProvider,
    setExecutorDialogOpen,
    setAddProviderDialogOpen,
    setTelegramDialogOpen,
    updateProviderKey,
    handleExecutorReconnect,
    handleStartCodexOAuth,
    handleImportCodexAuth,
    handleRefreshCodexModels,
    handleSyncModels,
    runCommand,
  } = props;

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
      <Card className="shadow-sm border-indigo-100 flex flex-col">
        <CardHeader className="bg-indigo-50/30 pb-4 border-b">
          <CardTitle className="flex items-center justify-between text-lg text-indigo-900 w-full">
            <div className="flex items-center gap-2">
              <Key className="w-5 h-5 text-indigo-600" />
              计算引擎资源栈
            </div>
            <Button
              variant="ghost"
              size="sm"
              className="h-8 gap-1 text-indigo-700 bg-white"
              onClick={() => setAddProviderDialogOpen(true)}
            >
              <Plus className="w-4 h-4" /> 添加供应商
            </Button>
          </CardTitle>
          <CardDescription>按需调集各类大语言模型，并配发 API 执行令牌</CardDescription>
        </CardHeader>
        <CardContent className="pt-4 space-y-3 flex-1 overflow-y-auto max-h-80">
          <div className="p-3 rounded-xl border border-indigo-100 bg-white shadow-sm space-y-3">
            <div className="flex items-start justify-between gap-3 flex-wrap">
              <div className="min-w-[200px] flex-1">
                <div className="font-semibold text-sm flex items-center gap-2">
                  Authority 执行后端
                  <Badge
                    variant="outline"
                    className={
                      executorStatus?.state === "ready"
                        ? "border-emerald-200 bg-emerald-50 text-emerald-700"
                        : executorStatus?.state === "blocked"
                          ? "border-red-200 bg-red-50 text-red-700"
                          : "border-amber-200 bg-amber-50 text-amber-700"
                    }
                  >
                    {executorStatus?.state ?? "unknown"}
                  </Badge>
                </div>
                <div className="mt-1 text-xs text-slate-600">
                  下游类型：{executorConfig?.type ?? "openclaw"} · 地址：{executorConfig?.openclaw.url ?? "--"}
                </div>
                <div className="mt-1 text-[11px] text-slate-500">
                  Token: {executorConfig?.openclaw.tokenConfigured ? "******(已配置)" : "未配置"}
                  {executorConfig?.lastConnectedAt
                    ? ` · 最近接通 ${formatTime(executorConfig.lastConnectedAt)}`
                    : ""}
                </div>
                <div className="mt-1 text-[11px] text-slate-500">
                  {executorStatus?.note || executorConfig?.lastError || "Authority 将浏览器请求统一代理到下游 OpenClaw。"}
                </div>
                {!executorConfig?.openclaw.tokenConfigured ? (
                  <div className="mt-2 rounded-lg border border-red-200 bg-red-50 px-2.5 py-2 text-[11px] text-red-800">
                    <div className="flex items-start gap-2">
                      <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                      <div>
                        当前没有为 Authority 配置 OpenClaw gateway token。若下游需要 operator 权限，执行器即使连上也无法列出、创建或修复 agent。
                      </div>
                    </div>
                  </div>
                ) : null}
                {authorityHealth?.executorCapabilities ? (
                  <div className="mt-1 text-[11px] text-slate-500">
                    能力快照：session_status {authorityHealth.executorCapabilities.sessionStatus} · process runtime{" "}
                    {authorityHealth.executorCapabilities.processRuntime}
                  </div>
                ) : null}
                {authorityHealth?.executorCapabilities?.notes[0] ? (
                  <div className="mt-2 rounded-lg border border-slate-200 bg-slate-50 px-2.5 py-2 text-[11px] text-slate-700">
                    {authorityHealth.executorCapabilities.notes[0]}
                  </div>
                ) : null}
                {authorityHealth?.executorReadiness?.length ? (
                  <div className="mt-3 space-y-2">
                    <div className="text-[11px] font-medium text-slate-700">执行器环境检查</div>
                    {authorityHealth.executorReadiness.map((check) => (
                      <div key={check.id} className="rounded-lg border border-slate-200 bg-slate-50 px-2.5 py-2">
                        <div className="flex items-center justify-between gap-2">
                          <div className="text-[11px] font-medium text-slate-800">{check.label}</div>
                          <div className="text-[11px] text-slate-500">{check.state}</div>
                        </div>
                        <div className="mt-1 text-[11px] text-slate-600">{check.summary}</div>
                        {check.detail ? (
                          <div className="mt-1 text-[11px] text-slate-500">{check.detail}</div>
                        ) : null}
                      </div>
                    ))}
                  </div>
                ) : null}
                {executorConfig?.lastError ? (
                  <div className="mt-2 rounded-lg border border-amber-200 bg-amber-50 px-2.5 py-2 text-[11px] text-amber-800">
                    最近错误：{executorConfig.lastError}
                  </div>
                ) : null}
              </div>
              <div className="flex items-center gap-1.5 shrink-0 flex-wrap justify-end">
                <Button
                  variant="secondary"
                  size="sm"
                  className={
                    executorConfig?.openclaw.tokenConfigured
                      ? "h-8 text-xs bg-white text-indigo-700 border border-indigo-200 hover:bg-indigo-50"
                      : "h-8 text-xs bg-red-600 text-white hover:bg-red-700"
                  }
                  onClick={() => setExecutorDialogOpen(true)}
                >
                  {executorConfig?.openclaw.tokenConfigured ? "修改后端" : "先配置 Token"}
                </Button>
                <Button
                  variant="secondary"
                  size="sm"
                  className="h-8 text-xs bg-indigo-600 text-white hover:bg-indigo-700"
                  onClick={() =>
                    void runCommand(handleExecutorReconnect, "执行后端重连失败")
                  }
                  disabled={executorSaving || loading}
                >
                  {executorSaving ? "重连中..." : "立即重连"}
                </Button>
              </div>
            </div>
          </div>

          {!configSnapshot?.config ? (
            <div className="rounded-xl border border-dashed border-slate-200 bg-slate-50 px-4 py-6 text-sm text-slate-500">
              当前还没有可用的下游配置快照。请先确保 Authority 已成功连接 OpenClaw，然后刷新运行时。
            </div>
          ) : null}

          <div className="p-3 rounded-xl border border-sky-100 bg-sky-50/60 shadow-sm space-y-3">
            <div className="flex items-start justify-between gap-3 flex-wrap">
              <div className="min-w-[200px] flex-1">
                <div className="font-semibold text-sm flex items-center gap-2">
                  OpenAI Codex (OAuth)
                  <Badge className="bg-sky-600 text-white">推荐</Badge>
                  {codexModels.length > 0 && (
                    <span className="text-[10px] font-normal text-sky-600 bg-white px-1.5 py-0.5 rounded-full border border-sky-100">
                      {codexModels.length} Models
                    </span>
                  )}
                </div>
                <div className="text-xs text-slate-600 mt-1">
                  支持直接授权回调，也支持从当前网关主机的 <span className="font-mono">~/.codex/auth.json</span> 一键同步授权，无需手填 API Key。
                </div>
                <div className="text-[11px] text-slate-500 mt-1">
                  {codexModels.length > 0
                    ? `已发现 ${codexModels.length} 个可用 Codex 模型，可直接供员工编排使用。`
                    : "尚未发现可用 Codex 模型；完成直接授权或本地同步后会自动刷新模型目录。"}
                </div>
                <div className="text-[11px] text-amber-700 mt-1">
                  这里导入的是 OpenClaw 内部可调用的 Codex 模型，不是独立的 Codex Agent 后端。
                </div>
              </div>
              <div className="flex items-center gap-1.5 shrink-0 flex-wrap justify-end">
                <Button
                  variant="secondary"
                  size="sm"
                  className="h-8 text-xs bg-white text-sky-700 border border-sky-200 hover:bg-sky-100"
                  onClick={() =>
                    void runCommand(handleStartCodexOAuth, "Codex 授权启动失败")
                  }
                  disabled={codexAuthorizing || codexImporting || codexRefreshing || loading}
                >
                  {codexAuthorizing ? "跳转中..." : "直接授权登录"}
                </Button>
                <Button
                  variant="secondary"
                  size="sm"
                  className="h-8 text-xs bg-sky-600 text-white hover:bg-sky-700"
                  onClick={() =>
                    void runCommand(handleImportCodexAuth, "Codex 授权同步失败")
                  }
                  disabled={codexAuthorizing || codexImporting || codexRefreshing || loading}
                >
                  {codexImporting ? "同步中..." : "同步本地 Codex 授权"}
                </Button>
                <Button
                  variant="secondary"
                  size="sm"
                  className="h-8 w-8 px-0 bg-white text-slate-600 hover:text-sky-600 hover:bg-sky-100"
                  disabled={codexAuthorizing || codexImporting || codexRefreshing || loading}
                  onClick={() =>
                    void runCommand(handleRefreshCodexModels, "Codex 模型刷新失败")
                  }
                  title="刷新 Codex 可用模型列表"
                >
                  <RefreshCw
                    className={`w-4 h-4 ${codexRefreshing ? "animate-spin text-sky-600" : ""}`}
                  />
                </Button>
              </div>
            </div>
            {codexModels.length > 0 && (
              <div className="flex flex-wrap gap-2">
                {codexModels.slice(0, 6).map((model) => (
                  <Badge key={`${model.provider}/${model.id}`} variant="outline" className="bg-white">
                    {model.name || model.id}
                  </Badge>
                ))}
                {codexModels.length > 6 && (
                  <Badge variant="outline" className="bg-white text-slate-500">
                    +{codexModels.length - 6}
                  </Badge>
                )}
              </div>
            )}
          </div>
          {configSnapshot?.config ? Object.entries(providerConfigs).map(([providerName, pConfig]) => (
            <div
              key={providerName}
              className="flex items-center justify-between p-3 rounded-xl border bg-white shadow-sm flex-wrap gap-2"
            >
              <div className="flex-1 min-w-[120px]">
                <div className="font-semibold text-sm capitalize flex items-center gap-2">
                  {providerName.split("-")[0]}
                  {Array.isArray(pConfig.models) && (
                    <span className="text-[10px] font-normal text-indigo-500 bg-indigo-50 px-1.5 py-0.5 rounded-full">
                      {pConfig.models.length} Models
                    </span>
                  )}
                </div>
                <div className="text-xs text-slate-500 mt-0.5 truncate max-w-[180px]">
                  鉴权: {pConfig.apiKey ? "******(已登记)" : "尚未配置"}
                </div>
                {pConfig.baseUrl && (
                  <div
                    className="text-[10px] text-slate-400 mt-0.5 truncate max-w-[180px]"
                    title={pConfig.baseUrl}
                  >
                    URL: {pConfig.baseUrl}
                  </div>
                )}
              </div>
              <div className="flex items-center gap-1.5 shrink-0">
                <Button
                  variant="secondary"
                  size="sm"
                  className="h-8 w-8 px-0 bg-slate-50 text-slate-600 hover:text-indigo-600 hover:bg-slate-100"
                  disabled={syncingProvider === providerName}
                  onClick={() =>
                    void runCommand(
                      () => handleSyncModels(providerName, pConfig),
                      `${providerName} 模型同步失败`,
                    )
                  }
                  title="通过 API 同步平台最新模型列表"
                >
                  <RefreshCw
                    className={`w-4 h-4 ${syncingProvider === providerName ? "animate-spin text-indigo-500" : ""}`}
                  />
                </Button>
                <Button
                  variant="secondary"
                  size="sm"
                  className="h-8 text-xs bg-indigo-50 text-indigo-700 hover:bg-indigo-100"
                  onClick={() => updateProviderKey(providerName)}
                >
                  更新密钥
                </Button>
              </div>
            </div>
          )) : null}
          {configSnapshot?.config && Object.keys(providerConfigs).length === 0 && (
            <div className="text-sm text-slate-400 text-center py-4">无提货商数据</div>
          )}
        </CardContent>
      </Card>

      <Card className="shadow-sm border-emerald-100 flex flex-col">
        <CardHeader className="bg-emerald-50/30 pb-4 border-b">
          <CardTitle className="flex items-center gap-2 text-lg text-emerald-900">
            <MessageCircle className="w-5 h-5 text-emerald-600" />
            外网应用链路通信
          </CardTitle>
          <CardDescription>绑定后，赛博公司将接通对应该社交体系的外网全量消息</CardDescription>
        </CardHeader>
        <CardContent className="pt-4 space-y-3 flex-1 overflow-y-auto max-h-80">
          <div className="flex items-center justify-between p-3 rounded-xl border bg-white shadow-sm">
            <div>
              <div className="font-semibold text-sm flex items-center gap-2">
                Telegram 机器人
                {telegramConfig?.enabled && (
                  <Badge
                    variant="outline"
                    className="text-[9px] h-4 text-emerald-600 border-emerald-200 bg-emerald-50"
                  >
                    运行中
                  </Badge>
                )}
              </div>
              <div className="text-xs text-slate-500 mt-0.5">
                Token: {telegramConfig?.botToken ? "******(已载入)" : "未装载"}
              </div>
            </div>
            <Button
              variant="secondary"
              size="sm"
              className="h-8 text-xs bg-emerald-50 text-emerald-700 hover:bg-emerald-100"
              onClick={() => setTelegramDialogOpen(true)}
            >
              配置 / 覆盖
            </Button>
          </div>

          {(configSnapshot?.config
            ? Object.entries(configSnapshot.config.channels || {})
                .filter(([k]) => k !== "telegram" && k !== "defaults" && k !== "modelByChannel")
                .map(([channelName]) => (
                  <div
                    key={channelName}
                    className="flex items-center justify-between p-3 rounded-xl border bg-white shadow-sm opacity-60"
                  >
                    <div>
                      <div className="font-semibold text-sm capitalize">{channelName}</div>
                      <div className="text-xs text-slate-500 mt-0.5">暂不支持在此视图直接修改</div>
                    </div>
                    <Badge variant="outline">只读</Badge>
                  </div>
                ))
            : [])}
        </CardContent>
      </Card>
    </div>
  );
}
