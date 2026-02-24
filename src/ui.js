
const clamp = (value, min, max) => Math.max(min, Math.min(max, value));

const TRACK_LABELS = {
  wasteTreatment: "Waste Treatment",
  renewableEnergy: "Renewable Energy",
  airFiltration: "Air Filtration"
};

const STAKEHOLDER_LABELS = {
  citizens: "Citizens",
  industry: "Industry",
  ngo: "NGO"
};

const IMPACT_LABELS = {
  economy: "Economy",
  air: "Air",
  water: "Water",
  soil: "Soil",
  carbon: "Carbon"
};

const LOW_GRAPHICS_STORAGE_KEY = "ecoDefender.lowGraphics";

const focusableSelector = [
  "button:not([disabled])",
  "[href]",
  "input:not([disabled])",
  "select:not([disabled])",
  "textarea:not([disabled])",
  "[tabindex]:not([tabindex='-1'])"
].join(", ");

export class UIManager {
  constructor(simulation, renderEngine, gameData) {
    this.simulation = simulation;
    this.renderEngine = renderEngine;
    this.data = gameData;

    this.state = null;
    this.previousSnapshot = null;
    this.panelIndex = 0;
    this.analyticsView = "trends";
    this.selectedIndicatorKey = null;
    this.chartVisibility = Object.fromEntries(this.data.indicators.map((indicator) => [indicator.key, true]));
    this.bannerTimer = null;
    this.toastTimer = null;
    this.pointerStartX = null;
    this.lastFocusBeforePolicyModal = null;

    this.reduceMotionQuery = window.matchMedia("(prefers-reduced-motion: reduce)");

    this.elements = this.cacheElements();
  }

  cacheElements() {
    return {
      startModal: document.getElementById("start-modal"),
      appShell: document.getElementById("app-shell"),
      startNewBtn: document.getElementById("start-new-btn"),
      startResumeBtn: document.getElementById("start-resume-btn"),
      startDifficulty: document.getElementById("start-difficulty"),
      difficultySelect: document.getElementById("difficulty-select"),
      lowGraphicsToggle: document.getElementById("low-graphics-toggle"),
      newGameBtn: document.getElementById("new-game-btn"),
      saveBtn: document.getElementById("save-btn"),
      loadBtn: document.getElementById("load-btn"),
      budgetValue: document.getElementById("budget-value"),
      yearValue: document.getElementById("year-value"),
      populationValue: document.getElementById("population-value"),
      debtValue: document.getElementById("debt-value"),
      interestValue: document.getElementById("interest-value"),
      roundInfo: document.getElementById("round-info"),
      policyTitle: document.getElementById("policy-title"),
      policyTitleMobile: document.getElementById("policy-title-mobile"),
      statusBadges: document.getElementById("status-badges"),
      eventBanner: document.getElementById("event-banner"),
      policyCards: document.getElementById("policy-cards"),
      policyCardsMobile: document.getElementById("policy-cards-mobile"),
      skipPolicyBtn: document.getElementById("skip-policy"),
      skipPolicyMobileBtn: document.getElementById("skip-policy-mobile"),
      chartLegend: document.getElementById("chart-legend"),
      projectionList: document.getElementById("projection-list"),
      stakeholderList: document.getElementById("stakeholder-list"),
      upgradeList: document.getElementById("upgrade-list"),
      eventLog: document.getElementById("event-log"),
      leaderboardList: document.getElementById("leaderboard-list"),
      gameoverModal: document.getElementById("gameover-modal"),
      gameoverTitle: document.getElementById("gameover-title"),
      gameoverReason: document.getElementById("gameover-reason"),
      scoreBreakdownList: document.getElementById("score-breakdown-list"),
      gameoverCloseBtn: document.getElementById("gameover-close-btn"),
      policyModal: document.getElementById("policy-modal"),
      policyModalTitle: document.getElementById("policy-modal-title"),
      policyModalSummary: document.getElementById("policy-modal-summary"),
      policyModalMeta: document.getElementById("policy-modal-meta"),
      policyModalImpacts: document.getElementById("policy-modal-impacts"),
      policyModalStakeholders: document.getElementById("policy-modal-stakeholders"),
      policyModalCloseBtn: document.getElementById("policy-modal-close-btn"),
      policyModalCloseIcon: document.getElementById("policy-modal-close-icon"),
      mobileTabs: document.getElementById("mobile-tabs"),
      panelTrack: document.getElementById("panel-track"),
      analyticsTabs: document.getElementById("analytics-tabs"),
      analyticsSection: document.querySelector(".analytics-section"),
      toast: document.getElementById("toast")
    };
  }

  init() {
    this.applyLowGraphicsPreference();
    this.buildLegend();
    this.bindEvents();
    this.bindSimulationEvents();
    this.setMobilePanel(0);
    this.setAnalyticsView("trends");
    this.syncChartRendering();
    this.elements.policyCards.innerHTML = "<p class=\"disabled-note\">Start a game to begin.</p>";
    this.elements.policyCardsMobile.innerHTML = "<p class=\"disabled-note\">Start a game to begin.</p>";
  }

  bindEvents() {
    const {
      startNewBtn,
      startResumeBtn,
      startDifficulty,
      difficultySelect,
      lowGraphicsToggle,
      newGameBtn,
      saveBtn,
      loadBtn,
      skipPolicyBtn,
      skipPolicyMobileBtn,
      policyCards,
      policyCardsMobile,
      statusBadges,
      chartLegend,
      projectionList,
      mobileTabs,
      analyticsTabs,
      analyticsSection,
      gameoverCloseBtn,
      policyModal,
      policyModalCloseBtn,
      policyModalCloseIcon
    } = this.elements;

    startNewBtn.addEventListener("click", () => {
      const difficulty = startDifficulty.value;
      difficultySelect.value = difficulty;
      this.simulation.startNewGame(difficulty);
      this.hideGameoverModal();
      this.closePolicyModal();
      this.showGame();
      this.showToast(`New ${difficulty} game started.`);
    });

    startResumeBtn.addEventListener("click", () => {
      const result = this.simulation.loadGame();
      if (result.ok) {
        this.closePolicyModal();
        this.showGame();
      }
      this.showToast(result.message);
    });

    newGameBtn.addEventListener("click", () => {
      const difficulty = difficultySelect.value;
      this.simulation.startNewGame(difficulty);
      this.hideGameoverModal();
      this.closePolicyModal();
      this.showGame();
      this.showToast(`New ${difficulty} game started.`);
    });

    saveBtn.addEventListener("click", () => {
      const result = this.simulation.saveGame();
      this.showToast(result.message);
    });

    loadBtn.addEventListener("click", () => {
      const result = this.simulation.loadGame();
      if (result.ok) {
        this.closePolicyModal();
        this.showGame();
      }
      this.showToast(result.message);
    });

    skipPolicyBtn.addEventListener("click", () => {
      const result = this.simulation.skipPolicy();
      this.showToast(result.message);
    });

    skipPolicyMobileBtn.addEventListener("click", () => {
      const result = this.simulation.skipPolicy();
      this.showToast(result.message);
    });

    [policyCards, policyCardsMobile].forEach((container) => {
      container.addEventListener("click", (event) => {
        const policyButton = event.target.closest("button[data-policy-id]");
        if (policyButton) {
          const result = this.simulation.applyPolicy(policyButton.dataset.policyId);
          this.showToast(result.message);
          return;
        }

        const detailsButton = event.target.closest("button[data-policy-details-id]");
        if (detailsButton) {
          this.openPolicyDetails(detailsButton.dataset.policyDetailsId);
          return;
        }

        const decisionButton = event.target.closest("button[data-major-option-id]");
        if (decisionButton) {
          const result = this.simulation.chooseMajorDecisionOption(decisionButton.dataset.majorOptionId);
          this.showToast(result.message);
        }
      });
    });

    statusBadges.addEventListener("click", (event) => {
      const badge = event.target.closest("button[data-indicator-key]");
      if (!badge) {
        return;
      }
      this.setFocusedIndicator(badge.dataset.indicatorKey);
    });

    projectionList.addEventListener("click", (event) => {
      const projectionRow = event.target.closest("li[data-indicator-key]");
      if (!projectionRow) {
        return;
      }
      this.setFocusedIndicator(projectionRow.dataset.indicatorKey);
    });

    chartLegend.addEventListener("click", (event) => {
      const legendButton = event.target.closest("button[data-indicator-key]");
      if (!legendButton) {
        return;
      }

      const indicatorKey = legendButton.dataset.indicatorKey;
      if (event.altKey || event.shiftKey) {
        this.setFocusedIndicator(indicatorKey);
      } else {
        this.toggleChartIndicator(indicatorKey);
      }
    });

    mobileTabs.addEventListener("click", (event) => {
      const tab = event.target.closest("button[data-panel]");
      if (!tab) {
        return;
      }
      this.setMobilePanel(tab.dataset.panel === "policies" ? 1 : 0);
    });

    analyticsTabs?.addEventListener("click", (event) => {
      const tab = event.target.closest("button[data-analytics-view]");
      if (!tab) {
        return;
      }
      this.setAnalyticsView(tab.dataset.analyticsView);
    });

    analyticsSection.addEventListener("pointerdown", (event) => {
      if (!this.isMobileLayout()) {
        return;
      }
      this.pointerStartX = event.clientX;
    });

    analyticsSection.addEventListener("pointerup", (event) => {
      if (!this.isMobileLayout() || this.pointerStartX === null) {
        return;
      }

      const diff = event.clientX - this.pointerStartX;
      this.pointerStartX = null;
      if (Math.abs(diff) < 48) {
        return;
      }

      this.setMobilePanel(diff < 0 ? 1 : 0);
    });

    window.addEventListener("resize", () => {
      this.renderEngine.resize();
      if (!this.isMobileLayout()) {
        this.setMobilePanel(0);
      }
      this.setAnalyticsView(this.analyticsView);
    });

    gameoverCloseBtn.addEventListener("click", () => {
      this.hideGameoverModal();
    });

    policyModalCloseBtn.addEventListener("click", () => {
      this.closePolicyModal();
    });

    policyModalCloseIcon.addEventListener("click", () => {
      this.closePolicyModal();
    });

    policyModal.addEventListener("click", (event) => {
      if (event.target === policyModal) {
        this.closePolicyModal();
      }
    });

    lowGraphicsToggle?.addEventListener("change", () => {
      this.setLowGraphicsMode(lowGraphicsToggle.checked);
    });

    document.addEventListener("keydown", (event) => {
      if (event.key === "Escape") {
        if (!this.elements.policyModal.classList.contains("hidden")) {
          this.closePolicyModal();
          return;
        }

        if (!this.elements.gameoverModal.classList.contains("hidden")) {
          this.hideGameoverModal();
        }
      }

      if (event.key === "Tab") {
        const activeModal = this.getActiveModal();
        if (activeModal) {
          this.trapFocus(event, activeModal);
        }
      }
    });
  }

  bindSimulationEvents() {
    this.simulation.on("state", (snapshot) => {
      this.state = snapshot;
      this.render(snapshot);
    });

    this.simulation.on("banner", (message) => {
      this.showBanner(message);
    });

    this.simulation.on("gameover", (payload) => {
      const label = payload.result === "win" ? "Victory" : "Defeat";
      this.showBanner(`${label}: ${payload.reason}`);
      this.showGameoverModal(payload);
    });
  }

  render(snapshot) {
    const {
      budgetValue,
      yearValue,
      populationValue,
      debtValue,
      interestValue,
      roundInfo,
      difficultySelect,
      skipPolicyBtn,
      skipPolicyMobileBtn,
      policyTitle,
      policyTitleMobile
    } = this.elements;

    this.updateValueNode(budgetValue, this.formatMoney(snapshot.budget));
    this.updateValueNode(yearValue, String(snapshot.year));
    this.updateValueNode(populationValue, this.formatPopulation(snapshot.populationAbsolute));
    this.updateValueNode(debtValue, this.formatMoney(snapshot.debt));
    this.updateValueNode(interestValue, this.formatMoney(snapshot.lastInterestCharge));
    difficultySelect.value = snapshot.difficulty;

    roundInfo.textContent =
      `Cycle ${snapshot.cycleInYear}/${snapshot.timing.cyclesPerYear} | ` +
      `Stability ${snapshot.stabilityCycles}/${snapshot.targetStabilityCycles}`;

    const majorDecisionPending = Boolean(snapshot.majorDecision);
    policyTitle.textContent = majorDecisionPending ? "Major Global Decision" : "Policy Choices";
    policyTitleMobile.textContent = majorDecisionPending ? "Major Global Decision" : "Policy Choices";

    const disableActions = snapshot.gameStatus !== "running" || snapshot.policyResolvedCycle || majorDecisionPending;
    skipPolicyBtn.disabled = disableActions;
    skipPolicyMobileBtn.disabled = disableActions;

    this.renderStatusBadges(snapshot);
    this.renderProjections(snapshot);
    this.renderStakeholders(snapshot);
    this.renderUpgrades(snapshot);
    this.renderEventLog(snapshot);
    this.renderLeaderboard(snapshot);
    this.updatePolicyContainers(snapshot);

    this.previousSnapshot = {
      stakeholders: { ...snapshot.stakeholders },
      upgrades: { ...snapshot.upgrades }
    };
  }

  renderStatusBadges(snapshot) {
    const html = this.data.indicators
      .map((indicator) => {
        const value = snapshot.indicators[indicator.key];
        const state = snapshot.indicatorStatuses[indicator.key];
        const labelValue = indicator.key === "carbon" ? `${value.toFixed(1)} em` : `${value.toFixed(1)}`;
        const active = this.selectedIndicatorKey === indicator.key;
        return `
          <button type="button" class="status-badge ${state} ${active ? "active" : ""}" data-indicator-key="${indicator.key}" aria-pressed="${active}">
            <span class="status-dot" style="background:${indicator.color}"></span>
            <span>${indicator.label}</span>
            <span>${labelValue}</span>
            <span class="status-state">${state}</span>
          </button>
        `;
      })
      .join("");

    this.elements.statusBadges.innerHTML = html;
  }

  renderProjections(snapshot) {
    const targets = [
      { key: "air", label: "Air" },
      { key: "water", label: "Water" },
      { key: "carbon", label: "Carbon" },
      { key: "health", label: "Health" }
    ];

    const html = targets
      .map((target) => {
        const projection = snapshot.projections?.[target.key];
        const active = this.selectedIndicatorKey === target.key;
        if (!projection) {
          return `<li data-indicator-key="${target.key}" class="${active ? "active" : ""}"><span>${target.label}: n/a</span></li>`;
        }

        const values = projection.nextValues.map((value) => value.toFixed(1)).join(" -> ");
        const warning = projection.warning ? "<span class=\"projection-warning\" aria-label=\"critical risk\">Critical risk</span>" : "";
        return `<li data-indicator-key="${target.key}" class="${active ? "active" : ""}"><span>${target.label}: ${values}</span>${warning}</li>`;
      })
      .join("");

    this.elements.projectionList.innerHTML = html;
  }

  renderStakeholders(snapshot) {
    const rows = this.data.stakeholders
      .map((stakeholder) => {
        const value = snapshot.stakeholders[stakeholder.key];
        const cls = value < 30 ? "low" : value < 60 ? "mid" : "high";
        const previous = this.previousSnapshot?.stakeholders?.[stakeholder.key];
        const delta = typeof previous === "number" ? value - previous : 0;
        const deltaBadge = this.renderDeltaBadge(delta);

        return `
          <div class="stakeholder-row">
            <span class="row-label">${stakeholder.label}${deltaBadge}</span>
            <div class="progress-track" aria-hidden="true">
              <div class="progress-fill ${cls}" style="width:${value.toFixed(1)}%"></div>
            </div>
            <strong>${Math.round(value)}</strong>
          </div>
        `;
      })
      .join("");

    this.elements.stakeholderList.innerHTML = rows;
  }

  renderUpgrades(snapshot) {
    const tracks = Object.entries(snapshot.upgrades)
      .map(([track, level]) => {
        const width = clamp(level / 3, 0, 1) * 100;
        const cls = level < 1 ? "low" : level < 3 ? "mid" : "high";
        const previous = this.previousSnapshot?.upgrades?.[track];
        const delta = typeof previous === "number" ? level - previous : 0;
        const deltaBadge = this.renderDeltaBadge(delta, 0);

        return `
          <li class="upgrade-row">
            <span class="row-label">${TRACK_LABELS[track] || track}${deltaBadge}</span>
            <div class="progress-track" aria-hidden="true">
              <div class="progress-fill ${cls}" style="width:${width}%"></div>
            </div>
            <strong>L${level}</strong>
          </li>
        `;
      })
      .join("");

    this.elements.upgradeList.innerHTML = tracks;
  }

  renderEventLog(snapshot) {
    const logs = snapshot.logs
      .slice(0, 8)
      .map((entry) => `<li>Y${entry.year} C${entry.cycle}: ${entry.message}</li>`)
      .join("");

    this.elements.eventLog.innerHTML = logs || "<li>No events yet.</li>";
  }

  renderLeaderboard(snapshot) {
    const entries = snapshot.leaderboard
      .slice(0, 8)
      .map((entry) => {
        const date = new Date(entry.date).toLocaleDateString();
        return `<li>${entry.result.toUpperCase()} | ${entry.difficulty} | Year ${entry.year} | Score ${Number(entry.score).toFixed(2)} | ${date}</li>`;
      })
      .join("");

    this.elements.leaderboardList.innerHTML = entries || "<li>No completed games yet.</li>";
  }

  updatePolicyContainers(snapshot) {
    if (!snapshot) {
      return;
    }

    const disabled = snapshot.gameStatus !== "running" || snapshot.policyResolvedCycle;

    if (snapshot.majorDecision) {
      this.renderDecisionCards(this.elements.policyCards, snapshot.majorDecision, disabled);
      this.renderDecisionCards(this.elements.policyCardsMobile, snapshot.majorDecision, disabled);
      return;
    }

    this.renderPolicyCards(
      this.elements.policyCards,
      snapshot.currentPolicies,
      disabled,
      snapshot.policyResolvedCycle,
      snapshot.budget,
      snapshot.policyCooldowns
    );

    this.renderPolicyCards(
      this.elements.policyCardsMobile,
      snapshot.currentPolicies,
      disabled,
      snapshot.policyResolvedCycle,
      snapshot.budget,
      snapshot.policyCooldowns
    );
  }

  renderPolicyCards(container, policies, disabled, policyResolvedCycle, budget, cooldowns = {}) {
    if (!policies.length) {
      container.innerHTML = "<p class=\"disabled-note\">No policies available this cycle.</p>";
      return;
    }

    const html = policies
      .map((policy) => {
        const canAfford = budget >= policy.cost;
        const cooldown = cooldowns[policy.id] || 0;
        const buttonDisabled = disabled || !canAfford || cooldown > 0;

        const impacts = Object.entries(policy.impacts)
          .map(([key, value]) => {
            const label = IMPACT_LABELS[key] || key;
            const isPositive = key === "carbon" ? value < 0 : value >= 0;
            const cls = isPositive ? "impact-pos" : "impact-neg";
            const sign = value >= 0 ? "+" : "";
            return `<span class="impact-pill ${cls}">${label}: ${sign}${value}</span>`;
          })
          .join("");

        const stakeholders = Object.entries(policy.stakeholders || {})
          .map(([key, value]) => {
            const name = STAKEHOLDER_LABELS[key] || key;
            const sign = value >= 0 ? "+" : "";
            return `${name} ${sign}${value}`;
          })
          .join(" | ");

        const immediatePct = Math.round((policy.effectTiming?.immediatePercent ?? 0.3) * 100);
        const rampCycles = policy.effectTiming?.rampCycles ?? 3;
        const cooldownLabel = policy.cooldownCycles ?? 3;

        return `
          <article class="policy-card">
            <h3>${policy.title}</h3>
            <p class="policy-summary">${policy.description}</p>
            <div class="cost-line">Cost: $${policy.cost}M</div>
            <div class="policy-meta-row">
              <span class="policy-meta">Ramp ${immediatePct}% in ${rampCycles} cycles</span>
              <span class="policy-meta">Cooldown ${cooldownLabel} cycles</span>
            </div>
            <div class="impact-grid">${impacts}</div>
            <p class="policy-stakeholders">Stakeholders: ${stakeholders}</p>
            <div class="actions">
              <button type="button" class="primary-btn" data-policy-id="${policy.id}" ${buttonDisabled ? "disabled" : ""}>
                ${policyResolvedCycle ? "Policy Locked" : cooldown > 0 ? `Cooldown (${cooldown})` : canAfford ? "Enact Policy" : "Insufficient Budget"}
              </button>
              <button type="button" class="secondary-btn" data-policy-details-id="${policy.id}">
                Details
              </button>
            </div>
          </article>
        `;
      })
      .join("");

    container.innerHTML = html;
  }

  renderDecisionCards(container, majorDecision, disabled) {
    const html = majorDecision.options
      .map((option) => {
        const modifierText = (option.globalModifiers || []).map((item) => item.label || item.type).join(" | ");
        const stakeholders = Object.entries(option.stakeholders || {})
          .map(([key, value]) => {
            const name = STAKEHOLDER_LABELS[key] || key;
            const sign = value >= 0 ? "+" : "";
            return `${name} ${sign}${value}`;
          })
          .join(" | ");

        return `
          <article class="policy-card decision-card">
            <h3>${option.title}</h3>
            <p class="policy-summary">${option.description}</p>
            <span class="policy-meta">${majorDecision.title}</span>
            <p class="policy-stakeholders">Stakeholders: ${stakeholders || "No direct shift"}</p>
            <p>${modifierText || "No timed global modifiers"}</p>
            <div class="actions">
              <button type="button" class="primary-btn" data-major-option-id="${option.id}" ${disabled ? "disabled" : ""}>Choose Option</button>
              <button type="button" class="secondary-btn" disabled>Details</button>
            </div>
          </article>
        `;
      })
      .join("");

    container.innerHTML = html;
  }

  buildLegend() {
    const legend = this.data.indicators
      .map((indicator) => {
        const visible = this.chartVisibility[indicator.key] !== false;
        const active = this.selectedIndicatorKey === indicator.key;
        return `
          <button type="button" class="legend-item ${visible ? "" : "is-off"} ${active ? "active" : ""}" data-indicator-key="${indicator.key}" aria-pressed="${visible}">
            <span class="legend-color" style="background:${indicator.color}"></span>
            <span>${indicator.label}</span>
          </button>
        `;
      })
      .join("");

    this.elements.chartLegend.innerHTML = legend;
  }

  setMobilePanel(index) {
    this.panelIndex = clamp(index, 0, 1);

    const tabs = [...this.elements.mobileTabs.querySelectorAll("button[data-panel]")];
    tabs.forEach((tab) => {
      const panel = tab.dataset.panel;
      const active = (this.panelIndex === 0 && panel === "charts") || (this.panelIndex === 1 && panel === "policies");
      tab.classList.toggle("active", active);
      tab.setAttribute("aria-selected", String(active));
    });

    if (this.isMobileLayout()) {
      this.elements.panelTrack.style.transform = `translateX(-${this.panelIndex * 50}%)`;
    } else {
      this.elements.panelTrack.style.transform = "translateX(0)";
    }
  }

  setAnalyticsView(viewKey) {
    this.analyticsView = viewKey || "trends";

    const tabs = [...(this.elements.analyticsTabs?.querySelectorAll("button[data-analytics-view]") || [])];
    tabs.forEach((tab) => {
      const active = tab.dataset.analyticsView === this.analyticsView;
      tab.classList.toggle("active", active);
      tab.setAttribute("aria-selected", String(active));
    });

    const views = [...document.querySelectorAll(".analytics-view[data-analytics-view]")];
    views.forEach((view) => {
      const active = view.dataset.analyticsView === this.analyticsView;
      view.classList.toggle("active", active);
    });
  }

  setFocusedIndicator(indicatorKey) {
    if (!indicatorKey) {
      return;
    }

    this.selectedIndicatorKey = this.selectedIndicatorKey === indicatorKey ? null : indicatorKey;
    if (this.selectedIndicatorKey && this.chartVisibility[this.selectedIndicatorKey] === false) {
      this.chartVisibility[this.selectedIndicatorKey] = true;
    }

    this.syncChartRendering();
    if (this.state) {
      this.renderStatusBadges(this.state);
      this.renderProjections(this.state);
    }
    this.buildLegend();
  }

  toggleChartIndicator(indicatorKey) {
    if (!(indicatorKey in this.chartVisibility)) {
      return;
    }

    const currentlyVisible = this.chartVisibility[indicatorKey] !== false;
    if (currentlyVisible) {
      const visibleCount = Object.values(this.chartVisibility).filter(Boolean).length;
      if (visibleCount <= 1) {
        return;
      }
    }

    this.chartVisibility[indicatorKey] = !currentlyVisible;
    if (!this.chartVisibility[indicatorKey] && this.selectedIndicatorKey === indicatorKey) {
      this.selectedIndicatorKey = null;
    }

    this.syncChartRendering();
    this.buildLegend();
  }

  syncChartRendering() {
    this.renderEngine.setChartDisplayOptions({
      focusIndicator: this.selectedIndicatorKey,
      visibility: { ...this.chartVisibility }
    });
  }

  isMobileLayout() {
    return window.matchMedia("(max-width: 900px)").matches;
  }

  showStartModal() {
    this.elements.startModal.classList.remove("hidden");
    this.elements.appShell.setAttribute("aria-hidden", "true");
    this.elements.startNewBtn.focus();
  }

  showGame() {
    this.elements.startModal.classList.add("hidden");
    this.elements.appShell.setAttribute("aria-hidden", "false");
  }

  showGameoverModal(payload) {
    const { gameoverModal, gameoverTitle, gameoverReason, scoreBreakdownList } = this.elements;
    const label = payload.result === "win" ? "Victory" : "Defeat";

    gameoverTitle.textContent = `${label} - Eco Defender`;
    gameoverReason.textContent = payload.reason;

    const breakdown = payload.scoreBreakdown;
    if (breakdown) {
      const component = breakdown.components;
      scoreBreakdownList.innerHTML = `
        <li>Final Score: <strong>${breakdown.finalScore.toFixed(2)}</strong></li>
        <li>Environmental Avg: ${component.environmentalAverage.toFixed(2)} x ${breakdown.weights.environmentalAverage}</li>
        <li>Economic Stability: ${component.economicStability.toFixed(2)} x ${breakdown.weights.economicStability}</li>
        <li>Public Health: ${component.publicHealth.toFixed(2)} x ${breakdown.weights.publicHealth}</li>
        <li>Carbon Efficiency: ${component.carbonEfficiency.toFixed(2)} x ${breakdown.weights.carbonEfficiency}</li>
        <li>Stakeholder Balance: ${component.stakeholderBalance.toFixed(2)} x ${breakdown.weights.stakeholderBalance}</li>
      `;
    } else {
      scoreBreakdownList.innerHTML = "<li>No score breakdown available.</li>";
    }

    gameoverModal.classList.remove("hidden");
    this.elements.gameoverCloseBtn.focus();
  }

  hideGameoverModal() {
    this.elements.gameoverModal.classList.add("hidden");
  }

  openPolicyDetails(policyId) {
    const policy =
      this.state?.currentPolicies?.find((entry) => entry.id === policyId) ||
      this.data.policies.find((entry) => entry.id === policyId);
    if (!policy) {
      return;
    }

    this.lastFocusBeforePolicyModal = document.activeElement;

    const impacts = Object.entries(policy.impacts || {})
      .map(([key, value]) => {
        const label = IMPACT_LABELS[key] || key;
        const isPositive = key === "carbon" ? value < 0 : value >= 0;
        const cls = isPositive ? "impact-pos" : "impact-neg";
        const sign = value >= 0 ? "+" : "";
        return `<span class="impact-pill ${cls}">${label}: ${sign}${value}</span>`;
      })
      .join("");

    const stakeholders = Object.entries(policy.stakeholders || {})
      .map(([key, value]) => {
        const sign = value >= 0 ? "+" : "";
        return `${STAKEHOLDER_LABELS[key] || key}: ${sign}${value}`;
      })
      .join(" | ");

    const immediatePct = Math.round((policy.effectTiming?.immediatePercent ?? 0.3) * 100);
    const rampCycles = policy.effectTiming?.rampCycles ?? 3;
    const cooldownLabel = policy.cooldownCycles ?? 3;

    this.elements.policyModalTitle.textContent = policy.title;
    this.elements.policyModalSummary.textContent = policy.description;
    this.elements.policyModalMeta.innerHTML = [
      `<span class="policy-meta">Cost $${policy.cost}M</span>`,
      `<span class="policy-meta">Ramp ${immediatePct}% in ${rampCycles} cycles</span>`,
      `<span class="policy-meta">Cooldown ${cooldownLabel} cycles</span>`
    ].join("");
    this.elements.policyModalImpacts.innerHTML = impacts || "<span class=\"disabled-note\">No impacts listed.</span>";
    this.elements.policyModalStakeholders.textContent = stakeholders || "No stakeholder effects listed.";

    this.elements.policyModal.classList.remove("hidden");
    this.elements.policyModalCloseBtn.focus();
  }

  closePolicyModal() {
    if (this.elements.policyModal.classList.contains("hidden")) {
      return;
    }

    this.elements.policyModal.classList.add("hidden");
    if (this.lastFocusBeforePolicyModal && this.lastFocusBeforePolicyModal.focus) {
      this.lastFocusBeforePolicyModal.focus();
    }
  }

  getActiveModal() {
    const { startModal, gameoverModal, policyModal } = this.elements;

    if (!policyModal.classList.contains("hidden")) {
      return policyModal;
    }
    if (!gameoverModal.classList.contains("hidden")) {
      return gameoverModal;
    }
    if (!startModal.classList.contains("hidden")) {
      return startModal;
    }
    return null;
  }

  trapFocus(event, modalElement) {
    const focusable = [...modalElement.querySelectorAll(focusableSelector)].filter(
      (node) => !node.hasAttribute("disabled") && node.offsetParent !== null
    );
    if (!focusable.length) {
      return;
    }

    const first = focusable[0];
    const last = focusable[focusable.length - 1];
    if (event.shiftKey && document.activeElement === first) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault();
      first.focus();
    }
  }

  showBanner(message) {
    const { eventBanner } = this.elements;
    eventBanner.textContent = message;
    eventBanner.classList.add("visible");

    if (this.bannerTimer) {
      clearTimeout(this.bannerTimer);
    }

    this.bannerTimer = setTimeout(() => {
      eventBanner.classList.remove("visible");
    }, 2600);
  }

  showToast(message) {
    if (!message) {
      return;
    }

    const { toast } = this.elements;
    toast.textContent = message;
    toast.classList.add("visible");

    if (this.toastTimer) {
      clearTimeout(this.toastTimer);
    }

    this.toastTimer = setTimeout(() => {
      toast.classList.remove("visible");
    }, 2200);
  }

  setLowGraphicsMode(enabled) {
    document.body.classList.toggle("low-graphics", enabled);
    if (this.elements.lowGraphicsToggle) {
      this.elements.lowGraphicsToggle.checked = enabled;
    }

    try {
      localStorage.setItem(LOW_GRAPHICS_STORAGE_KEY, enabled ? "1" : "0");
    } catch {
      // Ignore storage errors.
    }

    this.renderEngine.resize();
  }

  applyLowGraphicsPreference() {
    let enabled = false;
    try {
      enabled = localStorage.getItem(LOW_GRAPHICS_STORAGE_KEY) === "1";
    } catch {
      enabled = false;
    }
    this.setLowGraphicsMode(enabled);
  }

  updateValueNode(element, valueText) {
    if (element.textContent === valueText) {
      return;
    }

    element.textContent = valueText;
    if (this.reduceMotionQuery.matches) {
      return;
    }

    element.classList.remove("value-update");
    // Trigger reflow so repeated updates can replay the animation.
    void element.offsetWidth;
    element.classList.add("value-update");
  }

  renderDeltaBadge(delta, decimals = 1) {
    if (!delta) {
      return "";
    }

    const cls = delta > 0 ? "pos" : "neg";
    const rounded = delta.toFixed(decimals);
    const label = Number(rounded) > 0 ? `+${rounded}` : rounded;
    return `<span class="progress-delta ${cls}">${label}</span>`;
  }

  formatMoney(value) {
    const rounded = Math.round(value);
    const sign = rounded < 0 ? "-" : "";
    return `${sign}$${Math.abs(rounded)}M`;
  }

  formatPopulation(value) {
    return new Intl.NumberFormat().format(value);
  }
}
