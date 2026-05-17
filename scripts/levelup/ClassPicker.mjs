/**
 * ClassPicker — level-up choice dialog.
 *
 * Presents two paths:
 *
 *   1. "Continue your current class" — one card per class the actor
 *      already has, showing current → next level. Click to confirm.
 *
 *   2. "Take a level in a new class (multiclass)" — list of registry
 *      classes the actor does NOT yet have, each with the PHB multiclass
 *      ability prerequisite. If the actor doesn't meet the prereq, the
 *      card is dimmed with a tooltip explaining why, but still clickable
 *      (the table can choose to ignore the rule).
 *
 * On confirm, defers to AdvancementBridge, which mutates the actor in
 * a way that triggers dnd5e's native AdvancementManager.
 */

import { MODULE_ID, MODULE_PATH, t, log, warn } from "../utils.mjs";
import DataRegistry from "../data/DataRegistry.mjs";
import AdvancementBridge from "./AdvancementBridge.mjs";

const { ApplicationV2 } = foundry.applications.api;

// PHB 2014 multiclass prerequisites, keyed by class identifier.
// The `_any` flag means satisfying ANY one of the listed thresholds
// is enough (Fighter: Str 13 OR Dex 13). Otherwise all must be met.
const MULTICLASS_PREREQS = {
  barbarian: { str: 13 },
  bard: { cha: 13 },
  cleric: { wis: 13 },
  druid: { wis: 13 },
  fighter: { _any: true, str: 13, dex: 13 },
  monk: { dex: 13, wis: 13 },
  paladin: { str: 13, cha: 13 },
  ranger: { dex: 13, wis: 13 },
  rogue: { dex: 13 },
  sorcerer: { cha: 13 },
  warlock: { cha: 13 },
  wizard: { int: 13 }
};

/** Normalise an actor.items class entry into a compact descriptor. */
function describeClassItem(item) {
  const ident = item.system?.identifier || item.name?.toLowerCase().replace(/\s+/g, "-") || "";
  return {
    id: item.id,
    name: item.name,
    identifier: ident,
    level: item.system?.levels || 1,
    img: item.img || null
  };
}

/** Check whether the actor meets the PHB 2014 multiclass prereq for a
 *  class identifier. Returns `{ ok, hint }` where hint is the human
 *  prerequisite string ("STR 13" / "STR 13 or DEX 13" / "STR 13 and CHA 13"). */
function checkPrereq(actor, identifier) {
  const req = MULTICLASS_PREREQS[identifier];
  if (!req) return { ok: true, hint: "" };

  const abilities = actor.system?.abilities || {};
  const fmt = (k, v) => `${k.toUpperCase()} ${v}`;
  const entries = Object.entries(req).filter(([k]) => k !== "_any");

  if (req._any) {
    const ok = entries.some(([k, v]) => (abilities[k]?.value || 0) >= v);
    return { ok, hint: entries.map(([k, v]) => fmt(k, v)).join(" or ") };
  }
  const ok = entries.every(([k, v]) => (abilities[k]?.value || 0) >= v);
  return { ok, hint: entries.map(([k, v]) => fmt(k, v)).join(" and ") };
}

export default class ClassPicker extends ApplicationV2 {

  static DEFAULT_OPTIONS = {
    id: "character-forge-class-picker",
    classes: ["cf-class-picker", "cf-wizard"],
    tag: "div",
    window: {
      title: "CHARACTER_FORGE.LevelUp.Title",
      resizable: false,
      icon: "fas fa-arrow-up"
    },
    position: { width: 580, height: 640 },
    actions: {
      "pick-existing": ClassPicker._onPickExisting,
      "pick-new": ClassPicker._onPickNew,
      "confirm": ClassPicker._onConfirm,
      "cancel": ClassPicker._onCancel
    }
  };

  /** @type {Actor} */
  actor = null;
  /** Selected actor.items[].id for the "continue" path. */
  _selectedExistingId = null;
  /** Selected registry key for the "multiclass" path. */
  _selectedNewKey = null;

  constructor(options = {}) {
    super(options);
    this.actor = options.actor;
    if (!this.actor) {
      throw new Error("ClassPicker requires an `actor` option");
    }
  }

  /** Override window title to include the actor name. */
  get title() {
    const base = t("CHARACTER_FORGE.LevelUp.Title");
    return `${base} — ${this.actor.name}`;
  }

  async _renderHTML(context, options) {
    const wrapper = document.createElement("div");
    wrapper.classList.add("cf-class-picker-body");

    const actorClasses = (this.actor.items?.contents || [])
      .filter(i => i.type === "class")
      .map(describeClassItem);
    const ownedIdentifiers = new Set(actorClasses.map(c => c.identifier));
    const totalLevels = actorClasses.reduce((s, c) => s + c.level, 0);

    const allowMulticlass = (() => {
      try {
        return game.settings.get(MODULE_ID, "allowMulticlass");
      } catch { return true; }
    })();

    // ----------------------------------------------------------------- intro
    const intro = document.createElement("div");
    intro.classList.add("cf-class-picker-intro");
    intro.innerHTML = `<p class="cf-step-description">${t("CHARACTER_FORGE.LevelUp.Help")}</p>
      <p class="cf-help cf-muted">${t("CHARACTER_FORGE.LevelUp.TotalLevel", { n: totalLevels })}</p>`;
    wrapper.appendChild(intro);

    // ----------------------------------------------- Existing classes section
    if (actorClasses.length > 0) {
      const section = document.createElement("fieldset");
      section.classList.add("cf-fieldset");
      section.innerHTML = `<legend>${t("CHARACTER_FORGE.LevelUp.ContinueTitle")}</legend>`;

      const grid = document.createElement("div");
      grid.classList.add("cf-class-grid");
      for (const cls of actorClasses) {
        const card = document.createElement("button");
        card.type = "button";
        card.classList.add("cf-class-card");
        if (cls.id === this._selectedExistingId) card.classList.add("selected");
        card.dataset.action = "pick-existing";
        card.dataset.classId = cls.id;
        const next = cls.level + 1;
        card.innerHTML = `
          <div class="cf-class-card-header">
            ${cls.img ? `<img class="cf-class-card-img" src="${cls.img}" alt="">` : ""}
            <span class="cf-class-card-name">${cls.name}</span>
          </div>
          <div class="cf-class-card-stats">
            <span class="cf-class-stat">${t("CHARACTER_FORGE.LevelUp.CurrentLevel", { n: cls.level })}</span>
          </div>
          <div class="cf-levelup-next">${t("CHARACTER_FORGE.LevelUp.Arrow")} ${t("CHARACTER_FORGE.LevelUp.NextLevel", { n: next })}</div>
        `;
        grid.appendChild(card);
      }
      section.appendChild(grid);
      wrapper.appendChild(section);
    }

    // ------------------------------------------------------ Multiclass section
    if (allowMulticlass) {
      const allClasses = DataRegistry.getClasses();
      const candidates = allClasses
        .filter(c => {
          // Compendium classes use compound keys, so identifier comparison
          // uses their identifier/system field. SRD classes use their slug.
          const ident = c.identifier || c.key;
          return !ownedIdentifiers.has(ident);
        });

      const section = document.createElement("fieldset");
      section.classList.add("cf-fieldset");
      section.innerHTML = `<legend>${t("CHARACTER_FORGE.LevelUp.MulticlassTitle")}</legend>
        <p class="cf-help">${t("CHARACTER_FORGE.LevelUp.MulticlassHelp")}</p>`;

      const grid = document.createElement("div");
      grid.classList.add("cf-class-grid");

      for (const c of candidates) {
        const identifier = c.identifier || c.key;
        const prereq = checkPrereq(this.actor, identifier);
        const card = document.createElement("button");
        card.type = "button";
        card.classList.add("cf-class-card");
        if (c.source === "compendium") card.classList.add("cf-class-card-compendium");
        if (!prereq.ok) card.classList.add("cf-class-card-warn");
        if (c.key === this._selectedNewKey) card.classList.add("selected");
        card.dataset.action = "pick-new";
        card.dataset.classKey = c.key;
        if (prereq.hint) {
          card.dataset.tooltip = prereq.ok
            ? t("CHARACTER_FORGE.LevelUp.PrereqMet", { hint: prereq.hint })
            : t("CHARACTER_FORGE.LevelUp.PrereqUnmet", { hint: prereq.hint });
        }
        card.innerHTML = `
          <div class="cf-class-card-header">
            ${c.img ? `<img class="cf-class-card-img" src="${c.img}" alt="">` : ""}
            <span class="cf-class-card-name">${c.name}</span>
          </div>
          ${prereq.hint
            ? `<div class="cf-class-card-stats"><span class="cf-class-stat">${t("CHARACTER_FORGE.LevelUp.PrereqShort")}: ${prereq.hint}</span></div>`
            : ""}
          ${c._packLabel ? `<div class="cf-class-card-source">${c._packLabel}</div>` : ""}
        `;
        grid.appendChild(card);
      }
      if (!candidates.length) {
        const empty = document.createElement("p");
        empty.classList.add("cf-step-empty");
        empty.textContent = t("CHARACTER_FORGE.LevelUp.NoMulticlassOptions");
        section.appendChild(empty);
      } else {
        section.appendChild(grid);
      }
      wrapper.appendChild(section);
    }

    // ---------------------------------------------------------------- footer
    const footer = document.createElement("div");
    footer.classList.add("cf-class-picker-footer");

    const hasSelection = !!(this._selectedExistingId || this._selectedNewKey);
    const summary = document.createElement("div");
    summary.classList.add("cf-class-picker-summary");
    if (this._selectedExistingId) {
      const item = this.actor.items.get(this._selectedExistingId);
      if (item) {
        const cur = item.system?.levels || 1;
        summary.textContent = t("CHARACTER_FORGE.LevelUp.SummaryExisting", {
          name: item.name, from: cur, to: cur + 1
        });
      }
    } else if (this._selectedNewKey) {
      const cls = DataRegistry.getClass(this._selectedNewKey);
      if (cls) summary.textContent = t("CHARACTER_FORGE.LevelUp.SummaryNew", { name: cls.name });
    } else {
      summary.classList.add("cf-muted");
      summary.textContent = t("CHARACTER_FORGE.LevelUp.NoSelection");
    }
    footer.appendChild(summary);

    const cancel = document.createElement("button");
    cancel.type = "button";
    cancel.dataset.action = "cancel";
    cancel.textContent = t("CHARACTER_FORGE.LevelUp.Cancel");
    footer.appendChild(cancel);

    const confirm = document.createElement("button");
    confirm.type = "button";
    confirm.dataset.action = "confirm";
    confirm.classList.add("cf-forge-btn");
    confirm.disabled = !hasSelection;
    confirm.innerHTML = `<i class="fas fa-arrow-up"></i> ${t("CHARACTER_FORGE.LevelUp.Confirm")}`;
    footer.appendChild(confirm);

    wrapper.appendChild(footer);
    return { wrapper };
  }

  _replaceHTML(result, content) {
    content.replaceChildren(result.wrapper);
  }

  // -------------------------------------------------------------- actions

  static _onPickExisting(event, target) {
    const id = target.dataset.classId;
    if (!id) return;
    this._selectedExistingId = id;
    this._selectedNewKey = null;
    this.render();
  }

  static _onPickNew(event, target) {
    const key = target.dataset.classKey;
    if (!key) return;
    this._selectedNewKey = key;
    this._selectedExistingId = null;
    this.render();
  }

  static async _onConfirm() {
    const btn = this.element?.querySelector('[data-action="confirm"]');
    if (btn) {
      btn.disabled = true;
      btn.innerHTML = `<i class="fas fa-spinner fa-spin"></i> ${t("CHARACTER_FORGE.LevelUp.Working")}`;
    }
    try {
      if (this._selectedExistingId) {
        await AdvancementBridge.advanceExisting(this.actor, this._selectedExistingId);
      } else if (this._selectedNewKey) {
        await AdvancementBridge.advanceMulticlass(this.actor, this._selectedNewKey);
      } else {
        return;
      }
      ui.notifications.info(t("CHARACTER_FORGE.LevelUp.Triggered"));
      this.close();
    } catch (err) {
      console.error("Character Forge | Level-up failed:", err);
      ui.notifications.error(t("CHARACTER_FORGE.LevelUp.Error"));
      if (btn) {
        btn.disabled = false;
        btn.innerHTML = `<i class="fas fa-arrow-up"></i> ${t("CHARACTER_FORGE.LevelUp.Confirm")}`;
      }
    }
  }

  static _onCancel() {
    this.close();
  }
}
