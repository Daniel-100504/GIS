const KOBO_API_URL  = "API/kobo-proxy.php";

const BARANGAY_TO_ZONE = {
  "bagong_silang":  "bagong-silang",
  "baha":           "baha",
  "balibago":       "balibago",
  "balitoc":        "balitoc",
  "bucal":          "bucal",
  "encarnacion":    "encarnacion",
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

  if (hasBadThreat) return "degraded";
  if (cover >= 60)  return "healthy";
  if (cover >= 30)  return "moderate";
  return "degraded";
}

function coverToNDVI(cover) {

  const pct = Math.min(Math.max(parseFloat(cover) || 0, 0), 100);
  return +(0.10 + (pct / 100) * 0.75).toFixed(2);
}

let ALL_SUBMISSIONS = [];

async function fetchKoboData() {
  try {
    const res = await fetch(KOBO_API_URL);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json();
    ALL_SUBMISSIONS = data.results || [];
    setConnectionStatus(true);
    return ALL_SUBMISSIONS;
  } catch (err) {
    console.warn("KoboToolbox fetch failed — no submissions available until the proxy is reachable.", err);
    ALL_SUBMISSIONS = [];
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
    zone.satNdvi      = null;
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

function latestSubmissionByZone(submissions) {
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

  return byZone;
}

function mergeKoboIntoZones(submissions) {
  const byZone = latestSubmissionByZone(submissions);

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
    lat: null,
    lng: null,
  },
  {
    id: "talisay",
    name: "Talisay",
    area: 21.31,
    partner: "—",
    ndvi: null,
    status: "pending",
    lat: null,
    lng: null,
  },
  {
    id: "carretunan",
    name: "Carretunan",
    area: 38.72,
    partner: "—",
    ndvi: null,
    status: "pending",
    lat: null,
    lng: null,
  },
  {
    id: "quilitisan",
    name: "Quilitisan",
    area: 25.20,
    partner: "PALITAKAN",
    ndvi: null,
    status: "pending",
    lat: null,
    lng: null,
  },
  {
    id: "gulod",
    name: "Gulod",
    area: 35.32,
    partner: "—",
    ndvi: null,
    status: "pending",
    lat: null,
    lng: null,
  },
  {
    id: "balitoc",
    name: "Balitoc",
    area: 126.88,
    partner: "—",
    ndvi: null,
    status: "pending",
    lat: null,
    lng: null,
  },
  {
    id: "poblacion-1",
    name: "Poblacion 1",
    area: 12.16,
    partner: "—",
    ndvi: null,
    status: "pending",
    lat: null,
    lng: null,
  },
  {
    id: "poblacion-2",
    name: "Poblacion 2",
    area: 1.90,
    partner: "—",
    ndvi: null,
    status: "pending",
    lat: null,
    lng: null,
  },
  {
    id: "poblacion-3",
    name: "Poblacion 3",
    area: 35.37,
    partner: "—",
    ndvi: null,
    status: "pending",
    lat: null,
    lng: null,
  },
  {
    id: "poblacion-4",
    name: "Poblacion 4",
    area: 17.49,
    partner: "—",
    ndvi: null,
    status: "pending",
    lat: null,
    lng: null,
  },
  {
    id: "tanagan",
    name: "Tanagan",
    area: 142.39,
    partner: "—",
    ndvi: null,
    status: "pending",
    lat: null,
    lng: null,
  },
  {
    id: "sta-ana",
    name: "Sta. Ana",
    area: 75.01,
    partner: "SAPSAP",
    ndvi: null,
    status: "pending",
    lat: null,
    lng: null,
  },
  {
    id: "bagong-silang",
    name: "Bagong Silang",
    area: 10.85,
    partner: "SAMMABABA",
    ndvi: null,
    status: "pending",
    lat: null,
    lng: null,
  },
  {
    id: "bucal",
    name: "Bucal",
    area: null,
    partner: "SMME",
    ndvi: null,
    status: "pending",
    lat: null,
    lng: null,
  },
  {
    id: "encarnacion",
    name: "Encarnacion",
    area: null,
    partner: "SMME",
    ndvi: null,
    status: "pending",
    lat: null,
    lng: null,
  },
  {
    id: "baha",
    name: "Baha",
    area: 227.19,
    partner: "—",
    ndvi: null,
    status: "pending",
    lat: null,
    lng: null,
  },
  {
    id: "talibayog",
    name: "Talibayog",
    area: 242.54,
    partner: "—",
    ndvi: null,
    status: "pending",
    lat: null,
    lng: null,
  },
  {
    id: "sambungan",
    name: "Sambungan",
    area: 12.13,
    partner: "—",
    ndvi: null,
    status: "pending",
    lat: null,
    lng: null,
  }
];

const STATUS_COLOR = {
  healthy: "#1c7d61",
  moderate: "#c98a2c",
  degraded: "#c1473a",
  pending: "#93a29b"
};
