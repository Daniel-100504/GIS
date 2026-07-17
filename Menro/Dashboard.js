function computeDashboardStats() {
  const total    = ZONES.length;
  const healthy  = ZONES.filter(z => z.status === "healthy").length;
  const moderate = ZONES.filter(z => z.status === "moderate").length;
  const degraded = ZONES.filter(z => z.status === "degraded").length;

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

  const ndviTrend = [];

  const recent = [...ALL_SUBMISSIONS]
    .filter(sub => sub["Inspection_Date"])
    .sort((a, b) => (b["Inspection_Date"] || "").localeCompare(a["Inspection_Date"] || ""))
    .slice(0, 5)
    .map(sub => {
      const zoneId = BARANGAY_TO_ZONE[sub["Barangay"]];
      const zone   = ZONES.find(z => z.id === zoneId);
      return {
        zoneName: zone ? zone.name : (sub["Barangay"] || "Unknown zone").replace(/_/g, " "),
        ranger: sub["Ranger_Name"] || "—",
        date: sub["Inspection_Date"] || "—",
        threat: sub["Observed_Threats"] ? sub["Observed_Threats"].replace(/_/g, " ") : "none observed",
      };
    });

  return {
    total, healthy, moderate, degraded,
    avgNdvi, avgCanopy,
    totalSurveys: ALL_SUBMISSIONS.length,
    latestDate,
    topThreat: topThreat ? topThreat.replace(/_/g, " ") : null,
    topThreatCount,
    threatBreakdown: threatBreakdown.map(t => ({ threat: t.threat.replace(/_/g, " "), count: t.count })),
    ndviTrend,
    recent,
  };
}

function formatDate(iso) {
  if (!iso || iso === "—") return "—";
  const d = new Date(iso);
  if (isNaN(d.getTime())) return iso;
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

function statusColorHex(status) {
  if (status === "healthy")  return "#2e7d32";
  if (status === "moderate") return "#f57f17";
  if (status === "pending")  return "#9e9e9e";
  return "#b71c1c";
}

function renderHealthDonut(healthy, moderate, degraded) {
  const total = healthy + moderate + degraded;
  const r = 52, cx = 64, cy = 64, sw = 16;
  const circumference = 2 * Math.PI * r;

  const segments = [
    { value: healthy,  color: "#2e7d32", label: "Healthy" },
    { value: moderate, color: "#f57f17", label: "Moderate" },
    { value: degraded, color: "#b71c1c", label: "Degraded" },
  ];

  let offset = 0;
  const arcs = segments.map(seg => {
    const pct  = total > 0 ? seg.value / total : 0;
    const dash = pct * circumference;
    const circle = pct > 0
      ? `<circle cx="${cx}" cy="${cy}" r="${r}" fill="none" stroke="${seg.color}" stroke-width="${sw}"
           stroke-dasharray="${dash.toFixed(2)} ${(circumference - dash).toFixed(2)}"
           stroke-dashoffset="${(-offset).toFixed(2)}" transform="rotate(-90 ${cx} ${cy})" stroke-linecap="butt"/>`
      : "";
    offset += dash;
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
        <circle cx="${cx}" cy="${cy}" r="${r}" fill="none" stroke="#eef2ee" stroke-width="${sw}"/>
        ${arcs}
        <text x="${cx}" y="${cy - 4}" text-anchor="middle" font-size="24" font-weight="700" fill="#1b5e20">${total}</text>
        <text x="${cx}" y="${cy + 14}" text-anchor="middle" font-size="9" letter-spacing="1" fill="#8a9a8a">ZONES</text>
      </svg>
      <div class="donut-legend">${legend}</div>
    </div>
  `;
}

function renderNDVIBarChart(zones) {
  const sorted = [...zones].sort((a, b) => (b.ndvi ?? -1) - (a.ndvi ?? -1));
  const max = Math.max(...sorted.map(z => z.ndvi ?? 0), 0.1);

  const rows = sorted.map(z => {
    const pct   = z.ndvi !== null ? Math.max((z.ndvi / max) * 100, 2) : 0;
    const color = statusColorHex(z.status);
    return `
      <div class="hbar-row">
        <span class="hbar-label" title="${escapeHtml(z.name)}">${escapeHtml(z.name)}</span>
        <div class="hbar-track">
          <div class="hbar-fill" style="width:${pct.toFixed(1)}%; background:${color}"></div>
        </div>
        <span class="hbar-value">${z.ndvi !== null ? z.ndvi.toFixed(2) : "—"}</span>
      </div>
    `;
  }).join("");

  return `<div class="hbar-chart">${rows}</div>`;
}

function renderThreatBarChart(threatBreakdown) {
  if (!threatBreakdown || threatBreakdown.length === 0) {
    return `<div class="dashboard-empty">No threats reported in field surveys.</div>`;
  }
  const max = Math.max(...threatBreakdown.map(t => t.count));

  const rows = threatBreakdown.map(t => {
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

function renderNDVITrendChart(ndviTrend) {
  const points = ndviTrend.filter(p => p.avg !== null);
  if (points.length < 2) {
    return `<div class="dashboard-empty">Not enough scene dates yet to plot a trend.</div>`;
  }

  const w = 560, h = 140, padL = 34, padR = 14, padT = 14, padB = 26;
  const innerW = w - padL - padR, innerH = h - padT - padB;

  const values = points.map(p => p.avg);
  const minV = Math.min(...values) - 0.03;
  const maxV = Math.max(...values) + 0.03;

  const x = i => padL + (innerW * i) / (points.length - 1);
  const y = v => padT + innerH - ((v - minV) / (maxV - minV)) * innerH;

  const linePath = points.map((p, i) => `${i === 0 ? "M" : "L"} ${x(i).toFixed(1)} ${y(p.avg).toFixed(1)}`).join(" ");
  const areaPath = `${linePath} L ${x(points.length - 1).toFixed(1)} ${(padT + innerH).toFixed(1)} L ${x(0).toFixed(1)} ${(padT + innerH).toFixed(1)} Z`;

  const dots = points.map((p, i) => `<circle cx="${x(i).toFixed(1)}" cy="${y(p.avg).toFixed(1)}" r="3.2" fill="#1b5e20"/>`).join("");
  const labels = points.map((p, i) => {
    if (points.length > 6 && i % Math.ceil(points.length / 6) !== 0 && i !== points.length - 1) return "";
    const d = new Date(p.date);
    const label = isNaN(d.getTime()) ? p.date : d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
    return `<text x="${x(i).toFixed(1)}" y="${h - 6}" font-size="9" fill="#8a9a8a" text-anchor="middle">${label}</text>`;
  }).join("");

  return `
    <svg viewBox="0 0 ${w} ${h}" width="100%" height="${h}" class="trend-svg" preserveAspectRatio="none">
      <defs>
        <linearGradient id="ndviAreaFill" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stop-color="#2e7d32" stop-opacity="0.28"/>
          <stop offset="100%" stop-color="#2e7d32" stop-opacity="0"/>
        </linearGradient>
      </defs>
      <line x1="${padL}" y1="${padT}" x2="${padL}" y2="${padT + innerH}" stroke="#e2e8e2" stroke-width="1"/>
      <line x1="${padL}" y1="${padT + innerH}" x2="${w - padR}" y2="${padT + innerH}" stroke="#e2e8e2" stroke-width="1"/>
      <path d="${areaPath}" fill="url(#ndviAreaFill)" stroke="none"/>
      <path d="${linePath}" fill="none" stroke="#2e7d32" stroke-width="2.25"/>
      ${dots}
      ${labels}
    </svg>
  `;
}

function renderDashboard() {
  const body = document.getElementById("dashboardBody");
  if (!body) return;

  const s = computeDashboardStats();

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
          ${s.recent.map(r => `
            <tr>
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
    <h2 class="dashboard-page-title">Mangrove Monitoring Dashboard</h2>
    <div class="dashboard-meta-row">
      <span>MENRO Calatagan · Batangas</span>
      <span class="dashboard-meta-dot">•</span>
      <span>Generated ${formatDate(todayISO())}</span>
      ${s.latestDate ? `<span class="dashboard-meta-dot">•</span><span>Latest field inspection ${formatDate(s.latestDate)}</span>` : ""}
    </div>

    <p class="dashboard-section-title">Zone Health Overview</p>
    <div class="dashboard-grid">
      <div class="dashboard-stat-card">
        <span class="dashboard-stat-label">Total Mangrove Zones</span>
        <span class="dashboard-stat-value">${s.total}</span>
        <span class="dashboard-stat-hint">Across 17 barangays</span>
      </div>
      <div class="dashboard-stat-card accent-healthy">
        <span class="dashboard-stat-label">Healthy Zones</span>
        <span class="dashboard-stat-value">${s.healthy}</span>
        <span class="dashboard-stat-hint">${s.total ? Math.round((s.healthy / s.total) * 100) : 0}% of total</span>
      </div>
      <div class="dashboard-stat-card accent-moderate">
        <span class="dashboard-stat-label">Moderate Zones</span>
        <span class="dashboard-stat-value amber">${s.moderate}</span>
        <span class="dashboard-stat-hint">${s.total ? Math.round((s.moderate / s.total) * 100) : 0}% of total</span>
      </div>
      <div class="dashboard-stat-card accent-degraded">
        <span class="dashboard-stat-label">Degraded Zones</span>
        <span class="dashboard-stat-value red">${s.degraded}</span>
        <span class="dashboard-stat-hint">${s.total ? Math.round((s.degraded / s.total) * 100) : 0}% of total</span>
      </div>
    </div>

    <div class="dashboard-charts-row">
      <div class="chart-card chart-card-narrow">
        <p class="chart-card-title">Health Distribution</p>
        ${renderHealthDonut(s.healthy, s.moderate, s.degraded)}
      </div>
      <div class="chart-card">
        <p class="chart-card-title">NDVI by Zone</p>
        ${renderNDVIBarChart(ZONES)}
      </div>
    </div>

    <p class="dashboard-section-title">Satellite &amp; Field Metrics</p>
    <div class="dashboard-grid">
      <div class="dashboard-stat-card">
        <span class="dashboard-stat-label">Average NDVI</span>
        <span class="dashboard-stat-value">${s.avgNdvi.toFixed(2)}</span>
        <span class="dashboard-stat-hint">Scene-wide mean</span>
      </div>
      <div class="dashboard-stat-card">
        <span class="dashboard-stat-label">Average Canopy Cover</span>
        <span class="dashboard-stat-value">${s.avgCanopy !== null ? s.avgCanopy.toFixed(0) + "%" : "—"}</span>
        <span class="dashboard-stat-hint">${s.avgCanopy !== null ? "From field surveys" : "No field data yet"}</span>
      </div>
      <div class="dashboard-stat-card">
        <span class="dashboard-stat-label">Total Field Surveys</span>
        <span class="dashboard-stat-value">${s.totalSurveys}</span>
        <span class="dashboard-stat-hint">KoboToolbox submissions</span>
      </div>
      <div class="dashboard-stat-card">
        <span class="dashboard-stat-label">Latest Inspection</span>
        <span class="dashboard-stat-value" style="font-size:1.15rem">${s.latestDate ? formatDate(s.latestDate) : "—"}</span>
        <span class="dashboard-stat-hint">Most recent ranger visit</span>
      </div>
    </div>

    <div class="dashboard-charts-row">
      <div class="chart-card">
        <p class="chart-card-title">Average NDVI Trend</p>
        ${renderNDVITrendChart(s.ndviTrend)}
      </div>
      <div class="chart-card chart-card-narrow">
        <p class="chart-card-title">Observed Threats</p>
        ${renderThreatBarChart(s.threatBreakdown)}
      </div>
    </div>

    <p class="dashboard-section-title">Recent Survey Activity</p>
    ${activityHtml}
  `;
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

function openDashboard()  { switchTab("dashboard"); }
function closeDashboard() { switchTab("map"); }