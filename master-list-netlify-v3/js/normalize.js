import { VAGUE_QUANTITY_PREFIXES, NAME_MODIFIERS, MAX_INGREDIENT_NAME_LENGTH, MAX_INGREDIENT_NAME_WORDS } from "./config.js";

// "a drizzle of sesame oil" -> "sesame oil"
export function stripVagueQuantityPrefix(raw) {
  if (typeof raw !== "string") return raw;
  let s = raw.trim();
  for (const pattern of VAGUE_QUANTITY_PREFIXES) {
    s = s.replace(pattern, "");
  }
  return s.trim();
}

// Lowercase, strip parenthetical content entirely, strip descriptor words,
// naive singularize. Returns a normalized grouping key for the ingredient.
export function normalizeIngredientName(raw) {
  if (typeof raw !== "string") return null;

  let s = raw.trim().toLowerCase();
  s = s.replace(/\([^)]*\)/g, "");
  s = s.replace(/\[[^\]]*\]/g, "");
  s = s.replace(/[/,]/g, " ");
  s = s.replace(/[^a-z\s-]/g, "");
  s = s.replace(/\s+/g, " ").trim();

  let tokens = s.split(" ").filter((t) => t && !NAME_MODIFIERS.has(t));
  s = tokens.join(" ").trim();

  const words = s.split(" ").map((w) => {
    if (w.length > 3 && w.endsWith("s") && !w.endsWith("ss")) {
      return w.slice(0, -1);
    }
    return w;
  });
  s = words.join(" ").trim();

  return s || raw.trim().toLowerCase();
}

export function isProbablyPastedText(ingredient) {
  if (typeof ingredient !== "string") return false;
  const tooLong = ingredient.length > MAX_INGREDIENT_NAME_LENGTH;
  const tooManyWords = ingredient.trim().split(/\s+/).length > MAX_INGREDIENT_NAME_WORDS;
  return tooLong || tooManyWords;
}

// Takes raw extracted rows and returns { clean, review }.
// clean rows get an added `ingredientNormalized` field.
// review rows are flagged as likely pasted recipe text, kept separately.
export function cleanAndNormalize(rows) {
  const clean = [];
  const review = [];

  for (const row of rows) {
    const stripped = stripVagueQuantityPrefix(row.ingredient);
    const updated = { ...row, ingredient: stripped };

    if (isProbablyPastedText(stripped)) {
      review.push(updated);
    } else {
      updated.ingredientNormalized = normalizeIngredientName(stripped);
      clean.push(updated);
    }
  }

  return { clean, review };
}
