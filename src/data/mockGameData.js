const INDICATOR_COLORS = {
  population: "#53b5ff",
  economy: "#4ade80",
  air: "#8da8ff",
  water: "#4cc9f0",
  soil: "#f59e0b",
  health: "#fb7185",
  carbon: "#f87171"
};

export const mockGameData = {
  meta: {
    title: "Eco Defender",
    subtitle: "Environmental Governance Simulator"
  },
  modeOptions: ["Casual", "Realistic", "Crisis"],
  status: {
    budgetM: 220,
    year: 3,
    population: 1142800,
    debtM: 48,
    interestPerCycleM: 1.4,
    mode: "Realistic"
  },
  roundInfo: {
    cycleInYear: 4,
    cyclesPerYear: 12,
    stabilityCycles: 16,
    targetStabilityCycles: 120,
    eventBanner: "Event pressure rising: drought likelihood increased."
  },
  cityScene: {
    title: "City Scene",
    subtitle: "Visual placeholder. Plug your live renderer/canvas here."
  },
  indicators: [
    { key: "population", label: "Population", value: 58.3, state: "moderate", color: INDICATOR_COLORS.population },
    { key: "economy", label: "Economy", value: 61.9, state: "moderate", color: INDICATOR_COLORS.economy },
    { key: "air", label: "Air", value: 69.4, state: "moderate", color: INDICATOR_COLORS.air },
    { key: "water", label: "Water", value: 65.8, state: "moderate", color: INDICATOR_COLORS.water },
    { key: "soil", label: "Soil", value: 58.7, state: "moderate", color: INDICATOR_COLORS.soil },
    { key: "health", label: "Health", value: 63.2, state: "moderate", color: INDICATOR_COLORS.health },
    { key: "carbon", label: "Carbon", value: 41.5, state: "moderate", color: INDICATOR_COLORS.carbon }
  ],
  trendSeries: [
    { cycle: "C1", population: 52, economy: 54, air: 70, water: 67, soil: 63, health: 66, carbon: 39 },
    { cycle: "C2", population: 53, economy: 55, air: 69, water: 66, soil: 62, health: 65, carbon: 40 },
    { cycle: "C3", population: 54, economy: 57, air: 69, water: 66, soil: 61, health: 65, carbon: 40 },
    { cycle: "C4", population: 55, economy: 58, air: 68, water: 65, soil: 60, health: 64, carbon: 41 },
    { cycle: "C5", population: 56, economy: 60, air: 67, water: 65, soil: 60, health: 63, carbon: 41 },
    { cycle: "C6", population: 57, economy: 61, air: 67, water: 65, soil: 59, health: 63, carbon: 42 },
    { cycle: "C7", population: 58, economy: 62, air: 66, water: 64, soil: 59, health: 62, carbon: 42 },
    { cycle: "C8", population: 58, economy: 62, air: 66, water: 64, soil: 59, health: 62, carbon: 42 }
  ],
  projections: [
    { key: "air", label: "Air", values: [67.2, 65.9], warning: false },
    { key: "water", label: "Water", values: [64.6, 63.8], warning: false },
    { key: "carbon", label: "Carbon", values: [42.9, 44.1], warning: true },
    { key: "health", label: "Health", values: [62.4, 61.3], warning: false }
  ],
  stakeholders: [
    { id: "citizens", label: "Citizens", value: 63, delta: 1.2 },
    { id: "industry", label: "Industry", value: 56, delta: -0.8 },
    { id: "ngo", label: "Environmental NGO", value: 69, delta: 0.5 }
  ],
  upgrades: [
    { id: "wasteTreatment", label: "Waste Treatment", level: 2, maxLevel: 3, progress: 66, delta: 1 },
    { id: "renewableEnergy", label: "Renewable Energy", level: 1, maxLevel: 3, progress: 38, delta: 0 },
    { id: "airFiltration", label: "Air Filtration", level: 2, maxLevel: 3, progress: 71, delta: 1 }
  ],
  eventLog: [
    { id: "e1", year: 3, cycle: 2, message: "Green grant unlocked for wastewater optimization." },
    { id: "e2", year: 3, cycle: 3, message: "Heatwave pressure reduced agricultural productivity." },
    { id: "e3", year: 3, cycle: 4, message: "Policy ramp: Electric Transit Expansion now 65%." },
    { id: "e4", year: 3, cycle: 4, message: "Investor confidence warning triggered at debt ratio threshold." }
  ],
  leaderboard: [
    { id: "l1", result: "WIN", difficulty: "Realistic", year: 10, score: 86.2, date: "2026-02-20" },
    { id: "l2", result: "WIN", difficulty: "Casual", year: 10, score: 82.8, date: "2026-02-18" },
    { id: "l3", result: "LOSS", difficulty: "Crisis", year: 6, score: 61.1, date: "2026-02-17" }
  ],
  policies: [
    {
      id: "industrial_zone",
      title: "Build Industrial Zone",
      summary: "Expand output and tax base while adding pollution pressure.",
      description:
        "Adds immediate fiscal upside and long-term output capacity, but increases air/water degradation and emissions if not balanced with mitigation upgrades.",
      costM: 38,
      rampCycles: 2,
      cooldownCycles: 4,
      cooldownRemaining: 0,
      impacts: [
        { label: "Economy", value: 9, direction: "negative-tradeoff" },
        { label: "Air", value: -7, direction: "negative" },
        { label: "Water", value: -4, direction: "negative" },
        { label: "Soil", value: -5, direction: "negative" },
        { label: "Carbon", value: 8, direction: "negative" }
      ],
      projectedDeltas: [
        { label: "Budget", value: "+$12M over 2 cycles", tone: "neutral" },
        { label: "Carbon", value: "+3.2 in 2 cycles", tone: "negative" }
      ]
    },
    {
      id: "carbon_tax",
      title: "Enforce Carbon Tax",
      summary: "Price emissions to shift behavior and cut carbon growth.",
      description:
        "Introduces progressive levy on high-emission output. Near-term industrial resistance is expected, but medium-term emissions and air trends typically improve.",
      costM: 8,
      rampCycles: 3,
      cooldownCycles: 3,
      cooldownRemaining: 1,
      impacts: [
        { label: "Economy", value: -3, direction: "negative" },
        { label: "Air", value: 4, direction: "positive" },
        { label: "Water", value: 1, direction: "positive" },
        { label: "Carbon", value: -6, direction: "positive" }
      ],
      projectedDeltas: [
        { label: "Industry sentiment", value: "-8", tone: "negative" },
        { label: "Carbon trend", value: "-1.5 / cycle", tone: "positive" }
      ]
    },
    {
      id: "reforestation",
      title: "Reforestation Program",
      summary: "Restore forest buffer zones for carbon absorption and soil recovery.",
      description:
        "Funds phased tree restoration in peri-urban districts. Yields moderate climate gains and stronger land stability, especially in long simulations.",
      costM: 22,
      rampCycles: 3,
      cooldownCycles: 3,
      cooldownRemaining: 0,
      impacts: [
        { label: "Economy", value: 1, direction: "positive" },
        { label: "Air", value: 4, direction: "positive" },
        { label: "Water", value: 2, direction: "positive" },
        { label: "Soil", value: 6, direction: "positive" },
        { label: "Carbon", value: -4, direction: "positive" }
      ],
      projectedDeltas: [
        { label: "Soil resilience", value: "+4.0 in 2 cycles", tone: "positive" },
        { label: "Budget", value: "-$22M immediate", tone: "warning" }
      ]
    },
    {
      id: "green_transit",
      title: "Electric Transit Expansion",
      summary: "Scale electric fleet and rail links to reduce transport emissions.",
      description:
        "Invests in electric buses and smart route management. Improves air and carbon trajectory while supporting long-term productivity through mobility gains.",
      costM: 28,
      rampCycles: 3,
      cooldownCycles: 3,
      cooldownRemaining: 0,
      impacts: [
        { label: "Economy", value: 3, direction: "positive" },
        { label: "Air", value: 5, direction: "positive" },
        { label: "Water", value: 1, direction: "positive" },
        { label: "Carbon", value: -5, direction: "positive" }
      ],
      projectedDeltas: [
        { label: "Population trust", value: "+5", tone: "positive" },
        { label: "Net budget", value: "-$28M now", tone: "warning" }
      ]
    },
    {
      id: "wetlands",
      title: "Wetland Restoration",
      summary: "Rebuild floodplains for natural filtration and climate resilience.",
      description:
        "Restores critical wetland systems to reduce flood risk and improve water quality buffering. Impact is gradual but steady with high long-term value.",
      costM: 27,
      rampCycles: 3,
      cooldownCycles: 4,
      cooldownRemaining: 0,
      impacts: [
        { label: "Economy", value: 1, direction: "positive" },
        { label: "Water", value: 7, direction: "positive" },
        { label: "Soil", value: 4, direction: "positive" },
        { label: "Carbon", value: -2, direction: "positive" }
      ],
      projectedDeltas: [
        { label: "Flood damage risk", value: "-12%", tone: "positive" },
        { label: "Maintenance load", value: "+$1.4M / year", tone: "neutral" }
      ]
    },
    {
      id: "agri_regeneration",
      title: "Regenerative Agriculture Incentives",
      summary: "Improve soil and water outcomes via low-chemical farming.",
      description:
        "Provides targeted subsidies for soil-restoring techniques and nutrient runoff reduction. Balanced option for medium budget windows.",
      costM: 20,
      rampCycles: 3,
      cooldownCycles: 3,
      cooldownRemaining: 0,
      impacts: [
        { label: "Economy", value: 2, direction: "positive" },
        { label: "Water", value: 3, direction: "positive" },
        { label: "Soil", value: 7, direction: "positive" },
        { label: "Carbon", value: -3, direction: "positive" }
      ],
      projectedDeltas: [
        { label: "Food security", value: "+2.1", tone: "positive" },
        { label: "NGO trust", value: "+6", tone: "positive" }
      ]
    }
  ]
};

// Use this factory in components until real game logic/store is connected.
export const createInitialGameState = () => JSON.parse(JSON.stringify(mockGameData));
