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
  },

  filteredStationRoutes: []
};

function setLevel(newLevel) {
  appState.currentLevel = newLevel;
  document.getElementById("currentLevelLabel").textContent =
    `${newLevel} ${newLevel === 1 ? '(Nation)' :
                 newLevel === 2 ? '(Station)' :
                 '(Route)'}`;
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

function handleBackNavigation() {
  if (appState.currentLevel === 3) {
    clearRouteData();
    setLevel(2);
    initMap();
  } else if (appState.currentLevel === 2) {
    clearStationData();
    setLevel(1);
    initMap();
  } else {
    console.log("Already at Level 1; no further back to go.");
  }
}
