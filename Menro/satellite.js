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

/* ---------- Placeholder field data ----------
   Stand-in KoboToolbox submissions so the dashboard and map render
   real-looking numbers during development. Replace/remove once the
   live proxy (kobo-proxy.php) is reachable — DEFAULT_SUBMISSIONS is
   only used as a fallback when that fetch fails. */
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

/* ---------- Connection Status Badge ----------
   Shows whether the app can actually reach its backend (the KoboToolbox
   proxy), not just whether the OS reports a network interface — a laptop
   can be "connected" to Wi-Fi with no real route to the server. We seed
   the initial state from navigator.onLine for an instant first paint,
   then correct it as soon as a real request (fetchKoboData, or the
   lightweight poll below) succeeds or fails. */

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

let isOnline = null; // avoid redundant DOM writes

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

// Instant first paint from the browser's own signal.
setConnectionStatus(navigator.onLine);

// Browser-level network changes (Wi-Fi drop, airplane mode, etc.)
window.addEventListener("online",  () => setConnectionStatus(true));
window.addEventListener("offline", () => setConnectionStatus(false));

// Periodic real-world check against the backend, since navigator.onLine
// can say "online" even when the server itself is unreachable.
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

const satTile = L.tileLayer(
"https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}",
{
    attribution:"Tiles © Esri",
    maxZoom:19
});

satTile.addTo(map);

/* ---------- Copernicus Data Space Ecosystem (Sentinel Hub) ----------
   Both the true-color imagery and the NDVI heatmap tiles are fetched
   through sentinel-proxy.php so the OAuth client ID/secret never touch
   the browser. See sentinel-proxy.php for the one-time account setup
   (OAuth client + Sentinel Hub configuration/instance). */

const SENTINEL_PROXY_URL = "sentinel-proxy.php";

function sceneDateInputValueOrToday() {
    const el = document.getElementById("sceneDate");
    return (el && el.value) ? el.value : todayISO();
}

function sentinelTimeRangeFor(dateStr) {

    const to = dateStr || todayISO();
    const toDate = new Date(to + "T00:00:00Z");
    const fromDate = new Date(toDate);
    fromDate.setUTCDate(fromDate.getUTCDate() - 15);
    const from = fromDate.toISOString().slice(0, 10);
    return `${from}/${to}`;
}

const sentinelLayer = L.tileLayer.wms(`${SENTINEL_PROXY_URL}?mode=wms`, {
    layers: "TRUE_COLOR",
    format: "image/png",
    transparent: true,
    maxZoom: 19,
    attribution: "Imagery \u00a9 Copernicus Sentinel-2 (CDSE)",
    time: sentinelTimeRangeFor(sceneDateInputValueOrToday()),
});

const ndviHeatmapLayer = L.tileLayer.wms(`${SENTINEL_PROXY_URL}?mode=wms`, {
    layers: "NDVI",
    format: "image/png",
    transparent: true,
    maxZoom: 19,
    attribution: "NDVI \u00a9 Copernicus Sentinel-2 (CDSE)",
    time: sentinelTimeRangeFor(sceneDateInputValueOrToday()),
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

/* ---------- Per-zone NDVI from the Statistics API ----------
   Computes a real mean NDVI for the ~circular footprint already used
   for each zone's map marker (Math.sqrt(area) * 100 meters), over the
   15 days leading up to the selected scene date. Stored on
   zone.satNdvi (kept separate from the Kobo-derived zone.ndvi so field
   data and satellite data can be compared side by side). */

async function fetchZoneNdviFromCopernicus(zone, dateStr) {
    const radius = Math.sqrt(zone.area) * 100; // meters, matches the map circle
    const params = new URLSearchParams({
        mode: "ndvi",
        lat: zone.lat,
        lng: zone.lng,
        radius: radius.toFixed(0),
        date: dateStr || todayISO(),
    });

    try {
        const res = await fetch(`${SENTINEL_PROXY_URL}?${params.toString()}`);
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const data = await res.json();
        zone.satNdvi = (typeof data.ndvi === "number") ? data.ndvi : null;
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
    console.log(`Syncing satellite NDVI for ${ZONES.length} zones (this can take a little while)...`);

    // Sequential, not parallel — the Statistics API is rate-limited per
    // account, and 17 zones fired at once is an easy way to get throttled.
    for (const zone of ZONES) {
        await fetchZoneNdviFromCopernicus(zone, date);
        renderZoneList(zoneSearchEl ? zoneSearchEl.value : "");
    }

    satelliteSyncInProgress = false;
    console.log("Satellite NDVI sync complete.");
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

/* ---------- Popup Builder ----------
   Kept intentionally short — just what a ranger or MENRO officer needs
   at a glance. The full field survey record (transect, species, tree
   count, water color, aquafarm activity, notes, etc.) lives in the
   Export Field Survey Report PDF instead of cluttering the map popup. */
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

/* ---------- Markers ---------- */

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

/* -------- CONTINUE WITH PART 2 -------- */
/* ---------- Zone List ---------- */

const zoneListEl = document.getElementById("zoneList");
const zoneSearchEl = document.getElementById("zoneSearch");
const zoneSearchHintEl = document.getElementById("zoneSearchHint");
const zoneSearchClearEl = document.getElementById("zoneSearchClear");

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

function renderZoneList(filterText = "") {

    const query = filterText.trim().toLowerCase();

    zoneListEl.innerHTML = "";

    const filtered = ZONES.filter(zone =>
        zone.name.toLowerCase().includes(query)
    );

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

/* ---------- Zone Detail ---------- */

function selectZone(zone){

    document.querySelectorAll(".zone-item").forEach(item=>{

        item.style.background=
            item.dataset.id===zone.id
            ? "rgba(46,125,50,.12)"
            : "";

    });

}

/* ---------- Scene Summary ----------
   No longer rendered in the UI (left panel removed), but the figures are
   kept on `sceneSummary` since export.js reads them for the PDF cards.
   Every figure here is derived from real zone/survey data — nothing is
   a placeholder, so the PDF always matches what the Dashboard shows. */

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


/* ---------- NDVI Distribution Bar ---------- */
// Healthy:  NDVI >= 0.60
// Moderate: NDVI >= 0.40 and < 0.60
// Degraded: NDVI <  0.40

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

/* ---------- Layer Toggles ---------- */

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

document.getElementById("layerSatellite")
.addEventListener("change",function(){

    if(this.checked){

        map.removeLayer(osmTile);

        satTile.addTo(map);

    }else{

        map.removeLayer(satTile);

        osmTile.addTo(map);

    }

});

document.getElementById("layerZones")
.addEventListener("change",function(){

    if(this.checked){

        markersLayer.addTo(map);

    }else{

        markersLayer.remove();

    }

});

/* ---------- Scene Date ---------- */

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

// Keeps the date input synced to "today" so it doesn't go stale if the
// dashboard is left open overnight. Stops touching the field once the
// user has manually picked a date, so it never yanks them out of a
// historical scene they're actively reviewing.
function syncSceneDateToToday() {
    const today = todayISO();
    sceneDate.max = today; // no future scene dates

    if (sceneDateManuallySet) return;

    if (sceneDate.value !== today) {
        sceneDate.value = today;
        sentinelLayer.setParams({ time: sentinelTimeRangeFor(today) });
        ndviHeatmapLayer.setParams({ time: sentinelTimeRangeFor(today) });
        if (dataReady) applyDataForDate(today);
    }
}

sceneDate.addEventListener("change",(e)=>{

    sceneDateManuallySet = true;
    sentinelLayer.setParams({ time: sentinelTimeRangeFor(e.target.value) });
    ndviHeatmapLayer.setParams({ time: sentinelTimeRangeFor(e.target.value) });
    if (dataReady) applyDataForDate(e.target.value);

});

/* ---------- Scene Date Arrows ---------- */

function stepSceneDate(days) {
    const base = sceneDate.value ? new Date(sceneDate.value + "T00:00:00") : new Date();
    base.setDate(base.getDate() + days);

    const yyyy = base.getFullYear();
    const mm   = String(base.getMonth() + 1).padStart(2, "0");
    const dd   = String(base.getDate()).padStart(2, "0");
    const next = `${yyyy}-${mm}-${dd}`;

    if (sceneDate.max && next > sceneDate.max) return;
    if (sceneDate.min && next < sceneDate.min) return;

    sceneDate.value = next;
    sceneDate.dispatchEvent(new Event("change"));
}

const sceneDatePrevEl = document.getElementById("sceneDatePrev");
const sceneDateNextEl = document.getElementById("sceneDateNext");

function updateSceneDateArrowState() {
    if (sceneDateNextEl) {
        sceneDateNextEl.disabled = !!(sceneDate.max && sceneDate.value && sceneDate.value >= sceneDate.max);
    }
}

if (sceneDatePrevEl) sceneDatePrevEl.addEventListener("click", () => { stepSceneDate(-1); updateSceneDateArrowState(); });
if (sceneDateNextEl) sceneDateNextEl.addEventListener("click", () => { stepSceneDate(1); updateSceneDateArrowState(); });
sceneDate.addEventListener("change", updateSceneDateArrowState);

syncSceneDateToToday();
updateSceneDateArrowState();

setInterval(syncSceneDateToToday, 60 * 1000);

/* ---------- Mouse Coordinates ---------- */

const mouseCoordinates=document.getElementById("mouseCoordinates");

map.on("mousemove",(e)=>{

    mouseCoordinates.innerHTML=`
        Lat : ${e.latlng.lat.toFixed(6)}
        <br>
        Lng : ${e.latlng.lng.toFixed(6)}
    `;

});

/* ---------- Logout ---------- */

function handleLogout() {

    const confirmLogout = confirm(
        "Are you sure you want to sign out?"
    );

    if (confirmLogout) {

        // Clear saved login information
        localStorage.removeItem("menro_remembered_user");

        // Redirect to the login page
        window.location.href = "../Login/Login.html";

    }

    // If Cancel is clicked, nothing happens.

}

// btnLogout no longer exists in the top bar — sign out now lives in the
// hamburger drawer (menuSignOut) — but keep this guarded in case a page
// still ships the old button.
const btnLogout = document.getElementById("btnLogout");
if (btnLogout) btnLogout.addEventListener("click", handleLogout);

/* ---------- Right Resizer ---------- */

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

/* ---------- Utility ---------- */

function capitalise(str){

    return str.charAt(0).toUpperCase()+str.slice(1);

}

/* ---------- KoboToolbox Init ---------- */
// Satellite NDVI pipeline (Copernicus stats API) dropped — Kobo field
// surveys are now the only NDVI/status source. Zones with no survey
// yet stay at their initial "pending" / null state below.
async function initWithKobo() {
  captureSatelliteBaseline();

  await fetchKoboData();

  dataReady = true;
  applyDataForDate(sceneDate.value);

  selectZone(ZONES[0]);
}

initWithKobo();

/* ============================================================
   Dashboard modal code (stats, charts, open/close handlers) now
   lives in dashboard.js — loaded separately in satellite.html.
   ============================================================ */

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
    closeDashboard();
    closeGuide();
    closeSideMenu();
  }
});

/* ============================================================
   Map Hamburger Menu — Google Maps-style slide-out drawer.
   Mirrors the existing top bar / right panel controls rather
   than duplicating their logic: each drawer control forwards
   to the original element (dispatching its native event) so
   there is only one source of truth for map/layer state.
   ============================================================ */

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

// ── Drawer action items ────────────────────────────────────
const menuMap        = document.getElementById("menuMap");
const menuDashboard = document.getElementById("menuDashboard");
const menuGuide     = document.getElementById("menuGuide");
const menuExport    = document.getElementById("menuExport");
const menuSyncSatellite = document.getElementById("menuSyncSatellite");
const menuSignOut   = document.getElementById("menuSignOut");

if (menuMap) {
  menuMap.addEventListener("click", () => {
    closeSideMenu();
    closeDashboard(); // defined in Dashboard.js — switches back to the map view
  });
}

if (menuDashboard) {
  menuDashboard.addEventListener("click", () => {
    closeSideMenu();
    openDashboard(); // defined in Dashboard.js
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
    exportPDF(); // defined in export.js
  });
}

if (menuSyncSatellite) {
  menuSyncSatellite.addEventListener("click", () => {
    closeSideMenu();
    syncAllZonesFromSatellite(sceneDateInputValueOrToday());
  });
}

if (menuSignOut) {
  menuSignOut.addEventListener("click", () => {
    closeSideMenu();
    handleLogout();
  });
}

// First-time visit: show the guide automatically once, then remember.
// (Uses a session-scoped flag so it re-appears each new browser session,
// which is reasonable for shared MENRO office computers.)
if (!sessionStorage.getItem("aquaguard_guide_shown")) {
  openGuide();
  sessionStorage.setItem("aquaguard_guide_shown", "1");
}