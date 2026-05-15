/**
 * CompendiumScanner — scans Foundry Item compendium packs for content
 * relevant to the wizard (races, subraces, classes, subclasses, backgrounds,
 * feats, spells) and converts them into the registry's internal shape.
 *
 * This is how non-SRD content (typically populated by Plutonium, DDB
 * Importer, or hand-built packs) becomes available in the wizard without
 * the user touching a JSON file. The native dnd5e Item schema is already
 * the canonical form Foundry needs to apply the race/class/etc. to an
 * actor — at forge time we simply clone the original document by UUID
 * and let the dnd5e Advancement system handle ASI/traits/proficiencies.
 *
 * We only read the index here (fast, metadata only). Heavier reads
 * (e.g. parsing system.advancement) are deferred to the forge step.
 */

import { MODULE_ID, log, warn } from "../utils.mjs";

const INDEX_FIELDS = [
  "type",
  "img",
  "system.identifier",
  "system.source",
  "system.description.value"
];

/** Slug an arbitrary string into a stable key fragment. */
function slugKey(raw) {
  return String(raw || "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

/** Extract the first ~280 chars of the HTML description as plain text. */
function descriptionSnippet(html) {
  if (!html) return "";
  const tmp = document.createElement("div");
  tmp.innerHTML = String(html);
  const text = (tmp.textContent || "").replace(/\s+/g, " ").trim();
  return text.length > 280 ? `${text.slice(0, 277)}…` : text;
}

const CompendiumScanner = {

  /** Last scan result keyed by item type (race, class, background, ...). */
  _cache: {
    race: [],
    background: [],
    class: [],
    subclass: [],
    feat: [],
    spell: []
  },

  /** Pack IDs the user has opted out of via the compendiumPacksDisabled setting. */
  _disabledPacks() {
    try {
      const obj = game.settings.get(MODULE_ID, "compendiumPacksDisabled") || {};
      return new Set(Object.keys(obj).filter(k => obj[k] === true));
    } catch {
      return new Set();
    }
  },

  /** Scan all Item packs and rebuild the cache. */
  async scan() {
    const result = {
      race: [],
      background: [],
      class: [],
      subclass: [],
      feat: [],
      spell: []
    };

    const disabled = this._disabledPacks();
    const itemPacks = game.packs.filter(p => p.documentName === "Item");

    for (const pack of itemPacks) {
      if (disabled.has(pack.collection)) continue;

      let index;
      try {
        index = await pack.getIndex({ fields: INDEX_FIELDS });
      } catch (err) {
        warn(`Failed to index pack ${pack.collection}:`, err);
        continue;
      }

      const sourceLabel = pack.metadata?.label || pack.collection;
      const packId = pack.collection;

      for (const entry of index) {
        if (!result[entry.type]) continue; // not a type we care about

        const record = this._toRecord(entry, pack, sourceLabel, packId);
        result[entry.type].push(record);
      }
    }

    this._cache = result;

    const totals = Object.entries(result)
      .map(([k, v]) => `${k}=${v.length}`)
      .join(", ");
    log(`Compendium scan complete: ${totals}`);

    return result;
  },

  /** Convert one index entry into the registry's internal shape. */
  _toRecord(entry, pack, sourceLabel, packId) {
    const description = entry.system?.description?.value || "";
    const identifier = entry.system?.identifier || slugKey(entry.name);

    return {
      // Use a compound key to avoid collisions between SRD and compendium
      // and across packs (two packs may both publish a "tabaxi").
      key: `comp:${packId}:${entry._id}`,
      name: entry.name,
      img: entry.img,
      uuid: `Compendium.${packId}.Item.${entry._id}`,
      identifier,
      descriptionSnippet: descriptionSnippet(description),
      source: "compendium",
      _imported: true,
      _packId: packId,
      _packLabel: sourceLabel,
      // Display-summary fields are unknown from the index alone — leave
      // them empty so the UI can fall back to "no summary available".
      asi: null,
      size: null,
      speed: null,
      languages: [],
      traits: [],
      subraces: []
    };
  },

  /** Get the cached records for one type (race / background / class / ...). */
  get(type) {
    return this._cache[type] || [];
  }
};

export default CompendiumScanner;
