import { STORAGE_KEYS } from "./data.js";

const clamp = (value, min, max) => Math.max(min, Math.min(max, value));

class DeterministicRng {
  constructor(seed) {
    this.seed = seed >>> 0;
    this.state = this.seed;
  }

  next() {
    let t = (this.state += 0x6d2b79f5);
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  }
}

export class SimulationEngine {
  constructor(gameData) {
    this.data = gameData;
    this.listeners = {
      state: [],
      log: [],
      banner: [],
      gameover: []
    };
    this.loopHandle = null;
    this.rng = new DeterministicRng(Date.now());
    this.state = null;
  }

  on(eventName, handler) {
    if (!this.listeners[eventName]) {
      return;
    }
    this.listeners[eventName].push(handler);
  }

  emit(eventName, payload) {
    const handlers = this.listeners[eventName] || [];
    handlers.forEach((handler) => handler(payload));
  }

  startNewGame(difficultyKey = "realistic") {
    const difficulty = this.data.difficulty[difficultyKey] ? difficultyKey : "realistic";
    const seed = (Date.now() ^ Math.floor(Math.random() * 0xffffffff)) >>> 0;
    this.rng = new DeterministicRng(seed);

    const diffCfg = this.data.difficulty[difficulty];
    this.state = {
      version: this.data.version,
      difficulty,
      seed,
      rngState: this.rng.state,
      cycle: 0,
      year: 1,
      budget: diffCfg.initialBudget,
      policyResolvedCycle: false,
      currentPolicies: [],
      indicators: { ...diffCfg.initialIndicators },
      stakeholders: {
        citizens: 60,
        industry: 60,
        ngo: 60
      },
      upgrades: {
        wasteTreatment: 0,
        renewableEnergy: 0,
        airFiltration: 0
      },
      activeEvents: [],
      eventCooldown: 0,
      cumulativeDiseaseModifier: 0,
      stabilityCycles: 0,
      criticalStreaks: {
        air: 0,
        water: 0,
        soil: 0,
        health: 0,
        carbonSafety: 0
      },
      history: [],
      logs: [],
      gameStatus: "running",
      result: null,
      resultReason: ""
    };

    this.captureHistory();
    this.drawPolicies();
    this.startLoop();
    this.emitState();
    this.pushLog("New game started.", "system");
  }

  startLoop() {
    this.stopLoop();
    this.loopHandle = setInterval(() => this.tick(), this.data.timing.cycleMs);
  }

  stopLoop() {
    if (this.loopHandle) {
      clearInterval(this.loopHandle);
      this.loopHandle = null;
    }
  }

  tick() {
    if (!this.state || this.state.gameStatus !== "running") {
      return;
    }

    this.state.cycle += 1;
    this.state.year = Math.floor(this.state.cycle / this.data.timing.cyclesPerYear) + 1;

    const diseaseFromEvents = this.applyActiveEventEffects();
    this.applyCoreSimulation(diseaseFromEvents);
    this.applyNGoFineRisk();

    this.evaluateWinLoss();
    this.captureHistory();

    this.state.policyResolvedCycle = false;
    this.drawPolicies();

    this.emitState();
  }

  applyCoreSimulation(diseaseFromEvents) {
    const diffCfg = this.data.difficulty[this.state.difficulty];
    const indicators = this.state.indicators;
    const stakeholders = this.state.stakeholders;

    const waterUpgrade = this.getUpgradeModifier("wasteTreatment", "waterDecayMultiplier");
    const airUpgrade = this.getUpgradeModifier("airFiltration", "airDecayMultiplier");
    const renewableUpgrade = this.getUpgradeModifier("renewableEnergy", "carbonGrowthMultiplier");
    const economyDrainModifier = this.getUpgradeModifier("wasteTreatment", "economyDrainMultiplier");

    const citizenPenalty = stakeholders.citizens < 30 ? 0.88 : 1;
    const industryPenalty = stakeholders.industry < 30 ? 0.85 : 1;
    const healthPenalty = 1 - Math.max(0, 50 - indicators.health) * 0.011;
    const waterEfficiency = 1 - Math.max(0, 50 - indicators.water) * 0.008;
    const productivityMultiplier = clamp(citizenPenalty * industryPenalty * healthPenalty * waterEfficiency, 0.45, 1.15);

    const agriculturalBoost = (indicators.soil - 50) * 0.013;
    const economyGrowth = (0.52 + (indicators.population - 50) * 0.01 + agriculturalBoost) * productivityMultiplier;
    indicators.economy = clamp(indicators.economy + economyGrowth, 0, 100);

    const populationGrowth =
      0.26 +
      Math.max(0, indicators.economy - 45) * 0.008 -
      Math.max(0, 45 - indicators.health) * 0.012;
    indicators.population = clamp(indicators.population + populationGrowth, 0, 100);

    const popPressure = indicators.population / 100;
    const ecoPressure = indicators.economy / 100;
    const carbonPressure = indicators.carbon / 100;

    const baseAirDecay =
      (0.62 + ecoPressure * 1.18 + popPressure * 0.92 + carbonPressure * 1.22) *
      diffCfg.decayMultiplier *
      airUpgrade;
    const baseWaterDecay =
      (0.53 + ecoPressure * 0.94 + popPressure * 0.98 + carbonPressure * 0.74) *
      diffCfg.decayMultiplier *
      waterUpgrade;
    const baseSoilDecay =
      (0.44 + ecoPressure * 1.02 + popPressure * 0.84 + carbonPressure * 0.7) *
      diffCfg.decayMultiplier;

    const passiveRecovery = (100 - indicators.carbon) / 220;
    indicators.air = clamp(indicators.air - baseAirDecay + passiveRecovery * 0.3, 0, 100);
    indicators.water = clamp(indicators.water - baseWaterDecay + this.state.upgrades.wasteTreatment * 0.13, 0, 100);
    indicators.soil = clamp(indicators.soil - baseSoilDecay + this.state.upgrades.wasteTreatment * 0.08, 0, 100);

    const carbonGrowth =
      (0.2 + indicators.economy * 0.015 + indicators.population * 0.009) *
      diffCfg.carbonGrowthMultiplier *
      renewableUpgrade;
    const carbonAbsorption = (indicators.air + indicators.soil) / 260 + this.state.upgrades.renewableEnergy * 0.12;
    indicators.carbon = clamp(indicators.carbon + carbonGrowth - carbonAbsorption, 0, 100);

    this.recalculatePublicHealth(diseaseFromEvents);

    const taxRevenue =
      ((indicators.economy * 0.92 + indicators.population * 0.34) * diffCfg.revenueMultiplier * productivityMultiplier) /
      10;
    const environmentalDrain =
      ((100 - indicators.air) + (100 - indicators.water) + (100 - indicators.soil) + indicators.carbon) /
      (18 * economyDrainModifier);
    const socialServices = 2.3 + Math.max(0, 55 - indicators.health) * 0.05;

    this.state.budget = clamp(this.state.budget + taxRevenue - environmentalDrain - socialServices, -350, 9999);

    if (this.state.eventCooldown > 0) {
      this.state.eventCooldown -= 1;
    } else {
      this.tryTriggerEvent();
    }

    this.state.rngState = this.rng.state;
  }

  recalculatePublicHealth(diseaseFromEvents = 0) {
    const indicators = this.state.indicators;
    const averageEnv = (indicators.air + indicators.water) / 2;
    const diseasePenalty =
      Math.max(0, 50 - indicators.air) * 0.22 +
      Math.max(0, 50 - indicators.water) * 0.24 +
      diseaseFromEvents;

    const targetHealth = clamp(averageEnv - diseasePenalty, 0, 100);
    const recoveryRate = targetHealth >= indicators.health ? 0.24 : 0.16;
    const healthyBonus = indicators.air > 60 && indicators.water > 60 ? 0.06 : 0;

    indicators.health = clamp(indicators.health + (targetHealth - indicators.health) * recoveryRate + healthyBonus, 0, 100);
  }

  applyNGoFineRisk() {
    const ngo = this.state.stakeholders.ngo;
    if (ngo >= 30) {
      return;
    }

    const indicators = this.state.indicators;
    const risk = 0.08 + (30 - ngo) * 0.01 + indicators.carbon / 500;
    if (this.rng.next() < risk) {
      const fine = 8 + Math.round(indicators.carbon * 0.07);
      this.state.budget = clamp(this.state.budget - fine, -350, 9999);
      this.pushLog(`Environmental fine issued: -$${fine}M.`, "warning");
      this.emit("banner", "Environmental fine applied due low NGO trust.");
    }
  }

  applyActiveEventEffects() {
    if (!this.state.activeEvents.length) {
      return 0;
    }

    let diseaseModifier = 0;
    const stillActive = [];

    for (const activeEvent of this.state.activeEvents) {
      this.applyDeltaSet(activeEvent.perCycle || {});

      if (activeEvent.diseaseModifier) {
        diseaseModifier += activeEvent.diseaseModifier;
      }

      activeEvent.remaining -= 1;
      if (activeEvent.remaining > 0) {
        stillActive.push(activeEvent);
      } else {
        this.pushLog(`${activeEvent.title} has ended.`, "system");
      }
    }

    this.state.activeEvents = stillActive;
    return diseaseModifier;
  }

  tryTriggerEvent() {
    if (this.state.cycle % 2 !== 0) {
      return;
    }

    const diffCfg = this.data.difficulty[this.state.difficulty];
    const indicators = this.state.indicators;
    const ngo = this.state.stakeholders.ngo;

    let chance = diffCfg.eventBaseChance + indicators.carbon / 550;
    if (ngo < 30) {
      chance += 0.08;
    }

    if (this.rng.next() > chance) {
      return;
    }

    const event = this.selectWeightedEvent();
    if (!event) {
      return;
    }

    this.applyEvent(event);
    this.state.eventCooldown = diffCfg.eventCooldownCycles;
  }

  selectWeightedEvent() {
    const indicators = this.state.indicators;
    const ngo = this.state.stakeholders.ngo;
    const health = indicators.health;

    const weightedEvents = this.data.events.map((event) => {
      let weight = event.weight;
      if (event.tags.includes("climate") && indicators.carbon > 60) {
        weight *= 1.9;
      }
      if (event.tags.includes("health") && health < 45) {
        weight *= 1.7;
      }
      if (event.tags.includes("policy") && ngo < 30) {
        weight *= 1.4;
      }
      if (event.tags.includes("positive") && indicators.carbon < 35) {
        weight *= 1.2;
      }
      return { event, weight };
    });

    const totalWeight = weightedEvents.reduce((sum, item) => sum + item.weight, 0);
    if (totalWeight <= 0) {
      return null;
    }

    let pick = this.rng.next() * totalWeight;
    for (const item of weightedEvents) {
      pick -= item.weight;
      if (pick <= 0) {
        return item.event;
      }
    }

    return weightedEvents[weightedEvents.length - 1]?.event ?? null;
  }

  applyEvent(eventDef) {
    this.applyDeltaSet(eventDef.instant || {});
    this.applyStakeholderDelta(eventDef.stakeholders || {});

    if (eventDef.budgetDelta) {
      this.state.budget = clamp(this.state.budget + eventDef.budgetDelta, -350, 9999);
    }

    if (eventDef.duration > 1 || (eventDef.perCycle && Object.keys(eventDef.perCycle).length > 0)) {
      this.state.activeEvents.push({
        id: eventDef.id,
        title: eventDef.title,
        remaining: eventDef.duration,
        perCycle: { ...(eventDef.perCycle || {}) },
        diseaseModifier: eventDef.diseaseModifier || 0
      });
    }

    this.pushLog(`Event: ${eventDef.title} - ${eventDef.description}`, "event");
    this.emit("banner", `${eventDef.title}: ${eventDef.description}`);
  }

  applyDeltaSet(deltaSet) {
    Object.entries(deltaSet).forEach(([key, delta]) => {
      if (Object.prototype.hasOwnProperty.call(this.state.indicators, key)) {
        this.state.indicators[key] = clamp(this.state.indicators[key] + delta, 0, 100);
      }
    });
  }

  applyStakeholderDelta(stakeholderDelta) {
    Object.entries(stakeholderDelta).forEach(([key, delta]) => {
      if (Object.prototype.hasOwnProperty.call(this.state.stakeholders, key)) {
        this.state.stakeholders[key] = clamp(this.state.stakeholders[key] + delta, 0, 100);
      }
    });
  }

  drawPolicies() {
    const available = this.data.policies.filter((policy) => this.isPolicyAvailable(policy));
    if (available.length <= 3) {
      this.state.currentPolicies = [...available];
      return;
    }

    const selected = [];
    const pool = [...available];
    while (selected.length < 3 && pool.length) {
      const idx = Math.floor(this.rng.next() * pool.length);
      selected.push(pool.splice(idx, 1)[0]);
    }
    this.state.currentPolicies = selected;
  }

  isPolicyAvailable(policy) {
    if (policy.requires) {
      const [track, requiredLevel] = Object.entries(policy.requires)[0];
      if (this.state.upgrades[track] < requiredLevel) {
        return false;
      }
    }

    if (policy.upgrade) {
      const currentLevel = this.state.upgrades[policy.upgrade.track];
      if (currentLevel >= policy.upgrade.level) {
        return false;
      }
    }

    return true;
  }

  canAffordPolicy(policyId) {
    const policy = this.state.currentPolicies.find((item) => item.id === policyId);
    if (!policy) {
      return false;
    }
    return this.state.budget >= policy.cost;
  }

  applyPolicy(policyId) {
    if (!this.state || this.state.gameStatus !== "running") {
      return { ok: false, message: "Game is not running." };
    }

    if (this.state.policyResolvedCycle) {
      return { ok: false, message: "Policy already selected for this cycle." };
    }

    const policy = this.state.currentPolicies.find((item) => item.id === policyId);
    if (!policy) {
      return { ok: false, message: "Policy unavailable." };
    }

    if (!this.canAffordPolicy(policy.id)) {
      return { ok: false, message: "Insufficient budget." };
    }

    if (!this.isPolicyAvailable(policy)) {
      return { ok: false, message: "Prerequisite not met." };
    }

    this.state.budget = clamp(this.state.budget - policy.cost, -350, 9999);
    this.applyDeltaSet(policy.impacts);
    this.applyStakeholderDelta(policy.stakeholders || {});

    if (policy.upgrade) {
      this.state.upgrades[policy.upgrade.track] = Math.max(
        this.state.upgrades[policy.upgrade.track],
        policy.upgrade.level
      );
      this.pushLog(
        `Upgrade unlocked: ${policy.upgrade.track} L${policy.upgrade.level}.`,
        "upgrade"
      );
    }

    this.state.policyResolvedCycle = true;
    this.pushLog(`Policy adopted: ${policy.title}`, "policy");
    this.emit("banner", `Policy enacted: ${policy.title}`);
    this.emitState();

    return { ok: true, message: `${policy.title} enacted.` };
  }

  skipPolicy() {
    if (!this.state || this.state.gameStatus !== "running") {
      return;
    }

    if (this.state.policyResolvedCycle) {
      return;
    }

    this.state.policyResolvedCycle = true;
    this.pushLog("No policy enacted this cycle.", "system");
    this.emit("banner", "No policy enacted this cycle.");
    this.emitState();
  }

  evaluateWinLoss() {
    const indicators = this.state.indicators;
    const criticalFloor = this.data.thresholds.criticalFloor;
    const targetFloor = this.data.thresholds.targetFloor;

    const carbonSafety = 100 - indicators.carbon;
    const monitored = {
      air: indicators.air,
      water: indicators.water,
      soil: indicators.soil,
      health: indicators.health,
      carbonSafety
    };

    Object.entries(monitored).forEach(([key, value]) => {
      if (value < criticalFloor) {
        this.state.criticalStreaks[key] += 1;
      } else {
        this.state.criticalStreaks[key] = 0;
      }
    });

    const losingMetric = Object.entries(this.state.criticalStreaks).find(
      ([, streak]) => streak >= this.data.timing.criticalCyclesToLose
    );

    if (losingMetric) {
      const metricLabel = losingMetric[0] === "carbonSafety" ? "Carbon Emissions" : losingMetric[0];
      this.finishGame("loss", `${metricLabel} remained in critical range for 3 cycles.`);
      return;
    }

    const stable =
      indicators.air >= targetFloor &&
      indicators.water >= targetFloor &&
      indicators.soil >= targetFloor &&
      indicators.health >= targetFloor &&
      carbonSafety >= targetFloor;

    this.state.stabilityCycles = stable ? this.state.stabilityCycles + 1 : 0;

    if (this.state.stabilityCycles >= this.data.timing.targetYearsToWin * this.data.timing.cyclesPerYear) {
      this.finishGame("win", "Sustainability targets maintained for 10 years.");
    }
  }

  finishGame(result, reason) {
    this.state.gameStatus = "ended";
    this.state.result = result;
    this.state.resultReason = reason;
    this.stopLoop();
    this.pushLog(`Game ${result.toUpperCase()}: ${reason}`, "system");

    const entry = this.pushLeaderboardEntry(result);
    this.emit("gameover", {
      result,
      reason,
      entry
    });
    this.emitState();
  }

  pushLeaderboardEntry(result) {
    const entry = {
      result,
      difficulty: this.state.difficulty,
      year: this.state.year,
      cycle: this.state.cycle,
      budget: Math.round(this.state.budget),
      score: this.computeScore(),
      date: new Date().toISOString()
    };

    const leaderboard = this.getLeaderboard();
    leaderboard.push(entry);
    leaderboard.sort((a, b) => b.score - a.score);
    const trimmed = leaderboard.slice(0, 10);
    localStorage.setItem(STORAGE_KEYS.leaderboard, JSON.stringify(trimmed));
    return entry;
  }

  computeScore() {
    const indicators = this.state.indicators;
    const environmentComposite =
      (indicators.air + indicators.water + indicators.soil + indicators.health + (100 - indicators.carbon)) / 5;
    const stakeholderComposite =
      (this.state.stakeholders.citizens + this.state.stakeholders.industry + this.state.stakeholders.ngo) / 3;

    return Math.round(
      this.state.year * 52 +
        this.state.budget * 1.2 +
        environmentComposite * 3 +
        stakeholderComposite * 1.6
    );
  }

  getLeaderboard() {
    try {
      const raw = localStorage.getItem(STORAGE_KEYS.leaderboard);
      if (!raw) {
        return [];
      }
      const parsed = JSON.parse(raw);
      return Array.isArray(parsed) ? parsed : [];
    } catch (error) {
      return [];
    }
  }

  getUpgradeModifier(track, modifierKey) {
    const level = this.state.upgrades[track];
    const table = this.data.upgrades[track] || [];
    const match = table.find((item) => item.level === level) || table[0];
    return match?.[modifierKey] ?? 1;
  }

  captureHistory() {
    const row = {
      cycle: this.state.cycle,
      year: this.state.year,
      ...this.state.indicators
    };

    this.state.history.push(row);
    if (this.state.history.length > 180) {
      this.state.history.shift();
    }
  }

  pushLog(message, type = "info") {
    this.state.logs.unshift({
      cycle: this.state.cycle,
      year: this.state.year,
      message,
      type,
      timestamp: Date.now()
    });

    if (this.state.logs.length > 40) {
      this.state.logs = this.state.logs.slice(0, 40);
    }

    this.emit("log", { message, type });
  }

  classifyIndicator(key, value) {
    let score = value;
    if (key === "carbon") {
      score = 100 - value;
    }

    const band = this.data.thresholds.bands.find((item) => score >= item.min && score <= item.max);
    return band?.key || "critical";
  }

  getPopulationAbsolute() {
    if (!this.state) {
      return 0;
    }
    return Math.round(260000 + this.state.indicators.population * 17000);
  }

  getSnapshot() {
    if (!this.state) {
      return null;
    }

    const indicatorStatuses = {};
    this.data.indicators.forEach((indicator) => {
      indicatorStatuses[indicator.key] = this.classifyIndicator(
        indicator.key,
        this.state.indicators[indicator.key]
      );
    });

    return {
      version: this.state.version,
      difficulty: this.state.difficulty,
      cycle: this.state.cycle,
      year: this.state.year,
      cycleInYear: (this.state.cycle % this.data.timing.cyclesPerYear) + 1,
      budget: this.state.budget,
      populationAbsolute: this.getPopulationAbsolute(),
      policyResolvedCycle: this.state.policyResolvedCycle,
      currentPolicies: this.state.currentPolicies.map((policy) => ({ ...policy })),
      indicators: { ...this.state.indicators },
      indicatorStatuses,
      stakeholders: { ...this.state.stakeholders },
      upgrades: { ...this.state.upgrades },
      activeEvents: this.state.activeEvents.map((event) => ({ ...event })),
      history: this.state.history.map((item) => ({ ...item })),
      logs: this.state.logs.map((item) => ({ ...item })),
      gameStatus: this.state.gameStatus,
      result: this.state.result,
      resultReason: this.state.resultReason,
      stabilityCycles: this.state.stabilityCycles,
      targetStabilityCycles: this.data.timing.targetYearsToWin * this.data.timing.cyclesPerYear,
      leaderboard: this.getLeaderboard(),
      timing: { ...this.data.timing }
    };
  }

  emitState() {
    const snapshot = this.getSnapshot();
    if (snapshot) {
      this.emit("state", snapshot);
    }
  }

  saveGame() {
    if (!this.state) {
      return { ok: false, message: "No active game state." };
    }

    const payload = {
      savedAt: new Date().toISOString(),
      dataVersion: this.data.version,
      state: {
        ...this.state,
        rngState: this.rng.state
      }
    };

    localStorage.setItem(STORAGE_KEYS.save, JSON.stringify(payload));
    return { ok: true, message: "Game saved." };
  }

  loadGame() {
    try {
      const raw = localStorage.getItem(STORAGE_KEYS.save);
      if (!raw) {
        return { ok: false, message: "No saved game found." };
      }

      const parsed = JSON.parse(raw);
      if (!parsed?.state) {
        return { ok: false, message: "Saved data is invalid." };
      }

      this.state = parsed.state;
      this.rng = new DeterministicRng(this.state.seed || Date.now());
      this.rng.state = this.state.rngState || this.rng.seed;

      if (this.state.gameStatus === "running") {
        this.startLoop();
      } else {
        this.stopLoop();
      }

      this.drawPolicies();
      this.emitState();
      return { ok: true, message: "Saved game loaded." };
    } catch (error) {
      return { ok: false, message: "Unable to load save file." };
    }
  }
}