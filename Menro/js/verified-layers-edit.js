// Lets a menro officer fix a wrong boundary (drag corners) and add/update a
// name on the two verified reference layers — the 6 official Protected Areas
// and the satellite-derived Mangrove Extent patches. No add/delete here: both
// layers keep a fixed set of shapes, only their boundary/name can change.
// One toolbar button covers both layers — clicking a shape auto-detects which
// layer it belongs to, instead of needing a separate button per layer.

const VERIFIED_LAYER_CONFIG = {
  protected_area: {
    api: "../API/protected-areas.php",
    featureGroup: () => officialAreasLayer,
    getName: (layer) => (layer._protectedAreaProps && layer._protectedAreaProps.name) || "",
    getId: (layer) => layer._protectedAreaId,
    rebind: (layer, name) => {
      const updatedProps = Object.assign({}, layer._protectedAreaProps, { name });
      bindProtectedAreaPopup(layer, updatedProps);
    },
    namePlaceholder: "Protected area name",
    nameRequired: true,
  },
  mangrove_extent: {
    api: "../API/mangrove-extent.php",
    featureGroup: () => mangroveExtentLayer,
    getName: (layer) => layer._mangroveExtentName || "",
    getId: (layer) => layer._mangroveExtentId,
    rebind: (layer, name) => bindMangroveExtentPopup(layer, name),
    namePlaceholder: "Name this patch (optional)",
    nameRequired: false,
  },
};

let verifiedEditLayer = null;
let verifiedEditType = null;
let verifiedEditOriginalLatLngs = null;

const verifiedEditPanel     = document.getElementById("verifiedEditPanel");
const verifiedEditNameInput = document.getElementById("verifiedEditNameInput");
const btnCancelVerifiedEdit = document.getElementById("btnCancelVerifiedEdit");
const btnSaveVerifiedEdit   = document.getElementById("btnSaveVerifiedEdit");

function startVerifiedEdit(type, layer) {
  const config = VERIFIED_LAYER_CONFIG[type];
  verifiedEditType = type;
  verifiedEditLayer = layer;
  verifiedEditOriginalLatLngs = JSON.parse(JSON.stringify(layer.getLatLngs()));

  layer.closePopup();
  layer.editing.enable();
  document.body.classList.add("mangrove-editing-active");

  if (verifiedEditNameInput) {
    verifiedEditNameInput.value = config.getName(layer);
    verifiedEditNameInput.placeholder = config.namePlaceholder;
  }
  if (verifiedEditPanel) verifiedEditPanel.hidden = false;
}

function stopVerifiedEdit() {
  if (verifiedEditLayer && verifiedEditLayer.editing) {
    verifiedEditLayer.editing.disable();
  }
  document.body.classList.remove("mangrove-editing-active");
  verifiedEditLayer = null;
  verifiedEditType = null;
  verifiedEditOriginalLatLngs = null;
  if (verifiedEditPanel) verifiedEditPanel.hidden = true;
}

if (btnCancelVerifiedEdit) {
  btnCancelVerifiedEdit.addEventListener("click", () => {
    if (verifiedEditLayer && verifiedEditOriginalLatLngs) {
      verifiedEditLayer.setLatLngs(verifiedEditOriginalLatLngs);
    }
    stopVerifiedEdit();
  });
}

if (btnSaveVerifiedEdit) {
  btnSaveVerifiedEdit.addEventListener("click", () => {
    if (!verifiedEditLayer || !verifiedEditType) return;

    const config = VERIFIED_LAYER_CONFIG[verifiedEditType];
    const name = verifiedEditNameInput ? verifiedEditNameInput.value.trim() : "";
    if (config.nameRequired && !name) return;

    const layer = verifiedEditLayer;
    const geometry = layer.toGeoJSON().geometry;
    const body = new URLSearchParams({
      action: "update",
      id: config.getId(layer),
      name: name,
      geometry: JSON.stringify(geometry),
    });

    fetch(config.api, { method: "POST", body })
      .then(res => res.json())
      .then(data => {
        if (data.success) {
          config.rebind(layer, name || config.getName(layer));
        } else {
          alert(data.error || "Could not save changes to this shape.");
        }
        stopVerifiedEdit();
      })
      .catch(() => {
        alert("Could not save changes to this shape.");
        stopVerifiedEdit();
      });
  });
}
