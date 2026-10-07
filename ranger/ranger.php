<?php
require_once __DIR__ . '/../Login/Database/session-init.php';
if (!isset($_SESSION['user']) || $_SESSION['user']['role'] !== 'ranger') {
    header('Location: ../Login/Login.php');
    exit;
}

// Shared list so the species dropdowns (mature/seedling/sapling, in both the
// survey form and the edit form) all offer the same choices — sourced from
// the Municipality of Calatagan Forest Land Use Plan 2023-2027 (Table 5.2.3.1,
// Flora Species stated by the Stakeholders during the Workshop).
$mangroveSpeciesList = [
    'Anonang (Cordia dichotoma)',
    'Antipolo (Artocarpus blancoi)',
    'Aroma (Acacia farnesiana)',
    'Bakawan babae (Rhizophora mucronata)',
    'Bakawan bato (Rhizophora stylosa)',
    'Bakawan lalaki (Rhizophora apiculata)',
    'Bamboo species',
    'Bangkal (Nauclea orientalis)',
    'Bangkoro (Morinda citrifolia)',
    'Bayabas (Psidium guajava)',
    'Bignay (Antidesma bunius)',
    'Buboi-gubat (Ceiba pentandra)',
    'Buli (Corypha elata)',
    'Caballero (Caesalpinia pulcherrima)',
    'Calachuchi (Plumeria sp.)',
    'Dapo',
    'Dayumaka',
    'Duhat (Syzygium cumini)',
    'Himbabao (Broussonetia luzonica)',
    'Ipil-ipil (Leucaena leucocephala)',
    'Kakawate (Gliricidia sepium)',
    'Kalapinay (Avicennia marina)',
    'Kalumpang (Sterculia foetida)',
    'Kalumpit (Terminalia microcarpa)',
    'Kamatsili (Pithecellobium dulce)',
    'Kampupot (Tabernaemontana pandacaqui)',
    'Kasoy (Anacardium occidentale)',
    'Lato / seaweed (Caulerpa lentillifera)',
    'Ligas (Semecarpus cuneiformis)',
    'Mahogany (Swietenia macrophylla)',
    'Molawin (Vitex parviflora)',
    'Narra (Pterocarpus indicus)',
    'Nipa / Sasa (Nypa fruticans)',
    'Pagatpat (Sonneratia alba)',
    'Pakpak-lawin (Drynaria quercifolia)',
    'Paper tree / mulberry (Broussonetia papyrifera)',
    'Pong-apong (Amorphophallus paeoniifolius)',
    'Rain tree (Samanea saman)',
    'Rubber tree (Hevea brasiliensis)',
    'Saga (Adenanthera pavonina)',
    'Saging-saging (Aegiceras corniculatum)',
    'Susong-kalabaw (Uvaria rufa)',
    'Talisay (Terminalia catappa)',
    'Taluto (Pterocybium tinctorium)',
    'Usiw',
];
$mangroveSpeciesOptions = '<option value="">Select…</option>';
foreach ($mangroveSpeciesList as $sp) {
    $mangroveSpeciesOptions .= '<option value="' . htmlspecialchars($sp) . '">' . htmlspecialchars($sp) . '</option>';
}
$mangroveSpeciesOptions .= '<option value="__other__">Other (specify)</option>';

// Same idea for mollusk sightings — sourced from Table 5.2.3.2, Faunal
// Species stated by the Stakeholders during the Workshop (only the entry
// that's actually a mollusk/shell; the rest of that table is birds, reptiles,
// and mammals and doesn't belong under this field).
$molluskSpeciesList = [
    'Bakuku / Mangrove mud creeper (Terebralia palustris)',
    'Kapis / Windowpane oyster (Placuna placenta)',
    'Kuhol-dagat / Mangrove snail (Cerithidea cingulata)',
    'Lokan / Mud clam (Polymesoda erosa)',
    'Sihi / Halaan (Lajonkairia lajonkairii)',
    'Suso / Nerite (Nerita spp.)',
    'Talaba / Mangrove oyster (Crassostrea iredalei)',
    'Tulya / Asian clam (Corbicula fluminea)',
];
$molluskSpeciesOptions = '<option value="">Select…</option>';
foreach ($molluskSpeciesList as $sp) {
    $molluskSpeciesOptions .= '<option value="' . htmlspecialchars($sp) . '">' . htmlspecialchars($sp) . '</option>';
}
$molluskSpeciesOptions .= '<option value="__other__">Other (specify)</option>';
?>
<!DOCTYPE html>
<html lang="en">

<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>AquaGuard – Ranger Dashboard</title>
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link rel="preconnect" href="https://tile.openstreetmap.org">
  <link rel="preconnect" href="https://a.tile.openstreetmap.org">
  <link rel="preconnect" href="https://b.tile.openstreetmap.org">
  <link rel="preconnect" href="https://c.tile.openstreetmap.org">
  <link
    href="https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@400;500;600;700&family=Inter:wght@400;500;600&display=swap"
    rel="stylesheet">
  <link rel="stylesheet" href="../assets/theme.css" />
  <link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css" />
  <link rel="stylesheet" href="ranger.css?v=89" />
</head>

<body>

  <canvas id="gisCanvas" aria-hidden="true"></canvas>

  <div class="shell">

    <div class="sidebar-backdrop" id="sidebarBackdrop"></div>

    <aside class="sidebar" id="sidebar">
      <div class="sidebar-brand">
        <img src="../assets/calatagan-seal.png" width="36" height="36" alt="Calatagan Seal"
          class="sidebar-brand-logo" style="border-radius:50%;object-fit:contain;" />
        <div class="sidebar-brand-text">
          <div class="sidebar-brand-name">AquaGuard</div>
          <div class="sidebar-brand-sub">Forest Ranger</div>
        </div>
      </div>

      <nav class="sidebar-nav">
        <button class="nav-item active" data-view="dashboard" onclick="switchView('dashboard', this)" title="Dashboard">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"
            stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
            <rect x="3" y="3" width="7" height="7" />
            <rect x="14" y="3" width="7" height="7" />
            <rect x="14" y="14" width="7" height="7" />
            <rect x="3" y="14" width="7" height="7" />
          </svg>
          <span class="nav-item-label">Dashboard</span>
        </button>
        <button class="nav-item" data-view="submit" onclick="switchView('submit', this)" title="Submit Field Data">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"
            stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
            <path d="M12 5v14M5 12l7 7 7-7" />
          </svg>
          <span class="nav-item-label">Submit Field Data</span>
        </button>
        <button class="nav-item" data-view="history" onclick="switchView('history', this)" title="Submission History">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"
            stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
            <circle cx="12" cy="12" r="10" />
            <polyline points="12 6 12 12 16 14" />
          </svg>
          <span class="nav-item-label">Submission History</span>
        </button>
      </nav>

      <div class="sidebar-footer">
        <div class="ranger-info">
          <div class="ranger-avatar" id="rangerAvatar">R</div>
          <div class="ranger-info-text">
            <div class="ranger-name" id="rangerName">Ranger</div>
            <div class="ranger-role">Field Personnel</div>
          </div>
        </div>
        <button class="btn-logout" id="btnSignOut" type="button" title="Sign Out">
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"
            stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
            <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
            <polyline points="16 17 21 12 16 7" />
            <line x1="21" y1="12" x2="9" y2="12" />
          </svg>
          <span class="btn-logout-label">Sign Out</span>
        </button>
      </div>
    </aside>

    <main class="main">

      <header class="topbar">
        <div class="topbar-left">
          <button class="topbar-menu-btn" id="btnToggleSidebar" type="button" aria-label="Toggle menu">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
              <line x1="3" y1="6" x2="21" y2="6" />
              <line x1="3" y1="12" x2="21" y2="12" />
              <line x1="3" y1="18" x2="21" y2="18" />
            </svg>
          </button>
          <div>
            <div class="topbar-title" id="topbar-title">Dashboard</div>
            <div class="topbar-sub">Calatagan Mangrove Reserve · <span id="topbar-date"></span></div>
          </div>
        </div>
        <div class="topbar-right">
          <div class="topbar-coord">13.8317° N, 120.6400° E</div>
          <button type="button" class="notif-btn" id="btnHelpGuide" aria-label="Open user guide">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
              <circle cx="12" cy="12" r="10" />
              <path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3" />
              <line x1="12" y1="17" x2="12.01" y2="17" />
            </svg>
          </button>
          <div class="notif-wrap" id="notifWrap">
            <button type="button" class="notif-btn" id="notifBtn" aria-label="Notifications" aria-expanded="false">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
                <path d="M18 8a6 6 0 0 0-12 0c0 7-3 9-3 9h18s-3-2-3-9" />
                <path d="M13.73 21a2 2 0 0 1-3.46 0" />
              </svg>
              <span class="notif-count" id="notifCount" hidden>0</span>
            </button>
            <div class="notif-panel" id="notifPanel">
              <div class="notif-panel-header">
                <span>Notifications</span>
                <button type="button" class="notif-clear" id="notifClearBtn">Mark all read</button>
              </div>
              <div class="notif-list" id="notifList">
                <div class="notif-empty">No notifications yet</div>
              </div>
            </div>
          </div>
        </div>
      </header>

      <section class="view active" id="view-dashboard">

        <div class="welcome-banner">
          <div>
            <div class="welcome-banner-eyebrow">Ranger Field Portal</div>
            <div class="welcome-banner-title">Welcome back, <span id="welcomeBannerName">Ranger</span></div>
            <div class="welcome-banner-sub" id="welcomeBannerSub">Keep the momentum going.</div>
          </div>
          <button class="btn-new-survey" onclick="switchView('submit', document.querySelector('[data-view=submit]'))">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4"
              stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
              <line x1="12" y1="5" x2="12" y2="19" />
              <line x1="5" y1="12" x2="19" y2="12" />
            </svg>
            New Survey
          </button>
        </div>

        <div class="stat-row">
          <div class="stat-card">
            <div class="stat-icon stat-icon-green">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"
                stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
                <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
                <polyline points="9 22 9 12 15 12 15 22" />
              </svg>
            </div>
            <div class="stat-label">Total Submissions</div>
            <div class="stat-value" id="stat-total">–</div>
            <div class="stat-meta">All time</div>
          </div>
          <button type="button" class="stat-card stat-card-clickable stat-card-pending" data-summary-tab="pending">
            <div class="stat-icon stat-icon-pending">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
                <circle cx="12" cy="12" r="10" />
                <polyline points="12 6 12 12 16 14" />
              </svg>
            </div>
            <div class="stat-label">Pending Review</div>
            <div class="stat-value" id="dash-pending-count">–</div>
            <div class="stat-meta">Awaiting MENRO</div>
          </button>
          <button type="button" class="stat-card stat-card-clickable stat-card-approved" data-summary-tab="approved">
            <div class="stat-icon stat-icon-approved">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
                <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
                <polyline points="22 4 12 14.01 9 17.01" />
              </svg>
            </div>
            <div class="stat-label">Approved</div>
            <div class="stat-value" id="dash-approved-count">–</div>
            <div class="stat-meta">Reviewed &amp; accepted</div>
          </button>
          <button type="button" class="stat-card stat-card-clickable stat-card-rejected" data-summary-tab="rejected">
            <div class="stat-icon stat-icon-rejected">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
                <circle cx="12" cy="12" r="10" />
                <line x1="14.83" y1="9.17" x2="9.17" y2="14.83" />
                <line x1="9.17" y1="9.17" x2="14.83" y2="14.83" />
              </svg>
            </div>
            <div class="stat-label">Needs Revision</div>
            <div class="stat-value" id="dash-rejected-count">–</div>
            <div class="stat-meta">MENRO left a note</div>
          </button>
        </div>

        <div class="dash-grid">
          <div class="panel">
            <div class="panel-header">
              <span class="panel-title">Recent Submissions</span>
              <button class="panel-link"
                onclick="switchView('history', document.querySelector('[data-view=history]'))">View all</button>
            </div>
            <div class="submission-list" id="recent-submission-list">
              <div class="submission-empty">Loading submissions…</div>
            </div>
          </div>
        </div>

      </section>

      <section class="view" id="view-submit">
        <div class="panel form-panel">
          <div class="panel-header">
            <span class="panel-title">Field Data Submission</span>
            <span class="offline-badge">
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"
                stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
                <line x1="1" y1="1" x2="23" y2="23" />
                <path d="M16.72 11.06A10.94 10.94 0 0 1 19 12.55" />
                <path d="M5 12.55a10.94 10.94 0 0 1 5.17-2.39" />
                <path d="M10.71 5.05A16 16 0 0 1 22.56 9" />
                <path d="M1.42 9a15.91 15.91 0 0 1 4.7-2.88" />
                <path d="M8.53 16.11a6 6 0 0 1 6.95 0" />
                <line x1="12" y1="20" x2="12.01" y2="20" />
              </svg>
              Offline-capable
            </span>
          </div>
          <div class="survey-note">
            Complete the form below. Your GPS location is captured automatically, and it's saved on
            your device first if you're offline. It will send on its own once you're back online.
          </div>

          <div class="survey-stepper" id="surveyStepper">
            <div class="survey-step-item active" data-step-item="1">
              <span class="survey-step-circle">1</span>
              <span class="survey-step-label">Site Info</span>
            </div>
            <div class="survey-step-line"></div>
            <div class="survey-step-item" data-step-item="2">
              <span class="survey-step-circle">2</span>
              <span class="survey-step-label">Vegetation</span>
            </div>
            <div class="survey-step-line"></div>
            <div class="survey-step-item" data-step-item="3">
              <span class="survey-step-circle">3</span>
              <span class="survey-step-label">Fauna</span>
            </div>
            <div class="survey-step-line"></div>
            <div class="survey-step-item" data-step-item="4">
              <span class="survey-step-circle">4</span>
              <span class="survey-step-label">Water Quality</span>
            </div>
            <div class="survey-step-line"></div>
            <div class="survey-step-item" data-step-item="5">
              <span class="survey-step-circle">5</span>
              <span class="survey-step-label">Review</span>
            </div>
          </div>
          <div class="survey-step-current-label" id="surveyStepCurrentLabel">Step 1 of 5: Site Information</div>

          <form id="fieldSurveyForm" class="field-survey-form">

            <div class="survey-step" data-step="1">
              <div class="survey-section-title">
                <span class="survey-section-icon">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 22s8-9 8-14a8 8 0 1 0-16 0c0 5 8 14 8 14Z"/><circle cx="12" cy="8" r="3"/></svg>
                </span>
                <span class="survey-section-text">
                  <span class="survey-section-name">Site Information</span>
                  <span class="survey-section-desc">When and where this inspection took place</span>
                </span>
              </div>
              <div class="edit-panel active">
                <label class="edit-field">
                  <span>Inspection date <em>*</em></span>
                  <input type="date" id="fs-inspection-date" required />
                </label>
                <div class="edit-field">
                  <span>GPS location <em>*</em></span>
                  <div class="survey-gps-field">
                    <div class="survey-gps-row" id="surveyGpsRow">
                      <span class="survey-gps-dot" id="surveyGpsDot"></span>
                      <span id="surveyGpsStatus">Getting your location…</span>
                      <button type="button" class="inline-link" id="btnRetryGps" hidden>Retry</button>
                    </div>
                    <button type="button" class="survey-gps-locate-btn" id="btnLocateGps" aria-label="Use my current location" title="Use my current location">
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="3"/><path d="M12 2v3M12 19v3M2 12h3M19 12h3"/></svg>
                    </button>
                  </div>
                </div>
                <div class="edit-field edit-field-full">
                  <span>Adjust the pin if it's not exactly where you're standing</span>
                  <div class="survey-gps-map-wrap">
                    <div class="survey-gps-map" id="surveyGpsMap"></div>
                    <div class="survey-gps-map-loading" id="surveyGpsMapLoading">Loading map…</div>
                  </div>
                  <p class="survey-gps-map-hint">Tap or click anywhere on the map to move the pin, or drag it directly.</p>
                  <div class="survey-zone-preview" id="surveyZonePreview" hidden></div>
                </div>
              </div>
            </div>

            <div class="survey-step" data-step="2" hidden>
              <div class="survey-section-title">
                <span class="survey-section-icon">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 22V12"/><path d="M12 12C12 6.5 8 4 4 4c0 5 2.5 8 8 8Z"/><path d="M12 12c0-4.5 3-7 8-7 0 4.5-2 7-8 7Z"/></svg>
                </span>
                <span class="survey-section-text">
                  <span class="survey-section-name">Vegetation</span>
                  <span class="survey-section-desc">Canopy, species counts, and health</span>
                </span>
              </div>

              <p class="survey-group-label">1 &middot; Canopy</p>
              <div class="edit-panel active">
                <label class="edit-field edit-field-full">
                  <span>Canopy cover (%) <em>*</em></span>
                  <input type="number" step="1" min="0" max="100" id="fs-canopy-cover" placeholder="e.g. 75" />
                  <span class="field-helper-text">Estimate how much of the sky above the plot is covered by mangrove leaves.</span>
                </label>
              </div>

              <p class="survey-group-label">2 &middot; Species Found in Plot</p>
              <div class="species-table-wrap">
                <div class="species-table-header">
                  <span>Species <em>*</em></span>
                  <span>Trees</span>
                  <span>Saplings</span>
                  <span>Seedlings</span>
                  <span></span>
                </div>
                <div class="species-table-rows" id="speciesTableRows"></div>
              </div>
              <button type="button" class="btn-add-species" id="btnAddSpecies">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
                Add species
              </button>
              <p class="species-size-limit-note">Seedling: [size limit] &middot; Sapling: [size limit] &middot; Tree: [size limit]</p>

              <p class="survey-group-label">3 &middot; Overall Health</p>
              <div class="edit-panel active">
                <label class="edit-field edit-field-full">
                  <span>Overall health assessment <em>*</em></span>
                  <select id="fs-health-assessment" required>
                    <option value="">Select…</option>
                    <option value="healthy">Good, mostly green leaves, little or no damage</option>
                    <option value="moderate">Fair, some yellowing, leaf loss, or damage</option>
                    <option value="degraded">Poor, widespread dieback or many dead trees</option>
                  </select>
                </label>
              </div>
            </div>

            <div class="survey-step" data-step="3" hidden>
              <div class="survey-section-title">
                <span class="survey-section-icon">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="4"/><path d="M12 8V4"/><path d="M12 20v-4"/><path d="M4.93 4.93l2.83 2.83"/><path d="M16.24 16.24l2.83 2.83"/><path d="M2 12h4"/><path d="M18 12h4"/><path d="M4.93 19.07l2.83-2.83"/><path d="M16.24 7.76l2.83-2.83"/></svg>
                </span>
                <span class="survey-section-text">
                  <span class="survey-section-name">Fauna</span>
                  <span class="survey-section-desc">Wildlife observed and any threats to the site</span>
                </span>
              </div>
              <p class="survey-group-label">1 &middot; Mollusks Found</p>
              <div class="mollusk-table-wrap">
                <div class="mollusk-table-header" id="molluskTableHeader" hidden>
                  <span>Species <em>*</em></span>
                  <span></span>
                </div>
                <div class="mollusk-table-rows" id="molluskTableRows"></div>
              </div>
              <p class="field-helper-text" id="molluskEmptyNote">No mollusks added. Leave empty if none were found.</p>
              <button type="button" class="btn-add-species" id="btnAddMollusk">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
                Add mollusk
              </button>

              <p class="survey-group-label">2 &middot; Observed Threats <em>*</em></p>
              <div class="threat-checkbox-grid" id="threatCheckboxGrid">
                <label class="threat-checkbox"><input type="checkbox" class="threat-checkbox-input" value="none_observed" /> None observed</label>
                <label class="threat-checkbox"><input type="checkbox" class="threat-checkbox-input" value="charcoal_making" /> Charcoal making</label>
                <label class="threat-checkbox"><input type="checkbox" class="threat-checkbox-input" value="cutting" /> Cutting</label>
                <label class="threat-checkbox"><input type="checkbox" class="threat-checkbox-input" value="dieback" /> Dieback</label>
                <label class="threat-checkbox"><input type="checkbox" class="threat-checkbox-input" value="encroachment" /> Encroachment</label>
                <label class="threat-checkbox"><input type="checkbox" class="threat-checkbox-input" value="erosion" /> Erosion</label>
                <label class="threat-checkbox"><input type="checkbox" class="threat-checkbox-input" value="fire" /> Fire</label>
                <label class="threat-checkbox"><input type="checkbox" class="threat-checkbox-input" value="garbage" /> Garbage</label>
                <label class="threat-checkbox"><input type="checkbox" class="threat-checkbox-input" value="illegal_fishing" /> Illegal fishing</label>
                <label class="threat-checkbox"><input type="checkbox" class="threat-checkbox-input" value="land_conversion" /> Land conversion</label>
                <label class="threat-checkbox"><input type="checkbox" class="threat-checkbox-input" value="pests" /> Pests</label>
                <label class="threat-checkbox"><input type="checkbox" class="threat-checkbox-input" value="pollution___oil_spill" /> Pollution / oil spill</label>
                <label class="threat-checkbox"><input type="checkbox" class="threat-checkbox-input" value="sand_gravel_extraction" /> Sand / gravel extraction</label>
                <label class="threat-checkbox"><input type="checkbox" class="threat-checkbox-input" value="siltation" /> Siltation</label>
                <label class="threat-checkbox"><input type="checkbox" class="threat-checkbox-input" value="storm_damage" /> Storm damage</label>
                <label class="threat-checkbox"><input type="checkbox" class="threat-checkbox-input" value="__other__" /> Other</label>
              </div>
              <label class="edit-field edit-field-full" id="threatOtherField" hidden>
                <span>Describe the threat</span>
                <input type="text" id="fs-observed-threats-other" placeholder="Describe the threat" />
              </label>

              <p class="survey-group-label">3 &middot; Additional Notes</p>
              <div class="edit-panel active">
                <label class="edit-field edit-field-full">
                  <span>Additional notes</span>
                  <textarea id="fs-additional-notes" rows="2" placeholder="Anything else worth noting about this site"></textarea>
                </label>
              </div>

              <p class="survey-group-label">4 &middot; Photos <em>*</em></p>
              <div class="survey-photos-list" id="surveyPhotosList"></div>
              <label class="survey-photo-picker" id="surveyPhotoPicker" for="fs-photo">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2Z"/><circle cx="12" cy="13" r="4"/></svg>
                <span id="surveyPhotoLabel">Take or choose photos</span>
              </label>
              <input type="file" accept="image/*" capture="environment" id="fs-photo" multiple hidden />
              <p class="field-helper-text">You can add more than one photo.</p>
            </div>

            <div class="survey-step" data-step="4" hidden>
              <div class="survey-section-title">
                <span class="survey-section-icon">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 2.69s6 7.34 6 11.31a6 6 0 1 1-12 0c0-3.97 6-11.31 6-11.31z"/></svg>
                </span>
                <span class="survey-section-text">
                  <span class="survey-section-name">Water Quality</span>
                  <span class="survey-section-desc">Condition of water near the mangrove area</span>
                </span>
              </div>
              <p class="survey-group-label">1 &middot; Observations <em>*</em></p>
              <div class="edit-panel active">
                <label class="edit-field">
                  <span>Water clarity <em>*</em></span>
                  <select id="fs-water-clarity">
                    <option value="">Select…</option>
                    <option value="clear">Clear – you can see the bottom</option>
                    <option value="slightly_cloudy">Slightly cloudy – bottom is hard to see</option>
                    <option value="cloudy">Cloudy – can't see the bottom</option>
                    <option value="very_murky">Very murky – can barely see into the water</option>
                  </select>
                </label>
                <label class="edit-field">
                  <span>Water color <em>*</em></span>
                  <select id="fs-water-color">
                    <option value="">Select…</option>
                    <option value="no_color">No color</option>
                    <option value="brown">Brown</option>
                    <option value="green">Green</option>
                    <option value="dark___black">Dark / black</option>
                  </select>
                </label>
                <label class="edit-field">
                  <span>Odor <em>*</em></span>
                  <select id="fs-odor">
                    <option value="">Select…</option>
                    <option value="none">None</option>
                    <option value="rotten_egg___sulfur">Rotten egg / sulfur</option>
                    <option value="fishy">Fishy</option>
                    <option value="chemical">Chemical</option>
                    <option value="other">Other</option>
                  </select>
                </label>
                <label class="edit-field">
                  <span>Visible foam or discharge <em>*</em></span>
                  <select id="fs-foam-discharge">
                    <option value="">Select…</option>
                    <option value="none">None</option>
                    <option value="foam">Foam</option>
                    <option value="oily_film">Oily film</option>
                    <option value="visible_discharge_flow">Visible discharge flow</option>
                  </select>
                </label>
              </div>

              <p class="survey-group-label">2 &middot; Aquafarm <em>*</em></p>
              <div class="edit-panel active">
                <label class="edit-field edit-field-full">
                  <span>Nearby aquafarm activity <em>*</em></span>
                  <select id="fs-aquafarm-activity">
                    <option value="">Select…</option>
                    <option value="yes">Yes</option>
                    <option value="no">No</option>
                  </select>
                </label>
              </div>
              <div class="aquafarm-box" id="aquafarmBox" hidden>
                <div class="edit-panel active">
                  <label class="edit-field edit-field-full">
                    <span>Aquafarm name <em>*</em></span>
                    <input type="text" id="fs-aquafarm-name" placeholder="e.g. owner's name or farm name" />
                    <span class="edit-field-help">So MENRO knows which aquafarm this is, in case of a follow-up.</span>
                  </label>
                  <label class="edit-field edit-field-full">
                    <span>Aquafarm location <em>*</em></span>
                    <div class="aquafarm-location-row">
                      <button type="button" class="btn-use-location" id="btnAquafarmLocation">
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="8"/><circle cx="12" cy="12" r="2" fill="currentColor" stroke="none"/><path d="M12 2v3M12 19v3M2 12h3M19 12h3"/></svg>
                        Use my current location
                      </button>
                      <span class="aquafarm-location-out" id="aquafarmLocationOut"></span>
                    </div>
                    <span class="edit-field-help">Stand at the edge of the aquafarm before tapping.</span>
                  </label>
                  <label class="edit-field">
                    <span>Distance to mangroves (m)</span>
                    <input type="number" min="0" step="1" id="fs-aquafarm-distance" placeholder="50" />
                  </label>
                  <label class="edit-field">
                    <span>Discharge flowing toward mangroves? <em>*</em></span>
                    <select id="fs-discharge-toward-mangroves">
                      <option value="">Select…</option>
                      <option value="yes">Yes</option>
                      <option value="no_visible_discharge">No visible discharge</option>
                    </select>
                  </label>
                </div>
              </div>

              <p class="survey-group-label">3 &middot; Instrument Readings</p>
              <button type="button" class="btn-add-species" id="btnToggleInstruments">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><polyline points="6 9 12 15 18 9"/></svg>
                <span id="btnToggleInstrumentsLabel">Add instrument readings (optional)</span>
              </button>
              <div class="edit-panel" id="instrumentReadingsPanel">
                <label class="edit-field">
                  <span>Salinity (ppt)</span>
                  <input type="number" min="0" step="0.1" id="fs-salinity" />
                  <span class="edit-field-help">How salty the water is. Full seawater is around 30&ndash;35 ppt; freshwater is close to 0.</span>
                </label>
                <label class="edit-field">
                  <span>pH</span>
                  <input type="number" min="0" max="14" step="0.1" id="fs-ph" />
                  <span class="edit-field-help">How acidic or basic the water is. 7 is neutral, below 7 is acidic, above 7 is basic.</span>
                </label>
                <label class="edit-field">
                  <span>Water temperature (&deg;C)</span>
                  <input type="number" step="0.1" id="fs-water-temp" />
                  <span class="edit-field-help">The temperature of the water where you're standing.</span>
                </label>
                <label class="edit-field">
                  <span>Secchi depth (cm)</span>
                  <input type="number" min="0" step="1" id="fs-secchi-depth" />
                  <span class="edit-field-help">How far down you can still see a lowered disc, a simple way to measure how clear the water is.</span>
                </label>
              </div>
              <p class="field-helper-text" id="instrumentReadingsHelp" hidden>Leave blank if you don't have the instrument.</p>

              <p class="survey-group-label">4 &middot; Notes</p>
              <div class="edit-panel active">
                <label class="edit-field edit-field-full">
                  <span>Water quality notes</span>
                  <textarea id="fs-water-notes" rows="2" placeholder="Anything else about the water condition"></textarea>
                </label>
              </div>
            </div>

            <div class="survey-step" data-step="5" hidden>
              <div class="survey-section-title">
                <span class="survey-section-icon">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M9 11l3 3L22 4"/><path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11"/></svg>
                </span>
                <span class="survey-section-text">
                  <span class="survey-section-name">Review</span>
                  <span class="survey-section-desc">Check your answers before submitting</span>
                </span>
              </div>
              <div id="surveyReviewBody"></div>
            </div>

            <div class="field-survey-actions">
              <button type="button" class="btn-confirm-cancel" id="btnSurveyCancel">Cancel</button>
              <span class="field-survey-msg" id="fieldSurveyMsg"></span>
              <div class="field-survey-actions-right">
                <button type="button" class="btn-confirm-cancel" id="btnSurveyBack" hidden>Back</button>
                <button type="button" class="btn-confirm-primary" id="btnSurveyNext">Next</button>
                <button type="submit" class="btn-confirm-primary" id="btnSubmitSurvey" hidden>Submit</button>
              </div>
            </div>
          </form>
        </div>
      </section>

      <section class="view" id="view-history">
        <div class="panel">
          <div class="panel-header">
            <div class="panel-title-group">
              <div class="panel-title-icon">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
                  <circle cx="12" cy="12" r="10" />
                  <polyline points="12 6 12 12 16 14" />
                </svg>
              </div>
              <div>
                <span class="panel-title">Submission History</span>
                <span class="panel-sub">All field records submitted by you</span>
              </div>
            </div>
          </div>

          <div class="approval-tabs" id="approvalTabs">
            <button type="button" class="approval-tab active" data-approval-tab="all">All <span class="approval-tab-count" id="tabCountAll">0</span></button>
            <button type="button" class="approval-tab" data-approval-tab="pending">Pending <span class="approval-tab-count" id="tabCountPending">0</span></button>
            <button type="button" class="approval-tab" data-approval-tab="approved">Approved <span class="approval-tab-count" id="tabCountApproved">0</span></button>
            <button type="button" class="approval-tab" data-approval-tab="rejected">Needs Revision <span class="approval-tab-count" id="tabCountRejected">0</span></button>
          </div>

          <div class="filter-bar" id="history-filter-bar">
            <div class="filter-search">
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"
                stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
                <circle cx="11" cy="11" r="8" />
                <line x1="21" y1="21" x2="16.65" y2="16.65" />
              </svg>
              <input type="text" id="filter-search" class="filter-search-input"
                placeholder="Search barangay, mangrove, transect…" autocomplete="off" />
            </div>

            <select id="filter-barangay" class="filter-select">
              <option value="">All barangays</option>
            </select>

            <select id="filter-area" class="filter-select">
              <option value="">All mangroves</option>
            </select>

            <select id="filter-status" class="filter-select">
              <option value="">All status</option>
              <option value="healthy">Good</option>
              <option value="moderate">Fair</option>
              <option value="degraded">Poor</option>
              <option value="pending">Pending</option>
            </select>

            <button type="button" id="filter-clear" class="filter-clear-btn">Clear</button>
          </div>

          <div class="history-table-scroll">
          <table class="history-table">
            <colgroup>
              <col style="width:11%;">
              <col style="width:27%;">
              <col style="width:14%;">
              <col style="width:13%;">
              <col style="width:13%;">
              <col style="width:12%;">
              <col style="width:10%;">
            </colgroup>
            <thead>
              <tr>
                <th data-sort-key="date"><button type="button" class="sort-th-btn">Date<span class="sort-arrow"></span></button></th>
                <th data-sort-key="area"><button type="button" class="sort-th-btn">Mangroves<span class="sort-arrow"></span></button></th>
                <th data-sort-key="barangay"><button type="button" class="sort-th-btn">Barangay<span class="sort-arrow"></span></button></th>
                <th class="cell-center" data-sort-key="threats"><button type="button" class="sort-th-btn">Observed Threats<span class="sort-arrow"></span></button></th>
                <th class="cell-center" data-sort-key="aquafarm"><button type="button" class="sort-th-btn">Aquafarm Nearby<span class="sort-arrow"></span></button></th>
                <th class="cell-center" data-sort-key="status"><button type="button" class="sort-th-btn">Status<span class="sort-arrow"></span></button></th>
                <th class="cell-center">Actions</th>
              </tr>
            </thead>
            <tbody id="history-table-body">
              <tr>
                <td colspan="7" style="text-align:center; color:var(--ink-400); padding:20px;">Loading submissions…</td>
              </tr>
            </tbody>
          </table>
          </div>
          <div class="history-note" id="history-note">Loading…</div>
          <div class="table-pagination" id="historyPagination" hidden>
            <span class="table-pagination-text" id="historyPaginationText"></span>
            <div class="table-pagination-controls">
              <button type="button" class="table-pagination-btn" id="historyPrevPage">Prev</button>
              <button type="button" class="table-pagination-btn" id="historyNextPage">Next</button>
            </div>
          </div>
        </div>
      </section>

    </main>
  </div>

  <div class="dashboard-overlay" id="guideOverlay">
    <div class="dashboard-modal guide-modal">

      <div class="dashboard-modal-header">
        <div>
          <h2>User Guide</h2>
          <p class="dashboard-modal-sub">A quick walkthrough for field rangers</p>
        </div>
        <button class="dashboard-close" id="btnCloseGuide" aria-label="Close guide">&times;</button>
      </div>

      <div class="dashboard-modal-body">

        <div class="guide-section">
          <div class="guide-section-title">Getting Started</div>

          <div class="guide-item">
            <div class="guide-icon">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <rect x="3" y="3" width="7" height="7" /><rect x="14" y="3" width="7" height="7" />
                <rect x="14" y="14" width="7" height="7" /><rect x="3" y="14" width="7" height="7" />
              </svg>
            </div>
            <div class="guide-text">
              <h3>Dashboard</h3>
              <p>Shows your recent submissions, quick stats, and a water quality alert if any recent visit was flagged.</p>
            </div>
          </div>

          <div class="guide-item">
            <div class="guide-icon">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <path d="M12 5v14M5 12l7 7 7-7" />
              </svg>
            </div>
            <div class="guide-text">
              <h3>Submit Field Data</h3>
              <p>Opens the survey form for a new site visit. Works offline, saving your answers on the device and syncing once you're back online.</p>
            </div>
          </div>

          <div class="guide-item">
            <div class="guide-icon">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <circle cx="12" cy="12" r="10" /><polyline points="12 6 12 12 16 14" />
              </svg>
            </div>
            <div class="guide-text">
              <h3>Submission History</h3>
              <p>Lists every survey you've submitted. Click a row to view full details. You can edit or delete a submission until MENRO approves it.</p>
            </div>
          </div>
        </div>

        <div class="guide-section">
          <div class="guide-section-title">Filling Out a Survey</div>

          <div class="guide-item">
            <div class="guide-icon">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <path d="M12 22s8-9 8-14a8 8 0 1 0-16 0c0 5 8 14 8 14Z" /><circle cx="12" cy="8" r="3" />
              </svg>
            </div>
            <div class="guide-text">
              <h3>Section 1: Site Information</h3>
              <p>Inspection date and your GPS location. You don't need to pick a zone. AquaGuard matches your GPS point to the nearest mangrove area automatically.</p>
            </div>
          </div>

          <div class="guide-item">
            <div class="guide-icon">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <path d="M12 22V12" /><path d="M12 12C12 6.5 8 4 4 4c0 5 2.5 8 8 8Z" /><path d="M12 12c0-4.5 3-7 8-7 0 4.5-2 7-8 7Z" />
              </svg>
            </div>
            <div class="guide-text">
              <h3>Section 2: Vegetation</h3>
              <p>Canopy length/width, estimated canopy cover, species, tree count, average height, GBH, seedling/sapling counts, and your own <strong>Overall Health Assessment</strong> for the site.</p>
            </div>
          </div>

          <div class="guide-item">
            <div class="guide-icon">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <circle cx="12" cy="12" r="4" /><path d="M12 8V4" /><path d="M12 20v-4" /><path d="M4.93 4.93l2.83 2.83" /><path d="M16.24 16.24l2.83 2.83" /><path d="M2 12h4" /><path d="M18 12h4" /><path d="M4.93 19.07l2.83-2.83" /><path d="M16.24 7.76l2.83-2.83" />
              </svg>
            </div>
            <div class="guide-text">
              <h3>Section 3: Fauna</h3>
              <p>Mollusk species observed, any observed threats (e.g. illegal cutting, dumping), additional notes, and an optional photo.</p>
            </div>
          </div>

          <div class="guide-item">
            <div class="guide-icon">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <path d="M12 2.69s6 7.34 6 11.31a6 6 0 1 1-12 0c0-3.97 6-11.31 6-11.31z" />
              </svg>
            </div>
            <div class="guide-text">
              <h3>Section 4: Water Quality</h3>
              <p>Water color, odor, and visible foam or discharge. If there's a nearby aquafarm, you'll also record its name, its location, how far it is from the mangroves, and whether it's discharging toward them, plus a notes field.</p>
            </div>
          </div>
        </div>

        <div class="guide-section">
          <div class="guide-section-title">Reviewing &amp; Editing</div>

          <div class="guide-item">
            <div class="guide-icon">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8Z" /><circle cx="12" cy="12" r="3" />
              </svg>
            </div>
            <div class="guide-text">
              <h3>Viewing a Submission</h3>
              <p>Click any row in Submission History to see everything recorded for that visit, organized the same way as the survey: Site Information, Vegetation, Fauna, then Water Quality.</p>
            </div>
          </div>

          <div class="guide-item">
            <div class="guide-icon">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
                <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
              </svg>
            </div>
            <div class="guide-text">
              <h3>Editing a Submission</h3>
              <p>You can edit aquafarm info, water quality notes, and tree measurements here, but only before MENRO approves the submission. After that, it's locked.</p>
            </div>
          </div>
        </div>

        <div class="guide-section">
          <div class="guide-section-title">Account &amp; Security</div>

          <div class="guide-item">
            <div class="guide-icon">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <circle cx="12" cy="12" r="9" /><polyline points="12 7 12 12 15.5 14" />
              </svg>
            </div>
            <div class="guide-text">
              <h3>Auto Sign-Out</h3>
              <p>You'll be signed out after 15 minutes of inactivity, for security. A warning appears first. Click <strong>Stay signed in</strong> to keep working.</p>
            </div>
          </div>
        </div>

      </div>
    </div>
  </div>

  <div class="confirm-overlay" id="signoutOverlay">
    <div class="confirm-modal">
      <button class="confirm-modal-close" id="btnCloseSignout" aria-label="Close">&times;</button>
      <div class="confirm-modal-icon">
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"
          stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
          <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
          <polyline points="16 17 21 12 16 7" />
          <line x1="21" y1="12" x2="9" y2="12" />
        </svg>
      </div>
      <div class="confirm-modal-title">Sign out?</div>
      <div class="confirm-modal-text">You'll need to sign in again to access the ranger dashboard.</div>
      <div class="confirm-modal-actions">
        <button class="btn-confirm-cancel" id="btnCancelSignout">Cancel</button>
        <button class="btn-confirm-danger" id="btnConfirmSignout">Sign Out</button>
      </div>
    </div>
  </div>

  <div class="confirm-overlay" id="deleteOverlay">
    <div class="confirm-modal">
      <button class="confirm-modal-close" id="btnCloseDelete" aria-label="Close">&times;</button>
      <div class="confirm-modal-icon">
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"
          stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
          <polyline points="3 6 5 6 21 6" />
          <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
          <line x1="10" y1="11" x2="10" y2="17" />
          <line x1="14" y1="11" x2="14" y2="17" />
        </svg>
      </div>
      <div class="confirm-modal-title">Delete this submission?</div>
      <div class="confirm-modal-text">This will permanently remove this field record. This action cannot be undone.</div>
      <div class="confirm-modal-actions">
        <button class="btn-confirm-cancel" id="btnCancelDelete">Cancel</button>
        <button class="btn-confirm-danger" id="btnConfirmDelete">Delete</button>
      </div>
    </div>
  </div>

  <div class="confirm-overlay" id="discardSurveyOverlay">
    <div class="confirm-modal">
      <button class="confirm-modal-close" id="btnCloseDiscardSurvey" aria-label="Close">&times;</button>
      <div class="confirm-modal-icon">
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"
          stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
          <polyline points="3 6 5 6 21 6" />
          <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
          <line x1="10" y1="11" x2="10" y2="17" />
          <line x1="14" y1="11" x2="14" y2="17" />
        </svg>
      </div>
      <div class="confirm-modal-title" id="discardSurveyTitle">Discard This Survey?</div>
      <div class="confirm-modal-text" id="discardSurveyText">The information you've entered will be permanently deleted and cannot be recovered.</div>
      <div class="confirm-modal-actions">
        <button class="btn-confirm-cancel" id="btnKeepEditingSurvey">Keep Editing</button>
        <button class="btn-confirm-danger" id="btnConfirmDiscardSurvey">Discard</button>
      </div>
    </div>
  </div>

  <div class="confirm-overlay" id="confirmSubmitOverlay">
    <div class="confirm-modal">
      <button class="confirm-modal-close" id="btnCloseConfirmSubmit" aria-label="Close">&times;</button>
      <div class="confirm-modal-icon confirm-modal-icon-positive">
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"
          stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
          <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
          <polyline points="22 4 12 14.01 9 17.01" />
        </svg>
      </div>
      <div class="confirm-modal-title" id="confirmSubmitTitle">Submit This Survey?</div>
      <div class="confirm-modal-text" id="confirmSubmitText">Make sure everything looks correct. You can still edit it afterward from Submission History.</div>
      <div class="confirm-modal-actions">
        <button class="btn-confirm-cancel" id="btnCancelConfirmSubmit">Review Again</button>
        <button class="btn-confirm-primary" id="btnConfirmSubmit">Submit</button>
      </div>
    </div>
  </div>

  <div class="confirm-overlay" id="viewOverlay">
    <div class="confirm-modal confirm-modal-wide edit-modal view-modal">
      <button class="confirm-modal-close" id="btnCloseView" aria-label="Close">&times;</button>

      <div class="edit-modal-header view-modal-header">
        <div>
          <div class="edit-modal-title">Field submission details</div>
          <div class="edit-modal-subtitle" id="viewModalSubtitle">—</div>
        </div>
        <span class="badge" id="viewStatusBadge">—</span>
      </div>

      <div class="view-body" id="viewModalBody"></div>

      <div class="confirm-modal-actions">
        <button type="button" class="btn-confirm-cancel" id="btnCloseViewFooter">Close</button>
        <button type="button" class="btn-confirm-primary" id="btnEditFromView">Edit this submission</button>
      </div>
    </div>
  </div>

  <script src="../assets/utils.js?v=1"></script>
  <script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js"></script>
  <script>const MANGROVE_SPECIES_LIST = <?= json_encode($mangroveSpeciesList) ?>;</script>
  <script>const MOLLUSK_SPECIES_LIST = <?= json_encode($molluskSpeciesList) ?>;</script>
  <script src="ranger.js?v=47"></script>
  <script src="field-survey.js?v=48"></script>
  <script src="ranger-notifications.js?v=5"></script>
</body>

</html>