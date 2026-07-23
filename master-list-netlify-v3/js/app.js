import { extractWorkbook } from "./extract.js";
import { cleanAndNormalize } from "./normalize.js";
import { addParsedQuantities } from "./quantities.js";
import { buildCombinedList, buildUnspecifiedList } from "./combine.js";
import { learnAndAssignSuppliers, recordManualAssignment, listKnownStores } from "./suppliers.js";

const dropzone = document.getElementById("dropzone");
const fileInput = document.getElementById("file-input");
const statusEl = document.getElementById("status");
const resultsEl = document.getElementById("results");
const tallyEl = document.getElementById("tally-count");
const storeGroupsEl = document.getElementById("store-groups");
const unspecifiedBody = document.getElementById("unspecified-body");
const reviewBody = document.getElementById("review-body");
const unspecifiedCount = document.getElementById("unspecified-count");
const reviewCount = document.getElementById("review-count");
const downloadCombinedBtn = document.getElementById("download-combined");
const downloadUnspecifiedBtn = document.getElementById("download-unspecified");
const downloadReviewBtn = document.getElementById("download-review");

let latestCombined = [];
let latestUnspecified = [];
let latestReview = [];

["dragenter", "dragover"].forEach((evt) =>
  dropzone.addEventListener(evt, (e) => {
    e.preventDefault();
    dropzone.classList.add("dropzone--active");
  })
);
["dragleave", "drop"].forEach((evt) =>
  dropzone.addEventListener(evt, (e) => {
    e.preventDefault();
    dropzone.classList.remove("dropzone--active");
  })
);
dropzone.addEventListener("drop", (e) => {
  const file = e.dataTransfer.files[0];
  if (file) handleFile(file);
});
dropzone.addEventListener("click", () => fileInput.click());
fileInput.addEventListener("change", () => {
  if (fileInput.files[0]) handleFile(fileInput.files[0]);
});

async function handleFile(file) {
  if (!/\.xlsx?$/i.test(file.name)) {
    setStatus("That doesn't look like a spreadsheet. Drop a .xlsx file.", "error");
    return;
  }

  resultsEl.hidden = true;
  setStatus("Reading " + file.name + " ...", "working");

  try {
    const buffer = await file.arrayBuffer();
    const rawRows = extractWorkbook(new Uint8Array(buffer));

    if (rawRows.length === 0) {
      setStatus("No ingredient rows found. Check that sheets have a header row containing \u201cQuantity\u201d.", "error");
      return;
    }

    await animateTally(rawRows.length);

    const { clean, review } = cleanAndNormalize(rawRows);
    const parsed = addParsedQuantities(clean);
    const combined = buildCombinedList(parsed);
    const unspecified = buildUnspecifiedList(parsed);

    const { assignments } = learnAndAssignSuppliers(parsed);
    for (const entry of combined) {
      entry.supplierAssignment = assignments[entry.ingredientNormalized] || { store: null, confidence: 0, alternates: [] };
    }

    latestCombined = combined;
    latestUnspecified = unspecified;
    latestReview = review;

    renderCombined(combined);
    renderUnspecified(unspecified);
    renderReview(review);

    const storeCount = new Set(
      combined.map((e) => (e.supplierAssignment.store ? e.supplierAssignment.store : "Unassigned"))
    ).size;
    setStatus(`Combined ${rawRows.length} line items into ${combined.length} entries across ${storeCount} store groups.`, "done");
    resultsEl.hidden = false;
  } catch (err) {
    console.error(err);
    setStatus("Couldn't read that file: " + err.message, "error");
  }
}

function setStatus(message, kind) {
  statusEl.textContent = message;
  statusEl.className = "status status--" + kind;
}

function animateTally(target) {
  return new Promise((resolve) => {
    const duration = 500;
    const start = performance.now();
    function step(now) {
      const progress = Math.min((now - start) / duration, 1);
      tallyEl.textContent = Math.round(progress * target);
      if (progress < 1) {
        requestAnimationFrame(step);
      } else {
        resolve();
      }
    }
    requestAnimationFrame(step);
  });
}

function renderCombined(rows) {
  storeGroupsEl.innerHTML = "";

  const groups = new Map();
  for (const r of rows) {
    const store = r.supplierAssignment && r.supplierAssignment.store ? r.supplierAssignment.store : "Unassigned";
    if (!groups.has(store)) groups.set(store, []);
    groups.get(store).push(r);
  }

  const storeNames = Array.from(groups.keys()).filter((s) => s !== "Unassigned").sort();
  if (groups.has("Unassigned")) storeNames.push("Unassigned");

  for (const storeName of storeNames) {
    const items = groups.get(storeName);
    const block = document.createElement("div");
    block.className = "receipt" + (storeName === "Unassigned" ? " receipt--unassigned" : "");

    const head = document.createElement("div");
    head.className = "receipt__head";
    head.innerHTML = `<span>${escapeHtml(storeName.toUpperCase())}</span><span class="receipt__count">${items.length} item${items.length === 1 ? "" : "s"}</span>`;
    block.appendChild(head);

    const table = document.createElement("table");
    table.className = "receipt__table";
    table.innerHTML = `
      <thead>
        <tr>
          <th>Ingredient</th>
          <th class="num" colspan="2">Quantity</th>
          <th class="num">Dishes</th>
          <th>Store</th>
        </tr>
      </thead>
      <tbody></tbody>
    `;
    const tbody = table.querySelector("tbody");

    items.forEach((r, idx) => {
      const mainRow = document.createElement("tr");
      mainRow.className = "receipt__row";

      const linesHtml = r.lines
        .map(
          (line) =>
            `<div class="qty-line"><span class="num">${line.displayQty}</span> ${escapeHtml(line.displayUnit)}${line.isEstimated ? '<span class="est-flag" title="Estimated: weight and volume mentions were combined using a generic density, since this ingredient has no known density on file.">~est</span>' : ""}</div>`
        )
        .join("");

      const assignment = r.supplierAssignment || { store: null, confidence: 0, manual: false };
      const confidenceNote =
        assignment.store && !assignment.manual && assignment.confidence < 1
          ? `<span class="conf-flag" title="Guessed from ${Math.round(assignment.confidence * 100)}% of past mentions">?</span>`
          : "";

      mainRow.innerHTML = `
        <td>
          <button class="expand-toggle" aria-expanded="false" aria-label="Show per-recipe breakdown">▸</button>
          ${escapeHtml(r.ingredientNormalized)}
        </td>
        <td class="num qty-cell" colspan="2">${linesHtml}</td>
        <td class="num">${r.nRecipes}</td>
        <td class="store-cell">
          <select class="store-select" aria-label="Store for ${escapeHtml(r.ingredientNormalized)}">
            ${storeOptionsHtml(assignment.store)}
          </select>${confidenceNote}
        </td>
      `;
      tbody.appendChild(mainRow);

      const detailRow = document.createElement("tr");
      detailRow.className = "receipt__detail";
      detailRow.hidden = true;
      const detailItems = r.sourceRows
        .map(
          (s) =>
            `<tr><td>${escapeHtml(s.dish || "(no dish listed)")}</td><td>${escapeHtml(s.cook)}</td><td class="num">${escapeHtml(s.quantity || "\u2014")}</td><td>${escapeHtml(s.supplier || "\u2014")}</td></tr>`
        )
        .join("");
      detailRow.innerHTML = `
        <td colspan="5">
          <table class="detail-table">
            <thead><tr><th>Dish</th><th>Cook</th><th class="num">Quantity (as written)</th><th>Supplier (as written)</th></tr></thead>
            <tbody>${detailItems}</tbody>
          </table>
        </td>
      `;
      tbody.appendChild(detailRow);

      mainRow.querySelector(".expand-toggle").addEventListener("click", (e) => {
        e.stopPropagation();
        const nowHidden = !detailRow.hidden;
        detailRow.hidden = nowHidden;
        const btn = mainRow.querySelector(".expand-toggle");
        btn.setAttribute("aria-expanded", String(!nowHidden));
        btn.textContent = nowHidden ? "▸" : "▾";
      });

      const select = mainRow.querySelector(".store-select");
      select.addEventListener("change", () => {
        let newStore = select.value;
        if (newStore === "__new__") {
          newStore = window.prompt("New store name:");
          if (!newStore || !newStore.trim()) {
            select.value = assignment.store || "";
            return;
          }
        }
        recordManualAssignment(r.ingredientNormalized, newStore);
        r.supplierAssignment = { store: normalizeAfterManual(newStore), confidence: 1, manual: true, alternates: [] };
        renderCombined(latestCombined); // re-render everything so the item moves to its new store's section
      });
    });

    block.appendChild(table);
    const tear = document.createElement("div");
    tear.className = "receipt__tear";
    tear.setAttribute("aria-hidden", "true");
    block.appendChild(tear);

    storeGroupsEl.appendChild(block);
  }
}

function storeOptionsHtml(currentStore) {
  const known = listKnownStores();
  let html = `<option value="" ${!currentStore ? "selected" : ""}>— unassigned —</option>`;
  for (const store of known) {
    html += `<option value="${escapeHtml(store)}" ${store === currentStore ? "selected" : ""}>${escapeHtml(store)}</option>`;
  }
  html += `<option value="__new__">+ new store\u2026</option>`;
  return html;
}

function normalizeAfterManual(store) {
  return store.trim().split(/\s+/).map((w) => w[0].toUpperCase() + w.slice(1)).join(" ");
}

function renderUnspecified(rows) {
  unspecifiedCount.textContent = rows.length;
  unspecifiedBody.innerHTML = "";
  for (const r of rows) {
    const tr = document.createElement("tr");
    tr.innerHTML = `
      <td>${escapeHtml(r.ingredientNormalized)}</td>
      <td class="num">${r.nMentions}</td>
      <td>${escapeHtml(r.rawQuantities)}</td>
      <td class="used-in">${escapeHtml(r.usedIn)}</td>
    `;
    unspecifiedBody.appendChild(tr);
  }
}

function renderReview(rows) {
  reviewCount.textContent = rows.length;
  reviewBody.innerHTML = "";
  for (const r of rows) {
    const tr = document.createElement("tr");
    tr.innerHTML = `
      <td>${escapeHtml(r.cook || "")}</td>
      <td>${escapeHtml(r.dish || "")}</td>
      <td>${escapeHtml(r.ingredient || "")}</td>
      <td>${escapeHtml(r.quantity != null ? String(r.quantity) : "")}</td>
    `;
    reviewBody.appendChild(tr);
  }
}

function escapeHtml(str) {
  if (str == null) return "";
  return String(str)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function toCsv(rows, columns) {
  const header = columns.map((c) => c.label).join(",");
  const lines = rows.map((row) =>
    columns
      .map((c) => {
        const val = row[c.key] != null ? String(row[c.key]) : "";
        return `"${val.replace(/"/g, '""')}"`;
      })
      .join(",")
  );
  return [header, ...lines].join("\n");
}

function downloadCsv(filename, csvText) {
  const blob = new Blob([csvText], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

downloadCombinedBtn.addEventListener("click", () => {
  const flatRows = [];
  for (const r of latestCombined) {
    const store = r.supplierAssignment && r.supplierAssignment.store ? r.supplierAssignment.store : "";
    for (const line of r.lines) {
      flatRows.push({
        ingredient: r.ingredientNormalized,
        quantity: line.displayQty,
        unit: line.displayUnit,
        estimated: line.isEstimated ? "yes" : "no",
        store,
        n_recipes: r.nRecipes,
        used_in: r.usedIn,
      });
    }
  }
  const csv = toCsv(flatRows, [
    { key: "ingredient", label: "ingredient" },
    { key: "quantity", label: "quantity" },
    { key: "unit", label: "unit" },
    { key: "estimated", label: "estimated" },
    { key: "store", label: "store" },
    { key: "n_recipes", label: "n_recipes" },
    { key: "used_in", label: "used_in" },
  ]);
  downloadCsv("combined_shopping_list.csv", csv);
});

downloadUnspecifiedBtn.addEventListener("click", () => {
  const csv = toCsv(latestUnspecified, [
    { key: "ingredientNormalized", label: "ingredient" },
    { key: "nMentions", label: "n_mentions" },
    { key: "rawQuantities", label: "raw_quantities" },
    { key: "usedIn", label: "used_in" },
  ]);
  downloadCsv("unspecified_quantity_items.csv", csv);
});

downloadReviewBtn.addEventListener("click", () => {
  const csv = toCsv(latestReview, [
    { key: "cook", label: "cook" },
    { key: "dish", label: "dish" },
    { key: "ingredient", label: "ingredient" },
    { key: "quantity", label: "quantity" },
  ]);
  downloadCsv("needs_manual_review.csv", csv);
});
