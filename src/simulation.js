
import { STORAGE_KEYS } from "./data.js";
import { EventSystem } from "./events.js";
import { PolicySystem } from "./policy.js";

const clamp = (value, min, max) => Math.max(min, Math.min(max, value));
const toFiniteNumber = (value, fallback = 0) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
};

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

    this.policySystem = new PolicySystem(this.data);
    this.eventSystem = new EventSystem(this.data);
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
      history: [],
      logs: [],
      projections: {},
      activePolicyEffects: [],
      policyCooldowns: {},
      activeEvents: [],
      eventCooldown: 0,
      globalModifiers: [],
      majorDecision: null,
      lastMajorDecisionCycle: 0,
      finance: {
        debt: 0,
        lastInterestCharge: 0,
        lastDebtPayment: 0,
        lastRevenue: 0,
        annualRevenueEstimate: 200,
        annualRevenueWindow: [],
        debtToRevenueRatio: 0,
        investorPenaltyActive: false
      },
      stakeholderDynamics: {
        highCitizenRecoveryCycles: 0,
        citizensWereHigh: false
      },
      tipping: {
        healthCap: 100,
        soilCap: 100,
        populationGrowthMultiplier: 1,
        streaks: {
          lowAir: 0,
          lowWater: 0,
          highCarbon: 0
        }
      },
      stabilityCycles: 0,
      criticalStreaks: {
        air: 0,
        water: 0,
        soil: 0,
        health: 0,
        carbonSafety: 0
      },
      gameStatus: "running",
      result: null,
      resultReason: "",
      scoreBreakdown: null
    };

    this.policySystem.ensureState(this.state);
    this.eventSystem.ensureState(this.state);

    this.captureHistory();
    this.computeProjections();
    this.state.currentPolicies = this.policySystem.drawPolicies(this.state, this.rng);
    this.pushLog("New game started.", "system");
    this.startLoop();
    this.emitState();
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

    this.policySystem.processRampQueue(
      this.state,
      (deltaSet) => this.applyDeltaSet(deltaSet),
      (stakeholderDelta) => this.applyStakeholderDelta(stakeholderDelta),
      (message, type) => this.pushLog(message, type)
    );

    const diseaseFromEvents = this.eventSystem.processActiveEvents(
      this.state,
      (deltaSet) => this.applyDeltaSet(deltaSet),
      (stakeholderDelta) => this.applyStakeholderDelta(stakeholderDelta),
      (message, type) => this.pushLog(message, type)
    );

    const stakeholderFlags = this.getStakeholderFlags();

    this.applyCoreSimulation(diseaseFromEvents);
    this.applyStakeholderDynamicEffects();
    this.applyDebtAndFiscalSystem();
    this.applyTippingPoints();

    this.eventSystem.decayGlobalModifiers(this.state);

    const context = {
      citizensLow: stakeholderFlags.citizensLow,
      ngoLow: stakeholderFlags.ngoLow
    };

    this.eventSystem.maybeTriggerRandomEvent(this.state, this.rng, context, (eventDef) => {
      this.applyEvent(eventDef);
    });

    if (this.eventSystem.isMajorDecisionDue(this.state)) {
      this.eventSystem.queueMajorDecision(
        this.state,
        this.rng,
        (message, type) => this.pushLog(message, type),
        (message) => this.emit("banner", message)
      );
    }

    this.evaluateWinLoss();
    this.captureHistory();
    this.computeProjections();

    this.state.policyResolvedCycle = false;
    if (this.state.majorDecision) {
      this.state.currentPolicies = [];
    } else {
      this.state.currentPolicies = this.policySystem.drawPolicies(this.state, this.rng);
    }

    this.policySystem.decrementCooldowns(this.state);
    this.state.rngState = this.rng.state;
    this.emitState();
  }

  getStakeholderFlags() {
    const dynamics = this.data.systems.stakeholderDynamics;
    const stakeholders = this.state.stakeholders;

    return {
      citizensLow: stakeholders.citizens < dynamics.citizensLowThreshold,
      citizensHigh: stakeholders.citizens > dynamics.citizensHighThreshold,
      industryLow: stakeholders.industry < dynamics.industryLowThreshold,
      ngoLow: stakeholders.ngo < dynamics.ngoLowThreshold
    };
  }

  applyCoreSimulation(diseaseFromEvents) {
    const diffCfg = this.data.difficulty[this.state.difficulty];
    const indicators = this.state.indicators;
    const stakeholders = this.state.stakeholders;
    const stakeholderConfig = this.data.systems.stakeholderDynamics;

    const waterUpgrade = this.getUpgradeModifier("wasteTreatment", "waterDecayMultiplier");
    const airUpgrade = this.getUpgradeModifier("airFiltration", "airDecayMultiplier");
    const renewableUpgrade = this.getUpgradeModifier("renewableEnergy", "carbonGrowthMultiplier");
    const economyDrainModifier = this.getUpgradeModifier("wasteTreatment", "economyDrainMultiplier");

    const annualRevenueEstimate = this.getAnnualRevenueEstimate();
    const interestRate = this.data.systems.fiscal.interestRates[this.state.difficulty];
    const expectedInterest = this.state.finance.debt * interestRate;
    const interestPenalty = 1 - clamp(
      (expectedInterest / Math.max(1, annualRevenueEstimate)) * this.data.systems.fiscal.debtInterestPenaltyScale,
      0,
      this.data.systems.fiscal.debtInterestPenaltyCap
    );

    const investorPenaltyMultiplier = this.state.finance.investorPenaltyActive
      ? 1 - this.data.systems.fiscal.investorEconomyPenalty
      : 1;

    const citizenProductivityPenalty = stakeholders.citizens < stakeholderConfig.citizensLowThreshold ? 0.9 : 1;
    const industryPenalty = stakeholders.industry < stakeholderConfig.industryLowThreshold
      ? 1 - stakeholderConfig.industryLowEconomyPenalty
      : 1;
    const healthPenalty = 1 - Math.max(0, 50 - indicators.health) * 0.011;
    const waterEfficiency = 1 - Math.max(0, 50 - indicators.water) * 0.008;

    const globalEconomyModifier = this.eventSystem.getGlobalMultiplier(this.state, "economyGrowthMultiplier");
    const globalCarbonModifier = this.eventSystem.getGlobalMultiplier(this.state, "carbonGrowthMultiplier");

    const productivityMultiplier = clamp(
      citizenProductivityPenalty *
        industryPenalty *
        healthPenalty *
        waterEfficiency *
        interestPenalty *
        investorPenaltyMultiplier *
        globalEconomyModifier,
      0.35,
      1.2
    );

    const agriculturalBoost = (indicators.soil - 50) * 0.013;
    const economyGrowth =
      (0.52 + (indicators.population - 50) * 0.01 + agriculturalBoost) * productivityMultiplier;
    indicators.economy = clamp(indicators.economy + economyGrowth, 0, this.getIndicatorCap("economy"));

    const populationGrowth =
      (0.26 +
        Math.max(0, indicators.economy - 45) * 0.008 -
        Math.max(0, 45 - indicators.health) * 0.012) *
      this.state.tipping.populationGrowthMultiplier;
    indicators.population = clamp(
      indicators.population + populationGrowth,
      0,
      this.getIndicatorCap("population")
    );

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
    indicators.air = clamp(indicators.air - baseAirDecay + passiveRecovery * 0.3, 0, this.getIndicatorCap("air"));
    indicators.water = clamp(
      indicators.water - baseWaterDecay + this.state.upgrades.wasteTreatment * 0.13,
      0,
      this.getIndicatorCap("water")
    );
    indicators.soil = clamp(
      indicators.soil - baseSoilDecay + this.state.upgrades.wasteTreatment * 0.08,
      0,
      this.getIndicatorCap("soil")
    );

    const carbonGrowth =
      (0.2 + indicators.economy * 0.015 + indicators.population * 0.009) *
      diffCfg.carbonGrowthMultiplier *
      renewableUpgrade *
      globalCarbonModifier;
    const carbonAbsorption = (indicators.air + indicators.soil) / 260 + this.state.upgrades.renewableEnergy * 0.12;
    indicators.carbon = clamp(indicators.carbon + carbonGrowth - carbonAbsorption, 0, this.getIndicatorCap("carbon"));

    this.recalculatePublicHealth(diseaseFromEvents);

    let taxRevenue =
      ((indicators.economy * 0.92 + indicators.population * 0.34) * diffCfg.revenueMultiplier * productivityMultiplier) /
      10;

    if (stakeholders.citizens < stakeholderConfig.citizensLowThreshold) {
      taxRevenue *= 1 - stakeholderConfig.citizensLowRevenuePenalty;
    }

    const environmentalDrain =
      ((100 - indicators.air) + (100 - indicators.water) + (100 - indicators.soil) + indicators.carbon) /
      (18 * economyDrainModifier);
    const socialServices = 2.3 + Math.max(0, 55 - indicators.health) * 0.05;

    this.state.finance.lastRevenue = Math.max(0, taxRevenue);
    this.state.budget = clamp(this.state.budget + taxRevenue - environmentalDrain - socialServices, -9999, 9999);
  }

  recalculatePublicHealth(diseaseFromEvents = 0) {
    const indicators = this.state.indicators;
    const averageEnv = (indicators.air + indicators.water) / 2;
    const diseasePenalty =
      Math.max(0, 50 - indicators.air) * 0.22 +
      Math.max(0, 50 - indicators.water) * 0.24 +
      diseaseFromEvents;

    const targetHealth = clamp(averageEnv - diseasePenalty, 0, this.getIndicatorCap("health"));
    const recoveryRate = targetHealth >= indicators.health ? 0.24 : 0.16;
    const healthyBonus = indicators.air > 60 && indicators.water > 60 ? 0.06 : 0;

    indicators.health = clamp(
      indicators.health + (targetHealth - indicators.health) * recoveryRate + healthyBonus,
      0,
      this.getIndicatorCap("health")
    );
  }

  applyStakeholderDynamicEffects() {
    const indicators = this.state.indicators;
    const stakeholderConfig = this.data.systems.stakeholderDynamics;
    const dynamics = this.state.stakeholderDynamics;
    const citizensHigh = this.state.stakeholders.citizens > stakeholderConfig.citizensHighThreshold;

    if (citizensHigh && !dynamics.citizensWereHigh) {
      dynamics.highCitizenRecoveryCycles = stakeholderConfig.citizensHighRecovery.durationCycles;
      this.pushLog("Citizen confidence surge activated short recovery boost.", "system");
    }

    if (dynamics.highCitizenRecoveryCycles > 0) {
      indicators.air = clamp(
        indicators.air + stakeholderConfig.citizensHighRecovery.air,
        0,
        this.getIndicatorCap("air")
      );
      indicators.water = clamp(
        indicators.water + stakeholderConfig.citizensHighRecovery.water,
        0,
        this.getIndicatorCap("water")
      );
      dynamics.highCitizenRecoveryCycles -= 1;
    }

    dynamics.citizensWereHigh = citizensHigh;
  }

  applyDebtAndFiscalSystem() {
    const fiscal = this.data.systems.fiscal;
    const finance = this.state.finance;

    const interestRate = fiscal.interestRates[this.state.difficulty];
    const interestCharge = finance.debt * interestRate;
    finance.lastInterestCharge = interestCharge;
    finance.debt += interestCharge;

    if (this.state.budget < 0) {
      finance.debt += Math.abs(this.state.budget);
      this.state.budget = 0;
    }

    finance.lastDebtPayment = 0;
    if (finance.debt > 0 && this.state.budget > 0) {
      const payment = Math.min(finance.debt, this.state.budget * fiscal.debtRepaymentShare);
      finance.debt -= payment;
      this.state.budget -= payment;
      finance.lastDebtPayment = payment;
    }

    finance.annualRevenueWindow.push(finance.lastRevenue);
    if (finance.annualRevenueWindow.length > this.data.timing.cyclesPerYear) {
      finance.annualRevenueWindow.shift();
    }

    finance.annualRevenueEstimate = this.getAnnualRevenueEstimate();
    finance.debtToRevenueRatio = finance.debt / Math.max(1, finance.annualRevenueEstimate);

    const investorThreshold = fiscal.debtToAnnualRevenuePenaltyThreshold;
    if (finance.debtToRevenueRatio > investorThreshold && !finance.investorPenaltyActive) {
      finance.investorPenaltyActive = true;
      this.applyStakeholderDelta({ industry: -fiscal.investorIndustryHit });
      this.pushLog("Investor confidence penalty activated.", "warning");
      this.emit("banner", "Investor confidence dropped due debt stress.");
    }

    if (finance.debtToRevenueRatio <= investorThreshold && finance.investorPenaltyActive) {
      finance.investorPenaltyActive = false;
      this.pushLog("Investor confidence penalty removed.", "system");
    }
  }

  applyTippingPoints() {
    const tippingCfg = this.data.systems.tippingPoints;
    const tipping = this.state.tipping;
    const indicators = this.state.indicators;

    if (indicators.air < tippingCfg.air.threshold) {
      tipping.streaks.lowAir += 1;
    } else {
      tipping.streaks.lowAir = 0;
    }

    if (indicators.water < tippingCfg.water.threshold) {
      tipping.streaks.lowWater += 1;
    } else {
      tipping.streaks.lowWater = 0;
    }

    if (indicators.carbon > tippingCfg.carbon.threshold) {
      tipping.streaks.highCarbon += 1;
    } else {
      tipping.streaks.highCarbon = 0;
    }

    if (tipping.streaks.lowAir >= tippingCfg.air.cycles) {
      const before = tipping.healthCap;
      tipping.healthCap = Math.max(tippingCfg.air.minHealthCap, tipping.healthCap - tippingCfg.air.healthCapDrop);
      tipping.streaks.lowAir = 0;
      if (tipping.healthCap < before) {
        indicators.health = Math.min(indicators.health, tipping.healthCap);
        this.pushLog("Tipping point: chronic toxic air permanently lowered health potential.", "warning");
        this.emit("banner", "Tipping point reached: Public Health maximum permanently reduced.");
      }
    }

    if (tipping.streaks.highCarbon >= tippingCfg.carbon.cycles) {
      const before = tipping.soilCap;
      tipping.soilCap = Math.max(tippingCfg.carbon.minSoilCap, tipping.soilCap - tippingCfg.carbon.soilCapDrop);
      tipping.streaks.highCarbon = 0;
      if (tipping.soilCap < before) {
        indicators.soil = Math.min(indicators.soil, tipping.soilCap);
        this.pushLog("Tipping point: sustained carbon overload permanently degraded soil potential.", "warning");
        this.emit("banner", "Tipping point reached: Soil maximum permanently reduced.");
      }
    }

    if (tipping.streaks.lowWater >= tippingCfg.water.cycles) {
      const before = tipping.populationGrowthMultiplier;
      tipping.populationGrowthMultiplier = Math.max(
        tippingCfg.water.minPopulationGrowthMultiplier,
        tipping.populationGrowthMultiplier * (1 - tippingCfg.water.populationGrowthMultiplierDrop)
      );
      tipping.streaks.lowWater = 0;
      if (tipping.populationGrowthMultiplier < before) {
        this.pushLog("Tipping point: severe water stress permanently reduced population growth.", "warning");
        this.emit("banner", "Tipping point reached: Population growth permanently reduced.");
      }
    }
  }

  applyEvent(eventDef) {
    this.applyDeltaSet(eventDef.instant || {});
    this.applyStakeholderDelta(eventDef.stakeholders || {});

    if (eventDef.budgetDelta) {
      this.state.budget = clamp(this.state.budget + eventDef.budgetDelta, -9999, 9999);
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
        const cap = this.getIndicatorCap(key);
        this.state.indicators[key] = clamp(this.state.indicators[key] + delta, 0, cap);
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

  getIndicatorCap(indicatorKey) {
    if (indicatorKey === "health") {
      return this.state.tipping.healthCap;
    }

    if (indicatorKey === "soil") {
      return this.state.tipping.soilCap;
    }

    return 100;
  }

  canAffordPolicy(policyId) {
    if (!this.state) {
      return false;
    }

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

    if (this.state.majorDecision) {
      return { ok: false, message: "Resolve the major global decision first." };
    }

    if (this.state.policyResolvedCycle) {
      return { ok: false, message: "Policy already selected for this cycle." };
    }

    const policy = this.state.currentPolicies.find((item) => item.id === policyId);
    if (!policy) {
      return { ok: false, message: "Policy unavailable." };
    }

    if (!this.policySystem.isPolicyAvailable(policy, this.state)) {
      return { ok: false, message: "Policy on cooldown or prerequisite missing." };
    }

    if (!this.canAffordPolicy(policy.id)) {
      return { ok: false, message: "Insufficient budget." };
    }

    this.state.budget = clamp(this.state.budget - policy.cost, -9999, 9999);

    const application = this.policySystem.registerPolicySelection(policy, this.state);
    this.applyDeltaSet(application.immediateImpacts);
    this.applyStakeholderDelta(application.immediateStakeholders);

    if (policy.upgrade) {
      this.state.upgrades[policy.upgrade.track] = Math.max(
        this.state.upgrades[policy.upgrade.track],
        policy.upgrade.level
      );
      this.pushLog(`Upgrade unlocked: ${policy.upgrade.track} L${policy.upgrade.level}.`, "upgrade");
    }

    this.state.policyResolvedCycle = true;
    this.pushLog(`Policy adopted: ${policy.title}`, "policy");
    this.emit("banner", `Policy enacted: ${policy.title}`);
    this.emitState();

    return { ok: true, message: `${policy.title} enacted.` };
  }

  chooseMajorDecisionOption(optionId) {
    if (!this.state || this.state.gameStatus !== "running") {
      return { ok: false, message: "Game is not running." };
    }

    const result = this.eventSystem.resolveMajorDecisionOption(
      this.state,
      optionId,
      (deltaSet) => this.applyDeltaSet(deltaSet),
      (stakeholderDelta) => this.applyStakeholderDelta(stakeholderDelta),
      (message, type) => this.pushLog(message, type),
      (message) => this.emit("banner", message)
    );

    if (result.ok) {
      this.state.policyResolvedCycle = true;
      this.emitState();
    }

    return result;
  }

  skipPolicy() {
    if (!this.state || this.state.gameStatus !== "running") {
      return { ok: false, message: "Game is not running." };
    }

    if (this.state.majorDecision) {
      return { ok: false, message: "Major decision cycle cannot be skipped." };
    }

    if (this.state.policyResolvedCycle) {
      return { ok: false, message: "Policy already selected for this cycle." };
    }

    this.state.policyResolvedCycle = true;
    this.pushLog("No policy enacted this cycle.", "system");
    this.emit("banner", "No policy enacted this cycle.");
    this.emitState();

    return { ok: true, message: "Cycle skipped." };
  }

  evaluateWinLoss() {
    const indicators = this.state.indicators;
    const criticalFloor = this.data.thresholds.criticalFloor;
    const targetFloor = this.data.thresholds.targetFloor;
    const criticalCyclesToLose = this.data.timing.criticalCyclesToLose;

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
      ([, streak]) => streak >= criticalCyclesToLose
    );

    if (losingMetric) {
      const metricLabels = {
        air: "Air Quality",
        water: "Water Quality",
        soil: "Soil Quality",
        health: "Public Health",
        carbonSafety: "Carbon Emissions"
      };
      const metricLabel = metricLabels[losingMetric[0]] || losingMetric[0];
      this.finishGame("loss", `${metricLabel} remained in critical range for ${criticalCyclesToLose} cycles.`);
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
    this.state.scoreBreakdown = this.computeScoreBreakdown();

    this.stopLoop();
    this.pushLog(`Game ${result.toUpperCase()}: ${reason}`, "system");

    const entry = this.pushLeaderboardEntry(result);
    this.emit("gameover", {
      result,
      reason,
      entry,
      scoreBreakdown: this.state.scoreBreakdown
    });

    this.emitState();
  }

  computeScoreBreakdown() {
    const indicators = this.state.indicators;
    const stakeholders = this.state.stakeholders;
    const weights = this.data.systems.scoring.weights;

    const environmentalAverage = clamp((indicators.air + indicators.water + indicators.soil) / 3, 0, 100);

    const fiscalHealth = clamp(
      68 + this.state.budget * 0.12 - this.state.finance.debtToRevenueRatio * 22,
      0,
      100
    );
    const economicStability = clamp(indicators.economy * 0.7 + fiscalHealth * 0.3, 0, 100);

    const publicHealth = clamp(indicators.health, 0, 100);
    const carbonEfficiency = clamp(100 - indicators.carbon, 0, 100);
    const stakeholderBalance = clamp(
      (stakeholders.citizens + stakeholders.industry + stakeholders.ngo) / 3,
      0,
      100
    );

    const finalScore =
      environmentalAverage * weights.environmentalAverage +
      economicStability * weights.economicStability +
      publicHealth * weights.publicHealth +
      carbonEfficiency * weights.carbonEfficiency +
      stakeholderBalance * weights.stakeholderBalance;

    return {
      finalScore: Math.round(finalScore * 100) / 100,
      components: {
        environmentalAverage: Math.round(environmentalAverage * 100) / 100,
        economicStability: Math.round(economicStability * 100) / 100,
        publicHealth: Math.round(publicHealth * 100) / 100,
        carbonEfficiency: Math.round(carbonEfficiency * 100) / 100,
        stakeholderBalance: Math.round(stakeholderBalance * 100) / 100
      },
      weights: { ...weights }
    };
  }

  computeScore() {
    return this.computeScoreBreakdown().finalScore;
  }

  pushLeaderboardEntry(result) {
    const scoreBreakdown = this.computeScoreBreakdown();
    const entry = {
      result,
      difficulty: this.state.difficulty,
      year: this.state.year,
      cycle: this.state.cycle,
      budget: Math.round(this.state.budget),
      debt: Math.round(this.state.finance.debt),
      score: scoreBreakdown.finalScore,
      scoreBreakdown,
      date: new Date().toISOString()
    };

    const leaderboard = this.getLeaderboard();
    leaderboard.push(entry);
    leaderboard.sort((a, b) => b.score - a.score);
    const trimmed = leaderboard.slice(0, 10);

    try {
      localStorage.setItem(STORAGE_KEYS.leaderboard, JSON.stringify(trimmed));
    } catch (error) {
      // Keep in-memory flow alive even when storage is unavailable.
    }

    return entry;
  }

  getLeaderboard() {
    const keys = [STORAGE_KEYS.leaderboard, STORAGE_KEYS.leaderboardLegacy];

    for (const key of keys) {
      try {
        const raw = localStorage.getItem(key);
        if (!raw) {
          continue;
        }
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed)) {
          return parsed;
        }
      } catch (error) {
        // Continue to next key.
      }
    }

    return [];
  }

  getUpgradeModifier(track, modifierKey) {
    const level = this.state.upgrades[track];
    const table = this.data.upgrades[track] || [];
    const match = table.find((item) => item.level === level) || table[0];
    return match?.[modifierKey] ?? 1;
  }

  getAnnualRevenueEstimate() {
    const window = this.state.finance.annualRevenueWindow;
    if (!window.length) {
      return this.state.finance.annualRevenueEstimate || 200;
    }

    const sum = window.reduce((acc, value) => acc + value, 0);
    return (sum / window.length) * this.data.timing.cyclesPerYear;
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

  computeProjections() {
    const projectionCfg = this.data.systems.projections;
    const history = this.state.history;

    const projectionTargets = ["air", "water", "carbon", "health"];
    const projected = {};

    projectionTargets.forEach((key) => {
      const points = history.slice(-projectionCfg.windowCycles).map((entry) => entry[key]);
      const latest = points[points.length - 1] ?? this.state.indicators[key];

      let slope = 0;
      if (points.length >= 2) {
        slope = (points[points.length - 1] - points[0]) / (points.length - 1);
      }

      const nextValues = [];
      for (let step = 1; step <= projectionCfg.horizonCycles; step += 1) {
        nextValues.push(clamp(latest + slope * step, 0, 100));
      }

      const criticalCrossed =
        key === "carbon"
          ? nextValues.some((value) => value > 75)
          : nextValues.some((value) => value < this.data.thresholds.criticalFloor);

      projected[key] = {
        slope: Math.round(slope * 100) / 100,
        nextValues,
        warning: criticalCrossed
      };
    });

    this.state.projections = projected;
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
    let score = toFiniteNumber(value, 0);
    if (key === "carbon") {
      score = 100 - score;
    }

    const orderedBands = [...this.data.thresholds.bands].sort((a, b) => b.min - a.min);
    const band = orderedBands.find((item) => score >= item.min);
    return band?.key || orderedBands[orderedBands.length - 1]?.key || "critical";
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
      debt: this.state.finance.debt,
      lastInterestCharge: this.state.finance.lastInterestCharge,
      debtToRevenueRatio: this.state.finance.debtToRevenueRatio,
      annualRevenueEstimate: this.state.finance.annualRevenueEstimate,
      investorPenaltyActive: this.state.finance.investorPenaltyActive,
      populationAbsolute: this.getPopulationAbsolute(),
      policyResolvedCycle: this.state.policyResolvedCycle,
      currentPolicies: this.state.currentPolicies.map((policy) => ({ ...policy })),
      policyCooldowns: { ...this.state.policyCooldowns },
      activePolicyEffects: this.state.activePolicyEffects.map((entry) => ({ ...entry })),
      majorDecision: this.state.majorDecision
        ? {
            ...this.state.majorDecision,
            options: this.state.majorDecision.options.map((option) => ({ ...option }))
          }
        : null,
      globalModifiers: this.state.globalModifiers.map((modifier) => ({ ...modifier })),
      indicators: { ...this.state.indicators },
      indicatorStatuses,
      stakeholders: { ...this.state.stakeholders },
      upgrades: { ...this.state.upgrades },
      tipping: {
        ...this.state.tipping,
        streaks: { ...this.state.tipping.streaks }
      },
      projections: { ...this.state.projections },
      activeEvents: this.state.activeEvents.map((event) => ({ ...event })),
      history: this.state.history.map((item) => ({ ...item })),
      logs: this.state.logs.map((item) => ({ ...item })),
      gameStatus: this.state.gameStatus,
      result: this.state.result,
      resultReason: this.state.resultReason,
      scoreBreakdown: this.state.scoreBreakdown,
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

    try {
      localStorage.setItem(STORAGE_KEYS.save, JSON.stringify(payload));
      return { ok: true, message: "Game saved." };
    } catch (error) {
      return { ok: false, message: "Save failed: storage unavailable." };
    }
  }

  normalizeLoadedState(rawState) {
    const fallbackDifficulty = this.data.difficulty[rawState?.difficulty] ? rawState.difficulty : "realistic";
    const diffCfg = this.data.difficulty[fallbackDifficulty];

    const cycle = Math.max(0, Math.round(toFiniteNumber(rawState.cycle, 0)));
    const yearFallback = Math.floor(cycle / this.data.timing.cyclesPerYear) + 1;
    const year = Math.max(1, Math.round(toFiniteNumber(rawState.year, yearFallback)));

    const indicatorDefaults = { ...diffCfg.initialIndicators };
    const indicators = Object.fromEntries(
      Object.entries(indicatorDefaults).map(([key, fallback]) => [
        key,
        clamp(toFiniteNumber(rawState.indicators?.[key], fallback), 0, 100)
      ])
    );

    const stakeholders = {
      citizens: clamp(toFiniteNumber(rawState.stakeholders?.citizens, 60), 0, 100),
      industry: clamp(toFiniteNumber(rawState.stakeholders?.industry, 60), 0, 100),
      ngo: clamp(toFiniteNumber(rawState.stakeholders?.ngo, 60), 0, 100)
    };

    const upgrades = Object.keys(this.data.upgrades).reduce((acc, track) => {
      const maxLevel = Math.max(...this.data.upgrades[track].map((item) => item.level), 0);
      acc[track] = clamp(Math.round(toFiniteNumber(rawState.upgrades?.[track], 0)), 0, maxLevel);
      return acc;
    }, {});

    const status = rawState.gameStatus === "ended" ? "ended" : "running";

    const normalized = {
      ...rawState,
      version: this.data.version,
      difficulty: fallbackDifficulty,
      seed: toFiniteNumber(rawState.seed, Date.now()) >>> 0,
      rngState: toFiniteNumber(rawState.rngState, rawState.seed || Date.now()) >>> 0,
      cycle,
      year,
      budget: clamp(toFiniteNumber(rawState.budget, diffCfg.initialBudget), -9999, 9999),
      policyResolvedCycle: Boolean(rawState.policyResolvedCycle),
      currentPolicies: Array.isArray(rawState.currentPolicies) ? rawState.currentPolicies : [],
      indicators,
      stakeholders,
      upgrades,
      history: Array.isArray(rawState.history)
        ? rawState.history
            .slice(-180)
            .map((entry) => ({
              cycle: Math.max(0, Math.round(toFiniteNumber(entry?.cycle, cycle))),
              year: Math.max(1, Math.round(toFiniteNumber(entry?.year, year))),
              population: clamp(toFiniteNumber(entry?.population, indicators.population), 0, 100),
              economy: clamp(toFiniteNumber(entry?.economy, indicators.economy), 0, 100),
              air: clamp(toFiniteNumber(entry?.air, indicators.air), 0, 100),
              water: clamp(toFiniteNumber(entry?.water, indicators.water), 0, 100),
              soil: clamp(toFiniteNumber(entry?.soil, indicators.soil), 0, 100),
              health: clamp(toFiniteNumber(entry?.health, indicators.health), 0, 100),
              carbon: clamp(toFiniteNumber(entry?.carbon, indicators.carbon), 0, 100)
            }))
        : [],
      logs: Array.isArray(rawState.logs)
        ? rawState.logs.slice(0, 40).map((entry) => ({
            cycle: Math.max(0, Math.round(toFiniteNumber(entry?.cycle, cycle))),
            year: Math.max(1, Math.round(toFiniteNumber(entry?.year, year))),
            message: entry?.message ? String(entry.message) : "",
            type: entry?.type ? String(entry.type) : "info",
            timestamp: Math.max(0, Math.round(toFiniteNumber(entry?.timestamp, Date.now())))
          }))
        : [],
      policyCooldowns: rawState.policyCooldowns || {},
      activePolicyEffects: Array.isArray(rawState.activePolicyEffects) ? rawState.activePolicyEffects : [],
      activeEvents: Array.isArray(rawState.activeEvents) ? rawState.activeEvents : [],
      eventCooldown: Math.max(0, Math.round(toFiniteNumber(rawState.eventCooldown, 0))),
      globalModifiers: Array.isArray(rawState.globalModifiers) ? rawState.globalModifiers : [],
      majorDecision: rawState.majorDecision || null,
      lastMajorDecisionCycle: Math.max(0, Math.round(toFiniteNumber(rawState.lastMajorDecisionCycle, 0))),
      finance: {
        debt: Math.max(0, toFiniteNumber(rawState.finance?.debt, 0)),
        lastInterestCharge: Math.max(0, toFiniteNumber(rawState.finance?.lastInterestCharge, 0)),
        lastDebtPayment: Math.max(0, toFiniteNumber(rawState.finance?.lastDebtPayment, 0)),
        lastRevenue: Math.max(0, toFiniteNumber(rawState.finance?.lastRevenue, 0)),
        annualRevenueEstimate: Math.max(1, toFiniteNumber(rawState.finance?.annualRevenueEstimate, 200)),
        annualRevenueWindow: Array.isArray(rawState.finance?.annualRevenueWindow)
          ? rawState.finance.annualRevenueWindow
              .map((value) => Math.max(0, toFiniteNumber(value, 0)))
              .slice(-this.data.timing.cyclesPerYear)
          : [],
        debtToRevenueRatio: Math.max(0, toFiniteNumber(rawState.finance?.debtToRevenueRatio, 0)),
        investorPenaltyActive: Boolean(rawState.finance?.investorPenaltyActive)
      },
      stakeholderDynamics: {
        highCitizenRecoveryCycles: Math.max(
          0,
          Math.round(toFiniteNumber(rawState.stakeholderDynamics?.highCitizenRecoveryCycles, 0))
        ),
        citizensWereHigh: Boolean(rawState.stakeholderDynamics?.citizensWereHigh)
      },
      tipping: {
        healthCap: clamp(toFiniteNumber(rawState.tipping?.healthCap, 100), 0, 100),
        soilCap: clamp(toFiniteNumber(rawState.tipping?.soilCap, 100), 0, 100),
        populationGrowthMultiplier: clamp(toFiniteNumber(rawState.tipping?.populationGrowthMultiplier, 1), 0.1, 1),
        streaks: {
          lowAir: Math.max(0, Math.round(toFiniteNumber(rawState.tipping?.streaks?.lowAir, 0))),
          lowWater: Math.max(0, Math.round(toFiniteNumber(rawState.tipping?.streaks?.lowWater, 0))),
          highCarbon: Math.max(0, Math.round(toFiniteNumber(rawState.tipping?.streaks?.highCarbon, 0)))
        }
      },
      projections: rawState.projections || {},
      stabilityCycles: Math.max(0, Math.round(toFiniteNumber(rawState.stabilityCycles, 0))),
      criticalStreaks: {
        air: Math.max(0, Math.round(toFiniteNumber(rawState.criticalStreaks?.air, 0))),
        water: Math.max(0, Math.round(toFiniteNumber(rawState.criticalStreaks?.water, 0))),
        soil: Math.max(0, Math.round(toFiniteNumber(rawState.criticalStreaks?.soil, 0))),
        health: Math.max(0, Math.round(toFiniteNumber(rawState.criticalStreaks?.health, 0))),
        carbonSafety: Math.max(0, Math.round(toFiniteNumber(rawState.criticalStreaks?.carbonSafety, 0)))
      },
      gameStatus: status,
      result: status === "ended" ? rawState.result || null : null,
      resultReason: status === "ended" ? rawState.resultReason || "" : "",
      scoreBreakdown: rawState.scoreBreakdown || null
    };

    return normalized;
  }

  loadGame() {
    const keys = [STORAGE_KEYS.save, STORAGE_KEYS.saveLegacy];

    for (const key of keys) {
      try {
        const raw = localStorage.getItem(key);
        if (!raw) {
          continue;
        }

        const parsed = JSON.parse(raw);
        if (!parsed?.state) {
          continue;
        }

        this.state = this.normalizeLoadedState(parsed.state);

        this.policySystem.ensureState(this.state);
        this.eventSystem.ensureState(this.state);

        this.rng = new DeterministicRng(this.state.seed || Date.now());
        this.rng.state = this.state.rngState || this.rng.seed;

        if (!this.state.history.length) {
          this.captureHistory();
        }
        this.computeProjections();

        if (this.state.gameStatus === "running") {
          this.startLoop();
          if (!this.state.majorDecision) {
            this.state.currentPolicies = this.policySystem.drawPolicies(this.state, this.rng);
          } else {
            this.state.currentPolicies = [];
          }
        } else {
          this.stopLoop();
          this.state.currentPolicies = [];
        }

        this.emitState();
        return { ok: true, message: key === STORAGE_KEYS.saveLegacy ? "Legacy save migrated." : "Saved game loaded." };
      } catch (error) {
        // Continue trying next key.
      }
    }

    return { ok: false, message: "No saved game found." };
  }
}
