import {
  Activity,
  Building2,
  Users,
  LayoutDashboard,
  BarChart,
  BookOpen,
  BookOpenCheck,
  Folder,
  Settings,
  CalendarClock,
  Menu,
  ShieldAlert,
  Sparkles,
} from "lucide-react";
import { Suspense, lazy, useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import { Routes, Route, Link, useLocation, Navigate } from "react-router-dom";
import { useTranslate } from "./i18n";
import { ApprovalModalHost } from "./system/approval-modal-host";
import { AuthorityHealthBanner } from "./system/authority-health-banner";
import { CompanyAuthoritySyncHost } from "./system/company-authority-sync-host";
import { GatewayNotificationHost } from "./system/gateway-notification-host";
import { RequirementAggregateHost } from "./system/requirement-aggregate-host";
import { GatewayStatusBanner } from "./system/gateway-status-banner";
import { ToastHost } from "./ui/toast-host";
import {
  clearLiveChatSession,
  readLiveChatSession,
  upsertLiveChatSession,
} from "./application/chat/live-session-cache";
import { parseChatEventPayload } from "./application/delegation/chat-dispatch";
import { gateway } from "./application/gateway";
import {
  extractAuthorityHealthSnapshot,
  requiresAuthorityExecutorOnboarding,
} from "./application/gateway/authority-health";
import { useCompanyShellCommands, useCompanyShellQuery } from "./application/company/shell";
import { useGatewayStore } from "./application/gateway";
import { peekCachedCompanyConfig } from "./infrastructure/company/persistence/persistence";
import { getCompanyWorkspaceApps } from "./application/company/workspace-apps";
import { OrgAutopilotHost } from "./pages/org/OrgAutopilotHost";
import { extractTextFromMessage } from "./pages/chat/view-models/messages";
import { toast } from "./system/toast-store";
import { resolveSessionActorId } from "./lib/sessions";
import { LanguageSwitcher } from "./ui/language-switcher";

const AutomationPage = lazy(() =>
  import("./pages/automation/Page").then((module) => ({
    default: module.AutomationPresentationPage,
  })),
);
const BoardPage = lazy(() =>
  import("./pages/board/Page").then((module) => ({ default: module.BoardPageScreen })),
);
const ChatPage = lazy(() =>
  import("./pages/chat/Page").then((module) => ({ default: module.ChatPageScreen })),
);
const CompanyCreate = lazy(() =>
  import("./pages/company-create/Page").then((module) => ({
    default: module.CompanyCreatePresentationPage,
  })),
);
const CompanyLobby = lazy(() =>
  import("./pages/lobby/Page").then((module) => ({ default: module.CompanyLobbyPageScreen })),
);
const CompanySelect = lazy(() =>
  import("./pages/company-select/Page").then((module) => ({
    default: module.CompanySelectPresentationPage,
  })),
);
const ConnectPage = lazy(() =>
  import("./pages/connect/Page").then((module) => ({ default: module.ConnectPresentationPage })),
);
const CodexOAuthCallbackPage = lazy(() =>
  import("./pages/oauth-callback/Page").then((module) => ({
    default: module.CodexOAuthCallbackPresentationPage,
  })),
);
const CEOHomePage = lazy(() =>
  import("./pages/ceo/Page").then((module) => ({ default: module.CEOHomePageScreen })),
);
const DashboardPage = lazy(() =>
  import("./pages/dashboard/Page").then((module) => ({
    default: module.DashboardPresentationPage,
  })),
);
const EmployeeList = lazy(() =>
  import("./pages/org/EmployeeListPage").then((module) => ({ default: module.EmployeeListPage })),
);
const EmployeeProfile = lazy(() =>
  import("./pages/org/EmployeeProfilePage").then((module) => ({
    default: module.EmployeeProfilePage,
  })),
);
const ExecutorSetupPage = lazy(() =>
  import("./pages/executor-setup/Page").then((module) => ({
    default: module.ExecutorSetupPresentationPage,
  })),
);
const RequirementCenterPage = lazy(() =>
  import("./pages/requirement-center/Page").then((module) => ({
    default: module.RequirementCenterScreen,
  })),
);
const ProjectsPage = lazy(() =>
  import("./pages/projects/Page").then((module) => ({ default: module.ProjectsScreen })),
);
const ProjectDetailPage = lazy(() =>
  import("./pages/projects/Page").then((module) => ({ default: module.ProjectDetailScreen })),
);
const RuntimeInspectorPage = lazy(() =>
  import("./pages/runtime/Page").then((module) => ({
    default: module.RuntimeInspectorPageScreen,
  })),
);
const SettingsPage = lazy(() =>
  import("./pages/settings/Page").then((module) => ({
    default: module.SettingsPresentationPage,
  })),
);
const WorkspacePage = lazy(() =>
  import("./pages/workspace/Page").then((module) => ({
    default: module.WorkspacePresentationPage,
  })),
);

function CompanyBootstrapScreen() {
  const t = useTranslate();

  return (
    <div className="flex h-full min-h-[320px] items-center justify-center p-8">
      <div className="rounded-2xl border bg-card px-6 py-5 text-center shadow-sm">
        <div className="mx-auto mb-3 h-8 w-8 animate-spin rounded-full border-2 border-primary/20 border-t-primary" />
        <div className="text-sm font-medium">
          {t({
            zh: "正在恢复公司上下文...",
            en: "Restoring company context...",
          })}
        </div>
        <div className="mt-1 text-xs text-muted-foreground">
          {t({
            zh: "完成后会自动返回你上次所在的组织。",
            en: "You will return to the last active organization automatically.",
          })}
        </div>
      </div>
    </div>
  );
}

function RouteLoadingScreen() {
  const t = useTranslate();

  return (
    <div className="flex h-full min-h-[320px] items-center justify-center p-8">
      <div className="rounded-2xl border bg-card px-6 py-5 text-center shadow-sm">
        <div className="mx-auto mb-3 h-8 w-8 animate-spin rounded-full border-2 border-primary/20 border-t-primary" />
        <div className="text-sm font-medium">
          {t({
            zh: "正在加载页面...",
            en: "Loading page...",
          })}
        </div>
        <div className="mt-1 text-xs text-muted-foreground">
          {t({
            zh: "当前路由模块正在按需加载。",
            en: "The current route module is loading on demand.",
          })}
        </div>
      </div>
    </div>
  );
}

type QuickSwitchProps = {
  hasPrimaryRequirement: boolean;
};

type NavItem = {
  path: string;
  label: string;
  icon: typeof Building2;
  primary?: boolean;
};

type NavGroup = {
  label: string;
  items: NavItem[];
};

function MainlineQuickSwitch({ hasPrimaryRequirement }: QuickSwitchProps) {
  const location = useLocation();
  const t = useTranslate();
  const options = [
    { name: t({ zh: "运行态", en: "Runtime" }), path: "/runtime" },
    { name: t({ zh: "CEO 首页", en: "CEO Home" }), path: "/ceo" },
  ];
  if (hasPrimaryRequirement) {
    options.push({ name: t({ zh: "需求中心", en: "Requirement Hub" }), path: "/requirement" });
  }

  return (
    <div className="mr-2 flex items-center gap-1 rounded-full border bg-secondary/50 p-1 shadow-xs">
      <div className="px-2 flex items-center text-xs font-semibold text-muted-foreground">
        <Sparkles className="mr-1 h-3.5 w-3.5" />
        {t({ zh: "主线快切", en: "Primary Routes" })}
      </div>
      {options.map((opt) => (
        <Link
          key={opt.path}
          to={opt.path}
          className={`px-3 py-1 rounded-full text-xs font-medium transition-all ${
            location.pathname === opt.path
              ? "bg-background text-foreground shadow-sm ring-1 ring-border"
              : "text-muted-foreground hover:bg-black/5"
          }`}
        >
          {opt.name}
        </Link>
      ))}
    </div>
  );
}

export default function App() {
  const location = useLocation();
  const t = useTranslate();
  const isChatRoute = location.pathname.startsWith("/chat/");
  const { loadConfig } = useCompanyShellCommands();
  const { loading, activeCompany, bootstrapPhase, hasPrimaryRequirement } = useCompanyShellQuery();
  const {
    connected,
    phase,
    hasEverConnected,
    autoConnectInitialized,
    bootstrapAutoConnect,
    providerId,
    providers,
  } = useGatewayStore();
  const cachedBootstrapConfig = peekCachedCompanyConfig();
  const cachedBootstrapCompany =
    cachedBootstrapConfig
      ? (
          cachedBootstrapConfig.companies.find(
            (company) => company.id === cachedBootstrapConfig.activeCompanyId,
          ) ??
          cachedBootstrapConfig.companies[0] ??
          null
        )
      : null;
  const previousConnectedRef = useRef(connected);
  const hasSeenStableConnectionRef = useRef(connected);
  const lastKnownCompanyRef = useRef(activeCompany);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [authorityHealth, setAuthorityHealth] = useState<ReturnType<typeof extractAuthorityHealthSnapshot>>(null);
  const currentProvider = providers.find((provider) => provider.id === providerId);
  const effectiveAuthorityHealth = connected ? authorityHealth : null;
  const refreshAuthorityHealth = useCallback(async () => {
    if (!connected) {
      setAuthorityHealth(null);
      return;
    }
    try {
      const status = await gateway.getStatus();
      setAuthorityHealth(extractAuthorityHealthSnapshot(status));
    } catch {
      setAuthorityHealth(null);
    }
  }, [connected]);

  useEffect(() => {
    bootstrapAutoConnect();
  }, [bootstrapAutoConnect]);

  useEffect(() => {
    if (activeCompany) {
      lastKnownCompanyRef.current = activeCompany;
    }
  }, [activeCompany]);

  useEffect(() => {
    if (connected) {
      void loadConfig();
    }
  }, [connected, loadConfig]);

  useEffect(() => {
    if (!connected) {
      return;
    }
    void refreshAuthorityHealth();
    const handleFocus = () => {
      void refreshAuthorityHealth();
    };
    window.addEventListener("focus", handleFocus);
    return () => {
      window.removeEventListener("focus", handleFocus);
    };
  }, [connected, refreshAuthorityHealth]);

  useEffect(() => {
    if (!activeCompany || !connected) {
      return;
    }

    const companyAgentIds = new Set(activeCompany.employees.map((employee) => employee.agentId));
    const unsubscribe = gateway.subscribe("chat", (rawPayload) => {
      const payload = parseChatEventPayload(rawPayload);
      const sessionKey = payload?.sessionKey?.trim();
      if (!payload || !sessionKey) {
        return;
      }

      const actorId = resolveSessionActorId(sessionKey);
      if (!actorId || !companyAgentIds.has(actorId)) {
        return;
      }

      if (payload.state === "delta") {
        const deltaText = extractTextFromMessage(payload.message);
        if (!deltaText) {
          return;
        }

        const existing = readLiveChatSession(activeCompany.id, sessionKey);
        if (existing?.streamText && existing.streamText.length > deltaText.length) {
          return;
        }

        upsertLiveChatSession(activeCompany.id, sessionKey, {
          sessionKey,
          agentId: actorId,
          runId: payload.runId || existing?.runId || null,
          streamText: deltaText,
          isGenerating: true,
          startedAt: existing?.startedAt ?? Date.now(),
          updatedAt: Date.now(),
        });
        return;
      }

      if (payload.state === "final" || payload.state === "aborted" || payload.state === "error") {
        clearLiveChatSession(activeCompany.id, sessionKey);
      }
    });

    return () => unsubscribe();
  }, [activeCompany, connected]);

  useEffect(() => {
    // Avoid racing cached-config fallback against the initial auto-reconnect boot.
    if (
      !connected &&
      hasEverConnected &&
      autoConnectInitialized &&
      phase === "offline" &&
      !activeCompany &&
      !loading
    ) {
      void loadConfig();
    }
  }, [activeCompany, autoConnectInitialized, connected, hasEverConnected, loading, loadConfig, phase]);

  useEffect(() => {
    const previousConnected = previousConnectedRef.current;
    if (connected && !hasSeenStableConnectionRef.current) {
      hasSeenStableConnectionRef.current = true;
      previousConnectedRef.current = connected;
      return;
    }
    if (previousConnected && !connected) {
      toast.warning(
        t({ zh: "Authority 连接已断开", en: "Authority disconnected" }),
        t({
          zh: "系统正在自动重连。你可以继续停留在当前页面。",
          en: "The system is reconnecting automatically. You can stay on the current page.",
        }),
      );
    } else if (!previousConnected && connected) {
      toast.success(
        t({ zh: "Authority 已恢复连接", en: "Authority reconnected" }),
        t({
          zh: "本机权威源和执行能力已恢复。",
          en: "Local authority access and execution capability have been restored.",
        }),
      );
    }
    previousConnectedRef.current = connected;
  }, [connected, t]);

  if (
    !connected &&
    phase === "failed" &&
    location.pathname !== "/connect" &&
    location.pathname !== "/oauth/codex/callback"
  ) {
    return <Navigate to="/connect" replace />;
  }

  if (!connected && !hasEverConnected) {
    return (
      <>
        <ConnectPage />
        <ToastHost />
      </>
    );
  }

  const executorSetupRequired = effectiveAuthorityHealth
    ? requiresAuthorityExecutorOnboarding(effectiveAuthorityHealth)
    : false;
  if (
    connected &&
    executorSetupRequired &&
    location.pathname !== "/executor-setup" &&
    location.pathname !== "/oauth/codex/callback"
  ) {
    const returnTo = `${location.pathname}${location.search}${location.hash}`;
    return <Navigate to={`/executor-setup?returnTo=${encodeURIComponent(returnTo)}`} replace />;
  }

  const isFullScreenRoute = ["/select", "/create", "/connect", "/executor-setup", "/oauth/codex/callback"].includes(
    location.pathname,
  );
  let content: ReactNode;

  if (isFullScreenRoute) {
    content = (
      <div className="flex h-screen w-full bg-background text-foreground overflow-hidden">
        <main className="flex-1 flex flex-col h-full overflow-y-auto relative">
          <div className="absolute right-4 top-4 z-10">
            <LanguageSwitcher compact />
          </div>
          <Suspense fallback={<RouteLoadingScreen />}>
            <Routes>
              <Route path="/select" element={<CompanySelect />} />
              <Route path="/connect" element={<ConnectPage />} />
              <Route path="/executor-setup" element={<ExecutorSetupPage />} />
              <Route path="/create" element={<CompanyCreate />} />
              <Route path="/oauth/codex/callback" element={<CodexOAuthCallbackPage />} />
            </Routes>
          </Suspense>
        </main>
      </div>
    );
  } else {
    const companyBootstrapPending =
      !activeCompany &&
      (
        bootstrapPhase === "idle" ||
        bootstrapPhase === "restoring" ||
        loading ||
        (hasEverConnected && !autoConnectInitialized) ||
        phase === "connecting" ||
        phase === "reconnecting"
      );
    const fallbackCompany = activeCompany ?? cachedBootstrapCompany ?? lastKnownCompanyRef.current;
    const currentCompany = fallbackCompany;
    const shouldUseSilentRestoreShell = companyBootstrapPending && Boolean(currentCompany);

    if (companyBootstrapPending && !shouldUseSilentRestoreShell) {
      content = <CompanyBootstrapScreen />;
    } else if (!currentCompany && !shouldUseSilentRestoreShell) {
      content = <Navigate to="/select" replace />;
    } else {
      const resolvedCompany = currentCompany!;
      const sidebarBg = "bg-muted/30";
      const textIconColor = "text-primary";
      const linkHover = "hover:bg-secondary/50 hover:text-foreground";
      const isRouteActive = (path: string) => {
        if (path === "/ops") {
          return location.pathname === "/ops" || location.pathname === "/lobby";
        }
        return location.pathname === path || location.pathname.startsWith(`${path}/`);
      };
      const navClass = (path: string) => {
        return `flex items-center rounded-xl px-3 py-2 text-sm font-medium ${
          isRouteActive(path)
            ? "bg-secondary text-secondary-foreground shadow-sm"
            : `text-muted-foreground ${linkHover}`
        }`;
      };
      const navGroupLabelClass =
        "px-3 pt-3 text-[11px] font-semibold uppercase tracking-[0.18em] text-muted-foreground/80";
      const workspaceApps = getCompanyWorkspaceApps(resolvedCompany);
      const ceoEmployee =
        resolvedCompany.employees.find((employee) => employee.metaRole === "ceo") ?? null;
      const navGroups: NavGroup[] = [
        {
          label: t({ zh: "主线", en: "Primary" }),
          items: [
            { path: "/runtime", label: t({ zh: "运行态", en: "Runtime" }), icon: Activity, primary: true },
            { path: "/ceo", label: t({ zh: "CEO 首页", en: "CEO Home" }), icon: Building2 },
            {
              path: "/requirement",
              label: t({ zh: "需求中心", en: "Requirement Hub" }),
              icon: BookOpenCheck,
              primary: true,
            },
          ],
        },
        {
          label: t({ zh: "执行", en: "Execution" }),
          items: [
            { path: "/ops", label: "Ops", icon: ShieldAlert },
            { path: "/board", label: t({ zh: "工作看板", en: "Board" }), icon: LayoutDashboard },
            ...(workspaceApps.length > 0
              ? [{ path: "/workspace", label: t({ zh: "工作目录", en: "Workspace" }), icon: BookOpen }]
              : []),
          ],
        },
        {
          label: t({ zh: "项目", en: "Projects" }),
          items: [{ path: "/projects", label: t({ zh: "项目追踪", en: "Project Tracking" }), icon: Folder }],
        },
        {
          label: t({ zh: "组织", en: "Organization" }),
          items: [
            { path: "/employees", label: t({ zh: "员工管理", en: "Employees" }), icon: Users },
            { path: "/automation", label: t({ zh: "自动化", en: "Automation" }), icon: CalendarClock },
          ],
        },
        {
          label: t({ zh: "系统", en: "System" }),
          items: [
            { path: "/dashboard", label: t({ zh: "运营报表", en: "Operations Report" }), icon: BarChart },
            { path: "/settings", label: t({ zh: "系统设置", en: "Settings" }), icon: Settings },
          ],
        },
      ];

      const connectionIndicatorClass = connected
        ? "bg-green-500"
        : phase === "reconnecting" || phase === "connecting"
          ? "bg-amber-500 animate-pulse"
          : phase === "failed"
            ? "bg-rose-500"
            : "bg-red-500";
      const connectionLabel = connected
        ? t(
            { zh: "已连接到{provider}", en: "Connected to {provider}" },
            { provider: currentProvider?.label || t({ zh: "本机 authority", en: "local authority" }) },
          )
        : phase === "reconnecting" || phase === "connecting"
          ? t({ zh: "连接中断，正在重连", en: "Connection lost, reconnecting" })
          : phase === "failed"
            ? t({ zh: "重连失败，请重新配置连接", en: "Reconnect failed, please reconfigure the connection" })
            : t(
                { zh: "{provider} 已离线", en: "{provider} is offline" },
                { provider: currentProvider?.label || t({ zh: "本机 authority", en: "local authority" }) },
              );

      content = (
        <div className="flex h-screen w-full bg-background text-foreground overflow-hidden">
          {isMobileMenuOpen && (
            <div
              className="fixed inset-0 bg-background/80 backdrop-blur-sm z-40 md:hidden"
              onClick={() => setIsMobileMenuOpen(false)}
            />
          )}
          <aside
            onClickCapture={() => setIsMobileMenuOpen(false)}
            className={`fixed inset-y-0 left-0 z-50 w-64 border-r flex flex-col transition-transform duration-300 md:relative md:translate-x-0 bg-background md:bg-transparent ${sidebarBg} ${
              isMobileMenuOpen ? "translate-x-0" : "-translate-x-full"
            }`}
          >
            <div className="h-14 flex items-center px-4 border-b border-inherit">
              <Building2 className={`mr-2 h-5 w-5 ${textIconColor}`} />
              <span className="font-semibold tracking-tight">
                {t({ zh: "赛博公司", en: "Cyber Company" })}
              </span>
            </div>

            <nav className="flex-1 overflow-y-auto px-3 py-4">
              <div className="space-y-3">
                {navGroups.map((group) => (
                  <div key={group.label} className="space-y-1">
                    <div className={navGroupLabelClass}>{group.label}</div>
                    {group.items.map((item) => {
                      const Icon = item.icon;
                      return (
                        <Link
                          key={item.path}
                          to={item.path}
                          className={`${navClass(item.path)} ${
                            item.primary && !isRouteActive(item.path)
                              ? "border border-indigo-100 bg-indigo-50/60 text-indigo-800 hover:bg-indigo-100/80"
                              : ""
                          }`}
                        >
                          <Icon className="mr-3 h-4 w-4" />
                          {item.label}
                        </Link>
                      );
                    })}
                  </div>
                ))}
              </div>
            </nav>

            {ceoEmployee && (
              <div className="px-3 py-4 border-t border-inherit">
                <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2 px-2">
                  {t({ zh: "默认沟通入口", en: "Default Contact" })}
                </div>
                <Link
                  to={`/chat/${ceoEmployee.agentId}`}
                  className={`block rounded-xl border px-3 py-3 transition-colors ${
                    isRouteActive(`/chat/${ceoEmployee.agentId}`)
                      ? "border-indigo-200 bg-indigo-50 text-indigo-700"
                      : "border-slate-200 bg-white text-slate-700 hover:bg-slate-50"
                  }`}
                >
                  <div className="text-sm font-semibold">{t({ zh: "直接联系 CEO", en: "Message CEO" })}</div>
                  <div className="mt-1 text-xs leading-5 text-slate-500">
                    {t({
                      zh: "默认先由 CEO 吸收目标、判断组织和调度后台管理层。",
                      en: "Start with the CEO by default to intake goals, assess the org, and coordinate leadership.",
                    })}
                  </div>
                </Link>
                <div className="mt-3 px-2 text-[11px] leading-5 text-muted-foreground">
                  {t({
                    zh: "其他员工与管理层会话仍保留在员工页和完整聊天中，首页不再默认全部展开。",
                    en: "Other employee and leadership conversations remain in the employee pages and full chat views.",
                  })}
                </div>
              </div>
            )}

            <div className="p-4 border-t border-inherit space-y-2">
              <LanguageSwitcher />
              <Link
                to="/select"
                className={`flex items-center text-sm font-medium ${isRouteActive("/select") ? "text-foreground bg-secondary/50" : `text-muted-foreground ${linkHover}`} py-2 px-1 rounded-md`}
              >
                <Building2 className="mr-3 h-4 w-4" />
                {t({ zh: "切换公司", en: "Switch Company" })}
              </Link>
            </div>
          </aside>

          <main className="relative flex h-full min-w-0 flex-1 flex-col overflow-hidden">
            {!isChatRoute ? (
              <header className="h-14 border-b border-inherit flex items-center justify-between px-4 md:px-6 shrink-0 z-20 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
                <div className="flex items-center gap-2 md:gap-4">
                  <button
                    type="button"
                    className="md:hidden h-8 w-8 -ml-2 inline-flex items-center justify-center rounded-md hover:bg-muted text-muted-foreground"
                    onClick={() => setIsMobileMenuOpen(true)}
                  >
                    <Menu className="w-5 h-5" />
                    <span className="sr-only">{t({ zh: "切换侧边栏", en: "Toggle sidebar" })}</span>
                  </button>
                  <h1 className="text-base md:text-lg font-semibold truncate max-w-[150px] md:max-w-none">
                    {resolvedCompany.icon || "🏢"} {resolvedCompany.name || t({ zh: "加载中...", en: "Loading..." })}
                  </h1>
                  <span className="text-sm hidden md:inline-block text-muted-foreground truncate">
                    {resolvedCompany.description || ""}
                  </span>
                </div>
                <div className="flex items-center gap-4">
                  <LanguageSwitcher compact />
                  <MainlineQuickSwitch hasPrimaryRequirement={hasPrimaryRequirement} />
                  <div className="flex items-center gap-2">
                    <div className={`h-2 w-2 rounded-full ${connectionIndicatorClass}`} />
                    <span className="text-sm text-muted-foreground mr-2">{connectionLabel}</span>
                  </div>
                </div>
              </header>
            ) : (
              <header className="flex h-11 items-center justify-between border-b border-inherit bg-background/92 px-3 backdrop-blur md:hidden">
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    className="inline-flex h-8 w-8 items-center justify-center rounded-md text-muted-foreground hover:bg-muted"
                    onClick={() => setIsMobileMenuOpen(true)}
                  >
                    <Menu className="h-5 w-5" />
                    <span className="sr-only">{t({ zh: "切换侧边栏", en: "Toggle sidebar" })}</span>
                  </button>
                  <div className="truncate text-sm font-semibold">
                    {resolvedCompany.icon || "🏢"} {resolvedCompany.name || t({ zh: "加载中...", en: "Loading..." })}
                  </div>
                </div>
                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                  <div className={`h-2 w-2 rounded-full ${connectionIndicatorClass}`} />
                  <span>{connectionLabel}</span>
                </div>
              </header>
            )}

            <div className="flex-1 overflow-auto relative z-10">
              <AuthorityHealthBanner />
              {shouldUseSilentRestoreShell ? (
                <div className="border-b bg-background/90 px-4 py-2 text-xs text-muted-foreground backdrop-blur supports-[backdrop-filter]:bg-background/70">
                  {t({
                    zh: "正在后台恢复最新状态，你可以继续停留在当前页面。",
                    en: "Restoring the latest state in the background. You can stay on this page.",
                  })}
                </div>
              ) : null}
              <Suspense fallback={<RouteLoadingScreen />}>
                <Routes>
                  <Route path="/" element={<Navigate to="/runtime" replace />} />
                  <Route path="/ceo" element={<CEOHomePage />} />
                  <Route path="/ops" element={<CompanyLobby />} />
                  <Route path="/lobby" element={<Navigate to="/ops" replace />} />
                  <Route path="/runtime" element={<RuntimeInspectorPage />} />
                  <Route path="/chat/:agentId" element={<ChatPage />} />
                  <Route path="/employees" element={<EmployeeList />} />
                  <Route path="/employees/:id" element={<EmployeeProfile />} />
                  <Route path="/board" element={<BoardPage />} />
                  <Route path="/requirement" element={<RequirementCenterPage />} />
                  <Route path="/projects" element={<ProjectsPage />} />
                  <Route path="/projects/:id" element={<ProjectDetailPage />} />
                  <Route path="/workspace" element={<WorkspacePage />} />
                  <Route path="/automation" element={<AutomationPage />} />
                  <Route path="/dashboard" element={<DashboardPage />} />
                  <Route path="/settings" element={<SettingsPage />} />
                  <Route path="/executor-setup" element={<ExecutorSetupPage />} />
                  <Route path="/oauth/codex/callback" element={<CodexOAuthCallbackPage />} />
                  <Route path="*" element={<Navigate to="/runtime" replace />} />
                </Routes>
              </Suspense>
            </div>
          </main>
        </div>
      );
    }
  }

  return (
    <>
      <GatewayStatusBanner />
      <OrgAutopilotHost />
      {content}
      <ToastHost />
      <ApprovalModalHost />
      <CompanyAuthoritySyncHost />
      <GatewayNotificationHost />
      <RequirementAggregateHost />
    </>
  );
}
