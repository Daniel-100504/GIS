<?php
require_once __DIR__ . '/../../Login/Database/session-init.php';
if (!isset($_SESSION['user']) || $_SESSION['user']['role'] !== 'menro') {
    header('Location: ../../Login/Login.php');
    exit;
}
?>
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0"/>
  <title>AquaGuard – Mangrove Monitoring</title>

  <link rel="stylesheet"
        href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css"/>
  <link rel="stylesheet"
        href="https://unpkg.com/leaflet-draw@1.0.4/dist/leaflet.draw.css"/>

  <link rel="preconnect" href="https://fonts.googleapis.com"/>
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin/>
  <!-- Used only by the exported PDF's "Annual Monitoring Data Sheet" template,
       to match the official paper form's own typography. -->
  <link href="https://fonts.googleapis.com/css2?family=Source+Sans+3:wght@400;600;700&family=Source+Serif+4:opsz,wght@8..60,700&display=swap" rel="stylesheet"/>

  <link rel="icon" href="../../assets/calatagan-seal.png"/>

        <link rel="stylesheet" href="../../assets/theme.css"/>
        <link rel="stylesheet" href="../css/style.css?v=33"/>
        <link rel="stylesheet" href="../css/right-panel.css?v=4"/>
        <link rel="stylesheet" href="../css/side-menu.css?v=7"/>
        <link rel="stylesheet" href="../css/Dashboard.css?v=78"/>
</head>

<body>

<header class="topbar">

    <div class="topbar-left">

        <button class="map-menu-btn" id="btnMapMenu" aria-label="Open menu">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round">
            <line x1="3" y1="6" x2="21" y2="6"/>
            <line x1="3" y1="12" x2="21" y2="12"/>
            <line x1="3" y1="18" x2="21" y2="18"/>
          </svg>
        </button>

        <img src="../../assets/calatagan-seal.png" width="34" height="34" alt="Calatagan Seal" class="topbar-logo">

        <span class="topbar-brand">
            AquaGuard
        </span>

    </div>

    <div class="topbar-right">

        <button type="button" class="notif-btn" id="btnHelpGuide" aria-label="Open user guide">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
                <circle cx="12" cy="12" r="10" />
                <path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3" />
                <line x1="12" y1="17" x2="12.01" y2="17" />
            </svg>
        </button>

        <div class="notif-wrap" id="notifWrap">
            <button type="button" class="notif-btn" id="notifBtn" aria-label="Notifications" aria-expanded="false">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                    <path d="M18 8a6 6 0 0 0-12 0c0 7-3 9-3 9h18s-3-2-3-9"/>
                    <path d="M13.73 21a2 2 0 0 1-3.46 0"/>
                </svg>
                <span class="notif-count" id="notifCount" hidden>0</span>
            </button>
            <div class="notif-panel" id="notifPanel">
                <div class="notif-panel-header">
                    <span>New Submissions</span>
                    <button type="button" class="notif-clear" id="notifClearBtn">Mark all read</button>
                </div>
                <div class="notif-list" id="notifList">
                    <div class="notif-empty">No new submissions</div>
                </div>
            </div>
        </div>

        <span class="badge-pill online" id="connectionStatus" title="Connection to AquaGuard services">
            <svg class="icon" id="connectionStatusIcon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <path d="M5 12.5a10 10 0 0 1 14 0"/>
              <path d="M8.5 16a5 5 0 0 1 7 0"/>
              <line x1="12" y1="19.5" x2="12.01" y2="19.5"/>
            </svg>
            <span id="connectionStatusText">Online</span>
        </span>

    </div>

</header>

<div class="layout" id="mapView">

<main class="map-container">

<div id="map"></div>

<div class="map-layers-control" id="mapLayersControl">

    <button class="layers-toggle-btn" id="layersToggleBtn" aria-label="Switch to satellite view" aria-expanded="false" title="Click to switch map/satellite view">
        <span class="layers-toggle-thumb" id="layersToggleThumb"></span>
        <span class="layers-toggle-label" id="layersToggleLabel">Satellite</span>
    </button>

    <div class="layers-popup">

        <div class="layer-tile-grid">

            <label class="layer-tile">
                <input type="checkbox" id="layerSentinel2" class="layer-tile-input">
                <span class="layer-tile-icon layer-tile-icon-sentinel" aria-hidden="true">
                    <span class="layer-tile-art"></span>
                    <span class="layer-tile-badge">
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/><path d="M21 15l-5-5L5 21"/></svg>
                    </span>
                </span>
                <span class="layer-tile-label">Sentinel-2</span>
            </label>

            <label class="layer-tile">
                <input type="checkbox" id="layerNdviOverlay" class="layer-tile-input">
                <span class="layer-tile-icon layer-tile-icon-ndvi" aria-hidden="true">
                    <span class="layer-tile-art"></span>
                    <span class="layer-tile-badge">
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 22s8-9 8-14a8 8 0 1 0-16 0c0 5 8 14 8 14Z"/><circle cx="12" cy="8" r="3"/></svg>
                    </span>
                </span>
                <span class="layer-tile-label">NDVI Overlay</span>
            </label>

            <label class="layer-tile">
                <input type="checkbox" id="layerFieldMangroves" class="layer-tile-input" checked>
                <span class="layer-tile-icon layer-tile-icon-fieldmap" aria-hidden="true">
                    <span class="layer-tile-art"></span>
                    <span class="layer-tile-badge">
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 19l7-7 3 3-7 7-3-3z"/><path d="M18 13l-1.5-7.5L2 2l3.5 14.5L13 18l5-5z"/></svg>
                    </span>
                </span>
                <span class="layer-tile-label">Mangroves</span>
            </label>

        </div>

    </div>

</div>

<div class="map-legend">
    <div id="legendAreaType">
        <p class="map-legend-title">Area Type</p>
        <div class="map-legend-row"><span class="map-legend-dot" style="background:#8a2be2;"></span>Mangroves</div>
        <div class="map-legend-row"><span class="map-legend-dot" style="background:#ffd166;border:1.5px solid #b8860b;"></span>Protected Areas</div>
    </div>

    <div id="legendNdvi" hidden>
        <p class="map-legend-title" style="margin-top:8px;">NDVI</p>
        <div class="map-legend-row"><span class="map-legend-dot" style="background:#bfbfbf;"></span>Bare / No Vegetation</div>
        <div class="map-legend-row"><span class="map-legend-dot" style="background:#91bf51;"></span>Sparse Vegetation</div>
        <div class="map-legend-row"><span class="map-legend-dot" style="background:#004400;"></span>Dense Vegetation</div>
    </div>

</div>

</main>
<div class="resizer right-resizer"></div>

<aside class="right-panel">

    <p class="section-eyebrow">

        IMAGERY SETTINGS

    </p>

    <div class="settings-group">

        <span class="settings-label">

            Scene Date

        </span>

<input type="hidden" id="sceneDate">

    <div class="scene-calendar">

        <div class="scene-calendar-header">
            <button type="button" id="calMonthPrev" class="date-nav-btn" aria-label="Previous month">
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round"><polyline points="15 18 9 12 15 6"/></svg>
            </button>

            <div class="scene-calendar-title-controls">
                <select id="calMonthSelect" class="cal-select" aria-label="Month"></select>
                <select id="calYearSelect" class="cal-select" aria-label="Year"></select>
            </div>

            <button type="button" id="calMonthNext" class="date-nav-btn" aria-label="Next month">
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round"><polyline points="9 18 15 12 9 6"/></svg>
            </button>
        </div>

        <div class="scene-calendar-weekdays">
            <span>Su</span><span>Mo</span><span>Tu</span><span>We</span><span>Th</span><span>Fr</span><span>Sa</span>
        </div>

        <div class="scene-calendar-grid" id="calGrid"></div>

        <div class="scene-calendar-legend">
            <span><i class="cal-dot cal-dot-available"></i> Imagery available</span>
            <span><i class="cal-dot cal-dot-selected"></i> Selected</span>
        </div>

    </div>

    </div>

    <div class="settings-group">

        <p class="section-eyebrow">

            MANGROVE ZONES

        </p>

        <div class="zone-search-wrap">

            <input
                type="text"
                id="zoneSearch"
                class="zone-search"
                placeholder="Search zone..."
                autocomplete="off">

            <button
                type="button"
                id="zoneSearchClear"
                class="zone-search-clear"
                aria-label="Clear search"
                title="Clear search"
                hidden>
                &times;
            </button>

        </div>

        <div class="zone-controls-row">

            <select id="zoneStatusFilter" class="zone-control-select" aria-label="Filter by status">
                <option value="all">All Status</option>
                <option value="healthy">Good</option>
                <option value="moderate">Fair</option>
                <option value="degraded">Poor</option>
                <option value="pending">Pending</option>
            </select>

            <select id="zoneSort" class="zone-control-select" aria-label="Sort zones">
                <option value="name-asc">Name (A–Z)</option>
                <option value="name-desc">Name (Z–A)</option>
                <option value="ndvi-desc">NDVI (High–Low)</option>
                <option value="ndvi-asc">NDVI (Low–High)</option>
                <option value="area-desc">Area (Large–Small)</option>
                <option value="area-asc">Area (Small–Large)</option>
            </select>

        </div>

        <p id="zoneSearchHint" class="zone-search-hint">
            Type a zone name to filter
        </p>

        <div
            id="zoneList"
            class="zone-list">

        </div>

    </div>

</aside>

</div>

<div class="dashboard-overlay" id="mangroveNameOverlay">

  <div class="confirm-modal mangrove-form-modal">

    <button class="confirm-modal-close" id="btnCloseMangroveName" aria-label="Close">&times;</button>

    <h2 class="confirm-modal-title" id="mangroveNameModalTitle">Name this mangrove area</h2>
    <p class="confirm-modal-text" id="mangroveNameModalText">Give the area you just drew a short name so it can be identified later.</p>

    <label class="mangrove-field-label">
      Name
      <input type="text" id="mangroveNameInput" class="modal-text-input" placeholder="e.g. Barangay 3 Pob. mangrove patch" autocomplete="off">
    </label>
    <div class="mangrove-field-error" id="mangroveNameFieldError" hidden>This is a required field</div>

    <label class="mangrove-field-label">
      Category
    <select id="mangroveCategorySelect" class="modal-text-input">
      <option value="">Select category…</option>
      <option value="mangrove">Mangrove Forest Area</option>
      <option value="protected_area">Protected Area</option>
    </select>
    </label>
    <div class="mangrove-field-error" id="mangroveCategoryFieldError" hidden>This is a required field</div>

    <label class="mangrove-field-label">
      Barangay
    <select id="mangroveBarangaySelect" class="modal-text-input">
      <option value="">Select barangay…</option>
      <option value="Bagong Silang">Bagong Silang</option>
      <option value="Baha">Baha</option>
      <option value="Balibago">Balibago</option>
      <option value="Balitoc">Balitoc</option>
      <option value="Barangay 1">Barangay 1</option>
      <option value="Barangay 2">Barangay 2</option>
      <option value="Barangay 3">Barangay 3</option>
      <option value="Barangay 4">Barangay 4</option>
      <option value="Biga">Biga</option>
      <option value="Bucal">Bucal</option>
      <option value="Carlosa">Carlosa</option>
      <option value="Carretunan">Carretunan</option>
      <option value="Encarnacion">Encarnacion</option>
      <option value="Gulod">Gulod</option>
      <option value="Hukay">Hukay</option>
      <option value="Lucsuhin">Lucsuhin</option>
      <option value="Luya">Luya</option>
      <option value="Paraiso">Paraiso</option>
      <option value="Quilitisan">Quilitisan</option>
      <option value="Real">Real</option>
      <option value="Sambungan">Sambungan</option>
      <option value="Santa Ana">Santa Ana</option>
      <option value="Talibayog">Talibayog</option>
      <option value="Talisay">Talisay</option>
      <option value="Tanagan">Tanagan</option>
    </select>
    </label>
    <div class="mangrove-field-error" id="mangroveBarangayFieldError" hidden>This is a required field</div>

    <div id="mangroveNameErrorMsg" class="mangrove-form-error" role="alert" aria-live="polite" hidden></div>

    <div class="confirm-modal-actions">
      <button type="button" class="btn-confirm-cancel" id="btnCancelMangroveName">Cancel</button>
      <button type="button" class="btn-confirm-primary" id="btnSaveMangroveName">Save</button>
    </div>

  </div>

</div>

<div class="dashboard-overlay" id="mangroveDeleteOverlay">

  <div class="confirm-modal">

    <button class="confirm-modal-close" id="btnCloseMangroveDelete" aria-label="Close">&times;</button>

    <div class="confirm-modal-icon">
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
        <polyline points="3 6 5 6 21 6"/>
        <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/>
      </svg>
    </div>

    <h2 class="confirm-modal-title" id="mangroveDeleteModalTitle">Delete this mangrove area?</h2>
    <p class="confirm-modal-text">This can't be undone.</p>

    <div class="confirm-modal-actions">
      <button type="button" class="btn-confirm-cancel" id="btnCancelMangroveDelete">Cancel</button>
      <button type="button" class="btn-confirm-danger" id="btnConfirmMangroveDelete">Delete</button>
    </div>

  </div>

</div>

<div class="dashboard-overlay" id="guideOverlay">

  <div class="dashboard-modal guide-modal">

    <div class="dashboard-modal-header">
      <div>
        <h2>User Guide</h2>
        <p class="dashboard-modal-sub">A quick walkthrough for MENRO staff &amp; field personnel</p>
      </div>
      <button class="dashboard-close" id="btnCloseGuide" aria-label="Close guide">&times;</button>
    </div>

    <div class="dashboard-modal-body">

      <div class="guide-section">
        <div class="guide-section-title">Getting Started</div>

        <div class="guide-item">
          <div class="guide-icon">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <line x1="4" y1="20" x2="20" y2="20"/>
              <rect x="6" y="12" width="3.2" height="8"/>
              <rect x="11.4" y="7" width="3.2" height="13"/>
              <rect x="16.8" y="4" width="3.2" height="16"/>
            </svg>
          </div>
          <div class="guide-text">
            <h3>Dashboard</h3>
            <p>Open <strong>Dashboard</strong> to see a summary of zone health, NDVI, and surveys.</p>
          </div>
        </div>

        <div class="guide-item">
          <div class="guide-icon">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8Z"/>
              <polyline points="14 2 14 8 20 8"/>
              <path d="m9 15 2 2 4-4"/>
            </svg>
          </div>
          <div class="guide-text">
            <h3>Ranger Surveys</h3>
            <p>Open <strong>Ranger Surveys</strong> to see every field submission in one place. Use the tabs, search box, or filters to narrow the list. Click a row to open its full details and Approve or Reject it. Clicking a survey notification takes you straight to that submission.</p>
          </div>
        </div>

        <div class="guide-item">
          <div class="guide-icon">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <polygon points="3 6 9 3 15 6 21 3 21 18 15 21 9 18 3 21"/>
              <line x1="9" y1="3" x2="9" y2="18"/>
              <line x1="15" y1="6" x2="15" y2="21"/>
            </svg>
          </div>
          <div class="guide-text">
            <h3>Map</h3>
            <p>Scroll to zoom, drag to pan, or use the +/− controls.</p>
          </div>
        </div>

        <div class="guide-item">
          <div class="guide-icon">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <circle cx="11" cy="11" r="7"/>
              <line x1="21" y1="21" x2="16.65" y2="16.65"/>
            </svg>
          </div>
          <div class="guide-text">
            <h3>Search</h3>
            <p>Use the search box in the right panel to filter zones by barangay name.</p>
          </div>
        </div>
      </div>

      <div class="guide-section">
        <div class="guide-section-title">Working with Zones &amp; Data</div>

        <div class="guide-item">
          <div class="guide-icon">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <polygon points="12 2 2 7 12 12 22 7 12 2"/>
              <polyline points="2 17 12 22 22 17"/>
              <polyline points="2 12 12 17 22 12"/>
            </svg>
          </div>
          <div class="guide-text">
            <h3>Layers</h3>
            <p>Hover over the <strong>Layers</strong> button (bottom-left of the map) to turn Sentinel-2 imagery, the NDVI overlay, and Mangroves on or off. Click the button itself to switch between <strong>Map</strong> and <strong>Satellite</strong> view.</p>
          </div>
        </div>

        <div class="guide-item">
          <div class="guide-icon">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <path d="M12 22s8-9 8-14a8 8 0 1 0-16 0c0 5 8 14 8 14Z"/>
              <circle cx="12" cy="8" r="3"/>
            </svg>
          </div>
          <div class="guide-text">
            <h3>Selecting a Zone</h3>
            <p>Click a zone marker or list item to see its NDVI, health status, and field survey details.</p>
          </div>
        </div>

        <div class="guide-item">
          <div class="guide-icon">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <rect x="3" y="4" width="18" height="18" rx="2"/>
              <line x1="16" y1="2" x2="16" y2="6"/>
              <line x1="8" y1="2" x2="8" y2="6"/>
              <line x1="3" y1="10" x2="21" y2="10"/>
              <path d="M9 16l2 2 4-4"/>
            </svg>
          </div>
          <div class="guide-text">
            <h3>Satellite NDVI</h3>
            <p>Picking a Scene Date updates each zone's satellite NDVI in the background. This can take a moment.</p>
          </div>
        </div>

        <div class="guide-item">
          <div class="guide-icon">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <rect x="3" y="4" width="18" height="18" rx="2"/>
              <line x1="16" y1="2" x2="16" y2="6"/>
              <line x1="8" y1="2" x2="8" y2="6"/>
              <line x1="3" y1="10" x2="21" y2="10"/>
              <circle cx="9" cy="15" r="1.4" fill="currentColor" stroke="none"/>
              <circle cx="15" cy="15" r="1.4" fill="currentColor" stroke="none"/>
            </svg>
          </div>
          <div class="guide-text">
            <h3>Available Imagery Dates</h3>
            <p>Dates with satellite imagery are shaded green in the calendar. Click one to turn on the imagery right away.</p>
          </div>
        </div>

        <div class="guide-item">
          <div class="guide-icon">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <polyline points="23 4 23 10 17 10"/>
              <polyline points="1 20 1 14 7 14"/>
              <path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15"/>
            </svg>
          </div>
          <div class="guide-text">
            <h3>Field Surveys</h3>
            <p>A zone updates on its own the moment a ranger submits a field report.</p>
          </div>
        </div>
      </div>

      <div class="guide-section">
        <div class="guide-section-title">Reports &amp; Security</div>

        <div class="guide-item">
          <div class="guide-icon">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8Z"/>
              <polyline points="14 2 14 8 20 8"/>
              <line x1="12" y1="11" x2="12" y2="17"/>
              <polyline points="9.5 14.5 12 17 14.5 14.5"/>
            </svg>
          </div>
          <div class="guide-text">
            <h3>Export Report</h3>
            <p>Click <strong>Export Report</strong> on the Dashboard to open the PDF in your browser, then print or download it from there. Each field visit becomes its own Monitoring Data Sheet, matching MENRO's official paper form. Pick "This year" or "Last year" for a full Annual report. A visit with a lot of data automatically continues onto extra pages instead of being cut off.</p>
          </div>
        </div>

        <div class="guide-item">
          <div class="guide-icon">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <circle cx="12" cy="12" r="9"/>
              <polyline points="12 7 12 12 15.5 14"/>
            </svg>
          </div>
          <div class="guide-text">
            <h3>Auto Sign-Out</h3>
            <p>You'll be signed out after 15 minutes of inactivity, for security. A warning appears 30 seconds before — click <strong>Stay signed in</strong> to continue.</p>
          </div>
        </div>
      </div>

    </div>

  </div>

</div>

<div class="dashboard-overlay" id="rangerSubmissionsOverlay">

  <div class="dashboard-modal">

    <div class="dashboard-modal-header">
      <div>
        <h2 id="rangerSubmissionsTitle">Ranger</h2>
        <p class="dashboard-modal-sub" id="rangerSubmissionsSub">All field survey submissions</p>
      </div>
      <button class="dashboard-close" id="btnCloseRangerSubmissions" aria-label="Close">&times;</button>
    </div>

    <div class="dashboard-modal-body">
      <div class="survey-log-table-wrap">
        <table class="survey-log-table">
          <colgroup>
            <col style="width:11%;">
            <col style="width:24%;">
            <col style="width:12%;">
            <col style="width:20%;">
            <col style="width:18%;">
            <col style="width:15%;">
          </colgroup>
          <thead>
            <tr>
              <th>Date</th>
              <th>Protected Area</th>
              <th class="cell-center">Trees Measured</th>
              <th>Species</th>
              <th class="cell-center">Aquafarm Nearby</th>
              <th class="cell-center">Status</th>
            </tr>
          </thead>
          <tbody id="rangerSubmissionsBody"></tbody>
        </table>
      </div>
      <div class="dashboard-empty" id="rangerSubmissionsEmpty" hidden>No submissions found for this ranger.</div>
    </div>

  </div>

</div>

<div class="dashboard-overlay" id="submissionDetailOverlay">

  <div class="dashboard-modal view-modal">

    <div class="dashboard-modal-header view-modal-header">
      <div>
        <h2>Field submission details</h2>
        <p class="dashboard-modal-sub" id="submissionDetailSub">—</p>
      </div>
      <div class="view-modal-header-right">
        <span class="threat-tag" id="submissionDetailBadge">—</span>
        <button class="dashboard-close" id="btnCloseSubmissionDetail" aria-label="Close">&times;</button>
      </div>
    </div>

    <div class="dashboard-modal-body view-body" id="submissionDetailBody"></div>

    <div class="submission-detail-footer">
      <div class="submission-detail-reject-panel" id="rejectNotesPanel" hidden>
        <textarea class="reject-notes-input" id="rejectNotesInput" rows="2" placeholder="Add a note for the ranger (optional)"></textarea>
        <div class="submission-detail-actions">
          <button type="button" class="btn-confirm-cancel" id="btnCancelReject">Cancel</button>
          <button type="button" class="btn-confirm-danger" id="btnConfirmReject">Confirm Rejection</button>
        </div>
      </div>
      <div class="submission-detail-footer-main" id="submissionDetailFooterMain">
        <span class="submission-detail-approval" id="submissionDetailApproval">—</span>
      </div>
    </div>

  </div>

</div>

<div class="dashboard-overlay" id="confirmReviewOverlay">

  <div class="confirm-modal">

    <button class="confirm-modal-close" id="btnCloseConfirmReview" aria-label="Close">&times;</button>

    <div class="confirm-modal-icon" id="confirmReviewIcon">
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" id="confirmReviewIconSvg">
        <path d="M20 6 9 17l-5-5"/>
      </svg>
    </div>

    <h2 class="confirm-modal-title" id="confirmReviewTitle">—</h2>
    <p class="confirm-modal-text" id="confirmReviewText">—</p>

    <div class="confirm-modal-actions">
      <button type="button" class="btn-confirm-cancel" id="btnCancelConfirmReview">Cancel</button>
      <button type="button" class="btn-confirm-primary" id="btnConfirmReview">Confirm</button>
    </div>

  </div>

</div>

<div class="dashboard-overlay" id="signOutOverlay">

  <div class="confirm-modal">

    <button class="confirm-modal-close" id="btnCloseSignOut" aria-label="Close">&times;</button>

    <div class="confirm-modal-icon">
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
        <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/>
        <polyline points="16 17 21 12 16 7"/>
        <line x1="21" y1="12" x2="9" y2="12"/>
      </svg>
    </div>

    <h2 class="confirm-modal-title">Sign out of AquaGuard?</h2>
    <p class="confirm-modal-text">You'll need to sign in again to access the dashboard and map.</p>

    <div class="confirm-modal-actions">
      <button type="button" class="btn-confirm-cancel" id="btnCancelSignOut">Cancel</button>
      <button type="button" class="btn-confirm-danger" id="btnConfirmSignOut">Sign Out</button>
    </div>

  </div>

</div>

<div class="dashboard-overlay" id="exportReportOverlay">

  <div class="confirm-modal export-modal">

    <button class="confirm-modal-close" id="btnCloseExportReport" aria-label="Close">&times;</button>

    <div class="confirm-modal-icon export-modal-icon">
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
        <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8Z"/>
        <polyline points="14 2 14 8 20 8"/>
        <line x1="12" y1="11" x2="12" y2="17"/>
        <polyline points="9.5 14.5 12 17 14.5 14.5"/>
      </svg>
    </div>

    <h2 class="confirm-modal-title">Export Field Survey Report</h2>
    <p class="confirm-modal-text">Download all recorded field survey submissions as a PDF.</p>

    <div class="export-daterange-group">
      <label for="exportDateRange" class="export-daterange-label">Date range</label>
      <select id="exportDateRange" class="export-daterange-select">
        <option value="all" selected>All time</option>
        <option value="today">Today</option>
        <option value="7days">Last 7 days</option>
        <option value="30days">Last 30 days</option>
        <option value="thisyear">This year</option>
        <option value="lastyear">Last year</option>
        <option value="custom">Custom range</option>
      </select>
      <div class="export-daterange-custom" id="exportDateCustom" hidden>
        <input type="date" id="exportDateFrom" class="export-date-input">
        <span class="export-daterange-sep">to</span>
        <input type="date" id="exportDateTo" class="export-date-input">
      </div>
    </div>

    <div class="confirm-modal-actions">
      <button type="button" class="btn-confirm-cancel" id="btnCancelExportReport">Cancel</button>
      <button type="button" class="btn-confirm-primary" id="btnConfirmExportReport">Export</button>
    </div>

  </div>

</div>

<section class="dashboard-view" id="dashboardView">

  <div class="dashboard-view-inner" id="dashboardBody">

  </div>

</section>

<section class="dashboard-view" id="surveysView">

  <div class="dashboard-view-inner" id="surveysBody">

  </div>

</section>

<div class="side-menu-backdrop" id="sideMenuBackdrop"></div>

<aside class="side-menu" id="sideMenu">

  <div class="side-menu-header">
    <div class="side-menu-brand-group">
      <img src="../../assets/calatagan-seal.png" width="30" height="30" alt="Calatagan Seal" class="side-menu-logo">
      <span class="side-menu-brand">AquaGuard</span>
    </div>
    <button class="side-menu-close" id="btnCloseSideMenu" aria-label="Close menu">&times;</button>
  </div>

  <div class="side-menu-body">

    <button class="side-menu-item active" id="menuMap">
      <span class="side-menu-icon">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <polygon points="3 6 9 3 15 6 21 3 21 18 15 21 9 18 3 21"/>
          <line x1="9" y1="3" x2="9" y2="18"/>
          <line x1="15" y1="6" x2="15" y2="21"/>
        </svg>
      </span>
      <span>Map</span>
    </button>

    <button class="side-menu-item" id="menuDashboard">
      <span class="side-menu-icon">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <line x1="4" y1="20" x2="20" y2="20"/>
          <rect x="6" y="12" width="3.2" height="8"/>
          <rect x="11.4" y="7" width="3.2" height="13"/>
          <rect x="16.8" y="4" width="3.2" height="16"/>
        </svg>
      </span>
      <span>Dashboard</span>
    </button>

    <button class="side-menu-item" id="menuSurveys">
      <span class="side-menu-icon">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8Z"/>
          <polyline points="14 2 14 8 20 8"/>
          <path d="m9 15 2 2 4-4"/>
        </svg>
      </span>
      <span>Ranger Surveys</span>
    </button>

  </div>

  <div class="side-menu-footer">
    <div class="side-menu-account">
      <div class="side-menu-avatar" id="sideMenuAvatar">M</div>
      <div class="side-menu-account-info">
        <span class="side-menu-account-name" id="sideMenuAccountName">MENRO</span>
        <span class="side-menu-account-role">Calatagan, Batangas</span>
      </div>
    </div>

    <button class="side-menu-item side-menu-signout" id="menuSignOut">
      <span class="side-menu-icon">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/>
          <polyline points="16 17 21 12 16 7"/>
          <line x1="21" y1="12" x2="9" y2="12"/>
        </svg>
      </span>
      <span>Sign Out</span>
    </button>
  </div>

</aside>

<div class="mangrove-edit-panel" id="verifiedEditPanel" hidden>
  <div class="mangrove-edit-panel-title">Editing shape</div>
  <p class="mangrove-edit-panel-hint">Drag the shape's corner points on the map to correct its boundary. Update the name below if needed.</p>
  <input type="text" id="verifiedEditNameInput" class="modal-text-input" placeholder="Name" autocomplete="off">
  <div class="mangrove-edit-panel-actions">
    <button type="button" class="btn-confirm-cancel" id="btnCancelVerifiedEdit">Cancel</button>
    <button type="button" class="btn-confirm-primary" id="btnSaveVerifiedEdit">Save</button>
  </div>
</div>

<div class="dashboard-overlay" id="mangroveQuickEditOverlay">
<div class="mangrove-edit-panel mangrove-edit-panel-wide mangrove-edit-panel-modal" id="mangroveQuickEditPanel">
  <div class="mangrove-edit-panel-title">Edit mangrove area details</div>
  <p class="mangrove-edit-panel-hint">Update the name, barangay, or category below.</p>

  <label class="mangrove-field-label">
    Name
    <input type="text" id="mangroveQuickEditNameInput" class="modal-text-input" autocomplete="off">
  </label>

  <label class="mangrove-field-label">
    Category
    <select id="mangroveQuickEditCategorySelect" class="modal-text-input">
      <option value="">Select category…</option>
      <option value="mangrove">Mangrove Forest Area</option>
      <option value="protected_area">Protected Area</option>
    </select>
  </label>

  <label class="mangrove-field-label">
    Barangay
    <select id="mangroveQuickEditBarangaySelect" class="modal-text-input">
      <option value="">Select barangay…</option>
      <option value="Bagong Silang">Bagong Silang</option>
      <option value="Baha">Baha</option>
      <option value="Balibago">Balibago</option>
      <option value="Balitoc">Balitoc</option>
      <option value="Barangay 1">Barangay 1</option>
      <option value="Barangay 2">Barangay 2</option>
      <option value="Barangay 3">Barangay 3</option>
      <option value="Barangay 4">Barangay 4</option>
      <option value="Biga">Biga</option>
      <option value="Bucal">Bucal</option>
      <option value="Carlosa">Carlosa</option>
      <option value="Carretunan">Carretunan</option>
      <option value="Encarnacion">Encarnacion</option>
      <option value="Gulod">Gulod</option>
      <option value="Hukay">Hukay</option>
      <option value="Lucsuhin">Lucsuhin</option>
      <option value="Luya">Luya</option>
      <option value="Paraiso">Paraiso</option>
      <option value="Quilitisan">Quilitisan</option>
      <option value="Real">Real</option>
      <option value="Sambungan">Sambungan</option>
      <option value="Santa Ana">Santa Ana</option>
      <option value="Talibayog">Talibayog</option>
      <option value="Talisay">Talisay</option>
      <option value="Tanagan">Tanagan</option>
    </select>
  </label>

  <div class="mangrove-edit-panel-actions">
    <button type="button" class="btn-confirm-cancel" id="btnCancelMangroveQuickEdit">Cancel</button>
    <button type="button" class="btn-confirm-primary" id="btnSaveMangroveQuickEdit">Save</button>
  </div>
</div>
</div>

<script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js"></script>
<script src="https://unpkg.com/leaflet-draw@1.0.4/dist/leaflet.draw.js"></script>
<script src="https://cdnjs.cloudflare.com/ajax/libs/jspdf/4.2.1/jspdf.umd.min.js"></script>
<script src="https://cdnjs.cloudflare.com/ajax/libs/jspdf-autotable/5.0.8/jspdf.plugin.autotable.min.js"></script>
<script src="https://cdnjs.cloudflare.com/ajax/libs/html2canvas/1.4.1/html2canvas.min.js"></script>
<script src="../../assets/utils.js?v=1"></script>
<script src="../API/zones-data.php?v=9"></script>
<script src="../js/map-core.js?v=20"></script>
<script src="../js/mangrove-draw.js?v=34"></script>
<script src="../js/verified-layers-edit.js?v=3"></script>
<script src="../js/zones-panel.js?v=9"></script>
<script src="../js/scene-calendar.js?v=9"></script>
<script src="../js/export-report.js?v=28"></script>
<script src="../js/ui-chrome.js?v=9"></script>
<script src="../js/Dashboard.js?v=78"></script>
<script src="../js/notifications.js?v=12"></script>

</body>
</html>