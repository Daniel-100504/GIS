<?php
require_once __DIR__ . '/../../Login/Database/session-init.php';
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
  <button type="button" class="dashboard-header-export-btn" id="dashboardExportBtn">
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8Z"/><polyline points="14 2 14 8 20 8"/><line x1="12" y1="11" x2="12" y2="17"/><polyline points="9.5 14.5 12 17 14.5 14.5"/></svg>
    <span>Export Report</span>
  </button>
</div>

<div class="dashboard-grid">

  <div class="dashboard-stat-card dashboard-stat-total accent-brand-solid">
    <div class="dashboard-stat-icon">
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polygon points="3 6 9 3 15 6 21 3 21 18 15 21 9 18 3 21"/><line x1="9" y1="3" x2="9" y2="18"/><line x1="15" y1="6" x2="15" y2="21"/></svg>
    </div>
    <span class="dashboard-stat-label">Total Mangrove Zones</span>
    <span class="dashboard-stat-value" id="statTotalZonesValue">&mdash;</span>
    <span class="dashboard-stat-hint" id="statTotalZonesHint"></span>
  </div>

  <div class="dashboard-stat-card dashboard-stat-good accent-healthy">
    <div class="dashboard-stat-icon icon-healthy">
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 22c0-4 3-5 3-9a3 3 0 0 0-6 0c0 4 3 5 3 9Z"/><path d="M12 13V3"/><path d="M12 7 8 3"/><path d="M12 9 17 4"/></svg>
    </div>
    <span class="dashboard-stat-label">Good Zones</span>
    <span class="dashboard-stat-value" id="statHealthyValue">&mdash;</span>
    <span class="dashboard-stat-hint" id="statHealthyHint"></span>
  </div>

  <div class="dashboard-stat-card dashboard-stat-fair accent-moderate">
    <div class="dashboard-stat-icon icon-moderate">
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0Z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>
    </div>
    <span class="dashboard-stat-label">Fair Zones</span>
    <span class="dashboard-stat-value amber" id="statModerateValue">&mdash;</span>
    <span class="dashboard-stat-hint" id="statModerateHint"></span>
  </div>

  <div class="dashboard-stat-card dashboard-stat-poor accent-degraded">
    <div class="dashboard-stat-icon icon-degraded">
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><line x1="14.83" y1="9.17" x2="9.17" y2="14.83"/><line x1="9.17" y1="9.17" x2="14.83" y2="14.83"/></svg>
    </div>
    <span class="dashboard-stat-label">Poor Zones</span>
    <span class="dashboard-stat-value red" id="statDegradedValue">&mdash;</span>
    <span class="dashboard-stat-hint" id="statDegradedHint"></span>
  </div>

</div>

<div class="dashboard-bento-row dashboard-bento-row-tall">
  <div class="chart-card dashboard-date-picker">
    <p class="chart-card-title">Summary Date</p>
    <div id="dashboardDatePicker"></div>
  </div>
  <div class="chart-card dashboard-ndvi-card">
    <div class="chart-card-header-row">
      <p class="chart-card-title">NDVI by Zone</p>
      <span class="chart-card-corner-stat">Avg NDVI <strong id="statAvgNdviValue">&mdash;</strong></span>
    </div>
    <div id="ndviBarChart"></div>
  </div>
  <div class="chart-card dashboard-threats-card">
    <p class="chart-card-title">Threats Over Time</p>
    <div id="threatsOverTimeChart"></div>
  </div>
</div>

<div class="dashboard-bento-row dashboard-bento-row-compact">
  <div class="chart-card chart-card-narrow dashboard-donut-card">
    <p class="chart-card-title">Health Distribution</p>
    <div id="healthDonutChart"></div>
  </div>
  <div class="chart-card dashboard-alerts-card">
    <p class="chart-card-title">Threats &amp; Alerts</p>
    <div class="alert-card-list" id="alertsCardList"></div>
    <div class="dashboard-empty" id="alertsEmpty" hidden>No threats or alerts reported.</div>
  </div>
</div>
