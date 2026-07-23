import {
  UNICODE_FRACTIONS, UNIT_MAP, WEIGHT_TO_GRAMS, VOLUME_TO_ML,
  STAPLE_DENSITY_G_PER_CUP, INGREDIENT_UNIT_OVERRIDES,
} from "./config.js";

function replaceFractions(s) {
  for (const [fracChar, fracVal] of Object.entries(UNICODE_FRACTIONS)) {
    const re = new RegExp(`(\\d*)${fracChar}`, "g");
    s = s.replace(re, (match, prefix) => {
      const base = prefix ? parseInt(prefix, 10) : 0;
      return String(base + fracVal);
    });
  }
  return s;
}

// Returns [number, unitCode]. unitCode is a UNIT_MAP value, or "count" if a
// number was found with no recognized unit word, or [null, null] if nothing
// parseable was found (e.g. "as needed").
export function parseQuantity(raw) {
  if (typeof raw !== "string" || !raw.trim()) return [null, null];

  let s = raw.trim().toLowerCase();
  if (["as needed", "to taste", "optional", "as desired"].some((kw) => s.includes(kw))) {
    return [null, null];
  }

  s = replaceFractions(s);

  let num, rest;
  const rangeMatch = s.match(/^([\d.]+)\s*[-\u2013]\s*([\d.]+)/);
  if (rangeMatch) {
    num = (parseFloat(rangeMatch[1]) + parseFloat(rangeMatch[2])) / 2;
    rest = s.slice(rangeMatch[0].length).trim();
  } else {
    const numMatch = s.match(/^([\d.]+)/);
    if (!numMatch) return [null, null];
    num = parseFloat(numMatch[1]);
    rest = s.slice(numMatch[0].length).trim();
  }

  let unit = "count";
  for (const word of rest.split(/\s+/)) {
    const wordClean = word.replace(/[^a-z]/g, "");
    if (UNIT_MAP[wordClean]) {
      unit = UNIT_MAP[wordClean];
      break;
    }
  }

  return [num, unit];
}

function toBaseWeightOrVolume(qtyNum, unit) {
  if (WEIGHT_TO_GRAMS[unit] !== undefined) return [qtyNum * WEIGHT_TO_GRAMS[unit], "weight"];
  if (VOLUME_TO_ML[unit] !== undefined) return [qtyNum * VOLUME_TO_ML[unit], "volume"];
  return [null, null];
}

// Convert a single (ingredient, number, unit) into [baseQuantity, category].
// `category` doubles as the grouping key AND tells the formatter which
// family of units to display back in.
export function convertRow(ingredientNormalized, qtyNum, unit) {
  if (qtyNum == null || unit == null) return [null, null];

  const override = INGREDIENT_UNIT_OVERRIDES[ingredientNormalized];
  if (override) {
    if (override.conversions[unit] !== undefined) {
      return [qtyNum * override.conversions[unit], override.displayUnit];
    }
    return [null, null]; // unit not covered by the override -- can't safely convert
  }

  const density = STAPLE_DENSITY_G_PER_CUP[ingredientNormalized];
  if (density !== undefined && (WEIGHT_TO_GRAMS[unit] !== undefined || VOLUME_TO_ML[unit] !== undefined)) {
    let grams;
    if (WEIGHT_TO_GRAMS[unit] !== undefined) {
      grams = qtyNum * WEIGHT_TO_GRAMS[unit];
    } else {
      const cups = (qtyNum * VOLUME_TO_ML[unit]) / VOLUME_TO_ML.cup;
      grams = cups * density;
    }
    return [grams, "weight_volume_merged"];
  }

  const [baseVal, baseCat] = toBaseWeightOrVolume(qtyNum, unit);
  if (baseVal !== null) return [baseVal, baseCat];

  // anything else (clove, head, slice, bunch, stick, can, pinch, count):
  // keep as its own distinct, non-mergeable category
  return [qtyNum, unit];
}

// Adds qtyNum, qtyUnit, qtyBase, unitCategory to each row.
// Requires an `ingredientNormalized` field (see normalize.js).
export function addParsedQuantities(rows) {
  return rows.map((row) => {
    const [qtyNum, qtyUnit] = parseQuantity(row.quantity);
    const [qtyBase, unitCategory] = convertRow(row.ingredientNormalized, qtyNum, qtyUnit);
    return { ...row, qtyNum, qtyUnit, qtyBase, unitCategory };
  });
}

// Convert a summed base quantity back into a human-friendly display unit.
export function formatDisplayQuantity(unitCategory, totalBaseQty) {
  if (unitCategory === "weight" || unitCategory === "weight_volume_merged") {
    if (totalBaseQty >= WEIGHT_TO_GRAMS.lb) {
      return [round2(totalBaseQty / WEIGHT_TO_GRAMS.lb), "lb"];
    }
    if (unitCategory === "weight_volume_merged") {
      return [round1(totalBaseQty), "g"];
    }
    return [round2(totalBaseQty / WEIGHT_TO_GRAMS.oz), "oz"];
  }

  if (unitCategory === "volume") {
    if (totalBaseQty >= VOLUME_TO_ML.cup) return [round2(totalBaseQty / VOLUME_TO_ML.cup), "cup"];
    if (totalBaseQty >= VOLUME_TO_ML.tbsp) return [round2(totalBaseQty / VOLUME_TO_ML.tbsp), "tbsp"];
    return [round2(totalBaseQty / VOLUME_TO_ML.tsp), "tsp"];
  }

  // ingredient-specific override units (e.g. "clove") and bare count-like
  // units (head, slice, bunch, stick, can, pinch, count)
  return [round2(totalBaseQty), unitCategory];
}

function round2(n) { return Math.round(n * 100) / 100; }
function round1(n) { return Math.round(n * 10) / 10; }
