const SUBMISSIONS_API_URL  = "../API/ranger-submissions.php";

// Zones are now the 6 officially-designated Mangrove Protected Areas
// themselves (not barangays), matching what the ranger survey actually asks
// for. This fallback only covers old-form submissions that recorded a plain
// "Barangay" instead of a specific protected area, and only for barangays
// that host exactly one protected area (Sta. Ana hosts two, so it's ambiguous
// and deliberately left out).
const BARANGAY_TO_ZONE = {
  "bagong_silang":  "bagong-silang",
  "quilitisan":     "conservation-park",
  "balibago":       "rehabilitation",
  "encarnacion":    "encarnacion",
};

// Protected area / Zone answers map to a zone id by keyword, since Kobo's
// auto-generated field value depends on exactly how each option was typed.
const PROTECTED_AREA_TO_ZONE = [
  { match: "bagong_silang",      zoneId: "bagong-silang" },
  { match: "conservation",       zoneId: "conservation-park" },
  { match: "quilitisan",         zoneId: "conservation-park" },
  { match: "palobandera",        zoneId: "palobandera" },
  { match: "rehabilitation",     zoneId: "rehabilitation" },
  { match: "balibago",           zoneId: "rehabilitation" },
  { match: "encarnacion",        zoneId: "encarnacion" },
];

function zoneIdFromProtectedArea(raw) {
  const s = (raw || "").toLowerCase();
  if (!s) return null;
  const hit = PROTECTED_AREA_TO_ZONE.find(k => s.includes(k.match));
  if (hit) return hit.zoneId;
  if (s.includes("sta") && s.includes("ana") && !s.includes("palobandera")) return "sta-ana";
  return null;
}

// Kobo repeat groups come back as an array of objects under whatever key the
// group was given — found generically here instead of hardcoding a group
// name, since that name depends on how the form was built. A native
// submission can also carry a second repeat-group array for mollusks
// (Mollusk_Records) alongside this one, so Species_Records is checked by its
// exact name first — a generic "first array of objects on the record" scan
// could otherwise grab the wrong array depending on key order.
function koboExtractTrees(sub) {
  if (Array.isArray(sub["Species_Records"]) && sub["Species_Records"].length > 0) {
    return sub["Species_Records"];
  }
  for (const key in sub) {
    if (!Object.prototype.hasOwnProperty.call(sub, key)) continue;
    if (key === "Mollusk_Records") continue;
    const value = sub[key];
    // typeof null === "object" in JS, so a plain check would misread a
    // no-GPS submission's "_geolocation":[null,null] as the tree list.
    if (Array.isArray(value) && value.length > 0 && value[0] !== null && typeof value[0] === "object") {
      return value;
    }
  }
  // No repeat-group array on this record — every native submission's
  // vegetation/fauna fields (species, mollusk, seedling, sapling, health
  // assessment, etc.) sit flat on the record itself instead of inside a
  // list, so treat it as a single bucket regardless of which of those
  // fields were actually filled in. Checking only species/tree_code here
  // used to silently drop mollusk/seedling/sapling/health data whenever
  // species name was left blank, even though it was saved correctly.
  return [sub];
}

// A submission can cover more than one plot (matching the real MENRO
// sheet, where one visit measures several numbered plots) — a real
// Plot_Records array (new-format submissions) takes priority; a legacy
// record only ever had one implicit plot, described by its flat
// Plot_No/Plot_Size fields and a single Species_Records list.
function koboExtractPlots(sub) {
  if (Array.isArray(sub["Plot_Records"]) && sub["Plot_Records"].length > 0) {
    return sub["Plot_Records"];
  }
  return [{
    Plot_No: sub["Plot_No"] || "",
    Plot_Size: sub["Plot_Size"] || "",
    Species_Records: koboExtractTrees(sub),
  }];
}

// Mirrors koboExtractTrees, but for the Fauna step's separate mollusk table
// — its own named array (Mollusk_Records) checked first, falling back to a
// single implicit row for a legacy record that only ever had one flat
// mollusk species/count pair.
function koboExtractMollusks(sub) {
  if (Array.isArray(sub["Mollusk_Records"]) && sub["Mollusk_Records"].length > 0) {
    return sub["Mollusk_Records"];
  }
  const species = koboTreeField(sub, "Mollusk_Species_Name") || koboTreeField(sub, "Mollusk_species_name");
  if (species) {
    return [{ Mollusk_Species_Name: species, Mollusk_Count: koboTreeField(sub, "Mollusk_Count") ?? koboTreeField(sub, "Mollusk_count") }];
  }
  return [];
}

function koboTreeField(tree, name) {
  if (tree[name] !== undefined) return tree[name];
  const key = Object.keys(tree).find(k => k.split("/").pop() === name);
  return key ? tree[key] : undefined;
}

// The direct canopy-cover estimate is one answer for the whole survey now,
// not per species/tree — read off the outer record, not the tree. Canopy
// length/width (if present) are still per-tree, kept as a fallback only for
// older Kobo submissions that had those instead of a direct estimate.
function koboCanopyCoverPct(sub, t) {
  const direct = parseFloat(sub["Estimated_Canopy_Cover_"]);
  if (!isNaN(direct)) return Math.min(100, direct);

  const l = parseFloat(koboTreeField(t, "Canopy_Length_m"));
  const w = parseFloat(koboTreeField(t, "Canopy_Width_m"));
  if (isNaN(l) || isNaN(w)) return null;
  const crownArea = Math.PI * (l / 2) * (w / 2);
  return Math.min(100, (crownArea / 100) * 100);
}

function summarizeKoboTrees(trees, sub) {
  const heights = [], gbhs = [], canopyValues = [];
  const speciesSet = new Set();
  let seedling = 0, sapling = 0;

  trees.forEach(t => {
    const sp = koboTreeField(t, "Species_Name") || koboTreeField(t, "Species");
    if (sp) speciesSet.add(sp);
    const h = parseFloat(koboTreeField(t, "Average_Tree_Height_m") || koboTreeField(t, "Height_m"));
    if (!isNaN(h)) heights.push(h);
    const g = parseFloat(koboTreeField(t, "GBH_Girth_at_Breast_Height_cm") || koboTreeField(t, "GBH_cm"));
    if (!isNaN(g)) gbhs.push(g);
    const c = koboCanopyCoverPct(sub, t);
    if (c !== null) canopyValues.push(c);
    seedling += parseFloat(koboTreeField(t, "Seedling_Count") || koboTreeField(t, "Seedling_count")) || 0;
    sapling  += parseFloat(koboTreeField(t, "Sapling_Count")  || koboTreeField(t, "Sapling_count"))  || 0;
  });

  // Mollusks are their own repeat-group array now, not one field per tree —
  // summed separately instead of inside the tree loop above.
  const mollusk = koboExtractMollusks(sub).reduce((a, m) =>
    a + (parseFloat(koboTreeField(m, "Mollusk_Count") || koboTreeField(m, "Mollusk_count")) || 0), 0);

  const avg = (arr) => arr.length ? arr.reduce((a, b) => a + b, 0) / arr.length : null;
  return {
    count: trees.length,
    heights,
    speciesList: [...speciesSet],
    avgHeight: avg(heights),
    avgGbh: avg(gbhs),
    avgCanopyCoverPct: avg(canopyValues),
    mollusk, seedling, sapling,
  };
}

// The survey now asks the ranger to make this call directly (Overall Health
// Assessment), so that answer is trusted first. The old flag-counting
// heuristic (canopy cover + regeneration) only kicks in as a fallback for
// submissions from a form version that didn't ask this question.
function deriveStatus(sub) {
  const direct = (sub["Overall_Health_Assessment"] || "").toLowerCase();
  if (direct === "healthy" || direct === "moderate" || direct === "degraded") return direct;

  const trees = koboExtractTrees(sub);
  if (trees.length === 0) return "pending";

  const summary = summarizeKoboTrees(trees, sub);

  let flags = 0;
  if (summary.avgCanopyCoverPct === null || summary.avgCanopyCoverPct < 40) flags++;
  if (summary.seedling === 0 && summary.sapling === 0) flags++;

  if (flags === 0) return "healthy";
  if (flags === 1) return "moderate";
  return "degraded";
}

let ALL_SUBMISSIONS = [];

async function fetchKoboData() {
  try {
    const res = await fetch(SUBMISSIONS_API_URL);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json();
    ALL_SUBMISSIONS = data.results || [];
    setConnectionStatus(true);
    if (typeof onSubmissionsUpdated === "function") onSubmissionsUpdated();
    return ALL_SUBMISSIONS;
  } catch (err) {
    console.warn("Submissions fetch failed — showing last available data until the server is reachable.", err);
    setConnectionStatus(false);
    return null;
  }
}

async function refreshAfterReconnect() {
  await fetchKoboData();
  dataReady = true;
  if (typeof applyDataForDate === "function") applyDataForDate(sceneDate.value);
  if (typeof renderDashboard === "function") renderDashboard();
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

  connectionStatusEl.classList.remove("online", "offline");
  connectionStatusEl.classList.add(online ? "online" : "offline");
  connectionStatusEl.title = online
    ? "Connected, live field survey data"
    : "Offline, showing last available data";

  if (connectionStatusIconEl) connectionStatusIconEl.innerHTML = online ? ICON_ONLINE : ICON_OFFLINE;
  if (connectionStatusTextEl) connectionStatusTextEl.textContent = online ? "Online" : "Offline";
}

setConnectionStatus(navigator.onLine);

window.addEventListener("online", () => {
  const wasOffline = isOnline === false;
  setConnectionStatus(true);
  if (wasOffline) refreshAfterReconnect();
});
window.addEventListener("offline", () => {
  setConnectionStatus(false);
  if (typeof showDataWarning === "function") {
    showDataWarning("You're offline. Showing last available data.");
  }
});

async function pingBackend() {
  const wasOffline = isOnline === false;
  try {
    const res = await fetch(SUBMISSIONS_API_URL, { method: "HEAD", cache: "no-store" });
    setConnectionStatus(res.ok);
    if (res.ok && wasOffline) await refreshAfterReconnect();
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
    zone.ndviDelta        = null;
    zone.ndviPreviousDate = null;
    zone.lastRanger   = "—";
    zone.lastDate     = "—";
    zone.transect     = "—";
    zone.canopyCover  = "—";
    zone.speciesName  = "—";
    zone.treeCount    = "—";
    zone.waterColor   = "—";
    zone.aquafarmNear = "—";
    zone.notes        = "—";
    zone.threats      = "—";
    zone.lastSubmissionId = null;
    zone.approvalStatus = null;
    zone.reviewedAt      = null;
    zone.needsAttention       = false;
    zone.needsAttentionReason = "";
  });
}

function koboSubmissionDate(sub) {
  return sub["Date_of_visit"] || sub["Inspection_Date"] || "";
}

function submissionsUpToDate(dateStr) {
  if (!dateStr) return ALL_SUBMISSIONS;
  return ALL_SUBMISSIONS.filter(sub => {
    const d = koboSubmissionDate(sub);
    return d && d <= dateStr;
  });
}

function latestSubmissionByZone(submissions) {
  const byZone = {};

  submissions.forEach(sub => {
    // The current survey has no zone question — the backend already worked
    // out the nearest field-mapped area from the ranger's GPS point and
    // stamped it onto the record as _zone_id. Older submissions (from a form
    // version that did ask directly) fall back to that text match instead.
    const areaRaw = sub["Protected_area_Zone"] || sub["Barangay"] || "";
    const zoneId  = sub["_zone_id"] || zoneIdFromProtectedArea(areaRaw) || BARANGAY_TO_ZONE[areaRaw];
    if (!zoneId) {
      console.warn(`KoboToolbox: submission has unrecognized zone "${areaRaw}" — no matching zone, submission skipped.`);
      return;
    }

    const existing = byZone[zoneId];
    const subDate  = koboSubmissionDate(sub);

    if (!existing || subDate > koboSubmissionDate(existing)) {
      byZone[zoneId] = sub;
    }
  });

  return byZone;
}

// Every submission for one zone, newest first — unlike latestSubmissionByZone
// above, nothing here gets discarded, so this is what the zone history view
// in the map popup reads from.
function zoneSubmissionHistory(zoneId) {
  return ALL_SUBMISSIONS.filter(sub => {
    const areaRaw = sub["Protected_area_Zone"] || sub["Barangay"] || "";
    const subZoneId = sub["_zone_id"] || zoneIdFromProtectedArea(areaRaw) || BARANGAY_TO_ZONE[areaRaw];
    return subZoneId === zoneId;
  }).sort((a, b) => koboSubmissionDate(b).localeCompare(koboSubmissionDate(a)));
}

// Same zoneId grouping as latestSubmissionByZone, but keeps every submission
// (newest first) instead of discarding all but the latest — this is what
// decides the "needs attention" flag below, scoped to whatever date range
// mergeKoboIntoZones was called with (so it respects the scene-date picker
// the same way every other zone field already does).
function groupSubmissionsByZone(submissions) {
  const byZone = {};
  submissions.forEach(sub => {
    const areaRaw = sub["Protected_area_Zone"] || sub["Barangay"] || "";
    const zoneId  = sub["_zone_id"] || zoneIdFromProtectedArea(areaRaw) || BARANGAY_TO_ZONE[areaRaw];
    if (!zoneId) return;
    if (!byZone[zoneId]) byZone[zoneId] = [];
    byZone[zoneId].push(sub);
  });
  Object.values(byZone).forEach(list =>
    list.sort((a, b) => koboSubmissionDate(b).localeCompare(koboSubmissionDate(a)))
  );
  return byZone;
}

function submissionTreeTotal(sub) {
  const plots = koboExtractPlots(sub);
  const allTrees = plots.flatMap(p => p["Species_Records"] || []);
  return allTrees.reduce((sum, t) => sum + (Number(koboTreeField(t, "Tree_Count")) || 0), 0);
}

// Flags a zone for MENRO's attention — not AI, just two plain signals the
// panel asked about directly: an unresolved threat report, or a tree count
// that dropped since the previous survey. Needs at least one past survey to
// compare against, so a zone's very first submission never triggers the
// decline check (nothing to compare it to yet).
function zoneNeedsAttention(history) {
  if (!history || history.length === 0) return { flag: false, reason: "" };

  const latest = history[0];
  const latestAlerts = typeof submissionAlerts === "function" ? submissionAlerts(latest) : [];
  const unresolvedThreat = latestAlerts.length > 0 && !latest["_alert_reviewed"];

  let declining = false;
  if (history.length >= 2) {
    declining = submissionTreeTotal(latest) < submissionTreeTotal(history[1]);
  }

  if (unresolvedThreat && declining) {
    return { flag: true, reason: "Unresolved threat reported, and tree count dropped since the last survey" };
  }
  if (unresolvedThreat) {
    return { flag: true, reason: "Unresolved threat reported in the latest survey" };
  }
  if (declining) {
    return { flag: true, reason: "Tree count dropped since the last survey" };
  }
  return { flag: false, reason: "" };
}

function mergeKoboIntoZones(submissions) {
  const byZone = latestSubmissionByZone(submissions);
  const historyByZone = groupSubmissionsByZone(submissions);

  ZONES.forEach(zone => {
    const sub = byZone[zone.id];
    if (!sub) return;

    const gps = sub["Record_your_current_location"] || sub["GPS_location"] || sub["GPS"];
    if (gps) {
      const parts = gps.split(" ").map(Number);
      if (!isNaN(parts[0]) && !isNaN(parts[1])) {
        zone.lat = parts[0];
        zone.lng = parts[1];
      }
    }

    const trees   = koboExtractTrees(sub);
    const summary = summarizeKoboTrees(trees, sub);
    const aquafarmRaw = sub["Nearby_aquafarm_activity"] || sub["Nearby_Aquafarm_Activity"] || "";

    // zone.ndvi is intentionally left alone here — it's only ever set from real
    // satellite data (zone.satNdvi, via fetchZoneNdviFromCopernicus in map-core.js).
    // A ranger's field measurements are not an NDVI value and shouldn't be labeled as one.

    zone.status = deriveStatus(sub);

    zone.lastRanger    = sub["Ranger_Name"]  || zone.lastRanger || "—";
    zone.lastDate      = koboSubmissionDate(sub) || zone.lastDate || "—";
    zone.transect      = sub["Plot_number"]  || zone.transect   || "—";
    zone.canopyCover   = summary.avgCanopyCoverPct !== null ? `${Math.round(summary.avgCanopyCoverPct)}%` : "—";
    zone.speciesName   = summary.speciesList.length ? summary.speciesList.join(", ") : (zone.speciesName || "—");
    zone.treeCount     = summary.count || zone.treeCount || "—";
    zone.waterColor    = sub["Water_Color"] ? sub["Water_Color"].replace(/_/g," ") : "—";
    zone.aquafarmNear  = aquafarmRaw ? aquafarmRaw.replace(/_/g," ") : "—";
    zone.notes         = [sub["Additional_Notes"], sub["Water_Quality_Notes"] || sub["Water_quality_notes"]]
      .filter(Boolean).join(" — ") || zone.notes || "—";
    zone.threats       = (typeof observedThreatsDisplay === "function"
      ? observedThreatsDisplay(sub["Observed_Threats"], sub["Observed_Threats_Other"])
      : null) || zone.threats || "—";
    zone.lastSubmissionId = sub["_id"] != null ? String(sub["_id"]) : (zone.lastSubmissionId || null);
    zone.approvalStatus   = sub["_approval_status"] || "pending";
    zone.reviewedAt       = sub["_reviewed_at"] || null;

    const attention = zoneNeedsAttention(historyByZone[zone.id] || []);
    zone.needsAttention       = attention.flag;
    zone.needsAttentionReason = attention.reason;
  });

  console.log(`KoboToolbox: merged ${Object.keys(byZone).length} zone(s) from ${submissions.length} submission(s).`);
}

// Source: MENRO "Updated List of Fishponds in Calatagan 2026" + FLA list.
// activeHectares/activeCount only count entries NOT marked "Stop operation".
// Risk level is derived from active hectares nearby: high >= 20, moderate 5-19.9,
// low 0.1-4.9, none 0. Zones with no fishpond entries in the source list at all
// (bagong-silang, baha, talibayog, sambungan) are "none" by default.
const AQUAFARM_REGISTRY = {
  "balibago":      { activeCount: 4, activeHectares: 12.9,  inactiveCount: 2, risk: "moderate" },
  "talisay":       { activeCount: 4, activeHectares: 15.8,  inactiveCount: 1, risk: "moderate" },
  "carretunan":    { activeCount: 0, activeHectares: 0,     inactiveCount: 3, risk: "none" },
  "quilitisan":    { activeCount: 0, activeHectares: 0,     inactiveCount: 1, risk: "none" },
  "gulod":         { activeCount: 1, activeHectares: 16,    inactiveCount: 0, risk: "moderate", note: "1 salt operation, not aquaculture" },
  "balitoc":       { activeCount: 5, activeHectares: 29.5,  inactiveCount: 1, risk: "high" },
  "poblacion-1":   { activeCount: 1, activeHectares: 2,     inactiveCount: 4, risk: "low" },
  "poblacion-2":   { activeCount: 0, activeHectares: 0,     inactiveCount: 2, risk: "none" },
  "poblacion-3":   { activeCount: 1, activeHectares: 4.08,  inactiveCount: 1, risk: "low" },
  "poblacion-4":   { activeCount: 0, activeHectares: 0,     inactiveCount: 1, risk: "none" },
  "tanagan":       { activeCount: 7, activeHectares: 25.16, inactiveCount: 0, risk: "high" },
  "sta-ana":       { activeCount: 0, activeHectares: 0,     inactiveCount: 5, risk: "none" },
  "bagong-silang": { activeCount: 0, activeHectares: 0,     inactiveCount: 0, risk: "none" },
  "bucal":         { activeCount: 1, activeHectares: 40,    inactiveCount: 3, risk: "high" },
  "encarnacion":   { activeCount: 0, activeHectares: 0,     inactiveCount: 1, risk: "none" },
  "baha":          { activeCount: 0, activeHectares: 0,     inactiveCount: 0, risk: "none" },
  "talibayog":     { activeCount: 0, activeHectares: 0,     inactiveCount: 0, risk: "none" },
  "sambungan":     { activeCount: 0, activeHectares: 0,     inactiveCount: 0, risk: "none" },
  "hukay":         { activeCount: 1, activeHectares: 2,     inactiveCount: 1, risk: "low" },
};

const STATUS_COLOR = {
  healthy: "#1c7d61",
  moderate: "#c98a2c",
  degraded: "#c1473a",
  pending: "#93a29b"
};
