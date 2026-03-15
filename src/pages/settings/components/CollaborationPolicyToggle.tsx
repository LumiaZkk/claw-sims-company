export function CollaborationPolicyToggle(props: {
  label: string;
  active: boolean;
  disabled: boolean;
  onToggle: (next: boolean) => void;
}) {
  const { label, active, disabled, onToggle } = props;

  return (
    <button
      type="button"
      className={`rounded-lg border px-3 py-2 text-left text-sm transition ${
        active
          ? "border-emerald-300 bg-emerald-50 text-emerald-800"
          : "border-slate-200 bg-white text-slate-600"
      } ${disabled ? "cursor-not-allowed opacity-60" : "hover:border-indigo-300 hover:bg-indigo-50/60"}`}
      onClick={() => onToggle(!active)}
      disabled={disabled}
    >
      <div className="font-medium">{label}</div>
      <div className="mt-1 text-[11px]">{active ? "已启用" : "已关闭"}</div>
    </button>
  );
}
