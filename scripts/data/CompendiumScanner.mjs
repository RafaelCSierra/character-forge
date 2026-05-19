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
  // Subclass items reference their parent class via this field — we
  // index it so StepClass can filter the global subclass list down to
  // the ones that apply to the user's selected class.
  "system.classIdentifier",
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

/**
 * Extract a readable snippet from a dnd5e Item's `system.description.value`.
 *
 * The raw value is HTML with two kinds of noise we have to handle:
 *   1. Foundry text-enrichment tags: `@Embed[…]`, `@UUID[…]{label}`,
 *      `@Compendium[…]`, `@Check[…]`, etc. — those resolve to interactive
 *      widgets in real rendering, but as plain text they're junk.
 *   2. Block-level HTML (<p>, <h3>, <li>…) — `textContent` joins adjacent
 *      blocks with no space, producing run-ons like "Human TraitsCreature
 *      Type: HumanoidSize: Medium".
 *
 * We strip enrichment shorthand, inject a space before each block close,
 * decode entities, collapse whitespace, then truncate at a word boundary.
 */
function descriptionSnippet(html, maxChars = 500) {
  if (!html) return "";

  let txt = String(html);
  // 1. Strip enrichment shorthand: @Word[anything](optional {label})
  txt = txt.replace(/@\w+\[[^\]]*\](?:\{[^}]*\})?/g, "");
  // 2. Insert a space before each closing block tag so adjacent blocks
  //    don't run together when textContent is extracted.
  txt = txt.replace(/<\/(p|div|h[1-6]|li|tr|td|th|section|article)>/gi, " </$1>");
  // 3. Strip remaining HTML tags and decode entities via DOM.
  const tmp = document.createElement("div");
  tmp.innerHTML = txt;
  txt = (tmp.textContent || "").replace(/\s+/g, " ").trim();

  if (txt.length <= maxChars) return txt;

  // 4. Truncate at the last word boundary before maxChars (avoid mid-word
  //    cuts like "Speed: 3...").
  const cut = txt.slice(0, maxChars - 1);
  const lastSpace = cut.lastIndexOf(" ");
  const safeCut = lastSpace > maxChars * 0.6 ? cut.slice(0, lastSpace) : cut;
  return `${safeCut}…`;
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
      // Only meaningful for subclass items — references their parent
      // class's identifier. Subclass picker uses this to filter.
      classIdentifier: entry.system?.classIdentifier || null,
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
