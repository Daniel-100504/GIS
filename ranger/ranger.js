const AQUAGUARD_CONFIG = {
  KOBO_PROXY_URL: '../Menro/API/kobo-proxy.php',
  TOTAL_PROTECTED_AREAS: 6,
};

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
  confirmBtn.addEventListener('click', () => {
    window.location.href = '../Login/Login.html';
  });
})();

function switchView(viewName, btn) {
  document.querySelectorAll('.view').forEach(v => v.classList.remove('active'));
  document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'));

  const target = document.getElementById('view-' + viewName);
  if (target) target.classList.add('active');

  if (btn) btn.classList.add('active');

  const titles = { dashboard: 'Dashboard', submit: 'Submit Field Data', history: 'Submission History' };
  const titleEl = document.getElementById('topbar-title');
  if (titleEl) titleEl.textContent = titles[viewName] || 'Dashboard';
}

(function AquaGuardData() {

  const FIELD_CANDIDATES = {
    date:      ['date', 'inspection_date', 'date_of_inspection', 'survey_date', 'today'],
    barangay:  ['barangay', 'brgy', 'location', 'site', 'site_name'],
    area:      ['protected_area', 'mpa', 'area', 'protected_area_name', 'ecosystem_area'],
    transect:  ['transect', 'transect_quadrat', 'quadrat', 'plot', 'plot_id', 'transect_id'],
    canopy:    ['canopy_cover', 'canopy', 'canopy_percent', 'canopy_cover_percent', 'percent_canopy_cover'],
    water:     ['water_quality', 'water_quality_status', 'wq', 'water_condition', 'water_quality_observed'],
  };

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
    const str = String(raw).trim();
    if (str === '' || str === '—') return null;
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

  function waterQualityInfo(raw) {
    const wq = (raw || '').toString().toLowerCase();
    if (wq.includes('discharge')) return { label: 'Discharge', cls: 'wq-discharge' };
    if (wq.includes('turbid'))    return { label: 'Turbid',    cls: 'wq-turbid' };
    if (wq.includes('clear'))     return { label: 'Clear',     cls: 'wq-clear' };
    if (!wq) return { label: 'No data', cls: 'wq-pending' };
    return { label: prettifyLabel(raw) || raw, cls: 'wq-clear' };
  }

  function deriveStatus(canopyNum, waterRaw) {
    const wq = (waterRaw || '').toString().toLowerCase();
    if (wq.includes('discharge')) return 'degraded';
    if (canopyNum === null) return wq.includes('turbid') ? 'moderate' : 'pending';
    if (canopyNum >= 70) return 'healthy';
    if (canopyNum >= 40) return 'moderate';
    return 'degraded';
  }

  function statusBadge(status) {
    switch (status) {
      case 'healthy':  return { label: 'Healthy',  badgeCls: 'badge-healthy',  dotCls: 'dot-healthy' };
      case 'moderate': return { label: 'Moderate', badgeCls: 'badge-moderate', dotCls: 'dot-moderate' };
      case 'degraded': return { label: 'Degraded', badgeCls: 'badge-degraded', dotCls: 'dot-degraded' };
      default:         return { label: 'Pending',  badgeCls: 'badge-moderate', dotCls: 'dot-moderate' };
    }
  }

  function normalizeSubmission(record) {
    const flat = flattenKeys(record);
    const canopyNum = parseCanopyValue(findField(flat, FIELD_CANDIDATES.canopy));
    const waterRaw  = findField(flat, FIELD_CANDIDATES.water);
    const dateRaw   = findField(flat, FIELD_CANDIDATES.date) || flat['_submission_time'] || null;

    const areaRaw = findField(flat, FIELD_CANDIDATES.area);
    const transectRaw = findField(flat, FIELD_CANDIDATES.transect);

    return {
      id: flat['_id'] || flat['_uuid'] || Math.random().toString(36).slice(2),
      koboId: flat['_id'] || null,
      date: dateRaw ? new Date(dateRaw) : null,
      barangay: prettifyLabel(findField(flat, FIELD_CANDIDATES.barangay)) || 'Unknown',
      area: prettifyLabel(areaRaw) || '—',
      areaRaw: areaRaw || '',
      transect: (transectRaw ? String(transectRaw).toUpperCase() : null) || '—',
      canopy: canopyNum,
      water: waterQualityInfo(waterRaw),
      status: deriveStatus(canopyNum, waterRaw),
    };
  }

  function formatDate(d) {
    if (!d || isNaN(d.getTime())) return '—';
    return d.toLocaleDateString('en-PH', { year: 'numeric', month: 'short', day: 'numeric' });
  }

  function renderStats(submissions) {
    const totalEl = document.getElementById('stat-total');
    if (totalEl) totalEl.textContent = String(submissions.length);

    const sorted = [...submissions].sort((a, b) => {
      const at = a.date ? a.date.getTime() : 0;
      const bt = b.date ? b.date.getTime() : 0;
      return bt - at;
    });
    const latest = sorted[0];

    const lastDateEl = document.getElementById('stat-last-date');
    const lastBrgyEl = document.getElementById('stat-last-barangay');
    if (latest) {
      if (lastDateEl) lastDateEl.textContent = formatDate(latest.date);
      if (lastBrgyEl) lastBrgyEl.textContent = latest.barangay;
    } else {
      if (lastDateEl) lastDateEl.textContent = 'No data';
      if (lastBrgyEl) lastBrgyEl.textContent = '\u00A0';
    }

    const areasSet = new Set(submissions.map(s => s.area).filter(a => a && a !== '—'));
    const areasEl = document.getElementById('stat-areas');
    const areasMetaEl = document.getElementById('stat-areas-meta');
    if (areasEl) areasEl.textContent = String(areasSet.size);
    if (areasMetaEl) areasMetaEl.textContent = `of ${AQUAGUARD_CONFIG.TOTAL_PROTECTED_AREAS} protected areas`;
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
      const canopyText = s.canopy !== null ? `Canopy: ${s.canopy}%` : 'Canopy: —';
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
      tbody.innerHTML = `<tr><td colspan="8" style="text-align:center; color:var(--ink-400); padding:20px;">No submissions yet.</td></tr>`;
      if (note) note.textContent = 'Showing 0 of 0 submissions. Records will appear here after each field inspection.';
      return;
    }

    if (submissions.length === 0) {
      tbody.innerHTML = `<tr><td colspan="8" class="filter-empty-state">No submissions match your filters.
        <button class="inline-link" id="filter-empty-clear">Clear filters</button></td></tr>`;
      if (note) note.textContent = `Showing 0 of ${total} submissions.`;
      const clearLink = document.getElementById('filter-empty-clear');
      if (clearLink) clearLink.addEventListener('click', clearFilters);
      return;
    }

    const sorted = [...submissions].sort((a, b) => {
      const at = a.date ? a.date.getTime() : 0;
      const bt = b.date ? b.date.getTime() : 0;
      return bt - at;
    });

    tbody.innerHTML = sorted.map(s => {
      const badge = statusBadge(s.status);
      const canopyText = s.canopy !== null ? `${s.canopy}%` : '—';
      const deleteBtn = s.koboId
        ? `<button class="row-delete-btn" data-delete-id="${escapeHtml(String(s.koboId))}" aria-label="Delete submission">
             <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
               <polyline points="3 6 5 6 21 6" />
               <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
             </svg>
           </button>`
        : '—';
      return `
        <tr>
          <td class="cell-nowrap">${formatDate(s.date)}</td>
          <td>${escapeHtml(s.barangay)}</td>
          <td class="cell-truncate" title="${escapeHtml(s.areaRaw || s.area)}">${escapeHtml(s.area)}</td>
          <td class="cell-center cell-nowrap">${escapeHtml(s.transect)}</td>
          <td class="cell-right cell-nowrap">${canopyText}</td>
          <td class="cell-center"><span class="wq ${s.water.cls}">${escapeHtml(String(s.water.label))}</span></td>
          <td class="cell-center"><span class="badge ${badge.badgeCls}">${badge.label}</span></td>
          <td class="cell-center">${deleteBtn}</td>
        </tr>`;
    }).join('');

    if (note) note.textContent = `Showing ${sorted.length} of ${total} submissions.`;
  }

  function renderAlert(submissions) {
    const panel = document.getElementById('water-quality-alert');
    const titleEl = document.getElementById('alert-title');
    const subEl = document.getElementById('alert-sub');
    if (!panel) return;

    const flagged = submissions.filter(s => s.status === 'degraded' || s.water.label === 'Discharge');
    if (flagged.length === 0) {
      panel.style.display = 'none';
      return;
    }

    const byBarangay = {};
    flagged.forEach(s => {
      byBarangay[s.barangay] = (byBarangay[s.barangay] || 0) + 1;
    });
    const zones = Object.keys(byBarangay);
    const topZone = zones.sort((a, b) => byBarangay[b] - byBarangay[a])[0];

    if (titleEl) titleEl.textContent = `Water quality concern detected — ${topZone}`;
    if (subEl) subEl.textContent = `${flagged.length} submission${flagged.length === 1 ? '' : 's'} flagged degraded or discharge conditions. Prioritize water quality checks on your next inspection.`;
    panel.style.display = 'flex';
  }

  function escapeHtml(str) {
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
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
      tbody.innerHTML = `<tr><td colspan="8" style="text-align:center; color:var(--degraded); padding:20px;">Couldn't load submissions: ${escapeHtml(message)}</td></tr>`;
    }
    const note = document.getElementById('history-note');
    if (note) note.textContent = 'Check that kobo-proxy.php is reachable and correctly configured.';
  }

  let currentSubmissions = [];
  let pendingDeleteId = null;

  const filterState = {
    search: '',
    barangay: '',
    area: '',
    status: '',
    dateFrom: null,
    dateTo: null,
  };

  function isFilterActive() {
    return !!(filterState.search || filterState.barangay || filterState.area ||
      filterState.status || filterState.dateFrom || filterState.dateTo);
  }

  function getFilteredSubmissions() {
    const q = filterState.search.trim().toLowerCase();
    return currentSubmissions.filter(s => {
      if (filterState.barangay && s.barangay !== filterState.barangay) return false;
      if (filterState.area && s.area !== filterState.area) return false;
      if (filterState.status && s.status !== filterState.status) return false;

      if (filterState.dateFrom) {
        if (!s.date || isNaN(s.date.getTime()) || s.date < filterState.dateFrom) return false;
      }
      if (filterState.dateTo) {
        if (!s.date || isNaN(s.date.getTime()) || s.date > filterState.dateTo) return false;
      }

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
    areaSelect.innerHTML = '<option value="">All protected areas</option>' +
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
    filterState.dateFrom = null;
    filterState.dateTo = null;

    const searchInput = document.getElementById('filter-search');
    const barangaySelect = document.getElementById('filter-barangay');
    const areaSelect = document.getElementById('filter-area');
    const statusSelect = document.getElementById('filter-status');
    const dateFromInput = document.getElementById('filter-date-from');
    const dateToInput = document.getElementById('filter-date-to');

    if (searchInput) searchInput.value = '';
    if (barangaySelect) barangaySelect.value = '';
    if (areaSelect) areaSelect.value = '';
    if (statusSelect) statusSelect.value = '';
    if (dateFromInput) dateFromInput.value = '';
    if (dateToInput) dateToInput.value = '';

    applyFilters();
  }

  function parseDateInput(value) {
    if (!value) return null;
    const d = new Date(value + 'T00:00:00');
    return isNaN(d.getTime()) ? null : d;
  }

  function bindFilterBar() {
    const searchInput = document.getElementById('filter-search');
    const barangaySelect = document.getElementById('filter-barangay');
    const areaSelect = document.getElementById('filter-area');
    const statusSelect = document.getElementById('filter-status');
    const dateFromInput = document.getElementById('filter-date-from');
    const dateToInput = document.getElementById('filter-date-to');
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
    if (dateFromInput) {
      dateFromInput.addEventListener('change', () => {
        filterState.dateFrom = parseDateInput(dateFromInput.value);
        applyFilters();
      });
    }
    if (dateToInput) {
      dateToInput.addEventListener('change', () => {
        const d = parseDateInput(dateToInput.value);
        if (d) d.setHours(23, 59, 59, 999);
        filterState.dateTo = d;
        applyFilters();
      });
    }
    if (clearBtn) clearBtn.addEventListener('click', clearFilters);

    updateClearButtonState();
  }

  function renderAll() {
    renderStats(currentSubmissions);
    renderRecentSubmissions(currentSubmissions);
    populateFilterOptions(currentSubmissions);
    renderHistoryTable(getFilteredSubmissions(), currentSubmissions.length);
    renderAlert(currentSubmissions);
  }

  async function loadSubmissions() {
    try {
      const res = await fetch(AQUAGUARD_CONFIG.KOBO_PROXY_URL, { credentials: 'same-origin' });
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
      const res = await fetch(`${AQUAGUARD_CONFIG.KOBO_PROXY_URL}?action=delete&id=${encodeURIComponent(idToDelete)}`, {
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
  bindDeleteModal();
  bindFilterBar();
  loadSubmissions();
})();