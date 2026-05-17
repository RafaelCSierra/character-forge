/**
 * StepEquipment — pick A/B starting-equipment options from the class.
 *
 * This step is **only shown for SRD-bundled classes** that ship a
 * parsed `startingEquipment.choices` block (e.g. our Fighter JSON).
 * For compendium-sourced classes the dnd5e Advancement system already
 * walks the user through equipment choices when the class item is
 * added to the actor, so this step is hidden via `isApplicable()`.
 *
 * Background fixed items + starting gold are surfaced as informational
 * text so the user knows what they're also getting alongside the class
 * choices.
 */

import { MODULE_PATH, t } from "../utils.mjs";
import DataRegistry from "../data/DataRegistry.mjs";

const CHOICE_TITLES = {
  "armor": "CHARACTER_FORGE.Equipment.Choice.Armor",
  "primary-weapon": "CHARACTER_FORGE.Equipment.Choice.PrimaryWeapon",
  "ranged": "CHARACTER_FORGE.Equipment.Choice.Ranged",
  "pack": "CHARACTER_FORGE.Equipment.Choice.Pack"
};

/** Resolve a `{key, qty}` ref into a displayable label. */
function itemLabel(itemRef) {
  const eq = DataRegistry.getEquipmentItem(itemRef.key);
  const name = eq?.name || itemRef.key;
  return itemRef.qty > 1 ? `${itemRef.qty}× ${name}` : name;
}

export default class StepEquipment {

  constructor(wizard) {
    this.wizard = wizard;
  }

  get id() { return "equipment"; }
  get labelKey() { return "CHARACTER_FORGE.Step.Equipment"; }
  get templatePath() {
    return `modules/${MODULE_PATH}/templates/step-equipment.hbs`;
  }

  /**
   * Only applicable when the chosen class is SRD-bundled AND has a
   * parsed startingEquipment.choices block. Compendium classes have
   * their equipment driven by the AdvancementManager at item add time.
   */
  isApplicable(data) {
    const cls = DataRegistry.getClass(data.classKey);
    if (!cls) return false;
    if (cls.source === "compendium") return false;
    return (cls.startingEquipment?.choices || []).length > 0;
  }

  getContext(data) {
    const cls = DataRegistry.getClass(data.classKey) || {};
    const bg = DataRegistry.getBackground(data.backgroundKey) || {};

    const rawChoices = cls.startingEquipment?.choices || [];
    const choices = rawChoices.map(choice => {
      const selected = data.equipmentChoices?.[choice.id] ?? 0;
      return {
        id: choice.id,
        title: CHOICE_TITLES[choice.id] ? t(CHOICE_TITLES[choice.id]) : choice.id,
        options: (choice.options || []).map((opt, idx) => ({
          idx,
          label: opt.label,
          itemsLabel: (opt.items || []).map(itemLabel).join(", "),
          selected: idx === selected
        }))
      };
    });

    const bgItems = (bg.equipment || []).map(itemLabel);
    const bgGold = bg.startingGold || 0;

    return {
      className: cls.name || "",
      backgroundName: bg.name || "",
      choices,
      bgItems,
      hasBgItems: bgItems.length > 0,
      bgGold,
      hasBgGold: bgGold > 0
    };
  }

  captureData() {
    // Selection is action-driven (select-equipment-option).
  }

  validate(data) {
    // Choices default to option 0 if unset; nothing to enforce.
    return { ok: true };
  }
}
