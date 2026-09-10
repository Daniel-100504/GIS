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

const EXCEL_BRAND      = "FF0D4335";
const EXCEL_BRAND_SOFT = "FF5A8274";
const EXCEL_GRAY       = "FF78827D";
const EXCEL_LINE       = "FFE0E8E3";
const EXCEL_ZEBRA      = "FFF2F7F4";

function styleExcelTitleCell(cell, size, color, bold = true) {
    cell.font = { name: "Calibri", size, bold, color: { argb: color } };
}

function styleExcelHeaderRow(row) {
    row.eachCell(cell => {
        cell.font = { bold: true, color: { argb: "FFFFFFFF" } };
        cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: EXCEL_BRAND } };
        cell.alignment = { vertical: "middle" };
        cell.border = {
            top:    { style: "thin", color: { argb: EXCEL_BRAND } },
            bottom: { style: "thin", color: { argb: EXCEL_BRAND } },
        };
    });
}

function buildSummarySheet(wb, rows) {
    const zoneSet = new Set(rows.map(sub => zoneNameForBarangay(sub["Barangay"])));

    const threatCounts = {};
    rows.forEach(sub => {
        const t = sub["Observed_Threats"];
        if (t && t !== "none") {
            const label = capitalise(t.replace(/_/g, " "));
            threatCounts[label] = (threatCounts[label] || 0) + 1;
        }
    });
    const threatRows = Object.entries(threatCounts).sort((a, b) => b[1] - a[1]);

    const ws = wb.addWorksheet("Summary");
    ws.columns = [{ width: 32 }, { width: 16 }];

    ws.mergeCells(1, 1, 1, 2);
    ws.getCell(1, 1).value = "AquaGuard — Field Survey Report Summary";
    styleExcelTitleCell(ws.getCell(1, 1), 14, EXCEL_BRAND);

    ws.mergeCells(2, 1, 2, 2);
    ws.getCell(2, 1).value = "DENR-MENRO Batangas · Calatagan Mangrove Reserve";
    styleExcelTitleCell(ws.getCell(2, 1), 10, EXCEL_BRAND_SOFT, false);

    ws.mergeCells(3, 1, 3, 2);
    ws.getCell(3, 1).value = exportRangeLabel();
    styleExcelTitleCell(ws.getCell(3, 1), 9, EXCEL_GRAY, false);

    ws.addRow([]);
    styleExcelHeaderRow(ws.addRow(["Metric", "Value"]));
    ws.addRow(["Total Surveys Recorded", rows.length]);
    ws.addRow(["Zones Covered", zoneSet.size]);

    ws.addRow([]);
    styleExcelHeaderRow(ws.addRow(["Observed Threats", "Count"]));
    (threatRows.length ? threatRows : [["No threats observed", 0]]).forEach(r => ws.addRow(r));

    return ws;
}

async function exportFieldSurveyExcel() {
    if (!window.ExcelJS) {
        alert("Excel export is unavailable right now — the Excel library failed to load. Check your connection and try again.");
        return;
    }

    const rows = sortedSubmissions();

    const header = ["Zone", "Ranger", "Date", "Canopy Cover", "Threats", "Water Color", "Aquafarm Activity"];

    const wb = new ExcelJS.Workbook();
    wb.creator = "AquaGuard";
    wb.created = new Date();
    wb.views = [{ activeTab: 0 }];

    const ws = wb.addWorksheet("Field Surveys", {
        views: [{ state: "frozen", ySplit: 5 }],
    });
    ws.columns = [
        { width: 18 }, { width: 16 }, { width: 14 }, { width: 15 },
        { width: 20 }, { width: 16 }, { width: 20 },
    ];

    ws.mergeCells(1, 1, 1, header.length);
    ws.getCell(1, 1).value = "AquaGuard — Field Survey Report";
    styleExcelTitleCell(ws.getCell(1, 1), 14, EXCEL_BRAND);

    ws.mergeCells(2, 1, 2, header.length);
    ws.getCell(2, 1).value = "DENR-MENRO Batangas · Calatagan Mangrove Reserve";
    styleExcelTitleCell(ws.getCell(2, 1), 10, EXCEL_BRAND_SOFT, false);

    ws.mergeCells(3, 1, 3, header.length);
    ws.getCell(3, 1).value = `${exportRangeLabel()}  ·  ${rows.length} survey${rows.length !== 1 ? "s" : ""} recorded`;
    styleExcelTitleCell(ws.getCell(3, 1), 9, EXCEL_GRAY, false);

    ws.addRow([]);
    styleExcelHeaderRow(ws.addRow(header));

    rows.forEach((sub, i) => {
        const row = ws.addRow([
            zoneNameForBarangay(sub["Barangay"]),
            sub["Ranger_Name"] || "—",
            sub["Inspection_Date"] || "—",
            sub["Estimated_Canopy_Cover_"] ? Number(sub["Estimated_Canopy_Cover_"]) : "—",
            sub["Observed_Threats"] ? capitalise(sub["Observed_Threats"].replace(/_/g, " ")) : "None observed",
            sub["Water_Color"] ? capitalise(sub["Water_Color"].replace(/_/g, " ")) : "—",
            sub["Nearby_Aquafarm_Activity"] ? capitalise(sub["Nearby_Aquafarm_Activity"].replace(/_/g, " ")) : "—",
        ]);

        if (sub["Estimated_Canopy_Cover_"]) row.getCell(4).numFmt = '0"%"';

        row.eachCell(cell => {
            cell.border = {
                top:    { style: "thin", color: { argb: EXCEL_LINE } },
                bottom: { style: "thin", color: { argb: EXCEL_LINE } },
            };
            if (i % 2 === 1) {
                cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: EXCEL_ZEBRA } };
            }
        });
    });

    if (rows.length > 0) {
        ws.autoFilter = { from: { row: 5, column: 1 }, to: { row: 5 + rows.length, column: header.length } };
    }

    buildSummarySheet(wb, rows);

    const buf = await wb.xlsx.writeBuffer();
    const blob = new Blob([buf], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `aquaguard-field-survey-report-${todayISO()}.xlsx`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
}

async function exportFieldSurveyPdf() {
    if (!window.jspdf || !window.jspdf.jsPDF) {
        alert("PDF export is unavailable right now — the PDF library failed to load. Check your connection and try again.");
        return;
    }

    const sealDataUrl = await sealImagePromise;

    const { jsPDF } = window.jspdf;
    const doc = new jsPDF({ orientation: "landscape", unit: "pt", format: "a4" });
    const pageWidth  = doc.internal.pageSize.getWidth();
    const pageHeight = doc.internal.pageSize.getHeight();
    const marginX = 32;
    const rows = sortedSubmissions();
    const generatedAt = new Date().toLocaleString("en-US");

    const BRAND      = [13, 67, 53];
    const BRAND_SOFT = [90, 130, 116];
    const GRAY       = [120, 130, 125];
    const LINE       = [210, 219, 214];
    const ZEBRA      = [242, 247, 244];

    const logoSize = 30;
    const textX = sealDataUrl ? marginX + logoSize + 10 : marginX;

    function drawHeader() {
        if (sealDataUrl) {
            doc.addImage(sealDataUrl, "PNG", marginX, 10, logoSize, logoSize);
        }

        doc.setTextColor(...BRAND);
        doc.setFont("helvetica", "bold");
        doc.setFontSize(15);
        doc.text("AquaGuard — Field Survey Report", textX, 24);

        doc.setTextColor(...GRAY);
        doc.setFont("helvetica", "normal");
        doc.setFontSize(9);
        doc.text("DENR-MENRO Batangas · Calatagan Mangrove Reserve", textX, 37);

        doc.setFontSize(7.5);
        doc.setTextColor(...BRAND_SOFT);
        doc.text(`Generated ${generatedAt}`, textX, 48);

        doc.setFont("helvetica", "bold");
        doc.setFontSize(9);
        doc.setTextColor(...BRAND);
        doc.text(
            `${exportRangeLabel()}  ·  ${rows.length} survey${rows.length !== 1 ? "s" : ""} recorded`,
            pageWidth - marginX, 37, { align: "right" }
        );

        doc.setDrawColor(...BRAND);
        doc.setLineWidth(1);
        doc.line(marginX, 58, pageWidth - marginX, 58);
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
        doc.text(`Page ${pageNumber} of {totalPages}`, pageWidth - marginX, footerY, { align: "right" });
    }

    doc.autoTable({
        startY: 74,
        margin: { top: 74, left: marginX, right: marginX, bottom: 40 },
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
            fillColor: BRAND,
            textColor: [255, 255, 255],
            fontStyle: "bold",
            lineColor: BRAND,
            lineWidth: 0.75,
        },
        alternateRowStyles: { fillColor: ZEBRA },
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

    if (typeof doc.putTotalPages === "function") {
        doc.putTotalPages("{totalPages}");
    }

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
