import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Building2, Plus, Sparkles, CheckCircle2 } from "lucide-react";
import { useCompanyCreateApp } from "../../application/company/create-company";
import { parseCompanyBlueprint } from "../../application/company/blueprint";
import { toast } from "../../system/toast-store";
import { useTranslate } from "../../i18n";

export function CompanyCreatePresentationPage() {
  const navigate = useNavigate();
  const t = useTranslate();

  const [step, setStep] = useState(1);
  const [companyName, setCompanyName] = useState("");
  const [createMode, setCreateMode] = useState<"blank" | "blueprint">("blank");
  const [blueprintText, setBlueprintText] = useState("");
  const blueprintPreview = useMemo(() => {
    if (createMode !== "blueprint" || !blueprintText.trim()) {
      return null;
    }
    return parseCompanyBlueprint(blueprintText);
  }, [blueprintText, createMode]);
  const blueprintValid = createMode !== "blueprint" || Boolean(blueprintPreview);

  const {
    creationError,
    creationProgress,
    creationTotalSteps,
    handleCreate,
    isCreating,
  } = useCompanyCreateApp({
    companyName,
    mode: createMode,
    blueprintText,
  });

  const progressPercent = Math.round((creationProgress.current / creationTotalSteps) * 100);
  const canSubmit =
    createMode === "blank"
      ? companyName.trim().length >= 2
      : blueprintText.trim().length > 0 && blueprintValid;

  return (
    <div className="min-h-screen bg-slate-50 py-8 px-4 sm:px-6 lg:px-8 flex flex-col items-center">
      <div className="max-w-3xl w-full">
        <div className="mb-5 space-y-1">
           <h1 className="text-xl font-semibold text-slate-900">
             {t({ zh: "创建新公司", en: "Create a New Company" })}
           </h1>
           <p className="text-sm text-slate-500">
             {t({
               zh: "选择空白创建或导入 blueprint.v1，完成后即可进入总部大厅。",
               en: "Start from scratch or import a blueprint.v1 file, then continue into HQ.",
             })}
           </p>
        </div>

        <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
          <div className="border-b border-slate-100 bg-slate-50 px-5 py-3 text-sm text-slate-500">
            {t({ zh: "当前步骤：", en: "Current step: " })}
            {step === 1
              ? createMode === "blueprint"
                ? t({ zh: "导入蓝图", en: "Import Blueprint" })
                : t({ zh: "填写信息", en: "Enter Details" })
              : t({ zh: "创建公司", en: "Create Company" })}
          </div>

          <div className="p-8">
            {step === 1 && (
               <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500 max-w-lg mx-auto py-8">
                 <h2 className="text-2xl font-bold text-center">
                   {t({ zh: "选择公司创建方式", en: "Choose a creation mode" })}
                 </h2>
                 <p className="text-slate-500 text-center text-sm">
                   {t({
                     zh: "空白创建适合新团队，蓝图导入适合复制现有组织结构。",
                     en: "Blank mode fits new teams, while blueprint import is for cloning an existing org structure.",
                   })}
                 </p>

                 <div className="grid grid-cols-2 gap-3 pt-2">
                   <button
                     type="button"
                     className={`rounded-xl border px-4 py-3 text-sm font-semibold transition ${
                       createMode === "blank"
                         ? "border-indigo-600 bg-indigo-50 text-indigo-700"
                         : "border-slate-200 bg-white text-slate-500 hover:border-slate-300"
                     }`}
                     onClick={() => setCreateMode("blank")}
                   >
                     {t({ zh: "空白创建", en: "Blank Setup" })}
                   </button>
                   <button
                     type="button"
                     className={`rounded-xl border px-4 py-3 text-sm font-semibold transition ${
                       createMode === "blueprint"
                         ? "border-indigo-600 bg-indigo-50 text-indigo-700"
                         : "border-slate-200 bg-white text-slate-500 hover:border-slate-300"
                     }`}
                     onClick={() => setCreateMode("blueprint")}
                   >
                     {t({ zh: "从蓝图导入", en: "Import Blueprint" })}
                   </button>
                 </div>

                 <div className="pt-4">
                   <div className="flex items-center border-2 border-slate-200 rounded-xl overflow-hidden focus-within:border-indigo-600 focus-within:ring-4 focus-within:ring-indigo-100 transition-all">
                     <span className="pl-4 pr-3 text-slate-400 bg-slate-50 h-full py-4 border-r border-slate-200">
                       <Building2 size={24} />
                     </span>
                     <input
                       autoFocus
                       type="text"
                       value={companyName}
                       onChange={e => setCompanyName(e.target.value)}
                       placeholder={
                         createMode === "blueprint"
                           ? t({ zh: "公司名称（可选）", en: "Company name (optional)" })
                           : t({
                               zh: "例如：小说工作室 / 客服自动化团队",
                               en: "Example: Fiction Studio / Support Automation Team",
                             })
                       }
                       className="flex-1 px-4 py-4 outline-none text-lg font-bold text-slate-800 placeholder:font-normal placeholder:text-slate-300 bg-transparent"
                     />
                   </div>
                 </div>

                 {createMode === "blueprint" ? (
                   <div className="space-y-3 pt-2">
                     <div className="text-sm font-semibold text-slate-700">
                       {t({ zh: "蓝图内容", en: "Blueprint Content" })}
                     </div>
                     <textarea
                       rows={6}
                       value={blueprintText}
                       onChange={(event) => setBlueprintText(event.target.value)}
                       placeholder={t({
                         zh: "粘贴 blueprint.v1 JSON（可直接复制 Lobby 的蓝图导出内容）",
                         en: "Paste blueprint.v1 JSON here (you can copy a blueprint export from the lobby).",
                       })}
                       className="w-full resize-y rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-700 outline-none focus:border-indigo-600 focus:ring-4 focus:ring-indigo-100"
                     />
                     <div className="flex items-center justify-between text-xs text-slate-500">
                       <span>{t({ zh: "支持包含 ```json``` 的蓝图文本", en: "Blueprint text may include ```json``` fences" })}</span>
                       <label className="cursor-pointer text-indigo-600 hover:text-indigo-700">
                         {t({ zh: "导入文件", en: "Import File" })}
                         <input
                           type="file"
                           accept=".json,.txt"
                           className="hidden"
                           onChange={(event) => {
                             const file = event.target.files?.[0];
                             if (!file) {
                               return;
                             }
                             const reader = new FileReader();
                             reader.onload = (e) => {
                               const content = typeof e.target?.result === "string" ? e.target.result : "";
                               setBlueprintText(content);
                             };
                             reader.readAsText(file);
                           }}
                         />
                       </label>
                     </div>
                     {blueprintText.trim() ? (
                       blueprintPreview ? (
                         <div className="rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-700">
                           {t(
                             {
                               zh: "已解析：{employeeCount} 名成员，{departmentCount} 个部门。",
                               en: "Parsed successfully: {employeeCount} members and {departmentCount} departments.",
                             },
                             {
                               employeeCount: blueprintPreview.employees.length,
                               departmentCount: blueprintPreview.departments.length,
                             },
                           )}
                         </div>
                       ) : (
                         <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
                           {t({
                             zh: "蓝图无法解析，请检查 JSON 格式与 blueprint.v1 结构。",
                             en: "The blueprint could not be parsed. Check the JSON format and blueprint.v1 structure.",
                           })}
                         </div>
                       )
                     ) : null}
                   </div>
                 ) : null}

                 <div className="pt-8 flex gap-3">
                    <button
                      disabled={!canSubmit || isCreating}
                      onClick={() => {
                        setStep(2);
                        void handleCreate()
                          .then((result) => {
                            if (!result) {
                              return;
                            }
                            toast.success(
                              result.warnings?.length
                                ? t({ zh: "公司已创建，执行器补齐中", en: "Company created, executor provisioning in progress" })
                                : t({ zh: "公司创建完成", en: "Company created" }),
                              result.warnings?.length
                                ? t(
                                    {
                                      zh: "「{companyName}」已经创建成功，但执行器仍在补齐。你现在就可以先进入工作目录。",
                                      en: '"{companyName}" was created successfully, but the executor is still being provisioned. You can enter the workspace now.',
                                    },
                                    { companyName: result.companyName },
                                  )
                                : t(
                                    {
                                      zh: "「{companyName}」已上线。",
                                      en: '"{companyName}" is now live.',
                                    },
                                    { companyName: result.companyName },
                                  ),
                            );
                            window.setTimeout(() => {
                              navigate("/runtime");
                            }, 1500);
                          })
                          .catch((error) => {
                            toast.error(
                              t({ zh: "公司创建失败", en: "Company creation failed" }),
                              error instanceof Error ? error.message : String(error),
                            );
                          });
                      }}
                     className="flex-1 bg-indigo-600 disabled:bg-slate-300 disabled:cursor-not-allowed hover:bg-indigo-700 text-white px-8 py-3 rounded-xl font-bold transition-colors shadow-sm inline-flex justify-center items-center gap-2"
                   >
                     {t({ zh: "创建并进入", en: "Create and Enter" })} <Plus size={18} />
                   </button>
                 </div>
               </div>
            )}

            {step === 2 && (
               <div className="py-8 animate-in fade-in zoom-in duration-500">
                  <div className="text-center mb-10">
                     <div className="inline-block relative">
                       <div className="absolute inset-0 bg-indigo-500/20 blur-xl rounded-full"></div>
                       <Sparkles className={`w-12 h-12 text-indigo-600 relative z-10 ${isCreating ? 'animate-pulse' : ''}`} />
                     </div>
                     <h2 className="text-2xl font-bold mt-4">
                       {isCreating
                         ? t({ zh: "正在创建公司...", en: "Creating company..." })
                         : t({ zh: "公司已准备好", en: "Company is ready" })}
                     </h2>
                     <p className="text-slate-500 mt-2">
                       {t({
                         zh: "请保持当前页面打开，这通常只需要几十秒。",
                         en: "Keep this page open. This usually takes only a few dozen seconds.",
                       })}
                     </p>
                  </div>

                  <div className="rounded-xl border border-slate-200 bg-slate-50 p-6">
                    <div className="mb-2 flex items-center justify-between text-xs text-slate-500">
                      <span>{t({ zh: "部署进度", en: "Deployment progress" })}</span>
                      <span>{Math.min(creationProgress.current, creationTotalSteps)} / {creationTotalSteps}</span>
                    </div>
                    <div className="h-2 rounded-full bg-slate-200">
                      <div className="h-2 rounded-full bg-indigo-600 transition-all duration-300" style={{ width: `${progressPercent}%` }} />
                    </div>
                    <div className="mt-3 text-sm text-slate-700">{creationProgress.message}</div>

                    <div className="mt-4 max-h-44 space-y-2 overflow-auto rounded-lg border border-slate-200 bg-white p-3 text-sm">
                      {creationProgress.history.length === 0 ? (
                        <div className="text-slate-400">
                          {t({ zh: "等待部署任务开始...", en: "Waiting for deployment to start..." })}
                        </div>
                      ) : (
                        creationProgress.history.map((item, idx) => (
                          <div key={`${item}-${idx}`} className="flex items-start gap-2 text-slate-600">
                            <CheckCircle2 size={14} className="mt-0.5 text-emerald-500" />
                            <span>{item}</span>
                          </div>
                        ))
                      )}
                    </div>

                    {creationError ? (
                      <div className="mt-4 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
                        {t({ zh: "创建失败：", en: "Creation failed: " })}
                        {creationError}
                      </div>
                    ) : null}

                    {!isCreating && !creationError && creationProgress.current >= creationTotalSteps ? (
                      <div className="mt-4 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm font-semibold text-emerald-700">
                        {t({
                          zh: "已完成部署，正在跳转到总部大厅。",
                          en: "Deployment completed. Redirecting to HQ.",
                        })}
                      </div>
                    ) : null}
                  </div>
                </div>
             )}
          </div>
        </div>
      </div>
    </div>
  );
}
