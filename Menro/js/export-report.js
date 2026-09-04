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

function zoneNameForBarangay(barangay) {
    const zoneId = BARANGAY_TO_ZONE[barangay || ""];
    const zone = zoneId ? ZONES.find(z => z.id === zoneId) : null;
    return zone ? zone.name : (barangay || "Unknown").replace(/_/g, " ");
}

function getExportDateRange() {
    const rangeSelect = document.getElementById("exportDateRange");
    const mode = rangeSelect ? rangeSelect.value : "all";
    const toISO = (d) => d.toISOString().slice(0, 10);
    const today = new Date();

    if (mode === "month") {
        return { from: toISO(new Date(today.getFullYear(), today.getMonth(), 1)), to: toISO(today) };
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
    return [...ALL_SUBMISSIONS]
        .filter(sub => {
            const date = sub["Inspection_Date"] || "";
            if (from && date < from) return false;
            if (to && date > to) return false;
            return true;
        })
        .sort((a, b) => (a["Inspection_Date"] || "").localeCompare(b["Inspection_Date"] || ""));
}

function exportFieldSurveyExcel() {
    if (!window.XLSX) {
        alert("Excel export is unavailable right now — the Excel library failed to load. Check your connection and try again.");
        return;
    }

    const rows = sortedSubmissions();

    const header = [
        "Zone", "Ranger", "Inspection Date", "Transect / Quadrat", "Canopy Cover (%)",
        "Species Observed", "Tree Count", "Observed Threats", "Water Color",
        "Nearby Aquafarm Activity", "Additional Notes", "GPS Latitude", "GPS Longitude",
    ];

    const body = rows.map(sub => {
        const gpsParts = (sub["GPS"] || "").split(" ").map(Number);
        const hasGps = gpsParts.length >= 2 && !isNaN(gpsParts[0]) && !isNaN(gpsParts[1]);
        return [
            zoneNameForBarangay(sub["Barangay"]),
            sub["Ranger_Name"] || "",
            sub["Inspection_Date"] || "",
            sub["Transect_Number"] || "",
            sub["Estimated_Canopy_Cover_"] ? Number(sub["Estimated_Canopy_Cover_"]) : "",
            sub["Species_Name"] || "",
            sub["Tree_Count"] ? Number(sub["Tree_Count"]) : "",
            sub["Observed_Threats"] ? capitalise(sub["Observed_Threats"].replace(/_/g, " ")) : "None observed",
            sub["Water_Color"] ? capitalise(sub["Water_Color"].replace(/_/g, " ")) : "",
            sub["Nearby_Aquafarm_Activity"] ? capitalise(sub["Nearby_Aquafarm_Activity"].replace(/_/g, " ")) : "",
            sub["Additional_Notes"] || "",
            hasGps ? gpsParts[0] : "",
            hasGps ? gpsParts[1] : "",
        ];
    });

    const sheetData = [
        ["AquaGuard — Field Survey Report"],
        ["DENR-MENRO Batangas · Calatagan Mangrove Reserve"],
        [`${exportRangeLabel()}  ·  ${rows.length} survey${rows.length !== 1 ? "s" : ""} recorded`],
        [],
        header,
        ...body,
    ];

    const ws = XLSX.utils.aoa_to_sheet(sheetData);
    ws["!cols"] = [
        { wch: 16 }, { wch: 16 }, { wch: 14 }, { wch: 16 }, { wch: 15 },
        { wch: 18 }, { wch: 10 }, { wch: 18 }, { wch: 14 },
        { wch: 22 }, { wch: 32 }, { wch: 13 }, { wch: 13 },
    ];
    ws["!merges"] = [
        { s: { r: 0, c: 0 }, e: { r: 0, c: header.length - 1 } },
        { s: { r: 1, c: 0 }, e: { r: 1, c: header.length - 1 } },
        { s: { r: 2, c: 0 }, e: { r: 2, c: header.length - 1 } },
    ];

    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Field Surveys");
    XLSX.writeFile(wb, `aquaguard-field-survey-report-${todayISO()}.xlsx`);
}

function exportFieldSurveyPdf() {
    if (!window.jspdf || !window.jspdf.jsPDF) {
        alert("PDF export is unavailable right now — the PDF library failed to load. Check your connection and try again.");
        return;
    }

    const { jsPDF } = window.jspdf;
    const doc = new jsPDF({ orientation: "landscape", unit: "pt", format: "a4" });
    const pageWidth  = doc.internal.pageSize.getWidth();
    const pageHeight = doc.internal.pageSize.getHeight();
    const marginX = 32;
    const rows = sortedSubmissions();

    const BRAND = [13, 67, 53];
    const GRAY  = [120, 130, 125];
    const LINE  = [210, 219, 214];

    function drawHeader() {
        doc.setTextColor(...BRAND);
        doc.setFont("helvetica", "bold");
        doc.setFontSize(15);
        doc.text("AquaGuard — Field Survey Report", marginX, 32);

        doc.setTextColor(...GRAY);
        doc.setFont("helvetica", "normal");
        doc.setFontSize(9);
        doc.text("DENR-MENRO Batangas · Calatagan Mangrove Reserve", marginX, 46);
        doc.text(
            `${exportRangeLabel()}  ·  ${rows.length} survey${rows.length !== 1 ? "s" : ""} recorded`,
            pageWidth - marginX, 46, { align: "right" }
        );

        doc.setDrawColor(...BRAND);
        doc.setLineWidth(1);
        doc.line(marginX, 56, pageWidth - marginX, 56);
    }

    function drawFooter(pageNumber) {
        const footerY = pageHeight - 20;
        doc.setDrawColor(...LINE);
        doc.setLineWidth(0.5);
        doc.line(marginX, footerY - 10, pageWidth - marginX, footerY - 10);
        doc.setTextColor(...GRAY);
        doc.setFont("helvetica", "normal");
        doc.setFontSize(8);
        doc.text("DENR-MENRO Batangas · Calatagan Mangrove Reserve", marginX, footerY);
        doc.text(`Page ${pageNumber}`, pageWidth - marginX, footerY, { align: "right" });
    }

    doc.autoTable({
        startY: 72,
        margin: { top: 72, left: marginX, right: marginX, bottom: 40 },
        theme: "grid",
        styles: {
            font: "helvetica",
            fontSize: 8.5,
            cellPadding: 6,
            textColor: [30, 40, 36],
            fillColor: [255, 255, 255],
            lineColor: LINE,
            lineWidth: 0.5,
        },
        headStyles: {
            fillColor: [255, 255, 255],
            textColor: BRAND,
            fontStyle: "bold",
            lineColor: BRAND,
            lineWidth: 0.75,
        },
        alternateRowStyles: { fillColor: [255, 255, 255] },
        head: [["Zone", "Ranger", "Date", "Canopy Cover", "Threats", "Water Color", "Aquafarm Activity"]],
        body: rows.map(sub => [
            zoneNameForBarangay(sub["Barangay"]),
            sub["Ranger_Name"] || "—",
            sub["Inspection_Date"] || "—",
            sub["Estimated_Canopy_Cover_"] ? sub["Estimated_Canopy_Cover_"] + "%" : "—",
            sub["Observed_Threats"] ? capitalise(sub["Observed_Threats"].replace(/_/g, " ")) : "None observed",
            sub["Water_Color"] ? capitalise(sub["Water_Color"].replace(/_/g, " ")) : "—",
            sub["Nearby_Aquafarm_Activity"] ? capitalise(sub["Nearby_Aquafarm_Activity"].replace(/_/g, " ")) : "—",
        ]),
        didDrawPage: (data) => {
            drawHeader();
            drawFooter(data.pageNumber);
        },
    });

    doc.save(`aquaguard-field-survey-report-${todayISO()}.pdf`);
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
        const selected = document.querySelector('input[name="exportFormat"]:checked');
        const format = selected ? selected.value : "pdf";
        if (format === "excel") {
            exportFieldSurveyExcel();
        } else {
            exportFieldSurveyPdf();
        }
        closeExportReport();
    });
}
