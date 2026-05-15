/**
 * StepIdentity — first wizard step. Collects character name, alignment,
 * and an optional portrait path.
 *
 * Each step exposes the same shape so CharacterForgeWizard can iterate
 * over `this._steps` uniformly:
 *   { id, labelKey, templatePath, isApplicable?, getContext, captureData, validate }
 */

import { MODULE_PATH } from "../utils.mjs";

const ALIGNMENTS = [
  { key: "lawful-good",     labelKey: "CHARACTER_FORGE.Alignment.LawfulGood" },
  { key: "neutral-good",    labelKey: "CHARACTER_FORGE.Alignment.NeutralGood" },
  { key: "chaotic-good",    labelKey: "CHARACTER_FORGE.Alignment.ChaoticGood" },
  { key: "lawful-neutral",  labelKey: "CHARACTER_FORGE.Alignment.LawfulNeutral" },
  { key: "true-neutral",    labelKey: "CHARACTER_FORGE.Alignment.TrueNeutral" },
  { key: "chaotic-neutral", labelKey: "CHARACTER_FORGE.Alignment.ChaoticNeutral" },
  { key: "lawful-evil",     labelKey: "CHARACTER_FORGE.Alignment.LawfulEvil" },
  { key: "neutral-evil",    labelKey: "CHARACTER_FORGE.Alignment.NeutralEvil" },
  { key: "chaotic-evil",    labelKey: "CHARACTER_FORGE.Alignment.ChaoticEvil" }
];

export default class StepIdentity {

  constructor(wizard) {
    this.wizard = wizard;
  }

  get id() { return "identity"; }
  get labelKey() { return "CHARACTER_FORGE.Step.Identity"; }
  get templatePath() {
    return `modules/${MODULE_PATH}/templates/step-identity.hbs`;
  }

  isApplicable() { return true; }

  getContext(data) {
    return {
      name: data.name || "",
      alignment: data.alignment || "",
      portrait: data.portrait || "",
      alignments: ALIGNMENTS
    };
  }

  captureData(root, data) {
    const nameEl = root.querySelector('[name="name"]');
    if (nameEl) data.name = nameEl.value;
    const alignEl = root.querySelector('[name="alignment"]');
    if (alignEl) data.alignment = alignEl.value;
    const portraitEl = root.querySelector('[name="portrait"]');
    if (portraitEl) data.portrait = portraitEl.value;
  }

  validate(data) {
    if (!data.name?.trim()) {
      return { ok: false, error: "CHARACTER_FORGE.Notify.NoName" };
    }
    return { ok: true };
  }
}
