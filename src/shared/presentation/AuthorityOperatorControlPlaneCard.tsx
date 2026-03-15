import { useMemo, useState } from "react";
import type { AuthorityOperatorActionResponse } from "../../application/gateway/authority-types";
import type {
  AuthorityOperatorControlPlaneEntry,
  AuthorityOperatorControlPlaneModel,
} from "../../application/gateway/authority-health";
import { ActionFormDialog } from "../../ui/action-form-dialog";
import { Button } from "../../ui/button";

function toneClasses(state: AuthorityOperatorActionResponse["state"]) {
  if (state === "ready") {
    return "border-emerald-200 bg-emerald-50 text-emerald-800";
  }
  if (state === "blocked") {
    return "border-rose-200 bg-rose-50 text-rose-700";
  }
  return "border-amber-200 bg-amber-50 text-amber-800";
}

export function AuthorityOperatorControlPlaneCard(input: {
  model: AuthorityOperatorControlPlaneModel;
  onExecuteEntry?: (
    entry: AuthorityOperatorControlPlaneEntry,
  ) => Promise<AuthorityOperatorActionResponse>;
}) {
  const [busyEntryId, setBusyEntryId] = useState<string | null>(null);
  const [confirmEntryId, setConfirmEntryId] = useState<string | null>(null);
  const [results, setResults] = useState<Record<string, AuthorityOperatorActionResponse>>({});
  const [errors, setErrors] = useState<Record<string, string>>({});

  const confirmEntry = useMemo(
    () => input.model.entries.find((entry) => entry.id === confirmEntryId) ?? null,
    [confirmEntryId, input.model.entries],
  );

  const runEntry = async (entry: AuthorityOperatorControlPlaneEntry) => {
    if (!input.onExecuteEntry) {
      return false;
    }
    setBusyEntryId(entry.id);
    setErrors((current) => ({ ...current, [entry.id]: "" }));
    try {
      const result = await input.onExecuteEntry(entry);
      setResults((current) => ({ ...current, [entry.id]: result }));
      return true;
    } catch (error) {
      setErrors((current) => ({
        ...current,
        [entry.id]: error instanceof Error ? error.message : String(error),
      }));
      return false;
    } finally {
      setBusyEntryId(null);
    }
  };

  return (
    <div className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3">
      <div className="text-sm font-semibold text-slate-900">{input.model.title}</div>
      <div className="mt-1 text-xs text-slate-600">{input.model.summary}</div>
      {input.model.detail ? (
        <div className="mt-2 text-[11px] text-slate-500">{input.model.detail}</div>
      ) : null}
      <div className="mt-3 space-y-2">
        {input.model.entries.map((entry) => {
          const result = results[entry.id];
          const error = errors[entry.id];
          const busy = busyEntryId === entry.id;
          return (
            <div key={entry.id} className="rounded-lg border border-slate-200 bg-white px-3 py-2">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="text-xs font-semibold text-slate-900">{entry.title}</div>
                  <div className="mt-1 text-[11px] text-slate-600">{entry.summary}</div>
                </div>
                {input.onExecuteEntry ? (
                  <Button
                    type="button"
                    size="sm"
                    variant={entry.id === "restore-apply" ? "destructive" : "outline"}
                    disabled={busyEntryId !== null}
                    onClick={() => {
                      if (entry.confirmationText) {
                        setConfirmEntryId(entry.id);
                        return;
                      }
                      void runEntry(entry);
                    }}
                  >
                    {busy ? "处理中..." : entry.actionLabel}
                  </Button>
                ) : null}
              </div>
              <div className="mt-2 rounded border border-slate-200 bg-slate-50 px-2 py-1 font-mono text-[11px] text-slate-700">
                {entry.command}
              </div>
              {result ? (
                <div className={`mt-2 rounded-lg border px-2.5 py-2 text-[11px] ${toneClasses(result.state)}`}>
                  <div className="font-semibold">{result.title}</div>
                  <div className="mt-1">{result.summary}</div>
                  {result.detail ? <div className="mt-1 break-all">{result.detail}</div> : null}
                  <details className="mt-2">
                    <summary className="cursor-pointer text-[11px] font-medium">查看执行报告</summary>
                    <pre className="mt-2 whitespace-pre-wrap break-all font-mono text-[10px] leading-5">
                      {result.report}
                    </pre>
                  </details>
                </div>
              ) : null}
              {error ? (
                <div className="mt-2 rounded-lg border border-rose-200 bg-rose-50 px-2.5 py-2 text-[11px] text-rose-700">
                  {error}
                </div>
              ) : null}
            </div>
          );
        })}
      </div>

      <ActionFormDialog
        open={Boolean(confirmEntry)}
        onOpenChange={(open) => {
          if (!open) {
            setConfirmEntryId(null);
          }
        }}
        title={confirmEntry?.confirmationTitle ?? "确认执行控制面动作"}
        description={
          confirmEntry?.confirmationDescription ??
          "这项操作会直接影响 Authority 本地权威源，请确认后再继续。"
        }
        confirmLabel={confirmEntry?.actionLabel ?? "执行"}
        busy={Boolean(confirmEntry && busyEntryId === confirmEntry.id)}
        fields={
          confirmEntry?.confirmationText
            ? [
                {
                  name: "confirmation",
                  label: `输入 ${confirmEntry.confirmationText} 确认继续`,
                  placeholder: confirmEntry.confirmationText,
                  required: true,
                  confirmationText: confirmEntry.confirmationText,
                },
              ]
            : []
        }
        onSubmit={async () => {
          if (!confirmEntry) {
            return;
          }
          const success = await runEntry(confirmEntry);
          if (success) {
            setConfirmEntryId(null);
          }
        }}
      />
    </div>
  );
}
