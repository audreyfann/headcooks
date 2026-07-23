import { extractWorkbook } from "./extract.js";
import { cleanAndNormalize } from "./normalize.js";
import { addParsedQuantities } from "./quantities.js";
import { buildCombinedList, buildUnspecifiedList } from "./combine.js";

const dropzone = document.getElementById("dropzone");
const fileInput = document.getElementById("file-input");
const statusEl = document.getElementById("status");
const resultsEl = document.getElementById("results");
const tallyEl = document.getElementById("tally-count");
const combinedBody = document.getElementById("combined-body");
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

    latestCombined = combined;
    latestUnspecified = unspecified;
    latestReview = review;

    renderCombined(combined);
    renderUnspecified(unspecified);
    renderReview(review);

    setStatus(`Combined ${rawRows.length} line items into ${combined.length} entries.`, "done");
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
  combinedBody.innerHTML = "";
  for (const r of rows) {
    const tr = document.createElement("tr");
    tr.innerHTML = `
      <td>${escapeHtml(r.ingredientNormalized)}</td>
      <td class="num">${r.displayQty}</td>
      <td>${escapeHtml(r.displayUnit)}</td>
      <td class="num">${r.nRecipes}</td>
      <td class="used-in">${escapeHtml(r.usedIn)}</td>
    `;
    combinedBody.appendChild(tr);
  }
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
  const csv = toCsv(latestCombined, [
    { key: "ingredientNormalized", label: "ingredient" },
    { key: "displayQty", label: "quantity" },
    { key: "displayUnit", label: "unit" },
    { key: "nRecipes", label: "n_recipes" },
    { key: "usedIn", label: "used_in" },
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
