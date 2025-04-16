// scripts/filterManager.js

function initializeFilters() {
  const sidebar = document.getElementById("rightSidebar");
  sidebar.style.display = "none"; // Hide by default (only show in Level 2)

  sidebar.innerHTML = `
    <h3>Filter</h3>
    <div id="filterContainer">
      <div>
        <strong>Route Score</strong><br>
        <label><input type="checkbox" value="High" checked> High</label><br>
        <label><input type="checkbox" value="Medium" checked> Medium</label><br>
        <label><input type="checkbox" value="Low" checked> Low</label>
      </div>

      <div style="margin-top: 1em;">
        <strong>Date Range</strong><br>
        <input type="range" id="startDateSlider">
        <input type="range" id="endDateSlider">
        <div id="dateLabel" style="font-size: 12px;"></div>
      </div>

      <div style="margin-top: 1em;">
        <strong>Zone ID</strong><br>
        <select id="zoneFilter" multiple size="5" style="width: 100%;"></select>
      </div>
    </div>

    <button id="applyFilters">Apply</button>
    <button id="resetFilters">Reset</button>
    <div id="filterStatus" style="margin-top: 10px;"></div>
  `;

  document.getElementById("applyFilters").addEventListener("click", applyFilters);
  document.getElementById("resetFilters").addEventListener("click", resetFilters);

  setupDateSliders();

  const style = document.createElement("style");
  style.textContent = `
    .filter-tag {
      display: inline-block;
      background-color: #eef;
      color: #334;
      padding: 2px 6px;
      margin: 2px;
      border-radius: 4px;
      font-size: 11px;
      border: 1px solid #ccd;
    }
  `;
  document.head.appendChild(style);
}

function setupDateSliders() {
  const allRoutes = Object.values(appState.stationData).flatMap(s => s.routes);
  const dates = allRoutes.map(r => new Date(r.date).getTime()).sort((a, b) => a - b);

  const minTS = dates[0];
  const maxTS = dates[dates.length - 1];

  appState.filters.dateRange = { min: minTS, max: maxTS };
  appState.filters.selectedDateMin = minTS;
  appState.filters.selectedDateMax = maxTS;

  const startSlider = document.getElementById("startDateSlider");
  const endSlider = document.getElementById("endDateSlider");

  [startSlider, endSlider].forEach(slider => {
    slider.min = minTS;
    slider.max = maxTS;
    slider.step = 24 * 60 * 60 * 1000; // 1 day
  });

  startSlider.value = minTS;
  endSlider.value = maxTS;

  startSlider.addEventListener("input", updateDateLabel);
  endSlider.addEventListener("input", updateDateLabel);
  updateDateLabel();
}

function updateDateLabel() {
  const min = +document.getElementById("startDateSlider").value;
  const max = +document.getElementById("endDateSlider").value;

  const fmt = ts => new Date(ts).toISOString().slice(0, 10);
  document.getElementById("dateLabel").textContent = `From ${fmt(min)} to ${fmt(max)}`;
}

function populateZoneOptionsFromCurrentStation() {
  const zoneSet = new Set();
  (appState.stationStops || []).forEach(stop => zoneSet.add(stop.zone_id));

  const zoneSelect = document.getElementById("zoneFilter");
  zoneSelect.innerHTML = ""; // clear
  Array.from(zoneSet).sort().forEach(zone => {
    const opt = document.createElement("option");
    opt.value = zone;
    opt.textContent = zone;
    zoneSelect.appendChild(opt);
  });
}

function applyFilters() {
  const selectedScores = new Set(
    Array.from(document.querySelectorAll("input[type='checkbox']")).filter(cb => cb.checked).map(cb => cb.value)
  );
  appState.filters.routeScores = selectedScores;

  const dateMin = +document.getElementById("startDateSlider").value;
  const dateMax = +document.getElementById("endDateSlider").value;
  appState.filters.selectedDateMin = dateMin;
  appState.filters.selectedDateMax = dateMax;

  const zoneSelect = document.getElementById("zoneFilter");
  appState.filters.zoneIds = new Set(Array.from(zoneSelect.selectedOptions).map(o => o.value));

  const { routeScores, selectedDateMin, selectedDateMax, zoneIds } = appState.filters;

  appState.filteredStationRoutes = appState.stationRoutes.filter(route => {
    const scoreOK = routeScores.has(route.route_score);
    const routeTS = new Date(route.date).getTime();
    const dateOK = routeTS >= selectedDateMin && routeTS <= selectedDateMax;
    const zones = appState.stationStops.filter(s => s.route_id === route.route_id).map(s => s.zone_id);
    const zoneOK = zoneIds.size === 0 || zones.some(z => zoneIds.has(z));
    return scoreOK && dateOK && zoneOK;
  });

  const summary = [];
  if (routeScores.size < 3) summary.push(`Score: ${[...routeScores].join(", ")}`);
  if (dateMin !== appState.filters.dateRange.min || dateMax !== appState.filters.dateRange.max)
    summary.push(`Date: ${new Date(dateMin).toISOString().slice(0, 10)} – ${new Date(dateMax).toISOString().slice(0, 10)}`);
  if (zoneIds.size > 0) summary.push(`Zones: ${Array.from(zoneIds).join(", ")}`);

  const status = document.getElementById("filterStatus");
  status.innerHTML = `
    <div style="margin-bottom: 4px;">Filtered ${appState.filteredStationRoutes.length} routes</div>
    ${summary.map(s => `<span class="filter-tag">${s}</span>`).join(" ")}
  `;

  updatePieCharts();
  initMap();
}

function resetFilters() {
  document.querySelectorAll("input[type='checkbox']").forEach(cb => cb.checked = true);

  const { min, max } = appState.filters.dateRange;
  document.getElementById("startDateSlider").value = min;
  document.getElementById("endDateSlider").value = max;
  updateDateLabel();

  Array.from(document.getElementById("zoneFilter").options).forEach(o => o.selected = false);

  appState.filters.routeScores = new Set(["High", "Medium", "Low"]);
  applyFilters();
}
