// scripts/stateManager.js

const appState = {
  currentLevel: 1,
  stations: [], // Level 1 aggregates
  stationData: {}, // dictionary of station details for level 2

  selectedStation: null,
  stationRoutes: [],
  stationStops: [],
  stationSequences: [],

  selectedRoute: null,
  routeTravelTimes: null,  // dictionary from loadRouteTravelTimes()
  routeStops: [],          // the stops for the selected route
  routePackages: [],       // if we need package data
};

function setLevel(newLevel) {
  appState.currentLevel = newLevel;
  document.getElementById("currentLevelLabel").textContent =
    `${newLevel} ${newLevel === 1 ? '(Nation)' :
                 newLevel === 2 ? '(Station)' :
                 '(Route)'}`;
}

/**
 * Clears station-level data from state, in case we go back to Level 1 or switch stations
 */
function clearStationData() {
  appState.stationRoutes = [];
  appState.stationStops = [];
  appState.stationSequences = [];
  appState.selectedStation = null;
}

/**
 * Clears route-level data when going from L3 -> L2 or L1
 */
function clearRouteData() {
  appState.selectedRoute = null;
  appState.routeTravelTimes = null;
  appState.routeStops = [];
  appState.routePackages = [];
}
