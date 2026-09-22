function computeFieldBreakdown(submissions, fieldKey, excludeValues = ["none_observed", "none", "n_a"]) {
  const counts = {};
  submissions.forEach(sub => {
    const raw = sub[fieldKey];
    if (!raw || excludeValues.includes(raw)) return;
    counts[raw] = (counts[raw] || 0) + 1;
  });
  return Object.entries(counts)
    .map(([val, count]) => ({ threat: val.replace(/_/g, " "), count }))
    .sort((a, b) => b.count - a.count);
}

// Buckets every measured tree's height (from the per-tree Tree Measurements
// data) into ranges, across all submissions — replaces the old canopy-cover
// percentage buckets, which no longer exist in the new survey.
function computeTreeHeightBuckets(submissions) {
  const buckets = [
    { label: "0–2m",  min: 0, max: 2,   count: 0 },
    { label: "2–4m",  min: 2, max: 4,   count: 0 },
    { label: "4–6m",  min: 4, max: 6,   count: 0 },
    { label: "6–8m",  min: 6, max: 8,   count: 0 },
    { label: "8m+",   min: 8, max: Infinity, count: 0 },
  ];
  submissions.forEach(sub => {
    const trees = koboExtractTrees(sub);
    trees.forEach(t => {
      const h = parseFloat(koboTreeField(t, "Average_Tree_Height_m") || koboTreeField(t, "Height_m"));
      if (isNaN(h)) return;
      const bucket = buckets.find(b => h >= b.min && h < b.max);
      if (bucket) bucket.count++;
    });
  });
  return buckets
    .filter(b => b.count > 0)
    .map(b => ({ threat: b.label, count: b.count }));
}

// Number of trees measured per visit date, across all submissions. This is
// real survey effort/coverage, replacing the old canopy-cover-percent trend
// which no longer has a data source in the new survey.
function computeTreesMeasuredTrend(submissions) {
  const byDate = {};
  submissions.forEach(sub => {
    const date = koboSubmissionDate(sub);
    const trees = koboExtractTrees(sub);
    if (!date || trees.length === 0) return;
    if (!byDate[date]) byDate[date] = 0;
    byDate[date] += trees.length;
  });
  return Object.keys(byDate)
    .sort()
    .map(date => ({ date, avg: byDate[date] }));
}

function computeZoneSnapshotForDate(dateStr) {
  const subs = typeof submissionsUpToDate === "function" ? submissionsUpToDate(dateStr) : ALL_SUBMISSIONS;
  const byZone = latestSubmissionByZone(subs);

  return ZONES.map(zone => {
    const sub = byZone[zone.id];
    if (!sub) {
      return {
        id: zone.id, name: zone.name, area: zone.area, partner: zone.partner,
        ndvi: zone.dashboardNdvi ?? null, status: "pending", treesMeasured: 0,
      };
    }
    const treeCount = koboExtractTrees(sub).length;
    return {
      id: zone.id,
      name: zone.name,
      area: zone.area,
      partner: zone.partner,
      // Real satellite NDVI (from Sentinel-2, via map-core.js's fetchZoneNdviFromCopernicus),
      // not derived from the ranger's field measurements. Null until a satellite sync completes.
      // Read from zone.dashboardNdvi (this view's own date), not zone.satNdvi
      // (the map/Scene Calendar's date) — the two can legitimately differ.
      ndvi: zone.dashboardNdvi ?? null,
      status: deriveStatus(sub),
      treesMeasured: treeCount,
    };
  });
}

function computeDashboardStats(dateStr) {
  const subsUpToDate = typeof submissionsUpToDate === "function" ? submissionsUpToDate(dateStr) : ALL_SUBMISSIONS;
  const zoneSnapshot  = computeZoneSnapshotForDate(dateStr);

  const total    = zoneSnapshot.length;
  const healthy  = zoneSnapshot.filter(z => z.status === "healthy").length;
  const moderate = zoneSnapshot.filter(z => z.status === "moderate").length;
  const degraded = zoneSnapshot.filter(z => z.status === "degraded").length;
  const pending  = zoneSnapshot.filter(z => z.status === "pending").length;

  const avgNdvi = (() => {
    const withNdvi = zoneSnapshot.filter(z => z.ndvi !== null);
    return withNdvi.length > 0
      ? withNdvi.reduce((sum, z) => sum + z.ndvi, 0) / withNdvi.length
      : 0;
  })();

  const treeCountValues = zoneSnapshot.map(z => z.treesMeasured || 0);
  const totalTrees = treeCountValues.reduce((a, b) => a + b, 0);

  const speciesCounts = {};
  subsUpToDate.forEach(sub => {
    koboExtractTrees(sub).forEach(t => {
      const sp = koboTreeField(t, "Species_Name") || koboTreeField(t, "Species");
      if (!sp) return;
      speciesCounts[sp] = (speciesCounts[sp] || 0) + 1;
    });
  });
  const speciesBreakdown = Object.entries(speciesCounts)
    .map(([species, count]) => ({ threat: species, count }))
    .sort((a, b) => b.count - a.count);
  const topSpecies      = speciesBreakdown.length > 0 ? speciesBreakdown[0].threat : null;
  const topSpeciesCount = speciesBreakdown.length > 0 ? speciesBreakdown[0].count : 0;

  const dates = subsUpToDate
    .map(sub => koboSubmissionDate(sub))
    .filter(Boolean)
    .sort();
  const latestDate = dates.length > 0 ? dates[dates.length - 1] : null;

  const treesTrend        = computeTreesMeasuredTrend(subsUpToDate);
  const waterNotesBreakdown = (() => {
    const withNotes = subsUpToDate.filter(sub => (sub["Water_Quality_Notes"] || sub["Water_quality_notes"] || "").trim()).length;
    const withoutNotes = subsUpToDate.length - withNotes;
    return [
      { threat: "Notes recorded", count: withNotes },
      { threat: "No notes", count: withoutNotes },
    ].filter(r => r.count > 0);
  })();
  const aquafarmBreakdown = computeFieldBreakdown(subsUpToDate, "Nearby_Aquafarm_Activity", ["none_nearby"]);
  const treeHeightBuckets = computeTreeHeightBuckets(subsUpToDate);

  return {
    total, healthy, moderate, degraded, pending,
    avgNdvi, totalTrees,
    totalSurveys: subsUpToDate.length,
    latestDate,
    topSpecies,
    topSpeciesCount,
    speciesBreakdown,
    waterNotesBreakdown,
    aquafarmBreakdown,
    treeHeightBuckets,
    treesTrend,
    zoneSnapshot,
  };
}

function formatDate(iso) {
  if (!iso || iso === "—") return "—";
  const d = new Date(iso);
  if (isNaN(d.getTime())) return iso;
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

let dashboardSelectedDate  = null;
let dashboardCalendarYear  = null;
let dashboardCalendarMonth = null;

function ensureDashboardSelectedDate() {
  // Defaults to today's date rather than the latest survey date, so opening
  // the dashboard always starts on "now" unless the user picks a different day.
  if (!dashboardSelectedDate) {
    dashboardSelectedDate = todayISO();
  }

  if (dashboardCalendarYear === null) {
    const d = new Date(dashboardSelectedDate + "T00:00:00");
    dashboardCalendarYear  = d.getFullYear();
    dashboardCalendarMonth = d.getMonth();
  }
}

function availableSurveyDates() {
  return [...new Set(ALL_SUBMISSIONS.map(s => koboSubmissionDate(s)).filter(Boolean))].sort();
}

function submissionsOnDate(dateStr) {
  return ALL_SUBMISSIONS.filter(sub => koboSubmissionDate(sub) === dateStr);
}

function submissionsInRange(startIso, endIso) {
  return ALL_SUBMISSIONS.filter(sub => {
    const d = koboSubmissionDate(sub);
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

function renderHealthDonut(healthy, moderate, degraded, pending = 0) {
  const total    = healthy + moderate + degraded + pending;
  const surveyed = healthy + moderate + degraded;
  const r = 50, cx = 64, cy = 64, sw = 19;
  const circumference = 2 * Math.PI * r;

  const segments = [
    { value: healthy,  color: "#1c7d61", key: "healthy",  label: "Good" },
    { value: moderate, color: "#c98a2c", key: "moderate", label: "Fair" },
    { value: degraded, color: "#c1473a", key: "degraded", label: "Poor" },
  ];
  if (pending > 0) segments.push({ value: pending, color: "#c3cdc7", key: "pending", label: "Pending" });

  const gap = segments.filter(s => s.value > 0).length > 1 ? 2.2 : 0;
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
      <span class="donut-legend-dot ${seg.key}"></span>
      <span class="donut-legend-label">${seg.label}</span>
      <span class="donut-legend-value">${seg.value}</span>
    </div>
  `).join("");

  return `
    <div class="donut-chart-wrap">
      <svg viewBox="0 0 128 128" width="128" height="128" class="donut-svg">
        <circle cx="${cx}" cy="${cy}" r="${r}" fill="none" stroke="#eef4f0" stroke-width="${sw}"/>
        ${arcs}
        <text x="${cx}" y="${cy - 3}" text-anchor="middle" font-size="30" font-weight="800" fill="#0a3128" font-family="'Space Grotesk', sans-serif">${surveyed}</text>
        <text x="${cx}" y="${cy + 15}" text-anchor="middle" font-size="9" letter-spacing="1.5" fill="#869790" font-weight="600">ZONES</text>
      </svg>
      <div class="donut-legend">${legend}</div>
    </div>
    <p class="donut-surveyed-note">${surveyed} of ${total} zones have data</p>
  `;
}

function renderNDVIBarChart(zones) {
  const withData = zones.filter(z => z.ndvi !== null).sort((a, b) => b.ndvi - a.ndvi);
  const noData   = zones.filter(z => z.ndvi === null).sort((a, b) => a.name.localeCompare(b.name));
  const max = Math.max(...withData.map(z => z.ndvi), 0.1);

  const legend = `
    <div class="hbar-legend">
      <span><span class="hbar-legend-dot healthy"></span>High</span>
      <span><span class="hbar-legend-dot moderate"></span>Moderate</span>
      <span><span class="hbar-legend-dot degraded"></span>Low</span>
    </div>
  `;

  const dataRows = withData.map(z => {
    const pct = Math.max((z.ndvi / max) * 100, 4);
    const cls = z.ndvi >= 0.6 ? "healthy" : z.ndvi >= 0.3 ? "moderate" : "degraded";
    return `
      <div class="hbar-row">
        <span class="hbar-label" title="${escapeHtml(z.name)}">${escapeHtml(z.name)}</span>
        <div class="hbar-track">
          <div class="hbar-fill ${cls}" style="--pct:${pct.toFixed(1)}%"></div>
        </div>
        <span class="hbar-value">${formatNdvi(z.ndvi)}</span>
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

const AQUAFARM_RISK_CLASS = { high: "degraded", moderate: "moderate", low: "healthy", none: "pending" };
const AQUAFARM_RISK_LABEL = { high: "High", moderate: "Moderate", low: "Low", none: "None" };

function renderAquafarmRiskChart(zones) {
  const rows = zones
    .map(z => ({ zone: z, reg: AQUAFARM_REGISTRY[z.id] }))
    .filter(r => r.reg)
    .sort((a, b) => b.reg.activeHectares - a.reg.activeHectares);

  if (rows.length === 0) {
    return `<div class="dashboard-empty">No aquafarm registry data available.</div>`;
  }

  const max = Math.max(...rows.map(r => r.reg.activeHectares), 0.1);

  const legend = `
    <div class="hbar-legend">
      <span><span class="hbar-legend-dot degraded"></span>High</span>
      <span><span class="hbar-legend-dot moderate"></span>Moderate</span>
      <span><span class="hbar-legend-dot healthy"></span>Low</span>
      <span><span class="hbar-legend-dot pending"></span>None</span>
    </div>
  `;

  const dataRows = rows.map(({ zone, reg }) => {
    const pct = Math.max((reg.activeHectares / max) * 100, 4);
    const cls = AQUAFARM_RISK_CLASS[reg.risk] || "pending";
    const valueText = reg.activeCount > 0
      ? `${reg.activeCount} farm${reg.activeCount !== 1 ? "s" : ""} · ${reg.activeHectares.toFixed(1)} ha`
      : "No active farms";
    return `
      <div class="hbar-row" title="${escapeHtml(reg.note || "")}">
        <span class="hbar-label" title="${escapeHtml(zone.name)}">${escapeHtml(zone.name)}</span>
        <div class="hbar-track">
          <div class="hbar-fill ${cls}" style="--pct:${pct.toFixed(1)}%"></div>
        </div>
        <span class="hbar-value">${valueText}</span>
      </div>
    `;
  }).join("");

  const footnote = `<div class="hbar-footnote">Source: MENRO Updated List of Fishponds in Calatagan, 2026. Excludes farms marked "Stop operation."</div>`;

  return `${legend}<div class="hbar-chart">${dataRows}</div>${footnote}`;
}

function renderBreakdownBarChart(breakdown, emptyText, fillClass = "threat-fill") {
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
          <div class="hbar-fill ${fillClass}" style="--pct:${pct.toFixed(1)}%"></div>
        </div>
        <span class="hbar-value">${t.count}</span>
      </div>
    `;
  }).join("");

  return `<div class="hbar-chart">${rows}</div>`;
}

function renderSpeciesBarChart(speciesBreakdown) {
  return renderBreakdownBarChart(speciesBreakdown, "No species recorded in field surveys yet.", "threat-fill");
}

function renderCanopyTrendChart(canopyTrend, suffix = "%") {
  const points = canopyTrend.filter(p => p.avg !== null);
  if (points.length < 2) {
    return `<div class="dashboard-empty">Not enough scene dates yet to plot a trend.</div>`;
  }

  const padL = 46, padR = 20, padT = 30, padB = 34;
  const h = 220;
  const innerH = h - padT - padB;

  const slotWidth = 88;
  const innerW = Math.min(Math.max(points.length * slotWidth, 320), 620);
  const w = innerW + padL + padR;

  const rawMax = Math.max(...points.map(p => p.avg));
  const minV = 0;
  const maxV = rawMax + Math.max(rawMax * 0.18, 3);

  const baseline = padT + innerH;
  const slot = innerW / points.length;
  const barWidth = Math.min(slot * 0.6, 48);

  const xCenter = i => padL + slot * i + slot / 2;
  const y = v => padT + innerH - ((v - minV) / (maxV - minV)) * innerH;

  const gridSteps = 4;
  const gridLines = Array.from({ length: gridSteps + 1 }).map((_, i) => {
    const v  = minV + ((maxV - minV) * i) / gridSteps;
    const gy = y(v);
    return `
      <line x1="${padL}" y1="${gy.toFixed(1)}" x2="${w - padR}" y2="${gy.toFixed(1)}" stroke="#eef4f0" stroke-width="1"/>
      <text x="${padL - 8}" y="${(gy + 3).toFixed(1)}" font-size="9.5" fill="#869790" text-anchor="end" font-family="'JetBrains Mono', monospace">${v.toFixed(0)}${suffix}</text>
    `;
  }).join("");

  const bars = points.map((p, i) => {
    const cx = xCenter(i);
    const barTop = y(p.avg);
    const barH = Math.max(baseline - barTop, 2);
    return `<rect x="${(cx - barWidth / 2).toFixed(1)}" y="${barTop.toFixed(1)}" width="${barWidth.toFixed(1)}" height="${barH.toFixed(1)}" rx="6" fill="url(#ndviBarFill)"/>`;
  }).join("");

  const showEveryValue = barWidth >= 26;
  const valueLabels = points.map((p, i) => {
    if (!showEveryValue && i !== points.length - 1) return "";
    const barTop = y(p.avg);
    return `<text x="${xCenter(i).toFixed(1)}" y="${(barTop - 7).toFixed(1)}" font-size="9.5" font-weight="700" fill="#0a3128" text-anchor="middle" font-family="'JetBrains Mono', monospace">${p.avg.toFixed(0)}${suffix}</text>`;
  }).join("");

  const maxLabels = Math.max(Math.floor(innerW / 50), 3);
  const labelStep = points.length > maxLabels ? Math.ceil(points.length / maxLabels) : 1;
  const labels = points.map((p, i) => {
    if (labelStep > 1 && i % labelStep !== 0 && i !== points.length - 1) return "";
    const d = new Date(p.date);
    const label = isNaN(d.getTime()) ? p.date : d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
    return `<text x="${xCenter(i).toFixed(1)}" y="${h - 10}" font-size="9.5" fill="#869790" text-anchor="middle">${label}</text>`;
  }).join("");

  return `
    <svg viewBox="0 0 ${w} ${h}" class="trend-svg" preserveAspectRatio="xMidYMid meet" style="width:auto; max-width:${w}px; aspect-ratio:${w} / ${h}; margin:0 auto;">
      <defs>
        <linearGradient id="ndviBarFill" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stop-color="#3f9b7a"/>
          <stop offset="100%" stop-color="#1c7d61"/>
        </linearGradient>
      </defs>
      ${gridLines}
      <line x1="${padL}" y1="${baseline.toFixed(1)}" x2="${w - padR}" y2="${baseline.toFixed(1)}" stroke="#c7d4cd" stroke-width="1"/>
      ${bars}
      ${valueLabels}
      ${labels}
    </svg>
  `;
}

function renderCalendarWidget() {
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
    const isFuture = iso > todayIso;

    const classes = ["cal-day"];
    if (!inMonth) classes.push("outside");
    if (count > 0) classes.push("has-data");
    if (iso === dashboardSelectedDate) classes.push("selected");
    if (iso === todayIso) classes.push("today");
    if (isFuture) classes.push("future");

    return `
      <button type="button" class="${classes.join(" ")}" data-date="${iso}" ${isFuture ? "disabled" : ""}
        aria-label="${formatDate(iso)}, ${count} survey${count !== 1 ? "s" : ""}">
        <span class="cal-day-num">${d.getDate()}</span>
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
      <span><span class="cal-legend-swatch"></span> Selected</span>
    </div>
  `;
}

function renderDateSelector() {
  if (dashboardCalendarYear === null || dashboardCalendarMonth === null) {
    return `<div class="dashboard-empty">No field survey submissions recorded yet.</div>`;
  }
  return `<div class="survey-calendar">${renderCalendarWidget()}</div>`;
}

function shiftCalendarMonth(dir) {
  dashboardCalendarMonth += dir;
  if (dashboardCalendarMonth < 0)  { dashboardCalendarMonth = 11; dashboardCalendarYear--; }
  if (dashboardCalendarMonth > 11) { dashboardCalendarMonth = 0;  dashboardCalendarYear++; }

  renderDatePicker();
}

function renderDatePicker() {
  const el = document.getElementById("dashboardDatePicker");
  if (!el) return;
  el.innerHTML = renderDateSelector();
}

function renderSurveyLogCard(sub) {
  const areaRaw = sub["Protected_area_Zone"] || sub["Barangay"] || "";
  const zoneId  = sub["_zone_id"] || zoneIdFromProtectedArea(areaRaw) || BARANGAY_TO_ZONE[areaRaw];
  const zone    = ZONES.find(z => z.id === zoneId);
  const aquafarmRaw  = (sub["Nearby_aquafarm_activity"] || sub["Nearby_Aquafarm_Activity"] || "").toLowerCase();
  const hasAquafarm  = aquafarmRaw === "yes" || aquafarmRaw.startsWith("active");
  const summary = summarizeKoboTrees(koboExtractTrees(sub));

  return `
    <tr>
      <td class="survey-log-zone-cell">${escapeHtml(zone ? zone.name : (sub["_zone_name"] || areaRaw || "Unknown zone").replace(/_/g, " "))}</td>
      <td>${escapeHtml(sub["Ranger_Name"] || "—")}</td>
      <td class="cell-center">${summary.count || "—"}</td>
      <td>${escapeHtml(summary.speciesList.length ? summary.speciesList.join(", ") : "—")}</td>
      <td class="cell-center"><span class="threat-tag ${hasAquafarm ? "flagged" : "none"}">${hasAquafarm ? "Aquafarm nearby" : "No aquafarm nearby"}</span></td>
    </tr>
  `;
}

function setText(id, text) {
  const el = document.getElementById(id);
  if (el) el.textContent = text;
}

function renderDashboardHeader(s) {
  setText("dashboardSummaryDate", `Summary as of ${dashboardSelectedDate ? formatDate(dashboardSelectedDate) : "—"}`);

  const dot    = document.getElementById("dashboardLatestDot");
  const latest = document.getElementById("dashboardLatestInspection");
  if (s.latestDate) {
    if (dot)    dot.hidden = false;
    if (latest) { latest.hidden = false; latest.textContent = `Latest field inspection ${formatDate(s.latestDate)}`; }
  } else {
    if (dot)    dot.hidden = true;
    if (latest) { latest.hidden = true; latest.textContent = ""; }
  }
}

function renderStatCards(s) {
  setText("statTotalZonesValue", s.total);
  setText("statTotalZonesHint", s.pending > 0 ? `${s.pending} zone${s.pending !== 1 ? "s" : ""} awaiting data` : `Across ${s.total} protected areas`);

  setText("statHealthyValue", s.healthy);
  setText("statHealthyHint", `${s.total ? Math.round((s.healthy / s.total) * 100) : 0}% of total`);

  setText("statModerateValue", s.moderate);
  setText("statModerateHint", `${s.total ? Math.round((s.moderate / s.total) * 100) : 0}% of total`);

  setText("statDegradedValue", s.degraded);
  setText("statDegradedHint", `${s.total ? Math.round((s.degraded / s.total) * 100) : 0}% of total`);

  setText("statAvgNdviValue", formatNdvi(s.avgNdvi));

  setText("statLatestInspectionValue", s.latestDate ? formatDate(s.latestDate) : "—");
}

function renderWeekSubmissions(weekRangeObj) {
  const headEl     = document.getElementById("weekSummaryHead");
  const cardsEl    = document.getElementById("weekSummaryCards");
  const emptyWeekEl = document.getElementById("weekSummaryEmpty");
  const noDatesEl  = document.getElementById("noSurveyDatesEmpty");
  if (!headEl || !cardsEl || !emptyWeekEl || !noDatesEl) return;

  if (!weekRangeObj) {
    headEl.hidden = true;
    cardsEl.innerHTML = "";
    emptyWeekEl.hidden = true;
    noDatesEl.hidden = false;
    return;
  }

  noDatesEl.hidden = true;
  headEl.hidden = false;

  const weekSubs = submissionsInRange(weekRangeObj.start, weekRangeObj.end)
    .sort((a, b) => koboSubmissionDate(a).localeCompare(koboSubmissionDate(b)));

  const rangeLabel = weekRangeObj.start.slice(0, 7) === weekRangeObj.end.slice(0, 7)
    ? `${formatDate(weekRangeObj.start)} – ${new Date(weekRangeObj.end + "T00:00:00").toLocaleDateString("en-US", { day: "numeric" })}, ${weekRangeObj.end.slice(0, 4)}`
    : `${formatDate(weekRangeObj.start)} – ${formatDate(weekRangeObj.end)}`;

  setText("weekSummaryRange", rangeLabel);
  setText("weekSummaryCount", `${weekSubs.length} survey${weekSubs.length !== 1 ? "s" : ""} gathered this week`);

  if (weekSubs.length > 0) {
    cardsEl.innerHTML = weekSubs.map(renderSurveyLogCard).join("");
    emptyWeekEl.hidden = true;
  } else {
    cardsEl.innerHTML = "";
    emptyWeekEl.hidden = false;
  }
}

function bindDashboardControls() {
  const datePicker = document.getElementById("dashboardDatePicker");
  if (datePicker && !datePicker.dataset.bound) {
    datePicker.dataset.bound = "true";
    datePicker.addEventListener("click", (e) => {
      const dayBtn = e.target.closest(".cal-day");
      if (dayBtn) {
        dashboardSelectedDate = dayBtn.dataset.date;
        renderDashboard();
        syncDashboardSatelliteNdvi();
        return;
      }
      if (e.target.closest("#calPrevMonth")) { shiftCalendarMonth(-1); return; }
      if (e.target.closest("#calNextMonth")) { shiftCalendarMonth(1); return; }
    });
  }
}

function renderDashboard() {
  // dashboardBody is a static empty shell that's always in the page, even
  // before the Dashboard tab has ever been opened — its charts (like
  // healthDonutChart/ndviBarChart below) only actually exist once
  // ensureDashboardMarkup() has fetched and injected Dashboard.php's markup
  // into it. Rendering before that (e.g. a background refresh triggered
  // while still on the Map tab) would otherwise crash on a null element.
  if (!dashboardMarkupLoaded) return;

  ensureDashboardSelectedDate();

  const s = computeDashboardStats(dashboardSelectedDate);
  const hasSurveyDates = availableSurveyDates().length > 0;
  const weekRangeObj = hasSurveyDates ? weekRange(dashboardSelectedDate) : null;

  renderDashboardHeader(s);
  renderStatCards(s);
  renderDatePicker();
  document.getElementById("healthDonutChart").innerHTML = renderHealthDonut(s.healthy, s.moderate, s.degraded, s.pending);
  document.getElementById("ndviBarChart").innerHTML     = renderNDVIBarChart(s.zoneSnapshot);
  renderWeekSubmissions(weekRangeObj);

  bindDashboardControls();
}

const mapView       = document.getElementById("mapView");
const dashboardView = document.getElementById("dashboardView");

let dashboardMarkupLoaded = false;

async function ensureDashboardMarkup() {
  if (dashboardMarkupLoaded) return;
  const body = document.getElementById("dashboardBody");
  if (!body) return;

  const res = await fetch("Dashboard.php", { cache: "no-store" });
  body.innerHTML = await res.text();
  dashboardMarkupLoaded = true;
}

let dashboardSatelliteSyncInProgress = false;

// Fetches real Sentinel-2 NDVI (via map-core.js's fetchZoneNdviFromCopernicus) for every
// zone that has coordinates, then re-renders the dashboard so the NDVI chart shows actual
// satellite data instead of staying blank. Zones without lat/lng yet are skipped.
async function syncDashboardSatelliteNdvi() {
  if (dashboardSatelliteSyncInProgress) return;
  if (typeof fetchZoneNdviFromCopernicus !== "function") return;
  dashboardSatelliteSyncInProgress = true;

  const dateStr = dashboardSelectedDate || todayISO();
  const zonesWithCoords = ZONES.filter(z => z.lat != null && z.lng != null);

  // Written to zone.dashboardNdvi, not zone.satNdvi — the map/sidebar has its
  // own Scene Calendar date and keeps its own NDVI value in zone.satNdvi;
  // sharing one field between the two meant whichever view synced last would
  // silently overwrite the other's number, even though they're for different dates.
  const batchSize = (typeof NDVI_SYNC_BATCH_SIZE === "number") ? NDVI_SYNC_BATCH_SIZE : 3;
  for (let i = 0; i < zonesWithCoords.length; i += batchSize) {
    const batch = zonesWithCoords.slice(i, i + batchSize);
    await Promise.all(batch.map(async zone => {
      zone.dashboardNdvi = await fetchZoneNdviFromCopernicus(zone, dateStr);
    }));
    if (i + batchSize < zonesWithCoords.length) await sleep(NDVI_SYNC_BATCH_DELAY_MS || 400);
  }

  dashboardSatelliteSyncInProgress = false;
  renderDashboard();
}

async function switchTab(tab) {
  const toDashboard = tab === "dashboard";

  if (mapView)       mapView.style.display = toDashboard ? "none" : "flex";
  if (dashboardView) dashboardView.classList.toggle("active", toDashboard);

  const menuMapEl = document.getElementById("menuMap");
  const menuDashboardEl = document.getElementById("menuDashboard");
  if (menuMapEl) menuMapEl.classList.toggle("active", !toDashboard);
  if (menuDashboardEl) menuDashboardEl.classList.toggle("active", toDashboard);

  if (toDashboard) {
    await ensureDashboardMarkup();
    renderDashboard();
    syncDashboardSatelliteNdvi();
  } else if (typeof map !== "undefined" && map.invalidateSize) {
    setTimeout(() => map.invalidateSize(), 0);
  }
}

function openDashboard() {
  switchTab("dashboard");
}
function closeDashboard() { switchTab("map"); }
