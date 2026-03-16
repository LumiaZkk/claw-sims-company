import { CheckCircle2, Loader2, ShieldAlert } from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useCompanyShellQuery } from "../../application/company/shell";
import { useGatewayStore } from "../../application/gateway";
import {
  formatCodexAuthCompletionDescription,
  reapplyCodexModelsToActiveSessions,
  syncCodexModelsToAllowlist,
} from "../../application/gateway/codex-runtime";
import { Button } from "../../ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "../../ui/card";
import { gateway } from "../../application/gateway";
import { toast } from "../../system/toast-store";
import { syncCompanyCodexAuth } from "../../application/gateway/authority-client";
import { useTranslate } from "../../i18n";

type CallbackPhase = "connecting" | "authorizing" | "success" | "error";

export function CodexOAuthCallbackPresentationPage() {
  const t = useTranslate();
  const navigate = useNavigate();
  const completedRef = useRef(false);
  const { activeCompany } = useCompanyShellQuery();
  const { connected, connecting, bootstrapAutoConnect, markModelsRefreshed } = useGatewayStore();
  const params = useMemo(() => new URLSearchParams(window.location.search), []);
  const callbackProblem = (() => {
    const providerError = params.get("error");
    if (providerError) {
      const detail = params.get("error_description") || providerError;
      return t(
        { zh: "OpenAI 返回授权错误：{detail}", en: "OpenAI returned an authorization error: {detail}" },
        { detail },
      );
    }

    const code = params.get("code")?.trim();
    const state = params.get("state")?.trim();
    if (!code || !state) {
      return t({
        zh: "回调参数不完整，缺少 code 或 state。请返回设置页重新发起授权。",
        en: "The callback is missing required parameters: code or state. Return to Settings and start authorization again.",
      });
    }
    return null;
  })();
  const [result, setResult] = useState<{ phase: "success" | "error"; message: string } | null>(
    () => (callbackProblem ? { phase: "error", message: callbackProblem } : null),
  );

  useEffect(() => {
    bootstrapAutoConnect();
  }, [bootstrapAutoConnect]);

  const clearCallbackQuery = useCallback(() => {
    window.history.replaceState({}, document.title, window.location.pathname);
  }, []);

  useEffect(() => {
    if (callbackProblem) {
      completedRef.current = true;
      clearCallbackQuery();
      return;
    }

    if (completedRef.current || !connected) {
      return;
    }

    const code = params.get("code")?.trim();
    const state = params.get("state")?.trim();
    if (!code || !state) {
      return;
    }

    completedRef.current = true;
    void (async () => {
      try {
        const completed = await gateway.completeCodexOAuth({ code, state });
        if (activeCompany?.id) {
          await syncCompanyCodexAuth(activeCompany.id, "gateway");
        }
        const refreshed = await gateway.refreshModels();
        await syncCodexModelsToAllowlist(refreshed.models ?? []);
        const reapplyResult = await reapplyCodexModelsToActiveSessions();
        const codexCount = (refreshed.models ?? []).filter((model) => model.provider === "openai-codex")
          .length;
        markModelsRefreshed();
        clearCallbackQuery();
        const completionDescription = formatCodexAuthCompletionDescription({
          accountId: completed.accountId ?? null,
          codexCount,
          profileId: completed.profileId,
          reapplyResult,
        });
        setResult({
          phase: "success",
          message: t({ zh: "授权已完成，{description}", en: "Authorization completed. {description}" }, {
            description: completionDescription,
          }),
        });
        toast.success(
          t({ zh: "Codex 授权成功", en: "Codex authorization successful" }),
          t({ zh: "已同步 {count} 个可用模型。{description}", en: "{count} available models were synced. {description}" }, {
            count: codexCount,
            description: completionDescription,
          }),
        );

        if (window.opener) {
          setTimeout(() => {
            window.opener?.focus();
            window.close();
          }, 1200);
        }
      } catch (err) {
        clearCallbackQuery();
        setResult({
          phase: "error",
          message: err instanceof Error ? err.message : String(err),
        });
      }
    })();
  }, [activeCompany, callbackProblem, clearCallbackQuery, connected, markModelsRefreshed, params, t]);

  const phase: CallbackPhase = result?.phase ?? (connected ? "authorizing" : "connecting");
  const message =
    result?.message ??
    (connected
      ? t({ zh: "正在写入 Codex OAuth 凭据并刷新模型目录...", en: "Writing Codex OAuth credentials and refreshing the model catalog..." })
      : t({ zh: "正在连接网关并完成 Codex 授权...", en: "Connecting to the gateway and completing Codex authorization..." }));

  const icon = (() => {
    switch (phase) {
      case "success":
        return <CheckCircle2 className="h-10 w-10 text-emerald-600" />;
      case "error":
        return <ShieldAlert className="h-10 w-10 text-rose-600" />;
      default:
        return <Loader2 className="h-10 w-10 animate-spin text-sky-600" />;
    }
  })();

  const title =
    phase === "success"
      ? t({ zh: "Codex 授权完成", en: "Codex authorization complete" })
      : phase === "error"
        ? t({ zh: "Codex 授权失败", en: "Codex authorization failed" })
        : connecting || !connected
          ? t({ zh: "正在连接网关", en: "Connecting to gateway" })
          : t({ zh: "正在完成授权", en: "Completing authorization" });

  return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center px-4 py-10">
      <Card className="w-full max-w-lg shadow-lg border-sky-100">
        <CardHeader className="space-y-4 text-center">
          <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-white shadow-sm border border-slate-200">
            {icon}
          </div>
          <div className="space-y-2">
            <CardTitle className="text-xl text-slate-900">{title}</CardTitle>
            <CardDescription>
              {t({
                zh: "OpenAI Codex (OAuth) 回调页会把授权结果写回网关，并刷新可用模型目录。",
                en: "This OpenAI Codex OAuth callback page writes the result back to the gateway and refreshes the available model catalog.",
              })}
            </CardDescription>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="rounded-xl border bg-white px-4 py-3 text-sm text-slate-700">{message}</div>
          <div className="flex items-center justify-center gap-2">
            <Button variant="outline" onClick={() => navigate("/settings", { replace: true })}>
              {t({ zh: "返回设置", en: "Back to Settings" })}
            </Button>
            {window.opener && (
              <Button variant="secondary" onClick={() => window.close()}>
                {t({ zh: "关闭窗口", en: "Close Window" })}
              </Button>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
