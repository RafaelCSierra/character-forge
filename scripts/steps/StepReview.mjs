/**
 * StepReview — final read-only summary. The wizard's nav bar shows
 * "Forge Character" as the next-button on this (last) step, so the
 * user reviews and confirms in one place. Going back is done by
 * clicking earlier step indicators in the top bar.
 */

import { MODULE_PATH, t } from "../utils.mjs";
import DataRegistry from "../data/DataRegistry.mjs";
import { ABILITY_KEYS } from "../builders/AbilityScoreCalculator.mjs";

const ABILITY_LABEL_KEYS = {
  str: "CHARACTER_FORGE.Ability.Str",
  dex: "CHARACTER_FORGE.Ability.Dex",
  con: "CHARACTER_FORGE.Ability.Con",
  int: "CHARACTER_FORGE.Ability.Int",
  wis: "CHARACTER_FORGE.Ability.Wis",
  cha: "CHARACTER_FORGE.Ability.Cha"
};

const ALIGNMENT_LABEL_KEYS = {
  "lawful-good":     "CHARACTER_FORGE.Alignment.LawfulGood",
  "neutral-good":    "CHARACTER_FORGE.Alignment.NeutralGood",
  "chaotic-good":    "CHARACTER_FORGE.Alignment.ChaoticGood",
  "lawful-neutral":  "CHARACTER_FORGE.Alignment.LawfulNeutral",
  "true-neutral":    "CHARACTER_FORGE.Alignment.TrueNeutral",
  "chaotic-neutral": "CHARACTER_FORGE.Alignment.ChaoticNeutral",
  "lawful-evil":     "CHARACTER_FORGE.Alignment.LawfulEvil",
  "neutral-evil":    "CHARACTER_FORGE.Alignment.NeutralEvil",
  "chaotic-evil":    "CHARACTER_FORGE.Alignment.ChaoticEvil"
};

const METHOD_LABEL_KEYS = {
  "point-buy":      "CHARACTER_FORGE.Abilities.Method.PointBuy",
  "standard-array": "CHARACTER_FORGE.Abilities.Method.StandardArray",
  "roll":           "CHARACTER_FORGE.Abilities.Method.Roll"
};

function modifier(score) {
  if (typeof score !== "number" || !Number.isFinite(score)) return 0;
  return Math.floor((score - 10) / 2);
}

function fmtModifier(mod) {
  return mod >= 0 ? `+${mod}` : `${mod}`;
}

function localizedRaceName(race) {
  if (race?.i18nKey) {
    const key = `${race.i18nKey}.name`;
    const localized = game.i18n.localize(key);
    if (localized && localized !== key) return localized;
  }
  return race?.name || "";
}

export default class StepReview {

  constructor(wizard) {
    this.wizard = wizard;
  }

  get id() { return "review"; }
  get labelKey() { return "CHARACTER_FORGE.Step.Review"; }
  get templatePath() {
    return `modules/${MODULE_PATH}/templates/step-review.hbs`;
  }

  isApplicable() { return true; }

  getContext(data) {
    const race = DataRegistry.getRace(data.raceKey);
    const cls = DataRegistry.getClass(data.classKey);
    const bg = DataRegistry.getBackground(data.backgroundKey);

    let subraceName = "";
    if (race && data.subraceKey) {
      const sub = (race.subraces || []).find(s => s.key === data.subraceKey);
      if (sub) {
        const key = sub.i18nKey ? `${sub.i18nKey}.name` : null;
        if (key) {
          const localized = game.i18n.localize(key);
          subraceName = (localized && localized !== key) ? localized : sub.name;
        } else {
          subraceName = sub.name;
        }
      }
    }

    const abilities = ABILITY_KEYS.map(k => {
      const v = data.baseScores?.[k];
      const value = Number.isFinite(v) && v > 0 ? v : 10;
      return {
        key: k,
        label: t(ABILITY_LABEL_KEYS[k]),
        value,
        modifier: fmtModifier(modifier(value))
      };
    });

    const alignmentKey = data.alignment;
    const alignmentLabel = alignmentKey && ALIGNMENT_LABEL_KEYS[alignmentKey]
      ? t(ALIGNMENT_LABEL_KEYS[alignmentKey])
      : t("CHARACTER_FORGE.Identity.AlignmentNone");

    const method = data.abilityMethod || "point-buy";

    return {
      name: data.name || t("CHARACTER_FORGE.Notify.DefaultName"),
      alignmentLabel,
      portrait: data.portrait || "",
      hasPortrait: !!data.portrait,
      race: race ? {
        name: localizedRaceName(race),
        subname: subraceName,
        sourceLabel: race._packLabel || ""
      } : null,
      classBlock: cls ? {
        name: cls.name,
        sourceLabel: cls._packLabel || ""
      } : null,
      backgroundBlock: bg ? {
        name: bg.name,
        sourceLabel: bg._packLabel || ""
      } : null,
      abilities,
      methodLabel: t(METHOD_LABEL_KEYS[method] || METHOD_LABEL_KEYS["point-buy"])
    };
  }

  captureData() {
    // Read-only step.
  }

  validate() {
    // Final validation runs in _onForge by walking all steps; nothing
    // additional to check here.
    return { ok: true };
  }
}
