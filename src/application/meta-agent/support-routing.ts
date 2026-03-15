import type { Company, Department } from "../../domain/org/types";
import { resolveMetaDepartment } from "../../domain/meta-agent/organization";
import type { SupportMetaRole } from "../../domain/meta-agent/types";

type MetaSupportWorkShape = {
  title?: string | null;
  goal?: string | null;
  summary?: string | null;
  nextAction?: string | null;
  stageLabel?: string | null;
};

const META_SUPPORT_PATTERNS: Record<SupportMetaRole, RegExp> = {
  hr: /招聘|补人|headcount|编制|岗位|组团队/u,
  cto: /工具|系统|sdk|自动化|部署|集成|技术支持|脚手架|发布流水线|排障/u,
  coo: /渠道|流程|运营|增长|投放|转化|排期|发布|sop|数据/u,
};

function buildSupportNeedText(workItem: MetaSupportWorkShape): string {
  return [
    workItem.title,
    workItem.goal,
    workItem.summary,
    workItem.nextAction,
    workItem.stageLabel,
  ]
    .join(" ")
    .toLowerCase();
}

export function classifyMetaSupportNeed(
  workItem: MetaSupportWorkShape,
): SupportMetaRole | null {
  const text = buildSupportNeedText(workItem);
  if (META_SUPPORT_PATTERNS.hr.test(text)) {
    return "hr";
  }
  if (META_SUPPORT_PATTERNS.cto.test(text)) {
    return "cto";
  }
  if (META_SUPPORT_PATTERNS.coo.test(text)) {
    return "coo";
  }
  return null;
}

export function resolveMetaSupportDepartment(
  company: Company | null | undefined,
  workItem: MetaSupportWorkShape,
): Department | null {
  const supportNeed = classifyMetaSupportNeed(workItem);
  return supportNeed ? resolveMetaDepartment(company, supportNeed) : null;
}
