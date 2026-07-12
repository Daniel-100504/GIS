/* ============================================================
   KOBOTOOLBOX INTEGRATION
   ============================================================
   1. Replace KOBO_TOKEN with your token from:
      https://kf.kobotoolbox.org/token/
   2. Form UID is already set from your URL.
   3. Run on a server (XAMPP) — not file:// — to avoid CORS.
      If CORS blocks, use kobo-proxy.php (see README comment below).
   ============================================================ */

// NOTE: the KoboToolbox token lives only in kobo-proxy.php now.
// Never put it here — anything in a .js file is visible to every
// visitor via "View Source" / DevTools.
const KOBO_API_URL  = "kobo-proxy.php";

/* ---------- Barangay name → Zone ID map ---------- */
// Maps KoboToolbox choice names to your ZONES array IDs
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

/* ---------- Derive health status from field data ---------- */
// Since your form has no direct NDVI field, we estimate from
// canopy cover % and observed threats.
function deriveStatus(sub) {
  const cover   = parseFloat(sub["Estimated_Canopy_Cover_"]) || 0;
  const threats = sub["Observed_Threats"] || "none_observed";

  const hasBadThreat = ["illegal_cutting", "debris___waste_dumping"].includes(threats);

  if (cover >= 60 && !hasBadThreat)  return "healthy";
  if (cover >= 30 || !hasBadThreat)  return "moderate";
  return "degraded";
}

/* ---------- Estimate NDVI proxy from canopy cover ---------- */
function coverToNDVI(cover) {
  // Rough linear scale: 0% cover → 0.10, 100% cover → 0.85
  const pct = Math.min(Math.max(parseFloat(cover) || 0, 0), 100);
  return +(0.10 + (pct / 100) * 0.75).toFixed(2);
}

/* ---------- Fetch submissions from KoboToolbox ---------- */
let ALL_SUBMISSIONS = []; // raw, unmerged — used by the dashboard

async function fetchKoboData() {
  try {
    const res = await fetch(KOBO_API_URL);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json();
    ALL_SUBMISSIONS = data.results || [];
    return ALL_SUBMISSIONS;
  } catch (err) {
    console.warn("KoboToolbox fetch failed — using default data.", err);
    ALL_SUBMISSIONS = [];
    return null;
  }
}

/* ---------- Merge KoboToolbox submissions into ZONES ---------- */
function mergeKoboIntoZones(submissions) {
  // Group submissions by barangay — keep most recent per zone
  const byZone = {};

  submissions.forEach(sub => {
    const barangay = sub["Barangay"] || "";
    const zoneId   = BARANGAY_TO_ZONE[barangay];
    if (!zoneId) return;

    const existing = byZone[zoneId];
    const subDate  = sub["Inspection_Date"] || "";

    // Keep only the most recent submission per zone
    if (!existing || subDate > (existing["Inspection_Date"] || "")) {
      byZone[zoneId] = sub;
    }
  });

  // Apply to ZONES
  ZONES.forEach(zone => {
    const sub = byZone[zone.id];
    if (!sub) return;

    // GPS — KoboToolbox format: "lat lng altitude accuracy"
    const gps = sub["GPS"];
    if (gps) {
      const parts = gps.split(" ").map(Number);
      if (!isNaN(parts[0]) && !isNaN(parts[1])) {
        zone.lat = parts[0];
        zone.lng = parts[1];
      }
    }

    // NDVI proxy from canopy cover
    if (sub["Estimated_Canopy_Cover_"]) {
      zone.ndvi = coverToNDVI(sub["Estimated_Canopy_Cover_"]);
    }

    // Health status from canopy + threats
    zone.status = deriveStatus(sub);

    // Ranger / inspection info stored for popup display
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

/* ============================================================
   END KOBOTOOLBOX INTEGRATION
   ============================================================ */

const ZONES = [
  {
    id: "balibago",
    name: "Balibago",
    area: 6.22,
    partner: "—",
    ndvi: 0.59,
    status: "healthy",
    change: "+0.01",
    lat: 13.8730,
    lng: 120.6300,
  },
  {
    id: "talisay",
    name: "Talisay",
    area: 6.93,
    partner: "—",
    ndvi: 0.58,
    status: "moderate",
    change: "-0.01",
    lat: 13.8650,
    lng: 120.6260,
  },
  {
    id: "carretunan",
    name: "Carretunan",
    area: 23.24,
    partner: "—",
    ndvi: 0.55,
    status: "healthy",
    change: "+0.01",
    lat: 13.8570,
    lng: 120.6230,
  },
  {
    id: "quilitisan",
    name: "Quilitisan",
    area: 6.63,
    partner: "PALITAKAN",
    ndvi: 0.63,
    status: "healthy",
    change: "+0.01",
    lat: 13.8500,
    lng: 120.6210,
  },
  {
    id: "gulod",
    name: "Gulod",
    area: 66.80,
    partner: "—",
    ndvi: 0.37,
    status: "degraded",
    change: "-0.05",
    lat: 13.8450,
    lng: 120.6200,
  },
  {
    id: "balitoc",
    name: "Balitoc",
    area: 7.42,
    partner: "—",
    ndvi: 0.55,
    status: "degraded",
    change: "+0.01",
    lat: 13.8390,
    lng: 120.6210,
  },
  {
    id: "poblacion-1",
    name: "Poblacion 1",
    area: 6.66,
    partner: "—",
    ndvi: 0.57,
    status: "moderate",
    change: "-0.01",
    lat: 13.8340,
    lng: 120.6220,
  },
  {
    id: "poblacion-2",
    name: "Poblacion 2",
    area: 1.69,
    partner: "—",
    ndvi: 0.62,
    status: "healthy",
    change: "+0.01",
    lat: 13.8300,
    lng: 120.6230,
  },
  {
    id: "poblacion-3",
    name: "Poblacion 3",
    area: 29.06,
    partner: "—",
    ndvi: 0.43,
    status: "moderate",
    change: "-0.03",
    lat: 13.8260,
    lng: 120.6240,
  },
  {
    id: "poblacion-4",
    name: "Poblacion 4",
    area: 18.45,
    partner: "—",
    ndvi: 0.48,
    status: "moderate",
    change: "-0.02",
    lat: 13.8220,
    lng: 120.6250,
  },
  {
    id: "tanagan",
    name: "Tanagan",
    area: 5.41,
    partner: "—",
    ndvi: 0.64,
    status: "healthy",
    change: "+0.01",
    lat: 13.8160,
    lng: 120.6270,
  },
  {
    id: "sta-ana",
    name: "Sta. Ana",
    area: 28.63,
    partner: "SAPSAP",
    ndvi: 0.69,
    status: "degraded",
    change: "+0.03",
    lat: 13.8080,
    lng: 120.6300,
  },
  {
    id: "bagong-silang",
    name: "Bagong Silang",
    area: 3.57,
    partner: "SAMMABABA",
    ndvi: 0.72,
    status: "healthy",
    change: "+0.03",
    lat: 13.7970,
    lng: 120.6360,
  },
  {
    id: "bucal-encarnacion",
    name: "Bucal and Encarnacion",
    area: 23.49,
    partner: "SMME",
    ndvi: 0.46,
    status: "moderate",
    change: "-0.02",
    lat: 13.8380,
    lng: 120.6560,
  },
  {
    id: "baha",
    name: "Baha",
    area: 25.14,
    partner: "—",
    ndvi: 0.68,
    status: "healthy",
    change: "+0.02",
    lat: 13.8480,
    lng: 120.6620,
  },
  {
    id: "talibayog",
    name: "Talibayog",
    area: 2.14,
    partner: "—",
    ndvi: 0.61,
    status: "healthy",
    change: "+0.01",
    lat: 13.8560,
    lng: 120.6590,
  },
  {
    id: "sambungan",
    name: "Sambungan",
    area: 6.71,
    partner: "—",
    ndvi: 0.60,
    status: "healthy",
    change: "+0.02",
    lat: 13.8310,
    lng: 120.6490,
  }
];
const SCENE_DATA = {

    "2026-06-26": {
        balibago: 0.59,
        talisay: 0.58,
        carretunan: 0.55,
        quilitisan: 0.63,
        gulod: 0.37,
        balitoc: 0.55,
        "poblacion-1": 0.57,
        "poblacion-2": 0.62,
        "poblacion-3": 0.43,
        "poblacion-4": 0.48,
        tanagan: 0.64,
        "sta-ana": 0.69,
        "bagong-silang": 0.72,
        "bucal-encarnacion": 0.46,
        baha: 0.68,
        talibayog: 0.61,
        sambungan: 0.60
    },

    "2026-06-15": {
        balibago: 0.52,
        talisay: 0.61,
        carretunan: 0.50,
        quilitisan: 0.58,
        gulod: 0.41,
        balitoc: 0.54,
        "poblacion-1": 0.53,
        "poblacion-2": 0.58,
        "poblacion-3": 0.46,
        "poblacion-4": 0.44,
        tanagan: 0.60,
        "sta-ana": 0.66,
        "bagong-silang": 0.69,
        "bucal-encarnacion": 0.42,
        baha: 0.63,
        talibayog: 0.57,
        sambungan: 0.55
    }

};

/* ---------- Colors ---------- */

const STATUS_COLOR = {
  healthy: "#2e7d32",
  moderate: "#f9a825",
  degraded: "#c62828"
};

const CALATAGAN = [13.8300,120.6300];

/* ---------- Map ---------- */

const map = L.map("map",{
    center:CALATAGAN,
    zoom:13,
    zoomControl:false
});

// Zoom control moved to bottom-right (Google Maps convention) so the
// top-left corner is free for the hamburger menu button.
L.control.zoom({ position: "bottomright" }).addTo(map);

/* ---------- Basemaps ---------- */

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

/* ---------- Layer Groups ---------- */

const markersLayer = L.layerGroup().addTo(map);
const ndviLayer = L.layerGroup();


/* ---------- Marker Icon ---------- */

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

/* ---------- NDVI Overlay ---------- */
ZONES.forEach(zone => {

    const color = STATUS_COLOR[zone.status];

    // Scale the circle size according to area (hectares)
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

/* ---------- HTML Escaping ----------
   Field survey values (ranger name, notes, etc.) come from KoboToolbox
   submissions filled out by rangers in the field — treat them as
   untrusted input and escape before inserting into innerHTML. */
function escapeHtml(value) {
  if (value === null || value === undefined) return "—";
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

/* ---------- Popup Builder ---------- */
function buildPopup(zone) {
  const hasKobo = zone.lastRanger && zone.lastRanger !== "—";
  const koboRows = hasKobo ? `
    <tr style="border-top:1px solid #eee"><td colspan="2" style="padding-top:6px;font-weight:700;color:#555;font-size:0.75rem;">FIELD SURVEY DATA</td></tr>
    <tr><td>Ranger</td><td>${escapeHtml(zone.lastRanger)}</td></tr>
    <tr><td>Date</td><td>${escapeHtml(zone.lastDate)}</td></tr>
    <tr><td>Transect</td><td>${escapeHtml(zone.transect)}</td></tr>
    <tr><td>Canopy Cover</td><td>${escapeHtml(zone.canopyCover)}</td></tr>
    <tr><td>Species</td><td>${escapeHtml(zone.speciesName)}</td></tr>
    <tr><td>Tree Count</td><td>${escapeHtml(zone.treeCount)}</td></tr>
    <tr><td>Threats</td><td>${escapeHtml(zone.threats)}</td></tr>
    <tr><td>Water Color</td><td>${escapeHtml(zone.waterColor)}</td></tr>
    <tr><td>Aquafarm</td><td>${escapeHtml(zone.aquafarmNear)}</td></tr>
    ${zone.notes !== "—" ? `<tr><td>Notes</td><td>${escapeHtml(zone.notes)}</td></tr>` : ""}
  ` : `<tr><td colspan="2" style="color:#999;font-size:0.72rem;padding-top:4px;">No field survey data yet</td></tr>`;

  return `
    <div style="min-width:200px">
      <div class="popup-title">${escapeHtml(zone.name)}</div>
      <table style="width:100%;font-size:0.78rem;border-collapse:collapse">
        <tr><td style="color:#777;padding:2px 6px 2px 0">Partner</td><td style="font-weight:600">${escapeHtml(zone.partner)}</td></tr>
        <tr><td style="color:#777;padding:2px 6px 2px 0">Area</td><td style="font-weight:600">${zone.area} ha</td></tr>
        <tr><td style="color:#777;padding:2px 6px 2px 0">NDVI</td><td style="font-weight:600">${zone.ndvi.toFixed(2)}</td></tr>
        <tr><td style="color:#777;padding:2px 6px 2px 0">Status</td><td style="font-weight:600">${capitalise(zone.status)}</td></tr>
        ${koboRows}
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
                ${zone.area} ha • NDVI ${zone.ndvi.toFixed(2)}
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
   kept on `sceneSummary` since export.js reads them for the PDF cards. */

let sceneSummary = { meanNDVI: "0.00", cloudCover: "8%", healthyCount: 0, atRiskCount: 0 };

function updateSummary(){

    const mean=
        ZONES.reduce((sum,z)=>sum+z.ndvi,0)/ZONES.length;

    const healthy=
        ZONES.filter(z=>z.status==="healthy").length;

    const risk=
        ZONES.filter(z=>z.status==="degraded").length;

    sceneSummary = {
        meanNDVI: mean.toFixed(2),
        cloudCover: "8%",
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
    { label: "Healthy",  status: "healthy",  color: "#2e7d32" },
    { label: "Moderate", status: "moderate", color: "#f9a825" },
    { label: "Degraded", status: "degraded", color: "#c62828" },
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
let sceneDateManuallySet = false; // true once the user picks a date themselves

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
        updateSceneByDate(today);
    }
}

sceneDate.addEventListener("change",(e)=>{

    sceneDateManuallySet = true;
    updateSceneByDate(e.target.value);

});

syncSceneDateToToday();

// Re-check once a minute — cheap, and catches the midnight rollover
// on a MENRO office computer that's left open all day.
setInterval(syncSceneDateToToday, 60 * 1000);

// Thresholds mirrored from updateNDVIBar()'s comment:
// Healthy >= 0.60, Moderate 0.40–0.59, Degraded < 0.40
function statusFromNDVI(ndvi) {
    if (ndvi >= 0.60) return "healthy";
    if (ndvi >= 0.40) return "moderate";
    return "degraded";
}

function updateSceneByDate(date){

    const sceneValues = SCENE_DATA[date];

    if (!sceneValues) {
        console.warn(`No scene data for ${date} — keeping current values.`);
        return;
    }

    ZONES.forEach(zone => {
        const newNdvi = sceneValues[zone.id];
        if (newNdvi === undefined) return;

        const oldNdvi = zone.ndvi;
        zone.ndvi = newNdvi;
        zone.status = statusFromNDVI(newNdvi);
        zone.change = (newNdvi - oldNdvi >= 0 ? "+" : "") + (newNdvi - oldNdvi).toFixed(2);
    });

    // Rebuild markers + NDVI circles with the new status/colors
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
    updateSummary();

    console.log("Scene updated:", date);

}

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
async function initWithKobo() {
  const submissions = await fetchKoboData();

  if (submissions && submissions.length > 0) {
    mergeKoboIntoZones(submissions);

    // Rebuild markers with updated zone data
    markersLayer.clearLayers();
    ndviLayer.clearLayers();

    ZONES.forEach(zone => {
      // Rebuild NDVI circle
      const color  = STATUS_COLOR[zone.status];
      const radius = Math.sqrt(zone.area) * 100;
      L.circle([zone.lat, zone.lng], {
        radius, color, fillColor: color, fillOpacity: 0.35, weight: 1
      }).bindPopup(() => buildPopup(zone)).addTo(ndviLayer);

      // Rebuild marker
      const marker = L.marker([zone.lat, zone.lng], { icon: makeIcon(zone.status) });
      marker.bindPopup(() => buildPopup(zone));
      marker.on("click", () => selectZone(zone));
      marker.addTo(markersLayer);
      markers[zone.id] = marker;
    });

    // Rebuild zone list (keep current search filter applied, if any)
    renderZoneList(zoneSearchEl ? zoneSearchEl.value : "");
  } else {
    console.warn("Using default zone data (no KoboToolbox submissions).");
  }

  updateSummary();
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
const menuDashboard = document.getElementById("menuDashboard");
const menuGuide     = document.getElementById("menuGuide");
const menuExport    = document.getElementById("menuExport");
const menuSignOut   = document.getElementById("menuSignOut");

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