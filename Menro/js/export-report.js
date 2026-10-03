const exportReportOverlay    = document.getElementById("exportReportOverlay");
const btnCloseExportReport   = document.getElementById("btnCloseExportReport");
const btnCancelExportReport  = document.getElementById("btnCancelExportReport");
const btnConfirmExportReport = document.getElementById("btnConfirmExportReport");

function openExportReport() {
    if (exportReportOverlay) exportReportOverlay.classList.add("open");
}

function closeExportReport() {
    if (exportReportOverlay) exportReportOverlay.classList.remove("open");
}

function loadImageAsDataURL(src) {
    return new Promise((resolve, reject) => {
        const img = new Image();
        img.onload = () => {
            const canvas = document.createElement("canvas");
            canvas.width = img.naturalWidth;
            canvas.height = img.naturalHeight;
            canvas.getContext("2d").drawImage(img, 0, 0);
            try {
                resolve(canvas.toDataURL("image/png"));
            } catch (err) {
                reject(err);
            }
        };
        img.onerror = reject;
        img.src = src;
    });
}

const sealImagePromise = loadImageAsDataURL("../../assets/calatagan-seal.png").catch(() => null);

function zoneForSubmission(sub) {
    const areaRaw = sub["Protected_area_Zone"] || sub["Barangay"] || "";
    const zoneId = sub["_zone_id"] || (typeof zoneIdFromProtectedArea === "function" && zoneIdFromProtectedArea(areaRaw)) || BARANGAY_TO_ZONE[areaRaw];
    return zoneId ? ZONES.find(z => z.id === zoneId) : null;
}

function zoneNameForSubmission(sub) {
    const areaRaw = sub["Protected_area_Zone"] || sub["Barangay"] || "";
    const zone = zoneForSubmission(sub);
    return zone ? zone.name : (sub["_zone_name"] || areaRaw || "Unknown").replace(/_/g, " ");
}

function getExportDateRange() {
    const rangeSelect = document.getElementById("exportDateRange");
    const mode = rangeSelect ? rangeSelect.value : "all";
    const toISO = (d) => d.toISOString().slice(0, 10);
    const today = new Date();

    if (mode === "today") {
        return { from: toISO(today), to: toISO(today) };
    }
    if (mode === "7days") {
        const from = new Date(today);
        from.setDate(from.getDate() - 6);
        return { from: toISO(from), to: toISO(today) };
    }
    if (mode === "30days") {
        const from = new Date(today);
        from.setDate(from.getDate() - 29);
        return { from: toISO(from), to: toISO(today) };
    }
    if (mode === "thisyear") {
        const year = today.getFullYear();
        return { from: `${year}-01-01`, to: toISO(today) };
    }
    if (mode === "lastyear") {
        const year = today.getFullYear() - 1;
        return { from: `${year}-01-01`, to: `${year}-12-31` };
    }
    if (mode === "custom") {
        const fromInput = document.getElementById("exportDateFrom");
        const toInput = document.getElementById("exportDateTo");
        return {
            from: fromInput && fromInput.value ? fromInput.value : null,
            to: toInput && toInput.value ? toInput.value : null,
        };
    }
    return { from: null, to: null };
}

function exportRangeLabel() {
    const { from, to } = getExportDateRange();
    if (!from && !to) return `Generated ${new Date().toLocaleString("en-US")}`;

    const fmt = (iso) => new Date(iso + "T00:00:00").toLocaleDateString("en-US", { year: "numeric", month: "short", day: "numeric" });
    if (from && to) return `${fmt(from)} – ${fmt(to)}`;
    if (from) return `From ${fmt(from)}`;
    return `Through ${fmt(to)}`;
}

// A report only earns the "Annual" title when its range is a full, completed
// calendar year (Jan 1 – Dec 31 of one year) — matching how MENRO actually
// compiles an annual report, once the year is over. Anything shorter (a day,
// a week, a month, or a year still in progress) is labeled by its real period
// instead, so the document never claims to be "Annual" when it isn't.
function reportTitleInfo() {
    const { from, to } = getExportDateRange();
    if (from && to) {
        const fromD = new Date(from + "T00:00:00");
        const toD = new Date(to + "T00:00:00");
        const isFullCalendarYear = fromD.getMonth() === 0 && fromD.getDate() === 1
            && toD.getMonth() === 11 && toD.getDate() === 31
            && fromD.getFullYear() === toD.getFullYear();
        if (isFullCalendarYear) {
            return {
                title: "Annual Monitoring Data Sheet",
                subtitle: `Assessing the Climate Change Vulnerability and Recruitment Capacity of Mangrove Ecosystem — ${fromD.getFullYear()}`,
                fileTag: `annual-monitoring-data-sheet-${fromD.getFullYear()}`,
            };
        }
    }
    return {
        title: "Field Monitoring Data Sheet",
        subtitle: `Assessing the Climate Change Vulnerability and Recruitment Capacity of Mangrove Ecosystem — ${exportRangeLabel()}`,
        fileTag: "field-monitoring-data-sheet",
    };
}

function sortedSubmissions() {
    const { from, to } = getExportDateRange();
    const subDate = (sub) => (typeof koboSubmissionDate === "function" ? koboSubmissionDate(sub) : (sub["Date_of_visit"] || sub["Inspection_Date"] || ""));
    return [...ALL_SUBMISSIONS]
        .filter(sub => {
            const date = subDate(sub);
            if (from && date < from) return false;
            if (to && date > to) return false;
            return true;
        })
        .sort((a, b) => subDate(a).localeCompare(subDate(b)));
}

function healthAssessmentLabel(raw) {
    switch ((raw || "").toString().toLowerCase()) {
        case "healthy":  return "Good";
        case "moderate": return "Fair";
        case "degraded": return "Poor";
        default:         return "—";
    }
}

function prettify(raw) {
    if (!raw) return "—";
    return raw.toString()
        .replace(/___/g, " / ")
        .replace(/_/g, " ")
        .replace(/\b\w/g, (c) => c.toUpperCase());
}

function pdfEscapeHtml(str) {
    return String(str ?? "").replace(/[&<>"']/g, (ch) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[ch]));
}

// Every rule below is scoped under #pdfExportRoot so it can never leak out
// and affect the rest of the live dashboard page — several of these class
// names (.title, .fields, section, h2, table) are generic enough that they'd
// otherwise collide with this page's own styling.
const PDF_SHEET_STYLE = `
#pdfExportRoot{
  --pdf-green:#0F4C3A;
  --pdf-green-soft:#E8F0EC;
  --pdf-ink:#1D2623;
  --pdf-muted:#5E6B66;
  --pdf-rule:#C5D1CB;
  --pdf-rule-light:#E1E8E4;
  position:fixed; top:0; left:0; z-index:-1; opacity:0.01; pointer-events:none;
}
#pdfExportRoot *{box-sizing:border-box;margin:0;padding:0}
#pdfExportRoot{font-family:"Source Sans 3","Segoe UI",Arial,sans-serif;color:var(--pdf-ink);font-size:10pt;line-height:1.4}
#pdfExportRoot .sheet{width:210mm;min-height:297mm;background:#fff;padding:14mm 14mm 12mm;display:flex;flex-direction:column}

#pdfExportRoot .letterhead{display:grid;grid-template-columns:22mm 1fr 22mm;align-items:center;padding-bottom:4mm;border-bottom:2px solid var(--pdf-green)}
#pdfExportRoot .letterhead img{width:20mm;height:20mm;object-fit:contain}
#pdfExportRoot .letterhead .gov{text-align:center;font-size:9pt;line-height:1.35;color:var(--pdf-muted)}
#pdfExportRoot .letterhead .gov strong{display:block;color:var(--pdf-ink);font-size:10pt;font-weight:700}
#pdfExportRoot .rule{border-bottom:0.75px solid var(--pdf-green);margin-top:1mm}

#pdfExportRoot .title{text-align:center;margin:4mm 0 4mm}
#pdfExportRoot .title h1{font-family:"Source Serif 4",Georgia,serif;font-size:16pt;font-weight:700;color:var(--pdf-green)}
#pdfExportRoot .title p{font-size:9.5pt;color:var(--pdf-muted);font-style:italic;margin-top:1mm}

#pdfExportRoot .fields{display:grid;grid-template-columns:1fr 1fr;column-gap:10mm;row-gap:2.5mm}
#pdfExportRoot .fields div{display:grid;grid-template-columns:30mm 4mm 1fr;align-items:baseline}
#pdfExportRoot .fields dt{color:var(--pdf-muted);font-size:9.5pt;grid-column:1;grid-row:1}
#pdfExportRoot .fields div::before{content:":";grid-column:2;grid-row:1;color:var(--pdf-muted)}
#pdfExportRoot .fields dd{grid-column:3;grid-row:1;font-weight:600;min-height:5.5mm;border-bottom:0.75px solid var(--pdf-rule-light)}

#pdfExportRoot section{margin-top:7mm}
#pdfExportRoot h2{font-size:11pt;font-weight:700;color:var(--pdf-green);padding-bottom:1.5mm;margin-bottom:3mm;border-bottom:0.75px solid var(--pdf-rule)}

#pdfExportRoot table{width:100%;border-collapse:collapse;table-layout:fixed}
#pdfExportRoot .data th,#pdfExportRoot .data td{border:0.75px solid var(--pdf-rule);padding:1.8mm 2.5mm;font-size:9.5pt;vertical-align:middle}
#pdfExportRoot .data thead th{background:var(--pdf-green);color:#fff;font-weight:600;border-color:var(--pdf-green)}
#pdfExportRoot .data td{height:7.5mm;font-variant-numeric:tabular-nums}
#pdfExportRoot .data .no{width:9%;text-align:center}
#pdfExportRoot .data .num{width:16%;text-align:right}
#pdfExportRoot .data thead .num{text-align:right}
#pdfExportRoot .data thead th:not(.no):not(.num){text-align:left}
#pdfExportRoot .data tbody tr:nth-child(even) td{background:#FAFBFA}
#pdfExportRoot .data tfoot td{font-weight:700;background:var(--pdf-green-soft);border-top:1.25px solid var(--pdf-green)}

#pdfExportRoot .signatures{display:grid;grid-template-columns:1fr 1fr;gap:18mm;margin-top:12mm}
#pdfExportRoot .sig .line{border-bottom:0.75px solid var(--pdf-ink);height:12mm}
#pdfExportRoot .sig .name{font-weight:600;margin-top:1.5mm;min-height:5mm}
#pdfExportRoot .sig .role{font-size:9pt;color:var(--pdf-muted)}
#pdfExportRoot .sig .date{font-size:9pt;color:var(--pdf-muted);margin-top:3mm}

#pdfExportRoot .spacer{flex:1;min-height:6mm}
#pdfExportRoot footer{padding-top:5mm;margin-top:6mm;display:flex;justify-content:space-between;font-size:8pt;color:var(--pdf-muted);border-top:0.75px solid var(--pdf-rule-light)}
`;

function ensurePdfExportRoot() {
    let root = document.getElementById("pdfExportRoot");
    if (root) return root;
    const styleEl = document.createElement("style");
    styleEl.textContent = PDF_SHEET_STYLE;
    document.head.appendChild(styleEl);
    root = document.createElement("div");
    root.id = "pdfExportRoot";
    document.body.appendChild(root);
    return root;
}

// A "field: value" pair grid matching the printed form's own layout — two
// columns of label/value pairs, same as the paper data sheet.
function pdfFieldsHtml(pairs) {
    return `<dl class="fields">${pairs.map(([label, value]) =>
        `<div><dt>${pdfEscapeHtml(label)}</dt><dd>${pdfEscapeHtml(value)}</dd></div>`
    ).join("")}</dl>`;
}

function pdfDataTableHtml(headers, colClasses, rows, totalRow, emptyMessage) {
    const headHtml = `<tr>${headers.map((h, i) => `<th class="${colClasses[i] || ""}">${pdfEscapeHtml(h)}</th>`).join("")}</tr>`;
    const bodyHtml = rows.length > 0
        ? rows.map(cells => `<tr>${cells.map((c, i) => `<td class="${colClasses[i] || ""}">${pdfEscapeHtml(c)}</td>`).join("")}</tr>`).join("")
        : `<tr><td colspan="${headers.length}" style="text-align:center;font-style:italic;color:var(--pdf-muted)">${pdfEscapeHtml(emptyMessage)}</td></tr>`;
    const footHtml = rows.length > 0 && totalRow
        ? `<tfoot><tr>${totalRow.map((c, i) => `<td class="${colClasses[i] || ""}">${pdfEscapeHtml(c)}</td>`).join("")}</tr></tfoot>`
        : "";
    return `<table class="data"><thead>${headHtml}</thead><tbody>${bodyHtml}</tbody>${footHtml}</table>`;
}

// Builds one full A4 "Annual Monitoring Data Sheet" page for a single
// submission — same design as the official paper form, filled in with that
// submission's real data.
function buildSheetHtml(sub, sealDataUrl, pageNum, pageCount) {
    const zone = zoneForSubmission(sub);

    const trees = koboExtractTrees(sub).filter(t => koboTreeField(t, "Species_Name") || koboTreeField(t, "Species"));
    const speciesRows = trees.map(t => [
        koboTreeField(t, "Species_Name") || koboTreeField(t, "Species") || "—",
        koboTreeField(t, "Tree_Count") || "0",
        koboTreeField(t, "Sapling_Count") ?? koboTreeField(t, "Sapling_count") ?? "0",
        koboTreeField(t, "Seedling_Count") ?? koboTreeField(t, "Seedling_count") ?? "0",
    ]);
    const sumCol = (rows, i) => rows.reduce((a, r) => a + (parseFloat(r[i]) || 0), 0);
    const speciesTotal = ["Total", sumCol(speciesRows, 1), sumCol(speciesRows, 2), sumCol(speciesRows, 3)];
    const speciesTableHtml = pdfDataTableHtml(
        ["No.", "Species", "Trees", "Saplings", "Seedlings"],
        ["no", "", "num", "num", "num"],
        speciesRows.map((r, i) => [i + 1, ...r]),
        ["", ...speciesTotal],
        "No species recorded for this visit."
    );

    const mollusks = koboExtractMollusks(sub);
    const molluskRows = mollusks.map(m => [
        koboTreeField(m, "Mollusk_Species_Name") || koboTreeField(m, "Mollusk_species_name") || "—",
    ]);
    const molluskTableHtml = pdfDataTableHtml(
        ["No.", "Species"],
        ["no", ""],
        molluskRows.map((r, i) => [i + 1, ...r]),
        null,
        "No mollusks recorded for this visit."
    );

    const aquafarmRaw = sub["Nearby_Aquafarm_Activity"] || sub["Nearby_aquafarm_activity"] || "";
    const isAquafarmYes = aquafarmRaw.toLowerCase() === "yes";
    const waterFields = [
        ["Water clarity", prettify(sub["Water_Clarity"])],
        ["Water color", prettify(sub["Water_Color"])],
        ["Odor", prettify(sub["Odor"])],
        ["Foam / discharge", prettify(sub["Visible_Foam_or_Discharge"])],
        ["Aquafarm nearby", prettify(aquafarmRaw)],
        ["Observed threats", observedThreatsDisplay(sub["Observed_Threats"], sub["Observed_Threats_Other"]) || "—"],
    ];
    if (isAquafarmYes) {
        waterFields.push(
            ["Aquafarm name", sub["Aquafarm_Name"] || "—"],
            ["Distance to mangroves (m)", sub["Aquafarm_Distance_m"] || "—"],
            ["Discharge toward mangroves", prettify(sub["Discharge_Toward_Mangroves"] || sub["Discharge_toward_mangroves"])]
        );
    }

    const hasInstrumentReadings = sub["Salinity_ppt"] || sub["PH"] || sub["Water_Temperature_C"] || sub["Secchi_Depth_cm"];
    const instrumentSectionHtml = hasInstrumentReadings
        ? `<section><h2>Instrument readings</h2>${pdfFieldsHtml([
            ["Salinity (ppt)", sub["Salinity_ppt"] || "—"],
            ["pH", sub["PH"] || "—"],
            ["Water temp (°C)", sub["Water_Temperature_C"] || "—"],
            ["Secchi depth (cm)", sub["Secchi_Depth_cm"] || "—"],
        ])}</section>`
        : "";

    const notes = [sub["Water_Quality_Notes"], sub["Additional_Notes"]].filter(Boolean).join("  •  ");
    const notesHtml = notes ? `<p style="margin-top:4mm;font-size:9pt;font-style:italic;color:var(--pdf-ink)">Notes: ${pdfEscapeHtml(notes)}</p>` : "";

    return `
<div class="sheet">
  <header class="letterhead">
    ${sealDataUrl ? `<img src="${sealDataUrl}" alt="Municipality of Calatagan seal">` : "<div></div>"}
    <div class="gov">
      Republic of the Philippines<br>
      Province of Batangas
      <strong>Municipality of Calatagan</strong>
    </div>
    <div></div>
  </header>
  <div class="rule"></div>

  <div class="title">
    <h1>${pdfEscapeHtml(reportTitleInfo().title)}</h1>
    <p>${pdfEscapeHtml(reportTitleInfo().subtitle)}</p>
  </div>

  ${pdfFieldsHtml([
      ["Date", koboSubmissionDate(sub) || "—"],
      ["Ranger", sub["Ranger_Name"] || "—"],
      ["Protected area", zone ? zone.name : zoneNameForSubmission(sub)],
      ["Area", zone && zone.area ? `${zone.area} ha` : "—"],
      ["MPA manager", zone && zone.partner ? zone.partner : "—"],
      ["Canopy cover (%)", sub["Estimated_Canopy_Cover_"] || "—"],
      ["Overall health", healthAssessmentLabel(sub["Overall_Health_Assessment"])],
  ])}

  <section>
    <h2>Species found in plot</h2>
    ${speciesTableHtml}
  </section>

  <section>
    <h2>Mollusks found</h2>
    ${molluskTableHtml}
  </section>

  <section>
    <h2>Water quality and observations</h2>
    ${pdfFieldsHtml(waterFields)}
    ${notesHtml}
  </section>

  ${instrumentSectionHtml}

  <div class="spacer"></div>

  <div class="signatures">
    <div class="sig">
      <div class="line"></div>
      <div class="name"></div>
      <div class="role">Prepared by, Field Ranger</div>
      <div class="date">Date: ____________________</div>
    </div>
    <div class="sig">
      <div class="line"></div>
      <div class="name"></div>
      <div class="role">Reviewed by, MENRO</div>
      <div class="date">Date: ____________________</div>
    </div>
  </div>

  <footer>
    <span>Source: field data submitted by ranger via AquaGuard</span>
    <span>Generated ${pdfEscapeHtml(new Date().toLocaleString("en-US"))}</span>
    <span>Page ${pageNum} of ${pageCount}</span>
  </footer>
</div>`;
}

async function exportFieldSurveyPdf() {
    if (!window.jspdf || !window.jspdf.jsPDF) {
        alert("PDF export is unavailable right now — the PDF library failed to load. Check your connection and try again.");
        return;
    }
    if (typeof html2canvas !== "function") {
        alert("PDF export is unavailable right now — a required library failed to load. Check your connection and try again.");
        return;
    }

    const sealDataUrl = await sealImagePromise;
    // Without this, a capture that happens to fire before the sheet's web
    // fonts (Source Sans 3 / Source Serif 4) finish loading falls back to
    // whatever generic font the browser had on hand at that instant.
    if (document.fonts && document.fonts.ready) {
        try { await document.fonts.ready; } catch (err) { /* proceeds with whatever fonts were ready in time */ }
    }
    const { jsPDF } = window.jspdf;
    const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
    const rows = sortedSubmissions();
    const root = ensurePdfExportRoot();

    // Placed at its own true aspect ratio (width pinned to the full page
    // width, height following whatever the canvas actually came out as)
    // instead of being force-fit into a fixed 210x297 box — forcing a
    // capture that wasn't exactly that shape into that box was what made
    // every page come out visibly stretched. jsPDF already opens with one
    // blank page, so every call after the first has to add its own page.
    let firstPhysicalPage = true;
    function addCanvasAsPage(canvas, topMarginMM = 0) {
        if (!firstPhysicalPage) doc.addPage("a4", "portrait");
        firstPhysicalPage = false;
        const widthMM = 210;
        const heightMM = (canvas.height / canvas.width) * widthMM;
        doc.addImage(canvas.toDataURL("image/png"), "PNG", 0, topMarginMM, widthMM, heightMM, undefined, "FAST");
    }

    // Higher than a plain 2x — the source is vector text and thin 0.75px
    // rules, so the extra resolution actually shows once printed or zoomed
    // in, instead of just inflating file size for nothing.
    const CAPTURE_SCALE = 3;

    // The first physical page of a sheet already has its own top margin —
    // it's the sheet's own 14mm CSS padding, baked into the capture. A
    // continuation page is a raw slice starting exactly where the cut
    // landed, so without this it butts straight up against the very top
    // edge of the page — most noticeable, and least acceptable, when that
    // slice is the signature block, which needs real space around it to
    // actually be signed. Matches the sheet's own top padding so a
    // continuation page reads as a normal page, not a leftover fragment.
    const CONTINUATION_TOP_MARGIN_MM = 14;

    // A submission whose species/mollusk tables and readings add up to more
    // than one physical A4 page used to just overflow silently — the image
    // was taller than 297mm, so jsPDF clipped everything past the first
    // page and the rest was simply lost. This collects every point in the
    // sheet where a page break is "safe" (between two sections, or between
    // two table rows) — the space between direct children of the sheet, and
    // between <tr> rows inside any table — so a split, when one is needed,
    // never lands in the middle of a line of text or a table row.
    function collectSafeBreakPoints(sheetEl) {
        const top = sheetEl.getBoundingClientRect().top;
        const points = new Set([0, sheetEl.getBoundingClientRect().height]);
        Array.from(sheetEl.children).forEach(child => {
            const rect = child.getBoundingClientRect();
            points.add(rect.top - top);
            points.add(rect.bottom - top);
            child.querySelectorAll("tr").forEach(tr => {
                points.add(tr.getBoundingClientRect().bottom - top);
            });
        });
        return Array.from(points).filter(p => p >= 0).sort((a, b) => a - b);
    }

    // Rendered and captured one submission at a time (rather than one long
    // HTML page auto-paginated by jsPDF), but a submission itself can now
    // spill across more than one physical page — each slice is cut only at
    // one of the safe break points collected above, closest to (but not
    // past) a full page's worth of content.
    async function renderSheetToPage(sub, pageNum, pageCount) {
        root.innerHTML = buildSheetHtml(sub, sealDataUrl, pageNum, pageCount);
        const sheetEl = root.querySelector(".sheet");
        // The seal is already an inline data URI, so it paints essentially
        // instantly — decode() just guards against html2canvas snapshotting
        // the canvas one frame before that paint actually lands.
        const sealImg = sheetEl.querySelector("img");
        if (sealImg && sealImg.decode) {
            try { await sealImg.decode(); } catch (err) { /* falls back to whatever painted, rather than failing the whole export */ }
        }
        const breakPoints = collectSafeBreakPoints(sheetEl);
        const totalDomHeight = sheetEl.getBoundingClientRect().height;
        const canvas = await html2canvas(sheetEl, { scale: CAPTURE_SCALE, useCORS: true, backgroundColor: "#ffffff" });
        const pxPerMM = canvas.width / 210;
        const fullPageDomPx = (297 * pxPerMM) / CAPTURE_SCALE;
        const continuationPageDomPx = ((297 - CONTINUATION_TOP_MARGIN_MM) * pxPerMM) / CAPTURE_SCALE;

        if (canvas.height <= 297 * pxPerMM + 2) {
            addCanvasAsPage(canvas);
            return;
        }

        let domCursor = 0;
        let sliceIndex = 0;
        while (domCursor < totalDomHeight - 0.5) {
            const isContinuation = sliceIndex > 0;
            const pageHeightDomPx = isContinuation ? continuationPageDomPx : fullPageDomPx;
            const limit = domCursor + pageHeightDomPx;
            let cut = null;
            for (const p of breakPoints) {
                if (p > domCursor + 0.5 && p <= limit + 0.5) cut = p;
                if (p > limit + 0.5) break;
            }
            // No safe break point fits (a single row taller than a whole
            // page) — cut at the page limit anyway rather than looping
            // forever or leaving the rest of the sheet off the document.
            if (cut === null) cut = Math.min(limit, totalDomHeight);

            const startPx = Math.round(domCursor * CAPTURE_SCALE);
            const endPx = Math.round(cut * CAPTURE_SCALE);
            const sliceCanvas = document.createElement("canvas");
            sliceCanvas.width = canvas.width;
            sliceCanvas.height = endPx - startPx;
            sliceCanvas.getContext("2d").drawImage(
                canvas, 0, startPx, canvas.width, endPx - startPx, 0, 0, canvas.width, endPx - startPx
            );
            addCanvasAsPage(sliceCanvas, isContinuation ? CONTINUATION_TOP_MARGIN_MM : 0);
            domCursor = cut;
            sliceIndex++;
        }
    }

    try {
        if (rows.length === 0) {
            root.innerHTML = `<div class="sheet"><p style="margin-top:40mm;text-align:center;font-style:italic;color:var(--pdf-muted)">No field survey submissions found for this date range.</p></div>`;
            const canvas = await html2canvas(root.querySelector(".sheet"), { scale: CAPTURE_SCALE, useCORS: true, backgroundColor: "#ffffff" });
            addCanvasAsPage(canvas);
        } else {
            for (let i = 0; i < rows.length; i++) {
                await renderSheetToPage(rows[i], i + 1, rows.length);
            }
        }
        doc.setProperties({ title: `aquaguard-${reportTitleInfo().fileTag}-${todayISO()}.pdf` });
        // Navigating the current tab straight to the PDF (rather than an
        // AquaGuard-styled popup around it) hands the whole view over to the
        // browser's own plain PDF viewer, with its own native toolbar —
        // exactly like opening any other PDF link. A plain `location.href =`
        // assignment is silently blocked by Chromium as a script-initiated
        // top-level redirect to a blob: URL; a real <a> click is not, so the
        // navigation is done through a synthetic link click instead.
        const link = document.createElement("a");
        link.href = doc.output("bloburl");
        link.target = "_self";
        document.body.appendChild(link);
        link.click();
        link.remove();
    } finally {
        root.remove();
    }
}

const exportDateRangeSelect = document.getElementById("exportDateRange");
const exportDateCustom      = document.getElementById("exportDateCustom");
if (exportDateRangeSelect && exportDateCustom) {
    exportDateRangeSelect.addEventListener("change", () => {
        exportDateCustom.hidden = exportDateRangeSelect.value !== "custom";
    });
}

if (btnCloseExportReport)  btnCloseExportReport.addEventListener("click", closeExportReport);
if (btnCancelExportReport) btnCancelExportReport.addEventListener("click", closeExportReport);
if (exportReportOverlay) {
    exportReportOverlay.addEventListener("click", (e) => {
        if (e.target === exportReportOverlay) closeExportReport();
    });
}
if (btnConfirmExportReport) {
    btnConfirmExportReport.addEventListener("click", async () => {
        const originalLabel = btnConfirmExportReport.textContent;
        btnConfirmExportReport.disabled = true;
        btnConfirmExportReport.textContent = "Generating…";
        try {
            await exportFieldSurveyPdf();
            closeExportReport();
        } finally {
            btnConfirmExportReport.disabled = false;
            btnConfirmExportReport.textContent = originalLabel;
        }
    });
}
