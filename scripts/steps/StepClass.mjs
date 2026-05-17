/**
 * StepClass — pick a class for the new level-1 character.
 *
 * Mirrors StepRace's compendium-first strategy:
 *   - Compendium class items (dnd5e.classes pack, Plutonium classes, DDB
 *     Importer, etc.) are shown as cards with name + source badge; on
 *     forge, the original document is cloned via fromUuid and the dnd5e
 *     AdvancementManager fires automatically to handle skill choices,
 *     fighting style (Fighter / Paladin / Ranger), hit-point rolls, and
 *     proficiencies.
 *   - Bundled SRD class JSONs (srd-data/classes/*.json) appear with
 *     parsed hit-die / saves / primary ability summary; on forge they're
 *     turned into a minimal level-1 class Item with no advancement
 *     chain — the user will need to set HP / proficiencies manually
 *     until those SRD files grow proper Advancement definitions.
 *
 * Subclass selection happens later via the dnd5e Advancement system
 * (level 1 for Cleric/Sorcerer/Warlock in 2014 rules, level 3 for
 * everyone in 2024 rules) — there is no separate subclass step here.
 */

import { MODULE_PATH, t } from "../utils.mjs";
import DataRegistry from "../data/DataRegistry.mjs";

const ABILITY_LABEL_KEYS = {
  str: "CHARACTER_FORGE.Ability.Str",
  dex: "CHARACTER_FORGE.Ability.Dex",
  con: "CHARACTER_FORGE.Ability.Con",
  int: "CHARACTER_FORGE.Ability.Int",
  wis: "CHARACTER_FORGE.Ability.Wis",
  cha: "CHARACTER_FORGE.Ability.Cha"
};

function localizedClassName(cls) {
  if (cls.i18nKey) {
    const key = `${cls.i18nKey}.name`;
    const localized = game.i18n.localize(key);
    if (localized && localized !== key) return localized;
  }
  return cls.name;
}

function abilitySummary(keys) {
  if (!keys || keys.length === 0) return "";
  return keys.map(k => t(ABILITY_LABEL_KEYS[k] || k)).join(" / ");
}

export default class StepClass {

  constructor(wizard) {
    this.wizard = wizard;
  }

  get id() { return "class"; }
  get labelKey() { return "CHARACTER_FORGE.Step.Class"; }
  get templatePath() {
    return `modules/${MODULE_PATH}/templates/step-class.hbs`;
  }

  isApplicable() { return true; }

  getContext(data) {
    const all = DataRegistry.getClasses();

    const classes = all.map(c => {
      const isCompendium = c.source === "compendium";
      const hitDie = c.hitDie;
      const saves = c.savingThrows || [];
      const primary = c.primaryAbility || [];
      return {
        key: c.key,
        displayName: isCompendium ? c.name : localizedClassName(c),
        hitDie: hitDie || null,
        hitDieLabel: hitDie ? `d${hitDie}` : "",
        savesLabel: abilitySummary(saves),
        primaryLabel: abilitySummary(primary),
        showStats: !isCompendium && (hitDie || saves.length || primary.length),
        img: c.img || null,
        sourceLabel: c._packLabel || (c._imported ? t("CHARACTER_FORGE.Imported") : ""),
        isCompendium,
        imported: !!c._imported
      };
    });

    const selectedRaw = all.find(c => c.key === data.classKey) || null;
    const isCompendiumSelected = selectedRaw?.source === "compendium";

    const armorList = (selectedRaw?.armorProficiencies || []).join(", ");
    const weaponList = (selectedRaw?.weaponProficiencies || []).join(", ");
    const selectedClass = selectedRaw ? {
      key: selectedRaw.key,
      displayName: isCompendiumSelected ? selectedRaw.name : localizedClassName(selectedRaw),
      img: selectedRaw.img || null,
      isCompendium: isCompendiumSelected,
      sourceLabel: selectedRaw._packLabel || (selectedRaw._imported ? t("CHARACTER_FORGE.Imported") : ""),
      hitDieLabel: selectedRaw.hitDie ? `d${selectedRaw.hitDie}` : "",
      savesLabel: abilitySummary(selectedRaw.savingThrows || []),
      primaryLabel: abilitySummary(selectedRaw.primaryAbility || []),
      armorList,
      weaponList,
      hasArmor: !!armorList,
      hasWeapons: !!weaponList,
      skillChoice: selectedRaw.skillProficiencies || null,
      descriptionSnippet: selectedRaw.descriptionSnippet || ""
    } : null;

    return {
      classes,
      classKey: data.classKey || "",
      selectedClass
    };
  }

  captureData() {
    // Selection is action-driven.
  }

  validate(data) {
    if (!data.classKey) {
      return { ok: false, error: "CHARACTER_FORGE.Notify.NoClass" };
    }
    return { ok: true };
  }
}
