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

/** "lawful-good" → "Lawful Good"  (matches dnd5e alignment display style). */
function formatAlignment(key) {
  if (!key) return "";
  return key
    .split("-")
    .map(w => w.charAt(0).toUpperCase() + w.slice(1))
    .join(" ");
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
    const raceItem = await this._resolveRaceItem(data);

    const actorData = {
      name: data.name?.trim() || t("CHARACTER_FORGE.Notify.DefaultName"),
      type: "character",
      img: data.portrait?.trim() || "icons/svg/mystery-man.svg",
      system: {
        details: {
          alignment: formatAlignment(data.alignment)
        }
      }
    };

    log("Creating actor:", actorData.name);
    const actor = await Actor.create(actorData);
    if (!actor) {
      throw new Error("Actor.create returned null — likely a permissions issue.");
    }

    if (raceItem) {
      log("Embedding race item:", raceItem.name);
      try {
        await actor.createEmbeddedDocuments("Item", [raceItem]);
      } catch (err) {
        warn("Failed to embed race item:", err);
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
  }
};

export default ActorBuilder;
