/**
 * CompendiumPackPicker — ApplicationV2 dialog that lists every Item
 * compendium pack installed in the world and lets the GM check/uncheck
 * which ones the wizard should pull race / class / background / spell /
 * feat / item cards from.
 *
 * Selections are saved to the `character-forge.compendiumPacksDisabled`
 * setting (an object mapping packId → true for disabled). After save,
 * the CompendiumScanner re-runs and a hook fires so any open wizard
 * re-renders with the new merged content.
 */

import { MODULE_ID, MODULE_PATH, t, log } from "../utils.mjs";
import CompendiumScanner from "./CompendiumScanner.mjs";

const { ApplicationV2 } = foundry.applications.api;

const RELEVANT_TYPES = ["race", "class", "subclass", "background", "feat", "spell"];

export default class CompendiumPackPicker extends ApplicationV2 {

  static DEFAULT_OPTIONS = {
    id: "character-forge-pack-picker",
    classes: ["cf-pack-picker", "cf-wizard"],
    tag: "div",
    window: {
      title: "CHARACTER_FORGE.PackPicker.Title",
      resizable: true,
      icon: "fas fa-folder-tree"
    },
    position: {
      width: 560,
      height: 620
    },
    actions: {
      "toggle-pack": CompendiumPackPicker._onTogglePack,
      "select-all": CompendiumPackPicker._onSelectAll,
      "select-none": CompendiumPackPicker._onSelectNone,
      "save": CompendiumPackPicker._onSave,
      "cancel": CompendiumPackPicker._onCancel
    }
  };

  /** Per-pack metadata + type counts, cached after first render. */
  _rows = null;

  /** Set of disabled pack IDs (mutated on toggle, written on save). */
  _disabled = new Set();

  constructor(options = {}) {
    super(options);
    this._loadDisabled();
  }

  _loadDisabled() {
    try {
      const obj = game.settings.get(MODULE_ID, "compendiumPacksDisabled") || {};
      this._disabled = new Set(Object.keys(obj).filter(k => obj[k] === true));
    } catch {
      this._disabled = new Set();
    }
  }

  /** Build per-pack rows (lazy — only once per dialog session). */
  async _buildRows() {
    if (this._rows) return this._rows;
    const rows = [];
    const itemPacks = game.packs.filter(p => p.documentName === "Item");
    for (const pack of itemPacks) {
      let counts = {};
      let total = 0;
      try {
        const index = await pack.getIndex({ fields: ["type"] });
        for (const entry of index) {
          if (!RELEVANT_TYPES.includes(entry.type)) continue;
          counts[entry.type] = (counts[entry.type] || 0) + 1;
          total++;
        }
      } catch (err) {
        console.warn("Character Forge | Pack indexing failed:", pack.collection, err);
      }
      rows.push({
        id: pack.collection,
        label: pack.metadata?.label || pack.collection,
        counts,
        total
      });
    }
    // Sort: packs with content first (descending total), then by label
    rows.sort((a, b) => {
      if (a.total !== b.total) return b.total - a.total;
      return a.label.localeCompare(b.label);
    });
    this._rows = rows;
    return rows;
  }

  async _renderHTML(context, options) {
    const wrapper = document.createElement("div");
    wrapper.classList.add("cf-pack-picker-body");

    const rows = await this._buildRows();

    // -- Header / instructions
    const header = document.createElement("div");
    header.classList.add("cf-pack-picker-header");
    header.innerHTML = `
      <p class="cf-step-description">${t("CHARACTER_FORGE.PackPicker.Help")}</p>
      <div class="cf-pack-picker-toolbar">
        <button type="button" data-action="select-all">${t("CHARACTER_FORGE.PackPicker.SelectAll")}</button>
        <button type="button" data-action="select-none">${t("CHARACTER_FORGE.PackPicker.SelectNone")}</button>
        <span class="cf-pack-picker-count">${rows.filter(r => !this._disabled.has(r.id)).length} / ${rows.length} ${t("CHARACTER_FORGE.PackPicker.Enabled")}</span>
      </div>
    `;
    wrapper.appendChild(header);

    // -- Rows list
    const list = document.createElement("div");
    list.classList.add("cf-pack-picker-list");

    for (const row of rows) {
      const item = document.createElement("div");
      item.classList.add("cf-pack-row");
      if (row.total === 0) item.classList.add("empty");
      const enabled = !this._disabled.has(row.id);
      if (enabled) item.classList.add("enabled");

      const countParts = RELEVANT_TYPES
        .filter(typ => row.counts[typ])
        .map(typ => `<span class="cf-pack-count-chip" data-type="${typ}">${row.counts[typ]} ${t("CHARACTER_FORGE.PackPicker.Type." + typ)}</span>`)
        .join("");

      item.innerHTML = `
        <label class="cf-pack-row-toggle">
          <input type="checkbox"
                 ${enabled ? "checked" : ""}
                 data-action="toggle-pack"
                 data-pack="${row.id}">
          <span class="cf-pack-row-label">${row.label}</span>
          <span class="cf-pack-row-id">${row.id}</span>
        </label>
        <div class="cf-pack-counts">${countParts || `<span class="cf-muted">${t("CHARACTER_FORGE.PackPicker.NoRelevantItems")}</span>`}</div>
      `;
      list.appendChild(item);
    }

    wrapper.appendChild(list);

    // -- Footer
    const footer = document.createElement("div");
    footer.classList.add("cf-pack-picker-footer");
    footer.innerHTML = `
      <button type="button" data-action="cancel">${t("CHARACTER_FORGE.PackPicker.Cancel")}</button>
      <button type="button" class="cf-forge-btn" data-action="save">
        <i class="fas fa-save"></i> ${t("CHARACTER_FORGE.PackPicker.Save")}
      </button>
    `;
    wrapper.appendChild(footer);

    return { wrapper };
  }

  _replaceHTML(result, content) {
    content.replaceChildren(result.wrapper);
  }

  // ---------------------------------------------------------------------
  // Actions
  // ---------------------------------------------------------------------

  static _onTogglePack(event, target) {
    const id = target.dataset.pack;
    if (!id) return;
    if (this._disabled.has(id)) this._disabled.delete(id);
    else this._disabled.add(id);
    this.render();
  }

  static _onSelectAll() {
    this._disabled.clear();
    this.render();
  }

  static _onSelectNone() {
    for (const row of this._rows || []) {
      if (row.total > 0) this._disabled.add(row.id);
    }
    this.render();
  }

  static async _onSave() {
    const obj = {};
    for (const id of this._disabled) obj[id] = true;
    await game.settings.set(MODULE_ID, "compendiumPacksDisabled", obj);
    try {
      await CompendiumScanner.scan();
    } catch (err) {
      console.error("Character Forge | Re-scan after pack toggle failed:", err);
    }
    log(`Pack picker saved. Disabled packs: ${this._disabled.size}`);
    Hooks.callAll("character-forge:packPickerSaved");
    ui.notifications.info(t("CHARACTER_FORGE.PackPicker.Saved"));
    this.close();
  }

  static _onCancel() {
    this.close();
  }
}
