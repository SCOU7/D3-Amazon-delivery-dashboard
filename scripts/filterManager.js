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
        <input type="range" id="dateSlider" min="0" max="100" value="0" step="1" style="width: 100%;">
        <div id="dateRangeLabel" style="font-size: 12px;"></div>
      </div>
    </div>
    <button id="applyFilters">Apply</button>
    <button id="resetFilters">Reset</button>
    <div id="filterStatus" style="margin-top: 10px;"></div>
  `;

  document.getElementById("applyFilters").addEventListener("click", applyFilters);
  document.getElementById("resetFilters").addEventListener("click", resetFilters);

  // Dynamically calculate global date domain
  const allRoutes = Object.values(appState.stationData).flatMap(s => s.routes);
  const dateSet = allRoutes.map(r => r.date).filter(Boolean).sort();
  const minDate = dateSet[0];
  const maxDate = dateSet[dateSet.length - 1];

  appState.filters.dateRange = { min: minDate, max: maxDate };

  const minTS = new Date(minDate).getTime();
  const maxTS = new Date(maxDate).getTime();

  const slider = document.getElementById("dateSlider");
  slider.min = minTS;
  slider.max = maxTS;
  slider.value = maxTS;
  slider.step = 24 * 60 * 60 * 1000; // 1 day step

  const label = document.getElementById("dateRangeLabel");
  label.textContent = `Showing routes before: ${maxDate}`;

  slider.addEventListener("input", () => {
    const d = new Date(+slider.value).toISOString().slice(0, 10);
    label.textContent = `Showing routes before: ${d}`;
  });

  applyFilters(); // apply initially
}

function applyFilters() {
  const checkboxes = document.querySelectorAll("#filterContainer input[type='checkbox']");
  const selectedScores = new Set();
  checkboxes.forEach(cb => {
    if (cb.checked) selectedScores.add(cb.value);
  });
  appState.filters.routeScores = selectedScores;

  const cutoffDate = new Date(+document.getElementById("dateSlider").value);

  if (appState.stationRoutes && Array.isArray(appState.stationRoutes)) {
    appState.filteredStationRoutes = appState.stationRoutes.filter(r => {
      const matchesScore = selectedScores.has(r.route_score);
      const rDate = new Date(r.date);
      return matchesScore && (rDate <= cutoffDate);
    });
  }

  // Display summary
  const status = document.getElementById("filterStatus");
  const cutoffStr = cutoffDate.toISOString().slice(0, 10);
  status.textContent = `Filters applied: Score = [${Array.from(selectedScores).join(", ")}], Date ≤ ${cutoffStr}`;

  updatePieCharts();
  initMap();
}

function resetFilters() {
  // Reset checkboxes
  document.querySelectorAll("#filterContainer input[type='checkbox']")
    .forEach(cb => cb.checked = true);

  // Reset slider
  const max = new Date(appState.filters.dateRange.max).getTime();
  document.getElementById("dateSlider").value = max;
  document.getElementById("dateRangeLabel").textContent = `Showing routes before: ${appState.filters.dateRange.max}`;

  appState.filters.routeScores = new Set(["High", "Medium", "Low"]);

  applyFilters();
}
