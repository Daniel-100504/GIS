const KOBO_API_URL  = "kobo-proxy.php";

const BARANGAY_TO_ZONE = {
  "bagong_silang":  "bagong-silang",
  "baha":           "baha",
  "balibago":       "balibago",
  "balitoc":        "balitoc",
  "bucal":          "bucal-encarnacion",
  "carretunan":     "carretunan",
  "gulod":          "gulod",
  "quilitisan":     "quilitisan",
  "sambungan":      "sambungan",
  "sta__ana":       "sta-ana",
  "talibayog":      "talibayog",
  "talisay":        "talisay",
  "tanagan":        "tanagan",
  "poblacion_1":    "poblacion-1",
  "poblacion_2":    "poblacion-2",
  "poblacion_3":    "poblacion-3",
  "poblacion_4":    "poblacion-4",
};

function deriveStatus(sub) {
  const cover   = parseFloat(sub["Estimated_Canopy_Cover_"]) || 0;
  const threats = sub["Observed_Threats"] || "none_observed";

  const hasBadThreat = ["illegal_cutting", "debris___waste_dumping"].includes(threats);

  if (cover >= 60 && !hasBadThreat)  return "healthy";
  if (cover >= 30 || !hasBadThreat)  return "moderate";
  return "degraded";
}

function coverToNDVI(cover) {

  const pct = Math.min(Math.max(parseFloat(cover) || 0, 0), 100);
  return +(0.10 + (pct / 100) * 0.75).toFixed(2);
}

const DEFAULT_SUBMISSIONS = [
  { Barangay: "balibago",      Inspection_Date: "2026-06-02", Ranger_Name: "Marco Villanueva",   Transect_Number: "T-01", Estimated_Canopy_Cover_: "72", Species_Name: "Rhizophora mucronata", Tree_Count: "340", Observed_Threats: "none_observed",        Water_Color: "clear",           Nearby_Aquafarm_Activity: "none",     Additional_Notes: "Dense stand along the tidal creek, healthy regrowth on the eastern edge.", GPS: "13.922447 120.619998 0 5" },
  { Barangay: "talisay",       Inspection_Date: "2026-06-02", Ranger_Name: "Elena Ramos",         Transect_Number: "T-02", Estimated_Canopy_Cover_: "45", Species_Name: "Avicennia marina",     Tree_Count: "210", Observed_Threats: "debris___waste_dumping", Water_Color: "murky",           Nearby_Aquafarm_Activity: "minimal",  Additional_Notes: "Plastic debris accumulating near the outflow channel.", GPS: "13.8650 120.6260 0 5" },
  { Barangay: "carretunan",    Inspection_Date: "2026-06-05", Ranger_Name: "Marco Villanueva",   Transect_Number: "T-03", Estimated_Canopy_Cover_: "38", Species_Name: "Rhizophora apiculata", Tree_Count: "180", Observed_Threats: "illegal_cutting",       Water_Color: "murky",           Nearby_Aquafarm_Activity: "moderate", Additional_Notes: "Fresh stumps spotted along the northern boundary; flagged for follow-up patrol.", GPS: "13.8570 120.6230 0 5" },
  { Barangay: "quilitisan",    Inspection_Date: "2026-06-05", Ranger_Name: "Jonas Del Rosario",   Transect_Number: "T-04", Estimated_Canopy_Cover_: "65", Species_Name: "Sonneratia alba",      Tree_Count: "290", Observed_Threats: "none_observed",        Water_Color: "clear",           Nearby_Aquafarm_Activity: "none",     Additional_Notes: "PALITAKAN volunteers assisted with the transect count.", GPS: "13.8500 120.6210 0 5" },
  { Barangay: "gulod",         Inspection_Date: "2026-06-09", Ranger_Name: "Elena Ramos",         Transect_Number: "T-05", Estimated_Canopy_Cover_: "52", Species_Name: "Rhizophora mucronata", Tree_Count: "150", Observed_Threats: "erosion",              Water_Color: "slightly_turbid", Nearby_Aquafarm_Activity: "minimal",  Additional_Notes: "Visible shoreline erosion near the barangay boundary marker.", GPS: "13.8450 120.6200 0 5" },
  { Barangay: "balitoc",       Inspection_Date: "2026-06-09", Ranger_Name: "Jonas Del Rosario",   Transect_Number: "T-06", Estimated_Canopy_Cover_: "81", Species_Name: "Bruguiera gymnorrhiza", Tree_Count: "410", Observed_Threats: "none_observed",       Water_Color: "clear",           Nearby_Aquafarm_Activity: "none",     Additional_Notes: "Largest zone in the municipality; canopy continues to thicken year over year.", GPS: "13.8390 120.6210 0 5" },
  { Barangay: "poblacion_1",   Inspection_Date: "2026-06-14", Ranger_Name: "Marco Villanueva",   Transect_Number: "T-07", Estimated_Canopy_Cover_: "28", Species_Name: "Avicennia marina",     Tree_Count: "95",  Observed_Threats: "debris___waste_dumping", Water_Color: "murky",           Nearby_Aquafarm_Activity: "moderate", Additional_Notes: "Household waste dumping observed near the market-side access road.", GPS: "13.8340 120.6220 0 5" },
  { Barangay: "poblacion_2",   Inspection_Date: "2026-06-14", Ranger_Name: "Elena Ramos",         Transect_Number: "T-08", Estimated_Canopy_Cover_: "22", Species_Name: "Rhizophora apiculata", Tree_Count: "60",  Observed_Threats: "illegal_cutting",       Water_Color: "murky",           Nearby_Aquafarm_Activity: "heavy",    Additional_Notes: "Smallest and most degraded zone; recommend priority replanting.", GPS: "13.8300 120.6230 0 5" },
  { Barangay: "poblacion_3",   Inspection_Date: "2026-06-18", Ranger_Name: "Jonas Del Rosario",   Transect_Number: "T-09", Estimated_Canopy_Cover_: "58", Species_Name: "Sonneratia alba",      Tree_Count: "230", Observed_Threats: "none_observed",        Water_Color: "clear",           Nearby_Aquafarm_Activity: "none",     Additional_Notes: "Stable condition, consistent with last quarter's survey.", GPS: "13.8260 120.6240 0 5" },
  { Barangay: "poblacion_4",   Inspection_Date: "2026-06-18", Ranger_Name: "Marco Villanueva",   Transect_Number: "T-10", Estimated_Canopy_Cover_: "66", Species_Name: "Rhizophora mucronata", Tree_Count: "275", Observed_Threats: "none_observed",        Water_Color: "clear",           Nearby_Aquafarm_Activity: "minimal",  Additional_Notes: "Good recovery since the 2025 replanting drive.", GPS: "13.76865 120.662093 0 5" },
  { Barangay: "tanagan",       Inspection_Date: "2026-06-23", Ranger_Name: "Elena Ramos",         Transect_Number: "T-11", Estimated_Canopy_Cover_: "74", Species_Name: "Bruguiera gymnorrhiza", Tree_Count: "500", Observed_Threats: "none_observed",       Water_Color: "clear",           Nearby_Aquafarm_Activity: "none",     Additional_Notes: "Largest tree count recorded this season.", GPS: "13.8160 120.6270 0 5" },
  { Barangay: "sta__ana",      Inspection_Date: "2026-06-23", Ranger_Name: "Jonas Del Rosario",   Transect_Number: "T-12", Estimated_Canopy_Cover_: "47", Species_Name: "Rhizophora apiculata", Tree_Count: "260", Observed_Threats: "erosion",              Water_Color: "slightly_turbid", Nearby_Aquafarm_Activity: "minimal",  Additional_Notes: "SAPSAP partner requested support for sandbag revetment.", GPS: "13.8080 120.6300 0 5" },
  { Barangay: "bagong_silang",  Inspection_Date: "2026-06-27", Ranger_Name: "Marco Villanueva",  Transect_Number: "T-13", Estimated_Canopy_Cover_: "35", Species_Name: "Avicennia marina",     Tree_Count: "90",  Observed_Threats: "debris___waste_dumping", Water_Color: "murky",           Nearby_Aquafarm_Activity: "moderate", Additional_Notes: "SAMMABABA members conducted a cleanup the following week.", GPS: "13.7970 120.6360 0 5" },
  { Barangay: "bucal",         Inspection_Date: "2026-06-27", Ranger_Name: "Elena Ramos",         Transect_Number: "T-14", Estimated_Canopy_Cover_: "69", Species_Name: "Rhizophora mucronata", Tree_Count: "320", Observed_Threats: "none_observed",        Water_Color: "clear",           Nearby_Aquafarm_Activity: "none",     Additional_Notes: "SMME co-managed zone; no issues flagged.", GPS: "13.8380 120.6560 0 5" },
  { Barangay: "baha",          Inspection_Date: "2026-07-02", Ranger_Name: "Jonas Del Rosario",   Transect_Number: "T-15", Estimated_Canopy_Cover_: "77", Species_Name: "Sonneratia alba",      Tree_Count: "610", Observed_Threats: "none_observed",        Water_Color: "clear",           Nearby_Aquafarm_Activity: "none",     Additional_Notes: "Widest zone by area; canopy cover holding steady.", GPS: "13.8480 120.6620 0 5" },
  { Barangay: "talibayog",     Inspection_Date: "2026-07-02", Ranger_Name: "Marco Villanueva",   Transect_Number: "T-16", Estimated_Canopy_Cover_: "41", Species_Name: "Rhizophora apiculata", Tree_Count: "200", Observed_Threats: "illegal_cutting",       Water_Color: "murky",           Nearby_Aquafarm_Activity: "heavy",    Additional_Notes: "Cutting linked to nearby fish-pen expansion; referred to MENRO enforcement.", GPS: "13.8560 120.6590 0 5" },
  { Barangay: "sambungan",     Inspection_Date: "2026-07-07", Ranger_Name: "Elena Ramos",         Transect_Number: "T-17", Estimated_Canopy_Cover_: "55", Species_Name: "Bruguiera gymnorrhiza", Tree_Count: "140", Observed_Threats: "none_observed",       Water_Color: "slightly_turbid", Nearby_Aquafarm_Activity: "minimal",  Additional_Notes: "Minor turbidity, likely from recent rainfall runoff.", GPS: "13.8310 120.6490 0 5" },
  { Barangay: "balibago",      Inspection_Date: "2026-07-07", Ranger_Name: "Jonas Del Rosario",   Transect_Number: "T-01", Estimated_Canopy_Cover_: "75", Species_Name: "Rhizophora mucronata", Tree_Count: "352", Observed_Threats: "none_observed",        Water_Color: "clear",           Nearby_Aquafarm_Activity: "none",     Additional_Notes: "Follow-up visit confirms continued healthy growth.", GPS: "13.922447 120.619998 0 5" },
  { Barangay: "talisay",       Inspection_Date: "2026-07-10", Ranger_Name: "Marco Villanueva",   Transect_Number: "T-02", Estimated_Canopy_Cover_: "50", Species_Name: "Avicennia marina",     Tree_Count: "224", Observed_Threats: "none_observed",        Water_Color: "slightly_turbid", Nearby_Aquafarm_Activity: "minimal",  Additional_Notes: "Debris cleared since last visit; water clarity improving.", GPS: "13.8650 120.6260 0 5" },
  { Barangay: "carretunan",    Inspection_Date: "2026-07-10", Ranger_Name: "Elena Ramos",         Transect_Number: "T-03", Estimated_Canopy_Cover_: "44", Species_Name: "Rhizophora apiculata", Tree_Count: "196", Observed_Threats: "none_observed",        Water_Color: "slightly_turbid", Nearby_Aquafarm_Activity: "moderate", Additional_Notes: "No further cutting observed; barangay tanod now patrolling the area.", GPS: "13.8570 120.6230 0 5" },
];

let ALL_SUBMISSIONS = DEFAULT_SUBMISSIONS.slice();

async function fetchKoboData() {
  try {
    const res = await fetch(KOBO_API_URL);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json();
    ALL_SUBMISSIONS = data.results || [];
    setConnectionStatus(true);
    return ALL_SUBMISSIONS;
  } catch (err) {
    console.warn("KoboToolbox fetch failed — showing placeholder data until the proxy is reachable.", err);
    ALL_SUBMISSIONS = DEFAULT_SUBMISSIONS.slice();
    setConnectionStatus(false);
    return null;
  }
}

const connectionStatusEl     = document.getElementById("connectionStatus");
const connectionStatusIconEl = document.getElementById("connectionStatusIcon");
const connectionStatusTextEl = document.getElementById("connectionStatusText");

const ICON_ONLINE = `
  <path d="M5 12.5a10 10 0 0 1 14 0"/>
  <path d="M8.5 16a5 5 0 0 1 7 0"/>
  <line x1="12" y1="19.5" x2="12.01" y2="19.5"/>
`;

const ICON_OFFLINE = `
  <path d="M2 2l20 20"/>
  <path d="M8.5 16a5 5 0 0 1 4.4-1.4"/>
  <path d="M5 12.5a10 10 0 0 1 3.5-2.3"/>
  <path d="M12.5 5.03A10 10 0 0 1 19 8.5"/>
  <line x1="12" y1="19.5" x2="12.01" y2="19.5"/>
`;

let isOnline = null;

function setConnectionStatus(online) {
  if (!connectionStatusEl || online === isOnline) return;
  isOnline = online;

  connectionStatusEl.classList.remove("online", "offline", "checking");
  connectionStatusEl.classList.add(online ? "online" : "offline");
  connectionStatusEl.title = online
    ? "Connected — live data from KoboToolbox"
    : "Offline — showing last available data";

  if (connectionStatusIconEl) connectionStatusIconEl.innerHTML = online ? ICON_ONLINE : ICON_OFFLINE;
  if (connectionStatusTextEl) connectionStatusTextEl.textContent = online ? "Online" : "Offline";
}

setConnectionStatus(navigator.onLine);

window.addEventListener("online",  () => setConnectionStatus(true));
window.addEventListener("offline", () => setConnectionStatus(false));

async function pingBackend() {
  try {
    const res = await fetch(KOBO_API_URL, { method: "HEAD", cache: "no-store" });
    setConnectionStatus(res.ok);
  } catch (err) {
    setConnectionStatus(false);
  }
}

setInterval(pingBackend, 30 * 1000);

let SATELLITE_BASELINE = {};

function captureSatelliteBaseline() {
  ZONES.forEach(zone => {
    SATELLITE_BASELINE[zone.id] = { ndvi: zone.ndvi, status: zone.status };
  });
}

function resetZonesToBaseline() {
  ZONES.forEach(zone => {
    const base = SATELLITE_BASELINE[zone.id];
    zone.ndvi = base ? base.ndvi : null;
    zone.status = base ? base.status : "pending";
    zone.lastRanger   = "—";
    zone.lastDate     = "—";
    zone.transect     = "—";
    zone.canopyCover  = "—";
    zone.speciesName  = "—";
    zone.treeCount    = "—";
    zone.threats      = "—";
    zone.waterColor   = "—";
    zone.aquafarmNear = "—";
    zone.notes        = "—";
  });
}

function submissionsUpToDate(dateStr) {
  if (!dateStr) return ALL_SUBMISSIONS;
  return ALL_SUBMISSIONS.filter(sub => sub["Inspection_Date"] && sub["Inspection_Date"] <= dateStr);
}

function mergeKoboIntoZones(submissions) {
  const byZone = {};

  submissions.forEach(sub => {
    const barangay = sub["Barangay"] || "";
    const zoneId   = BARANGAY_TO_ZONE[barangay];
    if (!zoneId) return;

    const existing = byZone[zoneId];
    const subDate  = sub["Inspection_Date"] || "";

    if (!existing || subDate > (existing["Inspection_Date"] || "")) {
      byZone[zoneId] = sub;
    }
  });

  ZONES.forEach(zone => {
    const sub = byZone[zone.id];
    if (!sub) return;

    const gps = sub["GPS"];
    if (gps) {
      const parts = gps.split(" ").map(Number);
      if (!isNaN(parts[0]) && !isNaN(parts[1])) {
        zone.lat = parts[0];
        zone.lng = parts[1];
      }
    }

    if (sub["Estimated_Canopy_Cover_"]) {
      zone.ndvi = coverToNDVI(sub["Estimated_Canopy_Cover_"]);
    }

    zone.status = deriveStatus(sub);

    zone.lastRanger    = sub["Ranger_Name"]      || zone.lastRanger    || "—";
    zone.lastDate      = sub["Inspection_Date"]  || zone.lastDate      || "—";
    zone.transect      = sub["Transect_Number"]  || zone.transect      || "—";
    zone.canopyCover   = sub["Estimated_Canopy_Cover_"] ? sub["Estimated_Canopy_Cover_"] + "%" : "—";
    zone.speciesName   = sub["Species_Name"]     || zone.speciesName   || "—";
    zone.treeCount     = sub["Tree_Count"]       || zone.treeCount     || "—";
    zone.threats       = sub["Observed_Threats"] ? sub["Observed_Threats"].replace(/_/g," ") : "—";
    zone.waterColor    = sub["Water_Color"]      ? sub["Water_Color"].replace(/_/g," ")    : "—";
    zone.aquafarmNear  = sub["Nearby_Aquafarm_Activity"] ? sub["Nearby_Aquafarm_Activity"].replace(/_/g," ") : "—";
    zone.notes         = sub["Additional_Notes"] || zone.notes         || "—";
  });

  console.log(`KoboToolbox: merged ${Object.keys(byZone).length} zone(s) from ${submissions.length} submission(s).`);
}

const ZONES = [
  {
    id: "balibago",
    name: "Balibago",
    area: 70.78,
    partner: "—",
    ndvi: null,
    status: "pending",
    lat: 13.922447,
    lng: 120.619998,
  },
  {
    id: "talisay",
    name: "Talisay",
    area: 21.31,
    partner: "—",
    ndvi: null,
    status: "pending",
    lat: 13.8650,
    lng: 120.6260,
  },
  {
    id: "carretunan",
    name: "Carretunan",
    area: 38.72,
    partner: "—",
    ndvi: null,
    status: "pending",
    lat: 13.8570,
    lng: 120.6230,
  },
  {
    id: "quilitisan",
    name: "Quilitisan",
    area: 25.20,
    partner: "PALITAKAN",
    ndvi: null,
    status: "pending",
    lat: 13.8500,
    lng: 120.6210,
  },
  {
    id: "gulod",
    name: "Gulod",
    area: 35.32,
    partner: "—",
    ndvi: null,
    status: "pending",
    lat: 13.8450,
    lng: 120.6200,
  },
  {
    id: "balitoc",
    name: "Balitoc",
    area: 126.88,
    partner: "—",
    ndvi: null,
    status: "pending",
    lat: 13.8390,
    lng: 120.6210,
  },
  {
    id: "poblacion-1",
    name: "Poblacion 1",
    area: 12.16,
    partner: "—",
    ndvi: null,
    status: "pending",
    lat: 13.8340,
    lng: 120.6220,
  },
  {
    id: "poblacion-2",
    name: "Poblacion 2",
    area: 1.90,
    partner: "—",
    ndvi: null,
    status: "pending",
    lat: 13.8300,
    lng: 120.6230,
  },
  {
    id: "poblacion-3",
    name: "Poblacion 3",
    area: 35.37,
    partner: "—",
    ndvi: null,
    status: "pending",
    lat: 13.8260,
    lng: 120.6240,
  },
  {
    id: "poblacion-4",
    name: "Poblacion 4",
    area: 17.49,
    partner: "—",
    ndvi: null,
    status: "pending",
    lat: 13.76865,
    lng: 120.662093,
  },
  {
    id: "tanagan",
    name: "Tanagan",
    area: 142.39,
    partner: "—",
    ndvi: null,
    status: "pending",
    lat: 13.8160,
    lng: 120.6270,
  },
  {
    id: "sta-ana",
    name: "Sta. Ana",
    area: 75.01,
    partner: "SAPSAP",
    ndvi: null,
    status: "pending",
    lat: 13.8080,
    lng: 120.6300,
  },
  {
    id: "bagong-silang",
    name: "Bagong Silang",
    area: 10.85,
    partner: "SAMMABABA",
    ndvi: null,
    status: "pending",
    lat: 13.7970,
    lng: 120.6360,
  },
  {
    id: "bucal-encarnacion",
    name: "Bucal and Encarnacion",
    area: 71.79,
    partner: "SMME",
    ndvi: null,
    status: "pending",
    lat: 13.8380,
    lng: 120.6560,
  },
  {
    id: "baha",
    name: "Baha",
    area: 227.19,
    partner: "—",
    ndvi: null,
    status: "pending",
    lat: 13.8480,
    lng: 120.6620,
  },
  {
    id: "talibayog",
    name: "Talibayog",
    area: 242.54,
    partner: "—",
    ndvi: null,
    status: "pending",
    lat: 13.8560,
    lng: 120.6590,
  },
  {
    id: "sambungan",
    name: "Sambungan",
    area: 12.13,
    partner: "—",
    ndvi: null,
    status: "pending",
    lat: 13.8310,
    lng: 120.6490,
  }
];

const STATUS_COLOR = {
  healthy: "#1c7d61",
  moderate: "#c98a2c",
  degraded: "#c1473a",
  pending: "#93a29b"
};

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

const SENTINEL_PROXY_URL = "sentinel-proxy.php";

function sceneDateInputValueOrToday() {
    const el = document.getElementById("sceneDate");
    return (el && el.value) ? el.value : todayISO();
}

const SENTINEL_WINDOW_DAYS = 10; // Middle ground: tight enough that picking a date still
                                  // reflects a genuinely nearby scene, wide enough that a
                                  // cloudy pass doesn't leave you with no imagery at all.
                                  // (Window length barely affects Sentinel Hub processing
                                  // cost — what actually burns credits is repeat requests,
                                  // handled below via debouncing + per-date caching.)

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
    attribution: "Imagery \u00a9 Copernicus Sentinel-2 (CDSE)",
    time: sentinelTimeRangeFor(sceneDateInputValueOrToday()),
    maxcc: currentMaxCC,
});

const ndviHeatmapLayer = L.tileLayer.wms(`${SENTINEL_PROXY_URL}?mode=wms`, {
    layers: "NDVI",
    format: "image/png",
    transparent: true,
    maxZoom: 19,
    zIndex: 3,
    attribution: "NDVI \u00a9 Copernicus Sentinel-2 (CDSE)",
    time: sentinelTimeRangeFor(sceneDateInputValueOrToday()),
    maxcc: currentMaxCC,
});

const imageryRefreshBadgeEl = document.getElementById("imageryRefreshBadge");
let sentinelLoading = false;
let ndviLoading = false;

function updateImageryRefreshBadge() {
    if (!imageryRefreshBadgeEl) return;
    imageryRefreshBadgeEl.hidden = !(sentinelLoading || ndviLoading);
}

sentinelLayer.on("loading", () => { sentinelLoading = true; updateImageryRefreshBadge(); });
sentinelLayer.on("load",    () => { sentinelLoading = false; updateImageryRefreshBadge(); });
ndviHeatmapLayer.on("loading", () => { ndviLoading = true; updateImageryRefreshBadge(); });
ndviHeatmapLayer.on("load",    () => { ndviLoading = false; updateImageryRefreshBadge(); });

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

const satelliteNdviCache = {}; // key: `${zoneId}|${dateStr}|${maxcc}` -> ndvi value (or null)

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

const btnSyncSatelliteInlineEl = document.getElementById("btnSyncSatelliteInline");

async function syncAllZonesFromSatellite(dateStr) {
    if (satelliteSyncInProgress) return;
    satelliteSyncInProgress = true;

    if (btnSyncSatelliteInlineEl) btnSyncSatelliteInlineEl.classList.add("syncing");

    const date = dateStr || sceneDateInputValueOrToday();
    console.log(`Syncing satellite NDVI for ${ZONES.length} zones (cached dates are reused, no extra API calls)...`);

    for (const zone of ZONES) {
        await fetchZoneNdviFromCopernicus(zone, date);
        renderZoneList(zoneSearchEl ? zoneSearchEl.value : "");
    }

    if (btnSyncSatelliteInlineEl) btnSyncSatelliteInlineEl.classList.remove("syncing");

    satelliteSyncInProgress = false;
    console.log("Satellite NDVI sync complete.");
}

if (btnSyncSatelliteInlineEl) {
    btnSyncSatelliteInlineEl.addEventListener("click", () => {
        syncAllZonesFromSatellite(sceneDateInputValueOrToday());
    });
}

const markersLayer = L.layerGroup().addTo(map);
const ndviLayer = L.layerGroup();

function makeIcon(status){

    return L.divIcon({

        className:"",

        html:`
        <div style="
        width:18px;
        height:18px;
        background:${STATUS_COLOR[status]};
        border:3px solid white;
        border-radius:50%;
        box-shadow:0 2px 8px rgba(0,0,0,.35);
        "></div>
        `,

        iconSize:[18,18],
        iconAnchor:[9,9]

    });

}

ZONES.forEach(zone => {

    const color = STATUS_COLOR[zone.status];

    const radius = Math.sqrt(zone.area) * 100;

    L.circle([zone.lat, zone.lng], {

        radius: radius,
        color: color,
        fillColor: color,
        fillOpacity: 0.35,
        weight: 1

    })

    .bindPopup(() => buildPopup(zone))

    .addTo(ndviLayer);

});

function escapeHtml(value) {
  if (value === null || value === undefined) return "—";
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
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
        <tr><td style="color:#777;padding:2px 6px 2px 0">NDVI</td><td style="font-weight:600">${zone.ndvi !== null ? zone.ndvi.toFixed(2) : "Pending fetch\u2026"}</td></tr>
        ${zone.satNdvi != null ? `<tr><td style="color:#777;padding:2px 6px 2px 0">Satellite NDVI</td><td style="font-weight:600">${zone.satNdvi.toFixed(2)}</td></tr>` : ""}
        <tr><td style="color:#777;padding:2px 6px 2px 0">Area</td><td style="font-weight:600">${zone.area} ha</td></tr>
        ${surveyRow}
      </table>
    </div>
  `;
}

const markers={};

ZONES.forEach(zone=>{

    const marker=L.marker(
        [zone.lat,zone.lng],
        {
            icon:makeIcon(zone.status)
        }
    );

    marker.bindPopup(() => buildPopup(zone));

    marker.on("click",()=>selectZone(zone));

    marker.addTo(markersLayer);

    markers[zone.id]=marker;

});

const zoneListEl = document.getElementById("zoneList");
const zoneSearchEl = document.getElementById("zoneSearch");
const zoneSearchHintEl = document.getElementById("zoneSearchHint");
const zoneSearchClearEl = document.getElementById("zoneSearchClear");
const zoneStatusFilterEl = document.getElementById("zoneStatusFilter");
const zoneSortEl = document.getElementById("zoneSort");

function updateZoneSearchHint(query, matchCount) {

    if (!zoneSearchHintEl) return;

    if (!query) {
        zoneSearchHintEl.textContent = `Type a barangay name to filter (${ZONES.length} zones)`;
    } else if (matchCount === 0) {
        zoneSearchHintEl.textContent = `No zones match "${query}"`;
    } else {
        zoneSearchHintEl.textContent = `${matchCount} of ${ZONES.length} zones match "${query}"`;
    }

}

function sortZones(zones, sortKey) {

    const sorted = zones.slice();

    switch (sortKey) {
        case "name-desc":
            sorted.sort((a, b) => b.name.localeCompare(a.name));
            break;
        case "ndvi-desc":
            sorted.sort((a, b) => (b.ndvi ?? -1) - (a.ndvi ?? -1));
            break;
        case "ndvi-asc":
            sorted.sort((a, b) => (a.ndvi ?? Infinity) - (b.ndvi ?? Infinity));
            break;
        case "area-desc":
            sorted.sort((a, b) => b.area - a.area);
            break;
        case "area-asc":
            sorted.sort((a, b) => a.area - b.area);
            break;
        case "name-asc":
        default:
            sorted.sort((a, b) => a.name.localeCompare(b.name));
            break;
    }

    return sorted;
}

function renderZoneList(filterText = "") {

    const query = filterText.trim().toLowerCase();
    const statusFilter = zoneStatusFilterEl ? zoneStatusFilterEl.value : "all";
    const sortKey = zoneSortEl ? zoneSortEl.value : "name-asc";

    zoneListEl.innerHTML = "";

    let filtered = ZONES.filter(zone =>
        zone.name.toLowerCase().includes(query)
    );

    if (statusFilter !== "all") {
        filtered = filtered.filter(zone => zone.status === statusFilter);
    }

    filtered = sortZones(filtered, sortKey);

    updateZoneSearchHint(filterText.trim(), filtered.length);

    if (filtered.length === 0) {

        zoneListEl.innerHTML = `
            <div style="padding:10px 4px;font-size:0.78rem;color:#888;">
                No zones match "${filterText}"
            </div>
        `;

        return;

    }

    filtered.forEach(zone=>{

        const item=document.createElement("div");

        item.className="zone-item";

        item.dataset.id=zone.id;

        item.innerHTML=`

            <div class="zone-item-top">

                <span class="zone-name">
                    ${zone.name}
                </span>

                <span class="zone-chip ${zone.status}">
                    ${capitalise(zone.status)}
                </span>

            </div>

            <div class="zone-meta">
                ${zone.area} ha • NDVI ${zone.ndvi !== null ? zone.ndvi.toFixed(2) : "Pending"}
            </div>

        `;

        item.onclick=()=>{

            selectZone(zone);

            map.setView(
                [zone.lat,zone.lng],
                15,
                {animate:true}
            );

            markers[zone.id].openPopup();

        };

        zoneListEl.appendChild(item);

    });

}

renderZoneList();

if (zoneSearchEl) {
    zoneSearchEl.addEventListener("input", () => {
        renderZoneList(zoneSearchEl.value);
        if (zoneSearchClearEl) {
            zoneSearchClearEl.hidden = zoneSearchEl.value.length === 0;
        }
    });
}

if (zoneSearchClearEl) {
    zoneSearchClearEl.addEventListener("click", () => {
        zoneSearchEl.value = "";
        zoneSearchClearEl.hidden = true;
        renderZoneList("");
        zoneSearchEl.focus();
    });
}

if (zoneStatusFilterEl) {
    zoneStatusFilterEl.addEventListener("change", () => {
        renderZoneList(zoneSearchEl ? zoneSearchEl.value : "");
    });
}

if (zoneSortEl) {
    zoneSortEl.addEventListener("change", () => {
        renderZoneList(zoneSearchEl ? zoneSearchEl.value : "");
    });
}

function selectZone(zone){

    document.querySelectorAll(".zone-item").forEach(item=>{

        item.style.background=
            item.dataset.id===zone.id
            ? "rgba(46,125,50,.12)"
            : "";

    });

}

let sceneSummary = { meanNDVI: "0.00", zonesSurveyed: 0, totalZones: 0, healthyCount: 0, atRiskCount: 0 };

function updateSummary(){

    const withNdvi = ZONES.filter(z => z.ndvi !== null);

    const mean =
        withNdvi.length > 0
            ? withNdvi.reduce((sum,z)=>sum+z.ndvi,0)/withNdvi.length
            : 0;

    const healthy=
        ZONES.filter(z=>z.status==="healthy").length;

    const risk=
        ZONES.filter(z=>z.status==="degraded").length;

    const surveyed=
        ZONES.filter(z=>z.lastRanger && z.lastRanger !== "—").length;

    sceneSummary = {
        meanNDVI: mean.toFixed(2),
        zonesSurveyed: surveyed,
        totalZones: ZONES.length,
        healthyCount: healthy,
        atRiskCount: risk
    };

    updateNDVIBar();

}

function updateNDVIBar(){
  const total = ZONES.length;
  const groups = [
    { label: "Healthy",  status: "healthy",  color: "#1c7d61" },
    { label: "Moderate", status: "moderate", color: "#c98a2c" },
    { label: "Degraded", status: "degraded", color: "#c1473a" },
  ];

  const container = document.getElementById("ndviRows");
  if (!container) return;
  container.innerHTML = "";

  groups.forEach(g => {
    const count = ZONES.filter(z => z.status === g.status).length;
    const pct   = total > 0 ? ((count / total) * 100).toFixed(1) : 0;

    container.innerHTML += `
      <div style="display:flex;align-items:center;gap:10px;margin-bottom:10px;">
        <span style="font-size:0.7rem;color:var(--panel-muted);width:68px;flex-shrink:0;text-align:right;">${g.label}</span>
        <div style="flex:1;background:rgba(255,255,255,0.08);border-radius:4px;height:16px;overflow:hidden;">
          <div style="width:${pct}%;height:100%;background:${g.color};border-radius:4px;transition:width 0.4s ease;"></div>
        </div>
        <span style="font-size:0.7rem;color:var(--panel-muted);width:44px;flex-shrink:0;">${count} zone${count !== 1 ? "s" : ""}</span>
      </div>
    `;
  });
}

updateSummary();

const mapLayersControl = document.getElementById("mapLayersControl");
const layersToggleBtn  = document.getElementById("layersToggleBtn");

if (layersToggleBtn && mapLayersControl) {
    layersToggleBtn.addEventListener("click", function (e) {
        e.stopPropagation();
        const isOpen = mapLayersControl.classList.toggle("open");
        layersToggleBtn.setAttribute("aria-expanded", isOpen ? "true" : "false");
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

const sceneDate = document.getElementById("sceneDate");
let sceneDateManuallySet = false;
let dataReady = false;

function rebuildMapLayers() {
  markersLayer.clearLayers();
  ndviLayer.clearLayers();

  ZONES.forEach(zone => {
    const color  = STATUS_COLOR[zone.status];
    const radius = Math.sqrt(zone.area) * 100;
    L.circle([zone.lat, zone.lng], {
      radius, color, fillColor: color, fillOpacity: 0.35, weight: 1
    }).bindPopup(() => buildPopup(zone)).addTo(ndviLayer);

    const marker = L.marker([zone.lat, zone.lng], { icon: makeIcon(zone.status) });
    marker.bindPopup(() => buildPopup(zone));
    marker.on("click", () => selectZone(zone));
    marker.addTo(markersLayer);
    markers[zone.id] = marker;
  });

  renderZoneList(zoneSearchEl ? zoneSearchEl.value : "");
}

function applyDataForDate(dateStr) {
  resetZonesToBaseline();

  const submissions = submissionsUpToDate(dateStr);
  if (submissions.length > 0) mergeKoboIntoZones(submissions);

  rebuildMapLayers();
  updateSummary();
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

const refreshSentinelLayers = debounce((dateStr) => {
    sentinelLayer.setParams({ time: sentinelTimeRangeFor(dateStr) });
    ndviHeatmapLayer.setParams({ time: sentinelTimeRangeFor(dateStr) });
}, 450);

function syncSceneDateToToday() {
    const today = todayISO();
    sceneDate.max = today;

    if (sceneDateManuallySet) return;

    if (sceneDate.value !== today) {
        sceneDate.value = today;
        refreshSentinelLayers(today);
        if (dataReady) applyDataForDate(today);
    }
}

sceneDate.addEventListener("change",(e)=>{

    sceneDateManuallySet = true;
    refreshSentinelLayers(e.target.value);
    if (dataReady) applyDataForDate(e.target.value);
    if (typeof setDashboardDateFromScene === "function") setDashboardDateFromScene(e.target.value);

});

// ---- Scene availability calendar --------------------------------------
// Highlights which days in the visible month actually have a Sentinel-2
// scene at-or-under the chosen cloud coverage, so picking a date isn't a
// guessing game. One catalog search per (month, cloud%) covers the whole
// month — catalog search is metadata-only, so this doesn't touch the
// processing-credit budget the imagery/NDVI fetches do.

const calGridEl       = document.getElementById("calGrid");
const calMonthSelectEl = document.getElementById("calMonthSelect");
const calYearSelectEl  = document.getElementById("calYearSelect");
const calMonthPrevEl  = document.getElementById("calMonthPrev");
const calMonthNextEl  = document.getElementById("calMonthNext");

const MONTH_NAMES = ["January","February","March","April","May","June","July","August","September","October","November","December"];

const availableDatesCache = {}; // key: `${yyyy}-${mm}|${maxcc}` -> { "yyyy-mm-dd": cloudCoverPct }

function initialCalendarDate() {
    const val = sceneDate.value || todayISO();
    const [y, m] = val.split("-").map(Number);
    return { year: y, month: m - 1 };
}

let calendarView = initialCalendarDate();

function populateCalMonthYearSelects() {
    if (calMonthSelectEl && calMonthSelectEl.options.length === 0) {
        MONTH_NAMES.forEach((name, i) => {
            const opt = document.createElement("option");
            opt.value = i;
            opt.textContent = name;
            calMonthSelectEl.appendChild(opt);
        });
    }

    if (calYearSelectEl && calYearSelectEl.options.length === 0) {
        const currentYear = new Date().getFullYear();
        // A reasonable jump range: a handful of years back through the present year.
        for (let y = currentYear - 6; y <= currentYear; y++) {
            const opt = document.createElement("option");
            opt.value = y;
            opt.textContent = y;
            calYearSelectEl.appendChild(opt);
        }
    }
}

populateCalMonthYearSelects();

if (calMonthSelectEl) {
    calMonthSelectEl.addEventListener("change", () => {
        calendarView.month = parseInt(calMonthSelectEl.value, 10);
        renderSceneCalendar();
    });
}

if (calYearSelectEl) {
    calYearSelectEl.addEventListener("change", () => {
        calendarView.year = parseInt(calYearSelectEl.value, 10);
        renderSceneCalendar();
    });
}

async function fetchAvailableDatesForMonth(year, month, maxcc) {
    const ym = `${year}-${String(month + 1).padStart(2, "0")}`;
    const cacheKey = `${ym}|${maxcc}`;

    if (availableDatesCache[cacheKey]) return availableDatesCache[cacheKey];

    try {
        const res = await fetch(`${SENTINEL_PROXY_URL}?mode=catalog&month=${ym}&maxcc=${maxcc}`);
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const data = await res.json();
        availableDatesCache[cacheKey] = data.dates || {};
        return availableDatesCache[cacheKey];
    } catch (err) {
        console.warn("Could not load scene availability for", ym, err);
        return {};
    }
}

async function renderSceneCalendar() {
    if (!calGridEl) return;

    const { year, month } = calendarView;

    // Make sure the year dropdown can show whatever year we're actually viewing,
    // even if it falls outside the default pre-populated range.
    if (calYearSelectEl && !Array.from(calYearSelectEl.options).some(o => parseInt(o.value, 10) === year)) {
        const opt = document.createElement("option");
        opt.value = year;
        opt.textContent = year;
        calYearSelectEl.appendChild(opt);
    }

    if (calMonthSelectEl) calMonthSelectEl.value = month;
    if (calYearSelectEl) calYearSelectEl.value = year;

    const firstWeekday  = new Date(year, month, 1).getDay();
    const daysInMonth   = new Date(year, month + 1, 0).getDate();
    const today         = todayISO();
    const selected      = sceneDate.value || today;
    const maxDate       = sceneDate.max || today;

    // Render a quick skeleton first so the grid isn't blank while the
    // catalog request is in flight (visible instantly, availability fills in after).
    let cells = "";
    for (let i = 0; i < firstWeekday; i++) {
        cells += `<div class="cal-cell empty"></div>`;
    }
    for (let d = 1; d <= daysInMonth; d++) {
        const dateStr = `${year}-${String(month + 1).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
        const isOutOfRange = dateStr > maxDate;
        const isToday      = dateStr === today;
        const isSelected   = dateStr === selected;

        const classes = ["cal-cell"];
        if (isOutOfRange) classes.push("out-of-range");
        if (isToday)      classes.push("today");
        if (isSelected)   classes.push("selected");

        cells += `<div class="${classes.join(" ")}" data-date="${dateStr}">${d}</div>`;
    }
    calGridEl.innerHTML = cells;
    bindCalendarCellClicks();

    const available = await fetchAvailableDatesForMonth(year, month, currentMaxCC);

    // Only apply if we're still looking at the month we fetched for
    // (user may have flipped months again while this was in flight).
    if (calendarView.year !== year || calendarView.month !== month) return;

    Object.keys(available).forEach(dateStr => {
        const cell = calGridEl.querySelector(`.cal-cell[data-date="${dateStr}"]`);
        if (cell && !cell.classList.contains("out-of-range")) {
            cell.classList.add("available");
            const cc = available[dateStr];
            if (cc !== null && cc !== undefined) {
                cell.title = `Cloud cover: ${Math.round(cc)}%`;
            }
        }
    });
}

function bindCalendarCellClicks() {
    if (!calGridEl) return;
    calGridEl.querySelectorAll(".cal-cell:not(.empty):not(.out-of-range)").forEach(cell => {
        cell.addEventListener("click", () => {
            const dateStr = cell.dataset.date;
            if (!dateStr) return;
            sceneDate.value = dateStr;
            sceneDate.dispatchEvent(new Event("change"));
        });
    });
}

if (calMonthPrevEl) {
    calMonthPrevEl.addEventListener("click", () => {
        calendarView.month -= 1;
        if (calendarView.month < 0) { calendarView.month = 11; calendarView.year -= 1; }
        renderSceneCalendar();
    });
}

if (calMonthNextEl) {
    calMonthNextEl.addEventListener("click", () => {
        calendarView.month += 1;
        if (calendarView.month > 11) { calendarView.month = 0; calendarView.year += 1; }
        renderSceneCalendar();
    });
}

// Keep the calendar in sync whenever the scene date changes from any source
// (arrows, manual typing, or clicking a day) — jump to that month if needed.
sceneDate.addEventListener("change", () => {
    const [y, m] = sceneDate.value.split("-").map(Number);
    if (y !== calendarView.year || (m - 1) !== calendarView.month) {
        calendarView = { year: y, month: m - 1 };
    }
    renderSceneCalendar();
});

function onCloudCoverageChanged() {
    renderSceneCalendar();
}

renderSceneCalendar();

syncSceneDateToToday();

setInterval(syncSceneDateToToday, 60 * 1000);

const mouseCoordinates=document.getElementById("mouseCoordinates");

map.on("mousemove",(e)=>{

    mouseCoordinates.innerHTML=`
        Lat : ${e.latlng.lat.toFixed(6)}
        <br>
        Lng : ${e.latlng.lng.toFixed(6)}
    `;

});

function handleLogout() {

    const confirmLogout = confirm(
        "Are you sure you want to sign out?"
    );

    if (confirmLogout) {

        localStorage.removeItem("menro_remembered_user");

        window.location.href = "../Login/Login.html";

    }


}

const btnLogout = document.getElementById("btnLogout");
if (btnLogout) btnLogout.addEventListener("click", handleLogout);

const rightPanel=document.querySelector(".right-panel");
const rightResizer=document.querySelector(".right-resizer");

let dragRight=false;

rightResizer.onmousedown=()=>{

    dragRight=true;

    document.body.style.cursor="col-resize";

};

document.addEventListener("mousemove",(e)=>{

    if(!dragRight) return;

    const width=window.innerWidth-e.clientX;

    if(width>180 && width<420){

        rightPanel.style.width=width+"px";

    }

});

document.addEventListener("mouseup",()=>{

    dragRight=false;

    document.body.style.cursor="default";

});

function capitalise(str){

    return str.charAt(0).toUpperCase()+str.slice(1);

}

async function initWithKobo() {
  captureSatelliteBaseline();

  await fetchKoboData();

  dataReady = true;
  applyDataForDate(sceneDate.value);

  selectZone(ZONES[0]);
}

initWithKobo();

const guideOverlay  = document.getElementById("guideOverlay");
const btnHelp       = document.getElementById("btnHelp");
const btnCloseGuide = document.getElementById("btnCloseGuide");

function openGuide() {
  guideOverlay.classList.add("open");
}

function closeGuide() {
  guideOverlay.classList.remove("open");
}

if (btnHelp) btnHelp.addEventListener("click", openGuide);
if (btnCloseGuide) btnCloseGuide.addEventListener("click", closeGuide);
if (guideOverlay) {
  guideOverlay.addEventListener("click", (e) => {
    if (e.target === guideOverlay) closeGuide();
  });
}

document.addEventListener("keydown", (e) => {
  if (e.key === "Escape") {
    const surveyDetailOpen = document.getElementById("surveyDetailOverlay")?.classList.contains("open");
    if (surveyDetailOpen && typeof closeSurveyDetail === "function") {
      closeSurveyDetail();
      return;
    }
    closeDashboard();
    closeGuide();
    closeSideMenu();
  }
});

const sideMenu         = document.getElementById("sideMenu");
const sideMenuBackdrop = document.getElementById("sideMenuBackdrop");
const btnMapMenu       = document.getElementById("btnMapMenu");
const btnCloseSideMenu = document.getElementById("btnCloseSideMenu");

function openSideMenu() {
  sideMenu.classList.add("open");
  sideMenuBackdrop.classList.add("open");
}

function closeSideMenu() {
  sideMenu.classList.remove("open");
  sideMenuBackdrop.classList.remove("open");
}

if (btnMapMenu)       btnMapMenu.addEventListener("click", openSideMenu);
if (btnCloseSideMenu) btnCloseSideMenu.addEventListener("click", closeSideMenu);
if (sideMenuBackdrop) sideMenuBackdrop.addEventListener("click", closeSideMenu);

const menuMap        = document.getElementById("menuMap");
const menuDashboard = document.getElementById("menuDashboard");
const menuGuide     = document.getElementById("menuGuide");
const menuExport    = document.getElementById("menuExport");
const menuSignOut   = document.getElementById("menuSignOut");

if (menuMap) {
  menuMap.addEventListener("click", () => {
    closeSideMenu();
    closeDashboard();
  });
}

if (menuDashboard) {
  menuDashboard.addEventListener("click", () => {
    closeSideMenu();
    openDashboard();
  });
}

if (menuGuide) {
  menuGuide.addEventListener("click", () => {
    closeSideMenu();
    openGuide();
  });
}

if (menuExport) {
  menuExport.addEventListener("click", () => {
    closeSideMenu();
    exportPDF(); 
  });
}

if (menuSignOut) {
  menuSignOut.addEventListener("click", () => {
    closeSideMenu();
    handleLogout();
  });
}

if (!sessionStorage.getItem("aquaguard_guide_shown")) {
  openGuide();
  sessionStorage.setItem("aquaguard_guide_shown", "1");
}