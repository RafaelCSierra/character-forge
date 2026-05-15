/**
 * SrdLoader — loads the bundled SRD JSON files on module ready and feeds them
 * into the DataRegistry. Files live under modules/character-forge/srd-data/.
 */

import { loadJson, log, warn } from "../utils.mjs";
import DataRegistry from "./DataRegistry.mjs";

// List of class files shipped under srd-data/classes/.
// Add to this list as more classes are converted from SRD.
const CLASS_FILES = [
  "fighter"
];

const SrdLoader = {
  _loaded: false,

  async load() {
    if (this._loaded) return;

    const [races, backgrounds, equipment, skills] = await Promise.all([
      loadJson("srd-data/races.json"),
      loadJson("srd-data/backgrounds.json"),
      loadJson("srd-data/equipment.json"),
      loadJson("srd-data/skills.json")
    ]);

    const classes = [];
    for (const key of CLASS_FILES) {
      try {
        const data = await loadJson(`srd-data/classes/${key}.json`);
        classes.push(data);
      } catch (err) {
        warn(`Failed to load class file ${key}.json:`, err);
      }
    }

    DataRegistry.setSrd({
      races: races.races || [],
      backgrounds: backgrounds.backgrounds || [],
      classes,
      equipment: equipment.equipment || [],
      skills: skills.skills || []
    });

    this._loaded = true;
    log(`SRD loaded: ${races.races?.length || 0} races, ${classes.length} classes, ${backgrounds.backgrounds?.length || 0} backgrounds.`);
  }
};

export default SrdLoader;
