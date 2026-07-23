# ingredient-extractor

Extracts, normalizes, and combines ingredient lists from multi-sheet
recipe / menu-planning spreadsheets — the kind where each sheet is one
cook's or one event's menu, and each dish has its own ingredient table.

Given a workbook like this:

```
Sheet: "Adam"
  Name: Adam Golomb
  ...
  Naomi Osaka Bowl
  Recipe Instructions: ...
  Ingredient          | Quantity | Notes           | Status    | Supplier | Arrived
  Quinoa (dry)         | 1/2 cup  | scaled down     |           |          | FALSE
  Baby spinach         | 6 lbs    | washed & dried  |           |          | FALSE
  Chicken breast/thigh  | 14 lbs   | blackened       | Ordered   |          | TRUE
  ...
  Green Goddess Salad
  Recipe Instructions: ...
  Ingredient          | Quantity | ...
  ...
```

it produces a single combined shopping list across every sheet, with the
same ingredient written different ways (`"Baby spinach"`, `"fresh spinach"`,
`"Spinach"`) grouped together, and quantities in different units (cups vs.
grams, cloves vs. heads of garlic) combined wherever that's actually safe to
do.

## Install

```bash
pip install -r requirements.txt
```

## Usage

```bash
python -m ingredient_extractor.cli path/to/workbook.xlsx --output-dir output/
```

This produces four CSV files in `output/`:

| File | Contents |
|---|---|
| `combined_shopping_list.csv` | One row per ingredient (+ unit family), with quantities summed across every dish/sheet that uses it |
| `unspecified_quantity_items.csv` | Ingredients mentioned without a parseable quantity ("salt, to taste") — grouped so you can see every dish that needs them |
| `needs_manual_review.csv` | Rows where the "ingredient" cell looks like pasted recipe text rather than a real ingredient name — worth a human glance |
| `all_ingredients_parsed.csv` | Every ingredient row, un-aggregated, with all intermediate parsing columns (normalized name, parsed quantity/unit, base quantity) |

### Skipping non-data sheets

By default, sheets named `InstructionsGuide`, `TEMPLATE`, `Sheet11`, and
`RowSig` are skipped (common template/utility tab names). Override with:

```bash
python -m ingredient_extractor.cli workbook.xlsx --skip-sheets TEMPLATE Notes Cover
```

### Using it as a library

```python
from ingredient_extractor.extract import extract_workbook
from ingredient_extractor.normalize import clean_and_normalize
from ingredient_extractor.quantities import add_parsed_quantities
from ingredient_extractor.combine import build_combined_list

raw_df = extract_workbook("workbook.xlsx")
clean_df, review_df = clean_and_normalize(raw_df)
parsed_df = add_parsed_quantities(clean_df)
combined_df = build_combined_list(parsed_df)
```

## How combining works

1. **Name normalization** (`normalize.py`) — lowercases, strips parenthetical
   notes entirely (`"Kosher salt (for fries)"` → `"kosher salt"`), strips
   descriptor words (`fresh`, `baby`, `minced`, `kosher`, ...), and
   naive-singularizes (`"onions"` → `"onion"`).
2. **Quantity parsing** (`quantities.py`) — parses numbers (including
   unicode fractions like `½` and ranges like `"18-20"`, averaged) and
   matches a unit word against a known unit list. No recognized unit word →
   treated as a bare count.
3. **Unit conversion** — quantities are converted to a base unit so the same
   ingredient can be summed:
   - Weight units (`lb/oz/g/kg`) merge via grams.
   - Volume units (`cup/tbsp/tsp/ml/l/qt/gal`) merge via ml.
   - Ingredients with a known density (`config.STAPLE_DENSITY_G_PER_CUP`,
     e.g. flour, sugar, butter, oil) merge weight **and** volume together.
   - Ingredients with a unit override (`config.INGREDIENT_UNIT_OVERRIDES`,
     currently just garlic → cloves) convert everything to that
     ingredient's natural unit.
   - Everything else (`clove`, `head`, `slice`, `bunch`, `stick`, `can`,
     `pinch`, bare `count`) is kept **separate** — a "head" of garlic is
     never merged with a "clove", since that would silently corrupt the
     quantity.

## Configuration

All of the above is tunable in `ingredient_extractor/config.py`:
sheets to skip, descriptor words to strip, unit conversion tables,
staple densities, and ingredient-specific unit overrides. Add more
overrides the same way garlic is defined:

```python
INGREDIENT_UNIT_OVERRIDES = {
    "garlic": {
        "display_unit": "clove",
        "conversions": {"tsp": 1, "tbsp": 3, "cup": 48, "head": 10, "lb": 80, "oz": 5, "clove": 1, "count": 1},
    },
    "onion": {
        "display_unit": "onion",
        "conversions": {"lb": 2, "count": 1},
    },
}
```

## Known limitations

- **Density and unit-override values are standard kitchen-reference
  approximations**, not measured from your actual ingredients. Good enough
  for shopping-list purposes; not lab-precise.
- **Quantity ranges are averaged**, not maxed — `"18-20 avocados"` becomes
  19, not 20. Change this in `quantities.parse_quantity` if you'd rather
  round up for shopping purposes.
- **Messy source cells** (e.g. someone pasting an entire external recipe's
  text into a single "ingredient" cell) are caught by a length/word-count
  heuristic and routed to `needs_manual_review.csv` rather than corrupting
  the combined list — but the heuristic isn't perfect. Skim that file.
- **Header detection requires a "Quantity" column header** somewhere in the
  row. If your sheets use different header wording entirely, update
  `config.HEADER_KEYWORDS`.

## Tests

```bash
python -m pytest tests/
```
