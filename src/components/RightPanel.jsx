import { memo, useState } from "react";
import GlassPanel from "./GlassPanel";

const tabButtonClass = (active) =>
  [
    "rounded-full border px-3 py-1.5 text-xs font-medium transition duration-200 ease-out",
    "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/45",
    "motion-reduce:transition-none",
    active
      ? "border-white/35 bg-white/20 text-white"
      : "border-white/20 bg-white/8 text-white/70 hover:bg-white/14"
  ].join(" ");

const toneByDelta = (value) => {
  if (value > 0) {
    return "text-emerald-200";
  }
  if (value < 0) {
    return "text-rose-200";
  }
  return "text-white/70";
};

function RightPanel({
  indicators,
  selectedIndicatorKey,
  onSelectIndicator,
  chartCanvasRef,
  chartVisibility,
  onToggleChartLine,
  projections,
  stakeholders,
  upgrades,
  eventLog,
  leaderboard
}) {
  const [tab, setTab] = useState("trends");

  const trendsViewClass = tab === "trends" ? "block" : "hidden xl:block";
  const stakeholdersViewClass = tab === "stakeholders" ? "block" : "hidden xl:block";
  const logViewClass = tab === "log" ? "block" : "hidden xl:block";

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-3 gap-2 xl:hidden">
        <button type="button" className={tabButtonClass(tab === "trends")} onClick={() => setTab("trends")}>
          Trends
        </button>
        <button
          type="button"
          className={tabButtonClass(tab === "stakeholders")}
          onClick={() => setTab("stakeholders")}
        >
          Stakeholders
        </button>
        <button type="button" className={tabButtonClass(tab === "log")} onClick={() => setTab("log")}>
          Log
        </button>
      </div>

      <div className={trendsViewClass}>
        <GlassPanel title="Indicator Trends" subtitle="Click legend chips to toggle lines. Shift/Alt click to focus.">
          <div className="rounded-xl border border-white/15 bg-white/10 p-2">
            <canvas
              ref={chartCanvasRef}
              width={500}
              height={260}
              className="h-52 w-full rounded-lg"
              aria-label="Indicator trend chart"
              role="img"
            />
          </div>

          <div className="mt-3 flex flex-wrap gap-2">
            {indicators.map((indicator) => {
              const active = selectedIndicatorKey === indicator.key;
              const visible = chartVisibility[indicator.key] !== false;

              return (
                <button
                  key={indicator.key}
                  type="button"
                  onClick={(event) => {
                    if (event.shiftKey || event.altKey) {
                      onSelectIndicator(indicator.key);
                    } else {
                      onToggleChartLine(indicator.key);
                    }
                  }}
                  className={[
                    "inline-flex items-center gap-2 rounded-full border px-3 py-1.5 text-xs",
                    "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/45",
                    visible ? "border-white/25 bg-white/12 text-white" : "border-white/15 bg-white/6 text-white/45",
                    active && "ring-1 ring-white/50"
                  ]
                    .filter(Boolean)
                    .join(" ")}
                >
                  <span className="h-2 w-2 rounded-full" style={{ backgroundColor: indicator.color }} aria-hidden />
                  {indicator.label}
                </button>
              );
            })}
          </div>
        </GlassPanel>

        <GlassPanel title="2-Cycle Projection" className="mt-3">
          <ul className="space-y-2 text-xs">
            {projections.map((projection) => {
              const active = selectedIndicatorKey === projection.key;
              return (
                <li
                  key={projection.key}
                  className={[
                    "flex items-center justify-between rounded-lg border border-white/15 bg-white/10 px-3 py-2",
                    active && "ring-1 ring-white/40"
                  ]
                    .filter(Boolean)
                    .join(" ")}
                >
                  <button
                    type="button"
                    onClick={() => onSelectIndicator(projection.key)}
                    className="text-left text-white/90 focus-visible:outline-none"
                  >
                    {projection.label}: {projection.values.map((value) => value.toFixed(1)).join(" -> ")}
                  </button>
                  {projection.warning && <span className="font-medium text-rose-200">Critical risk</span>}
                </li>
              );
            })}
          </ul>
        </GlassPanel>
      </div>

      <div className={stakeholdersViewClass}>
        <div className="grid gap-3 xl:grid-cols-1 2xl:grid-cols-2">
          <GlassPanel title="Stakeholders">
            <div className="space-y-3">
              {stakeholders.map((stakeholder) => (
                <div key={stakeholder.id} className="space-y-1.5">
                  <div className="flex items-center justify-between text-xs text-white/90">
                    <span>{stakeholder.label}</span>
                    <span className={toneByDelta(stakeholder.delta)}>
                      {stakeholder.delta > 0 ? "+" : ""}
                      {stakeholder.delta.toFixed(1)}
                    </span>
                  </div>
                  <div className="relative h-2 overflow-hidden rounded-full border border-white/20 bg-white/10">
                    <div className="absolute inset-0 bg-gradient-to-r from-rose-300/25 via-amber-300/25 to-emerald-300/25" />
                    <div
                      className="relative h-full rounded-full bg-gradient-to-r from-emerald-300 to-emerald-500"
                      style={{ width: `${stakeholder.value}%` }}
                    />
                  </div>
                </div>
              ))}
            </div>
          </GlassPanel>

          <GlassPanel title="Technology Upgrades">
            <div className="space-y-3">
              {upgrades.map((upgrade) => (
                <div key={upgrade.id} className="space-y-1.5">
                  <div className="flex items-center justify-between text-xs text-white/90">
                    <span>{upgrade.label}</span>
                    <span>
                      L{upgrade.level}/{upgrade.maxLevel}
                    </span>
                  </div>
                  <div className="relative h-2 overflow-hidden rounded-full border border-white/20 bg-white/10">
                    <div className="absolute inset-0 bg-gradient-to-r from-sky-300/20 to-emerald-300/20" />
                    <div
                      className="relative h-full rounded-full bg-gradient-to-r from-sky-300 to-emerald-300"
                      style={{ width: `${upgrade.progress}%` }}
                    />
                  </div>
                  <p className={["text-[11px]", toneByDelta(upgrade.delta)].join(" ")}>
                    Delta: {upgrade.delta > 0 ? "+" : ""}
                    {upgrade.delta}
                  </p>
                </div>
              ))}
            </div>
          </GlassPanel>
        </div>
      </div>

      <div className={logViewClass}>
        <div className="grid gap-3 xl:grid-cols-1 2xl:grid-cols-2">
          <GlassPanel title="Event Log" subtitle="Latest simulation events" contentClassName="max-h-52 overflow-y-auto">
            <ul className="space-y-2 text-xs text-white/85">
              {eventLog.map((entry) => (
                <li key={entry.id} className="rounded-lg border border-white/15 bg-white/10 px-3 py-2">
                  Y{entry.year} C{entry.cycle}: {entry.message}
                </li>
              ))}
            </ul>
          </GlassPanel>

          <GlassPanel title="Leaderboard" subtitle="Top sustainability runs" contentClassName="max-h-52 overflow-y-auto">
            <ul className="space-y-2 text-xs text-white/85">
              {leaderboard.map((entry) => (
                <li key={entry.id} className="rounded-lg border border-white/15 bg-white/10 px-3 py-2">
                  {entry.result.toUpperCase()} | {entry.difficulty} | Year {entry.year} | Score {Number(entry.score).toFixed(2)}
                </li>
              ))}
            </ul>
          </GlassPanel>
        </div>
      </div>
    </div>
  );
}

export default memo(RightPanel);
