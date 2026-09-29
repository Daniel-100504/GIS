const AQUAGUARD_CONFIG = {
  SUBMISSIONS_API_URL: '../Menro/API/ranger-submissions.php',
  TOTAL_PROTECTED_AREAS: 6,
};

const AUTH_API = '../Login/Database/api.php';

(function () {
  const canvas = document.getElementById('gisCanvas');
  const ctx = canvas.getContext('2d');

  function draw() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    const gridSpacing = 48;
    ctx.strokeStyle = 'rgba(20, 107, 82, 0.05)';
    ctx.lineWidth = 1;
    for (let x = 0; x < canvas.width; x += gridSpacing) {
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, canvas.height);
      ctx.stroke();
    }
    for (let y = 0; y < canvas.height; y += gridSpacing) {
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(canvas.width, y);
      ctx.stroke();
    }

    const cx = canvas.width * 0.8;
    const cy = canvas.height * 0.2;
    ctx.strokeStyle = 'rgba(20, 107, 82, 0.04)';
    for (let r = 60; r < 260; r += 45) {
      ctx.beginPath();
      ctx.arc(cx, cy, r, 0, Math.PI * 2);
      ctx.stroke();
    }
  }

  function resize() {
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
    draw();
  }

  window.addEventListener('resize', resize);
  resize();

  const dateEl = document.getElementById('topbar-date');
  if (dateEl) {
    dateEl.textContent = new Date().toLocaleDateString('en-PH', {
      weekday: 'long', year: 'numeric', month: 'long', day: 'numeric'
    });
  }
})();

(function bindSignoutConfirm() {
  const overlay     = document.getElementById('signoutOverlay');
  const signOutBtn  = document.getElementById('btnSignOut');
  const closeBtn    = document.getElementById('btnCloseSignout');
  const cancelBtn   = document.getElementById('btnCancelSignout');
  const confirmBtn  = document.getElementById('btnConfirmSignout');
  if (!overlay || !signOutBtn || !confirmBtn) return;

  function openSignoutConfirm() { overlay.classList.add('open'); }
  function closeSignoutConfirm() { overlay.classList.remove('open'); }

  signOutBtn.addEventListener('click', openSignoutConfirm);
  if (closeBtn) closeBtn.addEventListener('click', closeSignoutConfirm);
  if (cancelBtn) cancelBtn.addEventListener('click', closeSignoutConfirm);
  overlay.addEventListener('click', (e) => {
    if (e.target === overlay) closeSignoutConfirm();
  });
  function signOutRanger() {
    fetch(`${AUTH_API}?action=logout`, { method: 'POST' }).catch(() => {});
    localStorage.removeItem('aquaguard_current_user');
    window.location.href = '../Login/Login.php';
  }

  confirmBtn.addEventListener('click', signOutRanger);

  initIdleLogout(15, signOutRanger, { overlayClass: "confirm-overlay" });
})();

function openGuide() {
  const overlay = document.getElementById('guideOverlay');
  if (overlay) overlay.classList.add('open');
}

function closeGuide() {
  const overlay = document.getElementById('guideOverlay');
  if (overlay) overlay.classList.remove('open');
}

(function bindGuideOverlay() {
  const overlay  = document.getElementById('guideOverlay');
  const closeBtn = document.getElementById('btnCloseGuide');
  const helpBtn  = document.getElementById('btnHelpGuide');
  if (!overlay) return;

  if (helpBtn) helpBtn.addEventListener('click', openGuide);
  if (closeBtn) closeBtn.addEventListener('click', closeGuide);
  overlay.addEventListener('click', (e) => {
    if (e.target === overlay) closeGuide();
  });
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && overlay.classList.contains('open')) closeGuide();
  });
})();

(function displayLoggedInUser() {
  const rangerName = document.getElementById('rangerName');
  const rangerAvatar = document.getElementById('rangerAvatar');
  const welcomeBannerName = document.getElementById('welcomeBannerName');
  if (!rangerName || !rangerAvatar) return;

  try {
    const stored = localStorage.getItem('aquaguard_current_user');
    if (!stored) return;

    const user = JSON.parse(stored);
    const displayName = user.fullName || user.username;
    if (!displayName) return;

    rangerName.textContent = displayName;
    rangerAvatar.textContent = displayName.charAt(0).toUpperCase();
    if (welcomeBannerName) welcomeBannerName.textContent = displayName.split(' ')[0];
  } catch (err) {
    // Malformed or missing stored user info — leave the default placeholder as-is.
  }
})();

function closeMobileSidebar() {
  const sidebar = document.getElementById('sidebar');
  const backdrop = document.getElementById('sidebarBackdrop');
  if (sidebar) sidebar.classList.remove('open');
  if (backdrop) backdrop.classList.remove('open');
}

// One hamburger button, same icon and spot on every screen size — on a
// phone it slides the sidebar open as a drawer; on a wide screen it
// collapses the same sidebar down to just its icons instead. Which one
// happens is decided by the same width the CSS uses to switch the sidebar
// into a drawer in the first place.
const SIDEBAR_COLLAPSED_KEY = 'aquaguard_ranger_sidebar_collapsed';
const SIDEBAR_MOBILE_QUERY = '(max-width: 900px)';

(function bindSidebarToggle() {
  const sidebar = document.getElementById('sidebar');
  const toggleBtn = document.getElementById('btnToggleSidebar');
  const backdrop = document.getElementById('sidebarBackdrop');
  if (!sidebar || !toggleBtn) return;

  try {
    if (localStorage.getItem(SIDEBAR_COLLAPSED_KEY) === '1') {
      sidebar.classList.add('collapsed');
    }
  } catch (err) {
    // localStorage unavailable — just start expanded.
  }

  toggleBtn.addEventListener('click', () => {
    if (window.matchMedia(SIDEBAR_MOBILE_QUERY).matches) {
      sidebar.classList.toggle('open');
      if (backdrop) backdrop.classList.toggle('open');
      return;
    }
    const isCollapsed = sidebar.classList.toggle('collapsed');
    try {
      localStorage.setItem(SIDEBAR_COLLAPSED_KEY, isCollapsed ? '1' : '0');
    } catch (err) {
      // Not persisted this time, but the toggle itself still works.
    }
  });

  if (backdrop) backdrop.addEventListener('click', closeMobileSidebar);
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') closeMobileSidebar();
  });
})();

function switchView(viewName, btn) {
  document.querySelectorAll('.view').forEach(v => v.classList.remove('active'));
  document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'));

  const target = document.getElementById('view-' + viewName);
  if (target) target.classList.add('active');

  if (btn) btn.classList.add('active');

  // On a phone the sidebar is an off-canvas drawer — picking a page from it
  // should close it, the same as any other mobile nav menu.
  closeMobileSidebar();

  const titles = { dashboard: 'Dashboard', submit: 'Submit Field Data', history: 'Submission History' };
  const titleEl = document.getElementById('topbar-title');
  if (titleEl) titleEl.textContent = titles[viewName] || 'Dashboard';

  if ((viewName === 'history' || viewName === 'dashboard') && typeof window.refreshAquaGuardSubmissions === 'function') {
    window.refreshAquaGuardSubmissions();
  }

  if (viewName === 'submit') {
    // Every plain visit to this tab starts a fresh, new submission — a
    // caller that wants to edit an existing one instead (see
    // bindEditDelegation below) calls startFieldSurveyEdit right after this,
    // which re-arms edit mode on top of this reset.
    if (typeof window.resetFieldSurveyEditMode === 'function') window.resetFieldSurveyEditMode();
    if (typeof window.initSurveyGpsMap === 'function') window.initSurveyGpsMap();
  }
}

(function AquaGuardData() {

  // The exact real Barangay choice list from the Kobo form (verified against
  // the form schema directly). Used instead of the generic label-prettifier
  // because that heuristic misreads "sta__ana" as a parent/sub-area pair
  // (the double underscore there is just how Kobo encodes "Sta. Ana"'s
  // period and space, not a real separator), producing "Sta. – Ana".
  const BARANGAY_LABELS = {
    bagong_silang: 'Bagong Silang',
    baha: 'Baha',
    balibago: 'Balibago',
    balitoc: 'Balitoc',
    bucal: 'Bucal',
    carretunan: 'Carretunan',
    encarnacion: 'Encarnacion',
    gulod: 'Gulod',
    quilitisan: 'Quilitisan',
    sambungan: 'Sambungan',
    sta__ana: 'Sta. Ana',
    talibayog: 'Talibayog',
    talisay: 'Talisay',
    tanagan: 'Tanagan',
    poblacion_1: 'Poblacion 1',
    poblacion_2: 'Poblacion 2',
    poblacion_3: 'Poblacion 3',
    poblacion_4: 'Poblacion 4',
  };

  const FIELD_CANDIDATES = {
    date:      ['date_of_visit', 'date', 'inspection_date', 'date_of_inspection', 'survey_date', 'today'],
    barangay:  ['barangay', 'brgy'],
    area:      ['protected_area_zone', 'protected_area', 'mpa', 'area', 'protected_area_name', 'ecosystem_area'],
    transect:  ['plot_number', 'transect', 'transect_quadrat', 'quadrat', 'plot', 'plot_id', 'transect_id'],
    rangerName: ['ranger_name', 'submitted_by', 'submitter', 'ranger'],
  };

  // The current survey doesn't ask which protected area a visit is in — the
  // backend matches the ranger's GPS point to the nearest field-mapped area
  // and stamps the result onto the record as _zone_name / _zone_barangay.
  // Preferred whenever present; the keyword-based guesses below only cover
  // older submissions from a form version that asked directly.

  const PHOTO_FIELD_PATTERN = /photo|image|picture|snapshot/i;

  // Maps a Protected area / Zone answer back to its barangay, since the new
  // survey only asks for the specific protected area, not the barangay.
  // Matched by keyword instead of an exact slug, since Kobo's auto-generated
  // field values depend on exactly how each option was typed.
  const PROTECTED_AREA_KEYWORDS = [
    { match: 'bagong_silang', barangay: 'Bagong Silang' },
    { match: 'conservation', barangay: 'Quilitisan' },
    { match: 'quilitisan', barangay: 'Quilitisan' },
    { match: 'palobandera', barangay: 'Sta. Ana' },
    { match: 'rehabilitation', barangay: 'Balibago' },
    { match: 'balibago', barangay: 'Balibago' },
    { match: 'encarnacion', barangay: 'Encarnacion' },
  ];

  function barangayFromProtectedArea(raw) {
    const s = (raw || '').toString().toLowerCase();
    if (!s) return null;
    const hit = PROTECTED_AREA_KEYWORDS.find(k => s.includes(k.match));
    if (hit) return hit.barangay;
    if (s.includes('sta') && s.includes('ana')) return 'Sta. Ana';
    return null;
  }

  // Kobo's auto-generated answer value for a select-one option is a
  // slugified, 42-char-truncated version of its label (e.g. "...conservation_p"
  // for "...Conservation Park"), so title-casing that raw value alone can
  // never recover the full protected area name. This restores the real,
  // full official name by keyword instead of relying on the truncated slug.
  const PROTECTED_AREA_LABELS = [
    { match: 'bagong_silang', label: 'Bagong Silang Mangrove Protected Area' },
    { match: 'conservation', label: 'Calatagan Mangrove Forest Conservation Park "Ang Pulo"' },
    { match: 'quilitisan', label: 'Calatagan Mangrove Forest Conservation Park "Ang Pulo"' },
    { match: 'palobandera', label: 'Palobandera Mangrove Protected Area' },
    { match: 'rehabilitation', label: 'Calatagan Mangrove Rehabilitation and Nursery Project' },
    { match: 'balibago', label: 'Calatagan Mangrove Rehabilitation and Nursery Project' },
    { match: 'encarnacion', label: 'Encarnacion Mangrove Protected Area' },
  ];

  function labelForProtectedArea(raw) {
    const s = (raw || '').toString().toLowerCase();
    if (!s) return null;
    if (s.includes('sta') && s.includes('ana') && !s.includes('palobandera')) return 'Sta. Ana Mangrove Protected Area';
    const hit = PROTECTED_AREA_LABELS.find(k => s.includes(k.match));
    return hit ? hit.label : null;
  }

  function flattenKeys(record) {
    const flat = {};
    for (const key in record) {
      if (!Object.prototype.hasOwnProperty.call(record, key)) continue;
      const shortKey = key.split('/').pop().trim().toLowerCase().replace(/[\s-]+/g, '_');
      flat[shortKey] = record[key];
    }
    return flat;
  }

  function findField(flat, candidates) {
    for (const c of candidates) {
      if (flat[c] !== undefined && flat[c] !== null && flat[c] !== '') return flat[c];
    }
    const keys = Object.keys(flat);
    for (const c of candidates) {
      const hit = keys.find(k => k.includes(c) && flat[k] !== '' && flat[k] != null);
      if (hit) return flat[hit];
    }
    return null;
  }

  // Converts raw KoboToolbox values (e.g. "balibago_mpa__calmada",
  // "not_a_protected_area", "poblacion_1") into clean, human-readable
  // text (e.g. "Balibago MPA – Calmada", "Not a Protected Area", "Poblacion 1")
  // so the dashboard never shows raw form-field slugs to the ranger.
  const ACRONYMS = new Set(['mpa', 'menro', 'gis', 'id']);
  const LOWERCASE_WORDS = new Set(['a', 'an', 'of', 'the', 'and', 'in', 'at']);
  const SPECIAL_WORDS = { sta: 'Sta.', sto: 'Sto.' };

  function titleCaseWord(word, isFirst) {
    const lower = word.toLowerCase();
    if (!lower) return '';
    if (ACRONYMS.has(lower)) return lower.toUpperCase();
    if (SPECIAL_WORDS[lower]) return SPECIAL_WORDS[lower];
    if (!isFirst && LOWERCASE_WORDS.has(lower)) return lower;
    return lower.charAt(0).toUpperCase() + lower.slice(1);
  }

  function titleCaseSegment(segment) {
    return segment
      .replace(/[_\-]+/g, ' ')
      .trim()
      .split(/\s+/)
      .filter(Boolean)
      .map((w, i) => titleCaseWord(w, i === 0))
      .join(' ');
  }

  function prettifyLabel(raw) {
    if (raw === null || raw === undefined) return null;
    let str = String(raw).trim();
    if (str === '' || str === '—') return null;
    // "Sta."/"Sto." names collapse their period and space into their own
    // underscore (e.g. "Sta. Ana" -> "sta__ana"), which looks identical to
    // the real parent/sub-area "__" separator used elsewhere (e.g.
    // "balibago_mpa__calmada"). Neutralize that one first so a code like
    // "sta__ana_mpa__sapsap" doesn't get mis-split into three parts.
    str = str.replace(/\b(sta|sto)__/gi, '$1_');
    // A double underscore separates a parent area from a sub-site,
    // e.g. "balibago_mpa__calmada" -> "Balibago MPA – Calmada"
    const parts = str.split('__').map(titleCaseSegment).filter(Boolean);
    return parts.join(' – ') || null;
  }

  function parseCanopyValue(raw) {
    if (raw === null || raw === undefined) return null;
    const n = parseFloat(String(raw).replace('%', '').trim());
    return isNaN(n) ? null : n;
  }

  // Kobo stores an uploaded photo's original filename as the question's
  // value, while the actual downloadable URL lives in the submission's
  // "_attachments" array. This matches each photo question to its
  // attachment and returns thumbnail + full-size URLs for the lightbox.
  function collectPhotoValues(flat) {
    return Object.keys(flat)
      .filter(k => PHOTO_FIELD_PATTERN.test(k) && flat[k] !== '' && flat[k] != null)
      .map(k => flat[k]);
  }

  function resolvePhoto(value, attachments) {
    if (value === null || value === undefined) return null;
    const raw = String(value).trim();
    if (!raw) return null;

    if (/^https?:\/\//i.test(raw)) {
      return { thumb: raw, full: raw };
    }

    if (!Array.isArray(attachments) || attachments.length === 0) return null;

    const target = raw.toLowerCase();
    const match = attachments.find(a => {
      const filename = (a && a.filename ? String(a.filename) : '').toLowerCase();
      const question = (a && a.question ? String(a.question) : '').toLowerCase();
      return filename.endsWith(target) || filename.includes(target) || question === target;
    });
    if (!match) return null;

    const thumb = match.download_small_url || match.download_medium_url ||
      match.download_url || match.download_large_url;
    const full = match.download_large_url || match.download_url ||
      match.download_medium_url || thumb;
    return thumb ? { thumb, full } : null;
  }

  function collectPhotos(flat, record) {
    const attachments = flat['_attachments'] || (record && record['_attachments']) || [];
    return collectPhotoValues(flat)
      .map(v => resolvePhoto(v, attachments))
      .filter(Boolean);
  }

  // The current survey asks about nearby aquafarm activity as a 4-option
  // status instead of a plain Yes/No. Mapped to the same {label, cls} shape
  // the table and view modal already expect, with 'yes'/'no' kept as a
  // fallback for older submissions from the form version that asked it that way.
  const AQUAFARM_STATUS = {
    none_nearby:                      { label: 'None nearby',                 cls: 'wq-clear' },
    inactive:                         { label: 'Inactive',                    cls: 'wq-clear' },
    active___no_visible_discharge:    { label: 'Active — no discharge',       cls: 'wq-pending' },
    active___discharge_observed:      { label: 'Active — discharge observed', cls: 'wq-discharge' },
  };

  function aquafarmInfo(raw) {
    const v = (raw || '').toString().toLowerCase();
    if (AQUAFARM_STATUS[v]) return AQUAFARM_STATUS[v];
    if (v === 'yes') return { label: 'Yes', cls: 'wq-discharge' };
    if (v === 'no')  return { label: 'No',  cls: 'wq-clear' };
    if (!v) return { label: 'No data', cls: 'wq-pending' };
    return { label: prettifyLabel(v) || v, cls: 'wq-pending' };
  }

  function isAquafarmActive(raw) {
    const v = (raw || '').toString().toLowerCase();
    return v === 'yes' || v.startsWith('active');
  }

  // Kobo repeat groups come back as an array of objects under whatever key
  // the group was given — found generically here instead of hardcoding an
  // exact group name, since that name depends on how the form was built.
  function extractTrees(record) {
    for (const key in record) {
      if (!Object.prototype.hasOwnProperty.call(record, key)) continue;
      const value = record[key];
      // typeof null === "object" in JS, so a plain check would misread a
      // no-GPS submission's "_geolocation":[null,null] as the tree list.
      if (Array.isArray(value) && value.length > 0 && value[0] !== null && typeof value[0] === 'object') {
        return value;
      }
    }
    // No repeat-group array on this record — every native submission's
    // vegetation/fauna fields (species, mollusk, seedling, sapling, health
    // assessment, etc.) sit flat on the record itself instead of inside a
    // list, so treat it as a single bucket regardless of which of those
    // fields were actually filled in. Checking only species/tree_code here
    // used to silently drop mollusk/seedling/sapling/health data from view
    // and edit whenever species name was left blank, even though it was
    // saved correctly.
    return [record];
  }

  function normalizeTree(treeRecord) {
    const t = flattenKeys(treeRecord);
    return {
      code: t['tree_code'] || '—',
      species: t['species_name'] || t['species'] || '—',
      height: parseCanopyValue(t['average_tree_height_m'] || t['height_m']),
      gbh: parseCanopyValue(t['gbh_girth_at_breast_height_cm'] || t['gbh_cm']),
      canopyLength: parseCanopyValue(t['canopy_length_m']),
      canopyWidth: parseCanopyValue(t['canopy_width_m']),
      canopyCoverDirect: parseCanopyValue(t['estimated_canopy_cover_']),
      molluskSpecies: t['mollusk_species_name'] || '',
      molluskCount: parseCanopyValue(t['mollusk_count']),
      seedlingSpecies: t['seedling_species'] || t['seedling_species_name'] || '',
      seedlingCount: parseCanopyValue(t['seedling_count']),
      saplingSpecies: t['sapling_species'] || t['sapling_species_name'] || '',
      saplingCount: parseCanopyValue(t['sapling_count']),
    };
  }

  // Crown area from canopy length/width (ellipse approximation), shown as a
  // % of the 10m x 10m (100 sqm) plot a tree was measured in — used only as a
  // fallback for submissions that don't have the survey's own direct
  // canopy-cover estimate (Estimated Canopy Cover %).
  function canopyCoverPct(tree) {
    if (tree.canopyCoverDirect !== null && tree.canopyCoverDirect !== undefined) {
      return Math.min(100, tree.canopyCoverDirect);
    }
    if (tree.canopyLength === null || tree.canopyWidth === null) return null;
    const crownArea = Math.PI * (tree.canopyLength / 2) * (tree.canopyWidth / 2);
    return Math.min(100, (crownArea / 100) * 100);
  }

  function summarizeTrees(trees) {
    const avg = (arr) => arr.length ? arr.reduce((a, b) => a + b, 0) / arr.length : null;
    const speciesList = [...new Set(trees.map(t => t.species).filter(s => s && s !== '—'))];
    const canopyValues = trees.map(canopyCoverPct).filter(n => n !== null);
    return {
      count: trees.length,
      speciesList,
      avgHeight: avg(trees.map(t => t.height).filter(n => n !== null)),
      avgGbh: avg(trees.map(t => t.gbh).filter(n => n !== null)),
      avgCanopyCoverPct: avg(canopyValues),
      totalMollusk: trees.reduce((a, t) => a + t.molluskCount, 0),
      totalSeedling: trees.reduce((a, t) => a + t.seedlingCount, 0),
      totalSapling: trees.reduce((a, t) => a + t.saplingCount, 0),
    };
  }

  // The survey now asks the ranger to make this call directly (Overall
  // Health Assessment), so that answer is trusted first. The old
  // flag-counting heuristic (canopy cover + regeneration) is only a fallback
  // for submissions from a form version that didn't ask this question.
  function deriveStatus(summary, healthAssessmentRaw) {
    const direct = (healthAssessmentRaw || '').toString().toLowerCase();
    if (direct === 'healthy' || direct === 'moderate' || direct === 'degraded') return direct;

    if (!summary || summary.count === 0) return 'pending';

    let flags = 0;
    if (summary.avgCanopyCoverPct === null || summary.avgCanopyCoverPct < 40) flags++;
    if (summary.totalSeedling === 0 && summary.totalSapling === 0) flags++;

    if (flags === 0) return 'healthy';
    if (flags === 1) return 'moderate';
    return 'degraded';
  }

  function healthAssessmentLabel(raw) {
    switch ((raw || '').toString().toLowerCase()) {
      case 'healthy':  return 'Good';
      case 'moderate': return 'Fair';
      case 'degraded': return 'Poor';
      default:         return prettifyLabel(raw);
    }
  }

  function statusBadge(status) {
    switch (status) {
      case 'healthy':  return { label: 'Good',  badgeCls: 'badge-healthy',  dotCls: 'dot-healthy' };
      case 'moderate': return { label: 'Fair', badgeCls: 'badge-moderate', dotCls: 'dot-moderate' };
      case 'degraded': return { label: 'Poor', badgeCls: 'badge-degraded', dotCls: 'dot-degraded' };
      default:         return { label: 'Pending',  badgeCls: 'badge-moderate', dotCls: 'dot-moderate' };
    }
  }

  function normalizeSubmission(record) {
    const flat = flattenKeys(record);
    const dateRaw   = findField(flat, FIELD_CANDIDATES.date) || flat['_submission_time'] || null;

    const areaRaw = findField(flat, FIELD_CANDIDATES.area);
    const transectRaw = findField(flat, FIELD_CANDIDATES.transect);
    const barangayRaw = findField(flat, FIELD_CANDIDATES.barangay);
    const zoneName = flat['_zone_name'] || null;
    const zoneBarangay = flat['_zone_barangay'] || null;
    const aquafarmRaw = flat['nearby_aquafarm_activity'] || null;
    const aquafarmName = flat['aquafarm_name_if_discharge_observed'] || flat['name_of_aquafarm_if_yes'] || '';
    const waterNotes = flat['water_quality_notes'] || '';
    const additionalNotes = flat['additional_notes'] || '';
    const healthAssessmentRaw = flat['overall_health_assessment'] || null;
    const observedThreats = flat['observed_threats'] || '';
    const waterColor = flat['water_color'] || '';
    const odor = flat['odor'] || '';
    const foamOrDischarge = flat['visible_foam_or_discharge'] || '';
    const treeCount = parseCanopyValue(flat['tree_count']);

    const trees = extractTrees(record).map(normalizeTree);
    const summary = summarizeTrees(trees);

    return {
      id: flat['_id'] || flat['_uuid'] || Math.random().toString(36).slice(2),
      koboId: flat['_id'] || null,
      date: dateRaw ? new Date(dateRaw) : null,
      barangay: zoneBarangay || barangayFromProtectedArea(areaRaw) || BARANGAY_LABELS[barangayRaw] || prettifyLabel(barangayRaw) || 'Unknown',
      area: zoneName || labelForProtectedArea(areaRaw) || prettifyLabel(areaRaw) || '—',
      areaRaw: areaRaw || '',
      transect: (transectRaw ? String(transectRaw).toUpperCase() : null) || '—',
      trees,
      summary,
      aquafarmRaw,
      aquafarmName,
      waterNotes,
      additionalNotes,
      observedThreats,
      waterColor,
      odor,
      foamOrDischarge,
      treeCount,
      healthAssessmentRaw,
      water: aquafarmInfo(aquafarmRaw),
      status: deriveStatus(summary, healthAssessmentRaw),
      submittedBy: findField(flat, FIELD_CANDIDATES.rangerName) || '—',
      photos: collectPhotos(flat, record),
      approvalStatus: flat['_approval_status'] || 'pending',
      reviewNotes: flat['_review_notes'] || '',
      raw: record,
    };
  }

  function formatDate(d) {
    if (!d || isNaN(d.getTime())) return '—';
    return d.toLocaleDateString('en-PH', { year: 'numeric', month: 'short', day: 'numeric' });
  }

  function renderStats(submissions) {
    const totalEl = document.getElementById('stat-total');
    if (totalEl) totalEl.textContent = String(submissions.length);

    const bannerSubEl = document.getElementById('welcomeBannerSub');
    if (bannerSubEl) {
      bannerSubEl.textContent = submissions.length > 0
        ? `You've submitted ${submissions.length} field ${submissions.length === 1 ? 'survey' : 'surveys'} so far.`
        : "You haven't submitted a field survey yet.";
    }

    const counts = { pending: 0, approved: 0, rejected: 0 };
    submissions.forEach(s => {
      const key = s.approvalStatus || 'pending';
      if (counts[key] !== undefined) counts[key] += 1;
    });
    const setCount = (id, n) => { const el = document.getElementById(id); if (el) el.textContent = String(n); };
    setCount('dash-pending-count', counts.pending);
    setCount('dash-approved-count', counts.approved);
    setCount('dash-rejected-count', counts.rejected);
  }

  function renderRecentSubmissions(submissions) {
    const container = document.getElementById('recent-submission-list');
    if (!container) return;

    if (submissions.length === 0) {
      container.innerHTML = `
        <div class="submission-empty">
          No submissions yet.
          <button class="inline-link" onclick="switchView('submit', document.querySelector('[data-view=submit]'))">Submit field data →</button>
        </div>`;
      return;
    }

    const sorted = [...submissions].sort((a, b) => {
      const at = a.date ? a.date.getTime() : 0;
      const bt = b.date ? b.date.getTime() : 0;
      return bt - at;
    });

    const top = sorted.slice(0, 5);
    container.innerHTML = top.map(s => {
      const badge = statusBadge(s.status);
      const canopyText = `Trees recorded: ${s.summary.count}`;
      const deleteBtn = s.koboId
        ? `<button class="submission-delete-btn" data-delete-id="${escapeHtml(String(s.koboId))}" aria-label="Delete submission">
             <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
               <polyline points="3 6 5 6 21 6" />
               <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
             </svg>
           </button>`
        : '';
      return `
        <div class="submission-item">
          <div class="submission-dot ${badge.dotCls}"></div>
          <div class="submission-info">
            <div class="submission-name">${escapeHtml(s.barangay)} · ${escapeHtml(s.transect)}</div>
            <div class="submission-meta">${formatDate(s.date)} · ${canopyText}</div>
          </div>
          <span class="badge ${badge.badgeCls}">${badge.label}</span>
          ${deleteBtn}
        </div>`;
    }).join('');
  }

  function renderHistoryTable(submissions, totalCount) {
    const tbody = document.getElementById('history-table-body');
    const note = document.getElementById('history-note');
    if (!tbody) return;

    const total = typeof totalCount === 'number' ? totalCount : submissions.length;

    if (total === 0) {
      tbody.innerHTML = `<tr><td colspan="7" style="text-align:center; color:var(--ink-400); padding:20px;">No submissions yet.</td></tr>`;
      if (note) note.textContent = 'Showing 0 of 0 submissions. Records will appear here after each field inspection.';
      return;
    }

    if (submissions.length === 0) {
      tbody.innerHTML = `<tr><td colspan="7" class="filter-empty-state">No submissions match your filters.
        <button class="inline-link" id="filter-empty-clear">Clear filters</button></td></tr>`;
      if (note) note.textContent = `Showing 0 of ${total} submissions.`;
      const clearLink = document.getElementById('filter-empty-clear');
      if (clearLink) clearLink.addEventListener('click', clearFilters);
      return;
    }

    const sorted = [...submissions].sort((a, b) => {
      const av = sortValue(a, sortState.key);
      const bv = sortValue(b, sortState.key);
      const cmp = typeof av === 'string' ? av.localeCompare(bv) : av - bv;
      return sortState.dir === 'asc' ? cmp : -cmp;
    });

    updateSortHeaderIndicators();

    tbody.innerHTML = sorted.map(s => {
      const badge = statusBadge(s.status);
      const threatsText = s.observedThreats ? prettifyLabel(s.observedThreats) : 'None';
      const isLocked = s.approvalStatus === 'approved';
      const editBtn = !s.koboId
        ? ''
        : isLocked
        ? `<button class="row-edit-btn row-edit-btn-locked" disabled aria-label="Approved submissions can't be edited" title="Approved submissions can't be edited. Contact MENRO if a correction is needed.">
             <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
               <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
               <path d="M7 11V7a5 5 0 0 1 10 0v4" />
             </svg>
           </button>`
        : `<button class="row-edit-btn" data-edit-id="${escapeHtml(String(s.koboId))}" aria-label="Edit submission">
             <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
               <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
               <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
             </svg>
           </button>`;
      const deleteBtn = !s.koboId
        ? '—'
        : isLocked
        ? `<button class="row-delete-btn row-delete-btn-locked" disabled aria-label="Approved submissions can't be deleted" title="Approved submissions can't be deleted. Contact MENRO if a correction is needed.">
             <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
               <polyline points="3 6 5 6 21 6" />
               <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
             </svg>
           </button>`
        : `<button class="row-delete-btn" data-delete-id="${escapeHtml(String(s.koboId))}" aria-label="Delete submission">
             <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
               <polyline points="3 6 5 6 21 6" />
               <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
             </svg>
           </button>`;
      return `
        <tr class="${s.koboId ? 'row-clickable' : ''}"${s.koboId ? ` data-view-id="${escapeHtml(String(s.koboId))}"` : ''}>
          <td class="cell-nowrap" data-label="Date">${formatDate(s.date)}</td>
          <td class="cell-truncate" data-label="Mangroves" title="${escapeHtml(s.areaRaw || s.area)}">${escapeHtml(s.area)}</td>
          <td data-label="Barangay">${escapeHtml(s.barangay)}</td>
          <td class="cell-center" data-label="Observed Threats">${escapeHtml(threatsText)}</td>
          <td class="cell-center" data-label="Aquafarm Nearby"><span class="wq ${s.water.cls}">${escapeHtml(String(s.water.label))}</span></td>
          <td class="cell-center" data-label="Status"><span class="badge ${badge.badgeCls}">${badge.label}</span></td>
          <td class="cell-center" data-label="Actions">${editBtn}${deleteBtn}</td>
        </tr>`;
    }).join('');

    if (note) note.textContent = `Showing ${sorted.length} of ${total} submissions.`;
  }

  function showError(message) {
    const totalEl = document.getElementById('stat-total');
    if (totalEl) totalEl.textContent = '—';

    const recentContainer = document.getElementById('recent-submission-list');
    if (recentContainer) {
      recentContainer.innerHTML = `<div class="submission-empty">Couldn't load submissions: ${escapeHtml(message)}</div>`;
    }

    const tbody = document.getElementById('history-table-body');
    if (tbody) {
      tbody.innerHTML = `<tr><td colspan="7" style="text-align:center; color:var(--degraded); padding:20px;">Couldn't load submissions: ${escapeHtml(message)}</td></tr>`;
    }
    const note = document.getElementById('history-note');
    if (note) note.textContent = 'Check that ranger-submissions.php is reachable and correctly configured.';
  }

  let currentSubmissions = [];
  let pendingDeleteId = null;

  // Newest-first by default, same as before this became sortable.
  const sortState = { key: 'date', dir: 'desc' };
  const SORT_STATUS_RANK = { healthy: 0, moderate: 1, degraded: 2, pending: 3 };

  function sortValue(s, key) {
    switch (key) {
      case 'date':     return s.date ? s.date.getTime() : 0;
      case 'barangay': return s.barangay || '';
      case 'area':     return s.area || '';
      case 'threats':  return s.observedThreats || '';
      case 'aquafarm': return s.water.label || '';
      case 'status':   return SORT_STATUS_RANK[s.status] ?? 99;
      default:         return 0;
    }
  }

  function updateSortHeaderIndicators() {
    document.querySelectorAll('.history-table th[data-sort-key]').forEach(th => {
      const isActive = th.getAttribute('data-sort-key') === sortState.key;
      th.classList.toggle('sort-active', isActive);
      th.classList.toggle('sort-asc', isActive && sortState.dir === 'asc');
      th.classList.toggle('sort-desc', isActive && sortState.dir === 'desc');
    });
  }

  function bindSortableHeaders() {
    document.querySelectorAll('.history-table th[data-sort-key]').forEach(th => {
      const btn = th.querySelector('.sort-th-btn');
      if (!btn) return;
      btn.addEventListener('click', () => {
        const key = th.getAttribute('data-sort-key');
        if (sortState.key === key) {
          sortState.dir = sortState.dir === 'asc' ? 'desc' : 'asc';
        } else {
          sortState.key = key;
          sortState.dir = 'asc';
        }
        renderHistoryTable(getFilteredSubmissions(), currentSubmissions.length);
      });
    });
    updateSortHeaderIndicators();
  }

  const filterState = {
    search: '',
    barangay: '',
    area: '',
    status: '',
  };

  // Separate from filterState/Clear — this is which tab (All/Pending/
  // Approved/Needs Revision) is selected, not a filter someone dials in.
  let activeApprovalTab = 'all';

  function isFilterActive() {
    return !!(filterState.search || filterState.barangay || filterState.area || filterState.status);
  }

  function getFilteredSubmissions() {
    const q = filterState.search.trim().toLowerCase();
    return currentSubmissions.filter(s => {
      if (activeApprovalTab !== 'all' && s.approvalStatus !== activeApprovalTab) return false;
      if (filterState.barangay && s.barangay !== filterState.barangay) return false;
      if (filterState.area && s.area !== filterState.area) return false;
      if (filterState.status && s.status !== filterState.status) return false;

      if (q) {
        const haystack = `${s.barangay} ${s.area} ${s.transect}`.toLowerCase();
        if (!haystack.includes(q)) return false;
      }
      return true;
    });
  }

  function populateFilterOptions(submissions) {
    const barangaySelect = document.getElementById('filter-barangay');
    const areaSelect = document.getElementById('filter-area');
    if (!barangaySelect || !areaSelect) return;

    const barangays = [...new Set(submissions.map(s => s.barangay).filter(Boolean))].sort();
    const areas = [...new Set(submissions.map(s => s.area).filter(a => a && a !== '—'))].sort();

    const prevBarangay = barangaySelect.value;
    const prevArea = areaSelect.value;

    barangaySelect.innerHTML = '<option value="">All barangays</option>' +
      barangays.map(b => `<option value="${escapeHtml(b)}">${escapeHtml(b)}</option>`).join('');
    areaSelect.innerHTML = '<option value="">All mangroves</option>' +
      areas.map(a => `<option value="${escapeHtml(a)}">${escapeHtml(a)}</option>`).join('');

    if (barangays.includes(prevBarangay)) barangaySelect.value = prevBarangay;
    if (areas.includes(prevArea)) areaSelect.value = prevArea;
  }

  function updateClearButtonState() {
    const clearBtn = document.getElementById('filter-clear');
    if (clearBtn) clearBtn.classList.toggle('is-inactive', !isFilterActive());
  }

  function applyFilters() {
    updateClearButtonState();
    renderHistoryTable(getFilteredSubmissions(), currentSubmissions.length);
  }

  function clearFilters() {
    filterState.search = '';
    filterState.barangay = '';
    filterState.area = '';
    filterState.status = '';

    const searchInput = document.getElementById('filter-search');
    const barangaySelect = document.getElementById('filter-barangay');
    const areaSelect = document.getElementById('filter-area');
    const statusSelect = document.getElementById('filter-status');

    if (searchInput) searchInput.value = '';
    if (barangaySelect) barangaySelect.value = '';
    if (areaSelect) areaSelect.value = '';
    if (statusSelect) statusSelect.value = '';

    applyFilters();
  }

  function bindFilterBar() {
    const searchInput = document.getElementById('filter-search');
    const barangaySelect = document.getElementById('filter-barangay');
    const areaSelect = document.getElementById('filter-area');
    const statusSelect = document.getElementById('filter-status');
    const clearBtn = document.getElementById('filter-clear');

    let searchDebounce = null;
    if (searchInput) {
      searchInput.addEventListener('input', () => {
        clearTimeout(searchDebounce);
        searchDebounce = setTimeout(() => {
          filterState.search = searchInput.value;
          applyFilters();
        }, 180);
      });
    }
    if (barangaySelect) {
      barangaySelect.addEventListener('change', () => {
        filterState.barangay = barangaySelect.value;
        applyFilters();
      });
    }
    if (areaSelect) {
      areaSelect.addEventListener('change', () => {
        filterState.area = areaSelect.value;
        applyFilters();
      });
    }
    if (statusSelect) {
      statusSelect.addEventListener('change', () => {
        filterState.status = statusSelect.value;
        applyFilters();
      });
    }
    if (clearBtn) clearBtn.addEventListener('click', clearFilters);

    updateClearButtonState();
  }

  function updateApprovalTabCounts(submissions) {
    const counts = { all: submissions.length, pending: 0, approved: 0, rejected: 0 };
    submissions.forEach(s => {
      const key = s.approvalStatus || 'pending';
      if (counts[key] !== undefined) counts[key] += 1;
    });
    const setCount = (id, n) => { const el = document.getElementById(id); if (el) el.textContent = String(n); };
    setCount('tabCountAll', counts.all);
    setCount('tabCountPending', counts.pending);
    setCount('tabCountApproved', counts.approved);
    setCount('tabCountRejected', counts.rejected);
  }

  function bindApprovalTabs() {
    document.querySelectorAll('.approval-tab').forEach(tab => {
      if (tab.dataset.bound) return;
      tab.dataset.bound = 'true';
      tab.addEventListener('click', () => {
        activeApprovalTab = tab.getAttribute('data-approval-tab');
        document.querySelectorAll('.approval-tab').forEach(t => t.classList.toggle('active', t === tab));
        applyFilters();
      });
    });
  }

  function bindApprovalSummaryCards() {
    document.querySelectorAll('.stat-row [data-summary-tab]').forEach(card => {
      if (card.dataset.bound) return;
      card.dataset.bound = 'true';
      card.addEventListener('click', () => {
        const tabKey = card.getAttribute('data-summary-tab');
        switchView('history', document.querySelector('[data-view=history]'));
        const tabBtn = document.querySelector(`.approval-tab[data-approval-tab="${tabKey}"]`);
        if (tabBtn) tabBtn.click();
      });
    });
  }

  function renderAll() {
    renderStats(currentSubmissions);
    renderRecentSubmissions(currentSubmissions);
    populateFilterOptions(currentSubmissions);
    updateApprovalTabCounts(currentSubmissions);
    renderHistoryTable(getFilteredSubmissions(), currentSubmissions.length);
  }

  async function loadSubmissions() {
    try {
      const res = await fetch(AQUAGUARD_CONFIG.SUBMISSIONS_API_URL, { credentials: 'same-origin' });
      if (!res.ok) {
        let detail = `HTTP ${res.status}`;
        try {
          const body = await res.json();
          if (body && body.error) detail = body.error;
        } catch (_) {}
        throw new Error(detail);
      }
      const data = await res.json();
      const results = Array.isArray(data.results) ? data.results : (Array.isArray(data) ? data : []);
      currentSubmissions = results.map(normalizeSubmission);
      renderAll();
    } catch (err) {
      console.error('AquaGuard: failed to load Kobo submissions', err);
      showError(err.message || 'Unknown error');
    }
  }

  function findDeleteTarget(e) {
    return e.target.closest('[data-delete-id]');
  }

  function findEditTarget(e) {
    return e.target.closest('[data-edit-id]');
  }

  let pendingViewSubmission = null;

  function viewField(label, value, opts = {}) {
    const isEmpty = value === null || value === undefined || value === '';
    const display = isEmpty ? '—' : escapeHtml(String(value));
    const cls = `view-field${opts.full ? ' view-field-full' : ''}`;
    return `<div class="${cls}"><span class="view-label">${escapeHtml(label)}</span><span class="view-value${isEmpty ? ' muted' : ''}">${display}</span></div>`;
  }

  // .view-grid is a 3-column grid — a row left with only 1 or 2 real fields
  // in it (e.g. right before a full-width field, or at the end of the list)
  // has no element in its last column(s), so nothing paints a border or
  // background there and the grid's box looks cut off. Blank filler cells
  // close out that row so every row looks like a complete, evenly bordered
  // row regardless of how many real fields are in it.
  function viewGridPad(fieldCount) {
    const remainder = fieldCount % 3;
    if (remainder === 0) return '';
    return '<div class="view-field view-field-blank"></div>'.repeat(3 - remainder);
  }

  function viewNotesField(label, value) {
    if (value === null || value === undefined || value === '') return viewField(label, null, { full: true });
    return `<div class="view-field view-field-full"><span class="view-label">${escapeHtml(label)}</span><div class="view-notes">${escapeHtml(String(value))}</div></div>`;
  }

  function viewPhotoField(photos) {
    if (!photos || photos.length === 0) return viewField('Photo documentation', null, { full: true });
    const thumbs = photos.map(p => `
      <a href="${escapeHtml(p.full)}" target="_blank" rel="noopener">
        <img class="view-photo-thumb" src="${escapeHtml(p.thumb)}" alt="Field photo" />
      </a>`).join('');
    return `<div class="view-field view-field-full"><span class="view-label">Photo documentation</span><div class="view-photos">${thumbs}</div></div>`;
  }

  // Same icon glyphs as the matching step in the Submit Field Data wizard,
  // so a submission's summary here reads as the same 4 sections, not a
  // differently-designed view of the same thing.
  const VIEW_SECTION_ICONS = {
    site: '<path d="M12 22s8-9 8-14a8 8 0 1 0-16 0c0 5 8 14 8 14Z"/><circle cx="12" cy="8" r="3"/>',
    vegetation: '<path d="M12 22V12"/><path d="M12 12C12 6.5 8 4 4 4c0 5 2.5 8 8 8Z"/><path d="M12 12c0-4.5 3-7 8-7 0 4.5-2 7-8 7Z"/>',
    fauna: '<circle cx="12" cy="12" r="4"/><path d="M12 8V4"/><path d="M12 20v-4"/><path d="M4.93 4.93l2.83 2.83"/><path d="M16.24 16.24l2.83 2.83"/><path d="M2 12h4"/><path d="M18 12h4"/><path d="M4.93 19.07l2.83-2.83"/><path d="M16.24 7.76l2.83-2.83"/>',
    water: '<path d="M12 2.69s6 7.34 6 11.31a6 6 0 1 1-12 0c0-3.97 6-11.31 6-11.31z"/>',
  };

  function viewSection(icon, title, innerHtml) {
    const iconSvg = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${VIEW_SECTION_ICONS[icon] || ''}</svg>`;
    return `<div class="view-section"><div class="view-section-title"><span class="view-section-icon">${iconSvg}</span>${escapeHtml(title)}</div><div class="view-section-body">${innerHtml}</div></div>`;
  }

  function gpsDisplayFromRaw(raw) {
    const gpsRaw = raw['Record_your_current_location'] || raw['GPS_location'];
    if (!gpsRaw) return null;
    const parts = String(gpsRaw).trim().split(/\s+/);
    return parts.length >= 2 ? `${parts[0]}, ${parts[1]}` : null;
  }

  function openViewModal(submission) {
    pendingViewSubmission = submission;
    const badge = statusBadge(submission.status);

    // Once MENRO has approved a submission it's the official record of what
    // was reviewed — editing it afterward would silently invalidate that
    // approval, so the edit path is locked instead of quietly allowing it.
    const editFromViewBtn = document.getElementById('btnEditFromView');
    if (editFromViewBtn) {
      const isApproved = submission.approvalStatus === 'approved';
      editFromViewBtn.disabled = isApproved;
      editFromViewBtn.textContent = isApproved ? 'Approved — locked from editing' : 'Edit this submission';
      editFromViewBtn.title = isApproved ? 'Approved submissions can\'t be edited. Contact MENRO if a correction is needed.' : '';
    }

    document.getElementById('viewModalSubtitle').textContent =
      `${submission.barangay} · ${formatDate(submission.date)}`;

    const statusEl = document.getElementById('viewStatusBadge');
    if (statusEl) {
      statusEl.className = `badge ${badge.badgeCls}`;
      statusEl.textContent = badge.label;
    }

    const siteFields = [
      viewField('Date of visit', formatDate(submission.date)),
      viewField('Nearest mangrove zone', submission.area !== '—' ? submission.area : null),
      viewField('GPS location', gpsDisplayFromRaw(submission.raw || {})),
    ].join('');

    let vegetationHtml = '';
    if (submission.trees && submission.trees.length > 0) {
      submission.trees.forEach((t, i) => {
        if (submission.trees.length > 1) vegetationHtml += `<div class="view-tree-heading">Tree ${i + 1}</div>`;
        const treeFields = [
          viewField('Species name', t.species !== '—' ? t.species : null),
          viewField('Average tree height (m)', t.height),
          viewField('GBH (cm)', t.gbh),
          viewField('Canopy length (m)', t.canopyLength),
          viewField('Canopy width (m)', t.canopyWidth),
          viewField('Estimated canopy cover (%)', t.canopyCoverDirect),
          viewField('Seedling species', t.seedlingSpecies || null),
          viewField('Seedling count', t.seedlingCount),
          viewField('Sapling species', t.saplingSpecies || null),
          viewField('Sapling count', t.saplingCount),
        ];
        vegetationHtml += `<div class="view-grid">${treeFields.join('')}${viewGridPad(treeFields.length)}</div>`;
      });
    } else {
      vegetationHtml = `<div class="view-empty-note">No trees recorded for this visit.</div>`;
    }
    const summaryFields = [
      viewField('Tree count', submission.treeCount),
      viewField('Overall health assessment', submission.healthAssessmentRaw ? healthAssessmentLabel(submission.healthAssessmentRaw) : null),
    ];
    vegetationHtml += `<div class="view-tree-heading">Summary</div><div class="view-grid">${summaryFields.join('')}${viewGridPad(summaryFields.length)}</div>`;

    const faunaFields = [
      viewField('Mollusk species name', submission.trees[0] ? submission.trees[0].molluskSpecies || null : null),
      viewField('Mollusk count', submission.trees[0] ? submission.trees[0].molluskCount : null),
    ];
    const faunaHtml = `<div class="view-grid">${faunaFields.join('')}${viewGridPad(faunaFields.length)}${viewField('Observed threats', submission.observedThreats ? prettifyLabel(submission.observedThreats) : null, { full: true })}</div>${viewNotesField('Additional notes', submission.additionalNotes || null)}${viewPhotoField(submission.photos)}`;

    const waterFields = [
      viewField('Water color', submission.waterColor ? prettifyLabel(submission.waterColor) : null),
      viewField('Odor', submission.odor ? prettifyLabel(submission.odor) : null),
      viewField('Visible foam or discharge', submission.foamOrDischarge ? prettifyLabel(submission.foamOrDischarge) : null),
      viewField('Nearby aquafarm activity', submission.water.label !== 'No data' ? submission.water.label : null),
      viewField('Aquafarm name (if discharge observed)', isAquafarmActive(submission.aquafarmRaw) ? (submission.aquafarmName || null) : null),
    ];
    const waterHtml = `<div class="view-grid">${waterFields.join('')}${viewGridPad(waterFields.length)}</div>${viewNotesField('Water quality notes', submission.waterNotes || null)}`;

    // MENRO's rejection reason is otherwise invisible on this side — it only
    // ever showed up once, briefly, in the notification dropdown — so a
    // ranger revisiting an older "Needs Revision" submission had no way to
    // recall what needed fixing without asking MENRO again.
    const revisionNoticeHtml = submission.approvalStatus === 'rejected'
      ? `<div class="view-revision-notice">
           <strong>Needs Revision</strong>
           <p>${submission.reviewNotes ? escapeHtml(submission.reviewNotes) : 'MENRO requested changes to this submission. Edit and resubmit when ready.'}</p>
         </div>`
      : '';

    document.getElementById('viewModalBody').innerHTML =
      revisionNoticeHtml +
      viewSection('site', 'Site Information', `<div class="view-grid">${siteFields}</div>`) +
      viewSection('vegetation', 'Vegetation', vegetationHtml) +
      viewSection('fauna', 'Fauna', faunaHtml) +
      viewSection('water', 'Water Quality', waterHtml);

    const overlay = document.getElementById('viewOverlay');
    if (overlay) overlay.classList.add('open');
  }

  function closeViewModal() {
    const overlay = document.getElementById('viewOverlay');
    if (overlay) overlay.classList.remove('open');
    pendingViewSubmission = null;
  }

  function findViewTarget(e) {
    if (findEditTarget(e) || findDeleteTarget(e)) return null;
    return e.target.closest('tr[data-view-id]');
  }

  function bindViewDelegation() {
    const historyBody = document.getElementById('history-table-body');
    if (!historyBody) return;
    historyBody.addEventListener('click', (e) => {
      const row = findViewTarget(e);
      if (!row) return;
      const submissionId = row.getAttribute('data-view-id');
      const submission = currentSubmissions.find(s => String(s.koboId) === String(submissionId));
      if (!submission) return;
      openViewModal(submission);
    });
  }

  function bindViewModal() {
    const overlay = document.getElementById('viewOverlay');
    const closeBtn = document.getElementById('btnCloseView');
    const closeFooterBtn = document.getElementById('btnCloseViewFooter');
    const editFromViewBtn = document.getElementById('btnEditFromView');
    if (!overlay) return;

    if (closeBtn) closeBtn.addEventListener('click', closeViewModal);
    if (closeFooterBtn) closeFooterBtn.addEventListener('click', closeViewModal);
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && overlay.classList.contains('open')) closeViewModal();
    });
    if (editFromViewBtn) {
      editFromViewBtn.addEventListener('click', () => {
        const submission = pendingViewSubmission;
        closeViewModal();
        if (!submission) return;
        switchView('submit', document.querySelector('[data-view=submit]'));
        if (typeof window.startFieldSurveyEdit === 'function') window.startFieldSurveyEdit(submission);
      });
    }
  }

  function bindEditDelegation() {
    const recentContainer = document.getElementById('recent-submission-list');
    const historyBody = document.getElementById('history-table-body');
    [recentContainer, historyBody].forEach(el => {
      if (!el) return;
      el.addEventListener('click', (e) => {
        const target = findEditTarget(e);
        if (!target) return;
        const submissionId = target.getAttribute('data-edit-id');
        const submission = currentSubmissions.find(s => String(s.koboId) === String(submissionId));
        if (!submission) return;
        switchView('submit', document.querySelector('[data-view=submit]'));
        if (typeof window.startFieldSurveyEdit === 'function') window.startFieldSurveyEdit(submission);
      });
    });
  }

  function bindDeleteDelegation() {
    const recentContainer = document.getElementById('recent-submission-list');
    const historyBody = document.getElementById('history-table-body');
    [recentContainer, historyBody].forEach(el => {
      if (!el) return;
      el.addEventListener('click', (e) => {
        const target = findDeleteTarget(e);
        if (!target) return;
        pendingDeleteId = target.getAttribute('data-delete-id');
        openDeleteConfirm();
      });
    });
  }

  function openDeleteConfirm() {
    const overlay = document.getElementById('deleteOverlay');
    if (overlay) overlay.classList.add('open');
  }

  function closeDeleteConfirm() {
    const overlay = document.getElementById('deleteOverlay');
    if (overlay) overlay.classList.remove('open');
    pendingDeleteId = null;
  }

  async function confirmDelete() {
    if (!pendingDeleteId) {
      closeDeleteConfirm();
      return;
    }
    const idToDelete = pendingDeleteId;
    const confirmBtn = document.getElementById('btnConfirmDelete');
    if (confirmBtn) {
      confirmBtn.disabled = true;
      confirmBtn.textContent = 'Deleting…';
    }

    try {
      const res = await fetch(`${AQUAGUARD_CONFIG.SUBMISSIONS_API_URL}?action=delete&id=${encodeURIComponent(idToDelete)}`, {
        method: 'POST',
        credentials: 'same-origin'
      });
      if (!res.ok) {
        let detail = `HTTP ${res.status}`;
        try {
          const body = await res.json();
          if (body && body.error) detail = body.error;
        } catch (_) {}
        throw new Error(detail);
      }
      currentSubmissions = currentSubmissions.filter(s => String(s.koboId) !== String(idToDelete));
      renderAll();
      closeDeleteConfirm();
    } catch (err) {
      console.error('AquaGuard: failed to delete submission', err);
      alert(`Couldn't delete this submission: ${err.message || 'Unknown error'}`);
    } finally {
      if (confirmBtn) {
        confirmBtn.disabled = false;
        confirmBtn.textContent = 'Delete';
      }
    }
  }

  function bindDeleteModal() {
    const overlay = document.getElementById('deleteOverlay');
    const closeBtn = document.getElementById('btnCloseDelete');
    const cancelBtn = document.getElementById('btnCancelDelete');
    const confirmBtn = document.getElementById('btnConfirmDelete');
    if (!overlay || !confirmBtn) return;

    if (closeBtn) closeBtn.addEventListener('click', closeDeleteConfirm);
    if (cancelBtn) cancelBtn.addEventListener('click', closeDeleteConfirm);
    overlay.addEventListener('click', (e) => {
      if (e.target === overlay) closeDeleteConfirm();
    });
    confirmBtn.addEventListener('click', confirmDelete);
  }

  bindDeleteDelegation();
  bindEditDelegation();
  bindViewDelegation();
  bindDeleteModal();
  bindViewModal();
  bindFilterBar();
  bindSortableHeaders();
  bindApprovalTabs();
  bindApprovalSummaryCards();
  loadSubmissions();

  window.refreshAquaGuardSubmissions = loadSubmissions;
  setInterval(loadSubmissions, 20000);

  // Lets a notification (which only knows a submission's kobo id) jump
  // straight to that submission's detail popup on Submission History,
  // re-fetching first so a just-approved record is guaranteed to be there.
  window.openSubmissionViewByKoboId = async function (koboId) {
    switchView('history', document.querySelector('[data-view=history]'));
    await loadSubmissions();
    const submission = currentSubmissions.find(s => String(s.koboId) === String(koboId));
    if (submission) openViewModal(submission);
  };
})();