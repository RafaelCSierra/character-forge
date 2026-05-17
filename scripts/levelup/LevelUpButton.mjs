/**
 * LevelUpButton — injects a "Level Up" button into the actor sheet's
 * window header for any character (`actor.type === "character"`).
 *
 * One ClassPicker instance is kept per actor in a Map, so reopening
 * the wizard for the same character re-renders the existing dialog
 * instead of stacking duplicates.
 */

import { MODULE_ID, t, log } from "../utils.mjs";
import ClassPicker from "./ClassPicker.mjs";

/** Map<actorId, ClassPicker> — singleton per actor. */
const pickerInstances = new Map();

export function openLevelUpWizard(actor) {
  if (!actor) return;
  const existing = pickerInstances.get(actor.id);
  if (existing && existing.rendered) {
    existing.bringToFront?.();
    return;
  }
  const picker = new ClassPicker({ actor });
  picker.addEventListener("close", () => pickerInstances.delete(actor.id));
  pickerInstances.set(actor.id, picker);
  picker.render(true);
}

/**
 * Attach the button to a sheet that just rendered. Works for both V1
 * actor sheets and dnd5e v5+ ActorSheet5eCharacter2 (V2). The button
 * is inserted before the existing window-controls block so it sits
 * left of the close icon.
 */
export function attachLevelUpButton(app, html) {
  const actor = app.actor || app.object;
  if (!actor || actor.type !== "character") return;

  const root = html instanceof HTMLElement ? html : html?.[0];
  if (!root) return;

  // ApplicationV2 / V1 both put the header at .window-header on the
  // outer element. The sheet's content may be a child of that element,
  // so we walk up to find it.
  const windowEl = root.closest(".window-app") || root.parentElement?.closest?.(".window-app");
  const header = (windowEl || root).querySelector(".window-header");
  if (!header) return;
  if (header.querySelector(".cf-levelup-btn")) return; // idempotent

  const btn = document.createElement("a");
  btn.classList.add("cf-levelup-btn", "header-control");
  btn.innerHTML = `<i class="fas fa-arrow-up"></i>`;
  const hint = t("CHARACTER_FORGE.LevelUp.ButtonHint");
  btn.dataset.tooltip = hint;
  btn.setAttribute("aria-label", hint);
  btn.title = hint;
  btn.addEventListener("click", (ev) => {
    ev.preventDefault();
    ev.stopPropagation();
    openLevelUpWizard(actor);
  });

  // Insert before .window-controls (the cluster with the close/maximize
  // icons) so the new button stays inside the header but before the
  // standard system buttons.
  const controls = header.querySelector(".window-controls");
  if (controls) header.insertBefore(btn, controls);
  else header.appendChild(btn);
  log(`Level-up button attached to ${actor.name}'s sheet.`);
}
