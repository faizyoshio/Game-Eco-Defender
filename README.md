
# Eco Defender V2

Eco Defender V2 is a static, offline-capable environmental governance strategy game built with HTML, CSS, and vanilla JavaScript.

It preserves the modular architecture from V1 and extends the gameplay with fiscal risk, permanent tipping points, policy cooldown/ramp logic, global strategic decisions, and predictive warnings.

## Updated Folder Structure

```text
Game-Eco-Defender/
  index.html
  styles.css
  vercel.json
  sw.js
  manifest.webmanifest
  README.md
  assets/
    icons/
      icon-192.svg
      icon-512.svg
  src/
    main.js
    data.js
    simulation.js
    policy.js
    events.js
    render.js
    ui.js
```

## Core Indicators (0-100)

- Population
- Economy
- Air Quality
- Water Quality
- Soil Quality
- Public Health
- Carbon Emissions

Quality bands for environmental and health dimensions:

- `75-100`: Safe
- `50-74`: Moderate
- `25-49`: Unhealthy
- `0-24`: Critical

Carbon remains an emission metric (higher is worse). Threshold checks use `carbon safety = 100 - carbon`.

## Fixed Timing Model

- Simulation cycle: every `3 seconds`
- `12 cycles = 1 in-game year`
- Win: maintain air/water/soil/health/carbon-safety above 50 for 10 in-game years
- Loss: any monitored environmental/health metric remains critical for 3 consecutive cycles

## Version 2 Systems

### 1. Fiscal Stability and Debt

When budget goes below zero, debt is created automatically.

Per-cycle debt interest rates:

- Casual: `2%`
- Realistic: `3%`
- Crisis: `4%`

Debt interest impact:

- Interest increases debt each cycle
- Expected interest load reduces the economy productivity multiplier
- Debt ratio check: if `debt > 150% of annual revenue estimate`, investor confidence penalty activates:
  - economy growth multiplier reduced by `15%`
  - industry satisfaction reduced by `10`

Displayed in top bar:

- Debt
- Interest per cycle

### 2. Permanent Tipping Points

Persistent rules (saved in LocalStorage state):

- Air `< 15` for 3 cycles: Public Health max cap reduced by 10 permanently
- Carbon `> 85` for 5 cycles: Soil max cap reduced by 10 permanently
- Water `< 15` for 3 cycles: Population growth multiplier reduced by 20% permanently

### 3. Long-Term Policy Effects

Each policy now includes:

- `effectTiming.immediatePercent`
- `effectTiming.rampCycles`

Policies apply immediate partial impact, then ramp via queued timed effects over upcoming cycles until full impact is reached.

### 4. Policy Cooldowns

Each policy has `cooldownCycles`.
After selection, it cannot reappear until cooldown expires.
Cooldown state is handled in `src/policy.js`.

### 5. Enhanced Stakeholder Behavior

- Citizens `< 30`:
  - tax revenue reduced by 10%
  - protest event weighting boosted by 20%
- Citizens `> 80`:
  - temporary +2 recovery to Air and Water per cycle for 2 cycles (triggered on crossing high-trust state)
- Industry `< 30`:
  - economy growth multiplier reduced by 15%
- NGO `< 30`:
  - environmental fine event probability weighting increased by 25%

### 6. Strategic Global Decision Events

Every 5 in-game years, a Major Global Decision appears and pauses normal policy selection for that cycle.

Current event:

- International Climate Agreement
  - Commit:
    - carbon growth coefficient `-20%` for 5 years
    - economy growth `-10%` for 2 years
  - Reject:
    - no carbon restriction
    - NGO `-20`
    - Industry `+10`

Global decision processing is handled in `src/events.js`.

### 7. Early Warning Projection Panel

UI projection card predicts next 2 cycles (linear trend slope) for:

- Air
- Water
- Carbon
- Public Health

Critical warnings are shown when projected values cross critical boundaries.

### 8. Sustainability Index (New Scoring)

Final Score uses weighted components:

- `0.30` Environmental Average (air, water, soil)
- `0.25` Economic Stability
- `0.20` Public Health
- `0.15` Carbon Efficiency
- `0.10` Stakeholder Balance

Game-over modal shows full component breakdown and weights.

## Simulation Loop Integration (Per 3-second Tick)

Execution order in `src/simulation.js`:

1. Increment cycle and year counters
2. Apply queued policy ramp effects (`policy.js`)
3. Apply active random event per-cycle effects (`events.js`)
4. Run core deterministic simulation formulas
5. Apply stakeholder dynamic bonuses/penalties
6. Update debt, interest, annual revenue estimate, investor confidence penalties
7. Evaluate and apply tipping point permanents
8. Decay global modifiers from strategic decisions
9. Attempt random event trigger (`events.js`)
10. Trigger major decision event every 5 years when due (`events.js`)
11. Evaluate win/loss conditions
12. Capture history and compute projections
13. Draw next round policies (unless major decision is pending)
14. Emit UI snapshot

## Formula Notes

### Economic Growth

Economy growth per cycle is driven by:

- baseline growth
- population contribution
- soil-driven agricultural contribution

Then adjusted by multipliers:

- stakeholder penalties
- public health productivity
- water efficiency
- debt-interest pressure
- investor confidence penalty
- active global modifiers

### Debt and Interest

Per cycle:

- `interest = debt * interestRateByDifficulty`
- `debt += interest`
- if budget < 0, shortfall is transferred into debt and budget reset to 0
- if budget > 0 and debt exists, a configured share repays debt

Investor confidence trigger:

- `debtToRevenueRatio = debt / annualRevenueEstimate`
- if ratio > 1.5, investor penalty activates

### Public Health

- base target: `(air + water) / 2`
- disease penalty applied when air/water are weak and disease events are active
- smoothed recovery toward target
- hard-clamped by tipping-point health cap

### Projections

For each projected metric:

- slope = `(latest - earliest) / (window - 1)`
- next values = `latest + slope * step` for steps 1..2
- warnings fire if prediction reaches critical zone

## Offline and Deployment

- Fully static app (no backend)
- Service worker caches all core assets for offline gameplay
- LocalStorage used for saves and leaderboard

### Deploy (Static Hosting)

#### GitHub Pages

1. Push repository
2. Open repo Settings -> Pages
3. Select main branch root (`/`)
4. Save and wait for deployment

#### Netlify

1. Import repository
2. Build command: leave empty
3. Publish directory: `.`
4. Deploy

#### Vercel

1. Import repository
2. Framework preset: `Other`
3. Build command: leave empty
4. Output directory: `.`
5. Deploy

If you previously saw `500: INTERNAL_SERVER_ERROR` with `FUNCTION_INVOCATION_FAILED`, redeploy after pulling `vercel.json` and verify:

1. Project Root Directory points to this repo root
2. No custom serverless function route is configured
3. Build Command is empty
4. Output Directory is `.`

## Migration Instructions (V1 -> V2)

### Save Data

- V2 uses new keys:
  - `eco-defender-save-v2`
  - `eco-defender-leaderboard-v2`
- Legacy keys are read as fallback and auto-normalized on load when possible.

### Code Migration Summary

1. Added new modules:
   - `src/policy.js`
   - `src/events.js`
2. Refactored `src/simulation.js` to delegate policy/event-specific behavior and integrate V2 mechanics.
3. Updated `src/data.js` with structured balancing config for all new parameters.
4. Updated UI (`index.html`, `styles.css`, `src/ui.js`) for debt/interest, projections, major decisions, and game-over breakdown.
5. Updated `sw.js` cache list for new modules.

### Recommended Upgrade Path

1. Pull latest code
2. Run via static server (example: `npx serve .`)
3. Start a fresh V2 save for best balance consistency
4. Optionally load a V1 save and validate migrated state

## Performance Notes

- Rendering remains on `requestAnimationFrame` for 60 FPS visuals
- Simulation remains deterministic at fixed 3-second ticks
- Chart redraws only on cycle update or resize
- History/log arrays are capped to avoid unbounded memory growth
- No heavy external libraries
