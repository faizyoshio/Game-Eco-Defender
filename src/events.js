const clamp = (value, min, max) => Math.max(min, Math.min(max, value));

export class EventSystem {
  constructor(gameData) {
    this.data = gameData;
  }

  ensureState(state) {
    state.activeEvents = state.activeEvents || [];
    state.globalModifiers = state.globalModifiers || [];
    state.majorDecision = state.majorDecision || null;
    state.eventCooldown = state.eventCooldown || 0;
    state.lastMajorDecisionCycle = state.lastMajorDecisionCycle || 0;
  }

  processActiveEvents(state, applyDeltaSet, applyStakeholderDelta, pushLog) {
    if (!state.activeEvents.length) {
      return 0;
    }

    let diseaseModifier = 0;
    const retained = [];

    for (const activeEvent of state.activeEvents) {
      applyDeltaSet(activeEvent.perCycle || {});

      if (activeEvent.diseaseModifier) {
        diseaseModifier += activeEvent.diseaseModifier;
      }

      activeEvent.remaining -= 1;
      if (activeEvent.remaining > 0) {
        retained.push(activeEvent);
      } else {
        pushLog(`${activeEvent.title} has ended.`, "system");
      }
    }

    state.activeEvents = retained;
    return diseaseModifier;
  }

  decayGlobalModifiers(state) {
    if (!state.globalModifiers.length) {
      return;
    }

    state.globalModifiers = state.globalModifiers
      .map((modifier) => ({
        ...modifier,
        remaining: modifier.remaining - 1
      }))
      .filter((modifier) => modifier.remaining > 0);
  }

  getGlobalMultiplier(state, modifierType) {
    if (!state.globalModifiers?.length) {
      return 1;
    }

    return state.globalModifiers.reduce((product, modifier) => {
      if (modifier.type !== modifierType) {
        return product;
      }
      return product * modifier.multiplier;
    }, 1);
  }

  isMajorDecisionDue(state) {
    const intervalCycles = this.data.globalDecisions.intervalYears * this.data.timing.cyclesPerYear;
    if (state.cycle === 0 || intervalCycles <= 0) {
      return false;
    }

    if (state.majorDecision) {
      return false;
    }

    if (state.cycle % intervalCycles !== 0) {
      return false;
    }

    if (state.lastMajorDecisionCycle === state.cycle) {
      return false;
    }

    return true;
  }

  queueMajorDecision(state, rng, pushLog, emitBanner) {
    const pool = this.data.globalDecisions.decisions || [];
    if (!pool.length) {
      return;
    }

    const selected = pool[Math.floor(rng.next() * pool.length)];
    state.majorDecision = {
      id: selected.id,
      title: selected.title,
      description: selected.description,
      options: selected.options.map((option) => ({ ...option })),
      issuedCycle: state.cycle
    };
    state.lastMajorDecisionCycle = state.cycle;

    pushLog(`Major Decision: ${selected.title}`, "event");
    emitBanner(`${selected.title}: select a strategic global response.`);
  }

  resolveMajorDecisionOption(state, optionId, applyDeltaSet, applyStakeholderDelta, pushLog, emitBanner) {
    if (!state.majorDecision) {
      return { ok: false, message: "No major decision pending." };
    }

    const option = state.majorDecision.options.find((item) => item.id === optionId);
    if (!option) {
      return { ok: false, message: "Decision option unavailable." };
    }

    applyDeltaSet(option.indicators || {});
    applyStakeholderDelta(option.stakeholders || {});

    if (option.budgetDelta) {
      state.budget = clamp(state.budget + option.budgetDelta, -9999, 9999);
    }

    (option.globalModifiers || []).forEach((modifier) => {
      state.globalModifiers.push({
        type: modifier.type,
        multiplier: modifier.multiplier,
        remaining: modifier.durationCycles,
        label: modifier.label || modifier.type
      });
    });

    const title = state.majorDecision.title;
    state.majorDecision = null;

    pushLog(`Major decision chosen: ${title} - ${option.title}`, "policy");
    emitBanner(`Major decision outcome: ${option.title}`);

    return { ok: true, message: `${option.title} selected.` };
  }

  maybeTriggerRandomEvent(state, rng, context, applyEvent) {
    if (state.majorDecision) {
      return;
    }

    if (state.eventCooldown > 0) {
      state.eventCooldown -= 1;
      return;
    }

    if (state.cycle % this.data.eventsConfig.triggerEveryCycles !== 0) {
      return;
    }

    const diffCfg = this.data.difficulty[state.difficulty];

    let chance = diffCfg.eventBaseChance + state.indicators.carbon / 550;
    if (context.citizensLow) {
      chance += 0.03;
    }

    if (rng.next() > chance) {
      return;
    }

    const selected = this.selectWeightedEvent(state, rng, context);
    if (!selected) {
      return;
    }

    applyEvent(selected);
    state.eventCooldown = diffCfg.eventCooldownCycles;
  }

  selectWeightedEvent(state, rng, context) {
    const indicators = state.indicators;

    const weighted = this.data.events.map((eventDef) => {
      let weight = eventDef.weight;

      if (eventDef.tags.includes("climate") && indicators.carbon > 60) {
        weight *= 1.9;
      }
      if (eventDef.tags.includes("health") && indicators.health < 45) {
        weight *= 1.7;
      }
      if (eventDef.id === "public_protest" && context.citizensLow) {
        weight *= 1 + this.data.systems.stakeholderDynamics.citizensLowProtestBoost;
      }
      if (eventDef.id === "environmental_fine" && context.ngoLow) {
        weight *= 1 + this.data.systems.stakeholderDynamics.ngoFineProbabilityBoost;
      }
      if (eventDef.tags.includes("positive") && indicators.carbon < 35) {
        weight *= 1.2;
      }

      return {
        eventDef,
        weight: Math.max(0.0001, weight)
      };
    });

    const total = weighted.reduce((sum, entry) => sum + entry.weight, 0);
    if (total <= 0) {
      return null;
    }

    let pick = rng.next() * total;
    for (const entry of weighted) {
      pick -= entry.weight;
      if (pick <= 0) {
        return entry.eventDef;
      }
    }

    return weighted[weighted.length - 1]?.eventDef || null;
  }
}