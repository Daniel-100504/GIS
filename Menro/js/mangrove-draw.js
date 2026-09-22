const MANGROVE_AREAS_API = "../API/mangrove-areas.php";
const MANGROVE_COLOR = "#3b82f6";

// Field-mapped shapes match the exact same style as the verified layers
// they resemble (violet for mangrove cover, amber for protected areas).
const MANGROVE_CATEGORY_STYLES = {
  mangrove:        { color: "#8a2be2", weight: 2,   opacity: 0.8,  fillColor: "#8a2be2", fillOpacity: 0.3 },
  protected_area:  { color: "#b8860b", weight: 2.5, opacity: 0.95, fillColor: "#ffd166", fillOpacity: 0.25 },
};
const MANGROVE_CATEGORY_LABELS = {
  mangrove: "Mangrove Forest Area",
  protected_area: "Protected Area",
  watershed_hazard: "Watershed Hazard",
};

// Watershed hazards are colored by severity instead of by category.
const HAZARD_SEVERITY_STYLES = {
  low:      { color: "#4d7c0f", weight: 2, opacity: 1, fillColor: "#84cc16", fillOpacity: 0.3 },
  moderate: { color: "#c2410c", weight: 2, opacity: 1, fillColor: "#fb923c", fillOpacity: 0.3 },
  high:     { color: "#991b1b", weight: 2, opacity: 1, fillColor: "#dc2626", fillOpacity: 0.35 },
};
const HAZARD_SEVERITY_LABELS = { low: "Low", moderate: "Moderate", high: "High" };
const HAZARD_TYPE_LABELS = {
  illegal_cutting: "Illegal Cutting/Logging",
  aquaculture_conversion: "Aquaculture/Fishpond Conversion",
  siltation: "Siltation/Sedimentation",
  pollution: "Pollution/Runoff",
  erosion: "Coastal Erosion",
  land_reclamation: "Land Reclamation/Development",
  illegal_dumping: "Illegal Dumping",
  other: "Other",
};

function mangroveCategoryStyle(category, severity) {
  if (category === "watershed_hazard") {
    return HAZARD_SEVERITY_STYLES[severity] || HAZARD_SEVERITY_STYLES.high;
  }
  return MANGROVE_CATEGORY_STYLES[category] || { color: MANGROVE_COLOR, weight: 2, fillColor: MANGROVE_COLOR, fillOpacity: 0.25 };
}

// Leaflet.Draw gives midpoint (add-a-corner) handles the same icon as real
// corner handles, only fainter (opacity 0.6). Tag them with an extra class so
// CSS can style them smaller/hollow, distinct from the solid corner handles.
if (L.Edit && L.Edit.PolyVerticesEdit) {
  const originalCreateMiddleMarker = L.Edit.PolyVerticesEdit.prototype._createMiddleMarker;
  L.Edit.PolyVerticesEdit.prototype._createMiddleMarker = function (marker1, marker2) {
    originalCreateMiddleMarker.call(this, marker1, marker2);
    const middleMarker = marker1._middleRight;
    if (middleMarker && middleMarker._icon) {
      middleMarker._icon.classList.add("mangrove-midpoint-icon");
    }
  };
}

// "Clear All" (delete-mode's own button for wiping every shape in one click)
// is too risky to keep — one accidental click would delete every field-mapped
// area at once. Dropped from the toolbar's action list, keeping "Cancel" and
// "Save". Lives on L.EditToolbar (the shared edit/delete action-bar builder),
// not on L.EditToolbar.Delete itself — it decides whether to include "Clear
// All" by checking if the active handler has a removeAllLayers method, which
// only the delete handler does.
if (L.EditToolbar) {
  const originalGetActions = L.EditToolbar.prototype.getActions;
  L.EditToolbar.prototype.getActions = function (handler) {
    return originalGetActions.call(this, handler).filter(action => action.text !== L.drawLocal.edit.toolbar.actions.clearAll.text);
  };
}

const mangroveDrawnItems = new L.FeatureGroup().addTo(map);

function mangroveAreaHa(layer) {
  const latlngs = layer.getLatLngs()[0];
  const areaM2 = L.GeometryUtil.geodesicArea(latlngs);
  return (areaM2 / 10000).toFixed(2);
}

function mangroveCentroid(layer) {
  const latlngs = layer.getLatLngs()[0];
  let latSum = 0, lngSum = 0;
  latlngs.forEach(ll => { latSum += ll.lat; lngSum += ll.lng; });
  return { lat: latSum / latlngs.length, lng: lngSum / latlngs.length };
}

// The layer itself doesn't store NDVI — it's tracked on the matching ZONES
// entry (kept in sync by syncMangroveAreaZoneEntry), so this looks it up
// fresh each time rather than caching a value on the layer that could go stale.
function mangroveNdviDisplay(layer) {
  const zoneEntry = ZONES.find(z => z.id === "field-" + layer._mangroveAreaId);
  if (!zoneEntry || zoneEntry.satNdvi === null || zoneEntry.satNdvi === undefined) return "Pending";
  return typeof formatNdvi === "function" ? formatNdvi(zoneEntry.satNdvi) : zoneEntry.satNdvi.toFixed(2);
}

// Mirrors a field-mapped mangrove area into the same ZONES list the
// "Mangrove Zones" panel already renders, so it shows up there with its
// own live NDVI reading, the same way the official zones do.
function syncMangroveAreaZoneEntry(layer) {
  const zoneId = "field-" + layer._mangroveAreaId;
  const centroid = mangroveCentroid(layer);
  let zoneEntry = ZONES.find(z => z.id === zoneId);

  if (!zoneEntry) {
    zoneEntry = {
      id: zoneId,
      name: layer._mangroveAreaName,
      area: parseFloat(mangroveAreaHa(layer)),
      partner: layer._mangroveAreaBarangay || "—",
      ndvi: null,
      satNdvi: null,
      status: "pending",
      lat: centroid.lat,
      lng: centroid.lng,
      // The exact drawn boundary — passed to the NDVI fetch so it samples
      // the real mangrove shape instead of an approximate circle, which can
      // catch nearby water/mud and skew the reading.
      geometry: layer.toGeoJSON().geometry,
      _mangroveAreaLayer: layer,
    };
    ZONES.push(zoneEntry);
  } else {
    zoneEntry.name = layer._mangroveAreaName;
    zoneEntry.area = parseFloat(mangroveAreaHa(layer));
    zoneEntry.partner = layer._mangroveAreaBarangay || "—";
    zoneEntry.lat = centroid.lat;
    zoneEntry.lng = centroid.lng;
    zoneEntry.geometry = layer.toGeoJSON().geometry;
    zoneEntry._mangroveAreaLayer = layer;
  }

  if (typeof renderZoneList === "function") renderZoneList(zoneSearchEl ? zoneSearchEl.value : "");
  if (typeof fetchZoneNdviFromCopernicus === "function") {
    fetchZoneNdviFromCopernicus(zoneEntry).then((value) => {
      zoneEntry.satNdvi = value;
      if (typeof renderZoneList === "function") renderZoneList(zoneSearchEl ? zoneSearchEl.value : "");
    });
  }
}

function removeMangroveAreaZoneEntry(layer) {
  const zoneId = "field-" + layer._mangroveAreaId;
  const index = ZONES.findIndex(z => z.id === zoneId);
  if (index !== -1) ZONES.splice(index, 1);
  if (typeof renderZoneList === "function") renderZoneList(zoneSearchEl ? zoneSearchEl.value : "");
}

const layerFieldMangrovesEl  = document.getElementById("layerFieldMangroves");
const layerWatershedHazardEl = document.getElementById("layerWatershedHazard");

// Watershed hazards share the same drawn-shapes group as mangrove/protected
// areas (so no extra draw/edit/delete toolbar buttons were needed for them),
// but they still need their own visibility toggle. Rather than adding or
// removing a whole Leaflet layer group — which would also affect the OTHER
// category sharing that group — each layer is individually hidden by
// zeroing its own style and disabling its pointer events, leaving group
// membership (and Leaflet.Draw's edit/delete tracking) untouched.
function applyMangroveLayerVisibility(layer) {
  const isHazard = layer._mangroveAreaCategory === "watershed_hazard";
  const toggleEl = isHazard ? layerWatershedHazardEl : layerFieldMangrovesEl;
  const visible = !toggleEl || toggleEl.checked;

  layer.setStyle(visible ? mangroveCategoryStyle(layer._mangroveAreaCategory, layer._mangroveSeverity) : { opacity: 0, fillOpacity: 0 });

  const el = layer.getElement && layer.getElement();
  if (el) el.style.pointerEvents = visible ? "" : "none";
}

function refreshMangroveLayersVisibility() {
  mangroveDrawnItems.eachLayer(applyMangroveLayerVisibility);
}

function bindMangrovePopup(layer, name, barangay, category, hazardType, severity) {
  layer._mangroveAreaName = name;
  layer._mangroveAreaBarangay = barangay;
  layer._mangroveAreaCategory = category;
  layer._mangroveHazardType = hazardType || "";
  layer._mangroveSeverity = severity || "";
  layer.unbindPopup();
  applyMangroveLayerVisibility(layer);

  const isHazard = category === "watershed_hazard";
  const extraRows = isHazard
    ? `<tr><td style="color:#777;padding:2px 6px 2px 0">Hazard Type</td><td style="font-weight:600">${escapeHtml(HAZARD_TYPE_LABELS[hazardType] || "—")}</td></tr>
       <tr><td style="color:#777;padding:2px 6px 2px 0">Severity</td><td style="font-weight:600">${escapeHtml(HAZARD_SEVERITY_LABELS[severity] || "—")}</td></tr>`
    : "";

  // Built as a function, not a fixed string, so the popup always shows
  // whatever NDVI value is current at the moment it's opened — NDVI loads
  // in asynchronously after the shape itself appears on the map, so a fixed
  // string here would keep showing "Pending" forever even once real data arrives.
  layer.bindPopup(() => {
    const ndviRow = !isHazard
      ? `<tr><td style="color:#777;padding:2px 6px 2px 0">NDVI</td><td style="font-weight:600">${mangroveNdviDisplay(layer)}</td></tr>`
      : "";
    return `
    <div style="min-width:190px">
      <div class="popup-title">${escapeHtml(name)}</div>
      <table style="width:100%;font-size:0.78rem;border-collapse:collapse">
        <tr><td style="color:#777;padding:2px 6px 2px 0">Category</td><td style="font-weight:600">${escapeHtml(MANGROVE_CATEGORY_LABELS[category] || "—")}</td></tr>
        ${extraRows}
        <tr><td style="color:#777;padding:2px 6px 2px 0">Barangay</td><td style="font-weight:600">${escapeHtml(barangay || "—")}</td></tr>
        <tr><td style="color:#777;padding:2px 6px 2px 0">Area</td><td style="font-weight:600">${mangroveAreaHa(layer)} ha</td></tr>
        ${ndviRow}
      </table>
    </div>
  `;
  });
  if (!isHazard) syncMangroveAreaZoneEntry(layer);
}

function loadMangroveAreas() {
  fetch(`${MANGROVE_AREAS_API}?action=list`)
    .then(res => res.json())
    .then(data => {
      mangroveDrawnItems.clearLayers();
      (data.features || []).forEach(feature => {
        const layer = L.geoJSON(feature, {
          style: mangroveCategoryStyle(feature.properties.category, feature.properties.severity),
        }).getLayers()[0];
        if (!layer) return;
        layer._mangroveAreaId = feature.properties.id;
        bindMangrovePopup(layer, feature.properties.name, feature.properties.barangay, feature.properties.category, feature.properties.hazard_type, feature.properties.severity);
        mangroveDrawnItems.addLayer(layer);
      });
      // The Dashboard's zone counts are computed from ZONES, which this loop
      // just finished populating — if the Dashboard tab was opened before this
      // fetch resolved (e.g. a slower connection), it rendered with an empty
      // list, so it needs to be told to recompute now that the real data is in.
      // Only if the Dashboard's own markup has actually been loaded at least
      // once, though — renderDashboard() reaches into elements (like the NDVI
      // chart container) that don't exist until that first load happens.
      if (typeof renderDashboard === "function" && typeof dashboardMarkupLoaded !== "undefined" && dashboardMarkupLoaded) {
        renderDashboard();
      }
    })
    .catch(err => console.warn("Could not load field-mapped mangrove areas:", err));
}

loadMangroveAreas();

const mangroveDrawControl = new L.Control.Draw({
  position: "topleft",
  draw: {
    polygon: { allowIntersection: false, showArea: true, guidelineDistance: 3, shapeOptions: { color: MANGROVE_COLOR, weight: 2 } },
    polyline: false,
    rectangle: false,
    circle: false,
    circlemarker: false,
    marker: false,
  },
  edit: {
    featureGroup: mangroveDrawnItems,
  },
});
map.addControl(mangroveDrawControl);

// Add/Update/Delete are consolidated into this one button with a small
// flyout menu, instead of three separate always-visible icons. The real
// Leaflet.Draw toolbar icons (hidden via CSS, see style.css) still do the
// actual work — each menu item just clicks the matching hidden icon, reusing
// its existing, already-tested mode-toggling behavior instead of reaching
// into Leaflet.Draw's internals directly.
const MangroveActionsControl = L.Control.extend({
  options: { position: "topleft" },
  onAdd: function () {
    const container = L.DomUtil.create("div", "leaflet-bar leaflet-control mangrove-actions-control");

    const button = L.DomUtil.create("a", "mangrove-actions-btn", container);
    button.href = "#";
    button.title = "Add, update, or delete a mangrove area";
    button.innerHTML = '<svg viewBox="0 0 24 24" width="22" height="22"><polygon points="12,2 22,9.5 18,21 6,21 2,9.5" fill="currentColor"/></svg>';

    const menu = L.DomUtil.create("div", "mangrove-actions-menu", container);
    menu.hidden = true;

    [
      {
        label: "Add", selector: ".leaflet-draw-draw-polygon",
        icon: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>',
      },
      {
        label: "Update", selector: ".leaflet-draw-edit-edit",
        icon: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>',
      },
      {
        label: "Delete", selector: ".leaflet-draw-edit-remove",
        icon: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>',
      },
    ].forEach(opt => {
      const item = L.DomUtil.create("a", "mangrove-actions-menu-item", menu);
      item.href = "#";
      item.innerHTML = `<span class="mangrove-actions-menu-icon">${opt.icon}</span><span>${opt.label}</span>`;
      L.DomEvent.on(item, "click", function (e) {
        L.DomEvent.preventDefault(e);
        menu.hidden = true;
        const target = document.querySelector(opt.selector);
        if (target) target.click();
      });
    });

    L.DomEvent.disableClickPropagation(container);
    L.DomEvent.on(button, "click", function (e) {
      L.DomEvent.preventDefault(e);
      menu.hidden = !menu.hidden;
    });
    L.DomEvent.on(map, "click", () => { menu.hidden = true; });

    // Highlights the button while any of Add/Update/Delete is currently
    // engaged, so it's clear one of them is active — same idea as the
    // separate Edit Details pencil button already highlighting itself below.
    const drawHandler = mangroveDrawControl._toolbars.draw._modes.polygon.handler;
    const editHandler = mangroveDrawControl._toolbars.edit._modes.edit.handler;
    const removeHandler = mangroveDrawControl._toolbars.edit._modes.remove.handler;
    [drawHandler, editHandler, removeHandler].forEach(handler => {
      handler.on("enabled", () => L.DomUtil.addClass(button, "mangrove-actions-btn-active"));
      handler.on("disabled", () => L.DomUtil.removeClass(button, "mangrove-actions-btn-active"));
    });

    return container;
  },
});
map.addControl(new MangroveActionsControl());

map.on(L.Draw.Event.EDITSTART, () => document.body.classList.add("mangrove-editing-active"));
map.on(L.Draw.Event.EDITSTOP, () => document.body.classList.remove("mangrove-editing-active"));
map.on(L.Draw.Event.DRAWSTART, () => document.body.classList.add("mangrove-editing-active"));
map.on(L.Draw.Event.DRAWSTOP, () => document.body.classList.remove("mangrove-editing-active"));

let mangroveRenamePickActive = false;

function onMangroveRenamePick(e) {
  L.DomEvent.stopPropagation(e);
  setMangroveRenamePickMode(false);
  const layer = e.target;
  if (layer._protectedAreaId != null) {
    startVerifiedEdit("protected_area", layer);
  } else if (layer._mangroveExtentId != null) {
    startVerifiedEdit("mangrove_extent", layer);
  } else {
    startMangroveQuickEdit(layer);
  }
}

function setMangroveRenamePickMode(active) {
  mangroveRenamePickActive = active;
  if (active) {
    L.DomUtil.addClass(mangroveRenameControlLink, "mangrove-rename-active");
    mangroveDrawnItems.eachLayer(layer => layer.on("click", onMangroveRenamePick));
    officialAreasLayer.eachLayer(layer => layer.on("click", onMangroveRenamePick));
    mangroveExtentLayer.eachLayer(layer => layer.on("click", onMangroveRenamePick));
  } else {
    L.DomUtil.removeClass(mangroveRenameControlLink, "mangrove-rename-active");
    mangroveDrawnItems.eachLayer(layer => layer.off("click", onMangroveRenamePick));
    officialAreasLayer.eachLayer(layer => layer.off("click", onMangroveRenamePick));
    mangroveExtentLayer.eachLayer(layer => layer.off("click", onMangroveRenamePick));
  }
}

const MangroveRenameControl = L.Control.extend({
  options: { position: "topleft" },
  onAdd: function () {
    const container = L.DomUtil.create("div", "leaflet-bar leaflet-control");
    const link = L.DomUtil.create("a", "mangrove-rename-btn", container);
    link.href = "#";
    link.title = "Edit a mangrove area's boundary or details";
    link.innerHTML = "&#9998;";
    L.DomEvent.disableClickPropagation(container);
    L.DomEvent.on(link, "click", function (e) {
      L.DomEvent.preventDefault(e);
      setMangroveRenamePickMode(!mangroveRenamePickActive);
    });
    mangroveRenameControlLink = link;
    return container;
  },
});

let mangroveRenameControlLink = null;
map.addControl(new MangroveRenameControl());

if (layerFieldMangrovesEl) layerFieldMangrovesEl.addEventListener("change", refreshMangroveLayersVisibility);
if (layerWatershedHazardEl) layerWatershedHazardEl.addEventListener("change", refreshMangroveLayersVisibility);

let pendingMangroveLayer = null;

const mangroveNameOverlay     = document.getElementById("mangroveNameOverlay");
const mangroveNameModalTitle  = document.getElementById("mangroveNameModalTitle");
const mangroveNameModalText   = document.getElementById("mangroveNameModalText");
const mangroveNameInput       = document.getElementById("mangroveNameInput");
const mangroveBarangaySelect  = document.getElementById("mangroveBarangaySelect");
const mangroveCategorySelect  = document.getElementById("mangroveCategorySelect");
const mangroveHazardFields    = document.getElementById("mangroveHazardFields");
const mangroveHazardTypeSelect = document.getElementById("mangroveHazardTypeSelect");
const mangroveSeveritySelect  = document.getElementById("mangroveSeveritySelect");
const mangroveNameFieldError     = document.getElementById("mangroveNameFieldError");
const mangroveBarangayFieldError = document.getElementById("mangroveBarangayFieldError");
const mangroveCategoryFieldError = document.getElementById("mangroveCategoryFieldError");
const mangroveHazardTypeFieldError = document.getElementById("mangroveHazardTypeFieldError");
const mangroveSeverityFieldError    = document.getElementById("mangroveSeverityFieldError");
const mangroveNameErrorMsg    = document.getElementById("mangroveNameErrorMsg");
const btnCloseMangroveName    = document.getElementById("btnCloseMangroveName");
const btnCancelMangroveName   = document.getElementById("btnCancelMangroveName");
const btnSaveMangroveName     = document.getElementById("btnSaveMangroveName");

function showMangroveNameError(message) {
  if (!mangroveNameErrorMsg) return;
  mangroveNameErrorMsg.textContent = message;
  mangroveNameErrorMsg.hidden = false;
}

function clearMangroveNameError() {
  if (!mangroveNameErrorMsg) return;
  mangroveNameErrorMsg.textContent = "";
  mangroveNameErrorMsg.hidden = true;
}

function setMangroveFieldValid(fieldEl, errorEl) {
  if (fieldEl) fieldEl.classList.remove("mangrove-field-invalid");
  if (errorEl) errorEl.hidden = true;
}

function setMangroveFieldInvalid(fieldEl, errorEl) {
  if (fieldEl) fieldEl.classList.add("mangrove-field-invalid");
  if (errorEl) errorEl.hidden = false;
}

function clearAllMangroveFieldErrors() {
  setMangroveFieldValid(mangroveNameInput, mangroveNameFieldError);
  setMangroveFieldValid(mangroveBarangaySelect, mangroveBarangayFieldError);
  setMangroveFieldValid(mangroveCategorySelect, mangroveCategoryFieldError);
  setMangroveFieldValid(mangroveHazardTypeSelect, mangroveHazardTypeFieldError);
  setMangroveFieldValid(mangroveSeveritySelect, mangroveSeverityFieldError);
}

if (mangroveCategorySelect) {
  mangroveCategorySelect.addEventListener("change", function () {
    if (mangroveHazardFields) mangroveHazardFields.hidden = this.value !== "watershed_hazard";
  });
}

function openMangroveNameModal(layer) {
  pendingMangroveLayer = layer;

  clearAllMangroveFieldErrors();
  clearMangroveNameError();
  if (mangroveNameInput) mangroveNameInput.value = "";
  if (mangroveBarangaySelect) mangroveBarangaySelect.value = "";
  if (mangroveCategorySelect) mangroveCategorySelect.value = "";
  if (mangroveHazardTypeSelect) mangroveHazardTypeSelect.value = "";
  if (mangroveSeveritySelect) mangroveSeveritySelect.value = "";
  if (mangroveHazardFields) mangroveHazardFields.hidden = true;
  if (mangroveNameModalTitle) mangroveNameModalTitle.textContent = "Name this mangrove area";
  if (mangroveNameModalText) mangroveNameModalText.textContent = "Give it a short name so it can be identified later.";
  if (mangroveNameOverlay) mangroveNameOverlay.classList.add("open");
}

function closeMangroveNameModal() {
  if (mangroveNameOverlay) mangroveNameOverlay.classList.remove("open");
  if (pendingMangroveLayer) {
    mangroveDrawnItems.removeLayer(pendingMangroveLayer);
  }
  pendingMangroveLayer = null;
}

if (btnCloseMangroveName) btnCloseMangroveName.addEventListener("click", closeMangroveNameModal);
if (btnCancelMangroveName) btnCancelMangroveName.addEventListener("click", closeMangroveNameModal);

if (btnSaveMangroveName) {
  btnSaveMangroveName.addEventListener("click", () => {
    const name = mangroveNameInput ? mangroveNameInput.value.trim() : "";
    const barangay = mangroveBarangaySelect ? mangroveBarangaySelect.value : "";
    const category = mangroveCategorySelect ? mangroveCategorySelect.value : "";
    const isHazard = category === "watershed_hazard";
    const hazardType = isHazard && mangroveHazardTypeSelect ? mangroveHazardTypeSelect.value : "";
    const severity = isHazard && mangroveSeveritySelect ? mangroveSeveritySelect.value : "";
    if (!pendingMangroveLayer) return;

    let hasError = false;
    if (!name) { setMangroveFieldInvalid(mangroveNameInput, mangroveNameFieldError); hasError = true; }
    else { setMangroveFieldValid(mangroveNameInput, mangroveNameFieldError); }
    if (!barangay) { setMangroveFieldInvalid(mangroveBarangaySelect, mangroveBarangayFieldError); hasError = true; }
    else { setMangroveFieldValid(mangroveBarangaySelect, mangroveBarangayFieldError); }
    if (!category) { setMangroveFieldInvalid(mangroveCategorySelect, mangroveCategoryFieldError); hasError = true; }
    else { setMangroveFieldValid(mangroveCategorySelect, mangroveCategoryFieldError); }
    if (isHazard && !hazardType) { setMangroveFieldInvalid(mangroveHazardTypeSelect, mangroveHazardTypeFieldError); hasError = true; }
    else { setMangroveFieldValid(mangroveHazardTypeSelect, mangroveHazardTypeFieldError); }
    if (isHazard && !severity) { setMangroveFieldInvalid(mangroveSeveritySelect, mangroveSeverityFieldError); hasError = true; }
    else { setMangroveFieldValid(mangroveSeveritySelect, mangroveSeverityFieldError); }
    if (hasError) return;
    clearMangroveNameError();

    const layer = pendingMangroveLayer;
    const geometry = layer.toGeoJSON().geometry;

    const body = new URLSearchParams({
      action: "create",
      name: name,
      barangay: barangay,
      category: category,
      hazard_type: hazardType,
      severity: severity,
      geometry: JSON.stringify(geometry),
    });

    fetch(MANGROVE_AREAS_API, { method: "POST", body })
      .then(res => res.json())
      .then(data => {
        if (data.success) {
          layer._mangroveAreaId = data.id;
          layer.setStyle(mangroveCategoryStyle(category, severity));
          bindMangrovePopup(layer, name, barangay, category, hazardType, severity);
        } else {
          showMangroveNameError(data.error || "Could not save this mangrove area.");
          mangroveDrawnItems.removeLayer(layer);
          return;
        }
        pendingMangroveLayer = null;
        if (mangroveNameOverlay) mangroveNameOverlay.classList.remove("open");
      })
      .catch(() => {
        showMangroveNameError("Could not save this mangrove area. Check your connection and try again.");
        mangroveDrawnItems.removeLayer(layer);
      });
  });
}

// Editing an existing shape's details uses a small floating panel instead
// of the full-screen modal above (that one's only for naming a brand-new
// shape). Reshaping the boundary is handled separately by the "Edit layers"
// toolbar button — this panel only touches name/barangay/category.
let mangroveQuickEditLayer = null;

const mangroveQuickEditOverlay   = document.getElementById("mangroveQuickEditOverlay");
const mangroveQuickEditNameInput = document.getElementById("mangroveQuickEditNameInput");
const mangroveQuickEditBarangaySelect = document.getElementById("mangroveQuickEditBarangaySelect");
const mangroveQuickEditCategorySelect = document.getElementById("mangroveQuickEditCategorySelect");
const mangroveQuickEditHazardFields = document.getElementById("mangroveQuickEditHazardFields");
const mangroveQuickEditHazardTypeSelect = document.getElementById("mangroveQuickEditHazardTypeSelect");
const mangroveQuickEditSeveritySelect   = document.getElementById("mangroveQuickEditSeveritySelect");
const btnCancelMangroveQuickEdit = document.getElementById("btnCancelMangroveQuickEdit");
const btnSaveMangroveQuickEdit   = document.getElementById("btnSaveMangroveQuickEdit");

if (mangroveQuickEditCategorySelect) {
  mangroveQuickEditCategorySelect.addEventListener("change", function () {
    if (mangroveQuickEditHazardFields) mangroveQuickEditHazardFields.hidden = this.value !== "watershed_hazard";
  });
}

function startMangroveQuickEdit(layer) {
  mangroveQuickEditLayer = layer;

  layer.closePopup();

  if (mangroveQuickEditNameInput) {
    mangroveQuickEditNameInput.value = layer._mangroveAreaName || "";
    mangroveQuickEditNameInput.classList.remove("mangrove-field-invalid");
  }
  if (mangroveQuickEditBarangaySelect) {
    mangroveQuickEditBarangaySelect.value = layer._mangroveAreaBarangay || "";
    mangroveQuickEditBarangaySelect.classList.remove("mangrove-field-invalid");
  }
  if (mangroveQuickEditCategorySelect) {
    mangroveQuickEditCategorySelect.value = layer._mangroveAreaCategory || "";
    mangroveQuickEditCategorySelect.classList.remove("mangrove-field-invalid");
  }
  const isHazard = layer._mangroveAreaCategory === "watershed_hazard";
  if (mangroveQuickEditHazardTypeSelect) {
    mangroveQuickEditHazardTypeSelect.value = layer._mangroveHazardType || "";
    mangroveQuickEditHazardTypeSelect.classList.remove("mangrove-field-invalid");
  }
  if (mangroveQuickEditSeveritySelect) {
    mangroveQuickEditSeveritySelect.value = layer._mangroveSeverity || "";
    mangroveQuickEditSeveritySelect.classList.remove("mangrove-field-invalid");
  }
  if (mangroveQuickEditHazardFields) mangroveQuickEditHazardFields.hidden = !isHazard;
  if (mangroveQuickEditOverlay) mangroveQuickEditOverlay.classList.add("open");
}

function stopMangroveQuickEdit() {
  mangroveQuickEditLayer = null;
  if (mangroveQuickEditOverlay) mangroveQuickEditOverlay.classList.remove("open");
}

if (btnCancelMangroveQuickEdit) {
  btnCancelMangroveQuickEdit.addEventListener("click", stopMangroveQuickEdit);
}

if (btnSaveMangroveQuickEdit) {
  btnSaveMangroveQuickEdit.addEventListener("click", () => {
    if (!mangroveQuickEditLayer) return;

    const name = mangroveQuickEditNameInput ? mangroveQuickEditNameInput.value.trim() : "";
    const barangay = mangroveQuickEditBarangaySelect ? mangroveQuickEditBarangaySelect.value : "";
    const category = mangroveQuickEditCategorySelect ? mangroveQuickEditCategorySelect.value : "";
    const isHazard = category === "watershed_hazard";
    const hazardType = isHazard && mangroveQuickEditHazardTypeSelect ? mangroveQuickEditHazardTypeSelect.value : "";
    const severity = isHazard && mangroveQuickEditSeveritySelect ? mangroveQuickEditSeveritySelect.value : "";

    let hasError = false;
    [
      [mangroveQuickEditNameInput, name],
      [mangroveQuickEditBarangaySelect, barangay],
      [mangroveQuickEditCategorySelect, category],
    ].forEach(([el, value]) => {
      if (!el) return;
      el.classList.toggle("mangrove-field-invalid", !value);
      if (!value) hasError = true;
    });
    if (isHazard) {
      [
        [mangroveQuickEditHazardTypeSelect, hazardType],
        [mangroveQuickEditSeveritySelect, severity],
      ].forEach(([el, value]) => {
        if (!el) return;
        el.classList.toggle("mangrove-field-invalid", !value);
        if (!value) hasError = true;
      });
    }
    if (hasError) return;

    const layer = mangroveQuickEditLayer;
    const geometry = layer.toGeoJSON().geometry;
    const body = new URLSearchParams({
      action: "update",
      id: layer._mangroveAreaId,
      name: name,
      barangay: barangay,
      category: category,
      hazard_type: hazardType,
      severity: severity,
      geometry: JSON.stringify(geometry),
    });

    fetch(MANGROVE_AREAS_API, { method: "POST", body })
      .then(res => res.json())
      .then(data => {
        if (data.success) {
          layer.setStyle(mangroveCategoryStyle(category, severity));
          bindMangrovePopup(layer, name, barangay, category, hazardType, severity);
        } else {
          alert(data.error || "Could not save changes to this mangrove area.");
        }
        stopMangroveQuickEdit();
      })
      .catch(() => {
        alert("Could not save changes to this mangrove area.");
        stopMangroveQuickEdit();
      });
  });
}

map.on(L.Draw.Event.CREATED, function (e) {
  const layer = e.layer;
  mangroveDrawnItems.addLayer(layer);
  openMangroveNameModal(layer);
});

map.on(L.Draw.Event.EDITED, function (e) {
  e.layers.eachLayer(function (layer) {
    if (!layer._mangroveAreaId) return;
    const geometry = layer.toGeoJSON().geometry;
    const body = new URLSearchParams({
      action: "update",
      id: layer._mangroveAreaId,
      geometry: JSON.stringify(geometry),
    });
    fetch(MANGROVE_AREAS_API, { method: "POST", body }).catch(() => {});
    if (layer._mangroveAreaCategory !== "watershed_hazard") syncMangroveAreaZoneEntry(layer);
  });
});

let pendingDeleteLayers = [];

const mangroveDeleteOverlay     = document.getElementById("mangroveDeleteOverlay");
const mangroveDeleteModalTitle  = document.getElementById("mangroveDeleteModalTitle");
const btnCloseMangroveDelete    = document.getElementById("btnCloseMangroveDelete");
const btnCancelMangroveDelete   = document.getElementById("btnCancelMangroveDelete");
const btnConfirmMangroveDelete  = document.getElementById("btnConfirmMangroveDelete");

map.on(L.Draw.Event.DELETED, function (e) {
  pendingDeleteLayers = [];
  e.layers.eachLayer(function (layer) {
    if (layer._mangroveAreaId) pendingDeleteLayers.push(layer);
  });
  if (!pendingDeleteLayers.length) return;

  if (mangroveDeleteModalTitle) {
    mangroveDeleteModalTitle.textContent = pendingDeleteLayers.length === 1
      ? "Delete this mangrove area?"
      : `Delete these ${pendingDeleteLayers.length} mangrove areas?`;
  }
  if (mangroveDeleteOverlay) mangroveDeleteOverlay.classList.add("open");
});

function cancelMangroveDelete() {
  pendingDeleteLayers.forEach(layer => mangroveDrawnItems.addLayer(layer));
  pendingDeleteLayers = [];
  if (mangroveDeleteOverlay) mangroveDeleteOverlay.classList.remove("open");
}

if (btnCloseMangroveDelete) btnCloseMangroveDelete.addEventListener("click", cancelMangroveDelete);
if (btnCancelMangroveDelete) btnCancelMangroveDelete.addEventListener("click", cancelMangroveDelete);

if (btnConfirmMangroveDelete) {
  btnConfirmMangroveDelete.addEventListener("click", () => {
    pendingDeleteLayers.forEach(function (layer) {
      const body = new URLSearchParams({
        action: "delete",
        id: layer._mangroveAreaId,
      });
      fetch(MANGROVE_AREAS_API, { method: "POST", body }).catch(() => {});
      removeMangroveAreaZoneEntry(layer);
    });
    pendingDeleteLayers = [];
    if (mangroveDeleteOverlay) mangroveDeleteOverlay.classList.remove("open");
  });
}
