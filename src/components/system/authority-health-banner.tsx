import { AlertTriangle, RefreshCcw } from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { Link, useLocation } from "react-router-dom";
import {
  buildAuthorityBannerModel,
  extractAuthorityHealthSnapshot,
} from "../../application/gateway/authority-health";
import { gateway, useGatewayStore } from "../../application/gateway";
import type { AuthorityHealthSnapshot } from "../../infrastructure/authority/contract";

function bannerToneClass(state: "ready" | "degraded" | "blocked") {
  if (state === "blocked") {
    return "border-rose-300 bg-rose-50/95 text-rose-900";
  }
  return "border-amber-300 bg-amber-50/95 text-amber-900";
}

export function AuthorityHealthBanner() {
  const location = useLocation();
  const { connected, phase } = useGatewayStore();
  const [health, setHealth] = useState<AuthorityHealthSnapshot | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  const hidden =
    !connected ||
    phase === "connecting" ||
    phase === "reconnecting" ||
    location.pathname === "/connect" ||
    location.pathname === "/settings";

  const refreshHealth = useCallback(async () => {
    if (hidden) {
      setHealth(null);
      return;
    }
    setRefreshing(true);
    try {
      const status = await gateway.getStatus();
      setHealth(extractAuthorityHealthSnapshot(status));
    } catch {
      setHealth(null);
    } finally {
      setRefreshing(false);
    }
  }, [hidden]);

  useEffect(() => {
    if (hidden) {
      setHealth(null);
      return;
    }
    void refreshHealth();
    const handleFocus = () => {
      void refreshHealth();
    };
    window.addEventListener("focus", handleFocus);
    return () => {
      window.removeEventListener("focus", handleFocus);
    };
  }, [hidden, refreshHealth]);

  const banner = useMemo(() => (health ? buildAuthorityBannerModel(health, 2) : null), [health]);

  if (hidden || !banner) {
    return null;
  }

  return (
    <div className={`border-b px-4 py-2.5 shadow-sm ${bannerToneClass(banner.state)}`}>
      <div className="mx-auto flex max-w-7xl flex-col gap-2 md:flex-row md:items-start md:justify-between">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2 text-sm font-semibold">
            <AlertTriangle className="h-4 w-4 shrink-0" />
            <span>{banner.title}</span>
          </div>
          <div className="mt-1 text-xs leading-5 opacity-90">{banner.summary}</div>
          {banner.detail ? (
            <div className="mt-1 text-[11px] leading-5 opacity-80">{banner.detail}</div>
          ) : null}
          {banner.steps.length > 0 ? (
            <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-[11px] leading-5 opacity-90">
              {banner.steps.map((step) => (
                <span key={step}>- {step}</span>
              ))}
            </div>
          ) : null}
        </div>

        <div className="flex shrink-0 items-center gap-2">
          <button
            type="button"
            onClick={() => void refreshHealth()}
            className="inline-flex items-center gap-1 rounded-md border border-current/30 bg-white/80 px-2.5 py-1 text-[11px] font-semibold hover:bg-white"
          >
            <RefreshCcw className={`h-3.5 w-3.5 ${refreshing ? "animate-spin" : ""}`} />
            刷新诊断
          </button>
          <Link
            to="/settings"
            className="inline-flex items-center rounded-md border border-current/30 bg-white/80 px-2.5 py-1 text-[11px] font-semibold hover:bg-white"
          >
            打开 Settings Doctor
          </Link>
          <Link
            to="/connect"
            className="inline-flex items-center rounded-md border border-current/30 bg-white/80 px-2.5 py-1 text-[11px] font-semibold hover:bg-white"
          >
            打开 Connect
          </Link>
        </div>
      </div>
    </div>
  );
}
