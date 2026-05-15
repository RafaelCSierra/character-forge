# Character Forge

Friendly wizard for creating and leveling up D&D 5e Player Characters in Foundry VTT v13.

- **Beginner-first onboarding** — every choice (race, class, ability scores, spells) is explained in plain language.
- **Bilingual** — full English and Brazilian Portuguese support.
- **SRD 5.1/5.2 included** — Wizards of the Coast SRD content (CC-BY-4.0) bundled out of the box.
- **Plutonium-aware** — automatically picks up any non-SRD content (Tasha's, Xanathar's, Mordenkainen's, etc.) that you've already imported into Foundry compendiums via Plutonium or any other importer.
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

## How to add content beyond SRD (Plutonium step-by-step)

The bundled content is the official **System Reference Document 5.1 / 5.2** (CC-BY-4.0). For anything beyond the SRD — sub-races from Tasha's, classes from Xanathar's, feats from Mordenkainen's, etc. — Character Forge does **not** download or ship that content itself.

Instead, the wizard automatically picks up whatever lives in your Foundry **compendiums**. The standard way to populate those compendiums is the **Plutonium** module, which imports content from [5e.tools](https://5e.tools). You only do this **once per world** (or once per new book added). After that, every character creation and level-up uses Character Forge's friendly UI — you never have to touch Plutonium's interface again.

### What to import in Plutonium (in order)

Open the Plutonium UI in your world (sidebar button or its toolbar entry). For each category below, filter by the source books you own and import everything you want available to your players.

1. **Races & sub-races** — *required for the Race step.*
   Open the **Races** tab in Plutonium → filter by source (e.g. PHB, MPMM, VGM, TCE) → select the races you want → **Import**.
2. **Classes** — *required for the Class step.*
   **Classes** tab → import each class you'll allow at your table.
3. **Subclasses** — *required if you want subclass cards.*
   **Subclasses** tab (or imported automatically when you import a class, depending on Plutonium version) → confirm subclasses are present in the resulting compendium.
4. **Backgrounds** — *required for the Background step.*
   **Backgrounds** tab → filter by source → import.
5. **Spells** — *required if anyone is playing a spellcaster.*
   **Spells** tab → filter by class list (Wizard, Cleric, etc.) and/or source → import. You can re-run later to add more.
6. **Items / Equipment** — *optional but recommended.*
   **Items** tab → filter by mundane vs magical, by source, etc. → import. Needed if you want starting equipment options beyond the SRD weapons/armor.
7. **Feats** — *only if you use the variant "feat at level 1" rule.*
   **Feats** tab → import as needed.

### Verify it worked

After running Plutonium:

1. In Foundry, open the **Compendiums** sidebar tab.
2. You should see new packs labeled something like "Plutonium — Races", "Plutonium — Classes", "Plutonium — Spells", etc. (exact labels depend on your Plutonium version).
3. Reload your world (**F5** or close & re-open).
4. Open **Forge Character** in the Actors sidebar. On the **Race** step you should now see the non-SRD races with a small badge showing their pack name (e.g. "Plutonium — Races"). Cards with a **dashed** border come from compendiums; cards with a **solid** border are the bundled SRD content.

### Troubleshooting

- **I imported in Plutonium but nothing new shows up in Character Forge.**
  Reload the world (F5). Character Forge scans compendiums once at startup; it won't see imports you ran after the world was already loaded until the next reload.
- **I see duplicates (SRD + Plutonium version of the same race).**
  This is expected — Plutonium imports the full PHB version, the SRD is a subset. Pick whichever you prefer; future versions will let you hide specific packs via a settings dialog.
- **A specific pack is showing content I don't want.**
  Open the world settings (`game.settings`) and add the pack's collection ID to `character-forge.compendiumPacksDisabled`. A graphical pack picker is on the roadmap.

### Don't have Plutonium?

You can still use Character Forge with just the SRD (9 races, Fighter, Soldier background, etc.). A manual JSON import path (drag-and-drop a `races.json` from 5e.tools) is on the roadmap for users who can't or don't want to install Plutonium.

### License note

Anything beyond the SRD is the intellectual property of Wizards of the Coast. You are responsible for owning the physical or digital books that correspond to whatever content you import via Plutonium. Character Forge itself ships **only** the CC-BY-4.0 SRD data and never fetches anything over the network.

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
- Compatible with (but does not require) **Plutonium** by The Giddy Limit.

## License

Code: MIT. SRD content: CC-BY-4.0 (Wizards of the Coast).

---

# Character Forge (Português)

Assistente amigável para criação e progressão de Personagens Jogadores de D&D 5e no Foundry VTT v13.

- **Foco em iniciantes** — cada escolha (raça, classe, atributos, magias) é explicada em linguagem simples.
- **Bilíngue** — inglês e português brasileiro completos.
- **SRD 5.1/5.2 embarcado** — conteúdo do System Reference Document (CC-BY-4.0) já vem incluído.
- **Compatível com Plutonium** — pega automaticamente qualquer conteúdo além do SRD (Tasha, Xanathar, Mordenkainen, etc.) que você já tenha importado para os compêndios do Foundry via Plutonium ou qualquer outro importador.
- **Ciclo completo de criação e level-up** — embrulha o Advancement Manager nativo do dnd5e com dicas amigáveis; suporta multiclasse.

## Como adicionar conteúdo além do SRD (passo a passo do Plutonium)

O conteúdo embarcado é o **System Reference Document 5.1 / 5.2** oficial (CC-BY-4.0). Para qualquer coisa além do SRD — sub-raças do Tasha, classes do Xanathar, talentos do Mordenkainen, etc. — o Character Forge **não** baixa nem distribui esse conteúdo.

Em vez disso, o assistente lê automaticamente o que estiver nos **compêndios** do seu Foundry. A forma padrão de popular esses compêndios é o módulo **Plutonium**, que importa conteúdo do [5e.tools](https://5e.tools). Esse processo é feito **uma vez por mundo** (ou sempre que adicionar um livro novo). Depois disso, toda criação de personagem e level-up acontece na UI amigável do Character Forge — você nunca mais precisa abrir a interface do Plutonium.

### O que importar no Plutonium (nesta ordem)

Abra a UI do Plutonium no seu mundo (botão na barra lateral ou na toolbar). Para cada categoria abaixo, filtre pelos livros que você possui e importe tudo que quiser disponível para seus jogadores.

1. **Raças e sub-raças** — *obrigatório para o passo Raça.*
   Abra a aba **Races** no Plutonium → filtre por fonte (ex.: PHB, MPMM, VGM, TCE) → selecione as raças → **Import**.
2. **Classes** — *obrigatório para o passo Classe.*
   Aba **Classes** → importe cada classe que você vai permitir na mesa.
3. **Subclasses** — *obrigatório se quiser cards de subclasse.*
   Aba **Subclasses** (ou já vem junto ao importar uma classe, depende da versão do Plutonium) → confira que as subclasses aparecem no compêndio resultante.
4. **Backgrounds** — *obrigatório para o passo Antecedente.*
   Aba **Backgrounds** → filtre por fonte → importe.
5. **Magias** — *obrigatório se alguém for jogar um conjurador.*
   Aba **Spells** → filtre por lista de classe (Mago, Clérigo, etc.) e/ou fonte → importe. Pode importar mais depois.
6. **Itens / Equipamento** — *opcional mas recomendado.*
   Aba **Items** → filtre por mundano vs mágico, por fonte, etc. → importe. Necessário se quiser opções de equipamento inicial além das armas/armaduras do SRD.
7. **Talentos (Feats)** — *só se usar a regra opcional "talento no nível 1".*
   Aba **Feats** → importe conforme necessário.

### Verificar se deu certo

Depois de rodar o Plutonium:

1. No Foundry, abra a aba **Compêndios** na barra lateral.
2. Você deve ver novos packs com nomes tipo "Plutonium — Races", "Plutonium — Classes", "Plutonium — Spells", etc. (rótulos exatos dependem da versão do Plutonium).
3. Recarregue o mundo (**F5** ou feche e reabra).
4. Abra **Forjar Personagem** na barra lateral de Actors. No passo **Raça** você deve ver agora as raças não-SRD com um pequeno badge mostrando o nome do pack (ex.: "Plutonium — Races"). Cards com borda **tracejada** vêm de compêndios; cards com borda **sólida** são o SRD embarcado.

### Solução de problemas

- **Importei no Plutonium mas nada novo aparece no Character Forge.**
  Recarregue o mundo (F5). O Character Forge varre os compêndios uma vez na inicialização; importações feitas com o mundo já aberto só aparecem depois do próximo reload.
- **Estou vendo duplicatas (SRD + versão Plutonium da mesma raça).**
  É esperado — o Plutonium importa a versão completa do PHB, o SRD é um subconjunto. Escolha qual preferir; em versões futuras você vai poder esconder packs específicos via diálogo de configurações.
- **Um pack específico está mostrando conteúdo que não quero.**
  Abra as configurações do mundo (`game.settings`) e adicione o ID de collection do pack em `character-forge.compendiumPacksDisabled`. Um seletor gráfico de packs está no roadmap.

### Não tem Plutonium?

Você ainda pode usar o Character Forge só com o SRD (9 raças, Guerreiro, Soldado, etc.). Um caminho de importação manual de JSON (arrastar um `races.json` do 5e.tools) está no roadmap para usuários que não podem ou não querem instalar o Plutonium.

### Nota de licença

Qualquer coisa além do SRD é propriedade intelectual da Wizards of the Coast. Você é responsável por possuir os livros físicos ou digitais correspondentes ao conteúdo que importa via Plutonium. O Character Forge em si distribui **apenas** os dados SRD CC-BY-4.0 e nunca faz requisições de rede.
