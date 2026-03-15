import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Zap, HardDrive, Terminal, RotateCw } from "lucide-react";
import {
  buildAuthorityOperatorControlPlaneModel,
  resolveAuthorityControlState,
} from "../../application/gateway/authority-health";
import { useGatewayStore } from "../../application/gateway";
import { probeAuthorityHealth, runAuthorityOperatorActionAt } from "../../application/gateway/authority-client";
import type { AuthorityHealthSnapshot } from "../../application/gateway/authority-types";
import { toast } from "../../system/toast-store";
import { ConnectionDiagnosisSummary } from "../../shared/presentation/ConnectionDiagnosisSummary";
import { AuthorityControlPlaneSurface } from "../../shared/presentation/AuthorityControlPlaneSurface";

type GatewayStoreSnapshot = ReturnType<typeof useGatewayStore.getState>;

type ConnectFormProps = Pick<
  GatewayStoreSnapshot,
  | "providers"
  | "connect"
  | "stageConnectionDraft"
  | "connected"
  | "connecting"
  | "error"
  | "connectError"
  | "phase"
  | "reconnectAttempts"
  | "lastCloseReason"
  | "manifest"
> & {
  currentProvider: GatewayStoreSnapshot["providers"][number] | undefined;
  savedUrl: string;
  savedToken: string;
  onEnterCompany: () => void;
};

type AuthorityProbeState =
  | {
      status: "idle" | "loading";
      health: null;
      error: null;
    }
  | {
      status: "ready";
      health: AuthorityHealthSnapshot;
      error: null;
    }
  | {
      status: "failed";
      health: null;
      error: string;
    };

function ConnectForm({
  providers,
  connect,
  stageConnectionDraft,
  connected,
  connecting,
  error,
  connectError,
  phase,
  reconnectAttempts,
  lastCloseReason,
  manifest,
  currentProvider,
  savedUrl,
  savedToken,
  onEnterCompany,
}: ConnectFormProps) {
  const [url, setUrl] = useState(savedUrl || currentProvider?.defaultUrl || "");
  const [token, setToken] = useState(savedToken || "");
  const [authorityProbe, setAuthorityProbe] = useState<AuthorityProbeState>({
    status: "idle",
    health: null,
    error: null,
  });
  const authorityOnly = providers.length <= 1;

  const refreshAuthorityProbe = async (targetUrl: string, commit = true) => {
    const health = await probeAuthorityHealth(targetUrl);
    if (commit) {
      setAuthorityProbe({ status: "ready", health, error: null });
    }
    return health;
  };

  useEffect(() => {
    const normalized = url.trim();
    if (!normalized) {
      setAuthorityProbe({ status: "idle", health: null, error: null });
      return;
    }

    let cancelled = false;
    const timer = window.setTimeout(() => {
      setAuthorityProbe({ status: "loading", health: null, error: null });
      void refreshAuthorityProbe(normalized, false)
        .then((health) => {
          if (!cancelled) {
            setAuthorityProbe({ status: "ready", health, error: null });
          }
        })
        .catch((probeError) => {
          if (!cancelled) {
            setAuthorityProbe({
              status: "failed",
              health: null,
              error: probeError instanceof Error ? probeError.message : String(probeError),
            });
          }
        });
    }, 300);

    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [url]);

  const handleConnect = (event: React.FormEvent) => {
    event.preventDefault();
    if (!url) {
      return;
    }
    connect(url, token);
  };

  const handleAuthorityOperatorAction = async (
    entry: ReturnType<typeof buildAuthorityOperatorControlPlaneModel>["entries"][number],
  ) => {
    const normalized = url.trim();
    if (!normalized) {
      throw new Error("请先输入 Authority 地址，再执行控制面动作。");
    }
    const result = await runAuthorityOperatorActionAt(normalized, { id: entry.id });
    if (result.state === "blocked") {
      toast.error(result.title, result.summary);
    } else if (result.state === "degraded") {
      toast.warning(result.title, result.summary);
    } else {
      toast.success(result.title, result.summary);
    }
    await refreshAuthorityProbe(normalized);
    return result;
  };

  const isFailed = phase === "failed";
  const authorityProbeState =
    authorityProbe.status === "ready"
      ? resolveAuthorityControlState(authorityProbe.health)
      : authorityProbe.status === "failed"
        ? "blocked"
        : null;
  const authorityProbeSteps = [
    "确认 `npm run dev` 或 `npm run authority:start` 已启动",
    `检查控制面地址是否正确（当前 ${url || currentProvider?.defaultUrl || "http://127.0.0.1:19789"}）`,
    "如果 authority 已开启鉴权，确认 Token 输入无误",
  ];

  return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
      <div className="max-w-md w-full">
        <div className="mb-4 space-y-1 text-sm">
          <div className="font-semibold text-slate-900">连接工作引擎</div>
          <p className="text-slate-500">
            浏览器现在只连接 Authority 控制面，由 Authority 统一持有权威源并代理下游 OpenClaw。
          </p>
        </div>

        <div className="bg-white rounded-2xl shadow-xl shadow-slate-200/50 border border-slate-100 p-6 md:p-7">
          {connected ? (
            <div className="mb-4 flex items-center justify-between rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs text-emerald-700">
              <span>{currentProvider?.label || "Authority"} 已连接</span>
              <button
                type="button"
                onClick={onEnterCompany}
                className="rounded-md border border-emerald-300 bg-white px-2.5 py-1 text-[11px] font-semibold text-emerald-700 hover:bg-emerald-100"
              >
                进入公司
              </button>
            </div>
          ) : null}
          <form onSubmit={handleConnect} className="space-y-5">
            <div>
              {authorityOnly ? (
                <div className="rounded-lg border border-slate-200 bg-slate-50 p-3 text-sm text-slate-600">
                  <div className="font-medium text-slate-900">控制面入口</div>
                  <div className="mt-1">{currentProvider?.label || "Authority"}</div>
                  {currentProvider?.description ? (
                    <p className="mt-1 text-xs text-slate-500">{currentProvider.description}</p>
                  ) : null}
                </div>
              ) : null}
              <div className="mt-2 rounded-lg border border-slate-200 bg-slate-50 p-3 text-xs text-slate-600">
                <div className="font-medium text-slate-800">执行器能力快照</div>
                <div className="mt-1">
                  运行模式：{manifest.actorStrategy} · 房间：{manifest.roomStrategy} · 归档：
                  {manifest.archiveStrategy} · 存储：{manifest.storageStrategy}
                </div>
                <div className="mt-2 grid gap-1 text-[11px] text-slate-500 sm:grid-cols-2">
                  <div>历史会话：{manifest.capabilities.sessionHistory ? "原生" : "产品降级"}</div>
                  <div>归档：{manifest.capabilities.sessionArchives ? "原生" : "产品归档"}</div>
                  <div>文件区：{manifest.capabilities.agentFiles ? "原生" : "产品产物库"}</div>
                  <div>多 Agent：{manifest.actorStrategy === "native-multi-actor" ? "原生" : "虚拟角色"}</div>
                </div>
                {manifest.notes.length > 0 ? (
                  <ul className="mt-2 space-y-1">
                    {manifest.notes.map((note) => (
                      <li key={note}>- {note}</li>
                    ))}
                  </ul>
                ) : (
                  <div className="mt-2">当前后端能力完整，系统将优先使用原生能力。</div>
                )}
              </div>
            </div>

            <div>
              <label htmlFor="gateway-url" className="block text-sm font-medium text-slate-700 mb-1">
                {currentProvider?.urlLabel || "服务地址"}
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <HardDrive className="h-5 w-5 text-slate-400" />
                </div>
                <input
                  id="gateway-url"
                  type="text"
                  value={url}
                  onChange={(event) => {
                    const nextUrl = event.target.value;
                    setUrl(nextUrl);
                    if (!connected) {
                      stageConnectionDraft(nextUrl, token);
                    }
                  }}
                  className="block w-full pl-10 pr-3 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition-shadow sm:text-sm outline-none"
                  placeholder={currentProvider?.defaultUrl || ""}
                  required
                />
              </div>
            </div>

            <div>
              <label htmlFor="gateway-token" className="block text-sm font-medium text-slate-700 mb-1">
                {currentProvider?.tokenLabel || "访问令牌"}{" "}
                <span className="text-slate-400 font-normal">
                  ({currentProvider?.tokenOptional === false ? "必填" : "可选"})
                </span>
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <Terminal className="h-5 w-5 text-slate-400" />
                </div>
                <input
                  id="gateway-token"
                  type="password"
                  value={token}
                  onChange={(event) => {
                    const nextToken = event.target.value;
                    setToken(nextToken);
                    if (!connected) {
                      stageConnectionDraft(url, nextToken);
                    }
                  }}
                  className="block w-full pl-10 pr-3 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition-shadow sm:text-sm outline-none"
                  placeholder={currentProvider?.tokenPlaceholder || ""}
                />
              </div>
            </div>

            {error && !isFailed ? (
              <div className="bg-red-50 text-red-600 text-sm p-3 rounded-lg border border-red-100 flex items-start gap-2">
                <div className="mt-0.5">⚠️</div>
                <div className="flex-1 break-words">
                  <div className="font-medium">{connectError?.title || "连接失败"}</div>
                  <div className="mt-1">{connectError?.message || error}</div>
                </div>
              </div>
            ) : null}

            {isFailed ? (
              <ConnectionDiagnosisSummary
                variant="onboarding"
                state="blocked"
                title={`${connectError?.title || "自动重连已停止"}（已重试 ${reconnectAttempts} 次）`}
                summary={
                  connectError?.message || "系统已经停止自动重连，请根据错误类型修正配置后再重试。"
                }
                detail={connectError?.debug || lastCloseReason || null}
                steps={
                  connectError?.steps?.length
                    ? connectError.steps
                    : [
                        "确认 authority daemon 正在运行",
                        `检查控制面地址是否正确（当前默认 ${currentProvider?.defaultUrl || "http://127.0.0.1:19789"}）`,
                        "如果 authority 开启了鉴权，确认 Token 输入无误",
                        "如果 authority 已连接但聊天仍失败，再检查设置页里的 OpenClaw 执行后端状态",
                        "检查本机与目标地址网络可达（防火墙/端口）",
                      ]
                }
                actions={
                  <button
                    type="button"
                    onClick={() => connect(url, token)}
                    disabled={connecting}
                    className="inline-flex items-center gap-2 rounded-md border border-amber-300 bg-white px-3 py-1.5 text-xs font-semibold hover:bg-amber-100 disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    <RotateCw className="h-3.5 w-3.5" />
                    重试连接
                  </button>
                }
              />
            ) : null}

            {authorityProbeState && authorityProbe.status !== "ready" ? (
              <div className="space-y-3">
                <ConnectionDiagnosisSummary
                  variant="onboarding"
                  state={authorityProbeState}
                  title="Authority 控制面暂不可达"
                  summary="还没探测到可用的 Authority 控制面，请先确认本地 daemon 是否已启动。"
                  detail={authorityProbe.error}
                  steps={authorityProbeSteps}
                />
              </div>
            ) : null}

            <AuthorityControlPlaneSurface
              health={authorityProbe.status === "ready" ? authorityProbe.health : null}
              summaryVariant="onboarding"
              summaryLimit={3}
              guidanceLimit={3}
              readinessLimit={4}
              onExecuteEntry={handleAuthorityOperatorAction}
            />

            <button
              type="submit"
              disabled={connecting}
              className={`w-full flex justify-center items-center py-2.5 px-4 border border-transparent rounded-lg shadow-sm text-sm font-medium text-white transition-colors ${
                connecting ? "bg-indigo-400 cursor-not-allowed" : "bg-indigo-600 hover:bg-indigo-700"
              }`}
            >
              {connecting ? (
                <>
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2" />
                  连接中...
                </>
              ) : (
                <>
                  <Zap className="w-4 h-4 mr-2" />
                  建立连接
                </>
              )}
            </button>
          </form>
        </div>

        <p className="mt-3 text-xs text-slate-400">
          {currentProvider?.connectHint ? (
            <>
              如果还没启动 Authority，请先运行{" "}
              <code className="bg-slate-200 px-1 py-0.5 rounded text-slate-600">
                {currentProvider.connectHint}
              </code>
            </>
          ) : (
            "请先启动 Authority 控制面，再回来连接。"
          )}
        </p>
      </div>
    </div>
  );
}

export function ConnectPresentationPage() {
  const {
    providerId,
    providers,
    connect,
    stageConnectionDraft,
    connected,
    connecting,
    error,
    connectError,
    phase,
    reconnectAttempts,
    lastCloseReason,
    manifest,
    url: savedUrl,
    token: savedToken,
  } = useGatewayStore();
  const navigate = useNavigate();
  const previousPhaseRef = useRef(phase);
  const previousConnectedRef = useRef(connected);
  const currentProvider = providers.find((provider) => provider.id === providerId) ?? providers[0];

  useEffect(() => {
    if (connected && !previousConnectedRef.current) {
      toast.success("连接成功", `${currentProvider?.label || "Authority"} 已连接，可以进入公司选择。`);
    }
    previousConnectedRef.current = connected;
  }, [connected, currentProvider?.label]);

  useEffect(() => {
    const previousPhase = previousPhaseRef.current;
    if (phase === "failed" && previousPhase !== "failed") {
      toast.error(
        connectError?.title || "自动重连失败",
        connectError?.message || "请检查 Authority 地址、Token 或 daemon 服务状态。",
      );
    }
    previousPhaseRef.current = phase;
  }, [connectError, phase]);

  return (
    <ConnectForm
      key={providerId}
      providers={providers}
      connect={connect}
      stageConnectionDraft={stageConnectionDraft}
      connected={connected}
      connecting={connecting}
      error={error}
      connectError={connectError}
      phase={phase}
      reconnectAttempts={reconnectAttempts}
      lastCloseReason={lastCloseReason}
      manifest={manifest}
      currentProvider={currentProvider}
      savedUrl={savedUrl}
      savedToken={savedToken}
      onEnterCompany={() => navigate("/select")}
    />
  );
}
