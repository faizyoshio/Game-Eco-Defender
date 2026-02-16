export const GAME_DATA = {
  version: "2.0.0",
  timing: {
    cycleMs: 3000,
    cyclesPerYear: 12,
    targetYearsToWin: 10,
    criticalCyclesToLose: 3
  },
  thresholds: {
    bands: [
      { key: "safe", min: 75, max: 100, label: "Safe" },
      { key: "moderate", min: 50, max: 74, label: "Moderate" },
      { key: "unhealthy", min: 25, max: 49, label: "Unhealthy" },
      { key: "critical", min: 0, max: 24, label: "Critical" }
    ],
    targetFloor: 50,
    criticalFloor: 25,
    // WHO-inspired reference points mapped to game scale.
    whoInspired: {
      air: {
        safePm25Upper: 15,
        moderatePm25Upper: 35,
        unhealthyPm25Upper: 55,
        criticalPm25Above: 55
      },
      water: {
        safeContaminationPercent: 10,
        moderateContaminationPercent: 25,
        unhealthyContaminationPercent: 45,
        criticalContaminationPercent: 45
      }
    }
  },
  systems: {
    fiscal: {
      interestRates: {
        casual: 0.02,
        realistic: 0.03,
        crisis: 0.04
      },
      debtToAnnualRevenuePenaltyThreshold: 1.5,
      investorEconomyPenalty: 0.15,
      investorIndustryHit: 10,
      debtInterestPenaltyScale: 0.38,
      debtInterestPenaltyCap: 0.35,
      debtRepaymentShare: 0.18
    },
    tippingPoints: {
      air: {
        threshold: 15,
        cycles: 3,
        healthCapDrop: 10,
        minHealthCap: 50
      },
      carbon: {
        threshold: 85,
        cycles: 5,
        soilCapDrop: 10,
        minSoilCap: 45
      },
      water: {
        threshold: 15,
        cycles: 3,
        populationGrowthMultiplierDrop: 0.2,
        minPopulationGrowthMultiplier: 0.35
      }
    },
    stakeholderDynamics: {
      citizensLowThreshold: 30,
      citizensLowRevenuePenalty: 0.1,
      citizensLowProtestBoost: 0.2,
      citizensHighThreshold: 80,
      citizensHighRecovery: {
        air: 2,
        water: 2,
        durationCycles: 2
      },
      industryLowThreshold: 30,
      industryLowEconomyPenalty: 0.15,
      ngoLowThreshold: 30,
      ngoFineProbabilityBoost: 0.25
    },
    projections: {
      windowCycles: 6,
      horizonCycles: 2
    },
    scoring: {
      weights: {
        environmentalAverage: 0.3,
        economicStability: 0.25,
        publicHealth: 0.2,
        carbonEfficiency: 0.15,
        stakeholderBalance: 0.1
      }
    }
  },
  difficulty: {
    casual: {
      label: "Casual",
      initialBudget: 260,
      initialIndicators: {
        population: 52,
        economy: 56,
        air: 74,
        water: 72,
        soil: 70,
        health: 74,
        carbon: 30
      },
      decayMultiplier: 0.82,
      carbonGrowthMultiplier: 0.8,
      revenueMultiplier: 1.15,
      eventBaseChance: 0.14,
      eventCooldownCycles: 2
    },
    realistic: {
      label: "Realistic",
      initialBudget: 220,
      initialIndicators: {
        population: 50,
        economy: 54,
        air: 70,
        water: 67,
        soil: 64,
        health: 68,
        carbon: 36
      },
      decayMultiplier: 1,
      carbonGrowthMultiplier: 1,
      revenueMultiplier: 1,
      eventBaseChance: 0.18,
      eventCooldownCycles: 2
    },
    crisis: {
      label: "Crisis",
      initialBudget: 180,
      initialIndicators: {
        population: 49,
        economy: 50,
        air: 63,
        water: 60,
        soil: 58,
        health: 60,
        carbon: 46
      },
      decayMultiplier: 1.28,
      carbonGrowthMultiplier: 1.24,
      revenueMultiplier: 0.9,
      eventBaseChance: 0.24,
      eventCooldownCycles: 1
    }
  },
  indicators: [
    { key: "population", label: "Population", color: "#1f6f94", inverted: false },
    { key: "economy", label: "Economy", color: "#3a8a3e", inverted: false },
    { key: "air", label: "Air", color: "#5e84cc", inverted: false },
    { key: "water", label: "Water", color: "#2f9fb5", inverted: false },
    { key: "soil", label: "Soil", color: "#92733b", inverted: false },
    { key: "health", label: "Health", color: "#cb5d2a", inverted: false },
    { key: "carbon", label: "Carbon", color: "#a23f3f", inverted: true }
  ],
  stakeholders: [
    { key: "citizens", label: "Citizens" },
    { key: "industry", label: "Industry" },
    { key: "ngo", label: "Environmental NGO" }
  ],
  policyDefaults: {
    effectTiming: {
      immediatePercent: 0.3,
      rampCycles: 3
    },
    cooldownCycles: 3
  },
  upgrades: {
    wasteTreatment: [
      { level: 0, waterDecayMultiplier: 1, economyDrainMultiplier: 1 },
      { level: 1, waterDecayMultiplier: 0.9, economyDrainMultiplier: 0.97 },
      { level: 2, waterDecayMultiplier: 0.78, economyDrainMultiplier: 0.93 },
      { level: 3, waterDecayMultiplier: 0.64, economyDrainMultiplier: 0.88 }
    ],
    renewableEnergy: [
      { level: 0, carbonGrowthMultiplier: 1 },
      { level: 1, carbonGrowthMultiplier: 0.88 },
      { level: 2, carbonGrowthMultiplier: 0.72 },
      { level: 3, carbonGrowthMultiplier: 0.58 }
    ],
    airFiltration: [
      { level: 0, airDecayMultiplier: 1 },
      { level: 1, airDecayMultiplier: 0.9 },
      { level: 2, airDecayMultiplier: 0.78 },
      { level: 3, airDecayMultiplier: 0.66 }
    ]
  },
  policies: [
    {
      id: "industrial_zone",
      title: "Build Industrial Zone",
      description: "Expand manufacturing output and tax base, but increase emissions and pollution load.",
      cost: 38,
      impacts: { economy: 9, air: -7, water: -4, soil: -5, carbon: 8 },
      stakeholders: { citizens: -4, industry: 10, ngo: -8 },
      effectTiming: { immediatePercent: 0.5, rampCycles: 2 },
      cooldownCycles: 4
    },
    {
      id: "waste_l1",
      title: "Wastewater Treatment L1",
      description: "Install baseline treatment infrastructure for major discharge points.",
      cost: 26,
      impacts: { economy: 2, air: 0, water: 6, soil: 2, carbon: -1 },
      stakeholders: { citizens: 4, industry: -1, ngo: 6 },
      upgrade: { track: "wasteTreatment", level: 1 },
      effectTiming: { immediatePercent: 0.35, rampCycles: 3 },
      cooldownCycles: 3
    },
    {
      id: "waste_l2",
      title: "Wastewater Treatment L2",
      description: "Upgrade treatment plants with nutrient and toxic-metal filtration.",
      cost: 34,
      impacts: { economy: 1, air: 0, water: 8, soil: 2, carbon: -1 },
      stakeholders: { citizens: 4, industry: -2, ngo: 7 },
      upgrade: { track: "wasteTreatment", level: 2 },
      requires: { wasteTreatment: 1 },
      effectTiming: { immediatePercent: 0.3, rampCycles: 3 },
      cooldownCycles: 4
    },
    {
      id: "waste_l3",
      title: "Wastewater Treatment L3",
      description: "Deploy advanced membrane treatment and watershed monitoring.",
      cost: 44,
      impacts: { economy: 1, air: 0, water: 10, soil: 3, carbon: -2 },
      stakeholders: { citizens: 5, industry: -3, ngo: 8 },
      upgrade: { track: "wasteTreatment", level: 3 },
      requires: { wasteTreatment: 2 },
      effectTiming: { immediatePercent: 0.25, rampCycles: 4 },
      cooldownCycles: 5
    },
    {
      id: "renew_l1",
      title: "Renewable Energy L1",
      description: "Subsidize municipal solar and wind adoption.",
      cost: 30,
      impacts: { economy: 3, air: 5, water: 1, soil: 1, carbon: -7 },
      stakeholders: { citizens: 4, industry: -1, ngo: 7 },
      upgrade: { track: "renewableEnergy", level: 1 },
      effectTiming: { immediatePercent: 0.3, rampCycles: 3 },
      cooldownCycles: 3
    },
    {
      id: "renew_l2",
      title: "Renewable Energy L2",
      description: "Scale renewable grids and battery storage capacity.",
      cost: 39,
      impacts: { economy: 2, air: 6, water: 1, soil: 1, carbon: -9 },
      stakeholders: { citizens: 4, industry: -2, ngo: 7 },
      upgrade: { track: "renewableEnergy", level: 2 },
      requires: { renewableEnergy: 1 },
      effectTiming: { immediatePercent: 0.3, rampCycles: 3 },
      cooldownCycles: 4
    },
    {
      id: "renew_l3",
      title: "Renewable Energy L3",
      description: "Retire fossil baseload with high-efficiency renewables and smart balancing.",
      cost: 50,
      impacts: { economy: 1, air: 8, water: 2, soil: 1, carbon: -12 },
      stakeholders: { citizens: 5, industry: -3, ngo: 9 },
      upgrade: { track: "renewableEnergy", level: 3 },
      requires: { renewableEnergy: 2 },
      effectTiming: { immediatePercent: 0.25, rampCycles: 4 },
      cooldownCycles: 5
    },
    {
      id: "air_l1",
      title: "Air Filtration L1",
      description: "Install particulate scrubbers on heavy emitters.",
      cost: 24,
      impacts: { economy: 2, air: 5, water: 0, soil: 1, carbon: -1 },
      stakeholders: { citizens: 3, industry: -1, ngo: 5 },
      upgrade: { track: "airFiltration", level: 1 },
      effectTiming: { immediatePercent: 0.35, rampCycles: 3 },
      cooldownCycles: 3
    },
    {
      id: "air_l2",
      title: "Air Filtration L2",
      description: "Expand filtration to district heating and transport hubs.",
      cost: 32,
      impacts: { economy: 2, air: 7, water: 0, soil: 1, carbon: -1 },
      stakeholders: { citizens: 4, industry: -2, ngo: 6 },
      upgrade: { track: "airFiltration", level: 2 },
      requires: { airFiltration: 1 },
      effectTiming: { immediatePercent: 0.3, rampCycles: 3 },
      cooldownCycles: 4
    },
    {
      id: "air_l3",
      title: "Air Filtration L3",
      description: "Adopt citywide AI-controlled filtration and stack monitoring.",
      cost: 41,
      impacts: { economy: 1, air: 9, water: 0, soil: 1, carbon: -2 },
      stakeholders: { citizens: 5, industry: -3, ngo: 8 },
      upgrade: { track: "airFiltration", level: 3 },
      requires: { airFiltration: 2 },
      effectTiming: { immediatePercent: 0.25, rampCycles: 4 },
      cooldownCycles: 5
    },
    {
      id: "carbon_tax",
      title: "Enforce Carbon Tax",
      description: "Price emissions to push industry toward cleaner production pathways.",
      cost: 8,
      impacts: { economy: -3, air: 4, water: 1, soil: 1, carbon: -6 },
      stakeholders: { citizens: 1, industry: -8, ngo: 7 },
      effectTiming: { immediatePercent: 0.45, rampCycles: 3 },
      cooldownCycles: 3
    },
    {
      id: "reforestation",
      title: "Reforestation Program",
      description: "Replant peri-urban forests to absorb carbon and stabilize soil.",
      cost: 22,
      impacts: { economy: 1, air: 4, water: 2, soil: 6, carbon: -4 },
      stakeholders: { citizens: 3, industry: -2, ngo: 8 },
      effectTiming: { immediatePercent: 0.3, rampCycles: 3 },
      cooldownCycles: 3
    },
    {
      id: "green_transit",
      title: "Electric Transit Expansion",
      description: "Scale electric buses and rail links to reduce transport emissions.",
      cost: 28,
      impacts: { economy: 3, air: 5, water: 1, soil: 1, carbon: -5 },
      stakeholders: { citizens: 5, industry: 1, ngo: 5 },
      effectTiming: { immediatePercent: 0.35, rampCycles: 3 },
      cooldownCycles: 3
    },
    {
      id: "mining_project",
      title: "Approve Mining Project",
      description: "Short-term growth from extraction with high ecological externalities.",
      cost: 10,
      impacts: { economy: 8, air: -4, water: -8, soil: -10, carbon: 7 },
      stakeholders: { citizens: -5, industry: 9, ngo: -10 },
      effectTiming: { immediatePercent: 0.55, rampCycles: 2 },
      cooldownCycles: 5
    },
    {
      id: "agri_regeneration",
      title: "Regenerative Agriculture Incentives",
      description: "Support crop rotation and low-chemical farming to restore soil and water.",
      cost: 20,
      impacts: { economy: 2, air: 1, water: 3, soil: 7, carbon: -3 },
      stakeholders: { citizens: 3, industry: -1, ngo: 6 },
      effectTiming: { immediatePercent: 0.3, rampCycles: 3 },
      cooldownCycles: 3
    },
    {
      id: "wetlands",
      title: "Wetland Restoration",
      description: "Restore floodplains for natural filtration and climate resilience.",
      cost: 27,
      impacts: { economy: 1, air: 1, water: 7, soil: 4, carbon: -2 },
      stakeholders: { citizens: 4, industry: -2, ngo: 7 },
      effectTiming: { immediatePercent: 0.3, rampCycles: 3 },
      cooldownCycles: 4
    }
  ],
  eventsConfig: {
    triggerEveryCycles: 2
  },
  events: [
    {
      id: "flood",
      title: "Major Flood",
      description: "River overflow damages transport links and soil structure.",
      tags: ["climate"],
      weight: 1.1,
      duration: 2,
      instant: { economy: -5, water: -6, soil: -4, health: -3, carbon: 1 },
      perCycle: { economy: -2, water: -2, soil: -2, health: -1 },
      stakeholders: { citizens: -4, industry: -2, ngo: 1 },
      budgetDelta: -14
    },
    {
      id: "drought",
      title: "Extended Drought",
      description: "Reservoir stress lowers water quality and agricultural output.",
      tags: ["climate"],
      weight: 1.05,
      duration: 3,
      instant: { water: -8, soil: -5, economy: -3, health: -2, carbon: 2 },
      perCycle: { water: -2, soil: -1, economy: -1, health: -1 },
      stakeholders: { citizens: -3, industry: -1, ngo: 1 },
      budgetDelta: -9
    },
    {
      id: "industrial_accident",
      title: "Industrial Accident",
      description: "Toxic release harms air and water while triggering cleanup costs.",
      tags: ["industrial"],
      weight: 0.95,
      duration: 2,
      instant: { air: -10, water: -7, health: -5, carbon: 4, economy: -2 },
      perCycle: { air: -2, water: -1, health: -1 },
      stakeholders: { citizens: -6, industry: -3, ngo: 2 },
      budgetDelta: -16
    },
    {
      id: "public_protest",
      title: "Public Protest Wave",
      description: "Citizen mobilization slows projects and demands cleaner governance.",
      tags: ["social"],
      weight: 1,
      duration: 2,
      instant: { economy: -4, health: -1 },
      perCycle: { economy: -1 },
      stakeholders: { citizens: -2, industry: -4, ngo: 3 },
      budgetDelta: -5
    },
    {
      id: "environmental_audit",
      title: "National Environmental Audit",
      description: "Audit imposes compliance costs but raises long-term trust.",
      tags: ["policy"],
      weight: 0.9,
      duration: 1,
      instant: { economy: -3, air: 2, water: 2, soil: 1, carbon: -2 },
      perCycle: {},
      stakeholders: { citizens: 2, industry: -3, ngo: 4 },
      budgetDelta: -7
    },
    {
      id: "disease_outbreak",
      title: "Waterborne Disease Outbreak",
      description: "Health emergency reduces labor productivity and strains services.",
      tags: ["health"],
      weight: 0.95,
      duration: 3,
      instant: { health: -8, economy: -4, water: -2 },
      perCycle: { health: -2, economy: -1 },
      stakeholders: { citizens: -5, industry: -2, ngo: 1 },
      budgetDelta: -12,
      diseaseModifier: 5
    },
    {
      id: "environmental_fine",
      title: "Environmental Fine",
      description: "Regulators issue a compliance fine over pollution breaches.",
      tags: ["fines", "policy"],
      weight: 0.6,
      duration: 1,
      instant: { economy: -2 },
      perCycle: {},
      stakeholders: { citizens: -1, industry: -2, ngo: 2 },
      budgetDelta: -10
    },
    {
      id: "green_grant",
      title: "International Green Grant",
      description: "External funding supports clean infrastructure modernization.",
      tags: ["positive"],
      weight: 0.72,
      duration: 2,
      instant: { economy: 3, air: 2, water: 2, soil: 2, carbon: -3, health: 2 },
      perCycle: { economy: 1, air: 1, water: 1 },
      stakeholders: { citizens: 3, industry: 1, ngo: 2 },
      budgetDelta: 16
    },
    {
      id: "clean_tech_breakthrough",
      title: "Clean Tech Breakthrough",
      description: "Local innovators deploy lower-emission production methods.",
      tags: ["positive", "industrial"],
      weight: 0.78,
      duration: 2,
      instant: { economy: 4, carbon: -5, air: 2 },
      perCycle: { economy: 1, carbon: -1, air: 1 },
      stakeholders: { citizens: 2, industry: 3, ngo: 2 },
      budgetDelta: 8
    }
  ],
  globalDecisions: {
    intervalYears: 5,
    decisions: [
      {
        id: "international_climate_agreement",
        title: "International Climate Agreement",
        description: "Neighboring regions request a binding commitment to emission cuts.",
        options: [
          {
            id: "commit",
            title: "Commit",
            description: "Adopt binding climate targets and transition plans.",
            stakeholders: { citizens: 4, industry: -4, ngo: 10 },
            globalModifiers: [
              {
                type: "carbonGrowthMultiplier",
                multiplier: 0.8,
                durationCycles: 60,
                label: "Carbon growth -20% for 5 years"
              },
              {
                type: "economyGrowthMultiplier",
                multiplier: 0.9,
                durationCycles: 24,
                label: "Economy growth -10% for 2 years"
              }
            ]
          },
          {
            id: "reject",
            title: "Reject",
            description: "Prioritize unrestricted domestic industry growth.",
            stakeholders: { citizens: -2, industry: 10, ngo: -20 },
            globalModifiers: []
          }
        ]
      }
    ]
  }
};

export const STORAGE_KEYS = {
  save: "eco-defender-save-v2",
  saveLegacy: "eco-defender-save-v1",
  leaderboard: "eco-defender-leaderboard-v2",
  leaderboardLegacy: "eco-defender-leaderboard-v1"
};

export const UPGRADE_LABELS = {
  wasteTreatment: "Waste Treatment",
  renewableEnergy: "Renewable Energy",
  airFiltration: "Air Filtration"
};