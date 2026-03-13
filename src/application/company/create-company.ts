import { useMemo, useState } from "react";
import { useCompanyShellCommands, useCompanyShellQuery } from "./shell";
import { parseCompanyBlueprint } from "./blueprint";
import { COMPANY_TEMPLATES } from "./templates";
import { createAuthorityCompany } from "../gateway/authority-control";

export const BLUEPRINT_TEMPLATE_ID = "__blueprint__";

export function useCompanyCreateApp(input: {
  companyName: string;
  blueprintText: string;
  selectedTemplate: string;
}) {
  const { config } = useCompanyShellQuery();
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

  const importedBlueprint = useMemo(
    () => parseCompanyBlueprint(input.blueprintText),
    [input.blueprintText],
  );
  const isBlueprintTemplate = input.selectedTemplate === BLUEPRINT_TEMPLATE_ID;
  const selectedTemplateIsKnown = COMPANY_TEMPLATES.some((template) => template.id === input.selectedTemplate);

  const updateProgress = (current: number, message: string) => {
    setCreationProgress((state) => ({
      current,
      message,
      history: [...state.history, message],
    }));
  };

  const handleCreate = async () => {
    const blueprint = isBlueprintTemplate ? importedBlueprint : null;
    const finalCompanyName = (input.companyName || blueprint?.sourceCompanyName || "").trim();
    if (!finalCompanyName) {
      return null;
    }
    if (isBlueprintTemplate && !blueprint) {
      setCreationError("蓝图解析失败，请粘贴有效的 cyber-company.blueprint.v1 JSON。");
      return null;
    }
    setIsCreating(true);
    setCreationError(null);
    setCreationProgress({ current: 0, message: "等待开始...", history: [] });
    updateProgress(1, `正在创建公司「${finalCompanyName}」...`);

    try {
      const templateId =
        blueprint?.template
        || (selectedTemplateIsKnown ? input.selectedTemplate : null)
        || config?.companies[0]?.template
        || "blank";
      updateProgress(2, blueprint ? "正在解析蓝图并在 authority 中建库..." : "正在在 authority 中初始化组织...");
      const created = await createAuthorityCompany({
        companyName: finalCompanyName,
        templateId,
        blueprintText: blueprint ? input.blueprintText : undefined,
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
    BLUEPRINT_TEMPLATE_ID,
    COMPANY_TEMPLATES,
    creationError,
    creationProgress,
    creationTotalSteps,
    handleCreate,
    importedBlueprint,
    isBlueprintTemplate,
    isCreating,
  };
}
