/*
 * Learns which store each ingredient is usually bought from, based on the
 * "Supplier" column already present in the spreadsheet (when filled in),
 * and remembers that across sessions so future uploads -- even ones with
 * gaps in the Supplier column -- can be auto-assigned a likely store.
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

const STORAGE_KEY = "ingredientSupplierMap.v1";
const MANUAL_WEIGHT = 5; // one manual correction counts as this many spreadsheet mentions

function normalizeStoreName(raw) {
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

// Merge this file's explicit Supplier mentions into the persisted map, then
// return { map, assignments } where `assignments` gives each ingredient its
// best-guess store plus whether that came from THIS file or purely from
// history.
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
    assignments[ingredient] = pickBestStore(stored[ingredient]);
  }

  return { map: stored, assignments };
}

function pickBestStore(bucket) {
  if (!bucket || Object.keys(bucket).length === 0) {
    return { store: null, confidence: 0, alternates: [] };
  }
  const entries = Object.entries(bucket).map(([store, info]) => ({
    store,
    weight: info.count * (info.manual ? MANUAL_WEIGHT : 1),
    manual: info.manual,
  }));
  entries.sort((a, b) => b.weight - a.weight);

  const top = entries[0];
  const totalWeight = entries.reduce((sum, e) => sum + e.weight, 0);

  return {
    store: top.store,
    confidence: totalWeight > 0 ? top.weight / totalWeight : 0,
    manual: top.manual,
    alternates: entries.slice(1).map((e) => e.store),
  };
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
  return pickBestStore(stored[ingredientNormalized]);
}

// All store names ever seen, for populating a manual-assignment dropdown.
export function listKnownStores() {
  const stored = loadStoredMap();
  const stores = new Set();
  for (const bucket of Object.values(stored)) {
    for (const store of Object.keys(bucket)) stores.add(store);
  }
  return Array.from(stores).sort();
}

export { normalizeStoreName };
