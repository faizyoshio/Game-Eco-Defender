
const clamp = (value, min, max) => Math.max(min, Math.min(max, value));

const TRACK_LABELS = {
  wasteTreatment: "Waste Treatment",
  renewableEnergy: "Renewable Energy",
  airFiltration: "Air Filtration"
};

const IMPACT_LABELS = {
  economy: "Economy",
  air: "Air",
  water: "Water",
  soil: "Soil",
  carbon: "Carbon"
};

export class UIManager {
  constructor(simulation, renderEngine, gameData) {
    this.simulation = simulation;
    this.renderEngine = renderEngine;
    this.data = gameData;

    this.state = null;
    this.panelIndex = 0;
    this.bannerTimer = null;
    this.toastTimer = null;
    this.pointerStartX = null;

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
      mobileTabs: document.getElementById("mobile-tabs"),
      panelTrack: document.getElementById("panel-track"),
      analyticsSection: document.querySelector(".analytics-section"),
      toast: document.getElementById("toast")
    };
  }

  init() {
    this.buildLegend();
    this.bindEvents();
    this.bindSimulationEvents();
    this.setMobilePanel(0);
    this.elements.policyCards.innerHTML = "<p class=\"disabled-note\">Start a game to begin.</p>";
    this.elements.policyCardsMobile.innerHTML = "<p class=\"disabled-note\">Start a game to begin.</p>";
  }

  bindEvents() {
    const {
      startNewBtn,
      startResumeBtn,
      startDifficulty,
      difficultySelect,
      newGameBtn,
      saveBtn,
      loadBtn,
      skipPolicyBtn,
      skipPolicyMobileBtn,
      policyCards,
      policyCardsMobile,
      mobileTabs,
      analyticsSection,
      gameoverCloseBtn
    } = this.elements;

    startNewBtn.addEventListener("click", () => {
      const difficulty = startDifficulty.value;
      difficultySelect.value = difficulty;
      this.simulation.startNewGame(difficulty);
      this.hideGameoverModal();
      this.showGame();
      this.showToast(`New ${difficulty} game started.`);
    });

    startResumeBtn.addEventListener("click", () => {
      const result = this.simulation.loadGame();
      if (result.ok) {
        this.showGame();
      }
      this.showToast(result.message);
    });

    newGameBtn.addEventListener("click", () => {
      const difficulty = difficultySelect.value;
      this.simulation.startNewGame(difficulty);
      this.hideGameoverModal();
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

        const decisionButton = event.target.closest("button[data-major-option-id]");
        if (decisionButton) {
          const result = this.simulation.chooseMajorDecisionOption(decisionButton.dataset.majorOptionId);
          this.showToast(result.message);
        }
      });
    });

    mobileTabs.addEventListener("click", (event) => {
      const tab = event.target.closest("button[data-panel]");
      if (!tab) {
        return;
      }
      this.setMobilePanel(tab.dataset.panel === "policies" ? 1 : 0);
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
    });

    gameoverCloseBtn.addEventListener("click", () => {
      this.hideGameoverModal();
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

    budgetValue.textContent = this.formatMoney(snapshot.budget);
    yearValue.textContent = String(snapshot.year);
    populationValue.textContent = this.formatPopulation(snapshot.populationAbsolute);
    debtValue.textContent = this.formatMoney(snapshot.debt);
    interestValue.textContent = this.formatMoney(snapshot.lastInterestCharge);
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
  }

  renderStatusBadges(snapshot) {
    const html = this.data.indicators
      .map((indicator) => {
        const value = snapshot.indicators[indicator.key];
        const state = snapshot.indicatorStatuses[indicator.key];
        const labelValue = indicator.key === "carbon" ? `${value.toFixed(1)} (emissions)` : `${value.toFixed(1)}`;
        return `<span class="status-badge ${state}">${indicator.label}: ${labelValue} - ${state}</span>`;
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
        if (!projection) {
          return `<li>${target.label}: n/a</li>`;
        }

        const values = projection.nextValues.map((value) => value.toFixed(1)).join(" -> ");
        const warning = projection.warning ? "<span class=\"projection-warning\"> critical risk</span>" : "";
        return `<li>${target.label}: ${values}${warning}</li>`;
      })
      .join("");

    this.elements.projectionList.innerHTML = html;
  }

  renderStakeholders(snapshot) {
    const rows = this.data.stakeholders
      .map((stakeholder) => {
        const value = snapshot.stakeholders[stakeholder.key];
        const cls = value < 30 ? "low" : value < 60 ? "mid" : "high";

        return `
          <div class="stakeholder-row">
            <span>${stakeholder.label}</span>
            <div class="progress-track">
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

        return `
          <li class="upgrade-row">
            <span>${TRACK_LABELS[track] || track}</span>
            <div class="progress-track">
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
            return `<span class="${cls}">${label}: ${sign}${value}</span>`;
          })
          .join("");

        const stakeholders = Object.entries(policy.stakeholders || {})
          .map(([key, value]) => {
            const name = key === "ngo" ? "NGO" : key[0].toUpperCase() + key.slice(1);
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
            <p>${policy.description}</p>
            <div class="cost-line">Cost: $${policy.cost}M</div>
            <span class="policy-meta">Ramp ${immediatePct}% to 100% in ${rampCycles} cycles</span>
            <span class="policy-meta">Cooldown ${cooldownLabel} cycles</span>
            <div class="impact-grid">${impacts}</div>
            <p>Stakeholders: ${stakeholders}</p>
            <div class="actions">
              <button class="primary-btn" data-policy-id="${policy.id}" ${buttonDisabled ? "disabled" : ""}>
                ${policyResolvedCycle ? "Policy Locked" : cooldown > 0 ? `Cooldown (${cooldown})` : canAfford ? "Enact Policy" : "Insufficient Budget"}
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
            const name = key === "ngo" ? "NGO" : key[0].toUpperCase() + key.slice(1);
            const sign = value >= 0 ? "+" : "";
            return `${name} ${sign}${value}`;
          })
          .join(" | ");

        return `
          <article class="policy-card decision-card">
            <h3>${option.title}</h3>
            <p>${option.description}</p>
            <span class="policy-meta">${majorDecision.title}</span>
            <p>Stakeholders: ${stakeholders || "No direct shift"}</p>
            <p>${modifierText || "No timed global modifiers"}</p>
            <div class="actions">
              <button class="primary-btn" data-major-option-id="${option.id}" ${disabled ? "disabled" : ""}>Choose Option</button>
            </div>
          </article>
        `;
      })
      .join("");

    container.innerHTML = html;
  }

  buildLegend() {
    const legend = this.data.indicators
      .map(
        (indicator) =>
          `<span class="legend-item"><span class="legend-color" style="background:${indicator.color}"></span>${indicator.label}</span>`
      )
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
    });

    if (this.isMobileLayout()) {
      this.elements.panelTrack.style.transform = `translateX(-${this.panelIndex * 50}%)`;
    } else {
      this.elements.panelTrack.style.transform = "translateX(0)";
    }
  }

  isMobileLayout() {
    return window.matchMedia("(max-width: 900px)").matches;
  }

  showStartModal() {
    this.elements.startModal.classList.remove("hidden");
    this.elements.appShell.setAttribute("aria-hidden", "true");
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
  }

  hideGameoverModal() {
    this.elements.gameoverModal.classList.add("hidden");
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

  formatMoney(value) {
    const rounded = Math.round(value);
    const sign = rounded < 0 ? "-" : "";
    return `${sign}$${Math.abs(rounded)}M`;
  }

  formatPopulation(value) {
    return new Intl.NumberFormat().format(value);
  }
}
