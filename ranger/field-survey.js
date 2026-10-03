(function FieldSurveyForm() {
  const form = document.getElementById('fieldSurveyForm');
  if (!form) return;

  // toISOString() converts to UTC first, so in timezones ahead of UTC (like
  // the Philippines, UTC+8) early-morning local times land on the previous
  // UTC day — that made "today" compute as yesterday and blocked the actual
  // current date in the picker. Building the string from local getters avoids that.
  function localDateStr(date) {
    const d = date || new Date();
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${y}-${m}-${day}`;
  }

  const gpsRow = document.getElementById('surveyGpsRow');
  const gpsStatusEl = document.getElementById('surveyGpsStatus');
  const btnRetryGps = document.getElementById('btnRetryGps');
  const msgEl = document.getElementById('fieldSurveyMsg');
  const submitBtn = document.getElementById('btnSubmitSurvey');

  let currentPosition = null;

  // A live "which zone am I in" check — lets the ranger catch a bad GPS
  // pin before submitting, instead of only finding out afterward once the
  // submission shows up (already tagged with a zone) in their history.
  // Read-only and best-effort: if it fails (no signal, server hiccup) the
  // preview just stays hidden — the real match still happens the same way
  // on the server once the survey is actually submitted.
  const zonePreviewEl = document.getElementById('surveyZonePreview');
  let zonePreviewRequestId = 0;

  // Beyond this, the "nearest" zone is probably not actually where the
  // ranger is standing — worth a caveat instead of stating it plainly.
  const ZONE_FAR_THRESHOLD_M = 300;

  function formatDistance(meters) {
    if (meters >= 1000) return `${(meters / 1000).toFixed(1)} km`;
    return `${Math.round(meters)} m`;
  }

  async function updateZonePreview(lat, lng) {
    if (!zonePreviewEl) return;
    const requestId = ++zonePreviewRequestId;
    zonePreviewEl.hidden = false;
    zonePreviewEl.classList.remove('survey-zone-preview-far', 'survey-zone-preview-inside');
    zonePreviewEl.textContent = 'Checking nearest mangrove zone…';

    try {
      const res = await fetch(`../Menro/API/nearest-zone.php?lat=${lat}&lng=${lng}`, { credentials: 'same-origin' });
      const data = await res.json();
      if (requestId !== zonePreviewRequestId) return; // a newer check has since superseded this one
      if (data && data.zone) {
        const zone = data.zone;
        const isFar = typeof zone.distanceMeters === 'number' && !zone.inside && zone.distanceMeters > ZONE_FAR_THRESHOLD_M;
        if (zone.inside) {
          zonePreviewEl.classList.add('survey-zone-preview-inside');
          zonePreviewEl.textContent = `✓ You are in ${zone.name} · Barangay: ${zone.barangay}`;
        } else if (isFar) {
          zonePreviewEl.classList.add('survey-zone-preview-far');
          zonePreviewEl.textContent = `Nearest mangrove: ${zone.name} (${formatDistance(zone.distanceMeters)} away) · Barangay: ${zone.barangay}`;
        } else {
          zonePreviewEl.textContent = `Nearest mangrove zone: ${zone.name} · Barangay: ${zone.barangay}`;
        }
      } else {
        zonePreviewEl.hidden = true;
      }
    } catch (err) {
      if (requestId !== zonePreviewRequestId) return;
      zonePreviewEl.hidden = true;
    }
  }

  function setGpsStatus(state, text) {
    gpsRow.classList.remove('ok', 'error');
    if (state) gpsRow.classList.add(state);
    gpsStatusEl.textContent = text;
    btnRetryGps.hidden = state !== 'error';
    if (state === 'ok' && currentPosition) updateZonePreview(currentPosition.lat, currentPosition.lng);
  }

  // A small map lets the ranger fine-tune (or fully override) the
  // auto-detected GPS fix by dragging the pin or tapping elsewhere — phone
  // GPS can land a few meters off, especially under mangrove canopy.
  const CALATAGAN_CENTER = [13.8300, 120.6300];
  let gpsMap = null;
  let gpsMarker = null;

  function movePin(lat, lng, recenter) {
    if (gpsMarker) gpsMarker.setLatLng([lat, lng]);
    if (gpsMap && recenter) gpsMap.setView([lat, lng], Math.max(gpsMap.getZoom(), 16));
  }

  // The map is heavy (it pulls in dozens of tile images), so it isn't built
  // until the ranger actually opens the Submit Field Data tab — building it
  // eagerly on every page load was competing with everything else the page
  // loads and made the whole page feel slower to open.
  function initGpsMap() {
    const mapEl = document.getElementById('surveyGpsMap');
    if (!mapEl || typeof L === 'undefined') return;
    if (gpsMap) {
      setTimeout(() => gpsMap.invalidateSize(), 50);
      return;
    }

    const startCenter = currentPosition ? [currentPosition.lat, currentPosition.lng] : CALATAGAN_CENTER;
    // Scroll-zoom is off — this map sits inside a long scrollable form, so
    // with it on, scrolling down the page while the cursor happens to pass
    // over the map zooms the map instead of scrolling the page, which the
    // ranger would have to fight every time. Dragging/tapping the pin and
    // the +/- buttons already cover zooming and placement without it.
    gpsMap = L.map(mapEl, { zoomControl: true, scrollWheelZoom: false }).setView(startCenter, currentPosition ? 16 : 15);

    const loadingEl = document.getElementById('surveyGpsMapLoading');
    const hideLoading = () => { if (loadingEl) loadingEl.hidden = true; };

    const streetLayer = L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '© OpenStreetMap',
      maxZoom: 19,
      keepBuffer: 1,
    });
    // Street tiles don't show much out in a mangrove area (no roads or
    // landmarks to go by) — satellite imagery lets the ranger actually see
    // the trees, water, and shoreline to confirm they're pinning the right
    // spot. Same sharper Esri source (plus its place-name overlay) as the
    // Menro map, instead of the lower-resolution public Esri endpoint.
    const satelliteImagery = L.tileLayer('https://clarity.maptiles.arcgis.com/arcgis/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}', {
      attribution: 'Tiles © Esri — Source: Esri, Maxar, Earthstar Geographics',
      maxZoom: 19,
      keepBuffer: 1,
    });
    const satelliteLabels = L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/Reference/World_Boundaries_and_Places/MapServer/tile/{z}/{y}/{x}', {
      attribution: 'Labels © Esri',
      maxZoom: 19,
      keepBuffer: 1,
    });
    const satelliteLayer = L.layerGroup([satelliteImagery, satelliteLabels]);

    streetLayer.addTo(gpsMap);
    L.control.layers({ 'Map': streetLayer, 'Satellite': satelliteLayer }, null, { position: 'topright' }).addTo(gpsMap);

    streetLayer.once('load', hideLoading);
    satelliteImagery.once('load', hideLoading);
    setTimeout(hideLoading, 8000); // don't leave the overlay stuck if tiles never fire "load"

    gpsMarker = L.marker(startCenter, { draggable: true }).addTo(gpsMap);

    gpsMarker.on('dragend', () => {
      const pos = gpsMarker.getLatLng();
      currentPosition = { lat: pos.lat, lng: pos.lng };
      setGpsStatus('ok', `Pinned location (${pos.lat.toFixed(5)}, ${pos.lng.toFixed(5)})`);
    });

    gpsMap.on('click', (e) => {
      movePin(e.latlng.lat, e.latlng.lng, false);
      currentPosition = { lat: e.latlng.lat, lng: e.latlng.lng };
      setGpsStatus('ok', `Pinned location (${e.latlng.lat.toFixed(5)}, ${e.latlng.lng.toFixed(5)})`);
    });

    setTimeout(() => gpsMap.invalidateSize(), 80);
  }
  window.initSurveyGpsMap = initGpsMap;

  function captureGps() {
    if (!navigator.geolocation) {
      setGpsStatus('error', 'Location is not supported on this device.');
      return;
    }
    setGpsStatus(null, 'Getting your location…');
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        currentPosition = { lat: pos.coords.latitude, lng: pos.coords.longitude };
        setGpsStatus('ok', `Location captured (${currentPosition.lat.toFixed(5)}, ${currentPosition.lng.toFixed(5)})`);
        movePin(currentPosition.lat, currentPosition.lng, true);
      },
      (err) => {
        setGpsStatus('error', 'Could not get your location — check location permission, or pin your location on the map below.');
      },
      { enableHighAccuracy: true, timeout: 15000, maximumAge: 60000 }
    );
  }

  captureGps();
  btnRetryGps.addEventListener('click', captureGps);

  const btnLocateGps = document.getElementById('btnLocateGps');
  if (btnLocateGps) btnLocateGps.addEventListener('click', captureGps);

  const photoInputEl = document.getElementById('fs-photo');
  const photoLabelEl = document.getElementById('surveyPhotoLabel');
  const PHOTO_LABEL_DEFAULT = photoLabelEl.textContent;
  const surveyPhotosListEl = document.getElementById('surveyPhotosList');
  // A newly picked file lives in the input's own .files, but a native
  // multi-select input replaces that FileList entirely on every pick instead
  // of adding to it — so photos actually picked so far are tracked by hand
  // here instead of trusting the input to remember earlier picks.
  let selectedPhotoFiles = [];
  // Existing submission's own photo(s), when editing — read-only for now
  // (the backend only stores one photo per submission today), shown
  // alongside whatever new photos get picked in this edit.
  let existingPhotoUrls = [];

  function renderPhotoThumbs() {
    if (!surveyPhotosListEl) return;
    surveyPhotosListEl.innerHTML = '';
    existingPhotoUrls.forEach((url) => {
      const thumb = document.createElement('div');
      thumb.className = 'survey-photo-thumb';
      thumb.innerHTML = `<img src="${escapeHtml(url)}" alt="Existing photo" />`;
      surveyPhotosListEl.appendChild(thumb);
    });
    selectedPhotoFiles.forEach((file, idx) => {
      const thumb = document.createElement('div');
      thumb.className = 'survey-photo-thumb';
      thumb.innerHTML = `
        <img src="${URL.createObjectURL(file)}" alt="Selected photo" />
        <button type="button" class="survey-photo-thumb-remove" aria-label="Remove photo">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
        </button>
      `;
      thumb.querySelector('.survey-photo-thumb-remove').addEventListener('click', () => {
        selectedPhotoFiles.splice(idx, 1);
        renderPhotoThumbs();
      });
      surveyPhotosListEl.appendChild(thumb);
    });
    photoLabelEl.textContent = (selectedPhotoFiles.length > 0 || existingPhotoUrls.length > 0)
      ? 'Add more photos'
      : PHOTO_LABEL_DEFAULT;
  }

  photoInputEl.addEventListener('change', () => {
    selectedPhotoFiles = selectedPhotoFiles.concat(Array.from(photoInputEl.files || []));
    photoInputEl.value = '';
    renderPhotoThumbs();
  });

  function resetPhotos() {
    selectedPhotoFiles = [];
    existingPhotoUrls = [];
    renderPhotoThumbs();
  }

  // A canopy cover reading is a percentage of the plot, so anything past
  // 100 isn't a real reading — the field's own min/max attributes only
  // affect a native browser form-submit, which this custom step wizard
  // never actually triggers, so nothing stopped 150 from being typed in
  // and carried straight through to submission without this.
  const canopyCoverInput = document.getElementById('fs-canopy-cover');
  if (canopyCoverInput) {
    canopyCoverInput.addEventListener('input', () => {
      const val = parseFloat(canopyCoverInput.value);
      if (!isNaN(val) && val > 100) canopyCoverInput.value = '100';
    });
  }

  // Fauna step, part 1: mollusks found — a repeatable table like Vegetation's
  // species table, but genuinely optional and starting completely empty (no
  // mollusks seen is a normal, common result, unlike a plot having literally
  // no species). The header row and "no mollusks" note swap based on whether
  // any row exists, matching the mockup.
  const molluskTableRowsEl = document.getElementById('molluskTableRows');
  const molluskTableHeaderEl = document.getElementById('molluskTableHeader');
  const molluskEmptyNoteEl = document.getElementById('molluskEmptyNote');
  const btnAddMollusk = document.getElementById('btnAddMollusk');

  function buildMolluskRowOptionsHtml(selectedValue) {
    const used = new Set(
      Array.from(molluskTableRowsEl.querySelectorAll('.mollusk-row-select'))
        .map((sel) => sel.value)
        .filter((v) => v && v !== selectedValue)
    );
    let html = '<option value="">Select…</option>';
    MOLLUSK_SPECIES_LIST.forEach((sp) => {
      if (used.has(sp)) return;
      const escaped = sp.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;');
      html += `<option value="${escaped}"${sp === selectedValue ? ' selected' : ''}>${escaped}</option>`;
    });
    // "Other" isn't excluded once another row already picked it — unlike a
    // real listed species, several rows can each be a different unlisted
    // mollusk, so it stays available every time.
    html += `<option value="__other__"${selectedValue === '__other__' ? ' selected' : ''}>Other (specify)</option>`;
    return html;
  }

  function updateMolluskTableVisibility() {
    const hasRows = molluskTableRowsEl.children.length > 0;
    if (molluskTableHeaderEl) molluskTableHeaderEl.hidden = !hasRows;
    if (molluskEmptyNoteEl) molluskEmptyNoteEl.hidden = hasRows;
    // "Other" makes the list effectively unlimited, so there's always room
    // for one more row.
    if (btnAddMollusk) btnAddMollusk.disabled = false;
  }

  function refreshMolluskRowOptions() {
    molluskTableRowsEl.querySelectorAll('.mollusk-row-select').forEach((sel) => {
      const current = sel.value;
      sel.innerHTML = buildMolluskRowOptionsHtml(current);
    });
    updateMolluskTableVisibility();
  }

  function updateMolluskOtherVisibility(row) {
    const select = row.querySelector('.mollusk-row-select');
    const otherInput = row.querySelector('.mollusk-row-other');
    const show = select.value === '__other__';
    otherInput.hidden = !show;
    if (show) otherInput.focus();
    else otherInput.value = '';
  }

  function createMolluskRowEl(prefill) {
    const row = document.createElement('div');
    row.className = 'mollusk-row';
    row.innerHTML = `
      <div class="mollusk-row-species-cell">
        <select class="mollusk-row-select" aria-label="Mollusk species"></select>
        <input type="text" class="mollusk-row-other" placeholder="Enter species name" hidden />
      </div>
      <button type="button" class="mollusk-row-remove" aria-label="Remove mollusk row" title="Remove">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>
      </button>
    `;
    const select = row.querySelector('.mollusk-row-select');
    const isKnown = prefill && prefill.species && MOLLUSK_SPECIES_LIST.includes(prefill.species);
    const isCustom = prefill && prefill.species && !isKnown;
    select.innerHTML = buildMolluskRowOptionsHtml(isCustom ? '__other__' : (prefill ? prefill.species : ''));
    select.addEventListener('change', () => {
      refreshMolluskRowOptions();
      updateMolluskOtherVisibility(row);
    });
    row.querySelector('.mollusk-row-remove').addEventListener('click', () => removeMolluskRow(row));
    if (isCustom) {
      const otherInput = row.querySelector('.mollusk-row-other');
      otherInput.hidden = false;
      otherInput.value = prefill.species;
    }
    return row;
  }

  function addMolluskRow(prefill) {
    const row = createMolluskRowEl(prefill);
    molluskTableRowsEl.appendChild(row);
    updateMolluskTableVisibility();
    return row;
  }

  function removeMolluskRow(row) {
    row.remove();
    refreshMolluskRowOptions();
  }

  function resetMolluskTable() {
    molluskTableRowsEl.innerHTML = '';
    updateMolluskTableVisibility();
  }

  if (btnAddMollusk) btnAddMollusk.addEventListener('click', () => addMolluskRow());
  if (molluskTableRowsEl) updateMolluskTableVisibility();

  function collectMolluskTableRows() {
    const rows = [];
    molluskTableRowsEl.querySelectorAll('.mollusk-row').forEach((row) => {
      const selectVal = row.querySelector('.mollusk-row-select').value;
      const species = selectVal === '__other__' ? row.querySelector('.mollusk-row-other').value.trim() : selectVal;
      rows.push({ species });
    });
    return rows;
  }

  function populateMolluskTable(rows) {
    molluskTableRowsEl.innerHTML = '';
    (rows || []).filter((r) => r && r.species).forEach((r) => addMolluskRow(r));
    updateMolluskTableVisibility();
  }

  // Fauna step, part 2: observed threats — multiple threats can genuinely
  // coexist (cutting AND garbage at the same site), but none of them can
  // coexist with "None observed", so picking one clears the other side.
  const threatCheckboxGridEl = document.getElementById('threatCheckboxGrid');
  const threatOtherFieldEl = document.getElementById('threatOtherField');
  const threatOtherInputEl = document.getElementById('fs-observed-threats-other');
  const threatCheckboxes = threatCheckboxGridEl
    ? Array.from(threatCheckboxGridEl.querySelectorAll('.threat-checkbox-input'))
    : [];

  function updateThreatOtherVisibility() {
    const otherBox = threatCheckboxes.find((b) => b.value === '__other__');
    const show = !!(otherBox && otherBox.checked);
    if (threatOtherFieldEl) threatOtherFieldEl.hidden = !show;
    if (!show && threatOtherInputEl) threatOtherInputEl.value = '';
  }

  threatCheckboxes.forEach((box) => {
    box.addEventListener('change', () => {
      if (box.checked && box.value === 'none_observed') {
        threatCheckboxes.forEach((b) => { if (b !== box) b.checked = false; });
      } else if (box.checked && box.value !== 'none_observed') {
        const noneBox = threatCheckboxes.find((b) => b.value === 'none_observed');
        if (noneBox) noneBox.checked = false;
      }
      updateThreatOtherVisibility();
    });
  });

  function collectSelectedThreats() {
    return threatCheckboxes.filter((b) => b.checked).map((b) => b.value);
  }

  function resetThreatCheckboxes() {
    threatCheckboxes.forEach((b) => { b.checked = false; });
    updateThreatOtherVisibility();
  }

  function populateThreatCheckboxes(values) {
    const set = new Set(values || []);
    threatCheckboxes.forEach((b) => { b.checked = set.has(b.value); });
    updateThreatOtherVisibility();
  }

  function resetSpeciesFields() {
    resetSpeciesTable();
    resetMolluskTable();
    resetThreatCheckboxes();
    resetPhotos();
    resetWaterQualityFields();
  }

  // The Vegetation step's species table — one row per species actually found
  // in the plot, each with its own Trees/Saplings/Seedlings counts, instead
  // of the old single fixed "main species" + "seedling species" + "sapling
  // species" fields. A species already used in one row is removed from every
  // other row's dropdown, since the same species can't be logged twice.
  const speciesTableRowsEl = document.getElementById('speciesTableRows');
  const btnAddSpecies = document.getElementById('btnAddSpecies');
  let speciesRowSeq = 0;

  function buildSpeciesRowOptionsHtml(selectedValue) {
    const used = new Set(
      Array.from(speciesTableRowsEl.querySelectorAll('.species-row-select'))
        .map((sel) => sel.value)
        .filter((v) => v && v !== selectedValue)
    );
    let html = '<option value="">Select…</option>';
    MANGROVE_SPECIES_LIST.forEach((sp) => {
      if (used.has(sp)) return;
      const escaped = sp.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;');
      html += `<option value="${escaped}"${sp === selectedValue ? ' selected' : ''}>${escaped}</option>`;
    });
    // "Other" stays available on every row — several rows can each be a
    // different unlisted species, unlike a real listed one that's used up.
    html += `<option value="__other__"${selectedValue === '__other__' ? ' selected' : ''}>Other (specify)</option>`;
    return html;
  }

  function refreshSpeciesRowOptions() {
    speciesTableRowsEl.querySelectorAll('.species-row-select').forEach((sel) => {
      const current = sel.value;
      sel.innerHTML = buildSpeciesRowOptionsHtml(current);
    });
    updateAddSpeciesButtonState();
    updateRemoveSpeciesButtonsVisibility();
  }

  function updateAddSpeciesButtonState() {
    // "Other" makes the list effectively unlimited, so there's always room
    // for one more row.
    if (btnAddSpecies) btnAddSpecies.disabled = false;
  }

  // The remove (trash) button only makes sense once there's more than one
  // row — a lone row should stay in place so the table is never fully empty
  // mid-edit, even though a genuinely empty table is allowed once the ranger
  // hasn't added anything yet at all.
  function updateRemoveSpeciesButtonsVisibility() {
    const rows = speciesTableRowsEl.querySelectorAll('.species-row');
    rows.forEach((row) => {
      const btn = row.querySelector('.species-row-remove');
      if (btn) btn.hidden = rows.length <= 1;
    });
  }

  function updateSpeciesOtherVisibility(row) {
    const select = row.querySelector('.species-row-select');
    const otherInput = row.querySelector('.species-row-other');
    const show = select.value === '__other__';
    otherInput.hidden = !show;
    if (show) otherInput.focus();
    else otherInput.value = '';
  }

  function createSpeciesRowEl(prefill) {
    const rowId = ++speciesRowSeq;
    const row = document.createElement('div');
    row.className = 'species-row';
    row.dataset.rowId = String(rowId);
    row.innerHTML = `
      <div class="species-row-species-cell">
        <select class="species-row-select" aria-label="Species"></select>
        <input type="text" class="species-row-other" placeholder="Enter species name" hidden />
      </div>
      <input type="number" class="species-row-count" data-field="tree" step="1" min="0" placeholder="0" aria-label="Trees" />
      <input type="number" class="species-row-count" data-field="sapling" step="1" min="0" placeholder="0" aria-label="Saplings" />
      <input type="number" class="species-row-count" data-field="seedling" step="1" min="0" placeholder="0" aria-label="Seedlings" />
      <button type="button" class="species-row-remove" aria-label="Remove species row" title="Remove">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>
      </button>
    `;
    const select = row.querySelector('.species-row-select');
    const isKnown = prefill && prefill.species && MANGROVE_SPECIES_LIST.includes(prefill.species);
    const isCustom = prefill && prefill.species && !isKnown;
    select.innerHTML = buildSpeciesRowOptionsHtml(isCustom ? '__other__' : (prefill ? prefill.species : ''));
    select.addEventListener('change', () => {
      refreshSpeciesRowOptions();
      updateSpeciesOtherVisibility(row);
    });
    row.querySelector('.species-row-remove').addEventListener('click', () => removeSpeciesRow(row));
    if (isCustom) {
      const otherInput = row.querySelector('.species-row-other');
      otherInput.hidden = false;
      otherInput.value = prefill.species;
    }

    if (prefill) {
      const setCount = (field, value) => {
        const el = row.querySelector(`.species-row-count[data-field="${field}"]`);
        if (el && value !== null && value !== undefined && value !== '') el.value = value;
      };
      setCount('tree', prefill.treeCount);
      setCount('sapling', prefill.saplingCount);
      setCount('seedling', prefill.seedlingCount);
    }
    return row;
  }

  function addSpeciesRow(prefill) {
    const row = createSpeciesRowEl(prefill);
    speciesTableRowsEl.appendChild(row);
    updateAddSpeciesButtonState();
    updateRemoveSpeciesButtonsVisibility();
    return row;
  }

  function removeSpeciesRow(row) {
    if (speciesTableRowsEl.querySelectorAll('.species-row').length <= 1) return;
    row.remove();
    refreshSpeciesRowOptions();
  }

  function resetSpeciesTable() {
    speciesTableRowsEl.innerHTML = '';
    addSpeciesRow();
  }

  if (btnAddSpecies) btnAddSpecies.addEventListener('click', () => addSpeciesRow());
  if (speciesTableRowsEl) resetSpeciesTable();

  // One row per species that actually has a species chosen; rows left on
  // "Select…" are ignored rather than treated as an error, so an unused
  // blank row (e.g. after removing others) doesn't block submission.
  function collectSpeciesTableRows() {
    const rows = [];
    speciesTableRowsEl.querySelectorAll('.species-row').forEach((row) => {
      const selectVal = row.querySelector('.species-row-select').value;
      const species = selectVal === '__other__' ? row.querySelector('.species-row-other').value.trim() : selectVal;
      if (!species) return;
      const getCount = (field) => row.querySelector(`.species-row-count[data-field="${field}"]`).value;
      rows.push({
        species,
        treeCount: getCount('tree'),
        saplingCount: getCount('sapling'),
        seedlingCount: getCount('seedling'),
      });
    });
    return rows;
  }

  function populateSpeciesTable(rows) {
    speciesTableRowsEl.innerHTML = '';
    const real = (rows || []).filter((r) => r && r.species);
    if (real.length === 0) {
      addSpeciesRow();
      return;
    }
    real.forEach((r) => addSpeciesRow(r));
  }

  function setFieldValue(id, value) {
    const el = document.getElementById(id);
    if (el) el.value = value === null || value === undefined ? '' : value;
  }

  // Water Quality, part 2: aquafarm — the follow-up questions (location,
  // distance, discharge direction) only make sense once an aquafarm is
  // actually confirmed nearby, so they stay hidden and get cleared the
  // moment the answer changes back to No.
  const aquafarmSelect = document.getElementById('fs-aquafarm-activity');
  const aquafarmBoxEl = document.getElementById('aquafarmBox');
  const btnAquafarmLocation = document.getElementById('btnAquafarmLocation');
  const aquafarmLocationOutEl = document.getElementById('aquafarmLocationOut');
  let aquafarmLocation = null;

  function resetAquafarmLocation() {
    aquafarmLocation = null;
    if (aquafarmLocationOutEl) aquafarmLocationOutEl.textContent = '';
  }

  aquafarmSelect.addEventListener('change', () => {
    const isYes = aquafarmSelect.value === 'yes';
    aquafarmBoxEl.hidden = !isYes;
    if (!isYes) {
      resetAquafarmLocation();
      setFieldValue('fs-aquafarm-name', '');
      setFieldValue('fs-aquafarm-distance', '');
      setFieldValue('fs-discharge-toward-mangroves', '');
    }
  });

  if (btnAquafarmLocation) {
    btnAquafarmLocation.addEventListener('click', () => {
      if (!navigator.geolocation) {
        aquafarmLocationOutEl.textContent = 'Location is not supported on this device.';
        return;
      }
      aquafarmLocationOutEl.textContent = 'Getting location…';
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          aquafarmLocation = { lat: pos.coords.latitude, lng: pos.coords.longitude };
          aquafarmLocationOutEl.textContent = `${aquafarmLocation.lat.toFixed(5)}, ${aquafarmLocation.lng.toFixed(5)}`;
        },
        () => {
          aquafarmLocationOutEl.textContent = 'Could not get your location — check location permission.';
        },
        { enableHighAccuracy: true, timeout: 15000, maximumAge: 60000 }
      );
    });
  }

  // Water Quality, part 3: instrument readings — collapsed by default since
  // most rangers won't have the instruments on hand; opening it never clears
  // whatever was already typed in, only hides it again.
  const btnToggleInstruments = document.getElementById('btnToggleInstruments');
  const btnToggleInstrumentsLabel = document.getElementById('btnToggleInstrumentsLabel');
  const instrumentReadingsPanel = document.getElementById('instrumentReadingsPanel');
  const instrumentReadingsHelp = document.getElementById('instrumentReadingsHelp');
  if (btnToggleInstruments) {
    btnToggleInstruments.addEventListener('click', () => {
      const opening = !instrumentReadingsPanel.classList.contains('active');
      instrumentReadingsPanel.classList.toggle('active', opening);
      if (instrumentReadingsHelp) instrumentReadingsHelp.hidden = !opening;
      btnToggleInstrumentsLabel.textContent = opening ? 'Hide instrument readings' : 'Add instrument readings (optional)';
    });
  }

  function resetWaterQualityFields() {
    aquafarmBoxEl.hidden = true;
    resetAquafarmLocation();
    if (instrumentReadingsPanel) instrumentReadingsPanel.classList.remove('active');
    if (instrumentReadingsHelp) instrumentReadingsHelp.hidden = true;
    if (btnToggleInstrumentsLabel) btnToggleInstrumentsLabel.textContent = 'Add instrument readings (optional)';
  }

  const todayInput = document.getElementById('fs-inspection-date');
  const todayStr = localDateStr();
  if (todayInput) {
    todayInput.max = todayStr;
    if (!todayInput.value) todayInput.value = todayStr;
  }

  // Step wizard — one section visible at a time, so the form doesn't turn
  // into one long scroll on a phone screen out in the field.
  const stepItems = Array.from(document.querySelectorAll('#surveyStepper .survey-step-item'));
  const stepPanels = Array.from(document.querySelectorAll('#fieldSurveyForm .survey-step'));
  const stepCurrentLabel = document.getElementById('surveyStepCurrentLabel');
  const btnNext = document.getElementById('btnSurveyNext');
  const btnBack = document.getElementById('btnSurveyBack');
  const btnCancel = document.getElementById('btnSurveyCancel');
  const STEP_NAMES = ['Site Information', 'Vegetation', 'Fauna', 'Water Quality', 'Review'];
  const TOTAL_STEPS = stepPanels.length;
  let currentStep = 1;
  let maxReachedStep = 1;

  // Editing an existing submission reuses this same wizard, but Site
  // Information (date + GPS) isn't open to editing there either — it opens
  // straight on Vegetation instead, and nothing lets it step back past it.
  let editSubmissionId = null;
  let editModeMinStep = 1;

  function escapeHtml(str) {
    return String(str).replace(/[&<>"']/g, (ch) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[ch]));
  }

  function fieldVal(id) {
    const el = document.getElementById(id);
    return el ? el.value : '';
  }

  function selectText(id) {
    const el = document.getElementById(id);
    if (!el || el.selectedIndex < 0) return '';
    const opt = el.options[el.selectedIndex];
    return opt && opt.value ? opt.text : '';
  }

  // Observed Threats are checked off from a fixed set of plain slugs — the
  // Review step needs its own lookup back to a readable label list.
  const OBSERVED_THREAT_LABELS = {
    none_observed: 'None observed',
    charcoal_making: 'Charcoal making',
    cutting: 'Cutting',
    dieback: 'Dieback',
    pests: 'Pests',
    garbage: 'Garbage',
    erosion: 'Erosion',
    land_conversion: 'Land conversion',
    encroachment: 'Encroachment',
    illegal_fishing: 'Illegal fishing',
    sand_gravel_extraction: 'Sand / gravel extraction',
    siltation: 'Siltation',
    storm_damage: 'Storm damage',
    fire: 'Fire',
    'pollution___oil_spill': 'Pollution / oil spill',
  };
  function observedThreatsDisplay(values) {
    if (!values || values.length === 0) return null;
    return values.map((v) => {
      if (v === '__other__') return fieldVal('fs-observed-threats-other') || 'Other';
      return OBSERVED_THREAT_LABELS[v] || v;
    }).join(', ');
  }

  // Matches the labeled-card layout used by the "Field submission details"
  // popup in ranger.js, so a submitted survey looks the same reviewed here
  // as it does looked up afterward in Submission History.
  function reviewField(label, value, opts = {}) {
    const isEmpty = value === null || value === undefined || value === '';
    const display = isEmpty ? '—' : escapeHtml(String(value));
    const cls = `view-field${opts.full ? ' view-field-full' : ''}`;
    return `<div class="${cls}"><span class="view-label">${escapeHtml(label)}</span><span class="view-value${isEmpty ? ' muted' : ''}">${display}</span></div>`;
  }

  // Same shape as reviewField, but for a value that's already-built HTML
  // (a colored status badge) instead of plain text that needs escaping.
  function reviewFieldHtml(label, html, opts = {}) {
    const cls = `view-field${opts.full ? ' view-field-full' : ''}`;
    return `<div class="${cls}"><span class="view-label">${escapeHtml(label)}</span><span class="view-value">${html}</span></div>`;
  }

  function viewEmptyNote(text) {
    return `<p class="view-empty-note">${escapeHtml(text)}</p>`;
  }

  // Short color-coded pill instead of the option's own long descriptive
  // text ("Good — mostly green leaves...") — quicker to scan at a glance,
  // same colors the History table already uses for this same status.
  const HEALTH_BADGE = {
    healthy: { label: 'Good', cls: 'badge-healthy' },
    moderate: { label: 'Fair', cls: 'badge-moderate' },
    degraded: { label: 'Poor', cls: 'badge-degraded' },
  };
  function healthBadgeHtml(rawValue) {
    const info = HEALTH_BADGE[rawValue];
    if (!info) return null;
    return `<span class="view-badge ${info.cls}">${escapeHtml(info.label)}</span>`;
  }

  // .view-grid is a 3-column grid — a row left with only 1 or 2 real fields
  // in it (e.g. right before a full-width field, or at the end of the list)
  // has no element in its last column(s), so nothing paints a border or
  // background there and the grid's box looks cut off. Blank filler cells
  // close out that row so every row looks like a complete, evenly bordered
  // row regardless of how many real fields are in it.
  function reviewGridPad(fieldCount) {
    const remainder = fieldCount % 3;
    if (remainder === 0) return '';
    return '<div class="view-field view-field-blank"></div>'.repeat(3 - remainder);
  }

  // Same icon glyphs as this step's own header in the wizard above, so the
  // review summary reads as the same 4 sections, not a differently-designed
  // recap of them.
  const REVIEW_SECTION_ICONS = {
    site: '<path d="M12 22s8-9 8-14a8 8 0 1 0-16 0c0 5 8 14 8 14Z"/><circle cx="12" cy="8" r="3"/>',
    vegetation: '<path d="M12 22V12"/><path d="M12 12C12 6.5 8 4 4 4c0 5 2.5 8 8 8Z"/><path d="M12 12c0-4.5 3-7 8-7 0 4.5-2 7-8 7Z"/>',
    fauna: '<circle cx="12" cy="12" r="4"/><path d="M12 8V4"/><path d="M12 20v-4"/><path d="M4.93 4.93l2.83 2.83"/><path d="M16.24 16.24l2.83 2.83"/><path d="M2 12h4"/><path d="M18 12h4"/><path d="M4.93 19.07l2.83-2.83"/><path d="M16.24 7.76l2.83-2.83"/>',
    water: '<path d="M12 2.69s6 7.34 6 11.31a6 6 0 1 1-12 0c0-3.97 6-11.31 6-11.31z"/>',
  };

  function reviewSection(icon, title, innerHtml) {
    const iconSvg = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${REVIEW_SECTION_ICONS[icon] || ''}</svg>`;
    return `<div class="view-section"><div class="view-section-title"><span class="view-section-icon">${iconSvg}</span>${escapeHtml(title)}</div><div class="view-section-body">${innerHtml}</div></div>`;
  }

  function buildReviewHtml() {
    const siteFields = [
      reviewField('Inspection date', fieldVal('fs-inspection-date')),
      reviewField('GPS location', currentPosition ? `${currentPosition.lat.toFixed(5)}, ${currentPosition.lng.toFixed(5)}` : null),
    ];
    const siteHtml = `<div class="view-grid">${siteFields.join('')}${reviewGridPad(siteFields.length)}</div>`;

    // Mirrors the Vegetation step's own 3 numbered groups (Canopy / Species
    // Found in Plot / Overall Health), same reasoning as the Water Quality
    // section below.
    const canopyHtml = `<p class="view-subsection-label">Canopy</p><div class="view-grid">${reviewField('Canopy cover (%)', fieldVal('fs-canopy-cover'))}${reviewGridPad(1)}</div>`;

    const speciesRowsForReview = collectSpeciesTableRows();
    const speciesTableReviewHtml = speciesRowsForReview.length
      ? `<div class="view-table-wrap"><table class="view-species-table">
          <thead><tr><th>Species</th><th>Trees</th><th>Saplings</th><th>Seedlings</th></tr></thead>
          <tbody>${speciesRowsForReview.map((r) => `<tr><td>${escapeHtml(r.species)}</td><td>${escapeHtml(r.treeCount || '—')}</td><td>${escapeHtml(r.saplingCount || '—')}</td><td>${escapeHtml(r.seedlingCount || '—')}</td></tr>`).join('')}</tbody>
        </table></div>`
      : viewEmptyNote('No species recorded.');
    const speciesSectionHtml = `<p class="view-subsection-label">Species Found in Plot</p>${speciesTableReviewHtml}`;

    const healthRaw = fieldVal('fs-health-assessment');
    const healthBadge = healthBadgeHtml(healthRaw);
    const healthFieldHtml = healthBadge
      ? reviewFieldHtml('Overall health assessment', healthBadge)
      : reviewField('Overall health assessment', null);
    const healthHtml = `<p class="view-subsection-label">Overall Health</p><div class="view-grid">${healthFieldHtml}${reviewGridPad(1)}</div>`;

    const vegetationHtml = `${canopyHtml}${speciesSectionHtml}${healthHtml}`;

    const allPhotos = existingPhotoUrls.map((url) => ({ src: url })).concat(
      selectedPhotoFiles.map((file) => ({ src: URL.createObjectURL(file) }))
    );
    const photoHtml = allPhotos.length
      ? `<div class="view-photos">${allPhotos.map((p) => `<img class="edit-photo-preview survey-review-photo" src="${p.src}" alt="Photo" />`).join('')}</div>`
      : viewEmptyNote('No photos attached.');

    // Mirrors the Fauna step's own 4 numbered groups (Mollusks Found /
    // Observed Threats / Additional Notes / Photos).
    const molluskRowsForReview = collectMolluskTableRows().filter((r) => r.species);
    const molluskTableReviewHtml = molluskRowsForReview.length
      ? `<div class="view-table-wrap"><table class="view-species-table">
          <thead><tr><th>Species</th></tr></thead>
          <tbody>${molluskRowsForReview.map((r) => `<tr><td>${escapeHtml(r.species)}</td></tr>`).join('')}</tbody>
        </table></div>`
      : viewEmptyNote('No mollusks recorded.');
    const molluskSectionHtml = `<p class="view-subsection-label">Mollusks Found</p>${molluskTableReviewHtml}`;

    const threatsHtml = `<p class="view-subsection-label">Observed Threats</p><div class="view-grid">${reviewField('Observed threats', observedThreatsDisplay(collectSelectedThreats()), { full: true })}</div>`;

    const notesRaw = fieldVal('fs-additional-notes');
    const notesHtml = `<p class="view-subsection-label">Additional Notes</p>${notesRaw ? `<div class="view-notes">${escapeHtml(notesRaw)}</div>` : viewEmptyNote('No additional notes.')}`;

    const photosHtml = `<p class="view-subsection-label">Photos</p>${photoHtml}`;

    const faunaHtml = `${molluskSectionHtml}${threatsHtml}${notesHtml}${photosHtml}`;

    // Mirrors the Water Quality step's own 4 numbered groups (Observations /
    // Aquafarm / Instrument Readings / Notes) instead of one long flat grid,
    // so the review reads as the same 4 groups the ranger just filled in.
    const observationsFields = [
      reviewField('Water clarity', selectText('fs-water-clarity')),
      reviewField('Water color', selectText('fs-water-color')),
      reviewField('Odor', selectText('fs-odor')),
      reviewField('Visible foam or discharge', selectText('fs-foam-discharge')),
    ];
    const observationsHtml = `<p class="view-subsection-label">Observations</p><div class="view-grid">${observationsFields.join('')}${reviewGridPad(observationsFields.length)}</div>`;

    const aquafarmFields = [reviewField('Nearby aquafarm activity', selectText('fs-aquafarm-activity'))];
    const isAquafarmYesReview = aquafarmSelect.value === 'yes';
    if (isAquafarmYesReview) {
      aquafarmFields.push(
        reviewField('Aquafarm name', fieldVal('fs-aquafarm-name')),
        reviewField('Aquafarm location', aquafarmLocation ? `${aquafarmLocation.lat.toFixed(5)}, ${aquafarmLocation.lng.toFixed(5)}` : null),
        reviewField('Distance to mangroves (m)', fieldVal('fs-aquafarm-distance')),
        reviewField('Discharge flowing toward mangroves?', selectText('fs-discharge-toward-mangroves'))
      );
    }
    const aquafarmHtml = `<p class="view-subsection-label">Aquafarm</p><div class="view-grid">${aquafarmFields.join('')}${reviewGridPad(aquafarmFields.length)}</div>`;

    const instrumentIds = ['fs-salinity', 'fs-ph', 'fs-water-temp', 'fs-secchi-depth'];
    const hasInstrumentValues = instrumentIds.some((id) => fieldVal(id));
    const instrumentHtml = hasInstrumentValues
      ? `<p class="view-subsection-label">Instrument Readings</p><div class="view-grid">${[
          reviewField('Salinity (ppt)', fieldVal('fs-salinity')),
          reviewField('pH', fieldVal('fs-ph')),
          reviewField('Water temperature (°C)', fieldVal('fs-water-temp')),
          reviewField('Secchi depth (cm)', fieldVal('fs-secchi-depth')),
        ].join('')}${reviewGridPad(4)}</div>`
      : '';

    const waterNotesRaw = fieldVal('fs-water-notes');
    const waterNotesHtml = `<p class="view-subsection-label">Notes</p>${waterNotesRaw ? `<div class="view-notes">${escapeHtml(waterNotesRaw)}</div>` : viewEmptyNote('No water quality notes.')}`;

    const waterHtml = `${observationsHtml}${aquafarmHtml}${instrumentHtml}${waterNotesHtml}`;

    const reviewBody = document.getElementById('surveyReviewBody');
    if (reviewBody) {
      reviewBody.innerHTML = `
        <p class="survey-note">Please check your answers below. You can go back to fix anything before submitting.</p>
        ${reviewSection('site', 'Site Information', siteHtml)}
        ${reviewSection('vegetation', 'Vegetation', vegetationHtml)}
        ${reviewSection('fauna', 'Fauna', faunaHtml)}
        ${reviewSection('water', 'Water Quality', waterHtml)}
      `;
    }
  }

  function showStep(step) {
    currentStep = Math.max(step, editModeMinStep);

    if (currentStep > maxReachedStep) maxReachedStep = currentStep;

    stepPanels.forEach((panel) => {
      panel.hidden = Number(panel.getAttribute('data-step')) !== currentStep;
    });
    stepItems.forEach((item) => {
      const itemStep = Number(item.getAttribute('data-step-item'));
      item.classList.toggle('active', itemStep === currentStep);
      item.classList.toggle('done', itemStep < currentStep);
    });
    if (stepCurrentLabel) stepCurrentLabel.textContent = `Step ${currentStep} of ${TOTAL_STEPS} — ${STEP_NAMES[currentStep - 1]}`;
    if (btnBack) btnBack.hidden = currentStep === editModeMinStep;
    if (btnNext) btnNext.hidden = currentStep === TOTAL_STEPS;
    if (submitBtn) submitBtn.hidden = currentStep !== TOTAL_STEPS;
    msgEl.className = 'field-survey-msg';
    msgEl.textContent = '';

    if (currentStep === TOTAL_STEPS) buildReviewHtml();
    if (currentStep === 1 && gpsMap) setTimeout(() => gpsMap.invalidateSize(), 50);

    const panelEl = form.closest('.form-panel');
    if (panelEl) panelEl.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  function validateStep(step) {
    if (step === 1) {
      if (!fieldVal('fs-inspection-date')) {
        msgEl.className = 'field-survey-msg error';
        msgEl.textContent = 'Please choose the inspection date before continuing.';
        return false;
      }
      if (fieldVal('fs-inspection-date') > todayStr) {
        msgEl.className = 'field-survey-msg error';
        msgEl.textContent = 'Inspection date cannot be in the future.';
        return false;
      }
      if (!currentPosition) {
        msgEl.className = 'field-survey-msg error';
        msgEl.textContent = 'Waiting for your GPS location — allow location access, or tap Retry, before continuing.';
        return false;
      }
    }
    if (step === 2) {
      if (!fieldVal('fs-canopy-cover')) {
        msgEl.className = 'field-survey-msg error';
        msgEl.textContent = 'Please enter canopy cover.';
        return false;
      }
      if (!fieldVal('fs-health-assessment')) {
        msgEl.className = 'field-survey-msg error';
        msgEl.textContent = 'Please select an overall health assessment before continuing.';
        return false;
      }
      const speciesRows = collectSpeciesTableRows();
      if (speciesRows.length === 0) {
        msgEl.className = 'field-survey-msg error';
        msgEl.textContent = 'Please select a species.';
        return false;
      }
      const rowMissingCount = speciesRows.some((r) => {
        const t = parseFloat(r.treeCount) || 0;
        const s = parseFloat(r.saplingCount) || 0;
        const e = parseFloat(r.seedlingCount) || 0;
        return t <= 0 && s <= 0 && e <= 0;
      });
      if (rowMissingCount) {
        msgEl.className = 'field-survey-msg error';
        msgEl.textContent = 'Enter at least one count for this species.';
        return false;
      }
    }
    if (step === 3) {
      const molluskRows = collectMolluskTableRows();
      const molluskMissingSpecies = molluskRows.some((r) => !r.species);
      if (molluskMissingSpecies) {
        msgEl.className = 'field-survey-msg error';
        msgEl.textContent = 'Please select a species.';
        return false;
      }
      // "None observed" counts as a real answer too — without requiring
      // something here, there'd be no way to tell "the ranger checked and
      // saw no threats" apart from "the ranger skipped this step".
      const selectedThreats = collectSelectedThreats();
      if (selectedThreats.length === 0) {
        msgEl.className = 'field-survey-msg error';
        msgEl.textContent = 'Select the threats you saw, or None observed.';
        return false;
      }
      if (selectedThreats.includes('__other__') && !fieldVal('fs-observed-threats-other')) {
        msgEl.className = 'field-survey-msg error';
        msgEl.textContent = 'Describe the other threat.';
        return false;
      }

      // Every visit needs photo proof it actually happened, not just the ones
      // where a threat turns up — the same way a real inspection report is
      // never accepted on the inspector's word alone, threat or no threat.
      const photoAttached = selectedPhotoFiles.length > 0 || existingPhotoUrls.length > 0;
      if (!photoAttached) {
        msgEl.className = 'field-survey-msg error';
        msgEl.textContent = 'Please attach at least one photo before continuing.';
        return false;
      }
    }
    if (step === 4) {
      if (!fieldVal('fs-water-clarity')) {
        msgEl.className = 'field-survey-msg error';
        msgEl.textContent = 'Please select water clarity.';
        return false;
      }
      if (!fieldVal('fs-water-color')) {
        msgEl.className = 'field-survey-msg error';
        msgEl.textContent = 'Please select water color.';
        return false;
      }
      if (!fieldVal('fs-odor')) {
        msgEl.className = 'field-survey-msg error';
        msgEl.textContent = 'Please select odor.';
        return false;
      }
      if (!fieldVal('fs-foam-discharge')) {
        msgEl.className = 'field-survey-msg error';
        msgEl.textContent = 'Please select visible foam or discharge.';
        return false;
      }
      if (!fieldVal('fs-aquafarm-activity')) {
        msgEl.className = 'field-survey-msg error';
        msgEl.textContent = 'Please select nearby aquafarm activity.';
        return false;
      }
      if (aquafarmSelect.value === 'yes') {
        if (!fieldVal('fs-aquafarm-name')) {
          msgEl.className = 'field-survey-msg error';
          msgEl.textContent = 'Please enter the aquafarm name.';
          return false;
        }
        if (!aquafarmLocation) {
          msgEl.className = 'field-survey-msg error';
          msgEl.textContent = 'Please mark the aquafarm location.';
          return false;
        }
        if (!fieldVal('fs-discharge-toward-mangroves')) {
          msgEl.className = 'field-survey-msg error';
          msgEl.textContent = 'Please select an option.';
          return false;
        }
      }
    }
    return true;
  }

  if (btnNext) {
    btnNext.addEventListener('click', () => {
      if (!validateStep(currentStep)) return;
      if (currentStep < TOTAL_STEPS) showStep(currentStep + 1);
    });
  }
  if (btnBack) {
    btnBack.addEventListener('click', () => {
      if (currentStep > editModeMinStep) showStep(currentStep - 1);
    });
  }
  const discardOverlay = document.getElementById('discardSurveyOverlay');
  const btnKeepEditing = document.getElementById('btnKeepEditingSurvey');
  const btnCloseDiscard = document.getElementById('btnCloseDiscardSurvey');
  const btnConfirmDiscard = document.getElementById('btnConfirmDiscardSurvey');

  function closeDiscardConfirm() {
    if (discardOverlay) discardOverlay.classList.remove('open');
  }

  function discardSurveyAndLeave() {
    const wasEditing = !!editSubmissionId;
    resetFieldSurveyEditMode();
    resetWizard();
    closeDiscardConfirm();
    const targetView = wasEditing ? 'history' : 'dashboard';
    if (typeof window.switchView === 'function') {
      window.switchView(targetView, document.querySelector(`[data-view=${targetView}]`));
    }
  }

  // Canceling an in-progress NEW submission really does throw away
  // everything typed so far, so "Discard" is accurate there — but canceling
  // an EDIT only drops the unsaved changes; the original submission the
  // ranger opened stays exactly as it was, on the server, untouched. Reusing
  // the same "Discard This Survey?" wording for both made rangers think
  // editing and cancelling would delete their already-submitted survey.
  function openDiscardConfirm() {
    const titleEl = document.getElementById('discardSurveyTitle');
    const textEl = document.getElementById('discardSurveyText');
    const isEditing = !!editSubmissionId;

    if (titleEl) titleEl.textContent = isEditing ? 'Discard changes to this survey?' : 'Discard This Survey?';
    if (textEl) {
      textEl.textContent = isEditing
        ? 'Your edits won\'t be saved, but the original submission stays exactly as it was. Nothing gets deleted.'
        : 'The information you\'ve entered will be permanently deleted and cannot be recovered.';
    }
    if (btnConfirmDiscard) btnConfirmDiscard.textContent = isEditing ? 'Discard Changes' : 'Discard';

    if (discardOverlay) discardOverlay.classList.add('open');
  }

  if (btnCancel && discardOverlay) {
    btnCancel.addEventListener('click', openDiscardConfirm);
    if (btnKeepEditing) btnKeepEditing.addEventListener('click', closeDiscardConfirm);
    if (btnCloseDiscard) btnCloseDiscard.addEventListener('click', closeDiscardConfirm);
    if (btnConfirmDiscard) btnConfirmDiscard.addEventListener('click', discardSurveyAndLeave);
    discardOverlay.addEventListener('click', (e) => {
      if (e.target === discardOverlay) closeDiscardConfirm();
    });
  }
  stepItems.forEach((item) => {
    item.addEventListener('click', () => {
      const target = Number(item.getAttribute('data-step-item'));
      if (target >= editModeMinStep && target <= maxReachedStep) showStep(target);
    });
  });

  function resetWizard() {
    maxReachedStep = editModeMinStep;
    showStep(editModeMinStep);
  }

  // Populates the wizard with an existing submission's answers and opens it
  // on Vegetation, skipping Site Information — date and GPS aren't editable
  // here, matching what the old edit popup allowed.
  function startFieldSurveyEdit(submission) {
    editSubmissionId = submission.koboId;
    editModeMinStep = 2;

    if (submission.date) todayInput.value = localDateStr(submission.date);
    const gpsRaw = submission.raw && (submission.raw['Record_your_current_location'] || submission.raw['GPS_location']);
    if (gpsRaw) {
      const parts = String(gpsRaw).trim().split(/\s+/);
      if (parts.length >= 2) currentPosition = { lat: parseFloat(parts[0]), lng: parseFloat(parts[1]) };
    }

    const trees = (submission.trees && submission.trees.length) ? submission.trees : [{}];
    // Canopy cover and mollusk data are flat fields on the outer record, not
    // inside the per-species Vegetation table — read straight from the raw
    // saved record instead of off the first species row, which no longer
    // carries them now that species are real repeat-group entries.
    const rawRecord = submission.raw || {};
    setFieldValue('fs-canopy-cover', rawRecord['Estimated_Canopy_Cover_']);
    populateSpeciesTable(trees.map((t) => ({
      species: t.species !== '—' ? t.species : '',
      treeCount: t.treeCount,
      saplingCount: t.saplingCount,
      seedlingCount: t.seedlingCount,
    })));
    setFieldValue('fs-health-assessment', submission.healthAssessmentRaw);

    // A real Mollusk_Records array (new-format submissions) takes priority;
    // a legacy record only ever had one flat species/count pair.
    const molluskRecordsRaw = Array.isArray(rawRecord['Mollusk_Records']) ? rawRecord['Mollusk_Records'] : null;
    if (molluskRecordsRaw) {
      populateMolluskTable(molluskRecordsRaw.map((m) => ({
        species: m['Mollusk_Species_Name'] || '',
      })));
    } else {
      const molluskSpeciesRaw = rawRecord['Mollusk_Species_Name'] || '';
      populateMolluskTable(molluskSpeciesRaw ? [{ species: molluskSpeciesRaw }] : []);
    }
    const threatsRaw = submission.observedThreats || '';
    populateThreatCheckboxes(String(threatsRaw).split(',').map((s) => s.trim()).filter(Boolean));
    setFieldValue('fs-observed-threats-other', rawRecord['Observed_Threats_Other']);
    setFieldValue('fs-additional-notes', submission.additionalNotes);
    existingPhotoUrls = (submission.photos || []).map((p) => p.full || p.thumb).filter(Boolean);
    selectedPhotoFiles = [];
    renderPhotoThumbs();

    setFieldValue('fs-water-clarity', rawRecord['Water_Clarity']);
    setFieldValue('fs-water-color', submission.waterColor);
    setFieldValue('fs-odor', submission.odor);
    setFieldValue('fs-foam-discharge', submission.foamOrDischarge);

    const aquafarmVal = submission.aquafarmRaw || '';
    setFieldValue('fs-aquafarm-activity', aquafarmVal);
    const isAquafarmYes = aquafarmVal === 'yes';
    aquafarmBoxEl.hidden = !isAquafarmYes;
    if (isAquafarmYes) {
      setFieldValue('fs-aquafarm-name', rawRecord['Aquafarm_Name']);
      const lat = rawRecord['Aquafarm_Location_Lat'];
      const lng = rawRecord['Aquafarm_Location_Lng'];
      if (lat && lng) {
        aquafarmLocation = { lat: parseFloat(lat), lng: parseFloat(lng) };
        aquafarmLocationOutEl.textContent = `${aquafarmLocation.lat.toFixed(5)}, ${aquafarmLocation.lng.toFixed(5)}`;
      } else {
        resetAquafarmLocation();
      }
      setFieldValue('fs-aquafarm-distance', rawRecord['Aquafarm_Distance_m']);
      setFieldValue('fs-discharge-toward-mangroves', rawRecord['Discharge_Toward_Mangroves']);
    } else {
      resetAquafarmLocation();
    }

    setFieldValue('fs-salinity', rawRecord['Salinity_ppt']);
    setFieldValue('fs-ph', rawRecord['PH']);
    setFieldValue('fs-water-temp', rawRecord['Water_Temperature_C']);
    setFieldValue('fs-secchi-depth', rawRecord['Secchi_Depth_cm']);
    const hasInstrumentReadings = ['Salinity_ppt', 'PH', 'Water_Temperature_C', 'Secchi_Depth_cm']
      .some((k) => rawRecord[k] !== undefined && rawRecord[k] !== null && rawRecord[k] !== '');
    if (hasInstrumentReadings && instrumentReadingsPanel) {
      instrumentReadingsPanel.classList.add('active');
      if (instrumentReadingsHelp) instrumentReadingsHelp.hidden = false;
      if (btnToggleInstrumentsLabel) btnToggleInstrumentsLabel.textContent = 'Hide instrument readings';
    }

    setFieldValue('fs-water-notes', submission.waterNotes);

    if (submitBtn) submitBtn.textContent = 'Save changes';
    maxReachedStep = editModeMinStep;
    showStep(editModeMinStep);
  }
  window.startFieldSurveyEdit = startFieldSurveyEdit;

  // Called on every plain visit to this tab (see ranger.js's switchView) so
  // a fresh "Submit Field Data" click always starts a new submission, even
  // right after leaving an edit in progress without saving it. Without this,
  // the wizard would still show the abandoned edit's old values — the
  // ranger stopped being "in edit mode" internally, but the visible form
  // never actually went blank, so those stale values could get submitted
  // as if they were a brand new report.
  function resetFieldSurveyEditMode() {
    if (!editSubmissionId) return;
    editSubmissionId = null;
    editModeMinStep = 1;
    if (submitBtn) submitBtn.textContent = 'Submit field report';
    form.reset();
    todayInput.value = todayStr;
    resetSpeciesFields();
    if (zonePreviewEl) zonePreviewEl.hidden = true;
    captureGps();
    resetWizard();
  }
  window.resetFieldSurveyEditMode = resetFieldSurveyEditMode;

  const SUBMIT_URL = '../Menro/API/submit-field-survey.php';
  const QUEUE_KEY = 'aquaguard_pending_surveys';

  function getQueue() {
    try {
      return JSON.parse(localStorage.getItem(QUEUE_KEY) || '[]');
    } catch (err) {
      return [];
    }
  }

  function setQueue(queue) {
    localStorage.setItem(QUEUE_KEY, JSON.stringify(queue));
  }

  function fieldsFromForm() {
    return {
      inspectionDate: document.getElementById('fs-inspection-date').value,
      canopyCover: document.getElementById('fs-canopy-cover').value,
      speciesRows: JSON.stringify(collectSpeciesTableRows()),
      healthAssessment: document.getElementById('fs-health-assessment').value,
      molluskRows: JSON.stringify(collectMolluskTableRows()),
      observedThreats: collectSelectedThreats().join(','),
      observedThreatsOther: fieldVal('fs-observed-threats-other'),
      additionalNotes: document.getElementById('fs-additional-notes').value,
      waterClarity: document.getElementById('fs-water-clarity').value,
      waterColor: document.getElementById('fs-water-color').value,
      odor: document.getElementById('fs-odor').value,
      foamDischarge: document.getElementById('fs-foam-discharge').value,
      aquafarmActivity: aquafarmSelect.value,
      aquafarmName: fieldVal('fs-aquafarm-name'),
      aquafarmLat: aquafarmLocation ? aquafarmLocation.lat : '',
      aquafarmLng: aquafarmLocation ? aquafarmLocation.lng : '',
      aquafarmDistance: fieldVal('fs-aquafarm-distance'),
      dischargeTowardMangroves: fieldVal('fs-discharge-toward-mangroves'),
      salinity: fieldVal('fs-salinity'),
      ph: fieldVal('fs-ph'),
      waterTemp: fieldVal('fs-water-temp'),
      secchiDepth: fieldVal('fs-secchi-depth'),
      waterNotes: document.getElementById('fs-water-notes').value,
      lat: currentPosition ? currentPosition.lat : '',
      lng: currentPosition ? currentPosition.lng : '',
    };
  }

  function fileToDataUrl(file) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result);
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });
  }

  function dataUrlToBlob(dataUrl) {
    const [meta, base64] = dataUrl.split(',');
    const mime = meta.match(/data:(.*);base64/)[1];
    const binary = atob(base64);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
    return new Blob([bytes], { type: mime });
  }

  function buildFormData(fields, photoFile) {
    const fd = new FormData();
    Object.entries(fields).forEach(([key, value]) => fd.append(key, value ?? ''));
    if (photoFile) fd.append('photo', photoFile, photoFile.name || 'photo.jpg');
    return fd;
  }

  async function sendToServer(fields, photoFile) {
    const res = await fetch(SUBMIT_URL, { method: 'POST', body: buildFormData(fields, photoFile), credentials: 'same-origin' });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json();
    if (!data.success) throw new Error(data.error || 'Submission failed');
    return data;
  }

  // Tries every queued offline submission again — called on page load and
  // whenever the device reconnects, so nothing needs to be resent by hand.
  async function flushQueue() {
    const queue = getQueue();
    if (queue.length === 0) return;

    const remaining = [];
    for (const item of queue) {
      try {
        const photoFile = item.photoDataUrl ? dataUrlToBlob(item.photoDataUrl) : null;
        await sendToServer(item.fields, photoFile);
      } catch (err) {
        remaining.push(item);
      }
    }
    setQueue(remaining);
    if (remaining.length < queue.length && typeof window.refreshAquaGuardSubmissions === 'function') {
      window.refreshAquaGuardSubmissions();
    }
  }

  window.addEventListener('online', flushQueue);
  flushQueue();

  async function saveFieldSurveyEdit() {
    const speciesRows = collectSpeciesTableRows();

    const body = new FormData();
    body.append('action', 'updateFields');
    body.append('id', editSubmissionId);
    body.append('aquafarm', aquafarmSelect.value);
    body.append('aquafarmName', fieldVal('fs-aquafarm-name'));
    body.append('aquafarmLat', aquafarmLocation ? aquafarmLocation.lat : '');
    body.append('aquafarmLng', aquafarmLocation ? aquafarmLocation.lng : '');
    body.append('aquafarmDistance', fieldVal('fs-aquafarm-distance'));
    body.append('dischargeTowardMangroves', fieldVal('fs-discharge-toward-mangroves'));
    body.append('waterNotes', fieldVal('fs-water-notes'));
    body.append('observedThreats', collectSelectedThreats().join(','));
    body.append('observedThreatsOther', fieldVal('fs-observed-threats-other'));
    body.append('additionalNotes', fieldVal('fs-additional-notes'));
    body.append('waterClarity', fieldVal('fs-water-clarity'));
    body.append('waterColor', fieldVal('fs-water-color'));
    body.append('odor', fieldVal('fs-odor'));
    body.append('foamDischarge', fieldVal('fs-foam-discharge'));
    body.append('salinity', fieldVal('fs-salinity'));
    body.append('ph', fieldVal('fs-ph'));
    body.append('waterTemp', fieldVal('fs-water-temp'));
    body.append('secchiDepth', fieldVal('fs-secchi-depth'));
    body.append('canopyCover', fieldVal('fs-canopy-cover'));
    body.append('healthAssessment', fieldVal('fs-health-assessment'));
    body.append('molluskRows', JSON.stringify(collectMolluskTableRows()));
    body.append('trees', JSON.stringify(speciesRows));
    // Only the first newly picked photo is sent for now — the backend still
    // stores one photo per submission; saving several is a later step.
    const photoFile = selectedPhotoFiles[0];
    if (photoFile) body.append('photo', photoFile, photoFile.name || 'photo.jpg');

    try {
      const res = await fetch('../Menro/API/ranger-submissions.php', { method: 'POST', credentials: 'same-origin', body });
      const data = await res.json();
      if (!res.ok || !data.success) throw new Error(data.error || `HTTP ${res.status}`);

      resetFieldSurveyEditMode();
      form.reset();
      todayInput.value = todayStr;
      resetSpeciesFields();
      resetWizard();
      if (typeof window.refreshAquaGuardSubmissions === 'function') await window.refreshAquaGuardSubmissions();
      if (typeof switchView === 'function') switchView('history', document.querySelector('[data-view=history]'));
    } catch (err) {
      msgEl.className = 'field-survey-msg error';
      msgEl.textContent = `Couldn't save changes: ${err.message || 'Unknown error'}`;
    } finally {
      submitBtn.disabled = false;
    }
  }

  async function performSubmit() {
    submitBtn.disabled = true;
    msgEl.className = 'field-survey-msg';
    msgEl.textContent = editSubmissionId ? 'Saving…' : 'Submitting…';

    if (editSubmissionId) {
      await saveFieldSurveyEdit();
      return;
    }

    const fields = fieldsFromForm();
    // Only the first picked photo is actually sent for now — the backend
    // still stores one photo per submission; saving several is a later step.
    const photoFile = selectedPhotoFiles[0] || null;

    const trySend = async () => {
      if (!navigator.onLine) throw new Error('offline');
      return sendToServer(fields, photoFile);
    };

    try {
      await trySend();
      form.reset();
      todayInput.value = todayStr;
      resetSpeciesFields();
      if (zonePreviewEl) zonePreviewEl.hidden = true;
      captureGps();
      resetWizard();
      msgEl.className = 'field-survey-msg ok';
      msgEl.textContent = 'Submitted successfully.';
      if (typeof window.refreshAquaGuardSubmissions === 'function') window.refreshAquaGuardSubmissions();
    } catch (err) {
      // No connection (or the request itself failed) — save it on this
      // device instead of losing the ranger's work, and send it automatically
      // once a connection comes back.
      const queue = getQueue();
      const queuedItem = { fields, photoDataUrl: null };
      if (photoFile) {
        try {
          queuedItem.photoDataUrl = await fileToDataUrl(photoFile);
        } catch (readErr) {
          // Photo couldn't be read for offline storage — keep the rest of the report anyway.
        }
      }
      queue.push(queuedItem);
      setQueue(queue);

      form.reset();
      todayInput.value = todayStr;
      resetSpeciesFields();
      if (zonePreviewEl) zonePreviewEl.hidden = true;
      captureGps();
      resetWizard();
      msgEl.className = 'field-survey-msg offline';
      msgEl.textContent = 'No connection — saved on this device. It will send automatically once you\'re back online.';
    } finally {
      submitBtn.disabled = false;
    }
  }

  const confirmSubmitOverlay = document.getElementById('confirmSubmitOverlay');
  const confirmSubmitTitle = document.getElementById('confirmSubmitTitle');
  const confirmSubmitText = document.getElementById('confirmSubmitText');
  const btnCloseConfirmSubmit = document.getElementById('btnCloseConfirmSubmit');
  const btnCancelConfirmSubmit = document.getElementById('btnCancelConfirmSubmit');
  const btnConfirmSubmit = document.getElementById('btnConfirmSubmit');

  function closeSubmitConfirm() {
    if (confirmSubmitOverlay) confirmSubmitOverlay.classList.remove('open');
  }

  form.addEventListener('submit', (e) => {
    e.preventDefault();
    if (!confirmSubmitOverlay) { performSubmit(); return; }

    if (editSubmissionId) {
      if (confirmSubmitTitle) confirmSubmitTitle.textContent = 'Save These Changes?';
      if (confirmSubmitText) confirmSubmitText.textContent = 'This will update the submission already on record.';
      if (btnConfirmSubmit) btnConfirmSubmit.textContent = 'Save Changes';
    } else {
      if (confirmSubmitTitle) confirmSubmitTitle.textContent = 'Submit This Survey?';
      if (confirmSubmitText) confirmSubmitText.textContent = "Make sure everything looks correct — you can still edit it afterward from Submission History.";
      if (btnConfirmSubmit) btnConfirmSubmit.textContent = 'Submit';
    }
    confirmSubmitOverlay.classList.add('open');
  });

  if (confirmSubmitOverlay) {
    if (btnCloseConfirmSubmit) btnCloseConfirmSubmit.addEventListener('click', closeSubmitConfirm);
    if (btnCancelConfirmSubmit) btnCancelConfirmSubmit.addEventListener('click', closeSubmitConfirm);
    if (btnConfirmSubmit) {
      btnConfirmSubmit.addEventListener('click', () => {
        closeSubmitConfirm();
        performSubmit();
      });
    }
    confirmSubmitOverlay.addEventListener('click', (e) => {
      if (e.target === confirmSubmitOverlay) closeSubmitConfirm();
    });
  }

  showStep(1);
})();
