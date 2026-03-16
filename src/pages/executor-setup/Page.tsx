import { useCallback, useEffect, useMemo, useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { AlertTriangle, KeyRound, RefreshCcw, Server, ShieldAlert } from "lucide-react";
import {
  extractAuthorityHealthSnapshot,
  requiresAuthorityExecutorOnboarding,
  resolveAuthorityExecutorOnboardingIssue,
} from "../../application/gateway/authority-health";
import { gateway, useGatewayStore } from "../../application/gateway";
import { patchAuthorityExecutorConfig } from "../../application/gateway/authority-control";
import type { AuthorityHealthSnapshot } from "../../application/gateway/authority-types";
import { useTranslate } from "../../i18n";

function sleep(ms: number) {
  return new Promise((resolve) => window.setTimeout(resolve, ms));
}

function describeIssue(health: AuthorityHealthSnapshot | null) {
  const issue = health ? resolveAuthorityExecutorOnboardingIssue(health) : null;
  if (issue === "missing-token") {
    return {
      title: "还没有为 Authority 配置 OpenClaw Token",
      summary: "浏览器虽然已经连上 Authority，但 Authority 还没有拿到下游执行器凭证，所以现在不能列出、创建或修复 agent。",
    };
  }
  if (issue === "missing-scope") {
    return {
      title: "当前 Token 权限不够",
      summary: "Authority 已经尝试连接下游执行器，但当前 token 没有拿到必需的 operator 权限。请换一个带 operator.read / operator.admin 的 token。",
    };
  }
  return {
    title: "Authority 执行器当前不可用",
    summary: "当前主界面依赖的下游 OpenClaw executor 还没有恢复。先完成接入或修复，再继续进入系统会更稳定。",
  };
}

export function ExecutorSetupPresentationPage() {
  const t = useTranslate();
  const location = useLocation();
  const navigate = useNavigate();
  const { connected } = useGatewayStore();
  const [health, setHealth] = useState<AuthorityHealthSnapshot | null>(null);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [url, setUrl] = useState("ws://localhost:18789");
  const [token, setToken] = useState("");

  const refreshHealth = useCallback(async () => {
    if (!connected) {
      setHealth(null);
      return null;
    }
    setLoading(true);
    setError(null);
    try {
      const status = await gateway.getStatus();
      const snapshot = extractAuthorityHealthSnapshot(status);
      setHealth(snapshot);
      if (snapshot?.executorConfig.openclaw.url) {
        setUrl(snapshot.executorConfig.openclaw.url);
      }
      return snapshot;
    } catch (refreshError) {
      const message = refreshError instanceof Error ? refreshError.message : String(refreshError);
      setError(message);
      setHealth(null);
      return null;
    } finally {
      setLoading(false);
    }
  }, [connected]);

  useEffect(() => {
    void refreshHealth();
  }, [refreshHealth]);

  const returnTo = useMemo(() => {
    const search = new URLSearchParams(location.search);
    const candidate = search.get("returnTo");
    return candidate && candidate.startsWith("/") ? candidate : "/runtime";
  }, [location.search]);

  useEffect(() => {
    if (!connected) {
      navigate("/connect", { replace: true });
      return;
    }
    if (health && !requiresAuthorityExecutorOnboarding(health) && !saving) {
      navigate(returnTo, { replace: true });
    }
  }, [connected, health, navigate, returnTo, saving]);

  const issue = describeIssue(health);
  const onboardingIssue = health ? resolveAuthorityExecutorOnboardingIssue(health) : null;
  const tokenConfigured = health?.executorConfig.openclaw.tokenConfigured ?? false;
  const lastError = health?.executorConfig.lastError ?? null;

  const handleSubmit = useCallback(async (event: React.FormEvent) => {
    event.preventDefault();
    const trimmedUrl = url.trim();
    const trimmedToken = token.trim();
    if (!trimmedUrl) {
      setError(t({ zh: "请先填写 OpenClaw URL。", en: "Enter the OpenClaw URL first." }));
      return;
    }
    if (!tokenConfigured && !trimmedToken) {
      setError(t({ zh: "当前还没有配置 token，这里需要先输入一个可用的 OpenClaw token。", en: "No token is configured yet. Enter a valid OpenClaw token first." }));
      return;
    }
    if (onboardingIssue === "missing-scope" && !trimmedToken) {
      setError(t({ zh: "当前保存下来的 token 权限不够。要继续修复，这里需要输入一个新的可用 token，而不是直接重试。", en: "The saved token does not have enough scope. Enter a new valid token instead of retrying with the existing one." }));
      return;
    }

    setSaving(true);
    setError(null);
    try {
      await patchAuthorityExecutorConfig({
        openclaw: {
          url: trimmedUrl,
          ...(trimmedToken ? { token: trimmedToken } : {}),
        },
        reconnect: true,
      });

      let nextHealth: AuthorityHealthSnapshot | null = null;
      for (let attempt = 0; attempt < 6; attempt += 1) {
        await sleep(attempt === 0 ? 150 : 500);
        nextHealth = await refreshHealth();
        if (nextHealth && !requiresAuthorityExecutorOnboarding(nextHealth)) {
          break;
        }
      }

      if (!nextHealth || requiresAuthorityExecutorOnboarding(nextHealth)) {
        throw new Error(
          nextHealth?.executorConfig.lastError
            ?? nextHealth?.executor.note
            ?? t({ zh: "Authority 还没有拿到可用的执行器权限，请检查 token 是否正确。", en: "Authority still does not have usable executor permissions. Check whether the token is correct." }),
        );
      }
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : String(submitError));
    } finally {
      setSaving(false);
      setToken("");
    }
  }, [onboardingIssue, refreshHealth, t, token, tokenConfigured, url]);

  return (
    <div className="min-h-screen bg-slate-50 px-4 py-8">
      <div className="mx-auto max-w-3xl">
        <div className="rounded-3xl border border-slate-200 bg-white shadow-xl shadow-slate-200/60">
          <div className="border-b border-slate-100 px-6 py-5 md:px-8">
            <div className="flex items-start gap-3">
              <div className="rounded-2xl bg-red-50 p-3 text-red-600">
                <ShieldAlert className="h-6 w-6" />
              </div>
              <div className="min-w-0 flex-1">
                <div className="text-sm font-semibold text-slate-900">
                  {t({ zh: "先完成 Authority 执行器接入", en: "Finish Authority executor setup first" })}
                </div>
                <div className="mt-1 text-sm text-slate-600">
                  {t(
                    {
                      zh: issue.title,
                      en:
                        onboardingIssue === "missing-token"
                          ? "Authority does not have an OpenClaw token configured yet"
                          : onboardingIssue === "missing-scope"
                            ? "The current token does not have enough permissions"
                            : "Authority executor is currently unavailable",
                    },
                  )}
                </div>
                <div className="mt-2 text-xs leading-6 text-slate-500">
                  {t(
                    {
                      zh: issue.summary,
                      en:
                        onboardingIssue === "missing-token"
                          ? "The browser is connected to Authority, but Authority still lacks downstream executor credentials, so it cannot list, create, or repair agents yet."
                          : onboardingIssue === "missing-scope"
                            ? "Authority reached the downstream executor, but the current token is missing required operator permissions. Use a token with operator.read / operator.admin."
                            : "The downstream OpenClaw executor required by the main interface has not recovered yet. Completing setup or repair first is the stable path.",
                    },
                  )}
                </div>
              </div>
            </div>
          </div>

          <div className="grid gap-6 px-6 py-6 md:grid-cols-[1.05fr_0.95fr] md:px-8">
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
                {t({
                  zh: "主界面暂时不会继续放行，因为当前不是“有点异常”，而是核心执行链路还没接通。",
                  en: "The main interface stays gated for now because this is not a minor warning. The core execution path is still unavailable.",
                })}
              </div>

              <div>
                <label htmlFor="executor-url" className="mb-1 block text-sm font-medium text-slate-700">
                  OpenClaw URL
                </label>
                <div className="relative">
                  <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3 text-slate-400">
                    <Server className="h-4 w-4" />
                  </div>
                  <input
                    id="executor-url"
                    type="text"
                    value={url}
                    onChange={(event) => setUrl(event.target.value)}
                    className="block w-full rounded-xl border border-slate-200 py-2.5 pl-10 pr-3 text-sm outline-none transition-shadow focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500"
                    placeholder="ws://127.0.0.1:18789"
                    required
                  />
                </div>
              </div>

              <div>
                <label htmlFor="executor-token" className="mb-1 block text-sm font-medium text-slate-700">
                  OpenClaw Token
                </label>
                <div className="relative">
                  <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3 text-slate-400">
                    <KeyRound className="h-4 w-4" />
                  </div>
                  <input
                    id="executor-token"
                    type="password"
                    value={token}
                    onChange={(event) => setToken(event.target.value)}
                    className="block w-full rounded-xl border border-slate-200 py-2.5 pl-10 pr-3 text-sm outline-none transition-shadow focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500"
                    placeholder={tokenConfigured ? "留空表示沿用当前 token" : "输入带 operator 权限的 token"}
                  />
                </div>
                <div className="mt-1 text-xs text-slate-500">
                  {t({
                    zh: "需要能授予 `operator.read` 和 `operator.admin`。如果当前完全没配 token，这里就是必填。",
                    en: "The token must grant `operator.read` and `operator.admin`. If no token is configured yet, this field is required.",
                  })}
                </div>
              </div>

              {error ? (
                <div className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
                  {error}
                </div>
              ) : null}

              <div className="flex flex-wrap items-center gap-2">
                <button
                  type="submit"
                  disabled={saving}
                  className="inline-flex items-center gap-2 rounded-xl bg-indigo-600 px-4 py-2 text-sm font-semibold text-white hover:bg-indigo-700 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {saving ? <RefreshCcw className="h-4 w-4 animate-spin" /> : <KeyRound className="h-4 w-4" />}
                  {t({ zh: "保存并验证执行器", en: "Save and Verify Executor" })}
                </button>
                <button
                  type="button"
                  onClick={() => void refreshHealth()}
                  disabled={loading || saving}
                  className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  <RefreshCcw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
                  {t({ zh: "刷新状态", en: "Refresh Status" })}
                </button>
                <Link
                  to="/settings?setup=executor-token"
                  className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50"
                >
                  {t({ zh: "打开高级设置", en: "Open Advanced Settings" })}
                </Link>
              </div>
            </form>

            <div className="space-y-4">
              <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3">
                <div className="flex items-center gap-2 text-sm font-semibold text-slate-900">
                  <AlertTriangle className="h-4 w-4 text-amber-600" />
                  {t({ zh: "当前执行器状态", en: "Current executor status" })}
                </div>
                <div className="mt-2 space-y-2 text-sm text-slate-600">
                  <div>
                    {t({ zh: "Authority 状态：", en: "Authority: " })}
                    {connected ? t({ zh: "已连接", en: "Connected" }) : t({ zh: "未连接", en: "Disconnected" })}
                  </div>
                  <div>
                    {t({ zh: "Executor 状态：", en: "Executor: " })}
                    {health?.executor.state ?? t({ zh: "未知", en: "Unknown" })}
                  </div>
                  <div>
                    {t({ zh: "Token：", en: "Token: " })}
                    {tokenConfigured ? t({ zh: "已配置", en: "Configured" }) : t({ zh: "未配置", en: "Not configured" })}
                  </div>
                  <div>
                    {t({ zh: "地址：", en: "URL: " })}
                    {health?.executorConfig.openclaw.url ?? url}
                  </div>
                </div>
                {lastError ? (
                  <div className="mt-3 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-xs leading-5 text-amber-900">
                    {t({ zh: "最近错误：", en: "Latest error: " })}
                    {lastError}
                  </div>
                ) : null}
              </div>

              <div className="rounded-2xl border border-slate-200 bg-white px-4 py-3">
                <div className="text-sm font-semibold text-slate-900">
                  {t({ zh: "修复顺序", en: "Recommended repair order" })}
                </div>
                <div className="mt-2 space-y-2 text-xs leading-6 text-slate-600">
                  <div>{t({ zh: "1. 先确认 OpenClaw URL 正确，能连到目标 gateway。", en: "1. Confirm the OpenClaw URL is correct and can reach the target gateway." })}</div>
                  <div>{t({ zh: "2. 再输入一个带 `operator.read` / `operator.admin` 的 token。", en: "2. Enter a token that includes `operator.read` / `operator.admin`." })}</div>
                  <div>{t({ zh: "3. 点击“保存并验证执行器”，等待 Authority 完成重连和权限校验。", en: '3. Click "Save and Verify Executor" and wait for Authority to reconnect and validate permissions.' })}</div>
                  <div>{t({ zh: "4. 只有校验通过后，系统才会自动放行回主界面。", en: "4. The app returns to the main interface only after validation succeeds." })}</div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
