import type { CompanyWorkspaceApp, SkillDefinition, WorkflowCapabilityBinding } from "../../domain/org/types";
import type { WorkItemRecord } from "../../domain/mission/types";
import { isNovelCompany, resolveWorkspaceAppTemplate } from "../company/workspace-apps";

export interface ResolvedWorkflowCapabilityBinding {
  id: string;
  label: string;
  required: boolean;
  guidance?: string | null;
  matchedBy: Array<"title" | "stage" | "nextAction">;
  apps: CompanyWorkspaceApp[];
  missingAppTemplates: Array<NonNullable<WorkflowCapabilityBinding["appTemplates"]>[number]>;
  skills: SkillDefinition[];
  missingSkillIds: string[];
}

function normalizeText(value: string | null | undefined) {
  return (value ?? "").trim().toLowerCase();
}

function matchesPatterns(text: string, patterns?: string[]) {
  if (!patterns || patterns.length === 0) {
    return false;
  }
  return patterns.some((pattern) => {
    const normalizedPattern = normalizeText(pattern);
    return normalizedPattern.length > 0 && text.includes(normalizedPattern);
  });
}

function buildDefaultWorkflowBindings(): WorkflowCapabilityBinding[] {
  return [
    {
      id: "reader-during-creation",
      label: "创作阶段先打开阅读器对照上下文",
      required: false,
      guidance: "在创作、交稿或主编回看阶段，优先打开阅读器对照正文、设定和最近报告，避免脱离上下文单点推进。",
      titleMatchers: ["小说", "章节", "正文"],
      stageMatchers: ["创作", "交稿", "主编", "写手", "章节", "阅读"],
      nextActionMatchers: ["交稿", "正文", "章节", "阅读", "目录", "对照"],
      appTemplates: ["reader"],
    },
    {
      id: "consistency-before-review",
      label: "终审前执行一致性检查",
      required: true,
      guidance: "进入审校、终审或设定核对阶段时，优先打开一致性中心，并运行一致性检查，避免把逻辑错误带进终审。",
      stageMatchers: ["审校", "终审", "一致性", "校对", "设定"],
      nextActionMatchers: ["一致性", "校验", "检查", "终审", "设定", "伏笔"],
      appTemplates: ["consistency"],
      skillIds: ["consistency.check"],
    },
    {
      id: "review-before-publish",
      label: "发布/验收前执行预检",
      required: true,
      guidance: "进入发布、验收或最终确认阶段时，先在审阅控制台里执行发布前检查，再决定是否推进收口或发布。",
      stageMatchers: ["发布", "验收", "收口", "归档", "审核"],
      nextActionMatchers: ["发布", "验收", "预检", "审核", "归档", "确认"],
      appTemplates: ["review-console"],
      skillIds: ["review.precheck"],
    },
  ];
}

function buildGenericWorkflowBindings(): WorkflowCapabilityBinding[] {
  return [
    {
      id: "viewer-during-delivery",
      label: "推进前先打开内容查看器对照上下文",
      required: false,
      guidance: "进入编写、设计、评审或交接阶段时，优先打开内容查看器对照主体内容、参考资料和最近报告，避免脱离上下文单点推进。",
      titleMatchers: ["需求", "设计", "方案", "评审", "交付", "内容"],
      stageMatchers: ["编写", "设计", "评审", "交接", "开发", "验收"],
      nextActionMatchers: ["查看", "对照", "补充", "阅读", "同步", "整理"],
      appTemplates: ["reader"],
    },
    {
      id: "consistency-before-review",
      label: "评审前先执行规则检查",
      required: true,
      guidance: "进入评审、联调、规则核对或验收前检查阶段时，先打开规则与校验中心，并运行检查，避免把结构性错误带进下一步。",
      stageMatchers: ["评审", "验收", "联调", "规则", "检查", "校验"],
      nextActionMatchers: ["检查", "校验", "验证", "review", "规则", "确认"],
      appTemplates: ["consistency"],
      skillIds: ["consistency.check"],
    },
    {
      id: "review-before-handoff",
      label: "交付/验收前执行预检",
      required: true,
      guidance: "进入交付、发布、验收或最终确认阶段时，先在审阅控制台里执行预检，再决定是否推进。",
      stageMatchers: ["交付", "发布", "验收", "归档", "上线"],
      nextActionMatchers: ["预检", "交付", "发布", "验收", "确认", "归档"],
      appTemplates: ["review-console"],
      skillIds: ["review.precheck"],
    },
  ];
}

export function hasStoredWorkflowCapabilityBindings(
  company: Pick<import("../../domain/org/types").Company, "workflowCapabilityBindings"> | null | undefined,
) {
  return Boolean(company?.workflowCapabilityBindings?.length);
}

export function getCompanyWorkflowCapabilityBindings(
  company: Pick<
    import("../../domain/org/types").Company,
    "workflowCapabilityBindings" | "template" | "name" | "description" | "employees"
  > | null | undefined,
): WorkflowCapabilityBinding[] {
  if (!company) {
    return [];
  }
  if (Array.isArray(company.workflowCapabilityBindings) && company.workflowCapabilityBindings.length > 0) {
    return company.workflowCapabilityBindings;
  }
  if (isNovelCompany(company as import("../../domain/org/types").Company)) {
    return buildDefaultWorkflowBindings();
  }
  return buildGenericWorkflowBindings();
}

export function resolveWorkflowCapabilityBindings(input: {
  bindings: WorkflowCapabilityBinding[];
  workItem: Pick<WorkItemRecord, "title" | "displayStage" | "stageLabel" | "displayNextAction" | "nextAction"> | null;
  apps: CompanyWorkspaceApp[];
  skills: SkillDefinition[];
}): ResolvedWorkflowCapabilityBinding[] {
  if (!input.workItem) {
    return [];
  }

  const title = normalizeText(input.workItem.title);
  const stage = normalizeText(input.workItem.displayStage || input.workItem.stageLabel);
  const nextAction = normalizeText(input.workItem.displayNextAction || input.workItem.nextAction);

  return input.bindings.reduce<ResolvedWorkflowCapabilityBinding[]>((acc, binding) => {
    const matchedBy: ResolvedWorkflowCapabilityBinding["matchedBy"] = [];
    if (matchesPatterns(title, binding.titleMatchers)) {
      matchedBy.push("title");
    }
    if (matchesPatterns(stage, binding.stageMatchers)) {
      matchedBy.push("stage");
    }
    if (matchesPatterns(nextAction, binding.nextActionMatchers)) {
      matchedBy.push("nextAction");
    }
    if (matchedBy.length === 0) {
      return acc;
    }

    const apps = input.apps.filter((app) => {
      if (binding.appIds?.includes(app.id)) {
        return true;
      }
      const template = resolveWorkspaceAppTemplate(app);
      return binding.appTemplates?.includes(template) ?? false;
    });
    const missingAppTemplates =
      binding.appTemplates?.filter(
        (template) => !apps.some((app) => resolveWorkspaceAppTemplate(app) === template),
      ) ?? [];
    const skills = input.skills.filter((skill) => binding.skillIds?.includes(skill.id) ?? false);
    const missingSkillIds =
      binding.skillIds?.filter((skillId) => !skills.some((skill) => skill.id === skillId)) ?? [];

    acc.push({
      id: binding.id,
      label: binding.label,
      required: binding.required,
      guidance: binding.guidance ?? null,
      matchedBy,
      apps,
      missingAppTemplates,
      skills,
      missingSkillIds,
    });
    return acc;
  }, []);
}
