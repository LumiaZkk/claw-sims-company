import { Server } from "lucide-react";
import type { AuthorityHealthSnapshot } from "../../../application/gateway/authority-types";
import type { AuthorityOperatorControlPlaneEntry } from "../../../application/gateway/authority-health";
import type { GatewayDoctorBaseline } from "../../../application/gateway/settings";
import { runAuthorityOperatorAction } from "../../../application/gateway/authority-control";
import { toast } from "../../../system/toast-store";
import { Badge } from "../../../ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "../../../ui/card";
import { formatTime } from "../../../lib/utils";
import { ConnectionDiagnosisSummary } from "../../../shared/presentation/ConnectionDiagnosisSummary";
import { AuthorityControlPlaneSurface } from "../../../shared/presentation/AuthorityControlPlaneSurface";
import { formatControlPlaneStateLabel } from "../../../shared/presentation/control-plane-labels";
import { formatAuthorityIntegrityLabel } from "../../../application/gateway/authority-health";
import { doctorToneClass } from "./settings-helpers";

export function SettingsDoctorSection(props: {
  doctorBaseline: GatewayDoctorBaseline;
  authorityHealth: AuthorityHealthSnapshot | null;
  refreshRuntime: () => Promise<unknown>;
}) {
  const { doctorBaseline, authorityHealth, refreshRuntime } = props;
  const authorityDoctor = authorityHealth?.authority.doctor ?? null;
  const authorityPreflight = authorityHealth?.authority.preflight ?? null;
  const executeAuthorityOperatorEntry = async (
    entry: AuthorityOperatorControlPlaneEntry,
  ) => {
    try {
      const result = await runAuthorityOperatorAction({ id: entry.id });
      if (result.state === "blocked") {
        toast.error(result.title, result.summary);
      } else if (result.state === "degraded") {
        toast.warning(result.title, result.summary);
      } else {
        toast.success(result.title, result.summary);
      }
      try {
        await refreshRuntime();
      } catch (refreshError) {
        toast.warning(
          "设置页快照刷新失败",
          refreshError instanceof Error ? refreshError.message : String(refreshError),
        );
      }
      return result;
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      toast.error(`${entry.actionLabel}失败`, message);
      throw error;
    }
  };

  return (
    <Card className="shadow-sm border-slate-200">
      <CardHeader className="pb-3 border-b bg-slate-50/70">
        <CardTitle className="flex items-center justify-between gap-3 text-lg">
          <div className="flex items-center gap-2">
            <Server className="w-5 h-5 text-slate-500" />
            V1 稳定性 Doctor 基线
          </div>
          <Badge variant="outline" className={doctorToneClass(doctorBaseline.overallState)}>
            {formatControlPlaneStateLabel(doctorBaseline.overallState)}
          </Badge>
        </CardTitle>
        <CardDescription>
          先分清 Gateway / Authority / Executor / Runtime 四层状态，再决定该修哪里。
        </CardDescription>
      </CardHeader>
      <CardContent className="pt-4 space-y-4">
        <ConnectionDiagnosisSummary
          variant="steady"
          state={doctorBaseline.overallState}
          title="连接成功后，从这里看稳态诊断"
          summary="Settings Doctor 负责解释 Authority 控制面的当前健康度、写入边界和固定回归清单。首次接入流程仍然留在 Connect。"
          detail={
            doctorBaseline.lastError
              ? `最近同步错误：${doctorBaseline.lastError}`
              : authorityDoctor
                ? `运行模式 ${doctorBaseline.mode} · 备份 ${authorityDoctor.backupCount} 份 · 最新备份 ${
                    authorityDoctor.latestBackupAt ? formatTime(authorityDoctor.latestBackupAt) : "尚无"
                  }`
                : `运行模式 ${doctorBaseline.mode}，已切到 command 的链路：${doctorBaseline.commandRoutes.join(", ")}`
          }
          layers={doctorBaseline.layers.map((layer) => ({
            id: layer.id,
            label: layer.label,
            state: layer.state,
            summary: layer.summary,
          }))}
        />

        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-3">
          {doctorBaseline.layers.map((layer) => (
            <div key={layer.id} className="rounded-xl border border-slate-200 bg-white p-3 space-y-2">
              <div className="flex items-center justify-between gap-2">
                <div className="text-sm font-semibold text-slate-900">{layer.label}</div>
                <Badge variant="outline" className={doctorToneClass(layer.state)}>
                  {formatControlPlaneStateLabel(layer.state)}
                </Badge>
              </div>
              <div className="text-xs text-slate-700">{layer.summary}</div>
              <div className="text-[11px] text-slate-500 break-all">{layer.detail}</div>
              {layer.timestamp ? (
                <div className="text-[11px] text-slate-400">最近时间：{formatTime(layer.timestamp)}</div>
              ) : null}
            </div>
          ))}
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          <div className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3">
            <div className="text-sm font-semibold text-slate-900">当前写入边界</div>
            <div className="mt-2 text-xs text-slate-600">
              运行模式：<span className="font-mono">{doctorBaseline.mode}</span>
            </div>
            <div className="mt-1 text-xs text-slate-600">
              `/runtime` 兼容路径：{doctorBaseline.compatibilityPathEnabled ? "仍开启" : "已关闭"}
            </div>
            <div className="mt-1 text-xs text-slate-600">
              兼容 slice：{doctorBaseline.compatibilitySlices.join(", ")}
            </div>
            <div className="mt-1 text-xs text-slate-600">
              Authority-owned slice：{doctorBaseline.authorityOwnedSlices.join(", ")}
            </div>
            <div className="mt-1 text-xs text-slate-600">
              已切到 command 的链路：{doctorBaseline.commandRoutes.join(", ")}
            </div>
            {doctorBaseline.lastError ? (
              <div className="mt-2 rounded-lg border border-amber-200 bg-amber-50 px-2.5 py-2 text-[11px] text-amber-800">
                最近同步错误：{doctorBaseline.lastError}
              </div>
            ) : null}
          </div>

          <div className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3">
            <div className="flex items-center justify-between gap-2">
              <div className="text-sm font-semibold text-slate-900">Authority 同步诊断</div>
              <Badge variant="outline" className={doctorToneClass(doctorBaseline.runtimeSync.state)}>
                {formatControlPlaneStateLabel(doctorBaseline.runtimeSync.state)}
              </Badge>
            </div>
            <div className="mt-2 text-xs text-slate-600">{doctorBaseline.runtimeSync.summary}</div>
            <div className="mt-1 text-[11px] text-slate-500">{doctorBaseline.runtimeSync.detail}</div>
            <div className="mt-3 grid grid-cols-2 gap-2 text-[11px] text-slate-600">
              {doctorBaseline.runtimeSync.metrics.map((item) => (
                <div key={item.label} className="rounded-lg border border-slate-200 bg-white px-2.5 py-2">
                  <div className="uppercase tracking-[0.12em] text-slate-400">{item.label}</div>
                  <div className="mt-1 font-semibold text-slate-900">{item.value}</div>
                </div>
              ))}
            </div>
            {doctorBaseline.runtimeSync.lastActivityAt ? (
              <div className="mt-2 text-[11px] text-slate-500">
                最近活动：{formatTime(doctorBaseline.runtimeSync.lastActivityAt)}
                {doctorBaseline.runtimeSync.lastAppliedSource
                  ? ` · 最近应用 ${doctorBaseline.runtimeSync.lastAppliedSource}`
                  : ""}
              </div>
            ) : null}
            {doctorBaseline.runtimeSync.warning ? (
              <div className="mt-2 rounded-lg border border-amber-200 bg-amber-50 px-2.5 py-2 text-[11px] text-amber-800">
                最近同步错误：{doctorBaseline.runtimeSync.warning}
              </div>
            ) : null}
          </div>

          <div className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3">
            <div className="text-sm font-semibold text-slate-900">固定回归清单</div>
            <div className="mt-2 space-y-1">
              {doctorBaseline.validationChecklist.map((item) => (
                <div key={item} className="text-xs text-slate-600">
                  - {item}
                </div>
              ))}
            </div>
          </div>

          <div className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3">
            <div className="text-sm font-semibold text-slate-900">Authority 运维快照</div>
            {authorityDoctor ? (
              <>
                <div className="mt-2 text-xs text-slate-600">
                  Schema：v{authorityDoctor.schemaVersion ?? "?"}
                </div>
                <div className="mt-1 text-xs text-slate-600">
                  完整性：{formatAuthorityIntegrityLabel(authorityDoctor.integrityStatus)}
                  {authorityDoctor.integrityMessage ? ` · ${authorityDoctor.integrityMessage}` : ""}
                </div>
                <div className="mt-2 text-xs text-slate-600">
                  备份：<strong>{authorityDoctor.backupCount}</strong> 份
                </div>
                <div className="mt-1 text-xs text-slate-600">
                  最近备份：{authorityDoctor.latestBackupAt ? formatTime(authorityDoctor.latestBackupAt) : "尚无"}
                </div>
                <div className="mt-1 text-xs text-slate-600 break-all">
                  备份目录：{authorityDoctor.backupDir}
                </div>
                <div className="mt-2 text-xs text-slate-600">
                  Companies / Runtimes / Events：{authorityDoctor.companyCount} / {authorityDoctor.runtimeCount} / {authorityDoctor.eventCount}
                </div>
                {authorityDoctor.issues.length > 0 ? (
                  <div className="mt-2 rounded-lg border border-amber-200 bg-amber-50 px-2.5 py-2 text-[11px] text-amber-800">
                    {authorityDoctor.issues[0]}
                  </div>
                ) : null}
              </>
            ) : (
              <div className="mt-2 text-xs text-slate-500">还没拿到 Authority 运维快照。</div>
            )}
          </div>

        </div>

        {authorityPreflight ? (
          <div className="rounded-xl border border-slate-200 bg-white px-4 py-3">
            <div className="flex items-center justify-between gap-2">
              <div className="text-sm font-semibold text-slate-900">启动前检查</div>
              <Badge variant="outline" className={doctorToneClass(authorityPreflight.status)}>
                {formatControlPlaneStateLabel(authorityPreflight.status)}
              </Badge>
            </div>
            <div className="mt-2 text-xs text-slate-600">
              SQLite：{authorityPreflight.dbExists ? "已存在，启动会直接复用" : "首次启动会自动初始化"}
            </div>
            <div className="mt-1 text-xs text-slate-600">
              Schema：v{authorityPreflight.schemaVersion ?? "?"}
            </div>
            <div className="mt-1 text-xs text-slate-600">
              完整性：{formatAuthorityIntegrityLabel(authorityPreflight.integrityStatus)}
              {authorityPreflight.integrityMessage ? ` · ${authorityPreflight.integrityMessage}` : ""}
            </div>
            <div className="mt-1 text-xs text-slate-600">
              标准备份：{authorityPreflight.backupCount} 份
              {authorityPreflight.latestBackupAt ? ` · 最新 ${formatTime(authorityPreflight.latestBackupAt)}` : ""}
            </div>
            <div className="mt-1 text-xs text-slate-600 break-all">
              Data dir：{authorityPreflight.dataDir}
            </div>
            <div className="mt-1 text-xs text-slate-600 break-all">
              Backup dir：{authorityPreflight.backupDir}
            </div>
            {authorityPreflight.notes.length > 0 ? (
              <div className="mt-2 space-y-1">
                {authorityPreflight.notes.map((note) => (
                  <div key={note} className="text-[11px] text-slate-500">
                    - {note}
                  </div>
                ))}
              </div>
            ) : null}
            {authorityPreflight.warnings.length > 0 ? (
              <div className="mt-2 rounded-lg border border-amber-200 bg-amber-50 px-2.5 py-2 text-[11px] text-amber-800">
                {authorityPreflight.warnings[0]}
              </div>
            ) : null}
            {authorityPreflight.issues.length > 0 ? (
              <div className="mt-2 rounded-lg border border-rose-200 bg-rose-50 px-2.5 py-2 text-[11px] text-rose-700">
                {authorityPreflight.issues[0]}
              </div>
            ) : null}
          </div>
        ) : null}

        <AuthorityControlPlaneSurface
          health={authorityHealth}
          summaryVariant="steady"
          summaryLimit={4}
          guidanceLimit={4}
          readinessLimit={4}
          onExecuteEntry={executeAuthorityOperatorEntry}
        />
      </CardContent>
    </Card>
  );
}
