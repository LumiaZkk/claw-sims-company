import type { AgentTemplateDefinition } from "./types";

/**
 * Curated templates are optional. Some deployments keep templates purely in docs.
 * This module provides a stable import target so the domain layer never breaks
 * when curated data is not bundled.
 */
export function loadCuratedAgencyTemplates(_now: number = Date.now()): AgentTemplateDefinition[] {
  return [];
}

