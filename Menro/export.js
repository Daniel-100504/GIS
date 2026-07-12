/**
 * export.js
 * Field Survey Report (PDF) export for AquaGuard.
 * Split out from satellite.js — depends on globals defined there:
 *   ZONES, capitalise(), sceneSummary, and the #sceneDate input.
 * Load AFTER satellite.js and jsPDF, e.g.:
 *   <script src="satellite.js"></script>
 *   <script src="export.js"></script>
 */

/* ---------- Export PDF ---------- */

// btnExport no longer exists in the left panel — export now lives in the
// hamburger drawer (menuExport, wired in satellite.js) — but keep this
// guarded in case a page still ships the old button.
const btnExportEl = document.getElementById("btnExport");
if (btnExportEl) btnExportEl.addEventListener("click", exportPDF);

function exportPDF() {
    const { jsPDF } = window.jspdf;
    const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });

    const PAGE_W = 210;
    const PAGE_H = 297;
    const ML = 15; // margin left
    const MR = 15; // margin right
    const CW = PAGE_W - ML - MR; // content width
    const today = new Date().toLocaleDateString("en-PH", { year:"numeric", month:"long", day:"numeric" });
    const reportDate = sceneDate.value;

    // ── Helpers ──────────────────────────────────────────────
    function checkPage(y, needed = 20) {
        if (y + needed > PAGE_H - 15) {
            doc.addPage();
            drawPageFooter();
            return 20;
        }
        return y;
    }

    function drawPageFooter() {
        const pg = doc.internal.getCurrentPageInfo().pageNumber;
        doc.setFontSize(8);
        doc.setTextColor(150);
        doc.setFont("helvetica", "normal");
        doc.text("MENRO Calatagan – AquaGuard Mangrove Monitoring System", ML, PAGE_H - 8);
        doc.text(`Page ${pg}`, PAGE_W - MR, PAGE_H - 8, { align: "right" });
        doc.setTextColor(0);
    }

    function statusColor(status) {
        if (status === "healthy")  return [46, 125, 50];
        if (status === "moderate") return [245, 127, 23];
        return [183, 28, 28];
    }

    function pill(doc, x, y, label, status) {
        const [r, g, b] = statusColor(status);
        doc.setFillColor(r, g, b);
        doc.roundedRect(x, y - 4, 24, 6, 2, 2, "F");
        doc.setFontSize(7);
        doc.setTextColor(255, 255, 255);
        doc.setFont("helvetica", "bold");
        doc.text(label, x + 12, y, { align: "center" });
        doc.setTextColor(0);
    }

    // ── Cover Header ─────────────────────────────────────────
    // Dark green header bar
    doc.setFillColor(27, 94, 32);
    doc.rect(0, 0, PAGE_W, 38, "F");

    // Accent stripe
    doc.setFillColor(76, 175, 80);
    doc.rect(0, 38, PAGE_W, 2, "F");

    doc.setTextColor(255, 255, 255);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(18);
    doc.text("AquaGuard Mangrove Monitoring System", ML, 16);

    doc.setFont("helvetica", "normal");
    doc.setFontSize(10);
    doc.text("Municipal Environment and Natural Resources Office  •  Calatagan, Batangas", ML, 24);

    doc.setFontSize(9);
    doc.text(`Field Survey Report  •  Scene Date: ${reportDate}  •  Generated: ${today}`, ML, 32);
    doc.setTextColor(0);

    let y = 52;

    // ── Scene Summary Cards ───────────────────────────────────
    doc.setFont("helvetica", "bold");
    doc.setFontSize(8);
    doc.setTextColor(100);
    doc.text("SCENE SUMMARY", ML, y);
    doc.setTextColor(0);
    y += 4;

    const cards = [
        { label: "Mean NDVI",     value: String(sceneSummary.meanNDVI),     color: [46,125,50]  },
        { label: "Cloud Cover",   value: String(sceneSummary.cloudCover),   color: [30,80,160]  },
        { label: "Healthy Zones", value: String(sceneSummary.healthyCount), color: [46,125,50]  },
        { label: "At-Risk Zones", value: String(sceneSummary.atRiskCount),  color: [183,28,28]  },
    ];

    const cardW = (CW - 9) / 4;
    cards.forEach((card, i) => {
        const cx = ML + i * (cardW + 3);
        doc.setFillColor(248, 250, 248);
        doc.setDrawColor(200, 220, 200);
        doc.roundedRect(cx, y, cardW, 18, 2, 2, "FD");
        doc.setFont("helvetica", "normal");
        doc.setFontSize(7);
        doc.setTextColor(100);
        doc.text(card.label, cx + cardW / 2, y + 6, { align: "center" });
        doc.setFont("helvetica", "bold");
        doc.setFontSize(14);
        doc.setTextColor(...card.color);
        doc.text(card.value, cx + cardW / 2, y + 14, { align: "center" });
        doc.setTextColor(0);
    });

    y += 26;

    // ── Zone Summary Table ────────────────────────────────────
    doc.setFont("helvetica", "bold");
    doc.setFontSize(8);
    doc.setTextColor(100);
    doc.text("MANGROVE ZONES OVERVIEW", ML, y);
    doc.setTextColor(0);
    y += 4;

    // Table header
    doc.setFillColor(27, 94, 32);
    doc.rect(ML, y, CW, 7, "F");
    doc.setTextColor(255);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(7.5);

    const cols = { name: ML+2, area: ML+52, ndvi: ML+72, status: ML+96, partner: ML+124 };
    doc.text("Barangay / Zone",    cols.name,    y + 4.8);
    doc.text("Area (ha)",          cols.area,    y + 4.8);
    doc.text("NDVI",               cols.ndvi,    y + 4.8);
    doc.text("Status",             cols.status,  y + 4.8);
    doc.text("Partner Org",        cols.partner, y + 4.8);
    doc.setTextColor(0);
    y += 7;

    ZONES.forEach((zone, idx) => {
        y = checkPage(y, 9);
        // Alternating row bg
        if (idx % 2 === 0) {
            doc.setFillColor(245, 250, 245);
            doc.rect(ML, y, CW, 8, "F");
        }
        doc.setDrawColor(220, 235, 220);
        doc.line(ML, y + 8, ML + CW, y + 8);

        doc.setFont("helvetica", "bold");
        doc.setFontSize(7.5);
        doc.setTextColor(27, 94, 32);
        doc.text(zone.name, cols.name, y + 5.5);

        doc.setFont("helvetica", "normal");
        doc.setTextColor(50);
        doc.text(zone.area.toString(), cols.area, y + 5.5);
        doc.text(zone.ndvi.toFixed(2),  cols.ndvi, y + 5.5);

        // Status pill
        pill(doc, cols.status, y + 5.5, capitalise(zone.status), zone.status);

        doc.setFont("helvetica", "normal");
        doc.setTextColor(50);
        doc.text(zone.partner !== "—" ? zone.partner : "—", cols.partner, y + 5.5);

        doc.setTextColor(0);
        y += 8;
    });

    y += 6;

    // ── Field Survey Details (KoboToolbox zones only) ─────────
    const surveyedZones = ZONES.filter(z => z.lastRanger && z.lastRanger !== "—");

    if (surveyedZones.length > 0) {
        y = checkPage(y, 20);

        // Section header
        doc.setFillColor(232, 245, 233);
        doc.setDrawColor(165, 214, 167);
        doc.roundedRect(ML, y, CW, 8, 2, 2, "FD");
        doc.setFont("helvetica", "bold");
        doc.setFontSize(9);
        doc.setTextColor(27, 94, 32);
        doc.text("FIELD SURVEY DETAILS  —  KoboToolbox Submissions", ML + 4, y + 5.5);
        doc.setTextColor(0);
        y += 14;

        surveyedZones.forEach((zone, idx) => {
            y = checkPage(y, 60);

            // Zone card header
            const [r,g,b] = statusColor(zone.status);
            doc.setFillColor(r, g, b);
            doc.roundedRect(ML, y, CW, 9, 2, 2, "F");
            doc.setTextColor(255);
            doc.setFont("helvetica", "bold");
            doc.setFontSize(9);
            doc.text(`${zone.name}  —  ${zone.protected_area || zone.partner}`, ML + 4, y + 6);
            doc.setFont("helvetica", "normal");
            doc.setFontSize(7.5);
            doc.text(`NDVI: ${zone.ndvi.toFixed(2)}  •  ${capitalise(zone.status)}  •  ${zone.area} ha`, PAGE_W - MR - 2, y + 6, { align: "right" });
            doc.setTextColor(0);
            y += 11;

            // Two-column detail layout
            const col1x = ML + 2;
            const col2x = ML + CW / 2 + 4;
            const colW  = CW / 2 - 6;

            function detailRow(label, value, x, cy) {
                doc.setFont("helvetica", "bold");
                doc.setFontSize(7);
                doc.setTextColor(100);
                doc.text(label.toUpperCase(), x, cy);
                doc.setFont("helvetica", "normal");
                doc.setFontSize(8);
                doc.setTextColor(30);
                const lines = doc.splitTextToSize(value || "—", colW);
                doc.text(lines, x, cy + 4);
                doc.setTextColor(0);
                return cy + 4 + (lines.length * 4);
            }

            // Left column
            let ly = y;
            ly = detailRow("Ranger Name",    zone.lastRanger  || "—", col1x, ly) + 3;
            ly = detailRow("Inspection Date", zone.lastDate   || "—", col1x, ly) + 3;
            ly = detailRow("Transect / Quadrat", `${zone.transect || "—"}`, col1x, ly) + 3;
            ly = detailRow("Canopy Cover",   zone.canopyCover || "—", col1x, ly) + 3;
            ly = detailRow("Species",        zone.speciesName || "—", col1x, ly) + 3;
            ly = detailRow("Tree Count",     zone.treeCount ? zone.treeCount.toString() : "—", col1x, ly) + 3;

            // Right column
            let ry = y;
            ry = detailRow("Observed Threats",       zone.threats      || "—", col2x, ry) + 3;
            ry = detailRow("Water Color",             zone.waterColor   || "—", col2x, ry) + 3;
            ry = detailRow("Nearby Aquafarm Activity",zone.aquafarmNear || "—", col2x, ry) + 3;
            ry = detailRow("Additional Notes",        zone.notes        || "—", col2x, ry) + 3;

            y = Math.max(ly, ry) + 4;

            // Divider
            doc.setDrawColor(200, 230, 200);
            doc.line(ML, y, ML + CW, y);
            y += 8;
        });
    }

    // ── Footer on all pages ───────────────────────────────────
    const totalPages = doc.internal.getNumberOfPages();
    for (let p = 1; p <= totalPages; p++) {
        doc.setPage(p);
        drawPageFooter();
    }

    doc.save(`Field_Survey_Report_${reportDate}.pdf`);

}