const IMPACT_TONE = {
  positive: "border-emerald-200/40 bg-emerald-200/15 text-emerald-100",
  negative: "border-rose-200/40 bg-rose-200/15 text-rose-100",
  "negative-tradeoff": "border-amber-200/40 bg-amber-200/15 text-amber-100"
};

export default function PolicyCard({
  policy,
  budgetM,
  cycleLocked,
  enacted,
  onEnact,
  onOpenDetails
}) {
  const affordable = budgetM >= policy.costM;
  const coolingDown = policy.cooldownRemaining > 0;
  const disabled = cycleLocked || coolingDown || !affordable;

  let actionLabel = "Enact Policy";
  if (enacted) {
    actionLabel = "Enacted";
  } else if (cycleLocked) {
    actionLabel = "Cycle Locked";
  } else if (coolingDown) {
    actionLabel = `Cooldown (${policy.cooldownRemaining})`;
  } else if (!affordable) {
    actionLabel = "Insufficient Budget";
  }

  return (
    <article
      className={[
        "relative overflow-hidden rounded-xl border border-white/20 bg-white/12 p-4 backdrop-blur-xl shadow-glass",
        "transition duration-200 ease-out hover:-translate-y-0.5 hover:shadow-floating",
        "motion-reduce:transition-none motion-reduce:transform-none"
      ].join(" ")}
    >
      <div aria-hidden className="pointer-events-none absolute inset-0 bg-gradient-to-br from-white/20 via-white/5 to-transparent" />

      <div className="relative space-y-3">
        <div>
          <h3 className="text-sm font-semibold text-white">{policy.title}</h3>
          <p className="mt-1 line-clamp-2 text-xs text-white/75">{policy.summary}</p>
        </div>

        <div className="flex flex-wrap gap-2 text-[11px] text-white/85">
          <span className="rounded-full border border-white/20 bg-white/10 px-2 py-1">Cost ${policy.costM}M</span>
          <span className="rounded-full border border-white/20 bg-white/10 px-2 py-1">Ramp {policy.rampCycles} cycles</span>
          <span className="rounded-full border border-white/20 bg-white/10 px-2 py-1">Cooldown {policy.cooldownCycles}</span>
        </div>

        <div className="flex flex-wrap gap-2">
          {policy.impacts.map((impact) => {
            const sign = impact.value > 0 ? "+" : "";
            return (
              <span
                key={`${policy.id}-${impact.label}`}
                className={[
                  "rounded-full border px-2.5 py-1 text-[11px]",
                  IMPACT_TONE[impact.direction] || IMPACT_TONE.negative
                ].join(" ")}
              >
                {impact.label}: {sign}
                {impact.value}
              </span>
            );
          })}
        </div>

        <div className="grid grid-cols-2 gap-2 pt-1">
          <button
            type="button"
            onClick={() => onEnact(policy)}
            disabled={disabled}
            className={[
              "rounded-lg border border-white/25 bg-gradient-to-br from-emerald-400/85 to-emerald-700/85 px-3 py-2 text-xs font-semibold text-white",
              "transition duration-200 ease-out hover:-translate-y-0.5 hover:shadow-xl hover:shadow-emerald-950/35",
              "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/45",
              "disabled:cursor-not-allowed disabled:opacity-50",
              "motion-reduce:transition-none motion-reduce:transform-none"
            ].join(" ")}
          >
            {actionLabel}
          </button>

          <button
            type="button"
            onClick={(event) => onOpenDetails(policy, event.currentTarget)}
            className={[
              "rounded-lg border border-white/25 bg-white/10 px-3 py-2 text-xs font-medium text-white/90",
              "transition duration-200 ease-out hover:-translate-y-0.5 hover:shadow-xl hover:shadow-black/20",
              "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/45",
              "motion-reduce:transition-none motion-reduce:transform-none"
            ].join(" ")}
          >
            Details
          </button>
        </div>
      </div>
    </article>
  );
}
