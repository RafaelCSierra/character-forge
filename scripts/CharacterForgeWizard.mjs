/**
 * CharacterForgeWizard — main ApplicationV2 wizard for creating a level-1
 * Player Character. Coordinates a sequence of Step modules (Identity, Race,
 * Class, Background, Abilities, Skills, Spells, Equipment, Review).
 *
 * State is a single `_data` object persisted to localStorage between sessions
 * (per the `cf-draft-character-forge-wizard` key). Each step is responsible
 * for reading its own slice of `_data`, capturing form values, and validating.
 */

import { MODULE_ID, MODULE_PATH, t, log } from "./utils.mjs";
import StepIdentity from "./steps/StepIdentity.mjs";
import StepRace from "./steps/StepRace.mjs";
import StepClass from "./steps/StepClass.mjs";
import StepAbilities from "./steps/StepAbilities.mjs";
import ActorBuilder from "./builders/ActorBuilder.mjs";
import CompendiumPackPicker from "./data/CompendiumPackPicker.mjs";
import {
  ABILITY_KEYS,
  POINT_BUY_MIN,
  POINT_BUY_MAX,
  POINT_BUY_BUDGET,
  pointBuyCost,
  pointBuyTotal,
  defaultPointBuyScores,
  emptyScores,
  rollSix
} from "./builders/AbilityScoreCalculator.mjs";

const { ApplicationV2 } = foundry.applications.api;

/** Build the initial empty `_data` object — single source of truth for the wizard. */
function emptyData() {
  return {
    // Identity
    name: "",
    alignment: "",
    portrait: "",
    // Race
    raceKey: "",
    subraceKey: "",
    raceAsiChoice: null,
    raceLanguageChoice: "",
    raceFeatChoice: "",
    // Class
    classKey: "",
    subclassKey: "",
    fightingStyle: "",
    classSkillChoices: [],
    // Background
    backgroundKey: "",
    backgroundSkillChoices: [],
    backgroundLangChoices: [],
    backgroundToolChoices: [],
    // Abilities
    abilityMethod: "point-buy",
    baseScores: { str: 8, dex: 8, con: 8, int: 8, wis: 8, cha: 8 },
    rolledArray: [],
    // Skills
    finalSkills: [],
    expertise: [],
    // Spells
    cantripsKnown: [],
    spellsKnown: [],
    spellsPrepared: [],
    spellbook: [],
    // Equipment
    startingEquipment: [],
    startingGold: 0,
    // Meta
    _version: 1,
    _stepReached: 0
  };
}

export default class CharacterForgeWizard extends ApplicationV2 {

  _currentStep = 0;
  _data = emptyData();
  _steps = [];
  _shouldScrollTop = false;
  _draftFadeTimeout = null;

  static DEFAULT_OPTIONS = {
    id: "character-forge-wizard",
    classes: ["cf-wizard"],
    tag: "div",
    window: {
      title: "CHARACTER_FORGE.Wizard.Title",
      resizable: true,
      icon: "fas fa-hammer",
      controls: [
        {
          action: "manage-packs",
          icon: "fas fa-folder-tree",
          label: "CHARACTER_FORGE.PackPicker.Open",
          visible: () => true
        }
      ]
    },
    position: {
      width: 720,
      height: 720
    },
    actions: {
      "step-next": CharacterForgeWizard._onStepNext,
      "step-back": CharacterForgeWizard._onStepBack,
      "step-jump": CharacterForgeWizard._onStepJump,
      "forge": CharacterForgeWizard._onForge,
      "clear": CharacterForgeWizard._onClear,
      "select-race": CharacterForgeWizard._onSelectRace,
      "select-subrace": CharacterForgeWizard._onSelectSubrace,
      "select-class": CharacterForgeWizard._onSelectClass,
      "select-ability-method": CharacterForgeWizard._onSelectAbilityMethod,
      "ability-inc": CharacterForgeWizard._onAbilityInc,
      "ability-dec": CharacterForgeWizard._onAbilityDec,
      "ability-roll": CharacterForgeWizard._onAbilityRoll,
      "manage-packs": CharacterForgeWizard._onManagePacks
    }
  };

  constructor(options = {}) {
    super(options);
    this._registerSteps();
    this._restoreDraft();
    // Refresh whenever the pack picker saves so new/removed content is
    // reflected immediately.
    this._packPickerHook = Hooks.on("character-forge:packPickerSaved", () => this.render());
  }

  async close(options) {
    if (this._packPickerHook) {
      Hooks.off("character-forge:packPickerSaved", this._packPickerHook);
      this._packPickerHook = null;
    }
    return super.close(options);
  }

  // ===========================================================================
  // Step registration — each step is an object exposing
  //   { id, labelKey, templatePath, isApplicable(data), getContext(data),
  //     captureData(rootEl, data), validate(data) }
  // ===========================================================================

  _registerSteps() {
    // Additional steps will be pushed here as implemented: StepBackground,
    // StepSkills, StepSpells, StepEquipment, StepReview.
    this._steps = [
      new StepIdentity(this),
      new StepRace(this),
      new StepClass(this),
      new StepAbilities(this)
    ];
  }

  /** Steps that apply to the current `_data` (e.g. StepSpells only for casters). */
  get _activeSteps() {
    return this._steps.filter(s => !s.isApplicable || s.isApplicable(this._data));
  }

  // ===========================================================================
  // Rendering
  // ===========================================================================

  async _renderHTML(context, options) {
    const wrapper = document.createElement("div");
    wrapper.classList.add("cf-wizard-body");

    const steps = this._activeSteps;
    const currentStep = steps[this._currentStep];

    // --- Step indicator bar ---
    const stepBar = document.createElement("div");
    stepBar.classList.add("cf-steps-bar");
    if (steps.length > 6) stepBar.classList.add("compact");
    for (let i = 0; i < steps.length; i++) {
      const indicator = document.createElement("div");
      indicator.classList.add("cf-step-indicator");
      if (i === this._currentStep) indicator.classList.add("active");
      if (i < this._currentStep) {
        indicator.classList.add("completed");
        indicator.dataset.action = "step-jump";
        indicator.dataset.step = String(i);
      }
      indicator.innerHTML = `<span class="cf-step-number">${i + 1}</span> ${t(steps[i].labelKey)}`;
      stepBar.appendChild(indicator);
    }

    // Draft saved indicator
    const draftIndicator = document.createElement("div");
    draftIndicator.classList.add("cf-draft-indicator");
    draftIndicator.textContent = t("CHARACTER_FORGE.DraftSaved");
    stepBar.appendChild(draftIndicator);

    wrapper.appendChild(stepBar);

    // --- Step content ---
    const stepsContainer = document.createElement("div");
    stepsContainer.classList.add("cf-steps-container");

    if (currentStep) {
      const ctx = currentStep.getContext(this._data);
      const html = await renderTemplate(currentStep.templatePath, ctx);
      const tempDiv = document.createElement("div");
      tempDiv.innerHTML = html;
      const section = tempDiv.firstElementChild;
      if (section) {
        section.classList.add("active");
        stepsContainer.appendChild(section);
      }
    }
    wrapper.appendChild(stepsContainer);

    // --- Navigation bar ---
    const nav = document.createElement("div");
    nav.classList.add("cf-wizard-nav");

    if (this._currentStep > 0) {
      const back = document.createElement("button");
      back.type = "button";
      back.dataset.action = "step-back";
      back.textContent = t("CHARACTER_FORGE.Nav.Back");
      nav.appendChild(back);
    } else {
      const reset = document.createElement("button");
      reset.type = "button";
      reset.classList.add("cf-reset-btn");
      reset.dataset.action = "clear";
      reset.innerHTML = `<i class="fas fa-undo"></i> ${t("CHARACTER_FORGE.Nav.Reset")}`;
      nav.appendChild(reset);
    }

    if (this._currentStep < steps.length - 1) {
      const next = document.createElement("button");
      next.type = "button";
      next.dataset.action = "step-next";
      next.textContent = t("CHARACTER_FORGE.Nav.Next");
      nav.appendChild(next);
    } else {
      const forge = document.createElement("button");
      forge.type = "button";
      forge.dataset.action = "forge";
      forge.classList.add("cf-forge-btn");
      forge.innerHTML = `<i class="fas fa-hammer"></i> ${t("CHARACTER_FORGE.Nav.Forge")}`;
      nav.appendChild(forge);
    }

    wrapper.appendChild(nav);
    return { wrapper };
  }

  _replaceHTML(result, content) {
    content.replaceChildren(result.wrapper);
  }

  _onRender(context, options) {
    if (this._shouldScrollTop) {
      const container = this.element?.querySelector(".cf-steps-container");
      if (container) container.scrollTop = 0;
      this._shouldScrollTop = false;
    }
  }

  // ===========================================================================
  // Data capture — delegate to the current step
  // ===========================================================================

  _captureCurrentStepData() {
    const root = this.element;
    if (!root) return;
    const step = this._activeSteps[this._currentStep];
    if (step?.captureData) step.captureData(root, this._data);
  }

  // ===========================================================================
  // Draft persistence
  // ===========================================================================

  get _storageKey() {
    return `cf-draft-${this.options.id}`;
  }

  _saveDraft() {
    try {
      localStorage.setItem(this._storageKey, JSON.stringify({
        data: this._data,
        step: this._currentStep
      }));
    } catch { /* ignore quota errors */ }

    const indicator = this.element?.querySelector(".cf-draft-indicator");
    if (indicator) {
      indicator.classList.add("visible");
      clearTimeout(this._draftFadeTimeout);
      this._draftFadeTimeout = setTimeout(() => {
        indicator.classList.remove("visible");
      }, 2000);
    }
  }

  _restoreDraft() {
    try {
      const raw = localStorage.getItem(this._storageKey);
      if (!raw) return;
      const draft = JSON.parse(raw);
      if (draft.data && typeof draft.data === "object") {
        // Merge — only known keys to avoid stale fields
        for (const key of Object.keys(this._data)) {
          if (key in draft.data) this._data[key] = draft.data[key];
        }
      }
      if (typeof draft.step === "number") this._currentStep = draft.step;
    } catch { /* ignore parse errors */ }
  }

  _clearDraft() {
    localStorage.removeItem(this._storageKey);
  }

  _resetWizard() {
    this._data = emptyData();
    this._currentStep = 0;
    this._clearDraft();
    this.render();
  }

  // ===========================================================================
  // Actions
  // ===========================================================================

  static _onStepJump(event, target) {
    const step = Number(target.closest("[data-step]")?.dataset.step);
    if (Number.isNaN(step) || step >= this._currentStep) return;
    this._captureCurrentStepData();
    this._currentStep = step;
    this._shouldScrollTop = true;
    this._saveDraft();
    this.render();
  }

  static _onStepNext(event, target) {
    this._captureCurrentStepData();
    const step = this._activeSteps[this._currentStep];
    if (step?.validate) {
      const res = step.validate(this._data);
      if (!res?.ok) {
        if (res?.error) ui.notifications.warn(t(res.error));
        return;
      }
    }
    if (this._currentStep < this._activeSteps.length - 1) {
      this._currentStep++;
      this._data._stepReached = Math.max(this._data._stepReached || 0, this._currentStep);
      this._shouldScrollTop = true;
      this._saveDraft();
      this.render();
    }
  }

  static _onStepBack(event, target) {
    this._captureCurrentStepData();
    if (this._currentStep > 0) {
      this._currentStep--;
      this._shouldScrollTop = true;
      this._saveDraft();
      this.render();
    }
  }

  static _onClear(event, target) {
    Dialog.confirm({
      title: t("CHARACTER_FORGE.ResetConfirmTitle"),
      content: `<p>${t("CHARACTER_FORGE.ResetConfirmContent")}</p>`,
      yes: () => this._resetWizard()
    });
  }

  static _onSelectRace(event, target) {
    const key = target.dataset.race;
    if (!key) return;
    this._captureCurrentStepData();
    this._data.raceKey = key;
    // Reset subrace when parent changes — keeps state consistent.
    this._data.subraceKey = "";
    this._saveDraft();
    this.render();
  }

  static _onSelectSubrace(event, target) {
    const key = target.dataset.subrace;
    if (!key) return;
    this._captureCurrentStepData();
    this._data.subraceKey = key;
    this._saveDraft();
    this.render();
  }

  // -------------------- Class step --------------------

  static _onSelectClass(event, target) {
    const key = target.dataset.class;
    if (!key) return;
    this._captureCurrentStepData();
    this._data.classKey = key;
    // Reset subclass when parent changes — keeps state consistent.
    this._data.subclassKey = "";
    this._saveDraft();
    this.render();
  }

  // -------------------- Abilities step --------------------

  static _onSelectAbilityMethod(event, target) {
    const method = target.dataset.method;
    if (!method) return;
    this._captureCurrentStepData();
    this._data.abilityMethod = method;
    // Reset scores so a half-finished assignment from one method doesn't
    // leak into another. Point-buy starts at the 8-across-the-board floor;
    // the others start unassigned.
    if (method === "point-buy") {
      this._data.baseScores = defaultPointBuyScores();
    } else {
      this._data.baseScores = emptyScores();
    }
    this._data.rolledArray = [];
    this._saveDraft();
    this.render();
  }

  static _onAbilityInc(event, target) {
    const ab = target.dataset.ability;
    if (!ab) return;
    const cur = this._data.baseScores?.[ab] ?? POINT_BUY_MIN;
    if (cur >= POINT_BUY_MAX) return;
    const next = cur + 1;
    const proposed = { ...this._data.baseScores, [ab]: next };
    if (pointBuyTotal(proposed) > POINT_BUY_BUDGET) return;
    this._data.baseScores[ab] = next;
    this._saveDraft();
    this.render();
  }

  static _onAbilityDec(event, target) {
    const ab = target.dataset.ability;
    if (!ab) return;
    const cur = this._data.baseScores?.[ab] ?? POINT_BUY_MIN;
    if (cur <= POINT_BUY_MIN) return;
    this._data.baseScores[ab] = cur - 1;
    this._saveDraft();
    this.render();
  }

  // -------------------- Compendium pack picker --------------------

  static _onManagePacks(event, target) {
    const picker = new CompendiumPackPicker();
    picker.render(true);
  }

  static async _onAbilityRoll(event, target) {
    const btn = target;
    if (btn) btn.disabled = true;
    try {
      const rolled = await rollSix();
      this._data.rolledArray = rolled;
      // Clear assignments so the user re-picks against the new dice.
      this._data.baseScores = emptyScores();
      this._saveDraft();
      this.render();
    } catch (err) {
      console.error("Character Forge | Roll failed:", err);
      if (btn) btn.disabled = false;
    }
  }

  static async _onForge(event, target) {
    this._captureCurrentStepData();
    // Run validation across all applicable steps
    for (const step of this._activeSteps) {
      const res = step.validate?.(this._data);
      if (res && !res.ok) {
        if (res.error) ui.notifications.warn(t(res.error));
        return;
      }
    }

    // Disable the forge button while we work to prevent double-submit.
    const forgeBtn = this.element?.querySelector('[data-action="forge"]');
    if (forgeBtn) {
      forgeBtn.disabled = true;
      forgeBtn.innerHTML = `<i class="fas fa-spinner fa-spin"></i> ${t("CHARACTER_FORGE.Nav.Forging")}`;
    }

    log("Forge requested with data:", this._data);
    try {
      const actor = await ActorBuilder.build(this._data);
      this._clearDraft();
      ui.notifications.info(t("CHARACTER_FORGE.Notify.ForgeSuccess", { name: actor.name }));
      // Open the resulting sheet so the user can verify / continue.
      actor.sheet?.render(true);
      this.close();
    } catch (err) {
      console.error("Character Forge | Forge failed:", err);
      ui.notifications.error(t("CHARACTER_FORGE.Notify.ForgeError"));
      if (forgeBtn) {
        forgeBtn.disabled = false;
        forgeBtn.innerHTML = `<i class="fas fa-hammer"></i> ${t("CHARACTER_FORGE.Nav.Forge")}`;
      }
    }
  }
}
