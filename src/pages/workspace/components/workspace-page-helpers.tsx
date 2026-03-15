import {
  BookOpen,
  BookOpenCheck,
  Compass,
  FileCode2,
  RefreshCcw,
  ScrollText,
} from "lucide-react";
import type {
  CompanyWorkspaceAppTemplate,
  SkillDefinitionStatus,
  SkillRunRecord,
} from "../../../domain/org/types";
import type { ResolvedWorkflowCapabilityBinding } from "../../../application/workspace";

export function renderWorkspaceAppIcon(template: CompanyWorkspaceAppTemplate) {
  switch (template) {
    case "reader":
      return <BookOpen className="h-5 w-5" />;
    case "consistency":
      return <Compass className="h-5 w-5" />;
    case "knowledge":
      return <ScrollText className="h-5 w-5" />;
    case "workbench":
      return <FileCode2 className="h-5 w-5" />;
    case "review-console":
      return <BookOpenCheck className="h-5 w-5" />;
    case "dashboard":
      return <RefreshCcw className="h-5 w-5" />;
    case "generic-app":
      return <FileCode2 className="h-5 w-5" />;
  }
}

export const SKILL_STATUS_LABEL: Record<SkillDefinitionStatus, string> = {
  draft: "草稿",
  ready: "可用",
  degraded: "降级",
  retired: "停用",
};

export const CAPABILITY_RUN_TRIGGER_LABEL: Record<SkillRunRecord["triggerType"], string> = {
  app_action: "App 动作",
  workflow_step: "流程节点",
  manual: "能力验证",
};

export function formatBindingMatchLabel(
  matchedBy: ResolvedWorkflowCapabilityBinding["matchedBy"],
) {
  return matchedBy
    .map((item) =>
      item === "stage" ? "阶段命中" : item === "nextAction" ? "下一步命中" : "标题命中",
    )
    .join(" / ");
}
