/*
 * Learns which store each ingredient is usually bought from, based on the
 * "Supplier" column already present in the spreadsheet (when filled in),
 * and remembers that across sessions so future uploads -- even ones with
 * gaps in the Supplier column -- can be auto-assigned a likely store.
 *
 * Two layers feed each decision:
 *   1. SUPPLIER_SEED -- a static baseline built from historical spreadsheets,
 *      shipped with the site (see js/data/supplier-seed.js). Never written
 *      to. Gives a fresh browser a reasonable starting guess.
 *   2. localStorage (STORAGE_KEY) -- what's actually been learned/corrected
 *      IN THIS BROWSER, from uploads and manual picks. Always outweighs the
 *      seed when the two disagree, since it reflects real, current usage.
 *
 * Storage shape (localStorage key STORAGE_KEY):
 *   {
 *     "<ingredientNormalized>": {
 *       "<storeName>": { count: number, manual: boolean }
 *     },
 *     ...
 *   }
 *
 * `manual` mentions (the person explicitly picked a store in the UI) are
 * weighted higher than spreadsheet mentions, so a correction sticks even
 * against a lot of historical noise.
 */

import { SUPPLIER_SEED } from "./data/supplier-seed.js";

const STORAGE_KEY = "ingredientSupplierMap.v1";
const MANUAL_WEIGHT = 5; // one manual correction counts as this many spreadsheet mentions
const SEED_WEIGHT_SCALE = 0.5; // seed mentions count for less than a live spreadsheet mention

export function normalizeStoreName(raw) {
  if (typeof raw !== "string") return null;
  const trimmed = raw.trim();
  if (!trimmed) return null;
  // Title-case-ish canonical form so "Weee" and "weee" collapse together,
  // while keeping multi-word store names readable ("Trader Joe's").
  return trimmed
    .split(/\s+/)
    .map((w) => (w.length > 0 ? w[0].toUpperCase() + w.slice(1) : w))
    .join(" ");
}

function loadStoredMap() {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : {};
  } catch (e) {
    console.warn("Couldn't read supplier history from localStorage:", e);
    return {};
  }
}

function saveStoredMap(map) {
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(map));
  } catch (e) {
    console.warn("Couldn't save supplier history to localStorage:", e);
  }
}

// Combines the static seed and the live stored map into one set of
// per-store weights for a single ingredient. Seed contributes at a reduced
// weight; live mentions (and especially manual corrections) can outweigh it.
function mergedWeights(ingredientNormalized, stored) {
  const weights = {}; // store -> { weight, manual }

  const seedBucket = SUPPLIER_SEED[ingredientNormalized];
  if (seedBucket) {
    for (const [store, count] of Object.entries(seedBucket)) {
      weights[store] = { weight: count * SEED_WEIGHT_SCALE, manual: false };
    }
  }

  const storedBucket = stored[ingredientNormalized];
  if (storedBucket) {
    for (const [store, info] of Object.entries(storedBucket)) {
      const liveWeight = info.count * (info.manual ? MANUAL_WEIGHT : 1);
      if (weights[store]) {
        weights[store].weight += liveWeight;
        weights[store].manual = weights[store].manual || info.manual;
      } else {
        weights[store] = { weight: liveWeight, manual: info.manual };
      }
    }
  }

  return weights;
}

function pickBestStore(weights) {
  const entries = Object.entries(weights).map(([store, info]) => ({
    store,
    weight: info.weight,
    manual: info.manual,
  }));

  if (entries.length === 0) {
    return { store: null, confidence: 0, manual: false, alternates: [] };
  }

  // A manual pick means "I'm telling you where I get this" -- it should
  // never lose to accumulated spreadsheet mentions, no matter how many.
  // So: if any manual entry exists, the winner is chosen from the manual
  // entries only. Non-manual entries still show up as alternates.
  const manualEntries = entries.filter((e) => e.manual);
  const pool = manualEntries.length > 0 ? manualEntries : entries;

  pool.sort((a, b) => b.weight - a.weight);
  const top = pool[0];
  const totalWeight = entries.reduce((sum, e) => sum + e.weight, 0);

  const alternates = entries
    .filter((e) => e.store !== top.store)
    .sort((a, b) => b.weight - a.weight)
    .map((e) => e.store);

  return {
    store: top.store,
    confidence: totalWeight > 0 ? top.weight / totalWeight : 0,
    manual: top.manual,
    alternates,
  };
}

// Merge this file's explicit Supplier mentions into the persisted map, then
// return { map, assignments } where `assignments` gives each ingredient in
// `rows` its best-guess store, blending seed knowledge with live history.
export function learnAndAssignSuppliers(rows) {
  const stored = loadStoredMap();

  for (const r of rows) {
    const store = normalizeStoreName(r.supplier);
    if (!store || !r.ingredientNormalized) continue;

    if (!stored[r.ingredientNormalized]) stored[r.ingredientNormalized] = {};
    const bucket = stored[r.ingredientNormalized];
    bucket[store] = bucket[store] || { count: 0, manual: false };
    bucket[store].count += 1;
  }

  saveStoredMap(stored);

  const assignments = {};
  const allIngredients = new Set(rows.map((r) => r.ingredientNormalized).filter(Boolean));
  for (const ingredient of allIngredients) {
    assignments[ingredient] = pickBestStore(mergedWeights(ingredient, stored));
  }

  return { map: stored, assignments };
}

// Called when the person manually assigns/corrects a store for an ingredient.
export function recordManualAssignment(ingredientNormalized, store) {
  const normalized = normalizeStoreName(store);
  if (!ingredientNormalized || !normalized) return;

  const stored = loadStoredMap();
  if (!stored[ingredientNormalized]) stored[ingredientNormalized] = {};
  stored[ingredientNormalized][normalized] = stored[ingredientNormalized][normalized] || { count: 0, manual: false };
  stored[ingredientNormalized][normalized].count += 1;
  stored[ingredientNormalized][normalized].manual = true;

  saveStoredMap(stored);
  return pickBestStore(mergedWeights(ingredientNormalized, stored));
}

// All store names ever seen (seed + this browser's history), for populating
// a manual-assignment dropdown.
export function listKnownStores() {
  const stored = loadStoredMap();
  const stores = new Set();

  for (const bucket of Object.values(SUPPLIER_SEED)) {
    for (const store of Object.keys(bucket)) stores.add(store);
  }
  for (const bucket of Object.values(stored)) {
    for (const store of Object.keys(bucket)) stores.add(store);
  }

  return Array.from(stores).sort();
}
