import { useState } from "react";
import { useCompanyShellCommands } from "./shell";
import { createAuthorityCompany } from "../gateway/authority-control";

export function useCompanyCreateApp(input: {
  companyName: string;
  mode?: "blank" | "blueprint";
  blueprintText?: string | null;
}) {
  const { loadConfig, switchCompany } = useCompanyShellCommands();
  const creationTotalSteps = 4;
  const [isCreating, setIsCreating] = useState(false);
  const [creationError, setCreationError] = useState<string | null>(null);
  const [creationProgress, setCreationProgress] = useState<{
    current: number;
    message: string;
    history: string[];
  }>({
    current: 0,
    message: "等待开始...",
    history: [],
  });

  const updateProgress = (current: number, message: string) => {
    setCreationProgress((state) => ({
      current,
      message,
      history: [...state.history, message],
    }));
  };

  const handleCreate = async () => {
    const finalCompanyName = (input.companyName || "").trim();
    const mode = input.mode ?? "blank";
    const blueprintText = mode === "blueprint" ? (input.blueprintText || "").trim() : "";

    if (mode !== "blueprint" && !finalCompanyName) {
      return null;
    }
    if (mode === "blueprint" && !blueprintText) {
      return null;
    }
    setIsCreating(true);
    setCreationError(null);
    setCreationProgress({ current: 0, message: "等待开始...", history: [] });
    updateProgress(
      1,
      mode === "blueprint"
        ? `正在导入蓝图并创建公司${finalCompanyName ? `「${finalCompanyName}」` : ""}...`
        : `正在创建公司「${finalCompanyName}」...`,
    );

    try {
      updateProgress(2, "正在在 authority 中初始化组织...");
      const created = await createAuthorityCompany({
        companyName: mode === "blueprint" ? finalCompanyName : (finalCompanyName || "新公司"),
        templateId: "blank",
        blueprintText: mode === "blueprint" ? blueprintText : undefined,
      });

      updateProgress(
        3,
        created.warnings.length > 0
          ? `公司已创建，执行器仍在补齐（${created.warnings[0]}），正在刷新前端上下文...`
          : `已创建 ${created.company.employees.length} 名成员，正在刷新前端上下文...`,
      );
      await loadConfig();
      await switchCompany(created.company.id);
      updateProgress(
        4,
        created.warnings.length > 0
          ? "公司已注册到本机 authority，执行器补齐中，准备进入总部大厅..."
          : "公司已注册到本机 authority，准备进入总部大厅...",
      );
      setIsCreating(false);
      return { companyId: created.company.id, companyName: finalCompanyName, warnings: created.warnings };
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      setCreationError(message);
      setIsCreating(false);
      throw error;
    }
  };

  return {
    creationError,
    creationProgress,
    creationTotalSteps,
    handleCreate,
    isCreating,
  };
}
