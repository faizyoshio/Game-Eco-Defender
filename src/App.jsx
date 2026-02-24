import { useEffect, useMemo, useRef, useState } from "react";
import GlassPanel from "./components/GlassPanel";
import StatCapsule from "./components/StatCapsule";
import IndicatorChips from "./components/IndicatorChips";
import PolicyCard from "./components/PolicyCard";
import PolicyModal from "./components/PolicyModal";
import RightPanel from "./components/RightPanel";
import { GAME_DATA } from "./data.js";
import { SimulationEngine } from "./simulation.js";
import { RenderEngine } from "./render.js";

const IMPACT_LABELS = {
  economy: "Economy",
  air: "Air",
  water: "Water",
  soil: "Soil",
  carbon: "Carbon"
};

const UPGRADE_LABELS = {
  wasteTreatment: "Waste Treatment",
  renewableEnergy: "Renewable Energy",
  airFiltration: "Air Filtration"
};

const formatMoney = (value) => {
  const rounded = Math.round(value);
  const sign = rounded < 0 ? "-" : "";
  return `${sign}$${Math.abs(rounded)}M`;
};

const formatPopulation = (value) => new Intl.NumberFormat("en-US").format(Math.round(value));

const toTitleCase = (value) => {
  if (!value) {
    return "";
  }

  return value
    .replace(/_/g, " ")
    .split(" ")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
};

const derivePolicyViewModel = (policy, cooldownRemaining = 0) => {
  const impacts = Object.entries(policy.impacts || {}).map(([key, value]) => {
    const isPositive = key === "carbon" ? value < 0 : value >= 0;
    return {
      label: IMPACT_LABELS[key] || toTitleCase(key),
      value,
      direction: isPositive ? "positive" : "negative"
    };
  });

  const strongestDeltas = [...impacts]
    .sort((a, b) => Math.abs(b.value) - Math.abs(a.value))
    .slice(0, 2)
    .map((entry) => ({
      label: `${entry.label} trend`,
      value: `${entry.value > 0 ? "+" : ""}${entry.value} over ramp window`,
      tone: entry.direction === "positive" ? "positive" : "negative"
    }));

  return {
    id: policy.id,
    title: policy.title,
    summary: policy.description,
    description: policy.description,
    costM: policy.cost,
    rampCycles: policy.effectTiming?.rampCycles ?? GAME_DATA.policyDefaults.effectTiming.rampCycles,
    cooldownCycles: policy.cooldownCycles ?? GAME_DATA.policyDefaults.cooldownCycles,
    cooldownRemaining,
    impacts,
    projectedDeltas: [
      {
        label: "Budget",
        value: `-${policy.cost}M immediate`,
        tone: "warning"
      },
      ...strongestDeltas
    ]
  };
};

export default function App() {
  const simulationRef = useRef(null);
  const renderEngineRef = useRef(null);
  const rafRef = useRef(null);
  const snapshotRef = useRef(null);
  const detailsTriggerRef = useRef(null);
  const toastTimerRef = useRef(null);
  const bannerTimerRef = useRef(null);

  const cityCanvasRef = useRef(null);
  const chartCanvasRef = useRef(null);

  const [snapshot, setSnapshot] = useState(null);
  const [previousSnapshot, setPreviousSnapshot] = useState(null);
  const [selectedMode, setSelectedMode] = useState("realistic");
  const [selectedIndicatorKey, setSelectedIndicatorKey] = useState("air");
  const [chartVisibility, setChartVisibility] = useState(() =>
    Object.fromEntries(GAME_DATA.indicators.map((indicator) => [indicator.key, true]))
  );

  const [activePolicy, setActivePolicy] = useState(null);
  const [toast, setToast] = useState("");
  const [banner, setBanner] = useState("");

  const emitToast = (message) => {
    if (!message) {
      return;
    }

    setToast(message);
    if (toastTimerRef.current) {
      window.clearTimeout(toastTimerRef.current);
    }

    toastTimerRef.current = window.setTimeout(() => {
      setToast("");
    }, 2200);
  };

  useEffect(() => {
    const simulation = new SimulationEngine(GAME_DATA);
    simulationRef.current = simulation;

    simulation.on("state", (nextSnapshot) => {
      const previous = snapshotRef.current;
      snapshotRef.current = nextSnapshot;
      setPreviousSnapshot(previous);
      setSnapshot(nextSnapshot);
      setSelectedMode(nextSnapshot.difficulty);
    });

    simulation.on("banner", (message) => {
      setBanner(message);
      if (bannerTimerRef.current) {
        window.clearTimeout(bannerTimerRef.current);
      }

      bannerTimerRef.current = window.setTimeout(() => {
        setBanner("");
      }, 2600);
    });

    simulation.on("gameover", (payload) => {
      emitToast(payload.result === "win" ? "Victory achieved." : `Simulation ended: ${payload.reason}`);
    });

    simulation.startNewGame(selectedMode);

    return () => {
      if (toastTimerRef.current) {
        window.clearTimeout(toastTimerRef.current);
      }

      if (bannerTimerRef.current) {
        window.clearTimeout(bannerTimerRef.current);
      }

      simulation.stopLoop();
      simulationRef.current = null;
      snapshotRef.current = null;
    };
  }, []);

  const hasSnapshot = Boolean(snapshot);

  useEffect(() => {
    if (!hasSnapshot || renderEngineRef.current) {
      return undefined;
    }

    const cityCanvas = cityCanvasRef.current;
    const chartCanvas = chartCanvasRef.current;
    if (!cityCanvas || !chartCanvas) {
      return undefined;
    }

    const renderEngine = new RenderEngine(cityCanvas, chartCanvas, GAME_DATA);
    renderEngineRef.current = renderEngine;
    renderEngine.resize();

    const onResize = () => {
      renderEngine.resize();
    };

    const frameLoop = (timeMs) => {
      const latestSnapshot = snapshotRef.current;
      if (latestSnapshot) {
        renderEngine.renderFrame(latestSnapshot, timeMs);
      }
      rafRef.current = window.requestAnimationFrame(frameLoop);
    };

    window.addEventListener("resize", onResize);
    rafRef.current = window.requestAnimationFrame(frameLoop);

    return () => {
      window.removeEventListener("resize", onResize);

      if (rafRef.current) {
        window.cancelAnimationFrame(rafRef.current);
      }

      renderEngineRef.current = null;
    };
  }, [hasSnapshot]);

  useEffect(() => {
    if (!renderEngineRef.current) {
      return;
    }

    renderEngineRef.current.setChartDisplayOptions({
      focusIndicator: selectedIndicatorKey,
      visibility: chartVisibility
    });
  }, [selectedIndicatorKey, chartVisibility]);

  const handleSelectIndicator = (indicatorKey) => {
    setSelectedIndicatorKey(indicatorKey);
    setChartVisibility((prev) => {
      if (prev[indicatorKey] !== false) {
        return prev;
      }
      return {
        ...prev,
        [indicatorKey]: true
      };
    });
  };

  const handleToggleChartLine = (indicatorKey) => {
    setChartVisibility((prev) => {
      const currentlyVisible = prev[indicatorKey] !== false;
      if (currentlyVisible) {
        const visibleCount = Object.values(prev).filter(Boolean).length;
        if (visibleCount <= 1) {
          return prev;
        }
      }

      return {
        ...prev,
        [indicatorKey]: !currentlyVisible
      };
    });
  };

  const handleTopAction = (action) => {
    const simulation = simulationRef.current;
    if (!simulation) {
      return;
    }

    if (action === "new") {
      simulation.startNewGame(selectedMode);
      setActivePolicy(null);
      emitToast(`New ${selectedMode} game started.`);
      return;
    }

    if (action === "save") {
      const result = simulation.saveGame();
      emitToast(result.message);
      return;
    }

    const result = simulation.loadGame();
    emitToast(result.message);
  };

  const handleEnactPolicy = (policy) => {
    const simulation = simulationRef.current;
    if (!simulation) {
      return;
    }

    const result = simulation.applyPolicy(policy.id);
    emitToast(result.message);
  };

  const handleChooseMajorDecision = (optionId) => {
    const simulation = simulationRef.current;
    if (!simulation) {
      return;
    }

    const result = simulation.chooseMajorDecisionOption(optionId);
    emitToast(result.message);
  };

  const handleSkipCycle = () => {
    const simulation = simulationRef.current;
    if (!simulation) {
      return;
    }

    const result = simulation.skipPolicy();
    emitToast(result.message);
  };

  const handleOpenPolicy = (policy, triggerNode) => {
    detailsTriggerRef.current = triggerNode;
    setActivePolicy(policy);
  };

  const handleClosePolicy = () => {
    setActivePolicy(null);
  };

  const difficultyOptions = useMemo(
    () =>
      Object.entries(GAME_DATA.difficulty).map(([key, config]) => ({
        value: key,
        label: config.label
      })),
    []
  );

  const indicators = useMemo(() => {
    if (!snapshot) {
      return [];
    }

    return GAME_DATA.indicators.map((indicator) => ({
      key: indicator.key,
      label: indicator.label,
      color: indicator.color,
      value: Number(snapshot.indicators[indicator.key] || 0),
      state: snapshot.indicatorStatuses[indicator.key] || "moderate"
    }));
  }, [snapshot]);

  const projections = useMemo(() => {
    if (!snapshot) {
      return [];
    }

    return ["air", "water", "carbon", "health"].map((key) => {
      const projection = snapshot.projections?.[key];
      return {
        key,
        label: toTitleCase(key),
        values: projection?.nextValues || [snapshot.indicators[key] || 0, snapshot.indicators[key] || 0],
        warning: Boolean(projection?.warning)
      };
    });
  }, [snapshot]);

  const stakeholders = useMemo(() => {
    if (!snapshot) {
      return [];
    }

    return GAME_DATA.stakeholders.map((stakeholder) => {
      const currentValue = Number(snapshot.stakeholders[stakeholder.key] || 0);
      const previousValue = Number(previousSnapshot?.stakeholders?.[stakeholder.key] ?? currentValue);
      return {
        id: stakeholder.key,
        label: stakeholder.label,
        value: currentValue,
        delta: currentValue - previousValue
      };
    });
  }, [snapshot, previousSnapshot]);

  const upgrades = useMemo(() => {
    if (!snapshot) {
      return [];
    }

    return Object.keys(snapshot.upgrades).map((track) => {
      const currentLevel = Number(snapshot.upgrades[track] || 0);
      const previousLevel = Number(previousSnapshot?.upgrades?.[track] ?? currentLevel);
      const maxLevel = Math.max(...(GAME_DATA.upgrades[track] || []).map((entry) => entry.level), 0);
      return {
        id: track,
        label: UPGRADE_LABELS[track] || toTitleCase(track),
        level: currentLevel,
        maxLevel,
        progress: maxLevel > 0 ? (currentLevel / maxLevel) * 100 : 0,
        delta: currentLevel - previousLevel
      };
    });
  }, [snapshot, previousSnapshot]);

  const eventLog = useMemo(() => {
    if (!snapshot) {
      return [];
    }

    return snapshot.logs.slice(0, 10).map((entry, index) => ({
      id: `${entry.timestamp}-${index}`,
      year: entry.year,
      cycle: entry.cycle,
      message: entry.message
    }));
  }, [snapshot]);

  const leaderboard = useMemo(() => {
    if (!snapshot) {
      return [];
    }

    return snapshot.leaderboard.slice(0, 10).map((entry, index) => ({
      id: `${entry.date}-${index}`,
      result: entry.result,
      difficulty: entry.difficulty,
      year: entry.year,
      score: Number(entry.score || 0)
    }));
  }, [snapshot]);

  const policyCards = useMemo(() => {
    if (!snapshot?.currentPolicies?.length) {
      return [];
    }

    return snapshot.currentPolicies.map((policy) =>
      derivePolicyViewModel(policy, Number(snapshot.policyCooldowns?.[policy.id] || 0))
    );
  }, [snapshot]);

  const statCapsules = useMemo(() => {
    if (!snapshot) {
      return [];
    }

    return [
      { label: "Budget", value: formatMoney(snapshot.budget) },
      { label: "Year", value: String(snapshot.year) },
      { label: "Population", value: formatPopulation(snapshot.populationAbsolute) },
      { label: "Debt", value: formatMoney(snapshot.debt) },
      { label: "Interest/Cycle", value: formatMoney(snapshot.lastInterestCharge) }
    ];
  }, [snapshot]);

  const topBannerText = banner || eventLog[0]?.message || "Simulation running.";

  if (!snapshot) {
    return (
      <div className="grid min-h-screen place-items-center bg-gradient-to-br from-emerald-950 via-teal-950 to-slate-950 text-white">
        <p className="rounded-xl border border-white/20 bg-white/10 px-4 py-2 backdrop-blur-xl">Initializing simulation...</p>
      </div>
    );
  }

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
              <h1 className="text-lg font-bold leading-tight text-white">Eco Defender</h1>
              <p className="text-xs uppercase tracking-[0.12em] text-white/70">Environmental Governance Simulator</p>
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
                value={selectedMode}
                onChange={(event) => setSelectedMode(event.target.value)}
                className="rounded-lg border border-white/25 bg-white/10 px-3 py-2 text-sm text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/45"
              >
                {difficultyOptions.map((mode) => (
                  <option key={mode.value} value={mode.value} className="bg-slate-900 text-white">
                    {mode.label}
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

        <main className="grid min-h-0 items-start gap-3 xl:grid-cols-[minmax(0,2fr)_minmax(360px,1fr)]">
          <GlassPanel className="self-start p-0">
            <div className="relative aspect-[16/9] min-h-[320px] overflow-hidden rounded-2xl sm:min-h-[380px] lg:min-h-[430px]">
              <canvas ref={cityCanvasRef} width={960} height={540} className="h-full w-full" aria-label="City simulation scene" />

              <div className="absolute left-4 top-4 rounded-full border border-white/20 bg-white/10 px-3 py-1 text-xs text-white/85 backdrop-blur-xl">
                Cycle {snapshot.cycleInYear}/{snapshot.timing.cyclesPerYear} | Stability {snapshot.stabilityCycles}/
                {snapshot.targetStabilityCycles}
              </div>

              <div className="absolute left-4 right-4 top-16">
                <IndicatorChips indicators={indicators} activeKey={selectedIndicatorKey} onSelect={handleSelectIndicator} />
              </div>

              <div className="absolute bottom-4 left-4 right-4 rounded-lg border border-white/20 bg-white/10 px-3 py-2 text-xs text-white/85 backdrop-blur-xl sm:max-w-[75%]">
                {topBannerText}
              </div>
            </div>
          </GlassPanel>

          <RightPanel
            indicators={indicators}
            selectedIndicatorKey={selectedIndicatorKey}
            onSelectIndicator={handleSelectIndicator}
            chartCanvasRef={chartCanvasRef}
            chartVisibility={chartVisibility}
            onToggleChartLine={handleToggleChartLine}
            projections={projections}
            stakeholders={stakeholders}
            upgrades={upgrades}
            eventLog={eventLog}
            leaderboard={leaderboard}
          />
        </main>

        <GlassPanel
          title={snapshot.majorDecision ? "Major Global Decision" : "Policy Choices"}
          subtitle={snapshot.majorDecision ? snapshot.majorDecision.title : "Pick one policy per cycle"}
          action={
            !snapshot.majorDecision ? (
              <button
                type="button"
                onClick={handleSkipCycle}
                className="rounded-lg border border-white/25 bg-white/10 px-3 py-2 text-xs font-medium text-white transition duration-200 ease-out hover:-translate-y-0.5 hover:bg-white/20 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/45 motion-reduce:transition-none motion-reduce:transform-none"
              >
                Skip Cycle
              </button>
            ) : null
          }
        >
          {snapshot.majorDecision ? (
            <div className="grid gap-3 sm:grid-cols-2">
              {snapshot.majorDecision.options.map((option) => (
                <article
                  key={option.id}
                  className="relative overflow-hidden rounded-xl border border-white/20 bg-white/12 p-4 backdrop-blur-xl shadow-glass"
                >
                  <div className="pointer-events-none absolute inset-0 bg-gradient-to-br from-white/20 via-white/5 to-transparent" aria-hidden />
                  <div className="relative space-y-3">
                    <h3 className="text-sm font-semibold text-white">{option.title}</h3>
                    <p className="text-xs text-white/80">{option.description}</p>
                    <button
                      type="button"
                      onClick={() => handleChooseMajorDecision(option.id)}
                      className="rounded-lg border border-white/25 bg-gradient-to-br from-emerald-400/85 to-emerald-700/85 px-3 py-2 text-xs font-semibold text-white transition duration-200 ease-out hover:-translate-y-0.5 hover:shadow-xl hover:shadow-emerald-950/35 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/45"
                    >
                      Choose Option
                    </button>
                  </div>
                </article>
              ))}
            </div>
          ) : (
            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
              {policyCards.map((policy) => (
                <PolicyCard
                  key={policy.id}
                  policy={policy}
                  budgetM={snapshot.budget}
                  cycleLocked={Boolean(snapshot.policyResolvedCycle)}
                  enacted={false}
                  onEnact={handleEnactPolicy}
                  onOpenDetails={handleOpenPolicy}
                />
              ))}
            </div>
          )}
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
