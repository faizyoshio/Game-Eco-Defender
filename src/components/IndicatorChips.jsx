const STATE_STYLES = {
  safe: "border-emerald-200/35 bg-emerald-300/10 text-emerald-100",
  moderate: "border-amber-100/35 bg-amber-200/10 text-amber-100",
  unhealthy: "border-orange-200/35 bg-orange-300/10 text-orange-100",
  critical: "border-rose-200/40 bg-rose-400/10 text-rose-100"
};

export default function IndicatorChips({ indicators, activeKey, onSelect }) {
  return (
    <div className="flex flex-wrap gap-2">
      {indicators.map((indicator) => {
        const active = activeKey === indicator.key;
        return (
          <button
            key={indicator.key}
            type="button"
            onClick={() => onSelect(indicator.key)}
            aria-pressed={active}
            className={[
              "inline-flex items-center gap-2 rounded-full border px-3 py-1.5 text-xs transition duration-200 ease-out",
              "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/45",
              "motion-reduce:transition-none",
              STATE_STYLES[indicator.state] || STATE_STYLES.moderate,
              active && "ring-1 ring-white/50 shadow-lg shadow-black/20"
            ]
              .filter(Boolean)
              .join(" ")}
          >
            <span className="h-2 w-2 rounded-full" style={{ backgroundColor: indicator.color }} aria-hidden />
            <span className="font-medium">{indicator.label}</span>
            <span className="text-white/80">{indicator.value.toFixed(1)}</span>
            <span className="capitalize text-white/65">{indicator.state}</span>
          </button>
        );
      })}
    </div>
  );
}
