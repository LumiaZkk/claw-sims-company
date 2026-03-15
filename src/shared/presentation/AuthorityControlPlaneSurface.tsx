import type { AuthorityOperatorActionResponse, AuthorityHealthSnapshot } from "../../application/gateway/authority-types";
import {
  buildAuthorityControlPlaneSummaryModel,
  buildAuthorityGuidanceItems,
  buildAuthorityOperatorControlPlaneModel,
  collectExecutorReadinessIssues,
} from "../../application/gateway/authority-health";
import { Badge } from "../../ui/badge";
import { AuthorityOperatorControlPlaneCard } from "./AuthorityOperatorControlPlaneCard";
import { ConnectionDiagnosisSummary } from "./ConnectionDiagnosisSummary";
import { formatControlPlaneStateLabel } from "./control-plane-labels";

function toneClass(state: "ready" | "attention" | "degraded" | "blocked") {
  if (state === "ready") {
    return "border-emerald-200 bg-emerald-50 text-emerald-700";
  }
  if (state === "attention") {
    return "border-sky-200 bg-sky-50 text-sky-700";
  }
  if (state === "blocked") {
    return "border-rose-200 bg-rose-50 text-rose-700";
  }
  return "border-amber-200 bg-amber-50 text-amber-700";
}

export function AuthorityControlPlaneSurface(props: {
  health: AuthorityHealthSnapshot | null;
  summaryLimit?: number;
  guidanceLimit?: number;
  readinessLimit?: number;
  summaryVariant?: "onboarding" | "steady";
  onExecuteEntry?: (
    entry: ReturnType<typeof buildAuthorityOperatorControlPlaneModel>["entries"][number],
  ) => Promise<AuthorityOperatorActionResponse>;
}) {
  const {
    health,
    summaryLimit = 3,
    guidanceLimit = 3,
    readinessLimit = 4,
    summaryVariant = "steady",
    onExecuteEntry,
  } = props;
  const summary = health ? buildAuthorityControlPlaneSummaryModel(health, summaryLimit) : null;
  const guidanceItems = health ? buildAuthorityGuidanceItems(health, guidanceLimit) : [];
  const readinessIssues = health ? collectExecutorReadinessIssues(health, readinessLimit) : [];
  const operatorControlPlane = buildAuthorityOperatorControlPlaneModel(health);

  return (
    <div className="space-y-3">
      {summary ? (
        <ConnectionDiagnosisSummary
          variant={summaryVariant}
          state={summary.state}
          title={summary.title}
          summary={summary.summary}
          detail={summary.detail}
          steps={summary.steps}
          layers={summary.layers}
        />
      ) : null}

      {guidanceItems.length > 0 ? (
        <div className="rounded-2xl border border-slate-200 bg-white px-4 py-3">
          <div className="text-xs font-semibold text-slate-900">优先修复建议</div>
          <div className="mt-2 space-y-2">
            {guidanceItems.map((item) => (
              <div key={item.id} className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2">
                <div className="flex items-center justify-between gap-2">
                  <div className="text-xs font-semibold text-slate-900">{item.title}</div>
                  <Badge variant="outline" className={toneClass(item.state)}>
                    {formatControlPlaneStateLabel(item.state)}
                  </Badge>
                </div>
                <div className="mt-1 text-[11px] text-slate-600">{item.summary}</div>
                <div className="mt-1 text-[11px] text-slate-500">{item.action}</div>
                {item.command ? (
                  <div className="mt-1 rounded border border-slate-200 bg-white px-2 py-1 font-mono text-[11px] text-slate-700">
                    {item.command}
                  </div>
                ) : null}
              </div>
            ))}
          </div>
        </div>
      ) : null}

      {readinessIssues.length > 0 ? (
        <div className="rounded-2xl border border-slate-200 bg-white px-4 py-3">
          <div className="text-xs font-semibold text-slate-900">执行器环境检查</div>
          <div className="mt-2 space-y-2">
            {readinessIssues.map((check) => (
              <div key={check.id} className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2">
                <div className="flex items-center justify-between gap-2">
                  <div className="text-xs font-medium text-slate-900">{check.label}</div>
                  <Badge variant="outline" className={toneClass(check.state)}>
                    {formatControlPlaneStateLabel(check.state)}
                  </Badge>
                </div>
                <div className="mt-1 text-[11px] text-slate-600">{check.summary}</div>
                {check.detail ? (
                  <div className="mt-1 text-[11px] text-slate-500">{check.detail}</div>
                ) : null}
              </div>
            ))}
          </div>
        </div>
      ) : null}

      <AuthorityOperatorControlPlaneCard
        model={operatorControlPlane}
        onExecuteEntry={onExecuteEntry}
      />
    </div>
  );
}
