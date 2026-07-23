import { formatDisplayQuantity } from "./quantities.js";

// rows must already have qtyBase and unitCategory (see quantities.addParsedQuantities).
// Returns one row per (ingredient, unit family) with summed, display-formatted quantities.
export function buildCombinedList(rows) {
  const parseable = rows.filter((r) => r.qtyBase != null && r.unitCategory != null);

  const groups = new Map();
  for (const r of parseable) {
    const key = `${r.ingredientNormalized}||${r.unitCategory}`;
    if (!groups.has(key)) {
      groups.set(key, {
        ingredientNormalized: r.ingredientNormalized,
        unitCategory: r.unitCategory,
        totalBaseQty: 0,
        recipes: new Set(),
        mentions: 0,
        dishes: new Set(),
      });
    }
    const g = groups.get(key);
    g.totalBaseQty += r.qtyBase;
    g.mentions += 1;
    if (r.dish) g.dishes.add(r.dish);
  }

  const result = [];
  for (const g of groups.values()) {
    const [displayQty, displayUnit] = formatDisplayQuantity(g.unitCategory, g.totalBaseQty);
    result.push({
      ingredientNormalized: g.ingredientNormalized,
      displayQty,
      displayUnit,
      nRecipes: g.dishes.size,
      nMentions: g.mentions,
      usedIn: Array.from(g.dishes).sort().join(", "),
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
