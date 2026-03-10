import { gateway } from "../gateway";

export async function syncTextReferenceFileToAgents(input: {
  fileName: string;
  textContent: string;
  agentIds: string[];
}) {
  let uploadCount = 0;
  for (const agentId of input.agentIds) {
    await gateway.setAgentFile(agentId, input.fileName, input.textContent);
    uploadCount += 1;
  }
  return uploadCount;
}
