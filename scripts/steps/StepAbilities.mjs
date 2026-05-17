/**
 * StepAbilities — assign STR / DEX / CON / INT / WIS / CHA.
 *
 * The user picks one of three methods via tabs:
 *   - point-buy (default): 27-point budget, scores 8..15, non-linear cost
 *   - standard-array: assign each of 15, 14, 13, 12, 10, 8 to one ability
 *   - roll: roll 4d6kh3 × 6, then assign each result to one ability
 *
 * Point-buy uses click actions (ability-inc / ability-dec) so the
 * remaining-points counter and disabled state stay in sync. The other
 * two methods use form selects captured at navigation time. Validation
 * enforces the method-specific rules.
 */

import { MODULE_ID, MODULE_PATH, t } from "../utils.mjs";
import {
  ABILITY_KEYS,
  POINT_BUY_BUDGET,
  POINT_BUY_MIN,
  POINT_BUY_MAX,
  STANDARD_ARRAY,
  pointBuyCost,
  pointBuyTotal,
  canIncrement,
  canDecrement,
  defaultPointBuyScores,
  emptyScores
} from "../builders/AbilityScoreCalculator.mjs";

const ABILITY_LABEL_KEYS = {
  str: "CHARACTER_FORGE.Ability.Str",
  dex: "CHARACTER_FORGE.Ability.Dex",
  con: "CHARACTER_FORGE.Ability.Con",
  int: "CHARACTER_FORGE.Ability.Int",
  wis: "CHARACTER_FORGE.Ability.Wis",
  cha: "CHARACTER_FORGE.Ability.Cha"
};

const METHODS = [
  { key: "point-buy", labelKey: "CHARACTER_FORGE.Abilities.Method.PointBuy" },
  { key: "standard-array", labelKey: "CHARACTER_FORGE.Abilities.Method.StandardArray" },
  { key: "roll", labelKey: "CHARACTER_FORGE.Abilities.Method.Roll" }
];

/** Compute the ability-score modifier from a raw value (5e standard). */
function modifier(score) {
  if (typeof score !== "number" || !Number.isFinite(score)) return 0;
  return Math.floor((score - 10) / 2);
}

function fmtModifier(mod) {
  return mod >= 0 ? `+${mod}` : `${mod}`;
}

/** Build a list of options for a dropdown, marking those already used elsewhere. */
function dropdownOptions(values, currentValue, scoresByKey, abilityKey) {
  // A value is "used" if it appears in any OTHER ability's slot.
  const usedElsewhere = new Set();
  for (const k of ABILITY_KEYS) {
    if (k === abilityKey) continue;
    const v = scoresByKey[k];
    if (v) usedElsewhere.add(v);
  }
  return values.map(v => ({
    value: v,
    selected: currentValue === v,
    disabled: usedElsewhere.has(v) && currentValue !== v
  }));
}

export default class StepAbilities {

  constructor(wizard) {
    this.wizard = wizard;
  }

  get id() { return "abilities"; }
  get labelKey() { return "CHARACTER_FORGE.Step.Abilities"; }
  get templatePath() {
    return `modules/${MODULE_PATH}/templates/step-abilities.hbs`;
  }

  isApplicable() { return true; }

  getContext(data) {
    let method = data.abilityMethod;
    if (!method) {
      // First visit — fall back to the world default setting.
      try {
        method = game.settings.get(MODULE_ID, "defaultAbilityMethod");
      } catch {
        method = "point-buy";
      }
    }

    const scores = { ...(data.baseScores || {}) };
    // Ensure all keys exist as numbers
    for (const k of ABILITY_KEYS) {
      if (typeof scores[k] !== "number") {
        scores[k] = method === "point-buy" ? POINT_BUY_MIN : 0;
      }
    }

    const rolled = Array.isArray(data.rolledArray) ? [...data.rolledArray] : [];

    // -- Point-buy rows
    const pointBuyRows = ABILITY_KEYS.map(k => {
      const v = scores[k];
      const mod = modifier(v);
      return {
        key: k,
        label: t(ABILITY_LABEL_KEYS[k]),
        value: v,
        cost: pointBuyCost(v),
        modifier: fmtModifier(mod),
        canInc: canIncrement(scores, k),
        canDec: canDecrement(scores, k)
      };
    });

    // -- Standard-array rows
    const arrayRows = ABILITY_KEYS.map(k => ({
      key: k,
      label: t(ABILITY_LABEL_KEYS[k]),
      value: scores[k] || "",
      modifier: scores[k] ? fmtModifier(modifier(scores[k])) : "",
      options: dropdownOptions(STANDARD_ARRAY, scores[k], scores, k)
    }));

    // -- Roll rows (only meaningful once rolledArray is set)
    const rollRows = ABILITY_KEYS.map(k => ({
      key: k,
      label: t(ABILITY_LABEL_KEYS[k]),
      value: scores[k] || "",
      modifier: scores[k] ? fmtModifier(modifier(scores[k])) : "",
      options: rolled.length === 6 ? dropdownOptions(rolled, scores[k], scores, k) : []
    }));

    const pointsUsed = pointBuyTotal(scores);

    return {
      method,
      isPointBuy: method === "point-buy",
      isStandardArray: method === "standard-array",
      isRoll: method === "roll",
      methodOptions: METHODS.map(m => ({
        ...m,
        active: method === m.key
      })),
      pointBuyRows,
      pointsUsed,
      pointsRemaining: POINT_BUY_BUDGET - pointsUsed,
      pointsBudget: POINT_BUY_BUDGET,
      arrayRows,
      arrayValues: STANDARD_ARRAY,
      rollRows,
      rolledArray: rolled,
      hasRolled: rolled.length === 6,
      pointBuyMin: POINT_BUY_MIN,
      pointBuyMax: POINT_BUY_MAX
    };
  }

  captureData(root, data) {
    // For point-buy, the inc/dec actions already mutated baseScores.
    // For the other methods, read the current select values.
    if (data.abilityMethod === "point-buy") return;

    for (const k of ABILITY_KEYS) {
      const sel = root.querySelector(`[name="ability-${k}"]`);
      if (!sel) continue;
      const v = parseInt(sel.value, 10);
      data.baseScores[k] = Number.isFinite(v) ? v : 0;
    }
  }

  validate(data) {
    const method = data.abilityMethod || "point-buy";
    const scores = data.baseScores || {};

    if (method === "point-buy") {
      const used = pointBuyTotal(scores);
      if (used > POINT_BUY_BUDGET) {
        return { ok: false, error: "CHARACTER_FORGE.Notify.AbilitiesOverBudget" };
      }
      for (const k of ABILITY_KEYS) {
        const v = scores[k];
        if (typeof v !== "number" || v < POINT_BUY_MIN || v > POINT_BUY_MAX) {
          return { ok: false, error: "CHARACTER_FORGE.Notify.AbilitiesOutOfRange" };
        }
      }
      return { ok: true };
    }

    if (method === "standard-array") {
      const values = ABILITY_KEYS.map(k => scores[k]).filter(v => Number.isFinite(v) && v > 0);
      if (values.length < ABILITY_KEYS.length) {
        return { ok: false, error: "CHARACTER_FORGE.Notify.AbilitiesUnassigned" };
      }
      const sortedScores = [...values].sort((a, b) => b - a);
      const sortedArray = [...STANDARD_ARRAY].sort((a, b) => b - a);
      if (sortedScores.join(",") !== sortedArray.join(",")) {
        return { ok: false, error: "CHARACTER_FORGE.Notify.AbilitiesNotStandardArray" };
      }
      return { ok: true };
    }

    if (method === "roll") {
      const rolled = data.rolledArray || [];
      if (rolled.length !== 6) {
        return { ok: false, error: "CHARACTER_FORGE.Notify.AbilitiesNotRolled" };
      }
      const values = ABILITY_KEYS.map(k => scores[k]).filter(v => Number.isFinite(v) && v > 0);
      if (values.length < ABILITY_KEYS.length) {
        return { ok: false, error: "CHARACTER_FORGE.Notify.AbilitiesUnassigned" };
      }
      const sortedScores = [...values].sort((a, b) => b - a);
      const sortedRolled = [...rolled].sort((a, b) => b - a);
      if (sortedScores.join(",") !== sortedRolled.join(",")) {
        return { ok: false, error: "CHARACTER_FORGE.Notify.AbilitiesAssignmentMismatch" };
      }
      return { ok: true };
    }

    return { ok: true };
  }
}
