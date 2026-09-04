const AUTH_API = "../../Login/Database/api.php";

(async function enforceMenroSession() {
    try {
        const res = await fetch(`${AUTH_API}?action=checkSession`);
        const data = await res.json();
        if (!data.success || data.user.role !== "menro") {
            window.location.href = "../../Login/Login.html";
        }
    } catch (err) {
        window.location.href = "../../Login/Login.html";
    }
})();

function handleLogout() {
    openSignOutConfirm();
}

const signOutOverlay    = document.getElementById("signOutOverlay");
const btnCloseSignOut   = document.getElementById("btnCloseSignOut");
const btnCancelSignOut  = document.getElementById("btnCancelSignOut");
const btnConfirmSignOut = document.getElementById("btnConfirmSignOut");

function openSignOutConfirm() {
    if (signOutOverlay) signOutOverlay.classList.add("open");
}

function closeSignOutConfirm() {
    if (signOutOverlay) signOutOverlay.classList.remove("open");
}

function confirmSignOut() {
    fetch(`${AUTH_API}?action=logout`, { method: "POST" }).catch(() => {});
    localStorage.removeItem("aquaguard_current_user");
    window.location.href = "../../Login/Login.html";
}

(function displayLoggedInUser() {
    const sideMenuAccountName = document.getElementById("sideMenuAccountName");
    const sideMenuAvatar = document.getElementById("sideMenuAvatar");
    if (!sideMenuAccountName || !sideMenuAvatar) return;

    try {
        const stored = localStorage.getItem("aquaguard_current_user");
        if (!stored) return;

        const user = JSON.parse(stored);
        const displayName = user.fullName || user.username;
        if (!displayName) return;

        sideMenuAccountName.textContent = displayName;
        sideMenuAvatar.textContent = displayName.charAt(0).toUpperCase();
    } catch (err) {
        // Malformed or missing stored user info — leave the default placeholder as-is.
    }
})();

if (btnCloseSignOut)   btnCloseSignOut.addEventListener("click", closeSignOutConfirm);
if (btnCancelSignOut)  btnCancelSignOut.addEventListener("click", closeSignOutConfirm);
if (btnConfirmSignOut) btnConfirmSignOut.addEventListener("click", confirmSignOut);
if (signOutOverlay) {
    signOutOverlay.addEventListener("click", (e) => {
        if (e.target === signOutOverlay) closeSignOutConfirm();
    });
}

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

const guideOverlay  = document.getElementById("guideOverlay");
const btnCloseGuide = document.getElementById("btnCloseGuide");

function openGuide() {
  guideOverlay.classList.add("open");
}

function closeGuide() {
  guideOverlay.classList.remove("open");
}

if (btnCloseGuide) btnCloseGuide.addEventListener("click", closeGuide);
if (guideOverlay) {
  guideOverlay.addEventListener("click", (e) => {
    if (e.target === guideOverlay) closeGuide();
  });
}

document.addEventListener("keydown", (e) => {
  if (e.key === "Escape") {
    const signOutOpen = document.getElementById("signOutOverlay")?.classList.contains("open");
    if (signOutOpen) {
      closeSignOutConfirm();
      return;
    }
    const exportOpen = document.getElementById("exportReportOverlay")?.classList.contains("open");
    if (exportOpen) {
      closeExportReport();
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
    openExportReport();
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

initIdleLogout(15, confirmSignOut, { overlayClass: "dashboard-overlay" });

// App bootstrap — runs last, after every module above has defined what it needs.
async function initWithKobo() {
  captureSatelliteBaseline();

  await fetchKoboData();

  dataReady = true;
  applyDataForDate(sceneDate.value);

  selectZone(ZONES[0]);
}

initWithKobo();
