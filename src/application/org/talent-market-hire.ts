import type { Company } from "../../domain/org/types";
import type { HireConfig } from "../../ui/immersive-hire-dialog";
import {
  buildDefaultTalentMarketTemplates,
  buildEmployeeTemplateBinding,
  buildHireIntentFromManualInput,
  compileHireDraft,
  matchTalentTemplates,
} from "../../domain/org/talent-market";

export function resolveTalentMarketHire(company: Company, config: HireConfig) {
  const templates = company.talentMarket?.templates ?? buildDefaultTalentMarketTemplates(Date.now());
  const intent = buildHireIntentFromManualInput({
    companyId: company.id,
    role: config.role,
    description: config.description,
    modelTier: config.modelTier,
    budget: config.budget,
    traits: config.traits,
  });
  const matches = matchTalentTemplates(intent, templates);

  let selectedTemplateId = config.templateSelection?.templateId ?? null;
  let selectedMatch = config.templateSelection?.match ?? null;

  if (config.templateSelection?.sourceType === "blank") {
    selectedTemplateId = null;
    selectedMatch = null;
  } else if (!selectedTemplateId && matches.length > 0 && matches[0]!.autoAdoptEligible) {
    selectedTemplateId = matches[0]!.templateId;
    selectedMatch = matches[0]!;
  }

  const template = selectedTemplateId
    ? templates.find((candidate) => candidate.id === selectedTemplateId) ?? null
    : null;
  if (template && !selectedMatch) {
    selectedMatch = matches.find((match) => match.templateId === template.id) ?? null;
  }

  const compiledDraft = compileHireDraft({
    intent,
    template,
    match: selectedMatch,
    roleOverride: config.role,
    descriptionOverride: config.description,
    traitsOverride: config.traits,
    modelTierOverride: config.modelTier,
    budgetOverride: config.budget,
  });

  const templateBinding = buildEmployeeTemplateBinding({
    templateId: template?.id ?? null,
    sourceType: template ? "template" : "blank",
    confidence: selectedMatch?.confidence ?? null,
  });

  return {
    templateId: template?.id ?? null,
    templateBinding,
    compiledDraft,
  };
}
