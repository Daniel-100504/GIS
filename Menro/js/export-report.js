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

const SHEET_HEADER = [
    "No.", "Species", "Tree\nCount", "Height\n(m)", "GBH\n(cm)", "Canopy\nLength (m)", "Canopy\nWidth (m)", "Canopy\nCover (%)",
    "Mollusk\nSpecies", "Mollusk\nCount", "Seedling\nSpecies", "Seedling\nCount", "Sapling\nSpecies", "Sapling\nCount",
];

async function exportFieldSurveyPdf() {
    if (!window.jspdf || !window.jspdf.jsPDF) {
        alert("PDF export is unavailable right now — the PDF library failed to load. Check your connection and try again.");
        return;
    }

    const sealDataUrl = await sealImagePromise;

    const { jsPDF } = window.jspdf;
    // Landscape gives the 14-column measurement table enough width that
    // every value gets its own readable cell instead of two numbers being
    // squeezed into one ("Name & No." columns used to jam a count and a
    // species name together, e.g. "27 1" — easy to misread as one number).
    const doc = new jsPDF({ orientation: "landscape", unit: "pt", format: "a4" });
    const pageWidth  = doc.internal.pageSize.getWidth();
    const pageHeight = doc.internal.pageSize.getHeight();
    const marginX = 36;
    const rows = sortedSubmissions();

    const BRAND = [13, 67, 53];
    const GRAY  = [120, 130, 125];
    const LINE  = [210, 219, 214];
    const ZEBRA = [242, 247, 244];
    const INK   = [30, 40, 36];
    const LABEL_BG = [234, 241, 237];

    // Matches the official MENRO letterhead: seal, Republic/Province/
    // Municipality lines, then the form title and subtitle.
    function drawLetterhead() {
        let y = 30;
        if (sealDataUrl) {
            doc.addImage(sealDataUrl, "PNG", pageWidth / 2 - 18, y, 36, 36);
        }
        y += 44;

        doc.setTextColor(60, 60, 60);
        doc.setFont("helvetica", "normal");
        doc.setFontSize(9);
        doc.text("REPUBLIC OF THE PHILIPPINES", pageWidth / 2, y, { align: "center" }); y += 12;
        doc.text("PROVINCE OF BATANGAS", pageWidth / 2, y, { align: "center" }); y += 12;
        doc.setFont("helvetica", "bold");
        doc.text("MUNICIPALITY OF CALATAGAN", pageWidth / 2, y, { align: "center" }); y += 20;

        doc.setTextColor(...BRAND);
        doc.setFontSize(13);
        doc.text("ANNUAL MONITORING DATA SHEET", pageWidth / 2, y, { align: "center" }); y += 14;

        doc.setTextColor(...GRAY);
        doc.setFont("helvetica", "italic");
        doc.setFontSize(8.5);
        doc.text(
            "(Assessing the Climate Change Vulnerability and Recruitment Capacity of Mangrove Ecosystem)",
            pageWidth / 2, y, { align: "center" }
        );
        y += 12;
        doc.setDrawColor(...BRAND);
        doc.setLineWidth(1.2);
        doc.line(marginX, y, pageWidth - marginX, y);
        return y + 20;
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

    // A clean bordered "field: value" grid (2 label/value pairs per row)
    // instead of plain floating text, so the header info reads like part of
    // an official form rather than a loose list of lines.
    function drawInfoGrid(pairs, startY) {
        const body = [];
        for (let i = 0; i < pairs.length; i += 2) {
            body.push([
                pairs[i][0], pairs[i][1],
                pairs[i + 1] ? pairs[i + 1][0] : "", pairs[i + 1] ? pairs[i + 1][1] : "",
            ]);
        }
        doc.autoTable({
            startY,
            margin: { left: marginX, right: marginX },
            theme: "grid",
            styles: {
                font: "helvetica",
                fontSize: 9,
                cellPadding: { top: 6, bottom: 6, left: 8, right: 8 },
                textColor: INK,
                lineColor: LINE,
                lineWidth: 0.75,
                valign: "middle",
            },
            columnStyles: {
                0: { fontStyle: "bold", fillColor: LABEL_BG, cellWidth: 100 },
                1: { cellWidth: 265 },
                2: { fontStyle: "bold", fillColor: LABEL_BG, cellWidth: 100 },
                3: { cellWidth: 265 },
            },
            body,
        });
        return doc.lastAutoTable.finalY;
    }

    function drawSectionLabel(text, y) {
        doc.setFont("helvetica", "bold");
        doc.setFontSize(10);
        doc.setTextColor(...BRAND);
        doc.text(text, marginX, y);
        return y + 12;
    }

    function drawTreesTable(sub, startY) {
        const trees = koboExtractTrees(sub);
        const body = trees.length > 0
            ? trees.map((t, i) => [
                i + 1,
                koboTreeField(t, "Species_Name") || koboTreeField(t, "Species") || "—",
                koboTreeField(t, "Tree_Count") || "—",
                koboTreeField(t, "Average_Tree_Height_m") ?? koboTreeField(t, "Height_m") ?? "—",
                koboTreeField(t, "GBH_Girth_at_Breast_Height_cm") ?? koboTreeField(t, "GBH_cm") ?? "—",
                koboTreeField(t, "Canopy_Length_m") ?? koboTreeField(t, "Canopy_length_m") ?? "—",
                koboTreeField(t, "Canopy_Width_m") ?? koboTreeField(t, "Canopy_width_m") ?? "—",
                koboTreeField(t, "Estimated_Canopy_Cover_") || "—",
                koboTreeField(t, "Mollusk_Species_Name") || koboTreeField(t, "Mollusk_species_name") || "—",
                koboTreeField(t, "Mollusk_Count") ?? koboTreeField(t, "Mollusk_count") ?? "—",
                koboTreeField(t, "Seedling_Species") || koboTreeField(t, "Seedling_species_name") || "—",
                koboTreeField(t, "Seedling_Count") ?? koboTreeField(t, "Seedling_count") ?? "—",
                koboTreeField(t, "Sapling_Species") || koboTreeField(t, "Sapling_species_name") || "—",
                koboTreeField(t, "Sapling_Count") ?? koboTreeField(t, "Sapling_count") ?? "—",
            ])
            : [[{ content: "No trees recorded for this visit.", colSpan: SHEET_HEADER.length, styles: { halign: "center", fontStyle: "italic" } }]];

        doc.autoTable({
            startY,
            margin: { left: marginX, right: marginX, bottom: 40 },
            theme: "grid",
            styles: {
                font: "helvetica",
                fontSize: 8,
                cellPadding: 6,
                textColor: INK,
                fillColor: [255, 255, 255],
                lineColor: LINE,
                lineWidth: 0.5,
                halign: "center",
                valign: "middle",
            },
            headStyles: {
                fillColor: BRAND,
                textColor: [255, 255, 255],
                fontStyle: "bold",
                fontSize: 8,
                lineColor: BRAND,
                lineWidth: 0.75,
                halign: "center",
                valign: "middle",
            },
            alternateRowStyles: { fillColor: ZEBRA },
            columnStyles: {
                0: { cellWidth: 24 },
                1: { halign: "left", cellWidth: 78 },
                8: { halign: "left", cellWidth: 62 },
                10: { halign: "left", cellWidth: 62 },
                12: { halign: "left", cellWidth: 62 },
            },
            head: [SHEET_HEADER],
            body,
        });
        return doc.lastAutoTable.finalY;
    }

    // Signature lines give the report the sign-off weight of an actual
    // government field form, and fill what would otherwise be a large,
    // unfinished-looking blank area at the bottom of the page.
    function drawSignatureFooter(y) {
        const lineY = Math.max(y, pageHeight - 90);
        const colWidth = (pageWidth - marginX * 2 - 40) / 2;

        [
            { x: marginX, label: "Prepared by (Field Ranger)" },
            { x: marginX + colWidth + 40, label: "Reviewed by (MENRO)" },
        ].forEach(({ x, label }) => {
            doc.setDrawColor(...INK);
            doc.setLineWidth(0.75);
            doc.line(x, lineY, x + colWidth, lineY);
            doc.setFont("helvetica", "normal");
            doc.setFontSize(8.5);
            doc.setTextColor(...GRAY);
            doc.text(label, x, lineY + 12);
        });

        doc.setFontSize(7.5);
        doc.setTextColor(...GRAY);
        doc.text(`Generated ${new Date().toLocaleString("en-US")}`, marginX, pageHeight - 18);
        doc.text(`Page ${doc.internal.getCurrentPageInfo().pageNumber}`, pageWidth - marginX, pageHeight - 18, { align: "right" });
    }

    function drawSubmission(sub) {
        const zone = zoneForSubmission(sub);
        let y = drawLetterhead();

        y = drawInfoGrid([
            ["Date", koboSubmissionDate(sub) || "—"],
            ["Ranger", sub["Ranger_Name"] || "—"],
            ["Protected Area", zone ? zone.name : zoneNameForSubmission(sub)],
            ["Area", zone && zone.area ? `${zone.area} ha` : "—"],
            ["MPA Manager", zone && zone.partner ? zone.partner : "—"],
            ["Overall Health", healthAssessmentLabel(sub["Overall_Health_Assessment"])],
        ], y);
        y += 16;

        y = drawSectionLabel("Vegetation & Fauna Measurements", y);
        y = drawTreesTable(sub, y + 6);
        y += 16;

        y = drawSectionLabel("Water Quality & Observations", y);
        y = drawInfoGrid([
            ["Water Color", prettify(sub["Water_Color"])],
            ["Odor", prettify(sub["Odor"])],
            ["Foam / Discharge", prettify(sub["Visible_Foam_or_Discharge"])],
            ["Aquafarm Activity", prettify(sub["Nearby_Aquafarm_Activity"])],
            ["Aquafarm Name", sub["Aquafarm_Name_if_Discharge_Observed"] || "—"],
            ["Observed Threats", prettify(sub["Observed_Threats"])],
        ], y + 6);

        const notes = [sub["Water_Quality_Notes"], sub["Additional_Notes"]].filter(Boolean).join("  •  ");
        if (notes) {
            y += 16;
            doc.setFont("helvetica", "italic");
            doc.setFontSize(8.5);
            doc.setTextColor(...INK);
            const wrapped = doc.splitTextToSize(`Notes: ${notes}`, pageWidth - marginX * 2);
            doc.text(wrapped, marginX, y);
            y += 12 * wrapped.length;
        }

        drawSignatureFooter(y + 24);
    }

    if (rows.length === 0) {
        drawLetterhead();
        doc.setFont("helvetica", "italic");
        doc.setFontSize(10);
        doc.setTextColor(...GRAY);
        doc.text("No field survey submissions found for this date range.", pageWidth / 2, 220, { align: "center" });
    } else {
        rows.forEach((sub, i) => {
            if (i > 0) doc.addPage();
            drawSubmission(sub);
        });
    }

    doc.save(`aquaguard-annual-monitoring-data-sheet-${todayISO()}.pdf`);
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
    btnConfirmExportReport.addEventListener("click", () => {
        exportFieldSurveyPdf();
        closeExportReport();
    });
}
