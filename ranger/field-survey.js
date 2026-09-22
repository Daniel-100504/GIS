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

  function setGpsStatus(state, text) {
    gpsRow.classList.remove('ok', 'error');
    if (state) gpsRow.classList.add(state);
    gpsStatusEl.textContent = text;
    btnRetryGps.hidden = state !== 'error';
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
    // Scroll-wheel zoom is off by default — this map sits inside a
    // scrollable page, so scrolling past it would otherwise zoom it out
    // (sometimes all the way to a whole-region view) instead of scrolling
    // the page. The +/- buttons still work for anyone who wants to zoom.
    gpsMap = L.map(mapEl, { zoomControl: true, scrollWheelZoom: false }).setView(startCenter, currentPosition ? 16 : 15);

    const loadingEl = document.getElementById('surveyGpsMapLoading');
    const hideLoading = () => { if (loadingEl) loadingEl.hidden = true; };
    const tileLayer = L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '© OpenStreetMap',
      maxZoom: 19,
      keepBuffer: 1,
    }).addTo(gpsMap);
    tileLayer.once('load', hideLoading);
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

  const photoInputEl = document.getElementById('fs-photo');
  const photoLabelEl = document.getElementById('surveyPhotoLabel');
  const PHOTO_LABEL_DEFAULT = photoLabelEl.textContent;
  photoInputEl.addEventListener('change', () => {
    photoLabelEl.textContent = photoInputEl.files[0] ? photoInputEl.files[0].name : PHOTO_LABEL_DEFAULT;
  });

  // Species fields offer a dropdown of common mangrove species, with an
  // "Other (specify)" option that reveals a plain text field for anything
  // not on the list — the text field (not the dropdown) is what actually
  // holds the value the rest of the form reads.
  function setupSpeciesField(selectId, inputId) {
    const select = document.getElementById(selectId);
    const input = document.getElementById(inputId);
    if (!select || !input) return;
    select.addEventListener('change', () => {
      if (select.value === '__other__') {
        input.hidden = false;
        input.value = '';
        input.focus();
      } else {
        input.hidden = true;
        input.value = select.value;
      }
    });
  }
  setupSpeciesField('fs-species-name-select', 'fs-species-name');
  setupSpeciesField('fs-seedling-species-select', 'fs-seedling-species');
  setupSpeciesField('fs-sapling-species-select', 'fs-sapling-species');
  setupSpeciesField('fs-mollusk-species-select', 'fs-mollusk-species');

  function resetSpeciesFields() {
    ['fs-species-name', 'fs-seedling-species', 'fs-sapling-species', 'fs-mollusk-species'].forEach((id) => {
      const input = document.getElementById(id);
      if (input) input.hidden = true;
    });
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
  const STEP_NAMES = ['Site Information', 'Vegetation', 'Fauna', 'Water Quality', 'Review'];
  const TOTAL_STEPS = stepPanels.length;
  let currentStep = 1;
  let maxReachedStep = 1;

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

  function reviewRow(question, value) {
    const isEmpty = value === null || value === undefined || value === '';
    const display = isEmpty ? '—' : escapeHtml(String(value));
    return `<tr><td class="qa-question">${escapeHtml(question)}</td><td class="qa-response${isEmpty ? ' muted' : ''}">${display}</td></tr>`;
  }

  function buildReviewHtml() {
    const photoFile = photoInputEl.files[0];
    const rows = [
      `<tr class="qa-part-header"><td colspan="2">Site Information</td></tr>`,
      reviewRow('Inspection date', fieldVal('fs-inspection-date')),
      reviewRow('GPS location', currentPosition ? `${currentPosition.lat.toFixed(5)}, ${currentPosition.lng.toFixed(5)}` : null),
      `<tr class="qa-part-header"><td colspan="2">Vegetation</td></tr>`,
      reviewRow('Species name', fieldVal('fs-species-name')),
      reviewRow('Canopy length (m)', fieldVal('fs-canopy-length')),
      reviewRow('Canopy width (m)', fieldVal('fs-canopy-width')),
      reviewRow('Estimated canopy cover (%)', fieldVal('fs-canopy-cover')),
      reviewRow('Tree count', fieldVal('fs-tree-count')),
      reviewRow('Average tree height (m)', fieldVal('fs-avg-height')),
      reviewRow('GBH (cm)', fieldVal('fs-gbh')),
      reviewRow('Seedling species', fieldVal('fs-seedling-species')),
      reviewRow('Seedling count', fieldVal('fs-seedling-count')),
      reviewRow('Sapling species', fieldVal('fs-sapling-species')),
      reviewRow('Sapling count', fieldVal('fs-sapling-count')),
      reviewRow('Overall health assessment', selectText('fs-health-assessment')),
      `<tr class="qa-part-header"><td colspan="2">Fauna</td></tr>`,
      reviewRow('Mollusk species name', fieldVal('fs-mollusk-species')),
      reviewRow('Mollusk count', fieldVal('fs-mollusk-count')),
      reviewRow('Observed threats', selectText('fs-observed-threats')),
      reviewRow('Additional notes', fieldVal('fs-additional-notes')),
      reviewRow('Photo documentation', photoFile ? photoFile.name : null),
      `<tr class="qa-part-header"><td colspan="2">Water Quality</td></tr>`,
      reviewRow('Water color', selectText('fs-water-color')),
      reviewRow('Odor', selectText('fs-odor')),
      reviewRow('Visible foam or discharge', selectText('fs-foam-discharge')),
      reviewRow('Nearby aquafarm activity', selectText('fs-aquafarm-activity')),
      reviewRow('Aquafarm name', aquafarmNameField.hidden ? null : fieldVal('fs-aquafarm-name')),
      reviewRow('Water quality notes', fieldVal('fs-water-notes')),
    ];

    const photoPreviewHtml = photoFile
      ? `<img class="edit-photo-preview survey-review-photo" src="${URL.createObjectURL(photoFile)}" alt="Selected photo" />`
      : '';

    const reviewBody = document.getElementById('surveyReviewBody');
    if (reviewBody) {
      reviewBody.innerHTML = `
        <p class="survey-note">Please check your answers below. You can go back to fix anything before submitting.</p>
        ${photoPreviewHtml}
        <div class="view-table-wrap survey-review-table">
          <table class="view-qa-table"><tbody>${rows.join('')}</tbody></table>
        </div>`;
    }
  }

  function showStep(step) {
    currentStep = step;
    if (step > maxReachedStep) maxReachedStep = step;

    stepPanels.forEach((panel) => {
      panel.hidden = Number(panel.getAttribute('data-step')) !== step;
    });
    stepItems.forEach((item) => {
      const itemStep = Number(item.getAttribute('data-step-item'));
      item.classList.toggle('active', itemStep === step);
      item.classList.toggle('done', itemStep < step);
    });
    if (stepCurrentLabel) stepCurrentLabel.textContent = `Step ${step} of ${TOTAL_STEPS} — ${STEP_NAMES[step - 1]}`;
    if (btnBack) btnBack.hidden = step === 1;
    if (btnNext) btnNext.hidden = step === TOTAL_STEPS;
    if (submitBtn) submitBtn.hidden = step !== TOTAL_STEPS;
    msgEl.className = 'field-survey-msg';
    msgEl.textContent = '';

    if (step === TOTAL_STEPS) buildReviewHtml();
    if (step === 1 && gpsMap) setTimeout(() => gpsMap.invalidateSize(), 50);

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
    if (step === 2 && !fieldVal('fs-health-assessment')) {
      msgEl.className = 'field-survey-msg error';
      msgEl.textContent = 'Please select an overall health assessment before continuing.';
      return false;
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
      if (currentStep > 1) showStep(currentStep - 1);
    });
  }
  stepItems.forEach((item) => {
    item.addEventListener('click', () => {
      const target = Number(item.getAttribute('data-step-item'));
      if (target <= maxReachedStep) showStep(target);
    });
  });

  function resetWizard() {
    maxReachedStep = 1;
    showStep(1);
  }

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

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    submitBtn.disabled = true;
    msgEl.className = 'field-survey-msg';
    msgEl.textContent = 'Submitting…';

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
      todayInput.value = todayStr;
      aquafarmNameField.hidden = true;
      resetSpeciesFields();
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
      todayInput.value = todayStr;
      aquafarmNameField.hidden = true;
      resetSpeciesFields();
      captureGps();
      resetWizard();
      msgEl.className = 'field-survey-msg offline';
      msgEl.textContent = 'No connection — saved on this device. It will send automatically once you\'re back online.';
    } finally {
      submitBtn.disabled = false;
    }
  });

  showStep(1);
})();
