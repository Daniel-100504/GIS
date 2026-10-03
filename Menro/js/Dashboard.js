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
        lastInspectedDate: null,
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
      lastInspectedDate: koboSubmissionDate(sub) || null,
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

let pendingDetailKoboId = null;

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

function submissionsOnDate(dateStr) {
  return ALL_SUBMISSIONS.filter(sub => koboSubmissionDate(sub) === dateStr);
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

  // Switching month should move the whole "Summary as of" snapshot to that
  // month too, not just redraw the calendar grid — the last day of the
  // newly-shown month gives the clearest "state at the end of that month"
  // reading, matching what clicking a specific day already does.
  const lastDayOfMonth = new Date(dashboardCalendarYear, dashboardCalendarMonth + 1, 0);
  dashboardSelectedDate = isoDate(lastDayOfMonth);

  renderDashboard();
  syncDashboardSatelliteNdvi();
}

function renderDatePicker() {
  const el = document.getElementById("dashboardDatePicker");
  if (!el) return;
  el.innerHTML = renderDateSelector();
}

const SURVEY_STATUS_TAG = {
  healthy:  { cls: "good",    label: "Good" },
  moderate: { cls: "fair",    label: "Fair" },
  degraded: { cls: "flagged", label: "Poor" },
  pending:  { cls: "none",    label: "Pending" },
};

// An active aquafarm only actually threatens the mangrove zone once it's
// discharging into it — an aquafarm sitting there with no visible discharge
// (or inactive, or none nearby at all) isn't a problem, so only the real
// discharge case gets the red "flagged" treatment. Everything else reads as
// neutral, informational status instead of a false alarm.
const AQUAFARM_TAG = {
  active___discharge_observed: { cls: "flagged", label: "Aquafarm discharge observed" },
  active___no_visible_discharge: { cls: "none", label: "Active — no discharge" },
  inactive:                      { cls: "none", label: "Inactive" },
  none_nearby:                   { cls: "none", label: "No aquafarm nearby" },
  no:                            { cls: "none", label: "No aquafarm nearby" },
};

// "Nearby aquafarm activity" alone no longer implies discharge — that's now
// its own separate follow-up question (Discharge_Toward_Mangroves), so an
// aquafarm being present only counts as the flagged, red "discharge" status
// once that follow-up actually confirms discharge flowing toward the
// mangroves. A plain "Yes" with no confirmed discharge reads as neutral.
function aquafarmTag(raw, dischargeRaw) {
  const v = (raw || "").toString().toLowerCase();
  if (v === "yes") {
    const d = (dischargeRaw || "").toString().toLowerCase();
    return d === "yes"
      ? { cls: "flagged", label: "Aquafarm discharge observed" }
      : { cls: "none", label: "Aquafarm nearby" };
  }
  return AQUAFARM_TAG[v] || { cls: "none", label: v ? prettifyNotifValue(v) : "No aquafarm nearby" };
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

// One row per ranger who has ever submitted a survey, with how many
// submissions they have and when the most recent one was — the entry point
// for drilling into everything a specific ranger has answered.
function rangerSummaries(asOfDate) {
  const subs = asOfDate ? submissionsUpToDate(asOfDate) : ALL_SUBMISSIONS;
  const byName = new Map();
  subs.forEach(sub => {
    const name = (sub["Ranger_Name"] || "").trim();
    if (!name) return;
    const date = koboSubmissionDate(sub);
    const existing = byName.get(name);
    if (existing) {
      existing.count += 1;
      if (date && (!existing.lastDate || date > existing.lastDate)) existing.lastDate = date;
    } else {
      byName.set(name, { name, count: 1, lastDate: date || "" });
    }
  });
  return [...byName.values()].sort((a, b) => a.name.localeCompare(b.name));
}

function submissionsByRangerName(name) {
  const target = name.trim().toLowerCase();
  return ALL_SUBMISSIONS.filter(sub => (sub["Ranger_Name"] || "").trim().toLowerCase() === target);
}

function renderRangersSection() {
  const body = document.getElementById("rangersTableBody");
  const empty = document.getElementById("rangersEmpty");
  if (!body || !empty) return;

  const rangers = rangerSummaries(dashboardSelectedDate);
  if (rangers.length === 0) {
    body.innerHTML = "";
    empty.hidden = false;
    return;
  }

  empty.hidden = true;
  body.innerHTML = rangers.map(r => `
    <tr class="row-clickable" data-ranger="${escapeHtml(r.name)}">
      <td class="survey-log-zone-cell">${escapeHtml(r.name)}</td>
      <td class="cell-center">${r.count}</td>
      <td>${formatDate(r.lastDate)}</td>
    </tr>
  `).join("");
}

function renderRangerSubmissionRow(sub) {
  const areaRaw = sub["Protected_area_Zone"] || sub["Barangay"] || "";
  const zoneId  = sub["_zone_id"] || zoneIdFromProtectedArea(areaRaw) || BARANGAY_TO_ZONE[areaRaw];
  const zone    = ZONES.find(z => z.id === zoneId);
  const aquafarmRaw  = (sub["Nearby_aquafarm_activity"] || sub["Nearby_Aquafarm_Activity"] || "").toLowerCase();
  const dischargeRaw = (sub["Discharge_Toward_Mangroves"] || sub["Discharge_toward_mangroves"] || "").toLowerCase();
  const aquafarmInfo = aquafarmTag(aquafarmRaw, dischargeRaw);
  const statusTag = SURVEY_STATUS_TAG[deriveStatus(sub)] || SURVEY_STATUS_TAG.pending;
  const summary = summarizeKoboTrees(koboExtractTrees(sub), sub);

  return `
    <tr class="row-clickable" data-kobo-id="${escapeHtml(String(sub["_id"] || ""))}">
      <td>${formatDate(koboSubmissionDate(sub))}</td>
      <td class="survey-log-zone-cell" title="${escapeHtml(zone ? zone.name : (sub["_zone_name"] || areaRaw || "Unknown zone").replace(/_/g, " "))}">${escapeHtml(zone ? zone.name : (sub["_zone_name"] || areaRaw || "Unknown zone").replace(/_/g, " "))}</td>
      <td class="cell-center">${summary.count || "—"}</td>
      <td class="cell-truncate" title="${escapeHtml(summary.speciesList.length ? summary.speciesList.join(", ") : "—")}">${escapeHtml(summary.speciesList.length ? summary.speciesList.join(", ") : "—")}</td>
      <td class="cell-center"><span class="threat-tag ${aquafarmInfo.cls}">${escapeHtml(aquafarmInfo.label)}</span></td>
      <td class="cell-center"><span class="threat-tag ${statusTag.cls}">${statusTag.label}</span></td>
    </tr>
  `;
}

function openRangerSubmissionsModal(name) {
  const overlay = document.getElementById("rangerSubmissionsOverlay");
  const titleEl = document.getElementById("rangerSubmissionsTitle");
  const subEl   = document.getElementById("rangerSubmissionsSub");
  const bodyEl  = document.getElementById("rangerSubmissionsBody");
  const emptyEl = document.getElementById("rangerSubmissionsEmpty");
  if (!overlay || !bodyEl || !emptyEl) return;

  const subs = submissionsByRangerName(name)
    .sort((a, b) => (koboSubmissionDate(b) || "").localeCompare(koboSubmissionDate(a) || ""));

  if (titleEl) titleEl.textContent = name;
  if (subEl) subEl.textContent = `${subs.length} submission${subs.length !== 1 ? "s" : ""}`;

  if (subs.length > 0) {
    bodyEl.innerHTML = subs.map(renderRangerSubmissionRow).join("");
    emptyEl.hidden = true;
  } else {
    bodyEl.innerHTML = "";
    emptyEl.hidden = false;
  }

  overlay.classList.add("open");
}

function closeRangerSubmissionsModal() {
  const overlay = document.getElementById("rangerSubmissionsOverlay");
  if (overlay) overlay.classList.remove("open");
}

// Full per-submission breakdown, opened from a row in the ranger
// submissions modal — same section layout (Site Information / Vegetation /
// Fauna / Water Quality) as the ranger app's own "Field submission details"
// popup, just built from the raw record instead of a normalized one.
function viewField(label, value, opts = {}) {
  const isEmpty = value === null || value === undefined || value === "";
  const display = isEmpty ? "—" : escapeHtml(String(value));
  const cls = `view-field${opts.full ? " view-field-full" : ""}`;
  return `<div class="${cls}"><span class="view-label">${escapeHtml(label)}</span><span class="view-value${isEmpty ? " muted" : ""}">${display}</span></div>`;
}

// .view-grid is a 3-column grid — a row left with only 1 or 2 real fields
// has no element in its last column(s), so nothing paints a border there and
// the grid looks cut off. Blank filler cells close out that row so every row
// looks complete regardless of how many real fields it has.
function viewGridPad(fieldCount) {
  const remainder = fieldCount % 3;
  if (remainder === 0) return "";
  return '<div class="view-field view-field-blank"></div>'.repeat(3 - remainder);
}

// Same shape as viewField, but for a value that's already-built HTML (a
// colored status badge) instead of plain text that needs escaping.
function viewFieldHtml(label, html, opts = {}) {
  const cls = `view-field${opts.full ? " view-field-full" : ""}`;
  return `<div class="${cls}"><span class="view-label">${escapeHtml(label)}</span><span class="view-value">${html}</span></div>`;
}

function viewEmptyNote(text) {
  return `<p class="view-empty-note">${escapeHtml(text)}</p>`;
}

const HEALTH_BADGE_CLS = { healthy: "badge-healthy", moderate: "badge-moderate", degraded: "badge-degraded" };

// Observed Threats are checked off from a fixed set of plain slugs — the
// same label lookup the ranger's own survey form uses, so a submission
// reads identically whichever side it's seen from.
const OBSERVED_THREAT_LABELS = {
  none_observed: "None observed",
  charcoal_making: "Charcoal making",
  cutting: "Cutting",
  dieback: "Dieback",
  pests: "Pests",
  garbage: "Garbage",
  erosion: "Erosion",
  land_conversion: "Land conversion",
  encroachment: "Encroachment",
  illegal_fishing: "Illegal fishing",
  sand_gravel_extraction: "Sand / gravel extraction",
  siltation: "Siltation",
  storm_damage: "Storm damage",
  fire: "Fire",
  "pollution___oil_spill": "Pollution / oil spill",
};
function observedThreatsDisplay(raw, otherText) {
  if (!raw) return null;
  const values = String(raw).split(",").map(s => s.trim()).filter(Boolean);
  if (values.length === 0) return null;
  return values.map((v) => {
    if (v === "__other__") return otherText || "Other";
    return OBSERVED_THREAT_LABELS[v] || prettifyNotifValue(v) || v;
  }).join(", ");
}

const VIEW_SECTION_ICONS = {
  site: '<path d="M12 22s8-9 8-14a8 8 0 1 0-16 0c0 5 8 14 8 14Z"/><circle cx="12" cy="8" r="3"/>',
  vegetation: '<path d="M12 22V12"/><path d="M12 12C12 6.5 8 4 4 4c0 5 2.5 8 8 8Z"/><path d="M12 12c0-4.5 3-7 8-7 0 4.5-2 7-8 7Z"/>',
  fauna: '<circle cx="12" cy="12" r="4"/><path d="M12 8V4"/><path d="M12 20v-4"/><path d="M4.93 4.93l2.83 2.83"/><path d="M16.24 16.24l2.83 2.83"/><path d="M2 12h4"/><path d="M18 12h4"/><path d="M4.93 19.07l2.83-2.83"/><path d="M16.24 7.76l2.83-2.83"/>',
  water: '<path d="M12 2.69s6 7.34 6 11.31a6 6 0 1 1-12 0c0-3.97 6-11.31 6-11.31z"/>',
};

function viewSection(icon, title, innerHtml) {
  const iconSvg = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${VIEW_SECTION_ICONS[icon] || ""}</svg>`;
  return `<div class="view-section"><div class="view-section-title"><span class="view-section-icon">${iconSvg}</span>${escapeHtml(title)}</div><div class="view-section-body">${innerHtml}</div></div>`;
}

// Every zone in AquaGuard is already a designated mangrove area, so a plain
// "protected or not" label would say the same thing for all of them. What
// actually varies is the kind of designation named right in the zone's own
// title — a Conservation Park, a Rehabilitation Project, an explicitly
// named Protected Area, or (for the numbered zones with no special
// designation yet) a plain Mangrove Area.
function zoneTypeLabel(zoneName) {
  if (!zoneName) return null;
  const n = zoneName.toLowerCase();
  if (n.includes("conservation park")) return "Conservation Park";
  if (n.includes("rehabilitation")) return "Rehabilitation Project";
  if (n.includes("protected area")) return "Protected Area";
  return "Mangrove Area";
}

function healthAssessmentLabel(raw) {
  switch ((raw || "").toString().toLowerCase()) {
    case "healthy":  return "Good";
    case "moderate": return "Fair";
    case "degraded": return "Poor";
    default:         return raw ? prettifyNotifValue(raw) : null;
  }
}

function renderApprovalStatus(sub) {
  const el = document.getElementById("submissionDetailApproval");
  if (!el) return;
  const status = sub["_approval_status"] || "pending";
  const labels = { pending: "Pending review", approved: "Approved", rejected: "Needs revision" };
  let text = labels[status] || labels.pending;
  if (status === "rejected" && sub["_review_notes"]) text += `: "${sub["_review_notes"]}"`;
  el.textContent = text;
  el.className = `submission-detail-approval ${status === "pending" ? "" : status}`.trim();
}

function openSubmissionDetailModal(sub) {
  // Opening this from a notification (which can happen before the Dashboard
  // tab — and its own bindRangersSection() call — has ever run) still needs
  // the close/approve/reject buttons wired up; the guard flags inside it
  // make calling it again here a no-op everywhere else.
  bindRangersSection();
  hideRejectNotesPanel();

  const overlay = document.getElementById("submissionDetailOverlay");
  const subEl   = document.getElementById("submissionDetailSub");
  const badgeEl = document.getElementById("submissionDetailBadge");
  const bodyEl  = document.getElementById("submissionDetailBody");
  if (!overlay || !bodyEl) return;

  pendingDetailKoboId = sub["_id"];
  renderApprovalStatus(sub);

  const areaRaw = sub["Protected_area_Zone"] || sub["Barangay"] || "";
  const zoneId  = sub["_zone_id"] || zoneIdFromProtectedArea(areaRaw) || BARANGAY_TO_ZONE[areaRaw];
  const zone    = ZONES.find(z => z.id === zoneId);
  const zoneName = zone ? zone.name : (sub["_zone_name"] || areaRaw || "Unknown zone").replace(/_/g, " ");

  if (subEl) subEl.textContent = `${zoneName} · ${formatDate(koboSubmissionDate(sub))}`;

  const statusTag = SURVEY_STATUS_TAG[deriveStatus(sub)] || SURVEY_STATUS_TAG.pending;
  if (badgeEl) {
    badgeEl.className = `threat-tag ${statusTag.cls}`;
    badgeEl.textContent = statusTag.label;
  }

  const siteFields = [
    viewField("Date of visit", formatDate(koboSubmissionDate(sub))),
    viewField("Nearest mangrove zone", zoneName),
    viewField("Zone type", zoneTypeLabel(zoneName)),
  ].join("");

  // Mirrors the ranger's own Submission History "View" popup — same 3
  // numbered Vegetation groups (Canopy / Species Found in Plot / Overall
  // Health), so a submission reads identically on both sides.
  const trees = koboExtractTrees(sub);
  const canopyHtml = `<p class="view-subsection-label">Canopy</p><div class="view-grid">${viewField("Canopy cover (%)", sub["Estimated_Canopy_Cover_"] || null)}${viewGridPad(1)}</div>`;

  const realTrees = trees.filter(t => koboTreeField(t, "Species_Name") || koboTreeField(t, "Species"));
  const speciesTableHtml = realTrees.length
    ? `<div class="view-table-wrap"><table class="view-species-table">
        <thead><tr><th>Species</th><th>Trees</th><th>Saplings</th><th>Seedlings</th></tr></thead>
        <tbody>${realTrees.map(t => `<tr><td>${escapeHtml(koboTreeField(t, "Species_Name") || koboTreeField(t, "Species") || "—")}</td><td>${escapeHtml(koboTreeField(t, "Tree_Count") ?? "—")}</td><td>${escapeHtml(koboTreeField(t, "Sapling_Count") ?? koboTreeField(t, "Sapling_count") ?? "—")}</td><td>${escapeHtml(koboTreeField(t, "Seedling_Count") ?? koboTreeField(t, "Seedling_count") ?? "—")}</td></tr>`).join("")}</tbody>
      </table></div>`
    : viewEmptyNote("No species recorded.");
  const speciesSectionHtml = `<p class="view-subsection-label">Species Found in Plot</p>${speciesTableHtml}`;

  const healthRaw = (sub["Overall_Health_Assessment"] || "").toLowerCase();
  const healthBadgeCls = HEALTH_BADGE_CLS[healthRaw];
  const healthFieldHtml = healthBadgeCls
    ? viewFieldHtml("Overall health assessment", `<span class="view-badge ${healthBadgeCls}">${escapeHtml(healthAssessmentLabel(sub["Overall_Health_Assessment"]))}</span>`)
    : viewField("Overall health assessment", null);
  const healthHtml = `<p class="view-subsection-label">Overall Health</p><div class="view-grid">${healthFieldHtml}${viewGridPad(1)}</div>`;

  const vegetationHtml = `${canopyHtml}${speciesSectionHtml}${healthHtml}`;

  // Mirrors the ranger's own Fauna groups (Mollusks Found / Observed
  // Threats / Additional Notes / Photos).
  const mollusks = koboExtractMollusks(sub);
  const molluskTableHtml = mollusks.length
    ? `<div class="view-table-wrap"><table class="view-species-table">
        <thead><tr><th>Species</th></tr></thead>
        <tbody>${mollusks.map(m => `<tr><td>${escapeHtml(koboTreeField(m, "Mollusk_Species_Name") || koboTreeField(m, "Mollusk_species_name") || "—")}</td></tr>`).join("")}</tbody>
      </table></div>`
    : viewEmptyNote("No mollusks recorded.");
  const molluskSectionHtml = `<p class="view-subsection-label">Mollusks Found</p>${molluskTableHtml}`;

  const threatsHtml = `<p class="view-subsection-label">Observed Threats</p><div class="view-grid">${viewField("Observed threats", observedThreatsDisplay(sub["Observed_Threats"], sub["Observed_Threats_Other"]), { full: true })}</div>`;

  const notesHtml = `<p class="view-subsection-label">Additional Notes</p>${sub["Additional_Notes"] ? `<div class="view-notes">${escapeHtml(sub["Additional_Notes"])}</div>` : viewEmptyNote("No additional notes.")}`;

  const photosHtml = `<p class="view-subsection-label">Photos</p>${sub["Photo_Documentation"] ? `<div class="view-photos"><a href="${escapeHtml(sub["Photo_Documentation"])}" target="_blank" rel="noopener"><img class="view-photo-thumb" src="${escapeHtml(sub["Photo_Documentation"])}" alt="Field photo" /></a></div>` : viewEmptyNote("No photos attached.")}`;

  const faunaHtml = `${molluskSectionHtml}${threatsHtml}${notesHtml}${photosHtml}`;

  // Mirrors the ranger's own Water Quality groups (Observations / Aquafarm /
  // Instrument Readings / Notes).
  const aquafarmRaw = sub["Nearby_Aquafarm_Activity"] || sub["Nearby_aquafarm_activity"] || "";
  const dischargeRawWQ = sub["Discharge_Toward_Mangroves"] || sub["Discharge_toward_mangroves"] || "";
  const observationsFields = [
    viewField("Water clarity", sub["Water_Clarity"] ? prettifyNotifValue(sub["Water_Clarity"]) : null),
    viewField("Water color", sub["Water_Color"] ? prettifyNotifValue(sub["Water_Color"]) : null),
    viewField("Odor", sub["Odor"] ? prettifyNotifValue(sub["Odor"]) : null),
    viewField("Visible foam or discharge", sub["Visible_Foam_or_Discharge"] ? prettifyNotifValue(sub["Visible_Foam_or_Discharge"]) : null),
  ];
  const observationsHtml = `<p class="view-subsection-label">Observations</p><div class="view-grid">${observationsFields.join("")}${viewGridPad(observationsFields.length)}</div>`;

  const aquafarmFields = [viewField("Nearby aquafarm activity", aquafarmRaw ? prettifyNotifValue(aquafarmRaw) : null)];
  if (aquafarmRaw.toLowerCase() === "yes") {
    const aqLat = sub["Aquafarm_Location_Lat"];
    const aqLng = sub["Aquafarm_Location_Lng"];
    aquafarmFields.push(
      viewField("Aquafarm name", sub["Aquafarm_Name"] || null),
      viewField("Aquafarm location", (aqLat && aqLng) ? `${parseFloat(aqLat).toFixed(5)}, ${parseFloat(aqLng).toFixed(5)}` : null),
      viewField("Distance to mangroves (m)", sub["Aquafarm_Distance_m"] || null),
      viewField("Discharge flowing toward mangroves?", dischargeRawWQ ? prettifyNotifValue(dischargeRawWQ) : null)
    );
  }
  const aquafarmHtml = `<p class="view-subsection-label">Aquafarm</p><div class="view-grid">${aquafarmFields.join("")}${viewGridPad(aquafarmFields.length)}</div>`;

  const hasInstrumentValues = sub["Salinity_ppt"] || sub["PH"] || sub["Water_Temperature_C"] || sub["Secchi_Depth_cm"];
  const instrumentHtml = hasInstrumentValues
    ? `<p class="view-subsection-label">Instrument Readings</p><div class="view-grid">${[
        viewField("Salinity (ppt)", sub["Salinity_ppt"] || null),
        viewField("pH", sub["PH"] || null),
        viewField("Water temperature (°C)", sub["Water_Temperature_C"] || null),
        viewField("Secchi depth (cm)", sub["Secchi_Depth_cm"] || null),
      ].join("")}${viewGridPad(4)}</div>`
    : "";

  const waterNotesHtml = `<p class="view-subsection-label">Notes</p>${sub["Water_Quality_Notes"] ? `<div class="view-notes">${escapeHtml(sub["Water_Quality_Notes"])}</div>` : viewEmptyNote("No water quality notes.")}`;

  const waterHtml = `${observationsHtml}${aquafarmHtml}${instrumentHtml}${waterNotesHtml}`;

  bodyEl.innerHTML =
    viewSection("site", "Site Information", `<div class="view-grid">${siteFields}</div>`) +
    viewSection("vegetation", "Vegetation", vegetationHtml) +
    viewSection("fauna", "Fauna", faunaHtml) +
    viewSection("water", "Water Quality", waterHtml);

  overlay.classList.add("open");
}

function closeSubmissionDetailModal() {
  const overlay = document.getElementById("submissionDetailOverlay");
  if (overlay) overlay.classList.remove("open");
}

// Approving/rejecting writes to the server (which is also what creates the
// ranger's notification, so it always reflects a real review action, never
// just a local UI toggle) and then patches the in-memory copy so the badge
// updates immediately without waiting for the next full refetch.
// koboId defaults to whichever submission the detail modal has open, so the
// modal's own Approve/Reject buttons don't need to pass anything — but the
// Ranger Surveys table's row-level Approve/Reject icons act on a specific
// row without needing the modal open at all, so they pass their own id.
async function reviewSubmission(action, notes, koboId) {
  const id = koboId != null ? koboId : pendingDetailKoboId;
  if (!id) return;
  try {
    const params = { action, id: String(id) };
    if (notes) params.notes = notes;
    const body = new URLSearchParams(params);
    const res = await fetch("../API/ranger-submissions.php", { method: "POST", credentials: "same-origin", body });
    const data = await res.json();
    if (!data.success) return;

    const sub = ALL_SUBMISSIONS.find(s => String(s["_id"]) === String(id));
    if (sub) {
      sub["_approval_status"] = data.approval_status;
      sub["_review_notes"] = notes || null;
      if (String(id) === String(pendingDetailKoboId)) renderApprovalStatus(sub);
      if (surveysMarkupLoaded) renderSurveysView();
    }
  } catch (err) {
    // Best-effort — MENRO can just try the button again.
  }
}

function showRejectNotesPanel() {
  const panel = document.getElementById("rejectNotesPanel");
  const main = document.getElementById("submissionDetailFooterMain");
  const input = document.getElementById("rejectNotesInput");
  if (panel) panel.hidden = false;
  if (main) main.hidden = true;
  if (input) { input.value = ""; input.focus(); }
}

function hideRejectNotesPanel() {
  const panel = document.getElementById("rejectNotesPanel");
  const main = document.getElementById("submissionDetailFooterMain");
  if (panel) panel.hidden = true;
  if (main) main.hidden = false;
}

function bindRangersSection() {
  const body = document.getElementById("rangersTableBody");
  if (body && !body.dataset.bound) {
    body.dataset.bound = "true";
    body.addEventListener("click", (e) => {
      const row = e.target.closest("tr[data-ranger]");
      if (row) openRangerSubmissionsModal(row.dataset.ranger);
    });
  }

  const overlay = document.getElementById("rangerSubmissionsOverlay");
  const closeBtn = document.getElementById("btnCloseRangerSubmissions");
  if (overlay && !overlay.dataset.bound) {
    overlay.dataset.bound = "true";
    if (closeBtn) closeBtn.addEventListener("click", closeRangerSubmissionsModal);
    overlay.addEventListener("click", (e) => {
      if (e.target === overlay) closeRangerSubmissionsModal();
    });
    document.addEventListener("keydown", (e) => {
      if (e.key === "Escape" && overlay.classList.contains("open")) closeRangerSubmissionsModal();
    });
  }

  const submissionsBody = document.getElementById("rangerSubmissionsBody");
  if (submissionsBody && !submissionsBody.dataset.bound) {
    submissionsBody.dataset.bound = "true";
    submissionsBody.addEventListener("click", (e) => {
      const row = e.target.closest("tr[data-kobo-id]");
      if (!row || !row.dataset.koboId) return;
      const sub = ALL_SUBMISSIONS.find(s => String(s["_id"]) === row.dataset.koboId);
      if (sub) openSubmissionDetailModal(sub);
    });
  }

  const detailOverlay = document.getElementById("submissionDetailOverlay");
  const detailCloseBtn = document.getElementById("btnCloseSubmissionDetail");
  if (detailOverlay && !detailOverlay.dataset.bound) {
    detailOverlay.dataset.bound = "true";
    if (detailCloseBtn) detailCloseBtn.addEventListener("click", closeSubmissionDetailModal);
    detailOverlay.addEventListener("click", (e) => {
      if (e.target === detailOverlay) closeSubmissionDetailModal();
    });
    document.addEventListener("keydown", (e) => {
      if (e.key === "Escape" && detailOverlay.classList.contains("open")) closeSubmissionDetailModal();
    });

    const approveBtn = document.getElementById("btnApproveSubmission");
    const rejectBtn = document.getElementById("btnRejectSubmission");
    const cancelRejectBtn = document.getElementById("btnCancelReject");
    const confirmRejectBtn = document.getElementById("btnConfirmReject");
    if (approveBtn) approveBtn.addEventListener("click", () => reviewSubmission("approve"));
    if (rejectBtn) rejectBtn.addEventListener("click", showRejectNotesPanel);
    if (cancelRejectBtn) cancelRejectBtn.addEventListener("click", hideRejectNotesPanel);
    if (confirmRejectBtn) {
      confirmRejectBtn.addEventListener("click", () => {
        const input = document.getElementById("rejectNotesInput");
        const notes = input ? input.value.trim() : "";
        hideRejectNotesPanel();
        reviewSubmission("reject", notes);
      });
    }
  }
}

// Everything worth MENRO's attention from one submission: any observed
// threat the ranger checked off (besides "None observed"), visible
// foam/discharge in the water, or an aquafarm actually discharging nearby.
// A clean submission returns [].
function submissionAlerts(sub) {
  const alerts = [];

  const threatValues = (sub["Observed_Threats"] || "").toLowerCase().split(",")
    .map(s => s.trim()).filter(v => v && v !== "none_observed");
  if (threatValues.length > 0) {
    alerts.push(observedThreatsDisplay(threatValues.join(","), sub["Observed_Threats_Other"]));
  }

  const dischargeRaw = (sub["Visible_Foam_or_Discharge"] || "").toLowerCase();
  if (dischargeRaw === "visible_discharge_flow") alerts.push("Discharge visible");
  else if (dischargeRaw === "oily_film") alerts.push("Oily film observed");
  // Legacy values, for submissions from before the Water Quality step asked
  // this question this way.
  else if (dischargeRaw === "discharge_visible") alerts.push("Discharge visible");
  else if (dischargeRaw === "heavy_discharge") alerts.push("Heavy discharge");

  const aquafarmRaw = (sub["Nearby_Aquafarm_Activity"] || sub["Nearby_aquafarm_activity"] || "").toLowerCase();
  const aquafarmDischargeRaw = (sub["Discharge_Toward_Mangroves"] || sub["Discharge_toward_mangroves"] || "").toLowerCase();
  if (aquafarmRaw === "active___discharge_observed" || (aquafarmRaw === "yes" && aquafarmDischargeRaw === "yes")) {
    alerts.push("Aquafarm discharge observed");
  }

  return alerts;
}

function computeAlertEntries() {
  return ALL_SUBMISSIONS
    .map(sub => ({ sub, alerts: submissionAlerts(sub) }))
    .filter(entry => entry.alerts.length > 0 && !entry.sub["_alert_reviewed"])
    .sort((a, b) => (koboSubmissionDate(b.sub) || "").localeCompare(koboSubmissionDate(a.sub) || ""));
}

function renderAlertsSection() {
  const list = document.getElementById("alertsCardList");
  const empty = document.getElementById("alertsEmpty");
  if (!list || !empty) return;

  const entries = computeAlertEntries();
  if (entries.length === 0) {
    list.innerHTML = "";
    empty.hidden = false;
    return;
  }

  empty.hidden = true;
  list.innerHTML = entries.map(({ sub, alerts }) => {
    const areaRaw = sub["Protected_area_Zone"] || sub["Barangay"] || "";
    const zoneId  = sub["_zone_id"] || zoneIdFromProtectedArea(areaRaw) || BARANGAY_TO_ZONE[areaRaw];
    const zone    = ZONES.find(z => z.id === zoneId);
    const zoneName = zone ? zone.name : (sub["_zone_name"] || areaRaw || "Unknown zone").replace(/_/g, " ");
    const alertBadges = alerts.map(a => `<span class="threat-tag flagged">${escapeHtml(a)}</span>`).join("");

    return `
      <div class="alert-card">
        <div>
          <div class="alert-card-zone">${escapeHtml(zoneName)}</div>
          <div class="alert-card-meta">${escapeHtml(sub["Ranger_Name"] || "—")} · ${formatDate(koboSubmissionDate(sub))}</div>
        </div>
        <div class="alert-card-right">
          <div class="alert-card-badges">${alertBadges}</div>
          <button type="button" class="alert-card-review-btn" data-review-alert-id="${escapeHtml(String(sub["_id"] || ""))}" title="Mark as reviewed">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M20 6 9 17l-5-5"/></svg>
            Mark reviewed
          </button>
        </div>
      </div>
    `;
  }).join("");
}

async function markAlertReviewed(koboId) {
  try {
    const body = new URLSearchParams({ action: "markAlertReviewed", id: String(koboId) });
    const res = await fetch("../API/ranger-submissions.php", { method: "POST", credentials: "same-origin", body });
    const data = await res.json();
    if (!data.success) return;

    const sub = ALL_SUBMISSIONS.find(s => String(s["_id"]) === String(koboId));
    if (sub) sub["_alert_reviewed"] = true;
    renderAlertsSection();
  } catch (err) {
    // Best-effort — MENRO can just try the button again.
  }
}

function bindAlertsSection() {
  const list = document.getElementById("alertsCardList");
  if (!list || list.dataset.bound) return;
  list.dataset.bound = "true";
  list.addEventListener("click", (e) => {
    const btn = e.target.closest(".alert-card-review-btn");
    if (!btn) return;
    const id = btn.dataset.reviewAlertId;
    if (id) markAlertReviewed(id);
  });
}

// Fixed order, never cycled (a validated colorblind-safe categorical set —
// see the dataviz skill's reference palette) — a 6th threat type would fold
// into "Other" rather than get a new hue.
const THREAT_SERIES_CONFIG = [
  { key: "cutting",                   label: "Cutting",                 color: "#2a78d6" },
  { key: "encroachment",              label: "Encroachment",            color: "#eb6834" },
  { key: "garbage",                   label: "Garbage",                 color: "#1baf7a" },
  { key: "storm_damage",              label: "Storm damage",            color: "#eda100" },
  { key: "other",                     label: "Other",                  color: "#e87ba4" },
];
const MONTH_LABELS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

// Grouped by calendar month across all years present (Jan–Dec), not a
// rolling range — with only a handful of submissions so far, splitting by
// year as well would spread too few points too thin to show a pattern.
function computeThreatsOverTime() {
  const monthCounts = THREAT_SERIES_CONFIG.map(() => Array(12).fill(0));

  ALL_SUBMISSIONS.forEach(sub => {
    // A submission can now have several threats checked at once (comma-
    // joined), not just one — each counted toward its own series instead of
    // the whole list being treated as a single unmatched value.
    const values = (sub["Observed_Threats"] || "").toLowerCase().split(",")
      .map(s => s.trim()).filter(v => v && v !== "none_observed");
    if (values.length === 0) return;

    const dateStr = koboSubmissionDate(sub);
    if (!dateStr || dateStr.length < 7) return;
    const month = parseInt(dateStr.slice(5, 7), 10) - 1;
    if (month < 0 || month > 11) return;

    values.forEach(v => {
      const key = v === "__other__" ? "other" : v;
      let seriesIndex = THREAT_SERIES_CONFIG.findIndex(s => s.key === key);
      if (seriesIndex === -1) seriesIndex = THREAT_SERIES_CONFIG.length - 1; // any threat type without its own series folds into "Other"
      monthCounts[seriesIndex][month] += 1;
    });
  });

  return THREAT_SERIES_CONFIG.map((cfg, i) => ({
    ...cfg,
    counts: monthCounts[i],
    total: monthCounts[i].reduce((a, b) => a + b, 0),
  }));
}

// A hand-built line chart (matching this dashboard's other charts, which are
// all plain inline SVG rather than a charting library) with its own hover
// layer — a crosshair snaps to the nearest month and one tooltip lists every
// series' value there, per the dataviz skill's interaction rules.
// A smooth curve through every real data point instead of straight segments
// between them — matches a softer, rounded chart style. Uses a *monotone*
// cubic Hermite spline (the same technique D3 calls curveMonotoneX), not a
// plain Catmull-Rom curve — a plain curve overshoots past a flat run of
// zeros right before a sharp rise (e.g. Jul-Aug both 0, then Sep jumps to
// 3), dipping visibly below zero, which is a real value that never
// occurred. The monotone version is constrained to never overshoot beyond
// the two points it's connecting, so a threat count can never show as
// negative. The curve still passes exactly through each month's real
// value; only the path between points is curved.
function smoothLinePath(points) {
  const n = points.length;
  if (n < 2) return "";
  if (n === 2) {
    return `M ${points[0][0].toFixed(1)},${points[0][1].toFixed(1)} L ${points[1][0].toFixed(1)},${points[1][1].toFixed(1)}`;
  }

  const xs = points.map(p => p[0]);
  const ys = points.map(p => p[1]);
  const dx = [], slope = [];
  for (let i = 0; i < n - 1; i++) {
    dx[i] = xs[i + 1] - xs[i];
    slope[i] = (ys[i + 1] - ys[i]) / dx[i];
  }

  const tangent = new Array(n);
  tangent[0] = slope[0];
  tangent[n - 1] = slope[n - 2];
  for (let i = 1; i < n - 1; i++) {
    // Slope sign changes at a local min/max — tangent must be flat there,
    // or the curve would bulge past that peak/trough on one side.
    if (slope[i - 1] * slope[i] <= 0) {
      tangent[i] = 0;
    } else {
      const w1 = 2 * dx[i] + dx[i - 1];
      const w2 = dx[i] + 2 * dx[i - 1];
      tangent[i] = (w1 + w2) / (w1 / slope[i - 1] + w2 / slope[i]);
    }
  }

  const d = [`M ${xs[0].toFixed(1)},${ys[0].toFixed(1)}`];
  for (let i = 0; i < n - 1; i++) {
    const cp1x = xs[i] + dx[i] / 3;
    const cp1y = ys[i] + tangent[i] * dx[i] / 3;
    const cp2x = xs[i + 1] - dx[i] / 3;
    const cp2y = ys[i + 1] - tangent[i + 1] * dx[i] / 3;
    d.push(`C ${cp1x.toFixed(1)},${cp1y.toFixed(1)} ${cp2x.toFixed(1)},${cp2y.toFixed(1)} ${xs[i + 1].toFixed(1)},${ys[i + 1].toFixed(1)}`);
  }
  return d.join(" ");
}

function smoothAreaPath(points, baselineY) {
  const line = smoothLinePath(points);
  if (!line) return "";
  const lastX = points[points.length - 1][0];
  const firstX = points[0][0];
  return `${line} L ${lastX.toFixed(1)},${baselineY.toFixed(1)} L ${firstX.toFixed(1)},${baselineY.toFixed(1)} Z`;
}

function renderThreatsOverTimeChart(container) {
  const series = computeThreatsOverTime();
  const grandTotal = series.reduce((sum, s) => sum + s.total, 0);

  if (grandTotal === 0) {
    container.innerHTML = `<div class="dashboard-empty">No threats reported yet.</div>`;
    return;
  }

  const w = 800, h = 260;
  const padL = 34, padR = 16, padT = 16, padB = 26;
  const innerW = w - padL - padR;
  const innerH = h - padT - padB;

  const maxCount = Math.max(...series.flatMap(s => s.counts), 4);
  const x = i => padL + (innerW * i) / 11;
  const y = v => padT + innerH - (v / maxCount) * innerH;

  const gridSteps = Math.min(maxCount, 4);
  const gridLines = Array.from({ length: gridSteps + 1 }).map((_, i) => {
    const v = Math.round((maxCount * i) / gridSteps);
    const gy = y(v);
    return `
      <line x1="${padL}" y1="${gy.toFixed(1)}" x2="${w - padR}" y2="${gy.toFixed(1)}" stroke="#e1e0d9" stroke-width="1"/>
      <text x="${padL - 8}" y="${(gy + 3).toFixed(1)}" font-size="9.5" fill="#898781" text-anchor="end">${v}</text>
    `;
  }).join("");

  const monthLabels = MONTH_LABELS.map((m, i) => `
    <text x="${x(i).toFixed(1)}" y="${h - 6}" font-size="9.5" fill="#898781" text-anchor="middle">${m}</text>
  `).join("");

  const seriesMarks = series.map(s => {
    const pts = s.counts.map((v, i) => [x(i), y(v)]);
    const linePath = smoothLinePath(pts);
    const areaPath = smoothAreaPath(pts, y(0));
    const dots = s.counts.map((v, i) => `
      <circle class="threats-chart-dot" data-series="${s.key}" cx="${x(i).toFixed(1)}" cy="${y(v).toFixed(1)}" r="4" fill="${s.color}" stroke="#fcfcfb" stroke-width="2"/>
    `).join("");
    return `
      <path d="${areaPath}" fill="${s.color}" opacity="0.16"/>
      <path d="${linePath}" fill="none" stroke="${s.color}" stroke-width="2" stroke-linejoin="round" stroke-linecap="round"/>
      ${dots}
    `;
  }).join("");

  // One invisible full-height hit column per month — bigger than the marks
  // themselves, so the pointer only has to be near a month, not on a dot.
  const hoverColumns = MONTH_LABELS.map((_, i) => {
    const colW = innerW / 12;
    return `<rect class="threats-chart-hitcol" data-month="${i}" x="${(padL + colW * i).toFixed(1)}" y="0" width="${colW.toFixed(1)}" height="${h}" fill="transparent"/>`;
  }).join("");

  const legend = series.map(s => `
    <div class="threats-legend-item">
      <span class="threats-legend-key" style="background:${s.color}"></span>
      <span class="threats-legend-label">${escapeHtml(s.label)}</span>
      <span class="threats-legend-value">${s.total}</span>
    </div>
  `).join("");

  container.innerHTML = `
    <div class="threats-chart-wrap">
      <svg viewBox="0 0 ${w} ${h}" class="threats-chart-svg" preserveAspectRatio="none">
        ${gridLines}
        <line x1="${padL}" y1="${(padT + innerH).toFixed(1)}" x2="${w - padR}" y2="${(padT + innerH).toFixed(1)}" stroke="#c3c2b7" stroke-width="1"/>
        ${seriesMarks}
        ${monthLabels}
        <line class="threats-chart-crosshair" x1="0" y1="${padT}" x2="0" y2="${padT + innerH}" stroke="#c3c2b7" stroke-width="1" opacity="0"/>
        ${hoverColumns}
      </svg>
      <div class="threats-chart-tooltip" hidden></div>
    </div>
    <div class="threats-legend">${legend}</div>
  `;

  const svg = container.querySelector(".threats-chart-svg");
  const crosshair = container.querySelector(".threats-chart-crosshair");
  const tooltip = container.querySelector(".threats-chart-tooltip");
  const wrap = container.querySelector(".threats-chart-wrap");

  function showMonth(i) {
    crosshair.setAttribute("x1", x(i).toFixed(1));
    crosshair.setAttribute("x2", x(i).toFixed(1));
    crosshair.setAttribute("opacity", "1");

    const rows = series
      .map(s => ({ s, v: s.counts[i] }))
      .filter(({ v }) => v > 0)
      .map(({ s, v }) => `
        <div class="threats-tooltip-row">
          <span class="threats-tooltip-key" style="background:${s.color}"></span>
          <span class="threats-tooltip-label"></span>
          <span class="threats-tooltip-value">${v}</span>
        </div>
      `);
    // Series names are fixed config here (not user data), but built via the
    // same textContent-safe pattern the interaction guide asks for anyway.
    tooltip.innerHTML = `<div class="threats-tooltip-title">${MONTH_LABELS[i]}</div>${rows.join("") || '<div class="threats-tooltip-row threats-tooltip-empty">No threats reported</div>'}`;
    tooltip.querySelectorAll(".threats-tooltip-label").forEach((el, idx) => {
      const visible = series.filter(s => s.counts[i] > 0);
      el.textContent = visible[idx] ? visible[idx].label : "";
    });

    const pct = x(i) / w;
    tooltip.style.left = `${(pct * 100).toFixed(2)}%`;
    tooltip.hidden = false;
  }

  function hideTooltip() {
    crosshair.setAttribute("opacity", "0");
    tooltip.hidden = true;
  }

  svg.querySelectorAll(".threats-chart-hitcol").forEach(col => {
    const month = parseInt(col.dataset.month, 10);
    col.addEventListener("mouseenter", () => showMonth(month));
    col.addEventListener("focus", () => showMonth(month));
  });
  wrap.addEventListener("mouseleave", hideTooltip);
}

function bindDashboardControls() {
  const datePicker = document.getElementById("dashboardDatePicker");
  if (datePicker && !datePicker.dataset.bound) {
    datePicker.dataset.bound = "true";
    datePicker.addEventListener("click", (e) => {
      const dayBtn = e.target.closest(".cal-day");
      if (dayBtn) {
        dashboardSelectedDate = dayBtn.dataset.date;
        // zone.dashboardNdvi is a plain per-zone value with no date attached
        // to it — left alone, a zone the new date's sync hasn't reached yet
        // still shows whatever number was fetched for the *previous* date,
        // which reads as "the NDVI didn't change" even though it's really
        // just stale leftovers waiting to be overwritten. Clearing it first
        // means the chart honestly shows "no data yet" until each zone's
        // real value for the newly picked date actually arrives.
        ZONES.forEach(z => { z.dashboardNdvi = null; });
        renderDashboard();
        syncDashboardSatelliteNdvi();
        return;
      }
      if (e.target.closest("#calPrevMonth")) { shiftCalendarMonth(-1); return; }
      if (e.target.closest("#calNextMonth")) { shiftCalendarMonth(1); return; }
    });
  }

  const exportBtn = document.getElementById("dashboardExportBtn");
  if (exportBtn && !exportBtn.dataset.bound) {
    exportBtn.dataset.bound = "true";
    exportBtn.addEventListener("click", () => {
      if (typeof openExportReport === "function") openExportReport();
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

  renderDashboardHeader(s);
  renderStatCards(s);
  renderAlertsSection();
  renderDatePicker();
  document.getElementById("healthDonutChart").innerHTML = renderHealthDonut(s.healthy, s.moderate, s.degraded, s.pending);
  document.getElementById("ndviBarChart").innerHTML     = renderNDVIBarChart(s.zoneSnapshot);
  const threatsChartEl = document.getElementById("threatsOverTimeChart");
  if (threatsChartEl) renderThreatsOverTimeChart(threatsChartEl);
  renderRangersSection();

  bindDashboardControls();
  bindRangersSection();
  bindAlertsSection();
}

const mapView       = document.getElementById("mapView");
const dashboardView = document.getElementById("dashboardView");
const surveysView   = document.getElementById("surveysView");

let dashboardMarkupLoaded = false;

async function ensureDashboardMarkup() {
  if (dashboardMarkupLoaded) return;
  const body = document.getElementById("dashboardBody");
  if (!body) return;

  const res = await fetch("Dashboard.php", { cache: "no-store" });
  body.innerHTML = await res.text();
  dashboardMarkupLoaded = true;
}

let surveysMarkupLoaded = false;

async function ensureSurveysMarkup() {
  if (surveysMarkupLoaded) return;
  const body = document.getElementById("surveysBody");
  if (!body) return;

  const res = await fetch("Surveys.php", { cache: "no-store" });
  body.innerHTML = await res.text();
  surveysMarkupLoaded = true;
}

let activeSurveysTab = "all";

const APPROVAL_STATUS_TAG = {
  pending:  { cls: "none",    label: "Pending" },
  approved: { cls: "good",    label: "Approved" },
  rejected: { cls: "flagged", label: "Needs Revision" },
};

function computeApprovalCounts(subs) {
  const counts = { all: subs.length, pending: 0, approved: 0, rejected: 0 };
  subs.forEach(sub => {
    const status = sub["_approval_status"] || "pending";
    if (counts[status] !== undefined) counts[status] += 1;
  });
  return counts;
}

function surveysZoneName(sub) {
  const areaRaw = sub["Protected_area_Zone"] || sub["Barangay"] || "";
  const zoneId  = sub["_zone_id"] || zoneIdFromProtectedArea(areaRaw) || BARANGAY_TO_ZONE[areaRaw];
  const zone    = ZONES.find(z => z.id === zoneId);
  return zone ? zone.name : (sub["_zone_name"] || areaRaw || "Unknown zone").replace(/_/g, " ");
}

function surveysBarangayName(sub) {
  const raw = sub["_zone_barangay"] || sub["Barangay"] || "";
  return raw ? String(raw).replace(/_/g, " ") : "";
}

function renderSurveysRow(sub) {
  const zoneName = surveysZoneName(sub);
  const aquafarmRaw = (sub["Nearby_aquafarm_activity"] || sub["Nearby_Aquafarm_Activity"] || "").toLowerCase();
  const dischargeRaw = (sub["Discharge_Toward_Mangroves"] || sub["Discharge_toward_mangroves"] || "").toLowerCase();
  const aquafarmInfo = aquafarmTag(aquafarmRaw, dischargeRaw);
  const approvalStatus = sub["_approval_status"] || "pending";
  const statusTag = APPROVAL_STATUS_TAG[approvalStatus] || APPROVAL_STATUS_TAG.pending;

  return `
    <tr class="row-clickable" data-kobo-id="${escapeHtml(String(sub["_id"] || ""))}">
      <td>${formatDate(koboSubmissionDate(sub))}</td>
      <td class="survey-log-zone-cell" title="${escapeHtml(zoneName)}">${escapeHtml(zoneName)}</td>
      <td>${escapeHtml(sub["Ranger_Name"] || "—")}</td>
      <td class="cell-center"><span class="threat-tag ${aquafarmInfo.cls}">${escapeHtml(aquafarmInfo.label)}</span></td>
      <td class="cell-center"><span class="threat-tag ${statusTag.cls}">${statusTag.label}</span></td>
      <td class="cell-center">
        <div class="row-actions">
          ${approvalStatus === "approved"
            ? `<button type="button" class="row-approve-btn row-approve-btn-locked" disabled aria-label="Already approved" title="Already approved">
                 <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
                   <path d="M20 6 9 17l-5-5"/>
                 </svg>
               </button>`
            : `<button type="button" class="row-approve-btn" data-approve-id="${escapeHtml(String(sub["_id"] || ""))}" aria-label="Approve submission" title="Approve">
                 <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
                   <path d="M20 6 9 17l-5-5"/>
                 </svg>
               </button>`
          }
          <button type="button" class="row-reject-btn" data-reject-id="${escapeHtml(String(sub["_id"] || ""))}" aria-label="Reject submission" title="Reject">
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
              <line x1="18" y1="6" x2="6" y2="18"/>
              <line x1="6" y1="6" x2="18" y2="18"/>
            </svg>
          </button>
        </div>
      </td>
    </tr>
  `;
}

// Newest-first by default, same convention as the ranger's own Submission
// History table.
const surveysSortState = { key: "date", dir: "desc" };
let surveysSearchQuery = "";
const surveysFilterState = { barangay: "", zone: "", status: "" };
const SURVEYS_PAGE_SIZE = 10;
let surveysCurrentPage = 1;

function isSurveysFilterActive() {
  return !!(surveysSearchQuery || surveysFilterState.barangay || surveysFilterState.zone || surveysFilterState.status);
}

// Rebuilds the barangay/zone dropdown options from whatever submissions
// actually exist, same as the ranger's own filter bar — keeping whatever
// was already selected if it's still a valid option.
function populateSurveysFilterOptions() {
  const barangaySelect = document.getElementById("surveysFilterBarangay");
  const zoneSelect = document.getElementById("surveysFilterZone");
  if (!barangaySelect || !zoneSelect) return;

  const barangays = [...new Set(ALL_SUBMISSIONS.map(surveysBarangayName).filter(Boolean))].sort();
  const zones = [...new Set(ALL_SUBMISSIONS.map(surveysZoneName).filter(z => z && z !== "Unknown zone"))].sort();

  const prevBarangay = barangaySelect.value;
  const prevZone = zoneSelect.value;

  barangaySelect.innerHTML = '<option value="">All barangays</option>' +
    barangays.map(b => `<option value="${escapeHtml(b)}">${escapeHtml(b)}</option>`).join("");
  zoneSelect.innerHTML = '<option value="">All mangroves</option>' +
    zones.map(z => `<option value="${escapeHtml(z)}">${escapeHtml(z)}</option>`).join("");

  if (barangays.includes(prevBarangay)) barangaySelect.value = prevBarangay;
  if (zones.includes(prevZone)) zoneSelect.value = prevZone;
}

const SURVEYS_STATUS_RANK = { pending: 0, rejected: 1, approved: 2 };

function surveysSortValue(sub, key) {
  switch (key) {
    case "date":     return koboSubmissionDate(sub) || "";
    case "zone":     return surveysZoneName(sub) || "";
    case "ranger":   return sub["Ranger_Name"] || "";
    case "aquafarm": return aquafarmTag(
      (sub["Nearby_aquafarm_activity"] || sub["Nearby_Aquafarm_Activity"] || "").toLowerCase(),
      (sub["Discharge_Toward_Mangroves"] || sub["Discharge_toward_mangroves"] || "").toLowerCase()
    ).label;
    case "status":   return SURVEYS_STATUS_RANK[sub["_approval_status"] || "pending"] ?? 99;
    default:         return 0;
  }
}

function updateSurveysSortHeaderIndicators() {
  document.querySelectorAll("#surveysBody .survey-log-table th[data-sort-key]").forEach(th => {
    const isActive = th.getAttribute("data-sort-key") === surveysSortState.key;
    th.classList.toggle("sort-active", isActive);
    th.classList.toggle("sort-asc", isActive && surveysSortState.dir === "asc");
    th.classList.toggle("sort-desc", isActive && surveysSortState.dir === "desc");
  });
}

function renderSurveysView() {
  const bodyEl  = document.getElementById("surveysTableBody");
  const emptyEl = document.getElementById("surveysEmpty");
  if (!bodyEl || !emptyEl) return;

  const counts = computeApprovalCounts(ALL_SUBMISSIONS);
  const setCount = (id, n) => { const el = document.getElementById(id); if (el) el.textContent = String(n); };
  setCount("surveysTabCountAll", counts.all);
  setCount("surveysTabCountPending", counts.pending);
  setCount("surveysTabCountApproved", counts.approved);
  setCount("surveysTabCountRejected", counts.rejected);

  populateSurveysFilterOptions();

  const filtered = activeSurveysTab === "all"
    ? ALL_SUBMISSIONS
    : ALL_SUBMISSIONS.filter(sub => (sub["_approval_status"] || "pending") === activeSurveysTab);

  const query = surveysSearchQuery.trim().toLowerCase();
  const searched = filtered.filter(sub => {
    if (surveysFilterState.barangay && surveysBarangayName(sub) !== surveysFilterState.barangay) return false;
    if (surveysFilterState.zone && surveysZoneName(sub) !== surveysFilterState.zone) return false;
    if (surveysFilterState.status && (sub["_approval_status"] || "pending") !== surveysFilterState.status) return false;
    if (query) {
      const haystack = `${surveysZoneName(sub)} ${sub["Ranger_Name"] || ""} ${surveysBarangayName(sub)}`.toLowerCase();
      if (!haystack.includes(query)) return false;
    }
    return true;
  });

  const clearBtn = document.getElementById("surveysFilterClear");
  if (clearBtn) clearBtn.classList.toggle("is-inactive", !isSurveysFilterActive());

  const sorted = [...searched].sort((a, b) => {
    const av = surveysSortValue(a, surveysSortState.key);
    const bv = surveysSortValue(b, surveysSortState.key);
    const cmp = typeof av === "string" ? av.localeCompare(bv) : av - bv;
    return surveysSortState.dir === "asc" ? cmp : -cmp;
  });

  updateSurveysSortHeaderIndicators();

  if (sorted.length > 0) {
    const totalPages = Math.max(1, Math.ceil(sorted.length / SURVEYS_PAGE_SIZE));
    surveysCurrentPage = Math.min(surveysCurrentPage, totalPages);
    const start = (surveysCurrentPage - 1) * SURVEYS_PAGE_SIZE;
    bodyEl.innerHTML = sorted.slice(start, start + SURVEYS_PAGE_SIZE).map(renderSurveysRow).join("");
    emptyEl.hidden = true;
    renderSurveysPagination(sorted.length, totalPages);
  } else {
    bodyEl.innerHTML = "";
    emptyEl.hidden = false;
    renderSurveysPagination(0, 1);
  }
}

function renderSurveysPagination(totalCount, totalPages) {
  const pagination = document.getElementById("surveysPagination");
  const text = document.getElementById("surveysPaginationText");
  if (!pagination || !text) return;

  if (totalCount <= SURVEYS_PAGE_SIZE) {
    pagination.hidden = true;
    return;
  }

  pagination.hidden = false;
  text.textContent = `Page ${surveysCurrentPage} of ${totalPages}`;

  const prev = document.getElementById("surveysPrevPage");
  const next = document.getElementById("surveysNextPage");
  if (prev) prev.disabled = surveysCurrentPage <= 1;
  if (next) next.disabled = surveysCurrentPage >= totalPages;
}

function bindSurveysSection() {
  const tabsEl = document.querySelector("#surveysBody .approval-tabs");
  if (tabsEl && !tabsEl.dataset.bound) {
    tabsEl.dataset.bound = "true";
    tabsEl.addEventListener("click", (e) => {
      const btn = e.target.closest(".approval-tab[data-surveys-tab]");
      if (!btn) return;
      activeSurveysTab = btn.dataset.surveysTab;
      tabsEl.querySelectorAll(".approval-tab").forEach(t => t.classList.toggle("active", t === btn));
      surveysCurrentPage = 1;
      renderSurveysView();
    });
  }

  const searchEl = document.getElementById("surveysSearch");
  if (searchEl && !searchEl.dataset.bound) {
    searchEl.dataset.bound = "true";
    searchEl.addEventListener("input", () => {
      surveysSearchQuery = searchEl.value;
      surveysCurrentPage = 1;
      renderSurveysView();
    });
  }

  const barangaySelect = document.getElementById("surveysFilterBarangay");
  if (barangaySelect && !barangaySelect.dataset.bound) {
    barangaySelect.dataset.bound = "true";
    barangaySelect.addEventListener("change", () => {
      surveysFilterState.barangay = barangaySelect.value;
      surveysCurrentPage = 1;
      renderSurveysView();
    });
  }

  const zoneSelect = document.getElementById("surveysFilterZone");
  if (zoneSelect && !zoneSelect.dataset.bound) {
    zoneSelect.dataset.bound = "true";
    zoneSelect.addEventListener("change", () => {
      surveysFilterState.zone = zoneSelect.value;
      surveysCurrentPage = 1;
      renderSurveysView();
    });
  }

  const statusSelect = document.getElementById("surveysFilterStatus");
  if (statusSelect && !statusSelect.dataset.bound) {
    statusSelect.dataset.bound = "true";
    statusSelect.addEventListener("change", () => {
      surveysFilterState.status = statusSelect.value;
      surveysCurrentPage = 1;
      renderSurveysView();
    });
  }

  const clearBtn = document.getElementById("surveysFilterClear");
  if (clearBtn && !clearBtn.dataset.bound) {
    clearBtn.dataset.bound = "true";
    clearBtn.addEventListener("click", () => {
      surveysSearchQuery = "";
      surveysFilterState.barangay = "";
      surveysFilterState.zone = "";
      surveysFilterState.status = "";
      surveysCurrentPage = 1;
      if (searchEl) searchEl.value = "";
      if (barangaySelect) barangaySelect.value = "";
      if (zoneSelect) zoneSelect.value = "";
      if (statusSelect) statusSelect.value = "";
      renderSurveysView();
    });
  }

  document.querySelectorAll("#surveysBody .survey-log-table th[data-sort-key]").forEach(th => {
    if (th.dataset.bound) return;
    th.dataset.bound = "true";
    const btn = th.querySelector(".sort-th-btn");
    if (!btn) return;
    btn.addEventListener("click", () => {
      const key = th.getAttribute("data-sort-key");
      if (surveysSortState.key === key) {
        surveysSortState.dir = surveysSortState.dir === "asc" ? "desc" : "asc";
      } else {
        surveysSortState.key = key;
        surveysSortState.dir = "asc";
      }
      surveysCurrentPage = 1;
      renderSurveysView();
    });
  });

  const surveysPrevBtn = document.getElementById("surveysPrevPage");
  if (surveysPrevBtn && !surveysPrevBtn.dataset.bound) {
    surveysPrevBtn.dataset.bound = "true";
    surveysPrevBtn.addEventListener("click", () => {
      surveysCurrentPage = Math.max(1, surveysCurrentPage - 1);
      renderSurveysView();
    });
  }

  const surveysNextBtn = document.getElementById("surveysNextPage");
  if (surveysNextBtn && !surveysNextBtn.dataset.bound) {
    surveysNextBtn.dataset.bound = "true";
    surveysNextBtn.addEventListener("click", () => {
      surveysCurrentPage += 1;
      renderSurveysView();
    });
  }

  // Approve/Reject act on the row directly and must be checked first, since
  // the click still bubbles up to the row — everything else on the row
  // (date, zone, ranger cells) falls through to opening the submission.
  const bodyEl = document.getElementById("surveysTableBody");
  if (bodyEl && !bodyEl.dataset.bound) {
    bodyEl.dataset.bound = "true";
    bodyEl.addEventListener("click", (e) => {
      const row = e.target.closest("tr[data-kobo-id]");
      if (!row || !row.dataset.koboId) return;
      const sub = ALL_SUBMISSIONS.find(s => String(s["_id"]) === row.dataset.koboId);
      if (!sub) return;

      if (e.target.closest(".row-approve-btn")) {
        openReviewConfirm(sub, "approve");
        return;
      }
      if (e.target.closest(".row-reject-btn")) {
        openReviewConfirm(sub, "reject");
        return;
      }

      openSubmissionDetailModal(sub);
    });
  }

  bindConfirmReviewOverlay();
}

// One shared "are you sure?" popup for the Ranger Surveys table's row-level
// Approve/Reject icons — its content (icon/title/text/button) is filled in
// per action, then the actual review only happens once the officer clicks
// through it: Approve applies immediately, Reject hands off to the full
// detail modal's notes panel (its own "Confirm Rejection" step) since a
// rejection reason needs more room than this popup gives it.
let pendingReviewAction = null;

const REVIEW_CONFIRM_CONTENT = {
  approve: {
    iconCls: "confirm-modal-icon confirm-modal-icon-positive",
    iconSvg: '<path d="M20 6 9 17l-5-5"/>',
    title: "Approve this submission?",
    text: "The ranger will be notified that their survey was approved.",
    confirmCls: "btn-confirm-primary",
    confirmLabel: "Approve",
  },
  reject: {
    iconCls: "confirm-modal-icon",
    iconSvg: '<line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>',
    title: "Reject this submission?",
    text: "You'll be able to add an optional note for the ranger on the next step.",
    confirmCls: "btn-confirm-danger",
    confirmLabel: "Continue",
  },
};

function openReviewConfirm(sub, action) {
  const overlay = document.getElementById("confirmReviewOverlay");
  const iconEl = document.getElementById("confirmReviewIcon");
  const iconSvgEl = document.getElementById("confirmReviewIconSvg");
  const titleEl = document.getElementById("confirmReviewTitle");
  const textEl = document.getElementById("confirmReviewText");
  const confirmBtn = document.getElementById("btnConfirmReview");
  if (!overlay || !iconEl || !titleEl || !textEl || !confirmBtn) return;

  pendingReviewAction = { sub, action };
  const content = REVIEW_CONFIRM_CONTENT[action];
  iconEl.className = content.iconCls;
  if (iconSvgEl) iconSvgEl.innerHTML = content.iconSvg;
  titleEl.textContent = content.title;
  textEl.textContent = content.text;
  confirmBtn.className = content.confirmCls;
  confirmBtn.textContent = content.confirmLabel;

  overlay.classList.add("open");
}

function closeReviewConfirm() {
  const overlay = document.getElementById("confirmReviewOverlay");
  if (overlay) overlay.classList.remove("open");
  pendingReviewAction = null;
}

function bindConfirmReviewOverlay() {
  const overlay = document.getElementById("confirmReviewOverlay");
  if (!overlay || overlay.dataset.bound) return;
  overlay.dataset.bound = "true";

  const closeBtn = document.getElementById("btnCloseConfirmReview");
  const cancelBtn = document.getElementById("btnCancelConfirmReview");
  const confirmBtn = document.getElementById("btnConfirmReview");

  if (closeBtn) closeBtn.addEventListener("click", closeReviewConfirm);
  if (cancelBtn) cancelBtn.addEventListener("click", closeReviewConfirm);

  if (confirmBtn) {
    confirmBtn.addEventListener("click", () => {
      const pending = pendingReviewAction;
      closeReviewConfirm();
      if (!pending) return;

      if (pending.action === "approve") {
        reviewSubmission("approve", null, pending.sub["_id"]);
      } else {
        openSubmissionDetailModal(pending.sub);
        showRejectNotesPanel();
      }
    });
  }
}

let dashboardSatelliteSyncInProgress = false;
// Bumped every time this is called — lets a sync already in flight recognize
// a *newer* date was picked while it was still batching through zones (a
// single batch can take a while) and abandon its own results instead of
// finishing and overwriting the newer date's numbers with stale ones. Without
// this, picking a new date while one sync was still running just got
// silently ignored (the old "already in progress, do nothing" guard), so the
// chart kept showing whichever date's sync happened to be running first, no
// matter how many other dates were clicked afterward.
let dashboardNdviSyncGeneration = 0;

// Fetches real Sentinel-2 NDVI (via map-core.js's fetchZoneNdviFromCopernicus) for every
// zone that has coordinates, then re-renders the dashboard so the NDVI chart shows actual
// satellite data instead of staying blank. Zones without lat/lng yet are skipped.
async function syncDashboardSatelliteNdvi() {
  if (typeof fetchZoneNdviFromCopernicus !== "function") return;

  const myGeneration = ++dashboardNdviSyncGeneration;
  if (dashboardSatelliteSyncInProgress) return; // the running sync will notice myGeneration and hand off to it
  dashboardSatelliteSyncInProgress = true;

  const dateStr = dashboardSelectedDate || todayISO();
  const zonesWithCoords = ZONES.filter(z => z.lat != null && z.lng != null);

  // Written to zone.dashboardNdvi, not zone.satNdvi — the map/sidebar has its
  // own Scene Calendar date and keeps its own NDVI value in zone.satNdvi;
  // sharing one field between the two meant whichever view synced last would
  // silently overwrite the other's number, even though they're for different dates.
  const batchSize = (typeof NDVI_SYNC_BATCH_SIZE === "number") ? NDVI_SYNC_BATCH_SIZE : 3;
  for (let i = 0; i < zonesWithCoords.length; i += batchSize) {
    if (myGeneration !== dashboardNdviSyncGeneration) {
      dashboardSatelliteSyncInProgress = false;
      syncDashboardSatelliteNdvi(); // a newer date came in — restart clean for it
      return;
    }
    const batch = zonesWithCoords.slice(i, i + batchSize);
    // A date the ranger/MENRO has already looked at this session is fully
    // cached — every zone in the batch resolves instantly with no real
    // network call. Pausing between batches only matters for pacing *real*
    // requests past the satellite service's rate limit, so a fully-cached
    // batch skips the pause instead of waiting out an artificial delay for
    // no reason.
    let hadRealFetch = false;
    await Promise.all(batch.map(async zone => {
      const cacheKey = `${zone.id}|${dateStr}|${currentMaxCC}`;
      if (!Object.prototype.hasOwnProperty.call(satelliteNdviCache, cacheKey)) hadRealFetch = true;
      zone.dashboardNdvi = await fetchZoneNdviFromCopernicus(zone, dateStr);
    }));
    // Progressive fill-in — each zone that just resolved shows up right
    // away instead of the whole chart staying blank until every one of the
    // 30+ zones has been fetched.
    if (myGeneration === dashboardNdviSyncGeneration) renderDashboard();
    if (hadRealFetch && i + batchSize < zonesWithCoords.length) await sleep(NDVI_SYNC_BATCH_DELAY_MS || 400);
  }

  dashboardSatelliteSyncInProgress = false;
  if (myGeneration === dashboardNdviSyncGeneration) {
    renderDashboard();
  } else {
    syncDashboardSatelliteNdvi(); // a newer date came in during the last batch
  }
}

async function switchTab(tab) {
  const showMap       = tab === "map";
  const showDashboard = tab === "dashboard";
  const showSurveys   = tab === "surveys";

  if (mapView)       mapView.style.display = showMap ? "flex" : "none";
  if (dashboardView) dashboardView.classList.toggle("active", showDashboard);
  if (surveysView)   surveysView.classList.toggle("active", showSurveys);

  const menuMapEl       = document.getElementById("menuMap");
  const menuDashboardEl = document.getElementById("menuDashboard");
  const menuSurveysEl   = document.getElementById("menuSurveys");
  if (menuMapEl)       menuMapEl.classList.toggle("active", showMap);
  if (menuDashboardEl) menuDashboardEl.classList.toggle("active", showDashboard);
  if (menuSurveysEl)   menuSurveysEl.classList.toggle("active", showSurveys);

  if (showDashboard) {
    await ensureDashboardMarkup();
    renderDashboard();
    syncDashboardSatelliteNdvi();
  } else if (showSurveys) {
    await ensureSurveysMarkup();
    bindSurveysSection();
    renderSurveysView();
  } else if (typeof map !== "undefined" && map.invalidateSize) {
    setTimeout(() => map.invalidateSize(), 0);
  }
}

function openDashboard() {
  switchTab("dashboard");
}
function openSurveys() {
  return switchTab("surveys");
}
function closeDashboard() { switchTab("map"); }
