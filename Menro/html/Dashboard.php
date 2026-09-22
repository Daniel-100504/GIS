<?php
session_start();
if (!isset($_SESSION['user']) || $_SESSION['user']['role'] !== 'menro') {
    header('Location: ../../Login/Login.php');
    exit;
}
?>
<div class="dashboard-header">
  <div class="dashboard-header-badge">
    <img src="../../assets/calatagan-seal.png" width="48" height="48" alt="Calatagan Seal">
  </div>
  <div>
    <h2 class="dashboard-page-title">Mangrove Monitoring Dashboard</h2>
    <div class="dashboard-meta-row">
      <span>MENRO Calatagan &middot; Batangas</span>
    </div>
  </div>
  <div class="dashboard-header-inspection">
    <div class="dashboard-header-inspection-icon">
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="4.5" width="18" height="16" rx="2"/><line x1="16" y1="2.5" x2="16" y2="6.5"/><line x1="8" y1="2.5" x2="8" y2="6.5"/><line x1="3" y1="10" x2="21" y2="10"/></svg>
    </div>
    <div>
      <span class="dashboard-header-inspection-label">Latest Inspection</span>
      <span class="dashboard-header-inspection-value" id="statLatestInspectionValue">&mdash;</span>
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
    <span class="dashboard-stat-label">Good Zones</span>
    <span class="dashboard-stat-value" id="statHealthyValue">&mdash;</span>
    <span class="dashboard-stat-hint" id="statHealthyHint"></span>
  </div>

  <div class="dashboard-stat-card accent-moderate">
    <div class="dashboard-stat-icon icon-moderate">
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0Z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>
    </div>
    <span class="dashboard-stat-label">Fair Zones</span>
    <span class="dashboard-stat-value amber" id="statModerateValue">&mdash;</span>
    <span class="dashboard-stat-hint" id="statModerateHint"></span>
  </div>

  <div class="dashboard-stat-card accent-degraded">
    <div class="dashboard-stat-icon icon-degraded">
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><line x1="14.83" y1="9.17" x2="9.17" y2="14.83"/><line x1="9.17" y1="9.17" x2="14.83" y2="14.83"/></svg>
    </div>
    <span class="dashboard-stat-label">Poor Zones</span>
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
    <div class="chart-card-header-row">
      <p class="chart-card-title">NDVI by Zone</p>
      <span class="chart-card-corner-stat">Avg NDVI <strong id="statAvgNdviValue">&mdash;</strong></span>
    </div>
    <div id="ndviBarChart"></div>
  </div>
</div>

<p class="dashboard-section-title">This Week's Field Submissions</p>
<div class="chart-card survey-log-panel">
  <div class="week-summary-head" id="weekSummaryHead" hidden>
    <span class="week-summary-range" id="weekSummaryRange"></span>
    <span class="week-summary-count" id="weekSummaryCount"></span>
  </div>
  <div class="survey-log-table-wrap">
    <table class="survey-log-table">
      <thead>
        <tr>
          <th>Protected Area</th>
          <th>Ranger</th>
          <th>Trees Measured</th>
          <th>Species</th>
          <th>Aquafarm Nearby</th>
        </tr>
      </thead>
      <tbody id="weekSummaryCards"></tbody>
    </table>
  </div>
  <div class="dashboard-empty" id="weekSummaryEmpty" hidden>No field surveys gathered this week.</div>
  <div class="dashboard-empty" id="noSurveyDatesEmpty" hidden>No field survey submissions recorded yet.</div>
</div>
