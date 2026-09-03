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
    "https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}",
    {
        attribution: "Tiles © Esri — Source: Esri, Maxar, Earthstar Geographics",
        maxZoom: 19
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
    } else {
        map.removeLayer(satelliteBasemap);
        osmTile.addTo(map);
    }

    if (layersToggleThumbEl) {
        layersToggleThumbEl.classList.toggle("mode-satellite", !satellite);
        layersToggleThumbEl.classList.toggle("mode-map", satellite);
    }
    if (layersToggleLabelEl) layersToggleLabelEl.textContent = satellite ? "Map" : "Satellite";
}

setMapType(false);

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

const cloudCoverageSliderEl = document.getElementById("cloudCoverageSlider");
const cloudCoverageValueEl  = document.getElementById("cloudCoverageValue");
let currentMaxCC = cloudCoverageSliderEl ? parseInt(cloudCoverageSliderEl.value, 10) : 50;

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

const ndviHeatmapLayer = L.tileLayer.wms(`${SENTINEL_PROXY_URL}?mode=wms`, {
    layers: "NDVI",
    format: "image/png",
    transparent: true,
    maxZoom: 19,
    zIndex: 3,
    attribution: "NDVI © Copernicus Sentinel-2 (CDSE)",
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
}

const layerNdviEl = document.getElementById("layerNdvi");
if (layerNdviEl) {
    layerNdviEl.addEventListener("change", function () {
        if (this.checked) {
            ndviHeatmapLayer.addTo(map);
        } else {
            map.removeLayer(ndviHeatmapLayer);
        }
    });
}

const satelliteNdviCache = {};

const refreshCloudCoverage = debounce((value) => {
    sentinelLayer.setParams({ maxcc: value });
    ndviHeatmapLayer.setParams({ maxcc: value });
    if (typeof onCloudCoverageChanged === "function") onCloudCoverageChanged(value);
}, 350);

if (cloudCoverageSliderEl) {
    cloudCoverageSliderEl.addEventListener("input", (e) => {
        currentMaxCC = parseInt(e.target.value, 10);
        if (cloudCoverageValueEl) cloudCoverageValueEl.textContent = `${currentMaxCC}%`;
        refreshCloudCoverage(currentMaxCC);
    });
}

async function fetchZoneNdviFromCopernicus(zone, dateStr) {
    if (zone.lat == null || zone.lng == null) {
        zone.satNdvi = null;
        return null;
    }

    const date = dateStr || todayISO();
    const cacheKey = `${zone.id}|${date}|${currentMaxCC}`;

    if (Object.prototype.hasOwnProperty.call(satelliteNdviCache, cacheKey)) {
        zone.satNdvi = satelliteNdviCache[cacheKey];
        return zone.satNdvi;
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

    try {
        const res = await fetch(`${SENTINEL_PROXY_URL}?${params.toString()}`);
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const data = await res.json();
        zone.satNdvi = (typeof data.ndvi === "number") ? data.ndvi : null;
        satelliteNdviCache[cacheKey] = zone.satNdvi;
        return zone.satNdvi;
    } catch (err) {
        console.warn(`Satellite NDVI fetch failed for ${zone.name}:`, err);
        zone.satNdvi = zone.satNdvi ?? null;
        return null;
    }
}

let satelliteSyncInProgress = false;

async function syncAllZonesFromSatellite(dateStr) {
    if (satelliteSyncInProgress) return;
    satelliteSyncInProgress = true;

    const date = dateStr || sceneDateInputValueOrToday();
    console.log(`Syncing satellite NDVI for ${ZONES.length} zones (cached dates are reused, no extra API calls)...`);

    for (const zone of ZONES) {
        await fetchZoneNdviFromCopernicus(zone, date);
        renderZoneList(zoneSearchEl ? zoneSearchEl.value : "");
    }

    satelliteSyncInProgress = false;
    console.log("Satellite NDVI sync complete.");
}

const markersLayer = L.layerGroup().addTo(map);

function makeIcon(status){
    const color = STATUS_COLOR[status];

    return L.divIcon({
        className: "",
        html: `
        <div style="
        width:14px;
        height:14px;
        background:${color};
        border:2.5px solid #fff;
        border-radius:50%;
        box-shadow:0 0 0 1px rgba(10,49,40,.15), 0 2px 6px rgba(10,49,40,.35);
        "></div>
        `,
        iconSize:[14,14],
        iconAnchor:[7,7]
    });
}

function buildPopup(zone) {
  const hasKobo = zone.lastRanger && zone.lastRanger !== "—";

  const surveyRow = hasKobo ? `
    <tr><td style="color:#777;padding:2px 6px 2px 0">Last Inspection</td><td style="font-weight:600">${escapeHtml(zone.lastDate)}</td></tr>
    <tr><td style="color:#777;padding:2px 6px 2px 0">Threats</td><td style="font-weight:600">${escapeHtml(capitalise(zone.threats))}</td></tr>
  ` : `<tr><td colspan="2" style="color:#999;font-size:0.72rem;padding-top:4px;">No field survey data yet</td></tr>`;

  return `
    <div style="min-width:190px">
      <div class="popup-title">${escapeHtml(zone.name)}</div>
      <table style="width:100%;font-size:0.78rem;border-collapse:collapse">
        <tr><td style="color:#777;padding:2px 6px 2px 0">Status</td><td style="font-weight:600">${capitalise(zone.status)}</td></tr>
        <tr><td style="color:#777;padding:2px 6px 2px 0">NDVI</td><td style="font-weight:600">${zone.ndvi !== null ? zone.ndvi.toFixed(2) : "Pending fetch…"}</td></tr>
        ${zone.satNdvi != null ? `<tr><td style="color:#777;padding:2px 6px 2px 0">Satellite NDVI</td><td style="font-weight:600">${zone.satNdvi.toFixed(2)}</td></tr>` : ""}
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

document.getElementById("layerZones")
.addEventListener("change",function(){

    if(this.checked){

        markersLayer.addTo(map);

    }else{

        markersLayer.remove();

    }

});

const mouseCoordinates=document.getElementById("mouseCoordinates");

map.on("mousemove",(e)=>{

    mouseCoordinates.innerHTML=`
        Lat : ${e.latlng.lat.toFixed(6)}
        <br>
        Lng : ${e.latlng.lng.toFixed(6)}
    `;

});
