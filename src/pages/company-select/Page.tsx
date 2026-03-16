import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useGatewayStore } from "../../application/gateway";
import { useCompanyShellCommands, useCompanyShellQuery } from "../../application/company/shell";
import { ActionFormDialog } from "../../ui/action-form-dialog";
import { toast } from "../../system/toast-store";
import { Plus, ArrowRight, Loader, Trash2, AlertTriangle, RefreshCcw } from "lucide-react";
import type { Company } from "../../domain/org/types";
import { isReservedSystemCompany } from "../../domain/org/system-company";
import { useTranslate } from "../../i18n";

export function CompanySelectPresentationPage() {
  const navigate = useNavigate();
  const t = useTranslate();
  const { config, loading: storeLoading } = useCompanyShellQuery();
  const { switchCompany, deleteCompany, loadConfig, retryCompanyProvisioning } = useCompanyShellCommands();
  const { connected } = useGatewayStore();
  const [initLoading, setInitLoading] = useState(true);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<Company | null>(null);
  const [deleteSubmitting, setDeleteSubmitting] = useState(false);
  const [retryingCompanyId, setRetryingCompanyId] = useState<string | null>(null);

  // 强制确保配置被加载
  useEffect(() => {
    async function init() {
      if (connected && !config) {
        await loadConfig();
      }
      setInitLoading(false);
    }
    init();
  }, [connected, config, loadConfig]);

  const isLoading = initLoading || (storeLoading && !deleteDialogOpen && !deleteSubmitting);
  const companies = config?.companies || [];

  const handleSelect = (id: string) => {
    switchCompany(id);
    navigate("/runtime");
  };

  const handleDeleteRequest = (company: Company) => {
    if (isReservedSystemCompany(company)) {
      toast.info(
        t({ zh: "默认公司已锁定", en: "Default company is locked" }),
        t({
          zh: "这个系统公司用于承接 OpenClaw 的 main agent，当前不可删除。",
          en: "This system company backs the OpenClaw main agent and cannot be deleted.",
        }),
      );
      return;
    }
    setDeleteTarget(company);
    setDeleteDialogOpen(true);
  };

  const handleDeleteSubmit = async () => {
    if (!deleteTarget) {
      return;
    }

    setDeleteSubmitting(true);
    try {
      await deleteCompany(deleteTarget.id);
      toast.success(
        t({ zh: "公司已删除", en: "Company deleted" }),
        t(
          {
            zh: "已确认「{companyName}」相关 agent 已从 OpenClaw 删除，并完成公司数据清理。",
            en: 'Confirmed that agents for "{companyName}" were removed from OpenClaw and company data was cleaned up.',
          },
          { companyName: deleteTarget.name },
        ),
      );
      setDeleteDialogOpen(false);
      setDeleteTarget(null);
      navigate("/select", { replace: true });
    } catch (error) {
      toast.error(t({ zh: "删除失败", en: "Delete failed" }), error instanceof Error ? error.message : String(error));
    } finally {
      setDeleteSubmitting(false);
    }
  };

  const handleRetryProvisioning = async (companyId: string) => {
    setRetryingCompanyId(companyId);
    try {
      await retryCompanyProvisioning(companyId);
      toast.success(
        t({ zh: "已触发执行器补齐", en: "Executor retry triggered" }),
        t({
          zh: "公司已保留，系统正在重新确认 OpenClaw agent 和上下文文件。",
          en: "The company is preserved and the system is revalidating OpenClaw agents and context files.",
        }),
      );
    } catch (error) {
      toast.error(t({ zh: "补齐失败", en: "Retry failed" }), error instanceof Error ? error.message : String(error));
    } finally {
      setRetryingCompanyId(null);
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-slate-50 flex flex-col items-center justify-center p-4">
        <Loader className="w-12 h-12 text-indigo-400 animate-spin mb-4" />
        <h2 className="text-slate-600 font-medium animate-pulse">
          {t({ zh: "正在加载可用公司...", en: "Loading available companies..." })}
        </h2>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col items-center py-8 px-4 overflow-y-auto">
      <div className="max-w-5xl w-full relative z-10 flex-1">
        <div className="mb-5 space-y-1">
          <h1 className="text-xl font-semibold text-slate-900">
            {t({ zh: "选择要继续推进的公司", en: "Choose a company to continue" })}
          </h1>
          <p className="text-sm text-slate-500">
            {t({
              zh: "继续一个已有团队，或创建新的 AI 公司。",
              en: "Resume an existing team or create a new AI company.",
            })}
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {companies.map((c) => (
            <div
              key={c.id}
              className="group bg-white p-6 rounded-2xl shadow-sm border border-slate-200 hover:border-indigo-600 hover:ring-4 hover:ring-indigo-50 transition-all text-left flex flex-col items-start"
            >
              <button
                type="button"
                onClick={() => handleSelect(c.id)}
                className="w-full text-left flex flex-1 flex-col items-start"
              >
                <div className="text-4xl mb-4">{c.icon || "🏢"}</div>
                <div className="mb-2 flex w-full items-center gap-2">
                  <h3 className="truncate text-xl font-bold text-slate-900">{c.name}</h3>
                  {isReservedSystemCompany(c) ? (
                    <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[11px] font-medium text-slate-600">
                      {t({ zh: "默认", en: "Default" })}
                    </span>
                  ) : null}
                </div>
                <p className="text-sm text-slate-500 mb-4 flex-1 line-clamp-2">
                  {c.description || t({ zh: "暂无组织描述", en: "No organization description yet" })}
                </p>
                {c.system?.executorProvisioning && c.system.executorProvisioning.state !== "ready" ? (
                  <div className="mb-4 w-full rounded-xl border border-amber-200 bg-amber-50 px-3 py-3 text-xs leading-5 text-amber-950">
                    <div className="flex items-center gap-2 font-medium">
                      <AlertTriangle size={14} />
                      {t({ zh: "执行器仍在补齐", en: "Executor provisioning in progress" })}
                    </div>
                    <div className="mt-1">
                      {t({
                        zh: "这家公司已经创建成功，但 OpenClaw agent 仍在补齐。你现在就可以进入工作目录继续看内容和配置入口。",
                        en: "The company was created successfully, but OpenClaw agents are still being provisioned. You can already enter the workspace and continue from there.",
                      })}
                    </div>
                    {c.system.executorProvisioning.lastError ? (
                      <div className="mt-2 line-clamp-2 text-amber-900/80">
                        {t({ zh: "最近原因：", en: "Latest reason: " })}
                        {c.system.executorProvisioning.lastError}
                      </div>
                    ) : null}
                  </div>
                ) : null}
              </button>

              <div className="w-full flex items-center justify-between mt-auto pt-4 border-t border-slate-100">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-xs text-slate-500 bg-slate-100 px-2 py-1 rounded font-medium">
                    {t(
                      { zh: "{count} 名成员", en: "{count} members" },
                      { count: c.employees?.length || 0 },
                    )}
                  </span>
                  {c.system?.executorProvisioning && c.system.executorProvisioning.state !== "ready" ? (
                    <span className="text-xs bg-amber-100 text-amber-800 px-2 py-1 rounded font-medium">
                      {t({ zh: "执行器补齐中", en: "Provisioning executor" })}
                    </span>
                  ) : null}
                  {isReservedSystemCompany(c) ? (
                    <span className="text-xs text-indigo-600 bg-indigo-50 px-2 py-1 rounded font-medium">
                      {t({ zh: "映射 main", en: "Mapped to main" })}
                    </span>
                  ) : null}
                </div>
                <div className="flex items-center gap-2">
                  {c.system?.executorProvisioning && c.system.executorProvisioning.state !== "ready" ? (
                    <button
                      type="button"
                      onClick={() => void handleRetryProvisioning(c.id)}
                      disabled={retryingCompanyId === c.id}
                      className="inline-flex items-center gap-1 rounded-lg border border-amber-200 px-2.5 py-1.5 text-xs font-medium text-amber-700 transition hover:bg-amber-50 disabled:cursor-not-allowed disabled:opacity-60"
                    >
                      <RefreshCcw size={14} className={retryingCompanyId === c.id ? "animate-spin" : undefined} />
                      {t({ zh: "重试补齐", en: "Retry" })}
                    </button>
                  ) : null}
                  {isReservedSystemCompany(c) ? null : (
                    <button
                      type="button"
                      onClick={() => handleDeleteRequest(c)}
                      className="inline-flex items-center gap-1 rounded-lg border border-rose-200 px-2.5 py-1.5 text-xs font-medium text-rose-600 transition hover:bg-rose-50"
                    >
                      <Trash2 size={14} />
                      {t({ zh: "删除", en: "Delete" })}
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={() => handleSelect(c.id)}
                    className="inline-flex items-center gap-1 text-indigo-600 group-hover:translate-x-1 transition-transform"
                  >
                    {t({ zh: "进入", en: "Enter" })}
                    <ArrowRight size={18} />
                  </button>
                </div>
              </div>
            </div>
          ))}

          <button
            onClick={() => navigate("/create")}
            className="group bg-indigo-50/50 p-6 rounded-2xl border-2 border-dashed border-indigo-200 hover:border-indigo-600 hover:bg-indigo-50 transition-all text-left flex flex-col items-center justify-center min-h-[220px]"
          >
            <div className="bg-white text-indigo-600 w-14 h-14 rounded-full flex items-center justify-center mb-4 shadow-sm group-hover:scale-110 transition-transform">
              <Plus size={24} />
            </div>
            <h3 className="text-lg font-bold text-indigo-900 mb-1">
              {t({ zh: "新建公司", en: "Create Company" })}
            </h3>
            <p className="text-sm text-indigo-600/70 text-center px-4">
              {t({
                zh: "从 CEO 开始搭建一个新的 AI 团队",
                en: "Start a new AI team with the CEO as the entry point.",
              })}
            </p>
          </button>
        </div>
      </div>

      <ActionFormDialog
        open={deleteDialogOpen}
        onOpenChange={(open) => {
          setDeleteDialogOpen(open);
          if (!open) {
            setDeleteTarget(null);
          }
        }}
        title="删除公司"
        description={
          deleteTarget
            ? t(
                {
                  zh: "删除后会移除「{companyName}」的公司配置，并清理该公司独占员工的会话、归档、自动化和 agent 文件内容。请输入公司名确认。",
                  en: 'Deleting will remove the configuration for "{companyName}" and clean up exclusive sessions, archives, automations, and agent files. Enter the company name to confirm.',
                },
                { companyName: deleteTarget.name },
              )
            : t({ zh: "请输入公司名确认删除。", en: "Enter the company name to confirm deletion." })
        }
        confirmLabel={t({ zh: "删除公司", en: "Delete Company" })}
        busy={deleteSubmitting}
        fields={[
          {
            name: "companyName",
            label: t({ zh: "输入公司名确认", en: "Type company name to confirm" }),
            placeholder: deleteTarget?.name ?? "",
            required: true,
            confirmationText: deleteTarget?.name ?? "",
          },
        ]}
        onSubmit={handleDeleteSubmit}
      />
    </div>
  );
}
