<?php
session_start();
if (!isset($_SESSION['user']) || $_SESSION['user']['role'] !== 'ranger') {
    header('Location: ../Login/Login.php');
    exit;
}

// Shared list so the species dropdowns (mature/seedling/sapling, in both the
// survey form and the edit form) all offer the same choices — sourced from
// the Municipality of Calatagan Forest Land Use Plan 2023-2027 (Table 5.2.3.1,
// Flora Species stated by the Stakeholders during the Workshop).
$mangroveSpeciesList = [
    'Bakawan babae (Rhizophora mucronata)',
    'Bakawan lalaki (Rhizophora apiculata)',
    'Bakawan bato (Rhizophora stylosa)',
    'Kalapinay (Avicennia marina)',
    'Pagatpat (Sonneratia alba)',
    'Bayabas (Psidium guajava)',
    'Aroma (Acacia farnesiana)',
    'Bignay (Antidesma bunius)',
    'Nipa / Sasa (Nypa fruticans)',
    'Lato / seaweed (Caulerpa lentillifera)',
    'Kasoy (Anacardium occidentale)',
    'Narra (Pterocarpus indicus)',
    'Bangkoro (Morinda citrifolia)',
    'Duhat (Syzygium cumini)',
    'Kamatsili (Pithecellobium dulce)',
    'Kalumpit (Terminalia microcarpa)',
    'Ligas (Semecarpus cuneiformis)',
    'Saga (Adenanthera pavonina)',
    'Buli (Corypha elata)',
    'Dapo',
    'Kampupot (Tabernaemontana pandacaqui)',
    'Pakpak-lawin (Drynaria quercifolia)',
    'Calachuchi (Plumeria sp.)',
    'Pong-apong (Amorphophallus paeoniifolius)',
    'Molawin (Vitex parviflora)',
    'Rain tree (Samanea saman)',
    'Rubber tree (Hevea brasiliensis)',
    'Talisay (Terminalia catappa)',
    'Ipil-ipil (Leucaena leucocephala)',
    'Kakawate (Gliricidia sepium)',
    'Antipolo (Artocarpus blancoi)',
    'Mahogany (Swietenia macrophylla)',
    'Bangkal (Nauclea orientalis)',
    'Bamboo species',
    'Usiw',
    'Saging-saging (Aegiceras corniculatum)',
    'Himbabao (Broussonetia luzonica)',
    'Paper tree / mulberry (Broussonetia papyrifera)',
    'Buboi-gubat (Ceiba pentandra)',
    'Kalumpang (Sterculia foetida)',
    'Anonang (Cordia dichotoma)',
    'Taluto (Pterocybium tinctorium)',
    'Caballero (Caesalpinia pulcherrima)',
    'Dayumaka',
    'Susong-kalabaw (Uvaria rufa)',
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
    'Sihi / Halaan (Lajonkairia lajonkairii)',
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
  <link rel="stylesheet" href="ranger.css?v=21" />
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
        <div class="topbar-coord">13.8317° N, 120.6400° E</div>
      </header>

      <section class="view active" id="view-dashboard">

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
          <div class="stat-card">
            <div class="stat-icon stat-icon-blue">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"
                stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
                <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
                <line x1="16" y1="2" x2="16" y2="6" />
                <line x1="8" y1="2" x2="8" y2="6" />
                <line x1="3" y1="10" x2="21" y2="10" />
              </svg>
            </div>
            <div class="stat-label">Last Inspection</div>
            <div class="stat-value" style="font-size:1.1rem;" id="stat-last-date">–</div>
            <div class="stat-meta" id="stat-last-barangay">&nbsp;</div>
          </div>
          <div class="stat-card">
            <div class="stat-icon stat-icon-amber">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"
                stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
                <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z" />
                <circle cx="12" cy="10" r="3" />
              </svg>
            </div>
            <div class="stat-label">Areas Covered</div>
            <div class="stat-value" id="stat-areas">–</div>
            <div class="stat-meta" id="stat-areas-meta">&nbsp;</div>
          </div>
          <div class="stat-card">
            <div class="stat-icon stat-icon-teal">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"
                stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
                <polyline points="22 12 18 12 15 21 9 3 6 12 2 12" />
              </svg>
            </div>
            <div class="stat-label">Next Schedule</div>
            <div class="stat-value" style="font-size:1.1rem;">Annual</div>
            <div class="stat-meta">MENRO assigned</div>
          </div>
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

          <div class="panel">
            <div class="panel-header">
              <span class="panel-title">Quick Actions</span>
            </div>
            <div class="quick-actions">
              <button class="qa-btn" onclick="switchView('submit', document.querySelector('[data-view=submit]'))">
                <div class="qa-icon">
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"
                    stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
                    <path d="M12 5v14M5 12l7 7 7-7" />
                  </svg>
                </div>
                <div>
                  <div class="qa-title">Submit field data</div>
                  <div class="qa-sub">Record today's inspection</div>
                </div>
              </button>
              <button class="qa-btn" onclick="switchView('history', document.querySelector('[data-view=history]'))">
                <div class="qa-icon">
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"
                    stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
                    <circle cx="12" cy="12" r="10" />
                    <polyline points="12 6 12 12 16 14" />
                  </svg>
                </div>
                <div>
                  <div class="qa-title">View submission history</div>
                  <div class="qa-sub">All past field records</div>
                </div>
              </button>
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
            your device first if you're offline — it will send on its own once you're back online.
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
          <div class="survey-step-current-label" id="surveyStepCurrentLabel">Step 1 of 5 — Site Information</div>

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
                  <div class="survey-gps-row" id="surveyGpsRow">
                    <span class="survey-gps-dot" id="surveyGpsDot"></span>
                    <span id="surveyGpsStatus">Getting your location…</span>
                    <button type="button" class="inline-link" id="btnRetryGps" hidden>Retry</button>
                  </div>
                </div>
                <div class="edit-field edit-field-full">
                  <span>Adjust the pin if it's not exactly where you're standing</span>
                  <div class="survey-gps-map-wrap">
                    <div class="survey-gps-map" id="surveyGpsMap"></div>
                    <div class="survey-gps-map-loading" id="surveyGpsMapLoading">Loading map…</div>
                  </div>
                  <p class="survey-gps-map-hint">Tap or click anywhere on the map to move the pin, or drag it directly.</p>
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
                  <span class="survey-section-desc">Canopy, tree measurements, and regeneration</span>
                </span>
              </div>
              <p class="survey-group-label">Canopy &amp; Cover</p>
              <div class="edit-panel active">
                <label class="edit-field">
                  <span>Canopy length (m)</span>
                  <input type="number" step="0.1" min="0" id="fs-canopy-length" />
                </label>
                <label class="edit-field">
                  <span>Canopy width (m)</span>
                  <input type="number" step="0.1" min="0" id="fs-canopy-width" />
                </label>
                <label class="edit-field">
                  <span>Estimated canopy cover (%)</span>
                  <input type="number" step="1" min="0" max="100" id="fs-canopy-cover" />
                </label>
                <label class="edit-field">
                  <span>Species name</span>
                  <select id="fs-species-name-select"><?= $mangroveSpeciesOptions ?></select>
                  <input type="text" id="fs-species-name" placeholder="Enter species name" hidden />
                </label>
              </div>

              <p class="survey-group-label">Tree &amp; Regeneration Counts</p>
              <div class="edit-panel active">
                <label class="edit-field">
                  <span>Tree count</span>
                  <input type="number" step="1" min="0" id="fs-tree-count" />
                </label>
                <label class="edit-field">
                  <span>Average tree height (m)</span>
                  <input type="number" step="0.1" min="0" id="fs-avg-height" />
                </label>
                <label class="edit-field">
                  <span>GBH — Girth at Breast Height (cm)</span>
                  <input type="number" step="0.1" min="0" id="fs-gbh" />
                </label>
                <label class="edit-field">
                  <span>Seedling species</span>
                  <select id="fs-seedling-species-select"><?= $mangroveSpeciesOptions ?></select>
                  <input type="text" id="fs-seedling-species" placeholder="Enter species name" hidden />
                </label>
                <label class="edit-field">
                  <span>Seedling count</span>
                  <input type="number" step="1" min="0" id="fs-seedling-count" />
                </label>
                <label class="edit-field">
                  <span>Sapling species</span>
                  <select id="fs-sapling-species-select"><?= $mangroveSpeciesOptions ?></select>
                  <input type="text" id="fs-sapling-species" placeholder="Enter species name" hidden />
                </label>
                <label class="edit-field">
                  <span>Sapling count</span>
                  <input type="number" step="1" min="0" id="fs-sapling-count" />
                </label>
                <label class="edit-field edit-field-full">
                  <span>Overall health assessment <em>*</em></span>
                  <select id="fs-health-assessment" required>
                    <option value="">Select…</option>
                    <option value="healthy">Good</option>
                    <option value="moderate">Fair</option>
                    <option value="degraded">Poor</option>
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
              <div class="edit-panel active">
                <label class="edit-field">
                  <span>Mollusk species name</span>
                  <select id="fs-mollusk-species-select"><?= $molluskSpeciesOptions ?></select>
                  <input type="text" id="fs-mollusk-species" placeholder="Enter species name" hidden />
                </label>
                <label class="edit-field">
                  <span>Mollusk count</span>
                  <input type="number" step="1" min="0" id="fs-mollusk-count" />
                </label>
                <label class="edit-field edit-field-full">
                  <span>Observed threats</span>
                  <select id="fs-observed-threats">
                    <option value="">Select…</option>
                    <option value="none_observed">None observed</option>
                    <option value="minor_encroachment">Minor encroachment</option>
                    <option value="illegal_cutting">Illegal cutting</option>
                    <option value="debris___waste_dumping">Debris / waste dumping</option>
                    <option value="storm_damage">Storm damage</option>
                    <option value="other">Other</option>
                  </select>
                </label>
                <label class="edit-field edit-field-full">
                  <span>Additional notes</span>
                  <textarea id="fs-additional-notes" rows="2"></textarea>
                </label>
                <div class="edit-field edit-field-full">
                  <span>Photo documentation</span>
                  <label class="survey-photo-picker" id="surveyPhotoPicker" for="fs-photo">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2Z"/><circle cx="12" cy="13" r="4"/></svg>
                    <span id="surveyPhotoLabel">Take or choose a photo</span>
                  </label>
                  <input type="file" accept="image/*" capture="environment" id="fs-photo" hidden />
                </div>
              </div>
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
              <div class="edit-panel active">
                <label class="edit-field">
                  <span>Water color</span>
                  <select id="fs-water-color">
                    <option value="">Select…</option>
                    <option value="clear">Clear</option>
                    <option value="slightly_turbid">Slightly turbid</option>
                    <option value="turbid___murky">Turbid / murky</option>
                    <option value="dark___discolored">Dark / discolored</option>
                  </select>
                </label>
                <label class="edit-field">
                  <span>Odor</span>
                  <select id="fs-odor">
                    <option value="">Select…</option>
                    <option value="none">None</option>
                    <option value="mild">Mild</option>
                    <option value="strong___chemical">Strong / chemical</option>
                    <option value="sewage_like">Sewage-like</option>
                  </select>
                </label>
                <label class="edit-field">
                  <span>Visible foam or discharge</span>
                  <select id="fs-foam-discharge">
                    <option value="">Select…</option>
                    <option value="none">None</option>
                    <option value="minor_foam">Minor foam</option>
                    <option value="discharge_visible">Discharge visible</option>
                    <option value="heavy_discharge">Heavy discharge</option>
                  </select>
                </label>
                <label class="edit-field">
                  <span>Nearby aquafarm activity</span>
                  <select id="fs-aquafarm-activity">
                    <option value="">Select…</option>
                    <option value="none_nearby">None nearby</option>
                    <option value="active___no_visible_discharge">Active — no visible discharge</option>
                    <option value="active___discharge_observed">Active — discharge observed</option>
                    <option value="inactive">Inactive</option>
                  </select>
                </label>
                <label class="edit-field edit-field-full" id="fs-aquafarm-name-field" hidden>
                  <span>Aquafarm name (if discharge observed)</span>
                  <input type="text" id="fs-aquafarm-name" />
                </label>
                <label class="edit-field edit-field-full">
                  <span>Water quality notes</span>
                  <textarea id="fs-water-notes" rows="2"></textarea>
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
              <span class="field-survey-msg" id="fieldSurveyMsg"></span>
              <button type="button" class="btn-confirm-cancel" id="btnSurveyBack" hidden>Back</button>
              <button type="button" class="btn-confirm-primary" id="btnSurveyNext">Next</button>
              <button type="submit" class="btn-confirm-primary" id="btnSubmitSurvey" hidden>Submit field report</button>
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

          <div class="filter-bar" id="history-filter-bar">
            <div class="filter-search">
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"
                stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
                <circle cx="11" cy="11" r="8" />
                <line x1="21" y1="21" x2="16.65" y2="16.65" />
              </svg>
              <input type="text" id="filter-search" class="filter-search-input"
                placeholder="Search barangay, protected area, transect…" autocomplete="off" />
            </div>

            <select id="filter-barangay" class="filter-select">
              <option value="">All barangays</option>
            </select>

            <select id="filter-area" class="filter-select">
              <option value="">All protected areas</option>
            </select>

            <select id="filter-status" class="filter-select">
              <option value="">All statuses</option>
              <option value="healthy">Good</option>
              <option value="moderate">Fair</option>
              <option value="degraded">Poor</option>
              <option value="pending">Pending</option>
            </select>

            <div class="filter-date-group">
              <input type="date" id="filter-date-from" class="filter-date" aria-label="From date" />
              <span class="filter-date-sep">–</span>
              <input type="date" id="filter-date-to" class="filter-date" aria-label="To date" />
            </div>

            <button type="button" id="filter-clear" class="filter-clear-btn">Clear</button>
          </div>

          <div class="history-table-scroll">
          <table class="history-table">
            <colgroup>
              <col style="width:11%;">
              <col style="width:15%;">
              <col style="width:26%;">
              <col style="width:13%;">
              <col style="width:13%;">
              <col style="width:12%;">
              <col style="width:10%;">
            </colgroup>
            <thead>
              <tr>
                <th>Date</th>
                <th>Barangay</th>
                <th>Protected Area</th>
                <th class="cell-center">Trees Recorded</th>
                <th class="cell-center">Aquafarm Nearby</th>
                <th class="cell-center">Status</th>
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
              <p>Lists every survey you've submitted. Click a row to view full details, or use the icons to edit or delete it.</p>
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
              <p>Inspection date and your GPS location. There's no protected area/zone question to fill in — AquaGuard automatically matches your GPS point to the nearest mapped mangrove or protected area.</p>
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
              <p>Mollusk species and count, any observed threats (e.g. illegal cutting, dumping), additional notes, and an optional photo.</p>
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
              <p>Water color, odor, visible foam/discharge, and nearby aquafarm activity (with a name if discharge is observed), plus a free-text water quality notes field.</p>
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
              <p>Aquafarm info and water quality notes can be edited directly here, including tree measurements. Changes save back to your submission record.</p>
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
              <p>For security, you'll be signed out automatically after 15 minutes of inactivity. A warning appears beforehand; click <strong>Stay signed in</strong> to keep working.</p>
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

  <div class="confirm-overlay" id="editOverlay">
    <div class="confirm-modal confirm-modal-wide edit-modal">
      <button class="confirm-modal-close" id="btnCloseEdit" aria-label="Close">&times;</button>

      <div class="edit-modal-header">
        <div class="edit-modal-title">Edit field submission</div>
        <div class="edit-modal-subtitle" id="editModalSubtitle">—</div>
      </div>

      <form id="editForm" class="edit-form">
        <div class="edit-body">
          <div class="survey-section-title">
            <span class="survey-section-icon">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 22V12"/><path d="M12 12C12 6.5 8 4 4 4c0 5 2.5 8 8 8Z"/><path d="M12 12c0-4.5 3-7 8-7 0 4.5-2 7-8 7Z"/></svg>
            </span>
            <span class="survey-section-text">
              <span class="survey-section-name">Vegetation</span>
              <span class="survey-section-desc">Canopy, tree measurements, and regeneration</span>
            </span>
            <span class="survey-section-num">1 / 3</span>
          </div>
          <p class="survey-group-label">Canopy &amp; Cover</p>
          <div class="edit-panel active">
            <label class="edit-field">
              <span>Species name</span>
              <select id="edit-species-name-select"><?= $mangroveSpeciesOptions ?></select>
              <input type="text" id="edit-species-name" placeholder="Enter species name" hidden />
            </label>
            <label class="edit-field">
              <span>Estimated canopy cover (%)</span>
              <input type="number" step="1" min="0" max="100" id="edit-canopy-cover" />
            </label>
            <label class="edit-field">
              <span>Canopy length (m)</span>
              <input type="number" step="0.1" min="0" id="edit-canopy-length" />
            </label>
            <label class="edit-field">
              <span>Canopy width (m)</span>
              <input type="number" step="0.1" min="0" id="edit-canopy-width" />
            </label>
          </div>

          <p class="survey-group-label">Tree &amp; Regeneration Counts</p>
          <div class="edit-panel active">
            <label class="edit-field">
              <span>Tree count</span>
              <input type="number" step="1" min="0" id="edit-tree-count" />
            </label>
            <label class="edit-field">
              <span>Average tree height (m)</span>
              <input type="number" step="0.1" min="0" id="edit-avg-height" />
            </label>
            <label class="edit-field">
              <span>GBH — Girth at Breast Height (cm)</span>
              <input type="number" step="0.1" min="0" id="edit-gbh" />
            </label>
            <label class="edit-field">
              <span>Seedling species</span>
              <select id="edit-seedling-species-select"><?= $mangroveSpeciesOptions ?></select>
              <input type="text" id="edit-seedling-species" placeholder="Enter species name" hidden />
            </label>
            <label class="edit-field">
              <span>Seedling count</span>
              <input type="number" step="1" min="0" id="edit-seedling-count" />
            </label>
            <label class="edit-field">
              <span>Sapling species</span>
              <select id="edit-sapling-species-select"><?= $mangroveSpeciesOptions ?></select>
              <input type="text" id="edit-sapling-species" placeholder="Enter species name" hidden />
            </label>
            <label class="edit-field">
              <span>Sapling count</span>
              <input type="number" step="1" min="0" id="edit-sapling-count" />
            </label>
            <label class="edit-field edit-field-full">
              <span>Overall health assessment</span>
              <select id="edit-health-assessment">
                <option value="">Select…</option>
                <option value="healthy">Good</option>
                <option value="moderate">Fair</option>
                <option value="degraded">Poor</option>
              </select>
            </label>
          </div>

          <div class="survey-section-title">
            <span class="survey-section-icon">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="4"/><path d="M12 8V4"/><path d="M12 20v-4"/><path d="M4.93 4.93l2.83 2.83"/><path d="M16.24 16.24l2.83 2.83"/><path d="M2 12h4"/><path d="M18 12h4"/><path d="M4.93 19.07l2.83-2.83"/><path d="M16.24 7.76l2.83-2.83"/></svg>
            </span>
            <span class="survey-section-text">
              <span class="survey-section-name">Fauna</span>
              <span class="survey-section-desc">Wildlife observed and any threats to the site</span>
            </span>
            <span class="survey-section-num">2 / 3</span>
          </div>
          <div class="edit-panel active">
            <label class="edit-field">
              <span>Mollusk species name</span>
              <select id="edit-mollusk-species-select"><?= $molluskSpeciesOptions ?></select>
              <input type="text" id="edit-mollusk-species" placeholder="Enter species name" hidden />
            </label>
            <label class="edit-field">
              <span>Mollusk count</span>
              <input type="number" step="1" min="0" id="edit-mollusk-count" />
            </label>
            <label class="edit-field edit-field-full">
              <span>Observed threats</span>
              <select id="edit-observed-threats">
                <option value="">Select…</option>
                <option value="none_observed">None observed</option>
                <option value="minor_encroachment">Minor encroachment</option>
                <option value="illegal_cutting">Illegal cutting</option>
                <option value="debris___waste_dumping">Debris / waste dumping</option>
                <option value="storm_damage">Storm damage</option>
                <option value="other">Other</option>
              </select>
            </label>
            <label class="edit-field edit-field-full">
              <span>Additional notes</span>
              <textarea id="edit-additional-notes" rows="2"></textarea>
            </label>
            <div class="edit-field edit-field-full">
              <span>Photo documentation</span>
              <img id="editPhotoPreview" class="edit-photo-preview" hidden />
              <label class="survey-photo-picker" id="editPhotoPicker" for="edit-photo">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2Z"/><circle cx="12" cy="13" r="4"/></svg>
                <span id="editPhotoLabel">Take or choose a photo</span>
              </label>
              <input type="file" accept="image/*" capture="environment" id="edit-photo" hidden />
            </div>
          </div>

          <div class="survey-section-title">
            <span class="survey-section-icon">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 2.69s6 7.34 6 11.31a6 6 0 1 1-12 0c0-3.97 6-11.31 6-11.31z"/></svg>
            </span>
            <span class="survey-section-text">
              <span class="survey-section-name">Water Quality</span>
              <span class="survey-section-desc">Condition of water near the mangrove area</span>
            </span>
            <span class="survey-section-num">3 / 3</span>
          </div>
          <div class="edit-panel active">
            <label class="edit-field">
              <span>Water color</span>
              <select id="edit-water-color">
                <option value="">Select…</option>
                <option value="clear">Clear</option>
                <option value="slightly_turbid">Slightly turbid</option>
                <option value="turbid___murky">Turbid / murky</option>
                <option value="dark___discolored">Dark / discolored</option>
              </select>
            </label>
            <label class="edit-field">
              <span>Odor</span>
              <select id="edit-odor">
                <option value="">Select…</option>
                <option value="none">None</option>
                <option value="mild">Mild</option>
                <option value="strong___chemical">Strong / chemical</option>
                <option value="sewage_like">Sewage-like</option>
              </select>
            </label>
            <label class="edit-field">
              <span>Visible foam or discharge</span>
              <select id="edit-foam-discharge">
                <option value="">Select…</option>
                <option value="none">None</option>
                <option value="minor_foam">Minor foam</option>
                <option value="discharge_visible">Discharge visible</option>
                <option value="heavy_discharge">Heavy discharge</option>
              </select>
            </label>
            <label class="edit-field">
              <span>Nearby aquafarm activity</span>
              <select id="edit-aquafarm">
                <option value="">Select…</option>
                <option value="none_nearby">None nearby</option>
                <option value="active___no_visible_discharge">Active — no visible discharge</option>
                <option value="active___discharge_observed">Active — discharge observed</option>
                <option value="inactive">Inactive</option>
              </select>
            </label>
            <label class="edit-field edit-field-full" id="edit-aquafarm-name-field" hidden>
              <span>Aquafarm name (if discharge observed)</span>
              <input type="text" id="edit-aquafarm-name" placeholder="Leave blank if none" />
            </label>
            <label class="edit-field edit-field-full">
              <span>Water quality notes</span>
              <textarea id="edit-water-notes" rows="2"></textarea>
            </label>
          </div>
        </div>

        <div class="confirm-modal-actions">
          <button type="button" class="btn-confirm-cancel" id="btnCancelEdit">Cancel</button>
          <button type="submit" class="btn-confirm-primary" id="btnSaveEdit">Save changes</button>
        </div>
      </form>
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

  <button class="btn-help-fab" id="btnHelpGuide" type="button" aria-label="Open user guide">?</button>

  <script src="../assets/utils.js"></script>
  <script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js"></script>
  <script src="ranger.js?v=19"></script>
  <script src="field-survey.js?v=8"></script>
</body>

</html>