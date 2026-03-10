export type AgentControlSnapshot = {
  agentId: string;
  defaultModel: string | null;
  defaultSkills: string[] | null;
  modelOverride: string | null;
  skillsOverride: string[] | null;
};

type GatewayConfigSnapshot = {
  path: string;
  exists: boolean;
  valid: boolean;
  hash?: string;
  config: Record<string, unknown>;
};

type AgentConfigGateway = {
  getConfigSnapshot(): Promise<GatewayConfigSnapshot>;
  setConfig(config: Record<string, unknown>, baseHash: string): Promise<unknown>;
  updateAgent(params: {
    agentId: string;
    name?: string;
    workspace?: string;
    model?: string;
    avatar?: string;
  }): Promise<{ ok: true; agentId: string }>;
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function normalizeNonEmptyString(value: unknown): string | null {
  if (typeof value !== "string") {
    return null;
  }
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

function resolvePrimaryModel(value: unknown): string | null {
  const direct = normalizeNonEmptyString(value);
  if (direct) {
    return direct;
  }
  if (!isRecord(value)) {
    return null;
  }
  return normalizeNonEmptyString(value.primary);
}

function normalizeSkillList(value: unknown): string[] | undefined {
  if (!Array.isArray(value)) {
    return undefined;
  }

  const normalized = value
    .map((entry) => (typeof entry === "string" ? entry.trim() : ""))
    .filter((entry) => entry.length > 0);

  return normalized.length > 0 ? normalized : [];
}

function isSameSkillList(current: unknown, expected: string[]): boolean {
  if (!Array.isArray(current) || current.length !== expected.length) {
    return false;
  }

  for (let index = 0; index < expected.length; index += 1) {
    if (typeof current[index] !== "string" || current[index] !== expected[index]) {
      return false;
    }
  }

  return true;
}

function resolveAgentConfigEntry(
  list: unknown[],
  agentId: string,
): { index: number; entry: Record<string, unknown> } {
  for (let index = 0; index < list.length; index += 1) {
    const candidate = list[index];
    if (!isRecord(candidate)) {
      continue;
    }
    const id = normalizeNonEmptyString(candidate.id);
    if (id === agentId) {
      return { index, entry: candidate };
    }
  }

  throw new Error(`Agent "${agentId}" not found in config list.`);
}

export async function alignAgentSkillsToDefaults(
  gateway: AgentConfigGateway,
  agentIds: string[],
): Promise<{ updated: number; defaultSkills: string[] | null }> {
  const targetIds = new Set(agentIds.map((id) => id.trim()).filter((id) => id.length > 0));

  if (targetIds.size === 0) {
    return { updated: 0, defaultSkills: null };
  }

  for (let attempt = 0; attempt < 2; attempt += 1) {
    const snapshot = await gateway.getConfigSnapshot();
    if (!snapshot.valid) {
      throw new Error("Gateway config is invalid; cannot align agent skills.");
    }

    const hash = typeof snapshot.hash === "string" ? snapshot.hash.trim() : "";
    if (!hash) {
      throw new Error("Gateway config hash is missing; cannot align agent skills.");
    }

    if (!isRecord(snapshot.config)) {
      throw new Error("Gateway config payload is malformed; cannot align agent skills.");
    }

    const config = structuredClone(snapshot.config);
    const agents = isRecord(config.agents) ? { ...config.agents } : {};
    const defaults = isRecord(agents.defaults) ? agents.defaults : {};
    const defaultSkills = normalizeSkillList(defaults.skills);
    const list = Array.isArray(agents.list) ? agents.list : [];

    let updated = 0;
    const nextList = list.map((entry) => {
      if (!isRecord(entry)) {
        return entry;
      }
      const id = typeof entry.id === "string" ? entry.id.trim() : "";
      if (!id || !targetIds.has(id)) {
        return entry;
      }

      const nextEntry: Record<string, unknown> = { ...entry };
      if (defaultSkills) {
        if (!isSameSkillList(nextEntry.skills, defaultSkills)) {
          nextEntry.skills = [...defaultSkills];
          updated += 1;
        }
      } else if (Object.prototype.hasOwnProperty.call(nextEntry, "skills")) {
        delete nextEntry.skills;
        updated += 1;
      }

      return nextEntry;
    });

    if (updated === 0) {
      return { updated: 0, defaultSkills: defaultSkills ?? null };
    }

    const nextConfig: Record<string, unknown> = {
      ...config,
      agents: {
        ...agents,
        list: nextList,
      },
    };

    try {
      await gateway.setConfig(nextConfig, hash);
      return { updated, defaultSkills: defaultSkills ?? null };
    } catch (error) {
      const isLastAttempt = attempt === 1;
      if (isLastAttempt) {
        throw error;
      }
    }
  }

  return { updated: 0, defaultSkills: null };
}

export async function getAgentControlSnapshot(
  gateway: AgentConfigGateway,
  agentId: string,
): Promise<AgentControlSnapshot> {
  const normalizedAgentId = normalizeNonEmptyString(agentId);
  if (!normalizedAgentId) {
    throw new Error("agentId is required.");
  }

  const snapshot = await gateway.getConfigSnapshot();
  if (!snapshot.valid) {
    throw new Error("Gateway config is invalid; cannot inspect agent controls.");
  }
  if (!isRecord(snapshot.config)) {
    throw new Error("Gateway config payload is malformed; cannot inspect agent controls.");
  }

  const agents = isRecord(snapshot.config.agents) ? snapshot.config.agents : {};
  const defaults = isRecord(agents.defaults) ? agents.defaults : {};
  const list = Array.isArray(agents.list) ? agents.list : [];
  const { entry } = resolveAgentConfigEntry(list, normalizedAgentId);

  return {
    agentId: normalizedAgentId,
    defaultModel: resolvePrimaryModel(defaults.model),
    defaultSkills: normalizeSkillList(defaults.skills) ?? null,
    modelOverride: resolvePrimaryModel(entry.model),
    skillsOverride: normalizeSkillList(entry.skills) ?? null,
  };
}

export async function setAgentModelOverride(
  gateway: AgentConfigGateway,
  agentId: string,
  model: string | null,
): Promise<{ updated: boolean; modelOverride: string | null }> {
  const normalizedAgentId = normalizeNonEmptyString(agentId);
  if (!normalizedAgentId) {
    throw new Error("agentId is required.");
  }

  const nextModel = normalizeNonEmptyString(model);

  if (nextModel) {
    const current = await getAgentControlSnapshot(gateway, normalizedAgentId);
    if (current.modelOverride === nextModel) {
      return { updated: false, modelOverride: nextModel };
    }

    await gateway.updateAgent({ agentId: normalizedAgentId, model: nextModel });
    return { updated: true, modelOverride: nextModel };
  }

  for (let attempt = 0; attempt < 2; attempt += 1) {
    const snapshot = await gateway.getConfigSnapshot();
    if (!snapshot.valid) {
      throw new Error("Gateway config is invalid; cannot update agent model.");
    }

    const hash = typeof snapshot.hash === "string" ? snapshot.hash.trim() : "";
    if (!hash) {
      throw new Error("Gateway config hash is missing; cannot update agent model.");
    }

    if (!isRecord(snapshot.config)) {
      throw new Error("Gateway config payload is malformed; cannot update agent model.");
    }

    const config = structuredClone(snapshot.config);
    const agents = isRecord(config.agents) ? { ...config.agents } : {};
    const list = Array.isArray(agents.list) ? [...agents.list] : [];
    const { index, entry } = resolveAgentConfigEntry(list, normalizedAgentId);
    const nextEntry: Record<string, unknown> = { ...entry };

    let changed = false;
    if (Object.prototype.hasOwnProperty.call(nextEntry, "model")) {
      delete nextEntry.model;
      changed = true;
    }

    if (!changed) {
      return { updated: false, modelOverride: nextModel };
    }

    list[index] = nextEntry;
    const nextConfig: Record<string, unknown> = {
      ...config,
      agents: {
        ...agents,
        list,
      },
    };

    try {
      await gateway.setConfig(nextConfig, hash);
      return { updated: true, modelOverride: nextModel };
    } catch (error) {
      if (attempt === 1) {
        throw error;
      }
    }
  }

  return { updated: false, modelOverride: nextModel };
}

export async function setAgentSkillsOverride(
  gateway: AgentConfigGateway,
  agentId: string,
  skills: string[] | null,
): Promise<{ updated: boolean; skillsOverride: string[] | null }> {
  const normalizedAgentId = normalizeNonEmptyString(agentId);
  if (!normalizedAgentId) {
    throw new Error("agentId is required.");
  }

  const nextSkills =
    skills === null
      ? null
      : Array.from(
          new Set(skills.map((entry) => entry.trim()).filter((entry) => entry.length > 0)),
        );

  for (let attempt = 0; attempt < 2; attempt += 1) {
    const snapshot = await gateway.getConfigSnapshot();
    if (!snapshot.valid) {
      throw new Error("Gateway config is invalid; cannot update agent skills.");
    }

    const hash = typeof snapshot.hash === "string" ? snapshot.hash.trim() : "";
    if (!hash) {
      throw new Error("Gateway config hash is missing; cannot update agent skills.");
    }

    if (!isRecord(snapshot.config)) {
      throw new Error("Gateway config payload is malformed; cannot update agent skills.");
    }

    const config = structuredClone(snapshot.config);
    const agents = isRecord(config.agents) ? { ...config.agents } : {};
    const list = Array.isArray(agents.list) ? [...agents.list] : [];
    const { index, entry } = resolveAgentConfigEntry(list, normalizedAgentId);
    const nextEntry: Record<string, unknown> = { ...entry };

    let changed = false;
    if (nextSkills === null) {
      if (Object.prototype.hasOwnProperty.call(nextEntry, "skills")) {
        delete nextEntry.skills;
        changed = true;
      }
    } else if (!isSameSkillList(nextEntry.skills, nextSkills)) {
      nextEntry.skills = [...nextSkills];
      changed = true;
    }

    if (!changed) {
      return { updated: false, skillsOverride: nextSkills };
    }

    list[index] = nextEntry;
    const nextConfig: Record<string, unknown> = {
      ...config,
      agents: {
        ...agents,
        list,
      },
    };

    try {
      await gateway.setConfig(nextConfig, hash);
      return { updated: true, skillsOverride: nextSkills };
    } catch (error) {
      if (attempt === 1) {
        throw error;
      }
    }
  }

  return { updated: false, skillsOverride: nextSkills };
}
