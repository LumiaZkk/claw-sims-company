export interface GatewayAgentIdentity {
  name?: string;
  theme?: string;
  emoji?: string;
  avatar?: string;
  avatarUrl?: string;
}

export interface AgentListEntry {
  id: string;
  name?: string;
  identity?: GatewayAgentIdentity;
}

export interface AgentsListResult {
  defaultId: string;
  mainKey: string;
  scope: "per-sender" | "global";
  agents: AgentListEntry[];
}

export interface AgentsDeleteResult {
  ok: true;
  agentId: string;
  removedBindings?: number;
  removedAllow?: number;
  removedSessions?: number;
  removedCronJobs?: number;
}

type AgentFileEntry = {
  name: string;
  path: string;
  missing: boolean;
  size?: number;
  updatedAtMs?: number;
  content?: string;
};

type AgentFileGetResult = {
  agentId: string;
  workspace: string;
  file: AgentFileEntry;
};

type AgentFileSetResult = {
  ok: true;
  agentId: string;
  workspace: string;
  file: AgentFileEntry;
};

type GatewayAgentRequester = {
  request<T = unknown>(method: string, params?: unknown): Promise<T>;
};

function stringifyError(error: unknown): string {
  if (error instanceof Error) {
    return error.message;
  }
  return String(error);
}

function isLegacyAgentsDeletePurgeStateError(error: unknown): boolean {
  const message = stringifyError(error);
  return (
    message.includes("invalid agents.delete params") &&
    message.includes("unexpected property") &&
    message.includes("purgeState")
  );
}

export function buildAgentMethods(gateway: GatewayAgentRequester) {
  return {
    async listAgents(): Promise<AgentsListResult> {
      return gateway.request<AgentsListResult>("agents.list", {});
    },

    async updateAgent(params: {
      agentId: string;
      name?: string;
      workspace?: string;
      model?: string;
      avatar?: string;
    }): Promise<{ ok: true; agentId: string }> {
      return gateway.request<{ ok: true; agentId: string }>("agents.update", params);
    },

    async createAgent(
      name: string,
    ): Promise<{ ok: true; agentId: string; name: string; workspace: string }> {
      return gateway.request("agents.create", {
        name,
        workspace: `~/.openclaw/workspaces/${name}`,
      });
    },

    async deleteAgent(
      agentId: string,
      opts?: { deleteFiles?: boolean; purgeState?: boolean },
    ): Promise<AgentsDeleteResult> {
      const params = {
        agentId,
        deleteFiles: opts?.deleteFiles ?? true,
        purgeState: opts?.purgeState ?? true,
      };

      try {
        return await gateway.request<AgentsDeleteResult>("agents.delete", params);
      } catch (error) {
        if (!params.purgeState || !isLegacyAgentsDeletePurgeStateError(error)) {
          throw error;
        }

        return gateway.request<AgentsDeleteResult>("agents.delete", {
          agentId,
          deleteFiles: params.deleteFiles,
        });
      }
    },

    async listAgentFiles(
      agentId: string,
    ): Promise<{ agentId: string; workspace: string; files: AgentFileEntry[] }> {
      return gateway.request("agents.files.list", { agentId });
    },

    async getAgentFile(agentId: string, name: string): Promise<AgentFileGetResult> {
      return gateway.request("agents.files.get", { agentId, name });
    },

    async setAgentFile(agentId: string, name: string, content: string): Promise<AgentFileSetResult> {
      return gateway.request("agents.files.set", { agentId, name, content });
    },
  };
}
