import { useEffect, useMemo, useRef } from "react";

const TONE = {
  positive: "text-emerald-200",
  negative: "text-rose-200",
  warning: "text-amber-200",
  neutral: "text-sky-200"
};

const getFocusableElements = (container) => {
  if (!container) {
    return [];
  }

  return [...container.querySelectorAll('button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])')];
};

export default function PolicyModal({ policy, isOpen, onClose, restoreFocusRef }) {
  const panelRef = useRef(null);

  const impacts = useMemo(() => policy?.impacts || [], [policy]);

  useEffect(() => {
    if (!isOpen) {
      return undefined;
    }

    const panel = panelRef.current;
    const focusables = getFocusableElements(panel);
    (focusables[0] || panel)?.focus();

    const handleKeyDown = (event) => {
      if (event.key === "Escape") {
        event.preventDefault();
        onClose();
        return;
      }

      if (event.key !== "Tab") {
        return;
      }

      const currentFocusables = getFocusableElements(panel);
      if (!currentFocusables.length) {
        event.preventDefault();
        return;
      }

      const first = currentFocusables[0];
      const last = currentFocusables[currentFocusables.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };

    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [isOpen, onClose]);

  useEffect(() => {
    if (!isOpen && restoreFocusRef?.current) {
      restoreFocusRef.current.focus();
    }
  }, [isOpen, restoreFocusRef]);

  if (!isOpen || !policy) {
    return null;
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/45 p-3 backdrop-blur-sm sm:items-center"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) {
          onClose();
        }
      }}
      role="dialog"
      aria-modal="true"
      aria-labelledby="policy-modal-title"
    >
      <div
        ref={panelRef}
        tabIndex={-1}
        className="relative max-h-[90vh] w-full max-w-2xl overflow-hidden rounded-2xl border border-white/20 bg-white/12 shadow-floating backdrop-blur-xxl"
      >
        <div aria-hidden className="pointer-events-none absolute inset-0 bg-gradient-to-br from-white/20 via-white/6 to-transparent" />

        <div className="relative flex max-h-[90vh] flex-col">
          <header className="flex items-start justify-between gap-4 border-b border-white/15 px-5 py-4">
            <div>
              <h2 id="policy-modal-title" className="text-base font-semibold text-white">
                {policy.title}
              </h2>
              <p className="mt-1 text-xs text-white/70">Policy details and 2-cycle projected deltas</p>
            </div>
            <button
              type="button"
              aria-label="Close policy details"
              onClick={onClose}
              className="rounded-full border border-white/25 bg-white/10 p-2 text-white/80 transition duration-200 hover:bg-white/20 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/45"
            >
              <svg viewBox="0 0 20 20" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M5 5l10 10M15 5L5 15" />
              </svg>
            </button>
          </header>

          <div className="space-y-4 overflow-y-auto px-5 py-4">
            <p className="text-sm leading-relaxed text-white/85">{policy.description}</p>

            <div className="flex flex-wrap gap-2 text-xs">
              <span className="rounded-full border border-white/20 bg-white/10 px-3 py-1 text-white/85">Cost ${policy.costM}M</span>
              <span className="rounded-full border border-white/20 bg-white/10 px-3 py-1 text-white/85">Ramp {policy.rampCycles} cycles</span>
              <span className="rounded-full border border-white/20 bg-white/10 px-3 py-1 text-white/85">Cooldown {policy.cooldownCycles} cycles</span>
            </div>

            <section>
              <h3 className="text-xs font-semibold uppercase tracking-[0.12em] text-white/70">Impact Deltas</h3>
              <div className="mt-2 flex flex-wrap gap-2">
                {impacts.map((impact) => {
                  const sign = impact.value > 0 ? "+" : "";
                  return (
                    <span
                      key={`${policy.id}-${impact.label}`}
                      className="rounded-full border border-white/20 bg-white/10 px-3 py-1 text-xs text-white/90"
                    >
                      {impact.label}: {sign}
                      {impact.value}
                    </span>
                  );
                })}
              </div>
            </section>

            <section>
              <h3 className="text-xs font-semibold uppercase tracking-[0.12em] text-white/70">2-Cycle Projection</h3>
              <ul className="mt-2 space-y-2">
                {policy.projectedDeltas.map((entry) => (
                  <li key={`${policy.id}-${entry.label}`} className="rounded-lg border border-white/15 bg-white/10 px-3 py-2 text-xs text-white/85">
                    <span className="font-medium text-white">{entry.label}:</span>{" "}
                    <span className={TONE[entry.tone] || TONE.neutral}>{entry.value}</span>
                  </li>
                ))}
              </ul>
            </section>
          </div>

          <footer className="border-t border-white/15 px-5 py-4">
            <button
              type="button"
              onClick={onClose}
              className="rounded-lg border border-white/25 bg-white/10 px-4 py-2 text-sm font-medium text-white transition duration-200 ease-out hover:-translate-y-0.5 hover:bg-white/20 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/45 motion-reduce:transition-none motion-reduce:transform-none"
            >
              Close
            </button>
          </footer>
        </div>
      </div>
    </div>
  );
}
