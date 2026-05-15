/**
 * StepRace — race + subrace selection.
 *
 * The user picks a race card; if the race has subraces, a second tier of
 * cards appears. Selecting a race resets the subrace to keep state consistent.
 * Selection is action-driven (data-action="select-race"), not form-driven —
 * the wizard re-renders on every click so the preview panel updates live.
 */

import { MODULE_PATH, t } from "../utils.mjs";
import DataRegistry from "../data/DataRegistry.mjs";

const ABILITY_KEYS = ["str", "dex", "con", "int", "wis", "cha"];

const SIZE_KEYS = {
  tiny: "CHARACTER_FORGE.Race.Size.Tiny",
  small: "CHARACTER_FORGE.Race.Size.Small",
  medium: "CHARACTER_FORGE.Race.Size.Medium",
  large: "CHARACTER_FORGE.Race.Size.Large"
};

/** "STR +2, CON +1" / "+1 to all". Reads the first asi entry; ignores choose-clauses for the summary. */
function asiSummary(race) {
  const block = (race.asi && race.asi[0]) || {};
  const fixed = ABILITY_KEYS
    .filter(k => Number.isFinite(block[k]) && block[k] !== 0)
    .map(k => `${k.toUpperCase()} +${block[k]}`);

  // Compact "+1 to all" shorthand
  if (fixed.length === 6 && new Set(ABILITY_KEYS.map(k => block[k])).size === 1) {
    return t("CHARACTER_FORGE.Race.AsiAll", { amount: block.str });
  }

  let summary = fixed.join(", ");
  if (block.choose) {
    const extra = t("CHARACTER_FORGE.Race.AsiChoose", {
      n: block.choose.n,
      amount: block.choose.amount
    });
    summary = summary ? `${summary}, ${extra}` : extra;
  }
  return summary || "—";
}

function localizedRaceName(race) {
  if (race.i18nKey) {
    const localized = game.i18n.localize(`${race.i18nKey}.name`);
    if (localized && localized !== `${race.i18nKey}.name`) return localized;
  }
  return race.name;
}

function sizeLabel(size) {
  const key = SIZE_KEYS[size];
  return key ? t(key) : (size || "—");
}

function languagesSummary(race) {
  const langs = race.languages || [];
  return langs
    .map(l => {
      if (l.startsWith("any:")) {
        const n = Number(l.split(":")[1]) || 1;
        return t("CHARACTER_FORGE.Race.AnyLanguage", { n });
      }
      const key = `CHARACTER_FORGE.Language.${l.charAt(0).toUpperCase()}${l.slice(1)}`;
      const localized = game.i18n.localize(key);
      return localized && localized !== key ? localized : l;
    })
    .join(", ");
}

/** Merge subrace traits/asi/speed onto the parent race for preview/summary. */
function mergeSubrace(race, subrace) {
  if (!subrace) return race;
  const merged = { ...race };

  // Combine ASI blocks
  const parentAsi = race.asi?.[0] || {};
  const subAsi = subrace.asi?.[0] || {};
  const combined = { ...parentAsi };
  for (const k of ABILITY_KEYS) {
    if (Number.isFinite(subAsi[k])) {
      combined[k] = (combined[k] || 0) + subAsi[k];
    }
  }
  merged.asi = [combined];

  if (Number.isFinite(subrace.speed)) merged.speed = subrace.speed;
  if (subrace.size) merged.size = subrace.size;

  merged.traits = [...(race.traits || []), ...(subrace.traits || [])];
  return merged;
}

export default class StepRace {

  constructor(wizard) {
    this.wizard = wizard;
  }

  get id() { return "race"; }
  get labelKey() { return "CHARACTER_FORGE.Step.Race"; }
  get templatePath() {
    return `modules/${MODULE_PATH}/templates/step-race.hbs`;
  }

  isApplicable() { return true; }

  getContext(data) {
    const all = DataRegistry.getRaces();

    const races = all.map(r => {
      const isCompendium = r.source === "compendium";
      const sLabel = isCompendium ? "" : sizeLabel(r.size);
      const sp = isCompendium ? null : r.speed;
      return {
        key: r.key,
        displayName: isCompendium ? r.name : localizedRaceName(r),
        // Compendium entries lack parsed asi/size/speed (they live inside
        // system.advancement[]) — leave those lines blank and rely on the
        // source badge + preview snippet instead.
        asiSummary: isCompendium ? "" : asiSummary(r),
        sizeLabel: sLabel,
        speed: sp,
        showMeta: !!(sLabel || sp),
        img: r.img || null,
        sourceLabel: r._packLabel || (r._imported ? t("CHARACTER_FORGE.Imported") : ""),
        isCompendium,
        imported: !!r._imported,
        hasSubraces: (r.subraces || []).length > 0
      };
    });

    const selectedRaw = all.find(r => r.key === data.raceKey) || null;
    const isCompendiumSelected = selectedRaw?.source === "compendium";

    let selectedSubrace = null;
    if (selectedRaw && data.subraceKey) {
      selectedSubrace = (selectedRaw.subraces || []).find(s => s.key === data.subraceKey) || null;
    }

    const previewRace = selectedRaw && !isCompendiumSelected
      ? mergeSubrace(selectedRaw, selectedSubrace)
      : selectedRaw;

    const selectedRace = previewRace ? {
      key: selectedRaw.key,
      displayName: isCompendiumSelected ? selectedRaw.name : localizedRaceName(selectedRaw),
      img: selectedRaw.img || null,
      isCompendium: isCompendiumSelected,
      sourceLabel: selectedRaw._packLabel || (selectedRaw._imported ? t("CHARACTER_FORGE.Imported") : ""),
      asiSummary: isCompendiumSelected ? "" : asiSummary(previewRace),
      sizeLabel: isCompendiumSelected ? "" : sizeLabel(previewRace.size),
      speed: isCompendiumSelected ? null : previewRace.speed,
      languagesSummary: isCompendiumSelected ? "" : languagesSummary(previewRace),
      descriptionSnippet: selectedRaw.descriptionSnippet || "",
      traits: isCompendiumSelected ? [] : (previewRace.traits || []),
      subraces: (selectedRaw.subraces || []).map(s => ({
        key: s.key,
        displayName: localizedRaceName(s),
        asiSummary: asiSummary(s)
      }))
    } : null;

    return {
      races,
      raceKey: data.raceKey || "",
      subraceKey: data.subraceKey || "",
      selectedRace,
      // Subrace step only shown for SRD entries with subraces. Compendium
      // races already have subraces packaged as separate top-level entries
      // (Plutonium splits Hill Dwarf and Mountain Dwarf into two race
      // items rather than nesting).
      needsSubrace: !!(selectedRaw && !isCompendiumSelected && (selectedRaw.subraces || []).length > 0)
    };
  }

  captureData() {
    // Selection is driven by data-action clicks; no form values to capture.
  }

  validate(data) {
    if (!data.raceKey) {
      return { ok: false, error: "CHARACTER_FORGE.Notify.NoRace" };
    }
    const race = DataRegistry.getRace(data.raceKey);
    if (race && (race.subraces || []).length > 0 && !data.subraceKey) {
      return { ok: false, error: "CHARACTER_FORGE.Notify.NoSubrace" };
    }
    return { ok: true };
  }
}
