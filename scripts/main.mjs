/**
 * Character Forge — main entry point.
 * Registers settings, hooks, and singletons for the creation/level-up wizards.
 */

import { MODULE_ID, MODULE_PATH, t, log, warn, checkSystemCompatibility } from "./utils.mjs";
import CharacterForgeWizard from "./CharacterForgeWizard.mjs";
import SrdLoader from "./data/SrdLoader.mjs";
import CompendiumScanner from "./data/CompendiumScanner.mjs";
import { attachLevelUpButton, openLevelUpWizard } from "./levelup/LevelUpButton.mjs";
import WelcomeDialog from "./WelcomeDialog.mjs";
import ActorBuilder from "./builders/ActorBuilder.mjs";

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

  // Map of pack collection ID → true when the user has explicitly disabled
  // it from being scanned for races/classes/etc. Default: all packs scanned.
  // Configured later via a future "Pack picker" dialog.
  game.settings.register(MODULE_ID, "compendiumPacksDisabled", {
    scope: "world",
    config: false,
    type: Object,
    default: {}
  });

  // Preload Handlebars templates used by the wizard.
  // (The wizard shell itself is built programmatically; only step content
  // templates need to be preloaded.)
  loadTemplates([
    `modules/${MODULE_PATH}/templates/step-identity.hbs`,
    `modules/${MODULE_PATH}/templates/step-race.hbs`,
    `modules/${MODULE_PATH}/templates/step-class.hbs`,
    `modules/${MODULE_PATH}/templates/step-background.hbs`,
    `modules/${MODULE_PATH}/templates/step-abilities.hbs`,
    `modules/${MODULE_PATH}/templates/step-equipment.hbs`,
    `modules/${MODULE_PATH}/templates/step-review.hbs`
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

  // Scan installed compendium packs for races/classes/etc.
  // Failure here is non-fatal — wizard still works with SRD-only content.
  try {
    await CompendiumScanner.scan();
  } catch (err) {
    console.error("Character Forge | Compendium scan failed:", err);
  }

  // Draft notification — one-shot if user left a draft mid-creation last session.
  // Key must match CharacterForgeWizard._storageKey: `cf-draft-${options.id}`.
  const draftKey = "cf-draft-character-forge-wizard";
  if (localStorage.getItem(draftKey)) {
    setTimeout(() => {
      ui.notifications.info(t("CHARACTER_FORGE.Notify.DraftPending"));
    }, 3000);
  }

  // First-run welcome dialog — only for GMs, only when never shown.
  // GMs in fresh worlds get a quick orientation about SRD vs compendium
  // content; players never see it.
  try {
    const alreadyShown = game.settings.get(MODULE_ID, "welcomeShown");
    if (!alreadyShown && game.user?.isGM) {
      // Small delay so the welcome appears AFTER the SRD/compat
      // notifications, not before them.
      setTimeout(() => new WelcomeDialog().render(true), 1500);
    }
  } catch (err) {
    console.error("Character Forge | Welcome check failed:", err);
  }

  log("Module ready.");
});

// =============================================================================
// Sidebar button — Actor Directory
// =============================================================================

// =============================================================================
// Level-up button — injected into every character sheet
// =============================================================================

// We cover both render hook variants:
//   - "renderActorSheet" fires for V1 sheets (legacy or other modules)
//   - "renderActorSheet5eCharacter2" fires for the dnd5e v5+ V2 sheet
// attachLevelUpButton is idempotent so getting the hook twice is harmless.
Hooks.on("renderActorSheet", (app, html) => attachLevelUpButton(app, html));
Hooks.on("renderActorSheet5eCharacter2", (app, html) => attachLevelUpButton(app, html));

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
    openCreationWizard,
    openLevelUpWizard,
    openWelcomeDialog: () => new WelcomeDialog().render(true),

    /**
     * Console diagnostic: dump key fields of an actor so the user can
     * tell at a glance whether class / race / background got embedded
     * and whether HP got set.
     *
     *   game.modules.get("character-forge").api.diagnoseActor("lLVE...")
     */
    diagnoseActor(id) {
      const actor = id?.documentName ? id : game.actors.get(id);
      if (!actor) {
        console.warn("Character Forge | Actor not found:", id);
        return null;
      }
      const items = actor.items.contents.map(i => ({
        type: i.type,
        name: i.name,
        id: i.id,
        identifier: i.system?.identifier,
        levels: i.system?.levels,
        advancements: (i.system?.advancement || []).length
      }));
      const report = {
        name: actor.name,
        type: actor.type,
        hp: foundry.utils.deepClone(actor.system?.attributes?.hp || {}),
        abilities: Object.fromEntries(
          Object.entries(actor.system?.abilities || {}).map(([k, v]) => [k, { value: v.value, mod: v.mod }])
        ),
        items
      };
      console.log(`Character Forge | Diagnose ${actor.name}:`, report);
      return report;
    },

    /**
     * Console repair: apply the same HP-fallback the ActorBuilder runs
     * at forge time. Useful for actors created with v0.12.0 or earlier
     * (or whenever the AdvancementManager was cancelled mid-flow).
     *
     *   await game.modules.get("character-forge").api.repairActor("lLVE...")
     */
    async repairActor(id) {
      const actor = id?.documentName ? id : game.actors.get(id);
      if (!actor) {
        console.warn("Character Forge | Actor not found:", id);
        return false;
      }
      const fixed = await ActorBuilder.applyHpFallback(actor);
      console.log(`Character Forge | Repair ${actor.name}:`, fixed ? "HP set" : "no change needed");
      return fixed;
    }
  };
});
