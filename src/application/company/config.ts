import type { CyberCompanyConfig } from "../../domain/org/types";
import { saveCompanyConfig } from "../../infrastructure/company/persistence/persistence";

export async function persistCompanyConfig(config: CyberCompanyConfig) {
  return saveCompanyConfig(config);
}
