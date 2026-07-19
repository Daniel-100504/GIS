function computeFieldBreakdown(fieldKey, excludeValues = ["none_observed", "none", "n_a"]) {
  const counts = {};
  ALL_SUBMISSIONS.forEach(sub => {
    const raw = sub[fieldKey];
    if (!raw || excludeValues.includes(raw)) return;
    counts[raw] = (counts[raw] || 0) + 1;
  });
  return Object.entries(counts)
    .map(([val, count]) => ({ threat: val.replace(/_/g, " "), count }))
    .sort((a, b) => b.count - a.count);
}

function computeCanopyCoverBuckets() {
  const buckets = [
    { label: "0–20%",   min: 0,  max: 20,  count: 0 },
    { label: "20–40%",  min: 20, max: 40,  count: 0 },
    { label: "40–60%",  min: 40, max: 60,  count: 0 },
    { label: "60–80%",  min: 60, max: 80,  count: 0 },
    { label: "80–100%", min: 80, max: 101, count: 0 },
  ];
  ALL_SUBMISSIONS.forEach(sub => {
    const cover = parseFloat(sub["Estimated_Canopy_Cover_"]);
    if (isNaN(cover)) return;
    const bucket = buckets.find(b => cover >= b.min && cover < b.max);
    if (bucket) bucket.count++;
  });
  return buckets
    .filter(b => b.count > 0)
    .map(b => ({ threat: b.label, count: b.count }));
}

function computeNdviTrend() {
  const byDate = {};
  ALL_SUBMISSIONS.forEach(sub => {
    const date = sub["Inspection_Date"];
    const cover = sub["Estimated_Canopy_Cover_"];
    if (!date || !cover) return;
    const ndvi = coverToNDVI(cover);
    if (!byDate[date]) byDate[date] = [];
    byDate[date].push(ndvi);
  });
  return Object.keys(byDate)
    .sort()
    .map(date => ({
      date,
      avg: byDate[date].reduce((a, b) => a + b, 0) / byDate[date].length,
    }));
}

function computeDashboardStats() {
  const total    = ZONES.length;
  const healthy  = ZONES.filter(z => z.status === "healthy").length;
  const moderate = ZONES.filter(z => z.status === "moderate").length;
  const degraded = ZONES.filter(z => z.status === "degraded").length;
  const pending  = ZONES.filter(z => z.status === "pending").length;

  const avgNdvi = (() => {
    const withNdvi = ZONES.filter(z => z.ndvi !== null);
    return withNdvi.length > 0
      ? withNdvi.reduce((sum, z) => sum + z.ndvi, 0) / withNdvi.length
      : 0;
  })();

  const coverValues = ZONES
    .map(z => parseFloat(z.canopyCover))
    .filter(v => !isNaN(v));
  const avgCanopy = coverValues.length > 0
    ? coverValues.reduce((a, b) => a + b, 0) / coverValues.length
    : null;

  const threatCounts = {};
  ALL_SUBMISSIONS.forEach(sub => {
    const threat = sub["Observed_Threats"];
    if (!threat || threat === "none_observed") return;
    threatCounts[threat] = (threatCounts[threat] || 0) + 1;
  });
  const threatBreakdown = Object.entries(threatCounts)
    .map(([threat, count]) => ({ threat, count }))
    .sort((a, b) => b.count - a.count);
  const topThreat      = threatBreakdown.length > 0 ? threatBreakdown[0].threat : null;
  const topThreatCount = threatBreakdown.length > 0 ? threatBreakdown[0].count : 0;

  const dates = ALL_SUBMISSIONS
    .map(sub => sub["Inspection_Date"])
    .filter(Boolean)
    .sort();
  const latestDate = dates.length > 0 ? dates[dates.length - 1] : null;

  const ndviTrend = computeNdviTrend();
  const waterColorBreakdown = computeFieldBreakdown("Water_Color");
  const aquafarmBreakdown   = computeFieldBreakdown("Nearby_Aquafarm_Activity");
  const canopyBuckets       = computeCanopyCoverBuckets();

  const recent = [...ALL_SUBMISSIONS]
    .filter(sub => sub["Inspection_Date"])
    .sort((a, b) => (b["Inspection_Date"] || "").localeCompare(a["Inspection_Date"] || ""))
    .slice(0, 5)
    .map(sub => {
      const zoneId = BARANGAY_TO_ZONE[sub["Barangay"]];
      const zone   = ZONES.find(z => z.id === zoneId);
      return {
        zoneName: zone ? zone.name : (sub["Barangay"] || "Unknown zone").replace(/_/g, " "),
        zoneStatus: zone ? zone.status : "pending",
        ranger: sub["Ranger_Name"] || "—",
        date: sub["Inspection_Date"] || "—",
        threat: sub["Observed_Threats"] ? sub["Observed_Threats"].replace(/_/g, " ") : "none observed",
        raw: sub,
      };
    });

  return {
    total, healthy, moderate, degraded, pending,
    avgNdvi, avgCanopy,
    totalSurveys: ALL_SUBMISSIONS.length,
    latestDate,
    topThreat: topThreat ? topThreat.replace(/_/g, " ") : null,
    topThreatCount,
    threatBreakdown: threatBreakdown.map(t => ({ threat: t.threat.replace(/_/g, " "), count: t.count })),
    waterColorBreakdown,
    aquafarmBreakdown,
    canopyBuckets,
    ndviTrend,
    recent,
  };
}

const STAT_ICONS = {
  zones: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polygon points="3 6 9 3 15 6 21 3 21 18 15 21 9 18 3 21"/><line x1="9" y1="3" x2="9" y2="18"/><line x1="15" y1="6" x2="15" y2="21"/></svg>`,
  healthy: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 22c0-4 3-5 3-9a3 3 0 0 0-6 0c0 4 3 5 3 9Z"/><path d="M12 13V3"/><path d="M12 7 8 3"/><path d="M12 9 17 4"/></svg>`,
  moderate: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0Z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>`,
  degraded: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><line x1="14.83" y1="9.17" x2="9.17" y2="14.83"/><line x1="9.17" y1="9.17" x2="14.83" y2="14.83"/></svg>`,
  ndvi: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/></svg>`,
  canopy: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 22v-6.5"/><path d="M7 12.5a5 5 0 1 1 10 0c0 3.2-5 6.5-5 6.5s-5-3.3-5-6.5Z"/><path d="M9.5 7a2.5 2.5 0 1 1 5 0c0 1.7-2.5 3.3-2.5 3.3S9.5 8.7 9.5 7Z"/></svg>`,
  surveys: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M9 2h6a1 1 0 0 1 1 1v2H8V3a1 1 0 0 1 1-1Z"/><path d="M8 4H6a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V6a2 2 0 0 0-2-2h-2"/><line x1="8" y1="12" x2="16" y2="12"/><line x1="8" y1="16" x2="13" y2="16"/></svg>`,
  calendar: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="4.5" width="18" height="16" rx="2"/><line x1="16" y1="2.5" x2="16" y2="6.5"/><line x1="8" y1="2.5" x2="8" y2="6.5"/><line x1="3" y1="10" x2="21" y2="10"/></svg>`,
};

function statCard({ label, value, hint, icon, accent, valueClass }) {
  return `
    <div class="dashboard-stat-card${accent ? ` accent-${accent}` : ""}">
      <div class="dashboard-stat-icon${accent ? ` icon-${accent}` : ""}">${STAT_ICONS[icon] || ""}</div>
      <span class="dashboard-stat-label">${label}</span>
      <span class="dashboard-stat-value${valueClass ? ` ${valueClass}` : ""}">${value}</span>
      <span class="dashboard-stat-hint">${hint}</span>
    </div>
  `;
}

function formatDate(iso) {
  if (!iso || iso === "—") return "—";
  const d = new Date(iso);
  if (isNaN(d.getTime())) return iso;
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

function statusColorHex(status) {
  if (status === "healthy")  return "#1c7d61";
  if (status === "moderate") return "#c98a2c";
  if (status === "pending")  return "#93a29b";
  return "#c1473a";
}

function renderHealthDonut(healthy, moderate, degraded, pending = 0) {
  const total = healthy + moderate + degraded + pending;
  const r = 52, cx = 64, cy = 64, sw = 16;
  const circumference = 2 * Math.PI * r;

  const segments = [
    { value: healthy,  color: "#1c7d61", label: "Healthy" },
    { value: moderate, color: "#c98a2c", label: "Moderate" },
    { value: degraded, color: "#c1473a", label: "Degraded" },
  ];
  if (pending > 0) segments.push({ value: pending, color: "#c3cdc7", label: "Pending" });

  const gap = segments.filter(s => s.value > 0).length > 1 ? 1.5 : 0;
  let offset = 0;
  const arcs = segments.map(seg => {
    const pct  = total > 0 ? seg.value / total : 0;
    const rawDash = pct * circumference;
    const dash = Math.max(rawDash - gap, 0);
    const circle = pct > 0
      ? `<circle cx="${cx}" cy="${cy}" r="${r}" fill="none" stroke="${seg.color}" stroke-width="${sw}"
           stroke-dasharray="${dash.toFixed(2)} ${(circumference - dash).toFixed(2)}"
           stroke-dashoffset="${(-offset).toFixed(2)}" transform="rotate(-90 ${cx} ${cy})" stroke-linecap="butt"/>`
      : "";
    offset += rawDash;
    return circle;
  }).join("");

  const legend = segments.map(seg => `
    <div class="donut-legend-item">
      <span class="donut-legend-dot" style="background:${seg.color}"></span>
      <span class="donut-legend-label">${seg.label}</span>
      <span class="donut-legend-value">${seg.value}</span>
    </div>
  `).join("");

  return `
    <div class="donut-chart-wrap">
      <svg viewBox="0 0 128 128" width="128" height="128" class="donut-svg">
        <circle cx="${cx}" cy="${cy}" r="${r}" fill="none" stroke="#eef4f0" stroke-width="${sw}"/>
        ${arcs}
        <text x="${cx}" y="${cy - 4}" text-anchor="middle" font-size="24" font-weight="700" fill="#0a3128" font-family="'Space Grotesk', sans-serif">${total}</text>
        <text x="${cx}" y="${cy + 14}" text-anchor="middle" font-size="9" letter-spacing="1" fill="#869790">ZONES</text>
      </svg>
      <div class="donut-legend">${legend}</div>
    </div>
  `;
}

function renderNDVIBarChart(zones) {
  const withData = zones.filter(z => z.ndvi !== null).sort((a, b) => b.ndvi - a.ndvi);
  const noData   = zones.filter(z => z.ndvi === null).sort((a, b) => a.name.localeCompare(b.name));
  const max = Math.max(...withData.map(z => z.ndvi), 0.1);

  const legend = `
    <div class="hbar-legend">
      <span><span class="hbar-legend-dot" style="background:${statusColorHex("healthy")}"></span>Healthy</span>
      <span><span class="hbar-legend-dot" style="background:${statusColorHex("moderate")}"></span>Moderate</span>
      <span><span class="hbar-legend-dot" style="background:${statusColorHex("degraded")}"></span>Degraded</span>
    </div>
  `;

  const dataRows = withData.map(z => {
    const pct   = Math.max((z.ndvi / max) * 100, 4);
    const color = statusColorHex(z.status);
    return `
      <div class="hbar-row">
        <span class="hbar-label" title="${escapeHtml(z.name)}">${escapeHtml(z.name)}</span>
        <div class="hbar-track">
          <div class="hbar-fill" style="width:${pct.toFixed(1)}%; background:linear-gradient(90deg, ${color}b3, ${color})"></div>
        </div>
        <span class="hbar-value">${z.ndvi.toFixed(2)}</span>
      </div>
    `;
  }).join("");

  const noDataRows = noData.map(z => `
    <div class="hbar-row no-data">
      <span class="hbar-label" title="${escapeHtml(z.name)}">${escapeHtml(z.name)}</span>
      <div class="hbar-track dashed"><div class="hbar-fill-empty"></div></div>
      <span class="hbar-value muted">No data</span>
    </div>
  `).join("");

  const footnote = noData.length > 0
    ? `<div class="hbar-footnote">${noData.length} zone${noData.length !== 1 ? "s" : ""} awaiting a field survey or satellite sync</div>`
    : "";

  if (withData.length === 0 && noData.length === 0) {
    return `<div class="dashboard-empty">No zone data recorded yet.</div>`;
  }

  return `${legend}<div class="hbar-chart">${dataRows}${noDataRows}</div>${footnote}`;
}

function renderBreakdownBarChart(breakdown, emptyText) {
  if (!breakdown || breakdown.length === 0) {
    return `<div class="dashboard-empty">${emptyText}</div>`;
  }
  const max = Math.max(...breakdown.map(t => t.count));

  const rows = breakdown.map(t => {
    const pct = Math.max((t.count / max) * 100, 4);
    return `
      <div class="hbar-row">
        <span class="hbar-label" title="${escapeHtml(capitalise(t.threat))}">${escapeHtml(capitalise(t.threat))}</span>
        <div class="hbar-track">
          <div class="hbar-fill threat-fill" style="width:${pct.toFixed(1)}%"></div>
        </div>
        <span class="hbar-value">${t.count}</span>
      </div>
    `;
  }).join("");

  return `<div class="hbar-chart">${rows}</div>`;
}

function renderThreatBarChart(threatBreakdown) {
  return renderBreakdownBarChart(threatBreakdown, "No threats reported in field surveys.");
}

function renderNDVITrendChart(ndviTrend) {
  const points = ndviTrend.filter(p => p.avg !== null);
  if (points.length < 2) {
    return `<div class="dashboard-empty">Not enough scene dates yet to plot a trend.</div>`;
  }

  const w = 640, h = 170, padL = 38, padR = 16, padT = 16, padB = 28;
  const innerW = w - padL - padR, innerH = h - padT - padB;

  const values = points.map(p => p.avg);
  const minV = Math.min(...values) - 0.03;
  const maxV = Math.max(...values) + 0.03;

  const x = i => padL + (innerW * i) / (points.length - 1);
  const y = v => padT + innerH - ((v - minV) / (maxV - minV)) * innerH;

  const linePath = points.map((p, i) => `${i === 0 ? "M" : "L"} ${x(i).toFixed(1)} ${y(p.avg).toFixed(1)}`).join(" ");
  const areaPath = `${linePath} L ${x(points.length - 1).toFixed(1)} ${(padT + innerH).toFixed(1)} L ${x(0).toFixed(1)} ${(padT + innerH).toFixed(1)} Z`;

  const dots = points.map((p, i) => `<circle cx="${x(i).toFixed(1)}" cy="${y(p.avg).toFixed(1)}" r="3.2" fill="#0a3128"/>`).join("");
  const labels = points.map((p, i) => {
    if (points.length > 6 && i % Math.ceil(points.length / 6) !== 0 && i !== points.length - 1) return "";
    const d = new Date(p.date);
    const label = isNaN(d.getTime()) ? p.date : d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
    return `<text x="${x(i).toFixed(1)}" y="${h - 6}" font-size="9" fill="#869790" text-anchor="middle">${label}</text>`;
  }).join("");

  return `
    <svg viewBox="0 0 ${w} ${h}" width="100%" height="${h}" class="trend-svg" preserveAspectRatio="none">
      <defs>
        <linearGradient id="ndviAreaFill" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stop-color="#1c7d61" stop-opacity="0.28"/>
          <stop offset="100%" stop-color="#1c7d61" stop-opacity="0"/>
        </linearGradient>
      </defs>
      <line x1="${padL}" y1="${padT}" x2="${padL}" y2="${padT + innerH}" stroke="#e0e8e3" stroke-width="1"/>
      <line x1="${padL}" y1="${padT + innerH}" x2="${w - padR}" y2="${padT + innerH}" stroke="#e0e8e3" stroke-width="1"/>
      <path d="${areaPath}" fill="url(#ndviAreaFill)" stroke="none"/>
      <path d="${linePath}" fill="none" stroke="#1c7d61" stroke-width="2.25"/>
      ${dots}
      ${labels}
    </svg>
  `;
}


let dashboardSelectedDate  = null; 
let dashboardCalendarYear  = null; 
let dashboardCalendarMonth = null; 

// Keeps the "Field Survey Calendar" in sync with the Scene Date control in the
// map's right panel: whenever the Scene Date changes (or the dashboard is
// opened), the calendar jumps to that date and re-summarizes its week.
function setDashboardDateFromScene(dateStr) {
  if (!dateStr) return;
  const d = new Date(dateStr + "T00:00:00");
  if (isNaN(d.getTime())) return;

  dashboardSelectedDate  = dateStr;
  dashboardCalendarYear  = d.getFullYear();
  dashboardCalendarMonth = d.getMonth();

  if (typeof dashboardView !== "undefined" && dashboardView && dashboardView.classList.contains("active")) {
    renderDashboard();
  }
}

function availableSurveyDates() {
  return [...new Set(ALL_SUBMISSIONS.map(s => s["Inspection_Date"]).filter(Boolean))].sort();
}

function submissionsOnDate(dateStr) {
  return ALL_SUBMISSIONS.filter(sub => sub["Inspection_Date"] === dateStr);
}

function submissionsInRange(startIso, endIso) {
  return ALL_SUBMISSIONS.filter(sub => {
    const d = sub["Inspection_Date"];
    return d && d >= startIso && d <= endIso;
  });
}

function isoDate(d) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function mondayOf(dateStr) {
  const d = new Date(dateStr + "T00:00:00");
  const offset = (d.getDay() + 6) % 7; 
  d.setDate(d.getDate() - offset);
  return isoDate(d);
}

function weekRange(dateStr) {
  const start = mondayOf(dateStr);
  const endD = new Date(start + "T00:00:00");
  endD.setDate(endD.getDate() + 6);
  return { start, end: isoDate(endD) };
}

function buildMonthGrid(year, month) {
  const firstOfMonth = new Date(year, month, 1);
  const leadDays = (firstOfMonth.getDay() + 6) % 7;
  const start = new Date(year, month, 1 - leadDays);
  const cells = [];
  for (let i = 0; i < 42; i++) {
    const d = new Date(start);
    d.setDate(start.getDate() + i);
    cells.push(d);
  }
  return cells;
}

function renderSurveyLogCard(sub) {
  const zoneId = BARANGAY_TO_ZONE[sub["Barangay"]];
  const zone = ZONES.find(z => z.id === zoneId);
  const hasThreat = sub["Observed_Threats"] && sub["Observed_Threats"] !== "none_observed";

  return `
    <div class="survey-log-card">
      <div class="survey-log-card-head">
        <span class="survey-log-zone">${escapeHtml(zone ? zone.name : (sub["Barangay"] || "Unknown zone").replace(/_/g, " "))}</span>
        <span class="threat-tag ${hasThreat ? "flagged" : "none"}">
          ${hasThreat ? escapeHtml(capitalise(sub["Observed_Threats"].replace(/_/g, " "))) : "None observed"}
        </span>
      </div>
      <div class="survey-log-grid">
        <div class="survey-log-field">
          <span class="survey-log-label">Ranger</span>
          <span class="survey-log-value">${escapeHtml(sub["Ranger_Name"] || "—")}</span>
        </div>
        <div class="survey-log-field">
          <span class="survey-log-label">Canopy Cover</span>
          <span class="survey-log-value">${sub["Estimated_Canopy_Cover_"] ? sub["Estimated_Canopy_Cover_"] + "%" : "—"}</span>
        </div>
        <div class="survey-log-field">
          <span class="survey-log-label">Water Color</span>
          <span class="survey-log-value">${escapeHtml(sub["Water_Color"] ? sub["Water_Color"].replace(/_/g, " ") : "—")}</span>
        </div>
        <div class="survey-log-field">
          <span class="survey-log-label">Aquafarm Nearby</span>
          <span class="survey-log-value">${escapeHtml(sub["Nearby_Aquafarm_Activity"] ? sub["Nearby_Aquafarm_Activity"].replace(/_/g, " ") : "—")}</span>
        </div>
      </div>
      ${sub["Additional_Notes"] ? `<p class="survey-log-notes">${escapeHtml(sub["Additional_Notes"])}</p>` : ""}
    </div>
  `;
}

function renderCalendarWidget(weekStart, weekEnd) {
  const monthLabel = new Date(dashboardCalendarYear, dashboardCalendarMonth, 1)
    .toLocaleDateString("en-US", { month: "long", year: "numeric" });
  const cells   = buildMonthGrid(dashboardCalendarYear, dashboardCalendarMonth);
  const todayIso = todayISO();

  const dowRow = ["Mo", "Tu", "We", "Th", "Fr", "Sa", "Su"]
    .map(d => `<span class="cal-dow">${d}</span>`).join("");

  const dayCells = cells.map(d => {
    const iso     = isoDate(d);
    const inMonth = d.getMonth() === dashboardCalendarMonth;
    const count   = submissionsOnDate(iso).length;

    const classes = ["cal-day"];
    if (!inMonth) classes.push("outside");
    if (count > 0) classes.push("has-data");
    if (iso >= weekStart && iso <= weekEnd) classes.push("in-week");
    if (iso === dashboardSelectedDate) classes.push("selected");
    if (iso === todayIso) classes.push("today");

    return `
      <button type="button" class="${classes.join(" ")}" data-date="${iso}"
        aria-label="${formatDate(iso)}, ${count} survey${count !== 1 ? "s" : ""}">
        <span class="cal-day-num">${d.getDate()}</span>
        ${count > 0 ? `<span class="cal-day-dot"></span>` : ""}
      </button>
    `;
  }).join("");

  return `
    <div class="cal-header">
      <button type="button" class="date-nav-btn" id="calPrevMonth" aria-label="Previous month">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><polyline points="15 18 9 12 15 6"/></svg>
      </button>
      <span class="cal-month-label">${monthLabel}</span>
      <button type="button" class="date-nav-btn" id="calNextMonth" aria-label="Next month">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><polyline points="9 18 15 12 9 6"/></svg>
      </button>
    </div>
    <div class="cal-grid cal-dow-row">${dowRow}</div>
    <div class="cal-grid cal-days">${dayCells}</div>
    <div class="cal-legend">
      <span><span class="cal-legend-dot"></span> Has survey data</span>
      <span><span class="cal-legend-swatch"></span> Selected week</span>
    </div>
  `;
}

function detailField(label, value) {
  return `
    <div class="survey-detail-field">
      <span class="survey-detail-label">${escapeHtml(label)}</span>
      <span class="survey-detail-value">${escapeHtml(value || "—")}</span>
    </div>
  `;
}

function renderSurveyDetailBody(sub, zoneName, zoneStatus) {
  const hasThreat = sub["Observed_Threats"] && sub["Observed_Threats"] !== "none_observed";
  const gpsParts  = (sub["GPS"] || "").split(" ").map(Number);
  const hasGps    = gpsParts.length >= 2 && !isNaN(gpsParts[0]) && !isNaN(gpsParts[1]);

  return `
    <div class="survey-detail-topline">
      <span class="status-chip status-${zoneStatus || "pending"}">${capitalise(zoneStatus || "pending")}</span>
      <span class="threat-tag ${hasThreat ? "flagged" : "none"}">
        ${hasThreat ? escapeHtml(capitalise(sub["Observed_Threats"].replace(/_/g, " "))) : "None observed"}
      </span>
    </div>

    <div class="survey-detail-grid">
      ${detailField("Ranger name", sub["Ranger_Name"])}
      ${detailField("Inspection date", formatDate(sub["Inspection_Date"]))}
      ${detailField("Transect / quadrat", sub["Transect_Number"])}
      ${detailField("Estimated canopy cover", sub["Estimated_Canopy_Cover_"] ? sub["Estimated_Canopy_Cover_"] + "%" : "—")}
      ${detailField("Species observed", sub["Species_Name"])}
      ${detailField("Tree count", sub["Tree_Count"])}
      ${detailField("Water color", sub["Water_Color"] ? sub["Water_Color"].replace(/_/g, " ") : "—")}
      ${detailField("Nearby aquafarm activity", sub["Nearby_Aquafarm_Activity"] ? sub["Nearby_Aquafarm_Activity"].replace(/_/g, " ") : "—")}
      ${hasGps ? detailField("GPS coordinates", `${gpsParts[0].toFixed(5)}, ${gpsParts[1].toFixed(5)}`) : ""}
    </div>

    ${sub["Additional_Notes"] ? `
      <div class="survey-detail-notes">
        <span class="survey-detail-label">Additional notes</span>
        <p>${escapeHtml(sub["Additional_Notes"])}</p>
      </div>
    ` : ""}

    <div class="survey-detail-source">
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M9 2h6a1 1 0 0 1 1 1v2H8V3a1 1 0 0 1 1-1Z"/><path d="M8 4H6a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V6a2 2 0 0 0-2-2h-2"/></svg>
      Synced from KoboToolbox field survey submission
    </div>
  `;
}

function openSurveyDetail(sub, zoneName, zoneStatus) {
  const overlay = document.getElementById("surveyDetailOverlay");
  const titleEl = document.getElementById("surveyDetailTitle");
  const subEl   = document.getElementById("surveyDetailSub");
  const bodyEl  = document.getElementById("surveyDetailBody");
  if (!overlay || !titleEl || !subEl || !bodyEl) return;

  titleEl.textContent = zoneName;
  subEl.textContent   = `Field survey · ${formatDate(sub["Inspection_Date"])}`;
  bodyEl.innerHTML     = renderSurveyDetailBody(sub, zoneName, zoneStatus);

  overlay.classList.add("open");
}

function closeSurveyDetail() {
  const overlay = document.getElementById("surveyDetailOverlay");
  if (overlay) overlay.classList.remove("open");
}

(function bindSurveyDetailModal() {
  const overlay  = document.getElementById("surveyDetailOverlay");
  const closeBtn = document.getElementById("btnCloseSurveyDetail");
  if (closeBtn) closeBtn.addEventListener("click", closeSurveyDetail);
  if (overlay) {
    overlay.addEventListener("click", (e) => {
      if (e.target === overlay) closeSurveyDetail();
    });
  }
})();

function bindActivityTableControls(recentList) {
  const table = document.querySelector(".activity-table tbody");
  if (!table) return;

  const openFromRow = (row) => {
    const item = recentList[parseInt(row.dataset.idx, 10)];
    if (item && item.raw) openSurveyDetail(item.raw, item.zoneName, item.zoneStatus);
  };

  table.addEventListener("click", (e) => {
    const row = e.target.closest("tr[data-idx]");
    if (row) openFromRow(row);
  });

  table.addEventListener("keydown", (e) => {
    if (e.key !== "Enter" && e.key !== " ") return;
    const row = e.target.closest("tr[data-idx]");
    if (!row) return;
    e.preventDefault();
    openFromRow(row);
  });
}

function renderSurveyLog() {
  const dates = availableSurveyDates();

  if (dates.length === 0) {
    dashboardSelectedDate = null;
    return `<div class="dashboard-empty">No field survey submissions recorded yet.</div>`;
  }

  if (!dashboardSelectedDate) {
    dashboardSelectedDate = dates[dates.length - 1];
  }

  if (dashboardCalendarYear === null) {
    const selD = new Date(dashboardSelectedDate + "T00:00:00");
    dashboardCalendarYear  = selD.getFullYear();
    dashboardCalendarMonth = selD.getMonth();
  }

  const { start: weekStart, end: weekEnd } = weekRange(dashboardSelectedDate);
  const weekSubs = submissionsInRange(weekStart, weekEnd)
    .sort((a, b) => (a["Inspection_Date"] || "").localeCompare(b["Inspection_Date"] || ""));

  const summaryCards = weekSubs.length > 0
    ? `<div class="survey-log-cards">${weekSubs.map(renderSurveyLogCard).join("")}</div>`
    : `<div class="dashboard-empty">No field surveys gathered this week.</div>`;

  const rangeLabel = weekStart.slice(0, 7) === weekEnd.slice(0, 7)
    ? `${formatDate(weekStart)} – ${new Date(weekEnd + "T00:00:00").toLocaleDateString("en-US", { day: "numeric" })}, ${weekEnd.slice(0, 4)}`
    : `${formatDate(weekStart)} – ${formatDate(weekEnd)}`;

  return `
    <div class="survey-log-layout">
      <div class="survey-calendar">
        ${renderCalendarWidget(weekStart, weekEnd)}
      </div>
      <div class="survey-week-summary">
        <div class="week-summary-head">
          <span class="week-summary-range">${rangeLabel}</span>
          <span class="week-summary-count">${weekSubs.length} survey${weekSubs.length !== 1 ? "s" : ""} gathered this week</span>
        </div>
        ${summaryCards}
      </div>
    </div>
  `;
}

function shiftCalendarMonth(dir) {
  dashboardCalendarMonth += dir;
  if (dashboardCalendarMonth < 0)  { dashboardCalendarMonth = 11; dashboardCalendarYear--; }
  if (dashboardCalendarMonth > 11) { dashboardCalendarMonth = 0;  dashboardCalendarYear++; }
  renderDashboard();
}

function bindSurveyLogControls() {
  const grid = document.querySelector(".survey-calendar .cal-days");
  if (grid) {
    grid.addEventListener("click", (e) => {
      const btn = e.target.closest(".cal-day");
      if (!btn) return;
      dashboardSelectedDate = btn.dataset.date;
      renderDashboard();
    });
  }

  const prevBtn = document.getElementById("calPrevMonth");
  const nextBtn = document.getElementById("calNextMonth");
  if (prevBtn) prevBtn.addEventListener("click", () => shiftCalendarMonth(-1));
  if (nextBtn) nextBtn.addEventListener("click", () => shiftCalendarMonth(1));
}

function renderDashboard() {
  const body = document.getElementById("dashboardBody");
  if (!body) return;

  const s = computeDashboardStats();
  const surveyLogHtml = renderSurveyLog();

  const activityHtml = s.recent.length > 0
    ? `<table class="activity-table">
        <thead>
          <tr>
            <th>Zone</th>
            <th>Ranger</th>
            <th>Observed Threat</th>
            <th>Date</th>
          </tr>
        </thead>
        <tbody>
          ${s.recent.map((r, i) => `
            <tr class="activity-row" data-idx="${i}" tabindex="0">
              <td class="activity-zone-cell">${escapeHtml(r.zoneName)}</td>
              <td>${escapeHtml(r.ranger)}</td>
              <td>${r.threat === "none observed"
                    ? `<span class="threat-tag none">None observed</span>`
                    : `<span class="threat-tag flagged">${escapeHtml(capitalise(r.threat))}</span>`}</td>
              <td class="activity-date-cell">${escapeHtml(formatDate(r.date))}</td>
            </tr>
          `).join("")}
        </tbody>
      </table>`
    : `<div class="dashboard-empty">No field survey submissions recorded yet.</div>`;

  body.innerHTML = `
    <div class="dashboard-header">
      <div class="dashboard-header-badge">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 22c0-4 3-5 3-9a3 3 0 0 0-6 0c0 4 3 5 3 9Z"/><path d="M12 13V3"/><path d="M12 7 8 3"/><path d="M12 9 17 4"/></svg>
      </div>
      <div>
        <h2 class="dashboard-page-title">Mangrove Monitoring Dashboard</h2>
        <div class="dashboard-meta-row">
          <span>MENRO Calatagan · Batangas</span>
          <span class="dashboard-meta-dot">•</span>
          <span>Generated ${formatDate(todayISO())}</span>
          ${s.latestDate ? `<span class="dashboard-meta-dot">•</span><span>Latest field inspection ${formatDate(s.latestDate)}</span>` : ""}
        </div>
      </div>
    </div>

    <p class="dashboard-section-title">Zone Health Overview</p>
    <div class="dashboard-grid">
      ${statCard({ icon: "zones", accent: "", label: "Total Mangrove Zones", value: s.total, hint: s.pending > 0 ? `${s.pending} zone${s.pending !== 1 ? "s" : ""} awaiting data` : "Across 17 barangays" })}
      ${statCard({ icon: "healthy", accent: "healthy", label: "Healthy Zones", value: s.healthy, hint: `${s.total ? Math.round((s.healthy / s.total) * 100) : 0}% of total` })}
      ${statCard({ icon: "moderate", accent: "moderate", label: "Moderate Zones", value: s.moderate, hint: `${s.total ? Math.round((s.moderate / s.total) * 100) : 0}% of total`, valueClass: "amber" })}
      ${statCard({ icon: "degraded", accent: "degraded", label: "Degraded Zones", value: s.degraded, hint: `${s.total ? Math.round((s.degraded / s.total) * 100) : 0}% of total`, valueClass: "red" })}
    </div>

    <div class="dashboard-charts-row">
      <div class="chart-card chart-card-narrow">
        <p class="chart-card-title">Health Distribution</p>
        ${renderHealthDonut(s.healthy, s.moderate, s.degraded, s.pending)}
      </div>
      <div class="chart-card">
        <p class="chart-card-title">NDVI by Zone</p>
        ${renderNDVIBarChart(ZONES)}
      </div>
    </div>

    <p class="dashboard-section-title">Satellite &amp; Field Metrics</p>
    <div class="dashboard-grid">
      ${statCard({ icon: "ndvi", label: "Average NDVI", value: s.avgNdvi.toFixed(2), hint: "Scene-wide mean" })}
      ${statCard({ icon: "canopy", label: "Average Canopy Cover", value: s.avgCanopy !== null ? s.avgCanopy.toFixed(0) + "%" : "—", hint: s.avgCanopy !== null ? "From field surveys" : "No field data yet" })}
      ${statCard({ icon: "surveys", label: "Total Field Surveys", value: s.totalSurveys, hint: "KoboToolbox submissions" })}
      ${statCard({ icon: "calendar", label: "Latest Inspection", value: s.latestDate ? formatDate(s.latestDate) : "—", hint: "Most recent ranger visit", valueClass: "date-value" })}
    </div>

    <p class="dashboard-section-title">Field Survey Calendar</p>
    <div class="chart-card survey-log-panel">
      ${surveyLogHtml}
    </div>

    <div class="dashboard-charts-row dashboard-charts-row-reverse">
      <div class="chart-card">
        <p class="chart-card-title">Average NDVI Trend</p>
        ${renderNDVITrendChart(s.ndviTrend)}
      </div>
      <div class="chart-card chart-card-narrow">
        <p class="chart-card-title">Observed Threats</p>
        ${renderThreatBarChart(s.threatBreakdown)}
      </div>
    </div>

    <p class="dashboard-section-title">Field Survey Insights</p>
    <div class="dashboard-charts-row-3">
      <div class="chart-card">
        <p class="chart-card-title">Canopy Cover Distribution</p>
        ${renderBreakdownBarChart(s.canopyBuckets, "No canopy cover data recorded yet.")}
      </div>
      <div class="chart-card">
        <p class="chart-card-title">Water Color</p>
        ${renderBreakdownBarChart(s.waterColorBreakdown, "No water color data recorded yet.")}
      </div>
      <div class="chart-card">
        <p class="chart-card-title">Nearby Aquafarm Activity</p>
        ${renderBreakdownBarChart(s.aquafarmBreakdown, "No aquafarm activity data recorded yet.")}
      </div>
    </div>

    <p class="dashboard-section-title">Recent Survey Activity</p>
    ${activityHtml}
  `;

  bindSurveyLogControls();
  bindActivityTableControls(s.recent);
}

const mapView       = document.getElementById("mapView");
const dashboardView = document.getElementById("dashboardView");

function switchTab(tab) {
  const toDashboard = tab === "dashboard";

  if (mapView)       mapView.style.display = toDashboard ? "none" : "flex";
  if (dashboardView) dashboardView.classList.toggle("active", toDashboard);

  if (toDashboard) {
    renderDashboard();
  } else if (typeof map !== "undefined" && map.invalidateSize) {
    setTimeout(() => map.invalidateSize(), 0);
  }
}

function openDashboard() {
  const sceneDateEl = document.getElementById("sceneDate");
  if (sceneDateEl && sceneDateEl.value) setDashboardDateFromScene(sceneDateEl.value);
  switchTab("dashboard");
}
function closeDashboard() { switchTab("map"); }