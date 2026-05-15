/**
 * Character Forge — main entry point.
 * Registers settings, hooks, and singletons for the creation/level-up wizards.
 */

import { MODULE_ID, MODULE_PATH, t, log, warn, checkSystemCompatibility } from "./utils.mjs";
import CharacterForgeWizard from "./CharacterForgeWizard.mjs";
import SrdLoader from "./data/SrdLoader.mjs";

// =============================================================================
// Singletons
// =============================================================================

let wizardInstance = null;

function openCreationWizard() {
  if (!wizardInstance) {
    wizardInstance = new CharacterForgeWizard();
    wizardInstance.addEventListener("close", () => {
      wizardInstance = null;
    });
  }
  wizardInstance.render(true);
}

// =============================================================================
// Init — settings, templates
// =============================================================================

Hooks.once("init", () => {
  log("Initializing.");

  game.settings.register(MODULE_ID, "defaultAbilityMethod", {
    name: t("CHARACTER_FORGE.Settings.DefaultAbilityMethod"),
    hint: t("CHARACTER_FORGE.Settings.DefaultAbilityMethodHint"),
    scope: "world",
    config: true,
    type: String,
    default: "point-buy",
    choices: {
      "point-buy": "CHARACTER_FORGE.Abilities.Method.PointBuy",
      "standard-array": "CHARACTER_FORGE.Abilities.Method.StandardArray",
      "roll": "CHARACTER_FORGE.Abilities.Method.Roll"
    }
  });

  game.settings.register(MODULE_ID, "allowMulticlass", {
    name: t("CHARACTER_FORGE.Settings.AllowMulticlass"),
    hint: t("CHARACTER_FORGE.Settings.AllowMulticlassHint"),
    scope: "world",
    config: true,
    type: Boolean,
    default: true
  });

  game.settings.register(MODULE_ID, "allowFeatAtLevel1", {
    name: t("CHARACTER_FORGE.Settings.AllowFeatAtLevel1"),
    hint: t("CHARACTER_FORGE.Settings.AllowFeatAtLevel1Hint"),
    scope: "world",
    config: true,
    type: Boolean,
    default: false
  });

  game.settings.register(MODULE_ID, "importedContent", {
    scope: "world",
    config: false,
    type: Object,
    default: {}
  });

  game.settings.register(MODULE_ID, "importedOverridesSrd", {
    name: t("CHARACTER_FORGE.Settings.ImportedOverridesSrd"),
    hint: t("CHARACTER_FORGE.Settings.ImportedOverridesSrdHint"),
    scope: "world",
    config: true,
    type: Boolean,
    default: true
  });

  game.settings.register(MODULE_ID, "autoTickXp", {
    name: t("CHARACTER_FORGE.Settings.AutoTickXp"),
    hint: t("CHARACTER_FORGE.Settings.AutoTickXpHint"),
    scope: "world",
    config: true,
    type: Boolean,
    default: false
  });

  game.settings.register(MODULE_ID, "welcomeShown", {
    scope: "world",
    config: false,
    type: Boolean,
    default: false
  });

  // Preload Handlebars templates used by the wizard.
  // (The wizard shell itself is built programmatically; only step content
  // templates need to be preloaded.)
  loadTemplates([
    `modules/${MODULE_PATH}/templates/step-identity.hbs`,
    `modules/${MODULE_PATH}/templates/step-race.hbs`
  ]);
});

// =============================================================================
// Ready — load SRD, compatibility check, draft notification
// =============================================================================

Hooks.once("ready", async () => {
  const compat = checkSystemCompatibility("5.2.0");
  if (!compat.ok) {
    if (compat.reason === "wrongSystem") {
      warn("Active system is not dnd5e; Character Forge will not be available.");
      ui.notifications.warn(t("CHARACTER_FORGE.Notify.WrongSystem"));
      return;
    }
    if (compat.reason === "oldVersion") {
      warn(`dnd5e ${compat.current} is older than required ${compat.required}.`);
      ui.notifications.warn(
        t("CHARACTER_FORGE.Notify.OldSystem", { current: compat.current, required: compat.required })
      );
    }
  }

  try {
    await SrdLoader.load();
    log("SRD data loaded.");
  } catch (err) {
    console.error("Character Forge | Failed to load SRD data:", err);
    ui.notifications.error(t("CHARACTER_FORGE.Notify.SrdLoadError"));
  }

  // Draft notification — one-shot if user left a draft mid-creation last session.
  // Key must match CharacterForgeWizard._storageKey: `cf-draft-${options.id}`.
  const draftKey = "cf-draft-character-forge-wizard";
  if (localStorage.getItem(draftKey)) {
    setTimeout(() => {
      ui.notifications.info(t("CHARACTER_FORGE.Notify.DraftPending"));
    }, 3000);
  }

  log("Module ready.");
});

// =============================================================================
// Sidebar button — Actor Directory
// =============================================================================

Hooks.on("renderActorDirectory", (app, html) => {
  const root = html instanceof HTMLElement ? html : html?.[0];
  if (!root) return;

  const headerActions = root.querySelector(".header-actions");
  if (!headerActions) return;
  if (headerActions.querySelector(".cf-sidebar-btn")) return; // idempotent

  const btn = document.createElement("button");
  btn.type = "button";
  btn.classList.add("cf-sidebar-btn");
  btn.innerHTML = `<i class="fas fa-hammer"></i> ${t("CHARACTER_FORGE.Button")}`;
  btn.dataset.tooltip = t("CHARACTER_FORGE.ButtonHint");
  btn.addEventListener("click", (ev) => {
    ev.preventDefault();
    openCreationWizard();
  });

  headerActions.appendChild(btn);
});

// =============================================================================
// Expose API for external/manual triggering and future level-up button
// =============================================================================

Hooks.once("ready", () => {
  const mod = game.modules.get(MODULE_ID);
  if (!mod) return;
  mod.api = {
    openCreationWizard
  };
});
