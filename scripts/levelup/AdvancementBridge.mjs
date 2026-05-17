/**
 * AdvancementBridge — kicks off the dnd5e Advancement Manager for a
 * level-up action (either raising an existing class's level by one,
 * or embedding a new class at level 1 for a multiclass dip).
 *
 * We rely entirely on dnd5e's native AdvancementManager to drive the
 * actual choice walkthrough (ASI / fighting style / subclass / hit
 * points / spell selection / etc.). All this bridge does is mutate
 * the actor in the way that triggers the manager.
 *
 *   - Level up existing class: update the class item's `system.levels`
 *     value to N+1. dnd5e detects the change in the item's preUpdate
 *     hook and opens the AdvancementManager for the new level's chain.
 *   - Multiclass: clone the chosen class item (from compendium UUID or
 *     SRD JSON), force `system.levels = 1`, and embed on the actor.
 *     dnd5e detects the new class item in the create hook and opens
 *     the AdvancementManager for that class's level-1 chain.
 */

import DataRegistry from "../data/DataRegistry.mjs";
import { log, warn, t } from "../utils.mjs";

/** Build a minimal level-1 class Item from a bundled SRD entry — mirror
 *  of ActorBuilder.buildSrdClassItem but local to the bridge so we don't
 *  cross-import. Kept intentionally small; description is descriptive
 *  but no advancement[] chain. */
function buildSrdClassItem(cls) {
  const parts = [];
  if (cls.hitDie) parts.push(`<p><strong>Hit Die:</strong> d${cls.hitDie}</p>`);
  if (cls.savingThrows?.length) {
    parts.push(`<p><strong>Saving Throws:</strong> ${cls.savingThrows.map(s => s.toUpperCase()).join(", ")}</p>`);
  }
  parts.push(`<p><em>Multiclass dip via Character Forge (SRD bundled). No automatic feature grants — apply proficiencies manually on the sheet.</em></p>`);
  return {
    name: cls.name,
    type: "class",
    img: cls.img || "icons/svg/mystery-man.svg",
    system: {
      identifier: cls.key,
      levels: 1,
      hitDice: `d${cls.hitDie || 6}`,
      hitDiceUsed: 0,
      saves: cls.savingThrows || [],
      primaryAbility: { value: cls.primaryAbility || [], all: false },
      description: { value: parts.join("\n") },
      source: { custom: "Character Forge — SRD bundled (multiclass)" }
    }
  };
}

const AdvancementBridge = {

  /**
   * Raise an existing class on the actor from N to N+1. Caller passes
   * the Item id (not the slug — actors can have two class items of the
   * same identifier in theory, though dnd5e usually merges them).
   */
  async advanceExisting(actor, classItemId) {
    const classItem = actor.items.get(classItemId);
    if (!classItem) throw new Error(`Class item ${classItemId} not found on actor ${actor.id}`);
    if (classItem.type !== "class") throw new Error(`Item ${classItemId} is not a class`);

    const cur = classItem.system?.levels || 1;
    const next = cur + 1;
    const hasAdvancement = (classItem.system?.advancement || []).length > 0;
    log(`Level up: ${actor.name} / ${classItem.name} — L${cur} → L${next} (advancement: ${hasAdvancement ? "yes" : "no"})`);

    // dnd5e detects the change in its preUpdateItem hook and opens the
    // AdvancementManager for the new level's chain. We don't have to
    // call .render() ourselves.
    await classItem.update({ "system.levels": next });

    // SRD-bundled class items have no system.advancement[], so dnd5e
    // won't pop up the AdvancementManager — the level just ticks up
    // silently. Warn the user so they know to adjust HP / features
    // manually, or to recreate using a compendium-sourced class.
    if (!hasAdvancement) {
      ui.notifications.warn(t("CHARACTER_FORGE.LevelUp.NoAdvancement", {
        name: classItem.name
      }));
    }
  },

  /**
   * Embed a new class at level 1 for a multiclass dip.
   *
   * @param {Actor} actor       The character to multiclass.
   * @param {string} classKey   Registry key — either an SRD slug
   *                            ("fighter") or a compound compendium key
   *                            ("comp:plutonium-pack:abc123").
   */
  async advanceMulticlass(actor, classKey) {
    const cls = DataRegistry.getClass(classKey);
    if (!cls) throw new Error(`Class not found in registry: ${classKey}`);

    let itemData;
    if (cls.uuid) {
      try {
        const doc = await fromUuid(cls.uuid);
        if (!doc) throw new Error("Compendium document missing");
        itemData = doc.toObject();
        delete itemData._id;
      } catch (err) {
        warn(`Failed to fetch compendium class ${cls.uuid}:`, err);
        itemData = buildSrdClassItem(cls);
      }
    } else {
      itemData = buildSrdClassItem(cls);
    }
    foundry.utils.setProperty(itemData, "system.levels", 1);

    log(`Multiclass: ${actor.name} + ${cls.name} L1`);

    // dnd5e detects the new class item via its preCreateItem hook and
    // opens the AdvancementManager for that class's level-1 chain.
    await actor.createEmbeddedDocuments("Item", [itemData]);
  }
};

export default AdvancementBridge;
