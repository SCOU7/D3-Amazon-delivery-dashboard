// scripts/filterManager.js

function initializeFilters() {
  const sidebar = document.getElementById("rightSidebar");
  sidebar.innerHTML = `
    <h3>Filter</h3>
    <div id="filterContainer">
      <label><input type="checkbox" value="High" checked> High</label><br>
      <label><input type="checkbox" value="Medium" checked> Medium</label><br>
      <label><input type="checkbox" value="Low" checked> Low</label><br>
    </div>
    <button id="applyFilters">Apply</button>
    <button id="resetFilters">Reset</button>
    <div id="filterStatus" style="margin-top: 10px;"></div>
  `;

  document.getElementById("applyFilters").addEventListener("click", applyFilters);
  document.getElementById("resetFilters").addEventListener("click", resetFilters);
  applyFilters(); // apply initially
}

function applyFilters() {
  const checkboxes = document.querySelectorAll("#filterContainer input[type='checkbox']");
  const selectedScores = new Set();
  checkboxes.forEach(cb => {
    if (cb.checked) selectedScores.add(cb.value);
  });
  appState.filters.routeScores = selectedScores;

  if (appState.stationRoutes && Array.isArray(appState.stationRoutes)) {
    appState.filteredStationRoutes = appState.stationRoutes.filter(r =>
      appState.filters.routeScores.has(r.route_score)
    );
  }

  // Logging status
  const statusDiv = document.getElementById("filterStatus");
  statusDiv.textContent = `Filters applied: ${Array.from(selectedScores).join(", ")}`;

  // Re-render charts and map
  updatePieCharts();
  initMap();
}

function resetFilters() {
  // Reset UI checkboxes
  const checkboxes = document.querySelectorAll("#filterContainer input[type='checkbox']");
  checkboxes.forEach(cb => {
    cb.checked = true;
  });

  // Reset internal state
  appState.filters.routeScores = new Set(["High", "Medium", "Low"]);

  // Re-apply filters
  applyFilters();
}
