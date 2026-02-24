import { useMemo, useRef, useState } from "react";
import GlassPanel from "./components/GlassPanel";
import StatCapsule from "./components/StatCapsule";
import IndicatorChips from "./components/IndicatorChips";
import PolicyCard from "./components/PolicyCard";
import PolicyModal from "./components/PolicyModal";
import RightPanel from "./components/RightPanel";
import { createInitialGameState } from "./data/mockGameData";

const formatMoney = (value) => `$${Math.round(value)}M`;
const formatPopulation = (value) => new Intl.NumberFormat("en-US").format(value);

export default function App() {
  // Replace this mock state with your live simulation snapshot/store.
  const [gameView, setGameView] = useState(() => createInitialGameState());
  const [selectedIndicatorKey, setSelectedIndicatorKey] = useState("air");
  const [activePolicy, setActivePolicy] = useState(null);
  const [cycleLockedPolicyId, setCycleLockedPolicyId] = useState(null);
  const [toast, setToast] = useState("");

  const detailsTriggerRef = useRef(null);
  const toastTimerRef = useRef(null);

  const statCapsules = useMemo(
    () => [
      { label: "Budget", value: formatMoney(gameView.status.budgetM) },
      { label: "Year", value: String(gameView.status.year) },
      { label: "Population", value: formatPopulation(gameView.status.population) },
      { label: "Debt", value: formatMoney(gameView.status.debtM) },
      { label: "Interest/Cycle", value: formatMoney(gameView.status.interestPerCycleM) }
    ],
    [gameView.status]
  );

  const emitToast = (message) => {
    setToast(message);

    if (toastTimerRef.current) {
      window.clearTimeout(toastTimerRef.current);
    }

    toastTimerRef.current = window.setTimeout(() => {
      setToast("");
    }, 2200);
  };

  const handleTopAction = (action) => {
    if (action === "new") {
      setGameView(createInitialGameState());
      setCycleLockedPolicyId(null);
      emitToast("New game session initialized.");
      return;
    }

    if (action === "save") {
      // Plug in real save action here.
      emitToast("Game saved (wire to your persistence layer).");
      return;
    }

    // Plug in real load action here.
    emitToast("Save loaded (wire to your persistence loader).");
  };

  const handleModeChange = (nextMode) => {
    setGameView((prev) => ({
      ...prev,
      status: {
        ...prev.status,
        mode: nextMode
      }
    }));
    emitToast(`Mode switched to ${nextMode}.`);
  };

  const handleEnactPolicy = (policy) => {
    if (cycleLockedPolicyId) {
      emitToast("Policy already selected this cycle.");
      return;
    }

    if (policy.cooldownRemaining > 0) {
      emitToast(`${policy.title} is on cooldown.`);
      return;
    }

    if (gameView.status.budgetM < policy.costM) {
      emitToast("Insufficient budget.");
      return;
    }

    setCycleLockedPolicyId(policy.id);
    setGameView((prev) => ({
      ...prev,
      status: {
        ...prev.status,
        budgetM: Math.max(0, prev.status.budgetM - policy.costM)
      },
      eventLog: [
        {
          id: `event-${Date.now()}`,
          year: prev.status.year,
          cycle: prev.roundInfo.cycleInYear,
          message: `Policy enacted: ${policy.title}`
        },
        ...prev.eventLog
      ].slice(0, 12)
    }));

    emitToast(`Policy enacted: ${policy.title}`);
  };

  const handleOpenPolicy = (policy, triggerNode) => {
    detailsTriggerRef.current = triggerNode;
    setActivePolicy(policy);
  };

  const handleClosePolicy = () => {
    setActivePolicy(null);
  };

  return (
    <div className="relative min-h-full overflow-x-hidden bg-gradient-to-br from-emerald-950 via-teal-950 to-slate-950 text-white">
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 opacity-30"
        style={{
          backgroundImage:
            "radial-gradient(circle at 15% 10%, rgba(100, 255, 197, 0.22), transparent 40%), radial-gradient(circle at 85% 20%, rgba(89, 174, 255, 0.18), transparent 45%), radial-gradient(circle at 2px 2px, rgba(255,255,255,0.13) 1px, transparent 0)",
          backgroundSize: "auto, auto, 4px 4px"
        }}
      />

      <div className="relative mx-auto flex min-h-full w-full max-w-[1500px] flex-col gap-3 p-3 sm:p-4 lg:p-5">
        <GlassPanel className="p-0">
          <div className="grid gap-3 px-4 py-4 xl:grid-cols-[minmax(220px,1fr)_minmax(420px,1.5fr)_auto] xl:items-center">
            <div>
              <h1 className="text-lg font-bold leading-tight text-white">{gameView.meta.title}</h1>
              <p className="text-xs uppercase tracking-[0.12em] text-white/70">{gameView.meta.subtitle}</p>
            </div>

            <div className="flex gap-2 overflow-x-auto pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
              {statCapsules.map((item) => (
                <StatCapsule key={item.label} label={item.label} value={item.value} />
              ))}
            </div>

            <div className="flex flex-wrap items-center justify-start gap-2 xl:justify-end">
              <label className="text-xs text-white/75" htmlFor="mode-select">
                Mode
              </label>
              <select
                id="mode-select"
                value={gameView.status.mode}
                onChange={(event) => handleModeChange(event.target.value)}
                className="rounded-lg border border-white/25 bg-white/10 px-3 py-2 text-sm text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/45"
              >
                {gameView.modeOptions.map((mode) => (
                  <option key={mode} value={mode} className="bg-slate-900 text-white">
                    {mode}
                  </option>
                ))}
              </select>

              <button
                type="button"
                onClick={() => handleTopAction("new")}
                className="rounded-lg border border-white/25 bg-white/10 px-3 py-2 text-sm font-medium text-white transition duration-200 ease-out hover:-translate-y-0.5 hover:bg-white/20 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/45 motion-reduce:transition-none motion-reduce:transform-none"
              >
                New
              </button>
              <button
                type="button"
                onClick={() => handleTopAction("save")}
                className="rounded-lg border border-white/25 bg-white/10 px-3 py-2 text-sm font-medium text-white transition duration-200 ease-out hover:-translate-y-0.5 hover:bg-white/20 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/45 motion-reduce:transition-none motion-reduce:transform-none"
              >
                Save
              </button>
              <button
                type="button"
                onClick={() => handleTopAction("load")}
                className="rounded-lg border border-white/25 bg-white/10 px-3 py-2 text-sm font-medium text-white transition duration-200 ease-out hover:-translate-y-0.5 hover:bg-white/20 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/45 motion-reduce:transition-none motion-reduce:transform-none"
              >
                Load
              </button>
            </div>
          </div>
        </GlassPanel>

        <main className="grid min-h-0 gap-3 xl:grid-cols-[minmax(0,2fr)_minmax(360px,1fr)]">
          <GlassPanel className="p-0">
            <div className="relative min-h-[420px] overflow-hidden rounded-2xl">
              <div className="absolute inset-0 bg-gradient-to-br from-emerald-600/30 via-sky-600/20 to-slate-900/55" />
              <div className="absolute inset-0 bg-[radial-gradient(circle_at_20%_20%,rgba(255,255,255,0.26),transparent_38%)]" />

              <div className="absolute left-4 top-4 rounded-full border border-white/20 bg-white/10 px-3 py-1 text-xs text-white/85 backdrop-blur-xl">
                Cycle {gameView.roundInfo.cycleInYear}/{gameView.roundInfo.cyclesPerYear} | Stability {gameView.roundInfo.stabilityCycles}/
                {gameView.roundInfo.targetStabilityCycles}
              </div>

              <div className="absolute left-4 right-4 top-16">
                <IndicatorChips
                  indicators={gameView.indicators}
                  activeKey={selectedIndicatorKey}
                  onSelect={setSelectedIndicatorKey}
                />
              </div>

              <div className="absolute bottom-4 left-4 right-4 rounded-lg border border-white/20 bg-white/10 px-3 py-2 text-xs text-white/85 backdrop-blur-xl sm:max-w-[70%]">
                {gameView.roundInfo.eventBanner}
              </div>

              <div className="absolute inset-0 grid place-items-center text-center">
                <div>
                  <p className="text-sm font-semibold text-white/90">{gameView.cityScene.title}</p>
                  <p className="mt-1 text-xs text-white/70">{gameView.cityScene.subtitle}</p>
                </div>
              </div>
            </div>
          </GlassPanel>

          <RightPanel
            indicators={gameView.indicators}
            selectedIndicatorKey={selectedIndicatorKey}
            onSelectIndicator={setSelectedIndicatorKey}
            trendSeries={gameView.trendSeries}
            projections={gameView.projections}
            stakeholders={gameView.stakeholders}
            upgrades={gameView.upgrades}
            eventLog={gameView.eventLog}
            leaderboard={gameView.leaderboard}
          />
        </main>

        <GlassPanel
          title="Policy Choices"
          subtitle="Pick one policy per cycle"
          action={
            <button
              type="button"
              onClick={() => {
                setCycleLockedPolicyId(null);
                emitToast("Cycle advanced. Policy lock cleared.");
              }}
              className="rounded-lg border border-white/25 bg-white/10 px-3 py-2 text-xs font-medium text-white transition duration-200 ease-out hover:-translate-y-0.5 hover:bg-white/20 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/45 motion-reduce:transition-none motion-reduce:transform-none"
            >
              Skip Cycle
            </button>
          }
        >
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
            {gameView.policies.map((policy) => (
              <PolicyCard
                key={policy.id}
                policy={policy}
                budgetM={gameView.status.budgetM}
                cycleLocked={Boolean(cycleLockedPolicyId)}
                enacted={cycleLockedPolicyId === policy.id}
                onEnact={handleEnactPolicy}
                onOpenDetails={handleOpenPolicy}
              />
            ))}
          </div>
        </GlassPanel>
      </div>

      <PolicyModal
        policy={activePolicy}
        isOpen={Boolean(activePolicy)}
        onClose={handleClosePolicy}
        restoreFocusRef={detailsTriggerRef}
      />

      <div className="pointer-events-none fixed bottom-4 right-4 z-40" aria-live="polite">
        {toast && (
          <div className="rounded-xl border border-white/25 bg-white/15 px-4 py-2 text-sm text-white backdrop-blur-xl shadow-floating">
            {toast}
          </div>
        )}
      </div>
    </div>
  );
}
