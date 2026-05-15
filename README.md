# Character Forge

Friendly wizard for creating and leveling up D&D 5e Player Characters in Foundry VTT v13.

- **Beginner-first onboarding** — every choice (race, class, ability scores, spells) is explained in plain language.
- **Bilingual** — full English and Brazilian Portuguese support.
- **SRD 5.1/5.2 included** — Wizards of the Coast SRD content (CC-BY-4.0) bundled out of the box.
- **Manual 5e.tools import** — drag-and-drop JSON files you've downloaded from [5e.tools](https://5e.tools) for expanded content (races, classes, backgrounds, spells, feats). No automatic fetching, no IP redistribution.
- **Full creation + level-up flow** — wraps the native dnd5e Advancement Manager with friendly hints; supports multiclass.

## Requirements

- Foundry VTT **v13.351+**
- D&D 5e system **v5.2+** (advancement system required)

## Installation

Manifest URL:

```
https://github.com/RafaelCSierra/character-forge/releases/latest/download/module.json
```

In Foundry: **Add-on Modules → Install Module → Paste manifest URL → Install**.

## Usage

### Creating a character (level 1)

1. Open the **Actors** sidebar.
2. Click the **Forge Character** button in the header.
3. Walk through the nine steps: Identity → Race → Class → Background → Ability Scores → Skills → Spells (if caster) → Equipment → Review.
4. Click **Forge Character** on the Review step.

Drafts auto-save to your browser; closing the wizard mid-creation lets you resume later.

### Leveling up

1. Open the character sheet of any PC.
2. Click the **Level Up** button in the sheet header.
3. Choose: level up an existing class **or** multiclass into a new one (with side-by-side feature comparison).
4. Walk through the native Advancement Manager — Character Forge injects friendly tooltips for each step.

## How to add content beyond SRD

The bundled content is the official **System Reference Document 5.1 / 5.2** (CC-BY-4.0). To add the expanded content from 5e.tools:

1. Open `https://5e.tools` in your browser, or browse the public mirror at `https://github.com/5etools-mirror-3/5etools-src/tree/master/data`.
2. Navigate to the category you want (Races, Classes, Backgrounds, Spells, Feats).
3. Download the JSON file (use the in-app export, or the "Raw" button on GitHub).
4. In Foundry, open the **Forge Character** dialog → **Import Content**.
5. Drag the downloaded JSON file into the importer, review the detected entries, and confirm.

**License note:** Anything beyond the SRD is the intellectual property of Wizards of the Coast. You are responsible for owning the physical or digital books corresponding to whatever content you import. Character Forge ships only SRD data and never fetches anything over the network.

## Settings

| Setting | Default | Description |
|---|---|---|
| Default ability score method | Point-buy | Point-buy / Standard array / Roll 4d6kh3 |
| Allow multiclass | true | Enable multiclass option in the Level Up wizard |
| Allow feat at level 1 | false | Variant rule: characters gain a feat at character creation |
| Imported content overrides SRD | true | When a key collides, imported content wins |
| Auto-tick XP after level-up | false | Award XP automatically when the level-up completes |

## Credits

- D&D 5e SRD 5.1 / 5.2 © Wizards of the Coast, licensed under **CC-BY-4.0**. See `srd-data/LICENSE.md` for attribution.
- Built for the D&D 5e system maintained by the Foundry VTT community.

## License

Code: MIT. SRD content: CC-BY-4.0 (Wizards of the Coast).
