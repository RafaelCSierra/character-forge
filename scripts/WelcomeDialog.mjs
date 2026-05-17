/**
 * WelcomeDialog — one-shot dialog shown the first time a GM opens a
 * world with Character Forge installed. Explains the SRD-vs-compendium
 * content model, links to the Plutonium setup guide in the README, and
 * gives quick-action buttons to open the wizard or the pack picker.
 *
 * Dismissal writes `welcomeShown = true` to the world-scope setting,
 * so the dialog never auto-appears again. GMs can still trigger it
 * manually via the module API (game.modules.get("character-forge")
 * .api.openWelcomeDialog()).
 */

import { MODULE_ID, t } from "./utils.mjs";

const { ApplicationV2 } = foundry.applications.api;

const README_URL = "https://github.com/RafaelCSierra/character-forge#how-to-add-content-beyond-srd-plutonium-step-by-step";

export default class WelcomeDialog extends ApplicationV2 {

  static DEFAULT_OPTIONS = {
    id: "character-forge-welcome",
    classes: ["cf-welcome", "cf-wizard"],
    tag: "div",
    window: {
      title: "CHARACTER_FORGE.Welcome.Title",
      resizable: false,
      icon: "fas fa-hammer"
    },
    position: { width: 620, height: 620 },
    actions: {
      "open-wizard": WelcomeDialog._onOpenWizard,
      "open-packs": WelcomeDialog._onOpenPackPicker,
      "open-readme": WelcomeDialog._onOpenReadme,
      "dismiss": WelcomeDialog._onDismiss
    }
  };

  async _renderHTML(context, options) {
    const wrapper = document.createElement("div");
    wrapper.classList.add("cf-welcome-body");

    wrapper.innerHTML = `
      <div class="cf-welcome-hero">
        <i class="fas fa-hammer cf-welcome-icon"></i>
        <h2>${t("CHARACTER_FORGE.Welcome.Heading")}</h2>
        <p class="cf-welcome-sub">${t("CHARACTER_FORGE.Welcome.Sub")}</p>
      </div>

      <section class="cf-welcome-section">
        <h3><i class="fas fa-star"></i> ${t("CHARACTER_FORGE.Welcome.WhatTitle")}</h3>
        <ul>
          <li>${t("CHARACTER_FORGE.Welcome.WhatBullet1")}</li>
          <li>${t("CHARACTER_FORGE.Welcome.WhatBullet2")}</li>
          <li>${t("CHARACTER_FORGE.Welcome.WhatBullet3")}</li>
        </ul>
      </section>

      <section class="cf-welcome-section">
        <h3><i class="fas fa-book-open"></i> ${t("CHARACTER_FORGE.Welcome.ContentTitle")}</h3>
        <p>${t("CHARACTER_FORGE.Welcome.ContentSrd")}</p>
        <p>${t("CHARACTER_FORGE.Welcome.ContentBeyond")}</p>
      </section>

      <section class="cf-welcome-section cf-welcome-actions">
        <button type="button" class="cf-forge-btn" data-action="open-wizard">
          <i class="fas fa-hammer"></i> ${t("CHARACTER_FORGE.Welcome.ActionWizard")}
        </button>
        <button type="button" data-action="open-packs">
          <i class="fas fa-folder-tree"></i> ${t("CHARACTER_FORGE.Welcome.ActionPacks")}
        </button>
        <button type="button" data-action="open-readme">
          <i class="fab fa-github"></i> ${t("CHARACTER_FORGE.Welcome.ActionReadme")}
        </button>
      </section>

      <div class="cf-welcome-footer">
        <button type="button" class="cf-welcome-dismiss" data-action="dismiss">
          ${t("CHARACTER_FORGE.Welcome.Dismiss")}
        </button>
      </div>
    `;

    return { wrapper };
  }

  _replaceHTML(result, content) {
    content.replaceChildren(result.wrapper);
  }

  /** Mark welcome as seen and close. Called by every action except readme. */
  async _markSeenAndClose() {
    try {
      await game.settings.set(MODULE_ID, "welcomeShown", true);
    } catch (err) {
      console.error("Character Forge | Failed to update welcomeShown:", err);
    }
    this.close();
  }

  // -------- Actions --------

  static async _onOpenWizard() {
    await this._markSeenAndClose();
    const api = game.modules.get(MODULE_ID)?.api;
    api?.openCreationWizard?.();
  }

  static async _onOpenPackPicker() {
    await this._markSeenAndClose();
    // Lazy import to avoid a tight circular dependency.
    const { default: CompendiumPackPicker } = await import("./data/CompendiumPackPicker.mjs");
    new CompendiumPackPicker().render(true);
  }

  static _onOpenReadme() {
    // Don't auto-dismiss — user may come back. Just open the link.
    window.open(README_URL, "_blank", "noopener");
  }

  static async _onDismiss() {
    await this._markSeenAndClose();
  }
}
