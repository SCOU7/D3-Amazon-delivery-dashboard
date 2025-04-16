// scripts/stateManager.js

// === App State ===
export const appState = {
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

  filteredStationRoutes: [],
  scatterAxes: { x: "total_transit_time_sec", y: "total_service_time_sec" }
};

// === Imports ===
import { renderScatterPlot } from './scatterPlot.js';
import { updatePieCharts } from './pieCharts.js';
import { initMap } from './mapManager.js';
import { applyFilters, populateZoneOptionsFromCurrentStation } from './filterManager.js';

// === Level Control ===
export function setLevel(newLevel) {
  appState.currentLevel = newLevel;

  const label = newLevel === 1 ? "(Nation)"
              : newLevel === 2 ? "(Station)"
              : "(Route)";
  document.getElementById("currentLevelLabel").textContent = `${newLevel} ${label}`;

  const filterSidebar = document.getElementById("rightSidebar");
  if (filterSidebar) {
    filterSidebar.style.display = (newLevel === 2) ? "block" : "none";
  }

  if (newLevel === 1) {
    renderScatterPlot();
    updatePieCharts();
    initMap();
  } else if (newLevel === 2) {
    populateZoneOptionsFromCurrentStation();
    applyFilters(); // Will call updatePieCharts, renderScatterPlot, initMap
  } else if (newLevel === 3) {
    renderScatterPlot();
    updatePieCharts();
    initMap();
  }
}

// === State Reset Helpers ===
export function clearStationData() {
  appState.stationRoutes = [];
  appState.stationStops = [];
  appState.stationSequences = [];
  appState.selectedStation = null;
  appState.filteredStationRoutes = [];
}

export function clearRouteData() {
  appState.selectedRoute = null;
  appState.routeTravelTimes = null;
  appState.routeStops = [];
  appState.routePackages = [];
}

// === Back Button Navigation ===
export function handleBackNavigation() {
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
