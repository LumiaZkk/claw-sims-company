import { Badge } from "../../../components/ui/badge";
import { Button } from "../../../components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "../../../components/ui/card";
import {
  CAPABILITY_ISSUE_STATUS_LABEL,
  type CapabilityPlatformCloseoutSummary,
} from "../../../application/workspace";
import type { CompanyWorkspaceApp, SkillDefinition } from "../../../domain/org/types";

const CAPABILITY_PLATFORM_CLOSEOUT_STATUS_LABEL = {
  ready: "已收口",
  in_progress: "推进中",
  attention: "待补齐",
} as const;

type WorkspaceCloseoutStatusCardProps = {
  closeoutSummary: CapabilityPlatformCloseoutSummary;
  firstAppWithoutManifest: Pick<CompanyWorkspaceApp, "id" | "title"> | null;
  skillDefinitions: SkillDefinition[];
  firstSkillNeedingValidation: Pick<SkillDefinition, "id" | "title"> | null;
  preferredDraftTool: "novel-reader" | "consistency-checker" | "chapter-review-console";
  onRetryCompanyProvisioning: () => void | Promise<void>;
  onGenerateAppManifestDraft: (appId?: string) => void | Promise<void>;
  onCreateSkillDraft: (tool: "novel-reader" | "consistency-checker" | "chapter-review-console") => void | Promise<void>;
  onRunSkillSmokeTest: (skillId: string) => void | Promise<void>;
};

export function WorkspaceCloseoutStatusCard(props: WorkspaceCloseoutStatusCardProps) {
  const {
    closeoutSummary,
    firstAppWithoutManifest,
    skillDefinitions,
    firstSkillNeedingValidation,
    preferredDraftTool,
    onRetryCompanyProvisioning,
    onGenerateAppManifestDraft,
    onCreateSkillDraft,
    onRunSkillSmokeTest,
  } = props;

  return (
    <Card className="border-slate-200/80 shadow-sm">
      <CardHeader>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <CardTitle className="text-base">中台收口状态</CardTitle>
            <CardDescription>按最终标准回看这家公司在 App、资源、能力、治理与运维上的收口进度。</CardDescription>
          </div>
          <div className="flex flex-wrap gap-2 text-xs">
            <Badge variant="default">已收口 {closeoutSummary.totals.ready}</Badge>
            <Badge variant="secondary">推进中 {closeoutSummary.totals.in_progress}</Badge>
            <Badge variant="outline">待补齐 {closeoutSummary.totals.attention}</Badge>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        {closeoutSummary.checks.map((check) => (
          <div key={check.id} className="rounded-xl border border-slate-200 bg-white px-4 py-4">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <div className="text-sm font-semibold text-slate-950">{check.label}</div>
                <div className="mt-1 text-xs leading-5 text-slate-500">{check.summary}</div>
              </div>
              <Badge
                variant={
                  check.status === "ready"
                    ? "default"
                    : check.status === "in_progress"
                      ? "secondary"
                      : "outline"
                }
              >
                {CAPABILITY_PLATFORM_CLOSEOUT_STATUS_LABEL[check.status]}
              </Badge>
            </div>
            <div className="mt-3 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-xs leading-5 text-slate-700">
              {check.detail}
            </div>
            {check.nextStep ? (
              <div className="mt-2 rounded-lg border border-dashed border-amber-200 bg-amber-50/80 px-3 py-2 text-xs leading-5 text-amber-900">
                下一步：{check.nextStep}
              </div>
            ) : null}
            {check.id === "executor-provisioning" && check.status !== "ready" ? (
              <div className="mt-3">
                <Button type="button" size="sm" variant="outline" onClick={() => void onRetryCompanyProvisioning()}>
                  重试补齐执行器
                </Button>
              </div>
            ) : null}
            {check.id === "app-manifest-coverage" && check.status !== "ready" && firstAppWithoutManifest ? (
              <div className="mt-3">
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  onClick={() => void onGenerateAppManifestDraft(firstAppWithoutManifest.id)}
                >
                  先补 {firstAppWithoutManifest.title} 的 AppManifest
                </Button>
              </div>
            ) : null}
            {check.id === "capability-validation" && check.status !== "ready" ? (
              <div className="mt-3">
                {skillDefinitions.length === 0 ? (
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    onClick={() => void onCreateSkillDraft(preferredDraftTool)}
                  >
                    登记首条能力草稿
                  </Button>
                ) : firstSkillNeedingValidation ? (
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    onClick={() => void onRunSkillSmokeTest(firstSkillNeedingValidation.id)}
                  >
                    先验证 {firstSkillNeedingValidation.title}
                  </Button>
                ) : null}
              </div>
            ) : null}
            {check.id === "governance-and-audit" && check.status !== "ready" ? (
              <div className="mt-3">
                {skillDefinitions.length === 0 ? (
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    onClick={() => void onCreateSkillDraft(preferredDraftTool)}
                  >
                    留下第一条治理记录
                  </Button>
                ) : firstSkillNeedingValidation ? (
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    onClick={() => void onRunSkillSmokeTest(firstSkillNeedingValidation.id)}
                  >
                    先跑一次能力验证
                  </Button>
                ) : (
                  <div className="text-xs text-slate-500">
                    还有未关闭事项，优先把状态推进到
                    {CAPABILITY_ISSUE_STATUS_LABEL.closed}
                    。
                  </div>
                )}
              </div>
            ) : null}
          </div>
        ))}
      </CardContent>
    </Card>
  );
}
