const clamp = (value, min, max) => Math.max(min, Math.min(max, value));

const scaleObject = (source, scale) => {
  const output = {};
  Object.entries(source || {}).forEach(([key, value]) => {
    output[key] = value * scale;
  });
  return output;
};

export class PolicySystem {
  constructor(gameData) {
    this.data = gameData;
  }

  ensureState(state) {
    state.policyCooldowns = state.policyCooldowns || {};
    state.activePolicyEffects = state.activePolicyEffects || [];
  }

  decrementCooldowns(state) {
    const cooldowns = state.policyCooldowns || {};
    Object.keys(cooldowns).forEach((policyId) => {
      cooldowns[policyId] -= 1;
      if (cooldowns[policyId] <= 0) {
        delete cooldowns[policyId];
      }
    });
  }

  drawPolicies(state, rng) {
    const available = this.data.policies.filter((policy) => this.isPolicyAvailable(policy, state));
    if (available.length <= 3) {
      return [...available];
    }

    const selected = [];
    const pool = [...available];
    while (selected.length < 3 && pool.length) {
      const idx = Math.floor(rng.next() * pool.length);
      selected.push(pool.splice(idx, 1)[0]);
    }

    return selected;
  }

  isPolicyAvailable(policy, state) {
    if (state.policyCooldowns?.[policy.id] > 0) {
      return false;
    }

    if (policy.requires) {
      const [track, requiredLevel] = Object.entries(policy.requires)[0];
      if ((state.upgrades?.[track] || 0) < requiredLevel) {
        return false;
      }
    }

    if (policy.upgrade) {
      const currentLevel = state.upgrades?.[policy.upgrade.track] || 0;
      if (currentLevel >= policy.upgrade.level) {
        return false;
      }
    }

    return true;
  }

  calculateRampScale(policy, cycleIndex) {
    const defaults = this.data.policyDefaults.effectTiming;
    const timing = policy.effectTiming || defaults;
    const immediate = clamp(timing.immediatePercent ?? defaults.immediatePercent, 0, 1);
    const rampCycles = Math.max(1, Math.round(timing.rampCycles ?? defaults.rampCycles));

    if (rampCycles === 1) {
      return 1;
    }

    const boundedCycle = Math.min(rampCycles, Math.max(1, cycleIndex));
    const progress = (boundedCycle - 1) / (rampCycles - 1);
    return immediate + (1 - immediate) * progress;
  }

  getCooldownCycles(policy) {
    return Math.max(1, Math.round(policy.cooldownCycles ?? this.data.policyDefaults.cooldownCycles));
  }

  registerPolicySelection(policy, state) {
    const initialScale = this.calculateRampScale(policy, 1);
    const rampCycles = Math.max(
      1,
      Math.round(policy.effectTiming?.rampCycles ?? this.data.policyDefaults.effectTiming.rampCycles)
    );

    state.policyCooldowns[policy.id] = this.getCooldownCycles(policy);

    if (rampCycles > 1 && initialScale < 1) {
      state.activePolicyEffects.push({
        policyId: policy.id,
        policyTitle: policy.title,
        impacts: { ...policy.impacts },
        stakeholders: { ...(policy.stakeholders || {}) },
        currentCycle: 1,
        rampCycles,
        immediatePercent:
          policy.effectTiming?.immediatePercent ?? this.data.policyDefaults.effectTiming.immediatePercent,
        lastScale: initialScale
      });
    }

    return {
      immediateImpacts: scaleObject(policy.impacts, initialScale),
      immediateStakeholders: scaleObject(policy.stakeholders || {}, initialScale),
      initialScale
    };
  }

  processRampQueue(state, applyDeltaSet, applyStakeholderDelta, pushLog) {
    if (!state.activePolicyEffects?.length) {
      return;
    }

    const nextQueue = [];

    for (const entry of state.activePolicyEffects) {
      const nextCycle = entry.currentCycle + 1;
      const pseudoPolicy = {
        effectTiming: {
          immediatePercent: entry.immediatePercent,
          rampCycles: entry.rampCycles
        }
      };

      const nextScale = this.calculateRampScale(pseudoPolicy, nextCycle);
      const deltaScale = nextScale - entry.lastScale;

      if (Math.abs(deltaScale) > 0.0001) {
        applyDeltaSet(scaleObject(entry.impacts, deltaScale));
        applyStakeholderDelta(scaleObject(entry.stakeholders, deltaScale));
      }

      entry.currentCycle = nextCycle;
      entry.lastScale = nextScale;

      if (entry.currentCycle < entry.rampCycles) {
        nextQueue.push(entry);
      } else {
        pushLog(`Policy ramp completed: ${entry.policyTitle}.`, "policy");
      }
    }

    state.activePolicyEffects = nextQueue;
  }
}