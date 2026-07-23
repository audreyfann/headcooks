import { formatDisplayQuantity } from "./quantities.js";
import { WEIGHT_TO_GRAMS, VOLUME_TO_ML, FALLBACK_DENSITY_G_PER_CUP } from "./config.js";

// Groups every parseable row under ONE entry per ingredient, regardless of
// unit. Where possible, everything is merged into a single quantity line:
//   - weight units merge via grams
//   - volume units merge via ml
//   - a known staple density (or, failing that, a generic water-density
//     fallback) merges weight AND volume together into one number
//   - count-like units (clove, head, slice, bunch, stick, can, pinch, bare
//     count) can't be safely merged with each other or with weight/volume,
//     so they remain as additional lines under the same ingredient rather
//     than being forced into one (misleading) number
//
// Each ingredient also carries `sourceRows`: every individual dish/cook
// contribution, for a per-recipe breakdown in the UI.
export function buildCombinedList(rows) {
  const parseable = rows.filter((r) => r.qtyBase != null && r.unitCategory != null);

  const byIngredient = new Map();
  for (const r of parseable) {
    const key = r.ingredientNormalized;
    if (!byIngredient.has(key)) byIngredient.set(key, []);
    byIngredient.get(key).push(r);
  }

  const result = [];
  for (const [ingredientNormalized, ingredientRows] of byIngredient) {
    // bucket by unitCategory first (same as before)
    const buckets = new Map(); // category -> { total, mentions, dishes }
    for (const r of ingredientRows) {
      if (!buckets.has(r.unitCategory)) {
        buckets.set(r.unitCategory, { total: 0, mentions: 0, dishes: new Set() });
      }
      const b = buckets.get(r.unitCategory);
      b.total += r.qtyBase;
      b.mentions += 1;
      if (r.dish) b.dishes.add(r.dish);
    }

    // if both a "weight" bucket and a "volume" bucket exist (neither already
    // density-merged), fall back to a generic density estimate so they
    // still combine into one number, flagged as estimated.
    let isEstimated = false;
    if (buckets.has("weight") && buckets.has("volume")) {
      const weightBucket = buckets.get("weight");
      const volumeBucket = buckets.get("volume");
      const estimatedGramsFromVolume = (volumeBucket.total / VOLUME_TO_ML.cup) * FALLBACK_DENSITY_G_PER_CUP;

      weightBucket.total += estimatedGramsFromVolume;
      weightBucket.mentions += volumeBucket.mentions;
      volumeBucket.dishes.forEach((d) => weightBucket.dishes.add(d));

      buckets.delete("volume");
      buckets.delete("weight");
      buckets.set("weight_volume_merged", weightBucket);
      isEstimated = true;
    }

    const lines = [];
    for (const [category, b] of buckets) {
      const [displayQty, displayUnit] = formatDisplayQuantity(category, b.total);
      lines.push({
        displayQty,
        displayUnit,
        nMentions: b.mentions,
        isEstimated: isEstimated && category === "weight_volume_merged",
      });
    }
    // largest-magnitude line first so the "primary" quantity is the most substantial one
    lines.sort((a, b) => b.displayQty - a.displayQty);

    const allDishes = new Set();
    for (const b of buckets.values()) b.dishes.forEach((d) => allDishes.add(d));

    const sourceRows = ingredientRows.map((r) => ({
      cook: r.cook || "",
      dish: r.dish || "",
      quantity: r.quantity != null ? String(r.quantity) : "",
      supplier: r.supplier != null ? String(r.supplier).trim() : "",
    }));

    result.push({
      ingredientNormalized,
      lines,
      nRecipes: allDishes.size,
      nMentions: ingredientRows.length,
      usedIn: Array.from(allDishes).sort().join(", "),
      sourceRows,
    });
  }

  return result.sort((a, b) => a.ingredientNormalized.localeCompare(b.ingredientNormalized));
}

// Ingredients mentioned but with no parseable quantity (e.g. "salt to taste").
export function buildUnspecifiedList(rows) {
  const unparsed = rows.filter((r) => r.qtyNum == null);

  const groups = new Map();
  for (const r of unparsed) {
    const key = r.ingredientNormalized;
    if (!groups.has(key)) {
      groups.set(key, { ingredientNormalized: key, mentions: 0, rawQuantities: new Set(), dishes: new Set() });
    }
    const g = groups.get(key);
    g.mentions += 1;
    if (r.quantity) g.rawQuantities.add(String(r.quantity));
    if (r.dish) g.dishes.add(r.dish);
  }

  const result = Array.from(groups.values()).map((g) => ({
    ingredientNormalized: g.ingredientNormalized,
    nMentions: g.mentions,
    rawQuantities: Array.from(g.rawQuantities).sort().join("; "),
    usedIn: Array.from(g.dishes).sort().join(", "),
  }));

  return result.sort((a, b) => b.nMentions - a.nMentions);
}
