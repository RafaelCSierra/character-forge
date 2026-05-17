/**
 * AbilityScoreCalculator — shared math for the three ability-score
 * methods supported by StepAbilities: point-buy, standard array, and
 * 4d6-drop-lowest roll.
 *
 * Constants follow the standard 5e PHB table. Point-buy is non-linear:
 * scores 14 and 15 cost an extra point each beyond the 13→14 step.
 */

export const ABILITY_KEYS = ["str", "dex", "con", "int", "wis", "cha"];

export const POINT_BUY_BUDGET = 27;
export const POINT_BUY_MIN = 8;
export const POINT_BUY_MAX = 15;
export const STANDARD_ARRAY = [15, 14, 13, 12, 10, 8];

const POINT_BUY_COST = {
  8: 0,
  9: 1,
  10: 2,
  11: 3,
  12: 4,
  13: 5,
  14: 7,
  15: 9
};

/** Cost (in points) of a given ability score under the 5e point-buy rule. */
export function pointBuyCost(score) {
  if (typeof score !== "number") return 0;
  return POINT_BUY_COST[score] ?? 0;
}

/** Sum of point-buy costs across a scores object. */
export function pointBuyTotal(scores) {
  let total = 0;
  for (const k of ABILITY_KEYS) {
    total += pointBuyCost(scores?.[k]);
  }
  return total;
}

/** Can the user increase this ability by 1 under point-buy? */
export function canIncrement(scores, key) {
  const cur = scores?.[key] ?? POINT_BUY_MIN;
  if (cur >= POINT_BUY_MAX) return false;
  const used = pointBuyTotal(scores) - pointBuyCost(cur) + pointBuyCost(cur + 1);
  return used <= POINT_BUY_BUDGET;
}

/** Can the user decrease this ability by 1 under point-buy? */
export function canDecrement(scores, key) {
  const cur = scores?.[key] ?? POINT_BUY_MIN;
  return cur > POINT_BUY_MIN;
}

/** Roll 4d6 and keep the highest three. Returns a number 3..18. */
export async function rollOne() {
  const roll = new Roll("4d6kh3");
  await roll.evaluate();
  return roll.total;
}

/** Roll six 4d6-keep-highest-3 results. Used by the "roll" method. */
export async function rollSix() {
  const out = [];
  for (let i = 0; i < 6; i++) out.push(await rollOne());
  return out;
}

/** Empty scores object with all abilities at zero. */
export function emptyScores() {
  return ABILITY_KEYS.reduce((acc, k) => { acc[k] = 0; return acc; }, {});
}

/** Default scores at the point-buy floor (8 across the board, cost 0). */
export function defaultPointBuyScores() {
  return ABILITY_KEYS.reduce((acc, k) => { acc[k] = POINT_BUY_MIN; return acc; }, {});
}
