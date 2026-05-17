/**
 * StepBackground — pick a background (Acolyte, Soldier, Sage, etc.).
 *
 * Same compendium-first strategy as StepRace and StepClass:
 *   - Cards from installed Item packs (Plutonium backgrounds, dnd5e
 *     backgrounds pack, DDB Importer) appear with name + thumbnail +
 *     source label. On forge, the original document is cloned via
 *     fromUuid and the dnd5e Advancement system applies the
 *     skill / tool / feature grants.
 *   - SRD-bundled JSON entries show parsed skill proficiencies and
 *     feature name on the card. On forge they become a minimal
 *     type:"background" Item without advancement chain — the user
 *     gets the description but has to apply skill choices manually.
 */

import { MODULE_PATH, t } from "../utils.mjs";
import DataRegistry from "../data/DataRegistry.mjs";

function localizedBackgroundName(bg) {
  if (bg.i18nKey) {
    const key = `${bg.i18nKey}.name`;
    const localized = game.i18n.localize(key);
    if (localized && localized !== key) return localized;
  }
  return bg.name;
}

/** Map skill keys like "ath", "itm" to friendly localized names. */
function localizedSkill(skillKey) {
  const skill = DataRegistry.getSkill(skillKey);
  return skill ? skill.name : skillKey;
}

function skillSummary(keys) {
  if (!keys || keys.length === 0) return "";
  return keys.map(localizedSkill).join(", ");
}

export default class StepBackground {

  constructor(wizard) {
    this.wizard = wizard;
  }

  get id() { return "background"; }
  get labelKey() { return "CHARACTER_FORGE.Step.Background"; }
  get templatePath() {
    return `modules/${MODULE_PATH}/templates/step-background.hbs`;
  }

  isApplicable() { return true; }

  getContext(data) {
    const all = DataRegistry.getBackgrounds();

    const backgrounds = all.map(b => {
      const isCompendium = b.source === "compendium";
      const skills = b.skillProficiencies || [];
      return {
        key: b.key,
        displayName: isCompendium ? b.name : localizedBackgroundName(b),
        skillsLabel: isCompendium ? "" : skillSummary(skills),
        featureName: isCompendium ? "" : (b.feature?.name || ""),
        showStats: !isCompendium && (skills.length || b.feature),
        img: b.img || null,
        sourceLabel: b._packLabel || (b._imported ? t("CHARACTER_FORGE.Imported") : ""),
        isCompendium,
        imported: !!b._imported
      };
    });

    const selectedRaw = all.find(b => b.key === data.backgroundKey) || null;
    const isCompendiumSelected = selectedRaw?.source === "compendium";

    const selectedBackground = selectedRaw ? {
      key: selectedRaw.key,
      displayName: isCompendiumSelected ? selectedRaw.name : localizedBackgroundName(selectedRaw),
      img: selectedRaw.img || null,
      isCompendium: isCompendiumSelected,
      sourceLabel: selectedRaw._packLabel || (selectedRaw._imported ? t("CHARACTER_FORGE.Imported") : ""),
      skillsLabel: skillSummary(selectedRaw.skillProficiencies || []),
      toolsLabel: (selectedRaw.toolProficiencies || []).join(", "),
      languagesLabel: (selectedRaw.languages || []).join(", "),
      startingGold: selectedRaw.startingGold || 0,
      feature: selectedRaw.feature || null,
      descriptionSnippet: selectedRaw.descriptionSnippet || "",
      hasTools: (selectedRaw.toolProficiencies || []).length > 0,
      hasLanguages: (selectedRaw.languages || []).length > 0
    } : null;

    return {
      backgrounds,
      backgroundKey: data.backgroundKey || "",
      selectedBackground
    };
  }

  captureData() {
    // Selection is action-driven.
  }

  validate(data) {
    if (!data.backgroundKey) {
      return { ok: false, error: "CHARACTER_FORGE.Notify.NoBackground" };
    }
    return { ok: true };
  }
}
