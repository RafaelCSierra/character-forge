/**
 * ActorBuilder — turns the wizard's `_data` into a real Foundry Actor.
 *
 * For v0.4 the wizard collects Identity + Race only, so the resulting
 * actor is minimal: name, portrait, alignment, and a single race item.
 *
 * Race resolution strategy:
 *   - If the chosen race came from a Foundry compendium (key starts with
 *     "comp:" and `_uuid` is set), we clone the original document via
 *     `fromUuid` and embed it. The dnd5e system's AdvancementManager
 *     fires automatically on document add and walks the user through
 *     ASI / traits / proficiencies choices defined on that race.
 *   - If the chosen race is a bundled SRD JSON entry (no UUID), we build
 *     a minimal race Item from the JSON's traits — the user will need
 *     to assign abilities manually on the sheet. Future versions will
 *     produce a full Advancement-aware item for SRD races too.
 */

import DataRegistry from "../data/DataRegistry.mjs";
import { t, log, warn } from "../utils.mjs";
import { ABILITY_KEYS } from "./AbilityScoreCalculator.mjs";

/** "lawful-good" → "Lawful Good"  (matches dnd5e alignment display style). */
function formatAlignment(key) {
  if (!key) return "";
  return key
    .split("-")
    .map(w => w.charAt(0).toUpperCase() + w.slice(1))
    .join(" ");
}

/** Map base ability scores from wizard state to the dnd5e abilities sub-tree.
 *  Unset / zero values fall back to 10 (the system default) so the sheet
 *  doesn't show 0s if the user skipped this step. */
function buildAbilitiesPayload(baseScores) {
  const out = {};
  for (const k of ABILITY_KEYS) {
    const v = baseScores?.[k];
    const value = Number.isFinite(v) && v > 0 ? v : 10;
    out[k] = { value };
  }
  return out;
}

/** Map a bundled equipment definition to a Foundry Item data object.
 *  Uses very loose heuristics on `type` (armor / weapon / ammo / pack / gear)
 *  to set the right dnd5e item type. The result is intentionally minimal
 *  — just enough so the item appears on the sheet with a name, qty, and
 *  a description that captures the SRD stat block.                      */
function buildSrdEquipmentItem(eq, qty = 1) {
  const TYPE_MAP = {
    armor: "equipment",
    weapon: "weapon",
    ammo: "consumable",
    pack: "container",
    gear: "loot"
  };
  const dndType = TYPE_MAP[eq.type] || "loot";

  const descParts = [];
  if (eq.type === "armor") {
    if (eq.armorType) descParts.push(`<p><strong>Armor:</strong> ${eq.armorType}</p>`);
    if (Number.isFinite(eq.ac)) descParts.push(`<p><strong>AC:</strong> ${eq.ac}</p>`);
    if (eq.strRequirement) descParts.push(`<p><strong>Strength:</strong> ${eq.strRequirement}</p>`);
    if (eq.stealthDisadvantage) descParts.push(`<p><strong>Stealth:</strong> Disadvantage</p>`);
  }
  if (eq.type === "weapon") {
    if (eq.damage) descParts.push(`<p><strong>Damage:</strong> ${eq.damage}</p>`);
    if (eq.versatile) descParts.push(`<p><strong>Versatile:</strong> ${eq.versatile}</p>`);
    if (eq.range) descParts.push(`<p><strong>Range:</strong> ${eq.range}</p>`);
    if (eq.thrown) descParts.push(`<p><strong>Thrown:</strong> ${eq.thrown}</p>`);
  }
  if (Number.isFinite(eq.weight)) descParts.push(`<p><strong>Weight:</strong> ${eq.weight} lb</p>`);

  const system = {
    quantity: qty,
    weight: { value: eq.weight || 0, units: "lb" },
    description: { value: descParts.join("\n") },
    source: { custom: "Character Forge — SRD bundled" }
  };
  if (Number.isFinite(eq.cost?.gp)) {
    system.price = { value: eq.cost.gp, denomination: "gp" };
  }

  return {
    name: eq.name,
    type: dndType,
    img: "icons/svg/item-bag.svg",
    system
  };
}

/** Build a minimal dnd5e background Item from a bundled-SRD entry. */
function buildSrdBackgroundItem(bg) {
  const parts = [];
  if (bg.skillProficiencies?.length) {
    parts.push(`<p><strong>Skill Proficiencies:</strong> ${bg.skillProficiencies.join(", ")}</p>`);
  }
  if (bg.toolProficiencies?.length) {
    parts.push(`<p><strong>Tool Proficiencies:</strong> ${bg.toolProficiencies.join(", ")}</p>`);
  }
  if (bg.languages?.length) {
    parts.push(`<p><strong>Languages:</strong> ${bg.languages.join(", ")}</p>`);
  }
  if (bg.startingGold) {
    parts.push(`<p><strong>Starting Gold:</strong> ${bg.startingGold} gp</p>`);
  }
  if (bg.feature) {
    parts.push(`<p><strong>Feature: ${bg.feature.name}.</strong> ${bg.feature.desc}</p>`);
  }
  parts.push(`<p><em>This background was built from Character Forge's bundled SRD data — proficiencies and tools need to be applied manually. For automatic application, use the dnd5e system's background compendium or import via Plutonium.</em></p>`);

  return {
    name: bg.name,
    type: "background",
    img: bg.img || "icons/svg/mystery-man.svg",
    system: {
      identifier: bg.key,
      description: { value: parts.join("\n") },
      source: { custom: "Character Forge — SRD bundled" }
    }
  };
}

/** Build a minimal dnd5e class Item at level 1 from a bundled-SRD entry. */
function buildSrdClassItem(cls) {
  const parts = [];
  if (cls.hitDie) parts.push(`<p><strong>Hit Die:</strong> d${cls.hitDie}</p>`);
  if (cls.savingThrows?.length) {
    parts.push(`<p><strong>Saving Throws:</strong> ${cls.savingThrows.map(s => s.toUpperCase()).join(", ")}</p>`);
  }
  if (cls.armorProficiencies?.length) {
    parts.push(`<p><strong>Armor:</strong> ${cls.armorProficiencies.join(", ")}</p>`);
  }
  if (cls.weaponProficiencies?.length) {
    parts.push(`<p><strong>Weapons:</strong> ${cls.weaponProficiencies.join(", ")}</p>`);
  }
  if (cls.skillProficiencies?.choose) {
    parts.push(`<p><strong>Skills:</strong> choose ${cls.skillProficiencies.choose} from ${(cls.skillProficiencies.from || []).join(", ")}</p>`);
  }
  parts.push(`<p><em>This class was built from Character Forge's bundled SRD data — no automatic advancement chain. For a fully-driven creation flow, use the dnd5e system's class compendiums or import via Plutonium.</em></p>`);

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
      primaryAbility: {
        value: cls.primaryAbility || [],
        all: false
      },
      description: { value: parts.join("\n") },
      source: { custom: "Character Forge — SRD bundled" }
    }
  };
}

/** Build a minimal dnd5e race Item from a bundled-SRD entry. */
function buildSrdRaceItem(race) {
  const parts = [];
  if (race.size || race.speed) {
    const bits = [];
    if (race.size) bits.push(`<strong>Size:</strong> ${race.size}`);
    if (race.speed) bits.push(`<strong>Speed:</strong> ${race.speed} ft.`);
    parts.push(`<p>${bits.join(" &middot; ")}</p>`);
  }
  for (const tr of race.traits || []) {
    parts.push(`<p><strong>${tr.name}.</strong> ${tr.desc}</p>`);
  }
  if (race._note) parts.push(`<p><em>${race._note}</em></p>`);

  return {
    name: race.name,
    type: "race",
    img: race.img || "icons/svg/mystery-man.svg",
    system: {
      description: { value: parts.join("\n") },
      identifier: race.key,
      source: { custom: "Character Forge — SRD bundled" }
    }
  };
}

const ActorBuilder = {

  /**
   * Build and create the Actor in the world. Returns the created Actor.
   * @param {object} data  Wizard `_data` object.
   * @returns {Promise<Actor>}
   */
  async build(data) {
    const [raceItem, classItem, backgroundItem] = await Promise.all([
      this._resolveRaceItem(data),
      this._resolveClassItem(data),
      this._resolveBackgroundItem(data)
    ]);
    const equipmentItems = this._resolveStartingEquipment(data);

    const actorData = {
      name: data.name?.trim() || t("CHARACTER_FORGE.Notify.DefaultName"),
      type: "character",
      img: data.portrait?.trim() || "icons/svg/mystery-man.svg",
      system: {
        details: {
          alignment: formatAlignment(data.alignment)
        },
        abilities: buildAbilitiesPayload(data.baseScores)
      }
    };

    log("Creating actor:", actorData.name);
    const actor = await Actor.create(actorData);
    if (!actor) {
      throw new Error("Actor.create returned null — likely a permissions issue.");
    }

    // Embed items one at a time so each Advancement chain (race traits,
    // then class proficiencies / fighting style / spellcasting / etc.)
    // walks the user through its own AdvancementManager session before
    // the next item is added.
    if (raceItem) {
      log("Embedding race item:", raceItem.name);
      try {
        await actor.createEmbeddedDocuments("Item", [raceItem]);
      } catch (err) {
        warn("Failed to embed race item:", err);
      }
    }
    if (classItem) {
      log("Embedding class item:", classItem.name);
      try {
        await actor.createEmbeddedDocuments("Item", [classItem]);
      } catch (err) {
        warn("Failed to embed class item:", err);
      }
    }
    if (backgroundItem) {
      log("Embedding background item:", backgroundItem.name);
      try {
        await actor.createEmbeddedDocuments("Item", [backgroundItem]);
      } catch (err) {
        warn("Failed to embed background item:", err);
      }
    }
    if (equipmentItems.length) {
      log(`Embedding ${equipmentItems.length} starting-equipment items.`);
      try {
        await actor.createEmbeddedDocuments("Item", equipmentItems);
      } catch (err) {
        warn("Failed to embed starting equipment:", err);
      }
    }
    // Apply background starting gold to currency.
    const bg = DataRegistry.getBackground(data.backgroundKey);
    if (bg && !bg.uuid && bg.startingGold) {
      try {
        await actor.update({ "system.currency.gp": bg.startingGold });
      } catch (err) {
        warn("Failed to set starting gold:", err);
      }
    }

    return actor;
  },

  /** Resolve the race the user selected into a Foundry Item document data. */
  async _resolveRaceItem(data) {
    if (!data.raceKey) return null;
    const race = DataRegistry.getRace(data.raceKey);
    if (!race) {
      warn(`Race not found in registry: ${data.raceKey}`);
      return null;
    }

    // 1) Compendium-sourced: clone the original document. dnd5e's
    //    AdvancementManager will then drive ASI / traits / proficiencies.
    if (race.uuid) {
      try {
        const doc = await fromUuid(race.uuid);
        if (doc) {
          const obj = doc.toObject();
          delete obj._id;
          return obj;
        }
      } catch (err) {
        warn(`Failed to load compendium race ${race.uuid}:`, err);
      }
    }

    // 2) Bundled SRD: synthesise a minimal Item from the JSON.
    //    Optionally merge the selected subrace's traits as flavour text.
    const merged = { ...race };
    if (data.subraceKey) {
      const sub = (race.subraces || []).find(s => s.key === data.subraceKey);
      if (sub) {
        merged.name = `${race.name} (${sub.name})`;
        merged.traits = [...(race.traits || []), ...(sub.traits || [])];
        merged._note = t("CHARACTER_FORGE.Notify.SubraceMerged", { subrace: sub.name });
      }
    }
    merged._note = (merged._note ? merged._note + "  " : "")
      + t("CHARACTER_FORGE.Notify.SrdRaceNote");

    return buildSrdRaceItem(merged);
  },

  /** Resolve the class the user selected into a Foundry Item document data. */
  async _resolveClassItem(data) {
    if (!data.classKey) return null;
    const cls = DataRegistry.getClass(data.classKey);
    if (!cls) {
      warn(`Class not found in registry: ${data.classKey}`);
      return null;
    }

    // 1) Compendium-sourced: clone original. dnd5e Advancement handles
    //    skills / fighting style / spellcasting / proficiencies / HP.
    if (cls.uuid) {
      try {
        const doc = await fromUuid(cls.uuid);
        if (doc) {
          const obj = doc.toObject();
          delete obj._id;
          // Ensure new characters start at level 1 explicitly — some
          // compendium templates ship with levels: 0, which would make
          // the AdvancementManager prompt for a level instead of
          // walking the level-1 chain.
          foundry.utils.setProperty(obj, "system.levels", 1);
          return obj;
        }
      } catch (err) {
        warn(`Failed to load compendium class ${cls.uuid}:`, err);
      }
    }

    // 2) Bundled SRD: synthesise a minimal level-1 class Item.
    return buildSrdClassItem(cls);
  },

  /** Resolve the background the user selected into a Foundry Item document data. */
  async _resolveBackgroundItem(data) {
    if (!data.backgroundKey) return null;
    const bg = DataRegistry.getBackground(data.backgroundKey);
    if (!bg) {
      warn(`Background not found in registry: ${data.backgroundKey}`);
      return null;
    }

    // 1) Compendium-sourced: clone original. dnd5e Advancement applies
    //    skill / tool / feature grants from system.advancement[].
    if (bg.uuid) {
      try {
        const doc = await fromUuid(bg.uuid);
        if (doc) {
          const obj = doc.toObject();
          delete obj._id;
          return obj;
        }
      } catch (err) {
        warn(`Failed to load compendium background ${bg.uuid}:`, err);
      }
    }

    // 2) Bundled SRD: synthesise a minimal Item with description-only.
    return buildSrdBackgroundItem(bg);
  },

  /**
   * Compile the starting-equipment item list from the user's choices.
   *
   * Sources:
   *   - For SRD-bundled classes: each `startingEquipment.choices` group
   *     contributes the items from the user-picked option (defaults to
   *     option 0 if the user never opened the Equipment step).
   *   - For SRD-bundled backgrounds: all fixed `equipment` entries.
   *
   * Compendium classes contribute nothing here — their starting gear
   * is handled by dnd5e's StartingEquipment advancement at item-add
   * time.
   */
  _resolveStartingEquipment(data) {
    const items = [];

    const cls = DataRegistry.getClass(data.classKey);
    if (cls && !cls.uuid) {
      const choices = cls.startingEquipment?.choices || [];
      for (const choice of choices) {
        const idx = data.equipmentChoices?.[choice.id] ?? 0;
        const opt = (choice.options || [])[idx];
        if (!opt) continue;
        for (const ref of opt.items || []) {
          const eq = DataRegistry.getEquipmentItem(ref.key);
          if (eq) items.push(buildSrdEquipmentItem(eq, ref.qty || 1));
        }
      }
    }

    const bg = DataRegistry.getBackground(data.backgroundKey);
    if (bg && !bg.uuid) {
      for (const ref of bg.equipment || []) {
        const eq = DataRegistry.getEquipmentItem(ref.key);
        if (eq) items.push(buildSrdEquipmentItem(eq, ref.qty || 1));
      }
    }

    return items;
  }
};

export default ActorBuilder;
