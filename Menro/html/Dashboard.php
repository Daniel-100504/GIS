<div class="dashboard-header">
  <div class="dashboard-header-badge">
    <img src="../../assets/calatagan-seal.png" width="48" height="48" alt="Calatagan Seal">
  </div>
  <div>
    <h2 class="dashboard-page-title">Mangrove Monitoring Dashboard</h2>
    <div class="dashboard-meta-row">
      <span>MENRO Calatagan &middot; Batangas</span>
      <span class="dashboard-meta-dot">&bull;</span>
      <span id="dashboardSummaryDate">Summary as of &mdash;</span>
      <span class="dashboard-meta-dot" id="dashboardLatestDot" hidden>&bull;</span>
      <span id="dashboardLatestInspection" hidden></span>
    </div>
  </div>
</div>

<p class="dashboard-section-title">Zone Health Overview</p>
<div class="dashboard-grid">

  <div class="dashboard-stat-card accent-brand">
    <div class="dashboard-stat-icon">
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polygon points="3 6 9 3 15 6 21 3 21 18 15 21 9 18 3 21"/><line x1="9" y1="3" x2="9" y2="18"/><line x1="15" y1="6" x2="15" y2="21"/></svg>
    </div>
    <span class="dashboard-stat-label">Total Mangrove Zones</span>
    <span class="dashboard-stat-value" id="statTotalZonesValue">&mdash;</span>
    <span class="dashboard-stat-hint" id="statTotalZonesHint"></span>
  </div>

  <div class="dashboard-stat-card accent-healthy">
    <div class="dashboard-stat-icon icon-healthy">
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 22c0-4 3-5 3-9a3 3 0 0 0-6 0c0 4 3 5 3 9Z"/><path d="M12 13V3"/><path d="M12 7 8 3"/><path d="M12 9 17 4"/></svg>
    </div>
    <span class="dashboard-stat-label">Healthy Zones</span>
    <span class="dashboard-stat-value" id="statHealthyValue">&mdash;</span>
    <span class="dashboard-stat-hint" id="statHealthyHint"></span>
  </div>

  <div class="dashboard-stat-card accent-moderate">
    <div class="dashboard-stat-icon icon-moderate">
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0Z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>
    </div>
    <span class="dashboard-stat-label">Moderate Zones</span>
    <span class="dashboard-stat-value amber" id="statModerateValue">&mdash;</span>
    <span class="dashboard-stat-hint" id="statModerateHint"></span>
  </div>

  <div class="dashboard-stat-card accent-degraded">
    <div class="dashboard-stat-icon icon-degraded">
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><line x1="14.83" y1="9.17" x2="9.17" y2="14.83"/><line x1="9.17" y1="9.17" x2="14.83" y2="14.83"/></svg>
    </div>
    <span class="dashboard-stat-label">Degraded Zones</span>
    <span class="dashboard-stat-value red" id="statDegradedValue">&mdash;</span>
    <span class="dashboard-stat-hint" id="statDegradedHint"></span>
  </div>

</div>

<div class="dashboard-charts-row dashboard-charts-row-with-date">
  <div class="chart-card dashboard-date-picker">
    <p class="chart-card-title">Summary Date</p>
    <div id="dashboardDatePicker"></div>
  </div>
  <div class="chart-card chart-card-narrow">
    <p class="chart-card-title">Health Distribution</p>
    <div id="healthDonutChart"></div>
  </div>
  <div class="chart-card">
    <p class="chart-card-title">NDVI by Zone</p>
    <div id="ndviBarChart"></div>
  </div>
</div>

<p class="dashboard-section-title">Satellite &amp; Field Metrics</p>
<div class="dashboard-grid">

  <div class="dashboard-stat-card">
    <div class="dashboard-stat-icon">
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/></svg>
    </div>
    <span class="dashboard-stat-label">Average NDVI</span>
    <span class="dashboard-stat-value" id="statAvgNdviValue">&mdash;</span>
    <span class="dashboard-stat-hint">Scene-wide mean</span>
  </div>

  <div class="dashboard-stat-card">
    <div class="dashboard-stat-icon">
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 22v-6.5"/><path d="M7 12.5a5 5 0 1 1 10 0c0 3.2-5 6.5-5 6.5s-5-3.3-5-6.5Z"/><path d="M9.5 7a2.5 2.5 0 1 1 5 0c0 1.7-2.5 3.3-2.5 3.3S9.5 8.7 9.5 7Z"/></svg>
    </div>
    <span class="dashboard-stat-label">Average Canopy Cover</span>
    <span class="dashboard-stat-value" id="statAvgCanopyValue">&mdash;</span>
    <span class="dashboard-stat-hint" id="statAvgCanopyHint"></span>
  </div>

  <div class="dashboard-stat-card">
    <div class="dashboard-stat-icon">
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M9 2h6a1 1 0 0 1 1 1v2H8V3a1 1 0 0 1 1-1Z"/><path d="M8 4H6a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V6a2 2 0 0 0-2-2h-2"/><line x1="8" y1="12" x2="16" y2="12"/><line x1="8" y1="16" x2="13" y2="16"/></svg>
    </div>
    <span class="dashboard-stat-label">Total Field Surveys</span>
    <span class="dashboard-stat-value" id="statTotalSurveysValue">&mdash;</span>
    <span class="dashboard-stat-hint">KoboToolbox submissions</span>
  </div>

  <div class="dashboard-stat-card">
    <div class="dashboard-stat-icon">
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="4.5" width="18" height="16" rx="2"/><line x1="16" y1="2.5" x2="16" y2="6.5"/><line x1="8" y1="2.5" x2="8" y2="6.5"/><line x1="3" y1="10" x2="21" y2="10"/></svg>
    </div>
    <span class="dashboard-stat-label">Latest Inspection</span>
    <span class="dashboard-stat-value date-value" id="statLatestInspectionValue">&mdash;</span>
    <span class="dashboard-stat-hint">Most recent ranger visit</span>
  </div>

</div>

<p class="dashboard-section-title">This Week's Field Submissions</p>
<div class="chart-card survey-log-panel">
  <div class="week-summary-head" id="weekSummaryHead" hidden>
    <span class="week-summary-range" id="weekSummaryRange"></span>
    <span class="week-summary-count" id="weekSummaryCount"></span>
  </div>
  <div class="survey-log-cards" id="weekSummaryCards"></div>
  <div class="dashboard-empty" id="weekSummaryEmpty" hidden>No field surveys gathered this week.</div>
  <div class="dashboard-empty" id="noSurveyDatesEmpty" hidden>No field survey submissions recorded yet.</div>
</div>

<div class="dashboard-charts-row dashboard-charts-row-reverse">
  <div class="chart-card">
    <p class="chart-card-title">Average NDVI Trend</p>
    <div id="ndviTrendChart"></div>
  </div>
  <div class="chart-card chart-card-narrow">
    <p class="chart-card-title">Observed Threats</p>
    <div id="threatBarChart"></div>
  </div>
</div>

<p class="dashboard-section-title">Field Survey Insights</p>
<div class="dashboard-charts-row-3">
  <div class="chart-card">
    <p class="chart-card-title">Canopy Cover Distribution</p>
    <div id="canopyBucketsChart"></div>
  </div>
  <div class="chart-card">
    <p class="chart-card-title">Water Color</p>
    <div id="waterColorChart"></div>
  </div>
  <div class="chart-card">
    <p class="chart-card-title">Nearby Aquafarm Activity</p>
    <div id="aquafarmChart"></div>
  </div>
</div>
