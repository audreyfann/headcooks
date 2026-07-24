import { DEFAULT_SKIP_SHEETS, HEADER_KEYWORDS } from "./config.js";

// XLSX is loaded globally from the SheetJS CDN script tag in index.html

function detectHeader(row) {
  const hasQuantity = row.some((c) => typeof c === "string" && c.trim() === "Quantity");
  if (!hasQuantity) return null;

  const headerMap = {};
  row.forEach((c, idx) => {
    if (typeof c !== "string" || !c.trim()) return;
    const key = c.trim().toLowerCase();
    if (key === "`") {
      headerMap[idx] = "ingredient";
      return;
    }
    for (const [keyword, field] of Object.entries(HEADER_KEYWORDS)) {
      if (key.includes(keyword)) {
        headerMap[idx] = field;
        break;
      }
    }
  });
  return headerMap;
}

function extractCookName(sheetRows, sheetName) {
  for (let i = 0; i < Math.min(6, sheetRows.length); i++) {
    const row = sheetRows[i];
    if (row && row[0] && typeof row[0] === "string" && row[0].trim().toLowerCase().startsWith("name")) {
      if (row[1]) return row[1];
    }
  }
  return sheetName;
}

function extractSheetRows(sheetRows, sheetName) {
  const cookName = extractCookName(sheetRows, sheetName);
  let currentDish = null;
  let headerMap = null;
  const records = [];

  for (const row of sheetRows) {
    const detected = detectHeader(row);
    if (detected) {
      headerMap = detected;
      continue;
    }

    const c1 = row[1];
    const c2 = row[2];

    if (headerMap === null) {
      if (typeof c1 === "string" && c1.trim() && c2 == null && !c1.trim().toLowerCase().startsWith("recipe instructions")) {
        currentDish = c1.trim();
      }
      continue;
    }

    const ingIdx = Object.entries(headerMap).find(([, v]) => v === "ingredient")?.[0];
    const qtyIdx = Object.entries(headerMap).find(([, v]) => v === "quantity")?.[0];
    const ingredientVal = ingIdx !== undefined ? row[ingIdx] : null;
    const quantityVal = qtyIdx !== undefined ? row[qtyIdx] : null;

    if (typeof c1 === "string" && c1.trim() && quantityVal == null && ingredientVal == null) {
      if (!c1.trim().toLowerCase().startsWith("recipe instructions")) {
        currentDish = c1.trim();
      }
      headerMap = null;
      continue;
    }

    if (ingredientVal == null && quantityVal == null) continue;
    if (typeof ingredientVal === "string" && ingredientVal.trim().toLowerCase().startsWith("recipe instructions")) continue;

    const record = { cook: cookName, sheet: sheetName, dish: currentDish };
    for (const [idx, field] of Object.entries(headerMap)) {
      record[field] = row[idx] ?? null;
    }
    records.push(record);
  }

  return records;
}

// arrayBuffer: the uploaded file's contents. skipSheets: optional override Set.
export function extractWorkbook(arrayBuffer, skipSheets = DEFAULT_SKIP_SHEETS) {
  // cellDates: true makes date-formatted cells come through as JS Date
  // objects instead of raw Excel serial numbers. This matters because
  // Excel/Sheets silently auto-converts things like "4-6" (a range someone
  // typed into a Quantity cell) into a date (April 6th) -- without this
  // option, that cell would read back as a meaningless number like 46118.
  // With it, we can detect the Date and reconstruct "4-6" (see
  // recoverDateMangledQuantity below).
  const wb = XLSX.read(arrayBuffer, { type: "array", cellDates: true });
  let allRecords = [];

  for (const sheetName of wb.SheetNames) {
    if (skipSheets.has(sheetName)) continue;
    const ws = wb.Sheets[sheetName];
    const rows = XLSX.utils.sheet_to_json(ws, { header: 1, raw: true, defval: null });
    allRecords = allRecords.concat(extractSheetRows(rows, sheetName));
  }

  for (const record of allRecords) {
    if (record.quantity instanceof Date) {
      record.quantity = recoverDateMangledQuantity(record.quantity);
    }
  }

  return allRecords.filter(
    (r) => r.ingredient != null && typeof r.ingredient === "string" && r.ingredient.trim() !== ""
  );
}

// Excel/Sheets auto-converts a typed range like "4-6" into a date (April
// 6th) when a Quantity cell has no other formatting to hint it's text.
// Recover the original-looking text by reading the month/day back off the
// Date object -- "4-6" in, "4-6" back out. This can't perfectly recover
// every possible original (e.g. "04-06" loses its leading zeros, and a
// genuine date would obviously also round-trip as itself), but it turns a
// meaningless serial number into a plausible, usable range instead.
function recoverDateMangledQuantity(date) {
  const month = date.getMonth() + 1;
  const day = date.getDate();
  return `${month}-${day}`;
}
