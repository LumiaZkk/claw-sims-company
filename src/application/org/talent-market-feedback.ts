import type { Company, TemplateFeedbackSignal } from "../../domain/org/types";
import { applyTalentMarketFeedback, buildDefaultTalentMarketTemplates } from "../../domain/org/talent-market";

export function applyTemplateFeedbackToCompany(input: {
  company: Company;
  signals: TemplateFeedbackSignal[];
  now?: number;
}): Company {
  const now = input.now ?? Date.now();
  const market = input.company.talentMarket ?? {
    templates: buildDefaultTalentMarketTemplates(now),
    updatedAt: now,
  };
  const nextMarket = applyTalentMarketFeedback({
    market,
    signals: input.signals,
    now,
  });

  return {
    ...input.company,
    talentMarket: nextMarket,
  };
}
