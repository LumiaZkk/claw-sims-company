import { ChevronDown, ChevronUp } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "../../../ui/card";
import { stringifyPreview } from "./settings-helpers";

export function SettingsAdvancedSection(props: {
  advancedOpen: boolean;
  setAdvancedOpen: (open: boolean) => void;
  status: unknown;
  channels: unknown;
  skills: unknown;
}) {
  const { advancedOpen, setAdvancedOpen, status, channels, skills } = props;
  return (
    <div className="mt-12 border rounded-xl overflow-hidden bg-white shadow-sm">
      <button
        className="w-full flex items-center justify-between p-4 bg-slate-50 hover:bg-slate-100 transition-colors text-left"
        onClick={() => setAdvancedOpen(!advancedOpen)}
      >
        <div>
          <h3 className="font-semibold text-slate-700">系统底层探针监测器</h3>
          <p className="text-xs text-slate-500 mt-1">
            仅供系统级排错与高级运维参考，包含各注册集群的心跳快照。
          </p>
        </div>
        {advancedOpen ? (
          <ChevronUp className="text-slate-400" />
        ) : (
          <ChevronDown className="text-slate-400" />
        )}
      </button>

      {advancedOpen && (
        <div className="p-4 border-t grid grid-cols-1 lg:grid-cols-3 gap-4 bg-slate-50/50">
          <Card className="shadow-none border-slate-200">
            <CardHeader className="py-3">
              <CardTitle className="text-sm">网关心跳切片</CardTitle>
            </CardHeader>
            <CardContent className="p-0 border-t">
              <pre className="text-[10px] bg-slate-950 text-slate-300 p-3 overflow-auto h-64 rounded-b-lg m-0">
                {stringifyPreview(status)}
              </pre>
            </CardContent>
          </Card>
          <Card className="shadow-none border-slate-200">
            <CardHeader className="py-3">
              <CardTitle className="text-sm">外网联络站切片</CardTitle>
            </CardHeader>
            <CardContent className="p-0 border-t">
              <pre className="text-[10px] bg-slate-950 text-slate-300 p-3 overflow-auto h-64 rounded-b-lg m-0">
                {stringifyPreview(channels)}
              </pre>
            </CardContent>
          </Card>
          <Card className="shadow-none border-slate-200">
            <CardHeader className="py-3">
              <CardTitle className="text-sm">内核函数块切片</CardTitle>
            </CardHeader>
            <CardContent className="p-0 border-t">
              <pre className="text-[10px] bg-slate-950 text-slate-300 p-3 overflow-auto h-64 rounded-b-lg m-0">
                {stringifyPreview(skills)}
              </pre>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}
