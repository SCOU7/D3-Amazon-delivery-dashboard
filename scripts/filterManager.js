// scripts/filterManager.js

function initializeFilters() {
  const sidebar = document.getElementById("rightSidebar");

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
        <input type="date" id="startDate"> – 
        <input type="date" id="endDate">
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

  // Set up date range
  const allRoutes = Object.values(appState.stationData).flatMap(s => s.routes);
  const dateList = allRoutes.map(r => r.date).filter(Boolean).sort();
  appState.filters.dateRange = { min: dateList[0], max: dateList[dateList.length - 1] };

  document.getElementById("startDate").value = dateList[0];
  document.getElementById("endDate").value = dateList[dateList.length - 1];
  appState.filters.selectedDateMin = dateList[0];
  appState.filters.selectedDateMax = dateList[dateList.length - 1];

  // Populate zone options
  populateZoneOptions();

  applyFilters();

  // Tag styling
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

function populateZoneOptions() {
  const zoneSet = new Set();
  Object.values(appState.stationData).forEach(station => {
    station.stops.forEach(stop => zoneSet.add(stop.zone_id));
  });
  const zoneSelect = document.getElementById("zoneFilter");
  Array.from(zoneSet).sort().forEach(zone => {
    const opt = document.createElement("option");
    opt.value = zone;
    opt.textContent = zone;
    zoneSelect.appendChild(opt);
  });
}

function applyFilters() {
  const selectedScores = new Set(
    Array.from(document.querySelectorAll("input[type='checkbox']"))
      .filter(cb => cb.checked)
      .map(cb => cb.value)
  );
  appState.filters.routeScores = selectedScores;

  const startDate = document.getElementById("startDate").value;
  const endDate = document.getElementById("endDate").value;
  appState.filters.selectedDateMin = startDate;
  appState.filters.selectedDateMax = endDate;

  const zoneSelect = document.getElementById("zoneFilter");
  appState.filters.zoneIds = new Set(Array.from(zoneSelect.selectedOptions).map(o => o.value));

  const { routeScores, selectedDateMin, selectedDateMax, zoneIds } = appState.filters;

  appState.filteredStationRoutes = appState.stationRoutes.filter(route => {
    const scoreOK = routeScores.has(route.route_score);
    const dateOK = route.date >= selectedDateMin && route.date <= selectedDateMax;
    const stopZones = appState.stationStops
      .filter(s => s.route_id === route.route_id)
      .map(s => s.zone_id);
    const zoneOK = zoneIds.size === 0 || stopZones.some(z => zoneIds.has(z));
    return scoreOK && dateOK && zoneOK;
  });

  // Filter summary
  const summary = [];
  if (routeScores.size < 3) summary.push(`Score: ${[...routeScores].join(", ")}`);
  if (startDate !== appState.filters.dateRange.min || endDate !== appState.filters.dateRange.max)
    summary.push(`Date: ${startDate} – ${endDate}`);
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
  document.getElementById("startDate").value = min;
  document.getElementById("endDate").value = max;
  Array.from(document.getElementById("zoneFilter").options).forEach(o => o.selected = false);

  appState.filters.routeScores = new Set(["High", "Medium", "Low"]);
  applyFilters();
}
