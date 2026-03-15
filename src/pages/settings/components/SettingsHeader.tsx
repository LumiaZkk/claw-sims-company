import { Badge } from "../../../ui/badge";
import { Button } from "../../../ui/button";
import type { RunCommand } from "./settings-helpers";

export function SettingsHeader(props: {
  connected: boolean;
  loading: boolean;
  refreshRuntime: () => Promise<unknown>;
  runCommand: RunCommand;
}) {
  const { connected, loading, refreshRuntime, runCommand } = props;
  return (
    <div className="flex items-center justify-between">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">全局设置</h1>
        <p className="text-muted-foreground mt-1 text-sm">
          统一化管理安全网关、算力配置、接入渠道与运营实体
        </p>
      </div>
      <div className="flex items-center gap-2">
        <Badge
          variant="outline"
          className={connected ? "text-green-700 bg-green-50 border-green-300" : "text-slate-500"}
        >
          {connected ? "Gateway 已连接" : "Gateway 未连接"}
        </Badge>
        <Button
          variant="outline"
          onClick={() =>
            void runCommand(
              async () => {
                await refreshRuntime();
                return {
                  title: "运行时已刷新",
                  description: "已获取最新编排、渠道和技能状态。",
                };
              },
              "刷新运行时失败",
            )
          }
          disabled={loading}
        >
          获取最新编排
        </Button>
      </div>
    </div>
  );
}
