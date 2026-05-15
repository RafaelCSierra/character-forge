/**
 * DataRegistry — single source of truth for content used by the wizard.
 *
 * Merges SRD data (bundled, loaded by SrdLoader) with content imported by
 * the user (stored in game.settings as "importedContent", world-scope).
 *
 * Imported entries with the same `key` as an SRD entry win when the
 * "importedOverridesSrd" setting is true (default).
 */

import { MODULE_ID } from "../utils.mjs";
import CompendiumScanner from "./CompendiumScanner.mjs";

const DataRegistry = {
  _srd: {
    races: [],
    backgrounds: [],
    classes: [],
    equipment: [],
    skills: []
  },

  setSrd(srd) {
    this._srd = {
      races: srd.races || [],
      backgrounds: srd.backgrounds || [],
      classes: srd.classes || [],
      equipment: srd.equipment || [],
      skills: srd.skills || []
    };
  },

  _getImported() {
    try {
      return game.settings.get(MODULE_ID, "importedContent") || {};
    } catch {
      return {};
    }
  },

  _shouldImportedOverride() {
    try {
      return game.settings.get(MODULE_ID, "importedOverridesSrd");
    } catch {
      return true;
    }
  },

  /**
   * Merge SRD + compendium + imported entries on `key`.
   *
   * Priority (when override is on, default): imported > compendium > SRD.
   * Compendium entries use compound keys (`comp:<pack>:<id>`) so they
   * never collide with SRD keys, but importing is allowed to shadow
   * a same-named entry from SRD if the user opts in.
   */
  _merge(srdList, compendiumList, importedList) {
    const override = this._shouldImportedOverride();
    const map = new Map();

    // 1) Seed with SRD
    for (const entry of srdList || []) {
      map.set(entry.key, { ...entry, _source: entry.source || "SRD-5.1" });
    }
    // 2) Layer compendium — never collides on key (compound) so always added
    for (const entry of compendiumList || []) {
      if (!entry || !entry.key) continue;
      map.set(entry.key, { ...entry });
    }
    // 3) Layer imported (manual JSON import)
    for (const entry of importedList || []) {
      if (!entry || !entry.key) continue;
      if (map.has(entry.key) && !override) continue;
      map.set(entry.key, { ...entry, _source: entry.source || "imported", _imported: true });
    }
    return Array.from(map.values());
  },

  getRaces() {
    const imported = this._getImported().races || [];
    return this._merge(this._srd.races, CompendiumScanner.get("race"), imported);
  },

  getRace(key) {
    return this.getRaces().find(r => r.key === key) || null;
  },

  getBackgrounds() {
    const imported = this._getImported().backgrounds || [];
    return this._merge(this._srd.backgrounds, CompendiumScanner.get("background"), imported);
  },

  getBackground(key) {
    return this.getBackgrounds().find(b => b.key === key) || null;
  },

  getClasses() {
    const imported = this._getImported().classes || [];
    return this._merge(this._srd.classes, CompendiumScanner.get("class"), imported);
  },

  getClass(key) {
    return this.getClasses().find(c => c.key === key) || null;
  },

  getEquipment() {
    const imported = this._getImported().equipment || [];
    return this._merge(this._srd.equipment, [], imported);
  },

  getEquipmentItem(key) {
    return this.getEquipment().find(i => i.key === key) || null;
  },

  getSkills() {
    return [...this._srd.skills];
  },

  getSkill(key) {
    return this._srd.skills.find(s => s.key === key) || null;
  }
};

export default DataRegistry;
