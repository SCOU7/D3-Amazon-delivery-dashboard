// scripts/stateManager.js

const appState = {
  currentLevel: 1,
  stations: [],
  stationData: {},

  selectedStation: null,
  stationRoutes: [],
  stationStops: [],
  stationSequences: [],

  selectedRoute: null,
  routeTravelTimes: null,
  routeStops: [],
  routePackages: [],

  filters: {
    routeScores: new Set(["High", "Medium", "Low"]),
    dateRange: null, // { min, max } from all data
    selectedDateMin: null,
    selectedDateMax: null,
    zoneIds: new Set()
  },

  filteredStationRoutes: []
};

/**
 * setLevel(newLevel):
 *  - Updates appState.currentLevel
 *  - Also triggers the correct rendering for that level
 *    so we never have to manually call “renderScatterPlot()”
 *    or “applyFilters()” in half a dozen places.
 */
function setLevel(newLevel) {
  appState.currentLevel = newLevel;
  document.getElementById("currentLevelLabel").textContent =
    `${newLevel} ${
      newLevel === 1 ? "(Nation)"
      : newLevel === 2 ? "(Station)"
      : "(Route)"
    }`;

  // Show/hide the filter sidebar depending on the level
  const filterSidebar = document.getElementById("rightSidebar");
  if (filterSidebar) {
    filterSidebar.style.display = (newLevel === 2) ? "block" : "none";
  }

  if (newLevel === 1) {
    // Level 1 => Show entire data set in scatter & pies
    // (We do not use filters at L1, so just forcibly re-render them all)
    renderScatterPlot();
    updatePieCharts();
    initMap();

  } else if (newLevel === 2) {
    // Level 2 => We have a selected station’s data in appState
    // We want to ensure zone filter is up to date, then apply filters
    populateZoneOptionsFromCurrentStation();
    applyFilters();  // automatically calls renderScatterPlot, updatePieCharts, initMap

  } else if (newLevel === 3) {
    // Level 3 => single route
    // Usually the map draws that route. If you want to show a single
    // route dot in the scatter, you can call renderScatterPlot() here as well:
    renderScatterPlot();
    updatePieCharts();
    initMap();
  }
}

function clearStationData() {
  appState.stationRoutes = [];
  appState.stationStops = [];
  appState.stationSequences = [];
  appState.selectedStation = null;
  appState.filteredStationRoutes = [];
}

function clearRouteData() {
  appState.selectedRoute = null;
  appState.routeTravelTimes = null;
  appState.routeStops = [];
  appState.routePackages = [];
}

/**
 * handleBackNavigation():
 * Called when the user clicks the “Back” button in the UI
 * We step from level 3→2 or 2→1, then let setLevel handle the rendering.
 */
function handleBackNavigation() {
  if (appState.currentLevel === 3) {
    clearRouteData();
    setLevel(2);
  } else if (appState.currentLevel === 2) {
    clearStationData();
    setLevel(1);
  } else {
    console.log("Already at Level 1; no further back to go.");
  }
}
