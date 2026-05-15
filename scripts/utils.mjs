/**
 * Character Forge — shared utilities.
 */

export const MODULE_ID = "character-forge";

/**
 * Module path prefix for assets/templates.
 * Use as: `modules/${MODULE_PATH}/templates/foo.hbs`.
 */
export const MODULE_PATH = MODULE_ID;

/** Localize via game.i18n (safe even if i18n is not ready). */
export function t(key, data) {
  if (data) return game.i18n.format(key, data);
  return game.i18n.localize(key);
}

/** Wrapper around console.log with module prefix. */
export function log(...args) {
  console.log(`Character Forge |`, ...args);
}

export function warn(...args) {
  console.warn(`Character Forge |`, ...args);
}

export function error(...args) {
  console.error(`Character Forge |`, ...args);
}

/** Slugify a string into a stable key (lowercase, dashes, ascii-only).
 * Uses a constructed RegExp with explicit unicode escapes for combining
 * diacritical marks (U+0300 – U+036F), so the source stays pure ASCII. */
const COMBINING_MARKS = new RegExp("[\\u0300-\\u036F]", "g");
export function slugify(input) {
  if (!input) return "";
  return String(input)
    .normalize("NFKD")
    .replace(COMBINING_MARKS, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

/** Read a JSON file shipped inside the module via fetch. */
export async function loadJson(relativePath) {
  const url = `modules/${MODULE_PATH}/${relativePath}`;
  const res = await fetch(url);
  if (!res.ok) {
    throw new Error(`Character Forge: failed to load ${url} (HTTP ${res.status})`);
  }
  return res.json();
}

/** Check that the active system is dnd5e at or above a minimum version. */
export function checkSystemCompatibility(minVersion = "5.2.0") {
  if (game.system?.id !== "dnd5e") {
    return { ok: false, reason: "wrongSystem" };
  }
  const current = game.system.version || "0.0.0";
  const ok = foundry.utils.isNewerVersion(current, minVersion)
    || current === minVersion;
  return { ok, reason: ok ? null : "oldVersion", current, required: minVersion };
}
