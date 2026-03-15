import { Button } from "../../../ui/button";

type DecisionOption = {
  id: string;
  label: string;
};

type DecisionTicket = {
  summary: string;
  options: DecisionOption[];
};

export function RequirementDecisionPanel(props: {
  decisionTicket: DecisionTicket | null;
  decisionSubmittingOptionId: string | null;
  onResolveDecision: (optionId: string) => void;
}) {
  const {
    decisionTicket,
    decisionSubmittingOptionId,
    onResolveDecision,
  } = props;

  if (!decisionTicket) {
    return null;
  }

  return (
    <div className="rounded-2xl border border-amber-200 bg-amber-50/80 px-4 py-3 text-sm text-amber-950 shadow-sm">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="text-[11px] font-semibold uppercase tracking-[0.16em] text-amber-700">
            待你决策
          </div>
          <div className="mt-2 font-semibold">{decisionTicket.summary}</div>
        </div>
        <div className="flex flex-wrap gap-2">
          {decisionTicket.options.map((option) => (
            <Button
              key={option.id}
              variant="outline"
              className="border-amber-300 bg-white text-amber-900 hover:bg-amber-100"
              onClick={() => onResolveDecision(option.id)}
              disabled={decisionSubmittingOptionId === option.id}
            >
              {decisionSubmittingOptionId === option.id ? "处理中..." : option.label}
            </Button>
          ))}
        </div>
      </div>
    </div>
  );
}
