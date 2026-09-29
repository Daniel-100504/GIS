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
  photoInputEl.addEventListener('change', () => {
    photoLabelEl.textContent = photoInputEl.files[0] ? photoInputEl.files[0].name : PHOTO_LABEL_DEFAULT;
  });

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

  // A count with nothing said about what's being counted isn't usable data
  // ("5 of what?") — so a paired count field (seedlings, saplings, mollusks)
  // stays locked until its own species dropdown actually has something
  // picked, "Other" included. It unlocks the moment *anything* is chosen,
  // even before "Other"'s own text is typed in — that text is still
  // required before moving on (see otherTextMissing), this just stops the
  // count from being touchable while the species side is still blank.
  function setCountFieldLock(countInput, locked) {
    if (!countInput) return;
    countInput.disabled = locked;
    if (locked) countInput.value = '';
  }

  // Species fields (and, the same way, Observed Threats) offer a dropdown of
  // common choices with an "Other (specify)" option that reveals a plain
  // text field for anything not on the list — the text field (not the
  // dropdown) is what actually holds the value the rest of the form reads.
  function setupSpeciesField(selectId, inputId, countInputId) {
    const select = document.getElementById(selectId);
    const input = document.getElementById(inputId);
    const countInput = countInputId ? document.getElementById(countInputId) : null;
    if (!select || !input) return;
    if (countInput) setCountFieldLock(countInput, select.value === '');
    select.addEventListener('change', () => {
      if (select.value === '__other__') {
        input.hidden = false;
        input.value = '';
        input.focus();
      } else {
        input.hidden = true;
        input.value = select.value;
      }
      if (countInput) setCountFieldLock(countInput, select.value === '');
    });
  }
  setupSpeciesField('fs-species-name-select', 'fs-species-name');
  setupSpeciesField('fs-seedling-species-select', 'fs-seedling-species', 'fs-seedling-count');
  setupSpeciesField('fs-sapling-species-select', 'fs-sapling-species', 'fs-sapling-count');
  setupSpeciesField('fs-mollusk-species-select', 'fs-mollusk-species', 'fs-mollusk-count');
  setupSpeciesField('fs-observed-threats-select', 'fs-observed-threats');

  function resetSpeciesFields() {
    ['fs-species-name', 'fs-seedling-species', 'fs-sapling-species', 'fs-mollusk-species', 'fs-observed-threats'].forEach((id) => {
      const input = document.getElementById(id);
      if (input) input.hidden = true;
    });
    [
      document.getElementById('fs-seedling-count'),
      document.getElementById('fs-sapling-count'),
      document.getElementById('fs-mollusk-count'),
    ].forEach((countInput) => setCountFieldLock(countInput, true));
  }

  // Like setupSpeciesField's change handler, but sets a starting value
  // instead of reacting to one — used to fill in an existing submission's
  // species when editing, including one not on the dropdown ("Other").
  function populateSpeciesField(selectId, inputId, value, countInputId) {
    const select = document.getElementById(selectId);
    const input = document.getElementById(inputId);
    const countInput = countInputId ? document.getElementById(countInputId) : null;
    if (!select || !input) return;
    const val = value || '';
    const isKnown = val && Array.from(select.options).some(o => o.value === val);
    if (isKnown) {
      select.value = val;
      input.hidden = true;
      input.value = val;
    } else if (val) {
      select.value = '__other__';
      input.hidden = false;
      input.value = val;
    } else {
      select.value = '';
      input.hidden = true;
      input.value = '';
    }
    if (countInput) setCountFieldLock(countInput, select.value === '');
  }

  function setFieldValue(id, value) {
    const el = document.getElementById(id);
    if (el) el.value = value === null || value === undefined ? '' : value;
  }

  const aquafarmSelect = document.getElementById('fs-aquafarm-activity');
  const aquafarmNameField = document.getElementById('fs-aquafarm-name-field');
  aquafarmSelect.addEventListener('change', () => {
    aquafarmNameField.hidden = aquafarmSelect.value !== 'active___discharge_observed';
  });

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
  // A newly chosen file lives in fs-photo's own input, but an existing
  // submission being edited already has a photo on the server that this
  // input can't reflect — tracked separately so "is a photo attached"
  // means either one, not just whatever's currently sitting in the input.
  let hasExistingPhoto = false;

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

  // Observed Threats stores its dropdown choices as plain slugs (matching
  // what was already saved before "Other" got its own free-text field), so
  // the Review step needs its own lookup back to a readable label — a typed
  // "Other" answer isn't in this map and just passes through unchanged.
  const OBSERVED_THREAT_LABELS = {
    none_observed: 'None observed',
    minor_encroachment: 'Minor encroachment',
    illegal_cutting: 'Illegal cutting',
    'debris___waste_dumping': 'Debris / waste dumping',
    storm_damage: 'Storm damage',
  };
  function observedThreatDisplay(raw) {
    return OBSERVED_THREAT_LABELS[raw] || raw;
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

  function reviewNotesField(label, value) {
    if (value === null || value === undefined || value === '') return reviewField(label, null, { full: true });
    return `<div class="view-field view-field-full"><span class="view-label">${escapeHtml(label)}</span><div class="view-notes">${escapeHtml(String(value))}</div></div>`;
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
    const photoFile = photoInputEl.files[0];

    const siteFields = [
      reviewField('Inspection date', fieldVal('fs-inspection-date')),
      reviewField('GPS location', currentPosition ? `${currentPosition.lat.toFixed(5)}, ${currentPosition.lng.toFixed(5)}` : null),
    ];
    const siteHtml = `<div class="view-grid">${siteFields.join('')}${reviewGridPad(siteFields.length)}</div>`;

    const vegetationFields = [
      reviewField('Species name', fieldVal('fs-species-name')),
      reviewField('Canopy length (m)', fieldVal('fs-canopy-length')),
      reviewField('Canopy width (m)', fieldVal('fs-canopy-width')),
      reviewField('Estimated canopy cover (%)', fieldVal('fs-canopy-cover')),
      reviewField('Tree count', fieldVal('fs-tree-count')),
      reviewField('Average tree height (m)', fieldVal('fs-avg-height')),
      reviewField('GBH (cm)', fieldVal('fs-gbh')),
      reviewField('Seedling species', fieldVal('fs-seedling-species')),
      reviewField('Seedling count', fieldVal('fs-seedling-count')),
      reviewField('Sapling species', fieldVal('fs-sapling-species')),
      reviewField('Sapling count', fieldVal('fs-sapling-count')),
      reviewField('Overall health assessment', selectText('fs-health-assessment')),
    ];
    const vegetationHtml = `<div class="view-grid">${vegetationFields.join('')}${reviewGridPad(vegetationFields.length)}</div>`;

    const photoHtml = photoFile
      ? `<div class="view-field view-field-full"><span class="view-label">Photo documentation</span><img class="edit-photo-preview survey-review-photo" src="${URL.createObjectURL(photoFile)}" alt="Selected photo" /></div>`
      : reviewField('Photo documentation', null, { full: true });

    const faunaFields = [
      reviewField('Mollusk species name', fieldVal('fs-mollusk-species')),
      reviewField('Mollusk count', fieldVal('fs-mollusk-count')),
    ];
    const faunaHtml = `<div class="view-grid">${faunaFields.join('')}${reviewGridPad(faunaFields.length)}${reviewField('Observed threats', observedThreatDisplay(fieldVal('fs-observed-threats')), { full: true })}</div>${reviewNotesField('Additional notes', fieldVal('fs-additional-notes'))}${photoHtml}`;

    const waterFields = [
      reviewField('Water color', selectText('fs-water-color')),
      reviewField('Odor', selectText('fs-odor')),
      reviewField('Visible foam or discharge', selectText('fs-foam-discharge')),
      reviewField('Nearby aquafarm activity', selectText('fs-aquafarm-activity')),
      reviewField('Aquafarm name', aquafarmNameField.hidden ? null : fieldVal('fs-aquafarm-name')),
    ];
    const waterHtml = `<div class="view-grid">${waterFields.join('')}${reviewGridPad(waterFields.length)}</div>${reviewNotesField('Water quality notes', fieldVal('fs-water-notes'))}`;

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

  // "Other" on any of these dropdowns only reveals a blank text box — leaving
  // it empty afterward would submit "Other" as if that were an actual species
  // or threat, which says nothing real at all. Same principle as requiring a
  // photo for a reported threat: picking "Other" is a promise to specify
  // what it actually is, so it isn't optional once chosen.
  function otherTextMissing(selectId, inputId) {
    const select = document.getElementById(selectId);
    const input = document.getElementById(inputId);
    if (!select || !input) return false;
    return select.value === '__other__' && !input.value.trim();
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
      if (!fieldVal('fs-health-assessment')) {
        msgEl.className = 'field-survey-msg error';
        msgEl.textContent = 'Please select an overall health assessment before continuing.';
        return false;
      }
      if (otherTextMissing('fs-species-name-select', 'fs-species-name')
        || otherTextMissing('fs-seedling-species-select', 'fs-seedling-species')
        || otherTextMissing('fs-sapling-species-select', 'fs-sapling-species')) {
        msgEl.className = 'field-survey-msg error';
        msgEl.textContent = 'Please specify the "Other" species you selected before continuing.';
        return false;
      }
    }
    if (step === 3) {
      if (otherTextMissing('fs-mollusk-species-select', 'fs-mollusk-species')) {
        msgEl.className = 'field-survey-msg error';
        msgEl.textContent = 'Please specify the "Other" mollusk species you selected before continuing.';
        return false;
      }
      if (otherTextMissing('fs-observed-threats-select', 'fs-observed-threats')) {
        msgEl.className = 'field-survey-msg error';
        msgEl.textContent = 'Please describe the "Other" threat you selected before continuing.';
        return false;
      }
      // A reported threat needs a photo to actually be actionable — MENRO can't
      // do much with "a ranger said there was illegal cutting" alone, the same
      // way an unphotographed complaint carries little weight in a real
      // enforcement case. Only enforced when a threat was actually selected;
      // a clean "none observed" visit never required one.
      const threatSelect = document.getElementById('fs-observed-threats-select');
      const threatVal = threatSelect ? threatSelect.value : '';
      const threatReported = threatVal && threatVal !== 'none_observed';
      const photoAttached = (photoInputEl.files && photoInputEl.files[0]) || hasExistingPhoto;
      if (threatReported && !photoAttached) {
        msgEl.className = 'field-survey-msg error';
        msgEl.textContent = 'Please attach a photo of the observed threat before continuing.';
        return false;
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

    const tree = (submission.trees && submission.trees[0]) || {};
    populateSpeciesField('fs-species-name-select', 'fs-species-name', tree.species !== '—' ? tree.species : '');
    setFieldValue('fs-canopy-length', tree.canopyLength);
    setFieldValue('fs-canopy-width', tree.canopyWidth);
    setFieldValue('fs-canopy-cover', tree.canopyCoverDirect);
    setFieldValue('fs-tree-count', submission.treeCount);
    setFieldValue('fs-avg-height', tree.height);
    setFieldValue('fs-gbh', tree.gbh);
    populateSpeciesField('fs-seedling-species-select', 'fs-seedling-species', tree.seedlingSpecies, 'fs-seedling-count');
    setFieldValue('fs-seedling-count', tree.seedlingCount);
    populateSpeciesField('fs-sapling-species-select', 'fs-sapling-species', tree.saplingSpecies, 'fs-sapling-count');
    setFieldValue('fs-sapling-count', tree.saplingCount);
    setFieldValue('fs-health-assessment', submission.healthAssessmentRaw);

    populateSpeciesField('fs-mollusk-species-select', 'fs-mollusk-species', tree.molluskSpecies, 'fs-mollusk-count');
    setFieldValue('fs-mollusk-count', tree.molluskCount);
    populateSpeciesField('fs-observed-threats-select', 'fs-observed-threats', submission.observedThreats);
    setFieldValue('fs-additional-notes', submission.additionalNotes);
    hasExistingPhoto = !!(submission.photos && submission.photos.length > 0);
    photoLabelEl.textContent = hasExistingPhoto
      ? 'Photo already attached — choose a new one to replace it'
      : PHOTO_LABEL_DEFAULT;

    setFieldValue('fs-water-color', submission.waterColor);
    setFieldValue('fs-odor', submission.odor);
    setFieldValue('fs-foam-discharge', submission.foamOrDischarge);
    const aquafarmVal = submission.aquafarmRaw || '';
    setFieldValue('fs-aquafarm-activity', aquafarmVal);
    aquafarmNameField.hidden = aquafarmVal !== 'active___discharge_observed';
    setFieldValue('fs-aquafarm-name', aquafarmVal === 'active___discharge_observed' ? submission.aquafarmName : '');
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
    photoLabelEl.textContent = PHOTO_LABEL_DEFAULT;
    hasExistingPhoto = false;
    todayInput.value = todayStr;
    aquafarmNameField.hidden = true;
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
      canopyLength: document.getElementById('fs-canopy-length').value,
      canopyWidth: document.getElementById('fs-canopy-width').value,
      canopyCover: document.getElementById('fs-canopy-cover').value,
      speciesName: document.getElementById('fs-species-name').value,
      treeCount: document.getElementById('fs-tree-count').value,
      avgHeight: document.getElementById('fs-avg-height').value,
      gbh: document.getElementById('fs-gbh').value,
      seedlingSpecies: document.getElementById('fs-seedling-species').value,
      seedlingCount: document.getElementById('fs-seedling-count').value,
      saplingSpecies: document.getElementById('fs-sapling-species').value,
      saplingCount: document.getElementById('fs-sapling-count').value,
      healthAssessment: document.getElementById('fs-health-assessment').value,
      molluskSpecies: document.getElementById('fs-mollusk-species').value,
      molluskCount: document.getElementById('fs-mollusk-count').value,
      observedThreats: document.getElementById('fs-observed-threats').value,
      additionalNotes: document.getElementById('fs-additional-notes').value,
      waterColor: document.getElementById('fs-water-color').value,
      odor: document.getElementById('fs-odor').value,
      foamDischarge: document.getElementById('fs-foam-discharge').value,
      aquafarmActivity: aquafarmSelect.value,
      aquafarmName: document.getElementById('fs-aquafarm-name').value,
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
    const tree = {
      species: fieldVal('fs-species-name'),
      canopyCover: fieldVal('fs-canopy-cover'),
      canopyLength: fieldVal('fs-canopy-length'),
      canopyWidth: fieldVal('fs-canopy-width'),
      treeCount: fieldVal('fs-tree-count'),
      height: fieldVal('fs-avg-height'),
      gbh: fieldVal('fs-gbh'),
      seedlingSpecies: fieldVal('fs-seedling-species'),
      seedlingCount: fieldVal('fs-seedling-count'),
      saplingSpecies: fieldVal('fs-sapling-species'),
      saplingCount: fieldVal('fs-sapling-count'),
      healthAssessment: fieldVal('fs-health-assessment'),
      molluskSpecies: fieldVal('fs-mollusk-species'),
      molluskCount: fieldVal('fs-mollusk-count'),
    };

    const body = new FormData();
    body.append('action', 'updateFields');
    body.append('id', editSubmissionId);
    body.append('aquafarm', aquafarmSelect.value);
    body.append('aquafarmName', fieldVal('fs-aquafarm-name'));
    body.append('waterNotes', fieldVal('fs-water-notes'));
    body.append('observedThreats', fieldVal('fs-observed-threats'));
    body.append('additionalNotes', fieldVal('fs-additional-notes'));
    body.append('waterColor', fieldVal('fs-water-color'));
    body.append('odor', fieldVal('fs-odor'));
    body.append('foamDischarge', fieldVal('fs-foam-discharge'));
    body.append('trees', JSON.stringify([tree]));
    const photoFile = photoInputEl.files[0];
    if (photoFile) body.append('photo', photoFile, photoFile.name || 'photo.jpg');

    try {
      const res = await fetch('../Menro/API/ranger-submissions.php', { method: 'POST', credentials: 'same-origin', body });
      const data = await res.json();
      if (!res.ok || !data.success) throw new Error(data.error || `HTTP ${res.status}`);

      resetFieldSurveyEditMode();
      form.reset();
      photoLabelEl.textContent = PHOTO_LABEL_DEFAULT;
      todayInput.value = todayStr;
      aquafarmNameField.hidden = true;
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
    const photoInput = document.getElementById('fs-photo');
    const photoFile = photoInput.files[0] || null;

    const trySend = async () => {
      if (!navigator.onLine) throw new Error('offline');
      return sendToServer(fields, photoFile);
    };

    try {
      await trySend();
      form.reset();
      photoLabelEl.textContent = PHOTO_LABEL_DEFAULT;
      hasExistingPhoto = false;
      todayInput.value = todayStr;
      aquafarmNameField.hidden = true;
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
      photoLabelEl.textContent = PHOTO_LABEL_DEFAULT;
      hasExistingPhoto = false;
      todayInput.value = todayStr;
      aquafarmNameField.hidden = true;
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
