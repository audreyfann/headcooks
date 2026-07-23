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

Same logic as the Python CLI:

1. **Extraction** (`extract.js`) — reads every sheet except the ones in
   `DEFAULT_SKIP_SHEETS`, finds each ingredient table by its header row
   (must contain a "Quantity" column), and walks rows until the next dish
   title or blank section.
2. **Normalization** (`normalize.js`) — strips vague quantity phrases
   ("a drizzle of..."), strips parenthetical notes entirely, strips
   descriptor words (fresh/baby/minced/kosher/...), naive-singularizes.
3. **Quantity parsing** (`quantities.js`) — parses numbers (incl. unicode
   fractions and averaged ranges) and matches a unit word.
4. **Unit conversion** — weight units merge via grams, volume units merge
   via ml, staples with a known density merge weight+volume together,
   garlic converts entirely to cloves. Count-like units (head, clove,
   slice, bunch, stick, can, pinch, bare count) are kept distinct from each
   other — never merged, since e.g. a head of garlic isn't a clove.

## Known limitations

- Garlic conversion and staple densities are standard kitchen-reference
  approximations, not measured — fine for a shopping list, not lab-precise.
- Quantity ranges ("18-20") are averaged, not maxed.
- Messy source cells (pasted recipe text in an ingredient cell) are caught
  by a length/word-count heuristic and routed to the "needs manual review"
  panel rather than silently corrupting the combined list — but the
  heuristic isn't perfect, so skim that panel.
- Tested against real spreadsheet data by porting the logic and comparing
  output to the validated Python CLI version — numbers matched exactly.
  The UI layer (drag-and-drop, rendering, download) was code-reviewed but
  not click-tested in a real browser during development; do a quick local
  smoke test (see above) before relying on a deploy.
