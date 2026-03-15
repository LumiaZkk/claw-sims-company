import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Building2, Plus, Sparkles, CheckCircle2 } from "lucide-react";
import { useCompanyCreateApp } from "../../application/company/create-company";
import { parseCompanyBlueprint } from "../../application/company/blueprint";
import { toast } from "../../system/toast-store";

export function CompanyCreatePresentationPage() {
  const navigate = useNavigate();

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
           <h1 className="text-xl font-semibold text-slate-900">创建新公司</h1>
           <p className="text-sm text-slate-500">
             选择空白创建或导入 blueprint.v1，完成后即可进入总部大厅。
           </p>
        </div>

        <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
          <div className="border-b border-slate-100 bg-slate-50 px-5 py-3 text-sm text-slate-500">
            当前步骤：{step === 1 ? (createMode === "blueprint" ? "导入蓝图" : "填写信息") : "创建公司"}
          </div>

          <div className="p-8">
            {step === 1 && (
               <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500 max-w-lg mx-auto py-8">
                 <h2 className="text-2xl font-bold text-center">选择公司创建方式</h2>
                 <p className="text-slate-500 text-center text-sm">
                   空白创建适合新团队，蓝图导入适合复制现有组织结构。
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
                     空白创建
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
                     从蓝图导入
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
                       placeholder={createMode === "blueprint" ? "公司名称（可选）" : "例如：小说工作室 / 客服自动化团队"}
                       className="flex-1 px-4 py-4 outline-none text-lg font-bold text-slate-800 placeholder:font-normal placeholder:text-slate-300 bg-transparent"
                     />
                   </div>
                 </div>

                 {createMode === "blueprint" ? (
                   <div className="space-y-3 pt-2">
                     <div className="text-sm font-semibold text-slate-700">蓝图内容</div>
                     <textarea
                       rows={6}
                       value={blueprintText}
                       onChange={(event) => setBlueprintText(event.target.value)}
                       placeholder="粘贴 blueprint.v1 JSON（可直接复制 Lobby 的蓝图导出内容）"
                       className="w-full resize-y rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-700 outline-none focus:border-indigo-600 focus:ring-4 focus:ring-indigo-100"
                     />
                     <div className="flex items-center justify-between text-xs text-slate-500">
                       <span>支持包含 ```json``` 的蓝图文本</span>
                       <label className="cursor-pointer text-indigo-600 hover:text-indigo-700">
                         导入文件
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
                           已解析：{blueprintPreview.employees.length} 名成员，{blueprintPreview.departments.length} 个部门。
                         </div>
                       ) : (
                         <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
                           蓝图无法解析，请检查 JSON 格式与 blueprint.v1 结构。
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
                              result.warnings?.length ? "公司已创建，执行器补齐中" : "公司创建完成",
                              result.warnings?.length
                                ? `「${result.companyName}」已经创建成功，但执行器仍在补齐。你现在就可以先进入工作目录。`
                                : `「${result.companyName}」已上线。`,
                            );
                            window.setTimeout(() => {
                              navigate("/runtime");
                            }, 1500);
                          })
                          .catch((error) => {
                            toast.error("公司创建失败", error instanceof Error ? error.message : String(error));
                          });
                      }}
                     className="flex-1 bg-indigo-600 disabled:bg-slate-300 disabled:cursor-not-allowed hover:bg-indigo-700 text-white px-8 py-3 rounded-xl font-bold transition-colors shadow-sm inline-flex justify-center items-center gap-2"
                   >
                     创建并进入 <Plus size={18} />
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
                     <h2 className="text-2xl font-bold mt-4">{isCreating ? "正在创建公司..." : "公司已准备好"}</h2>
                     <p className="text-slate-500 mt-2">请保持当前页面打开，这通常只需要几十秒。</p>
                  </div>

                  <div className="rounded-xl border border-slate-200 bg-slate-50 p-6">
                    <div className="mb-2 flex items-center justify-between text-xs text-slate-500">
                      <span>部署进度</span>
                      <span>{Math.min(creationProgress.current, creationTotalSteps)} / {creationTotalSteps}</span>
                    </div>
                    <div className="h-2 rounded-full bg-slate-200">
                      <div className="h-2 rounded-full bg-indigo-600 transition-all duration-300" style={{ width: `${progressPercent}%` }} />
                    </div>
                    <div className="mt-3 text-sm text-slate-700">{creationProgress.message}</div>

                    <div className="mt-4 max-h-44 space-y-2 overflow-auto rounded-lg border border-slate-200 bg-white p-3 text-sm">
                      {creationProgress.history.length === 0 ? (
                        <div className="text-slate-400">等待部署任务开始...</div>
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
                        创建失败：{creationError}
                      </div>
                    ) : null}

                    {!isCreating && !creationError && creationProgress.current >= creationTotalSteps ? (
                      <div className="mt-4 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm font-semibold text-emerald-700">
                        已完成部署，正在跳转到总部大厅。
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
