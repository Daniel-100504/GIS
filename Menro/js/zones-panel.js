const zoneShapes={};

// Display-only labels — internal status values (healthy/moderate/degraded/pending)
// stay the same everywhere else (CSS classes, filters, comparisons); only what's
// shown to the user changes.
const STATUS_DISPLAY_LABELS = { healthy: "Good", moderate: "Fair", degraded: "Poor", pending: "Pending" };

const zoneListEl = document.getElementById("zoneList");
const zoneSearchEl = document.getElementById("zoneSearch");
const zoneSearchHintEl = document.getElementById("zoneSearchHint");
const zoneSearchClearEl = document.getElementById("zoneSearchClear");
const zoneStatusFilterEl = document.getElementById("zoneStatusFilter");
const zoneSortEl = document.getElementById("zoneSort");

function updateZoneSearchHint(query, matchCount) {

    if (!zoneSearchHintEl) return;

    if (!query) {
        zoneSearchHintEl.textContent = `Type a zone name to filter`;
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
            sorted.sort((a, b) => (b.satNdvi ?? -1) - (a.satNdvi ?? -1));
            break;
        case "ndvi-asc":
            sorted.sort((a, b) => (a.satNdvi ?? Infinity) - (b.satNdvi ?? Infinity));
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

    if (!zoneListEl) return;

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
                    ${STATUS_DISPLAY_LABELS[zone.status] || capitalise(zone.status)}
                </span>

            </div>

            <div class="zone-meta">
                ${zone.area !== null ? zone.area + " ha" : "— ha"} • NDVI ${zone.satNdvi !== null && zone.satNdvi !== undefined ? formatNdvi(zone.satNdvi) : "Pending"}
            </div>

        `;

        item.onclick=()=>{

            selectZone(zone);

            if (zone._mangroveAreaLayer) {
                map.fitBounds(zone._mangroveAreaLayer.getBounds(), {maxZoom:16});
                zone._mangroveAreaLayer.openPopup();
                return;
            }

            if (zone.lat == null || zone.lng == null || !zoneShapes[zone.id]) return;

            map.setView(
                [zone.lat,zone.lng],
                15,
                {animate:true}
            );

            zoneShapes[zone.id].openPopup();

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
        const el = shape.getElement && shape.getElement();
        if (el) el.classList.toggle("zone-shape-selected", isSelected);
        if (isSelected) shape.bringToFront();
    });

}

function rebuildMapLayers() {
  markersLayer.clearLayers();

  ZONES.forEach(zone => {
    if (zone.lat == null || zone.lng == null) return;
    if (zone._mangroveAreaLayer) return; // has its own real shape/popup already, drawn on the map directly

    const bounds = circleLatLngs(zone.lat, zone.lng, zoneRadiusMeters(zone));
    const polygon = L.polygon(bounds, {
      className: "zone-shape",
      color: STATUS_COLOR[zone.status],
      weight: 0,
      opacity: 0,
      fillColor: STATUS_COLOR[zone.status],
      fillOpacity: 0,
    });
    polygon.bindPopup(() => buildPopup(zone));
    polygon.on("click", () => selectZone(zone));
    polygon.addTo(markersLayer);
    zoneShapes[zone.id] = polygon;
  });

  renderZoneList(zoneSearchEl ? zoneSearchEl.value : "");
}

function applyDataForDate(dateStr) {
  resetZonesToBaseline();

  const submissions = submissionsUpToDate(dateStr);
  if (submissions.length > 0) mergeKoboIntoZones(submissions);

  rebuildMapLayers();
}
