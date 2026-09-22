// Rounding a tiny negative NDVI (e.g. -0.001) to 2 decimals can produce the
// string "-0.00" — technically correct but reads like a display bug to anyone
// looking at it, so it's normalized to "0.00" everywhere NDVI is shown.
function formatNdvi(value) {
  const fixed = value.toFixed(2);
  return fixed === "-0.00" ? "0.00" : fixed;
}

function todayISO() {
    const d = new Date();
    const yyyy = d.getFullYear();
    const mm = String(d.getMonth() + 1).padStart(2, "0");
    const dd = String(d.getDate()).padStart(2, "0");
    return `${yyyy}-${mm}-${dd}`;
}

function debounce(fn, wait) {
    let t;
    return function (...args) {
        clearTimeout(t);
        t = setTimeout(() => fn.apply(this, args), wait);
    };
}

function capitalise(str){

    return str.charAt(0).toUpperCase()+str.slice(1);

}

// Calatagan has no barangay boundary polygons in OpenStreetMap, so each zone
// is drawn as a circle sized to match its known hectare area (not a survey boundary).
function circleLatLngs(lat, lng, radiusMeters, sides = 48) {
  const latRad = (lat * Math.PI) / 180;
  const metersPerDegLat = 111320;
  const metersPerDegLng = 111320 * Math.cos(latRad);

  const pts = [];
  for (let i = 0; i < sides; i++) {
    const theta = (2 * Math.PI * i) / sides;
    pts.push([
      lat + (radiusMeters * Math.sin(theta)) / metersPerDegLat,
      lng + (radiusMeters * Math.cos(theta)) / metersPerDegLng,
    ]);
  }
  return pts;
}

const KNOWN_ZONE_AREAS = ZONES.filter(z => z.area !== null).map(z => z.area);
const DEFAULT_ZONE_AREA_HA = KNOWN_ZONE_AREAS.length
  ? KNOWN_ZONE_AREAS.reduce((a, b) => a + b, 0) / KNOWN_ZONE_AREAS.length
  : 50;

function zoneRadiusMeters(zone) {
  const areaHa = zone.area !== null ? zone.area : DEFAULT_ZONE_AREA_HA;
  return Math.sqrt((areaHa * 10000) / Math.PI);
}

const CALATAGAN = [13.8300,120.6300];

const map = L.map("map",{
    center:CALATAGAN,
    zoom:13,
    zoomControl:false
});

L.control.zoom({ position: "bottomright" }).addTo(map);

const osmTile = L.tileLayer(
"https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png",
{
    attribution:"© OpenStreetMap",
    maxZoom:19
});

osmTile.addTo(map);

const satelliteBasemap = L.tileLayer(
    "https://clarity.maptiles.arcgis.com/arcgis/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}",
    {
        attribution: "Tiles © Esri — Source: Esri, Maxar, Earthstar Geographics",
        maxZoom: 19,
        maxNativeZoom: 17
    }
);

// Sharper satellite imagery alone has no text on it, so this free Esri overlay
// adds place names, roads, and boundaries as labels floating on top of it.
const satelliteLabelsOverlay = L.tileLayer(
    "https://server.arcgisonline.com/ArcGIS/rest/services/Reference/World_Boundaries_and_Places/MapServer/tile/{z}/{y}/{x}",
    {
        attribution: "Labels © Esri",
        maxZoom: 19,
        maxNativeZoom: 17,
        zIndex: 5
    }
);

const layersToggleThumbEl = document.getElementById("layersToggleThumb");
const layersToggleLabelEl = document.getElementById("layersToggleLabel");
let satelliteBasemapActive = false;

function setMapType(satellite) {
    satelliteBasemapActive = satellite;

    if (satellite) {
        map.removeLayer(osmTile);
        satelliteBasemap.addTo(map);
        satelliteLabelsOverlay.addTo(map);
    } else {
        map.removeLayer(satelliteBasemap);
        map.removeLayer(satelliteLabelsOverlay);
        osmTile.addTo(map);
    }

    if (layersToggleThumbEl) {
        layersToggleThumbEl.classList.toggle("mode-satellite", !satellite);
        layersToggleThumbEl.classList.toggle("mode-map", satellite);
    }
    if (layersToggleLabelEl) layersToggleLabelEl.textContent = satellite ? "Map" : "Satellite";
}

setMapType(true);

const SENTINEL_PROXY_URL = "../API/sentinel-proxy.php";

function sceneDateInputValueOrToday() {
    const el = document.getElementById("sceneDate");
    return (el && el.value) ? el.value : todayISO();
}

const SENTINEL_WINDOW_DAYS = 10;

function sentinelTimeRangeFor(dateStr) {

    const to = dateStr || todayISO();
    const toDate = new Date(to + "T00:00:00Z");
    const fromDate = new Date(toDate);
    fromDate.setUTCDate(fromDate.getUTCDate() - SENTINEL_WINDOW_DAYS);
    const from = fromDate.toISOString().slice(0, 10);
    return `${from}/${to}`;
}

const currentMaxCC = 50;

const sentinelLayer = L.tileLayer.wms(`${SENTINEL_PROXY_URL}?mode=wms`, {
    layers: "TRUE_COLOR",
    format: "image/png",
    transparent: true,
    maxZoom: 19,
    zIndex: 2,
    attribution: "Imagery © Copernicus Sentinel-2 (CDSE)",
    time: sentinelTimeRangeFor(sceneDateInputValueOrToday()),
    maxcc: currentMaxCC,
});

const layerSentinel2El = document.getElementById("layerSentinel2");
if (layerSentinel2El) {
    layerSentinel2El.addEventListener("change", function () {
        if (this.checked) {
            sentinelLayer.addTo(map);
        } else {
            map.removeLayer(sentinelLayer);
        }
    });
    if (layerSentinel2El.checked) sentinelLayer.addTo(map);
}

// Colorized NDVI map overlay (green = healthy vegetation, red/gray = little
// or none) — a visual companion to the per-zone NDVI numbers already shown
// in the sidebar/dashboard, using the same standard "NDVI" layer Sentinel
// Hub provides out of the box, the same way "TRUE_COLOR" is used above.
const ndviOverlayLayer = L.tileLayer.wms(`${SENTINEL_PROXY_URL}?mode=wms`, {
    layers: "NDVI_CUSTOM",
    format: "image/png",
    transparent: true,
    maxZoom: 19,
    zIndex: 3,
    attribution: "Imagery © Copernicus Sentinel-2 (CDSE)",
    time: sentinelTimeRangeFor(sceneDateInputValueOrToday()),
    maxcc: currentMaxCC,
});

const layerNdviOverlayEl = document.getElementById("layerNdviOverlay");
if (layerNdviOverlayEl) {
    layerNdviOverlayEl.addEventListener("change", function () {
        if (this.checked) {
            ndviOverlayLayer.addTo(map);
        } else {
            map.removeLayer(ndviOverlayLayer);
        }
    });
    if (layerNdviOverlayEl.checked) ndviOverlayLayer.addTo(map);
}

// Real mangrove boundary shapes for Calatagan, clipped from the Global Mangrove
// Watch (10m resolution, 2020) worldwide dataset — a broader, satellite-derived
// view of mangrove cover, separate from the officially-surveyed protected areas below.
// Real mangrove strips are only tens of meters wide, so a thin, semi-transparent
// outline is nearly invisible once zoomed out to see the whole municipality.
// A bold, fully-opaque stroke keeps them visible at any zoom, the way GMW's
// own viewer renders thin coastal features.
const mangroveExtentLayer = L.geoJSON(null, {
    style: {
        color: "#8a2be2",
        weight: 2,
        opacity: 0.8,
        fillColor: "#8a2be2",
        fillOpacity: 0.3,
    },
    onEachFeature: (feature, layer) => {
        layer._mangroveExtentId = feature.properties.id;
        bindMangroveExtentPopup(layer, feature.properties.name);
    },
});

function bindMangroveExtentPopup(layer, name) {
    layer._mangroveExtentName = name;
    layer.unbindPopup();
    layer.bindPopup(`
        <div style="min-width:150px">
          <div class="popup-title">${name ? escapeHtml(name) : "Unnamed mangrove patch"}</div>
          <p style="font-size:0.78rem;color:#777;margin:4px 0 0;">Satellite-detected mangrove cover.</p>
        </div>
    `);
}

fetch("../API/mangrove-extent.php?action=list")
    .then(res => res.json())
    .then(data => mangroveExtentLayer.addData(data))
    .catch(err => console.warn("Could not load mangrove extent layer:", err));

const layerMangroveExtentEl = document.getElementById("layerMangroveExtent");
if (layerMangroveExtentEl) {
    layerMangroveExtentEl.addEventListener("change", function () {
        if (this.checked) {
            mangroveExtentLayer.addTo(map);
        } else {
            map.removeLayer(mangroveExtentLayer);
        }
    });
    if (layerMangroveExtentEl.checked) mangroveExtentLayer.addTo(map);
}

// The 6 legally-designated Mangrove Protected Areas, digitized from MENRO's own
// official survey coordinates (not satellite-derived like the GMW layer above).
// Four use their true surveyed boundary; two (flagged "approximate_circle" in
// the data) only had a handful of rough reference points in the source survey,
// so a hectare-accurate circle is shown for those instead of a wrong-shaped polygon.
const officialAreasLayer = L.geoJSON(null, {
    style: (feature) => ({
        color: "#b8860b",
        weight: 2.5,
        opacity: 0.95,
        fillColor: "#ffd166",
        fillOpacity: 0.25,
        dashArray: feature.properties.source === "approximate_circle" ? "6 4" : null,
    }),
    onEachFeature: (feature, layer) => {
        layer._protectedAreaId = feature.properties.id;
        bindProtectedAreaPopup(layer, feature.properties);
    },
});

function bindProtectedAreaPopup(layer, p) {
    layer._protectedAreaProps = p;
    layer.unbindPopup();
    layer.bindPopup(`
        <div style="min-width:190px">
          <div class="popup-title">${escapeHtml(p.name)}</div>
          <table style="width:100%;font-size:0.78rem;border-collapse:collapse">
            <tr><td style="color:#777;padding:2px 6px 2px 0">Barangay</td><td style="font-weight:600">${escapeHtml(p.barangay || "")}</td></tr>
            <tr><td style="color:#777;padding:2px 6px 2px 0">Area</td><td style="font-weight:600">${p.statedHa} ha</td></tr>
            <tr><td style="color:#777;padding:2px 6px 2px 0">Boundary</td><td style="font-weight:600">${p.source === "approximate_circle" ? "Approximate" : "Official survey"}</td></tr>
          </table>
        </div>
    `);
}

fetch("../API/protected-areas.php?action=list")
    .then(res => res.json())
    .then(data => officialAreasLayer.addData(data))
    .catch(err => console.warn("Could not load official protected areas layer:", err));

const layerProtectedAreasEl = document.getElementById("layerProtectedAreas");
if (layerProtectedAreasEl) {
    layerProtectedAreasEl.addEventListener("change", function () {
        if (this.checked) {
            officialAreasLayer.addTo(map);
        } else {
            map.removeLayer(officialAreasLayer);
        }
    });
    if (layerProtectedAreasEl.checked) officialAreasLayer.addTo(map);
}

const satelliteNdviCache = {};

// Looks up (and caches) a zone's NDVI for one specific date, purely as a
// value — it doesn't decide where that value gets stored. The map's Scene
// Calendar and the Dashboard's own Summary Date each pick their own date and
// must keep their own copy of the result (zone.satNdvi vs zone.dashboardNdvi);
// this function used to write straight into zone.satNdvi regardless of which
// date it was asked for, so whichever of the two synced most recently would
// silently overwrite the other's number even though they were for different dates.
async function fetchZoneNdviFromCopernicus(zone, dateStr) {
    if (zone.lat == null || zone.lng == null) {
        return null;
    }

    const date = dateStr || todayISO();
    const cacheKey = `${zone.id}|${date}|${currentMaxCC}`;

    if (Object.prototype.hasOwnProperty.call(satelliteNdviCache, cacheKey)) {
        return satelliteNdviCache[cacheKey];
    }

    const radius = Math.sqrt(zone.area) * 100;
    const params = new URLSearchParams({
        mode: "ndvi",
        lat: zone.lat,
        lng: zone.lng,
        radius: radius.toFixed(0),
        date,
        maxcc: currentMaxCC,
    });
    // A drawn field-mapped area has its own exact boundary — sampling that
    // real shape instead of the circle above avoids picking up nearby water
    // or mud that a rough circle would include, which can swing the reading
    // a lot for coastal areas. Zones without a drawn shape (e.g. official
    // zones with just a center point) fall back to the circle server-side.
    if (zone.geometry) {
        params.set("geometry", JSON.stringify(zone.geometry));
    }

    try {
        const res = await fetch(`${SENTINEL_PROXY_URL}?${params.toString()}`);
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const data = await res.json();
        const value = (typeof data.ndvi === "number") ? data.ndvi : null;
        satelliteNdviCache[cacheKey] = value;
        return value;
    } catch (err) {
        console.warn(`Satellite NDVI fetch failed for ${zone.name}:`, err);
        return null;
    }
}

let satelliteSyncInProgress = false;

// Sentinel Hub rejects too many requests fired at once ("rate limit exceeded"),
// so zones are fetched a few at a time instead of all at once.
const NDVI_SYNC_BATCH_SIZE = 3;
const NDVI_SYNC_BATCH_DELAY_MS = 400;

function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

async function syncAllZonesFromSatellite(dateStr) {
    if (satelliteSyncInProgress) return;
    satelliteSyncInProgress = true;

    const date = dateStr || sceneDateInputValueOrToday();
    console.log(`Syncing satellite NDVI for ${ZONES.length} zones (cached dates are reused, no extra API calls)...`);

    for (let i = 0; i < ZONES.length; i += NDVI_SYNC_BATCH_SIZE) {
        const batch = ZONES.slice(i, i + NDVI_SYNC_BATCH_SIZE);
        await Promise.all(batch.map(async zone => {
            zone.satNdvi = await fetchZoneNdviFromCopernicus(zone, date);
        }));
        renderZoneList(zoneSearchEl ? zoneSearchEl.value : "");
        if (i + NDVI_SYNC_BATCH_SIZE < ZONES.length) await sleep(NDVI_SYNC_BATCH_DELAY_MS);
    }

    satelliteSyncInProgress = false;
    console.log("Satellite NDVI sync complete.");
}

const markersLayer = L.layerGroup().addTo(map);

function buildPopup(zone) {
  const hasKobo = zone.lastRanger && zone.lastRanger !== "—";

  const surveyRow = hasKobo ? `
    <tr><td style="color:#777;padding:2px 6px 2px 0">Last Inspection</td><td style="font-weight:600">${escapeHtml(zone.lastDate)}</td></tr>
  ` : `<tr><td colspan="2" style="color:#999;font-size:0.72rem;padding-top:4px;">No field survey data yet</td></tr>`;

  return `
    <div style="min-width:190px">
      <div class="popup-title">${escapeHtml(zone.name)}</div>
      <table style="width:100%;font-size:0.78rem;border-collapse:collapse">
        <tr><td style="color:#777;padding:2px 6px 2px 0">Status</td><td style="font-weight:600">${(typeof STATUS_DISPLAY_LABELS !== "undefined" && STATUS_DISPLAY_LABELS[zone.status]) || capitalise(zone.status)}</td></tr>
        <tr><td style="color:#777;padding:2px 6px 2px 0">NDVI</td><td style="font-weight:600">${zone.satNdvi != null ? formatNdvi(zone.satNdvi) : "Pending fetch…"}</td></tr>
        <tr><td style="color:#777;padding:2px 6px 2px 0">Area</td><td style="font-weight:600">${zone.area !== null ? zone.area + " ha" : "—"}</td></tr>
        ${surveyRow}
      </table>
    </div>
  `;
}

const mapLayersControl = document.getElementById("mapLayersControl");
const layersToggleBtn  = document.getElementById("layersToggleBtn");

if (layersToggleBtn && mapLayersControl) {
    layersToggleBtn.addEventListener("click", function (e) {
        e.stopPropagation();
        setMapType(!satelliteBasemapActive);
    });

    let layersHoverCloseTimer = null;

    mapLayersControl.addEventListener("mouseenter", function () {
        clearTimeout(layersHoverCloseTimer);
        mapLayersControl.classList.add("open");
        layersToggleBtn.setAttribute("aria-expanded", "true");
    });

    mapLayersControl.addEventListener("mouseleave", function () {
        layersHoverCloseTimer = setTimeout(function () {
            mapLayersControl.classList.remove("open");
            layersToggleBtn.setAttribute("aria-expanded", "false");
        }, 150);
    });

    document.addEventListener("click", function (e) {
        if (!mapLayersControl.contains(e.target)) {
            mapLayersControl.classList.remove("open");
            layersToggleBtn.setAttribute("aria-expanded", "false");
        }
    });

    mapLayersControl.querySelector(".layers-popup")
        .addEventListener("click", function (e) {
            e.stopPropagation();
        });
}

