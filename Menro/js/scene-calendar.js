const sceneDate = document.getElementById("sceneDate");
let sceneDateManuallySet = false;
let dataReady = false;

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
    syncAllZonesFromSatellite(e.target.value);

});


const calGridEl       = document.getElementById("calGrid");
const calMonthSelectEl = document.getElementById("calMonthSelect");
const calYearSelectEl  = document.getElementById("calYearSelect");
const calMonthPrevEl  = document.getElementById("calMonthPrev");
const calMonthNextEl  = document.getElementById("calMonthNext");

const MONTH_NAMES = ["January","February","March","April","May","June","July","August","September","October","November","December"];

const availableDatesCache = {};

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
