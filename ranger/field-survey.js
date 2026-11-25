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
  const successBanner = document.getElementById('surveySuccessBanner');
  const successBannerText = document.getElementById('surveySuccessBannerText');

  function showSuccessBanner(text) {
    if (!successBanner) return;
    if (successBannerText) successBannerText.textContent = text;
    successBanner.hidden = false;
  }
  function hideSuccessBanner() {
    if (successBanner) successBanner.hidden = true;
  }
  const submitBtn = document.getElementById('btnSubmitSurvey');

  let activeFieldWarning = null;

  function clearFieldWarning() {
    if (!activeFieldWarning) return;
    activeFieldWarning.tooltip.remove();
    activeFieldWarning.cleanup();
    activeFieldWarning = null;
  }

  function showFieldWarning(target, message) {
    clearFieldWarning();
    msgEl.className = 'field-survey-msg';
    msgEl.textContent = '';
    const el = typeof target === 'string' ? document.getElementById(target) : target;
    if (!el) return;
    const anchor = el.closest('.edit-field') || el;
    const tooltip = document.createElement('div');
    tooltip.className = 'field-warning-tooltip';
    tooltip.innerHTML = `<span class="field-warning-icon">!</span><span>${escapeHtml(message)}</span>`;
    anchor.insertAdjacentElement('afterend', tooltip);
    anchor.scrollIntoView({ behavior: 'smooth', block: 'center' });
    const onInteract = () => clearFieldWarning();
    el.addEventListener('input', onInteract);
    el.addEventListener('change', onInteract);
    activeFieldWarning = {
      tooltip,
      cleanup: () => {
        el.removeEventListener('input', onInteract);
        el.removeEventListener('change', onInteract);
      },
    };
  }

  let currentPosition = null;

  // A live "which zone am I in" check — lets the ranger catch a bad GPS
  // pin before submitting, instead of only finding out afterward once the
  // submission shows up (already tagged with a zone) in their history.
  // Read-only and best-effort: if it fails (no signal, server hiccup) the
  // preview just stays hidden — the real match still happens the same way
  // on the server once the survey is actually submitted.
  const zonePreviewEl = document.getElementById('surveyZonePreview');
  let zonePreviewRequestId = 0;

  // The last zone-match result (or null if it never resolved) — reused by
  // the Review step (so the ranger can actually see which zone/barangay
  // this survey will be filed under, not just raw coordinates) and by the
  // submit confirmation (so a GPS reading far from any mapped zone needs an
  // explicit hand confirmation instead of silently filing against whatever
  // zone happened to be nearest).
  let lastResolvedZone = null;

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
        lastResolvedZone = zone;
        if (typeof setMpaManagerDisplay === 'function') setMpaManagerDisplay(zone.mpaManager);
        if (typeof setZoneIdentityDisplay === 'function') setZoneIdentityDisplay(zone.name, zone.barangay);
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
        lastResolvedZone = null;
        if (typeof setMpaManagerDisplay === 'function') setMpaManagerDisplay('');
        if (typeof setZoneIdentityDisplay === 'function') setZoneIdentityDisplay('', '');
        zonePreviewEl.hidden = true;
      }
    } catch (err) {
      lastResolvedZone = null;
      if (requestId !== zonePreviewRequestId) return;
      if (typeof setMpaManagerDisplay === 'function') setMpaManagerDisplay('');
      if (typeof setZoneIdentityDisplay === 'function') setZoneIdentityDisplay('', '');
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

    // The real mangrove/protected-area zone shapes, so a ranger moving the
    // pin can actually see where the zones are instead of just a blank
    // satellite image — same colors as the MENRO map's own legend (purple
    // mangroves, gold protected areas). Best-effort: if this fails to load,
    // the pin and GPS capture still work fine without it.
    fetch('../Menro/API/mangrove-areas.php?action=list', { credentials: 'same-origin' })
      .then((res) => res.json())
      .then((data) => {
        (data.features || []).forEach((feature) => {
          const isProtected = feature.properties.category === 'protected_area';
          L.geoJSON(feature, {
            style: {
              color: isProtected ? '#b8860b' : '#8a2be2',
              weight: 2,
              fillColor: isProtected ? '#ffd166' : '#8a2be2',
              fillOpacity: 0.22,
            },
          }).bindTooltip(feature.properties.name || (isProtected ? 'Protected area' : 'Mangrove area')).addTo(gpsMap);
        });
      })
      .catch(() => {});

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

  // An installed PWA can report its own window size a beat late right after
  // launching from the home screen icon (a different startup path than a
  // normal browser tab) — Leaflet sizes its tiles to whatever size the map's
  // container reported at creation time, so if that size was wrong at that
  // moment, the map stays blank/mis-sized until something explicitly tells
  // it to re-measure. Catching both events here covers it regardless of
  // which one a given device actually fires.
  document.addEventListener('visibilitychange', () => {
    if (!document.hidden && gpsMap) setTimeout(() => gpsMap.invalidateSize(), 100);
  });
  window.addEventListener('resize', () => {
    if (gpsMap) gpsMap.invalidateSize();
  });

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
        setGpsStatus('error', 'Could not get your location. Check location permission, or pin your location on the map below.');
      },
      { enableHighAccuracy: true, timeout: 15000, maximumAge: 60000 }
    );
  }

  captureGps();
  btnRetryGps.addEventListener('click', captureGps);

  const btnLocateGps = document.getElementById('btnLocateGps');
  if (btnLocateGps) btnLocateGps.addEventListener('click', captureGps);

  const PHOTO_LIMIT = 5;

  const photoInputEl = document.getElementById('fs-photo');
  const photoLabelEl = document.getElementById('surveyPhotoLabel');
  const PHOTO_LABEL_DEFAULT = photoLabelEl.textContent;
  const surveyPhotosListEl = document.getElementById('surveyPhotosList');
  // A newly picked file lives in the input's own .files, but a native
  // multi-select input replaces that FileList entirely on every pick instead
  // of adding to it — so photos actually picked so far are tracked by hand
  // here instead of trusting the input to remember earlier picks.
  let selectedPhotoFiles = [];
  // Existing submission's own photo(s), when editing — shown alongside
  // whatever new photos get picked in this edit, counted against the same
  // 5-photo limit.
  let existingPhotoUrls = [];

  function renderPhotoThumbs() {
    if (!surveyPhotosListEl) return;
    surveyPhotosListEl.innerHTML = '';
    existingPhotoUrls.forEach((url, idx) => {
      const thumb = document.createElement('div');
      thumb.className = 'survey-photo-thumb';
      thumb.innerHTML = `
        <img src="${escapeHtml(url)}" alt="Existing photo" />
        <button type="button" class="survey-photo-thumb-remove" aria-label="Remove photo">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
        </button>
      `;
      thumb.querySelector('.survey-photo-thumb-remove').addEventListener('click', () => {
        existingPhotoUrls.splice(idx, 1);
        renderPhotoThumbs();
      });
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
    const totalCount = selectedPhotoFiles.length + existingPhotoUrls.length;
    photoLabelEl.textContent = totalCount > 0 ? 'Add more photos' : PHOTO_LABEL_DEFAULT;
    if (surveyPhotoPickerEl) surveyPhotoPickerEl.hidden = totalCount >= PHOTO_LIMIT;
  }

  const surveyPhotoPickerEl = document.getElementById('surveyPhotoPicker');

  // Draws a rounded rectangle path — ctx.roundRect is modern but not
  // universal, so a manual quadraticCurveTo path is used as the fallback.
  function roundRectPath(ctx, x, y, w, h, r) {
    if (typeof ctx.roundRect === 'function') {
      ctx.beginPath();
      ctx.roundRect(x, y, w, h, r);
    } else {
      ctx.beginPath();
      ctx.moveTo(x + r, y);
      ctx.lineTo(x + w - r, y);
      ctx.quadraticCurveTo(x + w, y, x + w, y + r);
      ctx.lineTo(x + w, y + h - r);
      ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
      ctx.lineTo(x + r, y + h);
      ctx.quadraticCurveTo(x, y + h, x, y + h - r);
      ctx.lineTo(x, y + r);
      ctx.quadraticCurveTo(x, y, x + r, y);
      ctx.closePath();
    }
  }

  // Burns GPS coordinates, date/time, and zone into the image on a canvas
  // so the geotag is permanently part of the file — survives download,
  // sharing, and printing, the same way a body-camera timestamp does.
  // Falls back to the original file if anything goes wrong (no GPS, canvas
  // error, etc.) so photo capture is never blocked.
  function geotagPhoto(file) {
    return new Promise((resolve) => {
      const url = URL.createObjectURL(file);
      const img = new Image();
      img.onerror = () => { URL.revokeObjectURL(url); resolve(file); };
      img.onload = () => {
        URL.revokeObjectURL(url);
        try {
          // Cap at 1920px on the longest side — full sensor resolution
          // (12MP+) uses ~150 MB of canvas RAM, which crashes older phones.
          // 1920px is sharp enough for documentation and reporting.
          const MAX_DIM = 1920;
          const scale = Math.min(1, MAX_DIM / Math.max(img.naturalWidth, img.naturalHeight));
          const canvas = document.createElement('canvas');
          canvas.width  = Math.round(img.naturalWidth  * scale);
          canvas.height = Math.round(img.naturalHeight * scale);
          const ctx = canvas.getContext('2d');
          ctx.drawImage(img, 0, 0, canvas.width, canvas.height);

          // Scale stamp to image size so it's readable on both phone
          // thumbnails (small) and full-resolution exports (large).
          const base       = Math.max(22, Math.min(Math.round(canvas.width * 0.028), 52));
          const lineH      = Math.round(base * 1.4);
          const pad        = Math.round(base * 0.75);
          const radius     = Math.round(base * 0.45);
          const margin     = Math.round(base * 0.9);

          const lat  = currentPosition ? currentPosition.lat  : null;
          const lng  = currentPosition ? currentPosition.lng  : null;
          const zone = zoneNameDisplayEl ? zoneNameDisplayEl.value.trim() : '';

          const now   = new Date();
          const hh    = now.getHours();
          const min   = String(now.getMinutes()).padStart(2, '0');
          const ampm  = hh >= 12 ? 'PM' : 'AM';
          const hh12  = String(hh > 12 ? hh - 12 : hh || 12).padStart(2, '0');
          const months = ['January','February','March','April','May','June','July','August','September','October','November','December'];
          const days   = ['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday'];
          const dateStr = `${days[now.getDay()]}, ${months[now.getMonth()]} ${now.getDate()}, ${now.getFullYear()}`;

          const lines = [
            { text: (zone && zone !== '—') ? zone : 'Calatagan, Batangas', bold: true,  size: Math.round(base * 1.08) },
            { text: 'Calatagan, Batangas, Philippines',                      bold: false, size: base },
            { text: lat != null ? `Lat ${lat.toFixed(6)}°  Long ${lng.toFixed(6)}°` : 'GPS location unavailable', bold: false, size: base },
            { text: `${dateStr}  ${hh12}:${min} ${ampm} GMT+08:00`,          bold: false, size: base },
            { text: 'AquaGuard · MENRO Calatagan',                           bold: false, size: Math.round(base * 0.88) },
          ];

          // Measure widest line to size the panel
          let maxW = 0;
          lines.forEach((l) => {
            ctx.font = `${l.bold ? 'bold' : 'normal'} ${l.size}px sans-serif`;
            maxW = Math.max(maxW, ctx.measureText(l.text).width);
          });

          const panelW = maxW + pad * 2;
          const panelH = lines.length * lineH + pad * 2 - Math.round(lineH * 0.2);
          const panelX = canvas.width  - panelW - margin;
          const panelY = canvas.height - panelH - margin;

          // Semi-transparent dark background
          ctx.save();
          ctx.globalAlpha = 0.70;
          ctx.fillStyle   = '#0a0a0a';
          roundRectPath(ctx, panelX, panelY, panelW, panelH, radius);
          ctx.fill();
          ctx.restore();

          // Text lines
          let textY = panelY + pad + lines[0].size;
          lines.forEach((l) => {
            ctx.font      = `${l.bold ? 'bold' : 'normal'} ${l.size}px sans-serif`;
            ctx.fillStyle = '#ffffff';
            ctx.globalAlpha = 1;
            ctx.fillText(l.text, panelX + pad, textY);
            textY += lineH;
          });

          canvas.toBlob((blob) => {
            if (!blob) { resolve(file); return; }
            resolve(new File([blob], file.name.replace(/\.[^.]+$/, '.jpg'), { type: 'image/jpeg', lastModified: Date.now() }));
          }, 'image/jpeg', 0.92);
        } catch (err) {
          resolve(file);
        }
      };
      img.src = url;
    });
  }

  photoInputEl.addEventListener('change', async () => {
    const picked = Array.from(photoInputEl.files || []);
    // iOS lets the camera switch to video mode even when accept="image/*" is set;
    // reject any non-image file silently so videos never land in selectedPhotoFiles.
    const imagesOnly = picked.filter(f => f.type.startsWith('image/'));
    const MAX_PHOTO_BYTES = 20 * 1024 * 1024; // 20 MB
    const tooBig = imagesOnly.filter(f => f.size > MAX_PHOTO_BYTES);
    if (tooBig.length > 0) {
      alert(`${tooBig.length} photo(s) are too large to upload (over 20 MB each). Please reduce the file size or use a lower camera resolution, then try again.`);
    }
    const valid = imagesOnly.filter(f => f.size <= MAX_PHOTO_BYTES);
    const room = PHOTO_LIMIT - (selectedPhotoFiles.length + existingPhotoUrls.length);
    const toAdd = valid.slice(0, Math.max(0, room));
    photoInputEl.value = '';
    const geotagged = await Promise.all(toAdd.map(geotagPhoto));
    selectedPhotoFiles = selectedPhotoFiles.concat(geotagged);
    renderPhotoThumbs();
  });

  function resetPhotos() {
    selectedPhotoFiles = [];
    existingPhotoUrls = [];
    renderPhotoThumbs();
  }

  const videoInputEl = document.getElementById('fs-video');
  const videoLabelEl = document.getElementById('surveyVideoLabel');
  const VIDEO_LABEL_DEFAULT = videoLabelEl ? videoLabelEl.textContent : '';
  const surveyVideoListEl = document.getElementById('surveyVideoList');
  const surveyVideoPickerEl = document.getElementById('surveyVideoPicker');
  let selectedVideoFile = null;
  let existingVideoUrl = null;

  function renderVideoThumb() {
    if (!surveyVideoListEl) return;
    surveyVideoListEl.innerHTML = '';
    const url = selectedVideoFile ? URL.createObjectURL(selectedVideoFile) : existingVideoUrl;
    const name = selectedVideoFile ? selectedVideoFile.name : (existingVideoUrl ? 'Current video' : '');
    if (url) {
      const thumb = document.createElement('div');
      thumb.className = 'survey-photo-thumb survey-video-thumb';
      thumb.innerHTML = `
        <video src="${escapeHtml(url)}" muted></video>
        <button type="button" class="survey-photo-thumb-remove" aria-label="Remove video">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
        </button>
      `;
      thumb.querySelector('.survey-photo-thumb-remove').addEventListener('click', () => {
        selectedVideoFile = null;
        existingVideoUrl = null;
        renderVideoThumb();
      });
      surveyVideoListEl.appendChild(thumb);
    }
    if (videoLabelEl) videoLabelEl.textContent = name ? 'Replace video' : VIDEO_LABEL_DEFAULT;
    if (surveyVideoPickerEl) surveyVideoPickerEl.hidden = !!url;
  }

  if (videoInputEl) {
    videoInputEl.addEventListener('change', () => {
      const file = (videoInputEl.files || [])[0];
      const MAX_VIDEO_BYTES = 100 * 1024 * 1024; // 100 MB
      if (file && file.size > MAX_VIDEO_BYTES) {
        alert('The video is too large to upload (over 100 MB). Please trim it or record a shorter clip, then try again.');
        videoInputEl.value = '';
        return;
      }
      if (file) selectedVideoFile = file;
      videoInputEl.value = '';
      renderVideoThumb();
    });
  }

  function resetVideo() {
    selectedVideoFile = null;
    existingVideoUrl = null;
    renderVideoThumb();
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
  const customThreatsContainerEl = document.getElementById('customThreatsContainer');
  const btnAddCustomThreat = document.getElementById('btnAddCustomThreat');
  const threatCheckboxes = threatCheckboxGridEl
    ? Array.from(threatCheckboxGridEl.querySelectorAll('.threat-checkbox-input'))
    : [];

  // Known predefined slugs — values not in this set when loading a saved
  // submission are custom threats added via the "+" button.
  const PREDEFINED_THREAT_SLUGS = new Set([
    'none_observed','charcoal_making','cutting','dieback','pests','garbage',
    'erosion','land_conversion','encroachment','illegal_fishing',
    'sand_gravel_extraction','siltation','storm_damage','fire',
    'pollution___oil_spill','__other__',
  ]);

  function addCustomThreatRow(value) {
    if (!customThreatsContainerEl) return;
    const row = document.createElement('div');
    row.className = 'custom-threat-row';
    row.innerHTML = `
      <input type="text" class="custom-threat-input" placeholder="Threat name" value="${escapeHtml(value || '')}" />
      <button type="button" class="custom-threat-remove" aria-label="Remove">
        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
      </button>`;
    row.querySelector('.custom-threat-remove').addEventListener('click', () => row.remove());
    // Adding any custom threat should uncheck "None observed"
    row.querySelector('.custom-threat-input').addEventListener('input', () => {
      const noneBox = threatCheckboxes.find((b) => b.value === 'none_observed');
      if (noneBox) noneBox.checked = false;
    });
    customThreatsContainerEl.appendChild(row);
    row.querySelector('.custom-threat-input').focus();
  }

  if (btnAddCustomThreat) {
    btnAddCustomThreat.addEventListener('click', () => {
      const noneBox = threatCheckboxes.find((b) => b.value === 'none_observed');
      if (noneBox) noneBox.checked = false;
      addCustomThreatRow('');
    });
  }

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
        if (customThreatsContainerEl) customThreatsContainerEl.innerHTML = '';
      } else if (box.checked && box.value !== 'none_observed') {
        const noneBox = threatCheckboxes.find((b) => b.value === 'none_observed');
        if (noneBox) noneBox.checked = false;
      }
      updateThreatOtherVisibility();
    });
  });

  function collectSelectedThreats() {
    const checked = threatCheckboxes.filter((b) => b.checked).map((b) => b.value);
    const custom = customThreatsContainerEl
      ? Array.from(customThreatsContainerEl.querySelectorAll('.custom-threat-input'))
          .map((inp) => inp.value.trim()).filter(Boolean)
      : [];
    return [...checked, ...custom];
  }

  function resetThreatCheckboxes() {
    threatCheckboxes.forEach((b) => { b.checked = false; });
    if (customThreatsContainerEl) customThreatsContainerEl.innerHTML = '';
    updateThreatOtherVisibility();
  }

  function populateThreatCheckboxes(values) {
    const set = new Set(values || []);
    threatCheckboxes.forEach((b) => { b.checked = set.has(b.value); });
    if (customThreatsContainerEl) customThreatsContainerEl.innerHTML = '';
    (values || []).filter((v) => !PREDEFINED_THREAT_SLUGS.has(v)).forEach(addCustomThreatRow);
    updateThreatOtherVisibility();
  }

  // Read-only now — MENRO sets MPA manager when they map the area, not the
  // ranger. This just displays whatever updateZonePreview() resolved for the
  // ranger's current GPS match (or, when editing a past submission, whatever
  // was already on record for it).
  const mpaManagerDisplayEl = document.getElementById('fs-mpa-manager-display');
  const zoneNameDisplayEl = document.getElementById('fs-zone-name-display');
  const zoneBarangayDisplayEl = document.getElementById('fs-zone-barangay-display');

  function mpaManagerValue() {
    return mpaManagerDisplayEl ? mpaManagerDisplayEl.value : '';
  }

  function setMpaManagerDisplay(value) {
    if (mpaManagerDisplayEl) mpaManagerDisplayEl.value = value || '—';
  }

  function setZoneIdentityDisplay(name, barangay) {
    if (zoneNameDisplayEl) zoneNameDisplayEl.value = name || '—';
    if (zoneBarangayDisplayEl) zoneBarangayDisplayEl.value = barangay || '—';
  }

  function resetMpaManager() {
    setMpaManagerDisplay('');
    setZoneIdentityDisplay('', '');
  }

  function resetSpeciesFields() {
    resetPlotBlocks();
    resetMolluskTable();
    resetThreatCheckboxes();
    resetPhotos();
    resetVideo();
    resetMpaManager();
  }

  // The Vegetation step's species table — one row per species actually found
  // in the plot, each with its own Trees/Saplings/Seedlings counts, instead
  // of the old single fixed "main species" + "seedling species" + "sapling
  // species" fields. A species already used in one row is removed from every
  // other row's dropdown, since the same species can't be logged twice.
  let speciesRowSeq = 0;

  // Each row now represents one individually measured tree (its own Code,
  // Height, GBH, Canopy), not a species-wide total, so the same species can
  // legitimately appear in more than one row within a plot — e.g. two
  // separate Kalapinay trees with different measurements. Every row's list
  // is the same full list, nothing excluded for being used elsewhere.
  function buildSpeciesRowOptionsHtml(rowsEl, selectedValue) {
    const optionsFor = (list) => list
      .map((sp) => {
        const escaped = sp.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;');
        return `<option value="${escaped}"${sp === selectedValue ? ' selected' : ''}>${escaped}</option>`;
      })
      .join('');
    // Grouped so it's visually obvious where true mangroves end and
    // associate/other flora begins — previously one flat alphabetical list
    // scattered e.g. Bakawan and Pagatpat among ~40 non-mangrove species.
    let html = '<option value="">Select…</option>';
    html += `<optgroup label="True Mangroves">${optionsFor(TRUE_MANGROVE_SPECIES_LIST)}</optgroup>`;
    html += `<optgroup label="Associates / Other">${optionsFor(ASSOCIATE_SPECIES_LIST)}</optgroup>`;
    html += `<option value="__other__"${selectedValue === '__other__' ? ' selected' : ''}>Other (specify)</option>`;
    return html;
  }

  function refreshSpeciesRowOptions(rowsEl) {
    rowsEl.querySelectorAll('.species-row-select').forEach((sel) => {
      const current = sel.value;
      sel.innerHTML = buildSpeciesRowOptionsHtml(rowsEl, current);
    });
    updateRemoveSpeciesButtonsVisibility(rowsEl);
  }

  // The remove (trash) button only makes sense once there's more than one
  // row — a lone row should stay in place so the table is never fully empty
  // mid-edit, even though a genuinely empty table is allowed once the ranger
  // hasn't added anything yet at all.
  function updateRemoveSpeciesButtonsVisibility(rowsEl) {
    const rows = rowsEl.querySelectorAll('.species-row');
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

  function createSpeciesRowEl(rowsEl, prefill) {
    const rowId = ++speciesRowSeq;
    const row = document.createElement('div');
    row.className = 'species-row';
    row.dataset.rowId = String(rowId);
    row.innerHTML = `
      <div class="species-row-species-cell">
        <select class="species-row-select" aria-label="Species"></select>
        <input type="text" class="species-row-other" placeholder="Enter species name" hidden />
      </div>
      <div class="species-row-count-group">
        <span class="species-row-count-label">Trees</span>
        <input type="number" class="species-row-count" data-field="tree" step="1" min="0" placeholder="0" aria-label="Trees" />
      </div>
      <div class="species-row-count-group">
        <span class="species-row-count-label">Saplings</span>
        <input type="number" class="species-row-count" data-field="sapling" step="1" min="0" placeholder="0" aria-label="Saplings" />
      </div>
      <div class="species-row-count-group">
        <span class="species-row-count-label">Seedlings</span>
        <input type="number" class="species-row-count" data-field="seedling" step="1" min="0" placeholder="0" aria-label="Seedlings" />
      </div>
      <button type="button" class="species-row-remove" aria-label="Remove species row" title="Remove">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>
      </button>
      <div class="species-row-measurements">
        <label>
          <span>Code</span>
          <input type="text" class="species-row-measure" data-field="code" placeholder="e.g. P1M1" aria-label="Tree code" readonly />
        </label>
        <label>
          <span>Height (m)</span>
          <input type="number" class="species-row-measure" data-field="height" step="any" min="0" placeholder="0" aria-label="Height in meters" />
        </label>
        <label>
          <span>GBH (cm)</span>
          <input type="number" class="species-row-measure" data-field="gbh" step="any" min="0" placeholder="0" aria-label="Girth at breast height in centimeters" />
        </label>
        <label>
          <span>Canopy L (m)</span>
          <input type="number" class="species-row-measure" data-field="canopyLength" step="any" min="0" placeholder="0" aria-label="Canopy length in meters" />
        </label>
        <label>
          <span>Canopy W (m)</span>
          <input type="number" class="species-row-measure" data-field="canopyWidth" step="any" min="0" placeholder="0" aria-label="Canopy width in meters" />
        </label>
      </div>
    `;
    const select = row.querySelector('.species-row-select');
    const isKnown = prefill && prefill.species && MANGROVE_SPECIES_LIST.includes(prefill.species);
    const isCustom = prefill && prefill.species && !isKnown;
    select.innerHTML = buildSpeciesRowOptionsHtml(rowsEl, isCustom ? '__other__' : (prefill ? prefill.species : ''));
    select.addEventListener('change', () => {
      refreshSpeciesRowOptions(rowsEl);
      updateSpeciesOtherVisibility(row);
    });
    row.querySelector('.species-row-remove').addEventListener('click', () => removeSpeciesRow(rowsEl, row));
    if (isCustom) {
      const otherInput = row.querySelector('.species-row-other');
      otherInput.hidden = false;
      otherInput.value = prefill.species;
    }

    // Code defaults to "P{plot no.}M{tree number in this plot}" (e.g.
    // P1M1, P1M2…), matching the real sheet's own tagging convention —
    // still editable, and only applied when the plot's own number is
    // known and nothing more specific was already prefilled.
    const plotBlockEl = rowsEl.closest('.plot-block');
    const plotNoForCode = plotBlockEl ? (plotBlockEl.querySelector('.plot-no-input').value || '').trim() : '';
    if (plotNoForCode) {
      const rowIndexForCode = rowsEl.querySelectorAll('.species-row').length + 1;
      row.querySelector('.species-row-measure[data-field="code"]').value = `P${plotNoForCode}M${rowIndexForCode}`;
    }

    if (prefill) {
      const setCount = (field, value) => {
        const el = row.querySelector(`.species-row-count[data-field="${field}"]`);
        if (el && value !== null && value !== undefined && value !== '') el.value = value;
      };
      setCount('tree', prefill.treeCount);
      setCount('sapling', prefill.saplingCount);
      setCount('seedling', prefill.seedlingCount);
      const setMeasure = (field, value) => {
        const el = row.querySelector(`.species-row-measure[data-field="${field}"]`);
        if (el && value !== null && value !== undefined && value !== '') el.value = value;
      };
      setMeasure('code', prefill.code);
      setMeasure('height', prefill.height);
      setMeasure('gbh', prefill.gbh);
      setMeasure('canopyLength', prefill.canopyLength);
      setMeasure('canopyWidth', prefill.canopyWidth);
    }
    return row;
  }

  function addSpeciesRow(rowsEl, prefill) {
    const row = createSpeciesRowEl(rowsEl, prefill);
    rowsEl.appendChild(row);
    updateRemoveSpeciesButtonsVisibility(rowsEl);
    return row;
  }

  // Codes are read-only and generated purely from position (P{plot}M{n}),
  // so removing a row from the middle has to renumber everything after it
  // right away — otherwise a gap or a duplicate code would be stuck there
  // with no way for the ranger to fix it by hand.
  function renumberSpeciesRowCodes(rowsEl) {
    const plotBlockEl = rowsEl.closest('.plot-block');
    const plotNo = plotBlockEl ? (plotBlockEl.querySelector('.plot-no-input').value || '').trim() : '';
    if (!plotNo) return;
    rowsEl.querySelectorAll('.species-row').forEach((row, i) => {
      const codeInput = row.querySelector('.species-row-measure[data-field="code"]');
      if (codeInput) codeInput.value = `P${plotNo}M${i + 1}`;
    });
  }

  function removeSpeciesRow(rowsEl, row) {
    if (rowsEl.querySelectorAll('.species-row').length <= 1) return;
    row.remove();
    refreshSpeciesRowOptions(rowsEl);
    renumberSpeciesRowCodes(rowsEl);
  }

  function resetSpeciesTable(rowsEl) {
    rowsEl.innerHTML = '';
    addSpeciesRow(rowsEl);
  }

  // One row per species that actually has a species chosen; rows left on
  // "Select…" are ignored rather than treated as an error, so an unused
  // blank row (e.g. after removing others) doesn't block submission.
  function collectSpeciesTableRows(rowsEl) {
    const rows = [];
    rowsEl.querySelectorAll('.species-row').forEach((row) => {
      const selectVal = row.querySelector('.species-row-select').value;
      const species = selectVal === '__other__' ? row.querySelector('.species-row-other').value.trim() : selectVal;
      if (!species) return;
      const getCount = (field) => row.querySelector(`.species-row-count[data-field="${field}"]`).value;
      const getMeasure = (field) => row.querySelector(`.species-row-measure[data-field="${field}"]`).value;
      rows.push({
        species,
        treeCount: getCount('tree'),
        saplingCount: getCount('sapling'),
        seedlingCount: getCount('seedling'),
        code: getMeasure('code'),
        height: getMeasure('height'),
        gbh: getMeasure('gbh'),
        canopyLength: getMeasure('canopyLength'),
        canopyWidth: getMeasure('canopyWidth'),
      });
    });
    return rows;
  }

  function populateSpeciesTable(rowsEl, rows) {
    rowsEl.innerHTML = '';
    const real = (rows || []).filter((r) => r && r.species);
    if (real.length === 0) {
      addSpeciesRow(rowsEl);
      return;
    }
    real.forEach((r) => addSpeciesRow(rowsEl, r));
  }

  // Plots & Species — a repeatable block per plot visited during this
  // survey (matches the real MENRO sheet, where one visit can measure
  // several numbered plots). Each block owns its own species table, built
  // from the same row machinery above, just scoped to that block's own
  // rows container instead of one shared table.
  const plotBlocksContainerEl = document.getElementById('plotBlocksContainer');
  const btnAddPlot = document.getElementById('btnAddPlot');
  let plotBlockSeq = 0;

  function updatePlotBlockRemoveVisibility() {
    const blocks = plotBlocksContainerEl.querySelectorAll('.plot-block');
    blocks.forEach((block) => {
      const btn = block.querySelector('.plot-block-remove');
      if (btn) btn.hidden = blocks.length <= 1;
    });
  }

  function createPlotBlockEl(prefill) {
    const blockId = ++plotBlockSeq;
    const block = document.createElement('div');
    block.className = 'plot-block';
    block.dataset.blockId = String(blockId);
    block.innerHTML = `
      <div class="plot-block-header">
        <label class="edit-field">
          <span>Plot No.</span>
          <input type="text" class="plot-no-input" placeholder="e.g. 1" readonly />
        </label>
        <label class="edit-field">
          <span>Plot size (m)</span>
          <div class="plot-size-inputs">
            <input type="number" class="plot-size-length" placeholder="Length" min="0" step="0.1" />
            <span class="plot-size-sep">×</span>
            <input type="number" class="plot-size-width" placeholder="Width" min="0" step="0.1" />
          </div>
        </label>
        <button type="button" class="plot-block-remove" aria-label="Remove this plot" title="Remove">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>
        </button>
      </div>
      <div class="species-table-wrap">
        <div class="species-table-header">
          <span>Species <em>*</em></span>
          <span>Trees</span>
          <span>Saplings</span>
          <span>Seedlings</span>
          <span></span>
        </div>
        <div class="species-table-rows"></div>
      </div>
      <button type="button" class="btn-add-species">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
        Add species
      </button>
    `;
    // Plot No. defaults to this plot's position (1, 2, 3…) — still editable,
    // but matches the order plots are measured in for the common case.
    block.querySelector('.plot-no-input').value = (prefill && prefill.plotNo) ? prefill.plotNo : String(blockId);
    if (prefill && prefill.plotSize) {
      const m = /^(\d+(?:\.\d+)?)\s*[mx×]\s*(\d+(?:\.\d+)?)/i.exec(prefill.plotSize);
      if (m) {
        block.querySelector('.plot-size-length').value = m[1];
        block.querySelector('.plot-size-width').value = m[2];
      }
    }
    const rowsEl = block.querySelector('.species-table-rows');
    block.querySelector('.btn-add-species').addEventListener('click', () => addSpeciesRow(rowsEl));
    if (prefill && prefill.speciesRows && prefill.speciesRows.length) {
      populateSpeciesTable(rowsEl, prefill.speciesRows);
    } else {
      resetSpeciesTable(rowsEl);
    }
    block.querySelector('.plot-block-remove').addEventListener('click', () => removePlotBlock(block));
    return block;
  }

  function addPlotBlock(prefill) {
    const block = createPlotBlockEl(prefill);
    plotBlocksContainerEl.appendChild(block);
    updatePlotBlockRemoveVisibility();
    return block;
  }

  // Same reasoning as renumberSpeciesRowCodes — Plot No. is read-only and
  // just reflects position, so removing a plot from the middle has to shift
  // every plot after it (and every one of their species codes, since those
  // are built from the plot's own number) down by one right away.
  function renumberPlotBlocks() {
    Array.from(plotBlocksContainerEl.querySelectorAll('.plot-block')).forEach((block, i) => {
      block.querySelector('.plot-no-input').value = String(i + 1);
      renumberSpeciesRowCodes(block.querySelector('.species-table-rows'));
    });
  }

  function removePlotBlock(block) {
    if (plotBlocksContainerEl.querySelectorAll('.plot-block').length <= 1) return;
    block.remove();
    updatePlotBlockRemoveVisibility();
    renumberPlotBlocks();
  }

  function resetPlotBlocks() {
    plotBlocksContainerEl.innerHTML = '';
    plotBlockSeq = 0;
    addPlotBlock();
  }

  if (btnAddPlot) btnAddPlot.addEventListener('click', () => addPlotBlock());
  if (plotBlocksContainerEl) resetPlotBlocks();

  function collectPlotBlocks() {
    return Array.from(plotBlocksContainerEl.querySelectorAll('.plot-block')).map((block) => ({
      plotNo: block.querySelector('.plot-no-input').value,
      plotSize: (() => {
        const l = block.querySelector('.plot-size-length').value.trim();
        const w = block.querySelector('.plot-size-width').value.trim();
        return (l && w) ? `${l}x${w}` : (l || w || '');
      })(),
      speciesRows: collectSpeciesTableRows(block.querySelector('.species-table-rows')),
    }));
  }

  function populatePlotBlocks(plots) {
    plotBlocksContainerEl.innerHTML = '';
    plotBlockSeq = 0;
    const real = (plots || []).filter((p) => p && (p.plotNo || (p.speciesRows && p.speciesRows.length)));
    if (real.length === 0) {
      addPlotBlock();
      return;
    }
    real.forEach((p) => addPlotBlock(p));
  }

  function setFieldValue(id, value) {
    const el = document.getElementById(id);
    if (el) el.value = value === null || value === undefined ? '' : value;
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
  const STEP_NAMES = ['Site Information', 'Vegetation', 'Fauna & Threats', 'Water Quality', 'Review'];
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

  // .view-grid used to be a 3-column grid, where a row left with only 1 or 2
  // real fields needed blank filler cells to close out its border evenly.
  // It's a plain stacked list now, so every field is already its own
  // full-width row — nothing to pad.
  function reviewGridPad() {
    return '';
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
    // Zone/barangay, not just raw coordinates — that's the thing most worth
    // double-checking before submitting (it's what the survey actually gets
    // filed against), and raw GPS numbers don't tell a ranger whether that
    // lookup landed somewhere sensible.
    // Shows the distance too when it's not a clean "inside" match — "Area 23"
    // alone read as a confirmed fact even when it was actually 10.4 km away
    // and the ranger hadn't ticked the override checkbox yet.
    const zoneLabel = lastResolvedZone
      ? (lastResolvedZone.inside || typeof lastResolvedZone.distanceMeters !== 'number'
          ? lastResolvedZone.name
          : `${lastResolvedZone.name} (${formatDistance(lastResolvedZone.distanceMeters)} away)`)
      : null;
    const siteFields = [
      reviewField('Inspection date', fieldVal('fs-inspection-date')),
      reviewField('GPS location', currentPosition ? `${currentPosition.lat.toFixed(5)}, ${currentPosition.lng.toFixed(5)}` : null),
      reviewField('Nearest mangrove zone', zoneLabel),
      reviewField('Barangay', lastResolvedZone ? lastResolvedZone.barangay : null),
    ];
    const siteHtml = `<div class="view-grid">${siteFields.join('')}${reviewGridPad(siteFields.length)}</div>`;

    // Mirrors the Vegetation step's own numbered groups (Area & MPA Manager /
    // Plots & Species / Overall Health), same reasoning as the Water Quality
    // section below.
    const areaFields = [
      reviewField('Mangrove name', zoneNameDisplayEl ? zoneNameDisplayEl.value : ''),
      reviewField('Barangay', zoneBarangayDisplayEl ? zoneBarangayDisplayEl.value : ''),
      reviewField('Area', fieldVal('fs-area-no')),
      reviewField('MPA manager', mpaManagerValue()),
    ];
    const areaHtml = `<p class="view-subsection-label">Plot</p><div class="view-grid">${areaFields.join('')}${reviewGridPad(areaFields.length)}</div>`;

    const plotsForReview = collectPlotBlocks();
    const plotsReviewHtml = plotsForReview.map((p, i) => {
      const plotLabel = p.plotNo ? (p.plotSize ? `${p.plotNo} (${p.plotSize})` : p.plotNo) : null;
      const plotFieldHtml = `<div class="view-grid">${reviewField('Plot No.', plotLabel)}${reviewGridPad(1)}</div>`;
      const tableHtml = p.speciesRows.length
        ? `<div class="view-table-wrap"><table class="view-species-table">
            <thead><tr><th>Code</th><th>Species</th><th>Trees</th><th>Saplings</th><th>Seedlings</th><th>Height (m)</th><th>GBH (cm)</th><th>Canopy L (m)</th><th>Canopy W (m)</th></tr></thead>
            <tbody>${p.speciesRows.map((r) => `<tr><td>${escapeHtml(r.code || '—')}</td><td>${escapeHtml(r.species)}</td><td>${escapeHtml(r.treeCount || '—')}</td><td>${escapeHtml(r.saplingCount || '—')}</td><td>${escapeHtml(r.seedlingCount || '—')}</td><td>${escapeHtml(r.height || '—')}</td><td>${escapeHtml(r.gbh || '—')}</td><td>${escapeHtml(r.canopyLength || '—')}</td><td>${escapeHtml(r.canopyWidth || '—')}</td></tr>`).join('')}</tbody>
          </table></div>`
        : viewEmptyNote('No species recorded.');
      return `<p class="view-subsection-label">Plot ${i + 1}</p>${plotFieldHtml}${tableHtml}`;
    }).join('');

    const healthRaw = fieldVal('fs-health-assessment');
    const healthBadge = healthBadgeHtml(healthRaw);
    const healthFieldHtml = healthBadge
      ? reviewFieldHtml('Overall health assessment', healthBadge)
      : reviewField('Overall health assessment', null);
    const healthHtml = `<p class="view-subsection-label">Overall Health</p><div class="view-grid">${healthFieldHtml}${reviewGridPad(1)}</div>`;

    const vegetationHtml = `${areaHtml}${plotsReviewHtml}${healthHtml}`;

    const allPhotos = existingPhotoUrls.map((url) => ({ src: url })).concat(
      selectedPhotoFiles.map((file) => ({ src: URL.createObjectURL(file) }))
    );
    const photoHtml = allPhotos.length
      ? `<div class="view-photos">${allPhotos.map((p) => `<img class="edit-photo-preview survey-review-photo" src="${p.src}" alt="Photo" />`).join('')}</div>`
      : viewEmptyNote('No photos attached.');

    const videoSrc = selectedVideoFile ? URL.createObjectURL(selectedVideoFile) : existingVideoUrl;
    const videoHtml = videoSrc
      ? `<div class="view-photos"><video class="edit-photo-preview survey-review-photo" src="${escapeHtml(videoSrc)}" controls></video></div>`
      : viewEmptyNote('No video attached.');

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

    const photosHtml = `<p class="view-subsection-label">Photos</p>${photoHtml}${videoSrc ? `<p class="view-subsection-label">Video</p>${videoHtml}` : ''}`;

    const faunaHtml = `${molluskSectionHtml}${threatsHtml}${notesHtml}${photosHtml}`;

    // Mirrors the Water Quality step's own 2 numbered groups (Observations /
    // Notes) instead of one long flat grid, so the review reads as the same
    // groups the ranger just filled in.
    const observationsFields = [
      reviewField('Water clarity', selectText('fs-water-clarity')),
      reviewField('Water color', selectText('fs-water-color')),
      reviewField('Odor', selectText('fs-odor')),
      reviewField('Visible foam or discharge', selectText('fs-foam-discharge')),
    ];
    const observationsHtml = `<p class="view-subsection-label">Observations</p><div class="view-grid">${observationsFields.join('')}${reviewGridPad(observationsFields.length)}</div>`;

    const instrumentIds = ['fs-salinity', 'fs-ph', 'fs-water-temp', 'fs-secchi-depth'];
    const hasInstrumentValues = instrumentIds.some((id) => fieldVal(id));
    const instrumentHtml = hasInstrumentValues
      ? `<p class="view-subsection-label">Instrument Readings</p><div class="view-grid">${[
          reviewField('Salinity (ppt)', fieldVal('fs-salinity')),
          reviewField('pH', fieldVal('fs-ph')),
          reviewField('Water temperature (°C)', fieldVal('fs-water-temp')),
          reviewField('Secchi depth (cm)', fieldVal('fs-secchi-depth')),
        ].join('')}</div>`
      : '';

    const waterNotesRaw = fieldVal('fs-water-notes');
    const waterNotesHtml = `<p class="view-subsection-label">Notes</p>${waterNotesRaw ? `<div class="view-notes">${escapeHtml(waterNotesRaw)}</div>` : viewEmptyNote('No water quality notes.')}`;

    const waterHtml = `${observationsHtml}${instrumentHtml}${waterNotesHtml}`;

    const reviewBody = document.getElementById('surveyReviewBody');
    if (reviewBody) {
      reviewBody.innerHTML = `
        <p class="survey-note">Please check your answers below. You can go back to fix anything before submitting.</p>
        ${reviewSection('site', 'Site Information', siteHtml)}
        ${reviewSection('vegetation', 'Vegetation', vegetationHtml)}
        ${reviewSection('fauna', 'Fauna & Threats', faunaHtml)}
        ${reviewSection('water', 'Water Quality', waterHtml)}
      `;
      reviewBody.querySelectorAll('.survey-review-photo').forEach((el) => {
        el.addEventListener('click', () => {
          if (typeof window.openMediaLightbox === 'function') {
            window.openMediaLightbox(el.src || el.currentSrc, el.tagName === 'VIDEO' ? 'video' : 'image');
          }
        });
      });
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
    if (stepCurrentLabel) stepCurrentLabel.textContent = `Step ${currentStep} of ${TOTAL_STEPS}: ${STEP_NAMES[currentStep - 1]}`;
    if (btnBack) btnBack.hidden = currentStep === editModeMinStep;
    if (btnNext) btnNext.hidden = currentStep === TOTAL_STEPS;
    if (submitBtn) submitBtn.hidden = currentStep !== TOTAL_STEPS;
    msgEl.className = 'field-survey-msg';
    msgEl.textContent = '';
    clearFieldWarning();

    if (currentStep === TOTAL_STEPS) buildReviewHtml();
    if (currentStep === 1 && gpsMap) setTimeout(() => gpsMap.invalidateSize(), 50);

    const panelEl = form.closest('.form-panel');
    if (panelEl) panelEl.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  // Water Quality, part 2: instrument readings — collapsed by default since
  // most rangers won't have the instruments on hand; opening it never clears
  // whatever was already typed in, so toggling back and forth is safe.
  const btnToggleInstruments = document.getElementById('btnToggleInstruments');
  const btnToggleInstrumentsLabel = document.getElementById('btnToggleInstrumentsLabel');
  const instrumentReadingsPanel = document.getElementById('instrumentReadingsPanel');
  const instrumentReadingsHelp = document.getElementById('instrumentReadingsHelp');
  if (btnToggleInstruments) {
    btnToggleInstruments.addEventListener('click', () => {
      const opening = !instrumentReadingsPanel.classList.contains('active');
      instrumentReadingsPanel.classList.toggle('active', opening);
      if (instrumentReadingsHelp) instrumentReadingsHelp.hidden = !opening;
      if (btnToggleInstrumentsLabel) btnToggleInstrumentsLabel.textContent = opening ? 'Hide instrument readings' : 'Add instrument readings (optional)';
    });
  }

  function validateStep(step) {
    if (step === 1) {
      if (!fieldVal('fs-inspection-date')) {
        showFieldWarning('fs-inspection-date', 'Please choose the inspection date before continuing.');
        return false;
      }
      if (fieldVal('fs-inspection-date') > todayStr) {
        showFieldWarning('fs-inspection-date', 'Inspection date cannot be in the future.');
        return false;
      }
      if (!currentPosition) {
        showFieldWarning(gpsRow, 'Waiting for your GPS location. Allow location access, or tap Retry, before continuing.');
        return false;
      }
    }
    if (step === 2) {
      if (!fieldVal('fs-health-assessment')) {
        showFieldWarning('fs-health-assessment', 'Please select an overall health assessment before continuing.');
        return false;
      }
      const plots = collectPlotBlocks();
      const allSpeciesRows = plots.flatMap((p) => p.speciesRows);
      if (allSpeciesRows.length === 0) {
        showFieldWarning(plotBlocksContainerEl, 'Please select a species.');
        return false;
      }
      // Checked before the "missing count" rule below — a row with -5 trees
      // and nothing else used to fall into "t <= 0 && s <= 0 && e <= 0"
      // (true for -5) and get the generic "enter at least one count"
      // message instead of being told the actual problem was the negative
      // number.
      const rowNegativeCount = allSpeciesRows.some((r) => {
        return [r.treeCount, r.saplingCount, r.seedlingCount].some((v) => v !== '' && parseFloat(v) < 0);
      });
      if (rowNegativeCount) {
        showFieldWarning(plotBlocksContainerEl, 'Tree, sapling, and seedling counts cannot be negative.');
        return false;
      }
      const rowMissingCount = allSpeciesRows.some((r) => {
        const t = parseFloat(r.treeCount) || 0;
        const s = parseFloat(r.saplingCount) || 0;
        const e = parseFloat(r.seedlingCount) || 0;
        return t <= 0 && s <= 0 && e <= 0;
      });
      if (rowMissingCount) {
        showFieldWarning(plotBlocksContainerEl, 'Enter at least one count for this species.');
        return false;
      }
    }
    if (step === 3) {
      const molluskRows = collectMolluskTableRows();
      const molluskMissingSpecies = molluskRows.some((r) => !r.species);
      if (molluskMissingSpecies) {
        showFieldWarning(document.querySelector('.mollusk-table-wrap'), 'Please select a species.');
        return false;
      }
      // "None observed" counts as a real answer too — without requiring
      // something here, there'd be no way to tell "the ranger checked and
      // saw no threats" apart from "the ranger skipped this step".
      const selectedThreats = collectSelectedThreats();
      if (selectedThreats.length === 0) {
        showFieldWarning(threatCheckboxGridEl, 'Select the threats you saw, or None observed.');
        return false;
      }
      if (selectedThreats.includes('__other__') && !fieldVal('fs-observed-threats-other')) {
        showFieldWarning('fs-observed-threats-other', 'Describe the other threat.');
        return false;
      }

      // Every visit needs photo proof it actually happened, not just the ones
      // where a threat turns up — the same way a real inspection report is
      // never accepted on the inspector's word alone, threat or no threat.
      const photoAttached = selectedPhotoFiles.length > 0 || existingPhotoUrls.length > 0;
      if (!photoAttached) {
        showFieldWarning(document.getElementById('surveyPhotoPicker'), 'Please attach at least one photo before continuing.');
        return false;
      }
    }
    return true;
  }

  if (btnNext) {
    btnNext.addEventListener('click', () => {
      if (!validateStep(currentStep)) return;
      hideSuccessBanner();
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

    // Canopy cover and mollusk data are flat fields on the outer record, not
    // inside the per-species Vegetation table — read straight from the raw
    // saved record instead of off the first species row, which no longer
    // carries them now that species are real repeat-group entries.
    const rawRecord = submission.raw || {};
    setFieldValue('fs-area-no', rawRecord['Area_No']);
    setMpaManagerDisplay(rawRecord['MPA_Manager']);
    setZoneIdentityDisplay(rawRecord['_zone_name'], rawRecord['_zone_barangay']);

    // A real Plot_Records array (new-format, multi-plot submissions) takes
    // priority; a legacy record only ever had one implicit plot, described
    // by the flat Plot_No/Plot_Size fields and a single Species_Records list.
    let plotsForEdit;
    if (Array.isArray(rawRecord['Plot_Records']) && rawRecord['Plot_Records'].length > 0) {
      plotsForEdit = rawRecord['Plot_Records'].map((p) => ({
        plotNo: p['Plot_No'] || '',
        plotSize: p['Plot_Size'] || '',
        speciesRows: (p['Species_Records'] || []).map((t) => ({
          species: t['Species_Name'] || '',
          treeCount: t['Tree_Count'],
          saplingCount: t['Sapling_Count'],
          seedlingCount: t['Seedling_Count'],
          code: t['Tree_Code'],
          height: t['Height_m'],
          gbh: t['GBH_cm'],
          canopyLength: t['Canopy_Length_m'],
          canopyWidth: t['Canopy_Width_m'],
        })),
      }));
    } else {
      const trees = (submission.trees && submission.trees.length) ? submission.trees : [];
      plotsForEdit = [{
        plotNo: rawRecord['Plot_No'] || '',
        plotSize: rawRecord['Plot_Size'] || '',
        speciesRows: trees.map((t) => ({
          species: t.species !== '—' ? t.species : '',
          treeCount: t.treeCount,
          saplingCount: t.saplingCount,
          seedlingCount: t.seedlingCount,
          code: t.code !== '—' ? t.code : '',
          height: t.height,
          gbh: t.gbh,
          canopyLength: t.canopyLength,
          canopyWidth: t.canopyWidth,
        })),
      }];
    }
    populatePlotBlocks(plotsForEdit);
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
    existingVideoUrl = submission.video || null;
    selectedVideoFile = null;
    renderVideoThumb();

    setFieldValue('fs-water-clarity', rawRecord['Water_Clarity']);
    setFieldValue('fs-water-color', submission.waterColor);
    setFieldValue('fs-odor', submission.odor);
    setFieldValue('fs-foam-discharge', submission.foamOrDischarge);

    setFieldValue('fs-salinity', rawRecord['Salinity_ppt']);
    setFieldValue('fs-ph', rawRecord['PH']);
    setFieldValue('fs-water-temp', rawRecord['Water_Temperature_C']);
    setFieldValue('fs-secchi-depth', rawRecord['Secchi_Depth_cm']);
    const hasInstrumentReadings = ['Salinity_ppt', 'PH', 'Water_Temperature_C', 'Secchi_Depth_cm']
      .some((key) => rawRecord[key] !== undefined && rawRecord[key] !== null && rawRecord[key] !== '');
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
    if (submitBtn) submitBtn.textContent = 'Submit';
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

  // Returns true on success, 'stripped' if it only fit after dropping
  // photos, or false if it couldn't be saved at all. A full offline queue
  // (several photos stored as base64 text add up fast) used to throw
  // QuotaExceededError straight out of this call — uncaught, which is what
  // was leaving "Submitting…" stuck forever: the code that updates that
  // message never got the chance to run once this line died.
  function setQueue(queue) {
    try {
      localStorage.setItem(QUEUE_KEY, JSON.stringify(queue));
      return true;
    } catch (err) {
      try {
        const stripped = queue.map((item) => ({ ...item, photoDataUrl: null }));
        localStorage.setItem(QUEUE_KEY, JSON.stringify(stripped));
        return 'stripped';
      } catch (err2) {
        return false;
      }
    }
  }

  function fieldsFromForm() {
    return {
      inspectionDate: document.getElementById('fs-inspection-date').value,
      areaNo: fieldVal('fs-area-no'),
      plots: JSON.stringify(collectPlotBlocks()),
      healthAssessment: document.getElementById('fs-health-assessment').value,
      molluskRows: JSON.stringify(collectMolluskTableRows()),
      observedThreats: collectSelectedThreats().join(','),
      observedThreatsOther: fieldVal('fs-observed-threats-other'),
      additionalNotes: document.getElementById('fs-additional-notes').value,
      waterClarity: document.getElementById('fs-water-clarity').value,
      waterClarityOther: fieldVal('fs-water-clarity-other'),
      waterColor: document.getElementById('fs-water-color').value,
      waterColorOther: fieldVal('fs-water-color-other'),
      odor: document.getElementById('fs-odor').value,
      odorOther: fieldVal('fs-odor-other'),
      foamDischarge: document.getElementById('fs-foam-discharge').value,
      foamDischargeOther: fieldVal('fs-foam-discharge-other'),
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

  function buildFormData(fields, photoFiles, videoFile) {
    const fd = new FormData();
    Object.entries(fields).forEach(([key, value]) => fd.append(key, value ?? ''));
    (photoFiles || []).forEach((file, i) => {
      if (file) fd.append(`photo${i === 0 ? '' : i + 1}`, file, file.name || 'photo.jpg');
    });
    if (videoFile) fd.append('video', videoFile, videoFile.name || 'video.mp4');
    return fd;
  }

  // "Offline" in the field often isn't clean — still connected to a router
  // with no real internet behind it, a weak signal, etc. navigator.onLine
  // can stay true in exactly that case, and without a timeout the fetch
  // below just hangs until the OS gives up (which can take a very long
  // time), leaving "Submitting…" on screen with no sign anything is wrong.
  // Failing fast here is what actually gets a bad connection into the same
  // offline-queue path a flat-out disconnected one already takes.
  async function sendToServer(fields, photoFiles, videoFile) {
    const controller = new AbortController();
    const timeoutMs = videoFile ? 120000 : 30000;
    const timeoutId = setTimeout(() => controller.abort(), timeoutMs);
    try {
      const res = await fetch(SUBMIT_URL, {
        method: 'POST',
        body: buildFormData(fields, photoFiles, videoFile),
        credentials: 'same-origin',
        signal: controller.signal,
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      if (!data.success) throw new Error(data.error || 'Submission failed');
      return data;
    } finally {
      clearTimeout(timeoutId);
    }
  }

  // Shown through the service worker (not a plain `new Notification()`) since
  // that's the form mobile browsers actually honor reliably, including while
  // the app is just sitting in the background rather than the active tab —
  // exactly the moment a ranger is most likely to regain signal and not be
  // looking at the screen.
  function notifySurveysSent(count) {
    const body = count === 1
      ? 'Your offline survey was successfully submitted.'
      : `${count} offline surveys were successfully submitted.`;

    // Always goes in the app's own notification bell, whether or not OS
    // push permission was ever granted — that one's never blocked by a
    // permission prompt.
    if (typeof window.addLocalRangerNotification === 'function') {
      window.addLocalRangerNotification(body);
    }

    if (typeof Notification === 'undefined' || Notification.permission !== 'granted') return;
    if (navigator.serviceWorker && navigator.serviceWorker.ready) {
      navigator.serviceWorker.ready
        .then((reg) => reg.showNotification('Survey submitted', { body, icon: '../assets/aquaguard-logo.png' }))
        .catch(() => {});
    } else {
      try { new Notification('Survey submitted', { body }); } catch (err) {}
    }
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
        await sendToServer(item.fields, photoFile ? [photoFile] : []);
      } catch (err) {
        remaining.push(item);
      }
    }
    setQueue(remaining);
    const sentCount = queue.length - remaining.length;
    if (sentCount > 0) {
      notifySurveysSent(sentCount);
      if (typeof window.refreshAquaGuardSubmissions === 'function') window.refreshAquaGuardSubmissions();
    }
  }

  window.addEventListener('online', flushQueue);
  flushQueue();

  // Mobile browsers don't always fire the 'online' event promptly — poll
  // every 30 s so a reconnected ranger doesn't have to wait long for their
  // queued survey to send.
  setInterval(() => { if (navigator.onLine && getQueue().length > 0) flushQueue(); }, 30000);

  async function saveFieldSurveyEdit() {
    const body = new FormData();
    body.append('action', 'updateFields');
    body.append('id', editSubmissionId);
    body.append('areaNo', fieldVal('fs-area-no'));
    body.append('plots', JSON.stringify(collectPlotBlocks()));
    body.append('waterNotes', fieldVal('fs-water-notes'));
    body.append('observedThreats', collectSelectedThreats().join(','));
    body.append('observedThreatsOther', fieldVal('fs-observed-threats-other'));
    body.append('additionalNotes', fieldVal('fs-additional-notes'));
    body.append('waterClarity', fieldVal('fs-water-clarity'));
    body.append('waterClarityOther', fieldVal('fs-water-clarity-other'));
    body.append('waterColor', fieldVal('fs-water-color'));
    body.append('waterColorOther', fieldVal('fs-water-color-other'));
    body.append('odor', fieldVal('fs-odor'));
    body.append('odorOther', fieldVal('fs-odor-other'));
    body.append('foamDischarge', fieldVal('fs-foam-discharge'));
    body.append('foamDischargeOther', fieldVal('fs-foam-discharge-other'));
    body.append('salinity', fieldVal('fs-salinity'));
    body.append('ph', fieldVal('fs-ph'));
    body.append('waterTemp', fieldVal('fs-water-temp'));
    body.append('secchiDepth', fieldVal('fs-secchi-depth'));
    body.append('healthAssessment', fieldVal('fs-health-assessment'));
    body.append('molluskRows', JSON.stringify(collectMolluskTableRows()));
    selectedPhotoFiles.forEach((file, i) => body.append(`photo${i === 0 ? '' : i + 1}`, file, file.name || 'photo.jpg'));
    if (selectedVideoFile) body.append('video', selectedVideoFile, selectedVideoFile.name || 'video.mp4');

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

    // fieldsFromForm() reads values straight off the form's own DOM elements
    // — if any single one of them were ever missing (a stale cached page
    // referencing an element a later update renamed, for example),
    // .value on that null would throw synchronously, right here, before
    // the network code below even runs. That's a real bug, independent of
    // being online or offline: nothing downstream could ever catch it,
    // since it never reached the try block at all — leaving the button
    // disabled and "Submitting…" on screen permanently, no matter what
    // your connection was doing. Wrapping this is what actually guarantees
    // the UI can't get stuck this way again, regardless of the cause.
    let fields, photoFiles, videoFile;
    try {
      fields = fieldsFromForm();
      photoFiles = selectedPhotoFiles.slice(0, PHOTO_LIMIT);
      videoFile = selectedVideoFile || null;
    } catch (setupErr) {
      submitBtn.disabled = false;
      msgEl.className = 'field-survey-msg error';
      msgEl.textContent = `Something went wrong reading the form: ${setupErr.message || 'please try again'}.`;
      return;
    }

    const trySend = async () => {
      if (!navigator.onLine) throw new Error('offline');
      return sendToServer(fields, photoFiles, videoFile);
    };

    try {
      await trySend();
      form.reset();
      todayInput.value = todayStr;
      resetSpeciesFields();
      if (zonePreviewEl) zonePreviewEl.hidden = true;
      captureGps();
      resetWizard();
      msgEl.className = 'field-survey-msg';
      msgEl.textContent = '';
      showSuccessBanner('Survey submitted successfully. You can start a new survey below.');
      if (typeof window.refreshAquaGuardSubmissions === 'function') window.refreshAquaGuardSubmissions();
    } catch (err) {
      // No connection (or the request itself failed) — save text fields
      // immediately so the ranger sees confirmation right away, then encode
      // the photo in the background (it can take a few seconds for a large
      // image and there's no reason to make the ranger wait for it).
      const queuedItem = { fields, photoDataUrl: null };

      // Reset the form immediately — don't make the ranger wait while photos encode.
      form.reset();
      todayInput.value = todayStr;
      resetSpeciesFields();
      if (zonePreviewEl) zonePreviewEl.hidden = true;
      captureGps();
      resetWizard();
      submitBtn.disabled = false;

      if (typeof Notification !== 'undefined' && Notification.permission === 'default') {
        Notification.requestPermission().catch(() => {});
      }

      msgEl.className = 'field-survey-msg offline';
      msgEl.textContent = 'No connection. Saved on this device. It will send automatically once you\'re back online.';

      // Encode photo in background — if it succeeds the queued item gets
      // a photo, if not the report still goes through without it.
      (async () => {
        if (photoFiles && photoFiles[0]) {
          try { queuedItem.photoDataUrl = await fileToDataUrl(photoFiles[0]); } catch (_) {}
        }
        const queue = getQueue();
        queue.push(queuedItem);
        const saved = setQueue(queue);
        if (saved === false) {
          msgEl.className = 'field-survey-msg error';
          msgEl.textContent = "Couldn't save offline — storage is full. Connect to the internet to clear the backlog.";
        } else if (saved === 'stripped') {
          msgEl.textContent = 'No connection. Saved on this device (without the photo — storage was nearly full). It will send automatically once you\'re back online.';
        }
      })();
    } finally {
      // submitBtn already re-enabled above in the catch block before async photo work;
      // only re-enable here for the success path where finally runs without the catch.
      if (submitBtn.disabled) submitBtn.disabled = false;
    }
  }

  const confirmSubmitOverlay = document.getElementById('confirmSubmitOverlay');
  const confirmSubmitTitle = document.getElementById('confirmSubmitTitle');
  const confirmSubmitText = document.getElementById('confirmSubmitText');
  const btnCloseConfirmSubmit = document.getElementById('btnCloseConfirmSubmit');
  const btnCancelConfirmSubmit = document.getElementById('btnCancelConfirmSubmit');
  const btnConfirmSubmit = document.getElementById('btnConfirmSubmit');
  const confirmZoneAckRow = document.getElementById('confirmZoneAckRow');
  const confirmZoneAckCheckbox = document.getElementById('confirmZoneAckCheckbox');

  function closeSubmitConfirm() {
    if (confirmSubmitOverlay) confirmSubmitOverlay.classList.remove('open');
  }

  form.addEventListener('submit', (e) => {
    e.preventDefault();

    // The browser's own validation (number step mismatches, required
    // fields, etc.) can't show its bubble on a field sitting on a hidden
    // step — it just silently does nothing. Jumping to that field's step
    // first is what actually lets the browser show the message.
    if (!form.checkValidity()) {
      const invalidEl = form.querySelector(':invalid');
      const stepPanel = invalidEl ? invalidEl.closest('.survey-step') : null;
      const stepNum = stepPanel ? Number(stepPanel.getAttribute('data-step')) : null;
      if (stepNum) showStep(stepNum);
      form.reportValidity();
      return;
    }

    if (!confirmSubmitOverlay) { performSubmit(); return; }

    if (editSubmissionId) {
      if (confirmSubmitTitle) confirmSubmitTitle.textContent = 'Save These Changes?';
      if (confirmSubmitText) confirmSubmitText.textContent = 'This will update the submission already on record.';
      if (btnConfirmSubmit) btnConfirmSubmit.textContent = 'Save Changes';
    } else {
      if (confirmSubmitTitle) confirmSubmitTitle.textContent = 'Submit This Survey?';
      if (confirmSubmitText) confirmSubmitText.textContent = "Make sure everything looks correct. You can still edit it afterward from Submission History.";
      if (btnConfirmSubmit) btnConfirmSubmit.textContent = 'Submit';
    }

    // A GPS reading nowhere near any mapped zone (or one that never resolved
    // at all) used to file just as easily as a reading taken standing inside
    // the zone — the survey still gets counted against whatever "nearest"
    // zone the server found, however far away that really was. This can't
    // block entirely (GPS can be down, or a real zone might not be mapped
    // yet), so instead it requires the ranger to explicitly tick a box
    // acknowledging the distance before Submit does anything.
    const zoneIsFar = !lastResolvedZone
      || (!lastResolvedZone.inside
          && typeof lastResolvedZone.distanceMeters === 'number'
          && lastResolvedZone.distanceMeters > ZONE_FAR_THRESHOLD_M);
    if (confirmZoneAckRow) confirmZoneAckRow.hidden = !zoneIsFar;
    if (confirmZoneAckCheckbox) confirmZoneAckCheckbox.checked = false;
    if (btnConfirmSubmit) btnConfirmSubmit.disabled = zoneIsFar;

    confirmSubmitOverlay.classList.add('open');
  });

  if (confirmZoneAckCheckbox) {
    confirmZoneAckCheckbox.addEventListener('change', () => {
      if (btnConfirmSubmit) btnConfirmSubmit.disabled = !confirmZoneAckCheckbox.checked;
    });
  }

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
