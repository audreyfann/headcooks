# master-list

A fully static, client-side tool that combines ingredient lists from a
multi-sheet recipe/menu-planning spreadsheet into one shopping list.
Nothing uploads anywhere — the spreadsheet is parsed and combined entirely
in the browser using [SheetJS](https://sheetjs.com/) (vendored locally in
`js/vendor/`).

This is a browser port of the Python `ingredient-extractor` CLI — same
normalization rules, same unit-conversion logic, same output shape — just
running client-side so it can be hosted as a static site.

## Before you deploy: test it locally

Since this is plain static files, you can just open it directly:

```bash
cd netlify-site
python3 -m http.server 8080
# visit http://localhost:8080 and drop in a spreadsheet
```

(Opening `index.html` directly via `file://` won't work — browsers block
module script loading over `file://`. Use a local server, even a trivial
one like the above.)

## Deploy to Netlify

**Option A — drag and drop (fastest, no git needed):**

1. Go to [app.netlify.com/drop](https://app.netlify.com/drop)
2. Drag the whole `netlify-site` folder onto the page
3. Done — Netlify gives you a live URL immediately

**Option B — connect a GitHub repo (recommended if you'll keep editing this):**

1. Push this folder to a GitHub repo
2. In Netlify: **Add new site → Import an existing project → GitHub**
3. Pick the repo. Build settings:
   - **Build command:** leave blank (there's no build step — it's plain HTML/CSS/JS)
   - **Publish directory:** `netlify-site` (or wherever this folder sits in your repo)
4. Deploy — every push to your main branch redeploys automatically

There's no backend, no environment variables, and no build tooling required.

## Editing the conversion rules

Everything tunable lives in `js/config.js` — sheets to skip, descriptor
words stripped from ingredient names, unit conversion tables, staple
densities (for merging weight and volume of the same ingredient), and
ingredient-specific overrides (currently just garlic → cloves). Add more
overrides the same way garlic is defined:

```js
export const INGREDIENT_UNIT_OVERRIDES = {
  garlic: {
    displayUnit: "clove",
    conversions: { tsp: 1, tbsp: 3, cup: 48, head: 10, lb: 80, oz: 5, clove: 1, count: 1 },
  },
  onion: {
    displayUnit: "onion",
    conversions: { lb: 2, count: 1 },
  },
};
```

Any change to `config.js` takes effect immediately on next page load — no
rebuild step.

## How combining works

Same logic as the Python CLI, plus one addition: **every ingredient now
gets exactly one row**, no matter how many different units it was measured
in across recipes.

1. **Extraction** (`extract.js`) — reads every sheet except the ones in
   `DEFAULT_SKIP_SHEETS`, finds each ingredient table by its header row
   (must contain a "Quantity" column), and walks rows until the next dish
   title or blank section.
2. **Normalization** (`normalize.js`) — strips vague quantity phrases
   ("a drizzle of..."), strips parenthetical notes entirely, strips
   descriptor words (fresh/baby/minced/kosher/...), naive-singularizes.
3. **Quantity parsing** (`quantities.js`) — parses numbers (incl. unicode
   fractions and averaged ranges) and matches a unit word.
4. **Unit conversion & grouping** (`combine.js`) — weight units merge via
   grams, volume units merge via ml. Staples with a known density
   (`config.STAPLE_DENSITY_G_PER_CUP`) merge weight and volume together
   precisely. For everything else, if both weight and volume mentions
   exist, they're still merged — using a generic water-density fallback
   (`config.FALLBACK_DENSITY_G_PER_CUP`) — and flagged **"~est"** in the UI
   so it reads as an approximation, not an exact figure. Garlic converts
   entirely to cloves. Genuinely incompatible count-like units (a "head" of
   garlic vs. a "clove", a "bunch" vs. a bare count) are never merged with
   each other, since that would silently give a wrong quantity — they show
   as additional lines under the same ingredient instead of a second row.
5. **Per-recipe breakdown** — click the ▸ next to any ingredient to expand
   a table of every dish/cook that used it, with the quantity, supplier, and
   any note exactly as written in the source spreadsheet. A small "note"
   tag appears next to an ingredient's name if at least one of its mentions
   has a note attached, so you know to check before you expand it.
6. **Store sorting** (`suppliers.js`) — every ingredient is assigned to a
   store, learned from two layers:
   - A **static baseline** (`js/data/supplier-seed.js`), built from historical
     spreadsheets and shipped with the site. Gives a fresh browser a
     reasonable starting guess even before it's learned anything itself.
   - **This browser's own history** (`localStorage`) — supplier mentions
     seen in files you've actually uploaded here, plus any manual
     corrections. Always outweighs the seed when the two disagree, and a
     manual correction always wins outright over accumulated mentions,
     however many there are — a manual pick means "I'm telling you where I
     get this," not "here's one more vote."
   - Anything never seen with a supplier, in the seed or this browser's
     history, lands in an "Unassigned" section.
   - Picking a store from the dropdown on any item corrects it immediately
     for this browser and is remembered the same way.
7. **Estimated lb for bare counts** (`config.AVG_WEIGHT_LB_PER_COUNT`) — when
   an ingredient is just measured as "N of them" (e.g. "20 onions"), the
   real count is always shown as-is, and an additional "(~X lb)" estimate is
   added alongside it using a standard average per-item weight, for
   ingredients where one is on file. This only fires when the mentions
   behind that count are genuinely counting individual items — a bare
   number, or plain descriptive text ("4 large", "1 peeled and halved") —
   not containers or packaging ("2 bags", "3 boxes"), and tolerates a small
   minority of outlier mentions without throwing out an otherwise-solid
   estimate.

   To refresh the seed with a newer batch of historical spreadsheets, adapt
   the extraction pipeline to read each file, collect `ingredientNormalized`
   → `supplier` counts, and regenerate `js/data/supplier-seed.js` in the
   same shape (`{ "<ingredient>": { "<store>": count } }`).

## Known limitations

- A spreadsheet cell that's a genuine number (not text) with no unit is
  treated as a bare count of that ingredient — e.g. a cell containing the
  number `5` (not the text `"5"`) becomes "5 [ingredient]". This is a
  deliberate assumption, not a detected fact, since a bare number genuinely
  can't say what it's counting.
- Excel/Sheets will sometimes silently auto-convert a typed range like "4-6"
  into a date (April 6th) if a Quantity cell has no other formatting hint
  that it's text. This is detected and recovered (`extract.js`,
  `recoverDateMangledQuantity`) by reading cells with `cellDates: true` and
  reading the month/day back off the resulting Date object — but this can't
  perfectly recover every case (e.g. "04-06" loses its leading zeros in the
  round trip), and if a cell was genuinely a date for some other reason, it
  will also come out looking like "M-D" text. Worth a glance at anything
  matching that pattern in the output if it looks off.
- Garlic conversion, staple densities, and the generic fallback density are
  standard kitchen-reference approximations, not measured — fine for a
  shopping list, not lab-precise. Anything using the fallback (rather than
  a known staple density) is marked "~est" in the UI and CSV export.
- Quantity ranges ("18-20") are averaged, not maxed.
- Messy source cells (pasted recipe text in an ingredient cell) are caught
  by a length/word-count heuristic and routed to the "needs manual review"
  panel rather than silently corrupting the combined list — but the
  heuristic isn't perfect, so skim that panel.
- Store assignments are a browser-local guess, not a guarantee — the
  learning has no idea if a store stopped carrying something, changed
  which branch supplies it, etc. It's a starting point, not a source of truth.
- Tested against real spreadsheet data by porting the logic and comparing
  output to the validated Python CLI version — numbers matched exactly.
  The UI layer (drag-and-drop, rendering, download, expand/collapse, store
  dropdown) was code-reviewed but not click-tested in a real browser during
  development; do a quick local smoke test (see above) before relying on a
  deploy.
