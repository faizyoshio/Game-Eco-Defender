# Eco Defender

Eco Defender is a production-ready browser strategy simulation focused on sustainable city governance. It runs as a static web app with no backend dependencies and supports desktop, tablet, and mobile devices.

## Folder Structure

```text
Game-Eco-Defender/
  index.html
  styles.css
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
    render.js
    ui.js
```

## Core Simulation Model

All seven indicators are dynamic and clamped to a 0-100 scale:

- Population
- Economy
- Air Quality Index
- Water Quality Index
- Soil Quality Index
- Public Health Index
- Carbon Emission Level

### Threshold Bands

Environmental and health quality bands (WHO-inspired normalization for air/water):

- `75-100`: Safe
- `50-74`: Moderate
- `25-49`: Unhealthy
- `0-24`: Critical

Note: Carbon is an emission metric (higher is worse), so the simulation uses `carbon safety = 100 - carbon` for win/loss threshold checks.

## Timing Rules

- One simulation cycle: every `3 seconds`
- One in-game year: `12 cycles`
- Win: maintain `air, water, soil, health, carbon safety >= 50` for `10 years` (`120 cycles`)
- Loss: any monitored environmental/health metric in critical range for `3 consecutive cycles`

## Formula Summary

### Economy

Economic growth each cycle:

- Base growth + population contribution + soil agricultural boost
- Multiplied by productivity penalties from:
  - low public health
  - low water quality
  - low citizen satisfaction
  - low industry satisfaction

### Carbon Emissions

Carbon increase each cycle:

- `base + economy_multiplier + population_multiplier`
- Multiplied by difficulty and renewable upgrade coefficient
- Reduced by natural absorption from air + soil and renewable tier bonuses

### Environmental Decay

Air, water, and soil decay use:

- economy pressure
- population pressure
- carbon pressure
- difficulty decay multiplier
- permanent upgrade multipliers (waste treatment, air filtration)

### Public Health

Public health target:

- `((air + water) / 2) - disease_penalty`
- Disease penalty increases if air/water are below 50 and during disease events
- Health changes gradually toward target each cycle (recovery smoothing)

### Stakeholder Penalties

Three stakeholder scores (`0-100`):

- Citizens
- Industry
- Environmental NGO

Effects:

- Citizens `< 30`: productivity penalty
- Industry `< 30`: economic growth penalty
- NGO `< 30`: higher probability of environmental fines

### Technology Upgrades

Persistent tiers (L1-L3):

- Waste Treatment: lowers water decay and cleanup drag
- Renewable Energy: lowers carbon growth coefficient
- Air Filtration: lowers air decay coefficient

## Policy System

Each round presents **exactly three** policy cards from structured JSON data (`src/data.js`).

Each policy includes:

- title
- description
- cost (budget deduction)
- economy impact
- air impact
- water impact
- soil impact
- carbon impact
- stakeholder modifiers

## Event System

Random events trigger at controlled intervals with weighted probability (influenced by carbon, health, and stakeholder conditions):

- Floods
- Droughts
- Industrial accidents
- Public protests
- Environmental audits
- Disease outbreaks
- Positive events (grants, clean-tech breakthroughs)

Events can apply:

- instant indicator/budget/stakeholder effects
- temporary per-cycle effects for multiple cycles

## UI and Interaction

- Top bar: budget, year, population
- Center: HTML5 Canvas city visualization with environmental overlays
- Right panel: live line chart for all seven indicators + stakeholders/upgrades/events
- Bottom panel (desktop): policy cards
- Mobile: vertical stack + swipe/tap switching between charts and policy panels

## Offline, Save, and Leaderboard

- Service worker caches game assets (`sw.js`) for offline play
- Save state in `localStorage`
- Leaderboard stored in `localStorage` (top 10 runs by score)

## Performance Strategy

- Rendering loop uses `requestAnimationFrame` for smooth 60 FPS visuals
- Simulation loop uses fixed `setInterval` at 3 seconds (deterministic step updates)
- Chart canvas redraws only on cycle change or resize (not every frame)
- Memory control:
  - history capped to latest 180 points
  - logs capped to latest 40 entries
  - leaderboard capped to 10 entries
- No heavy external libraries

## Local Run

Use any static file server (recommended for service worker testing):

```bash
# example with Node
npx serve .
```

Open the local URL in a browser.

## Deployment Instructions

### GitHub Pages

1. Push repository to GitHub.
2. In repo settings, open **Pages**.
3. Set source to the main branch root (`/`).
4. Save and wait for deployment.

### Netlify

1. Create a new site from this repository.
2. Build command: *(leave empty)*
3. Publish directory: `.`
4. Deploy.

### Vercel

1. Import repository into Vercel.
2. Framework preset: `Other`.
3. Build command: *(leave empty)*
4. Output directory: `.`
5. Deploy.

This project is fully static and requires no server-side runtime.