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
        doc.setDrawColor(180);
        doc.setLineWidth(0.2);
        doc.line(ML, PAGE_H - 14, PAGE_W - MR, PAGE_H - 14);
        doc.setFontSize(8);
        doc.setTextColor(120);
        doc.setFont("helvetica", "normal");
        doc.text("MENRO Calatagan - AquaGuard Mangrove Monitoring System", ML, PAGE_H - 8);
        doc.text(`Page ${pg}`, PAGE_W - MR, PAGE_H - 8, { align: "right" });
        doc.setTextColor(0);
    }

    function sectionLabel(text, y) {
        doc.setFont("helvetica", "bold");
        doc.setFontSize(8);
        doc.setTextColor(90);
        doc.text(text, ML, y);
        doc.setDrawColor(90);
        doc.setLineWidth(0.3);
        doc.line(ML, y + 1.5, ML + CW, y + 1.5);
        doc.setTextColor(0);
        return y + 6;
    }

    // ── Cover Header ─────────────────────────────────────────
    // Plain white header — no fills. Hierarchy comes from weight/size and
    // a single ruled line, keeping ink use to text + one thin rule.
    doc.setFont("helvetica", "bold");
    doc.setFontSize(17);
    doc.setTextColor(0);
    doc.text("AquaGuard Mangrove Monitoring System", ML, 18);

    doc.setFont("helvetica", "normal");
    doc.setFontSize(10);
    doc.setTextColor(80);
    doc.text("Municipal Environment and Natural Resources Office - Calatagan, Batangas", ML, 25);

    doc.setFontSize(9);
    doc.setTextColor(120);
    doc.text(`Field Survey Report  |  Scene Date: ${reportDate}  |  Generated: ${today}`, ML, 31);
    doc.setTextColor(0);

    doc.setDrawColor(0);
    doc.setLineWidth(0.6);
    doc.line(ML, 36, PAGE_W - MR, 36);

    let y = 48;

    // ── Scene Summary Cards ───────────────────────────────────
    y = sectionLabel("SCENE SUMMARY", y);

    const cards = [
        { label: "Mean NDVI",     value: String(sceneSummary.meanNDVI) },
        { label: "Cloud Cover",   value: String(sceneSummary.cloudCover) },
        { label: "Healthy Zones", value: String(sceneSummary.healthyCount) },
        { label: "At-Risk Zones", value: String(sceneSummary.atRiskCount) },
    ];

    const cardW = (CW - 9) / 4;
    doc.setDrawColor(180);
    doc.setLineWidth(0.25);
    cards.forEach((card, i) => {
        const cx = ML + i * (cardW + 3);
        doc.roundedRect(cx, y, cardW, 18, 1, 1, "S");
        doc.setFont("helvetica", "normal");
        doc.setFontSize(7);
        doc.setTextColor(110);
        doc.text(card.label, cx + cardW / 2, y + 6, { align: "center" });
        doc.setFont("helvetica", "bold");
        doc.setFontSize(14);
        doc.setTextColor(0);
        doc.text(card.value, cx + cardW / 2, y + 14, { align: "center" });
    });
    doc.setTextColor(0);

    y += 26;

    // ── Zone Summary Table ────────────────────────────────────
    y = sectionLabel("MANGROVE ZONES OVERVIEW", y);

    // Table header — ruled, not filled
    doc.setFont("helvetica", "bold");
    doc.setFontSize(7.5);
    doc.setTextColor(0);

    const cols = { name: ML+2, area: ML+52, ndvi: ML+72, status: ML+96, partner: ML+124 };
    doc.text("Barangay / Zone",    cols.name,    y + 4.8);
    doc.text("Area (ha)",          cols.area,    y + 4.8);
    doc.text("NDVI",               cols.ndvi,    y + 4.8);
    doc.text("Status",             cols.status,  y + 4.8);
    doc.text("Partner Org",        cols.partner, y + 4.8);
    y += 7;
    doc.setDrawColor(0);
    doc.setLineWidth(0.4);
    doc.line(ML, y, ML + CW, y);

    ZONES.forEach((zone) => {
        y = checkPage(y, 9);

        doc.setFont("helvetica", "bold");
        doc.setFontSize(7.5);
        doc.setTextColor(0);
        doc.text(zone.name, cols.name, y + 5.5);

        doc.setFont("helvetica", "normal");
        doc.setTextColor(60);
        doc.text(zone.area.toString(), cols.area, y + 5.5);
        doc.text(zone.ndvi.toFixed(2),  cols.ndvi, y + 5.5);

        doc.setFont("helvetica", "bold");
        doc.setTextColor(0);
        doc.text(capitalise(zone.status), cols.status, y + 5.5);

        doc.setFont("helvetica", "normal");
        doc.setTextColor(60);
        doc.text(zone.partner !== "—" ? zone.partner : "—", cols.partner, y + 5.5);

        doc.setTextColor(0);
        y += 8;
        doc.setDrawColor(210);
        doc.setLineWidth(0.15);
        doc.line(ML, y, ML + CW, y);
    });

    y += 6;

    // ── Field Survey Details (KoboToolbox zones only) ─────────
    const surveyedZones = ZONES.filter(z => z.lastRanger && z.lastRanger !== "—");

    if (surveyedZones.length > 0) {
        y = checkPage(y, 20);
        y = sectionLabel("FIELD SURVEY DETAILS  -  KoboToolbox Submissions", y);
        y += 2;

        surveyedZones.forEach((zone) => {
            y = checkPage(y, 60);

            // Zone card header — ruled box, no fill
            doc.setDrawColor(0);
            doc.setLineWidth(0.3);
            doc.line(ML, y, ML + CW, y);
            y += 6;

            doc.setFont("helvetica", "bold");
            doc.setFontSize(9.5);
            doc.setTextColor(0);
            doc.text(`${zone.name}  -  ${zone.protected_area || zone.partner}`, ML, y);
            doc.setFont("helvetica", "normal");
            doc.setFontSize(7.5);
            doc.setTextColor(90);
            doc.text(`NDVI: ${zone.ndvi.toFixed(2)}  |  ${capitalise(zone.status)}  |  ${zone.area} ha`, PAGE_W - MR, y, { align: "right" });
            doc.setTextColor(0);
            y += 6;

            // Two-column detail layout
            const col1x = ML + 2;
            const col2x = ML + CW / 2 + 4;
            const colW  = CW / 2 - 6;

            function detailRow(label, value, x, cy) {
                doc.setFont("helvetica", "bold");
                doc.setFontSize(7);
                doc.setTextColor(110);
                doc.text(label.toUpperCase(), x, cy);
                doc.setFont("helvetica", "normal");
                doc.setFontSize(8);
                doc.setTextColor(20);
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
        });

        // Closing rule for the survey section
        doc.setDrawColor(0);
        doc.setLineWidth(0.3);
        doc.line(ML, y, ML + CW, y);
        y += 8;
    }

    // ── Footer on all pages ───────────────────────────────────
    const totalPages = doc.internal.getNumberOfPages();
    for (let p = 1; p <= totalPages; p++) {
        doc.setPage(p);
        drawPageFooter();
    }

    doc.save(`Field_Survey_Report_${reportDate}.pdf`);

}