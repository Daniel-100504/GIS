const markers={};
const zoneShapes={};

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
            sorted.sort((a, b) => (b.area ?? -1) - (a.area ?? -1));
            break;
        case "area-asc":
            sorted.sort((a, b) => (a.area ?? Infinity) - (b.area ?? Infinity));
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
                ${zone.area !== null ? zone.area + " ha" : "— ha"} • NDVI ${zone.ndvi !== null ? zone.ndvi.toFixed(2) : "Pending"}
            </div>

        `;

        item.onclick=()=>{

            selectZone(zone);

            if (zone.lat == null || zone.lng == null || !markers[zone.id]) return;

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

    Object.entries(zoneShapes).forEach(([id, shape]) => {
        const isSelected = id === zone.id;
        shape.setStyle({
            weight: isSelected ? 3 : 2,
            fillOpacity: isSelected ? 0.4 : 0.16,
        });
        const el = shape.getElement && shape.getElement();
        if (el) el.classList.toggle("zone-shape-selected", isSelected);
        if (isSelected) shape.bringToFront();
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

function rebuildMapLayers() {
  markersLayer.clearLayers();

  ZONES.forEach(zone => {
    if (zone.lat == null || zone.lng == null) return;

    const bounds = circleLatLngs(zone.lat, zone.lng, zoneRadiusMeters(zone));
    const polygon = L.polygon(bounds, {
      className: "zone-shape",
      color: STATUS_COLOR[zone.status],
      weight: 2,
      opacity: 0.9,
      fillColor: STATUS_COLOR[zone.status],
      fillOpacity: 0.16,
    });
    polygon.bindPopup(() => buildPopup(zone));
    polygon.on("click", () => selectZone(zone));
    polygon.addTo(markersLayer);
    zoneShapes[zone.id] = polygon;

    const point = L.marker([zone.lat, zone.lng], { icon: makeIcon(zone.status) });
    point.bindPopup(() => buildPopup(zone));
    point.bindTooltip(zone.name, {
      permanent: true,
      direction: "top",
      offset: [0, -9],
      className: "zone-label"
    });
    point.on("click", () => selectZone(zone));
    point.addTo(markersLayer);
    markers[zone.id] = point;
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
