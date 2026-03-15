import type {
  AgentTemplateDefinition,
  CompiledHireDraft,
  EmployeeTemplateBinding,
  HireBootstrapBundle,
  HireIntent,
  HireProvenance,
  TalentMarketState,
  TemplateFeedbackSignal,
  TemplateMatch,
} from "./types";
import { loadCuratedAgencyTemplates } from "./talent-market-curated";

const DEFAULT_COMPILER_VERSION = "tm-compiler@1";

export function buildDefaultTalentMarketTemplates(now: number = Date.now()): AgentTemplateDefinition[] {
  const internalTemplates: AgentTemplateDefinition[] = [
    {
      id: "tm-template-ops-coordinator",
      title: "Ops Coordinator",
      summary: "协调运营节奏、跟踪阻塞并输出清晰状态更新。",
      roleFamily: "operations",
      tags: ["ops", "coordination", "status"],
      domainTags: ["operations"],
      collaborationTags: ["reporting", "escalation"],
      baseSoul:
        "你是公司的运营协调枢纽。确保所有交付都有清晰的节奏、负责人和阻塞处理。",
      strengths: ["节奏管理", "跨部门沟通", "问题追踪"],
      cautions: ["避免越级绕过汇报链", "避免同时拉满多条主线"],
      defaultTraits: "严谨、沟通清晰、节奏感强",
      recommendedModelTier: "standard",
      defaultBudgetUsd: 5,
      recommendedSkills: ["ops_planning", "status_reporting"],
      recommendedApps: ["dashboard"],
      sourceType: "internal",
      sourceRef: "curated",
      qualityScore: 0.72,
      validationScore: 0.7,
      adoptionCount: 0,
      status: "ready",
      updatedAt: now,
    },
    {
      id: "tm-template-quality-reviewer",
      title: "Quality Reviewer",
      summary: "质量审阅、验收检查与结构化复盘。",
      roleFamily: "quality",
      tags: ["review", "quality", "checklist"],
      domainTags: ["quality"],
      collaborationTags: ["review", "feedback"],
      baseSoul:
        "你负责质量审阅与验收。任何交付都要有清晰的检查点、风险记录和反馈回路。",
      strengths: ["质量把关", "结构化评审", "风险识别"],
      cautions: ["避免替代实际责任人决策", "避免拖延交付节奏"],
      defaultTraits: "细致、客观、直截了当",
      recommendedModelTier: "reasoning",
      defaultBudgetUsd: 8,
      recommendedSkills: ["quality_audit", "risk_reporting"],
      recommendedApps: ["review-console"],
      sourceType: "internal",
      sourceRef: "curated",
      qualityScore: 0.76,
      validationScore: 0.74,
      adoptionCount: 0,
      status: "ready",
      updatedAt: now,
    },
    {
      id: "tm-template-research-analyst",
      title: "Research Analyst",
      summary: "快速整理资料、形成结论并输出决策支撑。",
      roleFamily: "analysis",
      tags: ["research", "analysis", "summary"],
      domainTags: ["analysis"],
      collaborationTags: ["briefing"],
      baseSoul:
        "你负责研究与信息整理，要求来源清晰、结论明确、并能支撑决策。",
      strengths: ["信息结构化", "结论推导", "简洁表达"],
      cautions: ["避免遗漏关键假设", "避免超出证据的断言"],
      defaultTraits: "理性、谨慎、条理清晰",
      recommendedModelTier: "reasoning",
      defaultBudgetUsd: 7,
      recommendedSkills: ["research_ops", "source_tracking"],
      recommendedApps: ["knowledge"],
      sourceType: "internal",
      sourceRef: "curated",
      qualityScore: 0.7,
      validationScore: 0.68,
      adoptionCount: 0,
      status: "ready",
      updatedAt: now,
    },
  ];

  return [...internalTemplates, ...loadCuratedAgencyTemplates(now)];
}

export function buildHireIntentFromManualInput(input: {
  companyId: string;
  role: string;
  description: string;
  departmentName?: string | null;
  reportsTo?: string | null;
  modelTier?: "standard" | "reasoning" | "ultra";
  budget?: number | null;
  traits?: string | null;
  operatorNotes?: string | null;
}) : HireIntent {
  return {
    companyId: input.companyId,
    rolePrompt: input.role.trim(),
    businessContext: input.description.trim(),
    departmentName: input.departmentName ?? null,
    reportsTo: input.reportsTo ?? null,
    desiredModelTier: input.modelTier ?? undefined,
    budgetUsd: typeof input.budget === "number" ? input.budget : undefined,
    mustHaveTags: [],
    avoidTags: [],
    operatorNotes: input.operatorNotes ?? null,
  };
}

function normalizeTags(tags: string[] | undefined): Set<string> {
  return new Set((tags ?? []).map((tag) => tag.trim().toLowerCase()).filter((tag) => tag.length > 0));
}

function scoreTemplate(intent: HireIntent, template: AgentTemplateDefinition) {
  const mustHave = normalizeTags(intent.mustHaveTags);
  const avoid = normalizeTags(intent.avoidTags);
  const templateTags = normalizeTags([
    ...(template.tags ?? []),
    ...(template.domainTags ?? []),
    ...(template.collaborationTags ?? []),
  ]);

  const rolePrompt = intent.rolePrompt.toLowerCase();
  const titleHit = rolePrompt.includes(template.title.toLowerCase());
  const familyHit = template.roleFamily ? rolePrompt.includes(template.roleFamily.toLowerCase()) : false;
  const mustHits = [...mustHave].filter((tag) => templateTags.has(tag));
  const avoidHits = [...avoid].filter((tag) => templateTags.has(tag));
  const gapTags = [...mustHave].filter((tag) => !templateTags.has(tag));

  let score = 0.3;
  if (titleHit) score += 0.3;
  if (familyHit) score += 0.2;
  score += Math.min(0.2, mustHits.length * 0.1);
  score -= Math.min(0.3, avoidHits.length * 0.15);
  if (template.status === "draft") score -= 0.1;
  if (template.status === "deprecated") score -= 0.2;
  score = Math.max(0, Math.min(1, score));

  const confidence = Math.max(0.1, Math.min(1, score - gapTags.length * 0.05));
  const reasons = [
    titleHit ? "角色描述与模板标题匹配" : null,
    familyHit ? "角色描述与模板族系匹配" : null,
    mustHits.length > 0 ? `匹配必备标签：${mustHits.join("、")}` : null,
  ].filter((reason): reason is string => Boolean(reason));
  const gaps = gapTags.length > 0 ? [`缺少标签：${gapTags.join("、")}`] : [];
  const autoAdoptEligible = score >= 0.7 && confidence >= 0.7 && gaps.length === 0;

  return { score, confidence, reasons, gaps, autoAdoptEligible };
}

export function matchTalentTemplates(
  intent: HireIntent,
  templates: AgentTemplateDefinition[],
): TemplateMatch[] {
  const available = templates.filter((template) => template.status !== "retired");
  const readyOnly = available.filter((template) => template.status === "ready");
  const candidates = readyOnly.length > 0 ? readyOnly : available;

  return candidates
    .map((template) => {
      const scored = scoreTemplate(intent, template);
      return {
        templateId: template.id,
        score: scored.score,
        confidence: scored.confidence,
        reasons: scored.reasons,
        gaps: scored.gaps,
        autoAdoptEligible: scored.autoAdoptEligible,
      };
    })
    .sort((left, right) => right.score - left.score);
}

export function buildHireProvenance(input: {
  templateId?: string | null;
  sourceType: string;
  reasons: string[];
}): HireProvenance {
  return {
    templateId: input.templateId ?? null,
    sourceType: input.sourceType,
    reasons: input.reasons,
  };
}

export function compileHireDraft(input: {
  intent: HireIntent;
  template: AgentTemplateDefinition | null;
  match: TemplateMatch | null;
  roleOverride?: string;
  descriptionOverride?: string;
  traitsOverride?: string | null;
  modelTierOverride?: "standard" | "reasoning" | "ultra";
  budgetOverride?: number | null;
}): CompiledHireDraft {
  const templateId = input.template?.id ?? null;
  const sourceType = templateId ? "template" : "blank";
  const role = (input.roleOverride || input.intent.rolePrompt).trim();
  const description = (input.descriptionOverride || input.intent.businessContext).trim();
  const traits = input.traitsOverride || input.template?.defaultTraits || "";
  const modelTier = input.modelTierOverride ?? input.template?.recommendedModelTier ?? undefined;
  const budget = input.budgetOverride ?? input.template?.defaultBudgetUsd ?? undefined;

  const roleMd = buildRoleMarkdown({
    role,
    description,
    traits,
    modelTier,
    budget,
    recommendedSkills: input.template?.recommendedSkills ?? [],
  });
  const soulMd = input.template?.baseSoul ?? null;
  const onboardingMd = buildOnboardingMarkdown({
    role,
    businessContext: input.intent.businessContext,
    cautions: input.template?.cautions ?? [],
  });

  const bootstrapBundle: HireBootstrapBundle = {
    roleMd,
    soulMd,
    onboardingMd,
    recommendedSkills: input.template?.recommendedSkills ?? [],
  };

  const provenance = buildHireProvenance({
    templateId,
    sourceType,
    reasons: input.match?.reasons ?? [],
  });

  return {
    companyId: input.intent.companyId,
    templateId,
    sourceType,
    role,
    description,
    nickname: null,
    reportsTo: input.intent.reportsTo ?? null,
    departmentName: input.intent.departmentName ?? null,
    modelTier,
    budget,
    traits: traits || null,
    bootstrapBundle,
    provenance,
  };
}

export function buildEmployeeTemplateBinding(input: {
  templateId: string | null;
  sourceType: "template" | "blank";
  confidence: number | null;
  compiledAt?: number;
  compilerVersion?: string;
}): EmployeeTemplateBinding {
  return {
    templateId: input.templateId,
    sourceType: input.sourceType,
    compiledAt: input.compiledAt ?? Date.now(),
    compilerVersion: input.compilerVersion ?? DEFAULT_COMPILER_VERSION,
    confidence: input.confidence ?? null,
  };
}

const DEFAULT_QUALITY_SCORE = 0.6;
const DEFAULT_VALIDATION_SCORE = 0.6;

function clamp01(value: number) {
  return Math.max(0, Math.min(1, value));
}

function updateScore(current: number | null | undefined, next: number, weight: number) {
  const base = typeof current === "number" ? current : DEFAULT_QUALITY_SCORE;
  return clamp01(base * (1 - weight) + next * weight);
}

function applyGovernance(template: AgentTemplateDefinition): AgentTemplateDefinition {
  if (template.status === "retired") {
    return template;
  }
  const quality = typeof template.qualityScore === "number" ? template.qualityScore : DEFAULT_QUALITY_SCORE;
  const validation =
    typeof template.validationScore === "number" ? template.validationScore : DEFAULT_VALIDATION_SCORE;

  if (quality < 0.15 && validation < 0.2) {
    return { ...template, status: "retired" };
  }
  if (quality < 0.3 || validation < 0.35) {
    return { ...template, status: "deprecated" };
  }
  if (quality >= 0.72 && validation >= 0.65 && template.status === "draft") {
    return { ...template, status: "ready" };
  }
  if (quality >= 0.68 && validation >= 0.6 && template.status === "deprecated") {
    return { ...template, status: "ready" };
  }
  return template;
}

export function applyTalentMarketFeedback(input: {
  market: TalentMarketState;
  signals: TemplateFeedbackSignal[];
  now?: number;
}): TalentMarketState {
  if (input.signals.length === 0) {
    return input.market;
  }
  const now = input.now ?? Date.now();
  const signalQueue = [...input.signals];
  const byId = new Map(input.market.templates.map((template) => [template.id, template]));
  const nextTemplates: AgentTemplateDefinition[] = input.market.templates.map((template) => ({ ...template }));

  while (signalQueue.length > 0) {
    const signal = signalQueue.shift()!;
    const existing = byId.get(signal.templateId);
    if (!existing) {
      continue;
    }
    const index = nextTemplates.findIndex((template) => template.id === signal.templateId);
    if (index < 0) {
      continue;
    }
    const template = nextTemplates[index]!;
    let nextTemplate: AgentTemplateDefinition = { ...template, updatedAt: now };

    switch (signal.event) {
      case "adopted": {
        const adoptionCount = (template.adoptionCount ?? 0) + 1;
        nextTemplate = {
          ...nextTemplate,
          adoptionCount,
          qualityScore: updateScore(template.qualityScore, 0.75, 0.1),
          validationScore: updateScore(template.validationScore, 0.7, 0.05),
        };
        break;
      }
      case "rejected": {
        const adoptionCount = Math.max(0, (template.adoptionCount ?? 0) - 1);
        nextTemplate = {
          ...nextTemplate,
          adoptionCount,
          qualityScore: updateScore(template.qualityScore, 0.25, 0.2),
          validationScore: updateScore(template.validationScore, 0.3, 0.15),
        };
        break;
      }
      case "performance": {
        const score = clamp01(Number(signal.score ?? 0.5));
        nextTemplate = {
          ...nextTemplate,
          qualityScore: updateScore(template.qualityScore, score, 0.3),
          validationScore: updateScore(template.validationScore, score, 0.2),
        };
        break;
      }
      case "promote": {
        nextTemplate = { ...nextTemplate, status: "ready" };
        break;
      }
      case "retire": {
        nextTemplate = { ...nextTemplate, status: "retired" };
        break;
      }
      default:
        break;
    }

    nextTemplate = applyGovernance(nextTemplate);
    nextTemplates[index] = nextTemplate;
    byId.set(signal.templateId, nextTemplate);
  }

  return {
    ...input.market,
    templates: nextTemplates,
    updatedAt: now,
  };
}

function buildRoleMarkdown(input: {
  role: string;
  description: string;
  traits: string | null | undefined;
  modelTier?: "standard" | "reasoning" | "ultra";
  budget?: number | null;
  recommendedSkills: string[];
}) {
  const lines = [
    `# ${input.role}`,
    "",
    "## Role",
    input.role,
    "",
    "## Responsibilities",
    input.description,
  ];

  if (input.traits?.trim()) {
    lines.push("", "## Traits", input.traits.trim());
  }
  if (typeof input.budget === "number") {
    lines.push("", "## Budget", `Daily budget target: ${input.budget} USD`);
  }
  if (input.modelTier) {
    lines.push("", "## Model Tier", input.modelTier);
  }
  if (input.recommendedSkills.length > 0) {
    lines.push("", "## Recommended Skills", ...input.recommendedSkills.map((skill) => `- ${skill}`));
  }

  lines.push("", "## Reporting", "Follow company dispatch and use `company_report` for structured status replies.");
  return lines.join("\n");
}

function buildOnboardingMarkdown(input: {
  role: string;
  businessContext: string;
  cautions: string[];
}) {
  const lines = [
    `# Onboarding: ${input.role}`,
    "",
    "## Context",
    input.businessContext || "No additional context provided.",
  ];
  if (input.cautions.length > 0) {
    lines.push("", "## Cautions", ...input.cautions.map((caution) => `- ${caution}`));
  }
  return lines.join("\n");
}
